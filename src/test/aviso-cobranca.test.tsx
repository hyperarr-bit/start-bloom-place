/**
 * Cobrança recusada na loja (26/09): 11 testes do iPhone com o cartão recusado
 * no fim do teste. Só avisa quem ainda quer pagar (renovação ligada).
 */
import { describe, it, expect } from "vitest";
import { lerProblemaDeCobranca } from "@/lib/revenuecat";

const info = (ent: Record<string, unknown>, url: string | null = "https://apps.apple.com/account/subscriptions") => ({
  managementURL: url,
  entitlements: { all: { "CORE APP Pro": ent }, active: {} },
});

describe("Cobrança recusada — leitura do RevenueCat", () => {
  it("cartão recusado com renovação ligada: avisa, sem acesso", () => {
    expect(lerProblemaDeCobranca(info({ billingIssueDetectedAt: "2026-09-25T20:24:00Z", willRenew: true, isActive: false })))
      .toEqual({ temProblema: true, comAcesso: false, url: "https://apps.apple.com/account/subscriptions" });
  });

  it("dentro da carência (acesso ativo): avisa pra não perder o acesso", () => {
    expect(lerProblemaDeCobranca(info({ billingIssueDetectedAt: "2026-09-25T20:24:00Z", willRenew: true, isActive: true })).comAcesso).toBe(true);
  });

  it("quem cancelou não recebe aviso de cartão", () => {
    expect(lerProblemaDeCobranca(info({ billingIssueDetectedAt: "2026-09-25T20:24:00Z", willRenew: false, isActive: false })).temProblema).toBe(false);
    expect(lerProblemaDeCobranca(info({ billingIssueDetectedAt: "2026-09-25T20:24:00Z", willRenew: true, unsubscribeDetectedAt: "2026-09-25T21:00:00Z" })).temProblema).toBe(false);
  });

  it("sem problema de cobrança, ou sem dados: nada", () => {
    expect(lerProblemaDeCobranca(info({ billingIssueDetectedAt: null, willRenew: true, isActive: true })).temProblema).toBe(false);
    expect(lerProblemaDeCobranca(null).temProblema).toBe(false);
    expect(lerProblemaDeCobranca({}).temProblema).toBe(false);
  });
});
