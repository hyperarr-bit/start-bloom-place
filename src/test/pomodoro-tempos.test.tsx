/**
 * Foco (26/09) — chamado do app: "no foco não é possível alterar a quantidade
 * de tempo? Só aparece 25 ou 5". E o "N sessões hoje" nunca zerava: somava
 * desde a primeira sessão da vida.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { PomodoroTimer, diaLocal, minutosValidos } from "@/components/PomodoroTimer";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isSubscribed: true, user: null }) }));

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor };
};
const renderizar = (store: ReturnType<typeof criarStore>) =>
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}><PomodoroTimer /></UserDataContext.Provider></MemoryRouter>);

describe("Foco — tempo ajustável", () => {
  it("escolher 45 min muda o mostrador e fica salvo", () => {
    const store = criarStore();
    renderizar(store);
    expect(screen.getByText("25:00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "45 min" }));
    expect(screen.getByText("45:00")).toBeInTheDocument();
    expect(store.dados["pomodoro-duracoes"]).toMatchObject({ focus: 45, break: 5, longBreak: 15 });
  });

  it("a pausa tem os próprios tempos", () => {
    const store = criarStore({ "pomodoro-duracoes": { focus: 50, break: 5, longBreak: 15 } });
    renderizar(store);
    expect(screen.getByText("50:00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "PAUSA" }));
    fireEvent.click(screen.getByRole("button", { name: "10 min" }));
    expect(screen.getByText("10:00")).toBeInTheDocument();
    expect(store.dados["pomodoro-duracoes"]).toMatchObject({ focus: 50, break: 10 });
  });

  it("com o timer rodando as opções de tempo somem", () => {
    renderizar(criarStore());
    expect(screen.getByTestId("pomodoro-tempos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Iniciar/ }));
    expect(screen.queryByTestId("pomodoro-tempos")).not.toBeInTheDocument();
  });

  it("valor estranho salvo no banco volta pro padrão", () => {
    expect(minutosValidos({ focus: 0, break: -3, longBreak: 999 })).toEqual({ focus: 25, break: 5, longBreak: 15 });
    expect(minutosValidos(null)).toEqual({ focus: 25, break: 5, longBreak: 15 });
  });
});

describe("Foco — sessões de hoje", () => {
  it("contagem de outro dia não aparece como de hoje", () => {
    renderizar(criarStore({ "pomodoro-sessions-today": 37, "pomodoro-sessions-dia": "2026-09-01" }));
    expect(screen.getByText(/0 sessões hoje/)).toBeInTheDocument();
  });

  it("contagem do próprio dia aparece", () => {
    renderizar(criarStore({ "pomodoro-sessions-today": 3, "pomodoro-sessions-dia": diaLocal() }));
    expect(screen.getByText(/3 sessões hoje/)).toBeInTheDocument();
  });
});
