/**
 * SAVE-OFFER DE DOWNGRADE (22/08, aprovada pelo dono no dia da 1ª cobrança).
 *
 * O caso que a criou: raquel — usou o app até o fim (missão completa, 5
 * voltas na véspera) e cancelou o trial ANUAL 4h antes do débito de
 * R$ 159,90. Churn de PREÇO/estrutura, não de produto. Hoje esse
 * cancelamento morre em silêncio; esta tela é a única chance de trocar
 * "R$ 159,90 de uma vez" por "R$ 24,90/mês" enquanto o acesso ainda vive.
 *
 * Gatilho 100% no cliente (sem push, sem servidor): o RevenueCat sabe que o
 * trial não vai renovar (periodType TRIAL + willRenew false). Na abertura
 * seguinte do app, uma vez só por pessoa.
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { isNativeShell, APP_PRECOS } from "@/lib/native-shell";
import { useAuth } from "@/hooks/use-auth";
import { trialCartaoAtivo } from "@/lib/teste-gratis";

const CHAVE_VISTO = "core-save-offer-visto"; // nas 2 allowlists (regra eterna)

export function SaveOfferDowngrade() {
  const { user, isSubscribed, billingPeriod } = useAuth();
  const [mostrar, setMostrar] = useState(false);
  const [comprando, setComprando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const checou = useRef(false);

  const elegivel =
    isNativeShell() && !!user && isSubscribed && trialCartaoAtivo() && billingPeriod === "annual";

  useEffect(() => {
    if (!elegivel || checou.current) return;
    checou.current = true;
    try { if (localStorage.getItem(CHAVE_VISTO)) return; } catch { /* noop */ }
    void (async () => {
      const rc = await import("@/lib/revenuecat");
      if (await rc.estadoTrialCancelado()) {
        trackEvent("save_offer_view", { de: "anual", para: "mensal" });
        setMostrar(true);
      }
    })();
  }, [elegivel]);

  if (!mostrar) return null;

  const fechar = (acao: "recusou" | "aceitou") => {
    // marca de vista no DESFECHO, não na exibição (revisão 22/08): app morto
    // no meio da tela = a pessoa vê de novo na próxima abertura, em vez de
    // queimar a única chance sem ninguém ter lido.
    try { localStorage.setItem(CHAVE_VISTO, String(Date.now())); } catch { /* noop */ }
    trackEvent(acao === "aceitou" ? "save_offer_aceito" : "save_offer_recusado", {});
    setMostrar(false);
  };

  return (
    <div className="fixed inset-0 z-[250] overflow-y-auto" style={{ background: "linear-gradient(180deg,#f6f1fb 0%,#ffffff 55%)" }}>
      <div className="min-h-full max-w-[400px] mx-auto flex flex-col px-6 py-10">
        <motion.h1
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="text-[26px] font-black tracking-[-0.03em] leading-[1.12] text-center text-[#16121c] mt-6"
        >
          Fica com o CORE
          <br />do teu jeito.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="text-[13.5px] text-[#4f5a64] text-center mt-3"
        >
          O anual não fez sentido agora? Sem problema — seus hábitos, registros e
          lembretes continuam exatamente onde estão no plano mensal.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 24 }}
          className="rounded-3xl bg-white border-2 border-accent p-5 mt-7 shadow-[0_24px_48px_-18px_rgba(20,60,110,.30)]"
        >
          <div className="flex items-baseline justify-between">
            <span className="text-[16px] font-extrabold">Mensal</span>
            <span className="text-[22px] font-extrabold">{APP_PRECOS.mensal.preco}<small className="text-[12px] font-bold text-muted-foreground">/mês</small></span>
          </div>
          <p className="text-[12px] font-semibold text-[#4f5a64] mt-1">
            em vez de {APP_PRECOS.anual.preco} de uma vez · muda em 1 toque
          </p>
        </motion.div>

        {erro && <p className="text-[12.5px] text-destructive text-center mt-3">{erro}</p>}

        <div className="mt-auto pt-8">
          <motion.button
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
            disabled={comprando}
            onClick={async () => {
              if (comprando) return;
              setComprando(true);
              setErro(null);
              const rc = await import("@/lib/revenuecat");
              const ok = await rc.comprar(APP_PRECOS.mensal.id, { semTrial: true });
              setComprando(false);
              if (ok) { fechar("aceitou"); window.location.href = "/"; return; }
              if (rc.motivoUltimaCompra() !== "cancelou") setErro("Não deu certo agora — tenta de novo em instantes.");
            }}
            className="w-full min-h-[54px] rounded-full text-[16px] font-extrabold text-white bg-[#16121c] shadow-[0_18px_38px_-10px_rgba(22,18,28,.5)] active:scale-[0.985] transition-transform grid place-items-center"
          >
            {comprando
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <span className="flex items-center gap-1.5">Mudar pro mensal — {APP_PRECOS.mensal.preco}/mês <ArrowRight className="w-4 h-4" /></span>}
          </motion.button>
          <button
            onClick={() => fechar("recusou")}
            className="w-full text-center text-[12.5px] text-[#4f5a64] mt-3 py-1"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
