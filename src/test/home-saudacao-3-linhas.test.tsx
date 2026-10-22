/**
 * B4 (1.0.18, QA 21/10): a saudação da Home com um livro cadastrado à noite — `Que tal ler um pouco de "Dom
 * casmurro"? 📖` — quebrava com o 📖 sozinho numa 3ª linha, e ao rolar o rótulo "AÇÕES RÁPIDAS" aparecia por baixo do
 * emoji. O jsdom não faz layout: o que este arquivo trava é (1) o emoji do fim gruda na palavra anterior (espaço que
 * não quebra: nunca uma linha só com ele) e (2) o subtítulo tem o line-clamp de 2 linhas (a altura do cabeçalho não
 * cresce) — sem mudar nenhum texto.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { GreetingHeader } from "@/components/home/GreetingHeader";
import type { LifeHubData } from "@/hooks/use-life-hub-data";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "uid-1", email: "bia@exemplo.com" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/home/AccountDrawer", () => ({ AccountDrawer: () => null }));
vi.mock("@/components/home/NameEditDialog", () => ({ NameEditDialog: () => null }));

const store: UserDataContextType = { get: <T,>(_k: string, f: T) => f, set: () => {}, loaded: true, isGuest: true, fetchKey: async () => null };
const dados = (extra: Partial<LifeHubData>): LifeHubData => ({
  dayScore: 30, todayWorkoutGroup: null, workoutDone: false, workoutTime: null, caloriesConsumed: 0, caloriesGoal: 2000, mealsLogged: 0, mealsTotal: 0,
  waterGlasses: 0, waterGoal: 8, sleepHours: 7, supplementsTaken: 0, supplementsTotal: 0, currentBook: null, readingProgress: 0, booksReadThisYear: 0,
  tasksCompleted: 0, tasksTotal: 0, habits: [], userName: "Bia", ...extra,
} as unknown as LifeHubData);

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("saudação da Home (B4)", () => {
  it("à noite com livro: o 📖 gruda na palavra anterior (espaço que não quebra) e o subtítulo tem line-clamp-2; o texto é o mesmo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, 19, 30, 0));
    render(<UserDataContext.Provider value={store}><GreetingHeader data={dados({ currentBook: "Dom casmurro" })} /></UserDataContext.Provider>);
    const p = screen.getByTestId("saudacao-subtitulo");
    expect(p.textContent).toBe('Que tal ler um pouco de "Dom casmurro"? 📖');
    expect(p.textContent?.replace(/ /g, " ")).toBe('Que tal ler um pouco de "Dom casmurro"? 📖');
    expect(p).toHaveClass("line-clamp-2");
    expect(p.textContent).not.toMatch(/ \S+$/); // nada solto depois do último espaço comum
  });

  it("as outras frases também: o último pedaço nunca fica sozinho", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, 15, 0, 0)); // tarde: "Hidrate-se! Faltam … 💧"
    render(<UserDataContext.Provider value={store}><GreetingHeader data={dados({ waterGlasses: 2 })} /></UserDataContext.Provider>);
    const p = screen.getByTestId("saudacao-subtitulo");
    expect(p.textContent).toMatch(/^Hidrate-se! /);
    expect(p.textContent).toMatch(/ 💧$/);
  });
});
