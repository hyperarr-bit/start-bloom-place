/**
 * A SETA ← DOS MÓDULOS NA DEMO (P5, 30/09) — e o botão de baixo da demo, da MESMA fonte.
 *
 * O achado (auditoria de acessibilidade 28→29/09, achado 10): na demo da web
 * (/preview/:módulo) os módulos são os de VERDADE, e a seta ← do cabeçalho
 * fazia o que faz no app logado. Em Treino, Dieta, Saúde e cia. era
 * navigate("/home") → sem conta, o ProtectedRoute manda pro /auth (tela de
 * entrar de quem nem tem conta). Em Finanças, Rotina, Metas, Estudos e
 * Carreira era navigate(isPreview ? "/lp" : "/home") → /lp → /comecar, OUTRO
 * funil, outro paywall. A demo guiada está ligada pra todo mundo: a seta era
 * uma saída do funil no meio da missão.
 *
 * Agora o Preview PUBLICA aqui o destino do botão de baixo da demo ("Quase
 * lá" / "Criar conta" / "Quero o meu assim"), já com o item da demo guiada
 * (c=), e o que o botão faz ao ser tocado (encerrar a missão). O botão de
 * baixo e a seta de TODO módulo leem daqui — não têm como divergir.
 *
 * Fora da demo não existe provedor: a seta faz exatamente o que o módulo
 * fazia antes (o `padrao`, "/home" no app logado).
 */
import { createContext, useCallback, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "@/lib/analytics";

export interface VoltaDaDemo {
  /** Pra onde o botão de baixo da demo leva — JÁ com o ajuste da demo guiada (o item anotado vai junto). */
  destino: string;
  /** O que o botão de baixo faz além de navegar. Na Missão da demo guiada: encerra a missão.
   *  A seta chama com "seta" (só pra medir por onde saiu); o botão de baixo chama sem nada. */
  aoTocar?: (via?: "seta") => void;
  /** Módulo aberto na demo (vai no evento da seta). */
  modulo: string;
  /** Campos a mais no evento da seta (ex.: o braço da demo guiada). */
  extras?: Record<string, unknown>;
}

const ContextoDaVolta = createContext<VoltaDaDemo | null>(null);

/** O Preview envolve a demo inteira com isto (não pinta nada na tela). */
export const VoltaDaDemoProvider = ContextoDaVolta.Provider;

/** O que o Preview publicou; `null` fora da demo. */
export const useVoltaDaDemo = (): VoltaDaDemo | null => useContext(ContextoDaVolta);

/**
 * O onClick da seta ← do cabeçalho de um módulo.
 *  · Na demo: mesmo destino (e mesmo efeito na missão) do botão de baixo, com
 *    o evento `funnel_click { cta: "demo_seta_voltar" }`.
 *  · Fora dela: `navigate(padrao)` — o de sempre.
 */
export function useVoltarDoModulo(padrao = "/home"): () => void {
  const volta = useVoltaDaDemo();
  const navigate = useNavigate();
  return useCallback(() => {
    if (!volta) {
      navigate(padrao);
      return;
    }
    try {
      trackEvent("funnel_click", { cta: "demo_seta_voltar", module: volta.modulo, ...(volta.extras ?? {}) });
      volta.aoTocar?.("seta");
    } catch { /* medição e missão nunca prendem ninguém na demo: a navegação vem de qualquer jeito */ }
    navigate(volta.destino);
  }, [volta, navigate, padrao]);
}
