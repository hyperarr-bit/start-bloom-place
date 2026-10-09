/**
 * PROGRAMA DE AFILIADOS — a conta, pura (09/10/2026).
 *
 * Sem Deno, sem Supabase, sem rede: só regras. Testada no vitest
 * (src/test/afiliados.test.ts) e importada pelo revenuecat-webhook (que grava
 * a venda) e pela função `afiliados` (painel + Pix semanal).
 *
 * O QUE CASA A VENDA COM A AFILIADA. Cada afiliada é uma OFERTA DE CÓDIGO da
 * App Store no core_anual_97 (7 dias grátis) cujo nome de referência É o
 * código dela (ex.: "BIA"), com um custom code igual. A Apple põe no
 * Transaction.offerID "the reference name of the offer code" (doc do StoreKit,
 * Transaction/offerID) — por isso a oferta é uma por afiliada, e não uma
 * oferta geral com vários códigos: nesse desenho todas as vendas chegariam
 * com o MESMO nome e ninguém saberia de quem foi. O RevenueCat repassa esse
 * valor no campo `offer_code` do webhook ("Offer or promotion code used for
 * the transaction… Available for App Store and Google Play").
 *
 * UMA LINHA POR ASSINATURA. A chave é o `original_transaction_id` do
 * RevenueCat — é o mesmo do começo do teste até o reembolso, então teste →
 * 1ª cobrança → reembolso são ESTADOS de uma linha só. É isso que faz o
 * webhook ser idempotente: evento repetido encontra a linha no estado em que
 * ele mesmo a deixou e não muda nada.
 *
 * COMISSÃO: 50% do 1º pagamento LÍQUIDO. Renovação não paga. Líquido = o que
 * a Apple repassa: tabela oficial dos preços conhecidos (97,90 → 80,30;
 * 69,90 → 57,34 — proceeds lidos da API da ASC em 18/09 e 01/10), senão as
 * porcentagens estimadas que o RevenueCat manda (tax_percentage e
 * commission_percentage), senão a razão 80,30/97,90. Nunca "85%".
 */

export const PCT_COMISSAO = 0.5;
/** Vendas confirmadas há menos que isso ainda não entram no Pix (janela de reembolso). */
export const DIAS_CARENCIA = 7;
export const LIMITE_SEMANAL_PADRAO_CENTS = 50_000;

/** Bruto → líquido oficial da Apple (BRL). Fonte: /pricePoints da ASC. */
export const LIQUIDO_OFICIAL_CENTS: Record<number, number> = {
  9790: 8030,
  6990: 5734,
};
/** Preço cheio por produto, pra quando o evento não traz valor em BRL. */
export const BRUTO_POR_PRODUTO_CENTS: Record<string, number> = {
  core_anual_97: 9790,
  core_anual_69: 6990,
};
const RAZAO_LIQUIDA_PADRAO = 8030 / 9790;

export type StatusVenda = "em_teste" | "pago" | "reembolsado" | "recusado";
export type Plataforma = "ios" | "android";

export interface Venda {
  id?: string;
  afiliado_id: string;
  user_id: string | null;
  plataforma: Plataforma;
  transaction_id: string;
  transaction_id_cobranca: string | null;
  produto: string;
  valor_bruto_cents: number | null;
  valor_liquido_cents: number | null;
  comissao_cents: number;
  status: StatusVenda;
  motivo: string | null;
  cobrado_em: string | null;
  pagamento_id?: string | null;
  criado_em?: string;
}

/** O que a gente lê do evento do RevenueCat (nomes do webhook, v1). */
export interface EventoRC {
  type?: string;
  store?: string;
  product_id?: string;
  offer_code?: string | null;
  period_type?: string;
  price?: number | null;
  price_in_purchased_currency?: number | null;
  currency?: string | null;
  transaction_id?: string | null;
  original_transaction_id?: string | null;
  is_trial_conversion?: boolean | null;
  renewal_number?: number | null;
  cancel_reason?: string | null;
  purchased_at_ms?: number | null;
  event_timestamp_ms?: number | null;
  app_user_id?: string | null;
  original_app_user_id?: string | null;
  aliases?: string[] | null;
  tax_percentage?: number | null;
  commission_percentage?: number | null;
}

