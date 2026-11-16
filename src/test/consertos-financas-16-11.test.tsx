/**
 * CHAMADOS E AVALIAÇÕES DE 09–16/11 — Finanças (cartão, mês das despesas, vírgula, categorias).
 * Cada bloco cita o relato. Rodar: npx vitest run src/test/consertos-financas-16-11.test.tsx
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { createElement } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import {
  mesDaFatura, mesDoGasto, variaveisDoMes, contaNaFaturaDoMes, dataDaPrimeiraParcela, type CardConfig,
} from "@/lib/finance-fatura";
import { faturasDoMes } from "@/lib/finance-faturas";
import { carimbar, mesDeInicio, somaParcelasDoMes, viradaDeParcelas, type Parcela } from "@/lib/finance-parcelas";
import { separarPorMes, mesDoLancamento } from "@/lib/virada-do-mes";
import { lerFinancasDoMes } from "@/lib/retrospectiva";
import { avisoDeMesPassado } from "@/lib/finance-receita-futura";
import { CampoDinheiro } from "@/components/ui/campo-dinheiro";
import { CORTE_FECHAMENTO_NO_DIA, regraDoDiaDoFechamentoVale } from "@/lib/finance-fatura";
import { categoriaPadraoComNome } from "@/lib/finance-categories";
import { TotalPorCartao } from "@/components/finance/TotalPorCartao";
import { ExpenseTable } from "@/components/ExpenseTable";
import { IncomeTable } from "@/components/IncomeTable";
import { InstallmentTracker } from "@/components/InstallmentTracker";
import { CategorySelect } from "@/components/finance/CategorySelect";

afterEach(() => { cleanup(); vi.useRealTimers(); });

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
  render(createElement(UserDataContext.Provider, { value: store.valor }, ui));

const ROXO: CardConfig = { closingDay: 4, dueDay: 10 };
const FECHA2: CardConfig = { closingDay: 2, dueDay: 10 };
const compra = (id: string, date: string, value: number, cardName = "nubank") => ({ id, date, value, paymentMethod: "credito", cardName });
const DEPOIS_DO_CORTE = String(new Date(2026, 10, 20, 9, 0).getTime());
const ANTES_DO_CORTE = String(new Date(2026, 9, 25, 9, 0).getTime());

/* ═══ "coloquei fechamento dia 2, então todas as compras depois disso deveriam ser cobradas apenas no mês
 *     seguinte, mas quando eu anoto uma compra no cartão ele cobra ainda neste mesmo mês" ═══ */
describe("compra no dia do fechamento ou depois → fatura seguinte", () => {
  it("fechamento dia 2: dia 1 fica, dia 2 e dia 16 vão pra dezembro", () => {
    expect(mesDaFatura("2026-11-01", 2)).toBe("2026-11");
    expect(mesDaFatura("2026-11-02", 2)).toBe("2026-12");
    expect(mesDaFatura("2026-11-16", 2)).toBe("2026-12");
  });

  it("lançar em novembro → sai das despesas de novembro e entra nas de dezembro (o mesmo dinheiro em UM mês só)", () => {
    const configOf = () => FECHA2;
    // "b" anotada DEPOIS do corte da regra nova (id Date.now de 13 dígitos) — ver o bloco do corte
    const nov = [compra("a", "2026-11-01", 100), compra(DEPOIS_DO_CORTE, "2026-11-02", 30), compra("c", "2026-11-16", 70)];
    const vNov = variaveisDoMes(nov, [], "2026-11", configOf);
    expect(vNov.total).toBe(100);
    expect(vNov.adiados.map((g) => g.id)).toEqual([DEPOIS_DO_CORTE, "c"]);
    const vDez = variaveisDoMes([], nov, "2026-12", configOf);
    expect(vDez.total).toBe(100);
  });
});

/* ═══ Play 4★: "fecha dia 4 e vence dia 10; se eu lanço um parcelado no cartão 'roxo' no dia 8, ele aparece
 *     na fatura atual, já mostrando o vencimento no dia 10" ═══ */
