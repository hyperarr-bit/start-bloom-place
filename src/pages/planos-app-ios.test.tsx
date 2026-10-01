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
// 01/10 (teste de preço): o preço do ano vem da loja (ou do que ela comprou), nunca chumbado
const loja = vi.hoisted(() => ({ preco: "R$ 97,90" as string | null }));
vi.mock("@/lib/revenuecat", () => ({
  initRevenueCat: vi.fn(), restaurar: vi.fn().mockResolvedValue(false), abrirResgateApple: vi.fn(),
  prefetchAnualIos: vi.fn(async () => {}), precoAnualIos: () => loja.preco,
}));
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

  it("em teste grátis do anual: diz até quando é grátis, quanto cobra depois (preço da loja) e que cancelar antes é de graça", async () => {
    localStorage.clear();
    const fim = new Date(Date.now() + 2 * 86400e3).toISOString();
    auth.estado = { ...auth.estado, isSubscribed: true, billingPeriod: "annual", subscriptionEnd: fim, paymentMethod: "play_store" };
    montar();
    expect(await screen.findByText(/Teste grátis até .* Depois, R\$ 97,90 por ano, renovando automaticamente — cancele antes e não paga nada\./)).toBeInTheDocument();
    expect(screen.getByText("Plano anual")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Pagamento único|vitalíc|pra sempre/i);
  });

  it("quem comprou no braço 69,90 lê 69,90 — o preço guardado na compra vence o da loja de agora", async () => {
    localStorage.clear();
    localStorage.setItem("core-lembrete-teste", JSON.stringify({ fimMs: Date.now() + 86400e3, precoAno: "R$ 69,90" }));
    const fim = new Date(Date.now() + 2 * 86400e3).toISOString();
    auth.estado = { ...auth.estado, isSubscribed: true, billingPeriod: "annual", subscriptionEnd: fim, paymentMethod: "play_store" };
    montar();
    expect(await screen.findByText(/Depois, R\$ 69,90 por ano/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/97,90/);
  });

  it("loja muda e nada guardado: não inventa número", async () => {
    localStorage.clear();
    loja.preco = null;
    try {
      const fim = new Date(Date.now() + 2 * 86400e3).toISOString();
      auth.estado = { ...auth.estado, isSubscribed: true, billingPeriod: "annual", subscriptionEnd: fim, paymentMethod: "play_store" };
      montar();
      expect(await screen.findByText(/Teste grátis até .* Depois renova por ano no valor mostrado na App Store/)).toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/97,90|69,90/);
    } finally { loja.preco = "R$ 97,90"; }
  });
});
