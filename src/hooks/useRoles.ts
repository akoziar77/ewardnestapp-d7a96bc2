import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoles } from "@/lib/roles";

export function useRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    if (!user) {
      setRoles([]);
      setResolvedUserId(null);
      return;
    }

    setResolvedUserId(null);

    getMyRoles(supabase, user.id).then((r) => {
      if (!alive) return;
      setRoles(r);
      setResolvedUserId(user.id);
    });

    return () => {
      alive = false;
    };
  }, [user?.id]);

  const loading = !!user && resolvedUserId !== user.id;
  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager");

  return { roles, isAdmin, isManager, loading };
}
