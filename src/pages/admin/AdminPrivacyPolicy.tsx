import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, FileText, Eye, Pencil, Trash2, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

interface PolicyRow {
  id: string;
  content_markdown: string;
  version: string;
  published_at: string;
  updated_by: string | null;
  created_at: string;
}

export default function AdminPrivacyPolicy() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [version, setVersion] = useState("");
  const [content, setContent] = useState("");
  const [previewContent, setPreviewContent] = useState("");

  const { data: policies, isLoading } = useQuery({
    queryKey: ["privacy-policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("privacy_policies" as any)
        .select("*")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data as unknown as PolicyRow[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase
          .from("privacy_policies" as any)
          .update({
            content_markdown: content,
            version,
            updated_by: user?.id,
          } as any)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("privacy_policies" as any)
          .insert({
            content_markdown: content,
            version,
            updated_by: user?.id,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["privacy-policies"] });
      toast({ title: editingId ? "Policy updated" : "Policy published" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("privacy_policies" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["privacy-policies"] });
      toast({ title: "Policy deleted" });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setVersion("");
    setContent("");
  };

  const openEdit = (p: PolicyRow) => {
    setEditingId(p.id);
    setVersion(p.version);
    setContent(p.content_markdown);
    setDialogOpen(true);
  };

  const latestVersion = policies?.[0]?.version;

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-muted transition-colors active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Privacy Policies</h1>
            <p className="text-sm text-muted-foreground">Manage versions and view consent</p>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5 active:scale-95 transition-transform">
            <Plus className="h-4 w-4" /> New version
          </Button>
        </div>

        {/* Policies list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : !policies?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold">No policies yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first privacy policy version</p>
          </div>
        ) : (
          <div className="space-y-3">
            {policies.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">v{p.version}</span>
                      {p.version === latestVersion && (
                        <Badge variant="default" className="text-[10px] h-5 gap-1">
                          <Check className="h-3 w-3" /> Current
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Published {new Date(p.published_at).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {p.content_markdown.slice(0, 80)}…
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setPreviewContent(p.content_markdown);
                        setPreviewOpen(true);
                      }}
                      className="p-2 rounded-lg hover:bg-muted transition-colors active:scale-95"
                    >
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors active:scale-95"
                    >
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
                          <AlertDialogTitle>Delete policy v{p.version}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This cannot be undone. Users who consented to this version will keep their consent records.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(p.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Editor dialog */}
        <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit policy" : "New policy version"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Version</label>
                <Input
                  placeholder="e.g. 1.0, 2.1"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Content (Markdown)</label>
                <Textarea
                  placeholder="Write your privacy policy in Markdown…"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!version.trim() || !content.trim() || saveMutation.isPending}
                className="active:scale-95 transition-transform"
              >
                {saveMutation.isPending ? "Saving…" : editingId ? "Update" : "Publish"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Policy Preview</DialogTitle>
            </DialogHeader>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
              {previewContent}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
