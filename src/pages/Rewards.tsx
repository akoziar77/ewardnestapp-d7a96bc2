import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Gift, Check, Loader2 } from "lucide-react";

export default function Rewards() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedReward, setSelectedReward] = useState<any>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemed, setRedeemed] = useState(false);

  // Fetch all active rewards grouped by merchant
  const { data: rewards, isLoading } = useQuery({
    queryKey: ["consumer-rewards"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rewards")
        .select("*, merchants(name)")
        .eq("active", true)
        .order("points_cost", { ascending: true });
      return data ?? [];
    },
    enabled: !!user,
  });

  // Fetch user balances per merchant
  const { data: balances } = useQuery({
    queryKey: ["user-balances", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ledger_entries")
        .select("merchant_id, balance_after, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      const map = new Map<string, number>();
      for (const e of data ?? []) {
        if (!map.has(e.merchant_id)) {
          map.set(e.merchant_id, e.balance_after);
        }
      }
      return map;
    },
    enabled: !!user,
  });

  const getBalance = (merchantId: string) => balances?.get(merchantId) ?? 0;

  const handleRedeem = async () => {
    if (!selectedReward) return;
    setRedeeming(true);
    try {
      const { data, error } = await supabase.functions.invoke("redeem-reward", {
        body: { reward_id: selectedReward.id },
      });

      if (error) throw error;
      if (data?.error) {
        toast({
          title: "Can't redeem",
          description: data.message || data.error,
          variant: "destructive",
        });
        return;
      }

      setRedeemed(true);
      toast({ title: "Reward redeemed! 🎉", description: `You got: ${data.reward_title}` });

      // Refresh balances and ledger
      queryClient.invalidateQueries({ queryKey: ["user-balances"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      queryClient.invalidateQueries({ queryKey: ["consumer-rewards"] });

      setTimeout(() => {
        setSelectedReward(null);
        setRedeemed(false);
      }, 1500);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setRedeeming(false);
    }
  };

  // Group rewards by merchant
  const grouped = new Map<string, { name: string; rewards: any[] }>();
  for (const r of rewards ?? []) {
    const mId = r.merchant_id;
    const mName = (r as any).merchants?.name ?? "Unknown";
    if (!grouped.has(mId)) grouped.set(mId, { name: mName, rewards: [] });
    grouped.get(mId)!.rewards.push(r);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 pt-12 pb-4">
        <button
          onClick={() => navigate("/")}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:text-foreground active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Rewards</h1>
          <p className="text-sm text-muted-foreground">
            Browse and redeem with your points
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : grouped.size === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <Gift className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">No rewards available</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Check back soon — merchants are setting up their rewards.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Array.from(grouped.entries()).map(([merchantId, { name, rewards: mRewards }]) => {
              const balance = getBalance(merchantId);
              return (
                <div key={merchantId}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {name}
                    </h2>
                    <span className="text-xs font-medium tabular-nums text-primary">
                      {balance.toLocaleString()} pts
                    </span>
                  </div>
                  <div className="space-y-3">
                    {mRewards.map((reward: any) => {
                      const canAfford = balance >= reward.points_cost;
                      return (
                        <button
                          key={reward.id}
                          onClick={() => {
                            setSelectedReward({ ...reward, merchantName: name });
                            setRedeemed(false);
                          }}
                          className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:shadow-sm active:scale-[0.98]"
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary/10">
                            <Gift className="h-6 w-6 text-secondary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {reward.title}
                            </p>
                            {reward.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {reward.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p
                              className={`text-sm font-bold tabular-nums ${
                                canAfford ? "text-primary" : "text-muted-foreground"
                              }`}
                            >
                              {reward.points_cost.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-muted-foreground">pts</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Redeem dialog */}
      <Dialog
        open={!!selectedReward}
        onOpenChange={(open) => {
          if (!open && !redeeming) {
            setSelectedReward(null);
            setRedeemed(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          {selectedReward && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">
                  {redeemed ? "Redeemed! 🎉" : "Redeem reward"}
                </DialogTitle>
                <DialogDescription>
                  {redeemed
                    ? `You've redeemed ${selectedReward.title}. Show this to the merchant.`
                    : `${selectedReward.title} from ${selectedReward.merchantName}`}
                </DialogDescription>
              </DialogHeader>

              {!redeemed && (
                <div className="space-y-3 py-2">
                  <div className="flex items-center justify-between rounded-xl bg-muted p-4">
                    <span className="text-sm text-muted-foreground">Cost</span>
                    <span className="font-bold tabular-nums">
                      {selectedReward.points_cost.toLocaleString()} pts
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-muted p-4">
                    <span className="text-sm text-muted-foreground">Your balance</span>
                    <span
                      className={`font-bold tabular-nums ${
                        getBalance(selectedReward.merchant_id) >= selectedReward.points_cost
                          ? "text-[hsl(var(--success))]"
                          : "text-destructive"
                      }`}
                    >
                      {getBalance(selectedReward.merchant_id).toLocaleString()} pts
                    </span>
                  </div>
                  {getBalance(selectedReward.merchant_id) < selectedReward.points_cost && (
                    <p className="text-xs text-destructive text-center">
                      You need{" "}
                      {(selectedReward.points_cost - getBalance(selectedReward.merchant_id)).toLocaleString()}{" "}
                      more points
                    </p>
                  )}
                </div>
              )}

              <DialogFooter>
                {redeemed ? (
                  <Button
                    className="w-full h-12 active:scale-[0.97]"
                    onClick={() => {
                      setSelectedReward(null);
                      setRedeemed(false);
                    }}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Done
                  </Button>
                ) : (
                  <Button
                    className="w-full h-12 active:scale-[0.97]"
                    disabled={
                      redeeming ||
                      getBalance(selectedReward.merchant_id) < selectedReward.points_cost
                    }
                    onClick={handleRedeem}
                  >
                    {redeeming ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Gift className="mr-2 h-4 w-4" />
                    )}
                    {redeeming ? "Redeeming…" : "Confirm redemption"}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
