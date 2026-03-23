/**
 * MASTER BACKEND REFERENCE FILE
 * ==============================
 * Auto-generated: 2026-03-23T02:35:29.873Z
 * 
 * This file is a READ-ONLY reference containing all edge function
 * source code concatenated into a single file. It is NOT deployed.
 * The actual backend runs from individual files under supabase/functions/.
 *
 * Sections:
 *   1. Shared Utilities (_shared/utils.ts)
 *   2. Booster Engine  (_shared/booster-engine.ts)
 *   3. Engage+ Engine  (_shared/engage-engine.ts)
 *   4. Admin Actions    (admin-actions/index.ts)
 *   5. User Actions     (user-actions/index.ts)
 *   6. Brand Actions    (brand-actions/index.ts)
 *   7. Standalone Functions (scan-checkin, nest-earn, nest-streak,
 *      nest-tier-update, redeem-reward, connect-loyalty, set-user-role,
 *      seed-admin, seed-sample-data, delete-account, manage-tiers,
 *      check-subscription, create-checkout, customer-portal,
 *      geocode-brands, geofence-bulk-import)
 */


// ======================================================================
// FILE: supabase/functions/_shared/utils.ts
// ======================================================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// =======================================================
// GENERAL HELPERS
// =======================================================

export function nowTimestamp(): string {
  return new Date().toISOString();
}

export function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return isNaN(n) ? fallback : n;
}

export function requireFields(obj: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    if (!obj[field] && obj[field] !== 0) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}

// =======================================================
// LOGGING HELPERS
// =======================================================

export async function logInfo(client: SupabaseClient, message: string, metadata: Record<string, unknown> = {}) {
  await client.from("system_logs").insert({ level: "info", message, metadata });
}

export async function logWarn(client: SupabaseClient, message: string, metadata: Record<string, unknown> = {}) {
  await client.from("system_logs").insert({ level: "warn", message, metadata });
}

export async function logError(client: SupabaseClient, message: string, metadata: Record<string, unknown> = {}) {
  await client.from("system_logs").insert({ level: "error", message, metadata });
}

// =======================================================
// DATE UTILITIES
// =======================================================

export function isSameDay(date1: string | Date, date2: string | Date): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function daysBetween(date1: string | Date, date2: string | Date): number {
  const diff = Math.abs(new Date(date1).getTime() - new Date(date2).getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// =======================================================
// BOOSTER HELPERS
// =======================================================

export async function getActiveBoosters(client: SupabaseClient, brandId?: string) {
  let query = client.from("boosters").select("*").eq("active", true);
  if (brandId) query = query.eq("brand_id", brandId);
  const now = nowTimestamp();
  query = query.lte("start_at", now).or(`end_at.is.null,end_at.gte.${now}`);
  const { data } = await query;
  return data ?? [];
}

export async function getBoosterTierRules(client: SupabaseClient, boosterId: string) {
  const { data } = await client.from("booster_tier_rules").select("*").eq("booster_id", boosterId);
  return data ?? [];
}

export async function getBoosterActionRules(client: SupabaseClient, boosterId: string) {
  const { data } = await client.from("booster_action_rules").select("*").eq("booster_id", boosterId);
  return data ?? [];
}

export async function isUserTargeted(client: SupabaseClient, boosterId: string, userId: string): Promise<boolean> {
  const { count } = await client
    .from("booster_user_targets")
    .select("id", { count: "exact", head: true })
    .eq("booster_id", boosterId);

  if ((count ?? 0) === 0) return true; // no targeting = everyone eligible

  const { data } = await client
    .from("booster_user_targets")
    .select("id")
    .eq("booster_id", boosterId)
    .eq("user_id", userId)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

// =======================================================
// POINTS CALCULATION HELPERS
// =======================================================

export async function getBrandEarnRate(client: SupabaseClient, brandId: string): Promise<number> {
  const { data } = await client.from("brand_settings").select("earn_rate").eq("brand_id", brandId).maybeSingle();
  return toNumber(data?.earn_rate, 1);
}

export async function getGlobalMultiplier(client: SupabaseClient): Promise<number> {
  const { data } = await client.from("admin_settings").select("global_multiplier").eq("id", 1).maybeSingle();
  return toNumber(data?.global_multiplier, 1);
}

export async function calculateBasePoints(client: SupabaseClient, amount: number, brandId: string): Promise<number> {
  const earnRate = await getBrandEarnRate(client, brandId);
  const globalMultiplier = await getGlobalMultiplier(client);
  return Math.floor(amount * earnRate * globalMultiplier);
}

// =======================================================
// TIER PROGRESSION HELPERS
// =======================================================

export async function getOrCreateTier(client: SupabaseClient, userId: string, brandId: string) {
  const { data: existing } = await client
    .from("tier_progression")
    .select("*")
    .eq("user_id", userId)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (existing) return existing;

  const { data: created } = await client
    .from("tier_progression")
    .insert({ user_id: userId, brand_id: brandId, current_tier: "Bronze", lifetime_spend: 0 })
    .select()
    .single();

  return created;
}

export async function updateTierProgression(
  client: SupabaseClient,
  userId: string,
  brandId: string,
  amount: number
): Promise<string> {
  const tier = await getOrCreateTier(client, userId, brandId);
  if (!tier) return "Bronze";

  const newSpend = toNumber(tier.lifetime_spend, 0) + amount;

  const { data: settings } = await client
    .from("brand_settings")
    .select("tier_thresholds")
    .eq("brand_id", brandId)
    .maybeSingle();

  const thresholds = (settings?.tier_thresholds as Record<string, number>) ?? {
    Silver: 500,
    Gold: 2000,
    Platinum: 5000,
  };

  let newTier = "Bronze";
  if (newSpend >= (thresholds.Platinum ?? 5000)) newTier = "Platinum";
  else if (newSpend >= (thresholds.Gold ?? 2000)) newTier = "Gold";
  else if (newSpend >= (thresholds.Silver ?? 500)) newTier = "Silver";

  await client
    .from("tier_progression")
    .update({ lifetime_spend: newSpend, current_tier: newTier, updated_at: nowTimestamp() })
    .eq("id", tier.id);

  return newTier;
}

// =======================================================
// SECURITY HELPERS
// =======================================================

export function sanitizeUser(user: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!user) return null;
  const clone = { ...user };
  delete clone.password_hash;
  delete clone.api_key;
  delete clone.api_secret;
  return clone;
}

// =======================================================
// CORS & AUTH HELPERS (edge function boilerplate)
// =======================================================

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ error, ...extra }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}


// ======================================================================
// FILE: supabase/functions/_shared/booster-engine.ts
// ======================================================================

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


// ======================================================================
// FILE: supabase/functions/_shared/engage-engine.ts
// ======================================================================

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


