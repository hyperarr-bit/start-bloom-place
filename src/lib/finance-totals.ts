/**
 * Fonte única dos números agregados do módulo Finanças.
 *
 * Regra da casa: "despesas do mês" = fixas + variáveis + parcelas do mês +
 * contas AVULSAS do mês (17/10, ver computeLooseBillsOutflow).
 * Todas as telas (Dashboard, Relatórios, Saúde Financeira, barra de resumo)
 * derivam saldo e taxa de poupança DESTAS funções — nenhum componente pode
 * ter fórmula própria, senão as telas divergem (ex.: Relatórios -75,2% vs
 * Saúde -89,1% pro mesmo mês, bug corrigido em 07/2026).
 */

import { cartaoDoId } from "@/lib/finance-faturas";

/** Saída mensal total: custos fixos + variáveis + parcelas + contas avulsas
 *  do mês. `looseBills` é OBRIGATÓRIO de propósito (17/10): quem soma a saída
 *  tem que decidir de onde vêm as avulsas daquele mês
 *  (computeLooseBillsOutflow) — esquecer = a conta paga sumir de novo. */
export const computeMonthlyOutflow = (
  totalVariableExpenses: number,
  totalFixedExpenses: number,
  monthlyInstallments: number,
  looseBills: number,
): number => totalVariableExpenses + totalFixedExpenses + monthlyInstallments + looseBills;

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

/** A conta já está em OUTRO termo da saída? A gerada por um custo fixo
 *  (`fixedId` de um fixo que existe) está em "fixos"; a fatura do cartão
 *  (gasto + parcela) está em "variáveis"/"parcelas". Conta com `fixedId` de
 *  um fixo apagado é avulsa (o fixo não a conta mais). */
const jaNaSaidaPorOutroTermo = (b: any, fixos: Set<unknown>) =>
  (b?.fixedId && fixos.has(b.fixedId)) || cartaoDoId(b?.id) !== null;

const contasAvulsas = (dueDays: any[], fixedExpenses: any[]): any[] => {
  const fixos = new Set((fixedExpenses ?? []).map((f: any) => f?.id).filter(Boolean));
  return (dueDays ?? []).flatMap((d: any) =>
    Array.isArray(d?.bills) ? d.bills.filter((b: any) => b && !jaNaSaidaPorOutroTermo(b, fixos)) : []);
};

const temValor = (b: any) => typeof b?.value === "number" && b.value > 0;

/**
 * CONTA AVULSA DO MÊS = SAÍDA DO MÊS (17/10, achado do dono testando).
 *
 * A conta lançada direto no calendário do MEU MÊS (Netflix, IPVA, boleto),
 * sem custo fixo por trás, só era RESERVADA no "quanto posso gastar" enquanto
 * estava em aberto e nunca entrava no "Saldo do mês". Marcar como paga só
 * invertia a flag: saía da reserva e não virava gasto — o dinheiro sumia de
 * todas as contas e o "quanto posso gastar" SUBIA depois de pagar.
 *
 * Agora ela é tratada como os custos fixos: entra na saída do mês desde que é
 * criada, paga ou não. O ✓ de pago só mexe em alertas e lembretes.
 *
 * Só a conta COM valor: sem valor não há número pra pôr no "Saiu" (a média
 * dos fixos é chute, e chute não entra em saldo). A sem valor continua
 * reservada no "quanto posso gastar" — ver computeUnpaidOutsideOutflow.
 *
 * `dueDays` é o balde DO MÊS que se está somando (mês corrente =
 * `finance-dueDays`; outro mês = a chave dele). Conta de outro mês nunca entra.
 */
export const computeLooseBillsOutflow = (dueDays: any[], fixedExpenses: any[]): number =>
  contasAvulsas(dueDays, fixedExpenses).reduce((s: number, b: any) => s + (temValor(b) ? b.value : 0), 0);

/** Avulsas de um mês que NÃO é o corrente (arquivo do mês passado, planilha
 *  de mês futuro). Conta nascida de custo fixo (`fixedId`) nunca entra aqui:
 *  o retrato dos fixos daquele mês pode não existir (antes de 26/09 ninguém
 *  arquivava fixos; mês futuro usa fixo PROJETADO, com outro id) e a conta
 *  viraria "avulsa órfã" — o aluguel contado como conta solta. */
export const computeArchivedLooseBillsOutflow = (dueDays: any[], fixedExpenses: any[]): number =>
  computeLooseBillsOutflow(
    (dueDays ?? []).map((d: any) => ({ ...d, bills: Array.isArray(d?.bills) ? d.bills.filter((b: any) => !b?.fixedId) : [] })),
    fixedExpenses,
  );

/** A RESERVA de contas: só o que AINDA NÃO está na saída do mês.
 *  - (26/09) conta de custo fixo e fatura do cartão já entram em
 *    computeMonthlyOutflow — descontar de novo tirava o mesmo dinheiro duas
 *    vezes (um fixo de R$ 100 derrubava o disponível em R$ 200);
 *  - (17/10) a avulsa COM valor também já está na saída
 *    (computeLooseBillsOutflow), paga ou não.
 *  Sobra a avulsa SEM valor: reservada pela média dos fixos (a mesma
 *  estimativa do "A vencer"), PAGA OU NÃO — pagar não devolve dinheiro, então
 *  o ✓ não pode fazer o "quanto posso gastar" subir. Pra parar de reservar o
 *  chute, a pessoa põe o valor na conta.
 *  O total de contas a pagar (pra MOSTRAR) continua em computeUnpaidBillsEstimate. */
export const computeUnpaidOutsideOutflow = (dueDays: any[], fixedExpenses: any[]): number => {
  const semValor = contasAvulsas(dueDays, fixedExpenses).filter((b: any) => !temValor(b));
  if (semValor.length === 0) return 0;
  const fixedTotal = (fixedExpenses ?? []).reduce((s: number, e: any) => s + (e?.value || 0), 0);
  const avgBillValue = (fixedExpenses ?? []).length > 0 ? fixedTotal / fixedExpenses.length : 0;
  return semValor.length * avgBillValue;
};

/** "Quanto posso gastar hoje": saldo atual − reserva (avulsas sem valor),
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