describe("parcelado no cartão com fechamento: a 1ª parcela vai pra fatura seguinte", () => {
  it("dataDaPrimeiraParcela: antes do fechamento fica; no dia/depois vai pro vencimento do mês seguinte", () => {
    expect(dataDaPrimeiraParcela("2026-11-03", ROXO)).toBe("2026-11-03");
    expect(dataDaPrimeiraParcela("2026-11-04", ROXO)).toBe("2026-12-10");
    expect(dataDaPrimeiraParcela("2026-11-08", ROXO)).toBe("2026-12-10");
    expect(dataDaPrimeiraParcela("2026-12-20", ROXO)).toBe("2027-01-10"); // virada de ano
    expect(dataDaPrimeiraParcela("2027-01-30", { closingDay: 28, dueDay: 31 })).toBe("2027-02-28"); // mês curto
    expect(dataDaPrimeiraParcela("2026-11-08", { closingDay: 4 })).toBe("2026-12-08"); // sem vencimento: o dia da compra
    expect(dataDaPrimeiraParcela("2026-11-08", undefined)).toBe("2026-11-08"); // cartão sem fechamento: como sempre
    expect(dataDaPrimeiraParcela("2026-11-08", { dueDay: 10 })).toBe("2026-11-08");
  });

  // o cartão do formulário é um select Radix; sem escolher, o registro sai no cartão "outro" — a config vai nele
  it("no card de parcelamentos, sem data (= comprei hoje, dia 8): grava a 1ª em 10/12, não soma em novembro; reabrir em dezembro soma", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 8, 10, 0));
    let gravadas: Parcela[] = [];
    const store = criarStore({ "finance-card-config": { outro: ROXO } });
    renderComStore(createElement(InstallmentTracker, { installments: [], setInstallments: (l: Parcela[]) => { gravadas = l; }, mes: "2026-11" }), store);
    fireEvent.click(screen.getByRole("button", { name: /Novo Parcelamento/i }));
    fireEvent.change(screen.getByPlaceholderText("Nome do item"), { target: { value: "Fone" } });
    fireEvent.change(screen.getByPlaceholderText("Valor total"), { target: { value: "300,00" } });
    fireEvent.change(screen.getByPlaceholderText("Ex.: 5"), { target: { value: "3" } });
    expect(screen.getByText(/Em dezembro: parcela 1 de 3/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(gravadas).toHaveLength(1);
    expect(gravadas[0]).toMatchObject({ date: "2026-12-10", startMonth: "2026-11", totalValue: 300, installmentValue: 100 });
    expect(mesDeInicio(gravadas[0])).toBe("2026-12");
    expect(somaParcelasDoMes(gravadas)).toBe(0);
    const v = viradaDeParcelas(gravadas, "2026-12");
    expect(somaParcelasDoMes(v!.lista)).toBe(100);
  });

  it("no card de parcelamentos com a data da 1ª parcela digitada: fica a data dela", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 8, 10, 0));
    let gravadas: Parcela[] = [];
    renderComStore(createElement(InstallmentTracker, { installments: [], setInstallments: (l: Parcela[]) => { gravadas = l; }, mes: "2026-11" }), criarStore({ "finance-card-config": { outro: ROXO } }));
    fireEvent.click(screen.getByRole("button", { name: /Novo Parcelamento/i }));
    fireEvent.change(screen.getByPlaceholderText("Nome do item"), { target: { value: "Fone" } });
    fireEvent.change(screen.getByPlaceholderText("Valor total"), { target: { value: "300" } });
    fireEvent.change(screen.getByPlaceholderText("Ex.: 5"), { target: { value: "3" } });
    const data = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(data, { target: { value: "2026-11-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(gravadas[0].date).toBe("2026-11-10");
  });

  it("pelo '+ Novo gasto' → Parcelar no dia 8: a parcela sai com a 1ª em 10/12 e o aviso diz dezembro", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 8, 10, 0));
    let recebida: Parcela | null = null;
    const ouvinte = (e: Event) => {
      const d = (e as CustomEvent).detail;
      d.handled = true;
      recebida = d.installment;
      d.comecaEm = mesDeInicio(carimbar(d.installment, "2026-11")) ? "dezembro" : undefined;
    };
    window.addEventListener("core:novo-parcelamento", ouvinte);
    try {
      renderComStore(createElement(ExpenseTable, { expenses: [], setExpenses: () => {}, mes: "2026-11" }), criarStore({ "finance-card-config": { outro: ROXO } }));
      fireEvent.change(screen.getByPlaceholderText("+ Novo gasto"), { target: { value: "Tênis" } });
      fireEvent.click(screen.getByRole("button", { name: /Parcelar/i }));
      fireEvent.change(screen.getByPlaceholderText("Total"), { target: { value: "300" } });
      fireEvent.change(screen.getByPlaceholderText("Ex: 10"), { target: { value: "3" } });
      fireEvent.click(screen.getByRole("button", { name: /Adicionar compra parcelada/i }));
    } finally {
      window.removeEventListener("core:novo-parcelamento", ouvinte);
    }
    expect(recebida).not.toBeNull();
    expect(recebida!.date).toBe("2026-12-10");
    expect(recebida!.totalInstallments).toBe(3);
  });

  it("compra parcelada ANTES do fechamento (dia 3) segue na fatura do mês", () => {
    const nova = carimbar({ id: "f", description: "Fone", totalValue: 300, installmentValue: 100, paidInstallments: 0, totalInstallments: 3, cardName: "outro", category: "outros", date: dataDaPrimeiraParcela("2026-11-03", ROXO) }, "2026-11");
    expect(mesDeInicio(nova)).toBeNull();
    expect(somaParcelasDoMes([nova])).toBe(100);
  });
});

