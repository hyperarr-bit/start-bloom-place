/**
 * DEMO GUIADA DESLIGADA = FUNIL DE HOJE, BYTE A BYTE (28/09).
 *
 * A "Missão de 1 minuto" (demo guiada) entra no código DESLIGADA. Este teste
 * foi escrito e fotografado (snapshot) ANTES de a missão existir, no código do
 * funil que está vendendo — e tem que continuar passando igual com ela no
 * código e a chave desligada:
 *   · a demo (/preview/<módulo>): faixa, barra de módulos, CTA fixo "Quase lá",
 *     os links (pílulas e volta) e o evento funnel_view da demo;
 *   · o cadastro de 2 campos (/inicio?step=signup);
 *   · o paywall ROI 2 (sem item da demo).
 * Mudou alguma coisa aqui com a chave desligada? O funil de hoje mudou.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { MotionGlobalConfig } from "framer-motion";

const analytics = vi.hoisted(() => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
vi.mock("@/lib/analytics", () => ({
  trackEvent: analytics.trackEvent,
  trackEventBeacon: analytics.trackEventBeacon,
  captureLandingMeta: vi.fn(),
  getAttributionParams: () => ({}),
  markActivation: vi.fn(),
}));
vi.mock("@/lib/funil-roi2", () => ({ FUNIL_ROI2: true, ehFunilRoi2: () => true }));
vi.mock("@/lib/prova-social", () => ({
  useProvaSocial: () => null,
  buscarProvaSocial: vi.fn().mockResolvedValue(null),
  formatarPessoas: (n: number) => new Intl.NumberFormat("pt-BR").format(n),
  PROVA_SOCIAL_MINIMO: 1000,
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, loading: false, isSubscribed: false, subLoaded: true, signUp: vi.fn(), signIn: vi.fn() }),
}));
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

/* Os módulos de verdade são pesados e não são o assunto: no lugar deles, um
 * módulo de mentira que mostra o que a demo tem na memória. */
const moduloDeMentira = async (nome: string) => {
  const { useUserData } = await import("@/hooks/use-user-data");
  const Modulo = () => {
    const { get } = useUserData();
    const gastos = get<Array<{ description?: string }>>("finance-expenses", []);
    const habitos = get<string[]>("rotina-habits", []);
    return (
      <div data-testid={`modulo-${nome}`}>
        <p>{nome}</p>
        <ul>{(Array.isArray(gastos) ? gastos : []).map((g, i) => <li key={`g${i}`}>{g.description}</li>)}</ul>
        <ul>{(Array.isArray(habitos) ? habitos : []).map((h, i) => <li key={`h${i}`}>{String(h)}</li>)}</ul>
      </div>
    );
  };
  return { default: Modulo };
};
vi.mock("@/pages/Index", () => moduloDeMentira("financas"));
vi.mock("@/pages/Rotina", () => moduloDeMentira("rotina"));

import Preview from "@/pages/Preview";
import ComecarDia14 from "@/pages/funis/dia14/ComecarDia14";
import { PaywallDia14 } from "@/pages/funis/dia14/PaywallDia14";
import { UserDataProvider } from "@/hooks/use-user-data";

MotionGlobalConfig.skipAnimations = true;
// a barra de módulos mede a própria altura (ResizeObserver não existe no jsdom)
if (!("ResizeObserver" in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
}

const demo = async (url: string, modulo: string) => {
  const r = render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/preview/:moduleKey" element={<Preview />} /></Routes>
    </MemoryRouter>,
  );
  await screen.findByTestId(`modulo-${modulo}`);
  return r;
};

const hrefs = () => [...document.querySelectorAll("a")].map((a) => `${a.textContent?.trim()} → ${a.getAttribute("href")}`);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  analytics.trackEvent.mockClear();
  analytics.trackEventBeacon.mockClear();
});
afterEach(cleanup);

describe("demo guiada DESLIGADA — a demo de hoje", () => {
  it("finanças pelo funil do dia 14: mesma faixa, mesma barra, mesmo CTA, mesmos links", async () => {
    const { container } = await demo("/preview/financas?funnel=1&tour=vida&from=dia14", "financas");
    expect(hrefs()).toMatchSnapshot("links");
    expect(container.innerHTML).toMatchSnapshot("html");
    const vistas = analytics.trackEvent.mock.calls.filter((c) => c[0] === "funnel_view");
    expect(vistas).toMatchSnapshot("funnel_view");
    // nada de missão com a chave desligada
    expect(document.body.textContent).not.toMatch(/MISSÃO DE 1 MINUTO/i);
  });

  it("rotina (2º módulo aberto): mesmo nudge e mesmos links", async () => {
    sessionStorage.setItem("core_tour_visited", JSON.stringify(["financas"]));
    const { container } = await demo("/preview/rotina?funnel=1&tour=vida&from=dia14", "rotina");
    expect(hrefs()).toMatchSnapshot("links");
    expect(container.innerHTML).toMatchSnapshot("html");
  });
});

describe("demo guiada DESLIGADA — cadastro e paywall de hoje", () => {
  it("cadastro de 2 campos igual", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/inicio?step=signup"]}>
        <UserDataProvider><ComecarDia14 /></UserDataProvider>
      </MemoryRouter>,
    );
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.querySelectorAll("input")).toHaveLength(2);
    expect(container.innerHTML).toMatchSnapshot("cadastro");
  });

  it("paywall ROI 2 sem item da demo igual", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/inicio?step=signup"]}>
        <PaywallDia14 context="funnel" answers={{ area: "dinheiro", gasto: "R$ 300 a R$ 500", vitoria: "Entender meus gastos" }} />
      </MemoryRouter>,
    );
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.innerHTML).toMatchSnapshot("paywall");
    expect(document.body.textContent).not.toMatch(/O que você já construiu/i);
  });
});
