import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getActiveBoosters,
  getBoosterTierRules,
  getBoosterActionRules,
  isUserTargeted,
  getOrCreateTier,
  toNumber,
  nowTimestamp,
  isSameDay,
  daysBetween,
} from "./utils.ts";

// =======================================================
// BOOSTER ENGINE — CORE PROCESSOR
// =======================================================

interface ApplyBoostersInput {
  client: SupabaseClient;
  user_id: string;
  brand_id?: string;
  amount: number;
  action_type: string;
}

interface BoosterResult {
  totalBonusPoints: number;
  appliedBoosterIds: string[];
}

export async function applyBoosters({
  client,
  user_id,
  brand_id,
  amount,
  action_type,
}: ApplyBoostersInput): Promise<BoosterResult> {
  const boosters = await getActiveBoosters(client, brand_id);
  if (!boosters.length) return { totalBonusPoints: 0, appliedBoosterIds: [] };

  let totalBonusPoints = 0;
  const appliedBoosterIds: string[] = [];

  for (const booster of boosters) {
    const bonus = await processBooster({ client, booster, user_id, brand_id, amount, action_type });
    if (bonus > 0) {
      totalBonusPoints += bonus;
      appliedBoosterIds.push(booster.id);
    }
  }

  return { totalBonusPoints, appliedBoosterIds };
}

// =======================================================
// PROCESS A SINGLE BOOSTER
// =======================================================

interface ProcessBoosterInput {
  client: SupabaseClient;
  booster: Record<string, unknown>;
  user_id: string;
  brand_id?: string;
  amount: number;
  action_type: string;
}

async function processBooster({ client, booster, user_id, brand_id, amount, action_type }: ProcessBoosterInput): Promise<number> {
  const now = new Date();

  // Check date validity
  if (booster.start_at && now < new Date(booster.start_at as string)) return 0;
  if (booster.end_at && now > new Date(booster.end_at as string)) return 0;

  // Check action match
  if (booster.required_action !== "any" && booster.required_action !== action_type) return 0;

  // Check tier match
  if (booster.required_tier !== "any") {
    if (!brand_id) return 0;
    const tier = await getOrCreateTier(client, user_id, brand_id);
    if (tier?.current_tier !== booster.required_tier) return 0;
  }

  // Check user targeting
  const targeted = await isUserTargeted(client, booster.id as string, user_id);
  if (!targeted) return 0;

  const boosterType = booster.type as string;

  switch (boosterType) {
    case "tiered":
      return await processTieredBooster(client, booster, user_id, brand_id, amount);
    case "action":
      return await processActionBooster(client, booster, user_id, action_type);
    case "multiplier":
      return await processMultiplierBooster(client, booster, user_id, amount);
    case "flat_bonus":
      return await processFlatBonusBooster(client, booster, user_id, action_type);
    case "streak":
      return await processStreakBooster(client, booster, user_id);
    default:
      return 0;
  }
}

// =======================================================
// TIERED BOOSTER
// =======================================================

async function processTieredBooster(
  client: SupabaseClient,
  booster: Record<string, unknown>,
  user_id: string,
  brand_id: string | undefined,
  amount: number
): Promise<number> {
  if (!brand_id) return 0;

  const tier = await getOrCreateTier(client, user_id, brand_id);
  const rules = await getBoosterTierRules(client, booster.id as string);
  if (!rules.length) return 0;

  // Match on tier column (existing schema uses "tier" not "tier_name")
  const rule = rules.find((r: Record<string, unknown>) => r.tier === tier?.current_tier);
  if (!rule) return 0;

  const bonus = Math.floor(amount * toNumber(rule.multiplier, 1)) + toNumber(rule.bonus, 0);

  await logBoosterActivity(client, {
    booster_id: booster.id as string,
    user_id,
    action: "tiered",
    base_points: Math.floor(amount),
    bonus_points: bonus,
    total_points: Math.floor(amount) + bonus,
  });

  return bonus;
}

// =======================================================
// ACTION BOOSTER
// =======================================================

async function processActionBooster(
  client: SupabaseClient,
  booster: Record<string, unknown>,
  user_id: string,
  action_type: string
): Promise<number> {
  const rules = await getBoosterActionRules(client, booster.id as string);
  if (!rules.length) return 0;

  // Match on action column (existing schema uses "action" not "action_type")
  const rule = rules.find((r: Record<string, unknown>) => r.action === action_type);
  if (!rule) return 0;

  const bonus = toNumber(rule.bonus, 0);
  const multiplier = toNumber(rule.multiplier, 1);
  const points = bonus + (multiplier > 1 ? Math.floor(bonus * (multiplier - 1)) : 0);

  await logBoosterActivity(client, {
    booster_id: booster.id as string,
    user_id,
    action: action_type,
    base_points: 0,
    bonus_points: points,
    total_points: points,
  });

  return points;
}

// =======================================================
// MULTIPLIER BOOSTER
// =======================================================

async function processMultiplierBooster(
  client: SupabaseClient,
  booster: Record<string, unknown>,
  user_id: string,
  amount: number
): Promise<number> {
  const multiplier = toNumber(booster.multiplier_value, 1);
  if (multiplier <= 1) return 0;

  const bonus = Math.floor(amount * (multiplier - 1));

  await logBoosterActivity(client, {
    booster_id: booster.id as string,
    user_id,
    action: "multiplier",
    base_points: Math.floor(amount),
    bonus_points: bonus,
    total_points: Math.floor(amount) + bonus,
  });

  return bonus;
}

// =======================================================
// FLAT BONUS BOOSTER
// =======================================================

async function processFlatBonusBooster(
  client: SupabaseClient,
  booster: Record<string, unknown>,
  user_id: string,
  action_type: string
): Promise<number> {
  const bonus = toNumber(booster.bonus_value, 0);
  if (bonus <= 0) return 0;

  await logBoosterActivity(client, {
    booster_id: booster.id as string,
    user_id,
    action: action_type,
    base_points: 0,
    bonus_points: bonus,
    total_points: bonus,
  });

  return bonus;
}

// =======================================================
// STREAK BOOSTER
// =======================================================

async function processStreakBooster(
  client: SupabaseClient,
  booster: Record<string, unknown>,
  user_id: string
): Promise<number> {
  // Read current streak from profiles
  const { data: profile } = await client
    .from("profiles")
    .select("streak_count")
    .eq("user_id", user_id)
    .single();

  const streakCount = profile?.streak_count ?? 0;
  if (streakCount <= 0) return 0;

  const bonus = toNumber(booster.bonus_value, 1) * streakCount;

  await logBoosterActivity(client, {
    booster_id: booster.id as string,
    user_id,
    action: "streak",
    base_points: 0,
    bonus_points: Math.floor(bonus),
    total_points: Math.floor(bonus),
  });

  return Math.floor(bonus);
}

// =======================================================
// BOOSTER ACTIVITY LOGGER
// =======================================================

interface BoosterActivityLog {
  booster_id: string;
  user_id: string;
  action: string;
  base_points: number;
  bonus_points: number;
  total_points: number;
}

async function logBoosterActivity(client: SupabaseClient, entry: BoosterActivityLog) {
  await client.from("booster_activity_log").insert(entry);
}
