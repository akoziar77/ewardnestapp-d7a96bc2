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
