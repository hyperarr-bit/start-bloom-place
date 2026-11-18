/**
 * /escolha (18/11, chave PLANOS_PAGINA) — as contas puras da página dos 2 planos (testadas em src/test/planos-pagina.test.ts).
 * Os valores que valem são SEMPRE os do servidor (supabase/functions/_shared/stripe-ofertas.ts: "planos" 9790 e "planos_mensal" 3490);
 * aqui é só o que a tela mostra.
 */
export type Plano = "vitalicio" | "mensal";
export const ehPlano = (p: unknown): p is Plano => p === "vitalicio" || p === "mensal";

/** "R$ 97,90" (com espaço não separável, como o resto da landing) */
export const reaisPlanos = (centavos: number): string => `R$ ${(Math.round(centavos) / 100).toFixed(2).replace(".", ",")}`;

/**
 * A parcela que a tela mostra: o TOTAL dividido pelas parcelas, arredondado pra CIMA no centavo (97,90 ÷ 12 = 8,158… → R$ 8,16).
 * A Stripe cobra o total (R$ 97,90) e quem divide é o banco do cartão (parcelado do emissor): a tela nunca mostra uma parcela menor
 * do que a real. Se o banco cobrar juros do parcelamento, o valor da parcela é o do banco (PRECISA-DO-DONO.md, item da 1ª compra 12x).
 */
export const parcelaCentavos = (totalCentavos: number, n: number): number => Math.ceil(totalCentavos / Math.max(1, Math.floor(n)));
export const textoParcela = (totalCentavos: number, n: number): string => `${n}x de ${reaisPlanos(parcelaCentavos(totalCentavos, n))}`;

/** "o vitalício custa menos que 3 meses do mensal" — só aparece se for verdade com os preços da tela */
export const vitalicioMenosQue3Meses = (vitalicio: number, mensal: number): boolean => vitalicio < mensal * 3;

/** o valor do plano (o que a tela, o InitiateCheckout e o Purchase do navegador mostram) */
export const valorDoPlano = (p: Plano, precos: { vitalicio: number; mensal: number }): number => (p === "mensal" ? precos.mensal : precos.vitalicio);

/**
 * O eventID do Purchase do navegador — o MESMO event_id que a CAPI do servidor manda (a Meta conta 1):
 * vitalício = o id do PaymentIntent (stripe-webhook, payment_intent.succeeded); mensal = o id da assinatura (invoice.paid da 1ª fatura).
 * Renovação do mensal nunca manda Purchase (nem aqui, nem no servidor).
 */
export function eventIdDaCompra(p: Plano, ids: { pi?: string | null; sub?: string | null }): string | null {
  if (p === "mensal") return ids.sub && /^sub_/.test(ids.sub) ? ids.sub : null;
  return ids.pi && /^pi_/.test(ids.pi) ? ids.pi : null;
}
