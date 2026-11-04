/**
 * PEDIDOS DE CLIENTES — consertos pequenos de 01/11 (ramo pedidos-proxima).
 * Cada bloco cita o chamado. Nada de tela nova: cada mudança mora na tela que já existia.
 * Onde grava dado (meta de sono, medidas novas): grava → remonta → continua lá.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock, Toaster: () => null }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })), remove: vi.fn() }) },
  },
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { FixedExpensesTable } from "@/components/FixedExpensesTable";
import { FinancialSummary } from "@/components/FinancialSummary";
import { totalQueDevoAPessoas, type DividaPessoal } from "@/components/finance/DividasEntrePessoas";
import { PERFIL_PESSOAL, PERFIL_TODOS } from "@/lib/finance-perfil";
import { BodyEvolution } from "@/components/saude/BodyEvolution";
import { useMarcasDoMes } from "@/components/rotina/DiaDoMes";
import { CHAVE_TAREFAS_ROTINA } from "@/lib/tarefas";
import { textoDoDiaNoMapa } from "@/pages/Rotina";
import { useAbasOcultas, type AbaOcultavel } from "@/hooks/use-abas-ocultas";
import { AbasOcultaveis } from "@/components/ui/abas-ocultaveis";
import { ModuleTip } from "@/components/ModuleTip";
import Saude from "@/pages/Saude";

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = JSON.parse(JSON.stringify(value)); },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor };
};
type Store = ReturnType<typeof criarStore>;
const montar = (ui: React.ReactElement, store: Store) =>
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider></MemoryRouter>);

beforeEach(() => {
  toastMock.mockClear();
  window.history.pushState({}, "", "/");
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

/* ── 1. Planilha de outro mês (chamados f58d1b35, 9a7cf88d, 982febff, f175076b) ── */
describe("1. custo fixo na planilha de outro mês", () => {
  it("fora do mês atual diz que vale só para aquele mês; no mês atual, a frase de sempre", () => {
    const props = { expenses: [], setExpenses: () => {} };
    const { unmount } = montar(<FixedExpensesTable {...props} mes="2026-12" soDoMes="Dezembro" />, criarStore());
    expect(screen.getByText("Vale só para Dezembro. Pra repetir todo mês, cadastre em Meu financeiro.")).toBeInTheDocument();
    expect(screen.queryByText(/repetem todo mês/)).toBeNull();
    unmount();

    montar(<FixedExpensesTable {...props} />, criarStore());
    expect(screen.getByText(/contas recorrentes · repetem todo mês/)).toBeInTheDocument();
    expect(screen.queryByText(/Vale só para/)).toBeNull();
  });
});

/* ── 2. Card DÍVIDAS soma o que devo a pessoas ── */
describe("2. card DÍVIDAS", () => {
  const divida = (p: Partial<DividaPessoal>): DividaPessoal => ({
    id: Math.random().toString(36), pessoa: "Ana", direcao: "devo", criadaEm: "2026-10-01", lancamentos: [], ...p,
  });
  const lista: DividaPessoal[] = [
    divida({ lancamentos: [{ id: "a", data: "2026-10-01", valor: 1000 }, { id: "b", data: "2026-10-10", valor: -300 }] }), // 700 em aberto
    divida({ pessoa: "Quitada", lancamentos: [{ id: "c", data: "2026-10-01", valor: 200 }, { id: "d", data: "2026-10-02", valor: -200 }] }),
    divida({ pessoa: "Me deve", direcao: "medevem", lancamentos: [{ id: "e", data: "2026-10-01", valor: 5000 }] }),
    divida({ pessoa: "Fornecedor", perfil: "empresa-x", lancamentos: [{ id: "f", data: "2026-10-01", valor: 400 }] }),
  ];

  it("soma só o que EU devo e ainda está em aberto, no perfil da tela", () => {
    expect(totalQueDevoAPessoas(lista, PERFIL_PESSOAL)).toBe(700);
    expect(totalQueDevoAPessoas(lista, "empresa-x")).toBe(400);
    expect(totalQueDevoAPessoas(lista, PERFIL_TODOS)).toBe(1100);
    expect(totalQueDevoAPessoas(undefined)).toBe(0);
    expect(totalQueDevoAPessoas("lixo" as never)).toBe(0);
  });

  it("linha 'Parcelas · Pessoas' só quando as duas partes são maiores que zero", () => {
    const base = { totalIncome: 0, totalExpenses: 0, totalInvestments: 0 };
    const { unmount } = render(<FinancialSummary {...base} totalDebts={1200} partesDasDividas={{ parcelas: 500, pessoas: 700 }} />);
    expect(screen.getByText(/Total de Dívidas - R\$ 1\.200,00/)).toBeInTheDocument();
    expect(screen.getByText("Parcelas R$ 500,00 · Pessoas R$ 700,00")).toBeInTheDocument();
    unmount();

    render(<FinancialSummary {...base} totalDebts={700} partesDasDividas={{ parcelas: 0, pessoas: 700 }} />);
    expect(screen.getByText(/Total de Dívidas - R\$ 700,00/)).toBeInTheDocument();
    expect(screen.queryByText(/Parcelas R\$/)).toBeNull();
  });
});

