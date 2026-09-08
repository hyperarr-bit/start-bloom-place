/**
 * Parcelas que atravessam os meses, fatura do cartão e conta recorrente
 * (07/09). Cada bloco cita a avaliação da Play (set/2026) que o motivou.
 *
 * Ciclo completo (regra da casa, 19/07): lançar → sair → reabrir no mês
 * seguinte. Aqui "reabrir" é chamar a virada com o mês novo — é o que o
 * hook do App faz na primeira abertura.
 */
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import {
  type Parcela, viradaDeParcelas, projetarParcelas, parcelaDoMes, parcelaAtiva, parcelaPagaNoMes,
  marcarParcelaDoMes, somaParcelasDoMes, carimbarLista, mesesEntre, somarMeses, mesIdDe, chaveArquivadaDeParcelas,
} from "@/lib/finance-parcelas";
import { computeMonthlyOutflow } from "@/lib/finance-totals";
import { mesDaFatura, mesDoGasto, variaveisDoMes, rotuloVencimento, type CardConfig } from "@/lib/finance-fatura";
import { InstallmentTracker } from "@/components/InstallmentTracker";
import { ExpenseTable } from "@/components/ExpenseTable";
import { FixedExpensesTable } from "@/components/FixedExpensesTable";

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

const parcela = (extra: Partial<Parcela> = {}): Parcela => ({
  id: "p1", description: "Celular", totalValue: 1200, installmentValue: 100,
  paidInstallments: 0, totalInstallments: 12, cardName: "nubank", category: "eletronicos", date: "2026-09-10",
  ...extra,
});

/* ============================================================
 * PARCELAS ATRAVESSAM OS MESES — 3★ "não é repetida para os próximos meses
 * até finalizar" / 4★ "não atualiza para o próximo mês, tendo que adicionar
 * novamente"
 * ============================================================ */
