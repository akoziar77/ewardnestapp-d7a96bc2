import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QrCode, Gift, TrendingUp, History, UserCircle, Store, Heart, Sparkles, Link2, ExternalLink, Globe, CalendarClock, Smartphone, Pencil, Settings, RotateCcw, Download } from "lucide-react";
import { getProviderLinks, getOpenAppUrl, getProviderLink } from "@/lib/providerDeepLinks";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  LOYALTY_API_FIELDS,
  LOYALTY_SECTIONS,
  getFieldsForBrand,
  getBrandFieldOverride,
  setBrandFieldOverride,
  clearBrandFieldOverride,
  hasBrandFieldOverride,
  getVisibleWidgetFields,
  type FieldContext,
} from "@/lib/widgetFields";
import { Switch } from "@/components/ui/switch";
import { getWidgetLayout, saveWidgetLayout, type HomeWidget } from "@/lib/homeWidgets";
import HomeWidgetEditor from "@/components/HomeWidgetEditor";
import { useGeofence } from "@/hooks/useGeofence";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [widgetLayout, setWidgetLayout] = useState<HomeWidget[]>(getWidgetLayout);
  const [editorOpen, setEditorOpen] = useState(false);

  // Activate geofence monitoring when enabled in settings
  const geofenceActive = typeof window !== "undefined" && localStorage.getItem("geofence_enabled") === "true";
  useGeofence();


  const handleSaveLayout = (widgets: HomeWidget[]) => {
    setWidgetLayout(widgets);
    saveWidgetLayout(widgets);
    toast.success("Home layout saved");
  };

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

  const { data: favoriteBrands = [] } = useQuery({
    queryKey: ["favorite-brands-home", user?.id],
    queryFn: async () => {
      const { data: favs } = await supabase
        .from("favorite_brands")
        .select("brand_id")
        .eq("user_id", user!.id);
      if (!favs?.length) return [];
      const brandIds = favs.map((f: any) => f.brand_id);
      const { data: brands } = await supabase
        .from("brands")
        .select("*")
        .in("id", brandIds);
      return brands ?? [];
    },
    enabled: !!user,
  });

  const { data: brandVisits = [] } = useQuery({
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

  const { data: expiringEntries = [] } = useQuery({
    queryKey: ["expiring-points", user?.id],
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

  const { data: loyaltyConnections = [] } = useQuery({
    queryKey: ["external-loyalty-home", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("external_loyalty_connections" as any)
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "connected");
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  const connBrandIds = loyaltyConnections.map((c: any) => c.brand_id);
  const { data: connBrands = [] } = useQuery({
    queryKey: ["conn-brands", connBrandIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("brands")
        .select("id, name, loyalty_api_url, loyalty_provider, website_url, logo_emoji")
        .in("id", connBrandIds);
      return (data ?? []) as any[];
    },
    enabled: connBrandIds.length > 0,
  });

  const [favChoiceBrand, setFavChoiceBrand] = useState<any | null>(null);
  const [loyaltyChoiceConn, setLoyaltyChoiceConn] = useState<any | null>(null);
  const [editingBrandFields, setEditingBrandFields] = useState<string | null>(null); // brandId being edited
  const [brandFieldDraft, setBrandFieldDraft] = useState<string[]>([]);

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

  const totalExternalPoints = loyaltyConnections.reduce(
    (sum: number, c: any) => sum + (c.external_points_balance ?? 0),
    0
  );

  const hasActivity = (recentEntries?.length ?? 0) > 0;
  const greeting = profile?.display_name
    ? `Hey, ${profile.display_name}`
    : "Hey there";

  const visitCountForBrand = (brandId: string) => {
    const brand = favoriteBrands.find((b: any) => b.id === brandId);
    const expiryMonths = brand?.visit_expiry_months ?? 6;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - expiryMonths);
    return brandVisits.filter(
      (v: any) => v.brand_id === brandId && new Date(v.created_at) > cutoff
    ).length;
  };

  const visitsForBrand = (brandId: string) => {
    const brand = favoriteBrands.find((b: any) => b.id === brandId);
    const expiryMonths = brand?.visit_expiry_months ?? 6;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - expiryMonths);
    return brandVisits.filter(
      (v: any) => v.brand_id === brandId && new Date(v.created_at) > cutoff
    );
  };

  const expiringPointsForBrand = (brandId: string) => {
    return expiringEntries
      .filter((e: any) => (e.metadata as any)?.brand_id === brandId)
      .reduce((sum: number, e: any) => sum + e.delta_points, 0);
  };

  // Build field context for a brand
  const buildFieldContext = (brand: any): FieldContext => {
    const conn = loyaltyConnections.find((c: any) => c.brand_id === brand.id);
    const bVisits = visitsForBrand(brand.id);
    const exPts = expiringPointsForBrand(brand.id);
    return { brand, conn, profile, visits: bVisits, expiringPts: exPts, userEmail: user?.email };
  };

  const toastShown = useRef(false);
  useEffect(() => {
    if (toastShown.current || expiringEntries.length === 0) return;
    const totalExpiring = expiringEntries.reduce((sum: number, e: any) => sum + e.delta_points, 0);
    if (totalExpiring > 0) {
      toastShown.current = true;
      toast.warning(`⏰ ${totalExpiring} points expiring in the next 30 days`, {
        description: "Visit your favorite brands to earn more before they expire!",
        duration: 8000,
        action: {
          label: "View Brands",
          onClick: () => navigate("/brands"),
        },
      });
    }
  }, [expiringEntries, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-12 pb-4">
        <div>
          <p className="text-sm text-muted-foreground">Good to see you 👋</p>
          <h1 className="text-xl font-bold tracking-tight">{greeting}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditorOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:text-foreground active:scale-95"
            title="Edit layout"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate("/profile")}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:text-foreground active:scale-95"
          >
            <UserCircle className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Render widgets in layout order */}
      {widgetLayout.filter((w) => w.visible).map((widget) => {
        switch (widget.id) {
          case "points":
            return (
              <div key="points" className="px-6 py-4">
                <div className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-xl shadow-primary/15">
                  <div className="relative z-10">
                    <p className="text-sm font-medium opacity-80">In-app points</p>
                    <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">
                      {totalPoints.toLocaleString()}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-sm opacity-80">
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
            );

          case "loyalty":
            if (loyaltyConnections.length === 0) return null;
            return (
              <div key="loyalty" className="px-6 pb-2">
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Loyalty points
                    </h2>
                    <p className="text-2xl font-bold tabular-nums text-foreground">
                      {totalExternalPoints.toLocaleString()}
                      <span className="text-xs font-medium text-muted-foreground ml-1">pts</span>
                    </p>
                  </div>
                  <div className="space-y-2.5">
                    {loyaltyConnections.map((conn: any) => (
                      <button
                        key={conn.brand_id}
                        onClick={() => setLoyaltyChoiceConn(conn)}
                        className="flex w-full items-center gap-3 rounded-xl bg-muted/50 px-3.5 py-3 text-left transition-all hover:bg-muted active:scale-[0.98]"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <Link2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{conn.provider_name}</p>
                          <p className="text-[11px] text-muted-foreground">Connected program</p>
                        </div>
                        <p className="text-base font-bold tabular-nums text-foreground">
                          {(conn.external_points_balance ?? 0).toLocaleString()}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );

          case "quickActions":
            return (
              <div key="quickActions" className="px-6 py-4">
                <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Quick actions
                </h2>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { icon: QrCode, label: "Scan", color: "bg-primary/10 text-primary", onClick: () => navigate("/scan") },
                    { icon: Gift, label: "Rewards", color: "bg-secondary/10 text-secondary", onClick: () => navigate("/rewards") },
                    { icon: Store, label: "Brands", color: "bg-primary/10 text-primary", onClick: () => navigate("/brands") },
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
            );

          case "favorites":
            if (favoriteBrands.length === 0) return null;
            return (
              <div key="favorites" className="px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Heart className="h-3.5 w-3.5 fill-destructive text-destructive" />
                    Favorite brands
                  </h2>
                  <button
                    onClick={() => navigate("/brands")}
                    className="text-xs font-medium text-primary active:scale-95"
                  >
                    View all
                  </button>
                </div>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                  {favoriteBrands.map((brand: any) => {
                    const brandFields = getFieldsForBrand(brand.id);
                    const ctx = buildFieldContext(brand);
                    const count = visitCountForBrand(brand.id);
                    const progress = Math.min((count / brand.milestone_visits) * 100, 100);
                    const hasOverride = hasBrandFieldOverride(brand.id);

                    // Get fields to render on widget
                    const fieldsToRender = LOYALTY_API_FIELDS.filter((f) => brandFields.includes(f.key));

                    return (
                      <button
                        key={brand.id}
                        onClick={() => setFavChoiceBrand(brand)}
                        className="relative flex shrink-0 min-w-[8rem] max-w-[10rem] w-auto flex-col items-center gap-1.5 rounded-2xl border border-border bg-card px-3 py-4 transition-all hover:shadow-sm active:scale-[0.96]"
                      >
                        {(brand.loyalty_api_url || brand.website_url) && (
                          <ExternalLink className="absolute top-2.5 right-2.5 h-3 w-3 text-muted-foreground" />
                        )}
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-2xl">
                          {brand.logo_emoji}
                        </div>
                        <p className="text-xs font-semibold w-full text-center break-words line-clamp-2">
                          {brand.name}
                        </p>

                        {/* Render selected fields dynamically */}
                        {fieldsToRender.length > 0 ? (
                          fieldsToRender.map((field) => {
                            const val = field.getValue(ctx);
                            // Special rendering for progress
                            if (field.key === "progress") {
                              return (
                                <div key={field.key} className="w-full">
                                  <Progress value={progress} className="h-1 w-full" />
                                  <p className="text-[10px] tabular-nums text-muted-foreground text-center mt-0.5">
                                    {count}/{brand.milestone_visits}
                                  </p>
                                </div>
                              );
                            }
                            // Special rendering for expiring points
                            if (field.key === "expiringPoints") {
                              const expPts = ctx.expiringPts;
                              return (
                                <p key={field.key} className="text-[9px] font-medium text-muted-foreground leading-tight text-center">
                                  {expPts > 0 ? <span className="text-destructive">⚠ {expPts} pts expiring</span> : "No expiring pts"}
                                </p>
                              );
                            }
                            return (
                              <p key={field.key} className="text-[10px] text-muted-foreground truncate w-full text-center">
                                {val != null && val !== "" ? String(val) : "—"}
                              </p>
                            );
                          })
                        ) : (
                          <p className="text-[10px] text-muted-foreground/60 italic">No fields selected</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );

          case "activity":
            return hasActivity ? (
              <div key="activity" className="px-6 py-4">
                <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent activity</h2>
                <div className="space-y-2">
                  {recentEntries!.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                      <div>
                        <p className="text-sm font-medium">{(entry as any).merchants?.name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${entry.delta_points > 0 ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
                        {entry.delta_points > 0 ? "+" : ""}{entry.delta_points}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div key="activity-empty" className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                  <Gift className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold">No rewards yet</h3>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">Visit a partner merchant and scan their QR code to start earning points.</p>
                <Button variant="outline" className="mt-4 active:scale-[0.97]" onClick={() => navigate("/scan")}>Scan a QR code</Button>
              </div>
            );

          default:
            return null;
        }
      })}

      {/* Loyalty choice dialog */}
      <Dialog open={!!loyaltyChoiceConn} onOpenChange={(open) => !open && setLoyaltyChoiceConn(null)}>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {loyaltyChoiceConn?.provider_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            {(() => {
              const brand = connBrands.find((b: any) => b.id === loyaltyChoiceConn?.brand_id);
              const providerLinks = getProviderLinks(brand?.loyalty_provider);
              const providerLink = getProviderLink(brand?.loyalty_provider);
              const appUrl = providerLink ? getOpenAppUrl(providerLink) : brand?.loyalty_api_url;
              return (
                <>
                  {appUrl && (
                    <button
                      onClick={() => {
                        window.open(appUrl, "_blank", "noopener");
                        setLoyaltyChoiceConn(null);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-sm active:scale-[0.97]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        {providerLinks.appUrl ? <Download className="h-5 w-5 text-primary" /> : <Smartphone className="h-5 w-5 text-primary" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {providerLinks.appUrl ? `Get ${providerLinks.appName ?? "the"} app` : "Open app"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {providerLinks.appUrl ? "Download from app store" : "Launch the loyalty program"}
                        </p>
                      </div>
                    </button>
                  )}
                  {providerLinks.webUrl && (
                    <button
                      onClick={() => {
                        window.open(providerLinks.webUrl!, "_blank", "noopener");
                        setLoyaltyChoiceConn(null);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-sm active:scale-[0.97]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Open website</p>
                        <p className="text-[11px] text-muted-foreground">View in browser</p>
                      </div>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      navigate(`/brands?brand=${loyaltyChoiceConn?.brand_id}`);
                      setLoyaltyChoiceConn(null);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-sm active:scale-[0.97]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                      <Store className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">View brand</p>
                      <p className="text-[11px] text-muted-foreground">Go to the brands page</p>
                    </div>
                  </button>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Favorite brand choice dialog */}
      <Dialog open={!!favChoiceBrand} onOpenChange={(open) => { if (!open) { setFavChoiceBrand(null); setEditingBrandFields(null); } }}>
        <DialogContent className="max-w-xs rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <span className="text-xl">{favChoiceBrand?.logo_emoji}</span>
              {favChoiceBrand?.name}
            </DialogTitle>
          </DialogHeader>

          {/* Show selected API fields */}
          {favChoiceBrand && editingBrandFields !== favChoiceBrand.id && (() => {
            const brandFields = getFieldsForBrand(favChoiceBrand.id);
            const ctx = buildFieldContext(favChoiceBrand);
            const fieldsToShow = LOYALTY_API_FIELDS.filter((f) => brandFields.includes(f.key));
            const hasOverride = hasBrandFieldOverride(favChoiceBrand.id);
            return (
              <div className="space-y-1.5 rounded-xl bg-muted/50 p-3 text-xs">
                {hasOverride && (
                  <p className="text-[10px] text-primary font-medium mb-1">Custom fields for this brand</p>
                )}
                {fieldsToShow.length > 0 ? (
                  fieldsToShow.map((field) => {
                    const val = field.getValue(ctx);
                    const isExpiring = field.key === "expiringPoints";
                    return (
                      <div key={field.key} className="flex justify-between">
                        <span className="text-muted-foreground">{field.label}</span>
                        <span className={`font-medium tabular-nums ${isExpiring && ctx.expiringPts > 0 ? "text-destructive" : ""}`}>
                          {val != null && val !== "" ? String(val) : "—"}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-muted-foreground text-center py-1">No fields selected</p>
                )}
              </div>
            );
          })()}

          {/* Per-brand field editor */}
          {favChoiceBrand && editingBrandFields === favChoiceBrand.id && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Customize widget fields</p>
                {hasBrandFieldOverride(favChoiceBrand.id) && (
                  <button
                    onClick={() => {
                      clearBrandFieldOverride(favChoiceBrand.id);
                      setEditingBrandFields(null);
                      toast.success("Reset to global defaults");
                    }}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground active:scale-95"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Use global
                  </button>
                )}
              </div>
              <div className="max-h-[40vh] overflow-y-auto space-y-3 pr-1">
                {LOYALTY_SECTIONS.map((section) => {
                  const sectionFields = LOYALTY_API_FIELDS.filter((f) => f.section === section);
                  return (
                    <div key={section}>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{section}</p>
                      <div className="space-y-1">
                        {sectionFields.map((field) => (
                          <div key={field.key} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-muted/50">
                            <span className="text-xs">{field.label}</span>
                            <Switch
                              checked={brandFieldDraft.includes(field.key)}
                              onCheckedChange={() => {
                                setBrandFieldDraft((prev) =>
                                  prev.includes(field.key) ? prev.filter((k) => k !== field.key) : [...prev, field.key]
                                );
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 active:scale-[0.97]" onClick={() => setEditingBrandFields(null)}>
                  Cancel
                </Button>
                <Button size="sm" className="flex-1 active:scale-[0.97]" onClick={() => {
                  setBrandFieldOverride(favChoiceBrand.id, brandFieldDraft);
                  setEditingBrandFields(null);
                  toast.success("Brand fields saved");
                }}>
                  Save
                </Button>
              </div>
            </div>
          )}

          {editingBrandFields !== favChoiceBrand?.id && (
            <div className="space-y-2 pt-1">
              {/* Customize fields button */}
              <button
                onClick={() => {
                  if (favChoiceBrand) {
                    setBrandFieldDraft(getFieldsForBrand(favChoiceBrand.id));
                    setEditingBrandFields(favChoiceBrand.id);
                  }
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-sm active:scale-[0.97]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Settings className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Customize fields</p>
                  <p className="text-[11px] text-muted-foreground">
                    {hasBrandFieldOverride(favChoiceBrand?.id ?? "") ? "Using custom fields" : "Using global defaults"}
                  </p>
                </div>
              </button>
              {(() => {
                const favProviderLinks = getProviderLinks(favChoiceBrand?.loyalty_provider);
                const favProviderLink = getProviderLink(favChoiceBrand?.loyalty_provider);
                const favAppUrl = favProviderLink ? getOpenAppUrl(favProviderLink) : favChoiceBrand?.loyalty_api_url;
                return (
                  <>
                    {favAppUrl && (
                      <button
                        onClick={() => {
                          window.open(favAppUrl, "_blank", "noopener");
                          setFavChoiceBrand(null);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-sm active:scale-[0.97]"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                          {favProviderLinks.appUrl ? <Download className="h-5 w-5 text-primary" /> : <Smartphone className="h-5 w-5 text-primary" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">
                            {favProviderLinks.appUrl ? `Get ${favProviderLinks.appName ?? "the"} app` : "Open app"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {favProviderLinks.appUrl ? "Download from app store" : "Launch the loyalty program"}
                          </p>
                        </div>
                      </button>
                    )}
                    {favProviderLinks.webUrl && (
                      <button
                        onClick={() => {
                          window.open(favProviderLinks.webUrl!, "_blank", "noopener");
                          setFavChoiceBrand(null);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-sm active:scale-[0.97]"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                          <Globe className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Visit website</p>
                          <p className="text-[11px] text-muted-foreground">{favProviderLinks.webUrl}</p>
                        </div>
                      </button>
                    )}
                    {!favProviderLinks.webUrl && favChoiceBrand?.website_url && (
                      <button
                        onClick={() => {
                          window.open(favChoiceBrand.website_url, "_blank", "noopener");
                          setFavChoiceBrand(null);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-sm active:scale-[0.97]"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                          <Globe className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Visit website</p>
                          <p className="text-[11px] text-muted-foreground">{favChoiceBrand.website_url}</p>
                        </div>
                      </button>
                    )}
                  </>
                );
              })()}
              <button
                onClick={() => {
                  navigate(`/brands?brand=${favChoiceBrand?.id}`);
                  setFavChoiceBrand(null);
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-sm active:scale-[0.97]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <Store className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">View brand</p>
                  <p className="text-[11px] text-muted-foreground">See full details</p>
                </div>
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <HomeWidgetEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        widgets={widgetLayout}
        onSave={handleSaveLayout}
      />
      <BottomNav />
    </div>
  );
}
