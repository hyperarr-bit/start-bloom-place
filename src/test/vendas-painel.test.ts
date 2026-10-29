// @vitest-environment node
/**
 * PAINEL /vendas (29/10) — as contas do servidor (supabase/functions/_shared/vendas-painel.ts), com linhas no formato
 * real do banco/Meta/RevenueCat. A régua é a dos scripts de métricas (coleta.mjs, dia.mjs, base-turmas.mjs):
 *   · turma = testes anuais do iPhone do dia D (BRT); desfecho pelo RevenueCat; líquido Apple 80,30/57,34/20,42;
 *     retorno ÷ gasto das campanhas de APP do dia; e-mails de teste e contas internas fora;
 *   · "Iniciar teste" da Meta vem de `conversions` (start_trial_total), NUNCA de `actions`;
 *   · web = Pix do banco (amount_cents) ÷ gasto das campanhas de SITE; landing sem os robôs Right_Column;
 *   · vendas de hoje sem duplicar e sem teste grátis; verde ≥ 2, amarelo 1–2, vermelho < 1.
 */
import { describe, expect, it } from "vitest";
import {
  corRetorno, desfecho, funilLanding, gastoPorDia, linhaCampanha, liquidoCents, montarTurmas, normalizarLoja, roiWeb, tipoCampanha, vendasDoDia,
  type EstadoRC, type InsightMeta,
} from "../../supabase/functions/_shared/vendas-painel";
import type { LinhaSub } from "../../supabase/functions/_shared/aviso-venda";

const HOJE = "2026-10-29";
/** horário de Brasília → ISO (UTC) */
const brt = (dia: string, hm = "12:00") => new Date(Date.parse(`${dia}T${hm}:00-03:00`)).toISOString();
let n = 0;
const sub = (x: Partial<LinhaSub>): LinhaSub => ({
  id: `id-${++n}`, user_id: `u-${n}`, status: "active", plan: "app", billing_period: "annual", payment_method: "play_store",
  amount_cents: 9790, customer_email: `cliente${n}@exemplo.com`, current_period_start: null, current_period_end: null,
  created_at: brt(HOJE), abacatepay_billing_id: null, revenuecat_subscription_id: `subAap${n}`, ...x,
});
const rc = (status: string, gross = 0, renova = "will_renew"): EstadoRC => ({ status, renova, gross });

describe("dinheiro e cor", () => {
  it("líquido Apple BR da tabela do dono; o resto ×0,82; Play ×0,85", () => {
    expect(liquidoCents(9790, "apple")).toBe(8030);
    expect(liquidoCents(6990, "apple")).toBe(5734);
    expect(liquidoCents(2490, "apple")).toBe(2042);
    expect(liquidoCents(1990, "apple")).toBe(1632);
    expect(liquidoCents(2790, "play")).toBe(2372);
  });
  it("verde ≥ 2, amarelo 1–2, vermelho < 1, sem gasto = neutro", () => {
    expect([corRetorno(2), corRetorno(1.99), corRetorno(1), corRetorno(0.99), corRetorno(null)]).toEqual(["verde", "amarelo", "amarelo", "vermelho", "neutro"]);
  });
  it("desfecho = o do coleta.mjs", () => {
    expect(desfecho(rc("active", 12.3))).toBe("pagou");
    expect(desfecho(rc("trialing", 0, "will_not_renew"))).toBe("teste_ja_cancelou");
    expect(desfecho(rc("trialing"))).toBe("teste_vai_renovar");
    expect(desfecho(rc("in_grace_period"))).toBe("recusada_carencia");
    expect(desfecho(rc("in_billing_retry"))).toBe("recusada_retry");
    expect(desfecho(rc("expired"))).toBe("expirou");
    expect(desfecho(undefined)).toBe("?");
  });
});

