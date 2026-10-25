/**
 * 1.0.19 (dono, 25/10) — dois ajustes na Home:
 *  1) o topo é só "Bom dia, Nome 👋": a frase de contexto embaixo ("Hidrate-se! Faltam 2 copos 💧", "Tarde
 *     produtiva!"…) saiu, em qualquer horário;
 *  2) o fogo e os "N dias" na COR DA FAIXA (laranja 1+, vermelho 7+, roxo 14+, azul 30+, dourado 100+), com a cor
 *     de texto do claro (hojeTexto) e a do escuro (hojeTextoEscuro) — nada de laranja fixo. 27 dias = roxo.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { GreetingHeader } from "@/components/home/GreetingHeader";
import { DayScoreRing } from "@/components/home/DayScoreRing";
import { LinhaSequencia } from "@/components/conquistas/LinhaSequencia";
import { faixaDoFogo, type FaixaId } from "@/lib/fogo-sequencia";
import type { Sequencia } from "@/components/conquistas/use-conquistas";
import type { LifeHubData } from "@/hooks/use-life-hub-data";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "uid-1", email: "bia@exemplo.com" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/home/AccountDrawer", () => ({ AccountDrawer: () => null }));
vi.mock("@/components/home/NameEditDialog", () => ({ NameEditDialog: () => null }));

const store: UserDataContextType = { get: <T,>(_k: string, f: T) => f, set: () => {}, loaded: true, isGuest: true, fetchKey: async () => null };
const dados = (extra: Partial<LifeHubData> = {}): LifeHubData => ({
  dayScore: 30, todayWorkoutGroup: null, workoutDone: false, workoutTime: null, caloriesConsumed: 0, caloriesGoal: 2000, mealsLogged: 0, mealsTotal: 0,
  waterGlasses: 0, waterGoal: 8, sleepHours: 7, supplementsTaken: 0, supplementsTotal: 0, currentBook: null, readingProgress: 0, booksReadThisYear: 0,
  tasksCompleted: 0, tasksTotal: 0, habits: [], userName: "Bia Souza", ...extra,
} as unknown as LifeHubData);

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("1) topo da Home sem a frase embaixo da saudação", () => {
  const horarios: [string, number, Partial<LifeHubData>][] = [
    ["madrugada", 3, {}],
    ["manhã", 10, { tasksTotal: 3 }],
    ["almoço", 13, { mealsTotal: 4 }],
    ["tarde com água faltando", 15, { waterGlasses: 2 }],
    ["noite com livro", 19, { currentBook: "Dom casmurro" }],
  ];
  it.each(horarios)("%s: só a saudação com o primeiro nome — sem subtítulo nem frase de contexto", (_n, hora, extra) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, hora, 0, 0));
    const { container } = render(<UserDataContext.Provider value={store}><GreetingHeader data={dados(extra)} /></UserDataContext.Provider>);
    expect(screen.queryByTestId("saudacao-subtitulo")).toBeNull();
    expect(container.querySelector("p")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/^(Boa madrugada|Bom dia|Boa tarde|Boa noite), Bia 👋$/);
    expect(container.textContent).not.toMatch(/Hidrate-se|Dom casmurro|produtiva|almoço|hábito/);
  });
  it("o avatar fica centrado na altura da saudação (linha única: items-center)", () => {
    const { container } = render(<UserDataContext.Provider value={store}><GreetingHeader data={dados()} /></UserDataContext.Provider>);
    const linha = container.firstElementChild as HTMLElement;
    expect(linha).toHaveClass("items-center");
    expect(linha).not.toHaveClass("items-start");
  });
});

const CASOS: [number, FaixaId][] = [[6, "laranja"], [7, "vermelho"], [14, "roxo"], [27, "roxo"], [30, "azul"], [100, "dourado"]];

describe("2) o fogo da Home na cor da faixa", () => {
  it.each(CASOS)("%i dias → %s (faixaDoFogo)", (dias, id) => {
    expect(faixaDoFogo(dias).id).toBe(id);
  });

  it.each(CASOS)("selo do anel com %i dias: fogo e número na faixa %s, claro e escuro", (dias, id) => {
    const f = faixaDoFogo(dias);
    render(<DayScoreRing score={40} streak={dias} />);
    const selo = screen.getByTestId("anel-sequencia");
    expect(selo.dataset.faixa).toBe(id);
    expect(selo.style.getPropertyValue("--sq-c")).toBe(f.hojeTexto);
    expect(selo.style.getPropertyValue("--sq-cd")).toBe(f.hojeTextoEscuro);
    expect(selo.getAttribute("style") ?? "").not.toMatch(/--streak|--warning/);
    const num = screen.getByTestId("anel-sequencia-dias");
    expect(num.textContent).toBe(`${dias} dias`);
    expect(num).toHaveClass("text-[var(--sq-c)]", "dark:text-[var(--sq-cd)]");
    expect(screen.getByTestId("anel-sequencia-fogo").querySelector("svg")?.getAttribute("data-fogo")).toBe(id);
  });

  it("0 dias: sem selo (como antes)", () => {
    render(<DayScoreRing score={40} streak={0} />);
    expect(screen.queryByTestId("anel-sequencia")).toBeNull();
  });

  const seq = (dias: number): Sequencia => ({
    dias, hojeFeito: true, faixa: faixaDoFogo(dias), acao: { texto: "marque um hábito" },
  } as unknown as Sequencia);

  it.each(CASOS)("linha da sequência embaixo do anel com %i dias: fogo e número na faixa %s", (dias, id) => {
    const f = faixaDoFogo(dias);
    render(<MemoryRouter><LinhaSequencia seq={seq(dias)} /></MemoryRouter>);
    expect(screen.getByTestId("linha-sequencia-fogo").querySelector("svg")?.getAttribute("data-fogo")).toBe(id);
    const num = screen.getByTestId("linha-sequencia-dias");
    expect(num.style.getPropertyValue("--dias-c")).toBe(f.hojeTexto);
    expect(num.style.getPropertyValue("--dias-cd")).toBe(f.hojeTextoEscuro);
    expect(num).toHaveClass("text-[var(--dias-c)]", "dark:text-[var(--dias-cd)]");
  });

  it("linha com 0 dias: fogo apagado (cinza)", () => {
    render(<MemoryRouter><LinhaSequencia seq={seq(0)} /></MemoryRouter>);
    expect(screen.getByTestId("linha-sequencia-fogo")).toHaveClass("text-muted-foreground");
  });

  it("27 dias = roxo (o caso do dono)", () => {
    render(<DayScoreRing score={40} streak={27} />);
    expect(screen.getByTestId("anel-sequencia").style.getPropertyValue("--sq-c")).toBe("#7e22ce");
    expect(screen.getByTestId("anel-sequencia").style.getPropertyValue("--sq-cd")).toBe("#C4A6FA");
  });
});
