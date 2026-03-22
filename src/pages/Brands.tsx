import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LoyaltyConnectDialog from "@/components/LoyaltyConnectDialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, MapPin, Trophy, Sparkles, Clock, ChevronDown, Trash2, Heart, Link2, Search, ExternalLink, Settings, Globe, Tag, CalendarClock, Award, Eye } from "lucide-react";
import { getHiddenCategories } from "@/pages/BrandSettings";
import { format } from "date-fns";
import { WIDGET_FIELDS, getVisibleWidgetFields, setVisibleWidgetFields } from "@/lib/widgetFields";

interface Brand {
  id: string;
  name: string;
  logo_emoji: string;
  category: string | null;
  milestone_visits: number;
  milestone_points: number;
  visit_expiry_months: number;
  website_url: string | null;
  loyalty_api_url: string | null;
  loyalty_provider: string | null;
  api_field_name: string | null;
}

// Mapping of brand fields to their raw API (database) column names
const BRAND_API_FIELDS: { label: string; apiName: string; getValue: (b: Brand) => React.ReactNode }[] = [
  { label: "Category", apiName: "category", getValue: (b) => b.category },
  { label: "Loyalty Program", apiName: "loyalty_provider", getValue: (b) => b.loyalty_provider },
  { label: "Milestone Visits", apiName: "milestone_visits", getValue: (b) => b.milestone_visits },
  { label: "Milestone Points", apiName: "milestone_points", getValue: (b) => b.milestone_points },
  { label: "Visit Expiry", apiName: "visit_expiry_months", getValue: (b) => `${b.visit_expiry_months} months` },
  { label: "Logo", apiName: "logo_emoji", getValue: (b) => b.logo_emoji },
  { label: "API Field Name", apiName: "api_field_name", getValue: (b) => b.api_field_name },
];

interface BrandVisit {
  id: string;
  brand_id: string;
  notes: string | null;
  created_at: string;
}