/* ═══ "O valor somado na aba 'valor total de cartões' não corresponde aos lançamentos... tem um valor a menos
 *     de um pouco mais de 300,00" ═══ */
describe("TOTAL POR CARTÃO = despesas no cartão do mês", () => {
  const configOf = (c: string) => (c === "nubank" ? FECHA2 : undefined);
  // novembro, fechamento dia 2: compra de 01/10 anotada atrasada (fatura de outubro, já passou), compra de 01/11
  // (fatura de novembro) e compra de 16/11 (fatura de dezembro)
  const nov = [compra("atrasada", "2026-10-01", 312.5), compra("a", "2026-11-01", 100), compra("depois", "2026-11-16", 50)];

  it("ANTES: a compra atrasada contava nas despesas e em NENHUM total de cartão (a diferença de R$ 300)", () => {
    expect(mesDoGasto(nov[0], configOf, "2026-11")).toBe("2026-10");
    expect(variaveisDoMes(nov, [], "2026-11", configOf).total).toBe(412.5);
    // outubro não lê a chave de novembro: ela só podia contar em novembro
    expect(contaNaFaturaDoMes(nov[0], configOf, "2026-11", "2026-11")).toBe(true);
    expect(contaNaFaturaDoMes(nov[2], configOf, "2026-11", "2026-11")).toBe(false);
    expect(contaNaFaturaDoMes(nov[2], configOf, "2026-11", "2026-12")).toBe(true);
  });

  it("na tela: total de cartões = 412,50 (o mesmo das despesas) e a linha da fatura seguinte mostra os 50", () => {
    const store = criarStore({ "finance-card-config": { nubank: FECHA2 } });
    renderComStore(createElement(TotalPorCartao, { parcelas: [], variableExpenses: nov, variableExpensesAnterior: [], mes: "2026-11" }), store);
    const card = screen.getByTestId("total-por-cartao");
    expect(card).toHaveTextContent("TOTAL CARTÕES");
    expect(screen.getAllByText("R$ 412,50").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("cartao-proxima-fatura")).toHaveTextContent(/fatura de dezembro.*R\$ 50,00/);
  });

  it("a linha da fatura (CONTAS DO MÊS) usa a mesma régua", () => {
    const f = faturasDoMes({ mes: "2026-11", variaveis: nov, variaveisAnterior: [], fixos: [], parcelas: [], cards: ["nubank"], configOf, labelOf: (c) => c, pagas: {} });
    expect(f[0].total).toBe(412.5);
  });
});

/* ═══ "Quando coloco a data de uma compra no cartão, ele joga a informação pro mês anterior, mas o pagamento
 *     final do crédito é feito no mês atual… pra permanecer somando no mês que eu anotar" + "alguns
 *     lançamentos do custo variável sumiram" ═══ */
