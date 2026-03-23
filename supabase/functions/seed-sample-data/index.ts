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
