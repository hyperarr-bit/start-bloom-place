/**
 * RODADA 2 DA HOME NOVA (26/10, feedback do dono no iPhone) — tudo atrás da chave `home_nova`:
 *   · Resumos (os 3 cards da página 1 escolhidos em Você › Personalizar início, até 3) — lib/home-resumos + metricasDoDia;
 *   · a folha do score SIMPLES (contagens "2/5", sem pontos, sem Falta/Feito) e o card inteiro abre a folha;
 *   · pendências: a conta a vencer é um ALERTA próprio; o rodapé é "Ver todas (N)";
 *   · toasts: com a chave ligada, pílula em cima (abaixo do relógio); desligada, o aviso de sempre embaixo;
 *   · a aba Você no estilo da E (categorias que abrem) e a página Personalizar início (resumos, widgets, pendências);
 *   · a cor do tema volta pro padrão com a Home nova (claro/escuro continuam).
 */
process.env.TZ = "America/Sao_Paulo";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
}));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false, plataformaApp: () => "web", isIOS: () => false, isAndroid: () => false }));
const auth = vi.hoisted(() => ({
  user: { id: "u1", email: "fulana@exemplo.com.br", created_at: "2026-08-01T12:00:00Z", user_metadata: {} },
  session: null, loading: false, isSubscribed: true, subLoaded: true, signOut: () => {},
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth, AuthProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/lib/image-upload", async (orig) => ({ ...(await orig<typeof import("@/lib/image-upload")>()), uploadFromInput: vi.fn() }));
vi.mock("@/lib/desfazer", () => ({ avisarApagado: vi.fn() }));
vi.mock("@/lib/admin", () => ({ checkIsAdmin: vi.fn(async () => false) }));
vi.mock("@/integrations/supabase/client", () => {
  const q: Record<string, unknown> = {};
  Object.assign(q, {
    select: () => q, eq: () => q, in: () => q, order: () => q, range: () => q, limit: () => q, gte: () => q, lte: () => q, neq: () => q, is: () => q,
    abortSignal: async () => ({ data: [], error: null }), maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
    insert: async () => ({ data: null, error: null }), upsert: async () => ({ data: null, error: null }),
    update: () => q, delete: () => q, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r),
  });
  return {
    supabase: {
      from: () => q, rpc: async () => ({ data: null, error: null }), functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
      auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: { access_token: "x", user: { id: "u1" } } } }), resetPasswordForEmail: vi.fn(async () => ({ error: null })), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
      storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })), remove: vi.fn() }) },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }), removeChannel: vi.fn(),
    },
  };
});

import { toast } from "sonner";
import HomePage from "@/pages/Home";
import Voce, { PersonalizarInicio } from "@/pages/Voce";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/hooks/use-theme";
import { metricasDoDia } from "@/components/home-nova/e/PaginaSeuDia";
import { alternarResumo, normalizarResumos, RESUMOS_PADRAO } from "@/lib/home-resumos";
import { CHAVE_FORCA_HOME_NOVA, _zerarHomeNova } from "@/lib/home-nova";
import { _zerarConsultaAdmin } from "@/hooks/use-home-nova";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import { localDayKey, semanaAtualId } from "@/lib/utils";
import { criarNuvem, prepararJsdom, type Dados } from "./compat-comum";

const hoje = localDayKey();
const ontem = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return localDayKey(d); })();
const DADOS: Dados = {
  "core-user-name": "João Victor",
  "core-onboarding-done": "true",
  "core-all-modules-celebrated": "true",
  "rotina-habits": ["Água de manhã", "Ler 10 min", "Alongar", "Caminhar", "Dormir cedo"],
  "rotina-habits-week": semanaAtualId(),
  "rotina-habits-checked": { [["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"][(new Date().getDay() + 6) % 7]]: [true, true, false, false, false] },
  "core-saude-water": { [hoje]: 3 },
  "water-log": { [hoje]: 3 },
  "core-dieta-log": { [hoje]: { r1: { name: "Café da manhã", calories: 0 } } },
  "core-dias-anotados": [ontem, hoje],
  "core-hub-streak": { count: 2, lastDate: hoje },
  "finance-dueDays": [{ day: Number(hoje.slice(8, 10)), bills: [{ name: "Cartão Nubank", paid: false }] }],
};
const HUB = {
  dayScore: 27, habits: [{ name: "a", done: true }, { name: "b", done: true }, { name: "c", done: false }], waterGlasses: 3, waterGoal: 8, mealsLogged: 1, mealsTotal: 4,
  sleepHours: 7.4, workoutDone: true, todayWorkoutGroup: "Peito", leuHoje: false, currentBook: "Livro", supplementsTaken: 0, supplementsTotal: 0,
  registrosHoje: { humor: false, gasto: true, peso: false, sono: true, gratidao: false, ideia: false },
} as unknown as LifeHubData;

