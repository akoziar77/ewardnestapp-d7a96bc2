import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/utils.ts";

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

    const { reward_id } = await req.json();
    if (!reward_id) return errorResponse("reward_id is required", 400);

    // Load reward
    const { data: reward, error: rewardErr } = await supabaseAdmin
      .from("store_rewards")
      .select("*")
      .eq("id", reward_id)
      .eq("active", true)
      .single();

    if (rewardErr || !reward) return errorResponse("Reward not found", 404);

    // Load profile
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("nest_points")
      .eq("user_id", user.id)
      .single();

    if (profileErr || !profile) return errorResponse("Profile not found", 404);

    if (profile.nest_points < reward.cost_points) {
      return jsonResponse({
        error: "not_enough_points",
        message: "Not enough points to redeem this reward",
        required: reward.cost_points,
        current: profile.nest_points,
      }, 400);
    }

    // Deduct points
    await supabaseAdmin
      .from("profiles")
      .update({ nest_points: profile.nest_points - reward.cost_points })
      .eq("user_id", user.id);

    return jsonResponse({
      success: true,
      reward: {
        id: reward.id,
        name: reward.name,
        reward_type: reward.reward_type,
        reward_value: reward.reward_value,
      },
      points_spent: reward.cost_points,
      new_balance: profile.nest_points - reward.cost_points,
    });
  } catch (err) {
    console.error("redeem-store-reward error:", err);
    return errorResponse("internal_error", 500, { message: String(err) });
  }
});
