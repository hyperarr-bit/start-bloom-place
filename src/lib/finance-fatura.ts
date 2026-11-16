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
import { chaveArquivada, anotadoEmMs } from "@/lib/virada-do-mes";
import { mesCorrenteId } from "@/lib/virada-contas";
import { doPerfil } from "@/lib/finance-perfil";
import { CARD_CONFIG_KEY } from "@/lib/finance-cards-dados";

export interface CardConfig {
  /** Dia em que a fatura fecha (1-31). Compra NESSE DIA ou depois vai pro mês seguinte (16/11). */
  closingDay?: number;
  /** Dia em que a fatura vence (1-31). Só informativo. */
  dueDay?: number;
  /**
   * 07/10 (chamado do iPhone 1.0.9): "coloco meus gastos do cartão com
   * vencimento em outubro mas fica em setembro. Não estou colocando data de
   * fechamento… prefiro que o valor fique no mês que irá debitar." Sem
   * fechamento o app não sabe em que fatura a compra cai; com esta chave
   * ligada, toda compra no crédito conta no MÊS SEGUINTE ao da compra (a
   * fatura que vence no `dueDay` do mês que vem). Só vale sem `closingDay`
   * (com fechamento a regra dele é mais precisa). É OPT-IN de propósito:
   * quem já cadastrou só o vencimento não vê os números do mês mudarem
   * sozinhos — a caixinha fica no mesmo lugar do fechamento (CartaoConfig).
   */
  mesDoVencimento?: boolean;
}

/** Cartão sem fechamento que escolheu "conta no mês do vencimento". */
export const contaNoMesDoVencimento = (cfg: CardConfig | undefined): boolean =>
  !!cfg && cfg.mesDoVencimento === true && !diaValido(cfg.closingDay) && diaValido(cfg.dueDay);

/** O mínimo que um gasto precisa ter pra regra da fatura — sem assinatura de
 *  índice, senão a interface `Expense` do ExpenseTable não encaixa. */
export interface GastoDeCartao {
  id?: string;
  /** (07/11) também texto/null: é como o lançamento chega da retrospectiva e de chave antiga — quem soma usa Number(). */
  value?: number | string | null;
  date?: string;
  paymentMethod?: string;
  cardName?: string;
}

const diaValido = (d: unknown): d is number => Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 31;

/**
 * COMPRA NO DIA DO FECHAMENTO JÁ É DA FATURA SEGUINTE (16/11, chamados + Play 4★: "coloquei fechamento
 * dia 2, então todas as compras depois disso deveriam ser cobradas apenas no mês seguinte"; "fecha dia 4,
 * lanço no cartão no dia 8 e aparece na fatura atual"). É a regra dos bancos (Nubank, Itaú, Inter…): no
 * dia do fechamento a fatura já fechou e a compra entra na próxima — o "melhor dia de compra". Até aqui
 * só o dia SEGUINTE ao fechamento mudava de mês. Rollback: `false` volta à regra antiga (dia > fechamento).
 */
export const FECHAMENTO_CONTA_NO_DIA = true;

/**
 * CORTE DA REGRA NOVA (revisão 16/11 — o dono não quer que mês passado mude). A compra no dia do fechamento
 * só vai pra fatura seguinte se foi ANOTADA a partir deste dia (o "anotado em" sai do id `Date.now()` de 13
 * dígitos que as tabelas gravam). Anotada antes, ou sem id desse tipo (extrato importado, lançamento de
 * fora, dado antigo): regra antiga (dia > fechamento) — a retrospectiva, a comparação e o balanço de meses
 * que já passaram não mudam. AJUSTE pra data em que o ramo for publicado ("AAAA-MM-DD", meia-noite local).
 */
export const CORTE_FECHAMENTO_NO_DIA = "2026-11-17";

const corteEmMs = (): number => {
  const [a, m, d] = CORTE_FECHAMENTO_NO_DIA.split("-").map(Number);
  return new Date(a, m - 1, d).getTime();
};

/** A regra "no dia do fechamento já é a seguinte" vale pra este lançamento? (pelo id; ver o corte acima)
 *  16/11 (baixa da crítica): id "do futuro" (relógio adiantado de outro aparelho) é descartado, igual à virada —
 *  segue a regra antiga, em vez de passar no corte por engano. */
export const regraDoDiaDoFechamentoVale = (id: unknown, hoje: Date = new Date()): boolean => {
  if (!FECHAMENTO_CONTA_NO_DIA) return false;
  const ms = anotadoEmMs(id, hoje);
  return ms !== null && ms >= corteEmMs();
};

