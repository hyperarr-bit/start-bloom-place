/**
 * RODADA 3 da Home nova (26/10, feedback do dono no iPhone b47):
 *   · BUG "Ver todas" das pendências abria a folha do SCORE → abre a lista completa (FolhaPendencias);
 *   · toda folha fecha ARRASTANDO PARA BAIXO (folha-arrasto: a alça + a folha no topo da rolagem; mola de volta);
 *   · WIDGETS refeitos (lib/home-widgets-e): card único com dado real, catálogo enxuto, sem pequeno/grande, estado
 *     vazio útil, migração dos widgets antigos, chave core-home-widgets-e;
 *   · o fogo não reinicia ao remontar (fase pelo relógio) e a troca de aba é instantânea (troca-de-rota);
 *   · a entrada escalonada da Home só na 1ª montagem da sessão.
 */
process.env.TZ = "America/Sao_Paulo";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); } }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), message: vi.fn(), warning: vi.fn() }), Toaster: () => null }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false, plataformaApp: () => "web", isIOS: () => false, isAndroid: () => false }));
const auth = vi.hoisted(() => ({ user: { id: "u1", email: "fulana@exemplo.com.br", created_at: "2026-08-01T12:00:00Z", user_metadata: {} }, session: null, loading: false, isSubscribed: true, subLoaded: true, signOut: () => {} }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth, AuthProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/lib/image-upload", async (orig) => ({ ...(await orig<typeof import("@/lib/image-upload")>()), uploadFromInput: vi.fn() }));
vi.mock("@/lib/desfazer", () => ({ avisarApagado: vi.fn() }));
vi.mock("@/lib/admin", () => ({ checkIsAdmin: vi.fn(async () => false) }));
vi.mock("@/integrations/supabase/client", () => {
  const q: Record<string, unknown> = {};
  Object.assign(q, { select: () => q, eq: () => q, in: () => q, order: () => q, range: () => q, limit: () => q, gte: () => q, lte: () => q, neq: () => q, is: () => q, abortSignal: async () => ({ data: [], error: null }), maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }), insert: async () => ({ data: null, error: null }), upsert: async () => ({ data: null, error: null }), update: () => q, delete: () => q, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r) });
  return { supabase: { from: () => q, rpc: async () => ({ data: null, error: null }), functions: { invoke: vi.fn(async () => ({ data: null, error: null })) }, auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: { access_token: "x", user: { id: "u1" } } } }), resetPasswordForEmail: vi.fn(async () => ({ error: null })), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) }, storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })), remove: vi.fn() }) }, channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }), removeChannel: vi.fn() } };
});

import HomePage from "@/pages/Home";
import { BarraVidroGlobal } from "@/components/home-nova/e/BarraVidroGlobal";
import { CHAVE_FORCA_HOME_NOVA, _zerarHomeNova } from "@/lib/home-nova";
import { deveFechar, LIMITE_FECHAR_PX } from "@/components/home-nova/e/folha-arrasto";
import { FogoSequencia, faseDoFogo } from "@/components/fogo/FogoSequencia";
import { marcarTrocaDeAba, rotaMontou, _trocaDeAbaMarcada } from "@/lib/troca-de-rota";
import { _zerarEntradaDaHome, marcarEntradaDaHome } from "@/components/home-nova/e/Animacoes";
import { CATALOGO_WIDGETS_E, MAX_WIDGETS_E, WIDGETS_E_PADRAO, alternarWidgetE, dadoDoWidgetE, normalizarWidgetsE, widgetsE } from "@/lib/home-widgets-e";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import { localDayKey, semanaAtualId } from "@/lib/utils";
import { criarNuvem, prepararJsdom, type Dados } from "./compat-comum";

