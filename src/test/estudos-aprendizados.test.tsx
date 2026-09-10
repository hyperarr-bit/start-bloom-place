/**
 * Estudos — "O que aprendi" por curso (09/09).
 *
 * Pedido literal do dono: "Módulo de estudos muito básico, quero melhorar
 * ele. Não tem como acrescentar o que aprendi no curso. Tipo: aprendi isso,
 * esse slide é bom por causa disso."
 *
 * Ciclo completo (regra da casa, 19/07): abre → usa → SAI → REABRE. A
 * página real é montada com o store in-memory, igual ao /preview/estudos —
 * se quebrar a demo do funil, quebra aqui primeiro.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { PreviewUserDataProvider } from "@/hooks/use-preview-user-data";
import { localDayKey } from "@/lib/utils";
import { comoAprendizados, contarNaSemana, filtrarAprendizados, maisRecentesPrimeiro, misturarCursos } from "@/components/estudos/aprendizados";
import Estudos from "@/pages/Estudos";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: false, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...real, trackEvent: () => {}, trackEventBeacon: () => {}, markActivation: async () => {} };
});
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));

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

const montar = (store: ReturnType<typeof criarStore>) =>
  render(
    <MemoryRouter>
      <UserDataContext.Provider value={store.valor}><Estudos /></UserDataContext.Provider>
    </MemoryRouter>,
  );

const diasAtras = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return localDayKey(d); };
const abrirAba = (v: string) => fireEvent.click(document.querySelector(`[data-spotlight="tab-${v}"]`)!);
const resumo = () => screen.getByTestId("resumo-do-modulo");

describe("Aprendizados por curso — ciclo completo", () => {
  it("registra 'aprendi isso, esse slide é bom por causa disso' → aparece no curso e no Caderno → sobrevive a fechar e reabrir", () => {
    const store = criarStore({ "estudos-cursos-andamento": [{ id: "c1", name: "Inglês" }] });
    const tela = montar(store);

    // Curso sem nada: convite, não "0 aprendizados"
    expect(screen.getByRole("button", { name: "Aprendizados de Inglês" })).toHaveTextContent("O que aprendi");

    fireEvent.click(screen.getByRole("button", { name: "Registrar o que aprendi em Inglês" }));
    fireEvent.change(screen.getByLabelText("Referência"), { target: { value: "Aula 12 · slide 8" } });
    fireEvent.change(screen.getByLabelText("O que aprendi"), { target: { value: "Present perfect" } });
    fireEvent.change(screen.getByLabelText("Por que é bom ou como aplicar"), { target: { value: "usar com 'since' e 'for'" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar aprendizado" }));

    // Na linha do curso: contador + a entrada (lista já aberta)
    expect(screen.getByRole("button", { name: "Aprendizados de Inglês" })).toHaveTextContent("1 aprendizado");
    const linha = within(screen.getByTestId("aprendizados-curso-c1"));
    expect(linha.getByText("Present perfect")).toBeInTheDocument();
    expect(linha.getByText(/Aula 12 · slide 8/)).toBeInTheDocument();
    expect(linha.getByText(/usar com 'since' e 'for'/)).toBeInTheDocument();
    // Lápis e lixeira visíveis, sem depender de hover
    expect(linha.getByRole("button", { name: "Editar aprendizado" })).toBeInTheDocument();
    expect(linha.getByRole("button", { name: "Apagar aprendizado" })).toBeInTheDocument();

    // Persistiu na chave própria, com dia LOCAL
    const salvo = store.dados["estudos-aprendizados"] as Record<string, { data: string; aprendi: string }[]>;
    expect(salvo.c1).toHaveLength(1);
    expect(salvo.c1[0].data).toBe(localDayKey());
    // e o array de cursos NÃO foi inflado: continua só id+nome, como nasceu
    expect(store.dados["estudos-cursos-andamento"]).toEqual([{ id: "c1", name: "Inglês" }]);

    // Caderno relê
    abrirAba("caderno");
    expect(within(screen.getByTestId("caderno-aprendizados")).getByText("Present perfect")).toBeInTheDocument();
    expect(within(screen.getByTestId("caderno-aprendizados")).getByText(/Inglês · Aula 12 · slide 8/)).toBeInTheDocument();

    // SAI e REABRE
    tela.unmount();
    montar(store);
    expect(screen.getByRole("button", { name: "Aprendizados de Inglês" })).toHaveTextContent("1 aprendizado");
    abrirAba("caderno");
    expect(within(screen.getByTestId("caderno-aprendizados")).getByText("Present perfect")).toBeInTheDocument();
  });

  it("edita e apaga (apagar pede confirmação em dois toques)", () => {
    const store = criarStore({
      "estudos-cursos-andamento": [{ id: "c1", name: "Inglês" }],
      "estudos-aprendizados": { c1: [{ id: "1", data: diasAtras(0), aprendi: "Present perfect" }] },
    });
    montar(store);
    fireEvent.click(screen.getByRole("button", { name: "Aprendizados de Inglês" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar aprendizado" }));
    fireEvent.change(screen.getByLabelText("O que aprendi"), { target: { value: "Present perfect continuous" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByText("Present perfect continuous")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Apagar aprendizado" }));
    expect(screen.getByText("Present perfect continuous")).toBeInTheDocument(); // 1º toque não apaga
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão do aprendizado" }));
    expect(screen.queryByText("Present perfect continuous")).not.toBeInTheDocument();
    expect((store.dados["estudos-aprendizados"] as Record<string, unknown>).c1).toBeUndefined();
  });
});

describe("Progresso em aulas", () => {
  it("'+1 aula' incrementa e a barra acompanha; registrar aprendizado avança por padrão quando há total", () => {
    const store = criarStore({ "estudos-cursos-andamento": [{ id: "c2", name: "Excel", aulasFeitas: 12, aulasTotal: 30 }] });
    montar(store);
    expect(screen.getByText("Aula 12 de 30")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Progresso de Excel" })).toHaveAttribute("aria-valuenow", "12");

    fireEvent.click(screen.getByRole("button", { name: "Marcar mais uma aula de Excel como feita" }));
    expect(screen.getByText("Aula 13 de 30")).toBeInTheDocument();
    expect((store.dados["estudos-cursos-andamento"] as { aulasFeitas: number }[])[0].aulasFeitas).toBe(13);

    // Registrar aprendizado com "avançar 1 aula" ligado por padrão
    fireEvent.click(screen.getByRole("button", { name: "Registrar o que aprendi em Excel" }));
    const check = screen.getByLabelText("Avançar 1 aula") as HTMLInputElement;
    expect(check.checked).toBe(true);
    fireEvent.change(screen.getByLabelText("O que aprendi"), { target: { value: "Tabela dinâmica" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar aprendizado" }));
    expect(screen.getByText("Aula 14 de 30")).toBeInTheDocument();
  });

  it("sem total: checkbox nasce DESLIGADO e '+1 aula' só conta", () => {
    const store = criarStore({ "estudos-cursos-andamento": [{ id: "c3", name: "Oratória" }] });
    montar(store);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Registrar o que aprendi em Oratória" }));
    expect((screen.getByLabelText("Avançar 1 aula") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar mais uma aula de Oratória como feita" }));
    expect(screen.getByText("1 aula feita")).toBeInTheDocument();
  });

  it("curso legado (só id e nome) renderiza sem 'undefined' nem 'NaN'", () => {
    const store = criarStore({ "estudos-cursos-andamento": [{ id: "velho", name: "Curso antigo", notes: "Aula 3 de 10" }] });
    const { container } = montar(store);
    expect(container.textContent).not.toMatch(/undefined|NaN/);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aprendizados de Curso antigo" })).toHaveTextContent("O que aprendi");
    // a nota antiga continua onde estava
    expect(screen.getByText("Aula 3 de 10")).toBeInTheDocument();
  });
});

describe("Caderno: busca e filtro por curso", () => {
  const store = () => criarStore({
    "estudos-cursos-andamento": [{ id: "c1", name: "Inglês" }, { id: "c2", name: "Excel" }],
    "estudos-aprendizados": {
      c1: [{ id: "1", data: diasAtras(1), referencia: "Unidade 5", aprendi: "Present perfect", porque: "since e for" }],
      c2: [{ id: "2", data: diasAtras(0), referencia: "Aula 12 · slide 3", aprendi: "Tabela dinâmica" }],
    },
  });

  it("mistura os cursos (mais recente primeiro), busca por texto sem acento e filtra por curso", () => {
    montar(store());
    abrirAba("caderno");
    const caderno = within(screen.getByTestId("caderno-aprendizados"));
    const itens = caderno.getAllByTestId("aprendizado");
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent("Tabela dinâmica"); // hoje antes de ontem

    fireEvent.change(caderno.getByLabelText("Buscar aprendizados"), { target: { value: "dinamica" } });
    expect(caderno.getAllByTestId("aprendizado")).toHaveLength(1);
    expect(caderno.queryByText("Present perfect")).not.toBeInTheDocument();

    fireEvent.change(caderno.getByLabelText("Buscar aprendizados"), { target: { value: "" } });
    fireEvent.click(caderno.getByRole("button", { name: "Inglês" }));
    expect(caderno.getAllByTestId("aprendizado")).toHaveLength(1);
    expect(caderno.getByText("Present perfect")).toBeInTheDocument();

    fireEvent.change(caderno.getByLabelText("Buscar aprendizados"), { target: { value: "xyz" } });
    expect(caderno.queryAllByTestId("aprendizado")).toHaveLength(0);
    expect(caderno.getByText(/Nada com "xyz"/)).toBeInTheDocument();
  });

  it("curso apagado não leva os aprendizados junto — aparecem como 'Curso removido'", () => {
    const s = store();
    montar(s);
    fireEvent.click(screen.getByRole("button", { name: "Excluir Excel" }));
    abrirAba("caderno");
    expect(within(screen.getByTestId("caderno-aprendizados")).getByText(/Curso removido · Aula 12/)).toBeInTheDocument();
  });
});

describe("Resumo do topo", () => {
  it("tile 'Aprendizados' conta só a semana corrente e leva pro Caderno", () => {
    const s = criarStore({
      "estudos-cursos-andamento": [{ id: "c1", name: "Inglês" }],
      "estudos-aprendizados": {
        c1: [
          { id: "1", data: diasAtras(0), aprendi: "desta semana" },
          { id: "2", data: diasAtras(10), aprendi: "semana passada" },
          { id: "3", data: diasAtras(40), aprendi: "mês passado" },
        ],
      },
    });
    montar(s);
    const tile = within(resumo()).getByRole("button", { name: /Aprendizados/ });
    expect(tile).toHaveTextContent("1");
    expect(tile).toHaveTextContent("esta semana");
    fireEvent.click(tile);
    expect(document.querySelector('[data-spotlight="tab-caderno"]')).toHaveClass("notion-tab-active");
    expect(screen.getByTestId("caderno-aprendizados")).toBeInTheDocument();
  });

  it("sem aprendizado o tile some (regra do ResumoDoModulo)", () => {
    montar(criarStore({ "estudos-cursos-andamento": [{ id: "c1", name: "Inglês" }] }));
    expect(within(resumo()).queryByText("Aprendizados")).not.toBeInTheDocument();
  });

  it("/preview/estudos (seeds da demo) mostra barra de progresso, aprendizados e o tile", () => {
    render(
      <MemoryRouter>
        <PreviewUserDataProvider moduleKey="estudos"><Estudos /></PreviewUserDataProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("Aula 12 de 30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aprendizados de Inglês intermediário" })).toHaveTextContent("2 aprendizados");
    expect(within(resumo()).getByRole("button", { name: /Aprendizados/ })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/undefined|NaN/);
  });
});

describe("Contas puras", () => {
  it("contarNaSemana respeita segunda→hoje; comoAprendizados blinda lixo; ordem e busca", () => {
    const mapa = { c1: [{ id: "1", data: "2026-09-07", aprendi: "a" }, { id: "2", data: "2026-09-06", aprendi: "b" }, { id: "3", data: "2026-09-10", aprendi: "futuro" }] };
    // semana de 07/09 (segunda) a 09/09 (quarta): só o dia 07 conta; 06 é domingo anterior, 10 é futuro
    expect(contarNaSemana(mapa, "2026-09-09", "2026-09-07")).toBe(1);

    expect(comoAprendizados(null)).toEqual({});
    expect(comoAprendizados([1, 2])).toEqual({});
    expect(comoAprendizados({ c1: "lixo", c2: [{ id: "x", aprendi: "ok", data: "2026-01-01" }, { semTexto: true }, null] })).toEqual({ c2: [{ id: "x", aprendi: "ok", data: "2026-01-01" }] });

    const ordem = maisRecentesPrimeiro([
      { id: "100", data: "2026-09-01", aprendi: "a" },
      { id: "200", data: "2026-09-01", aprendi: "b" },
      { id: "50", data: "2026-09-02", aprendi: "c" },
    ]);
    expect(ordem.map(a => a.aprendi)).toEqual(["c", "b", "a"]);

    const todos = misturarCursos({ c1: [{ id: "1", data: "2026-09-01", aprendi: "Lição de casa", referencia: "Aula 2" }] }, {});
    expect(todos[0].cursoNome).toBe("Curso removido");
    expect(filtrarAprendizados(todos, "licao", null)).toHaveLength(1);
    expect(filtrarAprendizados(todos, "aula 2", null)).toHaveLength(1);
    expect(filtrarAprendizados(todos, "", "outro")).toHaveLength(0);
  });
});