describe("turmas do iPhone", () => {
  const D3 = "2026-10-26", D2 = "2026-10-27";
  const linhasBanco: LinhaSub[] = [
    // turma 26/10 (fecha hoje): 5 testes
    sub({ revenuecat_subscription_id: "subAapA", created_at: brt(D3, "09:00") }),
    sub({ revenuecat_subscription_id: "subAapB", created_at: brt(D3, "23:50") }), // 23h50 BRT = 02h50 UTC do dia 27 — ainda é turma 26
    sub({ revenuecat_subscription_id: "subAapC", created_at: brt(D3, "10:00") }),
    sub({ revenuecat_subscription_id: "subAapD", created_at: brt(D3, "11:00") }),
    sub({ revenuecat_subscription_id: "subAapE", created_at: brt(D3, "12:00"), amount_cents: 6990 }),
    // e-mail de teste e conta interna: fora
    sub({ revenuecat_subscription_id: "subAapT", created_at: brt(D3), customer_email: "dono.teste@exemplo.com" }),
    sub({ revenuecat_subscription_id: "subAapI", created_at: brt(D3), user_id: "admin-uid" }),
    // Android (GPA) e Pix não entram na turma do iPhone
    sub({ revenuecat_subscription_id: "GPA.1", created_at: brt(D3) }),
    sub({ payment_method: "pix", revenuecat_subscription_id: null, created_at: brt(D3), amount_cents: 2790 }),
    // mensal do iPhone pago no dia 26 entra no líquido da turma (retro-turmas.mjs)
    sub({ revenuecat_subscription_id: "subAapM", billing_period: "monthly", amount_cents: 2490, created_at: brt(D3, "15:00") }),
    // turma 27/10: 2 testes, ainda em teste
    sub({ revenuecat_subscription_id: "subAapF", created_at: brt(D2) }),
    sub({ revenuecat_subscription_id: "subAapG", created_at: brt(D2) }),
  ];
  const estados = new Map<string, EstadoRC>([
    ["subAapA", rc("active", 17.5)], ["subAapE", rc("active", 12.4)], // pagaram (97,90 e 69,90)
    ["subAapB", rc("in_billing_retry")], ["subAapC", rc("trialing", 0, "will_not_renew")], ["subAapD", rc("expired")],
    ["subAapM", rc("active", 4.4)], ["subAapF", rc("trialing")], ["subAapG", rc("trialing", 0, "will_not_renew")],
    ["subAapT", rc("active", 17.5)], ["subAapI", rc("active", 17.5)],
  ]);
  const linhas = normalizarLoja(linhasBanco, new Set(["admin-uid"]));
  const turmas = montarTurmas(linhas, estados, { [D3]: 100, [D2]: 50.5, "2026-10-28": 0 }, HOJE);

  it("4 turmas: a que fecha hoje (D−3) e as 3 abertas", () => {
    expect(turmas.map((t) => [t.dia, t.situacao, t.fechaEm])).toEqual([
      ["2026-10-26", "fecha_hoje", "2026-10-29"], ["2026-10-27", "aberta", "2026-10-30"],
      ["2026-10-28", "aberta", "2026-10-31"], ["2026-10-29", "aberta", "2026-11-01"],
    ]);
  });
  it("turma que fecha hoje: contagens, custo por teste, líquido e retorno", () => {
    const t = turmas[0];
    expect(t).toMatchObject({ testes: 5, pagaram: 2, pctPagaram: 40, recusas: 1, cancelaram: 2, emTeste: 0, outros: 0, mensais: 1, gasto: 100, custoPorTeste: 20 });
    expect(t.liquido).toBeCloseTo(80.3 + 57.34 + 20.42, 2);
    expect(t.retorno).toBe(1.58);
    expect(t.cor).toBe("amarelo");
  });
  it("turma aberta; turma sem gasto não inventa retorno", () => {
    expect(turmas[1]).toMatchObject({ testes: 2, pagaram: 0, emTeste: 1, cancelaram: 1, gasto: 50.5, custoPorTeste: 25.25, retorno: 0, cor: "neutro" }); // aberta: parcial, sem cor de veredito
    expect(turmas[2]).toMatchObject({ testes: 0, retorno: null, cor: "neutro", custoPorTeste: null });
  });
});