const hoje = localDayKey();
const DADOS: Dados = {
  "core-user-name": "João Victor", "core-onboarding-done": "true", "core-all-modules-celebrated": "true",
  "rotina-habits": ["Água de manhã", "Ler 10 min", "Alongar", "Meditar", "Planejar o dia", "Caminhar"], "rotina-habits-week": semanaAtualId(),
  "core-dias-anotados": [hoje], "core-hub-streak": { count: 1, lastDate: hoje },
  "rotina-habit-log": { [hoje]: ["Água de manhã"] },
  "core-saude-water-goal": 8, "core-saude-water": { [hoje]: 3 },
};
const Sonda = () => { const { pathname } = useLocation(); return <div data-testid="sonda" data-rota={pathname} />; };
const respirar = (ms = 0) => act(() => new Promise((r) => setTimeout(r, ms)));
const montar = async (dados: Dados = DADOS) => {
  const n = criarNuvem(dados);
  render(<MemoryRouter initialEntries={["/home"]}><n.Provedor><Routes><Route path="/home" element={<HomePage />} /><Route path="*" element={<div data-testid="outra" />} /></Routes><BarraVidroGlobal /><Sonda /></n.Provedor></MemoryRouter>);
  await respirar(30);
  await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
  return n;
};
/** vai pra página N do carrossel (as páginas ficam montadas; o teste só precisa do DOM) */
const pagina = (n: 1 | 2 | 3) => screen.getByTestId(`he-pagina-${n}`);

beforeAll(() => {
  prepararJsdom();
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
  // o jsdom não tem PointerEvent: o fireEvent.pointerDown viraria um Event sem clientY — o arrasto lê clientY/pointerId
  if (typeof (window as { PointerEvent?: unknown }).PointerEvent === "undefined") {
    class PointerEventFalso extends MouseEvent {
      pointerId: number; pointerType: string;
      constructor(tipo: string, init: PointerEventInit = {}) { super(tipo, init); this.pointerId = init.pointerId ?? 0; this.pointerType = init.pointerType ?? "touch"; }
    }
    (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventFalso;
  }
});
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); eventos.length = 0; _zerarHomeNova(); _zerarEntradaDaHome(); localStorage.setItem(CHAVE_FORCA_HOME_NOVA, "on"); });
afterEach(() => { cleanup(); document.body.className = ""; });

describe("fechar arrastando para baixo (folha-arrasto)", () => {
  it("a regra: além de 100 px fecha; com velocidade (> 0,5 px/ms) fecha a partir de 24 px; um toque parado não", () => {
    expect(deveFechar(LIMITE_FECHAR_PX + 1, 0)).toBe(true);
    expect(deveFechar(60, 0)).toBe(false);
    expect(deveFechar(30, 0.8)).toBe(true);
    expect(deveFechar(10, 2)).toBe(false);
    expect(deveFechar(0, 0)).toBe(false);
  });
  it("a folha do score tem a alça e é arrastável; arrastar 160 px pra baixo e soltar FECHA", async () => {
    await montar();
    fireEvent.click(screen.getByTestId("he-score-abrir"));
    const folha = await screen.findByTestId("he-folha-score");
    expect(folha.getAttribute("data-arrastavel")).toBe("1");
    expect(within(folha).getByTestId("he-alca")).toBeTruthy();
    fireEvent.pointerDown(folha, { pointerId: 1, clientY: 100, pointerType: "touch", button: 0 });
    fireEvent.pointerMove(folha, { pointerId: 1, clientY: 150, pointerType: "touch" });
    fireEvent.pointerMove(folha, { pointerId: 1, clientY: 260, pointerType: "touch" });
    fireEvent.pointerUp(folha, { pointerId: 1, clientY: 260, pointerType: "touch" });
    await waitFor(() => expect(screen.queryByTestId("he-folha-score")).toBeNull());
  });
  it("um arrasto curto (40 px) NÃO fecha — volta com mola; subir não vira arrasto", async () => {
    await montar();
    fireEvent.click(screen.getByTestId("he-score-abrir"));
    const folha = await screen.findByTestId("he-folha-score");
    fireEvent.pointerDown(folha, { pointerId: 2, clientY: 100, pointerType: "touch", button: 0 });
    fireEvent.pointerMove(folha, { pointerId: 2, clientY: 140, pointerType: "touch" });
    fireEvent.pointerUp(folha, { pointerId: 2, clientY: 140, pointerType: "touch" });
    await respirar(50);
    expect(screen.getByTestId("he-folha-score")).toBeTruthy();
    fireEvent.pointerDown(folha, { pointerId: 3, clientY: 300, pointerType: "touch", button: 0 });
    fireEvent.pointerMove(folha, { pointerId: 3, clientY: 100, pointerType: "touch" });
    fireEvent.pointerUp(folha, { pointerId: 3, clientY: 100, pointerType: "touch" });
    await respirar(50);
    expect(screen.getByTestId("he-folha-score")).toBeTruthy();
  });
  it("todas as folhas novas têm a alça: '+', sequência, personalizar pendências, widgets, pendências (Ver todas)", async () => {
    await montar();
    fireEvent.click(screen.getByTestId("hn-mais"));
    expect(within(await screen.findByTestId("hn-folha-mais")).getByTestId("he-alca")).toBeTruthy();
    expect(screen.getByTestId("hn-folha-mais").getAttribute("data-arrastavel")).toBe("1");
    fireEvent.click(screen.getByTestId("hn-folha-mais-fechar"));
    fireEvent.click(screen.getByTestId("hn-pilula-fogo"));
    expect(within(await screen.findByTestId("he-folha-sequencia")).getByTestId("he-alca")).toBeTruthy();
    fireEvent.click(within(screen.getByTestId("he-folha-sequencia")).getByRole("button", { name: "Fechar" }));
    fireEvent.click(within(pagina(2)).getByTestId("hn-personalizar"));
    expect(within(await screen.findByTestId("hn-prefs-folha")).getByTestId("he-alca")).toBeTruthy();
    fireEvent.click(screen.getByTestId("hn-prefs-fechar"));
    fireEvent.click(within(pagina(2)).getByTestId("hn-pendencias-mais"));
    expect(within(await screen.findByTestId("he-folha-pendencias")).getByTestId("he-alca")).toBeTruthy();
  });
});

