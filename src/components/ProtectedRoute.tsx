import { useAuth } from "@/hooks/use-auth";
import { Navigate } from "react-router-dom";
import { isNativeShell } from "@/lib/native-shell";
import { estadoTeste } from "@/lib/teste-gratis";

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
    /*
     * TESTE GRÁTIS DE 3 DIAS (16/08, desenho do dono): no app da loja, quem
     * plantou a semente no funil usa o app REAL sem conta — os dados caem no
     * modo convidado do useUserData (chaves guest:*), que já migra tudo pra
     * conta no cadastro pós-compra. Uma condição aqui cobre as ~30 rotas.
     *
     * Expirou → paywall do dia 3 (o funil recebe e mostra o recap do que a
     * pessoa construiu). Nunca /auth: convidado do teste não tem conta — a
     * conta nasce DEPOIS do pagamento, como desde a v48.
     */
    if (isNativeShell()) {
      /* CERCA DA DEMO (28/08, provado por CDP): a seta ← dos módulos faz
       * navigate("/home") — na demo do funil isso caía aqui e o /auth vencia
       * a corrida contra o redirect do GuardaDemoShell (o Navigate desta
       * árvore dispara depois e atropela). Decidindo AQUI, não há corrida:
       * visitante da demo volta pra continuação do funil, nunca pro /auth. */
      try {
        if (sessionStorage.getItem("core-demo-guarda") === "1") {
          return <Navigate to="/app?step=compromissos" replace />;
        }
      } catch { /* noop */ }
      const t = estadoTeste();
      if (t.fase === "ativo") return <>{children}</>;
      if (t.fase === "expirado") return <Navigate to="/app?step=offer&d3=1" replace />;
    }
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};
