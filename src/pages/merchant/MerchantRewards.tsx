import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, X, Gift } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Ctx = { merchantId: string };

interface RewardForm {
  title: string;
  description: string;
  points_cost: string;
  inventory: string;
}

const emptyForm: RewardForm = { title: "", description: "", points_cost: "", inventory: "" };

export default function MerchantRewards() {
  const { merchantId } = useOutletContext<Ctx>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RewardForm>(emptyForm);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: rewards, isLoading } = useQuery({
    queryKey: ["merchant-rewards", merchantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("rewards")
        .select("*")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!merchantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        merchant_id: merchantId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        points_cost: parseInt(form.points_cost) || 0,
        inventory: form.inventory ? parseInt(form.inventory) : null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("rewards")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rewards").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-rewards"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast({ title: editingId ? "Reward updated" : "Reward created" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("rewards").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["merchant-rewards"] }),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (reward: any) => {
    setEditingId(reward.id);
    setForm({
      title: reward.title,
      description: reward.description ?? "",
      points_cost: reward.points_cost.toString(),
      inventory: reward.inventory?.toString() ?? "",
    });
    setDialogOpen(true);
  };

  return (
    <div className="px-6 py-8 md:px-10 md:py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rewards</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage your reward catalog</p>
        </div>
        <Button onClick={openCreate} className="active:scale-[0.97]">
          <Plus className="mr-2 h-4 w-4" />
          Add reward
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : rewards?.length ? (
        <div className="space-y-3">
          {rewards.map((reward) => (
            <div
              key={reward.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                  <Gift className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{reward.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {reward.points_cost.toLocaleString()} pts
                    {reward.inventory != null && ` · ${reward.inventory} left`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Switch
                  checked={reward.active}
                  onCheckedChange={(active) =>
                    toggleMutation.mutate({ id: reward.id, active })
                  }
                />
                <button
                  onClick={() => openEdit(reward)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors active:scale-95"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Gift className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">No rewards yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first reward to start engaging customers.
          </p>
          <Button onClick={openCreate} className="mt-4 active:scale-[0.97]">
            <Plus className="mr-2 h-4 w-4" />
            Create reward
          </Button>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit reward" : "New reward"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update the reward details." : "Create a new reward for your customers."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Free coffee"
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Any regular-size drink"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Points cost</Label>
                <Input
                  type="number"
                  value={form.points_cost}
                  onChange={(e) => setForm({ ...form, points_cost: e.target.value })}
                  placeholder="500"
                  required
                  min={1}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Inventory (optional)</Label>
                <Input
                  type="number"
                  value={form.inventory}
                  onChange={(e) => setForm({ ...form, inventory: e.target.value })}
                  placeholder="Unlimited"
                  min={0}
                  className="h-11"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="flex-1 h-11 active:scale-[0.97]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="flex-1 h-11 active:scale-[0.97]"
              >
                {saveMutation.isPending ? "Saving…" : editingId ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
