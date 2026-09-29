/**
 * A MISSÃO DE 1 MINUTO na demo (28/09) — o caminho inteiro, com módulos de
 * mentira no lugar dos de verdade:
 *   · braço "on": faixa 1/3, o item nasce do gesto dela, "Missão cumprida"
 *     com as DUAS saídas;
 *   · a barra de módulos continua funcionando: trocar no meio encerra a
 *     missão (demo_guia_pular trocou_modulo) sem prender;
 *   · o item SOBREVIVE a 5 módulos de passeio (e ao storage zerado): volta
 *     pro módulo dele e chega no paywall ("O que você já construiu");
 *   · o paywall grava o item na conta — só ele;
 *   · braço "off" (controle): a demo de hoje, com o braço no evento.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
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
  formatarPessoas: (n: number) => String(n),
  PROVA_SOCIAL_MINIMO: 1000,
}));
const auth = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: auth.user, loading: false, isSubscribed: false, subLoaded: true, signUp: vi.fn(), signIn: vi.fn() }),
}));
// o sorteio do A/B (na entrada da demo) controlado pelo teste; o resto do módulo é o de verdade
const sorteio = vi.hoisted(() => ({ valor: null as null | "1" | "0", chamadas: 0 }));
vi.mock("@/lib/demo-guiada-braco", async (orig) => ({
  ...(await orig<typeof import("@/lib/demo-guiada-braco")>()),
  sortearBracoDaDemo: () => { sorteio.chamadas++; return sorteio.valor; },
}));
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

/* Módulos de mentira: mostram os gastos da memória da demo e têm o botão de
 * adicionar com a MESMA âncora do módulo real (add-expense), numa linha com
 * campo — igual ao ExpenseTable. */
const moduloDeMentira = async (nome: string) => {
  const { useUserData } = await import("@/hooks/use-user-data");
  const Modulo = () => {
    const { get, set } = useUserData();
    const gastos = get<Array<{ id: string; description: string; value: number }>>("finance-expenses", []);
    return (
      <div data-testid={`modulo-${nome}`}>
        <ul>{(Array.isArray(gastos) ? gastos : []).map((g) => <li key={g.id}>{g.description}</li>)}</ul>
        {nome === "financas" && (
          <div>
            <input placeholder="+ Novo gasto" readOnly />
            <button
              data-spotlight="add-expense"
              onClick={() => set("finance-expenses", [...gastos, { id: "novo-1", description: "Café", value: 12, category: "outros", date: "2026-09-28", paymentMethod: "pix" }])}
            >
              +
            </button>
          </div>
        )}
      </div>
    );
  };
  return { default: Modulo };
};
vi.mock("@/pages/Index", () => moduloDeMentira("financas"));
vi.mock("@/pages/Rotina", () => moduloDeMentira("rotina"));
vi.mock("@/pages/Treino", () => moduloDeMentira("treino"));
vi.mock("@/pages/Dieta", () => moduloDeMentira("dieta"));
vi.mock("@/pages/Saude", () => moduloDeMentira("saude"));
vi.mock("@/pages/DesenvolvimentoPessoal", () => moduloDeMentira("desenvolvimento"));

import Preview from "@/pages/Preview";
import { PaywallDia14 } from "@/pages/funis/dia14/PaywallDia14";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { esquecerMissao, estadoDaMissao } from "@/lib/demo-guiada";
import { idDoItem } from "@/lib/demo-guiada-registro";