describe("campanhas (Meta)", () => {
  const insight: InsightMeta = {
    campaign_id: "1", campaign_name: "wonderwall", objective: "OUTCOME_APP_PROMOTION", spend: "240.00", impressions: "24000",
    inline_link_clicks: "480", inline_link_click_ctr: "2.0",
    actions: [{ action_type: "omni_app_install", value: "60" }, { action_type: "start_trial_total", value: "999" }],
    conversions: [{ action_type: "start_trial_total", value: "20" }],
  };
  it("testes vêm de conversions, não de actions; CPM/CTR/CPC/custo por teste", () => {
    const l = linhaCampanha(insight, { id: "1", effective_status: "ACTIVE", daily_budget: "24000" }, "antiga");
    expect(l).toMatchObject({ tipo: "app", status: "ACTIVE", orcamentoDia: 240, gasto: 240, cpm: 10, ctr: 2, cpc: 0.5, testes: 20, custoPorTeste: 12, roas: null });
  });
  it("campanha de site: compras e ROAS do pixel, com cor", () => {
    const site: InsightMeta = { campaign_id: "2", campaign_name: "organizar · bid cap 16", objective: "OUTCOME_SALES", spend: "100", impressions: "5000", inline_link_clicks: "100",
      actions: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "8" }], action_values: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "223.2" }] };
    const l = linhaCampanha(site, { id: "2", effective_status: "ACTIVE" }, "antiga");
    expect(l).toMatchObject({ tipo: "site", compras: 8, valorCompras: 223.2, roas: 2.23, cor: "verde", custoPorTeste: null });
    expect(linhaCampanha(null, { id: "3", effective_status: "ACTIVE", name: "nova sem gasto", objective: "OUTCOME_SALES" }, "nova")).toMatchObject({ nome: "nova sem gasto", gasto: 0, cpm: null, roas: null });
  });
  it("app × site pelo objetivo, ou pela lista configurável", () => {
    expect(tipoCampanha("APP_INSTALLS")).toBe("app");
    expect(tipoCampanha("OUTCOME_SALES")).toBe("site");
    expect(tipoCampanha("OUTCOME_ENGAGEMENT")).toBe("outra");
    expect(tipoCampanha("OUTCOME_ENGAGEMENT", "99", ["99"])).toBe("site");
    const porDia = gastoPorDia([
      { ...insight, date_start: "2026-10-28" }, { ...insight, spend: "10", date_start: "2026-10-28" },
      { campaign_id: "2", campaign_name: "s", objective: "OUTCOME_SALES", spend: "50", date_start: "2026-10-28" },
    ], "app");
    expect(porDia).toEqual({ "2026-10-28": 250 });
  });
});

describe("web", () => {
  const pix = (dia: string, cents: number, x: Partial<LinhaSub> = {}) => sub({ payment_method: "pix", billing_period: "lifetime", amount_cents: cents, created_at: brt(dia), revenuecat_subscription_id: null, ...x });
  it("ROI de hoje e dos 7 dias: Pix do banco ÷ gasto de site; teste e loja fora", () => {
    const subs = [
      pix(HOJE, 2790), pix(HOJE, 2790), pix(HOJE, 1990, { abacatepay_billing_id: "up1" }),
      pix(HOJE, 2790, { customer_email: "x.teste@exemplo.com" }),
      sub({ created_at: brt(HOJE) }), // loja
      pix("2026-10-25", 2790), pix("2026-10-20", 2790), // 20/10 fica fora dos 7 dias
    ];
    const r = roiWeb(subs, { [HOJE]: 40, "2026-10-25": 20, "2026-10-23": 10, "2026-10-22": 999 }, HOJE);
    expect(r.hoje).toEqual({ vendas: 3, receita: 75.7, gasto: 40, retorno: 1.89, cor: "amarelo" });
    expect(r.semana).toMatchObject({ vendas: 4, receita: 103.6, gasto: 70, retorno: 1.48 });
    expect(r.dias).toHaveLength(7);
    expect(r.dias[0].dia).toBe(HOJE);
  });
  it("funil da landing: sessões reais sem robô Right_Column; Pix simulado não conta; pagou pelo evento ou pelo pedido no banco", () => {
    const ev = [
      { event_name: "landing_html", sid: "s1" }, { event_name: "landing_oferta_vista", sid: "s1" }, { event_name: "landing_pix_gerado", sid: "s1", simulado: "false", order_id: "pay_1" },
      { event_name: "landing_html", sid: "s2" }, { event_name: "landing_oferta_vista", sid: "s2" }, { event_name: "landing_pix_gerado", sid: "s2", simulado: "false", order_id: "pay_2" }, { event_name: "landing_pix_pago", sid: "s2", simulado: "false" },
      { event_name: "landing_html", sid: "s3" }, { event_name: "landing_pix_gerado", sid: "s3", simulado: "true", order_id: "sim" },
      { event_name: "landing_html", sid: "robo", termo: "Instagram_Right_Column" }, { event_name: "landing_oferta_vista", sid: "robo", termo: "Instagram_Right_Column" },
      { event_name: "landing_html", sid: null },
    ];
    expect(funilLanding(ev, new Set(["pay_1"]))).toEqual({ sessoes: 3, viuOferta: 2, gerouPix: 2, pagou: 2, robos: 1 });
  });
});

