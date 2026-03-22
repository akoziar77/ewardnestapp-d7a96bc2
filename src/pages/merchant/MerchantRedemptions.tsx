import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Receipt } from "lucide-react";

type Ctx = { merchantId: string };

export default function MerchantRedemptions() {
  const { merchantId } = useOutletContext<Ctx>();

  const { data: redemptions, isLoading } = useQuery({
    queryKey: ["merchant-redemptions", merchantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("redemptions")
        .select("*, rewards(title)")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!merchantId,
  });

  const statusColor: Record<string, string> = {
    completed: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
    pending: "bg-secondary/10 text-secondary",
    cancelled: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="px-6 py-8 md:px-10 md:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Redemptions</h1>
        <p className="text-sm text-muted-foreground mt-1">Track customer reward redemptions</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : redemptions?.length ? (
        <div className="space-y-2">
          {redemptions.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {(r as any).rewards?.title ?? "Reward"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold tabular-nums text-destructive">
                  -{r.points_spent}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    statusColor[r.status] ?? ""
                  }`}
                >
                  {r.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Receipt className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">No redemptions yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Redemptions will appear here when customers claim rewards.
          </p>
        </div>
      )}
    </div>
  );
}
