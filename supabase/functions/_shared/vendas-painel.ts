/**
 * PAINEL /vendas (29/10) — as contas puras do Turmas · Campanhas · Web · Vendas (testadas em src/test/vendas-painel.test.ts).
 *
 * Cópia da régua dos scripts de métricas do dono (~/core/ferramentas-sessao/metricas: coleta.mjs, dia.mjs,
 * raio-x/base-turmas.mjs, CONTEXTO do raio-x 27/10), sem métrica nova:
 *   · TURMA = testes anuais do iPhone (linha da loja com tx subAap…/otpA… e billing "annual") criados no dia D em BRT;
 *     a cobrança cai em D+3. Desfecho pelo RevenueCat (desfecho() do coleta.mjs: receita > 0 = pagou).
 *   · ROI da turma = líquido de quem pagou (Apple BR: 97,90→80,30 · 69,90→57,34 · 24,90→20,42; resto ×0,82; Play ×0,85)
 *     ÷ gasto das campanhas de APP do dia D nas 2 contas. O mensal do iPhone criado no dia D entra na turma (retro-turmas.mjs).
 *   · TESTES da Meta ficam em `conversions` (start_trial_total), NÃO em `actions`.
 *   · WEB = vendas Pix do banco (amount_cents, e-mails de teste fora) ÷ gasto das campanhas de SITE.
 *   · Landing /organizar: sessões = landing_session_id distintos; robô de revisão = utm_term com "Right_Column".
 * Nada de e-mail/id de usuário na saída.
 */
import { diaBRT, ehEmailTeste, lojaDoTx, somaDias, vendaLoja, vendaPix, type LinhaSub, type Origem } from "./aviso-venda.ts";

/* ------------------------------------------------------------------ dinheiro */

const LIQUIDO_APPLE: Record<number, number> = { 9790: 8030, 6990: 5734, 2490: 2042 };
export function liquidoCents(cents: number, loja: "apple" | "play"): number {
  if (loja === "play") return Math.round(cents * 0.85);
  return LIQUIDO_APPLE[cents] ?? Math.round(cents * 0.82);
}

export type Cor = "verde" | "amarelo" | "vermelho" | "neutro";
export const corRetorno = (r: number | null | undefined): Cor =>
  r === null || r === undefined || !Number.isFinite(r) ? "neutro" : r >= 2 ? "verde" : r >= 1 ? "amarelo" : "vermelho";

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const r2 = (x: number | null): number | null => (x === null ? null : Math.round(x * 100) / 100);

/* ------------------------------------------------------------------ turmas */

export type EstadoRC = { status: string | null; renova: string | null; gross: number };

/** desfecho() do coleta.mjs, igual. */
export function desfecho(rc: EstadoRC | null | undefined): string {
  if (!rc) return "?";
  if (rc.gross > 0) return "pagou";
  if (rc.status === "trialing") return rc.renova === "will_not_renew" ? "teste_ja_cancelou" : "teste_vai_renovar";
  if (rc.status === "in_grace_period") return "recusada_carencia";
  if (rc.status === "in_billing_retry") return "recusada_retry";
  if (rc.status === "expired") return "expirou";
  if (rc.status === "active") return "ativo_sem_receita";
  return rc.status ?? "?";
}

export type LinhaLoja = { uid: string; tx: string; loja: "apple" | "play"; tipo: string; billing: string; cents: number; criada: number; dia: string };

/** assinaturas() do coleta.mjs: só linhas da loja, e-mails internos/teste fora. */
export function normalizarLoja(linhas: LinhaSub[], uidsInternos: Set<string> = new Set()): LinhaLoja[] {
  const out: LinhaLoja[] = [];
  for (const r of linhas) {
    if (r.payment_method !== "play_store") continue;
    if (ehEmailTeste(r.customer_email) || (r.user_id && uidsInternos.has(r.user_id))) continue;
    const tx = r.revenuecat_subscription_id ?? "";
    const loja = lojaDoTx(tx);
    const billing = r.billing_period ?? "";
    const criada = Date.parse(r.created_at ?? "");
    out.push({ uid: r.user_id ?? "", tx, loja, tipo: billing === "annual" && loja === "apple" ? "teste_anual" : billing, billing, cents: Number(r.amount_cents ?? 0), criada, dia: diaBRT(criada) });
  }
  return out;
}

