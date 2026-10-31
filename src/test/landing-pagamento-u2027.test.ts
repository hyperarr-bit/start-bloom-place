/**
 * O Pix do "Seu 2027" de verdade (src/landing/pagamento.ts, 31/10) — o invoke do asaas-pix com a compra, e NENHUM Purchase
 * (nem marca pendente, nem dispara): o upsell não manda Purchase pra Meta (recomendação, confirmar com o dono: _shared/pix-upsell.ts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) }, auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock("@/lib/purchase-tracking", () => ({ markPixPurchasePending: vi.fn(), firePixPurchaseOnce: vi.fn(async () => true) }));
const viva = vi.fn(async () => true);
vi.mock("@/pages/hoje/conta", () => ({
  EMAIL_OK: /@/, abrirSessaoParaPagar: vi.fn(), emailAtual: vi.fn(), gravarAtribuicao: vi.fn(), pedirBoasVindas: vi.fn(), salvarEmailDaCompra: vi.fn(),
  sessaoViva: () => viva(), trazerCompraParaConta: vi.fn(),
}));
vi.mock("@/pages/venda/rastreio", () => ({ cookiesDaMeta: () => ({ fbp: null, fbc: null }) }));
vi.mock("@/lib/sessao-anonima", () => ({ definirEmailDaCompra: vi.fn(), guardarCompraAnonima: vi.fn(), limparBatismo: vi.fn(), vincularCompraAnonima: vi.fn() }));

import { conferirPixU2027, gerarPixU2027 } from "@/landing/pagamento";
import { firePixPurchaseOnce, markPixPurchasePending } from "@/lib/purchase-tracking";

beforeEach(() => { invoke.mockReset(); viva.mockClear(); viva.mockImplementation(async () => true); vi.mocked(markPixPurchasePending).mockClear(); vi.mocked(firePixPurchaseOnce).mockClear(); });

describe("gerarPixU2027 / conferirPixU2027", () => {
  it("pede o Pix da COMPRA (offer u2027 + compra) e devolve dono_igual / no_email; sem marcar Purchase", async () => {
    invoke.mockResolvedValue({ data: { orderId: "qr_u27_1", qrCode: "000201abc", qrCodeBase64: null, expiresAt: "2026-11-01T15:00:00-03:00", dono_igual: false, no_email: true }, error: null });
    const r = await gerarPixU2027("qr_vit_1");
    expect(invoke).toHaveBeenCalledWith("asaas-pix", { body: { action: "create", offer: "u2027", compra: "qr_vit_1" } });
    expect(r).toMatchObject({ orderId: "qr_u27_1", donoIgual: false, comEmail: true, expiresAt: "2026-11-01T15:00:00-03:00" });
    expect(markPixPurchasePending).not.toHaveBeenCalled();
  });
  it("ja_tem_2027 → jaTem2027; erro → mensagem curta", async () => {
    invoke.mockResolvedValueOnce({ data: { ja_tem_2027: true }, error: null });
    expect(await gerarPixU2027("qr_vit_1")).toEqual({ jaTem2027: true });
    invoke.mockResolvedValueOnce({ data: { error: "x" }, error: { message: "502" } });
    expect(await gerarPixU2027("qr_vit_1")).toMatchObject({ erro: expect.stringMatching(/Não consegui gerar o Pix/) });
  });
  it("conferir: check do u2027; pago → true SEM o pixel; sem sessão nem chama", async () => {
    invoke.mockResolvedValue({ data: { paid: true, pacote2027: true }, error: null });
    const pix = { orderId: "qr_u27_1", qrCode: "000201abc", qrCodeBase64: null, expiresAt: "2026-11-01T15:00:00-03:00", donoIgual: true };
    expect(await conferirPixU2027(pix)).toBe(true);
    expect(invoke).toHaveBeenCalledWith("asaas-pix", { body: { action: "check", id: "qr_u27_1", offer: "u2027" } });
    expect(firePixPurchaseOnce).not.toHaveBeenCalled();
    invoke.mockClear(); viva.mockImplementation(async () => false);
    expect(await conferirPixU2027(pix)).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });
});
