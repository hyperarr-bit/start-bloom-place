import { useAuth } from "@/hooks/use-auth";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * Where to send unauthenticated visitors. Module routes pass `allowGuest`
   * so cold visitors land on the landing page (offer + open demo); login-only
   * routes (e.g. /planos) omit it and go straight to /auth.
   *
   * Paid model: there is no guest access to real modules anymore — the open
   * demo (/preview/:moduleKey) is the "try before you pay" surface.
   */
  allowGuest?: boolean;
}

export const ProtectedRoute = ({ children, allowGuest = false }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-background" aria-hidden="true" />;
  }

  if (!user) {
    return <Navigate to={allowGuest ? "/lp" : "/auth"} replace />;
  }

  return <>{children}</>;
};
