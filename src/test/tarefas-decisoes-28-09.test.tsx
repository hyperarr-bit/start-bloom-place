/**
 * Tarefa com horário — as decisões do dono em 28/09 ("faz"):
 *  1. a ação rápida "Nova Tarefa" da Home abre a folha nova (horário, aviso,
 *     detalhes) e grava nas tarefas de hoje da Rotina — não vira mais urgência;
 *  2. na Rotina, as tarefas de hoje aparecem pra todo mundo; tarefa sozinha não
 *     arrasta mais o bloco de contadores/fechamentos;
 *  6. no site, o formulário avisa que o alarme só toca no app do celular.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { QuickActions } from "@/components/home/QuickActions";
import { FormTarefa, TarefasDeHoje } from "@/components/tarefas/tarefas-do-dia";
import { fasesEmUso } from "@/pages/Rotina";
import { localDayKey } from "@/lib/utils";

const nativo = { v: false };
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => nativo.v, plataformaApp: () => (nativo.v ? "android" : "web") }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "uid-1" }, session: null, loading: false, isSubscribed: true, subLoaded: true }) }));

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
const renderCom = (ui: React.ReactElement, store = criarStore()) => {
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider></MemoryRouter>);
  return store;
};

describe("1. ação rápida 'Nova Tarefa'", () => {
  it("abre a folha com horário/aviso/detalhes e grava na Rotina (não em urgências)", () => {
    const store = renderCom(<QuickActions />);
    fireEvent.click(screen.getByRole("button", { name: /Nova Tarefa/ }));
    expect(screen.getByTestId("folha-nova-tarefa")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("O que precisa fazer"), { target: { value: "Ligar pro fornecedor" } });
    fireEvent.change(screen.getByLabelText("Horário da tarefa"), { target: { value: "23:50" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar tarefa/ }));
    const lista = store.dados["rotina-day-tasks"] as { texto: string; hora?: string; dia: string }[];
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ texto: "Ligar pro fornecedor", hora: "23:50", dia: localDayKey() });
    expect(store.dados["rotina-urgencies"]).toBeUndefined();
    expect(store.dados["todo-list"]).toBeUndefined();
  });
});

describe("2. Rotina: tarefas de hoje pra todo mundo", () => {
  it("tarefa sozinha não liga mais o bloco de fases", () => {
    expect(fasesEmUso([], [{ id: "t", texto: "x", feito: false, dia: "2026-09-28" }], {})).toBe(false);
  });

  it("a lista sozinha mostra as tarefas de hoje e cria pelo +", () => {
    const store = renderCom(<TarefasDeHoje chave="rotina-day-tasks" onde="Rotina" placeholder="Nova tarefa de hoje..." />,
      criarStore({ "rotina-day-tasks": [{ id: "a", texto: "Pagar o boleto", feito: false, dia: localDayKey() }] }));
    expect(screen.getByTestId("tarefas-de-hoje")).toHaveTextContent("Pagar o boleto");
    fireEvent.change(screen.getByPlaceholderText("Nova tarefa de hoje..."), { target: { value: "Comprar pão" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar tarefa" }));
    expect((store.dados["rotina-day-tasks"] as unknown[])).toHaveLength(2);
  });
});

describe("6. no site o alarme não toca", () => {
  it("com horário e aviso, no site aparece o recado; no app não; sem horário, nada", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 28, 10, 0), toFake: ["Date"] }); // 23:50 ainda não passou
    nativo.v = false;
    const { unmount } = render(<FormTarefa inicial={{ texto: "Reunião" }} onSalvar={() => {}} />);
    expect(screen.queryByTestId("aviso-so-no-app")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Horário da tarefa"), { target: { value: "23:50" } });
    expect(screen.getByTestId("aviso-so-no-app")).toHaveTextContent("No site o aviso não toca");
    unmount();

    nativo.v = true;
    render(<FormTarefa inicial={{ texto: "Reunião", hora: "23:50" }} onSalvar={() => {}} />);
    expect(screen.queryByTestId("aviso-so-no-app")).not.toBeInTheDocument();
    nativo.v = false;
    vi.useRealTimers();
  });
});
