/**
 * CHAMADOS DE 01/11 (support_tickets do /admin):
 *  - "puxo o relatório da fatura Nubank e em vez de débito entra como dinheiro a receber;
 *    quando fecho o app some tudo" (Android 131, Finanças)
 *  - "se eu cadastrar uma receita com data do mês seguinte, por que ela já conta no mês atual?"
 *    (iPhone 1.0.22; mais 3 pedidos de receita prevista)
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { ImportExtrato } from "@/components/finance/ImportExtrato";
import { IncomeTable } from "@/components/IncomeTable";
import { guardarReceitaNoMes } from "@/lib/finance-receita-futura";

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
const renderComStore = (ui: React.ReactElement, store = criarStore()) =>
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider></MemoryRouter>);

// formato do CSV da fatura do Nubank: compra positiva, pagamento da fatura negativo
const FATURA_NUBANK = [
  "date,title,amount",
  "2026-10-03,Ifood *Restaurante,45.90",
  "2026-10-05,Uber *Trip,18.40",
  "2026-10-08,Pagamento recebido,-850.00",
  "2026-10-10,Supermercado Dia,132.75",
].join("\n");

const subirArquivo = async (container: HTMLElement, texto: string, nome = "fatura.csv") => {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File([texto], nome, { type: "text/csv" })] } });
  await screen.findByText("Revisar importação");
};

describe("Importar fatura do Nubank", () => {
  it("CSV da fatura já marca 'Fatura do cartão', compras entram como gasto no crédito e o pagamento fica de fora", async () => {
    const setExpenses = vi.fn();
    const setIncomes = vi.fn();
    const { container } = renderComStore(<ImportExtrato expenses={[]} incomes={[]} setExpenses={setExpenses} setIncomes={setIncomes} />);
    await subirArquivo(container, FATURA_NUBANK);

    expect(screen.getByRole("button", { name: "Fatura do cartão" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/fica de fora/)).toBeInTheDocument();
    expect(screen.queryByText("receita")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Importar 3 lançamentos/ }));

    expect(setIncomes).not.toHaveBeenCalled();
    const gastos = setExpenses.mock.calls[0][0];
    expect(gastos).toHaveLength(3);
    expect(gastos.map((g: any) => g.value)).toEqual([45.9, 18.4, 132.75]);
    expect(gastos.every((g: any) => g.paymentMethod === "credito")).toBe(true);
    expect(gastos.find((g: any) => /Ifood/.test(g.description)).category).toBe("delivery");
  });

  it("OFX de cartão (compra negativa, como manda o padrão) não é invertido", async () => {
    const ofx = "<OFX><STMTTRN><TRNAMT>-45.90<DTPOSTED>20261003<MEMO>Ifood</STMTTRN><STMTTRN><TRNAMT>-18.40<DTPOSTED>20261005<MEMO>Uber</STMTTRN><STMTTRN><TRNAMT>850.00<DTPOSTED>20261008<MEMO>Pagamento recebido</STMTTRN></OFX>";
    const setExpenses = vi.fn();
    const setIncomes = vi.fn();
    const { container } = renderComStore(<ImportExtrato expenses={[]} incomes={[]} setExpenses={setExpenses} setIncomes={setIncomes} />);
    await subirArquivo(container, ofx, "fatura.ofx");
    fireEvent.click(screen.getByRole("button", { name: "Fatura do cartão" }));
    fireEvent.click(screen.getByRole("button", { name: /Importar 2 lançamentos/ }));
    expect(setExpenses.mock.calls[0][0].map((g: any) => g.value)).toEqual([45.9, 18.4]);
    expect(setIncomes).not.toHaveBeenCalled();
  });

  it("extrato de conta continua igual: saída vira gasto, entrada vira receita", async () => {
    const csv = ["Data,Valor,Identificador,Descrição", "03/10/2026,-45.90,a1,Compra no débito - Ifood", "05/10/2026,3000.00,a2,Transferência recebida - Salário"].join("\n");
    const setExpenses = vi.fn();
    const setIncomes = vi.fn();
    const { container } = renderComStore(<ImportExtrato expenses={[]} incomes={[]} setExpenses={setExpenses} setIncomes={setIncomes} />);
    await subirArquivo(container, csv);
    expect(screen.getByRole("button", { name: "Conta (Pix/débito)" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Importar 2 lançamentos/ }));
    expect(setExpenses.mock.calls[0][0].map((g: any) => g.value)).toEqual([45.9]);
    expect(setIncomes.mock.calls[0][0].map((g: any) => g.value)).toEqual([3000]);
  });
});

describe("Receita com data de mês futuro", () => {
  const hoje = new Date(2026, 10, 1); // 1º/11/2026

  it("vai pra planilha do mês dela, etiquetada com o perfil, e não soma no mês atual", () => {
    const store = criarStore();
    const r = guardarReceitaNoMes({ id: "1", date: "2026-12-05", value: 4000 } as any, hoje, store.valor.get, store.valor.set, "pessoal");
    expect(r).toBe("Dezembro");
    expect(store.dados["finance-2026-dezembro-incomes"]).toEqual([{ id: "1", date: "2026-12-05", value: 4000, perfil: "pessoal" }]);
    expect(store.dados["finance-incomes"]).toBeUndefined();
  });

  it("virada de ano diz o ano; mês atual ou passado não muda de lugar", () => {
    const store = criarStore();
    expect(guardarReceitaNoMes({ id: "2", date: "2027-01-10" } as any, hoje, store.valor.get, store.valor.set, "pessoal")).toBe("Janeiro de 2027");
    expect(store.dados["finance-2027-janeiro-incomes"]).toHaveLength(1);
    expect(guardarReceitaNoMes({ id: "3", date: "2026-11-20" } as any, hoje, store.valor.get, store.valor.set, "pessoal")).toBeNull();
    expect(guardarReceitaNoMes({ id: "4", date: "2026-10-20" } as any, hoje, store.valor.get, store.valor.set, "pessoal")).toBeNull();
    expect(guardarReceitaNoMes({ id: "5", date: "" } as any, hoje, store.valor.get, store.valor.set, "pessoal")).toBeNull();
  });

  it("na tela: adicionar com data futura guarda fora e não grava na lista do mês; sem data futura grava normal", () => {
    const gravar = vi.fn();
    const guardar = vi.fn((r: any) => (r.date.startsWith("2099") ? "Dezembro de 2099" : null));
    const { container } = renderComStore(<IncomeTable incomes={[]} setIncomes={gravar} guardarEmOutroMes={guardar} />);
    fireEvent.change(screen.getByPlaceholderText("+ Nova receita"), { target: { value: "Bônus" } });
    fireEvent.change(screen.getByPlaceholderText("Valor"), { target: { value: "1500" } });
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: "2099-12-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar receita" }));
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(gravar).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("+ Nova receita"), { target: { value: "Salário" } });
    fireEvent.change(screen.getByPlaceholderText("Valor"), { target: { value: "3000" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar receita" }));
    expect(gravar).toHaveBeenCalledTimes(1);
    expect(gravar.mock.calls[0][0][0]).toMatchObject({ description: "Salário", value: 3000 });
  });

  it("editar a data pra um mês futuro tira a receita da lista do mês", async () => {
    const lista = [{ id: "a", description: "Bônus", value: 1500, date: "2026-11-05" }];
    const gravar = vi.fn();
    const guardar = vi.fn((r: any) => (r.date.startsWith("2099") ? "Janeiro de 2099" : null));
    const { container } = renderComStore(<IncomeTable incomes={lista} setIncomes={gravar} guardarEmOutroMes={guardar} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar Bônus" }));
    const datas = container.querySelectorAll('input[type="date"]');
    fireEvent.change(datas[datas.length - 1], { target: { value: "2099-01-05" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    await waitFor(() => expect(gravar).toHaveBeenCalledWith([]));
    expect(guardar.mock.calls[0][0]).toMatchObject({ id: "a", date: "2099-01-05" });
  });
});
