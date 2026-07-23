import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { APP_PRECOS } from "@/lib/native-shell";
import { initRevenueCat, estadoRevenueCat, comprar, restaurar } from "@/lib/revenuecat";

/**
 * A "ABA DE COMPRAR" DO APP (decisão do dono 23/07, lógica BitePal): o
 * OfferScreen personalizado vende; este bottom sheet só transaciona.
 * Sobe por cima do paywall quando o CTA é tocado — anual em destaque com
 * trial, mensal âncora apagada, preço TOTAL sempre visível (compliance
 * Play — Cal AI foi removido por esconder isso), renovação explícita e
 * Restaurar compras. Motor: RevenueCat (mesmo do SubscriptionPaywall).
 */
export function AppPurchaseSheet({ onClose }: { onClose: () => void }) {
  const [plano, setPlano] = useState<"anual" | "mensal">("anual");
  const [rc, setRc] = useState(estadoRevenueCat());
  const [comprando, setComprando] = useState(false);
  const [ok, setOk] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    trackEvent("app_sheet_view", {});
    initRevenueCat().then(setRc);
  }, []);

  const assinar = async () => {
    if (rc !== "pronto" || comprando) return;
    setComprando(true);
    trackEvent("app_sheet_cta", { plano });
    const ativou = await comprar(APP_PRECOS[plano].id);
    setComprando(false);
    if (ativou) {
      trackEvent("app_sheet_success", { plano });
      setOk(true);
      setTimeout(() => { window.location.href = "/"; }, 1600);
    }
  };

  const tentarRestaurar = async () => {
    trackEvent("app_sheet_restore", {});
    const r = await restaurar();
    if (r) { window.location.href = "/"; return; }
    setMsg("Nenhuma assinatura encontrada nesta conta Google.");
  };

  return (
    <div className="fixed inset-0 z-[90]">
      <motion.button
        aria-label="Fechar"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/45"
        onClick={() => { trackEvent("app_sheet_close", {}); onClose(); }}
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-5 pt-3 text-foreground"
        style={{ paddingBottom: "max(1.1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto w-10 h-1.5 rounded-full bg-muted mb-4" aria-hidden />

        {ok ? (
          <div className="py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 grid place-items-center mx-auto mb-3">
              <Check className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold">Assinatura ativa! 🎉</h2>
            <p className="text-sm text-muted-foreground mt-1">Abrindo seu CORE…</p>
          </div>
        ) : (
          <>
            <h2 className="text-[20px] font-bold tracking-tight text-center">Comece com 3 dias grátis</h2>
            <p className="text-[12.5px] text-muted-foreground text-center mt-1 mb-4">
              Acesso total agora · cancele quando quiser, direto na Play Store
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => { setPlano("anual"); trackEvent("app_sheet_plan", { plano: "anual" }); }}
                className={`w-full text-left rounded-2xl border-2 p-3.5 relative transition-colors ${plano === "anual" ? "border-accent bg-accent/5" : "border-border bg-card"}`}
              >
                <span className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold tracking-wide">
                  3 DIAS GRÁTIS
                </span>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[15px]">Anual</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{APP_PRECOS.anual.porMes}/mês</div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-lg">{APP_PRECOS.anual.preco}<span className="text-xs font-semibold text-muted-foreground">/ano</span></div>
                    <div className="text-[11px] text-emerald-600 font-bold">67% OFF</div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => { setPlano("mensal"); trackEvent("app_sheet_plan", { plano: "mensal" }); }}
                className={`w-full text-left rounded-2xl border-2 p-3.5 transition-colors ${plano === "mensal" ? "border-accent bg-accent/5" : "border-border bg-card opacity-75"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-[15px]">Mensal</div>
                  <div className="font-bold">{APP_PRECOS.mensal.preco}<span className="text-xs font-semibold text-muted-foreground">/mês</span></div>
                </div>
              </button>
            </div>

            <div className="rounded-xl bg-secondary/60 px-3 py-2.5 mt-3">
              <p className="text-[12px] leading-snug">
                “Adorei demais o aplicativo!! Estou usando há 1 dia e já está me ajudando bastante.”
              </p>
              <p className="text-[10.5px] text-muted-foreground mt-1">★★★★★ — @requeijohn · Instagram</p>
            </div>

            <button
              onClick={assinar}
              disabled={rc !== "pronto" || comprando}
              className="w-full h-14 mt-4 rounded-full bg-foreground text-background font-bold text-base disabled:opacity-50"
            >
              {comprando
                ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                : plano === "anual" ? "Começar 3 dias grátis" : "Assinar mensal"}
            </button>

            {rc !== "pronto" && (
              <p className="text-[11px] text-muted-foreground text-center mt-2">
                As compras estarão disponíveis em breve nesta versão.
              </p>
            )}
            <p className="text-[10.5px] text-muted-foreground text-center mt-2 leading-relaxed">
              {plano === "anual"
                ? <>Após 3 dias grátis, <b className="text-foreground">{APP_PRECOS.anual.preco}/ano</b>. Renova automaticamente; cancele antes e não paga nada.</>
                : <>Cobrança de <b className="text-foreground">{APP_PRECOS.mensal.preco}</b> por mês, renovação automática.</>}
            </p>
            <button onClick={tentarRestaurar} className="block mx-auto mt-2 text-[11.5px] font-semibold text-muted-foreground">
              Restaurar compras
            </button>
            {msg && <p className="text-[11px] text-muted-foreground text-center mt-1">{msg}</p>}
          </>
        )}
      </motion.div>
    </div>
  );
}