/** "bia", " Bia ", "AFILIADA_BIA"? — não: só maiúsculo e sem nada que não seja letra/número. */
export const normalizarCodigo = (s: unknown): string | null => {
  const c = String(s ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length >= 3 && c.length <= 64 ? c : null;
};

export const comissaoCents = (liquidoCents: number): number => Math.max(0, Math.round(liquidoCents * PCT_COMISSAO));

export function liquidoCents(brutoCents: number, ev?: Pick<EventoRC, "tax_percentage" | "commission_percentage">): number {
  if (LIQUIDO_OFICIAL_CENTS[brutoCents]) return LIQUIDO_OFICIAL_CENTS[brutoCents];
  const tax = typeof ev?.tax_percentage === "number" ? ev.tax_percentage : null;
  const com = typeof ev?.commission_percentage === "number" ? ev.commission_percentage : null;
  if (tax !== null && com !== null && tax >= 0 && com >= 0 && tax < 100 && com < 100) {
    // imposto sai do preço, a comissão da loja sai do que sobrou
    return Math.round(brutoCents * (1 - tax / 100) * (1 - com / 100));
  }
  return Math.round(brutoCents * RAZAO_LIQUIDA_PADRAO);
}

/** Bruto em centavos de BRL: o preço do evento se veio em BRL, senão o preço cheio do produto. */
export function brutoCents(ev: EventoRC): number | null {
  const p = ev.price_in_purchased_currency;
  if (typeof p === "number" && p > 0 && String(ev.currency ?? "").toUpperCase() === "BRL") return Math.round(p * 100);
  const porProduto = Object.keys(BRUTO_POR_PRODUTO_CENTS)
    .filter((k) => String(ev.product_id ?? "").startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return porProduto ? BRUTO_POR_PRODUTO_CENTS[porProduto] : null;
}

export const plataformaDaLoja = (store: unknown): Plataforma | null => {
  const s = String(store ?? "").toUpperCase();
  if (s === "APP_STORE" || s === "MAC_APP_STORE") return "ios";
  if (s === "PLAY_STORE") return "android";
  return null;
};

export type Decisao =
  | { tipo: "ignorar"; motivo: string }
  | {
      tipo: "em_teste" | "pago" | "reembolsado" | "recusado" | "voltou_ao_teste" | "reembolso_desfeito";
      chave: string;
      codigo: string | null;
      plataforma: Plataforma;
      produto: string;
      userId: string | null;
      quando: string;
      txCobranca: string | null;
      bruto: number | null;
      liquido: number | null;
      motivo: string | null;
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uidDoEvento = (ev: EventoRC): string | null =>
  [ev.app_user_id, ev.original_app_user_id, ...(ev.aliases ?? [])].find((x): x is string => typeof x === "string" && UUID.test(x)) ?? null;

/** Lê o evento e diz o que ele significa pro programa — sem olhar o banco. */
export function classificarEvento(ev: EventoRC): Decisao {
  const plataforma = plataformaDaLoja(ev.store);
  if (!plataforma) return { tipo: "ignorar", motivo: "loja_fora_do_programa" };
  const chave = String(ev.original_transaction_id || ev.transaction_id || "").trim();
  if (!chave) return { tipo: "ignorar", motivo: "sem_transaction_id" };
  const base = {
    chave,
    codigo: normalizarCodigo(ev.offer_code),
    plataforma,
    produto: String(ev.product_id ?? ""),
    userId: uidDoEvento(ev),
    quando: new Date(ev.purchased_at_ms ?? ev.event_timestamp_ms ?? Date.now()).toISOString(),
    txCobranca: null as string | null,
    bruto: null as number | null,
    liquido: null as number | null,
    motivo: null as string | null,
  };
  const tipo = String(ev.type ?? "");
  const preco = typeof ev.price_in_purchased_currency === "number" ? ev.price_in_purchased_currency : (typeof ev.price === "number" ? ev.price : null);
  const periodo = String(ev.period_type ?? "").toUpperCase();

  if (tipo === "INITIAL_PURCHASE") {
    if (periodo === "TRIAL" || preco === 0 || preco === null) return { tipo: "em_teste", ...base };
    // comprou direto com código sem teste (não é o desenho, mas se vier, é a 1ª cobrança)
    const bruto = brutoCents(ev);
    return { tipo: "pago", ...base, txCobranca: String(ev.transaction_id ?? "") || null, bruto, liquido: bruto === null ? null : liquidoCents(bruto, ev) };
  }
  if (tipo === "RENEWAL") {
    // A 1ª cobrança de quem fez o teste chega como RENEWAL (is_trial_conversion).
    // Quem decide se é a primeira é o estado da linha (aplicarDecisao): uma
    // renovação de verdade (linha já paga) não muda nada.
    const bruto = brutoCents(ev);
    if (preco !== null && preco <= 0) return { tipo: "ignorar", motivo: "renewal_sem_valor" };
    return { tipo: "pago", ...base, txCobranca: String(ev.transaction_id ?? "") || null, bruto, liquido: bruto === null ? null : liquidoCents(bruto, ev) };
  }
  if (tipo === "CANCELLATION") {
    const razao = String(ev.cancel_reason ?? "").toUpperCase();
    if (razao === "CUSTOMER_SUPPORT" || (preco !== null && preco < 0)) return { tipo: "reembolsado", ...base, motivo: "reembolso" };
    if (razao === "BILLING_ERROR") return { tipo: "recusado", ...base, motivo: "cartao_recusado" };
    // desligou a renovação: durante o teste quer dizer que não vai pagar
    return { tipo: "recusado", ...base, motivo: "cancelou_no_teste" };
  }
  if (tipo === "UNCANCELLATION") return { tipo: "voltou_ao_teste", ...base };
  if (tipo === "BILLING_ISSUE") return { tipo: "recusado", ...base, motivo: "cartao_recusado" };
  if (tipo === "EXPIRATION") return { tipo: "recusado", ...base, motivo: "nao_pagou" };
  if (tipo === "REFUND_REVERSED") return { tipo: "reembolso_desfeito", ...base };
  return { tipo: "ignorar", motivo: `tipo_${tipo || "vazio"}` };
}

export type Aplicacao =
  | { acao: "nada"; motivo: string }
  | { acao: "inserir"; linha: Venda }
  | { acao: "atualizar"; id: string; campos: Partial<Venda> };

/**
 * Decisão × linha existente → o que gravar. `afiliadoId` é o dono do código
 * do evento (null se o código não é de ninguém). Idempotente: aplicar o mesmo
 * evento duas vezes dá "nada" na segunda.
 */
export function aplicarDecisao(d: Decisao, existente: Venda | null, afiliadoId: string | null): Aplicacao {
  if (d.tipo === "ignorar") return { acao: "nada", motivo: d.motivo };
  const nova = (status: StatusVenda, extra: Partial<Venda> = {}): Venda => ({
    afiliado_id: afiliadoId as string,
    user_id: d.userId,
    plataforma: d.plataforma,
    transaction_id: d.chave,
    transaction_id_cobranca: null,
    produto: d.produto,
    valor_bruto_cents: null,
    valor_liquido_cents: null,
    comissao_cents: 0,
    status,
    motivo: null,
    cobrado_em: null,
    ...extra,
  });
  const camposCobranca = (): Partial<Venda> => ({
    status: "pago",
    transaction_id_cobranca: d.txCobranca,
    valor_bruto_cents: d.bruto,
    valor_liquido_cents: d.liquido,
    comissao_cents: d.liquido === null ? 0 : comissaoCents(d.liquido),
    cobrado_em: d.quando,
    motivo: null,
  });
  // o user_id pode chegar só mais tarde (a compra é anônima no começo)
  const completarUid = (): Partial<Venda> => (existente && !existente.user_id && d.userId ? { user_id: d.userId } : {});

  if (!existente) {
    if (!afiliadoId) return { acao: "nada", motivo: d.codigo ? "codigo_desconhecido" : "sem_codigo" };
    if (d.tipo === "em_teste") return { acao: "inserir", linha: nova("em_teste") };
    if (d.tipo === "pago") {
      if (d.liquido === null) return { acao: "nada", motivo: "sem_valor" };
      return { acao: "inserir", linha: nova("pago", camposCobranca()) };
    }
    // reembolso/recusa de uma assinatura que a gente nunca viu começar: não há o que desfazer
    return { acao: "nada", motivo: "sem_linha_anterior" };
  }

  const id = existente.id as string;
  switch (d.tipo) {
    case "em_teste":
      return Object.keys(completarUid()).length ? { acao: "atualizar", id, campos: completarUid() } : { acao: "nada", motivo: "ja_registrado" };
    case "pago":
      if (existente.status === "pago") return { acao: "nada", motivo: "renovacao_ou_repetido" };
      if (existente.status === "reembolsado") return { acao: "nada", motivo: "ja_reembolsado" };
      if (d.liquido === null) return { acao: "nada", motivo: "sem_valor" };
      // em_teste ou recusado (cartão que depois passou) → 1ª cobrança
      return { acao: "atualizar", id, campos: { ...camposCobranca(), ...completarUid() } };
    case "reembolsado":
      if (existente.status === "reembolsado") return { acao: "nada", motivo: "ja_reembolsado" };
      return { acao: "atualizar", id, campos: { status: "reembolsado", motivo: "reembolso", ...completarUid() } };
    case "recusado":
      // só derruba quem ainda não pagou; quem pagou e depois cancelou a renovação continua pago
      if (existente.status !== "em_teste") return { acao: "nada", motivo: `ja_${existente.status}` };
      return { acao: "atualizar", id, campos: { status: "recusado", motivo: d.motivo, ...completarUid() } };
    case "voltou_ao_teste":
      if (existente.status !== "recusado" || existente.motivo !== "cancelou_no_teste") return { acao: "nada", motivo: "nao_se_aplica" };
      return { acao: "atualizar", id, campos: { status: "em_teste", motivo: null } };
    case "reembolso_desfeito":
      if (existente.status !== "reembolsado" || !existente.cobrado_em) return { acao: "nada", motivo: "nao_se_aplica" };
      return { acao: "atualizar", id, campos: { status: "pago", motivo: null } };
  }
}

/* ------------------------------------------------------------ calendário (Brasília, UTC−3) */

const BRT_OFFSET_MS = 3 * 3600_000;
const HORA_PIX_BRT = 9;

/** Dia de Brasília "YYYY-MM-DD" de um instante. */
export const diaBRT = (iso: string | Date): string => new Date(new Date(iso).getTime() - BRT_OFFSET_MS).toISOString().slice(0, 10);

/** A próxima segunda às 9h de Brasília estritamente depois de `agora` (ou a de hoje, se ainda não deu 9h). */
export function proximaSegunda(agora: Date): Date {
  const local = new Date(agora.getTime() - BRT_OFFSET_MS); // "relógio de Brasília" em UTC
  const dow = local.getUTCDay(); // 0 dom … 1 seg
  let diasAte = (1 - dow + 7) % 7;
  const candidato = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + diasAte, HORA_PIX_BRT, 0, 0) + BRT_OFFSET_MS;
  if (candidato <= agora.getTime()) diasAte += 7;
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + diasAte, HORA_PIX_BRT, 0, 0) + BRT_OFFSET_MS);
}

