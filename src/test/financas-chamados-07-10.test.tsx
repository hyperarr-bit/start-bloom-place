/**
 * Chamados de Finanças (iPhone 1.0.9, 04–07/10):
 *  (d) "não consigo visualizar as minhas contas de 2027" — o seletor de ano do
 *      Orçamento Mensal (a única porta pra planilha de um mês com ano) e do
 *      Balanço anual parava no ano corrente. Agora vai até o ano que vem.
 *      "Ver detalhes" do mês anterior leva o ano DELE (em janeiro, dezembro é
 *      do ano passado). A comparação de meses lista 12 meses à frente
 *      ("não consigo prever meu comparativo out × nov").
 *  (e) "coloco meus gastos do cartão com vencimento em outubro mas fica em
 *      setembro; não coloco data de fechamento, prefiro que fique no mês que
 *      vai debitar" — cartão sem fechamento ganha a caixinha "conta no mês do
 *      vencimento" (opt-in; cartão novo nasce ligado): o gasto conta no mês
 *      seguinte e a fatura vence lá.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "uid-2027" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { contaNoMesDoVencimento, mesDoGasto, variaveisDoMes, type CardConfig } from "@/lib/finance-fatura";
import { faturasAVencer, faturasDoMes } from "@/lib/finance-faturas";
import { MonthlyBudget } from "@/components/MonthlyBudget";
import { AnnualBudget } from "@/components/AnnualBudget";
import { InstallmentTracker } from "@/components/InstallmentTracker";
import { opcoesDeMeses, rotuloMesAno } from "@/components/finance/MonthComparison";
import { PERFIL_PESSOAL } from "@/lib/finance-perfil";

/** Store reativo (a seta grava e a tela relê). */
type Controle = { dados: () => Record<string, unknown> };
const Provedor = ({ inicial, controle, children }: { inicial: Record<string, unknown>; controle: Controle; children?: React.ReactNode }) => {
  const [store, setStore] = useState<Record<string, unknown>>(() => ({ ...inicial }));
  const ref = useRef<Record<string, unknown>>({ ...inicial });
  const get = useCallback(<T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb), [store]);
  const set = useCallback((k: string, v: unknown) => { ref.current = { ...ref.current, [k]: v }; setStore((p) => ({ ...p, [k]: v })); }, []);
  controle.dados = () => ref.current;
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};
const montar = (ui: React.ReactNode, inicial: Record<string, unknown> = {}) => {
  const controle = {} as Controle;
  render(<Provedor inicial={inicial} controle={controle}>{ui}</Provedor>);
  return controle;
};

beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 9, 7, 10)); });
afterEach(() => vi.useRealTimers());

const NOMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/* ═══════════════════════ (d) 2027 ═══════════════════════ */

