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
          min_spend: body.min_spend ?? 0,
          required_brands: body.required_brands ?? 0,
          required_streak: body.required_streak ?? 0,
        }).select().single();
        if (error) throw error;

        // Save SKU/category rules if provided
        if (body.sku_rules?.length && data.id) {
          const skuRows = body.sku_rules.map((r: any) => ({
            booster_id: data.id,
            sku_keyword: r.sku_keyword,
            points: r.points ?? 0,
          }));
          await supabaseAdmin.from("booster_sku_rules").insert(skuRows);
        }
        if (body.category_rules?.length && data.id) {
          const catRows = body.category_rules.map((r: any) => ({
            booster_id: data.id,
            category_keyword: r.category_keyword,
            points: r.points ?? 0,
          }));
          await supabaseAdmin.from("booster_category_rules").insert(catRows);
        }

        await logInfo(supabaseAdmin, "Booster created", { booster_id: data.id, admin_id: user.id });
        return jsonResponse({ success: true, booster: data });
      }

      case "update_booster": {
        requireFields(body, ["booster_id"]);
        const updates: Record<string, unknown> = {};
        for (const key of ["name", "description", "type", "active", "start_at", "end_at", "multiplier_value", "bonus_value", "required_action", "required_tier", "brand_id", "min_spend", "required_brands", "required_streak"]) {
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

        // Replace SKU rules if provided
        if (body.sku_rules !== undefined) {
          await supabaseAdmin.from("booster_sku_rules").delete().eq("booster_id", body.booster_id);
          if (body.sku_rules?.length) {
            const skuRows = body.sku_rules.map((r: any) => ({
              booster_id: body.booster_id,
              sku_keyword: r.sku_keyword,
              points: r.points ?? 0,
            }));
            await supabaseAdmin.from("booster_sku_rules").insert(skuRows);
          }
        }
        // Replace category rules if provided
        if (body.category_rules !== undefined) {
          await supabaseAdmin.from("booster_category_rules").delete().eq("booster_id", body.booster_id);
          if (body.category_rules?.length) {
            const catRows = body.category_rules.map((r: any) => ({
              booster_id: body.booster_id,
              category_keyword: r.category_keyword,
              points: r.points ?? 0,
            }));
            await supabaseAdmin.from("booster_category_rules").insert(catRows);
          }
        }

        await logInfo(supabaseAdmin, "Booster updated", { booster_id: body.booster_id, admin_id: user.id });
        return jsonResponse({ success: true, booster: data });
      }

      case "delete_booster": {
        requireFields(body, ["booster_id"]);
        // Delete related rules first
        await supabaseAdmin.from("booster_tier_rules").delete().eq("booster_id", body.booster_id);
        await supabaseAdmin.from("booster_action_rules").delete().eq("booster_id", body.booster_id);
        await supabaseAdmin.from("booster_user_targets").delete().eq("booster_id", body.booster_id);
        await supabaseAdmin.from("booster_sku_rules").delete().eq("booster_id", body.booster_id);
        await supabaseAdmin.from("booster_category_rules").delete().eq("booster_id", body.booster_id);
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
