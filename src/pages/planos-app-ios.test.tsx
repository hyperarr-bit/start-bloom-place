/**
 * "MEU ACESSO" no iPhone (20/09): dizia "Pagamento único pela App Store" sob
 * o botão e "conta Google" no restaurar. Assinante em teste grátis do anual
 * precisa ler até quando é grátis e quanto cobra depois.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
// o build define __APP_VERSION__ (vite define); no vitest não existe
(globalThis as unknown as { __APP_VERSION__: string }).__APP_VERSION__ = "teste";
import PlanosApp from "./PlanosApp";

const auth = vi.hoisted(() => ({
  estado: { user: { id: "u1", email: "x@y.z" }, isSubscribed: false, subLoaded: true, billingPeriod: null as string | null, subscriptionEnd: null as string | null, paymentMethod: null as string | null, inGracePeriod: false },
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth.estado }));
vi.mock("@/lib/loja", async (orig) => ({ ...(await orig<typeof import("@/lib/loja")>()), ehApple: () => true, pelaLoja: () => "pela App Store", sufixoPagamento: () => "" }));
vi.mock("@/lib/teste-gratis", () => ({ estadoTeste: () => ({ fase: "nunca" }), trialCartaoAtivo: () => true }));
vi.mock("@/lib/revenuecat", () => ({ initRevenueCat: vi.fn(), restaurar: vi.fn().mockResolvedValue(false), abrirResgateApple: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/components/app/AppPurchaseSheet", () => ({ AppPurchaseSheet: () => null }));
vi.mock("@/components/paywall/EntradaDeCodigo", () => ({ EntradaDeCodigo: () => null }));

afterEach(cleanup);
const montar = () => render(<MemoryRouter><PlanosApp /></MemoryRouter>);

describe("Meu acesso no iPhone", () => {
  it("sem assinatura: o botão vende ASSINATURA pela App Store, não pagamento único", () => {
    auth.estado = { ...auth.estado, isSubscribed: false, billingPeriod: null, subscriptionEnd: null, paymentMethod: null };
    montar();
    expect(screen.getByText(/Assinatura pela App Store · cancele quando quiser/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Pagamento único|Google|vitalíc/i);
  });

  it("em teste grátis do anual: diz até quando é grátis, quanto cobra depois e que cancelar antes é de graça", () => {
    const fim = new Date(Date.now() + 2 * 86400e3).toISOString();
    auth.estado = { ...auth.estado, isSubscribed: true, billingPeriod: "annual", subscriptionEnd: fim, paymentMethod: "play_store" };
    montar();
    expect(screen.getByText(/Teste grátis até .* Depois, R\$ 97,90 por ano, renovando automaticamente — cancele antes e não paga nada\./)).toBeInTheDocument();
    expect(screen.getByText("Plano anual")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Pagamento único|vitalíc|pra sempre/i);
  });
});