/** A segunda-feira da semana (Brasília) em que `agora` cai — "YYYY-MM-DD"; rótulo do pagamento. */
export function segundaDaSemana(agora: Date): string {
  const local = new Date(agora.getTime() - BRT_OFFSET_MS);
  const recuo = (local.getUTCDay() + 6) % 7; // seg 0 … dom 6
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - recuo)).toISOString().slice(0, 10);
}

/** Em que segunda uma venda cobrada em `cobradoEm` entra no Pix: a primeira segunda 9h ≥ cobrança + 7 dias. */
export function dataPrevistaPagamento(cobradoEm: string, diasCarencia = DIAS_CARENCIA): Date {
  const libera = new Date(new Date(cobradoEm).getTime() + diasCarencia * 86400_000);
  return proximaSegunda(new Date(libera.getTime() - 1));
}

export const elegivelParaPagar = (v: Pick<Venda, "status" | "cobrado_em" | "pagamento_id">, agora: Date, diasCarencia = DIAS_CARENCIA): boolean =>
  v.status === "pago" && !v.pagamento_id && !!v.cobrado_em && new Date(v.cobrado_em).getTime() <= agora.getTime() - diasCarencia * 86400_000;

/* ------------------------------------------------------------ Pix semanal */

export interface AfiliadoResumido {
  id: string;
  nome: string;
  codigo: string;
  pausado: boolean;
  limite_semanal_cents: number;
}

