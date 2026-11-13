/**
 * Bugs e pedidos do levantamento de 05/11 (sugestoes-clientes.md): balanço anual, 1ª parcela em mês futuro, gratidão
 * da Home, fixos no crédito, frase do fechamento e o atalho "até domingo". O item do tablet não mudou código: a rotação
 * já é liberada no MainActivity desde 13/09.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState, type ReactNode } from "react";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { InstallmentTracker, NOVO_PARCELAMENTO_EVENT, type NovoParcelamentoDetalhe } from "@/components/InstallmentTracker";
import { TotalPorCartao } from "@/components/finance/TotalPorCartao";
import { TasksWidget } from "@/components/home/widgets/TasksWidget";
import { getMonthTotals } from "@/components/finance/storage-keys";
import { adiantarParcela, projetarParcelas, somaParcelasDoMes, viradaDeParcelas, type Parcela } from "@/lib/finance-parcelas";
import { juntarGratidao } from "@/lib/gratidao";
import { faturasDoMes } from "@/lib/finance-faturas";
import { CHAVE_TAREFAS_ROTINA, domingoDaSemana, type TarefaDoDia } from "@/lib/tarefas";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isSubscribed: true, user: null }) }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(), trackEventBeacon: vi.fn(), markActivation: vi.fn(async () => {}),
}));

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const valor = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (JSON.parse(JSON.stringify(dados[key])) as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true, isGuest: true, fetchKey: async () => null,
  } as unknown as UserDataContextType;
  return { dados, valor };
};
type Store = ReturnType<typeof criarStore>;
const comStore = (store: Store, ui: ReactNode) =>
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider></MemoryRouter>);

const DEZ = "finance-2026-dezembro-installments";
const parcela = (extra: Partial<Parcela> = {}): Parcela => ({
  id: "p", description: "Sofá", totalValue: 3000, installmentValue: 500, paidInstallments: 0, totalInstallments: 6,
  cardName: "outro", category: "casa", date: "2026-12-10", ...extra,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 5, 10, 0)); // quinta, 05/11/2026
  vi.mocked(toast.success).mockClear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); delete (window as unknown as Record<string, unknown>).__PREVIEW_SEEDS__; });

describe("bug 1: balanço anual", () => {
  const totais = (itens: unknown[]) => {
    (window as unknown as Record<string, unknown>).__PREVIEW_SEEDS__ = { "finance-2026-outubro-installments": itens };
    return getMonthTotals("Outubro", null, 2026, "pessoal").dividas;
  };
  it("soma a parcela do mês, não o que falta da dívida", () => {
    expect(totais([parcela({ paidInstallments: 2, parcelaDoMes: 3, startMonth: "2026-10", totalInstallments: 12 })])).toBe(500);
  });
  it("parcela que ainda não começou fica fora, igual ao resto do app", () => {
    const naoComecou = parcela({ date: "2026-12-10", startMonth: "2026-10", parcelaDoMes: 1 });
    expect(somaParcelasDoMes([naoComecou])).toBe(0);
    expect(totais([naoComecou])).toBe(0);
    expect(totais([{ ...naoComecou, levada: true }])).toBe(500); // retrato é história
  });
  it("bate com a conta do resto do app: paga no mês continua contando, quitada antes não conta, legado usa pagas + 1", () => {
    const itens = [
      parcela({ id: "a", paidInstallments: 3, parcelaDoMes: 3, startMonth: "2026-10" }), // paga, segue no mês
      parcela({ id: "b", paidInstallments: 6, parcelaDoMes: 7, startMonth: "2026-10" }), // acabou antes do mês
      parcela({ id: "c", paidInstallments: 6, parcelaDoMes: 3, startMonth: "2026-10" }), // adiantou tudo, segue no mês
      parcela({ id: "d", paidInstallments: 2 }), // legado
      parcela({ id: "e", paidInstallments: 6 }), // legado quitado
    ];
    expect(totais(itens)).toBe(somaParcelasDoMes(itens));
    expect(totais(itens)).toBe(1500);
  });
});

/** O pai de verdade guarda a lista em estado; aqui espelha no store como o usePersistedState. */
const Planilha = ({ store, mes = "2026-11", chave = "finance-installments" }: { store: Store; mes?: string; chave?: string }) => {
  const [lista, setLista] = useState<Parcela[]>(() => store.valor.get<Parcela[]>(chave, []));
  return <InstallmentTracker installments={lista} setInstallments={(l) => { store.dados[chave] = l; setLista(l); }} mes={mes} />;
};
const lancar = (data: string) => {
  fireEvent.click(screen.getByText("Novo Parcelamento"));
  fireEvent.change(screen.getByPlaceholderText("Nome do item"), { target: { value: "Sofá" } });
  fireEvent.change(screen.getByPlaceholderText("Valor total"), { target: { value: "3000" } });
  fireEvent.change(screen.getByLabelText("Total de parcelas"), { target: { value: "6" } });
  fireEvent.change(screen.getByLabelText("1ª parcela"), { target: { value: data } });
};

