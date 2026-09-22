/**
 * PEDIDOS DE CLIENTES 11–21/09, implementados na noite de 22/09.
 * Cada bloco cita o chamado que o originou (support_tickets do /admin).
 * Ciclo completo onde é UI: abre → usa → grava na chave de origem.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { buscarAlimentos, porcao, rotuloDaPorcao, carregarTaco } from "@/lib/taco";
import { faturasDoMes, injetarFaturas, extrairFaturas, chaveDaFatura } from "@/lib/finance-faturas";
import { gerarParcelas, DividasEntrePessoas, type DividaPessoal } from "@/components/finance/DividasEntrePessoas";
import { doCarimbo, ImportExtrato } from "@/components/finance/ImportExtrato";
import { TasksWidget } from "@/components/home/widgets/TasksWidget";
import { CompromissosDoDia } from "@/components/rotina/Compromissos";
import { BuscaAlimento } from "@/components/dieta/BuscaAlimento";
import { ExpenseTable } from "@/components/ExpenseTable";
import { CHAVE_COMPROMISSOS, type Compromisso } from "@/lib/compromissos";

// o ImportExtrato pergunta se a pessoa é assinante só pra decidir se pede avaliação
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
const renderComStore = (ui: React.ReactElement, store: ReturnType<typeof criarStore>) =>
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider></MemoryRouter>);

/* ============================================================
 * 2. Tabela de alimentos — 21/09 (com print): "coloco no meu registro a
 *    refeição, mas não aparece nem as calorias nem os macros no widget"
 * ============================================================ */
describe("Tabela TACO", () => {
  it("carrega os 597 alimentos e acha arroz cozido antes de bolinho de arroz", async () => {
    const t = await carregarTaco();
    expect(t.length).toBe(597);
    const r = buscarAlimentos(t, "arroz");
    expect(r[0].nome.startsWith("Arroz")).toBe(true);
    expect(r.some((a) => /cozido/.test(a.nome))).toBe(true);
    expect(buscarAlimentos(t, "frango grelhado")[0].nome).toMatch(/Frango.*grelhad/);
    expect(buscarAlimentos(t, "a")).toHaveLength(0); // curto demais
    expect(buscarAlimentos(t, "xyzzy")).toHaveLength(0);
  });

  it("porção calcula por gramas e rotula", async () => {
    const t = await carregarTaco();
    const arroz = t.find((a) => a.nome === "Arroz, tipo 1, cozido")!;
    expect(porcao(arroz, 150)).toEqual({ kcal: 192, p: 3.8, c: 42.2, g: 0.3 });
    expect(porcao(arroz, 0)).toEqual({ kcal: 0, p: 0, c: 0, g: 0 });
    expect(rotuloDaPorcao(arroz, 150)).toBe("Arroz tipo 1 cozido · 150 g");
  });

  it("busca + gramas → entrada pronta com kcal e macros", async () => {
    const onAdicionar = vi.fn();
    render(<BuscaAlimento onAdicionar={onAdicionar} />);
    fireEvent.change(screen.getByLabelText(/Buscar alimento/i), { target: { value: "arroz tipo 1 cozido" } });
    await waitFor(() => expect(screen.getByTestId("resultados-alimento")).toBeInTheDocument());
    fireEvent.click(within(screen.getByTestId("resultados-alimento")).getAllByRole("button")[0]);
    fireEvent.click(screen.getByRole("button", { name: "150 g" }));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar ao dia/i }));
    expect(onAdicionar).toHaveBeenCalledWith({ name: "Arroz tipo 1 cozido · 150 g", calories: 192, protein: 3.8, carbs: 42.2, fat: 0.3 });
  });
});

/* ============================================================
 * 3. Fatura do cartão como UMA conta do mês — 14/09: "criar uma única
 *    entrada nas contas do mês relativa à fatura… ao marcar como paga,
 *    marcar todas as entradas ligadas a essa fatura"
 * ============================================================ */