export interface PlanoPagamento {
  afiliado_id: string;
  total_cents: number;
  vendas_ids: string[];
  decisao: "pagar" | "segurar" | "pausado";
  motivo: string | null;
}

/**
 * Quem recebe quanto nesta segunda. Só vendas `pago`, sem pagamento, com
 * 7+ dias de cobrança. Afiliada pausada: nada (as vendas ficam esperando).
 * Acima do limite semanal: SEGURA tudo da semana (o dono libera no /admin).
 */
export function planejarSemana(
  afiliados: AfiliadoResumido[],
  vendas: Array<Pick<Venda, "id" | "afiliado_id" | "status" | "cobrado_em" | "pagamento_id" | "comissao_cents">>,
  agora: Date,
  diasCarencia = DIAS_CARENCIA,
): PlanoPagamento[] {
  const porAfiliado = new Map<string, { total: number; ids: string[] }>();
  for (const v of vendas) {
    if (!elegivelParaPagar(v, agora, diasCarencia) || !v.id || v.comissao_cents <= 0) continue;
    const acc = porAfiliado.get(v.afiliado_id) ?? { total: 0, ids: [] };
    acc.total += v.comissao_cents;
    acc.ids.push(v.id);
    porAfiliado.set(v.afiliado_id, acc);
  }
  const planos: PlanoPagamento[] = [];
  for (const a of afiliados) {
    const acc = porAfiliado.get(a.id);
    if (!acc || acc.total <= 0) continue;
    if (a.pausado) planos.push({ afiliado_id: a.id, total_cents: acc.total, vendas_ids: acc.ids, decisao: "pausado", motivo: "afiliada_pausada" });
    else if (acc.total > a.limite_semanal_cents) planos.push({ afiliado_id: a.id, total_cents: acc.total, vendas_ids: acc.ids, decisao: "segurar", motivo: `acima_do_limite_${a.limite_semanal_cents}` });
    else planos.push({ afiliado_id: a.id, total_cents: acc.total, vendas_ids: acc.ids, decisao: "pagar", motivo: null });
  }
  return planos;
}