export default function Brands() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [visitNotes, setVisitNotes] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [expandedBrandId, setExpandedBrandId] = useState<string | null>(
    searchParams.get("brand")
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [widgetFields, setWidgetFieldsState] = useState<string[]>(getVisibleWidgetFields);
  const [showWidgetSettings, setShowWidgetSettings] = useState(false);

  const toggleWidgetField = (key: string) => {
    setWidgetFieldsState((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      setVisibleWidgetFields(next);
      return next;
    });
  };

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

  const { data: loyaltyConnections = [] } = useQuery({
    queryKey: ["loyalty-connections", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("external_loyalty_connections" as any)
        .select("*")
        .eq("user_id", user!.id);
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  // Auto-sync all external loyalty connections on page load
  const syncAttempted = useRef(false);
  useEffect(() => {
    if (!user || syncAttempted.current || loyaltyConnections.length === 0) return;
    syncAttempted.current = true;
    supabase.functions
      .invoke("connect-loyalty", { body: { action: "sync_all" } })
      .then(({ data }) => {
        if (data?.success) {
          queryClient.invalidateQueries({ queryKey: ["loyalty-connections", user.id] });
        }
      })
      .catch(() => {});
  }, [user, loyaltyConnections.length, queryClient]);

  const [loyaltyBrandId, setLoyaltyBrandId] = useState<string | null>(null);

  const getLoyaltyConnection = (brandId: string) =>
    loyaltyConnections.find((c: any) => c.brand_id === brandId) || null;

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

  const hiddenCategories = getHiddenCategories();

  const filtered = brands
    .filter((b) => !b.category || !hiddenCategories.includes(b.category))
    .filter((b) => {
      if (!filter) return true;
      if (filter === "__favorites__") return favoriteIds.includes(b.id);
      return b.category === filter;
    })
    .filter((b) => !searchQuery || b.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const visibleCategories = categories.filter((c) => !hiddenCategories.includes(c));

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <header className="flex items-center gap-3 px-6 pt-12 pb-4">
        <button
          onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/home")}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:text-foreground active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">Brands</h1>
          <p className="text-sm text-muted-foreground">
            Track visits to earn milestone rewards
          </p>
        </div>
        <button
          onClick={() => navigate("/brands/settings")}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:text-foreground active:scale-95"
        >
          <Settings className="h-5 w-5" />
        </button>
      </header>

      {/* Search bar */}
      <div className="px-6 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search brands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm rounded-xl bg-muted border-0 focus-visible:ring-1"
          />
        </div>
      </div>

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
        <button
          onClick={() => setFilter("__favorites__")}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.96] flex items-center gap-1 ${
            filter === "__favorites__"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <Heart className={`h-3 w-3 ${filter === "__favorites__" ? "fill-current" : ""}`} />
          Favorites
        </button>
        {visibleCategories.map((cat) => (
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
                      {(() => {
                        const conn = getLoyaltyConnection(brand.id);
                        return conn?.external_points_balance != null ? (
                          <p className="mt-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <Sparkles className="inline h-3 w-3 mr-0.5 -mt-0.5" />
                            {conn.external_points_balance.toLocaleString()} external pts
                          </p>
                        ) : null;
                      })()}
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

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 pb-4">
                      {/* Brand details — all API fields */}
                       <div className="pt-3 pb-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Brand details
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          {BRAND_API_FIELDS.map(({ label, apiName, getValue }) => {
                            const val = getValue(brand);
                            const isLogo = apiName === "logo_emoji";
                            return (
                              <div key={apiName}>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                  {label}
                                </p>
                                <p className="text-[9px] font-mono text-muted-foreground/50 mb-0.5">
                                  {apiName}
                                </p>
                                {isLogo ? (
                                  <p className="text-lg">{val}</p>
                                ) : val ? (
                                  <p className="text-xs font-medium tabular-nums">{val}</p>
                                ) : (
                                  <p className="text-xs italic text-muted-foreground/50">Not set</p>
                                )}
                              </div>
                            );
                          })}
                          <div className="col-span-2">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Website</p>
                            <p className="text-[9px] font-mono text-muted-foreground/50 mb-0.5">website_url</p>
                            {brand.website_url ? (
                              <a
                                href={brand.website_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs font-medium text-primary hover:underline truncate block"
                              >
                                {brand.website_url}
                              </a>
                            ) : (
                              <p className="text-xs italic text-muted-foreground/50">Not set</p>
                            )}
                          </div>
                          <div className="col-span-2">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Loyalty URL</p>
                            <p className="text-[9px] font-mono text-muted-foreground/50 mb-0.5">loyalty_api_url</p>
                            {brand.loyalty_api_url ? (
                              <a
                                href={brand.loyalty_api_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs font-medium text-primary hover:underline truncate block"
                              >
                                {brand.loyalty_api_url}
                              </a>
                            ) : (
                              <p className="text-xs italic text-muted-foreground/50">Not set</p>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Widget display toggles */}
                      <div className="pt-3 border-t border-border">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowWidgetSettings((v) => !v);
                          }}
                          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 active:scale-[0.98]"
                        >
                          <Eye className="h-3 w-3" />
                          Home widget fields
                          <ChevronDown className={`h-3 w-3 transition-transform ${showWidgetSettings ? "rotate-180" : ""}`} />
                        </button>
                        {showWidgetSettings && (
                          <div className="space-y-2 rounded-xl bg-muted/50 p-3">
                            {WIDGET_FIELDS.map((field) => (
                              <label
                                key={field.key}
                                className="flex items-center justify-between cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-xs font-medium">{field.label}</span>
                                <Switch
                                  checked={widgetFields.includes(field.key)}
                                  onCheckedChange={() => toggleWidgetField(field.key)}
                                />
                              </label>
                            ))}
                            <p className="text-[10px] text-muted-foreground pt-1">
                              These settings apply to all brand widgets on the Home page.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Quick links */}
                      <div className="flex items-center gap-4 pt-3 border-t border-border mt-3">
                        {brand.website_url && (
                          <a
                            href={brand.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline active:scale-[0.98]"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Visit website
                          </a>
                        )}
                        {brand.loyalty_api_url && (
                          <a
                            href={brand.loyalty_api_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-xs font-medium text-secondary-foreground bg-secondary/10 rounded-lg px-2.5 py-1 hover:bg-secondary/20 active:scale-[0.98] transition-colors"
                          >
                            <Sparkles className="h-3 w-3" />
                            Join {brand.loyalty_provider ?? "program"}
                          </a>
                        )}
                      </div>

                      {/* Visit history */}
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

                      {/* Loyalty program connect */}
                      <div className="mt-3 pt-3 border-t border-border">
                        {(() => {
                          const conn = getLoyaltyConnection(brand.id);
                          return conn ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setLoyaltyBrandId(brand.id);
                              }}
                              className="flex w-full flex-col gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-3 text-left transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/30 active:scale-[0.98]"
                            >
                              <div className="flex items-center gap-2">
                                <Link2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 truncate flex-1">
                                  {conn.provider_name}
                                </p>
                                <span
                                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                    conn.status === "connected"
                                      ? "bg-emerald-200/60 text-emerald-700 dark:bg-emerald-800/40 dark:text-emerald-300"
                                      : "bg-destructive/10 text-destructive"
                                  }`}
                                >
                                  {conn.status}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-6">
                                {conn.external_member_id && (
                                  <div>
                                    <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/50">Member ID</p>
                                    <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 font-mono">{conn.external_member_id}</p>
                                  </div>
                                )}
                                {conn.external_points_balance != null && (
                                  <div>
                                    <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/50">Points</p>
                                    <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{conn.external_points_balance.toLocaleString()}</p>
                                  </div>
                                )}
                                {conn.last_synced_at && (
                                  <div>
                                    <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/50">Last synced</p>
                                    <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">{new Date(conn.last_synced_at).toLocaleDateString()}</p>
                                  </div>
                                )}
                              </div>
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setLoyaltyBrandId(brand.id);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/30 active:scale-[0.98]"
                            >
                              <Link2 className="h-3.5 w-3.5" />
                              Connect loyalty program
                            </button>
                          );
                        })()}
                      </div>
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

      {/* Loyalty connect dialog */}
      {loyaltyBrandId && (() => {
        const b = brands.find((br) => br.id === loyaltyBrandId);
        if (!b) return null;
        return (
          <LoyaltyConnectDialog
            open={!!loyaltyBrandId}
            onOpenChange={(open) => !open && setLoyaltyBrandId(null)}
            brandId={b.id}
            brandName={b.name}
            brandEmoji={b.logo_emoji}
            loyaltyProvider={b.loyalty_provider}
            loyaltyApiUrl={b.loyalty_api_url}
            connection={getLoyaltyConnection(b.id)}
            onConnectionChange={() =>
              queryClient.invalidateQueries({ queryKey: ["loyalty-connections", user?.id] })
            }
          />
        );
      })()}

      <BottomNav />
    </div>
  );
}