describe("Fatura do cartão como conta do mês", () => {
  const configOf = (c: string) => (c === "nubank" ? { closingDay: 25, dueDay: 5 } : c === "c6" ? { dueDay: 10 } : undefined);
  const labelOf = (c: string) => ({ nubank: "Nubank", c6: "C6 Bank", itau: "Itaú" }[c] ?? c);
  const base = {
    mes: "2026-09",
    variaveis: [
      { id: "1", value: 100, date: "2026-09-10", paymentMethod: "credito", cardName: "nubank" },
      { id: "2", value: 50, date: "2026-09-28", paymentMethod: "credito", cardName: "nubank" }, // depois do fechamento → outubro
      { id: "3", value: 30, date: "2026-09-12", paymentMethod: "pix", conta: "nubank" },        // Pix não é fatura
      { id: "4", value: 70, date: "2026-09-12", paymentMethod: "credito", cardName: "itau" },   // sem vencimento cadastrado
    ],
    variaveisAnterior: [{ id: "5", value: 20, date: "2026-08-29", paymentMethod: "credito", cardName: "nubank" }], // pós-fechamento de agosto → setembro
    fixos: [{ paymentMethod: "credito", cardName: "nubank", value: 40 }, { paymentMethod: "boleto", value: 999 }],
    parcelas: [{ id: "p", description: "TV", totalValue: 1200, installmentValue: 100, paidInstallments: 2, totalInstallments: 12, cardName: "nubank", category: "casa", date: "2026-07-10", startMonth: "2026-09", parcelaDoMes: 3 }],
    cards: ["nubank", "c6", "itau"],
    configOf, labelOf, pagas: {},
  };

  it("soma gasto (pela regra do fechamento) + parcela + fixo, só de cartão com vencimento", () => {
    const f = faturasDoMes(base);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ card: "nubank", label: "Nubank", dueDay: 5, variaveis: 120, parcelas: 100, fixos: 40, total: 260, paga: false });
    expect(faturasDoMes({ ...base, pagas: { [chaveDaFatura("2026-09", "nubank")]: true } })[0].paga).toBe(true);
  });

  it("entra nas contas do mês no dia do vencimento e volta separada do que é gravável", () => {
    const f = faturasDoMes(base);
    const dias = [{ day: 10, color: "slate", bills: [{ id: "b1", name: "Luz", paid: false }] }];
    const com = injetarFaturas(dias, f);
    expect(com.map((d) => d.day)).toEqual([5, 10]);
    const fatura = com[0].bills[0];
    expect(fatura).toMatchObject({ id: "fatura:nubank", name: "Fatura Nubank · R$ 260,00", paid: false, value: 220 });
    expect(injetarFaturas(dias, f, true)[0].bills[0].name).toBe("Fatura Nubank");

    // a tela devolve a lista com a fatura marcada como paga
    const devolvida = com.map((d) => ({ ...d, bills: d.bills.map((b) => (b.id === "fatura:nubank" ? { ...b, paid: true } : b)) }));
    const { dueDays, faturas } = extrairFaturas(devolvida, dias);
    expect(faturas).toEqual([{ card: "nubank", paga: true }]);
    expect(dueDays).toEqual(dias); // o dia 5 só existia pela fatura: não vai pro storage
  });
});

/* ============================================================
 * 6. Empréstimo parcelado + juros — 20/09: "emprestei 10 mil, ele me paga
 *    10× de 1.000… se emprestei a juros, como coloco o rendimento mensal?"
 * ============================================================ */
