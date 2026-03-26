import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Coins, ShoppingBag, Gift } from "lucide-react";

export default function RewardsStore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["store-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("nest_points")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: rewards, isLoading } = useQuery({
    queryKey: ["store-rewards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_rewards" as any)
        .select("*")
        .eq("active", true)
        .order("cost_points", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const redeemMutation = useMutation({
    mutationFn: async (rewardId: string) => {
      const { data, error } = await supabase.functions.invoke("redeem-store-reward", {
        body: { reward_id: rewardId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "🎉 Redeemed!",
        description: `You got: ${data.reward.name}`,
      });
      queryClient.invalidateQueries({ queryKey: ["store-profile"] });
    },
    onError: (err: any) => {
      toast({
        title: "Redeem failed",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const nestPoints = profile?.nest_points ?? 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="active:scale-95 transition-transform">
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Rewards Store</h1>
        </div>
        <Badge variant="secondary" className="tabular-nums">
          <Coins className="h-3.5 w-3.5 mr-1" />
          {nestPoints.toLocaleString()} pts
        </Badge>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        {isLoading && (
          <p className="text-sm text-muted-foreground text-center py-8">Loading rewards…</p>
        )}

        {!isLoading && (!rewards || rewards.length === 0) && (
          <div className="text-center py-12 space-y-3">
            <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">No rewards available yet</p>
          </div>
        )}

        {rewards?.map((reward: any) => (
          <Card key={reward.id} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Gift className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{reward.name}</p>
                <p className="text-xs text-muted-foreground">{reward.reward_value}</p>
                <Badge variant="outline" className="text-xs mt-1 tabular-nums">
                  {reward.cost_points} pts
                </Badge>
              </div>
              <Button
                size="sm"
                disabled={nestPoints < reward.cost_points || redeemMutation.isPending}
                onClick={() => redeemMutation.mutate(reward.id)}
              >
                Redeem
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