MotionGlobalConfig.skipAnimations = true;
if (!("ResizeObserver" in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
}

/** Como no App: cada módulo é uma página nova (Routes com key = pathname). */
const Rotas = () => {
  const location = useLocation();
  return (
    <>
      <Routes location={location} key={location.pathname}>
        <Route path="/preview/:moduleKey" element={<Preview />} />
        <Route path="/inicio" element={<p data-testid="cadastro">cadastro</p>} />
      </Routes>
      <p data-testid="url">{location.pathname + location.search}</p>
    </>
  );
};
const abrirDemo = async (url: string, modulo = "financas") => {
  render(<MemoryRouter initialEntries={[url]}><Rotas /></MemoryRouter>);
  await screen.findByTestId(`modulo-${modulo}`);
};
const pilula = (nome: string) => within(document.querySelector(".demo-tour-nav") as HTMLElement).getByText(nome).closest("a") as HTMLAnchorElement;
const irPara = async (nome: string, modulo: string) => {
  act(() => { fireEvent.click(pilula(nome)); });
  await screen.findByTestId(`modulo-${modulo}`);
};
const eventos = (nome: string) => analytics.trackEvent.mock.calls.filter((c) => c[0] === nome).map((c) => c[1]);
const quaseLa = () => screen.getByText("Quase lá").closest("a") as HTMLAnchorElement;
const DEMO = "/preview/financas?funnel=1&tour=vida&from=dia14";
const C_CAFE = "c=gasto%7CCaf%C3%A9%7C12";

const anotarCafe = async () => {
  await screen.findByTestId("demo-guia-faixa");
  const mais = document.querySelector('[data-spotlight="add-expense"]') as HTMLElement;
  act(() => { fireEvent.pointerDown(mais); fireEvent.click(mais); });
  await screen.findByText(/2\/3/);
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  esquecerMissao();
  auth.user = null;
  sorteio.valor = null;
  sorteio.chamadas = 0;
  analytics.trackEvent.mockClear();
  window.history.replaceState({}, "", "/");
});
afterEach(cleanup);

describe("o sorteio do A/B é na ENTRADA da demo (e o braço vai carimbado na URL)", () => {
  it("fora do experimento (chave desligada): a URL e o evento ficam os de hoje", async () => {
    await abrirDemo(DEMO);
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    expect(sorteio.chamadas).toBe(1);
    expect(screen.getByTestId("url").textContent).toBe(DEMO);
    expect(screen.queryByTestId("demo-guia-faixa")).toBeNull();
    const vista = eventos("funnel_view").find((e) => e.step === "demo");
    expect(vista).toEqual({ step: "demo", tour: "vida", module: "financas" });
  });

  it("sorteou a missão: a URL ganha guia=1 (replace) e a faixa aparece", async () => {
    sorteio.valor = "1";
    await abrirDemo(DEMO);
    await screen.findByTestId("demo-guia-faixa");
    expect(screen.getByTestId("url").textContent).toBe(`${DEMO}&guia=1`);
    expect(eventos("funnel_view")).toContainEqual(expect.objectContaining({ step: "demo", guia: "on" }));
  });

  it("sorteou o controle: a URL ganha guia=0 e a demo é a de hoje", async () => {
    sorteio.valor = "0";
    await abrirDemo(DEMO);
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    expect(screen.getByTestId("url").textContent).toBe(`${DEMO}&guia=0`);
    expect(screen.queryByTestId("demo-guia-faixa")).toBeNull();
    expect(eventos("funnel_view")).toContainEqual(expect.objectContaining({ step: "demo", guia: "off" }));
  });

  it("quem já tem braço na URL não é sorteado de novo; demo fora do funil do dia 14 nunca é sorteada", async () => {
    sorteio.valor = "0";
    await abrirDemo(`${DEMO}&guia=1`);
    await screen.findByTestId("demo-guia-faixa");
    expect(sorteio.chamadas).toBe(0);
    cleanup();
    sorteio.valor = "1";
    await abrirDemo("/preview/financas?funnel=1&tour=vida");
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    expect(sorteio.chamadas).toBe(0);
    expect(screen.queryByTestId("demo-guia-faixa")).toBeNull();
  });
});

