/**
 * "Ficou de ontem" (02/10) — a TELA, com o ciclo inteiro: aparece → toca →
 * FECHA E REABRE e continua certo. Rotina (lista de hoje) e Home (widget
 * Tarefas de hoje, que junta Rotina e Carreira).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { TarefasDeHoje } from "@/components/tarefas/tarefas-do-dia";
import { TasksWidget } from "@/components/home/widgets/TasksWidget";
import type { TarefaDoDia } from "@/lib/tarefas";

const eventos = vi.hoisted(() => [] as Array<[string, unknown]>);
const desfazeres = vi.hoisted(() => [] as Array<{ texto: string; desfazer: () => void }>);
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, p?: unknown) => { eventos.push([n, p]); },
  markActivation: vi.fn(),
}));
vi.mock("@/lib/desfazer", () => ({ avisarApagado: (texto: string, desfazer: () => void) => { desfazeres.push({ texto, desfazer }); } }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false, plataformaApp: () => "web" }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "uid-1" }, session: null, loading: false, isSubscribed: true, subLoaded: true }) }));

beforeAll(() => {
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
});
beforeEach(() => {
  eventos.length = 0;
  desfazeres.length = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 2, 10, 0)); // sexta, 02/10, 10:00
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const HOJE = "2026-10-02";
const t = (id: string, texto: string, dia: string, extra: Partial<TarefaDoDia> = {}): TarefaDoDia => ({ id, texto, feito: false, dia, ...extra });

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = JSON.parse(JSON.stringify(inicial));
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true,
    isGuest: false,
    fetchKey: async () => null,
  };
  return { dados, valor };
};
type Store = ReturnType<typeof criarStore>;
const lista = (s: Store, chave = "rotina-day-tasks") => s.dados[chave] as TarefaDoDia[];

const Rotina = ({ store }: { store: Store }) => (
  <MemoryRouter><UserDataContext.Provider value={store.valor}><TarefasDeHoje chave="rotina-day-tasks" onde="Rotina" /></UserDataContext.Provider></MemoryRouter>
);
const Home = ({ store }: { store: Store }) => (
  <MemoryRouter><UserDataContext.Provider value={store.valor}><TasksWidget /></UserDataContext.Provider></MemoryRouter>
);
const bloco = () => screen.queryByTestId("ficou-de-ontem");

describe("Rotina: o bloco no topo da lista de hoje", () => {
  it("uma tarefa que ficou: aparece com as 3 saídas, avisa a vista; TRAZER leva pra hoje — e REABRIR continua certo", () => {
    const store = criarStore({ "rotina-day-tasks": [t("a", "Ligar pro fornecedor", "2026-10-01", { hora: "15:00", detalhes: "Falar com a Rita" })] });
    const { unmount } = render(<Rotina store={store} />);
    const b = within(bloco()!);
    expect(bloco()).toHaveTextContent("FICOU DE ONTEM");
    expect(b.getByTestId("ficou-contagem")).toHaveTextContent("1 pendente");
    expect(bloco()).toHaveTextContent("ONTEM");
    expect(bloco()).toHaveTextContent("qui 01/10");
    expect(bloco()).toHaveTextContent("Ligar pro fornecedor");
    expect(bloco()).toHaveTextContent("15:00");
    expect(bloco()).toHaveTextContent("Falar com a Rita");
    expect(b.getByRole("button", { name: /Trazer pra hoje/ })).toBeInTheDocument();
    expect(b.getByRole("button", { name: /Concluir/ })).toBeInTheDocument();
    expect(b.getByRole("button", { name: /Apagar/ })).toBeInTheDocument();
    expect(b.queryByTestId("trazer-todas")).not.toBeInTheDocument(); // com 1 só, não tem lote
    expect(eventos.filter(([n]) => n === "tarefa_ficou_ontem_vista")).toEqual([["tarefa_ficou_ontem_vista", { n: 1 }]]);
    // a lista de hoje ainda não tem a tarefa
    expect(screen.getByTestId("tarefas-de-hoje")).toHaveTextContent("Nenhuma tarefa hoje ainda");

    fireEvent.click(b.getByRole("button", { name: /Trazer pra hoje/ }));
    expect(bloco()).not.toBeInTheDocument();
    const hoje = within(screen.getByTestId("tarefas-de-hoje"));
    expect(hoje.getByText("Ligar pro fornecedor")).toBeInTheDocument();
    expect(screen.getByTestId("tarefas-de-hoje")).toHaveTextContent("veio de 01/10");
    expect(screen.getByTestId("tarefas-de-hoje")).toHaveTextContent("15:00"); // mantém o horário
    expect(lista(store)[0]).toMatchObject({ id: "a", dia: HOJE, veioDe: "2026-10-01", hora: "15:00", detalhes: "Falar com a Rita", feito: false });
    expect(eventos).toContainEqual(["tarefa_ficou_ontem_acao", { acao: "trazer" }]);

    // sai do módulo e REABRE: a tarefa está em hoje, o bloco não volta
    unmount();
    render(<Rotina store={store} />);
    expect(bloco()).not.toBeInTheDocument();
    expect(screen.getByTestId("tarefas-de-hoje")).toHaveTextContent("Ligar pro fornecedor");
  });

  it("várias, de dias diferentes: agrupadas ('ONTEM', 'HÁ 3 DIAS') e 'Trazer todas pra hoje' leva tudo", () => {
    const store = criarStore({
      "rotina-day-tasks": [
        t("a", "Pagar a luz", "2026-10-01"),
        t("b", "Marcar dentista", "2026-10-01", { hora: "09:00" }),
        t("c", "Trocar a lâmpada", "2026-09-29"),
        t("d", "Já feita", "2026-10-01", { feito: true }),
        t("e", "Antiga demais", "2026-09-20"),
      ],
    });
    const { unmount } = render(<Rotina store={store} />);
    expect(screen.getByTestId("ficou-contagem")).toHaveTextContent("3 pendentes");
    expect(screen.getByTestId("grupo-1")).toHaveTextContent("ONTEM");
    expect(screen.getByTestId("grupo-3")).toHaveTextContent("HÁ 3 DIAS");
    expect(screen.getByTestId("grupo-3")).toHaveTextContent("ter 29/09");
    // dentro de ontem, a com hora vem primeiro
    expect(within(screen.getByTestId("grupo-1")).getAllByTestId("item-ficou")[0]).toHaveTextContent("Marcar dentista");
    expect(bloco()).not.toHaveTextContent("Já feita");
    expect(bloco()).not.toHaveTextContent("Antiga demais");

    fireEvent.click(screen.getByTestId("trazer-todas"));
    expect(bloco()).not.toBeInTheDocument();
    const dia = (id: string) => lista(store).find((x) => x.id === id)!;
    expect(dia("a").dia).toBe(HOJE);
    expect(dia("b").dia).toBe(HOJE);
    expect(dia("c")).toMatchObject({ dia: HOJE, veioDe: "2026-09-29" });
    expect(dia("d").dia).toBe("2026-10-01"); // a feita não foi mexida
    expect(dia("e").dia).toBe("2026-09-20"); // a muito antiga também não
    expect(eventos).toContainEqual(["tarefa_ficou_ontem_acao", { acao: "trazer_todas" }]);
    unmount();
    render(<Rotina store={store} />);
    expect(bloco()).not.toBeInTheDocument();
    expect(within(screen.getByTestId("tarefas-de-hoje")).getAllByTestId("linha-tarefa")).toHaveLength(3);
  });

  it("CONCLUIR: marca feita no dia em que era; não aparece na lista de hoje nem volta ao reabrir", () => {
    const store = criarStore({ "rotina-day-tasks": [t("a", "Comprar pão", "2026-10-01"), t("b", "Passear com o cachorro", "2026-10-01")] });
    const { unmount } = render(<Rotina store={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Concluir: Comprar pão" }));
    expect(lista(store).find((x) => x.id === "a")).toMatchObject({ feito: true, dia: "2026-10-01" });
    expect(bloco()).not.toHaveTextContent("Comprar pão");
    expect(bloco()).toHaveTextContent("Passear com o cachorro");
    expect(screen.getByTestId("tarefas-de-hoje")).not.toHaveTextContent("Comprar pão");
    expect(eventos).toContainEqual(["tarefa_ficou_ontem_acao", { acao: "concluir" }]);
    unmount();
    render(<Rotina store={store} />);
    expect(bloco()).not.toHaveTextContent("Comprar pão");
    expect(screen.getByTestId("tarefas-de-hoje")).not.toHaveTextContent("Comprar pão");
  });

  it("APAGAR: some, e o Desfazer devolve só ela", () => {
    const store = criarStore({ "rotina-day-tasks": [t("a", "Comprar pão", "2026-10-01"), t("b", "Passear com o cachorro", "2026-10-01")] });
    render(<Rotina store={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Apagar: Comprar pão" }));
    expect(lista(store).map((x) => x.id)).toEqual(["b"]);
    expect(bloco()).not.toHaveTextContent("Comprar pão");
    expect(eventos).toContainEqual(["tarefa_ficou_ontem_acao", { acao: "apagar" }]);
    expect(desfazeres).toHaveLength(1);
    act(() => desfazeres[0].desfazer());
    expect(lista(store).map((x) => x.id).sort()).toEqual(["a", "b"]);
    expect(bloco()).toHaveTextContent("Comprar pão");
  });

  it("DESFAZER do 'trazer' manda a tarefa de volta pro dia dela", () => {
    const store = criarStore({ "rotina-day-tasks": [t("a", "Comprar pão", "2026-10-01")] });
    render(<Rotina store={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Trazer pra hoje: Comprar pão" }));
    expect(lista(store)[0].dia).toBe(HOJE);
    act(() => desfazeres[0].desfazer());
    expect(lista(store)[0]).toEqual(t("a", "Comprar pão", "2026-10-01"));
    expect(bloco()).toHaveTextContent("Comprar pão");
  });

  it("some quando vazio: sem pendência (ou só feita/de hoje/antiga) não há bloco nem evento", () => {
    const store = criarStore({ "rotina-day-tasks": [t("a", "Feita", "2026-10-01", { feito: true }), t("b", "De hoje", HOJE), t("c", "Velha", "2026-09-01")] });
    render(<Rotina store={store} />);
    expect(bloco()).not.toBeInTheDocument();
    expect(eventos.filter(([n]) => n === "tarefa_ficou_ontem_vista")).toEqual([]);
    expect(screen.getByTestId("tarefas-de-hoje")).toHaveTextContent("De hoje");
  });

  it("a tarefa repetida que já está em hoje não aparece de novo em 'ficou de ontem'", () => {
    const store = criarStore({ "rotina-day-tasks": [t("a", "Tomar vitamina", "2026-10-01"), t("b", "Tomar vitamina", "2026-09-30"), t("h", "Tomar vitamina", HOJE)] });
    render(<Rotina store={store} />);
    expect(bloco()).not.toBeInTheDocument();
  });

  it("mais de 5: mostra 5 e 'Ver as outras N'", () => {
    const muitas = Array.from({ length: 8 }, (_, i) => t(`m${i}`, `Tarefa ${i + 1}`, "2026-10-01"));
    const store = criarStore({ "rotina-day-tasks": muitas });
    render(<Rotina store={store} />);
    expect(screen.getAllByTestId("item-ficou")).toHaveLength(5);
    fireEvent.click(screen.getByTestId("ficou-ver-mais"));
    expect(screen.getAllByTestId("item-ficou")).toHaveLength(8);
    expect(screen.getByTestId("ficou-contagem")).toHaveTextContent("8 pendentes");
  });

  it("o formato da lista não muda: id, texto, feito, dia (+ campos opcionais de sempre) — chave sincronizada nunca muda de tipo", () => {
    const store = criarStore({ "rotina-day-tasks": [t("a", "Ligar", "2026-10-01", { hora: "10:00", aviso: 0 })] });
    render(<Rotina store={store} />);
    fireEvent.click(screen.getByRole("button", { name: /Trazer pra hoje/ }));
    expect(Array.isArray(store.dados["rotina-day-tasks"])).toBe(true);
    const tarefa = lista(store)[0];
    expect(Object.keys(tarefa).sort()).toEqual(["aviso", "dia", "feito", "hora", "id", "texto", "veioDe"]);
    expect(typeof tarefa.dia).toBe("string");
  });
});

describe("Home: widget Tarefas de hoje (Rotina + Carreira)", () => {
  it("junta as duas listas no bloco; trazer põe a tarefa na lista do widget; reabrir mantém", () => {
    const store = criarStore({
      "rotina-day-tasks": [t("r1", "Pagar o boleto", "2026-10-01")],
      "career-day-tasks": [t("c1", "Mandar o relatório", "2026-09-30", { hora: "14:00" })],
    });
    const { unmount } = render(<Home store={store} />);
    expect(screen.getByTestId("ficou-contagem")).toHaveTextContent("2 pendentes");
    expect(bloco()).toHaveTextContent("Pagar o boleto");
    expect(bloco()).toHaveTextContent("Mandar o relatório");
    expect(bloco()).toHaveTextContent("HÁ 2 DIAS");
    // o bloco aparece mesmo sem nenhuma tarefa de hoje
    expect(screen.getByTestId("tasks-vazio")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Trazer pra hoje: Mandar o relatório" }));
    expect(lista(store, "career-day-tasks")[0]).toMatchObject({ dia: HOJE, veioDe: "2026-09-30", hora: "14:00" });
    expect(lista(store, "rotina-day-tasks")[0].dia).toBe("2026-10-01"); // a outra lista não foi tocada
    expect(screen.getByTestId("tasks-widget")).toHaveTextContent("veio de 30/09");

    unmount();
    render(<Home store={store} />);
    expect(screen.getByTestId("tasks-widget")).toHaveTextContent("veio de 30/09");
    expect(bloco()).toHaveTextContent("Pagar o boleto"); // a que não foi trazida segue esperando a decisão
  });

  it("'Trazer todas' no widget leva as das DUAS listas, cada uma na sua; reabrir mostra as duas em hoje", () => {
    const store = criarStore({
      "rotina-day-tasks": [t("r1", "Pagar o boleto", "2026-10-01"), t("r2", "Lavar o carro", "2026-10-01")],
      "career-day-tasks": [t("c1", "Mandar o relatório", "2026-09-30")],
    });
    const { unmount } = render(<Home store={store} />);
    fireEvent.click(screen.getByTestId("trazer-todas"));
    expect(lista(store).every((x) => x.dia === HOJE)).toBe(true);
    expect(lista(store, "career-day-tasks")[0].dia).toBe(HOJE);
    expect(bloco()).not.toBeInTheDocument();
    unmount();
    render(<Home store={store} />);
    expect(bloco()).not.toBeInTheDocument();
    expect(screen.getByTestId("contagem-tarefas")).toHaveTextContent("0/3 feitas");
  });
});
