import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Crown, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent, getAttributionParams } from "@/lib/analytics";
import { PixCheckout } from "@/components/paywall/PixCheckout";

// VITALÍCIO (13/07): o winback vende o mesmo prêmio do downsell — acesso
// pra sempre, pagamento único no Pix (PixCheckout in-app).
//
// ESTES DOIS NÚMEROS SEGUEM A OFERTA `downsell` DA CAKTO (linha 64: o
// PixCheckout abre com offer="downsell"). Quando o downsell virou 19,90
// (05/08), deixar 14,90 aqui faria a tela prometer 14,90 e o QR cobrar
// 19,90 — cobrar MAIS do que o anunciado. Mexeu no preço do downsell,
// mexe aqui na mesma passada.
const FULL_LIFETIME = 27.90;
const OFFER_LIFETIME = 19.90;
const SAVINGS = FULL_LIFETIME - OFFER_LIFETIME;

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
      trackEvent("winback_offer_shown", { discount_pct: 47 });
    }
  }, [attemptId]);

  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const [pixOpen, setPixOpen] = useState(false);
  const accept = async () => {
    trackEvent("winback_offer_accepted", { discount_pct: 47 });
    if (attemptId) {
      await supabase
        .from("winback_attempts")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", attemptId);
    }
    setPixOpen(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      {pixOpen && <PixCheckout offer="downsell" context="app" onClose={() => setPixOpen(false)} />}
      <div className="text-center space-y-2">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold tracking-wide"
        >
          <Crown className="w-3 h-3" /> VOCÊ GANHOU ACESSO VITALÍCIO
        </motion.div>
        <h2 className="text-2xl font-bold leading-tight">
          Pague uma vez.<br />Use o CORE <span className="text-primary">pra sempre</span>.
        </h2>
      </div>

      {/* Pricing card */}
      <div className="rounded-2xl border-2 border-primary bg-gradient-to-br from-primary/5 via-card to-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">CORE VITALÍCIO</p>
            <div className="mt-1 space-y-0.5">
              <p className="text-xs text-muted-foreground line-through">
                De R$ {FULL_LIFETIME.toFixed(2).replace(".", ",")}
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-primary">
                  R$ {OFFER_LIFETIME.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-muted-foreground text-sm">uma vez</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Pix único · sem mensalidade, nunca
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-lg font-bold">
              -47%
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">só agora</p>
          </div>
        </div>

        <div className="rounded-lg bg-primary/10 px-3 py-2 text-center">
          <p className="text-xs font-semibold text-primary">
            Você economiza R$ {SAVINGS.toFixed(2).replace(".", ",")} — e nunca mais paga nada
          </p>
        </div>

        <ul className="space-y-2">
          {[
            "Todos os 16 módulos, sem limites",
            "Acesso pra SEMPRE — pagamento único",
            "Sem mensalidade, sem renovação",
            "Pix aqui mesmo, libera na hora",
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
        {/* preço vem da constante — a string fixa ficou pra trás no degrau de
            05/08 e prometia 14,90 com o QR cobrando 19,90 (achado da auditoria
            de 12/08). Cobrar mais que o anunciado, nunca. */}
        {`GARANTIR VITALÍCIO POR R$ ${OFFER_LIFETIME.toFixed(2).replace(".", ",")}`}
      </Button>

      <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
        Pagamento único — não existe renovação. Garantia de 7 dias.
      </p>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 py-2"
        >
          Agora não, talvez depois
        </button>
      )}
    </motion.div>
  );
}