describe("braço on: a missão", () => {
  it("nasce em 1/3 (área escolhida ✓), com Pular, e as pílulas levam o braço", async () => {
    await abrirDemo(`${DEMO}&guia=1`);
    const faixa = await screen.findByTestId("demo-guia-faixa");
    expect(faixa.textContent).toMatch(/Missão de 1 minuto/i);
    expect(faixa.textContent).toMatch(/1\/3/);
    expect(faixa.textContent).toMatch(/Área escolhida ✓/);
    expect(screen.getByTestId("demo-guia-pular")).toBeTruthy();
    expect(pilula("Rotina").getAttribute("href")).toContain("guia=1");
    expect(eventos("funnel_view")).toContainEqual(expect.objectContaining({ step: "demo", module: "financas", guia: "on" }));
    expect(eventos("demo_guia_view")).toContainEqual(expect.objectContaining({ guia: "on", area: "dinheiro", modulo: "financas" }));
    // o CTA fixo de baixo continua lá
    expect(quaseLa()).toBeTruthy();
  });

  it("o item nasce do gesto dela: pílulas e 'Quase lá' levam c=, a sessão guarda, e a folha tem as DUAS saídas", async () => {
    await abrirDemo(`${DEMO}&guia=1`);
    await anotarCafe();
    expect(pilula("Rotina").getAttribute("href")).toContain(C_CAFE);
    expect(quaseLa().getAttribute("href")).toContain(C_CAFE);
    expect(estadoDaMissao().item).toEqual({ tipo: "gasto", nome: "Café", valor: 12 });
    expect(eventos("demo_guia_passo")).toContainEqual(expect.objectContaining({ n: 3, tipo: "gasto" }));
    // sem o resumo do mês no módulo de mentira, o "olhar" é pulado (fail-open) e a folha sobe
    const folha = await screen.findByTestId("demo-guia-cumprida", {}, { timeout: 4000 });
    expect(folha.textContent).toMatch(/Missão cumprida/);
    expect(folha.textContent).toMatch(/Café · R\$ 12/);
    expect(folha.textContent).toMatch(/já está anotado/);
    expect(eventos("demo_guia_feito")).toHaveLength(1);
    expect(within(folha).getByTestId("demo-guia-levar").textContent).toMatch(/Levar isso pros meus números/);
    // "Ver os outros módulos": fecha, a faixa sai e a demo segue igual à de hoje
    act(() => { fireEvent.click(within(folha).getByTestId("demo-guia-explorar")); });
    expect(screen.queryByTestId("demo-guia-cumprida")).toBeNull();
    expect(screen.queryByTestId("demo-guia-faixa")).toBeNull();
    expect(eventos("demo_guia_explorar")).toContainEqual(expect.objectContaining({ via: "folha" }));
    await screen.findByText("Quase lá"); // o CTA fixo volta quando a folha fecha
    expect(quaseLa().getAttribute("href")).toContain(C_CAFE);
  });

  it("'Levar isso pros meus números' vai pro cadastro com o item", async () => {
    await abrirDemo(`${DEMO}&guia=1`);
    await anotarCafe();
    const folha = await screen.findByTestId("demo-guia-cumprida", {}, { timeout: 4000 });
    act(() => { fireEvent.click(within(folha).getByTestId("demo-guia-levar")); });
    await screen.findByTestId("cadastro");
    // o mesmo destino do "Quase lá" de hoje (/inicio?step=signup&porta=vida), com o item junto
    expect(screen.getByTestId("url").textContent).toBe(`/inicio?step=signup&porta=vida&${C_CAFE}`);
    expect(eventos("demo_guia_levar")).toHaveLength(1);
    expect(eventos("funnel_click")).toContainEqual({ cta: "demo_quase_la", via: "guia" });
  });

  it("Pular: a faixa sai e a demo segue (sem item nenhum)", async () => {
    await abrirDemo(`${DEMO}&guia=1`);
    await screen.findByTestId("demo-guia-faixa");
    act(() => { fireEvent.click(screen.getByTestId("demo-guia-pular")); });
    expect(screen.queryByTestId("demo-guia-faixa")).toBeNull();
    expect(eventos("demo_guia_pular")).toContainEqual(expect.objectContaining({ motivo: "botao", passo: 2 }));
    expect(quaseLa().getAttribute("href")).not.toContain("c=");
  });
});

