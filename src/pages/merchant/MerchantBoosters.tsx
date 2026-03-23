import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Zap,
  Plus,
  Trash2,
  Save,
  Package,
  Tag,
  DollarSign,
  Clock,
  Globe,
  Flame,
  X,
  ChevronRight,
} from "lucide-react";

type Ctx = { merchantId: string; merchantName: string };

const BOOSTER_TYPES = [
  { value: "sku", label: "SKU Match", icon: Package, desc: "Bonus for specific products" },
  { value: "category", label: "Category", icon: Tag, desc: "Bonus for product categories" },
  { value: "threshold", label: "Spend Threshold", icon: DollarSign, desc: "Bonus when spend exceeds amount" },
  { value: "time_window", label: "Time Window", icon: Clock, desc: "Bonus during specific dates" },
  { value: "multi_brand", label: "Multi-Brand", icon: Globe, desc: "Bonus for shopping at multiple brands" },
  { value: "streak", label: "Streak", icon: Flame, desc: "Bonus for consecutive activity" },
  { value: "multiplier", label: "Multiplier", icon: Zap, desc: "Multiply base points" },
  { value: "flat_bonus", label: "Flat Bonus", icon: Plus, desc: "Fixed bonus points" },
] as const;

type SkuRule = { sku_keyword: string; points: number };
type CategoryRule = { category_keyword: string; points: number };

interface BoosterForm {
  name: string;
  description: string;
  type: string;
  active: boolean;
  bonus_value: number;
  multiplier_value: number;
  min_spend: number;
  required_brands: number;
  required_streak: number;
  start_at: string;
  end_at: string;
  brand_id: string | null;
}

const emptyForm = (brandId: string): BoosterForm => ({
  name: "",
  description: "",
  type: "sku",
  active: true,
  bonus_value: 0,
  multiplier_value: 1,
  min_spend: 0,
  required_brands: 0,
  required_streak: 0,
  start_at: "",
  end_at: "",
  brand_id: brandId,
});

