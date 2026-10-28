/**
 * "VER TUTORIAL" (dono 27/10, vídeo do iPhone + QA do tutorial antigo). Fixtures no formato REAL do user_data:
 * `tutorial-replay-modules` é um array de chaves de módulo (["financas","rotina",…]), igual ao POST do app.
 *  1. o pisca: as linhas do seletor não têm transição CSS de opacidade/transform (só cores) — a entrada é do framer;
 *  2. a fila só vale na abertura em que o tutorial foi pedido (fechar/reabrir no meio não liga holofote sozinho);
 *  3. o fim de um módulo diz o que falta pela FILA (não pelo resto do pivô "só finanças").
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  captureLandingMeta: vi.fn(),
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { SpotlightOverlay, type SpotlightStep } from "@/components/onboarding/SpotlightOverlay";
import { QuickStartOnboarding } from "@/components/onboarding/QuickStartOnboarding";
import { useModuleCompletionFlow } from "@/hooks/use-module-completion-flow";
import { desmarcarTutorialNestaAbertura, marcarTutorialNestaAbertura, tutorialNestaAbertura } from "@/lib/tutorial-abertura";

function criarStore(inicial: Record<string, unknown>) {
  const estado = { dados: { ...inicial } as Record<string, unknown> };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: v }; subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  return { Provedor, estado };
}

const Rota = () => <span data-testid="rota">{useLocation().pathname}</span>;
const PASSO: SpotlightStep[] = [{ selector: '[data-spotlight="alvo"]', label: "Toque aqui" }];
const Modulo = () => (
  <div>
    <button type="button" data-spotlight="alvo">Alvo</button>
    <SpotlightOverlay moduleKey="hiperfoco" steps={PASSO} />
    <Rota />
  </div>
);
const montarModulo = (dados: Record<string, unknown>) => {
  const s = criarStore(dados);
  render(<MemoryRouter initialEntries={["/hiperfoco"]}><s.Provedor><Routes><Route path="*" element={<Modulo />} /></Routes></s.Provedor></MemoryRouter>);
  return s;
};

beforeEach(() => { desmarcarTutorialNestaAbertura(); vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 300, left: 20, width: 200, height: 40, right: 220, bottom: 340, x: 20, y: 300, toJSON: () => ({}) } as DOMRect); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); desmarcarTutorialNestaAbertura(); });

describe("1. seletor de módulos: sem o pisca da entrada", () => {
  it("as linhas animam pelo framer e só as CORES têm transição CSS (transition-all reprisava a opacidade no WebKit)", () => {
    const s = criarStore({});
    render(<MemoryRouter><s.Provedor><QuickStartOnboarding replay aberturaPeloMenu onComplete={() => {}} /></s.Provedor></MemoryRouter>);
    expect(screen.getByText("Vamos começar seu tutorial")).toBeTruthy();
    const linhas = screen.getAllByRole("button").filter((b) => /Finanças|Hábitos|Metas|Detox/.test(b.textContent || ""));
    expect(linhas.length).toBe(4);
    for (const l of linhas) { expect(l.className).not.toMatch(/transition-all/); expect(l.className).toMatch(/transition-colors/); }
  });

  it("aberto pelo menu fala 'ver', não 'rever': Continuar → 'Qual módulo quer ver?' e marca a abertura", async () => {
    const s = criarStore({});
    render(<MemoryRouter><s.Provedor><QuickStartOnboarding replay aberturaPeloMenu onComplete={() => {}} /></s.Provedor></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(await screen.findByText("Qual módulo quer ver?", {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.queryByText(/rever/i)).toBeNull();
    expect(s.estado.dados["tutorial-replay-modules"]).toEqual(["financas", "rotina", "dieta", "metas"]);
    expect(tutorialNestaAbertura()).toBe(true);
    fireEvent.click(screen.getAllByText("Encerrar tutorial")[0]);
    expect(s.estado.dados["tutorial-replay-modules"]).toEqual([]);
    expect(tutorialNestaAbertura()).toBe(false);
  });

  it("fila de uma abertura ANTERIOR não retoma no seletor 'Qual módulo': começa na escolha", () => {
    const s = criarStore({ "tutorial-replay-modules": ["financas", "rotina"] });
    render(<MemoryRouter><s.Provedor><QuickStartOnboarding replay aberturaPeloMenu onComplete={() => {}} /></s.Provedor></MemoryRouter>);
    expect(screen.getByText("Vamos começar seu tutorial")).toBeTruthy();
  });
});

describe("2. reabrir o app no meio: o holofote não liga sozinho", () => {
  it("módulo na fila SEM a marca desta abertura → nada de balão", async () => {
    montarModulo({ "tutorial-replay-modules": ["hiperfoco", "estudos"] });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(document.querySelector("[data-tutorial-balao]")).toBeNull();
  });
  it("com a marca (pedido nesta abertura) → o balão aparece", async () => {
    marcarTutorialNestaAbertura();
    montarModulo({ "tutorial-replay-modules": ["hiperfoco", "estudos"] });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(document.querySelector("[data-tutorial-balao]")?.getAttribute("data-tutorial-modulo")).toBe("hiperfoco");
  });
});

describe("3. fim do módulo: o que falta vem da fila", () => {
  it("com mais módulos na fila: 'Módulo concluído!' e o botão volta pro seletor (/home)", async () => {
    marcarTutorialNestaAbertura();
    const s = montarModulo({ "tutorial-replay-modules": ["hiperfoco", "estudos", "casa"] });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    await act(async () => { fireEvent.click(screen.getByText("Alvo")); await new Promise((r) => setTimeout(r, 400)); });
    expect(screen.getByText("Módulo concluído!")).toBeTruthy();
    expect(screen.getByText("Ainda faltam 2 módulos no seu tutorial.")).toBeTruthy();
    expect(s.estado.dados["tutorial-replay-modules"]).toEqual(["estudos", "casa"]);
    fireEvent.click(screen.getByText("Voltar e ver os outros"));
    expect(screen.getByTestId("rota").textContent).toBe("/home");
  });
  it("último da fila: 'Tutorial concluído!' sem mandar procurar seta", async () => {
    marcarTutorialNestaAbertura();
    montarModulo({ "tutorial-replay-modules": ["hiperfoco"] });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    await act(async () => { fireEvent.click(screen.getByText("Alvo")); await new Promise((r) => setTimeout(r, 400)); });
    expect(screen.getByText(/Tutorial concluído!/)).toBeTruthy();
    expect(screen.queryByText(/canto superior esquerdo/)).toBeNull();
  });

  const Fim = ({ modulo }: { modulo: "financas" | "rotina" }) => { const { onModuleComplete, CompletionDialog } = useModuleCompletionFlow(modulo); return <div>{CompletionDialog}<button onClick={onModuleComplete}>terminar</button><Rota /></div>; };
  it("Finanças com mais 2 na fila (o get ainda vê Finanças): 'faltam 2' e volta pro seletor — antes dizia 'Tudo pronto' e deixava em Finanças", () => {
    const s = criarStore({ "tutorial-replay-modules": ["financas", "rotina", "pet"] });
    render(<MemoryRouter initialEntries={["/financas"]}><s.Provedor><Fim modulo="financas" /></s.Provedor></MemoryRouter>);
    fireEvent.click(screen.getByText("terminar"));
    expect(screen.getByText("Ainda faltam 2 módulos no tutorial.")).toBeTruthy();
    expect(screen.getByText("Pendentes: Hábitos, Pet")).toBeTruthy();
    fireEvent.click(screen.getByText("Voltar e terminar os outros"));
    expect(screen.getByTestId("rota").textContent).toBe("/home");
  });
  it("Hábitos sozinho na fila: 'Tudo pronto!' (antes cobrava Finanças, que nem estava na fila)", () => {
    const s = criarStore({ "tutorial-replay-modules": ["rotina"] });
    render(<MemoryRouter initialEntries={["/rotina"]}><s.Provedor><Fim modulo="rotina" /></s.Provedor></MemoryRouter>);
    fireEvent.click(screen.getByText("terminar"));
    expect(screen.getByText("Tudo pronto! 🎉")).toBeTruthy();
    expect(screen.queryByText(/Finanças/)).toBeNull();
  });
});
