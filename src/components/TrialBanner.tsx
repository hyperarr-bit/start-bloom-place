import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { useUserData } from "@/hooks/use-user-data";

export const TrialBanner = () => {
  const { user, trialExpired, isSubscribed, trialDay, trialHoursLeft } = useAuth();
  const { get, loaded } = useUserData();
  const navigate = useNavigate();
  const location = useLocation();
  const suppressOnRoute =
    location.pathname.startsWith("/planos") ||
    location.pathname.startsWith("/auth") ||
    location.pathname.startsWith("/reset-password") ||
    location.pathname.startsWith("/update-password") ||
    location.pathname.startsWith("/admin");

  const tutorialDone = loaded && get<string>("spotlight-done-financas", "") === "true";
  const viewedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user || isSubscribed) return;
    if (!trialExpired && !tutorialDone) return;
    const key = trialExpired ? "expired" : `mini-${trialDay}`;
    if (viewedRef.current === key) return;
    viewedRef.current = key;
    trackEvent(
      trialExpired ? "paywall_view" : "trial_banner_view",
      { phase: trialExpired ? "expired" : "mini", trial_day: trialDay },
      { trialDay },
    );
  }, [user, isSubscribed, trialDay, trialExpired, tutorialDone]);

  const goToPlanos = (cta: string) => {
    trackEvent("trial_banner_click", { phase: trialExpired ? "expired" : "mini", trial_day: trialDay, cta }, { trialDay });
    navigate("/planos");
  };

  if (isSubscribed || !user) return null;
  if (suppressOnRoute) return null;

  // Trial expired — blocking screen (mantido)
  if (trialExpired) {
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
            <h2 className="text-2xl font-bold">Seu trial de 7 dias terminou</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Continue de onde parou com acesso completo ao módulo de Finanças.
            </p>
          </div>
          <Button className="w-full h-12 text-base font-semibold" onClick={() => goToPlanos("expired")}>
            Ver planos
          </Button>
        </div>
      </motion.div>
    );
  }

  // Mini barrinha — só após tutorial concluído
  if (!tutorialDone) return null;

  const daysLeft = Math.max(0, Math.ceil(trialHoursLeft / 24));

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-primary/5 border-b border-primary/20"
    >
      <div className="max-w-5xl mx-auto px-3 py-1 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          Trial • <strong className="text-foreground">{daysLeft}d</strong> {daysLeft === 1 ? "restante" : "restantes"}
        </span>
        <button
          onClick={() => goToPlanos("mini")}
          className="text-[11px] font-medium text-primary hover:underline px-2 py-0.5 rounded"
        >
          Assinar
        </button>
      </div>
    </motion.div>
  );
};
