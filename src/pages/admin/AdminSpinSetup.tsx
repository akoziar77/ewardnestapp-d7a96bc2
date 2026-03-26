import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Dices, Trophy, History, Settings2, Pencil } from "lucide-react";

/* ─── Prizes Tab ─── */
function PrizesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", reward_type: "points", reward_value: "0", weight: 1, tier: "Bronze", active: true });

  const { data: prizes, isLoading } = useQuery({
    queryKey: ["admin-prizes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("prizes").select("*").order("weight", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from("prizes").update({
          name: form.name, reward_type: form.reward_type, reward_value: form.reward_value,
          weight: form.weight, tier: form.tier, active: form.active,
        }).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("prizes").insert({
          name: form.name, reward_type: form.reward_type, reward_value: form.reward_value,
          weight: form.weight, tier: form.tier, active: form.active,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-prizes"] }); setOpen(false); setEditId(null); toast.success("Prize saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("prizes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-prizes"] }); toast.success("Prize deleted"); },
  });

  const openNew = () => { setEditId(null); setForm({ name: "", reward_type: "points", reward_value: "0", weight: 1, tier: "Bronze", active: true }); setOpen(true); };
  const openEdit = (p: any) => { setEditId(p.id); setForm({ name: p.name, reward_type: p.reward_type, reward_value: p.reward_value, weight: p.weight, tier: p.tier, active: p.active }); setOpen(true); };

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{prizes?.length ?? 0} prizes configured</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Prize</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit Prize" : "New Prize"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="10 Points" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Type</Label>
                  <Select value={form.reward_type} onValueChange={v => setForm(f => ({ ...f, reward_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="points">Points</SelectItem><SelectItem value="badge">Badge</SelectItem><SelectItem value="item">Item</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Value</Label><Input value={form.reward_value} onChange={e => setForm(f => ({ ...f, reward_value: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Weight</Label><Input type="number" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: Number(e.target.value) }))} /></div>
                <div><Label>Tier</Label>
                  <Select value={form.tier} onValueChange={v => setForm(f => ({ ...f, tier: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Bronze">Bronze</SelectItem><SelectItem value="Silver">Silver</SelectItem><SelectItem value="Gold">Gold</SelectItem><SelectItem value="Platinum">Platinum</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} /><Label>Active</Label></div>
              <Button className="w-full" disabled={!form.name || upsert.isPending} onClick={() => upsert.mutate()}>{editId ? "Update" : "Create"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {prizes?.map(p => (
          <div key={p.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                {p.reward_type === "points" ? "🪙" : p.reward_type === "badge" ? "🏅" : "🎁"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">Weight: {p.weight} · {p.reward_type}: {p.reward_value}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={p.active ? "default" : "secondary"} className="text-[10px]">{p.active ? "Active" : "Off"}</Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => del.mutate(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
        {prizes?.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No prizes yet</p>}
      </div>
    </div>
  );
}

/* ─── Jackpot Settings Tab ─── */
function JackpotTab() {
  const qc = useQueryClient();
  const { data: profiles, isLoading } = useQuery({
    queryKey: ["admin-jackpot-defaults"],
    queryFn: async () => {
      // Read default jackpot values from first profile (they're per-user but we show defaults)
      const { data } = await supabase.from("profiles").select("jackpot_meter, jackpot_increment, jackpot_max").limit(1).single();
      return data;
    },
  });

  const [increment, setIncrement] = useState<number | null>(null);
  const [max, setMax] = useState<number | null>(null);

  const effectiveIncrement = increment ?? profiles?.jackpot_increment ?? 1;
  const effectiveMax = max ?? profiles?.jackpot_max ?? 25;

  const save = useMutation({
    mutationFn: async () => {
      // Update all profiles with new defaults
      const { error } = await supabase.from("profiles").update({
        jackpot_increment: effectiveIncrement,
        jackpot_max: effectiveMax,
      }).gte("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-jackpot-defaults"] }); toast.success("Jackpot settings saved for all users"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Jackpot Configuration</CardTitle><CardDescription>Controls how the progressive jackpot meter increases per spin</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Increment per Spin</Label><Input type="number" value={effectiveIncrement} onChange={e => setIncrement(Number(e.target.value))} /></div>
            <div><Label>Max Meter Value</Label><Input type="number" value={effectiveMax} onChange={e => setMax(Number(e.target.value))} /></div>
          </div>
          <p className="text-xs text-muted-foreground">The jackpot meter adds weight to the jackpot prize each spin. When it reaches max, the jackpot is at peak probability.</p>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save Jackpot Settings</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Spin Costs by Tier</CardTitle><CardDescription>Points deducted per paid spin (free spin = 0)</CardDescription></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {[{ tier: "Bronze / Hatchling", cost: 50 }, { tier: "Silver", cost: 40 }, { tier: "Gold", cost: 30 }, { tier: "Platinum", cost: 20 }].map(t => (
              <div key={t.tier} className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm font-medium">{t.tier}</span>
                <Badge variant="secondary">{t.cost} pts</Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Tier costs are configured in the spin-wheel backend function.</p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Spin Logs Tab ─── */
function SpinLogsTab() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["admin-spin-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spin_logs")
        .select("*, prizes(name, reward_type, reward_value)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Last 50 spins</p>
      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {logs?.map(l => (
          <div key={l.id} className="flex items-center justify-between p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{(l as any).prizes?.name ?? "Unknown Prize"}</p>
              <p className="text-xs text-muted-foreground">User: {l.user_id.slice(0, 8)}… · Cost: {l.points_spent} pts</p>
            </div>
            <p className="text-xs text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleDateString()}</p>
          </div>
        ))}
        {logs?.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No spins recorded yet</p>}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function AdminSpinSetup() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><Dices className="h-5 w-5 text-primary" />Spin to Win Setup</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage prizes, jackpot settings, and view spin history.</p>
      </div>

      <Tabs defaultValue="prizes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="prizes" className="gap-1.5"><Trophy className="h-3.5 w-3.5" />Prizes</TabsTrigger>
          <TabsTrigger value="jackpot" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" />Jackpot</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5"><History className="h-3.5 w-3.5" />Spin Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="prizes"><PrizesTab /></TabsContent>
        <TabsContent value="jackpot"><JackpotTab /></TabsContent>
        <TabsContent value="logs"><SpinLogsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
