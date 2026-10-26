/**
 * RODADA 3 (26/10) — a aba VOCÊ no estilo do menu do Cal AI + a navegação empilhada do iOS + os Resumos com prévia:
 *   · seções com título e linhas visíveis (sem acordeão); o card da conta; "Avaliar o CORE" sozinho e em destaque (só no app);
 *   · cada linha abre a subpágina com state.push = "ios" (lib/navegacao-ios); o PageTransition entra deslizando (push),
 *     volta com pop e tem a borda esquerda de arrastar pra voltar; `voltar` usa a pilha quando há;
 *   · Personalizar início › Resumos: a prévia dos 3 cards + a lista com interruptor, posição e máximo de 3;
 *   · Aparência no estilo da E com a chave; 5 toques na versão alternam o vidro "Cal AI" (lib/vidro-calai).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); } }));
const toasts = vi.hoisted(() => [] as string[]);
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), message: (m: string) => { toasts.push(m); }, warning: vi.fn() }), Toaster: () => null }));
const nativo = vi.hoisted(() => ({ v: false }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => nativo.v, plataformaApp: () => (nativo.v ? "ios" : "web"), isIOS: () => nativo.v, isAndroid: () => false }));
vi.mock("@/lib/avaliacao-v14", () => ({ avaliacaoV14Ligada: () => true }));
const avaliar = vi.hoisted(() => ({ chamadas: [] as string[] }));
vi.mock("@/lib/avaliacao", async (orig) => ({ ...(await orig<typeof import("@/lib/avaliacao")>()), abrirPaginaDeAvaliacao: (origem: string) => { avaliar.chamadas.push(origem); return true; } }));
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

import Voce, { Aparencia, PersonalizarInicio } from "@/pages/Voce";
import { PageTransition } from "@/components/PageTransition";
import { ThemeProvider } from "@/hooks/use-theme";
import { CHAVE_FORCA_HOME_NOVA, _zerarHomeNova } from "@/lib/home-nova";
import { PUSH_IOS, _empilhadas, _zerarPilhaIos, modoDeEntrada } from "@/lib/navegacao-ios";
import { CHAVE_VIDRO_CALAI, CLASSE_VIDRO_CALAI, aplicarVidroCalai, guardarForcaVidro, vidroCalaiLigado } from "@/lib/vidro-calai";
import { localDayKey, semanaAtualId } from "@/lib/utils";
import { criarNuvem, prepararJsdom, type Dados } from "./compat-comum";

const hoje = localDayKey();
const DADOS: Dados = {
  "core-user-name": "João Victor", "core-onboarding-done": "true", "core-all-modules-celebrated": "true",
  "rotina-habits": ["Água de manhã", "Ler 10 min"], "rotina-habits-week": semanaAtualId(),
  "core-dias-anotados": [hoje], "core-hub-streak": { count: 1, lastDate: hoje },
};
const Sonda = () => { const { pathname, state } = useLocation(); return <div data-testid="sonda" data-rota={pathname} data-push={(state as { push?: string } | null)?.push ?? ""} />; };
const respirar = (ms = 0) => act(() => new Promise((r) => setTimeout(r, ms)));
/** como o App.tsx: <Routes key={pathname}> — cada rota monta o PageTransition de novo */
const Rotas = () => {
  const l = useLocation();
  return (
    <Routes location={l} key={l.pathname}>
      <Route path="/voce" element={<PageTransition><Voce /></PageTransition>} />
      <Route path="/voce/inicio" element={<PageTransition><PersonalizarInicio /></PageTransition>} />
      <Route path="/voce/aparencia" element={<PageTransition><Aparencia /></PageTransition>} />
      <Route path="*" element={<PageTransition><div data-testid="outra" /></PageTransition>} />
    </Routes>
  );
};
const montar = async (rota = "/voce", dados: Dados = DADOS) => {
  const n = criarNuvem(dados);
  render(
    <ThemeProvider><MemoryRouter initialEntries={[rota]}><n.Provedor>
      <Rotas />
      <Sonda />
    </n.Provedor></MemoryRouter></ThemeProvider>,
  );
  await respirar(30);
  return n;
};