describe("Parcela criada em setembro aparece em outubro como 2 de 12", () => {
  it("lançar em set → reabrir em out: avança no balde e deixa retrato em setembro", () => {
    // lançar: o card carimba com o mês da chave
    const balde = carimbarLista([parcela()], "2026-09");
    expect(balde[0].startMonth).toBe("2026-09");
    expect(parcelaDoMes(balde[0])).toBe(1);

    // reabrir em outubro
    const v = viradaDeParcelas(balde, "2026-10");
    expect(v).not.toBeNull();
    const out = v!.lista[0];
    expect(out.startMonth).toBe("2026-10");
    expect(parcelaDoMes(out)).toBe(2);
    expect(out.paidInstallments).toBe(1); // a de setembro conta como paga
    expect(parcelaPagaNoMes(out)).toBe(false); // a de outubro ainda não
    expect(out.id).toBe("p1"); // mesmo id: a pessoa não vê "outra" dívida

    // setembro guarda o retrato de como estava, marcado como já levado
    expect(v!.arquivos["2026-09"]).toHaveLength(1);
    expect(v!.arquivos["2026-09"][0].levada).toBe(true);
    expect(parcelaDoMes(v!.arquivos["2026-09"][0])).toBe(1);
  });

  it("é idempotente: a segunda abertura do mesmo mês não faz nada", () => {
    const v = viradaDeParcelas(carimbarLista([parcela()], "2026-09"), "2026-10")!;
    expect(viradaDeParcelas(v.lista, "2026-10")).toBeNull();
  });

  it("ficou 3 meses sem abrir: pula direto pra 4 de 12 e preenche os meses do meio", () => {
    const v = viradaDeParcelas(carimbarLista([parcela()], "2026-09"), "2026-12")!;
    expect(parcelaDoMes(v.lista[0])).toBe(4);
    expect(v.lista[0].paidInstallments).toBe(3);
    expect(Object.keys(v.arquivos).sort()).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(parcelaDoMes(v.arquivos["2026-11"][0])).toBe(3);
  });

  it("aparece em X … X+N-1 e some depois: 12 parcelas de setembro acabam em agosto do ano seguinte", () => {
    let lista = carimbarLista([parcela()], "2026-09");
    let mes = "2026-09";
    for (let i = 0; i < 11; i++) {
      mes = somarMeses(mes, 1);
      lista = viradaDeParcelas(lista, mes)!.lista;
      expect(parcelaAtiva(lista[0])).toBe(true);
    }
    expect(mes).toBe("2027-08");
    expect(parcelaDoMes(lista[0])).toBe(12);
    expect(somaParcelasDoMes(lista)).toBe(100);
    // setembro/2027: quitou — não custa mais nada no mês
    lista = viradaDeParcelas(lista, "2027-09")!.lista;
    expect(parcelaAtiva(lista[0])).toBe(false);
    expect(somaParcelasDoMes(lista)).toBe(0);
    expect(lista[0].paidInstallments).toBe(12);
  });

  it("DADO ANTIGO sem startMonth continua funcionando: k = pagas + 1 e a virada não mexe", () => {
    const legado = parcela({ paidInstallments: 3 });
    expect(parcelaDoMes(legado)).toBe(4);
    expect(parcelaPagaNoMes(legado)).toBe(false);
    expect(somaParcelasDoMes([legado])).toBe(100);
    expect(viradaDeParcelas([legado], "2026-10")).toBeNull();
    // o carimbo entra na primeira gravação da pessoa, assumindo o mês da chave
    const [carimbado] = carimbarLista([legado], "2026-10");
    expect(carimbado.startMonth).toBe("2026-10");
    expect(parcelaDoMes(carimbado)).toBe(4);
    // e dali em diante avança como as novas
    expect(parcelaDoMes(viradaDeParcelas([carimbado], "2026-11")!.lista[0])).toBe(5);
  });

  it("checkbox reflete o estado real: marcar paga a parcela do mês, desmarcar volta", () => {
    const p = carimbarLista([parcela()], "2026-09")[0];
    const paga = marcarParcelaDoMes(p, true, "2026-09");
    expect(parcelaPagaNoMes(paga)).toBe(true);
    expect(paga.paidInstallments).toBe(1);
    expect(parcelaDoMes(paga)).toBe(1); // "1 de 12" não pula pra 2 dentro do mesmo mês
    expect(somaParcelasDoMes([paga])).toBe(100); // o dinheiro saiu do mês mesmo assim
    const desmarcada = marcarParcelaDoMes(paga, false, "2026-09");
    expect(parcelaPagaNoMes(desmarcada)).toBe(false);
    expect(desmarcada.paidInstallments).toBe(0);
    // legado: marcar também carimba, senão o checkbox voltaria a "desmarcado"
    const legadoPago = marcarParcelaDoMes(parcela({ paidInstallments: 3 }), true, "2026-09");
    expect(parcelaDoMes(legadoPago)).toBe(4);
    expect(legadoPago.paidInstallments).toBe(4);
    expect(parcelaPagaNoMes(legadoPago)).toBe(true);
  });

  it("parcela nascida na planilha de agosto é trazida pro balde UMA vez — apagar é definitivo", () => {
    const agosto: Parcela[] = carimbarLista([parcela({ id: "ag1", date: "2026-08-05" })], "2026-08");
    const fontes = [{ mes: "2026-08", itens: agosto }];
    const v = viradaDeParcelas([], "2026-09", fontes)!;
    expect(v.lista).toHaveLength(1);
    expect(parcelaDoMes(v.lista[0])).toBe(2);
    expect(v.fontesAtualizadas["2026-08"][0].levada).toBe(true);
    // a pessoa apaga do balde; na próxima abertura a origem já está `levada`
    const depois = viradaDeParcelas([], "2026-09", [{ mes: "2026-08", itens: v.fontesAtualizadas["2026-08"] }]);
    expect(depois).toBeNull();
  });

  it("registro criado 'por antecipação' na planilha de outubro entra no balde quando outubro chega", () => {
    const outubro = carimbarLista([parcela({ id: "fut" })], "2026-10");
    const v = viradaDeParcelas([], "2026-10", [{ mes: "2026-10", itens: outubro }])!;
    expect(v.lista[0].id).toBe("fut");
    expect(parcelaDoMes(v.lista[0])).toBe(1);
  });

  it("planilha de um mês futuro mostra a projeção (previsto), sem gravar nada", () => {
    const balde = carimbarLista([parcela()], "2026-09");
    const proj = projetarParcelas([{ mes: "2026-09", itens: balde }], "2026-11", []);
    expect(proj).toHaveLength(1);
    expect(parcelaDoMes(proj[0])).toBe(3);
    // a versão mais recente do mesmo id ganha; quem já mora na planilha fica de fora
    expect(projetarParcelas([{ mes: "2026-09", itens: balde }], "2026-11", balde)).toHaveLength(0);
    // quitadas não aparecem
    expect(projetarParcelas([{ mes: "2026-09", itens: balde }], "2027-09", [])).toHaveLength(0);
  });

  it("helpers de mês: virada de ano e chave arquivada", () => {
    expect(mesesEntre("2026-11", "2027-02")).toBe(3);
    expect(somarMeses("2026-12", 1)).toBe("2027-01");
    expect(somarMeses("2027-01", -1)).toBe("2026-12");
    expect(mesIdDe("Março", 2026)).toBe("2026-03");
    expect(chaveArquivadaDeParcelas("2026-03")).toBe("finance-2026-marco-installments");
  });
});

