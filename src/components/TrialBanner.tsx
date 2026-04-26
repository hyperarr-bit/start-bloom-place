import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Lock, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

export const TrialBanner = () => {
  const { user, trialExpired, isSubscribed, trialDay, trialHoursLeft } = useAuth();
  const navigate = useNavigate();
  const phase = trialExpired
    ? "expired"
    : trialDay <= 3
    ? "discovery"
    : trialDay <= 5
    ? "engagement"
    : "conversion";
  const viewedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user || isSubscribed) return;
    const key = `${phase}-${trialDay}`;
    if (viewedRef.current === key) return;
    viewedRef.current = key;
    trackEvent(
      trialExpired ? "paywall_view" : "trial_banner_view",
      { phase, trial_day: trialDay },
      { trialDay },
    );
  }, [user, isSubscribed, phase, trialDay, trialExpired]);

  const goToPlanos = (cta: string) => {
    trackEvent("trial_banner_click", { phase, trial_day: trialDay, cta }, { trialDay });
    navigate("/planos");
  };

  if (isSubscribed || !user) return null;

  // Trial expired — blocking screen
  if (trialExpired) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed inset-0 z-50 bg-background flex items-center justify-center px-4"
      >
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold">Seu trial de 7 dias terminou</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Você usou o CORE por uma semana inteira. Continue organizando sua vida
            com acesso completo a todos os módulos.
          </p>
          <div className="space-y-3">
            <Button className="w-full" onClick={() => goToPlanos("expired")}>
              Ver planos a partir de R$14,90/mês
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  const daysLeft = Math.max(0, Math.ceil(trialHoursLeft / 24));

  // Phase 1 — Discovery (D1-D3): discreet info
  if (trialDay <= 3) {
    return (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        className="bg-primary/5 border-b border-primary/20"
      >
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>
              Trial grátis · Dia <strong>{trialDay}</strong> de 7
            </span>
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => goToPlanos("discovery")}>
            Assinar agora
          </Button>
        </div>
      </motion.div>
    );
  }

  // Phase 2 — Engagement (D4-D5): gentle nudge
  if (trialDay <= 5) {
    return (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        className="bg-primary/10 border-b border-primary/30"
      >
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span>
              Faltam <strong>{daysLeft} {daysLeft === 1 ? "dia" : "dias"}</strong> do seu teste grátis
            </span>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => goToPlanos("engagement")}>
            Garantir acesso
          </Button>
        </div>
      </motion.div>
    );
  }

  // Phase 3 — Conversion (D6-D7): urgent sticky banner
  const isLastDay = trialDay >= 7;
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      className={
        isLastDay
          ? "bg-destructive/10 border-b-2 border-destructive/40 sticky top-0 z-40"
          : "bg-primary/15 border-b-2 border-primary/40 sticky top-0 z-40"
      }
    >
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <Clock className={`w-3.5 h-3.5 ${isLastDay ? "text-destructive" : "text-primary"}`} />
          <span>
            {isLastDay ? (
              <><strong>Último dia!</strong> Seu trial termina em poucas horas.</>
            ) : (
              <>Resta <strong>{daysLeft} {daysLeft === 1 ? "dia" : "dias"}</strong> · Garanta seu acesso antes que expire.</>
            )}
          </span>
        </div>
        <Button size="sm" className="h-7 text-xs" onClick={() => goToPlanos("conversion")}>
          Assinar
        </Button>
      </div>
    </motion.div>
  );
};
