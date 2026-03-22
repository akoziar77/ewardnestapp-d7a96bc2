import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface PolicyRow {
  id: string;
  content_markdown: string;
  version: string;
  published_at: string;
}

export default function ConsentBanner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showPolicy, setShowPolicy] = useState(false);

  // Fetch the latest policy
  const { data: latestPolicy } = useQuery({
    queryKey: ["latest-policy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("privacy_policies" as any)
        .select("*")
        .order("published_at", { ascending: false })
        .limit(1)
        .single();
      if (error) {
        if (error.code === "PGRST116") return null; // no rows
        throw error;
      }
      return data as unknown as PolicyRow;
    },
    enabled: !!user,
  });

  // Check if the user already consented to the latest version
  const { data: hasConsented, isLoading } = useQuery({
    queryKey: ["user-consent", user?.id, latestPolicy?.version],
    queryFn: async () => {
      if (!latestPolicy) return true; // no policy = no consent needed
      const { data, error } = await supabase
        .from("user_consents" as any)
        .select("id")
        .eq("user_id", user!.id)
        .eq("policy_version", latestPolicy.version)
        .eq("accepted", true)
        .limit(1);
      if (error) throw error;
      return (data as any[]).length > 0;
    },
    enabled: !!user && !!latestPolicy,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("user_consents" as any)
        .insert({
          user_id: user!.id,
          policy_version: latestPolicy!.version,
          accepted: true,
          metadata: { user_agent: navigator.userAgent },
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-consent"] });
    },
  });

  if (!user || isLoading || hasConsented || !latestPolicy) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-16 z-50 px-4 pb-2 animate-in slide-in-from-bottom-4 fade-in duration-500">
        <div className="mx-auto max-w-md rounded-2xl border bg-card p-4 shadow-xl shadow-black/5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Updated Privacy Policy</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                We've updated our privacy policy (v{latestPolicy.version}). Please review and accept to continue.
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 active:scale-95 transition-transform"
              onClick={() => setShowPolicy(true)}
            >
              Read policy
            </Button>
            <Button
              size="sm"
              className="flex-1 active:scale-95 transition-transform"
              disabled={acceptMutation.isPending}
              onClick={() => acceptMutation.mutate()}
            >
              {acceptMutation.isPending ? "Accepting…" : "Accept"}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showPolicy} onOpenChange={setShowPolicy}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Privacy Policy v{latestPolicy.version}</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
            {latestPolicy.content_markdown}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPolicy(false)}>
              Close
            </Button>
            <Button
              disabled={acceptMutation.isPending}
              onClick={() => {
                acceptMutation.mutate();
                setShowPolicy(false);
              }}
              className="active:scale-95 transition-transform"
            >
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
