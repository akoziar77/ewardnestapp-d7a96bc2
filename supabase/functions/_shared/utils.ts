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
