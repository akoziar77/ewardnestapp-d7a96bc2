import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  nowTimestamp,
  isSameDay,
  daysBetween,
  getGlobalMultiplier,
  toNumber,
  logInfo,
} from "./utils.ts";

// =======================================================
// ENGAGE+ ENGINE — DAILY ENGAGEMENT & STREAK LOGIC
// =======================================================

interface EngageResult {
  streak_count: number;
  points_awarded: number;
  already_checked_in: boolean;
}

export async function engagePlusCheckIn(client: SupabaseClient, userId: string): Promise<EngageResult> {
  const { data: profile } = await client
    .from("profiles")
    .select("nest_points, streak_count, last_check_in")
    .eq("user_id", userId)
    .single();

  if (!profile) throw new Error("Profile not found");

  const today = nowTimestamp();
  const lastCheckIn = profile.last_check_in;

  // Determine streak behavior
  const isFirstEngage = !lastCheckIn;
  const isSameDayEngage = lastCheckIn && isSameDay(lastCheckIn, today);
  const isNextDayEngage = lastCheckIn && daysBetween(lastCheckIn, today) === 1;

  if (isSameDayEngage) {
    return {
      streak_count: profile.streak_count,
      points_awarded: 0,
      already_checked_in: true,
    };
  }

  let newStreak: number;
  if (isFirstEngage || !isNextDayEngage) {
    newStreak = 1;
  } else {
    newStreak = profile.streak_count + 1;
  }

  // Calculate points
  const pointsAwarded = await calculateEngagePlusPoints(client, newStreak);
  const newPoints = profile.nest_points + pointsAwarded;

  // Update profile
  await client
    .from("profiles")
    .update({
      streak_count: newStreak,
      last_check_in: today,
      nest_points: newPoints,
    })
    .eq("user_id", userId);

  // Update tier
  await updateNestTier(client, userId, newPoints);

  // Log activity
  await client.from("nest_activities").insert({
    user_id: userId,
    type: "daily_streak",
    points: pointsAwarded,
  });

  await logInfo(client, "Engage+ streak updated", {
    user_id: userId,
    streak_count: newStreak,
    points_awarded: pointsAwarded,
  });

  return {
    streak_count: newStreak,
    points_awarded: pointsAwarded,
    already_checked_in: false,
  };
}

// =======================================================
// ENGAGE+ POINTS CALCULATION
// =======================================================

async function calculateEngagePlusPoints(client: SupabaseClient, streakCount: number): Promise<number> {
  // Base: streak * 2, minimum 10
  let points = Math.max(streakCount * 2, 10);

  const globalMultiplier = await getGlobalMultiplier(client);
  points *= globalMultiplier;

  return Math.floor(points);
}

// =======================================================
// NEST TIER UPDATE HELPER
// =======================================================

async function updateNestTier(client: SupabaseClient, userId: string, nestPoints: number) {
  let tier = "Hatchling";
  if (nestPoints >= 5000) tier = "Golden Nest";
  else if (nestPoints >= 2000) tier = "Winged";
  else if (nestPoints >= 500) tier = "Feathered";

  await client.from("profiles").update({ tier }).eq("user_id", userId);
}

// =======================================================
// ENGAGE+ SUMMARY FOR USER DASHBOARD
// =======================================================

export interface EngageSummary {
  streak_count: number;
  last_check_in: string | null;
  nest_points: number;
  tier: string;
}

export async function getEngagePlusSummary(client: SupabaseClient, userId: string): Promise<EngageSummary> {
  const { data: profile } = await client
    .from("profiles")
    .select("streak_count, last_check_in, nest_points, tier")
    .eq("user_id", userId)
    .single();

  return {
    streak_count: profile?.streak_count ?? 0,
    last_check_in: profile?.last_check_in ?? null,
    nest_points: profile?.nest_points ?? 0,
    tier: profile?.tier ?? "Hatchling",
  };
}

// =======================================================
// ENGAGE+ RESET (ADMIN TOOL)
// =======================================================

export async function resetEngagePlus(client: SupabaseClient, userId: string) {
  await client
    .from("profiles")
    .update({
      streak_count: 0,
      last_check_in: null,
      nest_points: 0,
      tier: "Hatchling",
    })
    .eq("user_id", userId);

  await logInfo(client, "Engage+ reset for user", { user_id: userId });

  return { success: true };
}
