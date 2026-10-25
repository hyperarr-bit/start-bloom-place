/**
 * 1.0.19 — A HOME NOVA DE VERDADE (opção E) atrás da chave `home_nova` (lib/home-nova), montada pela Home de
 * hoje (pages/Home) com a nuvem em memória:
 *   · chave OFF (padrão): a Home de hoje, sem NENHUM nó da nova — nem a barra de vidro;
 *   · chave ON (força de QA): a Home nova com os dados reais (score, Hábitos 2/5 · Água 3/8 · Refeições 1/4,
 *     pendências, 16 módulos), SEM o tour antigo da Home;
 *   · o "+" da barra de vidro abre a folha e GRAVA pelo QuickActions real: água (+1 nas duas chaves, evento com
 *     origem "folha"), humor (formulário de sempre → core-mood-log);
 *   · pendência com ação abre a folha já no formulário; "Organizar" abre a configuração real e esconder tira o azulejo;
 *   · as abas navegam de verdade (Conquistas com origem "home", Você, e Início volta);
 *   · modo "admin": só a conta admin vê a nova; a resposta fica guardada pra conta;
 *   · reabrir: nada repete (nenhuma folha aberta, o acendimento do fogo 1x por dia).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), message: vi.fn(), warning: vi.fn() }), Toaster: () => null }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false, plataformaApp: () => "web", isIOS: () => false, isAndroid: () => false }));
const auth = vi.hoisted(() => ({
  user: { id: "u1", email: "fulana@exemplo.com.br", created_at: "2026-08-01T12:00:00Z", user_metadata: {} },
  session: null, loading: false, isSubscribed: true, subLoaded: true, signOut: () => {},
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth, AuthProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/lib/image-upload", async (orig) => ({ ...(await orig<typeof import("@/lib/image-upload")>()), uploadFromInput: vi.fn() }));
vi.mock("@/lib/desfazer", () => ({ avisarApagado: vi.fn() }));
const adminMock = vi.hoisted(() => ({ resposta: false as boolean, chamadas: 0 }));
vi.mock("@/lib/admin", () => ({ checkIsAdmin: vi.fn(async () => { adminMock.chamadas++; return adminMock.resposta; }) }));
vi.mock("@/integrations/supabase/client", () => {
  const q: Record<string, unknown> = {};
  const fim = async () => ({ data: [], error: null });
  Object.assign(q, {
    select: () => q, eq: () => q, in: () => q, order: () => q, range: () => q, limit: () => q, gte: () => q, lte: () => q, neq: () => q, is: () => q,
    abortSignal: fim, maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
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

import HomePage from "@/pages/Home";
import { BarraVidroGlobal, __zerarPilhaDaBarraVidro } from "@/components/home-nova/e/BarraVidroGlobal";
import { _zerarConsultaAdmin } from "@/hooks/use-home-nova";
import { CHAVE_ADMIN_HOME_NOVA, CHAVE_FOGO_ACESO_HOME_NOVA, CHAVE_FORCA_HOME_NOVA, _zerarHomeNova, registrarHomeNovaRemoto } from "@/lib/home-nova";
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

const Sonda = () => { const { pathname, state } = useLocation(); return <div data-testid="sonda" data-rota={pathname} data-origem={(state as { origem?: string } | null)?.origem ?? ""} />; };
const App = () => (
  <>
    <Routes>
      <Route path="/home" element={<HomePage />} />
      <Route path="/conquistas" element={<div data-testid="tela-conquistas" />} />
      <Route path="/voce" element={<div data-testid="tela-voce-falsa" />} />
      <Route path="*" element={<div data-testid="outra-rota" />} />
    </Routes>
    <BarraVidroGlobal />
    <Sonda />
  </>
);
const respirar = (ms = 0) => act(() => new Promise((r) => setTimeout(r, ms)));
const montar = async (dados: Dados = DADOS) => {
  const n = criarNuvem(dados);
  const r = render(<MemoryRouter initialEntries={["/home"]}><n.Provedor><App /></n.Provedor></MemoryRouter>);
  await respirar(30);
  return { n, ...r };
};
const ligar = () => localStorage.setItem(CHAVE_FORCA_HOME_NOVA, "on");

beforeAll(() => {
  prepararJsdom();
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
  window.confirm = () => false;
  window.alert = () => {};
  Object.defineProperty(navigator, "vibrate", { configurable: true, value: () => true });
});
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); eventos.length = 0; _zerarHomeNova(); _zerarConsultaAdmin(); __zerarPilhaDaBarraVidro(); adminMock.resposta = false; adminMock.chamadas = 0; });
afterEach(() => { cleanup(); document.body.className = ""; });

describe("Home nova — chave OFF", () => {
  it("é a Home de hoje, sem nenhum nó da nova (nem a barra de vidro), e nenhuma chave nova é gravada", async () => {
    const { n } = await montar();
    expect(document.querySelector('[data-tour="acoes-rapidas"]')).toBeTruthy();
    for (const t of ["score", "acoes-rapidas", "adicionar-widget", "pendencias", "modulos"]) expect(document.querySelector(`[data-tour="${t}"]`), t).toBeTruthy();
    expect(document.querySelector('[data-layout="e"]')).toBeNull();
    expect(document.querySelector('[data-testid="barra-vidro-global"]')).toBeNull();
    expect(document.querySelector('[data-testid="hn-barra"]')).toBeNull();
    const raiz = document.querySelector('[data-nav-raiz="hoje"]') as HTMLElement;
    expect(raiz).toBeTruthy();
    expect(raiz.className.includes("hn")).toBe(false);
    expect(raiz.innerHTML).not.toMatch(/he-|hn-|home-nova/);
    expect(Object.keys(localStorage).filter((k) => k.includes("home-nova"))).toEqual([]);
    expect(n.escritasDeDado().some((k) => k.includes("home-nova"))).toBe(false);
  });
});

describe("Home nova — chave ON", () => {
  it("monta a Home nova com os dados reais, a barra de vidro, e sem o tour antigo", async () => {
    ligar();
    await montar();
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    expect(document.querySelector('[data-tour="acoes-rapidas"]')).toBeNull();
    expect(screen.getByText(/Boa (noite|tarde|madrugada)|Bom dia/).textContent).toContain("João");
    expect(screen.getByTestId("he-score-numero").textContent).toMatch(/^\d+$/);
    const metricas = Array.from(document.querySelectorAll('[data-testid="he-metrica"]')).map((e) => e.textContent?.replace(/\s+/g, " ").trim());
    expect(metricas).toEqual(["2/5Hábitos", "3/8Água", "1/4Refeições"].map((s) => s.replace("/", " /")).map((s) => s.replace(" /", "/")));
    expect(document.querySelectorAll('[data-testid="hn-pendencia"]').length).toBeGreaterThan(0);
    expect(screen.getByText(/Vence hoje: Cartão Nubank/)).toBeTruthy();
    expect(document.querySelectorAll('[data-testid="hn-modulo"]').length).toBe(16);
    await waitFor(() => expect(document.querySelector('[data-testid="barra-vidro-global"] [data-testid="hn-barra"]')).toBeTruthy());
    expect(document.querySelector('[data-camada-guia]')).toBeNull();
    expect(document.querySelector('[data-testid="barra-de-abas"]')).toBeNull();
    // o fogo acendeu hoje (o dia está anotado): a marca do aparelho é de hoje
    expect(localStorage.getItem(CHAVE_FOGO_ACESO_HOME_NOVA)).toBe(hoje);
  });

  it("o '+' abre a folha e a água GRAVA pelo QuickActions de verdade (as duas chaves, +1), com o evento de origem", async () => {
    ligar();
    const { n } = await montar();
    await waitFor(() => expect(document.querySelector('[data-testid="hn-mais"]')).toBeTruthy());
    fireEvent.click(screen.getByTestId("hn-mais"));
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais")).toBeTruthy());
    fireEvent.click(document.querySelector('[data-testid="hn-acoes"] [data-acao="water"]')!);
    await waitFor(() => expect((n.ler<Record<string, number>>("core-saude-water") ?? {})[hoje]).toBe(4));
    expect((n.ler<Record<string, number>>("water-log") ?? {})[hoje]).toBe(4);
    expect(eventos.some(([e, d]) => e === "home_acao_rapida" && d.acao === "water" && d.origem === "folha")).toBe(true);
    // a folha fecha sozinha depois do ✓
    await waitFor(() => expect(screen.queryByTestId("hn-folha-mais")).toBeNull(), { timeout: 3000 });
    // os 3 cards acompanham: Água 4/8
    expect(document.querySelector('[data-metrica="agua"]')?.textContent?.replace(/\s+/g, "")).toContain("4/8");
  });

  it("humor abre o formulário de sempre dentro da folha e grava em core-mood-log", async () => {
    ligar();
    const { n } = await montar();
    await waitFor(() => expect(document.querySelector('[data-testid="hn-mais"]')).toBeTruthy());
    fireEvent.click(screen.getByTestId("hn-mais"));
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais")).toBeTruthy());
    fireEvent.click(document.querySelector('[data-testid="hn-acoes"] [data-acao="mood"]')!);
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais").getAttribute("data-ativa")).toBe("mood"));
    expect(screen.queryByTestId("hn-acoes")).toBeNull(); // a grade some com o formulário aberto
    const formulario = screen.getByTestId("hn-formularios");
    const botoes = within(formulario).getAllByRole("button");
    const bom = botoes.find((b) => /🙂|😊|Bem|Bom/.test(b.textContent ?? ""));
    expect(bom, "um botão de humor").toBeTruthy();
    fireEvent.click(bom!);
    await waitFor(() => expect((n.ler<Record<string, unknown>>("core-mood-log") ?? {})[hoje]).toBeTruthy());
    await waitFor(() => expect(screen.queryByTestId("hn-folha-mais")).toBeNull(), { timeout: 3000 });
  });

  it("uma pendência com ação abre a folha já no formulário dela; o anel abre a folha da pontuação", async () => {
    ligar();
    // sem a conta a vencer: a página 2 cabe 5 linhas e os avisos (conta, treino sem plano) tomam vagas — assim o humor aparece
    const { "finance-dueDays": _conta, ...semConta } = DADOS; void _conta;
    await montar(semConta);
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    const humor = Array.from(document.querySelectorAll('[data-testid="hn-pendencia"]')).find((e) => /humor/i.test(e.textContent ?? ""));
    expect(humor, "a pendência do humor").toBeTruthy();
    fireEvent.click(humor!);
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais").getAttribute("data-ativa")).toBe("mood"));
    fireEvent.click(screen.getByTestId("hn-folha-mais-fechar"));
    await waitFor(() => expect(screen.queryByTestId("hn-folha-mais")).toBeNull());
    fireEvent.click(screen.getByTestId("he-score-abrir"));
    await waitFor(() => expect(screen.getByTestId("he-folha-score")).toBeTruthy());
    expect(screen.getByTestId("he-folha-explica").textContent).toMatch(/Falta/);
  });

  it("Organizar abre a configuração real; esconder tira o azulejo e grava em core-module-prefs", async () => {
    ligar();
    const { n } = await montar();
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    fireEvent.click(screen.getByTestId("hn-organizar"));
    await waitFor(() => expect(screen.getByTestId("hn-organizar-folha")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Esconder Pet"));
    await waitFor(() => expect(document.querySelectorAll('[data-testid="hn-modulo"]').length).toBe(15));
    expect((n.ler<{ hidden?: string[] }>("core-module-prefs") ?? {}).hidden).toContain("pet");
    expect(eventos.some(([e, d]) => e === "home_modulos_editar" && d.origem === "organizar")).toBe(true);
    fireEvent.click(screen.getByTestId("hn-organizar-pronto"));
    await waitFor(() => expect(screen.queryByTestId("hn-organizar-folha")).toBeNull());
    expect(screen.getByText(/\+1 oculto/)).toBeTruthy();
  });

  it("as abas navegam: Conquistas (origem home), Você, e Início volta pra Home", async () => {
    ligar();
    await montar();
    await waitFor(() => expect(document.querySelector('[data-testid="hn-aba-conquistas"]')).toBeTruthy());
    fireEvent.click(screen.getByTestId("hn-aba-conquistas"));
    await waitFor(() => expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/conquistas"));
    expect(screen.getByTestId("sonda").getAttribute("data-origem")).toBe("home");
    expect(screen.getByTestId("tela-conquistas")).toBeTruthy();
    await waitFor(() => expect(document.body.classList.contains("com-barra-vidro")).toBe(true)); // o respiro de baixo nas outras abas
    expect(eventos.some(([e, d]) => e === "tab_click" && d.tab === "conquistas" && d.barra === "vidro")).toBe(true);
    fireEvent.click(screen.getByTestId("hn-aba-voce"));
    await waitFor(() => expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/voce"));
    fireEvent.click(screen.getByTestId("hn-aba-inicio"));
    await waitFor(() => expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/home"));
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    expect(document.body.classList.contains("com-barra-vidro")).toBe(false);
  });

  it("o '+' numa outra aba leva pra Home já com a folha aberta", async () => {
    ligar();
    await montar();
    await waitFor(() => expect(document.querySelector('[data-testid="hn-aba-voce"]')).toBeTruthy());
    fireEvent.click(screen.getByTestId("hn-aba-voce"));
    await waitFor(() => expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/voce"));
    fireEvent.click(screen.getByTestId("hn-mais"));
    await waitFor(() => expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/home"));
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais")).toBeTruthy());
  });

  it("reabrir o app não repete nada: a mesma Home, nenhuma folha, o fogo não acende de novo", async () => {
    ligar();
    const primeira = await montar();
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    const marca = localStorage.getItem(CHAVE_FOGO_ACESO_HOME_NOVA);
    expect(marca).toBe(hoje);
    primeira.unmount();
    cleanup();
    await montar();
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    expect(screen.queryByTestId("hn-folha-mais")).toBeNull();
    expect(screen.queryByTestId("he-folha-score")).toBeNull();
    expect(screen.queryByTestId("hn-organizar-folha")).toBeNull();
    expect(localStorage.getItem(CHAVE_FOGO_ACESO_HOME_NOVA)).toBe(marca);
    expect(document.querySelector('[data-testid="hn-pilula-fogo"]')?.classList.contains("he-acende")).toBe(false);
  });
});

describe("Home nova — modo admin", () => {
  it("conta sem papel de admin: a Home de hoje (a checagem roda 1x e fica guardada pra conta)", async () => {
    registrarHomeNovaRemoto({ current: { metadata: { home_nova: "admin" } }, all: {} });
    adminMock.resposta = false;
    await montar();
    await waitFor(() => expect(document.querySelector('[data-tour="acoes-rapidas"]')).toBeTruthy());
    expect(document.querySelector('[data-layout="e"]')).toBeNull();
    expect(adminMock.chamadas).toBe(1); // a Home e a barra perguntam, a consulta é uma só
    expect(localStorage.getItem(CHAVE_ADMIN_HOME_NOVA)).toBe("u1:0");
  });
  it("conta admin: a Home nova; na abertura seguinte a resposta guardada vale na hora (a consulta só confirma, 1x)", async () => {
    registrarHomeNovaRemoto({ current: { metadata: { home_nova: "admin" } }, all: {} });
    adminMock.resposta = true;
    const primeira = await montar();
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    expect(localStorage.getItem(CHAVE_ADMIN_HOME_NOVA)).toBe("u1:1");
    expect(adminMock.chamadas).toBe(1);
    primeira.unmount(); cleanup();
    _zerarHomeNova(); _zerarConsultaAdmin(); // outra abertura: o RevenueCat ainda não respondeu, a resposta do aparelho vale
    localStorage.setItem("core-home-nova", "admin");
    adminMock.resposta = true;
    let resolver: (v: boolean) => void = () => {};
    const { checkIsAdmin } = await import("@/lib/admin");
    (checkIsAdmin as unknown as { mockImplementationOnce: (f: () => Promise<boolean>) => void }).mockImplementationOnce(() => new Promise<boolean>((r) => { adminMock.chamadas++; resolver = r; }));
    await montar();
    // a Home nova já está na tela ANTES da consulta responder (a resposta guardada vale)
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    expect(adminMock.chamadas).toBe(2);
    await act(async () => { resolver(true); });
    expect(document.querySelector('[data-layout="e"]')).toBeTruthy();
  });
});