describe("lançamento com data do mês passado fica no mês em que foi anotado (virada a cada abertura)", () => {
  const anotadoEm = (d: Date) => String(d.getTime());
  const idNov = anotadoEm(new Date(2026, 10, 5, 9, 0));

  it("abrir → lançar a compra de 28/10 em 05/11 → sair → REABRIR em 16/11: continua em novembro", () => {
    const balde = [{ id: idNov, date: "2026-10-28", value: 80 }];
    const r = separarPorMes(balde, new Date(2026, 10, 16), "expenses");
    expect(r.movidos).toBe(0);
    expect(r.ficam.map((i) => i.id)).toEqual([idNov]);
  });

  it("no dia 1º de dezembro vai pro arquivo de NOVEMBRO (onde ela anotou), não de outubro", () => {
    const r = separarPorMes([{ id: idNov, date: "2026-10-28", value: 80 }], new Date(2026, 11, 1), "expenses");
    expect(Object.keys(r.arquivar)).toEqual(["finance-2026-novembro-expenses"]);
  });

  it("o defeito de 01/08 continua resolvido: gasto de maio ANOTADO em maio vai pra maio", () => {
    const idMaio = anotadoEm(new Date(2026, 4, 2));
    const r = separarPorMes([{ id: idMaio, date: "2026-05-01" }], new Date(2026, 7, 2), "expenses");
    expect(Object.keys(r.arquivar)).toEqual(["finance-2026-maio-expenses"]);
  });

  it("id de outro formato (extrato importado, lançamento de fora) e id do futuro seguem pela data", () => {
    const hoje = new Date(2026, 10, 16);
    const r = separarPorMes([
      { id: "1762000000000-e0", date: "2026-10-03" },
      { id: "c0ffee", date: "2026-10-04" },
      { id: String(new Date(2027, 0, 1).getTime()), date: "2026-10-05" },
    ], hoje, "expenses");
    expect(r.arquivar["finance-2026-outubro-expenses"]).toHaveLength(3);
  });

  it("receita idem (mesma passada)", () => {
    const r = separarPorMes([{ id: idNov, date: "2026-10-30" }], new Date(2026, 10, 20), "incomes");
    expect(r.movidos).toBe(0);
  });

  it("no cartão com fechamento a compra de 28/10 anotada em novembro conta em novembro, não some", () => {
    const configOf = () => ({ closingDay: 25, dueDay: 5 });
    const g = { ...compra("x", "2026-10-28", 80), id: idNov };
    expect(variaveisDoMes([g], [], "2026-11", configOf).total).toBe(80);
  });
});

/* ═══ iPhone 1.0.23/1.0.24: "o botão de selecionar a vírgula no teclado do app não está funcionando / não
 *     deixa adicionar centavos" — `type="number"` + vírgula do teclado brasileiro = campo vazio ═══ */
describe("vírgula dos centavos nas tabelas de Finanças", () => {
  it("gasto variável: '12,50' entra como 12,5", () => {
    let gravados: { value: number }[] = [];
    renderComStore(createElement(ExpenseTable, { expenses: [], setExpenses: (l: { value: number }[]) => { gravados = l; }, mes: "2026-11" }), criarStore());
    fireEvent.change(screen.getByPlaceholderText("+ Novo gasto"), { target: { value: "Padaria" } });
    const valor = screen.getByPlaceholderText("Valor") as HTMLInputElement;
    expect(valor.type).toBe("text");
    expect(valor.inputMode).toBe("decimal");
    fireEvent.change(valor, { target: { value: "12,50" } });
    expect(valor.value).toBe("12,50");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar gasto" }));
    expect(gravados).toHaveLength(1);
    expect(gravados[0].value).toBe(12.5);
  });

  it("receita: '1.234,56' entra como 1234,56", () => {
    let gravadas: { value: number }[] = [];
    renderComStore(createElement(IncomeTable, { incomes: [], setIncomes: (l: { value: number }[]) => { gravadas = l; } }), criarStore());
    fireEvent.change(screen.getByPlaceholderText("+ Nova receita"), { target: { value: "Freela" } });
    fireEvent.change(screen.getByPlaceholderText("Valor"), { target: { value: "1.234,56" } });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar receita/i }));
    expect(gravadas[0].value).toBe(1234.56);
  });
});

