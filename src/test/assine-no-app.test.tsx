/**
 * QUEM ESTÁ LOGADO NA WEB SEM ACESSO (01/10): em vez do paywall com Pix, vê
 * "Assine no app e use aqui também" — com os selos passando pelo
 * /baixar?origem=web_paywall. No APP DA LOJA o gate continua sendo o
 * PaywallAssinatura, byte a byte. E a /planos da web só abre o Pix com
 * ?oferta= (o w97 do e-mail de cartão recusado) ou pra quem já tem acesso.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const auth = {
  user: { id: "u1", email: "ana@exemplo.com" } as { id: string; email: string } | null,
  noTrial: true, trialExpired: true, isSubscribed: false, subLoaded: true, trialDay: 0, trialHoursLeft: 0,
  signOut: vi.fn(),
};
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: () => "", set: vi.fn(), loaded: true }) }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
vi.mock("@/lib/purchase-tracking", () => ({ firePixPurchaseOnce: vi.fn(), temPixEmConfirmacao: () => false }));
vi.mock("@/components/paywall/PaywallFlow", () => ({ PaywallFlow: () => <div data-testid="paywall-pix" /> }));
vi.mock("@/components/paywall/PaywallAssinatura", () => ({ PaywallAssinatura: () => <div data-testid="paywall-assinatura" /> }));
vi.mock("@/components/app/AvisoCobrancaRecusada", () => ({ VagaDoAvisoCobranca: () => null }));
vi.mock("@/pages/Planos", () => ({ default: () => <div data-testid="planos-pix" /> }));

import { TrialBanner } from "@/components/TrialBanner";
import PlanosWeb from "@/pages/site/PlanosWeb";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";

const ua = (v: string) => Object.defineProperty(navigator, "userAgent", { value: v, configurable: true });
const nativo = (on: boolean) => {
  if (on) (window as { Capacitor?: unknown }).Capacitor = { getPlatform: () => "android", isNativePlatform: () => true };
  else delete (window as { Capacitor?: unknown }).Capacitor;
};

beforeEach(() => {
  nativo(false);
  ua("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari");
  Object.assign(auth, { user: { id: "u1", email: "ana@exemplo.com" }, noTrial: true, trialExpired: true, isSubscribed: false, subLoaded: true });
  vi.mocked(trackEvent).mockClear();
});
afterEach(() => { cleanup(); nativo(false); });

describe("TrialBanner (o gate) na WEB", () => {
  it("conta sem acesso vê 'Assine no app', com o e-mail dela e os selos pelo /baixar?origem=web_paywall", () => {
    render(<MemoryRouter initialEntries={["/home"]}><TrialBanner /></MemoryRouter>);
    const tela = screen.getByTestId("assine-no-app");
    expect(tela.getAttribute("data-variante")).toBe("gate");
    expect(screen.queryByTestId("paywall-pix")).toBeNull();
    expect(screen.queryByTestId("paywall-assinatura")).toBeNull();
    expect(tela.textContent).toContain("ana@exemplo.com");
    const selos = screen.getAllByRole("link").filter((a) => a.hasAttribute("data-loja"));
    expect(selos.map((a) => a.getAttribute("href"))).toEqual(["/baixar?origem=web_paywall&loja=ios", "/baixar?origem=web_paywall&loja=android"]);
    expect(screen.getByTestId("assine-oferta").textContent).not.toMatch(/R\$|dias grátis/); // 01/10: sem preço
    expect(screen.getByTestId("assine-no-app").textContent).not.toMatch(/R\$/);
    expect(trackEvent).toHaveBeenCalledWith("assine_no_app_view", { variante: "gate", aparelho: "iphone" });
    // saídas: como entrar no app, suporte, sair da conta — ninguém fica preso
    expect(screen.getByRole("link", { name: "Como entrar no app" }).getAttribute("href")).toBe("/como-entrar");
    fireEvent.click(screen.getByTestId("assine-sair"));
    expect(auth.signOut).toHaveBeenCalled();
    fireEvent.click(selos[0]);
    expect(trackEventBeacon).toHaveBeenCalledWith("loja_click", { loja: "ios", onde: "web_paywall", aparelho: "iphone" });
  });

  it("conta antiga com o trial de 7 dias vencido (sem noTrial) também vê 'Assine no app'", () => {
    auth.noTrial = false;
    render(<MemoryRouter initialEntries={["/financas"]}><TrialBanner /></MemoryRouter>);
    expect(screen.getByTestId("assine-no-app")).toBeInTheDocument();
    expect(screen.queryByText("Ver planos")).toBeNull();
  });

  it("quem tem acesso não vê nada; em /planos o gate não monta (a página cuida)", () => {
    auth.isSubscribed = true;
    const { container, unmount } = render(<MemoryRouter initialEntries={["/home"]}><TrialBanner /></MemoryRouter>);
    expect(container.innerHTML).toBe("");
    unmount();
    auth.isSubscribed = false;
    render(<MemoryRouter initialEntries={["/planos"]}><TrialBanner /></MemoryRouter>);
    expect(screen.queryByTestId("assine-no-app")).toBeNull();
  });
});

describe("TrialBanner no APP DA LOJA — intocado", () => {
  it("conta sem acesso vê o PaywallAssinatura de sempre, nunca o 'Assine no app'", () => {
    nativo(true);
    render(<MemoryRouter initialEntries={["/home"]}><TrialBanner /></MemoryRouter>);
    expect(screen.getByTestId("paywall-assinatura")).toBeInTheDocument();
    expect(screen.queryByTestId("assine-no-app")).toBeNull();
  });

  it("trial vencido no app continua na tela 'Seu período de teste terminou' com 'Ver planos'", () => {
    nativo(true);
    auth.noTrial = false;
    render(<MemoryRouter initialEntries={["/home"]}><TrialBanner /></MemoryRouter>);
    expect(screen.getByText("Seu período de teste terminou")).toBeInTheDocument();
    expect(screen.getByText("Ver planos")).toBeInTheDocument();
    expect(screen.queryByTestId("assine-no-app")).toBeNull();
  });
});

describe("/planos na WEB (PlanosWeb)", () => {
  const montar = (rota: string) => render(<MemoryRouter initialEntries={[rota]}><PlanosWeb /></MemoryRouter>);

  it("?oferta=w97 abre o Planos de sempre (o Pix do e-mail de cartão recusado) — mesmo sem acesso", async () => {
    montar("/planos?oferta=w97");
    expect(await screen.findByTestId("planos-pix")).toBeInTheDocument();
    expect(screen.queryByTestId("assine-no-app")).toBeNull();
  });

  it("?oferta=ds (e-mail h24) também", async () => {
    montar("/planos?oferta=ds");
    expect(await screen.findByTestId("planos-pix")).toBeInTheDocument();
  });

  it("sem oferta e sem acesso → 'Assine no app' (versão página, com voltar)", () => {
    montar("/planos");
    expect(screen.getByTestId("assine-no-app").getAttribute("data-variante")).toBe("pagina");
    expect(screen.getByTestId("assine-voltar").getAttribute("href")).toBe("/home");
    expect(screen.queryByTestId("planos-pix")).toBeNull();
  });

  it("quem já tem acesso (vitalício da web, assinante da loja) vê o Planos = 'Meu acesso'", async () => {
    auth.isSubscribed = true;
    montar("/planos");
    expect(await screen.findByTestId("planos-pix")).toBeInTheDocument();
  });

  it("enquanto o check-subscription não respondeu, não decide nada", () => {
    auth.subLoaded = false;
    const { container } = montar("/planos");
    expect(container.querySelector("[data-testid]")).toBeNull();
  });
});
