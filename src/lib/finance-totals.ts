/**
 * Fonte única dos números agregados do módulo Finanças.
 *
 * Regra da casa: "despesas do mês" = fixas + variáveis + parcelas do mês.
 * Todas as telas (Dashboard, Relatórios, Saúde Financeira, barra de resumo)
 * derivam saldo e taxa de poupança DESTAS funções — nenhum componente pode
 * ter fórmula própria, senão as telas divergem (ex.: Relatórios -75,2% vs
 * Saúde -89,1% pro mesmo mês, bug corrigido em 07/2026).
 */

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

/** "Quanto posso gastar hoje": saldo atual − contas em aberto, dividido pelos
 *  dias restantes do mês. */
export const computeDailyBudget = (
  totalIncome: number,
  monthlyOutflow: number,
  dueDays: any[],
  fixedExpenses: any[],
) => {
  const now = new Date();
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = daysInMonth - day;
  const unpaidBillsEstimate = computeUnpaidBillsEstimate(dueDays, fixedExpenses);
  const currentBalance = totalIncome - monthlyOutflow;
  const availableReal = currentBalance - unpaidBillsEstimate;
  const perDay = remainingDays > 0 ? availableReal / remainingDays : availableReal;
  return { availableReal, perDay, remainingDays, unpaidBillsEstimate, currentBalance, cantSpend: availableReal <= 0 };
};
