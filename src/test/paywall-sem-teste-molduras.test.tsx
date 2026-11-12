/**
 * PAYWALL SEM TESTE NAS MOLDURAS (12/11) — chave `paywall_teste`:
 *  · 12/11 noite: SÓ iPhone — o Android fica como hoje com qualquer valor da chave; no iPhone o visual sai do A/B
 *    `paywall_visual` (android = PaywallW semTeste · enxovaly = PaywallSemTeste);
 *  · funil (ComecarW, passo offer): off = paywall sem teste, SEM a tela do sino antes; on = a bifurcação de
 *    hoje (iPhone: PaywallIOS dentro do sino; Android: PaywallW);
 *  · gate do app (TrialBanner, conta logada sem acesso): off = PaywallSemTeste modo gate (sem "Você ganhou 3 dias
 *    grátis" e sem o presente do bloqueio por cima); on = o gate de hoje;
 *  · FECHAR E REABRIR: quem pagou não vê paywall nenhum, com a chave on ou off; a chave lida na abertura anterior
 *    vale na reabertura antes de o RevenueCat responder.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const estado = vi.hoisted(() => ({
  auth: { user: null as null | { id: string; email: string; created_at: string; user_metadata: Record<string, unknown> }, loading: false, trialExpired: false, noTrial: true, isSubscribed: false, subLoaded: true, trialDay: 1, trialHoursLeft: 0 },
}));
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), trackEvent: vi.fn(), trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => estado.auth }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: (_k: string, d: unknown) => d, loaded: true }) }));
vi.mock("@/lib/sessao-anonima", () => ({ anonimoLigado: async () => true, precisaBatizar: async () => true }));
vi.mock("@/lib/purchase-tracking", () => ({ firePixPurchaseOnce: vi.fn(), temPixEmConfirmacao: () => false }));
vi.mock("@/lib/revenuecat", () => ({
  compraNaLojaSemConta: async () => false,
  estadoRevenueCat: () => "pronto",
  temAnualIos: () => true,
  anualIosTemTrial: () => true,
}));
vi.mock("@/lib/notificacoes", () => ({
  agendarResgateDoPlano: vi.fn(async () => {}),
  cancelarResgateDoPlano: vi.fn(async () => {}),
  estadoPermissao: vi.fn(async () => "granted"),
  pedirPermissao: vi.fn(async () => true),
}));
vi.mock("@capacitor/app", () => ({ App: { addListener: async () => ({ remove: async () => {} }), minimizeApp: async () => {} } }));
vi.mock("@/components/paywall/PaywallSemTeste", () => ({
  PaywallSemTeste: ({ modo = "funil" }: { modo?: string }) => <div data-testid="sem-teste" data-modo={modo}>sem teste</div>,
}));
vi.mock("@/pages/funis/w/PaywallW", () => ({ PaywallW: ({ semTeste }: { semTeste?: boolean }) => <div data-testid={semTeste ? "paywall-w-sem-teste" : "paywall-w"}>paywall</div> }));
vi.mock("@/pages/funis/ios/PaywallIOS", () => ({ PaywallIOS: ({ modo = "funil" }: { modo?: string }) => <div data-testid="paywall-ios" data-modo={modo}>paywall ios</div> }));
vi.mock("@/pages/funis/ios/SinoIOS", () => ({ AntesDoPaywallIOS: ({ children }: { children?: ReactNode }) => <div data-testid="antes-do-paywall">{children}</div> }));
vi.mock("@/pages/funis/ios/CadastroIOS", () => ({ SignupIOS: () => <div />, ConfirmIOS: () => <div />, LiberandoIOS: () => <div /> }));
vi.mock("@/pages/funis/radar/ComecarRadar", () => ({ SignupScreen: () => <div />, ConfirmScreen: () => <div />, LiberandoScreen: () => <div />, POS_COMPRA_OAUTH_KEY: "core-pos-compra-oauth" }));
vi.mock("@/components/app/AppWelcome", () => ({ AppWelcome: () => <div data-testid="welcome">welcome</div> }));
vi.mock("@/components/paywall/PaywallAssinatura", () => ({ PaywallAssinatura: ({ contexto }: { contexto: string }) => <div data-testid="paywall-assinatura">{contexto}</div> }));
vi.mock("@/components/paywall/PaywallFlow", () => ({ PaywallFlow: () => <div data-testid="paywall-web" />, AppLegalFooter: () => null }));
vi.mock("@/components/app/AvisoCobrancaRecusada", () => ({ VagaDoAvisoCobranca: () => null }));
vi.mock("@/components/app/Presente69", () => ({ PresenteNoBloqueio: () => <div data-testid="presente-bloqueio" /> }));
vi.mock("framer-motion", async (orig) => {
  const m = await orig<typeof import("framer-motion")>();
  return { ...m, AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</> };
});

import ComecarW from "@/pages/funis/w/ComecarW";
import { TrialBanner } from "@/components/TrialBanner";
import { CHAVE_FORCA_PAYWALL_VISUAL, CHAVE_PAYWALL_TESTE_APARELHO, _zerarChavePaywallTeste, _zerarPaywallVisual, registrarPaywallTesteRemoto } from "@/lib/paywall-teste";

const plataforma = (p: "ios" | "android") => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => p }; };
const espera = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const funil = (url = "/app?step=offer") => {
  window.history.replaceState({}, "", url);
  return render(<MemoryRouter initialEntries={[url]}><ComecarW /></MemoryRouter>);
};
const gate = () => render(<MemoryRouter initialEntries={["/home"]}><main>Home</main><TrialBanner /></MemoryRouter>);
const chave = (v: "on" | "off") => registrarPaywallTesteRemoto({ current: { identifier: "default", metadata: { paywall_teste: v } }, all: {} });
const conta = () => ({ id: "uid-x", email: "a@exemplo.com", created_at: new Date().toISOString(), user_metadata: {} });

beforeEach(() => {
  delete (globalThis as { __PAYWALL_TESTE__?: string }).__PAYWALL_TESTE__; // o padrão de verdade (o setup fixa "on")
  localStorage.clear(); // conta VAZIA, aparelho novo
  sessionStorage.clear();
  _zerarChavePaywallTeste();
  _zerarPaywallVisual();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  Object.assign(estado.auth, { user: null, noTrial: true, isSubscribed: false, subLoaded: true, trialExpired: false });
  plataforma("ios");
});
afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; (globalThis as { __PAYWALL_TESTE__?: string }).__PAYWALL_TESTE__ = "on"; });

describe("funil (ComecarW, passo offer)", () => {
  it("iPhone, chave off (padrão), braço enxovaly: PaywallSemTeste, sem o sino e sem o paywall de hoje", async () => {
    localStorage.setItem(CHAVE_FORCA_PAYWALL_VISUAL, "enxovaly");
    funil();
    await espera();
    expect(screen.getByTestId("sem-teste").dataset.modo).toBe("funil");
    expect(screen.queryByTestId("antes-do-paywall")).toBeNull();
    expect(screen.queryByTestId("paywall-ios")).toBeNull();
    expect(screen.queryByTestId("paywall-w")).toBeNull();
    expect(screen.queryByTestId("paywall-w-sem-teste")).toBeNull();
  });
  it("iPhone, chave off (padrão), braço android: o PaywallW vendendo sem teste, sem o sino", async () => {
    funil("/app?step=offer&paywall-visual=android");
    await espera();
    expect(screen.getByTestId("paywall-w-sem-teste")).toBeInTheDocument();
    expect(screen.queryByTestId("sem-teste")).toBeNull();
    expect(screen.queryByTestId("antes-do-paywall")).toBeNull();
    expect(screen.queryByTestId("paywall-ios")).toBeNull();
  });
  it("iPhone, sem força: o sorteio escolhe UM dos dois braços (e só um)", async () => {
    funil();
    await espera();
    const n = ["sem-teste", "paywall-w-sem-teste"].filter((id) => screen.queryByTestId(id)).length;
    expect(n).toBe(1);
  });
  it("ANDROID fica como hoje: chave off (ou ausente) = o PaywallW de hoje (vitalício 97,90 + mensal 24,90), nada sem teste", async () => {
    plataforma("android");
    chave("off");
    localStorage.setItem(CHAVE_FORCA_PAYWALL_VISUAL, "enxovaly");
    funil("/app?step=offer&paywall-teste=off");
    await espera();
    expect(screen.getByTestId("paywall-w")).toBeInTheDocument();
    expect(screen.queryByTestId("paywall-w-sem-teste")).toBeNull();
    expect(screen.queryByTestId("sem-teste")).toBeNull();
  });
  it("iPhone, chave on: o paywall de hoje (sino + PaywallIOS)", async () => {
    chave("on");
    funil();
    await espera();
    expect(screen.getByTestId("antes-do-paywall")).toBeInTheDocument();
    expect(screen.getByTestId("paywall-ios")).toBeInTheDocument();
    expect(screen.queryByTestId("sem-teste")).toBeNull();
  });
  it("Android, chave on: o PaywallW de hoje", async () => {
    plataforma("android");
    chave("on");
    funil();
    await espera();
    expect(screen.getByTestId("paywall-w")).toBeInTheDocument();
    expect(screen.queryByTestId("sem-teste")).toBeNull();
  });
  it("a resposta do RevenueCat chega com a tela aberta e troca o paywall (on → hoje; off → sem teste)", async () => {
    localStorage.setItem(CHAVE_FORCA_PAYWALL_VISUAL, "enxovaly");
    funil();
    await espera();
    expect(screen.getByTestId("sem-teste")).toBeInTheDocument();
    await act(async () => { chave("on"); });
    expect(screen.getByTestId("paywall-ios")).toBeInTheDocument();
    await act(async () => { chave("off"); });
    expect(screen.getByTestId("sem-teste")).toBeInTheDocument();
  });
});

describe("gate do app (TrialBanner)", () => {
  beforeEach(() => { estado.auth.user = conta(); });
  it("iPhone, chave off: PaywallSemTeste modo gate, sem o presente do bloqueio por cima", async () => {
    gate();
    expect((await screen.findByTestId("sem-teste")).dataset.modo).toBe("gate");
    expect(screen.queryByTestId("presente-bloqueio")).toBeNull();
    expect(screen.queryByTestId("paywall-assinatura")).toBeNull();
  });
  it("ANDROID, chave off: o gate de hoje (PaywallAssinatura + presente do bloqueio), nada sem teste", async () => {
    plataforma("android");
    chave("off");
    gate();
    await espera();
    expect(screen.getByTestId("paywall-assinatura").textContent).toBe("gate");
    expect(screen.getByTestId("presente-bloqueio")).toBeInTheDocument();
    expect(screen.queryByTestId("sem-teste")).toBeNull();
  });
  it("conta da Porta, chave off: sem o 'Você ganhou 3 dias grátis'", async () => {
    estado.auth.user = { ...conta(), user_metadata: { porta: { area: "dinheiro" } } };
    gate();
    expect(await screen.findByTestId("sem-teste")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/dias grátis/i);
  });
  it("chave on: o gate de hoje (PaywallAssinatura + presente do bloqueio)", async () => {
    plataforma("android");
    chave("on");
    gate();
    await espera();
    expect(screen.getByTestId("paywall-assinatura").textContent).toBe("gate");
    expect(screen.getByTestId("presente-bloqueio")).toBeInTheDocument();
    expect(screen.queryByTestId("sem-teste")).toBeNull();
  });
});

describe("FECHAR E REABRIR O APP", () => {
  it.each(["on", "off"] as const)("quem pagou não vê paywall nenhum ao reabrir (chave %s)", async (v) => {
    chave(v);
    estado.auth.user = conta();
    Object.assign(estado.auth, { isSubscribed: true, noTrial: false });
    const { unmount } = gate();
    await espera();
    expect(screen.queryByTestId("sem-teste")).toBeNull();
    expect(screen.queryByTestId("paywall-ios")).toBeNull();
    expect(screen.queryByTestId("paywall-assinatura")).toBeNull();
    unmount();
    _zerarChavePaywallTeste(); // o app morreu
    gate();
    await espera();
    expect(document.body.textContent).toBe("Home");
  });
  it("a chave da abertura anterior vale na reabertura, antes de o RevenueCat responder", async () => {
    chave("on");
    _zerarChavePaywallTeste(); // fechou o app
    expect(localStorage.getItem(CHAVE_PAYWALL_TESTE_APARELHO)).toBe("on");
    funil();
    await espera();
    expect(screen.getByTestId("paywall-ios")).toBeInTheDocument();
  });
});
