import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Flame, Trophy, Target, Zap, CreditCard, Eye,
  MapPin, Gift, ChevronLeft, Egg, Feather, Bird, Crown,
  CheckCircle2, Clock, Rocket,
} from "lucide-react";
import { format } from "date-fns";

const TIER_CONFIG: Record<string, { icon: typeof Egg; color: string; next: string; threshold: number }> = {
  Hatchling: { icon: Egg, color: "text-muted-foreground", next: "Feathered", threshold: 500 },
  Feathered: { icon: Feather, color: "text-primary", next: "Winged", threshold: 2000 },
  Winged: { icon: Bird, color: "text-secondary", next: "Golden Nest", threshold: 5000 },
  "Golden Nest": { icon: Crown, color: "text-yellow-500", next: "", threshold: Infinity },
};

const EARN_ACTIONS = [
  { key: "add_card", label: "Add a Card", points: 50, icon: CreditCard },
  { key: "check_balance", label: "Check Balance", points: 5, icon: Eye },
  { key: "visit_brand", label: "Visit a Brand", points: 10, icon: MapPin },
  { key: "redeem_reward", label: "Redeem Reward", points: 20, icon: Gift },
];

export default function Engage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [earningAction, setEarningAction] = useState<string | null>(null);
  const [lastEarnResult, setLastEarnResult] = useState<{
    basePoints: number;
    boostedPoints: number;
    bonus: number;
    appliedBoosters: number;
  } | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["engage-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("nest_points, tier, streak_count, last_check_in, challenges_completed")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: challenges } = useQuery({
    queryKey: ["challenges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("active", true)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: userChallenges } = useQuery({
    queryKey: ["user-challenges", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_challenges")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: recentActivities } = useQuery({
    queryKey: ["nest-activities", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nest_activities")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: activeBoosters } = useQuery({
    queryKey: ["active-boosters"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("boosters")
        .select("*")
        .eq("active", true)
        .lte("start_at", now)
        .or(`end_at.is.null,end_at.gte.${now}`);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const earnMutation = useMutation({
    mutationFn: async (action: string) => {
      const { data, error } = await supabase.functions.invoke("nest-earn", {
        body: { action },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setLastEarnResult({
        basePoints: data.basePoints,
        boostedPoints: data.boostedPoints,
        bonus: data.bonus,
        appliedBoosters: data.appliedBoosters,
      });
      const boosterText = data.appliedBoosters > 0
        ? ` (🚀 ${data.bonus} bonus from boosters!)`
        : "";
      toast({
        title: `+${data.boostedPoints} Nest Points!${boosterText}`,
        description: `Tier: ${data.tier}`,
      });
      queryClient.invalidateQueries({ queryKey: ["engage-profile"] });
      queryClient.invalidateQueries({ queryKey: ["nest-activities"] });
      queryClient.invalidateQueries({ queryKey: ["user-challenges"] });
      setEarningAction(null);
      setTimeout(() => setLastEarnResult(null), 4000);
    },
    onError: () => {
      toast({ title: "Failed to earn points", variant: "destructive" });
      setEarningAction(null);
    },
  });

  const streakMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("nest-streak");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.bonus > 0) {
        toast({
          title: `🔥 ${data.streak}-day streak!`,
          description: `+${data.bonus} bonus Nest Points`,
        });
      } else {
        toast({ title: "Already checked in today!", description: `Streak: ${data.streak} days` });
      }
      queryClient.invalidateQueries({ queryKey: ["engage-profile"] });
      queryClient.invalidateQueries({ queryKey: ["nest-activities"] });
    },
    onError: () => {
      toast({ title: "Streak check-in failed", variant: "destructive" });
    },
  });

  const nestPoints = profile?.nest_points ?? 0;
  const tier = profile?.tier ?? "Hatchling";
  const tierInfo = TIER_CONFIG[tier] ?? TIER_CONFIG.Hatchling;
  const TierIcon = tierInfo.icon;
  const progressToNext = tierInfo.threshold === Infinity
    ? 100
    : Math.min(100, (nestPoints / tierInfo.threshold) * 100);

  const ucMap = new Map((userChallenges ?? []).map((uc) => [uc.challenge_id, uc]));

  const activityLabel = (type: string) => {
    const map: Record<string, string> = {
      add_card: "Added Card",
      check_balance: "Checked Balance",
      visit_brand: "Visited Brand",
      redeem_reward: "Redeemed Reward",
      daily_streak: "Daily Streak",
    };
    return map[type] ?? type;
  };

  const boosterTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      multiplier: "Multiplier",
      flat_bonus: "Flat Bonus",
      challenge: "Challenge",
      tier_bonus: "Tier Bonus",
    };
    return map[type] ?? type;
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="active:scale-95 transition-transform">
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">Engage+</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {/* Tier & Points Hero */}
        <Card className="overflow-hidden border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl bg-primary/10 ${tierInfo.color}`}>
                  <TierIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Current Tier
                  </p>
                  <p className="text-lg font-bold text-foreground">{tier}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary tabular-nums">{nestPoints.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Nest Points</p>
              </div>
            </div>
            {tierInfo.next && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{tier}</span>
                  <span>{tierInfo.next} — {tierInfo.threshold.toLocaleString()} pts</span>
                </div>
                <Progress value={progressToNext} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bonus Applied Banner */}
        {lastEarnResult && lastEarnResult.appliedBoosters > 0 && (
          <Card className="border-0 shadow-sm bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Rocket className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground text-sm">
                  🚀 Booster Applied!
                </p>
                <p className="text-xs text-muted-foreground">
                  Base: {lastEarnResult.basePoints} pts → Boosted: {lastEarnResult.boostedPoints} pts (+{lastEarnResult.bonus} bonus)
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Boosters */}
        {(activeBoosters?.length ?? 0) > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Rocket className="h-4 w-4 text-primary" /> Active Boosters
            </h2>
            <div className="space-y-2.5">
              {activeBoosters!.map((b) => (
                <Card key={b.id} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-foreground text-sm">{b.name}</p>
                        {b.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{b.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            {boosterTypeLabel(b.type)}
                          </Badge>
                          {b.type === "multiplier" && (
                            <Badge variant="outline" className="text-xs tabular-nums">
                              {b.multiplier_value}x
                            </Badge>
                          )}
                          {b.type === "flat_bonus" && (
                            <Badge variant="outline" className="text-xs tabular-nums">
                              +{b.bonus_value} pts
                            </Badge>
                          )}
                          {b.required_action !== "any" && (
                            <Badge variant="outline" className="text-xs">
                              {b.required_action}
                            </Badge>
                          )}
                          {b.required_tier !== "any" && (
                            <Badge variant="outline" className="text-xs">
                              {b.required_tier}+ tier
                            </Badge>
                          )}
                        </div>
                      </div>
                      {b.end_at && (
                        <p className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                          Ends {format(new Date(b.end_at), "MMM d")}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Daily Streak */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/10">
                <Flame className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {profile?.streak_count ?? 0}-day streak
                </p>
                <p className="text-xs text-muted-foreground">
                  Check in daily for +10 pts
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => streakMutation.mutate()}
              disabled={streakMutation.isPending}
              className="active:scale-95 transition-transform"
            >
              {streakMutation.isPending ? "…" : "Check In"}
            </Button>
          </CardContent>
        </Card>

        {/* Earn Points */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Earn Points
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {EARN_ACTIONS.map(({ key, label, points, icon: Icon }) => (
              <button
                key={key}
                onClick={() => {
                  setEarningAction(key);
                  earnMutation.mutate(key);
                }}
                disabled={earnMutation.isPending}
                className="bg-card rounded-xl p-4 text-left shadow-sm hover:shadow-md transition-shadow active:scale-[0.97] border border-border/50"
              >
                <Icon className="h-5 w-5 text-primary mb-2" />
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">+{points} pts</p>
              </button>
            ))}
          </div>
        </div>

        {/* Challenges */}
        {(challenges?.length ?? 0) > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-secondary" /> Challenges
            </h2>
            <div className="space-y-2.5">
              {challenges!.map((ch) => {
                const uc = ucMap.get(ch.id);
                const progress = uc?.progress ?? 0;
                const completed = uc?.completed ?? false;
                const pct = Math.min(100, (progress / ch.requirement) * 100);
                return (
                  <Card key={ch.id} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-foreground text-sm">{ch.name}</p>
                          {ch.description && (
                            <p className="text-xs text-muted-foreground">{ch.description}</p>
                          )}
                        </div>
                        {completed ? (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Done
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs tabular-nums">
                            +{ch.reward_points} pts
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {progress}/{ch.requirement}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {(recentActivities?.length ?? 0) > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" /> Recent Activity
            </h2>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0 divide-y divide-border">
                {recentActivities!.map((a) => (
                  <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground">{activityLabel(a.type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(a.created_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-primary tabular-nums">
                      +{a.points}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
