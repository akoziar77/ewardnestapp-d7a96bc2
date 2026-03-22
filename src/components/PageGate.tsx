import { Navigate } from "react-router-dom";
import { useRoles } from "@/hooks/useRoles";
import { usePageAccessContext } from "@/contexts/PageAccessContext";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Wraps a route element and checks the page_access table
 * to see if the current user's role is allowed on this page.
 * Shows a toast when access is denied.
 */
export function PageGate({ pageKey, children }: { pageKey: string; children: ReactNode }) {
  const { roles, loading: rolesLoading } = useRoles();
  const { canAccess, loading: accessLoading } = usePageAccessContext();
  const { toast } = useToast();
  const denied = useRef(false);

  const isLoading = rolesLoading || accessLoading;
  const allowed = isLoading || canAccess(pageKey, roles);

  useEffect(() => {
    if (!isLoading && !allowed && !denied.current) {
      denied.current = true;
      toast({
        title: "Access Denied",
        description: "You don't have permission to view that page.",
        variant: "destructive",
      });
    }
  }, [isLoading, allowed, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Skeleton className="h-12 w-48 rounded-lg" />
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