describe("bug 2: 1ª parcela em mês futuro", () => {
  const lista = (store: Store) => store.dados["finance-installments"] as Parcela[];

  it("o ciclo: lança com dezembro, fica na lista sem contar em novembro, sai, reabre, e conta em dezembro", () => {
    const store = criarStore({ "finance-installments": [] });
    const r = comStore(store, <Planilha store={store} />);
    lancar("2026-12-10");
    expect(screen.getByTestId("previa-parcelamento").textContent).toBe("Em dezembro: parcela 1 de 6 (R$ 500,00) · faltam 6, a última em mai");
    fireEvent.click(screen.getByText("Salvar"));
    expect(lista(store)).toEqual([expect.objectContaining({ description: "Sofá", startMonth: "2026-11", parcelaDoMes: 1, paidInstallments: 0 })]);
    expect(store.dados[DEZ]).toBeUndefined();
    expect(toast.success).toHaveBeenCalledWith("A 1ª parcela entra em dezembro", expect.anything());
    expect(somaParcelasDoMes(lista(store))).toBe(0);
    r.unmount();
    comStore(store, <Planilha store={store} />);
    expect(screen.getByTestId("comeca-em").textContent).toBe("Começa em dezembro");
    expect(screen.queryByRole("checkbox", { name: /parcela 1 de Sofá/ })).toBeNull();
    const v = viradaDeParcelas(lista(store), "2026-12", [])!;
    expect(v.lista[0]).toMatchObject({ parcelaDoMes: 1, startMonth: "2026-12", paidInstallments: 0 });
    expect(v.arquivos).toEqual({});
    expect(somaParcelasDoMes(v.lista)).toBe(500);
  });

  it("data deste mês, passada ou vazia continua como sempre", () => {
    const store = criarStore({ "finance-installments": [] });
    comStore(store, <Planilha store={store} />);
    lancar("2026-11-20");
    expect(screen.getByTestId("previa-parcelamento").textContent).toMatch(/^Este mês: parcela 1 de 6/);
    fireEvent.click(screen.getByText("Salvar"));
    expect(somaParcelasDoMes(lista(store))).toBe(500);
    expect(screen.queryByTestId("comeca-em")).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("dado antigo com data futura para de contar agora, sem escrita ao abrir, e o aviso aparece na lista", () => {
    const antigo = parcela({ startMonth: "2026-11", parcelaDoMes: 1 });
    const store = criarStore({ "finance-installments": [antigo] });
    comStore(store, <Planilha store={store} />);
    expect(store.dados["finance-installments"]).toEqual([antigo]);
    expect(screen.getByTestId("comeca-em").textContent).toBe("Começa em dezembro");
    expect(somaParcelasDoMes([antigo])).toBe(0);
  });

  it("corrigir a data resolve na hora: pra frente sai do mês, de volta pra este mês entra", () => {
    const store = criarStore({ "finance-installments": [parcela({ date: "2026-11-05", startMonth: "2026-11", parcelaDoMes: 1 })] });
    comStore(store, <Planilha store={store} />);
    const trocaData = (data: string) => {
      fireEvent.click(screen.getByRole("button", { name: "Editar Sofá" }));
      fireEvent.change(screen.getByLabelText(/1ª parcela/), { target: { value: data } });
      fireEvent.click(screen.getByText("Salvar"));
    };
    trocaData("2026-12-10");
    expect(toast.success).toHaveBeenCalledWith("A 1ª parcela entra em dezembro", expect.anything());
    expect(somaParcelasDoMes(lista(store))).toBe(0);
    trocaData("2026-11-10");
    expect(somaParcelasDoMes(lista(store))).toBe(500);
  });

  it("o '+ Novo gasto' parcelado passa pela mesma porta e avisa quando começa", () => {
    const store = criarStore({ "finance-installments": [] });
    comStore(store, <Planilha store={store} />);
    const detalhe: NovoParcelamentoDetalhe = { installment: parcela(), handled: false };
    window.dispatchEvent(new CustomEvent(NOVO_PARCELAMENTO_EVENT, { detail: detalhe }));
    expect(detalhe).toMatchObject({ handled: true, comecaEm: "dezembro" });
    expect(lista(store)).toHaveLength(1);
  });

  it("junto com antecipar: quando dezembro chega dá baixa e adianta; janeiro projeta paga e a virada mantém", () => {
    const guardada = parcela({ startMonth: "2026-12", parcelaDoMes: 1 });
    const store = criarStore({ [DEZ]: [guardada] });
    comStore(store, <Planilha store={store} mes="2026-12" chave={DEZ} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /parcela 1 de Sofá/ }));
    fireEvent.click(screen.getByText("+ Paguei a de jan"));
    cleanup();

    const [p] = store.dados[DEZ] as Parcela[];
    expect(p).toMatchObject({ paidInstallments: 2, parcelaDoMes: 1 });
    const [jan] = projetarParcelas([{ mes: "2026-12", itens: [p] }], "2027-01", []);
    expect(jan).toMatchObject({ parcelaDoMes: 2, paidInstallments: 2 });
    const v = viradaDeParcelas([], "2026-12", [{ mes: "2026-12", itens: [p] }])!;
    expect(v.lista[0]).toMatchObject({ paidInstallments: 2, parcelaDoMes: 1 });
    expect(adiantarParcela(v.lista[0], "2026-12").paidInstallments).toBe(3);
  });
});

