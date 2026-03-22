import { Navigate, Outlet, useLocation } from "react-router-dom";

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
  if (!signedIn) return <Navigate to="/auth" state={{ from: loc }} replace />;
  if (roles.includes("admin")) return <Outlet />;
  if (required && !required.some((r) => roles.includes(r)))
    return <Navigate to="/" replace />;
  return <Outlet />;
}
