import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Crown, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { toast } from "sonner";

const FULL_MONTHLY = 19.90;
const FULL_ANNUAL = 238.80; // 12 × 19,90 — preço cheio percebido
const OFFER_ANNUAL = 47.76; // 80% off
const OFFER_MONTHLY_EQUIV = 3.98;
const SAVINGS = 191.04;

const COUNTDOWN_SECONDS = 10 * 60;

interface Props {
  attemptId: string | null;
  onDismiss?: () => void;
}

export function WinbackOffer({ attemptId, onDismiss }: Props) {
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (attemptId) {
      supabase
        .from("winback_attempts")
        .update({ offer_shown_at: new Date().toISOString() })
        .eq("id", attemptId)
        .then(() => {});
      trackEvent("winback_offer_shown", { discount_pct: 80 });
    }
  }, [attemptId]);

  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const accept = async () => {
    setLoading(true);
    trackEvent("winback_offer_accepted", { discount_pct: 80 });
    if (attemptId) {
      await supabase
        .from("winback_attempts")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", attemptId);
    }
    try {
      const { data, error } = await supabase.functions.invoke("abacatepay-checkout", {
        body: { billing: "annual", coupon: "WINBACK80" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao iniciar checkout");
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <div className="text-center space-y-2">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold tracking-wide"
        >
          <Crown className="w-3 h-3" /> VOCÊ GANHOU 80% OFF
        </motion.div>
        <h2 className="text-2xl font-bold leading-tight">
          Sua oferta exclusiva<br />no plano <span className="text-primary">Anual</span>
        </h2>
      </div>

      {/* Pricing card */}
      <div className="rounded-2xl border-2 border-primary bg-gradient-to-br from-primary/5 via-card to-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">CORE PRO Anual</p>
            <div className="mt-1 space-y-0.5">
              <p className="text-xs text-muted-foreground line-through">
                De R$ {FULL_MONTHLY.toFixed(2).replace(".", ",")}/mês
                {" · "}R$ {FULL_ANNUAL.toFixed(2).replace(".", ",")}/ano
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-primary">
                  R$ {OFFER_MONTHLY_EQUIV.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-muted-foreground text-sm">/mês</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Cobrado R$ {OFFER_ANNUAL.toFixed(2).replace(".", ",")}/ano à vista
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-lg font-bold">
              -80%
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">só agora</p>
          </div>
        </div>

        <div className="rounded-lg bg-primary/10 px-3 py-2 text-center">
          <p className="text-xs font-semibold text-primary">
            Você economiza R$ {SAVINGS.toFixed(2).replace(".", ",")} no primeiro ano
          </p>
        </div>

        <ul className="space-y-2">
          {[
            "Todos os 16 módulos desbloqueados",
            "Acesso por 12 meses",
            "Sem fidelidade — cancele quando quiser",
            "Pix ou Cartão na próxima tela",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-primary shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Timer className="w-3.5 h-3.5" />
        Oferta expira em <span className="font-mono font-bold text-foreground">{mm}:{ss}</span>
      </div>

      <Button
        size="lg"
        onClick={accept}
        disabled={loading || secondsLeft === 0}
        className="w-full h-14 text-base font-bold"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Redirecionando...</>
        ) : (
          "GARANTIR 80% OFF AGORA"
        )}
      </Button>

      <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
        Renovação anual no preço cheio (R$ {FULL_ANNUAL.toFixed(2).replace(".", ",")}/ano).
        Cancele a qualquer momento dentro do app.
      </p>
    </motion.div>
  );
}