/* ------------------------------------------------------------ painel da afiliada (sem dado de cliente) */

export interface PagamentoResumido {
  id?: string;
  valor_cents: number;
  status: "enviando" | "enviado" | "falhou" | "segurado";
  criado_em: string;
}

export interface LinhaPainel {
  /** dia da cobrança (ou do começo do teste), "YYYY-MM-DD" em Brasília */
  dia: string;
  comissao_cents: number;
  situacao: "em_teste" | "prevista" | "paga" | "segurada" | "reembolsada" | "nao_pagou";
  /** "YYYY-MM-DD": quando foi/será paga */
  pagamento_dia: string | null;
}

export interface ResumoPainel {
  usaram: number;
  em_teste: number;
  pagaram: number;
  reembolsadas: number;
  nao_pagaram: number;
  a_receber_cents: number;
  ja_recebido_cents: number;
  segurado_cents: number;
  proximo_pagamento: { dia: string; valor_cents: number };
  linhas: LinhaPainel[];
}

/**
 * Agregados pro painel público. Recebe só colunas sem identidade (status,
 * valores, datas) — e devolve menos ainda. Nada aqui sabe quem é o cliente.
 */
export function resumoPainel(
  vendas: Array<Pick<Venda, "status" | "comissao_cents" | "cobrado_em" | "criado_em" | "pagamento_id">>,
  pagamentos: PagamentoResumido[],
  agora: Date,
  diasCarencia = DIAS_CARENCIA,
): ResumoPainel {
  const pagoPorId = new Map(pagamentos.filter((p) => p.id).map((p) => [p.id as string, p]));
  const proxima = proximaSegunda(agora);
  let aReceber = 0;
  let valorProxima = 0;
  const linhas: LinhaPainel[] = [];
  const r = { usaram: 0, em_teste: 0, pagaram: 0, reembolsadas: 0, nao_pagaram: 0 };
  for (const v of vendas) {
    r.usaram++;
    const dia = diaBRT(v.cobrado_em ?? v.criado_em ?? agora);
    if (v.status === "em_teste") { r.em_teste++; linhas.push({ dia, comissao_cents: 0, situacao: "em_teste", pagamento_dia: null }); continue; }
    if (v.status === "recusado") { r.nao_pagaram++; linhas.push({ dia, comissao_cents: 0, situacao: "nao_pagou", pagamento_dia: null }); continue; }
    if (v.status === "reembolsado") { r.reembolsadas++; linhas.push({ dia, comissao_cents: 0, situacao: "reembolsada", pagamento_dia: null }); continue; }
    r.pagaram++;
    const pg = v.pagamento_id ? pagoPorId.get(v.pagamento_id) : undefined;
    if (pg && pg.status === "enviado") { linhas.push({ dia, comissao_cents: v.comissao_cents, situacao: "paga", pagamento_dia: diaBRT(pg.criado_em) }); continue; }
    aReceber += v.comissao_cents;
    if (pg && pg.status === "segurado") { linhas.push({ dia, comissao_cents: v.comissao_cents, situacao: "segurada", pagamento_dia: null }); continue; }
    const prevista = v.cobrado_em ? dataPrevistaPagamento(v.cobrado_em, diasCarencia) : proxima;
    if (prevista.getTime() <= proxima.getTime()) valorProxima += v.comissao_cents;
    linhas.push({ dia, comissao_cents: v.comissao_cents, situacao: "prevista", pagamento_dia: diaBRT(prevista) });
  }
  linhas.sort((a, b) => (a.dia < b.dia ? 1 : a.dia > b.dia ? -1 : 0));
  return {
    ...r,
    a_receber_cents: aReceber,
    ja_recebido_cents: pagamentos.filter((p) => p.status === "enviado").reduce((s, p) => s + p.valor_cents, 0),
    segurado_cents: pagamentos.filter((p) => p.status === "segurado").reduce((s, p) => s + p.valor_cents, 0),
    proximo_pagamento: { dia: diaBRT(proxima), valor_cents: valorProxima },
    linhas,
  };
}

/** Link que a afiliada divulga (resgate do código na App Store). */
export const linkResgate = (codigo: string, appId = "6806913181"): string =>
  `https://apps.apple.com/redeem?ctx=offercodes&id=${appId}&code=${encodeURIComponent(codigo)}`;
