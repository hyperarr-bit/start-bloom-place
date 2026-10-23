import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * GUARDA DO TOQUE DUPLO NAS TELAS DE PASSO (1.0.17 — Montar Finanças e Montar Rotina).
 *
 * O "Continuar" de cada passo mora no MESMO lugar da tela (rodapé colado). Dois toques rápidos: o 1º troca o passo e o
 * 2º cai no "Continuar" do passo seguinte — pulava as contas (ou o cartão) sem ela ver. Conserto seguro: depois de cada
 * troca de passo (e quando a tela monta), o botão ignora toques por ~450 ms. Guarda por TEMPO, nunca esperando a
 * animação terminar (uma animação que não roda — Modo Pouca Energia, aba em 2º plano — não pode travar o botão).
 *
 *   const guardar = useGuardaDeToque(etapa);
 *   <button onClick={guardar(() => irPara("contas"))}>Continuar</button>
 *
 * Testes: a suíte zera a guarda em src/test/setup.ts (os fluxos clicam em sequência em < 1 ms); o teste da guarda
 * liga com `globalThis.__CORE_GUARDA_TOQUE_MS = GUARDA_DE_TOQUE_MS`.
 */
export const GUARDA_DE_TOQUE_MS = 450;

const msDaGuarda = (): number => {
  const v = (globalThis as { __CORE_GUARDA_TOQUE_MS?: unknown }).__CORE_GUARDA_TOQUE_MS;
  return typeof v === "number" && v >= 0 ? v : GUARDA_DE_TOQUE_MS;
};
const agora = (): number => (typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now());

export function useGuardaDeToque(chave: unknown) {
  const desde = useRef<number>(agora());
  // layout effect: marca a troca logo depois do commit, antes de o navegador entregar o próximo toque
  useLayoutEffect(() => { desde.current = agora(); }, [chave]);
  return useCallback(<A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
    if (agora() - desde.current < msDaGuarda()) return;
    fn(...args);
  }, []);
}