/**
 * "YYYY-MM" da fatura em que uma compra de `date` ("YYYY-MM-DD") cai, dado o
 * dia de fechamento. Parse de texto de propósito — `new Date("2026-09-30")`
 * é UTC e no Brasil vira 29/09 (ver lib/virada-do-mes.ts). Data ilegível ou
 * fechamento inválido → null (quem chama usa o mês da chave).
 */
export const mesDaFatura = (date: unknown, closingDay: unknown, noDiaJaESeguinte: boolean = FECHAMENTO_CONTA_NO_DIA): string | null => {
  if (typeof date !== "string" || !diaValido(closingDay)) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date.trim());
  if (!m) return null;
  const mes = `${m[1]}-${m[2]}`;
  const dia = Number(m[3]);
  if (!(Number(m[2]) >= 1 && Number(m[2]) <= 12) || !(dia >= 1 && dia <= 31)) return null;
  const fechou = noDiaJaESeguinte ? dia >= closingDay : dia > closingDay;
  return fechou ? somarMeses(mes, 1) : mes;
};

/**
 * CONTA NA FATURA DESTE MÊS? (16/11, "o total de cartões tem R$ 300 a menos que os lançamentos") — a mesma
 * régua de `variaveisDoMes`, pra quem soma por cartão (TOTAL POR CARTÃO, linha da fatura). Compra que mora
 * na chave `mesDaChave`: conta em `mes` se a fatura dela é `mes` OU ANTERIOR (compra antiga lançada
 * atrasada: o balde é o mês, na dúvida — a fatura dela já passou e nenhum outro mês a lê). Antes o total
 * por cartão exigia fatura === mês: a compra de 01/10 anotada em novembro (fechamento dia 2) contava nas
 * despesas de novembro e em NENHUM total de cartão.
 */
export const contaNaFaturaDoMes = (
  gasto: GastoDeCartao,
  configOf: (card: string) => CardConfig | undefined,
  mesDaChave: string,
  mes: string,
): boolean => {
  const fatura = mesDoGasto(gasto, configOf, mesDaChave);
  return mesDaChave === mes ? mesesEntre(mes, fatura) <= 0 : fatura === mes;
};

/**
 * 1ª PARCELA DE UMA COMPRA PARCELADA NO CARTÃO COM FECHAMENTO (16/11, Play 4★: "minha fatura fecha dia 4 e
 * vence dia 10; se eu lanço um parcelado no cartão no dia 8, ele aparece na fatura atual, já mostrando o
 * vencimento no dia 10"). A parcela não olhava o fechamento: a 1ª contava no mês da compra. Devolve a DATA
 * da 1ª parcela pra gravar no campo `date` de sempre ("1ª parcela" na tela): compra antes do fechamento →
 * a própria data; no dia do fechamento ou depois → no mês da fatura seguinte (dia do vencimento, ou o dia
 * da compra, limitado ao fim do mês). É o mesmo campo que a parcela "que ainda não começou" (mesDeInicio,
 * 07/11) já lê — formato igual, o app antigo entende. Cartão sem fechamento: a data como veio.
 */
export const dataDaPrimeiraParcela = (dataCompra: string, cfg: CardConfig | undefined): string => {
  if (!cfg || !diaValido(cfg.closingDay)) return dataCompra;
  const mes = mesDaFatura(dataCompra, cfg.closingDay);
  if (!mes || dataCompra.startsWith(`${mes}-`)) return dataCompra;
  const [ano, m] = mes.split("-").map(Number);
  const ultimo = new Date(ano, m, 0).getDate();
  const dia = Math.min(diaValido(cfg.dueDay) ? cfg.dueDay : Number(dataCompra.slice(8, 10)) || 1, ultimo);
  return `${mes}-${String(dia).padStart(2, "0")}`;
};

/** "YYYY-MM" da data da compra, ou null se ilegível. */
const mesDaData = (date: unknown): string | null => {
  if (typeof date !== "string") return null;
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(date.trim());
  return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? `${m[1]}-${m[2]}` : null;
};

/**
 * Em que mês este gasto CONTA. Só crédito muda de mês: em cartão com
 * fechamento, pela regra do fechamento; em cartão sem fechamento que marcou
 * "conta no mês do vencimento", no mês seguinte ao da compra. Nas duas
 * regras, nunca mais de 1 mês à frente da chave — é até onde o mês seguinte
 * lê pra trás (`variaveisDoMes`). Fatura 2+ meses à frente não contaria em
 * mês nenhum: foi o bug "credito-sem-data" (07/11) — gasto sem data numa
 * planilha de setembro ganhava a data de hoje (novembro) e, com fechamento
 * 25, a fatura ia pra novembro; setembro adiava, outubro não achava e
 * novembro lê outubro. A trava já existia no "mês do vencimento".
 */
