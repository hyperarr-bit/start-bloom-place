/**
 * DEMO GUIADA — o único pedaço que o chunk da porta carrega (28/09).
 *
 * O /inicio (porta, cadastro e paywall) é import EAGER: tudo o que ele importa
 * pesa na 1ª tela do tráfego pago. Então o paywall só pergunta "tem item da
 * missão?" com as duas constantes abaixo; o bloco "O que você já construiu", o
 * resto da missão, o sorteio do A/B e a gravação na conta descem sob demanda.
 */

/** O item que a pessoa anotou na missão, na URL da volta (validado em demo-guiada.ts). */
export const PARAM_ITEM = "c";
/** Estado da missão na sessão (reserva da URL). */
export const CHAVE_SESSAO_DA_MISSAO = "core-demo-guia";

/** Tem item da missão pra mostrar no paywall? (URL ou sessão — sem decodificar nada aqui). */
export function temItemDaDemo(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get(PARAM_ITEM)) return true;
  } catch { /* noop */ }
  try {
    return /"item"/.test(sessionStorage.getItem(CHAVE_SESSAO_DA_MISSAO) ?? "");
  } catch {
    return false;
  }
}
