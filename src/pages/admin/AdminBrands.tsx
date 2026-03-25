import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Brand {
  id: string;
  name: string;
  logo_emoji: string;
  category: string | null;
  show_in_onboarding: boolean;
  created_at: string;
}

const EMPTY: Omit<Brand, "id" | "created_at"> = {
  name: "",
  logo_emoji: "🏪",
  category: "",
  show_in_onboarding: false,
};

export default function AdminBrands() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<(Partial<Brand> & { id?: string }) | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleting, setDeleting] = useState<Brand | null>(null);

  const { data: brands, isLoading } = useQuery({
    queryKey: ["admin-brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, logo_emoji, category, show_in_onboarding, created_at")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (brand: Partial<Brand> & { id?: string }) => {
      if (brand.id) {
        const { error } = await supabase
          .from("brands")
          .update({ name: brand.name, logo_emoji: brand.logo_emoji, category: brand.category })
          .eq("id", brand.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("brands")
          .insert({ name: brand.name!, logo_emoji: brand.logo_emoji!, category: brand.category || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      toast({ title: isNew ? "Brand created" : "Brand updated" });
      setEditing(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("brands").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      toast({ title: "Brand deleted" });
      setDeleting(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openNew = () => {
    setIsNew(true);
    setEditing({ ...EMPTY });
  };

  const openEdit = (b: Brand) => {
    setIsNew(false);
    setEditing({ ...b });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage partner brands in your loyalty network.</p>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Add Brand
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {brands?.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <span className="text-2xl">{b.logo_emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{b.name}</p>
                  {b.category && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {b.category}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(b)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {brands?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">No brands yet. Add your first brand above.</p>
          )}
        </div>
      )}

      {/* Edit / Create dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isNew ? "Add Brand" : "Edit Brand"}</DialogTitle>
            <DialogDescription>Set the brand name, emoji, and category.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Brew & Bean" />
              </div>
              <div>
                <label className="text-sm font-medium">Emoji</label>
                <Input value={editing.logo_emoji ?? ""} onChange={(e) => setEditing({ ...editing, logo_emoji: e.target.value })} placeholder="🏪" className="max-w-24" />
              </div>
              <div>
                <label className="text-sm font-medium">Category</label>
                <Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="e.g. Coffee, Dining" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              disabled={!editing?.name || upsert.isPending}
              onClick={() => {
                if (!editing) return;
                upsert.mutate(editing);
              }}
            >
              {upsert.isPending ? "Saving…" : isNew ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete brand?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.name}" will be permanently removed.
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