beforeAll(() => { prepararJsdom(); Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo; });
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); eventos.length = 0; toasts.length = 0; avaliar.chamadas.length = 0; nativo.v = false; _zerarHomeNova(); _zerarPilhaIos(); localStorage.setItem(CHAVE_FORCA_HOME_NOVA, "on"); document.documentElement.classList.remove(CLASSE_VIDRO_CALAI); });
afterEach(() => { cleanup(); document.body.className = ""; });

describe("a aba Você no estilo do menu do Cal AI", () => {
  it("seções com título e linhas VISÍVEIS (sem acordeão): Início · Conta · Progresso · Ajuda; o card da conta; Sair; a versão", async () => {
    await montar();
    const secoes = screen.getByTestId("voce-secoes");
    expect(within(secoes).getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Início", "Conta", "Progresso", "Ajuda"]);
    // tudo visível de cara, sem abrir nada
    for (const id of ["personalizar-inicio", "tutorial", "plano", "aparencia", "conquistas", "retrospectiva", "ajuda", "privacidade", "termos"]) expect(screen.getByTestId(`voce-${id}`)).toBeTruthy();
    expect(screen.queryAllByRole("button", { expanded: false }).length).toBe(0);
    expect(screen.queryAllByRole("button", { expanded: true }).length).toBe(0);
    expect(screen.getByTestId("voce-conta")).toBeTruthy();
    expect(screen.getByTestId("voce-sair")).toBeTruthy();
    expect(screen.queryByTestId("voce-categorias")).toBeNull();
    // no site não há lembretes/computador nem o card de avaliar
    expect(screen.queryByTestId("voce-lembretes")).toBeNull();
    expect(screen.queryByTestId("voce-avaliar")).toBeNull();
  });
  it("no app: 'Avaliar o CORE' é um card PRÓPRIO em destaque, logo abaixo da conta, e usa o fluxo de avaliação de sempre", async () => {
    nativo.v = true;
    await montar();
    const card = screen.getByTestId("voce-avaliar");
    expect(card.textContent).toContain("Gostando do CORE?");
    expect(card.textContent).toContain("Avalie na App Store");
    // vem antes das seções (sozinho)
    expect(card.compareDocumentPosition(screen.getByTestId("voce-secoes")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("voce-secao-ajuda").textContent).not.toContain("Avaliar");
    fireEvent.click(card);
    expect(avaliar.chamadas).toEqual(["voce"]);
    expect(eventos.some(([e]) => e === "voce_avaliar_card")).toBe(true);
    expect(screen.getByTestId("voce-lembretes")).toBeTruthy();
  });
  it("uma linha abre a subpágina EMPILHANDO (state.push = ios) e a subpágina entra com a transição de push, com a borda de voltar", async () => {
    await montar();
    fireEvent.click(screen.getByTestId("voce-personalizar-inicio"));
    await waitFor(() => expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/voce/inicio"));
    expect(screen.getByTestId("sonda").getAttribute("data-push")).toBe(PUSH_IOS);
    const pagina = screen.getByTestId("tela-personalizar-inicio").closest("[data-transicao]");
    expect(pagina?.getAttribute("data-transicao")).toBe("push");
    expect(screen.getByTestId("pt-borda-voltar")).toBeTruthy();
    expect(_empilhadas()).toBe(1);
    // Conquistas é aba (não empilha)
  });
  it("Aparência com a chave: no estilo da E (título grande, painel no card, ← volta)", async () => {
    await montar("/voce/aparencia");
    const tela = screen.getByTestId("tela-aparencia");
    expect(tela.classList.contains("he")).toBe(true);
    expect(within(tela).getByRole("heading", { level: 1 }).textContent).toBe("Aparência");
    expect(within(tela).getByLabelText("Voltar")).toBeTruthy();
  });
  it("5 toques seguidos na versão alternam o vidro 'Cal AI' (classe no html + chave do aparelho + aviso)", async () => {
    await montar();
    const versao = screen.getByTestId("voce-versao");
    for (let i = 0; i < 5; i++) fireEvent.click(versao);
    expect(document.documentElement.classList.contains(CLASSE_VIDRO_CALAI)).toBe(true);
    expect(localStorage.getItem(CHAVE_VIDRO_CALAI)).toBe("on");
    expect(toasts.at(-1)).toMatch(/Cal AI/);
    for (let i = 0; i < 5; i++) fireEvent.click(versao);
    expect(document.documentElement.classList.contains(CLASSE_VIDRO_CALAI)).toBe(false);
    expect(vidroCalaiLigado()).toBe(false);
  });
});

describe("a navegação empilhada (lib/navegacao-ios)", () => {
  it("modoDeEntrada: push quando a rota pede; POP de uma empilhada = pop; outra navegação zera a pilha; idempotente por chave", () => {
    expect(modoDeEntrada("a", true, "PUSH")).toBe("push");
    expect(modoDeEntrada("a", true, "PUSH")).toBe("push"); // StrictMode: a mesma chave 2x não empilha 2x
    expect(_empilhadas()).toBe(1);
    expect(modoDeEntrada("b", false, "POP")).toBe("pop");
    expect(_empilhadas()).toBe(0);
    expect(modoDeEntrada("c", false, "POP")).toBeNull(); // pop sem pilha: troca comum
    expect(modoDeEntrada("d", true, "PUSH")).toBe("push");
    expect(modoDeEntrada("e", false, "PUSH")).toBeNull(); // saiu por outro caminho: zera
    expect(_empilhadas()).toBe(0);
  });
  it("a força de QA ?vidro=calai liga (e guarda); ?vidro=atual desliga; sem o parâmetro aplica o guardado", () => {
    guardarForcaVidro("?vidro=calai");
    expect(document.documentElement.classList.contains(CLASSE_VIDRO_CALAI)).toBe(true);
    expect(localStorage.getItem(CHAVE_VIDRO_CALAI)).toBe("on");
    guardarForcaVidro("?vidro=atual");
    expect(document.documentElement.classList.contains(CLASSE_VIDRO_CALAI)).toBe(false);
    localStorage.setItem(CHAVE_VIDRO_CALAI, "on");
    guardarForcaVidro("?x=1");
    expect(document.documentElement.classList.contains(CLASSE_VIDRO_CALAI)).toBe(true);
    aplicarVidroCalai(false);
  });
});

describe("Personalizar início › Resumos com prévia", () => {
  it("a prévia dos 3 cards como na Home, a lista com interruptor + posição, máximo de 3, e uma linha de explicação", async () => {
    const n = await montar("/voce/inicio");
    const previa = screen.getByTestId("pi-resumos-previa");
    expect(within(previa).getAllByTestId("he-metrica").map((c) => c.getAttribute("data-metrica"))).toEqual(["habitos", "agua", "refeicoes"]);
    expect(screen.getByTestId("pi-resumos").textContent).toContain("na ordem em que você escolhe");
    const lista = screen.getByTestId("pi-resumos-lista");
    expect(within(lista).getAllByRole("switch").length).toBe(7);
    expect(screen.getByTestId("resumo-habitos").getAttribute("data-ligado")).toBe("1");
    expect(within(screen.getByTestId("resumo-refeicoes")).getByLabelText("posição 3")).toBeTruthy();
    expect((within(screen.getByTestId("resumo-sono")).getByRole("switch") as HTMLButtonElement).disabled).toBe(true); // já tem 3
    fireEvent.click(within(screen.getByTestId("resumo-refeicoes")).getByRole("switch"));
    await waitFor(() => expect(n.ler<string[]>("core-home-resumos")).toEqual(["habitos", "agua"]));
    fireEvent.click(within(screen.getByTestId("resumo-sono")).getByRole("switch"));
    await waitFor(() => expect(n.ler<string[]>("core-home-resumos")).toEqual(["habitos", "agua", "sono"]));
    await waitFor(() => expect(within(screen.getByTestId("pi-resumos-previa")).getAllByTestId("he-metrica").map((c) => c.getAttribute("data-metrica"))).toEqual(["habitos", "agua", "sono"]));
    expect(within(screen.getByTestId("resumo-sono")).getByLabelText("posição 3")).toBeTruthy();
  });
});
