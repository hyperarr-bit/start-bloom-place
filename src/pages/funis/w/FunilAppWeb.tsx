/**
 * /funil-app (14/11) — a rota da web do funil do app com o paywall cobrando pela Stripe (lib/funil-app-web).
 * Chave DESLIGADA → manda pra home do site (nada aparece). Ligada (ou `?funil-app-web=on`) → o ComecarW com `cobrancaWeb`.
 * Reabriu o site com um Pix vivo ou pago sem senha (o pedido no aparelho) → pousa direto no paywall, que reabre a folha
 * no MESMO Pix (ou no pós-compra) — nunca um 2º Pix.
 */
import { lazy, Suspense } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { funilAppWebLigado, guardarForcaFunilAppWeb } from "@/lib/funil-app-web";
import { lerPedido, pedidoPendente } from "@/lib/stripe-app-web";

const ComecarW = lazy(() => import("./ComecarW"));

export default function FunilAppWeb() {
  const { search } = useLocation();
  try { guardarForcaFunilAppWeb(search); } catch { /* noop */ }
  if (!funilAppWebLigado()) return <Navigate to="/" replace />;
  const p = new URLSearchParams(search);
  /* 14/11 (revisão): com Pix vivo ou pago sem senha, o /funil-app SEMPRE pousa no paywall (que reabre a folha / o pós-compra),
   * venha a URL como vier — a volta da demo deixa ?step=compromissos na barra, e recarregar ali caía nas perguntas.
   * Só aqui: o ComecarW das outras rotas não muda. */
  if (p.get("step") !== "offer" && pedidoPendente(lerPedido())) {
    p.set("step", "offer");
    return <Navigate to={`/funil-app?${p.toString()}`} replace />;
  }
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white" />}>
      <ComecarW cobrancaWeb />
    </Suspense>
  );
}
