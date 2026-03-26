import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/utils.ts";

const SPIN_COST = 50;

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

    // Step 1: Check user points
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("nest_points")
      .eq("user_id", user.id)
      .single();

    if (profileErr || !profile) return errorResponse("Profile not found", 404);

    if (profile.nest_points < SPIN_COST) {
      return jsonResponse({ error: "not_enough_points", message: "Not enough points to spin", required: SPIN_COST, current: profile.nest_points }, 400);
    }

    // Step 2: Deduct points
    await supabaseAdmin
      .from("profiles")
      .update({ nest_points: profile.nest_points - SPIN_COST })
      .eq("user_id", user.id);

    // Step 3: Load prizes
    const { data: prizes, error: prizesErr } = await supabaseAdmin
      .from("prizes")
      .select("*")
      .eq("active", true);

    if (prizesErr || !prizes || prizes.length === 0) {
      // Refund points
      await supabaseAdmin
        .from("profiles")
        .update({ nest_points: profile.nest_points })
        .eq("user_id", user.id);
      return errorResponse("No prizes available", 500);
    }

    // Step 4-6: Weighted random selection
    const totalWeight = prizes.reduce((sum, p) => sum + (p.weight ?? 1), 0);
    let randomNumber = Math.random() * totalWeight;
    let selectedPrize = prizes[0];

    for (const prize of prizes) {
      randomNumber -= (prize.weight ?? 1);
      if (randomNumber <= 0) {
        selectedPrize = prize;
        break;
      }
    }

    // Step 7: Award prize
    if (selectedPrize.reward_type === "points") {
      const pointsWon = parseInt(selectedPrize.reward_value) || 0;
      const currentPoints = profile.nest_points - SPIN_COST;
      await supabaseAdmin
        .from("profiles")
        .update({ nest_points: currentPoints + pointsWon })
        .eq("user_id", user.id);
    }

    // Step 8: Log spin
    await supabaseAdmin.from("spin_logs").insert({
      user_id: user.id,
      prize_id: selectedPrize.id,
      points_spent: SPIN_COST,
    });

    // Step 9: Return result
    return jsonResponse({
      success: true,
      prize: {
        id: selectedPrize.id,
        name: selectedPrize.name,
        reward_type: selectedPrize.reward_type,
        reward_value: selectedPrize.reward_value,
        image_url: selectedPrize.image_url,
      },
      points_spent: SPIN_COST,
      new_balance: selectedPrize.reward_type === "points"
        ? (profile.nest_points - SPIN_COST + (parseInt(selectedPrize.reward_value) || 0))
        : (profile.nest_points - SPIN_COST),
    });
  } catch (err) {
    console.error("spin-wheel error:", err);
    return errorResponse("internal_error", 500, { message: String(err) });
  }
});