describe("Dívidas entre pessoas: parcelas e juros", () => {
  it("gera 10× de 1.000 mês a mês; centavo sobrando vai pra última; dia 31 encolhe em fevereiro", () => {
    const p = gerarParcelas(10000, 10, "2026-10-05");
    expect(p).toHaveLength(10);
    expect(p[0]).toEqual({ n: 1, data: "2026-10-05", valor: 1000 });
    expect(p[9].data).toBe("2027-07-05");
    const t = gerarParcelas(100, 3, "2027-01-31");
    expect(t.map((x) => x.valor)).toEqual([33.33, 33.33, 33.34]);
    expect(t.map((x) => x.data)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
    expect(gerarParcelas(100, 1, "2027-01-31")).toEqual([]);
  });

  it("'Recebi' abate a parcela e 'juros do mês' vira receita quando me devem", () => {
    const divida: DividaPessoal = {
      id: "d1", pessoa: "Carlos", direcao: "medevem", criadaEm: "2026-09-22",
      lancamentos: [{ id: "l1", data: "2026-09-22", valor: 10000, nota: "Valor inicial" }],
      parcelas: gerarParcelas(10000, 10, "2026-10-05"), jurosMes: 2,
    };
    const store = criarStore({ "finance-dividas-pessoas": [divida] });
    const onReceita = vi.fn();
    renderComStore(<DividasEntrePessoas onReceita={onReceita} />, store);
    fireEvent.click(screen.getByRole("button", { name: /Carlos/ }));
    expect(screen.getByTestId("parcelas-previstas")).toHaveTextContent("0/10");
    fireEvent.click(screen.getAllByRole("button", { name: "Recebi" })[0]);
    let salvo = store.dados["finance-dividas-pessoas"] as DividaPessoal[];
    expect(salvo[0].parcelas![0].paga).toBe(true);
    expect(salvo[0].lancamentos.at(-1)).toMatchObject({ valor: -1000, nota: "Parcela 1/10" });
    fireEvent.click(screen.getByTestId("lancar-juros"));
    salvo = store.dados["finance-dividas-pessoas"] as DividaPessoal[];
    expect(salvo[0].lancamentos.at(-1)!.valor).toBe(180); // 2% de 9.000
    expect(onReceita).toHaveBeenCalledWith(expect.objectContaining({ descricao: "Juros — Carlos", valor: 180 }));
  });
});

/* ============================================================
 * 4. Importar extrato: desfazer — 16/09: "importei meu extrato, mas não deu
 *    muito certo e gostaria de excluir, mas não sei como"
 * ============================================================ */
describe("Importação de extrato: desfazer", () => {
  it("remove só o que a última importação criou", () => {
    const stamp = 1700000000000;
    const expenses = [
      { id: "manual-1", description: "Padaria", value: 10, date: "2026-09-20", category: "alimentacao", paymentMethod: "pix" },
      { id: `${stamp}-e0`, description: "UBER", value: 20, date: "2026-09-21", category: "transporte", paymentMethod: "debito" },
      { id: `${stamp}-e1`, description: "IFOOD", value: 30, date: "2026-09-21", category: "delivery", paymentMethod: "debito" },
    ];
    const incomes = [{ id: `${stamp}-i0`, description: "PIX RECEBIDO", value: 100, date: "2026-09-21" }];
    expect(doCarimbo(expenses[1].id, stamp)).toBe(true);
    expect(doCarimbo("manual-1", stamp)).toBe(false);
    const store = criarStore({ "finance-ultima-importacao": { stamp, gastos: 2, receitas: 1, quando: "2026-09-21T10:00:00Z" } });
    const setExpenses = vi.fn();
    const setIncomes = vi.fn();
    renderComStore(<ImportExtrato expenses={expenses} incomes={incomes} setExpenses={setExpenses} setIncomes={setIncomes} />, store);
    const botao = screen.getByTestId("desfazer-importacao");
    expect(botao).toHaveTextContent("Desfazer (3)");
    fireEvent.click(botao);
    expect(setExpenses).toHaveBeenCalledWith([expenses[0]]);
    expect(setIncomes).toHaveBeenCalledWith([]);
    expect(store.dados["finance-ultima-importacao"]).toBeNull();
  });
});

/* ============================================================
 * 5. Separar por conta — 20/09: "que a aba de financeiro possa ser separada
 *    por contas, tipo C6, Nubank, o mesmo para os cartões de crédito"
 * ============================================================ */
describe("Gastos por conta", () => {
  it("chips com as contas presentes filtram a lista e mostram o subtotal", () => {
    const expenses = [
      { id: "1", description: "Compras da semana", category: "mercado", value: 200, date: "2026-09-10", paymentMethod: "credito", cardName: "nubank" },
      { id: "2", description: "Uber", category: "transporte", value: 25, date: "2026-09-11", paymentMethod: "pix", conta: "c6" },
      { id: "3", description: "Farmácia", category: "farmacia", value: 60, date: "2026-09-12", paymentMethod: "pix", conta: "c6" },
    ];
    const store = criarStore();
    renderComStore(<ExpenseTable expenses={expenses} setExpenses={() => {}} />, store);
    const filtro = screen.getByTestId("filtro-conta");
    fireEvent.click(within(filtro).getByRole("button", { name: "C6 Bank" }));
    expect(screen.queryByText("Compras da semana")).not.toBeInTheDocument();
    expect(screen.getByText("Uber")).toBeInTheDocument();
    expect(filtro).toHaveTextContent("2 gastos · R$ 85,00");
    expect(screen.getAllByTestId("badge-conta")).toHaveLength(2);
    fireEvent.click(within(filtro).getByRole("button", { name: "Todas" }));
    expect(screen.getByText("Compras da semana")).toBeInTheDocument();
  });
});

/* ============================================================
 * 10. Tarefas de hoje na Home — 20/09 (marcado como erro): "as tarefas
 *     criadas em CARREIRA - ROTINA - CASA não aparecem no dashboard"
 * ============================================================ */
describe("Widget Tarefas de hoje", () => {
  const hoje = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();

  it("junta Rotina, Carreira e Casa e o ✓ grava na chave de origem", () => {
    const store = criarStore({
      "todo-list": [{ id: "t1", text: "Pagar IPVA", priority: "alta", done: false, dueDate: "2026-01-01" }],
      "rotina-day-tasks": [{ id: "r1", texto: "Ligar pro dentista", feito: false, dia: hoje }, { id: "r2", texto: "Ontem", feito: false, dia: "2026-01-01" }],
      "career-day-tasks": [{ id: "c1", texto: "Enviar proposta", feito: false, dia: hoje }],
      "casa-chores": [{ id: "h1", name: "Lavar louça", currentTurnIndex: 1, lastRotation: "", done: false }],
      "casa-members": [{ id: "m1", name: "Ana", emoji: "👩" }, { id: "m2", name: "Bia", emoji: "👧" }],
      "casa-cleaning-routine": [{ id: "s1", name: "LIMPEZA DIÁRIA", color: "", items: [{ id: "i1", text: "Varrer", done: false }] }],
    });
    renderComStore(<TasksWidget />, store);
    const w = screen.getByTestId("tasks-widget");
    expect(w).toHaveTextContent("Pagar IPVA");
    expect(w).toHaveTextContent("atrasada");
    expect(w).toHaveTextContent("Ligar pro dentista");
    expect(w).not.toHaveTextContent("Ontem");
    expect(w).toHaveTextContent("Enviar proposta");
    expect(w).toHaveTextContent("vez de Bia");
    expect(w).toHaveTextContent("Varrer");
    expect(w).toHaveTextContent("0/5");
    fireEvent.click(screen.getByRole("checkbox", { name: /Concluir Enviar proposta/i }));
    expect((store.dados["career-day-tasks"] as { feito: boolean }[])[0].feito).toBe(true);
  });

  it("vazio explica de onde vêm as tarefas", () => {
    renderComStore(<TasksWidget />, criarStore());
    expect(screen.getByTestId("tasks-vazio")).toHaveTextContent(/Rotina/);
  });
});

/* ============================================================
 * 1. Compromisso com hora e aviso — 14/09 e 20/09 (a conta está em
 *    compromissos.test.ts; aqui é a tela)
 * ============================================================ */
describe("Compromissos do dia (tela)", () => {
  it("cria um compromisso repetido com aviso e grava na lista", () => {
    const store = criarStore();
    const onChange = vi.fn();
    renderComStore(<CompromissosDoDia dia="2026-09-29" lista={[]} onChange={onChange} />, store);
    expect(screen.getByTestId("compromissos-do-dia")).toHaveTextContent(/29 de setembro/);
    fireEvent.click(screen.getByTestId("novo-compromisso"));
    fireEvent.change(screen.getByLabelText("Nome do compromisso"), { target: { value: "Jiu-jitsu" } });
    fireEvent.change(screen.getByLabelText("Hora do compromisso"), { target: { value: "19:30" } });
    fireEvent.change(screen.getByLabelText("Antecedência do aviso"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Repete toda semana/i }));
    fireEvent.click(screen.getByRole("button", { name: "qua" }));
    fireEvent.click(screen.getByRole("button", { name: "sex" }));
    fireEvent.click(screen.getByRole("button", { name: /Salvar compromisso/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const salvo = (onChange.mock.calls[0][0] as Compromisso[])[0];
    expect(salvo).toMatchObject({ titulo: "Jiu-jitsu", data: "2026-09-29", hora: "19:30", repete: [1, 2, 4], aviso: 30 });
  });

  it("lista o que já existe no dia e apaga a série com confirmação", () => {
    const lista: Compromisso[] = [{ id: "x", titulo: "Médico", data: "2026-09-29", hora: "09:00", aviso: 1440, local: "Clínica" }];
    const store = criarStore({ [CHAVE_COMPROMISSOS]: lista });
    const onChange = vi.fn();
    renderComStore(<CompromissosDoDia dia="2026-09-29" lista={lista} onChange={onChange} />, store);
    const item = screen.getByTestId("compromisso-item");
    expect(item).toHaveTextContent("09:00");
    expect(item).toHaveTextContent("Médico");
    expect(item).toHaveTextContent("1 dia antes");
    expect(item).toHaveTextContent("Clínica");
    fireEvent.click(screen.getByRole("button", { name: /Apagar Médico/i }));
    fireEvent.click(screen.getByRole("button", { name: /apagar\?/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
