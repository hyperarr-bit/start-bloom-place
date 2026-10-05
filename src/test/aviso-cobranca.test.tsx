/**
 * Cobrança recusada na loja (26/09): 11 testes do iPhone com o cartão recusado
 * no fim do teste. Só avisa quem ainda quer pagar (renovação ligada).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";

const estado = vi.hoisted(() => ({
  problema: { temProblema: true, comAcesso: false, url: "https://apps.apple.com/account/subscriptions" as string | null },
  auth: {} as Record<string, unknown>,
}));
vi.mock("@/lib/revenuecat", async (original) => ({
  ...(await original<typeof import("@/lib/revenuecat")>()),
  problemaDeCobranca: vi.fn(async () => estado.problema),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => estado.auth }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: (_k: string, d: unknown) => d, loaded: true }) }));
vi.mock("@/lib/purchase-tracking", () => ({ firePixPurchaseOnce: vi.fn(), temPixEmConfirmacao: () => false }));
vi.mock("@/components/paywall/PaywallAssinatura", () => ({
  PaywallAssinatura: () => (
    <div data-testid="paywall-gate">
      <h2>Sua vida inteira organizada</h2>
      <button>Começar 3 dias grátis</button>
    </div>
  ),
}));
vi.mock("@/components/paywall/PaywallFlow", () => ({ PaywallFlow: () => <div data-testid="paywall-web" /> }));

import { lerProblemaDeCobranca } from "@/lib/revenuecat";
import { trackEvent } from "@/lib/analytics";
import { AvisoCobrancaRecusada } from "@/components/app/AvisoCobrancaRecusada";
import { TrialBanner } from "@/components/TrialBanner";

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

/* 28/09: sem acesso, o bloqueio do TrialBanner (fixed inset-0 z-[310]) cobria
 * a faixa — a pessoa via "compre de novo" em vez de "atualize o pagamento". */
describe("Cobrança recusada — o aviso por cima do bloqueio", () => {
  const Ir = () => {
    const navigate = useNavigate();
    return <button onClick={() => navigate("/planos")}>ir pra planos</button>;
  };
  /** O que o App.tsx monta: a faixa no alto do app + o TrialBanner depois das rotas. */
  const montarApp = () =>
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <div data-testid="topo-do-app"><AvisoCobrancaRecusada /></div>
        <main>Home</main>
        <Ir />
        <TrialBanner />
      </MemoryRouter>
    );
  const views = () => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === "aviso_cobranca_view");
  const gate = () => document.querySelector(".fixed.inset-0") as HTMLElement | null;
  const usuario = { id: "u1", email: "maria@exemplo.com" };

  beforeEach(() => {
    localStorage.clear();
    vi.mocked(trackEvent).mockClear();
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  });
  afterEach(() => {
    cleanup();
    delete (window as { Capacitor?: unknown }).Capacitor;
  });

  it("sem acesso: o aviso aparece NO ALTO do bloqueio, antes do paywall, abaixo da área segura — um evento só", async () => {
    estado.problema = { temProblema: true, comAcesso: false, url: "https://apps.apple.com/account/subscriptions" };
    estado.auth = { user: usuario, subLoaded: true, isSubscribed: false, noTrial: true, trialExpired: false };
    montarApp();
    const aviso = (await screen.findByText("Seu pagamento não passou")).closest('[role="alert"]') as HTMLElement;
    expect(screen.getAllByText("Seu pagamento não passou")).toHaveLength(1);
    // dentro do overlay do gate, e não mais na faixa escondida atrás dele
    expect(gate()).not.toBeNull();
    expect(gate()!.contains(aviso)).toBe(true);
    expect(screen.getByTestId("topo-do-app")).toBeEmptyDOMElement();
    // no alto: vem antes do paywall do gate, em fluxo normal (empurra, não cobre)
    const paywall = screen.getByTestId("paywall-gate");
    expect(aviso.compareDocumentPosition(paywall) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(aviso.className).not.toMatch(/\b(fixed|absolute|sticky)\b/);
    expect(screen.getByRole("button", { name: /Começar 3 dias grátis/ })).toBeInTheDocument();
    // área segura do topo (o mesmo recuo que o resto do app usa)
    expect(aviso.parentElement).toHaveClass("pt-[var(--app-safe-top)]");
    // o texto certo pra quem perdeu o acesso, com o caminho pra loja
    expect(aviso.textContent).toMatch(/Atualize a forma de pagamento na App Store pra voltar a usar o CORE\./);
    expect(screen.getByRole("link", { name: "Atualizar pagamento" })).toHaveAttribute("href", "https://apps.apple.com/account/subscriptions");
    // o evento sai num efeito depois do aviso montar — com a máquina cheia ele chega um tique depois (05/10: barrou o push)
    await waitFor(() => expect(views()).toEqual([["aviso_cobranca_view", { com_acesso: false }]]));
  });

  it("sem acesso, fora do bloqueio (ex.: /planos): volta pra faixa de cima — sem contar outra exibição", async () => {
    estado.problema = { temProblema: true, comAcesso: false, url: null };
    estado.auth = { user: usuario, subLoaded: true, isSubscribed: false, noTrial: true, trialExpired: false };
    montarApp();
    await screen.findByText("Seu pagamento não passou");
    expect(gate()).not.toBeNull();
    fireEvent.click(screen.getByText("ir pra planos"));
    expect(gate()).toBeNull();
    const aviso = screen.getByText("Seu pagamento não passou").closest('[role="alert"]') as HTMLElement;
    expect(screen.getByTestId("topo-do-app").contains(aviso)).toBe(true);
    expect(views()).toHaveLength(1);
  });

  it("com acesso (carência ligada): continua como hoje — faixa no alto do app, sem bloqueio", async () => {
    estado.problema = { temProblema: true, comAcesso: true, url: "https://apps.apple.com/account/subscriptions" };
    estado.auth = { user: usuario, subLoaded: true, isSubscribed: true, noTrial: false, trialExpired: false };
    montarApp();
    const aviso = (await screen.findByText("Seu pagamento não passou")).closest('[role="alert"]') as HTMLElement;
    expect(gate()).toBeNull();
    expect(screen.getByTestId("topo-do-app").firstElementChild).toBe(aviso);
    expect(aviso.textContent).toMatch(/pra não perder o acesso\./);
    expect(views()).toEqual([["aviso_cobranca_view", { com_acesso: true }]]);
  });

  it("'Agora não' dentro do bloqueio esconde o aviso e o bloqueio segue igual", async () => {
    estado.problema = { temProblema: true, comAcesso: false, url: null };
    estado.auth = { user: usuario, subLoaded: true, isSubscribed: false, noTrial: true, trialExpired: false };
    montarApp();
    await screen.findByText("Seu pagamento não passou");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Agora não" })); });
    expect(screen.queryByText("Seu pagamento não passou")).toBeNull();
    expect(screen.getByTestId("paywall-gate")).toBeInTheDocument();
  });

  it("fora do app nativo (web): nada, nem no bloqueio", async () => {
    delete (window as { Capacitor?: unknown }).Capacitor;
    estado.problema = { temProblema: true, comAcesso: false, url: null };
    estado.auth = { user: usuario, subLoaded: true, isSubscribed: false, noTrial: true, trialExpired: false };
    montarApp();
    // 01/10: na web o bloqueio virou "Assine no app" (venda só nas lojas); o
    // aviso de cobrança continua sendo coisa do app, então aqui não aparece.
    expect(await screen.findByTestId("assine-no-app")).toBeInTheDocument();
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText("Seu pagamento não passou")).toBeNull();
    expect(views()).toHaveLength(0);
  });
});
