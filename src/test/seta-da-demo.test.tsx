/**
 * A SETA ← DOS MÓDULOS NA DEMO (P5, 30/09) — com os módulos DE VERDADE.
 *
 * O achado (auditoria de acessibilidade 28→29/09, achado 10): na demo da web a
 * seta ← do cabeçalho de Treino, Dieta e Saúde levava pro /auth (tela de
 * entrar, e a pessoa nem tem conta) e a de Finanças, Rotina, Metas… pro
 * /comecar (outro funil). Agora ela vai pro MESMO destino do botão de baixo da
 * demo ("Quase lá"), com o item da demo guiada junto, e na Missão encerra a
 * missão do mesmo jeito. Fora da demo (app logado) nada muda: "/home".
 *
 * MÓDULO NOVO (ou um dos três do integrador): uma linha em MODULOS.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { MotionGlobalConfig } from "framer-motion";
import type { ComponentType } from "react";

const analytics = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: analytics.trackEvent,
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(),
}));
const auth = vi.hoisted(() => ({ user: null as null | { id: string; email: string; created_at: string } }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: auth.user, session: null, loading: false, isSubscribed: !!auth.user, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false }));
// Sorteio do A/B da demo guiada: fora do experimento (a demo de hoje). A Missão
// entra só pelo braço na URL (guia=1), como no QA.
vi.mock("@/lib/demo-guiada-braco", async (orig) => ({
  ...(await orig<typeof import("@/lib/demo-guiada-braco")>()),
  sortearBracoDaDemo: () => null,
}));

import Preview from "@/pages/Preview";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { esquecerMissao, estadoDaMissao } from "@/lib/demo-guiada";
import { TooltipProvider } from "@/components/ui/tooltip";

type Modulo = { chave: string; rota: string; carregar: () => Promise<{ default: ComponentType }> };

/** Módulos com a seta no `useVoltarDoModulo` (src/lib/volta-da-demo.tsx). */
const MODULOS: Modulo[] = [
  { chave: "financas", rota: "/financas", carregar: () => import("@/pages/Index") },
  { chave: "rotina", rota: "/rotina", carregar: () => import("@/pages/Rotina") },
  { chave: "treino", rota: "/treino", carregar: () => import("@/pages/Treino") },
  { chave: "dieta", rota: "/dieta", carregar: () => import("@/pages/Dieta") },
  { chave: "saude", rota: "/saude", carregar: () => import("@/pages/Saude") },
  { chave: "desenvolvimento", rota: "/desenvolvimento", carregar: () => import("@/pages/DesenvolvimentoPessoal") },
  { chave: "casa", rota: "/casa", carregar: () => import("@/pages/Casa") },
  { chave: "estudos", rota: "/estudos", carregar: () => import("@/pages/Estudos") },
  { chave: "biblioteca", rota: "/biblioteca", carregar: () => import("@/pages/Biblioteca") },
  { chave: "viagens", rota: "/viagens", carregar: () => import("@/pages/Viagens") },
  { chave: "carreira", rota: "/carreira", carregar: () => import("@/pages/Carreira") },
  { chave: "hiperfoco", rota: "/hiperfoco", carregar: () => import("@/pages/Hiperfoco") }, // "mente" é o mesmo componente
  { chave: "detox", rota: "/detox", carregar: () => import("@/pages/Detox") },
];

/** Em reescrita por outro agente (30/09): quem integrar troca a seta pelo hook e
 *  MOVE a linha pra MODULOS, ex.: { chave: "pet", rota: "/pet", carregar: () => import("@/pages/Pet") }. */
const O_INTEGRADOR_APLICA = ["pet", "relacionamentos", "beleza"];

