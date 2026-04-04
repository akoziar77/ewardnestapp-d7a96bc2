import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Users, Gift, ArrowUpRight, ArrowDownRight, ScanLine, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

type Ctx = { merchantId: string; merchantName: string };

export default function MerchantOverview() {
  const { merchantId, merchantName } = useOutletContext<Ctx>();

  const { data: stats } = useQuery({
    queryKey: ["merchant-stats", merchantId],
    queryFn: async () => {
      const [ledgerRes, redemptionRes, rewardRes] = await Promise.all([
        supabase
          .from("ledger_entries")
          .select("id, delta_points, type, user_id, created_at")
          .eq("merchant_id", merchantId),
        supabase
          .from("redemptions")
          .select("points_spent, created_at")
          .eq("merchant_id", merchantId),
        supabase
          .from("rewards")
          .select("id")
          .eq("merchant_id", merchantId),
      ]);

      const ledger = ledgerRes.data ?? [];
      const redemptions = redemptionRes.data ?? [];
      const rewards = rewardRes.data ?? [];

      const totalEarned = ledger
        .filter((e) => e.type === "earn")
        .reduce((s, e) => s + e.delta_points, 0);
      const totalRedeemed = redemptions.reduce((s, r) => s + r.points_spent, 0);
      const uniqueUsers = new Set(ledger.map((e) => e.user_id)).size;

      // Last 7 days activity
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentCheckins = ledger.filter(
        (e) => e.type === "earn" && new Date(e.created_at) >= sevenDaysAgo
      ).length;

      return {
        totalEarned,
        totalRedeemed,
        uniqueUsers,
        activeRewards: rewards.length,
        recentCheckins,
        recentEntries: ledger
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 8),
      };
    },
    enabled: !!merchantId,
  });

  const cards = [
    {
      label: "Points earned",
      value: stats?.totalEarned?.toLocaleString() ?? "–",
      icon: TrendingUp,
      color: "text-primary bg-primary/10",
      sub: `${stats?.recentCheckins ?? 0} check-ins this week`,
      trend: "up" as const,
    },
    {
      label: "Points redeemed",
      value: stats?.totalRedeemed?.toLocaleString() ?? "–",
      icon: ArrowDownRight,
      color: "text-secondary bg-secondary/10",
      sub: "Total lifetime",
      trend: "neutral" as const,
    },
    {
      label: "Active users",
      value: stats?.uniqueUsers?.toLocaleString() ?? "–",
      icon: Users,
      color: "text-primary bg-primary/10",
      sub: "Unique customers",
      trend: "up" as const,
    },
    {
      label: "Active rewards",
      value: stats?.activeRewards?.toString() ?? "–",
      icon: Gift,
      color: "text-secondary bg-secondary/10",
      sub: "In catalog",
      trend: "neutral" as const,
    },
  ];

  return (
    <div className="px-6 py-8 md:px-10 md:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">{merchantName}</h1>
        <p className="text-sm text-muted-foreground mt-1">Dashboard overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border bg-card p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.color}`}>
                <card.icon className="h-5 w-5" />
              </div>
              {card.trend === "up" && (
                <ArrowUpRight className="h-4 w-4 text-[hsl(var(--success))]" />
              )}
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums tracking-tight">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
            </div>
            <p className="text-xs text-muted-foreground">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Recent activity
        </h2>
        {stats?.recentEntries?.length ? (
          <div className="space-y-2">
            {stats.recentEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4"
              >
                <div>
                  <p className="text-sm font-medium">
                    {entry.type === "earn" ? "Check-in" : entry.type === "redeem" ? "Redemption" : entry.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span
                  className={`text-sm font-bold tabular-nums ${
                    entry.delta_points > 0
                      ? "text-[hsl(var(--success))]"
                      : "text-destructive"
                  }`}
                >
                  {entry.delta_points > 0 ? "+" : ""}
                  {entry.delta_points}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No activity yet. Share your QR code to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}