// ======================================================================
// FILE: supabase/functions/admin-actions/index.ts
// ======================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  errorResponse,
  requireFields,
  nowTimestamp,
  logInfo,
  logWarn,
} from "../_shared/utils.ts";
import { resetEngagePlus } from "../_shared/engage-engine.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("unauthorized", 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user + admin role
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return errorResponse("unauthorized", 401);

    const { data: isAdmin } = await supabaseAdmin.rpc("is_admin");
    // is_admin uses auth.uid() so we need to check via user_roles directly
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role_id, roles(name)")
      .eq("user_id", user.id)
      .limit(10);

    const hasAdmin = adminRole?.some((r: any) => (r as any).roles?.name === "admin");
    if (!hasAdmin) return errorResponse("forbidden: admin role required", 403);

    const body = await req.json();
    const { action } = body;

    switch (action) {
      // ── Booster CRUD ──
      case "create_booster": {
        requireFields(body, ["name", "type"]);
        const { data, error } = await supabaseAdmin.from("boosters").insert({
          brand_id: body.brand_id ?? null,
          name: body.name,
          description: body.description ?? null,
          type: body.type,
          start_at: body.start_date ?? nowTimestamp(),
          end_at: body.end_date ?? null,
          active: body.is_active ?? true,
          multiplier_value: body.multiplier_value ?? 1,
          bonus_value: body.bonus_value ?? 0,
          required_action: body.required_action ?? "any",
          required_tier: body.required_tier ?? "any",
        }).select().single();
        if (error) throw error;
        await logInfo(supabaseAdmin, "Booster created", { booster_id: data.id, admin_id: user.id });
        return jsonResponse({ success: true, booster: data });
      }

      case "update_booster": {
        requireFields(body, ["booster_id"]);
        const updates: Record<string, unknown> = {};
        for (const key of ["name", "description", "type", "active", "start_at", "end_at", "multiplier_value", "bonus_value", "required_action", "required_tier", "brand_id"]) {
          if (body[key] !== undefined) updates[key] = body[key];
        }
        // Map spec field names to existing schema
        if (body.start_date !== undefined) updates.start_at = body.start_date;
        if (body.end_date !== undefined) updates.end_at = body.end_date;
        if (body.is_active !== undefined) updates.active = body.is_active;

        const { data, error } = await supabaseAdmin
          .from("boosters")
          .update(updates)
          .eq("id", body.booster_id)
          .select()
          .single();
        if (error) throw error;
        await logInfo(supabaseAdmin, "Booster updated", { booster_id: body.booster_id, admin_id: user.id });
        return jsonResponse({ success: true, booster: data });
      }

      case "delete_booster": {
        requireFields(body, ["booster_id"]);
        // Delete related rules first
        await supabaseAdmin.from("booster_tier_rules").delete().eq("booster_id", body.booster_id);
        await supabaseAdmin.from("booster_action_rules").delete().eq("booster_id", body.booster_id);
        await supabaseAdmin.from("booster_user_targets").delete().eq("booster_id", body.booster_id);
        const { error } = await supabaseAdmin.from("boosters").delete().eq("id", body.booster_id);
        if (error) throw error;
        await logWarn(supabaseAdmin, "Booster deleted", { booster_id: body.booster_id, admin_id: user.id });
        return jsonResponse({ success: true });
      }

      // ── Brand Settings ──
      case "update_brand_settings": {
        requireFields(body, ["brand_id"]);
        const { data: existing } = await supabaseAdmin
          .from("brand_settings")
          .select("id")
          .eq("brand_id", body.brand_id)
          .maybeSingle();

        const payload: Record<string, unknown> = { updated_at: nowTimestamp() };
        if (body.earn_rate !== undefined) payload.earn_rate = body.earn_rate;
        if (body.redemption_rate !== undefined) payload.redemption_rate = body.redemption_rate;
        if (body.tier_thresholds !== undefined) payload.tier_thresholds = body.tier_thresholds;

        if (existing) {
          await supabaseAdmin.from("brand_settings").update(payload).eq("id", existing.id);
        } else {
          await supabaseAdmin.from("brand_settings").insert({ brand_id: body.brand_id, ...payload });
        }
        await logInfo(supabaseAdmin, "Brand settings updated", { brand_id: body.brand_id, admin_id: user.id });
        return jsonResponse({ success: true });
      }

      // ── Global Admin Settings ──
      case "update_global_settings": {
        const payload: Record<string, unknown> = { updated_at: nowTimestamp() };
        if (body.maintenance_mode !== undefined) payload.maintenance_mode = body.maintenance_mode;
        if (body.global_multiplier !== undefined) payload.global_multiplier = body.global_multiplier;

        await supabaseAdmin.from("admin_settings").update(payload).eq("id", 1);
        await logInfo(supabaseAdmin, "Global settings updated", { admin_id: user.id, changes: payload });
        return jsonResponse({ success: true });
      }

      case "set_maintenance_mode": {
        requireFields(body, ["maintenance_mode"]);
        await supabaseAdmin.from("admin_settings").update({
          maintenance_mode: body.maintenance_mode,
          updated_at: nowTimestamp(),
        }).eq("id", 1);
        await logWarn(supabaseAdmin, "Maintenance mode updated", { maintenance_mode: body.maintenance_mode, admin_id: user.id });
        return jsonResponse({ success: true, maintenance_mode: body.maintenance_mode });
      }

      // ── System Logs ──
      case "view_logs": {
        const limit = body.limit ?? 200;
        const { data: logs } = await supabaseAdmin
          .from("system_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        return jsonResponse({ logs: logs ?? [] });
      }

      // ── Engage+ Reset ──
      case "reset_engage": {
        requireFields(body, ["user_id"]);
        const result = await resetEngagePlus(supabaseAdmin, body.user_id);
        await logWarn(supabaseAdmin, "Engage+ reset by admin", { user_id: body.user_id, admin_id: user.id });
        return jsonResponse(result);
      }

      // ── Tier Thresholds ──
      case "update_tier_thresholds": {
        requireFields(body, ["brand_id", "tier_thresholds"]);
        const { data: existing } = await supabaseAdmin
          .from("brand_settings")
          .select("id")
          .eq("brand_id", body.brand_id)
          .maybeSingle();

        const payload = { tier_thresholds: body.tier_thresholds, updated_at: nowTimestamp() };
        if (existing) {
          await supabaseAdmin.from("brand_settings").update(payload).eq("id", existing.id);
        } else {
          await supabaseAdmin.from("brand_settings").insert({ brand_id: body.brand_id, ...payload });
        }
        await logInfo(supabaseAdmin, "Tier thresholds updated", { brand_id: body.brand_id, admin_id: user.id });
        return jsonResponse({ success: true, thresholds: body.tier_thresholds });
      }

      default:
        return errorResponse("invalid_action", 400, {
          valid_actions: [
            "create_booster", "update_booster", "delete_booster",
            "update_brand_settings", "update_global_settings", "set_maintenance_mode",
            "view_logs", "reset_engage", "update_tier_thresholds",
          ],
        });
    }
  } catch (err) {
    console.error("admin-actions error:", err);
    return errorResponse("internal_error", 500, { message: String(err) });
  }
});


// ======================================================================
// FILE: supabase/functions/user-actions/index.ts
// ======================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  errorResponse,
  requireFields,
  toNumber,
  nowTimestamp,
  logInfo,
  calculateBasePoints,
  sanitizeUser,
} from "../_shared/utils.ts";
import { engagePlusCheckIn, getEngagePlusSummary } from "../_shared/engage-engine.ts";
import { applyBoosters } from "../_shared/booster-engine.ts";
import { getOrCreateTier, updateTierProgression } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("unauthorized", 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return errorResponse("unauthorized", 401);

    const body = await req.json();
    const { action } = body;

    switch (action) {
      // ── Get Profile ──
      case "get_profile": {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();
        return jsonResponse({ user: { email: user.email, ...profile } });
      }

      // ── Update Profile ──
      case "update_profile": {
        const allowed = ["display_name", "phone", "address", "city", "state", "zip_code", "avatar_url"];
        const updates: Record<string, unknown> = { updated_at: nowTimestamp() };
        for (const key of allowed) {
          if (body[key] !== undefined) updates[key] = body[key];
        }
        await supabaseAdmin.from("profiles").update(updates).eq("user_id", user.id);
        await logInfo(supabaseAdmin, "User profile updated", { user_id: user.id });
        return jsonResponse({ success: true });
      }

      // ── Daily Engage+ Check-In ──
      case "engage_checkin": {
        const result = await engagePlusCheckIn(supabaseAdmin, user.id);
        return jsonResponse({
          success: true,
          streak_count: result.streak_count,
          points_awarded: result.points_awarded,
          already_checked_in: result.already_checked_in,
        });
      }

      // ── Get Engage+ Summary ──
      case "engage_summary": {
        const summary = await getEngagePlusSummary(supabaseAdmin, user.id);
        return jsonResponse({ summary });
      }

      // ── Submit Transaction ──
      case "submit_transaction": {
        requireFields(body, ["brand_id", "amount"]);
        const amount = toNumber(body.amount);
        if (amount <= 0) return errorResponse("Invalid amount", 400);

        const brandId = body.brand_id as string;

        // Base points
        const basePoints = await calculateBasePoints(supabaseAdmin, amount, brandId);

        // Booster points
        const { totalBonusPoints: boosterPoints, appliedBoosterIds } = await applyBoosters({
          client: supabaseAdmin,
          user_id: user.id,
          brand_id: brandId,
          amount,
          action_type: "purchase",
        });

        const totalPoints = basePoints + boosterPoints;

        // Insert transaction
        const { data: transaction, error: txnErr } = await supabaseAdmin
          .from("transactions")
          .insert({
            user_id: user.id,
            brand_id: brandId,
            amount,
            points_earned: totalPoints,
            source: body.source ?? "purchase",
          })
          .select()
          .single();
        if (txnErr) throw txnErr;

        // Update tier progression
        const newTier = await updateTierProgression(supabaseAdmin, user.id, brandId, amount);

        // Update nest_points on profile
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("nest_points")
          .eq("user_id", user.id)
          .single();

        const newPoints = (profile?.nest_points ?? 0) + totalPoints;
        await supabaseAdmin
          .from("profiles")
          .update({ nest_points: newPoints })
          .eq("user_id", user.id);

        await logInfo(supabaseAdmin, "Transaction processed", {
          user_id: user.id,
          brand_id: brandId,
          amount,
          basePoints,
          boosterPoints,
          totalPoints,
          newTier,
        });

        return jsonResponse({
          success: true,
          transaction,
          points: { base: basePoints, booster: boosterPoints, total: totalPoints },
          new_tier: newTier,
          boosters_applied: appliedBoosterIds.length,
        });
      }

      // ── Get Points Summary ──
      case "get_points": {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("nest_points, streak_count, tier")
          .eq("user_id", user.id)
          .single();

        const { data: transactions } = await supabaseAdmin
          .from("transactions")
          .select("points_earned")
          .eq("user_id", user.id);

        const totalEarned = (transactions ?? []).reduce((sum, t) => sum + (t.points_earned ?? 0), 0);

        return jsonResponse({
          nest_points: profile?.nest_points ?? 0,
          transaction_points: totalEarned,
          streak: profile?.streak_count ?? 0,
          tier: profile?.tier ?? "Hatchling",
        });
      }

      // ── Get Tier Status for Brand ──
      case "get_tier": {
        requireFields(body, ["brand_id"]);
        const tier = await getOrCreateTier(supabaseAdmin, user.id, body.brand_id);
        return jsonResponse({
          brand_id: body.brand_id,
          current_tier: tier?.current_tier ?? "Bronze",
          lifetime_spend: tier?.lifetime_spend ?? 0,
        });
      }

      // ── Dashboard Summary ──
      case "get_dashboard": {
        const [engageSummary, { data: recentTxns }, { data: profile }] = await Promise.all([
          getEngagePlusSummary(supabaseAdmin, user.id),
          supabaseAdmin
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(10),
          supabaseAdmin
            .from("profiles")
            .select("*")
            .eq("user_id", user.id)
            .single(),
        ]);

        return jsonResponse({
          user: { email: user.email, ...profile },
          engage: engageSummary,
          recent_transactions: recentTxns ?? [],
        });
      }

      default:
        return errorResponse("invalid_action", 400, {
          valid_actions: [
            "get_profile", "update_profile", "engage_checkin", "engage_summary",
            "submit_transaction", "get_points", "get_tier", "get_dashboard",
          ],
        });
    }
  } catch (err) {
    console.error("user-actions error:", err);
    return errorResponse("internal_error", 500, { message: String(err) });
  }
});


