import { useAuth } from "@/hooks/use-auth";
import { Navigate } from "react-router-dom";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    // Empty background placeholder — no spinner. Auth resolves in <300 ms in practice,
    // and showing a spinner that disappears abruptly creates a visible "flash" before
    // the WelcomeScreen mounts. The page background (set inline in index.html) is
    // already painted, so this is invisible to the user.
    return <div className="min-h-screen bg-background" aria-hidden="true" />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};