describe("(d) contas de 2027: o seletor de ano chega no ano que vem", () => {
  it("Orçamento Mensal: 'Próximo ano' leva a 2027 e abrir um mês passa o ano 2027; 2028 continua fechado", () => {
    const abertos: [string, number][] = [];
    montar(<MonthlyBudget budgets={NOMES.map((month) => ({ month, value: 0, hasNote: false }))} setBudgets={() => {}} onOpenMonth={(m, a) => abertos.push([m, a])} />);
    const proximo = screen.getByRole("button", { name: "Próximo ano" });
    expect(proximo).not.toBeDisabled();
    fireEvent.click(proximo);
    expect(screen.getByText("2027")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próximo ano" })).toBeDisabled();
    fireEvent.click(screen.getByText("Janeiro"));
    expect(abertos).toEqual([["Janeiro", 2027]]);
    // nada de "(atual)" num ano que não é o de agora
    expect(screen.queryByText("(atual)")).not.toBeInTheDocument();
  });

  it("Orçamento Mensal: 2027 escolhido fica guardado como NÚMERO (o app antigo mostra direto) e volta ao reabrir", () => {
    const controle = montar(<MonthlyBudget budgets={NOMES.map((month) => ({ month, value: 0, hasNote: false }))} setBudgets={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Próximo ano" }));
    expect(controle.dados()["finance-orcamento-ano"]).toBe(2027);
    expect(controle.dados()["finance-orcamento-ano-em"]).toBe(2026);
  });

  it("Balanço anual: a seta vai até 2027 e para lá", () => {
    montar(<AnnualBudget perfil={PERFIL_PESSOAL} />);
    const proximo = screen.getByRole("button", { name: "Próximo ano do balanço" });
    expect(proximo).not.toBeDisabled();
    fireEvent.click(proximo);
    expect(screen.getByTestId("balanco-ano").textContent).toBe("2027");
    expect(screen.getByRole("button", { name: "Próximo ano do balanço" })).toBeDisabled();
  });

  it("Comparação de meses: a lista chega a out/2027 em outubro de 2026 (out × nov dá pra comparar)", () => {
    const opcoes = opcoesDeMeses([], new Date(2026, 9, 7)).map(rotuloMesAno);
    expect(opcoes).toContain("nov/2026");
    expect(opcoes).toContain("jan/2027");
    expect(opcoes[opcoes.length - 1]).toBe("out/2027");
    expect(opcoes[0]).toBe("jan/2025");
  });
});

/* ═══════════════════════ (e) cartão sem fechamento ═══════════════════════ */

describe("(e) cartão sem fechamento com 'conta no mês do vencimento'", () => {
  const cfg: Record<string, CardConfig> = {
    nubank: { dueDay: 10, mesDoVencimento: true },     // marcou a caixinha
    itau: { dueDay: 10 },                                // só vencimento, como antes
    bb: { closingDay: 20, dueDay: 27, mesDoVencimento: true }, // com fechamento a chave não manda
  };
  const configOf = (c: string) => cfg[c];

  it("regra: só sem fechamento + com vencimento + marcado", () => {
    expect(contaNoMesDoVencimento(cfg.nubank)).toBe(true);
    expect(contaNoMesDoVencimento(cfg.itau)).toBe(false);
    expect(contaNoMesDoVencimento(cfg.bb)).toBe(false);
    expect(contaNoMesDoVencimento({ mesDoVencimento: true })).toBe(false);
    expect(contaNoMesDoVencimento(undefined)).toBe(false);
  });

  it("compra de setembro conta em outubro; quem não marcou continua no mês da compra; fechamento manda quando existe", () => {
    const g = (cardName: string, date = "2026-09-15", paymentMethod = "credito") => ({ date, paymentMethod, cardName, value: 10 });
    expect(mesDoGasto(g("nubank"), configOf, "2026-09")).toBe("2026-10");
    expect(mesDoGasto(g("nubank", "2026-12-28"), configOf, "2026-12")).toBe("2027-01");
    expect(mesDoGasto(g("itau"), configOf, "2026-09")).toBe("2026-09");
    expect(mesDoGasto(g("bb", "2026-09-25"), configOf, "2026-09")).toBe("2026-10");
    expect(mesDoGasto(g("bb", "2026-09-15"), configOf, "2026-09")).toBe("2026-09");
    expect(mesDoGasto(g("nubank", "2026-09-15", "debito"), configOf, "2026-09")).toBe("2026-09");
    // compra antiga que ficou no balde de setembro: conta em setembro (nunca volta mais de 1 mês)
    expect(mesDoGasto(g("nubank", "2026-07-02"), configOf, "2026-09")).toBe("2026-08");
    // data no futuro ou ilegível: no máximo 1 mês à frente da chave
    expect(mesDoGasto(g("nubank", "2026-11-02"), configOf, "2026-09")).toBe("2026-10");
    expect(mesDoGasto(g("nubank", "ontem"), configOf, "2026-09")).toBe("2026-10");
  });

  it("variáveis do mês: setembro mostra o gasto como adiado; outubro soma o de setembro", () => {
    const setembro = [{ id: "a", value: 100, date: "2026-09-15", paymentMethod: "credito", cardName: "nubank" }, { id: "p", value: 30, date: "2026-09-20", paymentMethod: "pix" }];
    const agosto = [{ id: "z", value: 70, date: "2026-08-28", paymentMethod: "credito", cardName: "nubank" }];
    const set = variaveisDoMes(setembro, agosto, "2026-09", configOf);
    expect(set.adiados.map((x) => x.id)).toEqual(["a"]);
    expect(set.total).toBe(30 + 70);
    const out = variaveisDoMes([], setembro, "2026-10", configOf);
    expect(out.doMesAnterior.map((x) => x.id)).toEqual(["a"]);
    expect(out.total).toBe(100);
  });

  it("a fatura que vence em 10/10 é a dos gastos de setembro — e em setembro não aparece fatura desses gastos", () => {
    const gastos: Record<string, { id: string; value: number; date: string; paymentMethod: string; cardName: string }[]> = {
      "2026-09": [{ id: "a", value: 100, date: "2026-09-15", paymentMethod: "credito", cardName: "nubank" }],
      "2026-10": [{ id: "b", value: 40, date: "2026-10-03", paymentMethod: "credito", cardName: "nubank" }],
    };
    const base = { gastosDoMes: (m: string) => gastos[m] ?? [], parcelasDoMes: () => [], fixos: [], cards: ["nubank"], configOf, labelOf: (c: string) => c, pagas: {} };
    const outubro = faturasAVencer({ ...base, mes: "2026-10" });
    expect(outubro).toHaveLength(1);
    expect(outubro[0]).toMatchObject({ card: "nubank", dueDay: 10, total: 100 });
    const setembro = faturasAVencer({ ...base, mes: "2026-09" });
    expect(setembro).toHaveLength(0);
    // faturasDoMes de outubro (a que "fecha" em outubro) = os gastos de setembro
    expect(faturasDoMes({ mes: "2026-10", variaveis: gastos["2026-10"], variaveisAnterior: gastos["2026-09"], fixos: [], parcelas: [], cards: ["nubank"], configOf, labelOf: (c) => c, pagas: {} })[0].total).toBe(100);
  });

  it("na tela: cartão que já tinha só o vencimento abre com a caixinha DESMARCADA (nada muda sozinho); marcar e salvar grava a chave", () => {
    const controle = montar(
      createElement(InstallmentTracker, {
        installments: [], setInstallments: () => {}, mes: "2026-10",
        variableExpenses: [{ id: "b", value: 40, date: "2026-10-03", paymentMethod: "credito", cardName: "nubank" }],
        variableExpensesAnterior: [{ id: "a", value: 100, date: "2026-09-15", paymentMethod: "credito", cardName: "nubank" }],
      }),
      { "finance-card-config": { nubank: { dueDay: 10 } } },
    );
    expect(screen.queryByText(/Fatura de outubro/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Fechamento e vencimento do cartão Nubank/i }));
    const caixa = screen.getByRole("checkbox", { name: "Gasto conta no mês do vencimento" });
    expect(caixa).not.toBeChecked();
    fireEvent.click(caixa);
    fireEvent.click(screen.getByRole("button", { name: "Salvar fechamento e vencimento" }));
    expect(controle.dados()["finance-card-config"]).toEqual({ nubank: { dueDay: 10, mesDoVencimento: true } });
    // a linha do cartão agora diz de que fatura é, e o total é o de setembro (100), não o de outubro (40)
    expect(screen.getByText(/Fatura de outubro · vence dia 10/i)).toBeInTheDocument();
    expect(screen.getAllByText("R$ 100,00").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("R$ 40,00")).not.toBeInTheDocument();
  });

  it("na tela: cartão NOVO nasce com a caixinha marcada; preencher fechamento esconde a caixinha e a chave não é gravada", () => {
    const controle = montar(
      createElement(InstallmentTracker, {
        installments: [], setInstallments: () => {}, mes: "2026-10",
        variableExpenses: [{ id: "b", value: 40, date: "2026-10-03", paymentMethod: "credito", cardName: "itau" }],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Fechamento e vencimento do cartão Itaú/i }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument(); // sem vencimento digitado, não há o que escolher
    const campos = screen.getAllByRole("spinbutton");
    fireEvent.change(campos[1], { target: { value: "10" } }); // vence dia
    expect(screen.getByRole("checkbox", { name: "Gasto conta no mês do vencimento" })).toBeChecked();
    fireEvent.change(campos[0], { target: { value: "25" } }); // fecha dia
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar fechamento e vencimento" }));
    expect(controle.dados()["finance-card-config"]).toEqual({ itau: { closingDay: 25, dueDay: 10 } });
  });
});
