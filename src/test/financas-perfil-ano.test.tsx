/**
 * PEDIDO DE UM CLIENTE PAGANTE (09/09), virado em trava:
 *
 *   "a divisão de empresa e pessoal não tá tão separado, na parte de dívidas
 *    e empréstimos, orçamento e balanço anual; conseguir ver 2025 no balanço
 *    anual; balanço anual e comparação entre os anos como no mensal; e
 *    registrar ganhos em ações rápidas"
 *
 * Cada bloco abaixo é uma frase dessa mensagem. Onde a feature é de UI, o
 * teste abre → usa → SAI → REABRE (regra da casa, 19/07), porque o buraco
 * costuma estar na remontagem — foi assim que o ano do Orçamento voltava pra
 * 2026 a cada volta (02/09).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { DividasEntrePessoas, type DividaPessoal } from "@/components/finance/DividasEntrePessoas";
import { CategoryBudgets } from "@/components/CategoryBudgets";
import { AnnualBudget } from "@/components/AnnualBudget";
import { MonthComparison, parPadrao, rotuloMesAno, opcoesDeMeses } from "@/components/finance/MonthComparison";
import { QuickActions } from "@/components/home/QuickActions";
import { getMonthTotals, anosComLancamentos } from "@/components/finance/storage-keys";
import { PERFIL_PESSOAL, PERFIL_TODOS, nomeDoPerfil, perfilDe } from "@/lib/finance-perfil";
import { localDayKey } from "@/lib/utils";

const UID = "uid-perfil-ano";

// Balanço e Comparação leem localStorage pelo id do usuário; aqui não há sessão.
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "uid-perfil-ano" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
}));

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

const envolver = (ui: React.ReactElement, store: ReturnType<typeof criarStore>) =>
  <UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider>;

const renderComStore = (ui: React.ReactElement, store: ReturnType<typeof criarStore>) =>
  render(envolver(ui, store));

const PERFIS = [{ id: "acme", nome: "Acme" }];
const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const chaveArquivada = (ano: number, mes: string, sufixo: string) => `u:${UID}:finance-${ano}-${mes}-${sufixo}`;
const gravarLocal = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

/* ============================================================
 * "na parte de dívidas e empréstimos"
 * ============================================================ */