describe("bug 3: gratidão da Home", () => {
  it("junta as duas chaves sem repetir a frase do mesmo dia e sem mudar o que recebeu", () => {
    const modulo = { "2026-11-04": ["Família", "", "Saúde"] };
    const home = { "2026-11-04": [" família ", "Café"], "2026-11-05": ["Sol"] };
    const copia = JSON.stringify([modulo, home]);
    expect(juntarGratidao(modulo, home)).toEqual({ "2026-11-04": ["Família", "Saúde", "Café"], "2026-11-05": ["Sol"] });
    expect(JSON.stringify([modulo, home])).toBe(copia);
  });
  it("registro torto de qualquer chave não derruba a tela", () => {
    expect(juntarGratidao({ a: "texto", b: null, c: [1, "ok"] }, null)).toEqual({ c: ["ok"] });
    expect(juntarGratidao(undefined, undefined)).toEqual({});
  });
});

describe("pedidos 5 e 6: total por cartão", () => {
  const CFG = { "finance-card-config": { nubank: { dueDay: 20, closingDay: 10 } } };
  const NETFLIX = { id: "n", description: "Netflix", value: 40, paymentMethod: "credito", cardName: "nubank" };
  const linha = () => screen.getByText("Nubank").closest("tr")!;
  const monta = (props: Partial<React.ComponentProps<typeof TotalPorCartao>>, dados: Record<string, unknown> = CFG) =>
    comStore(criarStore(dados), <TotalPorCartao parcelas={[]} mes="2026-11" {...props} />);

  it("fixo no crédito soma com compra e parcela, uma vez só, e bate com a fatura do mês", () => {
    const compra = { id: "c", description: "Mercado", value: 100, date: "2026-11-05", paymentMethod: "credito", cardName: "nubank" };
    const p = parcela({ cardName: "nubank", date: "2026-11-05", startMonth: "2026-11", parcelaDoMes: 1, installmentValue: 60 });
    monta({ parcelas: [p], variableExpenses: [compra], fixos: [NETFLIX] });
    expect(within(linha()).getByText("R$ 140,00")).toBeInTheDocument(); // gastos
    expect(within(linha()).getByText("R$ 200,00")).toBeInTheDocument(); // total
    const [f] = faturasDoMes({ mes: "2026-11", cards: ["nubank"], variaveis: [compra], variaveisAnterior: [], parcelas: [p], fixos: [NETFLIX], configOf: () => ({ dueDay: 20, closingDay: 10 }), labelOf: () => "Nubank", pagas: {} } as never);
    expect(f.total).toBe(200);
  });

  it("fica de fora: fixo no Pix, sem cartão, valor torto e o fixo que é o pagamento da própria fatura", () => {
    monta({ fixos: [
      NETFLIX,
      { ...NETFLIX, id: "a", paymentMethod: "pix" },
      { ...NETFLIX, id: "b", cardName: "" },
      { ...NETFLIX, id: "c", value: null },
      { ...NETFLIX, id: "d", category: "fatura_cartao", value: 900 },
    ] });
    expect(within(linha()).getAllByText("R$ 40,00")).toHaveLength(2);
  });

  it("frase do fechamento: aparece uma vez com cartões sem fechamento e some quando todos têm", () => {
    const fixos = [NETFLIX, { ...NETFLIX, id: "i", cardName: "inter" }, { ...NETFLIX, id: "o", cardName: "outro" }];
    monta({ fixos }, {});
    expect(screen.getAllByTestId("dica-fechamento")).toHaveLength(1);
    cleanup();
    monta({ fixos: [NETFLIX] });
    expect(screen.queryByTestId("dica-fechamento")).toBeNull();
    cleanup();
    monta({ fixos: [NETFLIX] }, { "finance-card-config": { nubank: { dueDay: 20, mesDoVencimento: true } } });
    expect(screen.queryByTestId("dica-fechamento")).toBeNull(); // quem veio do Montar já escolheu
  });
});

