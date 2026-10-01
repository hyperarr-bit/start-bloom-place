import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";
import { ENTRADA_APP, VENDA_NA_WEB, destinoNaLanding } from "@/lib/rotas-web";

/**
 * ROTA DE FUNIL DA WEB, APOSENTADA (01/10). Substitui o par SoNaWeb+funil nas
 * rotas de venda. Três saídas, nesta ordem:
 *
 *  1. APP DA LOJA → `nativo`, se a rota tem versão do app (/app e /funil-w
 *     renderizam o ComecarW); senão a porta do app (ENTRADA_APP) — é
 *     exatamente o que o SoNaWeb fazia, byte a byte.
 *  2. WEB com VENDA_NA_WEB ligada → `web`, o funil de sempre (rollback).
 *  3. WEB com a venda desligada → a landing "/", com utm/fbclid preservados.
 *
 * O evento `funil_redirecionado` diz de qual rota antiga a visita veio —
 * é como a gente vê quanto tráfego ainda chega por anúncio/link antigo.
 */
export function FunilAposentado({ web, nativo }: { web?: ReactNode; nativo?: ReactNode }) {
  const { pathname, search } = useLocation();
  const noApp = isNativeShell();
  const redireciona = !noApp && (!VENDA_NA_WEB || !web);
  useEffect(() => {
    if (redireciona) trackEvent("funil_redirecionado", { de: pathname });
    // uma vez por montagem: a rota some logo em seguida
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (noApp) return <>{nativo ?? <Navigate to={ENTRADA_APP} replace />}</>;
  if (!redireciona) return <>{web}</>;
  return <Navigate to={destinoNaLanding(search)} replace />;
}