describe("a barra de módulos continua funcionando", () => {
  it("trocar de módulo NO MEIO da missão encerra a missão, sem prender e sem voltar sozinha", async () => {
    await abrirDemo(`${DEMO}&guia=1`);
    await screen.findByTestId("demo-guia-faixa");
    await irPara("Rotina", "rotina");
    expect(eventos("demo_guia_pular")).toContainEqual(expect.objectContaining({ motivo: "trocou_modulo", para: "rotina", guia: "on" }));
    expect(screen.queryByTestId("demo-guia-faixa")).toBeNull();
    expect(screen.getByTestId("url").textContent).toContain("/preview/rotina");
    await irPara("Finanças", "financas");
    expect(screen.queryByTestId("demo-guia-faixa")).toBeNull();
    // cada módulo aberto conta, com o braço (métrica de proteção do A/B)
    expect(eventos("funnel_view").filter((e) => e.step === "demo").map((e) => [e.module, e.guia])).toEqual([
      ["financas", "on"], ["rotina", "on"], ["financas", "on"],
    ]);
  });

  it("O ITEM SOBREVIVE: 5 módulos de passeio (com o storage zerado no meio), volta pro módulo dele e chega no paywall", async () => {
    await abrirDemo(`${DEMO}&guia=1`);
    await anotarCafe();
    await screen.findByTestId("demo-guia-cumprida", {}, { timeout: 4000 });
    act(() => { fireEvent.click(screen.getByTestId("demo-guia-explorar")); });
    for (const [pil, mod] of [["Rotina", "rotina"], ["Treino", "treino"], ["Dieta", "dieta"]] as const) {
      await irPara(pil, mod);
      expect(screen.getByTestId("url").textContent).toContain(C_CAFE);
    }
    // o navegador do Instagram zera o storage (e a página perde a memória): a URL segura
    sessionStorage.clear();
    esquecerMissao();
    for (const [pil, mod] of [["Saúde", "saude"], ["Metas", "desenvolvimento"], ["Finanças", "financas"]] as const) {
      await irPara(pil, mod);
      expect(screen.getByTestId("url").textContent).toContain(C_CAFE);
    }
    // de volta em Finanças: o Café dela está no módulo, junto com o exemplo
    expect(within(screen.getByTestId("modulo-financas")).getByText("Café")).toBeTruthy();
    expect(screen.queryByTestId("demo-guia-faixa")).toBeNull(); // a missão não recomeça
    const volta = quaseLa().getAttribute("href") ?? "";
    expect(volta).toContain(C_CAFE);
    cleanup();

    // ...e o paywall (volta do "Quase lá" → cadastro → paywall) mostra o que ela construiu
    window.history.replaceState({}, "", volta);
    const semConta: UserDataContextType = { get: ((_k: string, f: unknown) => f) as UserDataContextType["get"], set: vi.fn(), loaded: true, isGuest: true, fetchKey: async () => null };
    render(<UserDataContext.Provider value={semConta}><MemoryRouter><PaywallDia14 context="funnel" answers={{ area: "dinheiro" }} /></MemoryRouter></UserDataContext.Provider>);
    const bloco = await screen.findByTestId("construiu");
    expect(bloco.textContent).toMatch(/O que você já construiu/i);
    expect(bloco.textContent).toMatch(/Café · R\$ 12/);
    expect(bloco.textContent).toMatch(/por você/);
    expect(bloco.textContent).toMatch(/Finanças pronta/);
    expect(bloco.textContent).toMatch(/16 módulos/);
    expect(bloco.textContent).toMatch(/Fica salvo quando liberar/);
    expect(eventos("paywall_construiu_view")).toContainEqual({ guia: "on", tipo: "gasto" });
  });
});

