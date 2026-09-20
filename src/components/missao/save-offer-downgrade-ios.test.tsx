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
vi.mock("@/lib/revenuecat", () => ({ estadoTrialCancelado: async () => true, comprar: vi.fn(), motivoUltimaCompra: () => null }));

afterEach(cleanup);

describe("SaveOfferDowngrade no iPhone", () => {
  it("compara com o anual do iPhone, por ano, e nunca fala em 'de uma vez'", async () => {
    localStorage.clear();
    render(<SaveOfferDowngrade />);
    expect(await screen.findByText(/em vez de R\$ 97,90 por ano/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/159,90|de uma vez|vitalíc|pra sempre/i);
    expect(screen.getByRole("button", { name: /Mudar pro mensal — R\$ 24,90\/mês/ })).toBeInTheDocument();
  });
});