/* ── 3. Meta de sono editável ── */
describe("3. meta de sono", () => {
  it("'Meta: 8h ✎' abre 5–12 h, grava na mesma chave e continua lá ao remontar", () => {
    const HOJE = localDayKey();
    const store = criarStore({ "core-saude-sleep": { [HOJE]: 7.5 } });
    const { unmount } = montar(<Saude />, store);
    expect(screen.getByText("Faltam 0,5h para a meta")).toBeInTheDocument();

    expect(screen.getByText("Meta: 8h ✎")).toBeInTheDocument(); // 02/11: o seletor nativo fica por cima do texto (1 toque)
    const escolha = screen.getByLabelText("Meta de sono") as HTMLSelectElement;
    const opcoes = Array.from(escolha.options).map((o) => o.value);
    expect(opcoes[0]).toBe("5");
    expect(opcoes[opcoes.length - 1]).toBe("12");
    expect(opcoes).toHaveLength(15); // de meia em meia hora
    fireEvent.change(escolha, { target: { value: "7" } });

    expect(store.dados["core-saude-sleep-goal"]).toBe(7);
    expect(screen.getByText("Meta atingida ✓")).toBeInTheDocument();
    unmount();

    // remonta: a meta lida é a gravada
    montar(<Saude />, store);
    expect(screen.getByText("Meta: 7h ✎")).toBeInTheDocument();
  });
});

/* ── 4. Medidas novas (chamados 08e0f4c8, b9a4d90f) ── */
describe("4. medidas novas", () => {
  it("glúteo, panturrilha e posterior da coxa gravam e aparecem ao remontar; medida antiga não quebra", () => {
    const antiga = { date: "2026-09-01", peso: "80", bf: "", cintura: "", bracoD: "", bracoE: "", pernaD: "", pernaE: "", peito: "" };
    const store = criarStore({ "core-saude-measures": [antiga] });
    const { unmount } = montar(<BodyEvolution />, store);
    expect(screen.getByText("GLÚTEO/QUADRIL")).toBeInTheDocument(); // linha nova com "—" pra medida antiga

    fireEvent.click(screen.getByRole("button", { name: /Registrar Medidas/ }));
    fireEvent.change(screen.getByPlaceholderText("GLÚTEO"), { target: { value: "102,5" } });
    fireEvent.change(screen.getByPlaceholderText("PANTURR."), { target: { value: "38" } });
    fireEvent.change(screen.getByPlaceholderText("POSTERIOR DA COXA"), { target: { value: "55" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Medidas" }));

    const gravadas = store.dados["core-saude-measures"] as Array<Record<string, string>>;
    expect(gravadas).toHaveLength(2);
    expect(gravadas[1]).toMatchObject({ gluteo: "102,5", panturrilha: "38", posteriorCoxa: "55" });
    unmount();

    montar(<BodyEvolution />, store);
    expect(screen.getByText("102,5 cm")).toBeInTheDocument();
    expect(screen.getByText("38 cm")).toBeInTheDocument();
    expect(screen.getByText("55 cm")).toBeInTheDocument();
  });
});

/* ── 5. Rotina › Meu mês: dia passado com tarefa feita (chamado 2541a7c9) ── */
describe("5. ponto cinza no dia passado com tarefa feita", () => {
  it("só dia PASSADO e só com tarefa feita", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 20, 10));
    const store = criarStore({
      [CHAVE_TAREFAS_ROTINA]: [
        { id: "1", texto: "Feita", feito: true, dia: "2026-11-05" },
        { id: "2", texto: "Pendente", feito: false, dia: "2026-11-06" },
        { id: "3", texto: "Feita hoje", feito: true, dia: "2026-11-20" },
        { id: "4", texto: "Outro mês", feito: true, dia: "2026-10-05" },
      ],
    });
    const wrapper = ({ children }: { children: ReactNode }) => <UserDataContext.Provider value={store.valor}>{children}</UserDataContext.Provider>;
    const { result } = renderHook(() => useMarcasDoMes(2026, 10), { wrapper });
    expect([...result.current.diasComFeita]).toEqual(["2026-11-05"]);
  });
});

