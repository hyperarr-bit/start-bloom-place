import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, X, Loader2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { APP_PRECOS } from "@/lib/native-shell";
import { initRevenueCat, estadoRevenueCat, comprar, restaurar } from "@/lib/revenuecat";
import { useUserData } from "@/hooks/use-user-data";
import { BoasVindasPago } from "@/components/onboarding/BoasVindasPago";

/**
 * Paywall de ASSINATURA do app Android (22/07) — substitui o PixCheckout
 * quando isNativeShell() (Pix in-app viola o Play Billing no BR).
 *
 * Arquitetura de preço (decidida com pesquisa Cal AI/BitePal/RevenueCat):
 * mensal 19,90 = âncora apagada; anual 97,90 com 3 dias grátis = produto
 * real (67% off vs 12× mensal). Compliance Play: preço TOTAL cobrado em
 * destaque (o Cal AI foi removido da App Store por esconder isso), renovação
 * automática explícita, botão Restaurar compras.
 */
export function SubscriptionPaywall({ onClose }: { onClose: () => void }) {
  const [plano, setPlano] = useState<"anual" | "mensal">("anual");
  const [rc, setRc] = useState(estadoRevenueCat());
  const [comprando, setComprando] = useState(false);
  const [ok, setOk] = useState(false);
  const [celebrar, setCelebrar] = useState(false);
  const { get } = useUserData();
  const nome = get<string>("core-user-name", "") || get<string>("user-name", "");

  useEffect(() => {
    trackEvent("app_paywall_view", {});
    initRevenueCat().then(setRc);
  }, []);

  const assinar = async () => {
    if (rc !== "pronto" || comprando) return;
    setComprando(true);
    trackEvent("app_paywall_cta", { plano });
    const ativou = await comprar(APP_PRECOS[plano].id);
    setComprando(false);
    if (ativou) {
      trackEvent("app_paywall_success", { plano });
      setOk(true);
      // Mesma regra do AppPurchaseSheet (27/07): celebra ANTES de navegar,
      // pra o app não pintar cru por um segundo. Ver BoasVindasPago.
      setTimeout(() => setCelebrar(true), 900);
    }
  };

  if (celebrar) {
    return <BoasVindasPago imediato nome={nome} onComecar={() => { window.location.href = "/"; }} />;
  }

  if (ok) {
    return (
      <div className="fixed inset-0 z-[400] bg-background grid place-items-center px-6">
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 grid place-items-center mx-auto mb-4">
            <Check className="w-9 h-9 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold">Assinatura ativa! 🎉</h2>
          <p className="text-sm text-muted-foreground mt-1">Só um instante…</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[400] bg-background overflow-y-auto">
      <div className="min-h-full max-w-sm mx-auto flex flex-col px-5 py-8">
        <button
          onClick={() => { trackEvent("app_paywall_close", {}); onClose(); }}
          aria-label="Fechar"
          className="fixed top-3 right-3 z-10 grid place-items-center w-9 h-9 rounded-full bg-black/[0.06] text-muted-foreground/70"
        >
          <X className="w-[18px] h-[18px]" />
        </button>

        <div className="text-center mt-6 mb-6">
          <h1 className="text-[26px] font-bold tracking-tight leading-tight">Desbloqueie o CORE completo</h1>
          <p className="text-sm text-muted-foreground mt-2">16 módulos · sem anúncios · seu plano personalizado</p>
        </div>

        <div className="space-y-3">
          {/* ANUAL — o produto real, destacado */}
          <button
            onClick={() => setPlano("anual")}
            className={`w-full text-left rounded-2xl border-2 p-4 relative transition-colors ${plano === "anual" ? "border-accent bg-accent/5" : "border-border bg-card"}`}
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
          {/* MENSAL — âncora, de propósito apagado */}
          <button
            onClick={() => setPlano("mensal")}
            className={`w-full text-left rounded-2xl border-2 p-4 transition-colors ${plano === "mensal" ? "border-accent bg-accent/5" : "border-border bg-card opacity-80"}`}
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-[15px]">Mensal</div>
              <div className="font-bold">{APP_PRECOS.mensal.preco}<span className="text-xs font-semibold text-muted-foreground">/mês</span></div>
            </div>
          </button>
        </div>

        <ul className="text-[13px] text-muted-foreground space-y-1.5 mt-5">
          {["Finanças, rotina, treino, dieta e +12 módulos", "Lembretes e plano diário", "Cancele quando quiser, direto na Play Store"].map((t) => (
            <li key={t} className="flex items-start gap-2"><Check className="w-4 h-4 text-accent shrink-0 mt-0.5" /> {t}</li>
          ))}
        </ul>

        <div className="mt-auto pt-6">
          <button
            onClick={assinar}
            disabled={rc !== "pronto" || comprando}
            className="w-full h-14 rounded-full bg-foreground text-background font-bold text-base disabled:opacity-50"
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
          <p className="text-[11px] text-muted-foreground text-center mt-2 leading-relaxed">
            {plano === "anual"
              ? <>Após 3 dias grátis, <b className="text-foreground">{APP_PRECOS.anual.preco}/ano</b>. Renova automaticamente; cancele antes e não paga nada.</>
              : <>Cobrança de <b className="text-foreground">{APP_PRECOS.mensal.preco}</b> por mês, renovação automática.</>}
          </p>
          <button
            onClick={async () => { trackEvent("app_paywall_restore", {}); const r = await restaurar(); if (r) window.location.href = "/"; }}
            className="w-full text-center text-[12px] text-muted-foreground underline underline-offset-2 mt-3"
          >
            Restaurar compras
          </button>
        </div>
      </div>
    </div>
  );
}
