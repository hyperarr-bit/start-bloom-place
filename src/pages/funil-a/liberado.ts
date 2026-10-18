/**
 * O /funil-a é PROTÓTIPO: só abre fora do domínio de produção (preview da Vercel, localhost). Em
 * coreaplicativo.com.br e www, a rota leva pra landing "/" com a mesma query, como os funis aposentados.
 * Pra ligar em produção, é tirar o domínio daqui (decisão do dono, depois do teste no preview).
 */
export const DOMINIOS_DE_PRODUCAO = ["coreaplicativo.com.br", "www.coreaplicativo.com.br"] as const;

export function funilALiberadoNoHost(host: string): boolean {
  const h = String(host ?? "").trim().toLowerCase().replace(/\.$/, "");
  return !(DOMINIOS_DE_PRODUCAO as readonly string[]).includes(h);
}