describe("paywall → conta (o caminho de quem paga)", () => {
  it("com a conta carregada, grava SÓ o item dela pela chave real, uma vez", async () => {
    auth.user = { id: "u1" };
    const dados: Record<string, unknown> = {};
    const set = vi.fn((k: string, v: unknown) => { dados[k] = v; });
    const ctx: UserDataContextType = { get: ((k: string, f: unknown) => (k in dados ? dados[k] : f)) as UserDataContextType["get"], set, loaded: true, isGuest: false, fetchKey: async () => null };
    window.history.replaceState({}, "", `/inicio?step=signup&${C_CAFE}`);
    const { rerender } = render(<UserDataContext.Provider value={ctx}><MemoryRouter><PaywallDia14 context="funnel" answers={{ area: "dinheiro" }} /></MemoryRouter></UserDataContext.Provider>);
    await screen.findByTestId("construiu");
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith("finance-expenses", [
      { id: idDoItem({ tipo: "gasto", nome: "Café", valor: 12 }), description: "Café", category: "outros", value: 12, date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), paymentMethod: "pix" },
    ], { system: true });
    rerender(<UserDataContext.Provider value={{ ...ctx }}><MemoryRouter><PaywallDia14 context="funnel" answers={{ area: "dinheiro" }} /></MemoryRouter></UserDataContext.Provider>);
    expect(set).toHaveBeenCalledTimes(1);
    expect(eventos("demo_guia_conta")).toContainEqual(expect.objectContaining({ ok: true, chaves: "finance-expenses" }));
  });

  it("antes da conta carregar do servidor, não grava nada (gravar antes apagaria o que uma conta antiga tinha)", async () => {
    auth.user = { id: "u1" };
    const set = vi.fn();
    const ctx: UserDataContextType = { get: ((_k: string, f: unknown) => f) as UserDataContextType["get"], set, loaded: false, isGuest: false, fetchKey: async () => null };
    window.history.replaceState({}, "", `/inicio?step=signup&${C_CAFE}`);
    render(<UserDataContext.Provider value={ctx}><MemoryRouter><PaywallDia14 context="funnel" answers={{ area: "dinheiro" }} /></MemoryRouter></UserDataContext.Provider>);
    await screen.findByTestId("construiu");
    expect(set).not.toHaveBeenCalled();
  });
});

describe("o bloco nunca derruba o paywall", () => {
  it("erro dentro do bloco (ex.: fora do provedor de dados) = o bloco some e o preço continua na tela", async () => {
    window.history.replaceState({}, "", `/inicio?step=signup&${C_CAFE}`);
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<MemoryRouter><PaywallDia14 context="funnel" answers={{ area: "dinheiro" }} /></MemoryRouter>);
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(screen.queryByTestId("construiu")).toBeNull();
    expect(screen.getByTestId("paywall-roi2")).toBeTruthy();
    expect(document.body.textContent).toMatch(/Liberar os 16 módulos/);
    erro.mockRestore();
  });
});

describe("braço off (controle do A/B)", () => {
  it("é a demo de hoje: sem faixa, sem item — só o braço nos eventos e nas pílulas", async () => {
    await abrirDemo(`${DEMO}&guia=0`);
    await act(async () => { await new Promise((r) => setTimeout(r, 1500)); });
    expect(screen.queryByTestId("demo-guia-faixa")).toBeNull();
    expect(pilula("Rotina").getAttribute("href")).toBe("/preview/rotina?funnel=1&tour=vida&from=dia14&guia=0");
    expect(quaseLa().getAttribute("href")).toBe("/inicio?step=signup&porta=vida");
    expect(eventos("funnel_view")).toContainEqual(expect.objectContaining({ step: "demo", guia: "off" }));
    expect(eventos("demo_guia_view")).toHaveLength(0);
  });
});
