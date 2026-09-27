/**
 * Fonte única dos números agregados do módulo Finanças.
 *
 * Regra da casa: "despesas do mês" = fixas + variáveis + parcelas do mês.
 * Todas as telas (Dashboard, Relatórios, Saúde Financeira, barra de resumo)
 * derivam saldo e taxa de poupança DESTAS funções — nenhum componente pode
 * ter fórmula própria, senão as telas divergem (ex.: Relatórios -75,2% vs
 * Saúde -89,1% pro mesmo mês, bug corrigido em 07/2026).
 */

import { cartaoDoId } from "@/lib/finance-faturas";

/** Saída mensal total: custos fixos + variáveis + parcelas do mês corrente. */
export const computeMonthlyOutflow = (
  totalVariableExpenses: number,
  totalFixedExpenses: number,
  monthlyInstallments: number,
): number => totalVariableExpenses + totalFixedExpenses + monthlyInstallments;

/** Taxa de poupança (%) sobre a saída mensal total. */
export const computeSavingsRate = (totalIncome: number, monthlyOutflow: number): number =>
  totalIncome > 0 ? ((totalIncome - monthlyOutflow) / totalIncome) * 100 : 0;

/** Saldo do mês: renda − saída mensal total. */
export const computeMonthlyBalance = (totalIncome: number, monthlyOutflow: number): number =>
  totalIncome - monthlyOutflow;

/** Contas em aberto: valor real quando cadastrado; média dos fixos como
 *  fallback pra conta sem valor. Usado pelo Dashboard E pelo Pergunte ao CORE
 *  — os dois têm que falar o mesmo número. */
export const computeUnpaidBillsEstimate = (dueDays: any[], fixedExpenses: any[]): number => {
  const fixedTotal = fixedExpenses.reduce((s: number, e: any) => s + (e.value || 0), 0);
  const avgBillValue = fixedExpenses.length > 0 ? fixedTotal / fixedExpenses.length : 0;
  const unpaid = (dueDays ?? []).flatMap((d: any) => (Array.isArray(d?.bills) ? d.bills.filter((b: any) => !b?.paid) : []));
  return unpaid.reduce(
    (s: number, b: any) => s + (typeof b?.value === "number" && b.value > 0 ? b.value : avgBillValue), 0);
};

/** A RESERVA de contas (26/09, varredura): só as contas em aberto que AINDA
 *  NÃO estão na saída do mês. A conta gerada por um custo fixo (`fixedId` de
 *  um fixo que existe) e a fatura do cartão (gasto + parcela) já entram em
 *  computeMonthlyOutflow — descontar de novo como "pendente" tirava o mesmo
 *  dinheiro duas vezes (um fixo de R$ 100 derrubava o disponível em R$ 200, e
 *  na demo os R$ 940 "pendentes" eram 100% dinheiro já contado). Sobra a conta
 *  avulsa lançada direto no calendário (IPVA, boleto), que não é gasto ainda.
 *  O total de contas a pagar (pra MOSTRAR) continua em computeUnpaidBillsEstimate. */
export const computeUnpaidOutsideOutflow = (dueDays: any[], fixedExpenses: any[]): number => {
  const fixos = new Set((fixedExpenses ?? []).map((f: any) => f?.id).filter(Boolean));
  const jaNaSaida = (b: any) => (b?.fixedId && fixos.has(b.fixedId)) || cartaoDoId(b?.id) !== null;
  const avulsas = (dueDays ?? []).map((d: any) => ({ ...d, bills: Array.isArray(d?.bills) ? d.bills.filter((b: any) => !jaNaSaida(b)) : [] }));
  return computeUnpaidBillsEstimate(avulsas, fixedExpenses);
};

/** "Quanto posso gastar hoje": saldo atual − contas avulsas em aberto,
 *  dividido pelos dias que faltam no mês CONTANDO HOJE (hoje também é dia de
 *  gastar; sem o +1, no último dia do mês dividia por 0 e mostrava tudo). */
export const computeDailyBudget = (
  totalIncome: number,
  monthlyOutflow: number,
  dueDays: any[],
  fixedExpenses: any[],
  now: Date = new Date(),
) => {
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = daysInMonth - day + 1;
  const unpaidBillsEstimate = computeUnpaidOutsideOutflow(dueDays, fixedExpenses);
  const currentBalance = totalIncome - monthlyOutflow;
  const availableReal = currentBalance - unpaidBillsEstimate;
  const perDay = availableReal / remainingDays;
  return { availableReal, perDay, remainingDays, unpaidBillsEstimate, currentBalance, cantSpend: availableReal <= 0 };
};
