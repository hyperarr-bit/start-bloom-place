/**
 * FATURA DO CARTÃO: fechamento e vencimento (07/09).
 *
 * Avaliação 4★ da Play (set/2026): "toda compra no crédito é somado nas
 * despesas do mês, ao invés de ser somado na fatura do próximo mês, e seria
 * interessante ter como adicionar a data de vencimento do cartão de crédito".
 *
 * Não existia entidade "cartão": `cardName` é só uma string no gasto. Agora
 * cada cartão PODE ter `closingDay` (fecha dia X) e `dueDay` (vence dia Y),
 * guardados em `finance-card-config` (ver finance-cards.ts). Cartão sem
 * fechamento cadastrado = comportamento de sempre (gasto conta no mês da
 * compra). É opcional de propósito: ~980 pessoas usam Finanças sem nunca ter
 * cadastrado cartão nenhum, e o número delas não pode mudar sozinho.
 *
 * ── DESENHO: PROJEÇÃO, NÃO MUDANÇA DE CHAVE ──────────────────────────────
 * O gasto continua gravado na chave do mês em que foi lançado (com a data da
 * compra intacta). O que muda é a CONTA: compra no crédito depois do
 * fechamento pertence à fatura do mês seguinte, então
 *   - sai do "despesas do mês" de onde foi lançada (fica na lista com o selo
 *     "fatura de out."), e
 *   - entra no "despesas do mês" seguinte, lida da chave do mês anterior.
 * Gravar o gasto direto na chave do mês da fatura foi descartado: chave de
 * mês FUTURO fica órfã quando o mês chega (o balde corrente é outra chave,
 * `finance-expenses`) e a virada só arquiva pra trás, nunca traz pra frente
 * — o gasto sumiria no exato mês em que a fatura vence.
 */

import { mesesEntre, somarMeses } from "@/lib/finance-parcelas";

export interface CardConfig {
  /** Dia em que a fatura fecha (1-31). Compra DEPOIS dele vai pro mês seguinte. */
  closingDay?: number;
  /** Dia em que a fatura vence (1-31). Só informativo. */
  dueDay?: number;
}

/** O mínimo que um gasto precisa ter pra regra da fatura — sem assinatura de
 *  índice, senão a interface `Expense` do ExpenseTable não encaixa. */
export interface GastoDeCartao {
  id?: string;
  value?: number;
  date?: string;
  paymentMethod?: string;
  cardName?: string;
}

const diaValido = (d: unknown): d is number => Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 31;

/**
 * "YYYY-MM" da fatura em que uma compra de `date` ("YYYY-MM-DD") cai, dado o
 * dia de fechamento. Parse de texto de propósito — `new Date("2026-09-30")`
 * é UTC e no Brasil vira 29/09 (ver lib/virada-do-mes.ts). Data ilegível ou
 * fechamento inválido → null (quem chama usa o mês da chave).
 */
export const mesDaFatura = (date: unknown, closingDay: unknown): string | null => {
  if (typeof date !== "string" || !diaValido(closingDay)) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date.trim());
  if (!m) return null;
  const mes = `${m[1]}-${m[2]}`;
  const dia = Number(m[3]);
  if (!(Number(m[2]) >= 1 && Number(m[2]) <= 12) || !(dia >= 1 && dia <= 31)) return null;
  return dia > closingDay ? somarMeses(mes, 1) : mes;
};

/** Em que mês este gasto CONTA. Só crédito em cartão com fechamento muda de mês. */
export const mesDoGasto = (
  gasto: GastoDeCartao,
  configOf: (card: string) => CardConfig | undefined,
  mesDaChave: string,
): string => {
  if (gasto?.paymentMethod !== "credito" || !gasto.cardName) return mesDaChave;
  const cfg = configOf(gasto.cardName);
  if (!cfg || !diaValido(cfg.closingDay)) return mesDaChave;
  return mesDaFatura(gasto.date, cfg.closingDay) ?? mesDaChave;
};

export interface VariaveisDoMes<T extends GastoDeCartao> {
  /** O que conta neste mês: os próprios que não foram adiados + os do mês
   *  anterior cuja fatura cai aqui. */
  noMes: T[];
  /** Lançados neste mês, mas que pertencem à fatura do mês seguinte. */
  adiados: T[];
  /** Vindos da chave do mês anterior (compra depois do fechamento de lá). */
  doMesAnterior: T[];
  total: number;
}

/**
 * Separa os gastos variáveis de um mês pela regra da fatura. `anteriores` é
 * a lista da chave do mês ANTERIOR (`mesAnterior`); tudo que lá caiu na
 * fatura deste mês conta aqui.
 */
export const variaveisDoMes = <T extends GastoDeCartao>(
  proprios: T[] | undefined | null,
  anteriores: T[] | undefined | null,
  mes: string,
  configOf: (card: string) => CardConfig | undefined,
): VariaveisDoMes<T> => {
  const mesAnterior = somarMeses(mes, -1);
  const noMes: T[] = [];
  const adiados: T[] = [];
  for (const g of Array.isArray(proprios) ? proprios : []) {
    // adiado = fatura DEPOIS do mês da chave; fatura anterior (compra antiga
    // ainda no balde) conta aqui mesmo — o balde é o mês, na dúvida
    if (mesesEntre(mes, mesDoGasto(g, configOf, mes)) > 0) adiados.push(g);
    else noMes.push(g);
  }
  const doMesAnterior = (Array.isArray(anteriores) ? anteriores : []).filter(
    (g) => mesDoGasto(g, configOf, mesAnterior) === mes,
  );
  const soma = (l: T[]) => l.reduce((s, g) => s + (Number.isFinite(Number(g?.value)) && g.value !== null ? Number(g.value) : 0), 0);
  return { noMes: [...noMes, ...doMesAnterior], adiados, doMesAnterior, total: soma(noMes) + soma(doMesAnterior) };
};

/** "vence dia 10" ou "vence dia 5 do mês seguinte" (vencimento antes do
 *  fechamento = a fatura fechada em set. vence em out.). */
export const rotuloVencimento = (cfg: CardConfig | undefined): string | null => {
  if (!cfg || !diaValido(cfg.dueDay)) return null;
  const seguinte = diaValido(cfg.closingDay) && cfg.dueDay <= cfg.closingDay;
  return `vence dia ${cfg.dueDay}${seguinte ? " do mês seguinte" : ""}`;
};