export type Turma = {
  dia: string;
  situacao: "fecha_hoje" | "aberta";
  fechaEm: string;
  testes: number;
  pagaram: number;
  pctPagaram: number | null;
  recusas: number;
  cancelaram: number;
  emTeste: number;
  outros: number;
  mensais: number;
  gasto: number;
  custoPorTeste: number | null;
  liquido: number;
  retorno: number | null;
  cor: Cor;
};

/** A turma que fecha hoje (D = hoje−3) e as abertas (D−2, D−1, hoje). */
export function montarTurmas(linhas: LinhaLoja[], rc: Map<string, EstadoRC>, gastoAppPorDia: Record<string, number>, hoje: string): Turma[] {
  const out: Turma[] = [];
  for (let k = 3; k >= 0; k--) {
    const dia = somaDias(hoje, -k);
    const doDia = linhas.filter((l) => l.dia === dia && l.loja === "apple");
    const testes = doDia.filter((l) => l.tipo === "teste_anual");
    let pagaram = 0, recusas = 0, cancelaram = 0, emTeste = 0, outros = 0, liq = 0;
    for (const t of testes) {
      const d = desfecho(rc.get(t.tx));
      if (d === "pagou") { pagaram++; liq += liquidoCents(t.cents, "apple"); }
      else if (d === "recusada_carencia" || d === "recusada_retry") recusas++;
      else if (d === "teste_ja_cancelou" || d === "expirou") cancelaram++;
      else if (d === "teste_vai_renovar") emTeste++;
      else outros++;
    }
    const mensaisPagos = doDia.filter((l) => l.billing === "monthly" && desfecho(rc.get(l.tx)) === "pagou");
    for (const m of mensaisPagos) liq += liquidoCents(m.cents, "apple");
    const gasto = Math.round((gastoAppPorDia[dia] ?? 0) * 100) / 100;
    const liquido = liq / 100;
    const retorno = div(liquido, gasto);
    out.push({
      dia,
      situacao: k === 3 ? "fecha_hoje" : "aberta",
      fechaEm: somaDias(dia, 3),
      testes: testes.length,
      pagaram,
      pctPagaram: testes.length ? Math.round((pagaram / testes.length) * 1000) / 10 : null,
      recusas,
      cancelaram,
      emTeste,
      outros,
      mensais: mensaisPagos.length,
      gasto,
      custoPorTeste: r2(div(gasto, testes.length)),
      liquido: Math.round(liquido * 100) / 100,
      retorno: r2(retorno),
      // turma aberta ainda não cobrou (a cobrança cai em D+3): o retorno é parcial e não ganha cor de veredito
      cor: k === 3 ? corRetorno(retorno) : "neutro",
    });
  }
  return out;
}

/* ------------------------------------------------------------------ campanhas */

export type Acao = { action_type: string; value: string | number };
export type InsightMeta = {
  campaign_id: string;
  campaign_name: string;
  objective?: string;
  spend?: string | number;
  impressions?: string | number;
  inline_link_clicks?: string | number;
  inline_link_click_ctr?: string | number;
  actions?: Acao[];
  conversions?: Acao[];
  action_values?: Acao[];
  date_start?: string;
};

const pega = (arr: Acao[] | undefined, ...tipos: string[]): number => {
  for (const t of tipos) { const a = (arr ?? []).find((x) => x.action_type === t); if (a) return Number(a.value); }
  return 0;
};
export const testesMeta = (x: InsightMeta) => pega(x.conversions, "start_trial_total", "start_trial_mobile_app", "app_custom_event.fb_mobile_start_trial");
const comprasPixel = (x: InsightMeta) => pega(x.actions, "offsite_conversion.fb_pixel_purchase", "omni_purchase", "purchase");
const valorComprasPixel = (x: InsightMeta) => pega(x.action_values, "offsite_conversion.fb_pixel_purchase", "omni_purchase", "purchase");

const OBJ_APP = new Set(["APP_INSTALLS", "OUTCOME_APP_PROMOTION", "MOBILE_APP_INSTALLS", "MOBILE_APP_ENGAGEMENT"]);
const OBJ_SITE = new Set(["OUTCOME_SALES", "CONVERSIONS", "OUTCOME_TRAFFIC", "LINK_CLICKS", "OUTCOME_LEADS", "LEAD_GENERATION"]);
/** App × site pelo OBJETIVO da campanha (o raio-x: APP_INSTALLS = app, OUTCOME_SALES = web). `siteExtra` = ids à mão. */
export function tipoCampanha(objective: string | undefined, id?: string, siteExtra: string[] = []): "app" | "site" | "outra" {
  if (id && siteExtra.includes(id)) return "site";
  const o = String(objective ?? "").toUpperCase();
  if (OBJ_APP.has(o)) return "app";
  if (OBJ_SITE.has(o)) return "site";
  return "outra";
}

