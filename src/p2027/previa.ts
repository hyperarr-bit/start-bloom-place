/**
 * /2027 — a regra da faixa amarela "PRÉVIA · PAGAMENTO SIMULADO" (arquivo puro: sem window, testado em src/test/p2027.test.ts).
 *
 * A prévia (pagamento simulado, nada rastreado) abre com ?qa=1 ou fora do domínio de produção. `?print=1` tira a faixa só FORA do
 * domínio (é o modo dos prints e das medidas no computador). No domínio de produção, `?qa=1&print=1` continua com a faixa
 * (rodada 2, T-BAIXA 1): um link desses que vaze nunca parece a página de verdade, com "Pronto! Seu CORE está liberado" sem pagar.
 */
export const DOMINIOS_PRODUCAO: readonly string[] = ["coreaplicativo.com.br", "www.coreaplicativo.com.br"];

/** a faixa "PRÉVIA" aparece? (`qa` = a página está na prévia; `host` = location.hostname; `busca` = location.search) */
export function faixaDaPrevia(qa: boolean, host: string, busca: string): boolean {
  if (!qa) return false;
  const print = new URLSearchParams(busca).get("print") === "1";
  return !(print && !DOMINIOS_PRODUCAO.includes(host));
}
