/**
 * Varredura da demo 26/09 — FINANÇAS (telas periféricas), nas telas.
 * Cada bloco reproduz o que foi visto na /preview/financas e confere o
 * conserto — com o ciclo usar → sair do campo → re-renderizar onde o buraco
 * estava na remontagem (investimento).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { toast } from "sonner";
import { FixedExpensesTable } from "@/components/FixedExpensesTable";
import { IncomeTable } from "@/components/IncomeTable";
import { ExpenseTable } from "@/components/ExpenseTable";
import { InvestmentsTracker } from "@/components/InvestmentsTracker";
import { WishlistItems } from "@/components/WishlistItems";
import { Reports } from "@/components/Reports";
import { InstallmentTracker } from "@/components/InstallmentTracker";
import { CategoryBudgets } from "@/components/CategoryBudgets";
import { Calculator } from "@/components/Calculator";
import { Simulators } from "@/components/Simulators";
import { TravelBudget } from "@/components/travel/TravelBudget";
import type { Parcela } from "@/lib/finance-parcelas";

vi.mock("sonner", async (orig) => {
  const real = await orig<typeof import("sonner")>();
  return { ...real, toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
    Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverStub });
    Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ResizeObserverStub });
  }
});
beforeEach(() => vi.clearAllMocks());

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = JSON.parse(JSON.stringify(inicial));
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor };
};
const envolver = (ui: React.ReactElement, store = criarStore()) =>
  <UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider>;
const renderComStore = (ui: React.ReactElement, store = criarStore()) => render(envolver(ui, store));

const erros = () => (toast.error as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
/** O toast de "apagado" (lib/desfazer): texto + ação Desfazer. */
const ultimoApagado = () => {
  const chamadas = (toast as unknown as ReturnType<typeof vi.fn>).mock.calls;
  const [texto, opcoes] = chamadas[chamadas.length - 1] as [string, { action: { label: string; onClick: () => void } }];
  return { texto, opcoes };
};

/* ============================================================
 * 1. Custo fixo sem "Dia" — não vira "vence dia 1"
 * ============================================================ */
