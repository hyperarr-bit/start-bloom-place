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
  /** 23/11 (dono: "troca o /tudo e o /organizar para 19,90"): valores ANTIGOS que o webhook ainda aceita nesta página — o Pix/cartão
   *  gerado antes da troca (Pix vence em 30 min) e pago depois não pode ficar sem acesso. O criar NUNCA cobra estes valores. */
  aceitaTambem?: readonly number[];
};

export const OFERTAS_STRIPE: Record<string, OfertaStripe> = {
  lp27: {
    pagina: "lp27", centavos: 2790, idem: "lp27", descricao: "CORE vitalicio", parcelasMax: 1, offer: "ST_lp27",
    contentName: "CORE vitalício (LP 27,90)", urlPadrao: "https://www.coreaplicativo.com.br/pra-sempre",
  },
  oferta: {
    pagina: "oferta", centavos: 6790, idem: "oferta", descricao: "CORE vitalicio", parcelasMax: 12, offer: "ST_oferta",
    contentName: "CORE vitalício (Stripe)", urlPadrao: "https://www.coreaplicativo.com.br/oferta",
  },
  /** 22/11 (ORGANIZAR_STRIPE, chave do <head>): o /organizar pagando pelo MESMO checkout Stripe da /oferta — vitalício R$ 27,90, Pix + cartão.
   *  Só este valor nesta página; a página só diz pagina "organizar" (o preço nunca vem dela). Chave off = o /organizar com o Pix do Asaas. */
  organizar: {
    // 23/11 (dono): 27,90 → 19,90. Chave de idempotência nova ("organizar19-<ref>") pra não bater no pedido antigo de 2790 da mesma ref;
    // o 2790 gerado antes da troca ainda libera no webhook (aceitaTambem).
    pagina: "organizar", centavos: 1990, idem: "organizar19", descricao: "CORE vitalicio", parcelasMax: 1, offer: "ST_organizar",
    contentName: "CORE vitalício (organizar Stripe)", urlPadrao: "https://www.coreaplicativo.com.br/organizar", aceitaTambem: [2790],
  },
  /** 23/11 (dono: /tudo a 19,90): linha PRÓPRIA da /tudo (antes ela usava a "lp27" da /pra-sempre, que segue 27,90). Mesma função
   *  stripe-lp27-criar. O /tudo velho (pagina "lp27", 2790) continua liberando pela linha lp27. */
  tudo: {
    pagina: "tudo", centavos: 1990, idem: "tudo19", descricao: "CORE vitalicio", parcelasMax: 1, offer: "ST_tudo",
    contentName: "CORE vitalício (/tudo)", urlPadrao: "https://www.coreaplicativo.com.br/tudo",
  },
  /** 23/11 (dono: "sobe o /dia a 19,90 também"): linha PRÓPRIA da /dia (a "versão CORE do Porquim"). Mesma função stripe-lp27-criar.
   *  Página nova, nunca vendeu a outro preço: não tem valor antigo pra aceitar. */
  dia: {
    pagina: "dia", centavos: 1990, idem: "dia19", descricao: "CORE vitalicio", parcelasMax: 1, offer: "ST_dia",
    contentName: "CORE vitalício (/dia)", urlPadrao: "https://www.coreaplicativo.com.br/dia",
  },
  /** 23/11 (página do carrossel 2027, chave PAGINA_2027 em 2027.html): linha PRÓPRIA da /2027 — vitalício R$ 27,90, Pix + cartão à
   *  vista, pela mesma função stripe-lp27-criar. O valor tem que bater com PRECO_2027_CENTAVOS (src/p2027/preco.ts): em produção a
   *  página só deixa pagar se o criar devolver o MESMO valor. Mudar o preço = mudar os dois + subir as funções. */
  p2027: {
    pagina: "p2027", centavos: 2790, idem: "p2027", descricao: "CORE vitalicio", parcelasMax: 1, offer: "ST_p2027",
    contentName: "CORE vitalício (/2027)", urlPadrao: "https://www.coreaplicativo.com.br/2027",
  },
  app_web: {
    pagina: "app_web", centavos: 9790, idem: "appweb", descricao: "CORE vitalicio", parcelasMax: 3, offer: "ST_app_web",
    contentName: "CORE vitalício (funil app web)", urlPadrao: "https://www.coreaplicativo.com.br/funil-app",
  },
  /** 18/11 (/escolha, chave PLANOS_PAGINA): o vitalício da página dos 2 planos — R$ 97,90, Pix + cartão até 12x */
  planos: {
    pagina: "planos", centavos: 9790, idem: "planos", descricao: "CORE vitalicio", parcelasMax: 12, offer: "ST_planos",
    contentName: "CORE vitalício (planos)", urlPadrao: "https://www.coreaplicativo.com.br/escolha",
  },
};

