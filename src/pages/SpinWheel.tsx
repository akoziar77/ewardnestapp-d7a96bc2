import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, RotateCw, Trophy, Coins, Clock, Gift, Flame } from "lucide-react";
import { format } from "date-fns";

const TIER_SPIN_COST: Record<string, number> = {
  Bronze: 50,
  Hatchling: 50,
  Silver: 40,
  Gold: 30,
  Platinum: 20,
};

const SEGMENT_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--primary) / 0.7)",
  "hsl(var(--secondary) / 0.7)",
  "hsl(var(--accent) / 0.7)",
  "hsl(var(--primary) / 0.5)",
  "hsl(var(--secondary) / 0.5)",
];

export default function SpinWheel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<null | { name: string; reward_type: string; reward_value: string; image_url?: string; free_spin?: boolean }>(null);

  const { data: profile } = useQuery({
    queryKey: ["spin-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("nest_points, last_free_spin_date, free_spins_used_today, tier, jackpot_meter, jackpot_max")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: prizes } = useQuery({
    queryKey: ["prizes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prizes")
        .select("*")
        .eq("active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: spinHistory } = useQuery({
    queryKey: ["spin-history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spin_logs")
        .select("*, prizes(name, reward_type, reward_value)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Tier-based spin cost
  const spinCost = TIER_SPIN_COST[profile?.tier ?? "Bronze"] ?? 50;

  // Determine if free spin is available
  const today = new Date().toISOString().split("T")[0];
  const freeSpinsUsed = profile?.last_free_spin_date === today ? (profile?.free_spins_used_today ?? 0) : 0;
  const hasFreeSpinAvailable = freeSpinsUsed < 1;

  const spinMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("spin-wheel");
      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
      return data;
    },
    onSuccess: (data) => {
      const prizeIndex = prizes?.findIndex((p: any) => p.id === data.prize.id) ?? 0;
      const segmentCount = prizes?.length ?? 1;
      const segmentAngle = 360 / segmentCount;
      const targetAngle = 360 * 5 + (360 - (prizeIndex * segmentAngle + segmentAngle / 2));
      setRotation((prev) => prev + targetAngle);

      setTimeout(() => {
        setSpinning(false);
        setWonPrize({ ...data.prize, free_spin: data.free_spin });
        toast({
          title: `🎉 You won: ${data.prize.name}!`,
          description: data.free_spin
            ? "Free daily spin!"
            : data.prize.reward_type === "points"
              ? `+${data.prize.reward_value} Nest Points`
              : data.prize.reward_value,
        });
        queryClient.invalidateQueries({ queryKey: ["spin-profile"] });
        queryClient.invalidateQueries({ queryKey: ["spin-history"] });
        queryClient.invalidateQueries({ queryKey: ["engage-profile"] });
      }, 4000);
    },
    onError: (err: any) => {
      setSpinning(false);
      toast({
        title: "Spin failed",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const handleSpin = useCallback(() => {
    if (spinning) return;
    if (!hasFreeSpinAvailable && (profile?.nest_points ?? 0) < spinCost) {
      toast({ title: "Not enough points", description: `You need ${spinCost} Nest Points to spin`, variant: "destructive" });
      return;
    }
    setSpinning(true);
    setWonPrize(null);
    spinMutation.mutate();
  }, [spinning, profile, hasFreeSpinAvailable, spinCost, spinMutation, toast]);

  const nestPoints = profile?.nest_points ?? 0;
  const segmentCount = prizes?.length || 1;
  const segmentAngle = 360 / segmentCount;
  const canSpin = hasFreeSpinAvailable || nestPoints >= spinCost;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="active:scale-95 transition-transform">
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Spin & Win</h1>
        </div>
        <Badge variant="secondary" className="tabular-nums">
          <Coins className="h-3.5 w-3.5 mr-1" />
          {nestPoints.toLocaleString()} pts
        </Badge>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-6">
        {/* Free spin banner */}
        {hasFreeSpinAvailable && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20">
            <Gift className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm font-medium text-primary">Daily free spin available!</p>
          </div>
        )}

        {/* Wheel */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
              <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-primary drop-shadow-md" />
            </div>

            {/* Wheel SVG */}
            <div
              className="w-72 h-72 rounded-full border-4 border-border shadow-xl overflow-hidden"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
              }}
            >
              <svg viewBox="0 0 200 200" className="w-full h-full">
                {(prizes ?? []).map((prize: any, i: number) => {
                  const startAngle = (i * segmentAngle * Math.PI) / 180;
                  const endAngle = ((i + 1) * segmentAngle * Math.PI) / 180;
                  const x1 = 100 + 100 * Math.cos(startAngle);
                  const y1 = 100 + 100 * Math.sin(startAngle);
                  const x2 = 100 + 100 * Math.cos(endAngle);
                  const y2 = 100 + 100 * Math.sin(endAngle);
                  const largeArc = segmentAngle > 180 ? 1 : 0;
                  const midAngle = (startAngle + endAngle) / 2;
                  const textX = 100 + 65 * Math.cos(midAngle);
                  const textY = 100 + 65 * Math.sin(midAngle);
                  const textRotation = (midAngle * 180) / Math.PI;

                  return (
                    <g key={prize.id}>
                      <path
                        d={`M100,100 L${x1},${y1} A100,100 0 ${largeArc},1 ${x2},${y2} Z`}
                        fill={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
                        stroke="hsl(var(--background))"
                        strokeWidth="1"
                      />
                      <text
                        x={textX}
                        y={textY}
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(${textRotation}, ${textX}, ${textY})`}
                        className="fill-primary-foreground"
                        fontSize={segmentCount > 6 ? "6" : "8"}
                        fontWeight="600"
                      >
                        {prize.name.length > 10 ? prize.name.slice(0, 10) + "…" : prize.name}
                      </text>
                    </g>
                  );
                })}
                {(!prizes || prizes.length === 0) && (
                  <circle cx="100" cy="100" r="100" fill="hsl(var(--muted))" />
                )}
                <circle cx="100" cy="100" r="12" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="2" />
              </svg>
            </div>
          </div>

          <Button
            size="lg"
            onClick={handleSpin}
            disabled={spinning || !canSpin || !prizes?.length}
            className="gap-2 px-8 active:scale-95 transition-transform"
          >
            <RotateCw className={`h-5 w-5 ${spinning ? "animate-spin" : ""}`} />
            {spinning
              ? "Spinning…"
              : hasFreeSpinAvailable
                ? "Free Spin!"
                : `Spin (${spinCost} pts)`}
          </Button>

          {!hasFreeSpinAvailable && nestPoints < spinCost && (
            <p className="text-sm text-destructive">
              You need {spinCost - nestPoints} more points to spin
            </p>
          )}
        </div>

        {/* Won Prize Card */}
        {wonPrize && (
          <Card className="border-0 shadow-lg bg-primary/5 animate-in fade-in slide-in-from-bottom-4">
            <CardContent className="p-5 text-center space-y-3">
              <Trophy className="h-10 w-10 text-primary mx-auto" />
              <h2 className="text-xl font-bold text-foreground">You Won!</h2>
              {wonPrize.free_spin && (
                <Badge variant="outline" className="text-xs">🎁 Free Spin</Badge>
              )}
              <p className="text-lg font-semibold text-primary">{wonPrize.name}</p>
              {wonPrize.reward_type === "points" && (
                <Badge variant="secondary" className="text-sm">+{wonPrize.reward_value} Nest Points</Badge>
              )}
              <div className="flex gap-3 justify-center pt-2">
                <Button variant="outline" size="sm" onClick={() => setWonPrize(null)}>
                  Collect
                </Button>
                <Button size="sm" onClick={() => { setWonPrize(null); handleSpin(); }}>
                  Spin Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Spin History */}
        {(spinHistory?.length ?? 0) > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" /> Spin History
            </h2>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0 divide-y divide-border">
                {spinHistory!.map((log: any) => (
                  <div key={log.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground">{(log.prizes as any)?.name ?? "Prize"}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs tabular-nums">
                      {log.points_spent === 0 ? "Free" : `-${log.points_spent} pts`}
                    </Badge>
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
