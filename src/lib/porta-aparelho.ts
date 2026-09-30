/**
 * PORTA POR APARELHO — teste do Dia 2 do plano "ROI 2 em 7 dias" (30/09/2026).
 *
 * O que os dados dizem (scratchpad web-roi2-7dias/porta-paywall.md, Kenny G,
 * 22/09 → 29/09): a porta nova do ROI 2 (27/09 14h) subiu o iPhone de 23% pra
 * 27% (1ª tela → 1ª pergunta) e DERRUBOU o Android de 47% pra 40% (n=560,
 * diferença fora do ruído). O resto do funil ROI 2 (pílula, central com os
 * 16 ✓, paywall, cadastro de 2 campos) fica igual pros dois: só a 1ª tela
 * muda no Android.
 *
 * DESLIGADO POR PADRÃO: `PORTA_ANTIGA_NO_ANDROID = false` = porta ROI 2 pra
 * todo mundo, byte a byte. Ligado: Android vê a porta de 19/09 ("Um app pra
 * vida inteira / Qual área tá mais fora de controle hoje?"), iPhone segue na
 * ROI 2. Rollback = `false` + push.
 * QA sem mexer no funil de ninguém: localStorage `porta-aparelho-force` =
 * "antiga" | "roi2".
 */
export const PORTA_ANTIGA_NO_ANDROID = false;

export const CHAVE_FORCA_PORTA = "porta-aparelho-force";

export const ehAndroid = (ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean =>
  /Android/i.test(ua) && !/iPhone|iPad/i.test(ua);

/** A porta antiga vale neste aparelho? Força de QA > chave × aparelho. */
export function portaAntigaNesteAparelho(ligada: boolean = PORTA_ANTIGA_NO_ANDROID, ua?: string): boolean {
  try {
    const f = localStorage.getItem(CHAVE_FORCA_PORTA);
    if (f === "antiga") return true;
    if (f === "roi2") return false;
  } catch { /* storage bloqueado (webview) — vale a chave */ }
  return ligada && ehAndroid(ua);
}
