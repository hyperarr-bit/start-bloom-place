/**
 * PROGRAMA DE AFILIADOS — a conta (09/10/2026).
 *
 * O que está em jogo: dinheiro saindo por Pix sozinho toda segunda. Estes
 * testes travam (1) a comissão = 50% do LÍQUIDO da Apple, nunca 85% nem do
 * bruto; (2) o webhook idempotente — o mesmo evento duas vezes não cria nem
 * paga duas vezes, e RENOVAÇÃO não paga; (3) a janela de 7 dias e a trava
 * semanal; (4) o painel sem nenhum dado de cliente.
 */
import { describe, it, expect } from "vitest";
import {
  aplicarDecisao, classificarEvento, comissaoCents, dataPrevistaPagamento, diaBRT, elegivelParaPagar, linkResgate, liquidoCents,
  normalizarCodigo, planejarSemana, proximaSegunda, resumoPainel, segundaDaSemana,
  type Aplicacao, type EventoRC, type Venda,
} from "../../supabase/functions/_shared/afiliados";

const AF = "11111111-1111-1111-1111-111111111111";
const UID = "22222222-2222-2222-2222-222222222222";
const T0 = Date.UTC(2026, 9, 1, 15, 0, 0); // 01/10/2026 12h BRT

const trial = (extra: Partial<EventoRC> = {}): EventoRC => ({
  type: "INITIAL_PURCHASE", store: "APP_STORE", product_id: "core_anual_97", offer_code: "BIA", period_type: "TRIAL",
  price: 0, price_in_purchased_currency: 0, currency: "BRL", transaction_id: "tx-1", original_transaction_id: "otx-1",
  purchased_at_ms: T0, app_user_id: "$RCAnonymousID:abc", ...extra,
});
const conversao = (extra: Partial<EventoRC> = {}): EventoRC => ({
  type: "RENEWAL", store: "APP_STORE", product_id: "core_anual_97", offer_code: null, period_type: "NORMAL", is_trial_conversion: true,
  renewal_number: 1, price: 17.9, price_in_purchased_currency: 97.9, currency: "BRL", transaction_id: "tx-2", original_transaction_id: "otx-1",
  purchased_at_ms: T0 + 7 * 86400_000, app_user_id: UID, ...extra,
});

/** Roda uma sequência de eventos contra um "banco" de uma linha, como o webhook faz. */
function simular(eventos: EventoRC[], codigos: Record<string, string> = { BIA: AF }) {
  let linha: Venda | null = null;
  const trilha: Aplicacao["acao"][] = [];
  for (const ev of eventos) {
    const d = classificarEvento(ev);
    const afiliadoId = linha?.afiliado_id ?? (d.tipo !== "ignorar" && d.codigo ? codigos[d.codigo] ?? null : null);
    const ap = aplicarDecisao(d, linha, afiliadoId);
    trilha.push(ap.acao);
    if (ap.acao === "inserir") linha = { ...ap.linha, id: "v1" };
    else if (ap.acao === "atualizar") linha = { ...(linha as Venda), ...ap.campos };
  }
  return { linha, trilha };
}

describe("comissão = 50% do líquido da Apple", () => {
  it("97,90 → líquido oficial 80,30 → comissão 40,15 (não 85% nem do bruto)", () => {
    expect(liquidoCents(9790)).toBe(8030);
    expect(comissaoCents(8030)).toBe(4015);
    expect(comissaoCents(liquidoCents(9790))).not.toBe(Math.round(9790 * 0.85 * 0.5));
  });
  it("69,90 → 57,34 → 28,67", () => {
    expect(liquidoCents(6990)).toBe(5734);
    expect(comissaoCents(5734)).toBe(2867);
  });
  it("preço fora da tabela: usa as porcentagens do RevenueCat (imposto no preço, comissão no que sobra)", () => {
    expect(liquidoCents(10000, { tax_percentage: 10, commission_percentage: 15 })).toBe(7650);
  });
  it("sem tabela e sem porcentagem: razão 80,30/97,90", () => {
    expect(liquidoCents(10000)).toBe(Math.round(10000 * (8030 / 9790)));
  });
  it("código: maiúsculo, só letras/números, 3–64", () => {
    expect(normalizarCodigo(" bia ")).toBe("BIA");
    expect(normalizarCodigo("Bia-2026!")).toBe("BIA2026");
    expect(normalizarCodigo("ab")).toBeNull();
    expect(normalizarCodigo(null)).toBeNull();
  });
  it("link de resgate aponta pro app certo", () => {
    expect(linkResgate("BIA")).toBe("https://apps.apple.com/redeem?ctx=offercodes&id=6806913181&code=BIA");
  });
});

