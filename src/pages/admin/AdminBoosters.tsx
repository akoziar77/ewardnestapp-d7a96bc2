import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Trash2, Rocket, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

const BOOSTER_TYPES = ["multiplier", "flat_bonus", "challenge", "tier_bonus"];
const ACTIONS = ["any", "add_card", "check_balance", "visit_brand", "redeem_reward"];
const TIERS = ["any", "Hatchling", "Feathered", "Winged", "Golden Nest"];

interface BoosterRule {
  id?: string;
  multiplier: number;
  bonus: number;
}

export default function AdminBoosters() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Form state for new booster
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "multiplier",
    multiplier_value: 2,
    bonus_value: 0,
    required_action: "any",
    required_tier: "any",
    start_at: new Date().toISOString().slice(0, 16),
    end_at: "",
  });

  const { data: boosters, isLoading } = useQuery({
    queryKey: ["admin-boosters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boosters")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("boosters").insert({
        name: form.name,
        description: form.description || null,
        type: form.type,
        multiplier_value: form.multiplier_value,
        bonus_value: form.bonus_value,
        required_action: form.required_action,
        required_tier: form.required_tier,
        start_at: new Date(form.start_at).toISOString(),
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booster created");
      queryClient.invalidateQueries({ queryKey: ["admin-boosters"] });
      setShowCreate(false);
      setForm({ name: "", description: "", type: "multiplier", multiplier_value: 2, bonus_value: 0, required_action: "any", required_tier: "any", start_at: new Date().toISOString().slice(0, 16), end_at: "" });
    },
    onError: () => toast.error("Failed to create booster"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("boosters").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-boosters"] }),
    onError: () => toast.error("Failed to update booster"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("boosters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booster deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-boosters"] });
    },
    onError: () => toast.error("Failed to delete booster"),
  });

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="active:scale-95 transition-transform">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <Rocket className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">Manage Boosters</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">
        {/* Create Button */}
        <Button onClick={() => setShowCreate(!showCreate)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> New Booster
        </Button>

        {/* Create Form */}
        {showCreate && (
          <Card className="border-0 shadow-md">
            <CardContent className="p-5 space-y-4">
              <div className="grid gap-3">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Double Points Weekend" />
                </div>
                <div>
                  <Label className="text-xs">Description</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Earn 2x points on all actions" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BOOSTER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Required Action</Label>
                    <Select value={form.required_action} onValueChange={(v) => setForm({ ...form, required_action: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Multiplier Value</Label>
                    <Input type="number" step="0.1" value={form.multiplier_value} onChange={(e) => setForm({ ...form, multiplier_value: parseFloat(e.target.value) || 1 })} />
                  </div>
                  <div>
                    <Label className="text-xs">Bonus Value</Label>
                    <Input type="number" value={form.bonus_value} onChange={(e) => setForm({ ...form, bonus_value: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Required Tier</Label>
                    <Select value={form.required_tier} onValueChange={(v) => setForm({ ...form, required_tier: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Start At</Label>
                    <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">End At (optional)</Label>
                  <Input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} />
                </div>
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending} className="w-full">
                {createMutation.isPending ? "Creating…" : "Create Booster"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Boosters List */}
        {isLoading ? (
          <div className="text-muted-foreground text-center py-8">Loading…</div>
        ) : (boosters?.length ?? 0) === 0 ? (
          <div className="text-muted-foreground text-center py-8">No boosters yet. Create one above.</div>
        ) : (
          <div className="space-y-3">
            {boosters!.map((b) => (
              <Card key={b.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Switch
                        checked={b.active}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: b.id, active: checked })}
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{b.name}</p>
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          <Badge variant="secondary" className="text-xs">{b.type}</Badge>
                          {b.type === "multiplier" && <Badge variant="outline" className="text-xs tabular-nums">{b.multiplier_value}x</Badge>}
                          {b.type === "flat_bonus" && <Badge variant="outline" className="text-xs tabular-nums">+{b.bonus_value}</Badge>}
                          {b.required_action !== "any" && <Badge variant="outline" className="text-xs">{b.required_action}</Badge>}
                          {b.required_tier !== "any" && <Badge variant="outline" className="text-xs">{b.required_tier}</Badge>}
                          {!b.active && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      >
                        {expandedId === b.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(b.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {expandedId === b.id && (
                    <BoosterRulesPanel boosterId={b.id} />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BoosterRulesPanel({ boosterId }: { boosterId: string }) {
  const queryClient = useQueryClient();

  const { data: tierRules } = useQuery({
    queryKey: ["booster-tier-rules", boosterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booster_tier_rules")
        .select("*")
        .eq("booster_id", boosterId);
      if (error) throw error;
      return data;
    },
  });

  const { data: actionRules } = useQuery({
    queryKey: ["booster-action-rules", boosterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booster_action_rules")
        .select("*")
        .eq("booster_id", boosterId);
      if (error) throw error;
      return data;
    },
  });

  const [tierForm, setTierForm] = useState({ tier: "Hatchling", multiplier: "1", bonus: "0" });
  const [actionForm, setActionForm] = useState({ action: "add_card", multiplier: "1", bonus: "0" });

  const addTierRule = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("booster_tier_rules").insert({
        booster_id: boosterId,
        tier: tierForm.tier,
        multiplier: parseFloat(tierForm.multiplier) || 1,
        bonus: parseInt(tierForm.bonus) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tier rule added");
      queryClient.invalidateQueries({ queryKey: ["booster-tier-rules", boosterId] });
    },
    onError: () => toast.error("Failed — rule may already exist for this tier"),
  });

  const addActionRule = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("booster_action_rules").insert({
        booster_id: boosterId,
        action: actionForm.action,
        multiplier: parseFloat(actionForm.multiplier) || 1,
        bonus: parseInt(actionForm.bonus) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Action rule added");
      queryClient.invalidateQueries({ queryKey: ["booster-action-rules", boosterId] });
    },
    onError: () => toast.error("Failed — rule may already exist for this action"),
  });

  const deleteTierRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("booster_tier_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booster-tier-rules", boosterId] }),
  });

  const deleteActionRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("booster_action_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booster-action-rules", boosterId] }),
  });

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-4">
      {/* Tier Rules */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tier Rules</p>
        {(tierRules ?? []).map((r) => (
          <div key={r.id} className="flex items-center justify-between py-1.5">
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">{r.tier}</Badge>
              <span className="text-xs text-muted-foreground tabular-nums">{r.multiplier}x / +{r.bonus}</span>
            </div>
            <button onClick={() => deleteTierRule.mutate(r.id)} className="text-destructive hover:bg-destructive/10 p-1 rounded">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <div className="flex gap-2 mt-2">
          <Select value={tierForm.tier} onValueChange={(v) => setTierForm({ ...tierForm, tier: v })}>
            <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Hatchling", "Feathered", "Winged", "Golden Nest"].map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input className="h-8 w-16 text-xs" placeholder="×" value={tierForm.multiplier} onChange={(e) => setTierForm({ ...tierForm, multiplier: e.target.value })} />
          <Input className="h-8 w-16 text-xs" placeholder="+" value={tierForm.bonus} onChange={(e) => setTierForm({ ...tierForm, bonus: e.target.value })} />
          <Button size="sm" variant="outline" className="h-8" onClick={() => addTierRule.mutate()}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Action Rules */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Action Rules</p>
        {(actionRules ?? []).map((r) => (
          <div key={r.id} className="flex items-center justify-between py-1.5">
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">{r.action}</Badge>
              <span className="text-xs text-muted-foreground tabular-nums">{r.multiplier}x / +{r.bonus}</span>
            </div>
            <button onClick={() => deleteActionRule.mutate(r.id)} className="text-destructive hover:bg-destructive/10 p-1 rounded">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <div className="flex gap-2 mt-2">
          <Select value={actionForm.action} onValueChange={(v) => setActionForm({ ...actionForm, action: v })}>
            <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["add_card", "check_balance", "visit_brand", "redeem_reward"].map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input className="h-8 w-16 text-xs" placeholder="×" value={actionForm.multiplier} onChange={(e) => setActionForm({ ...actionForm, multiplier: e.target.value })} />
          <Input className="h-8 w-16 text-xs" placeholder="+" value={actionForm.bonus} onChange={(e) => setActionForm({ ...actionForm, bonus: e.target.value })} />
          <Button size="sm" variant="outline" className="h-8" onClick={() => addActionRule.mutate()}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
