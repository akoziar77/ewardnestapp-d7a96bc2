import { Navigate, useLocation } from "react-router-dom";
import { useRoles } from "@/hooks/useRoles";
import { usePageAccessContext } from "@/contexts/PageAccessContext";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Wraps a route element and checks the page_access table dynamically.
 * Shows a destructive toast and redirects when access is revoked — even mid-session.
 */
export function PageGate({ pageKey, children }: { pageKey: string; children: ReactNode }) {
  const { roles, loading: rolesLoading } = useRoles();
  const { canAccess, loading: accessLoading } = usePageAccessContext();
  const { toast } = useToast();
  const location = useLocation();

  const isLoading = rolesLoading || accessLoading;
  const allowed = isLoading ? true : canAccess(pageKey, roles);

  // Track whether we already showed the toast for this page visit
  const toastShown = useRef(false);
  const [kicked, setKicked] = useState(false);

  // Reset on route change
  useEffect(() => {
    toastShown.current = false;
    setKicked(false);
  }, [location.pathname]);

  // React to access being revoked (including realtime updates)
  useEffect(() => {
    if (!isLoading && !allowed && !toastShown.current) {
      toastShown.current = true;
      toast({
        title: "Access Denied",
        description: "You don't have permission to view that page.",
        variant: "destructive",
      });
      setKicked(true);
    }
  }, [isLoading, allowed, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Skeleton className="h-12 w-48 rounded-lg" />
      </div>
    );
  }

  if (!allowed || kicked) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
