/**
 * O e-mail ANTES do Pix no lado "de verdade" (src/landing/pagamento.ts, 29/10): o que vai pro Supabase em cada caso.
 * Respostas no formato do supabase-js (updateUser com e-mail em uso → AuthApiError "A user with this email address has
 * already been registered"; verifyOtp errado → "Token has expired or is invalid").
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  sessao: "ok" as "ok" | "indisponivel",
  emailAtual: null as string | null,
  definir: vi.fn(),
  guardar: vi.fn(async () => {}),
  limparBatismo: vi.fn(),
  vincular: vi.fn(async () => false),
  verifyOtp: vi.fn(),
  getSession: vi.fn(async () => ({ data: { session: { user: { id: "c0ffee00-0000-4000-8000-000000000002" } } } })),
  invoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { verifyOtp: h.verifyOtp, getSession: h.getSession, signInWithOtp: vi.fn() }, functions: { invoke: h.invoke } },
}));
vi.mock("@/pages/hoje/conta", () => ({
  EMAIL_OK: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  abrirSessaoParaPagar: async () => h.sessao,
  emailAtual: async () => h.emailAtual,
  sessaoViva: async () => h.sessao === "ok",
  gravarAtribuicao: vi.fn(), pedirBoasVindas: vi.fn(), salvarEmailDaCompra: vi.fn(), trazerCompraParaConta: vi.fn(),
}));
vi.mock("@/lib/sessao-anonima", () => ({
  definirEmailDaCompra: h.definir, guardarCompraAnonima: h.guardar, limparBatismo: h.limparBatismo, vincularCompraAnonima: h.vincular,
}));
vi.mock("@/lib/purchase-tracking", () => ({ firePixPurchaseOnce: vi.fn(), markPixPurchasePending: vi.fn() }));
vi.mock("@/pages/venda/rastreio", () => ({ cookiesDaMeta: () => ({ fbp: null, fbc: null }) }));

import { conferirPix, emailAntesDoPix, entrarAntesDoPix } from "@/landing/pagamento";

beforeEach(() => {
  h.sessao = "ok"; h.emailAtual = null;
  for (const f of [h.definir, h.guardar, h.limparBatismo, h.vincular, h.verifyOtp, h.invoke]) f.mockClear();
});

describe("emailAntesDoPix", () => {
  it("e-mail livre → entra na anônima (updateUser) e não deve batismo", async () => {
    h.definir.mockResolvedValueOnce({ erro: null });
    expect(await emailAntesDoPix(" Maria@Email.com ")).toEqual({ ok: true, via: "nova" });
    expect(h.definir).toHaveBeenCalledWith("maria@email.com");
    expect(h.limparBatismo).toHaveBeenCalled();
  });
  it("e-mail com conta → existe, e a anônima fica guardada (pix-vincular) antes de qualquer troca de sessão", async () => {
    h.definir.mockResolvedValueOnce({ erro: "email_em_uso", mensagem: "A user with this email address has already been registered" });
    expect(await emailAntesDoPix("maria@email.com")).toEqual({ existe: true });
    expect(h.guardar).toHaveBeenCalledTimes(1);
  });
  it("sessão já com o MESMO e-mail → segue; com OUTRO → erro (nunca troca o e-mail de uma conta de verdade)", async () => {
    h.emailAtual = "maria@email.com";
    expect(await emailAntesDoPix("MARIA@email.com")).toEqual({ ok: true, via: "mesma_conta" });
    h.emailAtual = "joana@email.com";
    expect(await emailAntesDoPix("maria@email.com")).toMatchObject({ motivo: "outra_conta" });
    expect(h.definir).not.toHaveBeenCalled();
  });
  it("sem sessão anônima (chave do painel desligada) → erro 'sessao'; inválido → 'invalido'; falha → 'falhou'", async () => {
    h.sessao = "indisponivel";
    expect(await emailAntesDoPix("maria@email.com")).toMatchObject({ motivo: "sessao" });
    h.sessao = "ok";
    expect(await emailAntesDoPix("maria@")).toMatchObject({ motivo: "invalido" });
    h.definir.mockResolvedValueOnce({ erro: "falhou", mensagem: "network" });
    expect(await emailAntesDoPix("maria@email.com")).toMatchObject({ motivo: "falhou" });
  });
});

describe("entrarAntesDoPix", () => {
  it("código errado → erro, sem vincular", async () => {
    h.verifyOtp.mockResolvedValueOnce({ data: {}, error: { message: "Token has expired or is invalid", status: 403 } });
    expect(await entrarAntesDoPix("maria@email.com", "111111")).toMatchObject({ motivo: "codigo_errado" });
    expect(h.vincular).not.toHaveBeenCalled();
  });
  it("código certo → entra e tenta trazer qualquer compra da anônima (forçado)", async () => {
    h.verifyOtp.mockResolvedValueOnce({ data: { session: {} }, error: null });
    expect(await entrarAntesDoPix("maria@email.com", " 123456 ")).toEqual({ ok: true, via: "codigo" });
    expect(h.verifyOtp).toHaveBeenCalledWith({ email: "maria@email.com", token: "123456", type: "email" });
    expect(h.vincular).toHaveBeenCalledWith("c0ffee00-0000-4000-8000-000000000002", true);
  });
});

describe("conferirPix sem sessão (Pix reaberto pelo link do e-mail noutro navegador)", () => {
  it("nem chama o asaas-pix", async () => {
    h.sessao = "indisponivel";
    const pix = { orderId: "a6e3b0f1c2d34e5f9a8b7c6d5e4f3a2b", qrCode: "000201...", qrCodeBase64: null, expiresAt: null, criadoEm: Date.now(), oferta: "LN_sempre279" as const, doEmail: true };
    expect(await conferirPix(pix, "https://www.coreaplicativo.com.br/organizar")).toBe(false);
    expect(h.invoke).not.toHaveBeenCalled();
  });
});