// ======================================================================
// FILE: supabase/functions/brand-actions/index.ts
// ======================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  errorResponse,
  requireFields,
  nowTimestamp,
  logInfo,
  logWarn,
} from "../_shared/utils.ts";

/** Resolve the merchant_id for the authenticated user, or null. */
async function getMerchantId(client: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await client
    .from("merchant_users")
    .select("merchant_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.merchant_id ?? null;
}

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("unauthorized", 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return errorResponse("unauthorized", 401);

    // Verify manager/admin role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role_id, roles(name)")
      .eq("user_id", user.id);

    const roleNames = (roles ?? []).map((r: any) => (r as any).roles?.name).filter(Boolean);
    const isManagerOrAdmin = roleNames.includes("manager") || roleNames.includes("admin");
    if (!isManagerOrAdmin) return errorResponse("forbidden: manager or admin role required", 403);

    // Resolve merchant association
    const merchantId = await getMerchantId(supabaseAdmin, user.id);
    if (!merchantId) return errorResponse("No merchant association found", 403);

    const body = await req.json();
    const { action } = body;

    switch (action) {
      // ── Get Brand/Merchant Profile ──
      case "get_profile": {
        const { data: merchant } = await supabaseAdmin
          .from("merchants")
          .select("*")
          .eq("id", merchantId)
          .single();
        return jsonResponse({ brand: merchant });
      }

      // ── Update Brand/Merchant Profile ──
      case "update_profile": {
        const allowed = ["name", "logo_url", "category"];
        const updates: Record<string, unknown> = {};
        for (const key of allowed) {
          if (body[key] !== undefined) updates[key] = body[key];
        }
        await supabaseAdmin.from("merchants").update(updates).eq("id", merchantId);
        await logInfo(supabaseAdmin, "Brand profile updated", { merchant_id: merchantId, manager_id: user.id });
        return jsonResponse({ success: true });
      }

      // ── Create Booster (scoped to brand) ──
      case "create_booster": {
        requireFields(body, ["name", "type"]);
        // Find the brand_id linked to this merchant (use merchant as brand proxy)
        const { data: booster, error } = await supabaseAdmin.from("boosters").insert({
          brand_id: body.brand_id ?? null,
          name: body.name,
          description: body.description ?? null,
          type: body.type,
          start_at: body.start_date ?? nowTimestamp(),
          end_at: body.end_date ?? null,
          active: body.is_active ?? true,
          multiplier_value: body.multiplier_value ?? 1,
          bonus_value: body.bonus_value ?? 0,
          required_action: body.required_action ?? "any",
          required_tier: body.required_tier ?? "any",
        }).select().single();
        if (error) throw error;
        await logInfo(supabaseAdmin, "Brand booster created", { booster_id: booster.id, merchant_id: merchantId });
        return jsonResponse({ success: true, booster });
      }

      // ── Update Booster (owned by brand) ──
      case "update_booster": {
        requireFields(body, ["booster_id"]);
        // Verify ownership if brand_id is set
        const { data: existing } = await supabaseAdmin
          .from("boosters")
          .select("id, brand_id")
          .eq("id", body.booster_id)
          .single();
        if (!existing) return errorResponse("Booster not found", 404);

        const updates: Record<string, unknown> = {};
        for (const key of ["name", "description", "type", "active", "start_at", "end_at", "multiplier_value", "bonus_value", "required_action", "required_tier"]) {
          if (body[key] !== undefined) updates[key] = body[key];
        }
        if (body.start_date !== undefined) updates.start_at = body.start_date;
        if (body.end_date !== undefined) updates.end_at = body.end_date;
        if (body.is_active !== undefined) updates.active = body.is_active;

        const { data, error } = await supabaseAdmin
          .from("boosters").update(updates).eq("id", body.booster_id).select().single();
        if (error) throw error;
        await logInfo(supabaseAdmin, "Brand booster updated", { booster_id: body.booster_id, merchant_id: merchantId });
        return jsonResponse({ success: true, booster: data });
      }

      // ── Delete Booster ──
      case "delete_booster": {
        requireFields(body, ["booster_id"]);
        await supabaseAdmin.from("booster_tier_rules").delete().eq("booster_id", body.booster_id);
        await supabaseAdmin.from("booster_action_rules").delete().eq("booster_id", body.booster_id);
        await supabaseAdmin.from("booster_user_targets").delete().eq("booster_id", body.booster_id);
        await supabaseAdmin.from("boosters").delete().eq("id", body.booster_id);
        await logWarn(supabaseAdmin, "Brand booster deleted", { booster_id: body.booster_id, merchant_id: merchantId });
        return jsonResponse({ success: true });
      }

      // ── Update Brand Settings ──
      case "update_settings": {
        const brandId = body.brand_id;
        if (!brandId) return errorResponse("brand_id required", 400);

        const { data: existing } = await supabaseAdmin
          .from("brand_settings").select("id").eq("brand_id", brandId).maybeSingle();

        const payload: Record<string, unknown> = { updated_at: nowTimestamp() };
        if (body.earn_rate !== undefined) payload.earn_rate = body.earn_rate;
        if (body.redemption_rate !== undefined) payload.redemption_rate = body.redemption_rate;
        if (body.tier_thresholds !== undefined) payload.tier_thresholds = body.tier_thresholds;

        if (existing) {
          await supabaseAdmin.from("brand_settings").update(payload).eq("id", existing.id);
        } else {
          await supabaseAdmin.from("brand_settings").insert({ brand_id: brandId, ...payload });
        }
        await logInfo(supabaseAdmin, "Brand settings updated", { brand_id: brandId, merchant_id: merchantId });
        return jsonResponse({ success: true });
      }

      // ── View Transactions ──
      case "get_transactions": {
        const { data: txns } = await supabaseAdmin
          .from("transactions")
          .select("*")
          .eq("brand_id", body.brand_id ?? merchantId)
          .order("created_at", { ascending: false })
          .limit(body.limit ?? 100);
        return jsonResponse({ transactions: txns ?? [] });
      }

      // ── Dashboard Summary ──
      case "get_dashboard": {
        const [{ data: merchant }, { data: rewards }, { data: recentTxns }] = await Promise.all([
          supabaseAdmin.from("merchants").select("*").eq("id", merchantId).single(),
          supabaseAdmin.from("rewards").select("*").eq("merchant_id", merchantId).eq("active", true),
          supabaseAdmin.from("transactions")
            .select("*")
            .eq("brand_id", body.brand_id ?? merchantId)
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

        const totalPoints = (recentTxns ?? []).reduce((sum, t) => sum + (t.points_earned ?? 0), 0);

        return jsonResponse({
          brand: merchant,
          stats: {
            total_transactions: recentTxns?.length ?? 0,
            total_points_awarded: totalPoints,
            active_rewards: rewards?.length ?? 0,
          },
          recent_transactions: recentTxns ?? [],
        });
      }

      default:
        return errorResponse("invalid_action", 400, {
          valid_actions: [
            "get_profile", "update_profile", "create_booster", "update_booster",
            "delete_booster", "update_settings", "get_transactions", "get_dashboard",
          ],
        });
    }
  } catch (err) {
    console.error("brand-actions error:", err);
    return errorResponse("internal_error", 500, { message: String(err) });
  }
});


// ======================================================================
// FILE: supabase/functions/scan-checkin/index.ts
// ======================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const POINTS_PER_CHECKIN = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user JWT
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      anonKey,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { merchant_id } = await req.json();
    if (!merchant_id || typeof merchant_id !== "string") {
      return new Response(
        JSON.stringify({ error: "merchant_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify merchant exists
    const { data: merchant, error: merchantErr } = await supabaseAdmin
      .from("merchants")
      .select("id, name")
      .eq("id", merchant_id)
      .single();

    if (merchantErr || !merchant) {
      return new Response(
        JSON.stringify({ error: "merchant_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate idempotency key: one check-in per user per merchant per day
    const today = new Date().toISOString().slice(0, 10);
    const idempotencyKey = `checkin:${user.id}:${merchant_id}:${today}`;

    // Check if already checked in today
    const { data: existing } = await supabaseAdmin
      .from("ledger_entries")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          error: "already_checked_in",
          message: "You've already checked in at this merchant today.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate current balance for this merchant
    const { data: lastEntry } = await supabaseAdmin
      .from("ledger_entries")
      .select("balance_after")
      .eq("user_id", user.id)
      .eq("merchant_id", merchant_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentBalance = lastEntry?.balance_after ?? 0;
    const newBalance = currentBalance + POINTS_PER_CHECKIN;

    // Create ledger entry
    const { data: entry, error: insertErr } = await supabaseAdmin
      .from("ledger_entries")
      .insert({
        user_id: user.id,
        merchant_id: merchant_id,
        delta_points: POINTS_PER_CHECKIN,
        balance_after: newBalance,
        type: "earn",
        idempotency_key: idempotencyKey,
        metadata: { source: "qr_checkin", date: today },
      })
      .select()
      .single();

    if (insertErr) {
      // Could be a race condition duplicate
      if (insertErr.code === "23505") {
        return new Response(
          JSON.stringify({
            error: "already_checked_in",
            message: "You've already checked in at this merchant today.",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw insertErr;
    }

    return new Response(
      JSON.stringify({
        success: true,
        points_earned: POINTS_PER_CHECKIN,
        new_balance: newBalance,
        merchant_name: merchant.name,
        entry_id: entry.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Check-in error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


// ======================================================================
// FILE: supabase/functions/nest-earn/index.ts
// ======================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ACTION_POINTS: Record<string, number> = {
  add_card: 50,
  check_balance: 5,
  visit_brand: 10,
  redeem_reward: 20,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = await req.json();
    const basePoints = ACTION_POINTS[action];
    if (!basePoints) {
      return new Response(
        JSON.stringify({ error: "invalid_action", valid_actions: Object.keys(ACTION_POINTS) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("nest_points, tier, challenges_completed")
      .eq("user_id", user.id)
      .single();

    const currentPoints = profile?.nest_points ?? 0;
    const userTier = profile?.tier ?? "Hatchling";

    // --- Booster logic ---
    const now = new Date().toISOString();

    // Fetch active boosters within their time window
    const { data: activeBoosters } = await supabaseAdmin
      .from("boosters")
      .select("*")
      .eq("active", true)
      .lte("start_at", now)
      .or(`end_at.is.null,end_at.gte.${now}`);

    let totalMultiplier = 1;
    let totalBonus = 0;
    const appliedBoosterIds: string[] = [];

    for (const b of activeBoosters ?? []) {
      // Action match
      if (b.required_action !== "any" && b.required_action !== action) continue;
      // Tier match
      if (b.required_tier !== "any" && b.required_tier !== userTier) continue;

      // Check user targeting (if targets exist, user must be in the list)
      const { count } = await supabaseAdmin
        .from("booster_user_targets")
        .select("id", { count: "exact", head: true })
        .eq("booster_id", b.id);

      if ((count ?? 0) > 0) {
        const { data: targeted } = await supabaseAdmin
          .from("booster_user_targets")
          .select("id")
          .eq("booster_id", b.id)
          .eq("user_id", user.id)
          .limit(1);
        if (!targeted || targeted.length === 0) continue;
      }

      appliedBoosterIds.push(b.id);

      // Apply booster type
      if (b.type === "multiplier") {
        totalMultiplier *= Number(b.multiplier_value) || 1;
      }
      if (b.type === "flat_bonus") {
        totalBonus += b.bonus_value || 0;
      }

      // Tier rules for this booster
      const { data: tierRules } = await supabaseAdmin
        .from("booster_tier_rules")
        .select("multiplier, bonus")
        .eq("booster_id", b.id)
        .eq("tier", userTier);

      for (const r of tierRules ?? []) {
        if (r.multiplier && Number(r.multiplier) !== 0) totalMultiplier *= Number(r.multiplier);
        if (r.bonus) totalBonus += r.bonus;
      }

      // Action rules for this booster
      const { data: actionRules } = await supabaseAdmin
        .from("booster_action_rules")
        .select("multiplier, bonus")
        .eq("booster_id", b.id)
        .eq("action", action);

      for (const r of actionRules ?? []) {
        if (r.multiplier && Number(r.multiplier) !== 0) totalMultiplier *= Number(r.multiplier);
        if (r.bonus) totalBonus += r.bonus;
      }
    }

    // Final points calculation
    const boostedPoints = Math.floor(basePoints * totalMultiplier) + totalBonus;
    const bonusPoints = boostedPoints - basePoints;
    const newPoints = currentPoints + boostedPoints;

    // Update nest_points
    await supabaseAdmin
      .from("profiles")
      .update({ nest_points: newPoints })
      .eq("user_id", user.id);

    // Log activity
    await supabaseAdmin.from("nest_activities").insert({
      user_id: user.id,
      type: action,
      points: boostedPoints,
    });

    // Log booster activity for each applied booster
    if (appliedBoosterIds.length > 0) {
      const boosterLogs = appliedBoosterIds.map((bid) => ({
        user_id: user.id,
        booster_id: bid,
        action,
        base_points: basePoints,
        bonus_points: bonusPoints,
        total_points: boostedPoints,
      }));
      await supabaseAdmin.from("booster_activity_log").insert(boosterLogs);
    }

    // Update tier
    let tier = "Hatchling";
    if (newPoints >= 5000) tier = "Golden Nest";
    else if (newPoints >= 2000) tier = "Winged";
    else if (newPoints >= 500) tier = "Feathered";

    await supabaseAdmin
      .from("profiles")
      .update({ tier })
      .eq("user_id", user.id);

    // Check challenge progress
    const { data: userChallenges } = await supabaseAdmin
      .from("user_challenges")
      .select("id, challenge_id, progress, completed, challenges(type, requirement, reward_points)")
      .eq("user_id", user.id)
      .eq("completed", false);

    const completedChallenges: string[] = [];
    for (const uc of userChallenges ?? []) {
      const ch = (uc as any).challenges;
      if (!ch) continue;
      if (ch.type === action || ch.type === "action_count") {
        const newProgress = uc.progress + 1;
        const isComplete = newProgress >= ch.requirement;
        await supabaseAdmin
          .from("user_challenges")
          .update({
            progress: newProgress,
            completed: isComplete,
            completed_at: isComplete ? new Date().toISOString() : null,
          })
          .eq("id", uc.id);

        if (isComplete) {
          completedChallenges.push(uc.challenge_id);
          await supabaseAdmin
            .from("profiles")
            .update({
              nest_points: newPoints + ch.reward_points,
              challenges_completed: (profile?.challenges_completed ?? 0) + 1,
            })
            .eq("user_id", user.id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        basePoints,
        boostedPoints,
        bonus: bonusPoints,
        appliedBoosters: appliedBoosterIds.length,
        newTotal: newPoints,
        tier,
        completedChallenges,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("nest-earn error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


// ======================================================================
// FILE: supabase/functions/nest-streak/index.ts
// ======================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STREAK_BONUS = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("nest_points, streak_count, last_check_in")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "profile_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toDateString();
    const lastCheckIn = profile.last_check_in
      ? new Date(profile.last_check_in).toDateString()
      : null;

    if (today === lastCheckIn) {
      return new Response(
        JSON.stringify({ streak: profile.streak_count, bonus: 0, message: "Already checked in today" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if streak should reset (missed a day)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const wasYesterday = lastCheckIn === yesterday.toDateString();

    const newStreak = wasYesterday || !lastCheckIn ? profile.streak_count + 1 : 1;
    const newPoints = profile.nest_points + STREAK_BONUS;

    await supabaseAdmin
      .from("profiles")
      .update({
        streak_count: newStreak,
        last_check_in: new Date().toISOString(),
        nest_points: newPoints,
      })
      .eq("user_id", user.id);

    // Log activity
    await supabaseAdmin.from("nest_activities").insert({
      user_id: user.id,
      type: "daily_streak",
      points: STREAK_BONUS,
    });

    // Update tier
    let tier = "Hatchling";
    if (newPoints >= 5000) tier = "Golden Nest";
    else if (newPoints >= 2000) tier = "Winged";
    else if (newPoints >= 500) tier = "Feathered";

    await supabaseAdmin
      .from("profiles")
      .update({ tier })
      .eq("user_id", user.id);

    return new Response(
      JSON.stringify({ streak: newStreak, bonus: STREAK_BONUS, tier, newTotal: newPoints }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("nest-streak error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


// ======================================================================
// FILE: supabase/functions/nest-tier-update/index.ts
// ======================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("nest_points")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "profile_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const np = profile.nest_points;
    let tier = "Hatchling";
    if (np >= 5000) tier = "Golden Nest";
    else if (np >= 2000) tier = "Winged";
    else if (np >= 500) tier = "Feathered";

    await supabaseAdmin
      .from("profiles")
      .update({ tier })
      .eq("user_id", user.id);

    return new Response(
      JSON.stringify({ tier, nestPoints: np }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("nest-tier-update error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


// ======================================================================
// FILE: supabase/functions/redeem-reward/index.ts
// ======================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      anonKey,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reward_id } = await req.json();
    if (!reward_id || typeof reward_id !== "string") {
      return new Response(
        JSON.stringify({ error: "reward_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch reward
    const { data: reward, error: rewardErr } = await supabaseAdmin
      .from("rewards")
      .select("id, title, points_cost, merchant_id, active, inventory")
      .eq("id", reward_id)
      .single();

    if (rewardErr || !reward) {
      return new Response(
        JSON.stringify({ error: "reward_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!reward.active) {
      return new Response(
        JSON.stringify({ error: "reward_inactive", message: "This reward is no longer available." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (reward.inventory !== null && reward.inventory <= 0) {
      return new Response(
        JSON.stringify({ error: "out_of_stock", message: "This reward is out of stock." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's current balance for this merchant
    const { data: lastEntry } = await supabaseAdmin
      .from("ledger_entries")
      .select("balance_after")
      .eq("user_id", user.id)
      .eq("merchant_id", reward.merchant_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentBalance = lastEntry?.balance_after ?? 0;

    if (currentBalance < reward.points_cost) {
      return new Response(
        JSON.stringify({
          error: "insufficient_points",
          message: `You need ${reward.points_cost} points but have ${currentBalance}.`,
          current_balance: currentBalance,
          points_cost: reward.points_cost,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newBalance = currentBalance - reward.points_cost;
    const today = new Date().toISOString().slice(0, 10);

    // Insert ledger entry (deduction)
    const { error: ledgerErr } = await supabaseAdmin
      .from("ledger_entries")
      .insert({
        user_id: user.id,
        merchant_id: reward.merchant_id,
        delta_points: -reward.points_cost,
        balance_after: newBalance,
        type: "redeem",
        metadata: { reward_id: reward.id, reward_title: reward.title, date: today },
      });

    if (ledgerErr) throw ledgerErr;

    // Insert redemption record
    const { data: redemption, error: redemptionErr } = await supabaseAdmin
      .from("redemptions")
      .insert({
        user_id: user.id,
        merchant_id: reward.merchant_id,
        reward_id: reward.id,
        points_spent: reward.points_cost,
        status: "completed",
      })
      .select("id")
      .single();

    if (redemptionErr) throw redemptionErr;

    // Decrement inventory if tracked
    if (reward.inventory !== null) {
      await supabaseAdmin
        .from("rewards")
        .update({ inventory: reward.inventory - 1 })
        .eq("id", reward.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        redemption_id: redemption.id,
        reward_title: reward.title,
        points_spent: reward.points_cost,
        new_balance: newBalance,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Redeem error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


// ======================================================================
// FILE: supabase/functions/connect-loyalty/index.ts
// ======================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, brand_id, provider_name, api_endpoint, access_token, external_member_id, points_balance } = body;

    const adminClient = createClient(supabaseUrl, serviceKey);

    if (action === "connect") {
      // Use manually provided points_balance, or try API if endpoint provided
      let pointsBalance: number | null = typeof points_balance === "number" ? points_balance : null;

      if (pointsBalance === null && api_endpoint && access_token) {
        try {
          const testResponse = await fetch(api_endpoint, {
            headers: {
              Authorization: `Bearer ${access_token}`,
              "Content-Type": "application/json",
            },
          });

          if (testResponse.ok) {
            const apiData = await testResponse.json();
            pointsBalance =
              apiData.points ??
              apiData.balance ??
              apiData.data?.points ??
              apiData.data?.balance ??
              null;
          }
        } catch {
          // API unreachable — continue with manual balance
        }
      }

      const { data, error } = await adminClient
        .from("external_loyalty_connections")
        .upsert(
          {
            user_id: user.id,
            brand_id,
            provider_name: provider_name || "custom",
            api_endpoint: api_endpoint || null,
            access_token: access_token || null,
            external_member_id: external_member_id || null,
            external_points_balance: pointsBalance,
            status: "connected",
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,brand_id" }
        )
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, connection: data }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "disconnect") {
      const { error } = await adminClient
        .from("external_loyalty_connections")
        .delete()
        .eq("user_id", user.id)
        .eq("brand_id", brand_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sync") {
      // Fetch current connection
      const { data: conn, error: connErr } = await adminClient
        .from("external_loyalty_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("brand_id", brand_id)
        .single();

      if (connErr || !conn) {
        return new Response(
          JSON.stringify({ error: "No connection found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // If manual points_balance provided, update directly
      if (typeof points_balance === "number") {
        await adminClient
          .from("external_loyalty_connections")
          .update({
            external_points_balance: points_balance,
            status: "connected",
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", conn.id);

        return new Response(
          JSON.stringify({ success: true, points_balance }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Try API sync if endpoint configured
      if (conn.api_endpoint) {
        try {
          const fetchHeaders: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (conn.access_token) {
            fetchHeaders["Authorization"] = `Bearer ${conn.access_token}`;
          }

          const resp = await fetch(conn.api_endpoint, { headers: fetchHeaders });

          if (resp.ok) {
            const apiData = await resp.json();
            const points =
              apiData.points ?? apiData.balance ?? apiData.data?.points ?? apiData.data?.balance ?? null;

            await adminClient
              .from("external_loyalty_connections")
              .update({
                external_points_balance: points,
                status: "connected",
                last_synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", conn.id);

            return new Response(
              JSON.stringify({ success: true, points_balance: points }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        } catch {
          // API unreachable — return current balance without error
        }
      }

      // No API or API failed — return current balance gracefully
      return new Response(
        JSON.stringify({
          success: true,
          points_balance: conn.external_points_balance,
          synced: false,
          message: "No API available. Update points manually.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "sync_all") {
      // Sync all connections for this user — attempt API calls, fallback gracefully
      const { data: connections, error: listErr } = await adminClient
        .from("external_loyalty_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "connected");

      if (listErr) throw listErr;

      const results = [];
      for (const conn of (connections || [])) {
        let points = conn.external_points_balance;
        let synced = false;

        if (conn.api_endpoint) {
          try {
            const fetchHeaders: Record<string, string> = { "Content-Type": "application/json" };
            if (conn.access_token) fetchHeaders["Authorization"] = `Bearer ${conn.access_token}`;

            const resp = await fetch(conn.api_endpoint, { headers: fetchHeaders });
            if (resp.ok) {
              const apiData = await resp.json();
              const newPoints = apiData.points ?? apiData.balance ?? apiData.data?.points ?? apiData.data?.balance ?? null;
              if (newPoints !== null) {
                points = newPoints;
                synced = true;
                await adminClient
                  .from("external_loyalty_connections")
                  .update({
                    external_points_balance: points,
                    last_synced_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", conn.id);
              }
            }
          } catch {
            // Skip — keep existing balance
          }
        }

        results.push({
          brand_id: conn.brand_id,
          provider_name: conn.provider_name,
          points_balance: points,
          synced,
        });
      }

      return new Response(
        JSON.stringify({ success: true, connections: results }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: connect, disconnect, sync, sync_all" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("connect-loyalty error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});


// ======================================================================
// FILE: supabase/functions/set-user-role/index.ts
// ======================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is admin using service role client
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", user.id);

    const isCallerAdmin = callerRoles?.some((r: any) => r.roles?.name === "admin");
    if (!isCallerAdmin) {
      return new Response(JSON.stringify({ error: "forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, user_id: targetUserId, role: roleName, email } = await req.json();

    if (!action || !roleName || (!targetUserId && !email)) {
      return new Response(
        JSON.stringify({ error: "action, role, and (user_id or email) required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve user_id from email if needed
    let resolvedUserId = targetUserId;
    if (!resolvedUserId && email) {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
      const found = usersData?.users?.find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase()
      );
      if (!found) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      resolvedUserId = found.id;
    }

    // Get role id
    const { data: roleData, error: roleErr } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("name", roleName)
      .single();
    if (roleErr || !roleData) {
      return new Response(JSON.stringify({ error: `Role '${roleName}' not found` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "assign") {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: resolvedUserId, role_id: roleData.id },
          { onConflict: "user_id,role_id" }
        );
      if (error) throw error;
    } else if (action === "remove") {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", resolvedUserId)
        .eq("role_id", roleData.id);
      if (error) throw error;
    } else {
      return new Response(JSON.stringify({ error: "action must be 'assign' or 'remove'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


// ======================================================================
// FILE: supabase/functions/seed-admin/index.ts
// ======================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Accept x-admin-key, service_role via Authorization, or service_role via apikey header
    const adminKey = req.headers.get("x-admin-key");
    const expectedKey = Deno.env.get("ADMIN_API_KEY");
    const authHeader = req.headers.get("Authorization");
    const apikeyHeader = req.headers.get("apikey");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const isAdminKey = adminKey && adminKey === expectedKey;
    const isServiceRole = (authHeader && authHeader === `Bearer ${serviceRoleKey}`) ||
                          (apikeyHeader && apikeyHeader === serviceRoleKey);
    if (!isAdminKey && !isServiceRole) {
      console.log("Auth failed. Has x-admin-key:", !!adminKey, "Has auth:", !!authHeader, "Has apikey:", !!apikeyHeader);
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let userId: string | null = null;
    const body = await req.json().catch(() => ({}));
    const email = body?.email;

    if (email) {
      // Find user by email via auth admin API
      const { data: usersData, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
      if (listErr) throw listErr;
      const found = usersData.users.find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase()
      );
      if (!found) {
        return new Response(
          JSON.stringify({ error: "User not found. They must sign up first." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = found.id;
    } else {
      // Promote caller from Authorization header
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Provide email in body or Authorization header" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
      if (userErr || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    // Get admin role id
    const { data: roleData, error: roleErr } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("name", "admin")
      .single();
    if (roleErr || !roleData) throw new Error("Admin role not found");

    // Upsert user_role
    const { error: upsertErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role_id: roleData.id }, { onConflict: "user_id,role_id" });
    if (upsertErr) throw upsertErr;

    return new Response(
      JSON.stringify({ ok: true, user_id: userId, role: "admin" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


// ======================================================================
// FILE: supabase/functions/seed-sample-data/index.ts
// ======================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  errorResponse,
  nowTimestamp,
  logInfo,
} from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("unauthorized", 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return errorResponse("unauthorized", 401);

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role_id, roles(name)")
      .eq("user_id", user.id);
    const hasAdmin = adminRole?.some((r: any) => (r as any).roles?.name === "admin");
    if (!hasAdmin) return errorResponse("forbidden: admin only", 403);

    // ── Prevent duplicate seeding ──
    const { data: existingBrand } = await supabaseAdmin
      .from("brands")
      .select("id")
      .eq("name", "RewardsNest Coffee")
      .maybeSingle();

    if (existingBrand) {
      return jsonResponse({ success: false, message: "Sample data already exists" });
    }

    // ── Create sample brand ──
    const { data: brand, error: brandErr } = await supabaseAdmin
      .from("brands")
      .insert({
        name: "RewardsNest Coffee",
        logo_emoji: "☕",
        category: "Coffee & Beverages",
        milestone_visits: 10,
        milestone_points: 100,
      })
      .select()
      .single();
    if (brandErr) throw brandErr;

    // ── Create sample merchant ──
    const { data: merchant, error: merchantErr } = await supabaseAdmin
      .from("merchants")
      .insert({
        name: "RewardsNest Coffee Shop",
        category: "Coffee & Beverages",
      })
      .select()
      .single();
    if (merchantErr) throw merchantErr;

    // ── Brand settings ──
    await supabaseAdmin.from("brand_settings").insert({
      brand_id: brand.id,
      earn_rate: 1,
      redemption_rate: 0.01,
      tier_thresholds: { Bronze: 0, Silver: 100, Gold: 300, Platinum: 700 },
    });

    // ── Admin settings (upsert) ──
    await supabaseAdmin
      .from("admin_settings")
      .upsert({ id: 1, maintenance_mode: false, global_multiplier: 1 });

    // ── Sample boosters ──

    // Tiered booster
    const { data: tieredBooster } = await supabaseAdmin
      .from("boosters")
      .insert({
        brand_id: brand.id,
        name: "Tier Multiplier Booster",
        description: "Boost points based on tier level",
        type: "tiered",
        active: true,
        required_action: "any",
        required_tier: "any",
      })
      .select()
      .single();

    if (tieredBooster) {
      await supabaseAdmin.from("booster_tier_rules").insert([
        { booster_id: tieredBooster.id, tier: "Silver", multiplier: 1.5, bonus: 0 },
        { booster_id: tieredBooster.id, tier: "Gold", multiplier: 2, bonus: 0 },
        { booster_id: tieredBooster.id, tier: "Platinum", multiplier: 3, bonus: 0 },
      ]);
    }

    // Action booster
    const { data: actionBooster } = await supabaseAdmin
      .from("boosters")
      .insert({
        brand_id: brand.id,
        name: "Review Bonus",
        description: "Earn bonus points for leaving a review",
        type: "action",
        active: true,
        required_action: "any",
        required_tier: "any",
      })
      .select()
      .single();

    if (actionBooster) {
      await supabaseAdmin.from("booster_action_rules").insert({
        booster_id: actionBooster.id,
        action: "review",
        bonus: 20,
        multiplier: 1,
      });
    }

    // Multiplier booster
    await supabaseAdmin.from("boosters").insert({
      brand_id: brand.id,
      name: "Double Points Weekend",
      description: "2x points on all purchases",
      type: "multiplier",
      active: true,
      multiplier_value: 2,
      required_action: "any",
      required_tier: "any",
    });

    // Flat bonus booster
    await supabaseAdmin.from("boosters").insert({
      brand_id: brand.id,
      name: "Streak Bonus",
      description: "Earn extra flat bonus for daily streaks",
      type: "flat_bonus",
      active: true,
      bonus_value: 5,
      required_action: "any",
      required_tier: "any",
    });

    // ── Sample rewards ──
    await supabaseAdmin.from("rewards").insert([
      {
        merchant_id: merchant.id,
        title: "Free Coffee",
        description: "One free regular coffee",
        points_cost: 100,
        active: true,
      },
      {
        merchant_id: merchant.id,
        title: "10% Off Next Order",
        description: "Discount on your next purchase",
        points_cost: 50,
        active: true,
      },
    ]);

    // ── Sample transactions (using current admin user) ──
    await supabaseAdmin.from("transactions").insert([
      { user_id: user.id, brand_id: brand.id, amount: 12.50, points_earned: 15, source: "purchase" },
      { user_id: user.id, brand_id: brand.id, amount: 5.00, points_earned: 5, source: "purchase" },
    ]);

    // ── Sample tier progression ──
    await supabaseAdmin.from("tier_progression").insert({
      user_id: user.id,
      brand_id: brand.id,
      current_tier: "Silver",
      lifetime_spend: 150,
    });

    await logInfo(supabaseAdmin, "Sample data seeded", { admin_id: user.id, brand_id: brand.id });

    return jsonResponse({
      success: true,
      message: "Sample data seeded successfully",
      brand_id: brand.id,
      merchant_id: merchant.id,
    });
  } catch (err) {
    console.error("seed-sample-data error:", err);
    return errorResponse("internal_error", 500, { message: String(err) });
  }
});


// ======================================================================
// FILE: supabase/functions/delete-account/index.ts
// ======================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user from their JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to delete the user
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


// ======================================================================
// FILE: supabase/functions/manage-tiers/index.ts
// ======================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Service role client for writes
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const body = await req.json();
    const { action } = body;

    // ── TIER CRUD ──
    if (action === "upsert_tier") {
      const { id, name, slug, description, price_cents, price_label, interval, stripe_price_id, stripe_product_id, sort_order, is_free } = body;
      const row: Record<string, unknown> = { name, slug, description, price_cents, price_label, interval, stripe_price_id: stripe_price_id || null, stripe_product_id: stripe_product_id || null, sort_order, is_free };
      if (id) row.id = id;
      const { data, error } = await admin.from("subscription_tiers").upsert(row, { onConflict: "id" }).select().single();
      if (error) throw error;
      return respond(data);
    }

    if (action === "delete_tier") {
      const { id } = body;
      const { error } = await admin.from("subscription_tiers").delete().eq("id", id);
      if (error) throw error;
      return respond({ success: true });
    }

    // ── FEATURE CRUD ──
    if (action === "upsert_feature") {
      const { id, feature_key, label, description, sort_order } = body;
      const row: Record<string, unknown> = { feature_key, label, description, sort_order };
      if (id) row.id = id;
      const { data, error } = await admin.from("subscription_features").upsert(row, { onConflict: "id" }).select().single();
      if (error) throw error;
      return respond(data);
    }

    if (action === "delete_feature") {
      const { id } = body;
      const { error } = await admin.from("subscription_features").delete().eq("id", id);
      if (error) throw error;
      return respond({ success: true });
    }

    // ── FEATURE ACCESS TOGGLE ──
    if (action === "set_feature_access") {
      const { tier_id, feature_id, enabled } = body;
      const { data, error } = await admin.from("tier_feature_access").upsert(
        { tier_id, feature_id, enabled },
        { onConflict: "tier_id,feature_id" },
      ).select().single();
      if (error) throw error;
      return respond(data);
    }

    // ── BULK SET ACCESS (for new tier/feature) ──
    if (action === "bulk_set_access") {
      const { rows } = body; // Array of { tier_id, feature_id, enabled }
      const { data, error } = await admin.from("tier_feature_access").upsert(rows, { onConflict: "tier_id,feature_id" }).select();
      if (error) throw error;
      return respond(data);
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  function respond(data: unknown) {
    return new Response(JSON.stringify(data), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


// ======================================================================
// FILE: supabase/functions/check-subscription/index.ts
// ======================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData?.user) {
      logStep("Invalid or expired token, returning unsubscribed");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const userEmail = userData.user.email;
    if (!userEmail) {
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    logStep("User authenticated", { email: userEmail });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let productId: string | null = null;
    let subscriptionEnd: string | null = null;

    if (hasActiveSub) {
      const sub = subscriptions.data[0];
      subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();
      productId = sub.items.data[0].price.product as string;
      logStep("Active subscription", { productId, subscriptionEnd });
    }

    return new Response(
      JSON.stringify({ subscribed: hasActiveSub, product_id: productId, subscription_end: subscriptionEnd }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});


// ======================================================================
// FILE: supabase/functions/create-checkout/index.ts
// ======================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { priceId } = await req.json();
    if (!priceId) throw new Error("priceId is required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/home?checkout=success`,
      cancel_url: `${req.headers.get("origin")}/pricing?checkout=canceled`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});


// ======================================================================
// FILE: supabase/functions/customer-portal/index.ts
// ======================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) throw new Error("No Stripe customer found");

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${origin}/pricing`,
    });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});


// ======================================================================
// FILE: supabase/functions/geocode-brands/index.ts
// ======================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "EwardNestApp/1.0" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Parse optional batch_size from body (default 10)
    let batchSize = 10;
    try {
      const body = await req.json();
      if (body?.batch_size) batchSize = Math.min(body.batch_size, 30);
    } catch { /* empty body is fine */ }

    // Find brands with address but no coordinates
    const { data: brands, error } = await adminClient
      .from("brands")
      .select("id, name, address_line")
      .not("address_line", "is", null)
      .is("latitude", null)
      .limit(batchSize);

    if (error) throw error;

    const results: { id: string; name: string; status: string }[] = [];
    let remaining = 0;

    // Count total remaining
    const { count } = await adminClient
      .from("brands")
      .select("id", { count: "exact", head: true })
      .not("address_line", "is", null)
      .is("latitude", null);
    remaining = (count ?? 0) - (brands?.length ?? 0);

    for (const brand of brands ?? []) {
      if (!brand.address_line) continue;

      // Rate limit: Nominatim asks for 1 req/sec
      await new Promise((r) => setTimeout(r, 1100));

      const coords = await geocodeAddress(brand.address_line);
      if (coords) {
        const { error: updateError } = await adminClient
          .from("brands")
          .update({ latitude: coords.lat, longitude: coords.lon })
          .eq("id", brand.id);

        results.push({
          id: brand.id,
          name: brand.name,
          status: updateError ? `error: ${updateError.message}` : "geocoded",
        });
      } else {
        results.push({ id: brand.id, name: brand.name, status: "not_found" });
      }
    }

    return new Response(JSON.stringify({ geocoded: results.length, remaining, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


// ======================================================================
// FILE: supabase/functions/geofence-bulk-import/index.ts
// ======================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- constants ----------
const BATCH_SIZE = 1000;
const VALID_COUNTRIES = new Set([
  "US","CA","MX","GB","FR","DE","IT","ES","PT","NL","BE","CH","AT","AU","NZ",
  "JP","KR","CN","IN","BR","AR","CL","CO","SE","NO","DK","FI","IE","PL","CZ",
  "HU","RO","BG","HR","GR","TR","ZA","EG","NG","KE","AE","SA","IL","SG","MY",
  "TH","PH","ID","VN","TW","HK","RU","UA",
]);
const VALID_STATUSES = new Set(["ACTIVE", "INACTIVE", "PENDING", "CLOSED"]);
const VALID_GEOFENCE_TYPES = new Set(["CIRCLE", "POLYGON", "MULTI_POLYGON"]);
const VALID_TRIGGERS = new Set(["ENTER", "EXIT", "DWELL"]);
const VALID_DAYS = new Set(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
const TIME_RE = /^\d{2}:\d{2}$/;

// ---------- helpers ----------
function maskPhone(phone: string | null): string {
  if (!phone) return "null";
  return phone.length > 4 ? "***" + phone.slice(-4) : "****";
}

function computeHash(obj: Record<string, unknown>): string {
  const sorted = JSON.stringify(obj, Object.keys(obj).sort());
  let h = 0;
  for (let i = 0; i < sorted.length; i++) {
    h = ((h << 5) - h + sorted.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

interface LocationRecord {
  location_id: string;
  brand_code: string;
  gem_id: string;
  name: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state_province: string;
  postal_code: string;
  country_code: string;
  latitude: number;
  longitude: number;
  phone?: string | null;
  open_date?: string | null;
  status: string;
  geofence: {
    geofence_id: string;
    type: string;
    radius_m?: number;
    polygon_coords?: number[][];
    active_hours?: { day_of_week: string; start_time: string; end_time: string }[] | null;
    triggers: string[];
    dwell_seconds?: number | null;
    priority: number;
    metadata?: Record<string, unknown> | null;
  };
  metadata?: Record<string, unknown> | null;
}

interface ValidationError {
  location_id: string;
  geofence_id?: string;
  error_code: string;
  message: string;
}

function validateLocation(loc: LocationRecord): ValidationError[] {
  const errs: ValidationError[] = [];
  const lid = loc.location_id || "UNKNOWN";

  if (!loc.location_id) errs.push({ location_id: lid, error_code: "MISSING_LOCATION_ID", message: "location_id required" });
  if (!loc.brand_code) errs.push({ location_id: lid, error_code: "MISSING_BRAND_CODE", message: "brand_code required" });
  if (!loc.gem_id) errs.push({ location_id: lid, error_code: "MISSING_GEM_ID", message: "gem_id required" });
  if (!loc.name) errs.push({ location_id: lid, error_code: "MISSING_NAME", message: "name required" });
  if (!loc.address_line1) errs.push({ location_id: lid, error_code: "MISSING_ADDRESS", message: "address_line1 required" });
  if (!loc.city) errs.push({ location_id: lid, error_code: "MISSING_CITY", message: "city required" });
  if (!loc.state_province) errs.push({ location_id: lid, error_code: "MISSING_STATE", message: "state_province required" });
  if (!loc.postal_code) errs.push({ location_id: lid, error_code: "MISSING_POSTAL", message: "postal_code required" });
  if (!loc.country_code || !VALID_COUNTRIES.has(loc.country_code)) errs.push({ location_id: lid, error_code: "INVALID_COUNTRY", message: `Invalid country_code: ${loc.country_code}` });
  if (typeof loc.latitude !== "number" || loc.latitude < -90 || loc.latitude > 90) errs.push({ location_id: lid, error_code: "INVALID_LAT", message: `latitude must be [-90,90]: ${loc.latitude}` });
  if (typeof loc.longitude !== "number" || loc.longitude < -180 || loc.longitude > 180) errs.push({ location_id: lid, error_code: "INVALID_LNG", message: `longitude must be [-180,180]: ${loc.longitude}` });
  if (!VALID_STATUSES.has(loc.status)) errs.push({ location_id: lid, error_code: "INVALID_STATUS", message: `Invalid status: ${loc.status}` });

  // Geofence validation
  const gf = loc.geofence;
  if (!gf) {
    errs.push({ location_id: lid, error_code: "MISSING_GEOFENCE", message: "geofence object required" });
    return errs;
  }
  if (!gf.geofence_id) errs.push({ location_id: lid, geofence_id: gf.geofence_id, error_code: "MISSING_GF_ID", message: "geofence_id required" });
  if (!VALID_GEOFENCE_TYPES.has(gf.type)) errs.push({ location_id: lid, geofence_id: gf.geofence_id, error_code: "INVALID_GF_TYPE", message: `Invalid type: ${gf.type}` });
  if (gf.type === "CIRCLE" && (typeof gf.radius_m !== "number" || gf.radius_m <= 0)) errs.push({ location_id: lid, geofence_id: gf.geofence_id, error_code: "INVALID_RADIUS", message: "radius_m must be > 0 for CIRCLE" });
  if ((gf.type === "POLYGON" || gf.type === "MULTI_POLYGON") && (!Array.isArray(gf.polygon_coords) || gf.polygon_coords.length < 3)) errs.push({ location_id: lid, geofence_id: gf.geofence_id, error_code: "INVALID_POLYGON", message: "polygon_coords needs >= 3 points" });

  if (gf.triggers) {
    for (const t of gf.triggers) {
      if (!VALID_TRIGGERS.has(t)) errs.push({ location_id: lid, geofence_id: gf.geofence_id, error_code: "INVALID_TRIGGER", message: `Invalid trigger: ${t}` });
    }
  }

  if (gf.active_hours && Array.isArray(gf.active_hours)) {
    for (const ah of gf.active_hours) {
      if (!VALID_DAYS.has(ah.day_of_week)) errs.push({ location_id: lid, geofence_id: gf.geofence_id, error_code: "INVALID_DAY", message: `Invalid day: ${ah.day_of_week}` });
      if (!TIME_RE.test(ah.start_time)) errs.push({ location_id: lid, geofence_id: gf.geofence_id, error_code: "INVALID_TIME", message: `Invalid start_time: ${ah.start_time}` });
      if (!TIME_RE.test(ah.end_time)) errs.push({ location_id: lid, geofence_id: gf.geofence_id, error_code: "INVALID_TIME", message: `Invalid end_time: ${ah.end_time}` });
    }
  }

  return errs;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { source_id, locations } = body as { source_id: string; locations: LocationRecord[] };

    if (!source_id) throw new Error("source_id required");
    if (!Array.isArray(locations) || locations.length === 0) throw new Error("locations array required and non-empty");

    const jobId = `job_${source_id}_${Date.now()}`;
    const startTime = Date.now();

    // Create job record
    await supabase.from("geofence_import_jobs").insert({
      job_id: jobId,
      source_id,
      status: "PROCESSING",
    });

    // ---------- Step 1: Preflight validation ----------
    const allErrors: ValidationError[] = [];
    const validLocations: LocationRecord[] = [];

    for (const loc of locations) {
      const errs = validateLocation(loc);
      if (errs.length > 0) {
        allErrors.push(...errs);
      } else {
        validLocations.push(loc);
      }
    }

    const errorRate = allErrors.length / locations.length;
    if (errorRate > 0.01 && allErrors.length > 0) {
      // Abort if >1% fail validation
      await supabase.from("geofence_import_jobs").update({
        status: "FAILED",
        summary: { processed: 0, inserted: 0, updated: 0, skipped: 0, review_count: 0, errors: allErrors.length, elapsed_time: Date.now() - startTime },
        errors: allErrors.slice(0, 500),
        completed_at: new Date().toISOString(),
      }).eq("job_id", jobId);

      return new Response(JSON.stringify({
        job_id: jobId,
        status: "FAILED",
        summary: { processed: 0, inserted: 0, updated: 0, skipped: 0, review_count: 0, errors: allErrors.length, elapsed_time: Date.now() - startTime },
        errors: allErrors.slice(0, 200),
        review_csv_url: null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }

    // ---------- Step 2: Resolve brands ----------
    const brandCodes = [...new Set(validLocations.map((l) => l.brand_code))];
    const { data: existingBrands } = await supabase.from("brands").select("id, name").in("name", brandCodes);
    const brandMap = new Map<string, string>();
    for (const b of existingBrands || []) {
      brandMap.set(b.name.toLowerCase(), b.id);
    }

    // Create placeholder brands for missing codes
    const missingCodes = brandCodes.filter((c) => !brandMap.has(c.toLowerCase()));
    for (const code of missingCodes) {
      const { data: newBrand } = await supabase.from("brands").insert({ name: code, category: "PENDING_REVIEW", logo_emoji: "🏪" }).select("id").single();
      if (newBrand) brandMap.set(code.toLowerCase(), newBrand.id);
    }

    // ---------- Step 3: Process in batches ----------
    let inserted = 0, updated = 0, skipped = 0, reviewCount = 0;
    const reviewRecords: Record<string, unknown>[] = [];
    const auditEntries: Record<string, unknown>[] = [];

    for (let i = 0; i < validLocations.length; i += BATCH_SIZE) {
      const batch = validLocations.slice(i, i + BATCH_SIZE);

      for (const loc of batch) {
        const brandId = brandMap.get(loc.brand_code.toLowerCase());
        if (!brandId) {
          allErrors.push({ location_id: loc.location_id, error_code: "BRAND_NOT_FOUND", message: `Could not resolve brand: ${loc.brand_code}` });
          auditEntries.push({ job_id: jobId, source_id, entity_type: "LOCATION", entity_id: loc.location_id, action: "ERROR", details: { error: "brand_not_found" } });
          continue;
        }

        // Compute hashes
        const locHashFields = { name: loc.name, address_line1: loc.address_line1, city: loc.city, state_province: loc.state_province, postal_code: loc.postal_code, latitude: loc.latitude, longitude: loc.longitude, status: loc.status };
        const locHash = computeHash(locHashFields as unknown as Record<string, unknown>);

        const gfHashFields = { type: loc.geofence.type, radius_m: loc.geofence.radius_m, triggers: loc.geofence.triggers, priority: loc.geofence.priority, active_hours: loc.geofence.active_hours, dwell_seconds: loc.geofence.dwell_seconds };
        const gfHash = computeHash(gfHashFields as unknown as Record<string, unknown>);

        // ---------- Brand-Gem mapping ----------
        const { data: existingGem } = await supabase.from("brand_gem_mapping").select("id, brand_id, status").eq("gem_id", loc.gem_id).maybeSingle();

        if (existingGem && existingGem.brand_id !== brandId) {
          // Conflict — gem already linked to different brand
          reviewRecords.push({
            type: "GEM_CONFLICT",
            location_id: loc.location_id,
            gem_id: loc.gem_id,
            existing_brand_id: existingGem.brand_id,
            new_brand_id: brandId,
            message: "gem_id already linked to different brand",
          });
          reviewCount++;
          auditEntries.push({ job_id: jobId, source_id, entity_type: "BRAND_GEM", entity_id: loc.gem_id, action: "REVIEW", details: { existing_brand: existingGem.brand_id, new_brand: brandId } });
        } else if (!existingGem) {
          await supabase.from("brand_gem_mapping").insert({ brand_id: brandId, gem_id: loc.gem_id, location_id: loc.location_id, source_id, status: "LINKED" });
          auditEntries.push({ job_id: jobId, source_id, entity_type: "BRAND_GEM", entity_id: loc.gem_id, action: "INSERT", details: { brand_id: brandId } });
        }

        // ---------- Upsert brand_location ----------
        const { data: existingLoc } = await supabase.from("brand_locations").select("id").eq("name", loc.name).eq("brand_id", brandId).eq("latitude", loc.latitude).eq("longitude", loc.longitude).maybeSingle();

        let brandLocationId: string;
        if (existingLoc) {
          brandLocationId = existingLoc.id;
          skipped++;
          auditEntries.push({ job_id: jobId, source_id, entity_type: "LOCATION", entity_id: loc.location_id, action: "SKIP", details: { brand_location_id: brandLocationId } });
        } else {
          const { data: newLoc } = await supabase.from("brand_locations").insert({
            brand_id: brandId,
            name: loc.name,
            address_line: [loc.address_line1, loc.address_line2].filter(Boolean).join(", "),
            city: loc.city,
            state: loc.state_province,
            zip_code: loc.postal_code,
            country: loc.country_code,
            latitude: loc.latitude,
            longitude: loc.longitude,
            phone: loc.phone,
            geofence_radius_meters: loc.geofence.type === "CIRCLE" ? Math.round(loc.geofence.radius_m || 200) : 200,
          }).select("id").single();

          brandLocationId = newLoc?.id || "";
          inserted++;
          auditEntries.push({ job_id: jobId, source_id, entity_type: "LOCATION", entity_id: loc.location_id, action: "INSERT", details: { brand_location_id: brandLocationId, phone: maskPhone(loc.phone || null) } });
        }

        // ---------- Upsert geofence ----------
        const gf = loc.geofence;
        const { data: existingGf } = await supabase.from("geofences").select("id, import_hash, brand_id, location_id").eq("geofence_id", gf.geofence_id).maybeSingle();

        if (existingGf) {
          if (existingGf.import_hash === gfHash) {
            auditEntries.push({ job_id: jobId, source_id, entity_type: "GEOFENCE", entity_id: gf.geofence_id, action: "SKIP", details: { hash: gfHash } });
          } else if (existingGf.brand_id !== brandId) {
            // Geofence linked to different brand — review
            reviewRecords.push({
              type: "GEOFENCE_BRAND_CONFLICT",
              geofence_id: gf.geofence_id,
              location_id: loc.location_id,
              existing_brand_id: existingGf.brand_id,
              new_brand_id: brandId,
            });
            reviewCount++;
            auditEntries.push({ job_id: jobId, source_id, entity_type: "GEOFENCE", entity_id: gf.geofence_id, action: "REVIEW", details: { conflict: "brand_mismatch" } });
          } else {
            await supabase.from("geofences").update({
              location_id: loc.location_id,
              brand_location_id: brandLocationId,
              type: gf.type,
              radius_m: gf.radius_m || 200,
              polygon_coords: gf.polygon_coords || null,
              active_hours: gf.active_hours || null,
              triggers: gf.triggers,
              dwell_seconds: gf.dwell_seconds || null,
              priority: gf.priority,
              metadata: gf.metadata || null,
              import_hash: gfHash,
              status: loc.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
              source_id,
            }).eq("id", existingGf.id);

            updated++;
            auditEntries.push({ job_id: jobId, source_id, entity_type: "GEOFENCE", entity_id: gf.geofence_id, action: "UPDATE", details: { old_hash: existingGf.import_hash, new_hash: gfHash } });
          }
        } else {
          await supabase.from("geofences").insert({
            geofence_id: gf.geofence_id,
            location_id: loc.location_id,
            brand_id: brandId,
            brand_location_id: brandLocationId,
            type: gf.type,
            radius_m: gf.radius_m || 200,
            polygon_coords: gf.polygon_coords || null,
            active_hours: gf.active_hours || null,
            triggers: gf.triggers,
            dwell_seconds: gf.dwell_seconds || null,
            priority: gf.priority,
            metadata: gf.metadata || null,
            import_hash: gfHash,
            status: loc.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
            source_id,
          });

          auditEntries.push({ job_id: jobId, source_id, entity_type: "GEOFENCE", entity_id: gf.geofence_id, action: "INSERT", details: { brand_id: brandId } });
        }
      }

      // Flush audit entries per batch
      if (auditEntries.length > 0) {
        await supabase.from("geofence_audit_log").insert(auditEntries);
        auditEntries.length = 0;
      }
    }

    // ---------- Step 4: Generate review CSV ----------
    let reviewCsvUrl: string | null = null;
    if (reviewRecords.length > 0) {
      const csvHeader = "type,location_id,gem_id,geofence_id,existing_brand_id,new_brand_id,message\n";
      const csvRows = reviewRecords.map((r) =>
        `${r.type || ""},${r.location_id || ""},${r.gem_id || ""},${r.geofence_id || ""},${r.existing_brand_id || ""},${r.new_brand_id || ""},${r.message || ""}`
      ).join("\n");
      const csvContent = csvHeader + csvRows;
      const csvBlob = new Blob([csvContent], { type: "text/csv" });
      const csvPath = `reviews/${jobId}_review.csv`;

      // Try uploading to storage
      const { error: uploadErr } = await supabase.storage.from("avatars").upload(csvPath, csvBlob, { contentType: "text/csv", upsert: true });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(csvPath);
        reviewCsvUrl = urlData?.publicUrl || null;
      }
    }

    // ---------- Step 5: Finalize job ----------
    const elapsed = Date.now() - startTime;
    const finalStatus = allErrors.length > 0 ? "PARTIAL_SUCCESS" : "SUCCESS";
    const summary = {
      processed: validLocations.length,
      inserted,
      updated,
      skipped,
      review_count: reviewCount,
      errors: allErrors.length,
      elapsed_time: elapsed,
    };

    await supabase.from("geofence_import_jobs").update({
      status: finalStatus,
      summary,
      errors: allErrors.slice(0, 500),
      review_csv_url: reviewCsvUrl,
      completed_at: new Date().toISOString(),
    }).eq("job_id", jobId);

    return new Response(JSON.stringify({
      job_id: jobId,
      status: finalStatus,
      summary,
      errors: allErrors.slice(0, 200),
      review_csv_url: reviewCsvUrl,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("Geofence bulk import error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

