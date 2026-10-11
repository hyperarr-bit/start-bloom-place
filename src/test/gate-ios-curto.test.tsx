/**
 * GATE DO iPHONE = O PAYWALL CURTO DO FUNIL (10/10, build 38 — dono: "quem entra logado sem assinatura
 * no iPhone tem que ver o MESMO paywall novo"). O que este arquivo trava:
 *   · iPhone + chave "curto" ligada + conta logada sem assinatura (noTrial) → o TrialBanner mostra o
 *     PaywallIOS curto (título dos 3 dias, card "3 DIAS GRÁTIS", "Sem cobrança hoje", "Continuar"),
 *     SEM o Voltar redondo e com "Entrar com outra conta" + "Excluir conta" + Termos/Privacidade/Restaurar;
 *   · a compra identifica o RevenueCat com o uid ANTES da folha, usa comprarAnualIos, e o pós-compra é o
 *     do gate (recarrega "/"), cancelando a régua do gate; eventos com funil "gate_ios";
 *   · chave desligada pela metadata do RevenueCat → volta o gate antigo (PaywallAssinatura);
 *   · Android, e iPhone com a chave off: o PaywallAssinatura de sempre.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const estado = vi.hoisted(() => ({
  auth: { user: { id: "uid-porta", email: "ana@exemplo.com", created_at: new Date().toISOString(), user_metadata: {} as Record<string, unknown> }, loading: false, trialExpired: false, noTrial: true, isSubscribed: false, subLoaded: true, trialDay: 1, trialHoursLeft: 0 },
  metadataCurto: null as null | "on" | "off",
}));
const rcMock = vi.hoisted(() => ({
  identificar: vi.fn(async (_u: string | null) => undefined),
  comprarAnual: vi.fn(async () => true),
  restaurar: vi.fn(async () => false),
}));
const notif = vi.hoisted(() => ({
  resgate: vi.fn(async (_a: string | null) => undefined),
  cancelarResgate: vi.fn(async () => undefined),
  cancelarRegua: vi.fn(async () => undefined),
  recuperar: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/revenuecat", async (original) => {
  const ofertas = await import("@/lib/ofertas-saida");
  return {
    ...(await original<typeof import("@/lib/revenuecat")>()),
    initRevenueCat: vi.fn(async () => {
      if (estado.metadataCurto) ofertas.registrarChavesRemotas({ current: { identifier: "d", metadata: { paywall_curto: estado.metadataCurto } }, all: {} });
      return "pronto";
    }),
    prefetchAnualIos: vi.fn(async () => undefined),
    temAnualIos: () => true,
    precoAnualIos: () => "R$ 97,90",
    idProdutoAnualIos: () => "core_anual_97",
    mesesDeMensalQuePagamOAno: () => 4,
    ofertaAnualIos: () => "anual_97",
    dadosDaOfertaIos: () => ({ oferta: "anual_97", produto: "core_anual_97", offering: "default", preco: "R$ 97,90", pacote: true }),
    precoMensalDoAnualIos: () => "R$ 8,16",
    diasTrialIos: () => 3,
    anualIosTemTrial: () => true,
    ultimaCompraAnualFoiTrial: () => true,
    fimDaUltimaCompraTrial: () => null,
    comprarAnualIos: () => rcMock.comprarAnual(),
    comprar: vi.fn(async () => true),
    identificarRevenueCat: (u: string | null) => rcMock.identificar(u),
    estadoRevenueCat: () => "pronto",
    restaurar: () => rcMock.restaurar(),
    compraVitaliciaLocal: vi.fn(async () => false),
    compraAssinaturaLocal: vi.fn(async () => false),
    motivoUltimaCompra: () => null,
    valorAnualIos: () => 97.9,
    valorMensalIos: () => 24.9,
    precoMensalIos: () => "R$ 24,90",
    economiaDoAnualIos: () => 67,
    precoDoTesteIos: () => "R$ 0,00",
    carregarPresente69: vi.fn(async () => null),
    carregarMensal19: vi.fn(async () => null),
    marcarToqueDeCompra: vi.fn(),
  };
});
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => estado.auth }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: (_k: string, d: unknown) => d, loaded: true }) }));
vi.mock("@/lib/purchase-tracking", () => ({ firePixPurchaseOnce: vi.fn(), temPixEmConfirmacao: () => false }));
vi.mock("@/lib/notificacoes", () => ({
  pedirLembreteDoTeste: vi.fn(async () => "pendente"),
  cancelarLembreteDoTeste: vi.fn(async () => undefined),
  pedidoDeLembreteDoTeste: () => null,
  agendarRecuperacaoDoPaywall: () => notif.recuperar(),
  cancelarRecuperacaoDoPaywall: vi.fn(async () => undefined),
  agendarResgateDoPlano: (a: string | null) => notif.resgate(a),
  cancelarResgateDoPlano: () => notif.cancelarResgate(),
  cancelarReguaDoTeste: () => notif.cancelarRegua(),
}));
vi.mock("@/components/paywall/PaywallAssinatura", () => ({ PaywallAssinatura: ({ contexto }: { contexto: string }) => <div data-testid="paywall-assinatura">{contexto}</div> }));
vi.mock("@/components/paywall/PaywallFlow", () => ({ PaywallFlow: () => <div data-testid="paywall-web" />, AppLegalFooter: () => null }));
vi.mock("@/components/app/AvisoCobrancaRecusada", () => ({ VagaDoAvisoCobranca: () => null }));
vi.mock("@/components/account/DeleteAccountDialog", () => ({ DeleteAccountDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="excluir-dialogo" /> : null) }));
const signOut = vi.fn(async () => ({ error: null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: () => signOut() } } }));

import { trackEvent } from "@/lib/analytics";
import { CHAVE_FORCA_OFERTAS, _zerarChavesRemotas } from "@/lib/ofertas-saida";
import { TrialBanner } from "@/components/TrialBanner";
import { _zerarParabens, linhaDoPlano } from "@/components/porta/ParabensPorta";

const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const plataforma = (p: "ios" | "android") => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => p }; };
const montar = () => render(<MemoryRouter initialEntries={["/home"]}><main>Home</main><TrialBanner /></MemoryRouter>);
let href = "";

beforeEach(() => {
  localStorage.clear();
  _zerarChavesRemotas();
  _zerarParabens();
  estado.auth.user.user_metadata = {};
  estado.metadataCurto = null;
  vi.mocked(trackEvent).mockClear();
  [rcMock.identificar, rcMock.comprarAnual, rcMock.restaurar, notif.resgate, notif.cancelarResgate, notif.cancelarRegua, notif.recuperar, signOut].forEach((f) => f.mockClear());
  rcMock.comprarAnual.mockResolvedValue(true);
  plataforma("ios");
  localStorage.setItem(CHAVE_FORCA_OFERTAS, "curto"); // a chave "curto" ligada (na 1.0.14 de loja é o VITE_V14_LOJA)
  href = "";
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, get href() { return href; }, set href(v: string) { href = v; }, pathname: "/home", search: "" } });
});
afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; vi.useRealTimers(); });

describe("gate do iPhone com a chave 'curto' = o PaywallIOS curto", () => {
  it("conta logada sem assinatura vê o paywall curto (sem Voltar), com conta/excluir/termos/restaurar; nada do gate antigo", async () => {
    montar();
    expect(await screen.findByTestId("ios-curto")).toBeInTheDocument();
    expect(screen.queryByTestId("paywall-assinatura")).toBeNull();
    expect(screen.queryByTestId("ios-curto-voltar")).toBeNull();
    expect(screen.getByRole("heading").textContent).toMatch(/Comece seus 3 dias grátis\s*pra continuar/);
    await waitFor(() => expect(screen.getByTestId("ios-curto-anual").textContent).toContain("R$ 97,90 cobrado por ano"));
    expect(screen.getByTestId("ios-curto-anual").textContent).toContain("3 DIAS GRÁTIS");
    expect(screen.getByTestId("ios-curto-anual").textContent).toContain("R$ 8,16/mês");
    expect(screen.getByTestId("ios-economize").textContent).toContain("67%");
    expect(screen.getByTestId("ios-curto-mensal").textContent).toContain("R$ 24,90/mês");
    expect(screen.getByTestId("ios-sem-cobranca").textContent).toMatch(/Sem cobrança hoje/);
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
    expect(screen.getByText("Termos")).toBeInTheDocument();
    expect(screen.getByText("Privacidade")).toBeInTheDocument();
    expect(screen.getByText("Restaurar compras")).toBeInTheDocument();
    expect(screen.getByTestId("gate-trocar-conta").textContent).toBe("Entrar com outra conta");
    fireEvent.click(screen.getByTestId("gate-excluir-conta"));
    expect(screen.getByTestId("excluir-dialogo")).toBeInTheDocument();
    // eventos do gate não somam no funil do iPhone; a régua do gate de hoje arma ao abrir
    expect(eventos("funnel_view")[0]).toMatchObject({ step: "offer", funil: "gate_ios", loja: "ios" });
    await waitFor(() => expect(eventos("paywall_oferta_vista")[0]).toMatchObject({ funil: "gate_ios", paywall_curto: true }));
    expect(notif.resgate).toHaveBeenCalledWith(null);
  });

  it("Continuar: pílula da Apple, RevenueCat identificado com o uid ANTES da folha, comprarAnualIos, e o pós-compra do gate (recarrega '/')", async () => {
    montar();
    await screen.findByTestId("ios-curto");
    await waitFor(() => expect(screen.getByTestId("ios-curto-anual").textContent).toContain("R$ 97,90"));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByTestId("ios-preparando-folha").textContent).toContain("R$ 97,90/ano");
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    vi.useRealTimers();
    await waitFor(() => expect(rcMock.comprarAnual).toHaveBeenCalledTimes(1));
    expect(rcMock.identificar).toHaveBeenCalledWith("uid-porta");
    expect(rcMock.identificar.mock.invocationCallOrder[0]).toBeLessThan(rcMock.comprarAnual.mock.invocationCallOrder[0]);
    await waitFor(() => expect(href).toBe("/"));
    expect(notif.cancelarResgate).toHaveBeenCalled();
    expect(notif.cancelarRegua).toHaveBeenCalled();
    expect(notif.recuperar).not.toHaveBeenCalled(); // a recuperação do funil não arma no gate
    expect(eventos("app_sheet_success")[0]).toMatchObject({ funil: "gate_ios", produto: "core_anual_97" });
  });

  it("'Entrar com outra conta': sai desta conta e vai pro /entrar", async () => {
    montar();
    fireEvent.click(await screen.findByTestId("gate-trocar-conta"));
    await waitFor(() => expect(href).toBe("/entrar"));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("interruptor de emergência: a metadata do RevenueCat desliga o curto → volta o gate antigo", async () => {
    localStorage.removeItem(CHAVE_FORCA_OFERTAS);
    // chave ligada no início (como na loja) e desligada quando as offerings chegam
    estado.metadataCurto = "off";
    const ofertas = await import("@/lib/ofertas-saida");
    ofertas.registrarChavesRemotas({ current: { identifier: "d", metadata: { paywall_curto: "on" } }, all: {} });
    montar();
    expect(screen.getByTestId("gate-ios-curto")).toBeInTheDocument(); // nasce no curto
    await waitFor(() => expect(screen.getByTestId("paywall-assinatura").textContent).toBe("gate"));
    expect(screen.queryByTestId("ios-curto")).toBeNull();
  });
});

describe("fora do iPhone com a chave: o gate de sempre", () => {
  it("Android: PaywallAssinatura contexto gate, mesmo com a chave ligada", () => {
    plataforma("android");
    montar();
    expect(screen.getByTestId("paywall-assinatura").textContent).toBe("gate");
    expect(screen.queryByTestId("ios-curto")).toBeNull();
  });

  it("iPhone com a chave 'curto' desligada: PaywallAssinatura contexto gate", () => {
    localStorage.removeItem(CHAVE_FORCA_OFERTAS);
    montar();
    expect(screen.getByTestId("paywall-assinatura").textContent).toBe("gate");
    expect(screen.queryByTestId("gate-ios-curto")).toBeNull();
  });
});

describe("'Você ganhou 3 dias grátis' — conta da Porta (user_metadata.porta), antes do paywall", () => {
  const daPorta = (area: string | null = "rotina") => { estado.auth.user.user_metadata = { porta: { respostas: { area, rota: area } } }; };

  it("mostra a tela (título, o plano da área do site, 'Continuar'); sem preço; Continuar → o paywall curto, sem comprar nada", async () => {
    daPorta("rotina");
    montar();
    expect(screen.getByTestId("porta-parabens-titulo").textContent).toBe("Você ganhou 3 dias grátis");
    expect(screen.getByTestId("porta-parabens-plano").textContent).toBe("Seu plano de Rotina já está salvo.");
    expect(document.body.textContent).not.toMatch(/R\$|\d+,90|por ano|\/mês/);
    expect(screen.queryByTestId("ios-curto")).toBeNull();
    expect(eventos("porta_parabens_visto")[0]).toEqual({ area: "rotina" });
    expect(rcMock.comprarAnual).not.toHaveBeenCalled();
    expect(rcMock.restaurar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("porta-parabens-continuar"));
    expect(eventos("porta_parabens_continuar")[0]).toEqual({ area: "rotina" });
    expect(await screen.findByTestId("ios-curto")).toBeInTheDocument();
    expect(rcMock.comprarAnual).not.toHaveBeenCalled();
    // a área do site vira a área do app (a Missão do dia 1 abre nela)
    expect(localStorage.getItem("core-funnel-area")).toBe("rotina");
  });

  it("1x por sessão do app: remontar o gate na mesma sessão vai direto pro paywall", async () => {
    daPorta();
    montar();
    fireEvent.click(screen.getByTestId("porta-parabens-continuar"));
    cleanup();
    montar();
    expect(screen.queryByTestId("porta-parabens")).toBeNull();
    expect(await screen.findByTestId("ios-curto")).toBeInTheDocument();
  });

  it("conta SEM porta: direto no paywall curto; Android com porta: o gate de sempre, sem a tela", async () => {
    montar();
    expect(screen.queryByTestId("porta-parabens")).toBeNull();
    expect(await screen.findByTestId("ios-curto")).toBeInTheDocument();
    cleanup();
    daPorta();
    plataforma("android");
    montar();
    expect(screen.queryByTestId("porta-parabens")).toBeNull();
    expect(screen.getByTestId("paywall-assinatura").textContent).toBe("gate");
  });

  it("a linha do plano: área conhecida pelo nome; 'tudo'/sem área = 'Seu plano de 3 dias'", () => {
    expect(linhaDoPlano({ respostas: { area: "dinheiro" } })).toBe("Seu plano de Dinheiro já está salvo.");
    expect(linhaDoPlano({ respostas: { area: "tudo" } })).toBe("Seu plano de 3 dias já está salvo.");
    expect(linhaDoPlano(null)).toBe("Seu plano de 3 dias já está salvo.");
  });
});