describe("Dívidas e empréstimos por perfil", () => {
  const registrar = (pessoa: string, valor: string) => {
    fireEvent.change(screen.getByPlaceholderText(/Devo para quem/i), { target: { value: pessoa } });
    fireEvent.change(screen.getByPlaceholderText("Valor"), { target: { value: valor } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar dívida" }));
  };

  it("dívida criada na empresa não aparece no Pessoal, aparece em Tudo junto com selo — e sobrevive a fechar e reabrir", () => {
    const store = criarStore();

    // abre na empresa e registra
    let tela = renderComStore(<DividasEntrePessoas perfil="acme" perfis={PERFIS} />, store);
    registrar("Fornecedor", "5000");
    expect(screen.getByText("Fornecedor")).toBeInTheDocument();
    const gravadas = store.dados["finance-dividas-pessoas"] as DividaPessoal[];
    expect(gravadas).toHaveLength(1);
    expect(gravadas[0].perfil).toBe("acme");
    tela.unmount();

    // reabre no Pessoal: nada da empresa
    tela = renderComStore(<DividasEntrePessoas perfil={PERFIL_PESSOAL} perfis={PERFIS} />, store);
    expect(screen.queryByText("Fornecedor")).not.toBeInTheDocument();
    expect(screen.getByText("Nenhuma dívida registrada")).toBeInTheDocument();
    // registra uma pessoal: lida como pessoal (a mesclagem carimba "pessoal",
    // como faz com as despesas) e SEM apagar a da empresa
    registrar("João", "300");
    const depois = store.dados["finance-dividas-pessoas"] as DividaPessoal[];
    expect(depois.map((d) => d.pessoa)).toEqual(["Fornecedor", "João"]);
    expect(perfilDe(depois[1])).toBe(PERFIL_PESSOAL);
    tela.unmount();

    // Tudo junto: as duas, cada uma com o selo de quem é
    renderComStore(<DividasEntrePessoas perfil={PERFIL_TODOS} perfis={PERFIS} />, store);
    expect(screen.getByText("Fornecedor")).toBeInTheDocument();
    expect(screen.getByText("João")).toBeInTheDocument();
    expect(screen.getAllByTestId("selo-perfil").map((s) => s.textContent)).toEqual(["Acme", "Pessoal"]);
  });

  it("dado antigo (sem etiqueta) continua no Pessoal, e apagar ali não leva a dívida da empresa junto", () => {
    const antiga: DividaPessoal = { id: "a", pessoa: "Maria", direcao: "medevem", criadaEm: "2026-08-01", lancamentos: [{ id: "l1", data: "2026-08-01", valor: 200 }] };
    const daEmpresa: DividaPessoal = { ...antiga, id: "b", pessoa: "Fornecedor", perfil: "acme" };
    const store = criarStore({ "finance-dividas-pessoas": [antiga, daEmpresa] });

    renderComStore(<DividasEntrePessoas perfil={PERFIL_PESSOAL} perfis={PERFIS} />, store);
    expect(screen.getByText("Maria")).toBeInTheDocument();
    expect(screen.queryByText("Fornecedor")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Maria"));
    fireEvent.click(screen.getByText("Apagar esta dívida inteira"));
    const restam = store.dados["finance-dividas-pessoas"] as DividaPessoal[];
    expect(restam.map((d) => d.pessoa)).toEqual(["Fornecedor"]);
  });

  it("o selo dá nome à empresa — e não some se a empresa foi apagada", () => {
    expect(nomeDoPerfil(undefined, PERFIS)).toBe("Pessoal");
    expect(nomeDoPerfil("acme", PERFIS)).toBe("Acme");
    expect(nomeDoPerfil("sumida", PERFIS)).toBe("sumida");
  });
});

/* ============================================================
 * "orçamento" — Limites por categoria
 * ============================================================ */
describe("Limites por categoria por perfil", () => {
  it("o teto pessoal NÃO mede o gasto da empresa; a empresa ganha o próprio teto sem encostar no pessoal", () => {
    const store = criarStore({ "finance-category-budgets": { alimentacao: 900 } });
    const gastosEmpresa = [{ category: "alimentacao", value: 700, perfil: "acme" }];

    // na empresa: o gasto aparece, o "/ R$ 900" do pessoal NÃO
    let tela = renderComStore(<CategoryBudgets expenses={gastosEmpresa} perfil="acme" perfis={PERFIS} />, store);
    expect(screen.getByTestId("limites-perfil-ativo").textContent).toContain("Acme");
    expect(screen.getByText(/R\$ 700/)).toBeInTheDocument();
    expect(screen.queryByText(/R\$ 900/)).not.toBeInTheDocument();

    // define 300 pra empresa
    fireEvent.click(screen.getByRole("button", { name: /Editar limite de Alimentação/i }));
    fireEvent.change(screen.getByPlaceholderText("Limite"), { target: { value: "300" } });
    fireEvent.keyDown(screen.getByPlaceholderText("Limite"), { key: "Enter" });
    expect(store.dados["finance-category-budgets-perfis"]).toEqual({ acme: { alimentacao: 300 } });
    expect(store.dados["finance-category-budgets"]).toEqual({ alimentacao: 900 }); // intocado
    expect(screen.getByText(/Limite excedido em R\$ 400/)).toBeInTheDocument();
    tela.unmount();

    // reabre no Pessoal com o gasto pessoal: teto 900, gasto 200, nada excedido
    const gastosPessoal = [{ category: "alimentacao", value: 200 }];
    tela = renderComStore(<CategoryBudgets expenses={gastosPessoal} perfil={PERFIL_PESSOAL} perfis={PERFIS} />, store);
    expect(screen.getByText(/R\$ 200/)).toBeInTheDocument();
    expect(screen.getByText(/\/ R\$ 900/)).toBeInTheDocument();
    expect(screen.queryByText(/Limite excedido/)).not.toBeInTheDocument();
    tela.unmount();

    // Tudo junto: um bloco por perfil, cada um com o SEU par teto×gasto; só leitura
    renderComStore(<CategoryBudgets expenses={[...gastosPessoal, ...gastosEmpresa]} perfil={PERFIL_TODOS} perfis={PERFIS} />, store);
    const pessoal = within(screen.getByTestId("limites-Pessoal"));
    const acme = within(screen.getByTestId("limites-Acme"));
    expect(pessoal.getByText(/R\$ 200/)).toBeInTheDocument();
    expect(pessoal.getByText(/\/ R\$ 900/)).toBeInTheDocument();
    expect(acme.getByText(/R\$ 700/)).toBeInTheDocument();
    expect(acme.getByText(/\/ R\$ 300/)).toBeInTheDocument();
    expect(screen.queryByText("Adicionar limite:")).not.toBeInTheDocument();
  });

  it("quem não tem empresa vê a tela de sempre — e o aviso de perfil nem existe", () => {
    const store = criarStore({ "finance-category-budgets": { lazer: 100 } });
    renderComStore(<CategoryBudgets expenses={[{ category: "lazer", value: 40 }]} />, store);
    expect(screen.queryByTestId("limites-perfil-ativo")).not.toBeInTheDocument();
    expect(screen.getByText(/\/ R\$ 100/)).toBeInTheDocument();
    expect(screen.getByText("Adicionar limite:")).toBeInTheDocument();
  });
});

/* ============================================================
 * "conseguir ver 2025 no balanço anual; comparação entre os anos"
 * ============================================================ */
describe("Balanço anual: ano escolhido, perfil e a linha 'vs ano anterior'", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 9)); // 09/09/2026, o dia do pedido
  });
  afterEach(() => vi.useRealTimers());

  const linhaDe = (mes: string) => within(screen.getByText(mes).closest("tr")!);

  it("lê 2025 pelas setas, recalcula ao trocar o perfil sem remontar, e lembra o ano ao reabrir", () => {
    gravarLocal(chaveArquivada(2025, "janeiro", "incomes"), [{ id: "1", value: 1000 }, { id: "2", value: 20000, perfil: "acme" }]);
    gravarLocal(chaveArquivada(2025, "janeiro", "expenses"), [{ id: "3", value: 300, perfil: "acme" }]);
    const store = criarStore();

    const tela = renderComStore(<AnnualBudget perfil={PERFIL_PESSOAL} />, store);
    expect(screen.getByTestId("balanco-ano").textContent).toBe("2026");
    expect(screen.getByText(/Nenhum lançamento em 2026/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próximo ano do balanço" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Ano anterior do balanço" }));
    expect(screen.getByTestId("balanco-ano").textContent).toBe("2025");
    expect(store.dados["finance-balanco-ano"]).toBe(2025);
    expect(linhaDe("Janeiro").getByText("1.000")).toBeInTheDocument();
    expect(linhaDe("Janeiro").queryByText("300")).not.toBeInTheDocument();

    // troca o chip PF/PJ: era o useMemo sem o perfil nas dependências
    tela.rerender(envolver(<AnnualBudget perfil="acme" />, store));
    expect(linhaDe("Janeiro").getByText("20.000")).toBeInTheDocument();
    expect(linhaDe("Janeiro").getByText("300")).toBeInTheDocument();
    expect(linhaDe("Janeiro").queryByText("1.000")).not.toBeInTheDocument();

    tela.rerender(envolver(<AnnualBudget perfil={PERFIL_TODOS} />, store));
    expect(linhaDe("Janeiro").getByText("21.000")).toBeInTheDocument();
    tela.unmount();

    // SAIR e REABRIR: continua em 2025
    renderComStore(<AnnualBudget perfil={PERFIL_PESSOAL} />, store);
    expect(screen.getByTestId("balanco-ano").textContent).toBe("2025");
  });

  it("'vs ano anterior' só aparece quando o ano anterior tem dado — e compara o MESMO período do ano", () => {
    for (const mes of MESES) gravarLocal(chaveArquivada(2025, mes, "incomes"), [{ id: mes, value: 1000 }]);
    gravarLocal(`u:${UID}:finance-incomes`, [{ id: "set", value: 2000 }]); // o mês vivo de 2026
    const store = criarStore();

    renderComStore(<AnnualBudget perfil={PERFIL_PESSOAL} />, store);
    const linha = screen.getByTestId("vs-ano-anterior");
    // jan–set de 2025 = 9.000, não os 12.000 do ano inteiro; 2.000 contra 9.000 = -78%
    expect(linha.textContent).toContain("vs 2025 (jan–set): R$ 9.000");
    expect(linha.textContent).toContain("-78%");

    // em 2025 não existe 2024 → a linha não aparece
    fireEvent.click(screen.getByRole("button", { name: "Ano anterior do balanço" }));
    expect(screen.queryByTestId("vs-ano-anterior")).not.toBeInTheDocument();
  });
});

