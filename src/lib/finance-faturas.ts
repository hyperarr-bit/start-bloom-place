import { mesDoGasto, type CardConfig, type GastoDeCartao } from "@/lib/finance-fatura";
import { somarMeses, valorDaParcelaNoMes, type Parcela } from "@/lib/finance-parcelas";

/**
 * FATURA DO CARTÃO COMO UMA CONTA DO MÊS (22/09) — o chamado mais longo da
 * semana: "as parcelas de cartão vencem junto com a fatura… seria interessante
 * criar uma única entrada nas contas do mês relativa à fatura, em vez de
 * várias entradas separadas… ao marcar como paga, marcar todas as entradas
 * ligadas a essa fatura".
 *
 * A conta já existia espalhada: gasto no crédito (pela regra do fechamento,
 * lib/finance-fatura), parcela do mês (lib/finance-parcelas) e custo fixo no
 * cartão. Aqui ela vira UMA linha por cartão — "Fatura Nubank · R$ 1.234,56"
 * — que aparece em CONTAS DO MÊS no dia de vencimento cadastrado no cartão
 * (CartaoConfig). Sem vencimento cadastrado, nada muda pra ninguém.
 *
 * A linha é DERIVADA, nunca gravada em `finance-dueDays`: se fosse gravada,
 * o total ficaria velho no minuto seguinte a um gasto novo. O que se grava é
 * só o "paguei" (`finance-faturas-pagas`, chave "YYYY-MM:cartão"), e pagar a
 * fatura marca as parcelas daquele cartão no mês como pagas — que é o pedido.
 * Pagar NÃO cria despesa: os gastos que a compõem já estão nas despesas do
 * mês; somar a fatura de novo contaria o dinheiro duas vezes.
 */

export const CHAVE_FATURAS_PAGAS = "finance-faturas-pagas";
export const PREFIXO_FATURA = "fatura:";

export interface FaturaDoMes {
  card: string;
  label: string;
  dueDay: number;
  total: number;
  variaveis: number;
  parcelas: number;
  fixos: number;
  paga: boolean;
}

export interface EntradaFatura {
  mes: string;
  variaveis: GastoDeCartao[];
  variaveisAnterior: GastoDeCartao[];
  fixos: { paymentMethod?: string; cardName?: string; value?: number }[];
  parcelas: Parcela[];
  cards: string[];
  configOf: (card: string) => CardConfig | undefined;
  labelOf: (card: string) => string;
  pagas: Record<string, boolean>;
}

const dia = (v: unknown) => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 31 ? (v as number) : null);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export const chaveDaFatura = (mes: string, card: string) => `${mes}:${card}`;
export const idDaFaturaNoDia = (card: string) => `${PREFIXO_FATURA}${card}`;
export const cartaoDoId = (id: unknown) => (typeof id === "string" && id.startsWith(PREFIXO_FATURA) ? id.slice(PREFIXO_FATURA.length) : null);

export const brl = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** As faturas do mês: só de cartão com dia de vencimento cadastrado, e só quando tem valor. */
export function faturasDoMes(e: EntradaFatura): FaturaDoMes[] {
  const mesAnterior = somarMeses(e.mes, -1);
  const porCartao = new Map<string, { variaveis: number; parcelas: number; fixos: number }>();
  const conta = (card: unknown) => {
    const c = String(card ?? "");
    if (!porCartao.has(c)) porCartao.set(c, { variaveis: 0, parcelas: 0, fixos: 0 });
    return porCartao.get(c)!;
  };

  for (const g of arr<GastoDeCartao>(e.variaveis)) {
    if (g?.paymentMethod === "credito" && g.cardName && mesDoGasto(g, e.configOf, e.mes) === e.mes) conta(g.cardName).variaveis += Number(g.value) || 0;
  }
  for (const g of arr<GastoDeCartao>(e.variaveisAnterior)) {
    if (g?.paymentMethod === "credito" && g.cardName && mesDoGasto(g, e.configOf, mesAnterior) === e.mes) conta(g.cardName).variaveis += Number(g.value) || 0;
  }
  for (const p of arr<Parcela>(e.parcelas)) {
    const v = valorDaParcelaNoMes(p);
    if (v > 0 && p.cardName) conta(p.cardName).parcelas += v;
  }
  for (const f of arr<EntradaFatura["fixos"][number]>(e.fixos)) {
    if (f?.paymentMethod === "credito" && f.cardName) conta(f.cardName).fixos += Number(f.value) || 0;
  }

  const out: FaturaDoMes[] = [];
  for (const card of new Set([...e.cards, ...porCartao.keys()])) {
    const dueDay = dia(e.configOf(card)?.dueDay);
    if (!dueDay) continue;
    const t = porCartao.get(card);
    const total = t ? t.variaveis + t.parcelas + t.fixos : 0;
    if (total <= 0.005) continue;
    out.push({
      card, label: e.labelOf(card), dueDay,
      total: Math.round(total * 100) / 100,
      variaveis: t?.variaveis ?? 0, parcelas: t?.parcelas ?? 0, fixos: t?.fixos ?? 0,
      paga: e.pagas?.[chaveDaFatura(e.mes, card)] === true,
    });
  }
  return out.sort((a, b) => a.dueDay - b.dueDay || a.label.localeCompare(b.label));
}

