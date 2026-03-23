import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute({
  signedIn,
  roles,
  required,
}: {
  signedIn: boolean;
  roles: string[];
  required?: string[];
}) {
  const loc = useLocation();
  const { loading } = useAuth();

  // Wait for auth to resolve before making access decisions
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!signedIn) return <Navigate to="/auth" state={{ from: loc }} replace />;
  // Admin always passes
  if (roles.includes("admin")) return <Outlet />;
  // Users with no roles assigned yet are treated as "user" level
  const effectiveRoles = roles.length > 0 ? roles : ["user"];
  if (required && !required.some((r) => effectiveRoles.includes(r)))
    return <Navigate to="/" replace />;
  return <Outlet />;
}