describe("CUSTOS FIXOS", () => {
  it("Dia em branco grava SEM vencimento; Dia 45 é recusado com aviso", () => {
    let gravado: Parameters<typeof FixedExpensesTable>[0]["expenses"] = [];
    renderComStore(<FixedExpensesTable expenses={[]} setExpenses={(l) => { gravado = l; }} />);
    fireEvent.change(screen.getByPlaceholderText("+ Novo custo fixo"), { target: { value: "Spotify" } });
    fireEvent.change(screen.getByPlaceholderText("Valor"), { target: { value: "21.90" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar custo fixo" }));
    expect(gravado).toHaveLength(1);
    expect(gravado[0]).toMatchObject({ description: "Spotify", value: 21.9 });
    expect(gravado[0].day).toBeUndefined();

    gravado = [];
    fireEvent.change(screen.getByPlaceholderText("+ Novo custo fixo"), { target: { value: "Seguro" } });
    fireEvent.change(screen.getByPlaceholderText("Valor"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Dia do vencimento"), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar custo fixo" }));
    expect(gravado).toHaveLength(0);
    expect(erros().some((e) => /1 a 31/.test(e))).toBe(true);
  });

  it("valor negativo não entra", () => {
    const gravar = vi.fn();
    renderComStore(<FixedExpensesTable expenses={[]} setExpenses={gravar} />);
    fireEvent.change(screen.getByPlaceholderText("+ Novo custo fixo"), { target: { value: "Netflix" } });
    fireEvent.change(screen.getByPlaceholderText("Valor"), { target: { value: "-39.90" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar custo fixo" }));
    expect(gravar).not.toHaveBeenCalled();
    expect(erros()).toContain("O valor precisa ser maior que zero.");
  });

  it("apagar pede o segundo toque ('apagar?') — um toque não apaga mais", () => {
    const gravar = vi.fn();
    const fixos = [{ id: "a", description: "Academia", category: "academia", value: 120, paymentMethod: "pix", day: 3 }];
    renderComStore(<FixedExpensesTable expenses={fixos} setExpenses={gravar} />);
    fireEvent.click(screen.getByRole("button", { name: "Apagar Academia" }));
    expect(gravar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão de Academia" }));
    expect(gravar).toHaveBeenCalledWith([]);
  });
});

/* ============================================================
 * 8 + 9. Receita e gasto: valor inválido e apagar com Desfazer
 * ============================================================ */
describe("RECEITAS e CUSTOS VARIÁVEIS", () => {
  it("receita −500, R$ 0 e sem nome não entram — com o motivo no aviso", () => {
    const gravar = vi.fn();
    renderComStore(<IncomeTable incomes={[]} setIncomes={gravar} />);
    const nome = screen.getByPlaceholderText("+ Nova receita");
    const valor = screen.getByPlaceholderText("Valor");
    const salvar = () => fireEvent.click(screen.getByRole("button", { name: "Adicionar receita" }));
    fireEvent.change(nome, { target: { value: "Estorno" } }); fireEvent.change(valor, { target: { value: "-500" } }); salvar();
    fireEvent.change(nome, { target: { value: "Zero" } }); fireEvent.change(valor, { target: { value: "0" } }); salvar();
    fireEvent.change(nome, { target: { value: "   " } }); fireEvent.change(valor, { target: { value: "100" } }); salvar();
    expect(gravar).not.toHaveBeenCalled();
    expect(erros()).toEqual(["O valor precisa ser maior que zero.", "O valor precisa ser maior que zero.", "Dê um nome à receita."]);
  });

  it("apagar receita avisa com Desfazer — e o Desfazer devolve na mesma posição", () => {
    const lista = [
      { id: "1", description: "Salário", value: 6200, date: "2026-09-01" },
      { id: "2", description: "Freela", value: 800, date: "2026-09-10" },
    ];
    let gravado: typeof lista = lista;
    const store = criarStore();
    const tela = renderComStore(<IncomeTable incomes={gravado} setIncomes={(l) => { gravado = l; }} />, store);
    fireEvent.click(screen.getByRole("button", { name: "Apagar Salário" }));
    expect(gravado.map((i) => i.id)).toEqual(["2"]);
    const { texto, opcoes } = ultimoApagado();
    expect(texto).toBe("Receita apagada: Salário");
    expect(opcoes.action.label).toBe("Desfazer");
    // a tela re-renderiza com a lista nova antes do toque em Desfazer
    tela.rerender(envolver(<IncomeTable incomes={gravado} setIncomes={(l) => { gravado = l; }} />, store));
    opcoes.action.onClick();
    expect(gravado.map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("gasto −50 não entra; apagar gasto tem Desfazer", () => {
    const padaria = { id: "p", description: "Padaria", category: "alimentacao", value: 32, date: "2026-09-06", paymentMethod: "pix" };
    let gravado: (typeof padaria)[] = [padaria];
    const store = criarStore();
    const tela = renderComStore(<ExpenseTable expenses={gravado} setExpenses={(l) => { gravado = l; }} mes="2026-09" />, store);
    fireEvent.change(screen.getByPlaceholderText("+ Novo gasto"), { target: { value: "Devolução" } });
    fireEvent.change(screen.getByPlaceholderText("Valor"), { target: { value: "-50" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar gasto" }));
    expect(gravado).toHaveLength(1);
    expect(erros()).toContain("O valor precisa ser maior que zero.");

    fireEvent.click(screen.getByRole("button", { name: "Apagar Padaria" }));
    expect(gravado).toHaveLength(0);
    tela.rerender(envolver(<ExpenseTable expenses={gravado} setExpenses={(l) => { gravado = l; }} mes="2026-09" />, store));
    ultimoApagado().opcoes.action.onClick();
    expect(gravado.map((e) => e.id)).toEqual(["p"]);
  });
});

/* ============================================================
 * 2 + 7 + 8. Investimentos: o aporte não some mais
 * ============================================================ */
describe("INVESTIMENTOS", () => {
  const selic = { id: "inv-1", name: "Tesouro Selic", type: "renda_fixa" as const, startDate: "2025-06-01", currentValue: 15100, expectedReturn: 12, investedAmount: 14200, monthlyContribution: 500 };

  it("aporte pelo botão +, e tocar no valor atual e sair NÃO volta pro valor velho", () => {
    type Lista = Parameters<typeof InvestmentsTracker>[0]["investments"];
    let lista: Lista = [selic];
    const gravar = vi.fn((l: Lista) => { lista = l; });
    const store = criarStore();
    const tela = renderComStore(<InvestmentsTracker investments={lista} setInvestments={gravar} />, store);
    const aporte = screen.getByLabelText("Novo aporte em Tesouro Selic");
    fireEvent.change(aporte, { target: { value: "500" } });
    fireEvent.blur(aporte); // sair do campo não lança nem perde o que foi digitado
    expect(gravar).not.toHaveBeenCalled();
    expect((aporte as HTMLInputElement).value).toBe("500");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar aporte em Tesouro Selic" }));
    expect(lista[0]).toMatchObject({ currentValue: 15600, investedAmount: 14700 });

    tela.rerender(envolver(<InvestmentsTracker investments={lista} setInvestments={gravar} />, store));
    const atual = screen.getByLabelText("Valor atual de Tesouro Selic") as HTMLInputElement;
    expect(atual.value).toBe("15600"); // antes continuava 15100
    fireEvent.focus(atual);
    fireEvent.blur(atual);
    expect(gravar).toHaveBeenCalledTimes(1); // sair sem mudar não grava nada
    expect(lista[0].currentValue).toBe(15600);
    expect(screen.getByText("Desde 01/06/2025")).toBeInTheDocument(); // antes: 31/05/2025
    expect(screen.getByText("12% a.a.")).toBeInTheDocument();
  });

  it("rentabilidade pode ir a 0% (o '|| anterior' não deixava) e o aviso de apagar traz Desfazer", () => {
    let lista: Parameters<typeof InvestmentsTracker>[0]["investments"] = [selic];
    const store = criarStore();
    const tela = renderComStore(<InvestmentsTracker investments={lista} setInvestments={(l) => { lista = l; }} />, store);
    const taxa = screen.getByLabelText("Rentabilidade esperada de Tesouro Selic (% ao ano)");
    fireEvent.change(taxa, { target: { value: "0" } });
    fireEvent.blur(taxa);
    expect(lista[0].expectedReturn).toBe(0);

    tela.rerender(envolver(<InvestmentsTracker investments={lista} setInvestments={(l) => { lista = l; }} />, store));
    fireEvent.click(screen.getByRole("button", { name: "Apagar Tesouro Selic" }));
    expect(lista).toHaveLength(0);
    expect(ultimoApagado().texto).toBe("Investimento apagado: Tesouro Selic (R$ 15.100,00)");
    tela.rerender(envolver(<InvestmentsTracker investments={lista} setInvestments={(l) => { lista = l; }} />, store));
    ultimoApagado().opcoes.action.onClick();
    expect(lista[0]).toMatchObject({ id: "inv-1", investedAmount: 14200, expectedReturn: 0 });
  });
});

/* ============================================================
 * 3 + 8. Desejos: data certa e apagar com o guardado de volta
 * ============================================================ */
describe("DESEJOS", () => {
  it("data 25/12 aparece 25/12 (antes 24/12); apagar avisa quanto estava guardado e o Desfazer devolve", () => {
    let itens: Parameters<typeof WishlistItems>[0]["items"] = [{ id: "w-1", name: "Apple iPad", price: 3399, savedAmount: 2550, priority: "media", category: "Outros", targetDate: "2026-12-25" }];
    const store = criarStore();
    const props = { monthlyBudget: 6200, totalExpenses: 3568, totalDebts: 450, monthlyInstallments: 150, fixedExpenses: [], dueDays: [] };
    const tela = renderComStore(<WishlistItems items={itens} setItems={(l) => { itens = l; }} {...props} />, store);
    expect(screen.getByText("📅 25/12/2026")).toBeInTheDocument();
    // "Gastos do mês" já com a parcela: 3.568 + 150
    expect(screen.getByText("- R$ 3.718,00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Apagar Apple iPad" }));
    expect(itens).toHaveLength(0);
    expect(ultimoApagado().texto).toBe("Desejo apagado: Apple iPad (tinha R$ 2.550,00 guardados)");
    tela.rerender(envolver(<WishlistItems items={itens} setItems={(l) => { itens = l; }} {...props} />, store));
    ultimoApagado().opcoes.action.onClick();
    expect(itens[0]).toMatchObject({ id: "w-1", savedAmount: 2550, targetDate: "2026-12-25" });
  });
});

/* ============================================================
 * 5. Relatório fecha
 * ============================================================ */
describe("RELATÓRIOS", () => {
  it("fixos e parcelas entram na lista e nas categorias; a composição soma o total; rodapé CORE", () => {
    const store = criarStore({
      "finance-fixed-expenses": [{ id: "f1", description: "Aluguel", category: "moradia", value: 3104, paymentMethod: "debito", day: 5 }],
      "finance-installments": [{ id: "inst-1", description: "Celular novo", category: "eletronicos", cardName: "nubank", installmentValue: 150, totalValue: 1800, paidInstallments: 9, totalInstallments: 12, date: "2025-11-15" }],
    });
    renderComStore(
      <Reports
        incomes={[{ id: "i", description: "Salário", value: 6200, date: "2026-09-01" }]}
        expenses={[{ id: "e", description: "Mercado", category: "alimentacao", value: 464, date: "2026-09-02", paymentMethod: "pix" }]}
        totalIncome={6200} totalExpenses={3718} totalDebts={450} totalInvestments={0}
        setIncomes={() => {}} setExpenses={() => {}}
      />,
      store,
    );
    expect(screen.getByText("Despesas (3)")).toBeInTheDocument();
    expect(screen.getByText("Aluguel")).toBeInTheDocument();
    expect(screen.getByText("Celular novo")).toBeInTheDocument();
    expect(screen.getByTestId("despesas-composicao").textContent)
      .toBe("Despesas = custos fixos R$ 3.104,00 + dia a dia R$ 464,00 + parcelas R$ 150,00");
    // categoria da parcela aparece no quadro de categorias E na linha da tabela
    expect(screen.getAllByText("Eletrônicos")).toHaveLength(2);
    expect(screen.getByText("40,0%")).toBeInTheDocument();
    expect(screen.getByText(/• CORE$/)).toBeInTheDocument();
    expect(screen.queryByText(/Finanças em Ordem/)).not.toBeInTheDocument();
  });
});

/* ============================================================
 * 6. Parcelamentos no celular: valor e ✓ visíveis
 * ============================================================ */
describe("PARCELAMENTOS no celular", () => {
  it("colunas secundárias só a partir de sm; 'k de N · cartão' desce pra baixo do nome; total com linha própria", () => {
    const p: Parcela = { id: "p1", description: "Celular", totalValue: 1800, installmentValue: 150, paidInstallments: 9, totalInstallments: 12, cardName: "nubank", category: "eletronicos", date: "2025-11-15" };
    const { container } = renderComStore(<InstallmentTracker installments={[p]} setInstallments={() => {}} mes="2026-09" />);
    const tabela = container.querySelector("table")!;
    expect(tabela.className).toContain("sm:min-w-[650px]");
    expect(tabela.className).not.toMatch(/(^|\s)min-w-\[650px\]/);
    const ths = [...tabela.querySelectorAll("thead th")];
    const escondidas = ths.filter((th) => th.className.includes("hidden sm:table-cell")).map((th) => th.textContent);
    expect(escondidas).toEqual(["Parcela", "Data", "Cartão", "Categoria"]);
    expect(screen.getByText("10 de 12 · Nubank")).toBeInTheDocument();
    const rodapeCelular = tabela.querySelector("tfoot tr.sm\\:hidden")!;
    expect(within(rodapeCelular as HTMLElement).getByText("R$ 150,00")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Marcar parcela 10 de Celular como paga/ })).toBeInTheDocument();
  });
});

/* ============================================================
 * 13. Limites contam a parcela
 * ============================================================ */
describe("LIMITES POR CATEGORIA", () => {
  it("Eletrônicos mostra a parcela do mês contra o teto (antes R$ 0 / R$ 300)", () => {
    const store = criarStore({
      "finance-category-budgets": { eletronicos: 300 },
      "finance-installments": [{ id: "inst-1", description: "Celular novo", category: "eletronicos", cardName: "nubank", installmentValue: 150, totalValue: 1800, paidInstallments: 9, totalInstallments: 12, date: "2025-11-15" }],
    });
    renderComStore(<CategoryBudgets expenses={[]} />, store);
    expect(screen.getByText("R$ 150,00", { exact: false })).toHaveTextContent("R$ 150,00 / R$ 300,00");
  });
});

/* ============================================================
 * 10. Calculadora
 * ============================================================ */
describe("CALCULADORA", () => {
  it("÷, ⌫ e xʸ funcionam; divisão por zero diz Erro", () => {
    render(<Calculator />);
    const visor = () => screen.getByTestId("visor-calculadora").textContent;
    const t = (nome: string) => fireEvent.click(screen.getByRole("button", { name: nome }));
    t("1"); t("2"); t("Dividir"); t("4"); t("Igual");
    expect(visor()).toBe("3");
    t("Limpar"); t("2"); t("Potência"); t("1"); t("0"); t("Igual");
    expect(visor()).toBe("1.024");
    t("Limpar"); t("1"); t("2"); t("3"); t("Apagar último dígito");
    expect(visor()).toBe("12");
    t("Dividir"); t("0"); t("Igual");
    expect(visor()).toBe("Erro");
  });
});

/* ============================================================
 * 11. Simuladores
 * ============================================================ */
describe("SIMULADORES", () => {
  const campo = (rotulo: string, n = 0) => screen.getAllByText(rotulo)[n].parentElement!.querySelector("input")!;

  it("campo apagado fica vazio (não '0' → '05') e aporte 0 diz que não alcança", () => {
    render(<Simulators />);
    const meta = campo("Meta (R$)");
    fireEvent.change(meta, { target: { value: "" } });
    expect(meta.value).toBe("");
    fireEvent.change(meta, { target: { value: "5" } });
    expect(meta.value).toBe("5");
    fireEvent.change(meta, { target: { value: "10000" } });
    fireEvent.change(campo("Aporte/mês (R$)"), { target: { value: "0" } });
    expect(screen.getByTestId("resultado-tempo")).toHaveTextContent("Com esse aporte, não chega na meta.");
  });

  it("independência sem aporte nem retorno: honesto; taxa negativa: rendimento com menos", () => {
    render(<Simulators />);
    fireEvent.change(campo("Aporte mensal (R$)", 1), { target: { value: "0" } });
    fireEvent.change(campo("Retorno anual (%)"), { target: { value: "0" } });
    expect(screen.getByTestId("resultado-independencia")).toHaveTextContent("Com esse aporte, não chega na meta");
    expect(screen.getByTestId("resultado-independencia")).not.toHaveTextContent("100 anos e 0 meses");
    fireEvent.change(campo("Taxa anual (%)"), { target: { value: "-50" } });
    expect(screen.getByText(/^-R\$ [\d.]+,\d{2}$/)).toBeInTheDocument();
    expect(screen.queryByText(/\+R\$ -/)).not.toBeInTheDocument();
  });
});

/* ============================================================
 * 9. Viagem: custo real negativo
 * ============================================================ */
describe("VIAGEM", () => {
  it("valor real negativo não entra e avisa", () => {
    const store = criarStore({
      "travel-trips-v2": {
        trips: [{ id: "t1", destination: "Salvador", startDate: "", endDate: "", photoUrl: "", places: [], categories: { passagens: [{ id: "c1", description: "Passagem", estimated: 1200, actual: 0 }] } }],
        ativoId: "t1", migrouDoObjetoUnico: true,
      },
    });
    renderComStore(<TravelBudget />, store);
    const real = screen.getByLabelText("Valor real de Passagem") as HTMLInputElement;
    fireEvent.change(real, { target: { value: "-300" } });
    expect(erros()).toContain("O valor não pode ser negativo.");
    const trip = (store.dados["travel-trips-v2"] as { trips?: { categories?: Record<string, { actual?: number }[]> }[] } | undefined)?.trips?.[0];
    expect(trip?.categories?.passagens?.[0]?.actual ?? 0).toBe(0);
  });
});
