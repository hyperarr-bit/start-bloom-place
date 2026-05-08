import { useAuth } from "@/hooks/use-auth";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Allow unauthenticated visitors (guest mode). Used for the onboarding flow. */
  allowGuest?: boolean;
}

export const ProtectedRoute = ({ children, allowGuest = false }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-background" aria-hidden="true" />;
  }

  if (!user && !allowGuest) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};