/* ═══ App Store 3★: "Não organiza os rendimentos por ordem de data, só por ordem de lançamento" ═══ */
describe("receitas: ordenar por data", () => {
  it("as pílulas Ordenar aparecem e 'Data' põe a mais recente primeiro; a lista gravada não muda", () => {
    const incomes = [
      { id: "1", description: "Salário", value: 3000, date: "2026-11-05" },
      { id: "2", description: "Freela", value: 500, date: "2026-11-20" },
      { id: "3", description: "Pix da mãe", value: 100, date: "2026-11-01" },
    ];
    const store = criarStore();
    const setIncomes = vi.fn();
    const { rerender } = renderComStore(createElement(IncomeTable, { incomes, setIncomes }), store);
    const nomes = () => screen.getAllByText(/^(Salário|Freela|Pix da mãe)$/).map((n) => n.textContent);
    expect(nomes()).toEqual(["Salário", "Freela", "Pix da mãe"]);
    fireEvent.click(screen.getByRole("button", { name: "Data" }));
    expect(store.dados["finance-ordem-receitas"]).toBe("data");
    rerender(createElement(UserDataContext.Provider, { value: { ...store.valor } }, createElement(IncomeTable, { incomes, setIncomes })));
    expect(nomes()).toEqual(["Freela", "Salário", "Pix da mãe"]);
    expect(setIncomes).not.toHaveBeenCalled();
  });
});

/* ═══ "Financiamento está em custo fixo, quero em custo variável, mas não consigo porque fala que já tem essa
 *     categoria cadastrada" ═══ */
describe("categoria padrão da outra lista", () => {
  it("o nome de uma padrão (fixo ou variável) devolve a própria padrão — sem personalizada duplicada", () => {
    expect(categoriaPadraoComNome("Financiamento")?.value).toBe("financiamento");
    expect(categoriaPadraoComNome("  financiamento ")?.value).toBe("financiamento");
    expect(categoriaPadraoComNome("Coisa que não existe")).toBeUndefined();
  });

  it("gasto variável com 'financiamento' mostra o nome no seletor (antes ficava vazio)", () => {
    renderComStore(createElement(CategorySelect, { value: "financiamento", onValueChange: () => {}, kind: "variable" }), criarStore());
    expect(screen.getByRole("combobox")).toHaveTextContent("Financiamento");
  });
});


/* ═══════════════ CONSERTOS DA REVISÃO (16/11) ═══════════════ */

/* MÉDIA 1 — retrospectiva/insígnias/card contavam o lançamento atrasado em DOIS meses */
describe("revisão M1: lançamento atrasado conta em UM mês na retrospectiva", () => {
  const agora = new Date(2026, 10, 16, 12, 0);
  const anotadoNov = String(new Date(2026, 10, 5, 9, 0).getTime());
  const loja: Record<string, unknown> = {
    "finance-2026-outubro-expenses": [{ id: "o1", description: "Mercado", date: "2026-10-10", value: 100, paymentMethod: "pix" }],
    "finance-expenses": [
      { id: anotadoNov, description: "Atrasado", date: "2026-10-28", value: 300, paymentMethod: "pix" },
      { id: "n1", description: "Padaria", date: "2026-11-03", value: 50, paymentMethod: "pix" },
    ],
    "finance-2026-outubro-incomes": [{ id: "r1", description: "Salário", date: "2026-10-05", value: 3000 }],
    "finance-incomes": [{ id: anotadoNov, description: "Freela atrasado", date: "2026-10-30", value: 400 }],
  };
  const ler = (k: string) => loja[k];
  const soma = (l: { value?: unknown }[]) => l.reduce((t, i) => t + Number(i.value), 0);

  it("mesDoLancamento: 28/10 anotado em 05/11 é de novembro; sem id Date.now, pela data", () => {
    expect(mesDoLancamento({ id: anotadoNov, date: "2026-10-28" }, agora)).toBe("2026-11");
    expect(mesDoLancamento({ id: "x", date: "2026-10-28" }, agora)).toBe("2026-10");
  });

  it("gasto: outubro 100 (antes 400), novembro 350", () => {
    expect(soma(lerFinancasDoMes(2026, 9, ler, "pessoal", agora).expenses)).toBe(100);
    expect(soma(lerFinancasDoMes(2026, 10, ler, "pessoal", agora).expenses)).toBe(350);
  });

  it("receita: outubro 3000 (antes 3400), novembro 400", () => {
    expect(soma(lerFinancasDoMes(2026, 9, ler, "pessoal", agora).incomes)).toBe(3000);
    expect(soma(lerFinancasDoMes(2026, 10, ler, "pessoal", agora).incomes)).toBe(400);
  });
});