const Sonda = () => { const { pathname } = useLocation(); return <div data-testid="sonda" data-rota={pathname} />; };
const App = () => (
  <>
    <Routes>
      <Route path="/home" element={<HomePage />} />
      <Route path="/voce" element={<Voce />} />
      <Route path="/voce/inicio" element={<PersonalizarInicio />} />
      <Route path="*" element={<div data-testid="outra-rota" />} />
    </Routes>
    <Sonda />
  </>
);
const respirar = (ms = 0) => act(() => new Promise((r) => setTimeout(r, ms)));
const montar = async (rota = "/home", dados: Dados = DADOS) => {
  const n = criarNuvem(dados);
  const r = render(<MemoryRouter initialEntries={[rota]}><n.Provedor><App /></n.Provedor></MemoryRouter>);
  await respirar(30);
  return { n, ...r };
};
const ligar = () => localStorage.setItem(CHAVE_FORCA_HOME_NOVA, "on");

beforeAll(() => {
  prepararJsdom();
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
  Element.prototype.scrollIntoView = (() => {}) as typeof Element.prototype.scrollIntoView;
  window.confirm = () => false;
  window.alert = () => {};
  Object.defineProperty(navigator, "vibrate", { configurable: true, value: () => true });
});
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); eventos.length = 0; _zerarHomeNova(); _zerarConsultaAdmin(); });
afterEach(() => { cleanup(); document.body.className = ""; });

describe("Resumos (lib/home-resumos) e as métricas da página 1", () => {
  it("normalizar: lista válida, sem repetir, até 3; vazio/estranho = os 3 de sempre; alternar respeita o máximo e nunca zera", () => {
    expect(normalizarResumos(null)).toEqual(RESUMOS_PADRAO);
    expect(normalizarResumos(["sono", "x", "sono", "treino", "agua", "leitura"])).toEqual(["sono", "treino", "agua"]);
    expect(alternarResumo(["habitos", "agua", "refeicoes"], "sono")).toEqual(["habitos", "agua", "refeicoes"]); // cheio
    expect(alternarResumo(["habitos", "agua"], "sono")).toEqual(["habitos", "agua", "sono"]);
    expect(alternarResumo(["habitos"], "habitos")).toEqual(["habitos"]); // nunca fica sem nenhum
    expect(alternarResumo(["habitos", "agua"], "agua")).toEqual(["habitos"]);
  });
  it("metricasDoDia: sem escolha, Hábitos · Água · Refeições; com escolha, os cards pedidos na ordem (Sono 7/8, Gasto 1/1, Treino 1/1, Leitura 0/1); tocar nunca registra", () => {
    const padrao = metricasDoDia(HUB);
    expect(padrao.map((m) => `${m.rotulo} ${m.valor}/${m.max}`)).toEqual(["Hábitos 2/3", "Água 3/8", "Refeições 1/4"]);
    expect(padrao[1].action).toBe("water"); // abre o formulário da água (que tem o "+ 1 copo")
    const escolhidos = metricasDoDia(HUB, undefined, ["sono", "financas", "treino"]);
    expect(escolhidos.map((m) => `${m.rotulo} ${m.valor}/${m.max}`)).toEqual(["Sono 7/8", "Gasto 1/1", "Treino 1/1"]);
    expect(metricasDoDia(HUB, undefined, ["leitura"]).map((m) => m.rotulo)).toEqual(["Leitura", "Registros"]);
  });
});