export type InfoCampanha = { id: string; status?: string; effective_status?: string; daily_budget?: string | number | null; lifetime_budget?: string | number | null; bid_strategy?: string | null };
export type LinhaCampanha = {
  nome: string; conta: string; tipo: "app" | "site" | "outra"; status: string; orcamentoDia: number | null;
  gasto: number; impressoes: number; cliques: number; cpm: number | null; ctr: number | null; cpc: number | null;
  testes: number; custoPorTeste: number | null; compras: number; valorCompras: number; roas: number | null; cor: Cor;
};

export function linhaCampanha(x: InsightMeta | null, info: InfoCampanha & { name?: string; objective?: string }, conta: string, siteExtra: string[] = []): LinhaCampanha {
  const gasto = Number(x?.spend ?? 0);
  const imp = Number(x?.impressions ?? 0);
  const cl = Number(x?.inline_link_clicks ?? 0);
  const tipo = tipoCampanha(x?.objective ?? info.objective, info.id, siteExtra);
  const testes = x ? testesMeta(x) : 0;
  const compras = x ? comprasPixel(x) : 0;
  const valor = x ? valorComprasPixel(x) : 0;
  const roas = tipo === "site" ? div(valor, gasto) : null;
  const orc = info.daily_budget ? Number(info.daily_budget) / 100 : null;
  return {
    nome: x?.campaign_name ?? info.name ?? info.id,
    conta,
    tipo,
    status: info.effective_status ?? info.status ?? "?",
    orcamentoDia: orc,
    gasto: Math.round(gasto * 100) / 100,
    impressoes: imp,
    cliques: cl,
    cpm: r2(div(gasto * 1000, imp)),
    ctr: x?.inline_link_click_ctr !== undefined ? r2(Number(x.inline_link_click_ctr)) : r2(div(cl * 100, imp)),
    cpc: r2(div(gasto, cl)),
    testes,
    custoPorTeste: tipo === "app" ? r2(div(gasto, testes)) : null,
    compras,
    valorCompras: Math.round(valor * 100) / 100,
    roas: r2(roas),
    cor: tipo === "site" ? corRetorno(roas) : "neutro",
  };
}

/** Gasto por dia (date_start) das campanhas de um tipo. */
export function gastoPorDia(insights: InsightMeta[], tipo: "app" | "site", siteExtra: string[] = []): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of insights) {
    if (tipoCampanha(x.objective, x.campaign_id, siteExtra) !== tipo || !x.date_start) continue;
    out[x.date_start] = (out[x.date_start] ?? 0) + Number(x.spend ?? 0);
  }
  return out;
}

/* ------------------------------------------------------------------ web */

export type PeriodoWeb = { vendas: number; receita: number; gasto: number; retorno: number | null; cor: Cor };
export function roiWeb(subsPix: LinhaSub[], gastoSite: Record<string, number>, hoje: string): { hoje: PeriodoWeb; semana: PeriodoWeb; dias: Array<PeriodoWeb & { dia: string }> } {
  const porDia: Record<string, { vendas: number; receita: number }> = {};
  for (const s of subsPix) {
    // dia.mjs: payment_method ≠ loja, e-mail de teste fora, valor real (amount_cents) — qualquer status
    if (s.payment_method === "play_store" || ehEmailTeste(s.customer_email)) continue;
    const c = Number(s.amount_cents ?? 0);
    if (!(c > 0)) continue;
    const d = diaBRT(s.created_at ?? "");
    porDia[d] ??= { vendas: 0, receita: 0 };
    porDia[d].vendas++; porDia[d].receita += c / 100;
  }
  const periodo = (dias: string[]): PeriodoWeb => {
    let vendas = 0, receita = 0, gasto = 0;
    for (const d of dias) { vendas += porDia[d]?.vendas ?? 0; receita += porDia[d]?.receita ?? 0; gasto += gastoSite[d] ?? 0; }
    const ret = div(receita, gasto);
    return { vendas, receita: Math.round(receita * 100) / 100, gasto: Math.round(gasto * 100) / 100, retorno: r2(ret), cor: corRetorno(ret) };
  };
  const semana = Array.from({ length: 7 }, (_, i) => somaDias(hoje, -6 + i));
  return { hoje: periodo([hoje]), semana: periodo(semana), dias: semana.map((d) => ({ dia: d, ...periodo([d]) })).reverse() };
}

