/**
 * TIMER DE FOCO da Home (28/09): usa o tempo escolhido no Pomodoro (era fixo
 * em 25), conta no relógio de parede (não congela com a tela travada) e o foco
 * feito aqui entra no "foco do mês" das insígnias (`pomodoro-log`).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { FocusTimerWidget } from "@/components/home/widgets/FocusTimerWidget";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isSubscribed: true, user: null }) }));
const toasts: string[] = [];
vi.mock("sonner", () => ({ toast: { success: (m: string) => { toasts.push(m); }, error: () => {} } }));

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
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}><FocusTimerWidget /></UserDataContext.Provider></MemoryRouter>);

afterEach(() => { vi.useRealTimers(); toasts.length = 0; });

describe("Timer de foco da Home", () => {
  it("segue o tempo escolhido no Pomodoro (45 min), não o 25 fixo", () => {
    renderizar(criarStore({ "pomodoro-duracoes": { focus: 45, break: 5, longBreak: 15 } }));
    expect(screen.getByTestId("widget-foco-tempo")).toHaveTextContent("45:00");
    expect(screen.getByTestId("widget-foco")).toHaveTextContent(/45 min/);
  });

  it("sem escolha salva, 25 min como antes", () => {
    renderizar(criarStore());
    expect(screen.getByTestId("widget-foco-tempo")).toHaveTextContent("25:00");
  });

  it("concluir grava o foco do dia (insígnias), o total e a sessão, e volta pro tempo cheio", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 28, 10, 0) });
    const store = criarStore({ "pomodoro-duracoes": { focus: 15, break: 5, longBreak: 15 }, "pomodoro-total-focus": 100 });
    renderizar(store);
    fireEvent.click(screen.getByRole("button", { name: "Começar o foco" }));
    act(() => { vi.advanceTimersByTime(15 * 60 * 1000 + 1000); });
    expect(store.dados["pomodoro-log"]).toEqual({ "2026-09-28": 15 });
    expect(store.dados["pomodoro-total-focus"]).toBe(115);
    expect(store.dados["pomodoro-sessions-dia"]).toBe("2026-09-28");
    expect(store.dados["pomodoro-sessions-today"]).toBe(1);
    expect(toasts).toEqual(["Foco de 15 min concluído"]);
    expect(screen.getByTestId("widget-foco-tempo")).toHaveTextContent("15:00");
  });

  it("tela travada (relógio anda sem tique): ao voltar, o mostrador alcança o tempo real", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 28, 10, 0), toFake: ["Date"] });
    renderizar(criarStore());
    fireEvent.click(screen.getByRole("button", { name: "Começar o foco" }));
    vi.setSystemTime(new Date(2026, 8, 28, 10, 10));
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(screen.getByTestId("widget-foco-tempo")).toHaveTextContent("15:00");
  });
});
