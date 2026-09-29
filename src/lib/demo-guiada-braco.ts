/**
 * DEMO GUIADA — "Missão de 1 minuto" (28/09): a chave e o sorteio do A/B.
 *
 * Por que existe (scratchpad funil-web-28-09/relatorio.md): a demo da web é um
 * corredor — mediana de 14 s, 80% tocam "Quase lá" — e a maior fuga do funil
 * é o paywall (70% veem o Pix de 27,90 e não tocam). A missão faz a pessoa
 * anotar UMA coisa dela na demo, ver o número dela, ganhar o adesivo e chegar
 * no paywall com "O que você já construiu".
 *
 * DESLIGADA POR PADRÃO: `DEMO_GUIADA = "off"` é o funil de hoje, byte a byte
 * (src/test/demo-guiada-off.test.tsx foi fotografado antes da missão existir).
 *   · "ab": sorteio NA ENTRADA da demo (1ª abertura da demo do funil do dia
 *     14) e o braço carimbado na URL (`&guia=1|0`, replace) — imune ao apagão
 *     de storage do navegador do Instagram (lição de 24/09). Os 3 primeiros
 *     dias a 20% pra caçar bug e desempenho; depois `DEMO_GUIADA_FATIA = 0.5`.
 *   · "on": todo mundo na missão.
 * QA e prints, sem mexer no funil de ninguém: `?guia=1` na URL da demo, ou
 * localStorage `demo-guiada-force` = "on" | "off".
 *
 * Este arquivo só desce com a demo (o sorteio é feito pela própria demo, não
 * pela porta): o chunk da 1ª tela não carrega nada disso.
 */
export type ModoDemoGuiada = "off" | "ab" | "on";

export const DEMO_GUIADA: ModoDemoGuiada = "off";

/** Fatia que cai na missão quando DEMO_GUIADA = "ab". */
export const DEMO_GUIADA_FATIA = 0.2;

export const CHAVE_FORCA_DEMO_GUIADA = "demo-guiada-force";
/** Braço na URL da demo: "1" = missão, "0" = controle (demo de hoje, medida). */
export const PARAM_BRACO = "guia";

export const forcaDaDemoGuiada = (): "on" | "off" | null => {
  try {
    const f = localStorage.getItem(CHAVE_FORCA_DEMO_GUIADA);
    return f === "on" || f === "off" ? f : null;
  } catch {
    return null; // storage bloqueado (webview): vale a chave
  }
};

/** Sorteio na entrada da demo. `null` = fora do experimento: a demo fica a de hoje. */
export function sortearBracoDaDemo(modo: ModoDemoGuiada = DEMO_GUIADA, sorte: () => number = Math.random): "1" | "0" | null {
  const f = forcaDaDemoGuiada();
  if (f === "on") return "1";
  if (f === "off") return null;
  if (modo === "on") return "1";
  if (modo === "ab") return sorte() < DEMO_GUIADA_FATIA ? "1" : "0";
  return null;
}

/** A URL da demo com o braço carimbado. Sem braço (chave desligada), devolve a MESMA string. */
export function urlDaDemoComBraco(url: string, braco: "1" | "0" | null = sortearBracoDaDemo()): string {
  if (!braco) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${PARAM_BRACO}=${braco}`;
}
