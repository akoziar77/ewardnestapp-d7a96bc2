import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QrCode, Gift, TrendingUp, History, UserCircle, Store, Heart, Sparkles, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: recentEntries } = useQuery({
    queryKey: ["ledger", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ledger_entries")
        .select("*, merchants(name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: favoriteBrands = [] } = useQuery({
    queryKey: ["favorite-brands-home", user?.id],
    queryFn: async () => {
      const { data: favs } = await supabase
        .from("favorite_brands")
        .select("brand_id")
        .eq("user_id", user!.id);
      if (!favs?.length) return [];
      const brandIds = favs.map((f: any) => f.brand_id);
      const { data: brands } = await supabase
        .from("brands")
        .select("*")
        .in("id", brandIds);
      return brands ?? [];
    },
    enabled: !!user,
  });

  const { data: brandVisits = [] } = useQuery({
    queryKey: ["brand-visits", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("brand_visits")
        .select("brand_id, created_at")
        .eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  // Fetch ledger entries expiring within next 30 days per brand
  const { data: expiringEntries = [] } = useQuery({
    queryKey: ["expiring-points", user?.id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);
      const { data } = await supabase
        .from("ledger_entries")
        .select("delta_points, expires_at, metadata")
        .eq("user_id", user!.id)
        .eq("type", "brand_milestone")
        .gt("expires_at", now)
        .lte("expires_at", nextMonth.toISOString());
      return data ?? [];
    },
    enabled: !!user,
  });

  // Fetch external loyalty connections for aggregated external points
  const { data: loyaltyConnections = [] } = useQuery({
    queryKey: ["external-loyalty-home", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("external_loyalty_connections" as any)
        .select("external_points_balance, provider_name, brand_id")
        .eq("user_id", user!.id)
        .eq("status", "connected");
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  // Compute total points from latest balance per merchant
  const totalPoints = (() => {
    if (!recentEntries?.length) return 0;
    const merchantBalances = new Map<string, number>();
    for (const e of recentEntries) {
      if (!merchantBalances.has(e.merchant_id)) {
        merchantBalances.set(e.merchant_id, e.balance_after);
      }
    }
    return Array.from(merchantBalances.values()).reduce((a, b) => a + b, 0);
  })();

  const totalExternalPoints = loyaltyConnections.reduce(
    (sum: number, c: any) => sum + (c.external_points_balance ?? 0),
    0
  );

  const hasActivity = (recentEntries?.length ?? 0) > 0;
  const greeting = profile?.display_name
    ? `Hey, ${profile.display_name}`
    : "Hey there";

  const visitCountForBrand = (brandId: string) => {
    const brand = favoriteBrands.find((b: any) => b.id === brandId);
    const expiryMonths = brand?.visit_expiry_months ?? 6;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - expiryMonths);
    return brandVisits.filter(
      (v: any) => v.brand_id === brandId && new Date(v.created_at) > cutoff
    ).length;
  };

  const expiringPointsForBrand = (brandId: string) => {
    return expiringEntries
      .filter((e: any) => (e.metadata as any)?.brand_id === brandId)
      .reduce((sum: number, e: any) => sum + e.delta_points, 0);
  };

  // Show toast notification for expiring points (once per session)
  const toastShown = useRef(false);
  useEffect(() => {
    if (toastShown.current || expiringEntries.length === 0) return;
    const totalExpiring = expiringEntries.reduce((sum: number, e: any) => sum + e.delta_points, 0);
    if (totalExpiring > 0) {
      toastShown.current = true;
      toast.warning(`⏰ ${totalExpiring} points expiring in the next 30 days`, {
        description: "Visit your favorite brands to earn more before they expire!",
        duration: 8000,
        action: {
          label: "View Brands",
          onClick: () => navigate("/brands"),
        },
      });
    }
  }, [expiringEntries, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-12 pb-4">
        <div>
          <p className="text-sm text-muted-foreground">Good to see you 👋</p>
          <h1 className="text-xl font-bold tracking-tight">{greeting}</h1>
        </div>
        <button
          onClick={() => navigate("/profile")}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:text-foreground active:scale-95"
        >
          <UserCircle className="h-5 w-5" />
        </button>
      </header>

      {/* Points card */}
      <div className="px-6 py-4">
        <div className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-xl shadow-primary/15">
          <div className="relative z-10">
            <p className="text-sm font-medium opacity-80">In-app points</p>
            <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">
              {totalPoints.toLocaleString()}
            </p>
            <div className="mt-3 flex items-center gap-2 text-sm opacity-80">
              <TrendingUp className="h-4 w-4" />
              <span>
                {hasActivity
                  ? `${recentEntries!.length} recent transaction${recentEntries!.length > 1 ? "s" : ""}`
                  : "No activity yet — start scanning!"}
              </span>
            </div>
          </div>
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-white/5" />
        </div>
      </div>

      {/* External loyalty card */}
      {loyaltyConnections.length > 0 && (
        <div className="px-6 pb-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                External loyalty
              </h2>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {totalExternalPoints.toLocaleString()}
                <span className="text-xs font-medium text-muted-foreground ml-1">pts</span>
              </p>
            </div>
            <div className="space-y-2.5">
              {loyaltyConnections.map((conn: any) => (
                <button
                  key={conn.brand_id}
                  onClick={() => navigate("/brands")}
                  className="flex w-full items-center gap-3 rounded-xl bg-muted/50 px-3.5 py-3 text-left transition-all hover:bg-muted active:scale-[0.98]"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Link2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{conn.provider_name}</p>
                    <p className="text-[11px] text-muted-foreground">Connected program</p>
                  </div>
                  <p className="text-base font-bold tabular-nums text-foreground">
                    {(conn.external_points_balance ?? 0).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="px-6 py-4">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Quick actions
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: QrCode, label: "Scan", color: "bg-primary/10 text-primary", onClick: () => navigate("/scan") },
            { icon: Gift, label: "Rewards", color: "bg-secondary/10 text-secondary", onClick: () => navigate("/rewards") },
            { icon: Store, label: "Brands", color: "bg-primary/10 text-primary", onClick: () => navigate("/brands") },
            { icon: History, label: "History", color: "bg-muted text-muted-foreground", onClick: () => navigate("/history") },
          ].map(({ icon: Icon, label, color, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-sm active:scale-[0.96]"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Favorite brands */}
      {favoriteBrands.length > 0 && (
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 fill-destructive text-destructive" />
              Favorite brands
            </h2>
            <button
              onClick={() => navigate("/brands")}
              className="text-xs font-medium text-primary active:scale-95"
            >
              View all
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {favoriteBrands.map((brand: any) => {
              const count = visitCountForBrand(brand.id);
              const progress = Math.min(
                (count / brand.milestone_visits) * 100,
                100
              );
              const expPts = expiringPointsForBrand(brand.id);
              const extConn = loyaltyConnections.find((c: any) => c.brand_id === brand.id);
              const extPts = extConn?.external_points_balance ?? 0;
              return (
                <button
                  key={brand.id}
                  onClick={() => navigate("/brands")}
                  className="flex shrink-0 w-32 flex-col items-center gap-1.5 rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-sm active:scale-[0.96]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-2xl">
                    {brand.logo_emoji}
                  </div>
                  <p className="text-xs font-semibold truncate w-full text-center">
                    {brand.name}
                  </p>
                  <Progress value={progress} className="h-1 w-full" />
                  <p className="text-[10px] tabular-nums text-muted-foreground">
                    {count}/{brand.milestone_visits}
                  </p>
                  <p className="text-[10px] font-semibold text-primary">
                    {brand.milestone_points} pts
                  </p>
                  {extPts > 0 && (
                    <p className="text-[10px] font-medium text-foreground/70 flex items-center gap-0.5">
                      <Link2 className="h-2.5 w-2.5" />
                      {extPts.toLocaleString()}
                    </p>
                  )}
                  {expPts > 0 && (
                    <p className="text-[9px] font-medium text-destructive leading-tight text-center">
                      ⚠ {expPts} pts expiring soon
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent activity or empty state */}
      {hasActivity ? (
        <div className="px-6 py-4">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Recent activity
          </h2>
          <div className="space-y-2">
            {recentEntries!.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
              >
                <div>
                  <p className="text-sm font-medium">
                    {(entry as any).merchants?.name ?? "Unknown"}
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
                    entry.delta_points > 0 ? "text-[hsl(var(--success))]" : "text-destructive"
                  }`}
                >
                  {entry.delta_points > 0 ? "+" : ""}
                  {entry.delta_points}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <Gift className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">No rewards yet</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Visit a partner merchant and scan their QR code to start earning points.
          </p>
          <Button
            variant="outline"
            className="mt-4 active:scale-[0.97]"
            onClick={() => navigate("/scan")}
          >
            Scan a QR code
          </Button>
        </div>
      )}
      <BottomNav />
    </div>
  );
}