describe("pedido 7: atalho até domingo", () => {
  it("acha o domingo da semana, atravessa o mês e não pula o próprio domingo", () => {
    expect(domingoDaSemana("2026-11-05")).toBe("2026-11-08");
    expect(domingoDaSemana("2026-11-08")).toBe("2026-11-08");
    expect(domingoDaSemana("2026-11-09")).toBe("2026-11-15");
    expect(domingoDaSemana("2026-12-28")).toBe("2027-01-03");
  });

  it("o ciclo: um toque põe o prazo, grava, e a tarefa reaberta segue com ele", () => {
    const store = criarStore();
    const r = comStore(store, <TasksWidget />);
    fireEvent.click(screen.getByTestId("nova-tarefa"));
    const folha = screen.getByTestId("folha-nova-tarefa");
    fireEvent.change(within(folha).getByLabelText("O que precisa fazer"), { target: { value: "Ligar pro banco" } });
    fireEvent.click(within(folha).getByRole("button", { name: "Até domingo" }));
    expect(within(folha).queryByRole("button", { name: "Até domingo" })).toBeNull();
    expect((within(folha).getByLabelText("Prazo da tarefa") as HTMLInputElement).value).toBe("2026-11-08");
    fireEvent.click(within(folha).getByRole("button", { name: "Salvar tarefa" }));
    expect((store.dados[CHAVE_TAREFAS_ROTINA] as TarefaDoDia[])[0]).toMatchObject({ texto: "Ligar pro banco", prazo: "2026-11-08" });
    r.unmount();
    comStore(store, <TasksWidget />);
    expect(screen.getByText("Ligar pro banco")).toBeInTheDocument();
  });

  it("com a tarefa pra depois do domingo, o atalho usa o domingo da semana dela", () => {
    const store = criarStore();
    comStore(store, <TasksWidget />);
    fireEvent.click(screen.getByTestId("nova-tarefa"));
    const folha = screen.getByTestId("folha-nova-tarefa");
    fireEvent.change(within(folha).getByLabelText("Escolher dia"), { target: { value: "2026-11-10" } });
    fireEvent.click(within(folha).getByRole("button", { name: "Até domingo" }));
    expect((within(folha).getByLabelText("Prazo da tarefa") as HTMLInputElement).value).toBe("2026-11-15");
  });
});
