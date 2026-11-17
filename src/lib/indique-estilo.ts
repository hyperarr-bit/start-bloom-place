/**
 * INDIQUE E GANHE — qual CARA da tela cheia (17/11, dono: "faz um estilo bitepal e estilo o dele só que em tela cheia").
 *
 * As duas caras usam o MESMO HTML e os mesmos textos; só muda o CSS (e a composição da cena). Trocar = esta linha.
 *   "bitepal" — fundo neutro lavanda com um wash rosa que morre no neutro, título display enorme, número-herói contando,
 *               props em sticker (o CORE no celular, 2 amigas, moedas), pílula PRETA.
 *   "site"    — a direção B de 16/11 em tela cheia: rosa claro do site, as bolinhas "amiga 1 + amiga 2 = R$ 67,90",
 *               caixa grafite, botão magenta.
 *   "c"       — 17/11 (dono): a cara BitePal SEM lembrar o preço que ela pagou (nada de "R$ 67,90 de volta" / "sai de graça":
 *               pensar no dinheiro gasto pode puxar reembolso). A mensagem: 50%, R$ 33,95 por amiga, SEM LIMITE de amigas. (recomendada)
 * Vale pro pós-pago da /oferta (src/landing/indique.ts) e pro topo do painel /indique/:token (src/pages/IndiquePainel.tsx).
 * QA: ?indique-estilo=bitepal|site|c (fica neste aparelho; ?indique-estilo=auto volta pra chave).
 */
export type EstiloIndique = "bitepal" | "site" | "c";
// 17/11: "c" recomendada — a cara BitePal (a mais bonita) sem lembrar o preço pago (risco de reembolso levantado pelo dono)
export const ESTILO_INDIQUE: EstiloIndique = "c";

const CHAVE = "indique-estilo-force";
export function estiloIndique(busca: string = typeof location === "undefined" ? "" : location.search): EstiloIndique {
  let v: string | null = null;
  try { v = new URLSearchParams(busca).get("indique-estilo"); } catch { v = null; }
  try {
    if (v === "bitepal" || v === "site" || v === "c") localStorage.setItem(CHAVE, v);
    else if (v === "auto") localStorage.removeItem(CHAVE);
    const g = v === "bitepal" || v === "site" || v === "c" ? v : localStorage.getItem(CHAVE);
    if (g === "bitepal" || g === "site" || g === "c") return g;
  } catch {
    if (v === "bitepal" || v === "site" || v === "c") return v;
  }
  return ESTILO_INDIQUE;
}