/**
 * 22/11 (AB_PRECO_OFERTA, sorteio de preço da /oferta): os ÚNICOS 3 valores que a /oferta pode cobrar. A página manda só QUAL braço
 * (braco_preco "2790" | "4790" | "6790"); qualquer outro número é recusado (400). Sem braço = a /oferta de sempre (6790, nada muda).
 * O stripe-criar grava o braço na metadata do PI (metadata[braco_preco]) e o webhook só libera 2790/4790 quando o valor pago bate com
 * o braço gravado. 2790 e 4790 só são CRIADOS com a env PRECO_OFERTA_SERVIDOR=on no Supabase (a trava do servidor).
 */
export const BRACOS_PRECO_OFERTA = [2790, 4790, 6790] as const;
export type BracoPrecoOferta = (typeof BRACOS_PRECO_OFERTA)[number];
export const ENV_PRECO_OFERTA_SERVIDOR = "PRECO_OFERTA_SERVIDOR";
/** "2790" | 2790 → 2790; qualquer outra coisa → null (nunca um valor arbitrário) */
export function bracoPrecoValido(v: unknown): BracoPrecoOferta | null {
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  if (!/^\d{4}$/.test(s)) return null;
  const n = Number(s);
  return (BRACOS_PRECO_OFERTA as readonly number[]).includes(n) ? (n as BracoPrecoOferta) : null;
}
/**
 * o valor que o webhook aceita pra uma venda da /oferta, pela metadata do PI: sem braco_preco = 6790 (como sempre);
 * com braco_preco válido = aquele valor; braco_preco presente mas fora dos 3 = null (ignora a venda).
 */
export function valorEsperadoOferta(md: Record<string, string | undefined>): number | null {
  if (md.braco_preco === undefined || md.braco_preco === "") return OFERTAS_STRIPE.oferta.centavos;
  return bracoPrecoValido(md.braco_preco);
}
/** o servidor pode criar este braço? 6790 (ou sem braço) sempre; 2790/4790 só com PRECO_OFERTA_SERVIDOR=on */
export const bracoPrecoLiberado = (braco: BracoPrecoOferta | null, env: string | null | undefined): boolean =>
  braco === null || braco === OFERTAS_STRIPE.oferta.centavos || env === "on";

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

export type MensalStripe = {
  pagina: string; centavos: number; envPreco: string; offer: string; contentName: string; urlPadrao: string; apiVersion: string;
};

/**
 * 18/11 (/escolha): o MENSAL da página dos 2 planos. Mesmo preço da Stripe (STRIPE_PRECO_MENSAL_34, R$ 34,90/mês) e as mesmas regras
 * de acesso do mensal do /funil-app (a MESMA linha de subscriptions: plan/billing_period "monthly", payment_method "stripe").
 * Cartão (Subscription com card) ou Pix Automático (Subscription com pix + mandato: chave PLANOS_PIX_MENSAL na página E env
 * STRIPE_PIX_RECORRENTE=on no servidor).
 */
export const MENSAL_PLANOS: MensalStripe = {
  pagina: "planos_mensal",
  centavos: 3490,
  envPreco: "STRIPE_PRECO_MENSAL_34",
  offer: "ST_planos_mensal",
  contentName: "CORE mensal (planos)",
  urlPadrao: "https://www.coreaplicativo.com.br/escolha",
  apiVersion: "2024-06-20",
};

/** os mensais que a Stripe cobra (metadata.pagina da assinatura → regra). Fora desta tabela o webhook só loga. */
export const MENSAIS_STRIPE: Record<string, MensalStripe> = {
  app_web_mensal: MENSAL_APP_WEB,
  planos_mensal: MENSAL_PLANOS,
};
export const mensalDaPagina = (pagina: unknown): MensalStripe | null =>
  typeof pagina === "string" && Object.prototype.hasOwnProperty.call(MENSAIS_STRIPE, pagina) ? MENSAIS_STRIPE[pagina] : null;

/**
 * 18/11: Pix Automático na assinatura (docs.stripe.com/billing/subscriptions/pix). A doc de hoje usa a versão nova da API (a fatura
 * não tem mais `payment_intent`: o PI vem em `latest_invoice.payments` e o segredo em `latest_invoice.confirmation_secret`). Só as
 * chamadas do Pix mensal usam esta versão; o resto segue na 2024-06-20 (o que já está no ar).
 */
export const API_PIX_AUTOMATICO = "2026-10-28.endive";

/**
 * 18/11 (indique e ganhe na /escolha): comissão FIXA por venda indicada nesta página (dono: R$ 33,95). No vitalício nasce na compra;
 * no mensal, só no 2º pagamento pago da assinatura.
 */
export const COMISSAO_FIXA_PLANOS_CENTS = 3395;

/** o preço da Stripe confere com o mensal (R$ 34,90 BRL, mensal, recorrente)? Trava contra env com o preço errado. */
export function precoMensalConfere(p: unknown): boolean {
  const x = (p ?? {}) as { unit_amount?: unknown; currency?: unknown; recurring?: { interval?: unknown; interval_count?: unknown } | null; active?: unknown };
  return x.unit_amount === MENSAL_APP_WEB.centavos && x.currency === "brl" && x.recurring?.interval === "month"
    && (x.recurring?.interval_count ?? 1) === 1 && x.active !== false;
}
