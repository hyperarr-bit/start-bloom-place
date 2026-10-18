/**
 * FUNIL "RAIO-X DO MÊS" (/raio-x). Chave da campanha.
 *
 * "off" (entrega): /raio-x redireciona pra "/" com a query (destinoNaLanding).
 * "on": o quiz abre. A main faz deploy automático — só ligar depois do ok do João.
 */
export const RAIOX: "off" | "on" = "off";

/**
 * Demo entre a escolha e o preço.
 * "ab": 50/50, fixo por sessão (e pelo hash do fbclid). "on"/"off": força.
 * ?demo=1 e ?demo=0 ganham da chave (QA e anúncio separado).
 */
export const RAIOX_DEMO: "off" | "on" | "ab" = "ab";
