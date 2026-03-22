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