describe("'Ver todas' das pendências", () => {
  it("abre a LISTA COMPLETA (não a folha do score): todas as pendentes, as feitas, e cada linha leva a resolver", async () => {
    await montar({ ...DADOS, "core-saude-water": { [hoje]: 8 } }); // a água batida = uma "feita"
    const p2 = pagina(2);
    const visiveis = within(p2).getAllByTestId("hn-pendencia").length;
    expect(visiveis).toBeLessThanOrEqual(5);
    fireEvent.click(within(p2).getByTestId("hn-pendencias-mais"));
    const folha = await screen.findByTestId("he-folha-pendencias");
    expect(screen.queryByTestId("he-folha-score")).toBeNull();
    expect(eventos.some(([e]) => e === "home_pendencias_todas")).toBe(true);
    const todas = within(folha).getAllByTestId("hn-pendencia");
    expect(todas.length).toBeGreaterThan(visiveis);
    expect(within(folha).getByTestId("he-pendencias-resumo").textContent).toMatch(/pendentes · 1 feita|pendentes/);
    expect(within(folha).getAllByTestId("hn-pendencia-feita").length).toBeGreaterThanOrEqual(1);
    fireEvent.click(todas[0]);
    await waitFor(() => expect(screen.queryByTestId("he-folha-pendencias")).toBeNull());
    expect(eventos.some(([e, d]) => e === "home_pendencia" && d.origem === "todas")).toBe(true);
  });
});