describe("InstallmentTracker: k de N, checkbox real e lápis visível (3★ 'áreas não clicáveis')", () => {
  it("mostra '3 de 12', checkbox desmarcado, e marcar grava paidInstallments = 3", () => {
    let gravado: Parcela[] = [];
    const lista = [parcela({ startMonth: "2026-09", parcelaDoMes: 3, paidInstallments: 2 })];
    renderComStore(
      createElement(InstallmentTracker, { installments: lista, setInstallments: (l: Parcela[]) => { gravado = l; }, mes: "2026-09" }),
      criarStore(),
    );
    expect(screen.getByText("3 de 12")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Editar Celular/i })).toBeInTheDocument();
    const cb = screen.getByRole("checkbox", { name: /Marcar parcela 3 de Celular como paga/i });
    expect(cb).toHaveAttribute("aria-checked", "false");
    fireEvent.click(cb);
    expect(gravado[0].paidInstallments).toBe(3);
    expect(parcelaPagaNoMes(gravado[0])).toBe(true);
  });

  it("parcela prevista (de outro mês) entra no total mas não tem checkbox nem lixeira", () => {
    renderComStore(
      createElement(InstallmentTracker, {
        installments: [], setInstallments: () => {}, mes: "2026-11",
        projetadas: [parcela({ startMonth: "2026-11", parcelaDoMes: 3, paidInstallments: 2 })],
      }),
      criarStore(),
    );
    expect(screen.getByText("previsto")).toBeInTheDocument();
    expect(screen.getByText("3 de 12")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Apagar Celular/i })).not.toBeInTheDocument();
    // TOTAL MENSAL do card = a parcela prevista (linha + rodapé, por isso "all")
    expect(screen.getAllByText("R$ 100,00").length).toBeGreaterThanOrEqual(2);
  });
});

/* ============================================================
 * UM TOTAL SÓ — DESPESAS da planilha e o outflow do Index
 * ============================================================ */
describe("Um total só entre a planilha do mês e o financeiro geral", () => {
  it("computeMonthlyOutflow inclui as parcelas do mês — a planilha ignorava", () => {
    const lista = [parcela({ startMonth: "2026-09", parcelaDoMes: 2 }), parcela({ id: "q", startMonth: "2026-09", parcelaDoMes: 13, paidInstallments: 12 })];
    const parcelas = somaParcelasDoMes(lista);
    expect(parcelas).toBe(100); // a quitada não conta
    const antigo = 500 + 1000; // variáveis + fixos, como a MonthlySheet fazia
    const unico = computeMonthlyOutflow(500, 1000, parcelas);
    expect(unico).toBe(1600);
    expect(unico).not.toBe(antigo);
  });
});

/* ============================================================
 * FATURA DO CARTÃO — 4★ "toda compra no crédito é somado nas despesas do
 * mês, ao invés de ser somado na fatura do próximo mês… data de vencimento"
 * ============================================================ */
