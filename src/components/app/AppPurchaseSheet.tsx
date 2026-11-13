import { lazy, Suspense, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import { PaywallAssinatura } from "@/components/paywall/PaywallAssinatura";
import { PaywallSemTeste } from "@/components/paywall/PaywallSemTeste";
import { usePaywallComTeste, usePaywallVisual } from "@/hooks/use-paywall-teste";
// lazy: o PaywallW puxa o PaywallDia14 inteiro — só o iPhone sem teste paga esse peso, e só ao abrir o /planos
const PaywallW = lazy(() => import("@/pages/funis/w/PaywallW").then((m) => ({ default: m.PaywallW })));
import { getFunnelArea } from "@/lib/funnel";

/**
 * A "ABA DE COMPRAR" DO /planos ("Meu acesso").
 *
 * HISTÓRIA: nasceu em 06/08 vendendo o VITALÍCIO R$ 27,90 ("Quero pra sempre",
 * "PAGAMENTO ÚNICO", "sem mensalidade"). Em 16/08 o app virou ASSINATURA
 * (anual 97,90 / mensal 24,90) e o catálogo da Play foi trocado — mas esta
 * tela continuou oferecendo o produto antigo. Quem estava no teste de 3 dias
 * e abria "Meu acesso" via uma oferta que não é mais a nossa, com um preço
 * que não bate com o catálogo: confusão pra quem paga e divergência que
 * reprova na análise da Play.
 *
 * Agora o sheet é só a MOLDURA (bottom sheet + voltar do Android); quem vende
 * é o PaywallAssinatura, o mesmo componente do funil e do gate. Uma oferta
 * só no app inteiro.
 */
export function AppPurchaseSheet({ onClose }: { onClose: () => void }) {
  /*
   * VOLTAR do Android fecha o SHEET, não a tela de trás (04/08).
   *
   * Sem isto, o gesto de voltar — o jeito instintivo de fechar um bottom
   * sheet — caía no history.back() do webview e desmontava a tela inteira,
   * sem caminho de volta ("quando clicamos em assinar não dá mais pra
   * voltar", dono). O truque: uma entrada de histórico fantasma enquanto o
   * sheet vive; o primeiro voltar consome ela e fecha o sheet.
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
  }, []);

  useEffect(() => { trackEvent("app_sheet_view", { produto: "assinatura" }); }, []);
  /* 12/11 (1.0.26 / Android 138): chave `paywall_teste` off (padrão) = o paywall SEM teste em tela cheia; o Voltar
     redondo (e o do Android, pelo histórico fantasma acima) fecha. "on" = o sheet de hoje. */
  const comTeste = usePaywallComTeste();
  /* 12/11 (dono): no iPhone sem teste o "Ver planos" usa o desenho do Android (PaywallW, modo "planos") com o A/B
     anual × vitalício; "enxovaly" (só pela chave remota paywall_visual) volta o PaywallSemTeste. */
  const visual = usePaywallVisual(!comTeste);
  if (!comTeste && visual === "android") {
    return (
      <div
        className="fixed inset-0 z-[300] overflow-y-auto bg-white px-5"
        style={{ paddingTop: "var(--app-safe-top, env(safe-area-inset-top, 0px))" }}
        data-testid="planos-ios-paywall-w"
      >
        <Suspense fallback={null}>
          <PaywallW modo="planos" semTeste area={getFunnelArea() ?? "dinheiro"} answers={{}} onVoltar={onClose} onPagoSemConta={() => { window.location.href = "/"; }} />
        </Suspense>
      </div>
    );
  }
  if (!comTeste) {
    return <PaywallSemTeste modo="planos" area={getFunnelArea() ?? "dinheiro"} onVoltar={onClose} onPagoSemConta={() => { window.location.href = "/"; }} />;
  }

  return (
    <div className="fixed inset-0 z-[90]">
      <motion.button
        aria-label="Fechar"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/45"
        onClick={() => { trackEvent("app_sheet_close", {}); onClose(); }}
      />
      {/* calc, nao max no paddingBottom (05/08): em WebView 77 o max() e
          rejeitado no estilo inline e o sheet colava no rodape; calc(a+env)
          rende igual em qualquer motor. */}
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-white px-5 pt-3 text-foreground"
        style={{ paddingBottom: "calc(1.1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto w-10 h-1.5 rounded-full bg-muted mb-4" aria-hidden />
        <PaywallAssinatura contexto="planos" onFechar={onClose} />
      </motion.div>
    </div>
  );
}
