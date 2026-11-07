/**
 * GASTO NO CRÉDITO SEM DATA NUMA PLANILHA DE MÊS ANTIGO (bug "credito-sem-data", 07/11).
 *
 * 07/11, planilha de setembro, cartão com fechamento 25, "R$ 300" sem data. O gasto
 * ganhava a data de HOJE (2026-11-07) e ia pra chave de setembro. Pela regra do
 * fechamento (lib/finance-fatura) a fatura dele é a de novembro — 2 meses à frente
 * da chave. Setembro não conta (é "adiado"), outubro lê setembro procurando
 * "2026-10" e não acha, novembro lê outubro, onde o gasto não está: os R$ 300
 * somem de todos os meses. O "mês do vencimento" já tinha a trava "nunca mais de
 * 1 mês à frente da chave"; a regra do fechamento não.
 *
 * Dois consertos:
 *   · lib/finance-fatura `mesDoGasto`: com fechamento, a fatura também nunca passa
 *     de 1 mês à frente da chave (é até onde o mês seguinte lê pra trás);
 *   · ExpenseTable: gasto sem data numa planilha de OUTRO mês ganha o dia 1 daquele
 *     mês (conta no mês da planilha); no mês corrente continua sendo hoje.
 *
 * Rodar com: TZ=America/Sao_Paulo npx vitest run src/test/credito-sem-data-07-11.test.tsx
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useState } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u-credito" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { mesDoGasto, variaveisDoMes, type CardConfig } from "@/lib/finance-fatura";
import { faturasDoMes } from "@/lib/finance-faturas";
import { ExpenseTable, dataDoGastoSemData } from "@/components/ExpenseTable";

const cfg: Record<string, CardConfig> = { nubank: { closingDay: 25, dueDay: 5 } };
const configOf = (c: string) => cfg[c];

type Gasto = { id: string; description: string; category: string; value: number; date: string; paymentMethod: string; cardName?: string };
const tenis = (date: string, extra: Partial<Gasto> = {}): Gasto =>
  ({ id: "t", description: "Tênis", category: "outros", value: 300, date, paymentMethod: "credito", cardName: "nubank", ...extra });

/* ═══════════════ a regra (lib/finance-fatura) ═══════════════ */

describe("o relato: R$ 300 no crédito sem data, planilha de setembro, lançado em 07/11", () => {
  // o que o app gravava: a data de HOJE na chave de setembro
  const setembro = [tenis("2026-11-07")];

  it("com fechamento, a fatura do gasto nunca fica mais de 1 mês à frente da chave (a trava que o 'mês do vencimento' já tinha)", () => {
    expect(mesDoGasto(setembro[0], configOf, "2026-09")).toBe("2026-10");
    // data digitada no mês seguinte e depois do fechamento: também seria 2 meses à frente
    expect(mesDoGasto(tenis("2026-10-28"), configOf, "2026-09")).toBe("2026-10");
  });

  it("o dinheiro aparece em exatamente UM mês: setembro adia, outubro soma, novembro não repete", () => {
    const set = variaveisDoMes(setembro, [], "2026-09", configOf);
    const out = variaveisDoMes([], setembro, "2026-10", configOf);
    const nov = variaveisDoMes([], [], "2026-11", configOf); // novembro lê outubro, onde o gasto não está
    expect(set.adiados.map((g) => g.id)).toEqual(["t"]);
    expect([set.total, out.total, nov.total]).toEqual([0, 300, 0]);
  });

  it("a fatura do cartão em outubro leva os R$ 300 (TOTAL POR CARTÃO e a linha da fatura usam a mesma regra)", () => {
    const faturas = faturasDoMes({ mes: "2026-10", variaveis: [], variaveisAnterior: setembro, fixos: [], parcelas: [], cards: ["nubank"], configOf, labelOf: (c) => c, pagas: {} });
    expect(faturas).toHaveLength(1);
    expect(faturas[0]).toMatchObject({ card: "nubank", variaveis: 300, total: 300 });
  });

  it("o que já funcionava não muda: até 1 mês à frente, compra antiga no balde, virada de ano, data ilegível, débito", () => {
    expect(mesDoGasto(tenis("2026-09-25"), configOf, "2026-09")).toBe("2026-09");
    expect(mesDoGasto(tenis("2026-09-26"), configOf, "2026-09")).toBe("2026-10");
    expect(mesDoGasto(tenis("2026-10-10"), configOf, "2026-09")).toBe("2026-10");
    expect(mesDoGasto(tenis("2026-07-02"), configOf, "2026-09")).toBe("2026-07"); // conta em setembro mesmo (o balde é o mês)
    expect(mesDoGasto(tenis("2026-12-28"), configOf, "2026-12")).toBe("2027-01");
    expect(mesDoGasto(tenis("ontem"), configOf, "2026-09")).toBe("2026-09");
    expect(mesDoGasto(tenis("2026-11-07", { paymentMethod: "debito" }), configOf, "2026-09")).toBe("2026-09");
    expect(mesDoGasto(tenis("2026-11-07", { cardName: "itau" }), configOf, "2026-09")).toBe("2026-09"); // sem fatura cadastrada
  });
});