describe("a folha do score, simples", () => {
  it("tocar em qualquer parte do card abre; a folha mostra contagens (2/5, 3/8, 1/4), sem pontos nem 'Falta/Feito'; a linha leva a resolver", async () => {
    ligar();
    await montar();
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    fireEvent.click(screen.getByTestId("hn-score-explica")); // o texto "Score do dia", não a estrela
    await waitFor(() => expect(screen.getByTestId("he-folha-score")).toBeTruthy());
    const folha = screen.getByTestId("he-folha-score");
    const contagens = within(folha).getAllByTestId("he-score-contagem").map((e) => e.textContent);
    expect(contagens).toEqual(expect.arrayContaining(["2/5", "3/8", "1/4"]));
    expect(folha.textContent).not.toMatch(/\/20|\/15|\/10\b|0\/5/);
    expect(within(folha).queryByText(/^Falta$/)).toBeNull();
    expect(within(folha).queryByText(/^Feito$/)).toBeNull();
    expect(within(folha).getByTestId("he-folha-explica").textContent).toMatch(/Falta/);
    expect(within(folha).getByTestId("he-folha-numero").textContent).toMatch(/^\d+$/);
    // a linha da água leva ao formulário da água (não registra)
    fireEvent.click(within(folha).getByTestId("he-score-itens").querySelector('[data-tipo="agua"]')!);
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais").getAttribute("data-ativa")).toBe("water"), { timeout: 2000 });
  });
});

describe("pendências: alerta de conta e o rodapé", () => {
  it("a conta a vencer tem a própria cor/ícone de alerta (não é a linha do gasto); o rodapé diz 'Ver todas (N)'", async () => {
    ligar();
    await montar();
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    const conta = screen.getByTestId("hn-aviso-conta");
    expect(conta.getAttribute("data-alerta")).toBe("1");
    expect(conta.textContent).toMatch(/Vence hoje: Cartão Nubank/);
    expect(conta.textContent).not.toMatch(/R\$/);
    expect(conta.textContent).toMatch(/conta/);
    const rodape = screen.getByTestId("hn-pendencias-mais");
    expect(rodape.textContent?.trim()).toMatch(/^Ver todas \(\d+\)$/);
  });
});

describe("toasts", () => {
  const avisar = () => act(async () => { toast.success("Oi"); await new Promise((r) => setTimeout(r, 300)); });
  it("com a Home nova ligada: pílula em cima; desligada: o aviso de sempre embaixo", async () => {
    ligar();
    const n = criarNuvem(DADOS);
    const { unmount } = render(<MemoryRouter><n.Provedor><Toaster /></n.Provedor></MemoryRouter>);
    await avisar();
    const emCima = document.querySelector("[data-sonner-toaster]");
    expect(emCima).toBeTruthy();
    expect(emCima?.getAttribute("data-y-position")).toBe("top");
    expect(document.querySelector("[data-sonner-toast]")?.className).toMatch(/rounded-full/); // a pílula
    unmount(); cleanup(); localStorage.clear(); _zerarHomeNova();
    const n2 = criarNuvem(DADOS);
    render(<MemoryRouter><n2.Provedor><Toaster /></n2.Provedor></MemoryRouter>);
    await avisar();
    const embaixo = document.querySelector("[data-sonner-toaster]");
    expect(embaixo).toBeTruthy();
    expect(embaixo?.getAttribute("data-y-position")).toBe("bottom");
    expect(document.querySelector("[data-sonner-toast]")?.className).not.toMatch(/rounded-full/);
  });
});