MotionGlobalConfig.skipAnimations = true;
beforeAll(() => {
  // a barra de módulos da demo mede a própria altura; jsdom não tem ResizeObserver nem rolagem
  if (!("ResizeObserver" in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  }
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  Element.prototype.scrollIntoView = () => {};
});

/** Como no App: cada caminho é uma página nova; qualquer saída da demo cai em "fora". */
const Rotas = ({ pagina }: { pagina?: { rota: string; Componente: ComponentType } }) => {
  const location = useLocation();
  return (
    <>
      <Routes location={location} key={location.pathname}>
        <Route path="/preview/:moduleKey" element={<Preview />} />
        {pagina && <Route path={pagina.rota} element={<pagina.Componente />} />}
        <Route path="*" element={<p data-testid="fora">fora</p>} />
      </Routes>
      <p data-testid="url">{location.pathname + location.search}</p>
    </>
  );
};

const montar = (url: string, pagina?: { rota: string; Componente: ComponentType }, dados?: UserDataContextType) => {
  const arvore = (
    <TooltipProvider>
      <MemoryRouter initialEntries={[url]}><Rotas pagina={pagina} /></MemoryRouter>
    </TooltipProvider>
  );
  return render(dados ? <UserDataContext.Provider value={dados}>{arvore}</UserDataContext.Provider> : arvore);
};

/** A seta ← do cabeçalho do módulo (todo módulo usa o ArrowLeft do lucide no <header>). */
const acharSeta = () =>
  waitFor(() => {
    const botao = document.querySelector("header svg.lucide-arrow-left")?.closest("button");
    if (!botao) throw new Error("seta ← do cabeçalho ainda não montou");
    return botao as HTMLButtonElement;
  }, { timeout: 12_000 });

/** O botão de baixo da demo (a faixa fixa z-70: "Quase lá" no funil, "Criar conta" fora dele). */
const botaoDeBaixo = () => {
  const a = document.querySelector(".z-\\[70\\] a");
  if (!a) throw new Error("botão de baixo da demo não está na tela");
  return a as HTMLAnchorElement;
};
const url = () => screen.getByTestId("url").textContent;
const eventos = (nome: string) => analytics.trackEvent.mock.calls.filter((c) => c[0] === nome).map((c) => c[1]);

/** Conta logada em memória (o app de verdade, sem rede). */
const contaEmMemoria = (): UserDataContextType => {
  const dados: Record<string, unknown> = {};
  return {
    get: (<T,>(k: string, f: T) => (k in dados ? (dados[k] as T) : f)) as UserDataContextType["get"],
    set: (k: string, v: unknown) => { dados[k] = v; },
    loaded: true,
    isGuest: false,
    fetchKey: async () => null,
  };
};

const DEMO = "?funnel=1&tour=vida&from=dia14";
const VOLTA_DO_DIA14 = "/inicio?step=signup&porta=vida";
const C_CAFE = "c=gasto%7CCaf%C3%A9%7C12";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  esquecerMissao();
  auth.user = null;
  analytics.trackEvent.mockClear();
});
afterEach(cleanup);

describe("na demo, a seta ← vai pro MESMO destino do botão de baixo", () => {
  it.each(MODULOS)("$chave", async ({ chave }) => {
    montar(`/preview/${chave}${DEMO}`);
    const seta = await acharSeta();
    const destino = botaoDeBaixo().getAttribute("href");
    expect(botaoDeBaixo().textContent).toMatch(/Quase lá/);
    expect(destino).toBe(VOLTA_DO_DIA14);
    act(() => { fireEvent.click(seta); });
    await screen.findByTestId("fora");
    expect(url()).toBe(destino);
    expect(eventos("funnel_click")).toContainEqual({ cta: "demo_seta_voltar", module: chave });
  });

  for (const chave of O_INTEGRADOR_APLICA) {
    it.todo(`${chave} — o integrador troca a seta pelo useVoltarDoModulo e move a linha pra MODULOS`);
  }
});