/* ═══════════════ a tela (ExpenseTable) ═══════════════ */

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const valor: UserDataContextType = {
    get: <T,>(k: string, fb: T): T => (k in dados ? (dados[k] as T) : fb),
    set: (k: string, v: unknown) => { dados[k] = v; },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor };
};

/** A planilha de um mês, como a MonthlySheet/Index montam: a lista vive num estado e volta pelo setExpenses. */
const Planilha = ({ mes, controle }: { mes?: string; controle: { lista: Gasto[] } }) => {
  const [lista, setLista] = useState<Gasto[]>([]);
  controle.lista = lista;
  return <ExpenseTable expenses={lista} setExpenses={(l) => setLista(l as Gasto[])} mes={mes} />;
};

beforeAll(() => {
  // Radix Select no jsdom
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 7, 10)); }); // 07/11/2026
afterEach(() => { cleanup(); vi.useRealTimers(); });

/** Os Selects do formulário não têm aria-label (combobox não ganha nome pelo conteúdo): acha pelo texto do gatilho. */
const combo = (texto: string) => {
  const c = screen.getAllByRole("combobox").find((el) => el.textContent?.trim() === texto);
  if (!c) throw new Error(`combobox "${texto}" não está na tela`);
  return c;
};
const escolher = async (texto: string, opcao: RegExp | string) => {
  fireEvent.keyDown(combo(texto), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: opcao }));
};

/** Lança "Tênis · 300" na planilha `mes`. `credito` escolhe Cartão de Crédito + Nubank; `data` digita a data. */
const lancar = async (mes: string | undefined, { credito = false, data = "" } = {}) => {
  const controle = { lista: [] as Gasto[] };
  const store = criarStore({ "finance-card-config": cfg });
  render(<UserDataContext.Provider value={store.valor}><Planilha mes={mes} controle={controle} /></UserDataContext.Provider>);
  fireEvent.change(screen.getByPlaceholderText("+ Novo gasto"), { target: { value: "Tênis" } });
  fireEvent.change(screen.getByPlaceholderText("Valor"), { target: { value: "300" } });
  // lista vazia nasce com "Mais opções" aberto; se não estiver, abre
  if (screen.queryByRole("button", { name: /Mais opções/ })) fireEvent.click(screen.getByRole("button", { name: /Mais opções/ }));
  if (data) fireEvent.change(screen.getByLabelText(/Data:/), { target: { value: data } });
  if (credito) {
    await escolher("Pagamento", "Cartão de Crédito");
    await escolher("Cartão", "Nubank");
  }
  fireEvent.click(screen.getByRole("button", { name: "Adicionar gasto" }));
  return controle.lista;
};

describe("dataDoGastoSemData", () => {
  it("hoje no mês da planilha; dia 1 fora dele (passado ou futuro); mês ilegível → hoje", () => {
    expect(dataDoGastoSemData("2026-11", "2026-11-07")).toBe("2026-11-07");
    expect(dataDoGastoSemData("2026-09", "2026-11-07")).toBe("2026-09-01");
    expect(dataDoGastoSemData("2026-12", "2026-11-07")).toBe("2026-12-01");
    expect(dataDoGastoSemData("2025-11", "2026-11-07")).toBe("2025-11-01"); // mesmo mês, outro ano
    expect(dataDoGastoSemData("setembro", "2026-11-07")).toBe("2026-11-07");
    expect(dataDoGastoSemData("2026-11")).toMatch(/^2026-11-07$/); // o padrão é hoje (relógio falso em 07/11)
  });
});

describe("planilha de OUTRO mês: gasto sem data ganha o dia 1 daquele mês", () => {
  it("07/11, planilha de setembro, R$ 300 no crédito sem data: grava 2026-09-01 e conta em setembro", async () => {
    const lista = await lancar("2026-09", { credito: true });
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ description: "Tênis", value: 300, paymentMethod: "credito", cardName: "nubank", date: "2026-09-01" });
    expect(variaveisDoMes(lista, [], "2026-09", configOf).total).toBe(300);
    // na lista: a data dentro de setembro, sem selo de fatura adiada, e o TOTAL com os R$ 300
    expect(screen.getByText("1 de set.")).toBeInTheDocument();
    expect(screen.queryByText(/fatura de/)).not.toBeInTheDocument();
    expect(screen.getByText("R$ 300,00", { selector: ".font-bold" })).toBeInTheDocument();
  });

  it("mês corrente, com ou sem `mes`: continua sendo hoje", async () => {
    expect((await lancar("2026-11"))[0].date).toBe("2026-11-07");
    cleanup();
    expect((await lancar(undefined))[0].date).toBe("2026-11-07");
  });

  it("planilha de um mês FUTURO: dia 1 daquele mês, não hoje", async () => {
    expect((await lancar("2026-12"))[0].date).toBe("2026-12-01");
  });

  it("data digitada manda, em qualquer planilha", async () => {
    const lista = await lancar("2026-09", { credito: true, data: "2026-09-28" });
    expect(lista[0].date).toBe("2026-09-28");
    expect(mesDoGasto(lista[0], configOf, "2026-09")).toBe("2026-10"); // depois do fechamento 25 → fatura de outubro, como sempre
  });
});