describe("vendas de hoje", () => {
  it("Pix + Apple confirmada + renovação; sem duplicar, sem teste grátis, sem ontem, sem e-mail de teste", () => {
    const pixHoje = sub({ payment_method: "pix", billing_period: "lifetime", amount_cents: 2790, created_at: brt(HOJE, "09:15"), abacatepay_billing_id: "pay_9", revenuecat_subscription_id: null,
      current_period_start: brt(HOJE, "09:15"), current_period_end: new Date(Date.parse(brt(HOJE, "09:15")) + 365 * 86400_000).toISOString() });
    const pixTeste = { ...pixHoje, id: "t", abacatepay_billing_id: "pay_t", customer_email: "a.teste@exemplo.com" };
    const pixOntem = { ...pixHoje, id: "o", abacatepay_billing_id: "pay_o", created_at: brt("2026-10-28", "22:00") };
    const linha = sub({ revenuecat_subscription_id: "subAapZ" });
    const r = vendasDoDia(
      [pixHoje, { ...pixHoje }, pixTeste, pixOntem],
      [
        { event_name: "meta_capi_app_enviado", event_data: { tx: "subAapZ", valor: 97.9 }, created_at: brt(HOJE, "10:30") },
        { event_name: "meta_capi_app_enviado", event_data: { tx: "subAapZ", valor: 97.9 }, created_at: brt(HOJE, "10:31") }, // webhook + cron
        { event_name: "meta_capi_trial_enviado", event_data: { tx: "subAapY" }, created_at: brt(HOJE, "11:00") },
      ],
      new Map([["subAapZ", linha]]),
      [{ chave: "renov:subAapR:2026-11-28", origem: "apple", valor_cents: 1990, plano: "mensal", criado_em: brt(HOJE, "08:00") }],
      HOJE,
    );
    expect(r.itens).toEqual([
      { hora: "10:30", valor_cents: 9790, origem: "apple", plano: "anual", renovacao: false },
      { hora: "09:15", valor_cents: 2790, origem: "pix", plano: "1 ano", renovacao: false },
      { hora: "08:00", valor_cents: 1990, origem: "apple", plano: "mensal", renovacao: true },
    ]);
    expect(r.total_cents).toBe(9790 + 2790 + 1990);
    expect(r.porOrigem).toEqual({ pix: { n: 1, cents: 2790 }, apple: { n: 2, cents: 11780 }, play: { n: 0, cents: 0 } });
  });
  it("a resposta não carrega e-mail nem id de usuário", () => {
    const r = vendasDoDia([sub({ payment_method: "pix", amount_cents: 2790, revenuecat_subscription_id: null, customer_email: "maria@exemplo.com", user_id: "uuid-da-maria" })], [], new Map(), [], HOJE);
    const txt = JSON.stringify(r);
    expect(txt).not.toContain("maria");
    expect(txt).not.toContain("uuid-da-maria");
  });
});
