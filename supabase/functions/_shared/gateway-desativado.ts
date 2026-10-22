/**
 * GATEWAYS ANTIGOS DESLIGADOS (21/10, dono aprovou).
 *
 * AbacatePay e Pagar.me saíram do funil há semanas (o Pix da web é Asaas — PixCheckout FORCE_GATEWAY "asaas" — e a
 * Cakto é a reserva). As funções continuavam no ar e davam acesso: o cliente escolhia a oferta, o check podia dar
 * vitalício a um w25, os webhooks davam vitalício a qualquer oferta paga e o abacatepay-webhook pegava o userId do
 * corpo (revisão de segurança 21/10). Agora todas respondem 410 "gateway desativado" ANTES de criar cliente do banco
 * ou ler o corpo: nada é lido nem gravado.
 *
 * Quem usa: abacate-pix, pagarme-pix, abacate-webhook, pagarme-webhook, abacatepay-webhook, abacatepay-checkout —
 * a 1ª linha do `serve` de cada uma (o teste src/test/seguranca/gateways-antigos.test.ts confere).
 * Religar (não deveria): GATEWAYS_ANTIGOS_DESLIGADOS = false + deploy da função.
 */
export const GATEWAYS_ANTIGOS_DESLIGADOS = true;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** A resposta da função desligada (ou null se o gateway estiver ligado). Não toca em banco, corpo nem segredo. */
export function respostaGatewayDesativado(req: Request, nome: string, desligado: boolean = GATEWAYS_ANTIGOS_DESLIGADOS): Response | null {
  if (!desligado) return null;
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  console.log(`[${nome}] gateway desativado (410) ${req.method}`);
  return new Response(JSON.stringify({ error: "gateway desativado", gateway: nome }), {
    status: 410,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
