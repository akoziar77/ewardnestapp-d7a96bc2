import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Filter, Gift, QrCode, Calendar } from "lucide-react";
import { format, subDays, isAfter } from "date-fns";

type TxnFilter = "all" | "checkin" | "redemption";
type DateRange = "all" | "7d" | "30d" | "90d";

interface MergedEntry {
  id: string;
  kind: "checkin" | "redemption";
  delta: number;
  merchantName: string;
  detail: string;
  date: Date;
}

export default function History() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<TxnFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");

  const { data: ledger = [], isLoading: loadingLedger } = useQuery({
    queryKey: ["history-ledger", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ledger_entries")
        .select("id, delta_points, type, created_at, merchants(name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: redemptions = [], isLoading: loadingRedemptions } = useQuery({
    queryKey: ["history-redemptions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("redemptions")
        .select("id, points_spent, created_at, status, merchants(name), rewards(title)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const isLoading = loadingLedger || loadingRedemptions;

  // Merge into unified list
  const merged: MergedEntry[] = [
    ...ledger
      .filter((e) => e.type === "checkin")
      .map((e) => ({
        id: e.id,
        kind: "checkin" as const,
        delta: e.delta_points,
        merchantName: (e as any).merchants?.name ?? "Unknown",
        detail: `+${e.delta_points} pts earned`,
        date: new Date(e.created_at),
      })),
    ...redemptions.map((r) => ({
      id: r.id,
      kind: "redemption" as const,
      delta: -r.points_spent,
      merchantName: (r as any).merchants?.name ?? "Unknown",
      detail: (r as any).rewards?.title ?? "Reward redeemed",
      date: new Date(r.created_at),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  // Apply filters
  const filtered = merged.filter((entry) => {
    if (typeFilter !== "all" && entry.kind !== typeFilter) return false;
    if (dateRange !== "all") {
      const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
      if (!isAfter(entry.date, subDays(new Date(), days))) return false;
    }
    return true;
  });

  // Group by date
  const grouped = filtered.reduce<Record<string, MergedEntry[]>>((acc, entry) => {
    const key = format(entry.date, "MMM d, yyyy");
    (acc[key] ??= []).push(entry);
    return acc;
  }, {});

  const typeOptions: { value: TxnFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "checkin", label: "Check-ins" },
    { value: "redemption", label: "Redeemed" },
  ];

  const dateOptions: { value: DateRange; label: string }[] = [
    { value: "all", label: "All time" },
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
    { value: "90d", label: "90 days" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 pt-12 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:text-foreground active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">History</h1>
          <p className="text-sm text-muted-foreground">All your transactions</p>
        </div>
      </header>

      {/* Filters */}
      <div className="space-y-3 px-6 pb-2">
        {/* Type filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex gap-1.5">
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTypeFilter(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.96] ${
                  typeFilter === opt.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date filter */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex gap-1.5">
            {dateOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.96] ${
                  dateRange === opt.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-3">
              <Gift className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-medium">No transactions found</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-[240px]">
              {typeFilter !== "all"
                ? "Try changing the filter to see more results."
                : "Start scanning QR codes at partner merchants to earn points."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, entries]) => (
              <div key={date}>
                <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {date}
                </p>
                <div className="space-y-2">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          entry.kind === "checkin"
                            ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
                            : "bg-secondary/10 text-secondary"
                        }`}
                      >
                        {entry.kind === "checkin" ? (
                          <ArrowDownLeft className="h-5 w-5" />
                        ) : (
                          <ArrowUpRight className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{entry.merchantName}</p>
                        <p className="text-xs text-muted-foreground truncate">{entry.detail}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            entry.delta > 0 ? "text-[hsl(var(--success))]" : "text-destructive"
                          }`}
                        >
                          {entry.delta > 0 ? "+" : ""}
                          {entry.delta}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(entry.date, "h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
