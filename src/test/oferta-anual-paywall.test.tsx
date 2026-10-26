/**
 * OFERTA "ANUAL" DO /inicio (26/10) no paywall e na porta:
 *   · ligada (link ?oferta=anual): card "1 ANO DE ACESSO COMPLETO", R$ 2,33/mês, "não é assinatura / não renova", CTA
 *     "Quero 1 ano" abrindo o Pix da OFB_anual27 — e NENHUMA menção a vitalício/pra sempre na tela;
 *   · desligada (sem o link, ou a chave de emergência em false): o paywall de sempre (vitalício w27);
 *   · a porta do /inicio grava a marca e mede `oferta_etapa landing` com a variante.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MotionGlobalConfig } from "framer-motion";

vi.mock("@/lib/funil-roi2", () => ({ FUNIL_ROI2: false, ehFunilRoi2: () => false }));
vi.mock("@/lib/prova-social", () => ({
  useProvaSocial: () => null, buscarProvaSocial: vi.fn().mockResolvedValue(null),
  formatarPessoas: (n: number) => String(n), PROVA_SOCIAL_MINIMO: 1000,
}));
const analytics = vi.hoisted(() => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
vi.mock("@/lib/analytics", () => ({
  trackEvent: analytics.trackEvent, trackEventBeacon: analytics.trackEventBeacon, captureLandingMeta: vi.fn(), getAttributionParams: () => ({}),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, loading: false, isSubscribed: false, subLoaded: true, signUp: vi.fn(), signIn: vi.fn() }),
}));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: () => null, set: vi.fn(), data: {}, loaded: true }) }));
vi.mock("@/lib/sessao-anonima", () => ({ guardarCompraAnonima: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false }));
vi.mock("@/lib/loja", async (orig) => ({ ...(await orig<typeof import("@/lib/loja")>()), ehApple: () => false }));
const meta = vi.hoisted(() => ({ fire: vi.fn() }));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: meta.fire }));
vi.mock("@/components/retention/WinbackWheel", () => ({ WinbackWheel: () => null, SLICES_FUNIL: [] }));
vi.mock("@/components/paywall/PixCheckout", async (orig) => ({
  ...(await orig<typeof import("@/components/paywall/PixCheckout")>()),
  PixCheckout: ({ offer }: { offer: string }) => <div data-testid="pix-mock">oferta:{offer}</div>,
  aquecerCheckoutPix: vi.fn(),
  prepararPixAdiantado: () => ({ tocou: () => {}, parar: () => {} }),
}));

import ComecarDia14 from "@/pages/funis/dia14/ComecarDia14";
import { PaywallDia14 } from "@/pages/funis/dia14/PaywallDia14";
import { CHAVE_OFERTA, _forcarChaveOfertaAnual, _zerarOfertaAnual, capturarOferta } from "@/lib/oferta-anual";

MotionGlobalConfig.skipAnimations = true;

const paywall = () => render(<MemoryRouter><PaywallDia14 context="funnel" answers={{ area: "dinheiro", gasto: "R$ 300 a 500", vitoria: "controle" }} /></MemoryRouter>);
const texto = () => document.body.textContent ?? "";

beforeEach(() => {
  _forcarChaveOfertaAnual(null);
  _zerarOfertaAnual();
  document.cookie = `${CHAVE_OFERTA}=; max-age=0; path=/`;
  localStorage.clear();
  analytics.trackEvent.mockClear();
  meta.fire.mockClear();
});
afterEach(() => { cleanup(); _forcarChaveOfertaAnual(null); window.history.replaceState(null, "", "/"); });

describe("paywall do /inicio na variante anual", () => {
  it("mostra o ANUAL (1 ano, R$ 2,33/mês, não renova) e nenhuma menção a vitalício", () => {
    window.history.replaceState(null, "", "/inicio?oferta=anual&step=offer");
    capturarOferta();
    paywall();
    expect(screen.getByTestId("anual-card")).toBeInTheDocument();
    expect(screen.getByTestId("anual-selo").textContent).toContain("1 ano de acesso completo");
    expect(texto()).toContain("1 ANO DE ACESSO COMPLETO");
    expect(screen.getByTestId("anual-por-mes").textContent).toContain("R$ 2,33/mês");
    expect(screen.getByTestId("nao-e-assinatura").textContent).toMatch(/Não é assinatura.*Nada é cobrado sozinho/);
    expect(screen.getByTestId("anual-comparacao").textContent).toContain("97,90/ano");
    expect(screen.getByTestId("paywall-legal-anual").textContent).toContain("não renova sozinho");
    expect(texto()).not.toMatch(/vitalíc|pra sempre|pague 1x|1x, pra sempre/i);
  });

  it("o CTA 'Quero 1 ano' abre o Pix da OFB_anual27 (InitiateCheckout 27,90)", () => {
    window.history.replaceState(null, "", "/inicio?oferta=anual&step=offer");
    capturarOferta();
    paywall();
    fireEvent.click(screen.getByTestId("paywall-cta-anual"));
    expect(screen.getByTestId("pix-mock").textContent).toBe("oferta:OFB_anual27");
    expect(meta.fire).toHaveBeenCalledWith("InitiateCheckout", expect.objectContaining({ content_name: "OFB_anual27", value: 27.9 }));
    expect(analytics.trackEvent).toHaveBeenCalledWith("funnel_view", expect.objectContaining({ step: "offer", oferta: "anual" }));
  });

  it("SEM o link: o paywall de sempre (vitalício w27), sem nada do anual nos eventos", () => {
    window.history.replaceState(null, "", "/inicio?step=offer");
    capturarOferta();
    paywall();
    expect(screen.queryByTestId("anual-card")).toBeNull();
    expect(texto()).toContain("ACESSO VITALÍCIO");
    fireEvent.click(screen.getByText(/Quero pra sempre/));
    expect(screen.getByTestId("pix-mock").textContent).toBe("oferta:w27");
    const fv = analytics.trackEvent.mock.calls.find((c) => c[0] === "funnel_view")!;
    expect(fv[1]).not.toHaveProperty("oferta");
  });

  it("CHAVE DE EMERGÊNCIA desligada: quem tem a marca volta pro vitalício", () => {
    window.history.replaceState(null, "", "/inicio?oferta=anual&step=offer");
    capturarOferta();
    _forcarChaveOfertaAnual(false);
    paywall();
    expect(screen.queryByTestId("anual-card")).toBeNull();
    expect(texto()).toContain("ACESSO VITALÍCIO");
  });
});

describe("a porta do /inicio", () => {
  it("?oferta=anual grava a marca no aparelho e mede a landing com variante anual", () => {
    window.history.replaceState(null, "", "/inicio?oferta=anual");
    render(<MemoryRouter initialEntries={["/inicio?oferta=anual&utm_source=ig"]}><ComecarDia14 /></MemoryRouter>);
    expect(JSON.parse(localStorage.getItem(CHAVE_OFERTA)!)).toMatchObject({ v: "anual" });
    expect(analytics.trackEvent).toHaveBeenCalledWith("oferta_etapa", expect.objectContaining({ etapa: "landing", variante: "anual", landing: "/inicio" }));
    // "pra vida inteira" leria como vitalício: a variante troca a frase do topo (e não põe preço na 1ª tela)
    expect(texto()).toContain("Tudo da sua vida");
    expect(texto()).not.toMatch(/vida inteira|vitalíc|pra sempre|R\$/);
  });

  it("sem o link: nenhuma marca; a landing é medida como controle", () => {
    window.history.replaceState(null, "", "/inicio");
    render(<MemoryRouter initialEntries={["/inicio"]}><ComecarDia14 /></MemoryRouter>);
    expect(localStorage.getItem(CHAVE_OFERTA)).toBeNull();
    expect(analytics.trackEvent).toHaveBeenCalledWith("oferta_etapa", expect.objectContaining({ etapa: "landing", variante: "controle" }));
    expect(texto()).toContain("vida inteira");
  });
});