/* ============================================================
 * "comparação entre os anos como no mensal" — dez/2025 × jan/2026
 * ============================================================ */
describe("Comparação mensal atravessa o ano", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 0, 15)); // janeiro: o caso que era impossível
  });
  afterEach(() => vi.useRealTimers());

  it("em janeiro o padrão é dez/2025 × jan/2026, e cada lado lê a chave do SEU ano", () => {
    gravarLocal(chaveArquivada(2025, "dezembro", "incomes"), [{ id: "d", value: 4000 }]);
    gravarLocal(chaveArquivada(2025, "dezembro", "expenses"), [{ id: "d2", value: 1500, category: "lazer" }]);
    gravarLocal(`u:${UID}:finance-incomes`, [{ id: "j", value: 5000 }]);
    gravarLocal(`u:${UID}:finance-expenses`, [{ id: "j2", value: 500, category: "lazer" }]);

    renderComStore(<MonthComparison perfil={PERFIL_PESSOAL} />, criarStore());
    expect(screen.getByText("R$ 4.000")).toBeInTheDocument();
    expect(screen.getByText("R$ 5.000")).toBeInTheDocument();
    expect(screen.getByTestId("rotulos-meses").textContent).toBe("dez/25jan/26");

    const [a, b] = parPadrao(new Date(2026, 0, 15));
    expect(rotuloMesAno(a)).toBe("dez/2025");
    expect(rotuloMesAno(b)).toBe("jan/2026");
    expect(getMonthTotals("Dezembro", UID, 2025, PERFIL_PESSOAL)).toMatchObject({ receitas: 4000, custosVariaveis: 1500 });
    expect(getMonthTotals("Janeiro", UID, 2026, PERFIL_PESSOAL)).toMatchObject({ receitas: 5000, custosVariaveis: 500 });
  });

  it("a lista de meses carrega o ano e vai do ano mais antigo com dado até o mês de agora", () => {
    gravarLocal(chaveArquivada(2024, "marco", "expenses"), [{ id: "x", value: 10 }]);
    gravarLocal(chaveArquivada(2019, "abril", "expenses"), []); // vazio não conta
    expect(anosComLancamentos(UID)).toEqual([2024]);
    const opcoes = opcoesDeMeses(anosComLancamentos(UID), new Date(2026, 0, 15)).map(rotuloMesAno);
    expect(opcoes[0]).toBe("jan/2024");
    expect(opcoes).toContain("dez/2025");
    expect(opcoes[opcoes.length - 1]).toBe("jan/2026");
    // sem nada arquivado: ano passado inteiro + este, nunca menos
    expect(opcoesDeMeses([], new Date(2026, 8, 9)).map(rotuloMesAno)[0]).toBe("jan/2025");
  });
});

