import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { APP_PRECOS } from "@/lib/native-shell";
import { initRevenueCat, estadoRevenueCat, comprar, restaurar } from "@/lib/revenuecat";
import { useUserData } from "@/hooks/use-user-data";
import { BoasVindasPago } from "@/components/onboarding/BoasVindasPago";

/**
 * A "ABA DE COMPRAR" DO APP (decisão do dono 23/07, lógica BitePal): o
 * OfferScreen personalizado vende; este bottom sheet só transaciona.
 * Sobe por cima do paywall quando o CTA é tocado — anual em destaque com
 * trial, mensal âncora apagada, preço TOTAL sempre visível (compliance
 * Play — Cal AI foi removido por esconder isso), renovação explícita e
 * Restaurar compras. Motor: RevenueCat (mesmo do SubscriptionPaywall).
 */
export function AppPurchaseSheet({ onClose, planoInicial = "anual" }: { onClose: () => void; planoInicial?: "anual" | "mensal" }) {
  const [plano, setPlano] = useState<"anual" | "mensal">(planoInicial);
  const [rc, setRc] = useState(estadoRevenueCat());
  const [comprando, setComprando] = useState(false);
  const [ok, setOk] = useState(false);
  const [celebrar, setCelebrar] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { get } = useUserData();
  const nome = get<string>("core-user-name", "") || get<string>("user-name", "");

  /*
   * VOLTAR do Android fecha o SHEET, não o funil (04/08).
   *
   * Sem isto, o gesto de voltar — o jeito instintivo de fechar um bottom
   * sheet — caía no padrão do Capacitor: history.back() do webview. E o
   * histórico tem entradas reais (central → demo → cadastro), então o
   * usuário não fechava o sheet: ele DESMONTAVA o funil inteiro, o step
   * "offer" (estado de componente) evaporava e não existia caminho de volta
   * ao paywall — "quando clicamos em assinar não dá mais pra voltar" (dono).
   *
   * O truque: uma entrada de histórico fantasma enquanto o sheet vive. O
   * primeiro voltar consome a entrada e fecha o sheet; fechar pelo X ou
   * backdrop desfaz a entrada no cleanup pra não deixar lixo no histórico.
   */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    let fechouPeloVoltar = false;
    try { history.pushState({ coreSheet: true }, ""); } catch { return; }
    const aoVoltar = () => {
      fechouPeloVoltar = true;
      onCloseRef.current();
    };
    window.addEventListener("popstate", aoVoltar);
    return () => {
      window.removeEventListener("popstate", aoVoltar);
      if (!fechouPeloVoltar && (history.state as { coreSheet?: boolean } | null)?.coreSheet) {
        try { history.back(); } catch { /* noop */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    trackEvent("app_sheet_view", {});
    /*
     * Telemetria do botão CINZA (04/08). O disabled do botão depende do
     * estadoRC, e até hoje esse estado não gerava evento nenhum: o
     * app_compra_falhou com motivo rc_* só dispara dentro de comprar(), que
     * nunca roda com o botão desabilitado. Resultado real: campanha com zero
     * vendas e nenhum jeito de saber se as pessoas viram um botão morto.
     * Agora cada abertura do sheet reporta em que estado o botão nasceu e em
     * que estado ficou depois do init.
     */
    trackEvent("app_sheet_rc", { fase: "abertura", estado: estadoRevenueCat() });
    initRevenueCat().then((e) => {
      setRc(e);
      trackEvent("app_sheet_rc", { fase: "apos_init", estado: e });
    });
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
      // Boas-vindas ANTES de navegar (27/07): o app não pode pintar primeiro,
      // senão a pessoa vê o módulo cru por um segundo e a celebração chega
      // atrasada, como aviso. Ver BoasVindasPago.
      setTimeout(() => setCelebrar(true), 900);
    }
  };

  const tentarRestaurar = async () => {
    trackEvent("app_sheet_restore", {});
    const r = await restaurar();
    if (r) { window.location.href = "/"; return; }
    setMsg("Nenhuma assinatura encontrada nesta conta Google.");
  };

  // A celebração cobre tudo e é ela quem navega — o app só monta depois.
  if (celebrar) {
    return <BoasVindasPago imediato nome={nome} onComecar={() => { window.location.href = "/"; }} />;
  }

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
        {/* X visível (04/08): as únicas saídas eram o backdrop (faixa
            estreita) e o voltar do Android — que até hoje destruía o funil.
            Sheet sem saída óbvia é gaiola, e gaiola não vende. */}
        <button
          aria-label="Fechar"
          onClick={() => { trackEvent("app_sheet_close", { via: "x" }); onClose(); }}
          className="absolute right-3.5 top-3.5 w-7 h-7 rounded-full bg-black/[0.06] grid place-items-center text-muted-foreground active:scale-95 transition-transform"
        >
          <X className="w-[15px] h-[15px]" strokeWidth={2.25} />
        </button>

        {ok ? (
          <div className="py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 grid place-items-center mx-auto mb-3">
              <Check className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold">Assinatura ativa! 🎉</h2>
            <p className="text-sm text-muted-foreground mt-1">Só um instante…</p>
          </div>
        ) : (
          <>
            {/* DUAS ofertas de peso igual (04/08, pedido do dono: "o paywall
                tem que ser focado nas duas ofertas, não só no anual"). O
                mensal deixou de ser âncora apagada (opacity-75, uma linha) e
                virou card completo. O anual segue default e com o selo do
                trial — destaque por INFORMAÇÃO, não por apagar o irmão. */}
            <h2 className="text-[20px] font-bold tracking-tight text-center">
              {plano === "anual" ? "Comece com 3 dias grátis" : "CORE completo, sem fidelidade"}
            </h2>
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
                    {/* 59%: 12 × 19,90 = 238,80 → 97,90 é 59% menos. Era "67%"
                        calculado sobre o mensal de 29,90 — número FALSO desde
                        a troca de preço de 02/08. Se mexer nos preços, refaz
                        esta conta. */}
                    <div className="text-[11px] text-emerald-600 font-bold">59% OFF</div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => { setPlano("mensal"); trackEvent("app_sheet_plan", { plano: "mensal" }); }}
                className={`w-full text-left rounded-2xl border-2 p-3.5 transition-colors ${plano === "mensal" ? "border-accent bg-accent/5" : "border-border bg-card"}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[15px]">Mensal</div>
                    <div className="text-xs text-muted-foreground mt-0.5">sem fidelidade · cancela em 1 toque</div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-lg">{APP_PRECOS.mensal.preco}<span className="text-xs font-semibold text-muted-foreground">/mês</span></div>
                  </div>
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
                : plano === "anual" ? "Começar 3 dias grátis" : `Assinar por ${APP_PRECOS.mensal.preco}/mês`}
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
