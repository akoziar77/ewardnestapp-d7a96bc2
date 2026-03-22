import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Zap, GripVertical, Pencil, Trash2,
  QrCode, Gift, Store, Clock, Heart, MapPin, Star, Settings,
  History, TrendingUp, UserPlus, Sparkles, Shield, Bell,
  Home, Search, Calendar, Camera, Bookmark,
  ShoppingCart, Coffee, Wallet, Music, Plane, Trophy,
  Utensils, Ticket, Tag, Package,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const ICON_OPTIONS = [
  { name: "QrCode", icon: QrCode },
  { name: "Gift", icon: Gift },
  { name: "Store", icon: Store },
  { name: "Clock", icon: Clock },
  { name: "Heart", icon: Heart },
  { name: "MapPin", icon: MapPin },
  { name: "Star", icon: Star },
  { name: "Settings", icon: Settings },
  { name: "History", icon: History },
  { name: "TrendingUp", icon: TrendingUp },
  { name: "UserPlus", icon: UserPlus },
  { name: "Sparkles", icon: Sparkles },
  { name: "Shield", icon: Shield },
  { name: "Bell", icon: Bell },
  { name: "Home", icon: Home },
  { name: "Search", icon: Search },
  { name: "Calendar", icon: Calendar },
  { name: "Camera", icon: Camera },
  { name: "Bookmark", icon: Bookmark },
  { name: "ShoppingCart", icon: ShoppingCart },
  { name: "Coffee", icon: Coffee },
  { name: "Wallet", icon: Wallet },
  { name: "Music", icon: Music },
  { name: "Plane", icon: Plane },
  { name: "Trophy", icon: Trophy },
  { name: "Utensils", icon: Utensils },
  { name: "Ticket", icon: Ticket },
  { name: "Tag", icon: Tag },
  { name: "Package", icon: Package },
  { name: "Zap", icon: Zap },
] as const;

export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = Object.fromEntries(
  ICON_OPTIONS.map((o) => [o.name, o.icon])
);

const COLOR_OPTIONS = [
  { label: "Primary", value: "bg-primary/10 text-primary" },
  { label: "Secondary", value: "bg-secondary/10 text-secondary" },
  { label: "Muted", value: "bg-muted text-muted-foreground" },
  { label: "Destructive", value: "bg-destructive/10 text-destructive" },
];

interface QuickAction {
  id: string;
  label: string;
  icon_name: string;
  color_class: string;
  route: string;
  sort_order: number;
  visible: boolean;
}

export default function AdminQuickActions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [iconName, setIconName] = useState("Zap");
  const [colorClass, setColorClass] = useState(COLOR_OPTIONS[0].value);
  const [route, setRoute] = useState("");

  const { data: actions, isLoading } = useQuery({
    queryKey: ["quick-actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_actions" as any)
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as unknown as QuickAction[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase
          .from("quick_actions" as any)
          .update({ label, icon_name: iconName, color_class: colorClass, route } as any)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const nextOrder = (actions?.length ?? 0);
        const { error } = await supabase
          .from("quick_actions" as any)
          .insert({ label, icon_name: iconName, color_class: colorClass, route, sort_order: nextOrder } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quick-actions"] });
      toast({ title: editingId ? "Action updated" : "Action added" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, visible }: { id: string; visible: boolean }) => {
      const { error } = await supabase
        .from("quick_actions" as any)
        .update({ visible } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quick-actions"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quick_actions" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quick-actions"] });
      toast({ title: "Action removed" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      if (!actions) return;
      const idx = actions.findIndex((a) => a.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= actions.length) return;

      const updates = [
        { id: actions[idx].id, sort_order: actions[swapIdx].sort_order },
        { id: actions[swapIdx].id, sort_order: actions[idx].sort_order },
      ];

      for (const u of updates) {
        const { error } = await supabase
          .from("quick_actions" as any)
          .update({ sort_order: u.sort_order } as any)
          .eq("id", u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quick-actions"] }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setLabel("");
    setIconName("Zap");
    setColorClass(COLOR_OPTIONS[0].value);
    setRoute("");
  };

  const openEdit = (a: QuickAction) => {
    setEditingId(a.id);
    setLabel(a.label);
    setIconName(a.icon_name);
    setColorClass(a.color_class);
    setRoute(a.route);
    setDialogOpen(true);
  };

  const SelectedIcon = ICON_MAP[iconName] || Zap;

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-muted transition-colors active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Quick Actions</h1>
            <p className="text-sm text-muted-foreground">Manage home screen shortcuts</p>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5 active:scale-95 transition-transform">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </div>
        ) : !actions?.length ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <Zap className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold">No quick actions</p>
            <p className="text-sm text-muted-foreground mt-1">Add shortcuts for the home screen</p>
          </div>
        ) : (
          <div className="space-y-2">
            {actions.map((a, idx) => {
              const Icon = ICON_MAP[a.icon_name] || Zap;
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm">
                  <div className="flex flex-col gap-0.5">
                    <button
                      disabled={idx === 0}
                      onClick={() => reorderMutation.mutate({ id: a.id, direction: "up" })}
                      className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 active:scale-90 transition-all"
                    >
                      <GripVertical className="h-3 w-3 rotate-90" />
                    </button>
                    <button
                      disabled={idx === actions.length - 1}
                      onClick={() => reorderMutation.mutate({ id: a.id, direction: "down" })}
                      className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 active:scale-90 transition-all rotate-180"
                    >
                      <GripVertical className="h-3 w-3 rotate-90" />
                    </button>
                  </div>

                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.color_class}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{a.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.route}</p>
                  </div>

                  <Switch
                    checked={a.visible}
                    onCheckedChange={(v) => toggleMutation.mutate({ id: a.id, visible: v })}
                  />

                  <button onClick={() => openEdit(a)} className="p-2 rounded-lg hover:bg-muted transition-colors active:scale-95">
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="p-2 rounded-lg hover:bg-destructive/10 transition-colors active:scale-95">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove "{a.label}"?</AlertDialogTitle>
                        <AlertDialogDescription>This quick action will be removed from the home screen for all users.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(a.id)}>Remove</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              );
            })}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit action" : "New quick action"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Label</label>
                <Input placeholder="e.g. Scan" value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Route</label>
                <Input placeholder="e.g. /scan" value={route} onChange={(e) => setRoute(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Icon</label>
                <Select value={iconName} onValueChange={setIconName}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <SelectedIcon className="h-4 w-4" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((o) => {
                      const I = o.icon;
                      return (
                        <SelectItem key={o.name} value={o.name}>
                          <div className="flex items-center gap-2">
                            <I className="h-4 w-4" /> {o.name}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Color</label>
                <div className="grid grid-cols-2 gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setColorClass(c.value)}
                      className={`flex items-center gap-2 rounded-xl border-2 p-3 transition-all active:scale-95 ${
                        colorClass === c.value ? "border-primary" : "border-border"
                      }`}
                    >
                      <div className={`h-6 w-6 rounded-lg ${c.value.split(" ")[0]}`} />
                      <span className="text-sm font-medium">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!label.trim() || !route.trim() || saveMutation.isPending}
                className="active:scale-95 transition-transform"
              >
                {saveMutation.isPending ? "Saving…" : editingId ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