type Bill = { id: string; name: string; paid: boolean; value?: number };
type DueDay = { day: number; color: string; bills: Bill[] };

const CORES = ["yellow", "slate", "indigo", "emerald", "rose", "cyan", "orange", "purple"];

/** Nome da linha em CONTAS DO MÊS — com o valor, porque é o número que a pessoa confere. */
export const nomeDaFatura = (f: FaturaDoMes, comValor = true) => (comValor ? `Fatura ${f.label} · R$ ${brl(f.total)}` : `Fatura ${f.label}`);

/**
 * As contas do mês COM as faturas dentro (derivado, pra tela). Fatura cujo
 * vencimento não tem card de dia ainda ganha um — que some sozinho quando a
 * fatura não existir mais (é derivado, não gravado). `semValor` é pro
 * lembrete: o texto da notificação congela no agendamento e um valor velho
 * seria mentira; o nome do cartão não muda.
 */
export function injetarFaturas(dueDays: DueDay[], faturas: FaturaDoMes[], semValor = false): DueDay[] {
  if (!faturas.length) return dueDays;
  const dias = arr<DueDay>(dueDays).map((d) => ({ ...d, bills: arr<Bill>(d?.bills).filter((b) => !cartaoDoId(b?.id)) }));
  for (const f of faturas) {
    // `value` = só o que NÃO tem conta própria (gasto + parcela): o custo fixo
    // no cartão já vira conta do mês pelo sync, e contaria duas vezes no "a vencer"
    const bill: Bill = { id: idDaFaturaNoDia(f.card), name: nomeDaFatura(f, !semValor), paid: f.paga, value: Math.round((f.variaveis + f.parcelas) * 100) / 100 };
    const existente = dias.find((d) => Number(d?.day) === f.dueDay);
    if (existente) existente.bills = [...existente.bills, bill];
    else dias.push({ day: f.dueDay, color: CORES[dias.length % CORES.length], bills: [bill] });
  }
  return dias.sort((a, b) => Number(a.day) - Number(b.day));
}

/**
 * O caminho de volta: a tela devolve a lista com as faturas dentro; aqui
 * separa o que é gravável (contas de verdade) do que é derivado (faturas),
 * devolvendo quais faturas foram marcadas/desmarcadas. Dia que só existia
 * por causa da fatura não vai pro storage.
 */
export function extrairFaturas(lista: DueDay[], diasOriginais: DueDay[]): { dueDays: DueDay[]; faturas: { card: string; paga: boolean }[] } {
  const faturas: { card: string; paga: boolean }[] = [];
  const originais = new Set(arr<DueDay>(diasOriginais).map((d) => Number(d?.day)));
  const dueDays: DueDay[] = [];
  for (const d of arr<DueDay>(lista)) {
    const reais: Bill[] = [];
    for (const b of arr<Bill>(d?.bills)) {
      const card = cartaoDoId(b?.id);
      if (card) faturas.push({ card, paga: !!b.paid });
      else reais.push(b);
    }
    if (reais.length || originais.has(Number(d?.day))) dueDays.push({ ...d, bills: reais });
  }
  return { dueDays, faturas };
}
