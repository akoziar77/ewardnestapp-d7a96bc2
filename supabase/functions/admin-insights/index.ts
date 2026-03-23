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

    // Admin-only
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role_id, roles(name)")
      .eq("user_id", user.id)
      .limit(10);

    const isAdmin = adminRole?.some(
      (r: any) => (r as any).roles?.name === "admin"
    );
    if (!isAdmin) return errorResponse("forbidden", 403);

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "summary": {
        const [receiptsRes, txRes, profilesRes] = await Promise.all([
          supabaseAdmin
            .from("receipt_uploads")
            .select("total_amount, status"),
          supabaseAdmin
            .from("transactions")
            .select("points_earned"),
          supabaseAdmin
            .from("profiles")
            .select("id", { count: "exact", head: true }),
        ]);

        const receipts = receiptsRes.data ?? [];
        const transactions = txRes.data ?? [];
        const totalSpend = receipts.reduce(
          (s, r) => s + (Number(r.total_amount) || 0),
          0
        );
        const totalPoints = transactions.reduce(
          (s, t) => s + (t.points_earned || 0),
          0
        );

        return jsonResponse({
          total_spend: Math.round(totalSpend * 100) / 100,
          receipt_count: receipts.length,
          total_points: totalPoints,
          active_users: profilesRes.count ?? 0,
        });
      }

      case "health": {
        const { data: allReceipts } = await supabaseAdmin
          .from("receipt_uploads")
          .select("status, confidence, created_at")
          .order("created_at", { ascending: false })
          .limit(500);

        const recs = allReceipts ?? [];
        const total = recs.length || 1;
        const approved = recs.filter((r) => r.status === "approved").length;
        const errors = recs.filter(
          (r) => r.status === "error" || r.status === "rejected"
        ).length;
        const avgConf =
          recs.reduce((s, r) => s + (Number(r.confidence) || 0), 0) / total;

        return jsonResponse({
          ocr_success: Math.round((approved / total) * 100),
          avg_processing: Math.round(avgConf * 100) / 100,
          error_rate: Math.round((errors / total) * 100),
          queue_depth: recs.filter((r) => r.status === "pending").length,
        });
      }

      case "brands": {
        const { data: receipts } = await supabaseAdmin
          .from("receipt_uploads")
          .select("brand_id, total_amount");

        const { data: txs } = await supabaseAdmin
          .from("transactions")
          .select("brand_id, points_earned");

        const { data: allBrands } = await supabaseAdmin
          .from("brands")
          .select("id, name");

        const brandMap: Record<
          string,
          { name: string; receipts: number; spend: number; points: number }
        > = {};

        for (const b of allBrands ?? []) {
          brandMap[b.id] = { name: b.name, receipts: 0, spend: 0, points: 0 };
        }

        for (const r of receipts ?? []) {
          if (r.brand_id && brandMap[r.brand_id]) {
            brandMap[r.brand_id].receipts++;
            brandMap[r.brand_id].spend += Number(r.total_amount) || 0;
          }
        }

        for (const t of txs ?? []) {
          if (t.brand_id && brandMap[t.brand_id]) {
            brandMap[t.brand_id].points += t.points_earned || 0;
          }
        }

        const brands = Object.entries(brandMap)
          .map(([id, stats]) => ({
            id,
            ...stats,
            spend: Math.round(stats.spend * 100) / 100,
          }))
          .sort((a, b) => b.spend - a.spend)
          .slice(0, 50);

        return jsonResponse({ brands });
      }

      case "boosters": {
        const { data: boosters } = await supabaseAdmin
          .from("boosters")
          .select("id, name, type, active");

        const result = [];
        for (const booster of boosters ?? []) {
          const { data: logs } = await supabaseAdmin
            .from("booster_activity_log")
            .select("bonus_points, user_id")
            .eq("booster_id", booster.id);

          const totalBonus = (logs ?? []).reduce(
            (s, l) => s + (l.bonus_points || 0),
            0
          );

          result.push({
            booster_id: booster.id,
            name: booster.name,
            type: booster.type,
            active: booster.active,
            total_points_awarded: totalBonus,
            activations: logs?.length ?? 0,
          });
        }

        return jsonResponse({ boosters: result });
      }

      case "top_sku": {
        const { data: items } = await supabaseAdmin
          .from("receipt_line_items")
          .select("item_name, quantity, price")
          .limit(1000);

        const map: Record<string, { qty: number; revenue: number }> = {};
        for (const item of items ?? []) {
          const key = item.item_name ?? "Unknown";
          if (!map[key]) map[key] = { qty: 0, revenue: 0 };
          map[key].qty += Number(item.quantity) || 0;
          map[key].revenue +=
            (Number(item.price) || 0) * (Number(item.quantity) || 1);
        }

        const result = Object.entries(map)
          .map(([name, stats]) => ({
            name,
            quantity_sold: stats.qty,
            revenue: Math.round(stats.revenue * 100) / 100,
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 50);

        return jsonResponse({ items: result });
      }

      case "top_users": {
        const { data } = await supabaseAdmin
          .from("receipt_uploads")
          .select("user_id, total_amount");

        const map: Record<string, { spend: number; receipts: number }> = {};
        for (const r of data ?? []) {
          if (!r.user_id) continue;
          if (!map[r.user_id]) map[r.user_id] = { spend: 0, receipts: 0 };
          map[r.user_id].spend += Number(r.total_amount) || 0;
          map[r.user_id].receipts++;
        }

        const users = Object.entries(map)
          .map(([user_id, stats]) => ({
            user_id,
            spend: Math.round(stats.spend * 100) / 100,
            receipts: stats.receipts,
          }))
          .sort((a, b) => b.spend - a.spend)
          .slice(0, 30);

        return jsonResponse({ users });
      }

      case "timeseries": {
        const days = body.days ?? 30;
        const since = new Date();
        since.setDate(since.getDate() - days);

        const { data } = await supabaseAdmin
          .from("receipt_uploads")
          .select("total_amount, created_at")
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

      default:
        return errorResponse("invalid_action", 400, {
          valid_actions: [
            "summary",
            "health",
            "brands",
            "boosters",
            "top_sku",
            "top_users",
            "timeseries",
          ],
        });
    }
  } catch (err) {
    console.error("admin-insights error:", err);
    return errorResponse("internal_error", 500, { message: String(err) });
  }
});
