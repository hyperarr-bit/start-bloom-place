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