describe("demo guiada", () => {
  it("com o item anotado (c=): a seta leva o item junto, igual ao 'Quase lá'", async () => {
    montar(`/preview/financas${DEMO}&guia=1&${C_CAFE}`);
    const seta = await acharSeta();
    const destino = botaoDeBaixo().getAttribute("href");
    expect(destino).toBe(`${VOLTA_DO_DIA14}&${C_CAFE}`);
    act(() => { fireEvent.click(seta); });
    await screen.findByTestId("fora");
    expect(url()).toBe(destino);
    expect(eventos("funnel_click")).toContainEqual({ cta: "demo_seta_voltar", module: "financas", guia: "on" });
  });

  it("no meio da Missão: a seta encerra a missão como o 'Quase lá' (e diz que foi pela seta)", async () => {
    montar(`/preview/treino${DEMO}&guia=1`);
    await screen.findByTestId("demo-guia-faixa", {}, { timeout: 12_000 });
    const seta = await acharSeta();
    // 30/09: no começo da missão o botão de baixo está na TRAVA SUAVE ("1 toque e é
    // seu →", sem link) — a seta não trava: sai direto pro destino do "Quase lá"
    expect(screen.getByTestId("demo-cta-travado")).toBeTruthy();
    act(() => { fireEvent.click(seta); });
    await screen.findByTestId("fora");
    expect(url()).toBe(VOLTA_DO_DIA14);
    expect(estadoDaMissao().fim).toBe("quase_la");
    expect(eventos("demo_guia_pular")).toContainEqual(expect.objectContaining({ motivo: "quase_la", via: "seta", modulo: "treino", guia: "on" }));
    expect(eventos("funnel_click")).toContainEqual({ cta: "demo_seta_voltar", module: "treino", guia: "on" });
  });

  it("o 'Quase lá' continua medindo igual ao de antes (sem `via` no pulo)", async () => {
    montar(`/preview/treino${DEMO}&guia=1`);
    await screen.findByTestId("demo-guia-faixa", {}, { timeout: 12_000 });
    // 30/09: o 1º toque no botão de baixo é a trava suave (reacende a missão, não sai);
    // o 2º é o "Quase lá" de sempre — e é ele que precisa medir igual ao de antes
    act(() => { fireEvent.click(screen.getByTestId("demo-cta-travado")); });
    const quaseLa = await waitFor(() => botaoDeBaixo());
    act(() => { fireEvent.click(quaseLa); });
    await screen.findByTestId("fora");
    expect(url()).toBe(VOLTA_DO_DIA14);
    expect(estadoDaMissao().fim).toBe("quase_la");
    const pulo = eventos("demo_guia_pular").find((e) => e.motivo === "quase_la");
    expect(pulo).toBeTruthy();
    expect(pulo).not.toHaveProperty("via");
    expect(eventos("funnel_click")).toContainEqual({ cta: "demo_quase_la" });
  });
});

describe("outras portas da demo", () => {
  it("o funil que deixou a volta marcada (core-demo-volta): seta e botão vão pra ela", async () => {
    sessionStorage.setItem("core-demo-volta", "/funil-w?step=compromissos");
    montar("/preview/saude?funnel=1&tour=vida&from=w");
    const seta = await acharSeta();
    expect(botaoDeBaixo().getAttribute("href")).toBe("/funil-w?step=compromissos");
    act(() => { fireEvent.click(seta); });
    await screen.findByTestId("fora");
    expect(url()).toBe("/funil-w?step=compromissos");
  });

  it("demo solta, fora do funil (/preview/dieta): seta e 'Criar conta' de baixo vão pro /comecar", async () => {
    montar("/preview/dieta");
    const seta = await acharSeta();
    expect(botaoDeBaixo().textContent).toMatch(/Criar conta/);
    expect(botaoDeBaixo().getAttribute("href")).toBe("/comecar");
    act(() => { fireEvent.click(seta); });
    await screen.findByTestId("fora");
    expect(url()).toBe("/comecar");
  });
});

describe("no app logado, a seta continua indo pro hub (/home)", () => {
  it.each(MODULOS)("$chave", async ({ rota, carregar }) => {
    auth.user = { id: "u-seta", email: "seta@exemplo.com", created_at: "2026-01-01T00:00:00Z" };
    const { default: Componente } = await carregar();
    montar(rota, { rota, Componente }, contaEmMemoria());
    const seta = await acharSeta();
    act(() => { fireEvent.click(seta); });
    await screen.findByTestId("fora");
    expect(url()).toBe("/home");
    expect(eventos("funnel_click").filter((e) => e.cta === "demo_seta_voltar")).toHaveLength(0);
  });
});
