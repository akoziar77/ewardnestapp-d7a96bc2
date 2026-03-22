import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bird, QrCode, Gift, LogOut, TrendingUp, History } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { user, signOut } = useAuth();
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

  const hasActivity = (recentEntries?.length ?? 0) > 0;
  const greeting = profile?.display_name
    ? `Hey, ${profile.display_name}`
    : "Hey there";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-12 pb-4">
        <div>
          <p className="text-sm text-muted-foreground">Good to see you 👋</p>
          <h1 className="text-xl font-bold tracking-tight">{greeting}</h1>
        </div>
        <button
          onClick={signOut}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:text-foreground active:scale-95"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {/* Points card */}
      <div className="px-6 py-4">
        <div className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-xl shadow-primary/15">
          <div className="relative z-10">
            <p className="text-sm font-medium opacity-80">Total points</p>
            <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">
              {totalPoints.toLocaleString()}
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm opacity-80">
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

      {/* Quick actions */}
      <div className="px-6 py-4">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Quick actions
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: QrCode, label: "Scan", color: "bg-primary/10 text-primary", onClick: () => navigate("/scan") },
            { icon: Gift, label: "Rewards", color: "bg-secondary/10 text-secondary", onClick: () => navigate("/rewards") },
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
    </div>
  );
}
