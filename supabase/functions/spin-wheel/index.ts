import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/utils.ts";

const TIER_SPIN_COST: Record<string, number> = {
  Bronze: 50,
  Hatchling: 50,
  Silver: 40,
  Gold: 30,
  Platinum: 20,
};

function getSpinCost(tier: string): number {
  return TIER_SPIN_COST[tier] ?? 50;
}

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

    // Step 1: Check user points & free spin status
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("nest_points, last_free_spin_date, free_spins_used_today, tier")
      .eq("user_id", user.id)
      .single();

    if (profileErr || !profile) return errorResponse("Profile not found", 404);

    const spinCost = getSpinCost(profile.tier);

    // Daily free spin logic
    const today = new Date().toISOString().split("T")[0];
    let freeSpinsUsed = profile.free_spins_used_today ?? 0;

    if (profile.last_free_spin_date !== today) {
      freeSpinsUsed = 0;
    }

    const isFreeSpin = freeSpinsUsed < 1;

    if (!isFreeSpin && profile.nest_points < spinCost) {
      return jsonResponse({
        error: "not_enough_points",
        message: "Not enough points to spin",
        required: spinCost,
        current: profile.nest_points,
        free_spin_available: false,
      }, 400);
    }

    // Step 2: Deduct points (skip if free spin)
    if (!isFreeSpin) {
      await supabaseAdmin
        .from("profiles")
        .update({ nest_points: profile.nest_points - spinCost })
        .eq("user_id", user.id);
    }

    // Update free spin tracking
    if (isFreeSpin) {
      await supabaseAdmin
        .from("profiles")
        .update({
          last_free_spin_date: today,
          free_spins_used_today: freeSpinsUsed + 1,
        })
        .eq("user_id", user.id);
    }

    // Step 3: Load prizes
    const { data: prizes, error: prizesErr } = await supabaseAdmin
      .from("prizes")
      .select("*")
      .eq("active", true);

    if (prizesErr || !prizes || prizes.length === 0) {
      if (!isFreeSpin) {
        await supabaseAdmin
          .from("profiles")
          .update({ nest_points: profile.nest_points })
          .eq("user_id", user.id);
      }
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
    const currentPoints = isFreeSpin ? profile.nest_points : (profile.nest_points - spinCost);
    if (selectedPrize.reward_type === "points") {
      const pointsWon = parseInt(selectedPrize.reward_value) || 0;
      await supabaseAdmin
        .from("profiles")
        .update({ nest_points: currentPoints + pointsWon })
        .eq("user_id", user.id);
    }

    // Step 8: Log spin
    await supabaseAdmin.from("spin_logs").insert({
      user_id: user.id,
      prize_id: selectedPrize.id,
      points_spent: isFreeSpin ? 0 : spinCost,
    });

    const pointsSpent = isFreeSpin ? 0 : spinCost;
    const newBalance = selectedPrize.reward_type === "points"
      ? (currentPoints + (parseInt(selectedPrize.reward_value) || 0))
      : currentPoints;

    return jsonResponse({
      success: true,
      free_spin: isFreeSpin,
      spin_cost: spinCost,
      prize: {
        id: selectedPrize.id,
        name: selectedPrize.name,
        reward_type: selectedPrize.reward_type,
        reward_value: selectedPrize.reward_value,
        image_url: selectedPrize.image_url,
      },
      points_spent: pointsSpent,
      new_balance: newBalance,
    });
  } catch (err) {
    console.error("spin-wheel error:", err);
    return errorResponse("internal_error", 500, { message: String(err) });
  }
});
