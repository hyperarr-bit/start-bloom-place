import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";
import { ENTRADA_APP, destinoNaLanding } from "@/lib/rotas-web";

/**
 * O /funil-d só existe fora do domínio de produção. coreaplicativo.com.br e
 * www continuam caindo na landing "/", com utm/fbclid preservados. Preview da
 * Vercel, localhost e qualquer outro host mostram o protótipo. No app da loja,
 * a porta do app — a rota nunca monta o funil dentro do binário.
 */
export function ehDominioDeProducao(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/\.$/, "");
  return h === "coreaplicativo.com.br" || h === "www.coreaplicativo.com.br";
}

export function CercaFunilD({ children, hostname }: { children: ReactNode; hostname?: string }) {
  const { pathname, search } = useLocation();
  const host = hostname ?? (typeof window !== "undefined" ? window.location.hostname : "");
  const noApp = isNativeShell();
  const producao = ehDominioDeProducao(host);
  useEffect(() => {
    if (!noApp && producao) trackEvent("funild_redirecionado", { de: pathname });
    // uma vez por montagem: a rota some logo em seguida
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (noApp) return <Navigate to={ENTRADA_APP} replace />;
  if (producao) return <Navigate to={destinoNaLanding(search)} replace />;
  return <>{children}</>;
}
