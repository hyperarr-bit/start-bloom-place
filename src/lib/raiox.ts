/**
 * FUNIL "RAIO-X DO MÊS" (/raio-x). Chave da campanha.
 *
 * "off" no domínio principal (coreaplicativo.com.br): /raio-x redireciona pra "/"
 * com a query (destinoNaLanding). "on": o quiz abre também em produção.
 * Fora do domínio principal — preview da Vercel (*.vercel.app, inclusive com
 * "-git-"), localhost — o quiz abre mesmo com a chave "off", pra testar o
 * deploy do branch no celular sem ligar a campanha.
 */
export const RAIOX: "off" | "on" = "off";

/** Só estes hosts são a produção. www e o ápice; o resto é preview ou local. */
const HOSTS_PRODUCAO = ["coreaplicativo.com.br", "www.coreaplicativo.com.br"];

export function hostDeProducao(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/\.$/, "");
  return HOSTS_PRODUCAO.includes(h);
}

/** Aberto com a chave, ou em qualquer host que não seja o domínio principal. */
export function raioxAberto(chave: "off" | "on", hostname: string): boolean {
  if (chave === "on") return true;
  return !hostDeProducao(hostname);
}

/**
 * Demo entre a escolha e o preço.
 * "ab": 50/50, fixo por sessão (e pelo hash do fbclid). "on"/"off": força.
 * ?demo=1 e ?demo=0 ganham da chave (QA e anúncio separado).
 */
export const RAIOX_DEMO: "off" | "on" | "ab" = "ab";