describe("widgets da Home nova (lib/home-widgets-e)", () => {
  const vida = (extra: Partial<LifeHubData> = {}): LifeHubData => ({
    habits: [{ name: "a", done: true }, { name: "b", done: false }], waterGlasses: 3, waterGoal: 8, mealsLogged: 2, mealsTotal: 4,
    caloriesConsumed: 850, caloriesGoal: 2000, sleepHours: 7.5, currentBook: "Dom Casmurro", readingProgress: 34,
    todayWorkoutGroup: "Peito", workoutDone: false, workoutStatus: "hoje", nextBillName: "Aluguel", nextBillDaysUntil: 3, nextBillDate: "dia 29",
    dayScore: 44, ...extra,
  }) as unknown as LifeHubData;
  const get = <T,>(_k: string, f: T): T => f;

  it("normaliza, migra os widgets antigos (os que têm par) e cai no padrão; alternar respeita o máximo de 6", () => {
    expect(normalizarWidgetsE(["sono", "x", "sono", "agua"])).toEqual(["sono", "agua"]);
    expect(normalizarWidgetsE(undefined)).toBeNull();
    expect(widgetsE(undefined, undefined)).toEqual(WIDGETS_E_PADRAO);
    expect(widgetsE(undefined, [{ id: "workout", size: "small" }, { id: "quick-notes", size: "large" }, { id: "finances", size: "small" }])).toEqual(["treino", "proxima-conta"]);
    expect(widgetsE([], [{ id: "workout", size: "small" }])).toEqual([]); // lista gravada vazia vale (a pessoa tirou tudo)
    const seis = CATALOGO_WIDGETS_E.slice(0, MAX_WIDGETS_E).map((w) => w.id);
    expect(alternarWidgetE(seis, "cuidados")).toBe(seis);
    expect(alternarWidgetE(["sono"], "sono")).toEqual([]);
    expect(alternarWidgetE(["sono"], "agua")).toEqual(["sono", "agua"]);
  });
  it("cada widget tem dado real: número + unidade + anel; sem dado, o estado vazio ÚTIL com a ação", () => {
    const d = vida();
    expect(dadoDoWidgetE("proxima-conta", d, get)).toMatchObject({ numero: "3", unidade: "dias", detalhe: "Aluguel · vence em 3 dias", fracao: null, vazio: null });
    expect(dadoDoWidgetE("calorias", d, get)).toMatchObject({ numero: "850", unidade: "/2000", fracao: { valor: 850, max: 2000 } });
    expect(dadoDoWidgetE("treino", d, get)).toMatchObject({ numero: "Hoje", detalhe: "Peito", action: "workout" });
    expect(dadoDoWidgetE("sono", d, get)).toMatchObject({ numero: "7,5", unidade: "h", detalhe: "noite boa" });
    expect(dadoDoWidgetE("leitura", d, get)).toMatchObject({ numero: "34", unidade: "%", detalhe: "Dom Casmurro" });
    expect(dadoDoWidgetE("habitos", d, get)).toMatchObject({ numero: "1", unidade: "/2", detalhe: "1 falta" });
    expect(dadoDoWidgetE("agua", d, get)).toMatchObject({ numero: "3", unidade: "/8", detalhe: "5 copos pra meta", action: "water" });
    // sem renda cadastrada: o orçamento pede pra cadastrar (nunca R$ aqui — é % quando tem)
    expect(dadoDoWidgetE("orcamento", d, get).vazio).toEqual({ texto: "Sem renda cadastrada", cta: "Cadastrar renda" });
    expect(dadoDoWidgetE("cuidados", d, get).vazio).toEqual({ texto: "Nenhum cuidado cadastrado", cta: "Cadastrar cuidado" });
    const vazio = vida({ nextBillName: null, nextBillDaysUntil: null, currentBook: null, todayWorkoutGroup: null, workoutStatus: "vazio", sleepHours: null, habits: [] });
    expect(dadoDoWidgetE("proxima-conta", vazio, get).vazio?.cta).toBe("Cadastrar conta");
    expect(dadoDoWidgetE("leitura", vazio, get).vazio?.cta).toBe("Começar um livro");
    expect(dadoDoWidgetE("treino", vazio, get).vazio?.cta).toBe("Montar treino");
    expect(dadoDoWidgetE("sono", vazio, get).vazio?.cta).toBe("Registrar sono");
    expect(dadoDoWidgetE("habitos", vazio, get).vazio?.cta).toBe("Criar hábito");
    // orçamento com renda: % do que sobra
    const comRenda = <T,>(k: string, f: T): T => (k === "finance-incomes" ? ([{ id: 1, value: 1000 }] as unknown as T) : k === "finance-expenses" ? ([{ id: 2, value: 250, date: hoje }] as unknown as T) : f);
    const o = dadoDoWidgetE("orcamento", d, comRenda);
    expect(o.vazio).toBeNull(); expect(o.unidade).toBe("%"); expect(Number(o.numero)).toBeGreaterThan(0); expect(Number(o.numero)).toBeLessThanOrEqual(100);
    expect(JSON.stringify(o)).not.toMatch(/R\$/);
  });
  it("a página 3 mostra os cards no formato único (número + rótulo + anel/ícone) e o vazio útil; o seletor não tem pequeno/grande e grava a chave nova", async () => {
    await montar({ ...DADOS, "core-home-widgets-e": ["habitos", "agua", "proxima-conta", "leitura"] });
    const p3 = pagina(3);
    expect(within(p3).getByTestId("he-widget-habitos").querySelector("[data-testid='he-widget-numero']")?.textContent).toMatch(/^\d+$/);
    expect(within(p3).getByTestId("he-widget-habitos").textContent).toMatch(/\/\d+/); // "n/total"
    expect(within(p3).getByTestId("he-widget-agua").querySelector("[data-testid='he-widget-numero']")?.textContent).toBe("3");
    expect(within(p3).getByTestId("he-widget-proxima-conta").getAttribute("data-vazio")).toBe("1");
    expect(within(p3).getByTestId("he-widget-proxima-conta").textContent).toContain("Cadastrar conta");
    expect(within(p3).getByTestId("he-widget-leitura").textContent).toContain("Começar um livro");
    expect(p3.textContent).not.toMatch(/Orçamento Restante|Quanto ainda pode gastar/); // nunca só a descrição
    fireEvent.click(within(p3).getByTestId("he-widget-agua")); // abre o formulário da água (ação), não o módulo
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais")).toBeTruthy());
    fireEvent.click(screen.getByTestId("hn-folha-mais-fechar"));
    await waitFor(() => expect(screen.queryByTestId("hn-folha-mais")).toBeNull());
    // o seletor
    expect(within(p3).queryByTestId("he-widgets-escolher")).toBeNull(); // 4 widgets: a vaga do "+" some
    cleanup();
    const n2 = await montar({ ...DADOS, "core-home-widgets-e": ["sono"] });
    fireEvent.click(within(pagina(3)).getByTestId("he-widgets-escolher"));
    const folha = await screen.findByTestId("hn-widgets-folha");
    expect(folha.textContent).not.toMatch(/Pequeno|Grande/);
    expect(within(folha).getAllByRole("switch").length).toBe(CATALOGO_WIDGETS_E.length);
    fireEvent.click(within(folha).getByLabelText("Mostrar Hábitos"));
    await waitFor(() => expect(n2.ler("core-home-widgets-e")).toEqual(["sono", "habitos"]));
    expect(eventos.some(([e, d]) => e === "home_widgets" && d.id === "habitos")).toBe(true);
  });
});

