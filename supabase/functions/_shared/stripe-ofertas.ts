/**
 * OFERTAS DA STRIPE (14/11) — a tabela que substitui o preço único (6790 / "oferta").
 *
 * Cada página que cobra pela Stripe tem UMA linha aqui: o valor que o stripe-criar cobra e o ÚNICO valor que o
 * stripe-webhook aceita pra aquela página. A página do navegador só diz QUAL oferta (metadata.pagina); o preço nunca
 * vem dela.
 *
 *   oferta   /oferta, /completo e /vitalicio (04/11): vitalício R$ 67,90, Pix + cartão. NADA mudou nela (mesma
 *            idempotência "oferta-<ref>", mesma descrição, mesmo content_name na CAPI).
 *   app_web  /funil-app (14/11): o funil do app na web. Vitalício R$ 97,90, Pix + cartão em até 3x.
 *
 * O MENSAL (R$ 34,90/mês, só cartão, assinatura recorrente) não é PaymentIntent avulso: é uma Subscription da Stripe
 * com o preço STRIPE_PRECO_MENSAL_34 (env; o dono cria o preço na conta de produção). Fica em MENSAL_APP_WEB.
 */
export type OfertaStripe = {
  /** o valor de metadata.pagina (a chave desta tabela) */
  pagina: string;
  centavos: number;
  /** prefixo da Idempotency-Key do criar ("oferta" = o de sempre) */
  idem: string;
  descricao: string;
  /** máximo de parcelas oferecido no cartão (1 = à vista) */
  parcelasMax: number;
  /** a oferta gravada no registro de pagamento em dobro */
  offer: string;
  contentName: string;
  urlPadrao: string;
};

export const OFERTAS_STRIPE: Record<string, OfertaStripe> = {
  oferta: {
    pagina: "oferta", centavos: 6790, idem: "oferta", descricao: "CORE vitalicio", parcelasMax: 12, offer: "ST_oferta",
    contentName: "CORE vitalício (Stripe)", urlPadrao: "https://www.coreaplicativo.com.br/oferta",
  },
  app_web: {
    pagina: "app_web", centavos: 9790, idem: "appweb", descricao: "CORE vitalicio", parcelasMax: 3, offer: "ST_app_web",
    contentName: "CORE vitalício (funil app web)", urlPadrao: "https://www.coreaplicativo.com.br/funil-app",
  },
};

/** a oferta da página (desconhecida = null; o stripe-criar cai na "oferta" de sempre, o webhook ignora) */
export const ofertaDaPagina = (pagina: unknown): OfertaStripe | null =>
  typeof pagina === "string" && Object.prototype.hasOwnProperty.call(OFERTAS_STRIPE, pagina) ? OFERTAS_STRIPE[pagina] : null;

/** o mensal do funil app web: assinatura recorrente no cartão */
export const MENSAL_APP_WEB = {
  pagina: "app_web_mensal",
  centavos: 3490,
  /** env com o id do preço (price_…) de R$ 34,90/mês — o dono cria na Stripe de produção */
  envPreco: "STRIPE_PRECO_MENSAL_34",
  offer: "ST_app_web_mensal",
  contentName: "CORE mensal (funil app web)",
  urlPadrao: "https://www.coreaplicativo.com.br/funil-app",
  /** a versão da API nas chamadas de assinatura (latest_invoice.payment_intent existe nela) */
  apiVersion: "2024-06-20",
} as const;

/** o preço da Stripe confere com o mensal (R$ 34,90 BRL, mensal, recorrente)? Trava contra env com o preço errado. */
export function precoMensalConfere(p: unknown): boolean {
  const x = (p ?? {}) as { unit_amount?: unknown; currency?: unknown; recurring?: { interval?: unknown; interval_count?: unknown } | null; active?: unknown };
  return x.unit_amount === MENSAL_APP_WEB.centavos && x.currency === "brl" && x.recurring?.interval === "month"
    && (x.recurring?.interval_count ?? 1) === 1 && x.active !== false;
}
