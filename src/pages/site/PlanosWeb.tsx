import { Suspense, lazy } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { AssineNoApp } from "@/components/site/AssineNoApp";
import { VENDA_NA_WEB } from "@/lib/rotas-web";

/**
 * A /planos da WEB depois de 01/10 (venda na web desligada).
 *
 * Planos.tsx NÃO foi tocado (outro ramo traz hoje o `?oferta=w97`, o Pix de
 * 97,90 do e-mail de cartão recusado). A decisão fica aqui, na frente dele:
 *
 *   · veio com `?oferta=…` (w97, ds do e-mail h24…) → Planos de sempre, com
 *     o Pix. É o caminho que não pode quebrar.
 *   · já tem acesso (vitalício da web, assinante da loja) → Planos, que pra
 *     essa pessoa é a tela "Meu acesso" (plano, data, VITALÍCIO 🎉).
 *   · sem acesso e sem oferta → "Assine no app e use aqui também".
 *
 * No app da loja esta página nunca monta (App.tsx usa PlanosApp lá).
 */
const Planos = lazy(() => import("@/pages/Planos"));

export default function PlanosWeb() {
  const [sp] = useSearchParams();
  const { isSubscribed, subLoaded } = useAuth();
  const temOferta = !!sp.get("oferta");
  if (VENDA_NA_WEB || temOferta) {
    return <Suspense fallback={<div className="min-h-screen bg-background" />}><Planos /></Suspense>;
  }
  if (!subLoaded) return <div className="min-h-screen bg-background" aria-hidden="true" />;
  if (isSubscribed) return <Suspense fallback={<div className="min-h-screen bg-background" />}><Planos /></Suspense>;
  return <AssineNoApp variante="pagina" />;
}