describe("webhook: teste → 1ª cobrança → renovação, idempotente", () => {
  it("teste com código cria em_teste (mesmo anônimo); a conversão vira pago com 40,15; renovação não muda nada", () => {
    const { linha, trilha } = simular([trial(), conversao(), conversao({ type: "RENEWAL", is_trial_conversion: false, renewal_number: 2, transaction_id: "tx-3", purchased_at_ms: T0 + 372 * 86400_000 })]);
    expect(trilha).toEqual(["inserir", "atualizar", "nada"]);
    expect(linha).toMatchObject({ status: "pago", comissao_cents: 4015, valor_bruto_cents: 9790, valor_liquido_cents: 8030, transaction_id: "otx-1", transaction_id_cobranca: "tx-2", user_id: UID, plataforma: "ios" });
  });
  it("o mesmo evento duas vezes não grava duas vezes", () => {
    expect(simular([trial(), trial()]).trilha).toEqual(["inserir", "nada"]);
    expect(simular([trial(), conversao(), conversao()]).trilha).toEqual(["inserir", "atualizar", "nada"]);
  });
  it("o user_id chega depois: o teste anônimo ganha o uid quando a conta aparece", () => {
    const { linha, trilha } = simular([trial(), trial({ app_user_id: UID })]);
    expect(trilha).toEqual(["inserir", "atualizar"]);
    expect(linha?.user_id).toBe(UID);
    expect(linha?.status).toBe("em_teste");
  });
  it("código que não é de ninguém: nada é gravado", () => {
    expect(simular([trial({ offer_code: "ZEZE" })]).trilha).toEqual(["nada"]);
  });
  it("teste sem código (cliente comum) não é afiliado; a conversão dele também não", () => {
    expect(simular([trial({ offer_code: null }), conversao()]).trilha).toEqual(["nada", "nada"]);
  });
  it("código em minúsculo casa igual", () => {
    expect(simular([trial({ offer_code: "bia" })]).trilha).toEqual(["inserir"]);
  });
  it("reembolso (CANCELLATION/CUSTOMER_SUPPORT) depois de pago → reembolsado, comissão fica mas não é elegível", () => {
    const { linha } = simular([trial(), conversao(), { ...conversao(), type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", price_in_purchased_currency: -97.9 }]);
    expect(linha?.status).toBe("reembolsado");
    expect(elegivelParaPagar(linha as Venda, new Date(T0 + 60 * 86400_000))).toBe(false);
  });
  it("cartão recusado no fim do teste → recusado; se depois a Apple cobra, vira pago", () => {
    const { linha, trilha } = simular([trial(), { ...trial(), type: "BILLING_ISSUE" }, conversao()]);
    expect(trilha).toEqual(["inserir", "atualizar", "atualizar"]);
    expect(linha?.status).toBe("pago");
    expect(linha?.comissao_cents).toBe(4015);
  });
  it("cancelou a renovação DEPOIS de pagar: continua pago (comissão não some)", () => {
    const { linha } = simular([trial(), conversao(), { ...conversao(), type: "CANCELLATION", cancel_reason: "UNSUBSCRIBE", price_in_purchased_currency: 0 }]);
    expect(linha?.status).toBe("pago");
  });
  it("teste expirou sem pagar → recusado (nao_pagou)", () => {
    const { linha } = simular([trial(), { ...trial(), type: "EXPIRATION" }]);
    expect(linha).toMatchObject({ status: "recusado", motivo: "nao_pagou" });
  });
  it("renovação sem valor em BRL usa o preço cheio do produto", () => {
    const { linha } = simular([trial(), conversao({ price_in_purchased_currency: 19.99, currency: "USD" })]);
    expect(linha).toMatchObject({ valor_bruto_cents: 9790, valor_liquido_cents: 8030, comissao_cents: 4015 });
  });
  it("Play Store entra como android; loja estranha é ignorada", () => {
    expect(classificarEvento(trial({ store: "PLAY_STORE" }))).toMatchObject({ tipo: "em_teste", plataforma: "android" });
    expect(classificarEvento(trial({ store: "STRIPE" }))).toMatchObject({ tipo: "ignorar" });
    expect(classificarEvento({ ...trial(), type: "TEST" })).toMatchObject({ tipo: "ignorar" });
  });
});

describe("calendário de Brasília", () => {
  it("próxima segunda às 9h BRT (12h UTC)", () => {
    // quinta 08/10/2026 12h BRT → segunda 12/10 12:00Z
    expect(proximaSegunda(new Date("2026-10-08T15:00:00Z")).toISOString()).toBe("2026-10-12T12:00:00.000Z");
    // segunda 12/10 às 8h BRT → ainda hoje; às 9h01 → próxima
    expect(proximaSegunda(new Date("2026-10-12T11:00:00Z")).toISOString()).toBe("2026-10-12T12:00:00.000Z");
    expect(proximaSegunda(new Date("2026-10-12T12:01:00Z")).toISOString()).toBe("2026-10-19T12:00:00.000Z");
  });
  it("venda cobrada no dia 05 (madrugada) entra na segunda 12; cobrada ao meio-dia ainda não tem 7 dias às 9h → 19", () => {
    expect(diaBRT(dataPrevistaPagamento("2026-10-05T08:00:00Z"))).toBe("2026-10-12"); // 05h BRT + 7d = 12/10 05h ≤ 9h
    expect(diaBRT(dataPrevistaPagamento("2026-10-05T14:00:00Z"))).toBe("2026-10-19"); // 11h BRT + 7d = 12/10 11h > 9h
    expect(diaBRT(dataPrevistaPagamento("2026-10-04T14:00:00Z"))).toBe("2026-10-12");
    // a mesma regra do cron: no dia 12 às 9h, elegível = cobrada até 05/10 09h
    const seg = new Date("2026-10-12T12:00:00Z");
    expect(elegivelParaPagar({ status: "pago", cobrado_em: "2026-10-05T08:00:00Z", pagamento_id: null }, seg)).toBe(true);
    expect(elegivelParaPagar({ status: "pago", cobrado_em: "2026-10-05T14:00:00Z", pagamento_id: null }, seg)).toBe(false);
  });
  it("segunda da semana corrente", () => {
    expect(segundaDaSemana(new Date("2026-10-08T15:00:00Z"))).toBe("2026-10-05");
    expect(segundaDaSemana(new Date("2026-10-12T12:00:00Z"))).toBe("2026-10-12");
    expect(segundaDaSemana(new Date("2026-10-12T01:00:00Z"))).toBe("2026-10-05"); // ainda domingo em Brasília
  });
});

describe("Pix semanal: carência, trava e pausa", () => {
  const agora = new Date("2026-10-12T12:00:00Z");
  const venda = (id: string, afiliado: string, diasAtras: number, comissao = 4015, extra: Partial<Venda> = {}) => ({
    id, afiliado_id: afiliado, status: "pago" as const, cobrado_em: new Date(agora.getTime() - diasAtras * 86400_000).toISOString(), pagamento_id: null, comissao_cents: comissao, ...extra,
  });
  const bia = { id: "a1", nome: "Bia", codigo: "BIA", pausado: false, limite_semanal_cents: 50000 };

  it("só vendas pagas há 7+ dias e sem pagamento entram", () => {
    const planos = planejarSemana([bia], [venda("v1", "a1", 8), venda("v2", "a1", 7), venda("v3", "a1", 6), venda("v4", "a1", 9, 4015, { status: "reembolsado" }), venda("v5", "a1", 20, 4015, { pagamento_id: "p0" }), venda("v6", "a1", 10, 0, { status: "em_teste", cobrado_em: null })], agora);
    expect(planos).toEqual([{ afiliado_id: "a1", total_cents: 8030, vendas_ids: ["v1", "v2"], decisao: "pagar", motivo: null }]);
  });
  it("acima do limite semanal SEGURA a semana inteira", () => {
    const vendas = Array.from({ length: 13 }, (_, i) => venda(`v${i}`, "a1", 8 + i)); // 13 × 40,15 = 521,95 > 500
    const [p] = planejarSemana([bia], vendas, agora);
    expect(p.decisao).toBe("segurar");
    expect(p.total_cents).toBe(52195);
    expect(p.vendas_ids).toHaveLength(13);
  });
  it("exatamente no limite ainda paga", () => {
    const [p] = planejarSemana([{ ...bia, limite_semanal_cents: 8030 }], [venda("v1", "a1", 8), venda("v2", "a1", 9)], agora);
    expect(p.decisao).toBe("pagar");
  });
  it("afiliada pausada: nada sai, as vendas ficam esperando", () => {
    const [p] = planejarSemana([{ ...bia, pausado: true }], [venda("v1", "a1", 8)], agora);
    expect(p.decisao).toBe("pausado");
  });
  it("sem venda madura: nenhum plano", () => {
    expect(planejarSemana([bia], [venda("v1", "a1", 2)], agora)).toEqual([]);
  });
});

describe("painel da afiliada: agregados sem dado de cliente", () => {
  const agora = new Date("2026-10-08T15:00:00Z"); // quinta
  const vendas = [
    { status: "em_teste" as const, comissao_cents: 0, cobrado_em: null, criado_em: "2026-10-08T10:00:00Z", pagamento_id: null },
    { status: "pago" as const, comissao_cents: 4015, cobrado_em: "2026-10-04T10:00:00Z", criado_em: "2026-09-27T10:00:00Z", pagamento_id: null }, // madura dia 11 → Pix 12/10
    { status: "pago" as const, comissao_cents: 4015, cobrado_em: "2026-10-07T10:00:00Z", criado_em: "2026-09-30T10:00:00Z", pagamento_id: null }, // madura 14 → Pix 19/10
    { status: "pago" as const, comissao_cents: 4015, cobrado_em: "2026-09-28T10:00:00Z", criado_em: "2026-09-21T10:00:00Z", pagamento_id: "p1" },
    { status: "pago" as const, comissao_cents: 4015, cobrado_em: "2026-09-27T10:00:00Z", criado_em: "2026-09-20T10:00:00Z", pagamento_id: "p2" },
    { status: "reembolsado" as const, comissao_cents: 4015, cobrado_em: "2026-09-29T10:00:00Z", criado_em: "2026-09-22T10:00:00Z", pagamento_id: null },
    { status: "recusado" as const, comissao_cents: 0, cobrado_em: null, criado_em: "2026-10-01T10:00:00Z", pagamento_id: null },
  ];
  const pagamentos = [
    { id: "p1", valor_cents: 4015, status: "enviado" as const, criado_em: "2026-10-06T12:00:00Z" },
    { id: "p2", valor_cents: 4015, status: "segurado" as const, criado_em: "2026-10-06T12:00:00Z" },
  ];
  const r = resumoPainel(vendas, pagamentos, agora);

  it("conta certo", () => {
    expect(r).toMatchObject({ usaram: 7, em_teste: 1, pagaram: 4, reembolsadas: 1, nao_pagaram: 1, ja_recebido_cents: 4015, segurado_cents: 4015 });
    expect(r.a_receber_cents).toBe(4015 * 3); // 2 na fila + 1 segurada
    expect(r.proximo_pagamento).toEqual({ dia: "2026-10-12", valor_cents: 4015 });
  });
  it("cada linha diz só dia, valor e situação", () => {
    expect(r.linhas.find((l) => l.situacao === "paga")).toEqual({ dia: "2026-09-28", comissao_cents: 4015, situacao: "paga", pagamento_dia: "2026-10-06" });
    expect(r.linhas.filter((l) => l.situacao === "prevista").map((l) => l.pagamento_dia)).toEqual(["2026-10-19", "2026-10-12"]);
    expect(r.linhas.find((l) => l.situacao === "segurada")?.comissao_cents).toBe(4015);
    expect(r.linhas.find((l) => l.situacao === "reembolsada")?.comissao_cents).toBe(0);
    for (const l of r.linhas) expect(Object.keys(l).sort()).toEqual(["comissao_cents", "dia", "pagamento_dia", "situacao"]);
  });
  it("nada no resumo lembra um cliente (sem user_id, e-mail, nome, transaction)", () => {
    const texto = JSON.stringify(r);
    expect(texto).not.toMatch(/user_id|email|nome|transaction|@/);
  });
});