export const mesDoGasto = (
  gasto: GastoDeCartao,
  configOf: (card: string) => CardConfig | undefined,
  mesDaChave: string,
): string => {
  if (gasto?.paymentMethod !== "credito" || !gasto.cardName) return mesDaChave;
  const cfg = configOf(gasto.cardName);
  if (!cfg) return mesDaChave;
  if (diaValido(cfg.closingDay)) {
    // (revisão 16/11) a regra do dia do fechamento só pra compra anotada depois do corte — histórico não muda
    const mes = mesDaFatura(gasto.date, cfg.closingDay, regraDoDiaDoFechamentoVale(gasto.id)) ?? mesDaChave;
    return mesesEntre(mesDaChave, mes) > 1 ? somarMeses(mesDaChave, 1) : mes;
  }
  if (contaNoMesDoVencimento(cfg)) {
    const mes = mesDaData(gasto.date) ?? mesDaChave;
    return somarMeses(mesesEntre(mesDaChave, mes) > 0 ? mesDaChave : mes, 1);
  }
  return mesDaChave;
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

/* ═══ UMA FONTE SÓ PRA QUEM LÊ O MÊS DO STORE (bug "dois-numeros", 07/11) ═══
 *
 * A regra acima só valia nas duas telas que têm as listas na mão (Index e
 * MonthlySheet, via `variaveisDoMes`). Todo mundo que LÊ o mês pelo store —
 * comparação mensal/anual, balanço anual, retrospectiva, Home, widget de
 * orçamento, lembrete do dia 2 — somava a chave crua, e o mesmo mês dava dois
 * números: compra de R$ 1.000 em 28/10 com fechamento 25 → tela out 200 ·
 * nov 1.000; comparação out 1.200 · nov 0. Daqui pra frente quem lê do store
 * passa por `variaveisDoMesLidas`; quem já tem as listas segue em
 * `variaveisDoMes`. Sem cartão com fechamento/vencimento cadastrado as duas
 * dão a soma crua de sempre — ninguém sem fatura vê número mudar.
 */

/** Quem lê uma chave lógica: o `get` do useUserData sem o padrão, o `readMonthData` de um usuário, o `ler` da
 *  retrospectiva. `undefined`/`null` = ausente. */
export type LeitorDeChave = (chave: string) => unknown;

/** O `configOf` do useFinanceCards sem React, a partir do `finance-card-config` cru: entrada com fechamento OU
 *  vencimento inteiro vale; o resto é "sem fatura" (comportamento de sempre). O hook usa esta mesma função. */
export const configOfDe = (bruto: unknown): ((card: string) => CardConfig | undefined) => {
  const config = bruto && typeof bruto === "object" && !Array.isArray(bruto) ? (bruto as Record<string, CardConfig | undefined>) : {};
  return (card) => {
    const c = config[card];
    return c && (Number.isInteger(c.closingDay) || Number.isInteger(c.dueDay)) ? c : undefined;
  };
};

/** Chave lógica dos gastos variáveis de um mês: o balde corrente ou o arquivo dele — a mesma escolha de
 *  getFinanceStorageKeys e da planilha do mês (MonthlySheet). */
export const chaveDeGastosDoMes = (mesId: string, atual: string = mesCorrenteId()): string =>
  mesId === atual ? "finance-expenses" : chaveArquivada(Number(mesId.slice(0, 4)), Number(mesId.slice(5, 7)) - 1, "expenses");

/**
 * Os gastos variáveis que CONTAM num mês, lidos do store: a chave do mês e a
 * do anterior (compra depois do fechamento de lá cai aqui), no perfil pedido
 * (sem `perfil`, todos), pela regra da fatura do `finance-card-config`.
 * `atual` é o mês corrente — quem simula outra data passa o dele.
 */
export const variaveisDoMesLidas = <T extends GastoDeCartao & { perfil?: string }>(
  mesId: string, ler: LeitorDeChave, perfil?: string, atual: string = mesCorrenteId(),
): VariaveisDoMes<T> => {
  const lista = (chave: string): T[] => { const v = ler(chave); return Array.isArray(v) ? (v as T[]) : []; };
  const doPerfilPedido = (l: T[]): T[] => (perfil ? doPerfil(l, perfil) : l);
  return variaveisDoMes(
    doPerfilPedido(lista(chaveDeGastosDoMes(mesId, atual))),
    doPerfilPedido(lista(chaveDeGastosDoMes(somarMeses(mesId, -1), atual))),
    mesId,
    configOfDe(ler(CARD_CONFIG_KEY)),
  );
};