/* ============================================================
 * "registrar ganhos em ações rápidas"
 * ============================================================ */
describe("Ações rápidas: Registrar ganho", () => {
  const abrirEGravar = (store: ReturnType<typeof criarStore>, valor: string, tipo?: string) => {
    render(<MemoryRouter>{envolver(<QuickActions />, store)}</MemoryRouter>);
    fireEvent.click(screen.getByText("Registrar Ganho"));
    if (tipo) fireEvent.click(screen.getByText(tipo));
    fireEvent.change(screen.getByPlaceholderText("R$ 0,00"), { target: { value: valor } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar ganho" }));
  };

  it("grava em finance-incomes no formato da tabela RECEITAS, etiquetado com a empresa ativa, sem apagar o que já havia", () => {
    const store = criarStore({
      "finance-perfil-ativo": "acme",
      "finance-incomes": [{ id: "antiga", description: "Salário", value: 3000, date: "2026-09-01" }],
    });
    abrirEGravar(store, "1.250,50", "Freela");
    const incomes = store.dados["finance-incomes"] as Array<Record<string, unknown>>;
    expect(incomes).toHaveLength(2);
    expect(incomes[0].id).toBe("antiga");
    expect(incomes[1]).toMatchObject({ description: "Freela", value: 1250.5, perfil: "acme", date: localDayKey() });
    expect(typeof incomes[1].id).toBe("string");
  });

  it("no Pessoal nasce SEM etiqueta — o legado que a tabela de sempre entende", () => {
    const store = criarStore();
    abrirEGravar(store, "300");
    const incomes = store.dados["finance-incomes"] as Array<Record<string, unknown>>;
    expect(incomes).toHaveLength(1);
    expect(incomes[0]).toMatchObject({ description: "Recebimento", value: 300 });
    expect(incomes[0].perfil).toBeUndefined();
  });

  it("valor inválido não grava nada", () => {
    const store = criarStore();
    abrirEGravar(store, "abc");
    expect(store.dados["finance-incomes"]).toBeUndefined();
  });
});
