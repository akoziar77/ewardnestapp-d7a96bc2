import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoles } from "@/lib/roles";

export function useRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getMyRoles(supabase).then((r) => {
      setRoles(r);
      setLoading(false);
    });
  }, [user]);

  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager");

  return { roles, isAdmin, isManager, loading };
}