describe("a aba Você no estilo da E e Personalizar início", () => {
  it("com a chave desligada, a aba de hoje (grupos); ligada, categorias que abrem subcategorias", async () => {
    await montar("/voce");
    expect(screen.getByTestId("tela-voce").getAttribute("data-layout")).toBeNull();
    cleanup(); ligar();
    await montar("/voce");
    await waitFor(() => expect(screen.getByTestId("tela-voce").getAttribute("data-layout")).toBe("e"));
    const cats = screen.getByTestId("voce-categorias");
    expect(within(cats).getAllByRole("button", { expanded: true }).length).toBe(1); // Início aberta
    expect(screen.getByTestId("voce-personalizar-inicio")).toBeTruthy();
    expect(screen.queryByTestId("voce-plano")).toBeNull(); // Conta fechada
    fireEvent.click(within(screen.getByTestId("voce-categoria-conta")).getByRole("button", { expanded: false }));
    await waitFor(() => expect(screen.getByTestId("voce-plano")).toBeTruthy());
    expect(screen.getByTestId("voce-aparencia").textContent).toMatch(/Claro|Escuro/);
    expect(screen.getByTestId("voce-aparencia").textContent).not.toMatch(/Original/); // sem cor de tema
    fireEvent.click(screen.getByTestId("voce-personalizar-inicio"));
    await waitFor(() => expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/voce/inicio"));
    expect(eventos.some(([e, d]) => e === "voce_item_click" && d.item === "personalizar-inicio")).toBe(true);
  });

  it("Personalizar início: Resumos até 3 (grava core-home-resumos), Widgets abre a folha e grava, Pendências abre a folha e grava", async () => {
    ligar();
    const { n } = await montar("/voce/inicio");
    await waitFor(() => expect(screen.getByTestId("tela-personalizar-inicio")).toBeTruthy());
    expect(screen.getByTestId("resumo-habitos").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("resumo-sono").getAttribute("aria-pressed")).toBe("false");
    expect((screen.getByTestId("resumo-sono") as HTMLButtonElement).disabled).toBe(true); // já tem 3
    fireEvent.click(screen.getByTestId("resumo-refeicoes"));
    await waitFor(() => expect(n.ler<string[]>("core-home-resumos")).toEqual(["habitos", "agua"]));
    fireEvent.click(screen.getByTestId("resumo-sono"));
    await waitFor(() => expect(n.ler<string[]>("core-home-resumos")).toEqual(["habitos", "agua", "sono"]));
    expect(eventos.some(([e]) => e === "home_resumos")).toBe(true);
    fireEvent.click(screen.getByTestId("pi-widgets"));
    await waitFor(() => expect(screen.getByTestId("hn-widgets-folha")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Mostrar Treino"));
    await waitFor(() => expect(JSON.stringify(n.ler("core-home-widgets-v2") ?? [])).toContain("workout"));
    fireEvent.click(screen.getByTestId("hn-widgets-fechar"));
    await waitFor(() => expect(screen.queryByTestId("hn-widgets-folha")).toBeNull());
    fireEvent.click(screen.getByTestId("pi-pendencias"));
    await waitFor(() => expect(screen.getByTestId("hn-prefs-folha")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Mostrar Sono"));
    await waitFor(() => expect((n.ler<{ ocultos: string[] }>("home-pendencias-prefs") ?? { ocultos: [] }).ocultos).toContain("sono"));
  });

  it("a Home usa os resumos escolhidos (Sono no lugar de Refeições)", async () => {
    ligar();
    await montar("/home", { ...DADOS, "core-home-resumos": ["habitos", "agua", "sono"] });
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    const rotulos = Array.from(document.querySelectorAll('[data-testid="he-metrica"]')).map((e) => e.getAttribute("data-metrica"));
    expect(rotulos).toEqual(["habitos", "agua", "sono"]);
  });
});

describe("o fundo da tela até o topo (adendo 26/10: a faixa do relógio na cor da E)", () => {
  const CLASSE = "he-fundo-da-tela";
  const css = readFileSync(resolve(process.cwd(), "src/components/home-nova/e/home-e.css"), "utf8");
  it("a Home nova, a aba Você e Personalizar início põem html.he-fundo-da-tela enquanto estão na tela; sai ao desmontar", async () => {
    ligar();
    expect(document.documentElement.classList.contains(CLASSE)).toBe(false);
    await montar("/home");
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    expect(document.documentElement.classList.contains(CLASSE)).toBe(true);
    cleanup();
    expect(document.documentElement.classList.contains(CLASSE)).toBe(false);
    await montar("/voce");
    await waitFor(() => expect(screen.getByTestId("tela-voce")).toBeTruthy());
    expect(document.documentElement.classList.contains(CLASSE)).toBe(true);
    cleanup();
    await montar("/voce/inicio");
    await waitFor(() => expect(screen.getByTestId("tela-personalizar-inicio")).toBeTruthy());
    expect(document.documentElement.classList.contains(CLASSE)).toBe(true);
    cleanup();
    expect(document.documentElement.classList.contains(CLASSE)).toBe(false);
  });
  it("com a chave desligada, a Home de hoje não põe a classe (a faixa branca de sempre)", async () => {
    await montar("/home");
    await waitFor(() => expect(screen.queryByTestId("home-nova")).toBeNull());
    await respirar(50);
    expect(document.documentElement.classList.contains(CLASSE)).toBe(false);
  });
  it("o CSS: a faixa do relógio na cor do topo da E com desfoque, e a casca no fundo da E — claro e escuro", () => {
    expect(css).toMatch(/html\.he-fundo-da-tela \{ --safe-top-cor: hsl\(40 8% 95% \/ 0\.82\); \}/);
    expect(css).toMatch(/html\.he-fundo-da-tela \.app-safe-top-guard \{[^}]*backdrop-filter: blur\(14px\)/);
    expect(css).toMatch(/html\.he-fundo-da-tela, html\.he-fundo-da-tela body, html\.he-fundo-da-tela \.app-safe-shell \{ background-color: hsl\(0 0% 98%\); \}/);
    expect(css).toMatch(/html\.dark\.he-fundo-da-tela \{ --safe-top-cor: hsl\(222 14% 10% \/ 0\.82\); \}/);
    expect(css).toMatch(/html\.dark\.he-fundo-da-tela, html\.dark\.he-fundo-da-tela body, html\.dark\.he-fundo-da-tela \.app-safe-shell \{ background-color: hsl\(222 16% 7%\); \}/);
    // o topo do degradê da E é a mesma cor da faixa (claro 40 8% 95%, escuro 222 14% 10%)
    expect(css).toContain("background: linear-gradient(180deg, hsl(40 8% 95%) 0px, hsl(40 6% 96.5%) 160px");
    expect(css).toContain("background: linear-gradient(180deg, hsl(222 14% 10%) 0px, hsl(var(--hn-fundo)) 360px");
  });
});

describe("a cor do tema", () => {
  it("com a Home nova, quem tinha outra cor volta pro padrão (claro/escuro ficam) — e a cor fica GUARDADA na conta (26/10)", async () => {
    ligar();
    localStorage.setItem("core-theme-palette", "rose");
    localStorage.setItem("core-theme-mode", "dark");
    const n = criarNuvem(DADOS);
    render(<ThemeProvider><MemoryRouter initialEntries={["/home"]}><n.Provedor><App /></n.Provedor></MemoryRouter></ThemeProvider>);
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    await waitFor(() => expect(localStorage.getItem("core-theme-palette")).toBe("default"));
    expect(localStorage.getItem("core-theme-mode")).toBe("dark");
    await waitFor(() => expect(n.ler<string>("core-cor-antes-home-nova")).toBe("rose"));
  });
  it("com a chave DESLIGADA, a cor guardada volta na abertura e o guardado sai (o outro sentido)", async () => {
    localStorage.setItem("core-theme-palette", "default");
    const n = criarNuvem({ ...DADOS, "core-cor-antes-home-nova": "rose" });
    render(<ThemeProvider><MemoryRouter initialEntries={["/home"]}><n.Provedor><App /></n.Provedor></MemoryRouter></ThemeProvider>);
    await waitFor(() => expect(screen.queryByTestId("home-nova")).toBeNull());
    await waitFor(() => expect(localStorage.getItem("core-theme-palette")).toBe("rose"));
    await waitFor(() => expect(n.ler<string | null>("core-cor-antes-home-nova") ?? null).toBeNull());
  });
  it("com a Home nova e sem cor guardada, nada é gravado (quem já usava o Original não ganha chave)", async () => {
    ligar();
    localStorage.setItem("core-theme-palette", "default");
    const n = criarNuvem(DADOS);
    render(<ThemeProvider><MemoryRouter initialEntries={["/home"]}><n.Provedor><App /></n.Provedor></MemoryRouter></ThemeProvider>);
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    await respirar(50);
    expect(n.ler<string | null>("core-cor-antes-home-nova") ?? null).toBeNull();
  });
});
