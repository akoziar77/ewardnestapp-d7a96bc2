import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

  useEffect(() => {
    if (!user) {
      setEntries([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("page_access")
        .select("page_key, role_name, allowed");

      if (!cancelled) {
        setEntries(error ? [] : (data ?? []));
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user]);

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
