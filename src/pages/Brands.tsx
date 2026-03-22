import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, MapPin, Trophy, Sparkles } from "lucide-react";

interface Brand {
  id: string;
  name: string;
  logo_emoji: string;
  category: string | null;
  milestone_visits: number;
  milestone_points: number;
}

export default function Brands() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [visitNotes, setVisitNotes] = useState("");
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading || !user) return null;

  const { data: brands = [], isLoading: loadingBrands } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brands")
        .select("*")
        .order("name");
      return (data ?? []) as Brand[];
    },
  });

  const { data: visits = [] } = useQuery({
    queryKey: ["brand-visits", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("brand_visits")
        .select("id, brand_id, notes, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const logVisitMutation = useMutation({
    mutationFn: async (brandId: string) => {
      const { error } = await supabase.from("brand_visits").insert({
        user_id: user!.id,
        brand_id: brandId,
        notes: visitNotes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-visits", user?.id] });
      const brand = selectedBrand!;
      const currentCount = visitCountForBrand(brand.id) + 1;
      if (currentCount >= brand.milestone_visits) {
        toast.success(`🎉 Milestone reached! You earned ${brand.milestone_points} bonus points at ${brand.name}!`);
      } else {
        toast.success(`Visit logged at ${brand.name}`);
      }
      setSelectedBrand(null);
      setVisitNotes("");
    },
    onError: () => toast.error("Failed to log visit"),
  });

  const visitCountForBrand = (brandId: string) =>
    visits.filter((v) => v.brand_id === brandId).length;

  const categories = [...new Set(brands.map((b) => b.category).filter(Boolean))] as string[];

  const filtered = filter
    ? brands.filter((b) => b.category === filter)
    : brands;

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <header className="flex items-center gap-3 px-6 pt-12 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:text-foreground active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Brands</h1>
          <p className="text-sm text-muted-foreground">
            Track visits to earn milestone rewards
          </p>
        </div>
      </header>

      {/* Category filters */}
      <div className="flex gap-1.5 px-6 pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setFilter(null)}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.96] ${
            !filter
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.96] ${
              filter === cat
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Brand cards */}
      <div className="flex-1 px-6 py-2">
        {loadingBrands ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((brand) => {
              const count = visitCountForBrand(brand.id);
              const progress = Math.min(
                (count / brand.milestone_visits) * 100,
                100
              );
              const milestoneReached = count >= brand.milestone_visits;

              return (
                <div
                  key={brand.id}
                  className="rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl">
                      {brand.logo_emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold truncate">
                          {brand.name}
                        </p>
                        {milestoneReached && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-secondary">
                            <Trophy className="h-3 w-3" />
                            MILESTONE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {brand.category} · {brand.milestone_points} pts at{" "}
                        {brand.milestone_visits} visits
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                          {count}/{brand.milestone_visits}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedBrand(brand);
                        setVisitNotes("");
                      }}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors hover:bg-primary/20 active:scale-95"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log visit dialog */}
      <Dialog
        open={!!selectedBrand}
        onOpenChange={(open) => !open && setSelectedBrand(null)}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{selectedBrand?.logo_emoji}</span>
              Log visit at {selectedBrand?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedBrand && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Progress</p>
                  <p className="text-sm font-semibold">
                    {visitCountForBrand(selectedBrand.id)}/
                    {selectedBrand.milestone_visits} visits
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Reward</p>
                  <p className="text-sm font-semibold text-primary">
                    {selectedBrand.milestone_points} pts
                  </p>
                </div>
              </div>

              <Input
                placeholder="Add a note (optional)"
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
              />

              <Button
                className="w-full gap-2 active:scale-[0.97]"
                onClick={() => logVisitMutation.mutate(selectedBrand.id)}
                disabled={logVisitMutation.isPending}
              >
                <Sparkles className="h-4 w-4" />
                {logVisitMutation.isPending ? "Logging…" : "Log visit"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