describe("Mês da fatura pelo dia de fechamento", () => {
  it("compra no dia do fechamento ou antes fica no mês; depois vai pro seguinte", () => {
    expect(mesDaFatura("2026-09-20", 20)).toBe("2026-09");
    expect(mesDaFatura("2026-09-21", 20)).toBe("2026-10");
    expect(mesDaFatura("2026-09-05", 20)).toBe("2026-09");
  });

  it("virada de ano: compra em 31/12 depois do fechamento cai em janeiro do ano seguinte", () => {
    expect(mesDaFatura("2026-12-31", 25)).toBe("2027-01");
    expect(mesDaFatura("2026-12-20", 25)).toBe("2026-12");
  });

  it("data ilegível ou fechamento inválido → null (quem chama usa o mês da chave)", () => {
    expect(mesDaFatura("ontem", 20)).toBeNull();
    expect(mesDaFatura("2026-09-21", 0)).toBeNull();
    expect(mesDaFatura("2026-09-21", undefined)).toBeNull();
  });

  it("só crédito em cartão COM fechamento muda de mês; o resto é o comportamento de sempre", () => {
    const cfg: Record<string, CardConfig> = { nubank: { closingDay: 20, dueDay: 27 } };
    const configOf = (c: string) => cfg[c];
    expect(mesDoGasto({ date: "2026-09-25", paymentMethod: "credito", cardName: "nubank" }, configOf, "2026-09")).toBe("2026-10");
    expect(mesDoGasto({ date: "2026-09-25", paymentMethod: "debito", cardName: "nubank" }, configOf, "2026-09")).toBe("2026-09");
    expect(mesDoGasto({ date: "2026-09-25", paymentMethod: "credito", cardName: "itau" }, configOf, "2026-09")).toBe("2026-09");
    expect(mesDoGasto({ date: "2026-09-25", paymentMethod: "pix" }, configOf, "2026-09")).toBe("2026-09");
  });

  it("variáveis do mês: adiado sai deste mês e o do mês anterior entra", () => {
    const cfg: Record<string, CardConfig> = { nubank: { closingDay: 20 } };
    const configOf = (c: string) => cfg[c];
    const setembro = [
      { id: "a", value: 100, date: "2026-09-10", paymentMethod: "credito", cardName: "nubank" },
      { id: "b", value: 50, date: "2026-09-25", paymentMethod: "credito", cardName: "nubank" }, // fatura de out.
      { id: "c", value: 30, date: "2026-09-25", paymentMethod: "pix" },
    ];
    const agosto = [
      { id: "z", value: 70, date: "2026-08-28", paymentMethod: "credito", cardName: "nubank" }, // fatura de set.
      { id: "y", value: 10, date: "2026-08-10", paymentMethod: "credito", cardName: "nubank" },
    ];
    const r = variaveisDoMes(setembro, agosto, "2026-09", configOf);
    expect(r.total).toBe(100 + 30 + 70);
    expect(r.adiados.map((g) => g.id)).toEqual(["b"]);
    expect(r.doMesAnterior.map((g) => g.id)).toEqual(["z"]);
    // sem fechamento cadastrado: soma de sempre, nada vem do mês anterior
    const semCfg = variaveisDoMes(setembro, agosto, "2026-09", () => undefined);
    expect(semCfg.total).toBe(180);
    expect(semCfg.adiados).toHaveLength(0);
  });

  it("rótulo do vencimento: antes do fechamento = mês seguinte", () => {
    expect(rotuloVencimento({ closingDay: 20, dueDay: 27 })).toBe("vence dia 27");
    expect(rotuloVencimento({ closingDay: 28, dueDay: 5 })).toBe("vence dia 5 do mês seguinte");
    expect(rotuloVencimento({ closingDay: 28 })).toBeNull();
  });

  it("card do cartão mostra 'Fatura de setembro · vence dia 27' e o total da fatura", () => {
    const store = criarStore({ "finance-card-config": { nubank: { closingDay: 20, dueDay: 27 } } });
    renderComStore(
      createElement(InstallmentTracker, {
        installments: [parcela({ startMonth: "2026-09", parcelaDoMes: 1 })],
        setInstallments: () => {},
        mes: "2026-09",
        variableExpenses: [
          { id: "a", value: 100, date: "2026-09-10", paymentMethod: "credito", cardName: "nubank" },
          { id: "b", value: 50, date: "2026-09-25", paymentMethod: "credito", cardName: "nubank" },
        ],
        variableExpensesAnterior: [{ id: "z", value: 70, date: "2026-08-28", paymentMethod: "credito", cardName: "nubank" }],
      }),
      store,
    );
    expect(screen.getByText(/Fatura de setembro · vence dia 27/i)).toBeInTheDocument();
    // parcela 100 + gastos na fatura (100 de set. + 70 de ago.; os 50 vão pra out.) = 270
    // linha do Nubank e rodapé TOTAL CARTÕES: os dois dizem 270
    expect(screen.getAllByText("R$ 270,00")).toHaveLength(2);
    // os R$ 50 de 25/09 NÃO estão na fatura de setembro
    expect(screen.queryByText("R$ 320,00")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fechamento e vencimento do cartão Nubank/i })).toBeInTheDocument();
  });
});

/* ============================================================
 * CONTA RECORRENTE — 4★ "as contas recorrentes. Não consegui fazer"
 * ============================================================ */
describe("'Repete todo mês' no lançamento de gasto cria o custo fixo com Dia", () => {
  it("toggle ligado + salvar → vai pra CUSTOS FIXOS (com day), não pros variáveis", () => {
    let fixos: any[] = [];
    let variaveis: any[] = [];
    const store = criarStore();
    renderComStore(
      createElement("div", null,
        createElement(FixedExpensesTable, { expenses: [], setExpenses: (l: any[]) => { fixos = l; } }),
        createElement(ExpenseTable, { expenses: [], setExpenses: (l: any[]) => { variaveis = l; }, mes: "2026-09" }),
      ),
      store,
    );
    // o cabeçalho diz com todas as letras o que o card é
    expect(screen.getByText(/contas recorrentes · repetem todo mês/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("+ Novo gasto"), { target: { value: "Academia" } });
    fireEvent.change(screen.getAllByPlaceholderText("Valor")[1], { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: /Repete todo mês \(conta recorrente\)/i }));
    fireEvent.change(screen.getByLabelText(/Dia em que a conta recorrente vence/i), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar gasto" }));

    expect(variaveis).toHaveLength(0);
    expect(fixos).toHaveLength(1);
    expect(fixos[0]).toMatchObject({ description: "Academia", value: 120, day: 10 });
  });
});
