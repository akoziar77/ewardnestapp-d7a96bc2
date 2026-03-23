import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  errorResponse,
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

    const anonKey =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) return errorResponse("unauthorized", 401);

    const body = await req.json();
    const { action, brand_id } = body;

    // ── Authorization: admin OR merchant member for the brand ──
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role_id, roles(name)")
      .eq("user_id", user.id)
      .limit(10);

    const isAdmin = adminRole?.some(
      (r: any) => (r as any).roles?.name === "admin"
    );

    let authorizedBrandId: string | null = brand_id ?? null;

    if (!isAdmin) {
      // Check merchant membership to derive brand access
      const { data: membership } = await supabaseAdmin
        .from("merchant_users")
        .select("merchant_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!membership) return errorResponse("forbidden", 403);

      // If no brand_id provided, we can't scope queries
      if (!authorizedBrandId) {
        return errorResponse("brand_id required for non-admin users", 400);
      }
    }

    if (!authorizedBrandId) {
      return errorResponse("brand_id required", 400);
    }

    switch (action) {
      // ── Summary metrics ──
      case "summary": {
        const [receiptsRes, txRes] = await Promise.all([
          supabaseAdmin
            .from("receipt_uploads")
            .select("total_amount, status, confidence")
            .eq("brand_id", authorizedBrandId),
          supabaseAdmin
            .from("transactions")
            .select("points_earned")
            .eq("brand_id", authorizedBrandId),
        ]);

        const receipts = receiptsRes.data ?? [];
        const transactions = txRes.data ?? [];

        const approved = receipts.filter((r) => r.status === "approved");
        const totalSpend = receipts.reduce(
          (s, r) => s + (Number(r.total_amount) || 0),
          0
        );
        const receiptCount = receipts.length;
        const avgBasket = receiptCount ? totalSpend / receiptCount : 0;
        const avgConfidence =
          receipts.length > 0
            ? receipts.reduce((s, r) => s + (Number(r.confidence) || 0), 0) /
              receipts.length
            : 0;
        const totalPoints = transactions.reduce(
          (s, t) => s + (t.points_earned || 0),
          0
        );

        return jsonResponse({
          total_spend: Math.round(totalSpend * 100) / 100,
          receipt_count: receiptCount,
          approved_count: approved.length,
          avg_basket: Math.round(avgBasket * 100) / 100,
          avg_confidence: Math.round(avgConfidence * 100) / 100,
          total_points_awarded: totalPoints,
        });
      }

      // ── SKU / line-item insights ──
      case "sku_insights": {
        const { data: receiptIds } = await supabaseAdmin
          .from("receipt_uploads")
          .select("id")
          .eq("brand_id", authorizedBrandId);

        const ids = receiptIds?.map((r) => r.id) ?? [];
        if (ids.length === 0) return jsonResponse({ items: [] });

        const { data: items } = await supabaseAdmin
          .from("receipt_line_items")
          .select("item_name, quantity, price, category, sku")
          .in("receipt_id", ids);

        const map: Record<
          string,
          { qty: number; revenue: number; category: string | null; sku: string | null }
        > = {};

        for (const item of items ?? []) {
          const key = item.item_name ?? "Unknown";
          if (!map[key]) {
            map[key] = { qty: 0, revenue: 0, category: item.category, sku: item.sku };
          }
          map[key].qty += Number(item.quantity) || 0;
          map[key].revenue +=
            (Number(item.price) || 0) * (Number(item.quantity) || 1);
        }

        const result = Object.entries(map)
          .map(([name, stats]) => ({
            name,
            quantity_sold: stats.qty,
            revenue: Math.round(stats.revenue * 100) / 100,
            category: stats.category,
            sku: stats.sku,
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 100);

        return jsonResponse({ items: result });
      }

      // ── Top customers ──
      case "top_customers": {
        const limit = body.limit ?? 20;

        const { data } = await supabaseAdmin
          .from("receipt_uploads")
          .select("user_id, total_amount")
          .eq("brand_id", authorizedBrandId);

        const map: Record<string, { spend: number; count: number }> = {};

        for (const r of data ?? []) {
          if (!r.user_id) continue;
          if (!map[r.user_id]) map[r.user_id] = { spend: 0, count: 0 };
          map[r.user_id].spend += Number(r.total_amount) || 0;
          map[r.user_id].count++;
        }

        const customers = Object.entries(map)
          .map(([user_id, stats]) => ({
            user_id,
            total_spend: Math.round(stats.spend * 100) / 100,
            receipt_count: stats.count,
          }))
          .sort((a, b) => b.total_spend - a.total_spend)
          .slice(0, limit);

        return jsonResponse({ customers });
      }

      // ── Time-series spend ──
      case "timeseries": {
        const days = body.days ?? 30;
        const since = new Date();
        since.setDate(since.getDate() - days);

        const { data } = await supabaseAdmin
          .from("receipt_uploads")
          .select("total_amount, created_at")
          .eq("brand_id", authorizedBrandId)
          .gte("created_at", since.toISOString());

        const map: Record<string, { spend: number; count: number }> = {};

        for (const r of data ?? []) {
          const day = r.created_at.split("T")[0];
          if (!map[day]) map[day] = { spend: 0, count: 0 };
          map[day].spend += Number(r.total_amount) || 0;
          map[day].count++;
        }

        const timeseries = Object.entries(map)
          .map(([date, stats]) => ({
            date,
            spend: Math.round(stats.spend * 100) / 100,
            receipt_count: stats.count,
          }))
          .sort((a, b) => (a.date > b.date ? 1 : -1));

        return jsonResponse({ timeseries });
      }

      // ── Booster performance ──
      case "booster_performance": {
        const { data: boosters } = await supabaseAdmin
          .from("boosters")
          .select("id, name, type, active, multiplier_value, bonus_value")
          .eq("brand_id", authorizedBrandId);

        const result = [];
        for (const booster of boosters ?? []) {
          const { data: logs } = await supabaseAdmin
            .from("booster_activity_log")
            .select("bonus_points, total_points, user_id")
            .eq("booster_id", booster.id);

          const totalBonus = (logs ?? []).reduce(
            (s, l) => s + (l.bonus_points || 0),
            0
          );
          const uniqueUsers = new Set((logs ?? []).map((l) => l.user_id)).size;

          result.push({
            booster_id: booster.id,
            name: booster.name,
            type: booster.type,
            active: booster.active,
            total_bonus_awarded: totalBonus,
            activations: logs?.length ?? 0,
            unique_users: uniqueUsers,
          });
        }

        return jsonResponse({ boosters: result });
      }

      default:
        return errorResponse("invalid_action", 400, {
          valid_actions: [
            "summary",
            "sku_insights",
            "top_customers",
            "timeseries",
            "booster_performance",
          ],
        });
    }
  } catch (err) {
    console.error("brand-receipt-insights error:", err);
    return errorResponse("internal_error", 500, { message: String(err) });
  }
});