/* ── 6. Mapa de 16 semanas: o toque mostra o dia (chamado f6de589e) ── */
describe("6. toque no quadradinho do mapa de hábitos", () => {
  it("texto do aviso: dia da semana, data e hábitos", () => {
    const seg = new Date(2026, 9, 12); // segunda
    expect(textoDoDiaNoMapa(seg, ["Água", "Leitura"], 2)).toBe("Seg 12/10: Água · Leitura");
    expect(textoDoDiaNoMapa(seg, [], 0)).toBe("Seg 12/10: nenhum hábito");
    expect(textoDoDiaNoMapa(seg, undefined, 1)).toBe("Seg 12/10: hábito feito");
  });
});

/* ── 7. "Ver dicas de novo" na folha Organizar abas (chamado 00f3064c) ── */
describe("7. ver dicas de novo", () => {
  const ABAS: AbaOcultavel[] = [
    { id: "hoje", label: "HOJE", icon: "☀️" },
    { id: "mes", label: "MEU MÊS", icon: "📅" },
  ];
  const Pagina = ({ modulo }: { modulo: string }) => {
    const [ativa, setAtiva] = useState("hoje");
    const abas = useAbasOcultas(modulo, ABAS);
    return (
      <div>
        <AbasOcultaveis abas={abas} ativa={ativa} onTrocar={setAtiva} />
        <ModuleTip moduleId={modulo} />
      </div>
    );
  };

  it("com a marca gravada: a linha aparece, apaga a marca, fecha a folha e as dicas voltam", async () => {
    const store = criarStore({ "core-tip-seen-rotina": "true" });
    montar(<Pagina modulo="rotina" />, store);
    expect(screen.queryByTestId("dicas-modulo")).toBeNull();

    fireEvent.click(screen.getByTestId("abas-organizar"));
    fireEvent.click(screen.getByTestId("abas-ver-dicas-de-novo"));
    expect(store.dados["core-tip-seen-rotina"]).toBe("");
    await waitFor(() => expect(screen.queryByTestId("abas-organizar-folha")).toBeNull());
    expect(screen.getByTestId("dicas-modulo")).toBeInTheDocument();
  });

  it("sem a marca, ou módulo sem dicas: a linha não aparece", () => {
    const { unmount } = montar(<Pagina modulo="rotina" />, criarStore());
    fireEvent.click(screen.getByTestId("abas-organizar"));
    expect(screen.queryByTestId("abas-ver-dicas-de-novo")).toBeNull();
    unmount();

    montar(<Pagina modulo="modulo-sem-dicas" />, criarStore({ "core-tip-seen-modulo-sem-dicas": "true" }));
    fireEvent.click(screen.getByTestId("abas-organizar"));
    expect(screen.queryByTestId("abas-ver-dicas-de-novo")).toBeNull();
  });
});

/* 01/11 (dono: "não é mais fácil repetir todos os meses?"): fixo cadastrado na planilha de um mês futuro
   também aparece previsto nos meses seguintes — o mais recente vence no mesmo perfil + descrição. */
describe("fixos em cadeia nos meses futuros", () => {
  it("o balde corrente + a planilha de novembro aparecem em dezembro; o de novembro vence o de mesmo nome", async () => {
    const { juntarFixosEmCadeia, projetarFixos } = await import("@/components/FixedExpensesTable");
    const corrente = [{ id: "a", description: "Aluguel", value: 1200 }, { id: "n", description: "Netflix", value: 40 }] as any[];
    const novembro = [{ id: "b", description: "aluguel ", value: 1350 }, { id: "c", description: "Academia", value: 99 }] as any[];
    const dezembroReal = [{ id: "d", description: "Netflix", value: 45 }] as any[];
    const previstos = projetarFixos(juntarFixosEmCadeia([corrente, novembro]), dezembroReal);
    expect(previstos.map((f: any) => [f.description.trim(), f.value])).toEqual([["aluguel", 1350], ["Academia", 99]]);
  });
  it("perfis diferentes não se misturam; lista vazia ou estranha não quebra", async () => {
    const { juntarFixosEmCadeia } = await import("@/components/FixedExpensesTable");
    const r = juntarFixosEmCadeia([[{ id: "1", description: "Aluguel", value: 1, perfil: "empresa" } as any], [{ id: "2", description: "Aluguel", value: 2 } as any], null as any, [null as any]]);
    expect(r).toHaveLength(2);
  });
});