/* MÉDIA 2 — a regra "no dia do fechamento já é a seguinte" não pode mudar mês passado */
describe("revisão M2: corte da regra do dia do fechamento", () => {
  const configOf = () => ({ closingDay: 25, dueDay: 5 });
  it("o corte é uma data simples de ajustar", () => {
    expect(CORTE_FECHAMENTO_NO_DIA).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("compra de 25/10 anotada ANTES do corte (já no histórico) continua em outubro", () => {
    expect(regraDoDiaDoFechamentoVale(ANTES_DO_CORTE)).toBe(false);
    expect(mesDoGasto(compra(ANTES_DO_CORTE, "2026-10-25", 80), configOf, "2026-10")).toBe("2026-10");
  });
  it("sem id de 13 dígitos (extrato, dado antigo): regra antiga", () => {
    expect(mesDoGasto(compra("1762000000000-e0", "2026-11-25", 80), configOf, "2026-11")).toBe("2026-11");
    expect(mesDoGasto(compra("abc", "2026-11-25", 80), configOf, "2026-11")).toBe("2026-11");
  });
  it("compra no dia do fechamento anotada DEPOIS do corte vai pra fatura seguinte", () => {
    expect(regraDoDiaDoFechamentoVale(DEPOIS_DO_CORTE)).toBe(true);
    expect(mesDoGasto(compra(DEPOIS_DO_CORTE, "2026-11-25", 80), configOf, "2026-11")).toBe("2026-12");
  });
  it("depois do fechamento é a seguinte pros dois lados (essa regra não mudou)", () => {
    expect(mesDoGasto(compra(ANTES_DO_CORTE, "2026-10-26", 80), configOf, "2026-10")).toBe("2026-11");
    expect(mesDoGasto(compra("abc", "2026-10-26", 80), configOf, "2026-10")).toBe("2026-11");
  });
});

/* BAIXA — o resto dos campos de dinheiro com type=number + parseFloat */
describe("revisão: vírgula no resto dos campos de dinheiro (CampoDinheiro)", () => {
  it("'12,50' vira 12,5 e '1.234,56' vira 1234,56; o texto digitado fica como está", () => {
    const vistos: (number | undefined)[] = [];
    render(createElement(CampoDinheiro, { valor: undefined, onValor: (n: number | undefined) => vistos.push(n), placeholder: "Preço (R$)" }));
    const campo = screen.getByPlaceholderText("Preço (R$)") as HTMLInputElement;
    expect(campo.type).toBe("text");
    expect(campo.inputMode).toBe("decimal");
    fireEvent.change(campo, { target: { value: "12,50" } });
    expect(campo.value).toBe("12,50");
    expect(vistos.at(-1)).toBe(12.5);
    fireEvent.change(campo, { target: { value: "1.234,56" } });
    expect(vistos.at(-1)).toBe(1234.56);
    fireEvent.change(campo, { target: { value: "" } });
    expect(vistos.at(-1)).toBeUndefined();
  });

  it("os campos de valor de Reserva, Desejos, Investimentos e o gasto rápido da Home não usam mais type=number + parseFloat", async () => {
    const fs = await import("node:fs");
    const ler = (f: string) => fs.readFileSync(`${process.cwd()}/src/components/${f}`, "utf8");
    expect(ler("finance/EmergencyFund.tsx")).not.toMatch(/parseFloat/);
    expect(ler("home/widgets/FinancesWidget.tsx")).not.toMatch(/parseFloat|type="number"/);
    expect(ler("WishlistItems.tsx")).not.toMatch(/parseFloat|type="number"/);
    expect(ler("InvestmentsTracker.tsx")).not.toMatch(/parseFloat|type="number"/);
  });
});

/* OPCIONAL — aviso de 1 linha ao salvar com data de mês passado */
describe("revisão: aviso de data do mês passado", () => {
  const hoje = new Date(2026, 10, 16);
  it("mês passado avisa que fica no mês atual e onde lançar no mês da data", () => {
    expect(avisoDeMesPassado("2026-10-28", hoje)).toBe("Fica em novembro, o mês em que você anotou. Pra lançar em outubro, use a planilha de outubro (Orçamento mensal).");
  });
  it("mês atual, futuro ou sem data: sem aviso", () => {
    expect(avisoDeMesPassado("2026-11-02", hoje)).toBeNull();
    expect(avisoDeMesPassado("2026-12-02", hoje)).toBeNull();
    expect(avisoDeMesPassado("", hoje)).toBeNull();
    expect(avisoDeMesPassado(undefined, hoje)).toBeNull();
  });
});
