import { Navigate } from "react-router-dom";
import { useRoles } from "@/hooks/useRoles";
import { usePageAccessContext } from "@/contexts/PageAccessContext";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReactNode } from "react";

/**
 * Wraps a route element and checks the page_access table
 * to see if the current user's role is allowed on this page.
 */
export function PageGate({ pageKey, children }: { pageKey: string; children: ReactNode }) {
  const { roles, loading: rolesLoading } = useRoles();
  const { canAccess, loading: accessLoading } = usePageAccessContext();

  if (rolesLoading || accessLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Skeleton className="h-12 w-48 rounded-lg" />
      </div>
    );
  }

  if (!canAccess(pageKey, roles)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
