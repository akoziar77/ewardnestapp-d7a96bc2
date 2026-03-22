import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PageAccessRow {
  id: string;
  page_key: string;
  page_label: string;
  role_name: string;
  allowed: boolean;
}

export function usePageAccess() {
  return useQuery<PageAccessRow[]>({
    queryKey: ["page_access"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("page_access")
        .select("*")
        .order("page_label");
      if (error) throw error;
      return (data ?? []) as PageAccessRow[];
    },
  });
}

export function useTogglePageAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, allowed }: { id: string; allowed: boolean }) => {
      const { error } = await supabase
        .from("page_access")
        .update({ allowed })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["page_access"] }),
  });
}
