import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Plus, GripVertical, Pencil, Trash2, ArrowUp, ArrowDown,
  Bird, Gift, Sparkles, Bell, QrCode, Star, Heart, Zap, Shield, MapPin,
  Trophy, Crown, Flame, Target, Rocket, type LucideIcon,
} from "lucide-react";

/* ── icon registry ─────────────────────────────────────── */
const ICON_MAP: Record<string, LucideIcon> = {
  Bird, Gift, Sparkles, Bell, QrCode, Star, Heart, Zap, Shield, MapPin,
  Trophy, Crown, Flame, Target, Rocket,
};
const ICON_NAMES = Object.keys(ICON_MAP);

const STEP_TYPES = [
  { value: "intro", label: "Intro slide" },
  { value: "permissions", label: "Permissions request" },
  { value: "merchant_select", label: "Merchant selection" },
];

const COLOR_OPTIONS = [
  { value: "bg-primary", label: "Primary" },
  { value: "bg-secondary", label: "Secondary" },
  { value: "bg-accent", label: "Accent" },
  { value: "bg-destructive", label: "Destructive" },
];

/* ── types ─────────────────────────────────────────────── */
interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon_name: string;
  color_class: string;
  step_type: string;
  sort_order: number;
  active: boolean;
}

const EMPTY: Omit<OnboardingStep, "id" | "sort_order"> = {
  title: "",
  description: "",
  icon_name: "Sparkles",
  color_class: "bg-primary",
  step_type: "intro",
  active: true,
};

/* ── component ─────────────────────────────────────────── */
export default function AdminOnboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editing, setEditing] = useState<OnboardingStep | null>(null);
  const [deleting, setDeleting] = useState<OnboardingStep | null>(null);
  const [isNew, setIsNew] = useState(false);

  /* ── queries ── */
  const { data: steps = [], isLoading } = useQuery({
    queryKey: ["onboarding-steps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_steps")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as OnboardingStep[];
    },
  });

  /* ── mutations ── */
  const upsert = useMutation({
    mutationFn: async (step: Partial<OnboardingStep> & { id?: string }) => {
      if (step.id) {
        const { error } = await supabase
          .from("onboarding_steps")
          .update({
            title: step.title,
            description: step.description,
            icon_name: step.icon_name,
            color_class: step.color_class,
            step_type: step.step_type,
            active: step.active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", step.id);
        if (error) throw error;
      } else {
        const maxOrder = steps.length > 0 ? Math.max(...steps.map((s) => s.sort_order)) + 1 : 0;
        const { error } = await supabase.from("onboarding_steps").insert({
          title: step.title!,
          description: step.description!,
          icon_name: step.icon_name!,
          color_class: step.color_class!,
          step_type: step.step_type!,
          active: step.active ?? true,
          sort_order: maxOrder,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding-steps"] });
      toast({ title: isNew ? "Step created" : "Step updated" });
      setEditing(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("onboarding_steps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding-steps"] });
      toast({ title: "Step deleted" });
      setDeleting(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reorder = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      const idx = steps.findIndex((s) => s.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= steps.length) return;

      const a = steps[idx];
      const b = steps[swapIdx];

      const { error: e1 } = await supabase
        .from("onboarding_steps")
        .update({ sort_order: b.sort_order, updated_at: new Date().toISOString() })
        .eq("id", a.id);
      const { error: e2 } = await supabase
        .from("onboarding_steps")
        .update({ sort_order: a.sort_order, updated_at: new Date().toISOString() })
        .eq("id", b.id);
      if (e1 || e2) throw e1 || e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding-steps"] }),
    onError: (e: Error) => toast({ title: "Reorder failed", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("onboarding_steps")
        .update({ active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding-steps"] }),
  });

  const openNew = () => {
    setIsNew(true);
    setEditing({ ...EMPTY, id: "", sort_order: 0 });
  };

  const openEdit = (s: OnboardingStep) => {
    setIsNew(false);
    setEditing({ ...s });
  };

  /* ── render ── */
  return (
    <div className="min-h-screen bg-background">
      {/* header */}
      <div className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold flex-1">Onboarding Flow</h1>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Add Step
        </Button>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))
          : steps.map((step, idx) => {
              const Icon = ICON_MAP[step.icon_name] ?? Sparkles;
              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 rounded-xl border p-4 transition-opacity ${
                    !step.active ? "opacity-50" : ""
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />

                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${step.color_class}`}>
                    <Icon className="h-5 w-5 text-primary-foreground" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{step.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{step.step_type} · order {step.sort_order}</p>
                  </div>

                  <Switch
                    checked={step.active}
                    onCheckedChange={(v) => toggleActive.mutate({ id: step.id, active: v })}
                    className="shrink-0"
                  />

                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={idx === 0}
                      onClick={() => reorder.mutate({ id: step.id, direction: "up" })}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={idx === steps.length - 1}
                      onClick={() => reorder.mutate({ id: step.id, direction: "down" })}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(step)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(step)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
      </div>

      {/* ── edit / create dialog ── */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isNew ? "Add Step" : "Edit Step"}</DialogTitle>
            <DialogDescription>Configure the onboarding step details below.</DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Icon</label>
                  <Select value={editing.icon_name} onValueChange={(v) => setEditing({ ...editing, icon_name: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ICON_NAMES.map((n) => {
                        const I = ICON_MAP[n];
                        return (
                          <SelectItem key={n} value={n}>
                            <span className="flex items-center gap-2">
                              <I className="h-4 w-4" /> {n}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Color</label>
                  <Select value={editing.color_class} onValueChange={(v) => setEditing({ ...editing, color_class: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLOR_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Step Type</label>
                <Select value={editing.step_type} onValueChange={(v) => setEditing({ ...editing, step_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STEP_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              disabled={!editing?.title || upsert.isPending}
              onClick={() => {
                if (!editing) return;
                const { id, sort_order, ...rest } = editing;
                upsert.mutate(isNew ? rest : { id, ...rest });
              }}
            >
              {upsert.isPending ? "Saving…" : isNew ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── delete confirmation ── */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete step?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.title}" will be permanently removed from the onboarding flow.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && remove.mutate(deleting.id)}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