export type EventoLanding = { event_name: string; sid?: string | null; termo?: string | null; simulado?: string | boolean | null; order_id?: string | null };
/** Funil da landing /organizar: sessões reais → viu a oferta → gerou Pix → pagou. */
export function funilLanding(eventos: EventoLanding[], pedidosPagos: Set<string> = new Set()) {
  const robos = new Set<string>();
  for (const e of eventos) if (e.sid && /right_column/i.test(e.termo ?? "")) robos.add(e.sid);
  const sessoes = new Set<string>(), oferta = new Set<string>(), pix = new Set<string>(), pagou = new Set<string>();
  const simulado = (v: EventoLanding["simulado"]) => v === true || v === "true";
  for (const e of eventos) {
    const s = e.sid;
    if (!s || robos.has(s)) continue;
    sessoes.add(s);
    if (e.event_name === "landing_oferta_vista") oferta.add(s);
    if (e.event_name === "landing_pix_gerado" && !simulado(e.simulado)) { pix.add(s); if (e.order_id && pedidosPagos.has(e.order_id)) pagou.add(s); }
    if (e.event_name === "landing_pix_pago" && !simulado(e.simulado)) pagou.add(s);
  }
  return { sessoes: sessoes.size, viuOferta: oferta.size, gerouPix: pix.size, pagou: pagou.size, robos: robos.size };
}

/* ------------------------------------------------------------------ vendas de hoje */

export type ItemVenda = { hora: string; valor_cents: number; origem: Origem; plano: string; renovacao: boolean };
export function vendasDoDia(
  subsPix: LinhaSub[],
  marcadores: Array<{ event_name: string; event_data: { tx?: string; valor?: number } | null; created_at: string }>,
  linhaPorTx: Map<string, LinhaSub>,
  renovacoes: Array<{ chave: string; origem: Origem; valor_cents: number; plano: string; criado_em: string }>,
  hoje: string,
): { itens: ItemVenda[]; total_cents: number; porOrigem: Record<Origem, { n: number; cents: number }> } {
  const vistas = new Set<string>();
  const itens: ItemVenda[] = [];
  const hora = (t: string) => new Date(Date.parse(t) - 3 * 3600_000).toISOString().slice(11, 16);
  for (const s of subsPix) {
    if (diaBRT(s.created_at ?? "") !== hoje) continue;
    const v = vendaPix(s);
    if (!v || vistas.has(v.chave)) continue;
    vistas.add(v.chave);
    itens.push({ hora: hora(v.quando), valor_cents: v.valor_cents, origem: "pix", plano: v.plano, renovacao: false });
  }
  for (const m of marcadores) {
    if (diaBRT(m.created_at) !== hoje) continue;
    const v = vendaLoja(m, linhaPorTx.get(String(m.event_data?.tx ?? "")) ?? null);
    if (!v || vistas.has(v.chave)) continue;
    vistas.add(v.chave);
    itens.push({ hora: hora(v.quando), valor_cents: v.valor_cents, origem: v.origem, plano: v.plano, renovacao: false });
  }
  for (const r of renovacoes) {
    if (diaBRT(r.criado_em) !== hoje || vistas.has(r.chave)) continue;
    vistas.add(r.chave);
    itens.push({ hora: hora(r.criado_em), valor_cents: r.valor_cents, origem: r.origem, plano: r.plano, renovacao: true });
  }
  itens.sort((a, b) => b.hora.localeCompare(a.hora));
  const porOrigem: Record<Origem, { n: number; cents: number }> = { pix: { n: 0, cents: 0 }, apple: { n: 0, cents: 0 }, play: { n: 0, cents: 0 } };
  for (const i of itens) { porOrigem[i.origem].n++; porOrigem[i.origem].cents += i.valor_cents; }
  return { itens, total_cents: itens.reduce((s, i) => s + i.valor_cents, 0), porOrigem };
}
