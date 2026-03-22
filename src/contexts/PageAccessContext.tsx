import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PageAccessEntry {
  page_key: string;
  role_name: string;
  allowed: boolean;
}

interface PageAccessContextType {
  /** Check if any of the given roles can access this page_key */
  canAccess: (pageKey: string, roles: string[]) => boolean;
  loading: boolean;
}

const PageAccessContext = createContext<PageAccessContextType>({
  canAccess: () => true,
  loading: true,
});

export function usePageAccessContext() {
  return useContext(PageAccessContext);
}

export function PageAccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<PageAccessEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("page_access")
      .select("page_key, role_name, allowed");
    setEntries(error ? [] : (data ?? []));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      setLoading(false);
      return;
    }

    load();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("page_access_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "page_access" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  function canAccess(pageKey: string, roles: string[]): boolean {
    // Admin always has access
    if (roles.includes("admin")) return true;

    // If no entries loaded yet or page not configured, default allow
    const pageEntries = entries.filter((e) => e.page_key === pageKey);
    if (pageEntries.length === 0) return true;

    // Users with no roles are treated as "user"
    const effectiveRoles = roles.length > 0 ? roles : ["user"];

    return pageEntries.some((e) => effectiveRoles.includes(e.role_name) && e.allowed);
  }

  return (
    <PageAccessContext.Provider value={{ canAccess, loading }}>
      {children}
    </PageAccessContext.Provider>
  );
}
