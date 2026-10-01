/**
 * Resgate do teste cancelado no iPHONE (20/09): a tela oferecia o mensal "em
 * vez de R$ 159,90 de uma vez" — preço do Android e mecânica de compra única.
 * No iPhone o anual é R$ 97,90 por ano, assinatura.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SaveOfferDowngrade } from "./SaveOfferDowngrade";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1" }, isSubscribed: true, billingPeriod: "annual" }) }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => true }));
vi.mock("@/lib/teste-gratis", () => ({ trialCartaoAtivo: () => true }));
vi.mock("@/lib/loja", () => ({ ehApple: () => true }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
// 01/10 (teste de preço): o preço do ano vem do que ela COMPROU (pedido do
// lembrete) ou da loja — nunca de um "97,90" chumbado.
const loja = vi.hoisted(() => ({ preco: "R$ 97,90" as string | null }));
vi.mock("@/lib/revenuecat", () => ({
  estadoTrialCancelado: async () => true, comprar: vi.fn(), motivoUltimaCompra: () => null,
  prefetchAnualIos: async () => {}, precoAnualIos: () => loja.preco,
}));

afterEach(cleanup);

describe("SaveOfferDowngrade no iPhone", () => {
  it("compara com o anual do iPhone, por ano (preço da loja), e nunca fala em 'de uma vez'", async () => {
    localStorage.clear();
    render(<SaveOfferDowngrade />);
    expect(await screen.findByText(/em vez de R\$ 97,90 por ano/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/159,90|de uma vez|vitalíc|pra sempre/i);
    expect(screen.getByRole("button", { name: /Mudar pro mensal — R\$ 24,90\/mês/ })).toBeInTheDocument();
  });

  it("quem comprou no braço 69,90 lê 69,90 (o preço guardado na compra vence o da loja de agora)", async () => {
    localStorage.clear();
    localStorage.setItem("core-lembrete-teste", JSON.stringify({ fimMs: Date.now() + 86400e3, precoAno: "R$ 69,90" }));
    render(<SaveOfferDowngrade />);
    expect(await screen.findByText(/em vez de R\$ 69,90 por ano/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/97,90/);
  });

  it("loja muda e nada guardado: fala 'do anual', sem inventar número", async () => {
    localStorage.clear();
    loja.preco = null;
    try {
      render(<SaveOfferDowngrade />);
      expect(await screen.findByText(/em vez do anual/)).toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/97,90|69,90/);
    } finally { loja.preco = "R$ 97,90"; }
  });
});
