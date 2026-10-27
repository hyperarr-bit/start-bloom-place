import { describe, expect, it, vi } from "vitest";

/* 27/10 (raio-x da recusa) — a linha da Apple chega no banco como "play_store" (revenuecat-webhook/-sync gravam assim
 * pras duas lojas) e continua "active" enquanto o cartão está recusado. A conferência do "já tinha acesso" do aviso de
 * cobrança (AvisoCobrancaRecusada → acessoAnteriorDaSessao) tem que ignorá-la: da 1.0.17 à 1.0.20 ela contava como
 * "acesso de fora" e a recusada via "Você já tem acesso… cancele na App Store" no lugar do aviso e do card da recusa
 * (24 de 26 recusadas nas builds 44–45). A linha aqui é o formato REAL da tabela, não um exemplo inventado. */
const banco = vi.hoisted(() => ({ linhas: [] as Record<string, unknown>[] }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: "conta-1" } } } }) },
    from: () => ({ select: () => ({ eq: () => ({ in: async () => ({ data: banco.linhas, error: null }) }) }) }),
  },
}));

import { acessoAnteriorDaSessao } from "@/lib/conta-ja-tinha-acesso";

const amanha = () => new Date(Date.now() + 864e5).toISOString();

describe("aviso de cobrança × a linha da loja (bug 1.0.17–1.0.20)", () => {
  it("recusada só com a assinatura da Apple (play_store, active): NÃO 'já tinha acesso' — vê o aviso e o card", async () => {
    banco.linhas = [{ status: "active", billing_period: "annual", plan: "core-pro", payment_method: "play_store", revenuecat_subscription_id: "subAap1a2b3c", current_period_end: amanha() }];
    expect(await acessoAnteriorDaSessao()).toBeNull();
  });

  it("play_store sem o id do RevenueCat (não dá pra saber a loja): na dúvida, não avisa", async () => {
    banco.linhas = [{ status: "active", billing_period: "annual", plan: "core-pro", payment_method: "play_store", current_period_end: amanha() }];
    expect(await acessoAnteriorDaSessao()).toBeNull();
  });

  it("assinatura da GOOGLE PLAY (play_store, id subGoo…) + teste da Apple: avisa de novo (revisor b52)", async () => {
    banco.linhas = [
      { status: "active", billing_period: "annual", plan: "core-pro", payment_method: "play_store", revenuecat_subscription_id: "subGoo9z8y7x", current_period_end: amanha() },
      { status: "active", billing_period: "annual", plan: "core-pro", payment_method: "play_store", revenuecat_subscription_id: "subAap1a2b3c", current_period_end: amanha() },
    ];
    expect(await acessoAnteriorDaSessao()).toBe("assinatura");
  });

  it("o select lê o revenuecat_subscription_id", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const fonte = fs.readFileSync(path.resolve(__dirname, "../lib/conta-ja-tinha-acesso.ts"), "utf8");
    expect(fonte).toMatch(/select\("[^"]*revenuecat_subscription_id/);
  });

  it("mensal da loja recusado (play_store): também não", async () => {
    banco.linhas = [{ status: "active", billing_period: "monthly", plan: "core-pro", payment_method: "play_store", revenuecat_subscription_id: "subAapM0n7h", current_period_end: amanha() }];
    expect(await acessoAnteriorDaSessao()).toBeNull();
  });

  it("quem tem o vitalício da web de verdade (pix) + a assinatura da Apple: continua avisando", async () => {
    banco.linhas = [
      { status: "active", billing_period: "annual", plan: "core-pro", payment_method: "play_store", revenuecat_subscription_id: "subAap1a2b3c", current_period_end: amanha() },
      { status: "active", billing_period: "lifetime", plan: "lifetime", payment_method: "pix", current_period_end: null },
    ];
    expect(await acessoAnteriorDaSessao()).toBe("vitalicio");
  });
});