export default function MerchantBoosters() {
  const { merchantId } = useOutletContext<Ctx>();
  const queryClient = useQueryClient();
  const brandId = merchantId; // maps merchant → brand

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<BoosterForm>(emptyForm(brandId));
  const [skuRules, setSkuRules] = useState<SkuRule[]>([]);
  const [catRules, setCatRules] = useState<CategoryRule[]>([]);
  const [isNew, setIsNew] = useState(false);

  // ── Load boosters ──
  const { data: boosters, isLoading } = useQuery({
    queryKey: ["merchant-boosters", brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boosters")
        .select("*")
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Load rules for selected booster ──
  const { data: loadedRules } = useQuery({
    queryKey: ["booster-rules", selectedId],
    queryFn: async () => {
      if (!selectedId) return { sku: [], category: [] };
      const [skuRes, catRes] = await Promise.all([
        supabase.from("booster_sku_rules").select("*").eq("booster_id", selectedId),
        supabase.from("booster_category_rules").select("*").eq("booster_id", selectedId),
      ]);
      return {
        sku: (skuRes.data ?? []) as SkuRule[],
        category: (catRes.data ?? []) as CategoryRule[],
      };
    },
    enabled: !!selectedId,
  });

  function selectBooster(booster: any) {
    setSelectedId(booster.id);
    setIsNew(false);
    setForm({
      name: booster.name,
      description: booster.description ?? "",
      type: booster.type,
      active: booster.active,
      bonus_value: booster.bonus_value ?? 0,
      multiplier_value: booster.multiplier_value ?? 1,
      min_spend: booster.min_spend ?? 0,
      required_brands: booster.required_brands ?? 0,
      required_streak: booster.required_streak ?? 0,
      start_at: booster.start_at ? booster.start_at.slice(0, 16) : "",
      end_at: booster.end_at ? booster.end_at.slice(0, 16) : "",
      brand_id: booster.brand_id,
    });
    // Rules will load via query
    setSkuRules([]);
    setCatRules([]);
  }

  // Sync loaded rules into local state
  if (loadedRules && selectedId && !isNew) {
    if (skuRules.length === 0 && loadedRules.sku.length > 0) {
      setSkuRules(loadedRules.sku.map((r: any) => ({ sku_keyword: r.sku_keyword, points: r.points })));
    }
    if (catRules.length === 0 && loadedRules.category.length > 0) {
      setCatRules(loadedRules.category.map((r: any) => ({ category_keyword: r.category_keyword, points: r.points })));
    }
  }

  function startNew() {
    setSelectedId(null);
    setIsNew(true);
    setForm(emptyForm(brandId));
    setSkuRules([]);
    setCatRules([]);
  }

  // ── Save mutation ──
  const saveMut = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        action: isNew ? "create_booster" : "update_booster",
        ...(!isNew && { booster_id: selectedId }),
        name: form.name,
        type: form.type,
        description: form.description || null,
        is_active: form.active,
        bonus_value: form.bonus_value,
        multiplier_value: form.multiplier_value,
        min_spend: form.min_spend,
        required_brands: form.required_brands,
        required_streak: form.required_streak,
        brand_id: brandId,
        ...(form.start_at && { start_date: new Date(form.start_at).toISOString() }),
        ...(form.end_at && { end_date: new Date(form.end_at).toISOString() }),
      };

      if (form.type === "sku") {
        body.sku_rules = skuRules.filter((r) => r.sku_keyword.trim());
      }
      if (form.type === "category") {
        body.category_rules = catRules.filter((r) => r.category_keyword.trim());
      }

      const { data, error } = await supabase.functions.invoke("admin-actions", { body });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(isNew ? "Booster created" : "Booster updated");
      queryClient.invalidateQueries({ queryKey: ["merchant-boosters"] });
      if (isNew && data?.booster?.id) {
        setSelectedId(data.booster.id);
        setIsNew(false);
      }
      queryClient.invalidateQueries({ queryKey: ["booster-rules"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Delete mutation ──
  const deleteMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("admin-actions", {
        body: { action: "delete_booster", booster_id: selectedId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booster deleted");
      setSelectedId(null);
      setIsNew(false);
      setForm(emptyForm(brandId));
      queryClient.invalidateQueries({ queryKey: ["merchant-boosters"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const typeConfig = BOOSTER_TYPES.find((t) => t.value === form.type);
  const TypeIcon = typeConfig?.icon ?? Zap;

  const showEditor = isNew || selectedId;

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Left panel — booster list */}
      <div className="w-full border-r border-border sm:w-[300px] flex flex-col">
        <div className="border-b border-border px-4 py-3">
          <Button size="sm" className="w-full" onClick={startNew}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Booster
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : !boosters?.length ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Zap className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No boosters yet</p>
            </div>
          ) : (
            <div className="space-y-0.5 p-1.5">
              {boosters.map((b: any) => {
                const tc = BOOSTER_TYPES.find((t) => t.value === b.type);
                const Icon = tc?.icon ?? Zap;
                const active = selectedId === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => selectBooster(b)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors active:scale-[0.98] ${
                      active ? "bg-primary/10" : "hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {b.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground capitalize">
                        {tc?.label ?? b.type}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`shrink-0 text-[10px] ${
                        b.active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {b.active ? "Active" : "Off"}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right panel — editor */}
      <div className="hidden flex-1 sm:block">
        {!showEditor ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Zap className="h-8 w-8 opacity-40" />
            <p className="text-sm">Select or create a booster</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="max-w-xl space-y-5 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  {isNew ? "New Booster" : "Edit Booster"}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedId(null);
                    setIsNew(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Core fields */}
              <Card>
                <CardContent className="space-y-4 pt-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Weekend Double Points"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Optional description"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={form.type}
                      onValueChange={(v) => setForm({ ...form, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BOOSTER_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            <span className="flex items-center gap-2">
                              <t.icon className="h-3.5 w-3.5" />
                              {t.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {typeConfig && (
                      <p className="text-[11px] text-muted-foreground">
                        {typeConfig.desc}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Active</Label>
                    <Switch
                      checked={form.active}
                      onCheckedChange={(v) => setForm({ ...form, active: v })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Type-specific fields */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <TypeIcon className="h-4 w-4 text-primary" />
                    Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Bonus value — used by most types */}
                  {["threshold", "time_window", "multi_brand", "flat_bonus", "streak", "sku", "category"].includes(form.type) && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Bonus Points</Label>
                      <Input
                        type="number"
                        value={form.bonus_value}
                        onChange={(e) => setForm({ ...form, bonus_value: Number(e.target.value) })}
                      />
                    </div>
                  )}

                  {/* Multiplier */}
                  {["multiplier", "tiered"].includes(form.type) && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Multiplier</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={form.multiplier_value}
                        onChange={(e) => setForm({ ...form, multiplier_value: Number(e.target.value) })}
                      />
                    </div>
                  )}

                  {/* Threshold */}
                  {form.type === "threshold" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Minimum Spend ($)</Label>
                      <Input
                        type="number"
                        value={form.min_spend}
                        onChange={(e) => setForm({ ...form, min_spend: Number(e.target.value) })}
                      />
                    </div>
                  )}

                  {/* Time window */}
                  {form.type === "time_window" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Start</Label>
                        <Input
                          type="datetime-local"
                          value={form.start_at}
                          onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">End</Label>
                        <Input
                          type="datetime-local"
                          value={form.end_at}
                          onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Multi-brand */}
                  {form.type === "multi_brand" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Required Brands</Label>
                      <Input
                        type="number"
                        value={form.required_brands}
                        onChange={(e) => setForm({ ...form, required_brands: Number(e.target.value) })}
                      />
                    </div>
                  )}

                  {/* Streak */}
                  {form.type === "streak" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Required Streak Days</Label>
                      <Input
                        type="number"
                        value={form.required_streak}
                        onChange={(e) => setForm({ ...form, required_streak: Number(e.target.value) })}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* SKU rules */}
              {form.type === "sku" && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        SKU Rules
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() =>
                          setSkuRules([...skuRules, { sku_keyword: "", points: 0 }])
                        }
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Add
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {skuRules.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        No rules — add keywords to match against product names
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {skuRules.map((rule, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Input
                              className="flex-1 h-8 text-xs"
                              placeholder="Keyword"
                              value={rule.sku_keyword}
                              onChange={(e) => {
                                const next = [...skuRules];
                                next[i] = { ...next[i], sku_keyword: e.target.value };
                                setSkuRules(next);
                              }}
                            />
                            <Input
                              className="w-20 h-8 text-xs"
                              type="number"
                              placeholder="Pts"
                              value={rule.points}
                              onChange={(e) => {
                                const next = [...skuRules];
                                next[i] = { ...next[i], points: Number(e.target.value) };
                                setSkuRules(next);
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setSkuRules(skuRules.filter((_, j) => j !== i))}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Category rules */}
              {form.type === "category" && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary" />
                        Category Rules
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() =>
                          setCatRules([...catRules, { category_keyword: "", points: 0 }])
                        }
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Add
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {catRules.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        No rules — add keywords to match against categories
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {catRules.map((rule, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Input
                              className="flex-1 h-8 text-xs"
                              placeholder="Category keyword"
                              value={rule.category_keyword}
                              onChange={(e) => {
                                const next = [...catRules];
                                next[i] = { ...next[i], category_keyword: e.target.value };
                                setCatRules(next);
                              }}
                            />
                            <Input
                              className="w-20 h-8 text-xs"
                              type="number"
                              placeholder="Pts"
                              value={rule.points}
                              onChange={(e) => {
                                const next = [...catRules];
                                next[i] = { ...next[i], points: Number(e.target.value) };
                                setCatRules(next);
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setCatRules(catRules.filter((_, j) => j !== i))}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => saveMut.mutate()}
                  disabled={saveMut.isPending || !form.name.trim()}
                >
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  {saveMut.isPending ? "Saving…" : isNew ? "Create" : "Save"}
                </Button>
                {!isNew && selectedId && (
                  <Button
                    variant="destructive"
                    onClick={() => deleteMut.mutate()}
                    disabled={deleteMut.isPending}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
