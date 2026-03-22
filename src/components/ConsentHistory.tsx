import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, FileText } from "lucide-react";

interface ConsentRow {
  id: string;
  policy_version: string;
  accepted: boolean;
  accepted_at: string;
}

export default function ConsentHistory() {
  const { user } = useAuth();

  const { data: consents, isLoading } = useQuery({
    queryKey: ["consent-history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_consents" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("accepted_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ConsentRow[];
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!consents?.length) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No consent records yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {consents.map((c) => (
        <div
          key={c.id}
          className="flex items-center gap-3 rounded-xl border bg-card p-3"
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              c.accepted ? "bg-primary/10" : "bg-destructive/10"
            }`}
          >
            {c.accepted ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <X className="h-4 w-4 text-destructive" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Policy v{c.policy_version}</p>
            <p className="text-xs text-muted-foreground">
              {c.accepted ? "Accepted" : "Declined"} on{" "}
              {new Date(c.accepted_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