describe("o fogo não reinicia ao remontar; a troca de aba é instantânea; a entrada da Home é 1x por sessão", () => {
  it("a fase da chama vem do relógio (animation-delay negativo dentro do período) e remontar dá a mesma fase", () => {
    const f = faseDoFogo(10_000);
    expect(f.corpo).toBeCloseTo(-((10_000 % 2600) / 1000), 3);
    expect(f.gota).toBeCloseTo(-((10_000 % 2100) / 1000), 3);
    expect(f.corpo).toBeLessThanOrEqual(0); expect(f.corpo).toBeGreaterThan(-2.6);
    const { unmount } = render(<FogoSequencia dias={5} estado="aceso" />);
    const antes = (screen.getByTestId("fg-seq") as HTMLElement).style.getPropertyValue("--fg-fase-corpo");
    expect(antes).toMatch(/^-?\d+\.\d{3}s$/);
    unmount();
    render(<FogoSequencia dias={5} estado="aceso" />);
    const depois = (screen.getByTestId("fg-seq") as HTMLElement).style.getPropertyValue("--fg-fase-corpo");
    expect(Math.abs(parseFloat(depois) - parseFloat(antes))).toBeLessThan(0.1);
    const css = readFileSync(resolve(process.cwd(), "src/components/fogo/fogo-sequencia.css"), "utf8");
    expect(css).toContain("animation-delay: var(--fg-fase-corpo, 0s)");
    expect(css).toContain("animation-delay: var(--fg-fase-gota, 0s)");
  });
  it("marcar a troca de aba faz a foto da tela de antes sair na hora (0 ms) e a marca se apaga ao montar a rota", () => {
    expect(_trocaDeAbaMarcada()).toBe(false);
    marcarTrocaDeAba();
    expect(_trocaDeAbaMarcada()).toBe(true);
    rotaMontou();
    expect(_trocaDeAbaMarcada()).toBe(false);
  });
  it("a entrada escalonada só toca na 1ª montagem da sessão", () => {
    expect(marcarEntradaDaHome()).toBe(true);
    expect(marcarEntradaDaHome()).toBe(false);
    _zerarEntradaDaHome();
    expect(marcarEntradaDaHome()).toBe(true);
  });
});
