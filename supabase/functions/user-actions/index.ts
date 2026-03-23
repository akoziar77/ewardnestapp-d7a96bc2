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
