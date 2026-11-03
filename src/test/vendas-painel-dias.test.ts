// @vitest-environment node
/**
 * PAINEL /vendas · aba Dias (02/11, dono: "uma aba pra eu ver o total de cada dia, a partir do dia que a campanha bid foi
 * criada, e no iOS desde o mesmo período"). Contas: vendido = o mesmo do "Hoje"; lucro do site = Pix − 1,99 − anúncio
 * × 1,1215 (imposto da Meta) − 15,5% do bruto; iPhone = a TURMA do dia (nunca o caixa da Apple do dia) − anúncio de app
 * × 1,1215 − 15,5%; turmas de 28/10 até hoje com situação fechada / fecha hoje / aberta.
 */
import { describe, expect, it } from "vitest";
import { INICIO_DIAS, montarTurmasDesde, normalizarLoja, resumoDoDia, vendasDoDia, type EstadoRC } from "../../supabase/functions/_shared/vendas-painel";
import type { LinhaSub } from "../../supabase/functions/_shared/aviso-venda";

const brt = (dia: string, hm = "12:00") => new Date(Date.parse(`${dia}T${hm}:00-03:00`)).toISOString();
let n = 0;
const sub = (x: Partial<LinhaSub>): LinhaSub => ({
  id: `id-${++n}`, user_id: `u-${n}`, status: "active", plan: "app", billing_period: "annual", payment_method: "play_store",
  amount_cents: 9790, customer_email: `cliente${n}@exemplo.com`, current_period_start: null, current_period_end: null,
  created_at: brt("2026-10-30"), abacatepay_billing_id: null, revenuecat_subscription_id: `subAap${n}`, ...x,
});

describe("aba Dias", () => {
  it("começa no dia da campanha bid (28/10)", () => {
    expect(INICIO_DIAS).toBe("2026-10-28");
  });

  it("turmas de 28/10 até hoje, a mais nova primeiro, com a situação certa", () => {
    const linhas = normalizarLoja([sub({ created_at: brt("2026-10-28") }), sub({ created_at: brt("2026-10-30") }), sub({ created_at: brt("2026-11-02") })]);
    const rc = new Map<string, EstadoRC>(linhas.map((l, i) => [l.tx, i === 0 ? { status: "active", renova: "will_renew", gross: 18 } : { status: "trialing", renova: "will_renew", gross: 0 }]));
    const t = montarTurmasDesde(linhas, rc, { "2026-10-28": 100, "2026-11-02": 50 }, "2026-11-02", INICIO_DIAS);
    expect(t.map((x) => x.dia)).toEqual(["2026-11-02", "2026-11-01", "2026-10-31", "2026-10-30", "2026-10-29", "2026-10-28"]);
    expect(t.map((x) => x.situacao)).toEqual(["aberta", "aberta", "aberta", "fecha_hoje", "fechada", "fechada"]);
    const d28 = t.find((x) => x.dia === "2026-10-28")!;
    expect(d28).toMatchObject({ testes: 1, pagaram: 1, liquido: 80.3, gasto: 100, retorno: 0.8 });
  });

  it("lucro do dia: site com taxa do Pix, imposto da Meta e 15,5%; iPhone pela turma; Android pelo que vendeu", () => {
    const dia = "2026-11-02";
    const pix = Array.from({ length: 10 }, (_, i) => sub({ payment_method: "pix", amount_cents: 2790, billing_period: "lifetime", revenuecat_subscription_id: null, abacatepay_billing_id: `NATALIAD${i}`, created_at: brt(dia, "10:00") }));
    const v = vendasDoDia(pix, [], new Map(), [], dia);
    expect(v.total_cents).toBe(27900);
    const r = resumoDoDia(v, dia, 100, { testes: 30, pagaram: 6, situacao: "aberta", liquido: 481.8, gasto: 120 });
    // site: 10 × 25,91 = 259,10 − 112,15 − 15,5% × 279 (43,245) = 103,705
    expect(r.site).toMatchObject({ vendas: 10, bruto: 279, liquido: 259.1, gastoComImposto: 112.15, imposto: 43.25 });
    expect(r.site.lucro).toBeCloseTo(103.7, 1);
    // iPhone: 481,80 − 134,58 − 74,68 = 272,54 (parcial: a turma ainda cobra)
    expect(r.iphone.lucro).toBeCloseTo(272.54, 1);
    expect(r.iphone.parcial).toBe(true);
    expect(r.vendido).toBe(279);
    expect(r.lucro).toBeCloseTo(103.7 + 272.54, 0);
  });

  it("dia sem anúncio nem venda não vira prejuízo nem cor", () => {
    const r = resumoDoDia(vendasDoDia([], [], new Map(), [], "2026-10-29"), "2026-10-29", 0, { testes: 0, pagaram: 0, situacao: "fechada", liquido: 0, gasto: 0 });
    expect(r.lucro).toBe(0);
    expect(r.site.cor).toBe("neutro");
  });
});

describe("03/11: o iPhone do dia é a turma COBRADA nele (começou 3 dias antes)", () => {
  it("leva o dia da turma e só é parcial enquanto a cobrança cai (fecha hoje)", () => {
    const v = vendasDoDia([], [], new Map(), [], "2026-11-02");
    const fechou = resumoDoDia(v, "2026-11-02", 0, { dia: "2026-10-30", testes: 36, pagaram: 8, situacao: "fechada", liquido: 619, gasto: 280 });
    expect(fechou.iphone).toMatchObject({ turma: "2026-10-30", parcial: false, liquido: 619, gasto: 280 });
    const hoje = resumoDoDia(v, "2026-11-03", 0, { dia: "2026-10-31", testes: 33, pagaram: 5, situacao: "fecha_hoje", liquido: 401.5, gasto: 309 });
    expect(hoje.iphone.parcial).toBe(true);
  });
});
