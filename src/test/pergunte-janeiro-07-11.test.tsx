/**
 * "TÔ MELHOR QUE MÊS PASSADO?" EM JANEIRO (bug "pergunte-janeiro", 07/11).
 *
 * Dois erros na mesma resposta do Pergunte ao CORE (components/ask/AskCore):
 *   1. o mês passado era lido SEM ano: em janeiro de 2027 a pergunta buscava o dezembro de
 *      2027 (vazio) em vez do de 2026 e respondia "Ainda não tenho Dezembro registrado";
 *   2. os dois lados da conta eram diferentes: este mês vinha com fixos + variáveis + parcelas
 *      + contas avulsas (`monthlyOutflow`), o mês passado só com fixos + variáveis — e a
 *      resposta podia dizer "gastou mais" quando gastou menos.
 *
 * Conserto: o mês passado sai de `parPadrao` (atravessa janeiro) e o total de `totaisDoMes`,
 * a MESMA conta do Dashboard e da Comparação mensal.
 *
 * O teste abre a folha de verdade e clica na pergunta: é a resposta que a pessoa lê.
 *
 * Rodar com: TZ=America/Sao_Paulo npx vitest run src/test/pergunte-janeiro-07-11.test.tsx
 */
process.env.TZ = "America/Sao_Paulo";

import React from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

const UID = "u-pergunte-janeiro";
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u-pergunte-janeiro" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
}));

import { AskCore, type AskCtx } from "@/components/ask/AskCore";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";

const lsKey = (k: string) => `u:${UID}:${k}`;
const gravar = (dados: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(dados)) localStorage.setItem(lsKey(k), JSON.stringify(v));
};

/** Um mês arquivado: fixos 1.000 + variáveis 800 + parcela 300 + conta avulsa 200 = R$ 2.300. */
const mesArquivado = (ano: number, chave: string, mesId: string) => ({
  [`finance-${ano}-${chave}-incomes`]: [{ id: "sal", description: "Salário", value: 5000 }],
  [`finance-${ano}-${chave}-fixed`]: [{ id: "aluguel", description: "Aluguel", value: 1000 }],
  [`finance-${ano}-${chave}-expenses`]: [{ id: "mercado", description: "Mercado", category: "mercado", value: 800, date: `${mesId}-05` }],
  [`finance-${ano}-${chave}-installments`]: [
    { id: "tv", description: "TV", totalInstallments: 10, paidInstallments: 2, installmentValue: 300, startMonth: mesId, parcelaDoMes: 3 },
  ],
  [`finance-${ano}-${chave}-dueDays`]: [{ day: 15, bills: [{ id: "ipva", name: "IPVA", value: 200, paid: true }] }],
});

const ctxCom = (monthlyOutflow: number): AskCtx => ({
  totalIncome: 5000, monthlyOutflow, savingsRate: 0, monthlyInstallments: 0, totalInvestments: 0, totalDebts: 0,
  expenses: [], fixedExpenses: [], dueDays: [], goals: [], investments: [],
});

const dadosDaTela: UserDataContextType = {
  get: <T,>(_k: string, fb: T): T => fb,
  set: () => {},
  loaded: true,
  isGuest: false,
  fetchKey: async () => null,
};

/** Abre o Pergunte ao CORE, clica em "Tô melhor que mês passado?" e devolve a resposta. */
const perguntar = async (monthlyOutflow: number): Promise<string> => {
  render(
    <UserDataContext.Provider value={dadosDaTela}>
      <AskCore open onOpenChange={() => {}} ctx={ctxCom(monthlyOutflow)} />
    </UserDataContext.Provider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Tô melhor que mês passado/ }));
  const resposta = await screen.findByText(/de gastos\.|Ainda não tenho/, undefined, { timeout: 2000 });
  return resposta.textContent ?? "";
};

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.scrollTo = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  localStorage.clear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("pergunte-janeiro (07/11): em janeiro, o mês passado é o dezembro do ano passado", () => {
  it("10/01/2027 lê dezembro de 2026, e não o dezembro vazio de 2027", async () => {
    vi.setSystemTime(new Date(2027, 0, 10, 10));
    gravar(mesArquivado(2026, "dezembro", "2026-12"));
    const resposta = await perguntar(1000);
    expect(resposta).not.toContain("Ainda não tenho");
    expect(resposta).toContain("Dezembro: R$ 2.300 de gastos.");
  });

  it("dezembro de 2027 preenchido antes da hora não entra no lugar do de 2026", async () => {
    vi.setSystemTime(new Date(2027, 0, 10, 10));
    gravar({ "finance-2027-dezembro-expenses": [{ id: "plano", description: "Natal", value: 9000, date: "2027-12-20" }] });
    expect(await perguntar(1000)).toContain("Ainda não tenho Dezembro registrado");
  });

  it("janeiro sem nada em dezembro segue dizendo que não tem o que comparar", async () => {
    vi.setSystemTime(new Date(2027, 0, 10, 10));
    expect(await perguntar(1000)).toContain("Ainda não tenho Dezembro registrado");
  });
});

describe("pergunte-janeiro (07/11): os dois meses somam a mesma coisa", () => {
  it("o mês passado conta parcelas e contas avulsas, como este mês", async () => {
    vi.setSystemTime(new Date(2026, 10, 15, 10)); // 15/11: dia 15 de 30, R$ 1.000 → fecha em ~R$ 2.000
    gravar(mesArquivado(2026, "outubro", "2026-10"));
    const resposta = await perguntar(1000);
    expect(resposta).toContain("Outubro: R$ 2.300 de gastos.");
    // sem parcela e avulsa, outubro ficava em R$ 1.800 e a resposta dizia que ela gastou MAIS
    expect(resposta).toContain("✅ Sim! Nesse passo você gasta MENOS que mês passado.");
  });

  it("parcela de outro perfil não entra na conta do perfil ativo", async () => {
    vi.setSystemTime(new Date(2026, 10, 15, 10));
    gravar({
      ...mesArquivado(2026, "outubro", "2026-10"),
      "finance-2026-outubro-installments": [
        { id: "pj", description: "Notebook", totalInstallments: 10, paidInstallments: 2, installmentValue: 300, startMonth: "2026-10", parcelaDoMes: 3, perfil: "acme" },
      ],
    });
    expect(await perguntar(1000)).toContain("Outubro: R$ 2.000 de gastos.");
  });

  it("quem não tem parcela nem avulsa vê o mesmo número de antes", async () => {
    vi.setSystemTime(new Date(2026, 10, 15, 10));
    gravar({
      "finance-2026-outubro-fixed": [{ id: "aluguel", description: "Aluguel", value: 1000 }],
      "finance-2026-outubro-expenses": [{ id: "mercado", description: "Mercado", category: "mercado", value: 800, date: "2026-10-05" }],
    });
    expect(await perguntar(1000)).toContain("Outubro: R$ 1.800 de gastos.");
  });
});
