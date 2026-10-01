/**
 * O PIX NUNCA ESCREVE NA LINHA DA LOJA (01/10/2026).
 *
 * Caso real que motivou: 33 pessoas do teste grátis do iPhone com o cartão
 * recusado pela Apple (linha play_store ativa até o fim da carência de 16
 * dias). Se uma delas pagar o vitalício de 97,90 no Pix, o grant antigo
 * (maybeSingle + update) virava ESSA linha em pix — o RevenueCat a devolvia
 * pra anual pela chave revenuecat_subscription_id e, no fim da carência, a
 * pessoa que pagou ficava sem acesso. A decisão agora é pura e testável.
 */
import { describe, it, expect } from "vitest";
import {
  decidirGrantPix, ehDaLoja, linhaParaEscrever, temVitalicioProprio, type LinhaAssinatura,
} from "../../supabase/functions/_shared/linha-pix";

const AGORA = new Date("2026-10-01T12:00:00Z");
const daqui = (dias: number) => new Date(AGORA.getTime() + dias * 86400_000).toISOString();

const lojaEmCarencia: LinhaAssinatura = {
  id: "loja", status: "active", plan: "app", billing_period: "annual", payment_method: "play_store",
  current_period_end: daqui(12), revenuecat_subscription_id: "subAap123",
};
const pixVitalicio: LinhaAssinatura = {
  id: "pix", status: "active", plan: "lifetime", billing_period: "lifetime", payment_method: "pix",
  current_period_end: daqui(36500), revenuecat_subscription_id: null,
};
const mesPrePago = (fimEmDias: number): LinhaAssinatura => ({
  id: "mes", status: "active", plan: "web", billing_period: "monthly_prepaid", payment_method: "pix",
  current_period_end: daqui(fimEmDias), revenuecat_subscription_id: null,
});
const VITALICIO = { dias: null };
const MES = { dias: 30 };

describe("linha da loja é do RevenueCat", () => {
  it("play_store ou qualquer linha com revenuecat_subscription_id é da loja", () => {
    expect(ehDaLoja(lojaEmCarencia)).toBe(true);
    // linha já "virada" pelo bug antigo: payment_method pix mas com a chave do RC → continua da loja
    expect(ehDaLoja({ id: "x", payment_method: "pix", revenuecat_subscription_id: "subAap9" })).toBe(true);
    expect(ehDaLoja(pixVitalicio)).toBe(false);
  });

  it("carência da Apple + Pix de 97,90: INSERE uma linha nova, não toca a da loja", () => {
    const d = decidirGrantPix([lojaEmCarencia], VITALICIO, AGORA);
    expect(d.acao).toBe("inserir");
    expect(d.jaLiberado).toBe(false); // CAPI/boas-vindas disparam: é uma venda nova
    expect(new Date((d as { fim: string }).fim).getFullYear()).toBe(2126);
    expect(linhaParaEscrever([lojaEmCarencia])).toBeNull();
  });

  it("linha da loja CANCELADA (trial que acabou) também não é reaproveitada", () => {
    const d = decidirGrantPix([{ ...lojaEmCarencia, status: "canceled" }], VITALICIO, AGORA);
    expect(d.acao).toBe("inserir");
  });

  it("vitalício da loja (compra dentro do app) não conta como 'já liberado' pro Pix", () => {
    const vitLoja: LinhaAssinatura = { ...lojaEmCarencia, billing_period: "lifetime", current_period_end: daqui(36500) };
    expect(temVitalicioProprio([vitLoja])).toBe(false);
    expect(decidirGrantPix([vitLoja], VITALICIO, AGORA).acao).toBe("inserir");
  });
});

describe("linha própria", () => {
  it("sem linha nenhuma: insere", () => {
    expect(decidirGrantPix([], VITALICIO, AGORA)).toMatchObject({ acao: "inserir", jaLiberado: false });
  });

  it("pix vencido/cancelado: a linha própria vira a nova (atualiza), e a da loja fica quieta", () => {
    const cancelada: LinhaAssinatura = { ...mesPrePago(-10), status: "canceled" };
    const d = decidirGrantPix([lojaEmCarencia, cancelada], VITALICIO, AGORA);
    expect(d).toMatchObject({ acao: "atualizar", linhaId: "mes", jaLiberado: false });
  });

  it("já vitalício no Pix e paga o vitalício de novo: atualiza a mesma linha, sem disparar venda nova", () => {
    const d = decidirGrantPix([pixVitalicio, lojaEmCarencia], VITALICIO, AGORA);
    expect(d).toMatchObject({ acao: "atualizar", linhaId: "pix", jaLiberado: true });
  });

  it("TRAVA DE REBAIXAMENTO: vitalício que paga o mês → preservar (caso de reembolso)", () => {
    expect(decidirGrantPix([pixVitalicio], MES, AGORA)).toEqual({ acao: "preservar", motivo: "vitalicio_pagou_mes", jaLiberado: true });
  });

  it("mês pré-pago EMPILHA sobre o período próprio vigente", () => {
    const d = decidirGrantPix([mesPrePago(10)], MES, AGORA);
    expect(d.acao).toBe("atualizar");
    expect((d as { fim: string }).fim).toBe(daqui(40));
  });

  it("mês pré-pago NÃO empilha sobre a carência da loja: conta de hoje", () => {
    const d = decidirGrantPix([lojaEmCarencia], MES, AGORA);
    expect(d.acao).toBe("inserir");
    expect((d as { fim: string }).fim).toBe(daqui(30));
  });

  it("com 2+ linhas próprias escreve na viva de fim mais distante", () => {
    const antiga: LinhaAssinatura = { ...mesPrePago(-5), id: "antiga", status: "canceled" };
    const viva = { ...mesPrePago(3), id: "viva" };
    expect(linhaParaEscrever([antiga, viva, lojaEmCarencia])?.id).toBe("viva");
  });
});
