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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, MapPin, Trophy, Sparkles, Clock, ChevronDown, Trash2, Heart } from "lucide-react";
import { format } from "date-fns";

interface Brand {
  id: string;
  name: string;
  logo_emoji: string;
  category: string | null;
  milestone_visits: number;
  milestone_points: number;
  visit_expiry_months: number;
}

interface BrandVisit {
  id: string;
  brand_id: string;
  notes: string | null;
  created_at: string;
}

export default function Brands() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [visitNotes, setVisitNotes] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [expandedBrandId, setExpandedBrandId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, loading, navigate]);

  const { data: brands = [], isLoading: loadingBrands } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brands")
        .select("*")
        .order("name");
      return (data ?? []) as Brand[];
    },
    enabled: !!user,
  });

  const { data: visits = [] } = useQuery({
    queryKey: ["brand-visits", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("brand_visits")
        .select("id, brand_id, notes, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as BrandVisit[];
    },
    enabled: !!user,
  });

  const { data: expiringEntries = [] } = useQuery({
    queryKey: ["expiring-points-brands", user?.id],
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

  const deleteVisitMutation = useMutation({
    mutationFn: async (visitId: string) => {
      const { error } = await supabase
        .from("brand_visits")
        .delete()
        .eq("id", visitId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-visits", user?.id] });
      toast.success("Visit removed");
    },
    onError: () => toast.error("Failed to remove visit"),
  });

  const { data: favoriteIds = [] } = useQuery({
    queryKey: ["favorite-brands", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("favorite_brands")
        .select("brand_id")
        .eq("user_id", user!.id);
      return (data ?? []).map((f: any) => f.brand_id as string);
    },
    enabled: !!user,
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async (brandId: string) => {
      const isFav = favoriteIds.includes(brandId);
      if (isFav) {
        const { error } = await supabase
          .from("favorite_brands")
          .delete()
          .eq("user_id", user!.id)
          .eq("brand_id", brandId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("favorite_brands")
          .insert({ user_id: user!.id, brand_id: brandId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorite-brands", user?.id] });
    },
    onError: () => toast.error("Failed to update favorite"),
  });

  if (loading || !user) return null;

  const getExpiryDate = (brand: Brand) => {
    const d = new Date();
    d.setMonth(d.getMonth() - brand.visit_expiry_months);
    return d;
  };

  const visitCountForBrand = (brandId: string) => {
    const brand = brands.find((b) => b.id === brandId);
    if (!brand) return 0;
    const cutoff = getExpiryDate(brand);
    return visits.filter((v) => v.brand_id === brandId && new Date(v.created_at) > cutoff).length;
  };

  const visitsForBrand = (brandId: string) => {
    const brand = brands.find((b) => b.id === brandId);
    if (!brand) return visits.filter((v) => v.brand_id === brandId);
    const cutoff = getExpiryDate(brand);
    return visits.filter((v) => v.brand_id === brandId && new Date(v.created_at) > cutoff);
  };

  const expiringVisitsNextMonth = (brandId: string) => {
    const brand = brands.find((b) => b.id === brandId);
    if (!brand) return 0;
    const cutoff = getExpiryDate(brand);
    const nextMonthCutoff = new Date(cutoff);
    nextMonthCutoff.setMonth(nextMonthCutoff.getMonth() + 1);
    return visits.filter(
      (v) => v.brand_id === brandId && new Date(v.created_at) > cutoff && new Date(v.created_at) <= nextMonthCutoff
    ).length;
  };

  const expiringPointsForBrand = (brandId: string) => {
    return expiringEntries
      .filter((e: any) => (e.metadata as any)?.brand_id === brandId)
      .reduce((sum: number, e: any) => sum + e.delta_points, 0);
  };

  const categories = [...new Set(brands.map((b) => b.category).filter(Boolean))] as string[];

  const filtered = filter
    ? brands.filter((b) => b.category === filter)
    : brands;

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <header className="flex items-center gap-3 px-6 pt-12 pb-4">
        <button
          onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/home")}
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
              const isExpanded = expandedBrandId === brand.id;
              const brandVisits = visitsForBrand(brand.id);
              const isFavorite = favoriteIds.includes(brand.id);
              const expiring = expiringVisitsNextMonth(brand.id);
              const expiringPts = expiringPointsForBrand(brand.id);

              return (
                <div
                  key={brand.id}
                  className="rounded-2xl border border-border bg-card transition-shadow hover:shadow-sm overflow-hidden"
                >
                  {/* Card header — tappable */}
                  <button
                    onClick={() =>
                      setExpandedBrandId(isExpanded ? null : brand.id)
                    }
                    className="flex w-full items-start gap-3 p-4 text-left active:scale-[0.99] transition-transform"
                  >
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl">
                      {brand.logo_emoji}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavoriteMutation.mutate(brand.id);
                        }}
                        className={`absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full transition-all active:scale-90 ${
                          isFavorite
                            ? "bg-destructive text-destructive-foreground"
                            : "bg-muted-foreground/20 text-muted-foreground hover:bg-muted-foreground/30"
                        }`}
                        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                      >
                        <Heart className={`h-2.5 w-2.5 ${isFavorite ? "fill-current" : ""}`} />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold truncate">
                          {brand.name}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {milestoneReached && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-secondary">
                              <Trophy className="h-3 w-3" />
                              MILESTONE
                            </span>
                          )}
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </div>
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
                      {expiring > 0 && (
                        <p className="mt-1 text-[10px] text-destructive font-medium">
                          ⚠ {expiring} visit{expiring > 1 ? "s" : ""} expiring next month
                        </p>
                      )}
                      {expiringPts > 0 && (
                        <p className="mt-0.5 text-[10px] text-destructive font-medium">
                          ⚠ {expiringPts} pts expiring next month
                        </p>
                      )}
                    </div>
                  </button>

                  {/* Expanded visit history */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 pb-4">
                      <div className="flex items-center justify-between pt-3 pb-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Visit history
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBrand(brand);
                            setVisitNotes("");
                          }}
                          className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 active:scale-95"
                        >
                          <Plus className="h-3 w-3" />
                          Log visit
                        </button>
                      </div>

                      {brandVisits.length === 0 ? (
                        <div className="flex flex-col items-center py-4 text-center">
                          <Clock className="h-8 w-8 text-muted-foreground/40 mb-1.5" />
                          <p className="text-xs text-muted-foreground">
                            No visits yet — tap "Log visit" to start tracking
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {brandVisits.map((visit) => (
                            <div
                              key={visit.id}
                              className="group flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2"
                            >
                              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium tabular-nums">
                                  {format(new Date(visit.created_at), "MMM d, yyyy · h:mm a")}
                                </p>
                                {visit.notes && (
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {visit.notes}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteVisitMutation.mutate(visit.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all active:scale-90"
                                title="Remove visit"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
            <DialogDescription className="sr-only">
              Log a new visit to {selectedBrand?.name}
            </DialogDescription>
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