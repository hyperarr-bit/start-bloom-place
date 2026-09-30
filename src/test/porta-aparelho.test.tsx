/**
 * PORTA POR APARELHO (30/09) — Dia 2 do plano "ROI 2 em 7 dias".
 *
 * Trava:
 *   · chave DESLIGADA = porta ROI 2 pra todo aparelho (o funil de hoje);
 *   · ligada = Android vê a porta de 19/09 e o iPhone segue na ROI 2; o
 *     resto do funil (pílula, central, paywall) não muda;
 *   · força de QA por localStorage; o toque na área marca `porta_v: "antiga"`.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MotionGlobalConfig } from "framer-motion";

vi.mock("@/lib/funil-roi2", () => ({ FUNIL_ROI2: true, ehFunilRoi2: () => true }));
vi.mock("@/lib/prova-social", () => ({
  useProvaSocial: () => null,
  buscarProvaSocial: vi.fn().mockResolvedValue(null),
  formatarPessoas: (n: number) => new Intl.NumberFormat("pt-BR").format(n),
  PROVA_SOCIAL_MINIMO: 1000,
}));
const analytics = vi.hoisted(() => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
vi.mock("@/lib/analytics", () => ({
  trackEvent: analytics.trackEvent,
  trackEventBeacon: analytics.trackEventBeacon,
  captureLandingMeta: vi.fn(),
  getAttributionParams: () => ({}),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, loading: false, isSubscribed: false, subLoaded: true, signUp: vi.fn(), signIn: vi.fn() }),
}));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: () => null, set: vi.fn(), data: {}, loaded: true }) }));
vi.mock("@/lib/sessao-anonima", () => ({ guardarCompraAnonima: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false }));
vi.mock("@/lib/loja", async (orig) => ({ ...(await orig<typeof import("@/lib/loja")>()), ehApple: () => false }));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/components/retention/WinbackWheel", () => ({ WinbackWheel: () => null, SLICES_FUNIL: [] }));
vi.mock("@/components/paywall/PixCheckout", async (orig) => ({
  ...(await orig<typeof import("@/components/paywall/PixCheckout")>()),
  PixCheckout: () => null,
  aquecerCheckoutPix: vi.fn(),
  prepararPixAdiantado: () => ({ tocou: () => {}, parar: () => {} }),
}));

import ComecarDia14 from "@/pages/funis/dia14/ComecarDia14";
import { PORTA_ANTIGA_NO_ANDROID, CHAVE_FORCA_PORTA, ehAndroid, portaAntigaNesteAparelho } from "@/lib/porta-aparelho";

MotionGlobalConfig.skipAnimations = true;

const UA_ANDROID = "Mozilla/5.0 (Linux; Android 12; SM-A125M) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 Instagram 330.0.0.0.0 Android";
const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0.0";
const comUA = (ua: string) => Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });

const porta = () => render(<MemoryRouter initialEntries={["/inicio"]}><ComecarDia14 /></MemoryRouter>);
const texto = () => document.body.textContent ?? "";
const ANTIGA = /Qual área tá mais fora de controle hoje\?/;
const NOVA = /Só me diz por onde a gente começa:/;

beforeEach(() => { localStorage.clear(); analytics.trackEvent.mockClear(); });
afterEach(cleanup);

describe("a chave", () => {
  it("nasce DESLIGADA: porta ROI 2 pra todo mundo", () => {
    expect(PORTA_ANTIGA_NO_ANDROID).toBe(false);
    expect(portaAntigaNesteAparelho(false, UA_ANDROID)).toBe(false);
    expect(portaAntigaNesteAparelho(false, UA_IPHONE)).toBe(false);
  });
  it("ligada: só o Android vê a antiga", () => {
    expect(portaAntigaNesteAparelho(true, UA_ANDROID)).toBe(true);
    expect(portaAntigaNesteAparelho(true, UA_IPHONE)).toBe(false);
    expect(ehAndroid(UA_ANDROID)).toBe(true);
    expect(ehAndroid(UA_IPHONE)).toBe(false);
    expect(ehAndroid("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe(false);
  });
  it("a força de QA manda mais que a chave e o aparelho", () => {
    localStorage.setItem(CHAVE_FORCA_PORTA, "antiga");
    expect(portaAntigaNesteAparelho(false, UA_IPHONE)).toBe(true);
    localStorage.setItem(CHAVE_FORCA_PORTA, "roi2");
    expect(portaAntigaNesteAparelho(true, UA_ANDROID)).toBe(false);
  });
});

describe("no funil (/inicio)", () => {
  it("DESLIGADA + Android: a porta é a ROI 2 (o funil de hoje) e o toque não leva porta_v", () => {
    comUA(UA_ANDROID);
    porta();
    expect(screen.getByTestId("porta-roi2")).toBeTruthy();
    expect(texto()).toMatch(NOVA);
    expect(texto()).not.toMatch(ANTIGA);
    fireEvent.click(screen.getByText("Meu dinheiro"));
    const clique = analytics.trackEvent.mock.calls.find((c) => c[0] === "funnel_click" && c[1]?.cta === "start")?.[1];
    expect(clique).toEqual(expect.objectContaining({ porta: "vida", area: "dinheiro" }));
    expect(clique).not.toHaveProperty("porta_v");
  });

  it("forçada 'antiga' (= ligada no Android): a porta de 19/09, e o resto do funil ROI 2 segue (pílula dos 16)", async () => {
    comUA(UA_ANDROID);
    localStorage.setItem(CHAVE_FORCA_PORTA, "antiga");
    porta();
    expect(screen.queryByTestId("porta-roi2")).toBeNull();
    expect(texto()).toMatch(/Um app pra\s*vida inteira/);
    expect(texto()).toMatch(ANTIGA);
    expect(texto()).toMatch(/4 perguntas rápidas/);
    expect(texto()).not.toMatch(/R\$/);
    fireEvent.click(screen.getByText("Meu dinheiro"));
    const clique = analytics.trackEvent.mock.calls.find((c) => c[0] === "funnel_click" && c[1]?.cta === "start")?.[1];
    expect(clique).toEqual(expect.objectContaining({ porta: "vida", area: "dinheiro", porta_v: "antiga" }));
    const pilula = await screen.findByTestId("quiz-pilula", {}, { timeout: 4000 });
    expect(pilula.textContent).toBe("16 módulos · começo: Dinheiro");
  });

  it("forçada 'roi2' num Android: a porta nova (é o que o iPhone vê com a chave ligada)", () => {
    comUA(UA_ANDROID);
    localStorage.setItem(CHAVE_FORCA_PORTA, "roi2");
    porta();
    expect(screen.getByTestId("porta-roi2")).toBeTruthy();
  });
});
