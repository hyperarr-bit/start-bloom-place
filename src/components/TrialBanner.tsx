import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

/**
 * Paywall do modelo pago: qualquer usuário logado SEM assinatura ativa é
 * bloqueado (tela cheia) até assinar. Quem está no período de graça aparece
 * como `isSubscribed: true` no check-subscription, então não cai aqui — vê o
 * GracePeriodBanner. A demo aberta (/preview) e a LP (/lp) são as superfícies
 * de "testar antes de pagar"; o gate de rotas (ProtectedRoute) impede acesso
 * de visitante não logado aos módulos reais.
 */
export const TrialBanner = () => {
  const { user, isSubscribed, subscriptionChecked, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Superfícies sempre abertas (marketing/demo/login) — não recebem paywall,
  // mesmo para um logado sem assinatura (pra ele poder rever a oferta e a demo).
  const suppressOnRoute =
    location.pathname === "/" ||
    location.pathname.startsWith("/lp") ||
    location.pathname.startsWith("/preview") ||
    location.pathname.startsWith("/demo") ||
    location.pathname.startsWith("/planos") ||
    location.pathname.startsWith("/auth") ||
    location.pathname.startsWith("/reset-password") ||
    location.pathname.startsWith("/update-password") ||
    location.pathname.startsWith("/admin");

  // Só bloqueia quando JÁ sabemos que não é assinante (evita flash de paywall
  // em assinantes enquanto o check-subscription ainda está resolvendo, e falha
  // aberto se o backend der erro).
  const blocked = !!user && subscriptionChecked && !isSubscribed && !suppressOnRoute;

  const viewedRef = useRef(false);
  useEffect(() => {
    if (!blocked) { viewedRef.current = false; return; }
    if (viewedRef.current) return;
    viewedRef.current = true;
    trackEvent("paywall_view", { phase: "paid" });
  }, [blocked]);

  if (!blocked) return null;

  const goToPlanos = () => {
    trackEvent("trial_banner_click", { phase: "paid", cta: "subscribe" });
    navigate("/planos");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 z-50 bg-background flex items-center justify-center px-4"
    >
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Assine para acessar o CORE</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Crie sua assinatura e libere os 16 módulos. Garantia de 7 dias — se não
            for pra você, devolvemos o valor. Cancele quando quiser.
          </p>
        </div>
        <Button className="w-full h-12 text-base font-semibold" onClick={goToPlanos}>
          Ver planos
        </Button>
        <button
          onClick={() => signOut()}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Sair da conta
        </button>
      </div>
    </motion.div>
  );
};
