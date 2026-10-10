import type { FaturaDoMes } from "@/lib/finance-faturas";
import { valorDaParcelaNoMes, type Parcela } from "@/lib/finance-parcelas";

/**
 * SALDO EM CONTA (10/10). Chamado: "O 'Saldo do Mês' calcula receitas menos
 * todas as despesas, inclusive o que foi pago no cartão de crédito. Seria
 * bacana um campo que refletisse só o débito real: receitas menos o que é pago
 * via pix/débito, aí bate certinho com o saldo que tenho em conta."
 *
 * Dois números, duas perguntas:
 *  - SALDO DO MÊS (o de sempre, lib/finance-totals) = quanto do mês já está
 *    COMPROMETIDO: receitas − fixos − variáveis − parcelas, com a compra no
 *    crédito contando no mês da fatura (lib/finance-fatura).
 *  - SALDO EM CONTA = quanto SOBRA NA CONTA neste mês: receitas − o que sai da
 *    conta agora (Pix, débito, dinheiro, boleto, transferência, débito
 *    automático) − as FATURAS DE CARTÃO QUE VENCEM neste mês (é dinheiro que
 *    sai da conta). A compra no crédito deste mês NÃO entra — ela só vira
 *    dinheiro saindo quando a fatura vencer.
 *
 * O que falta de dado conta como "sai da conta" — nunca some dinheiro:
 *  - gasto/fixo SEM forma de pagamento → sai da conta;
 *  - crédito num cartão SEM vencimento cadastrado (não existe fatura calculada
 *    pra ele) → conta no mês em que o gasto conta, como no Saldo do Mês;
 *  - parcela de cartão sem vencimento (ou sem cartão) → sai da conta no mês.
 * O ⓘ da tela diz isso e aponta pra ⚙️ do cartão (CartaoConfig).
 */

export type GastoComForma = { value?: unknown; paymentMethod?: unknown; cardName?: unknown };

export const CREDITO = "credito";

/** Pagamento que sai da conta no ato (ou que não sabemos — na dúvida, sai). */
export const saiDaConta = (paymentMethod: unknown): boolean => paymentMethod !== CREDITO;

const n = (v: unknown): number => (v !== null && Number.isFinite(Number(v)) ? Number(v) : 0);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export interface EntradaSaldoEmConta {
  receitas: number;
  /** Gastos variáveis que CONTAM neste mês (variaveisDoMes(...).noMes — já pela regra da fatura). */
  variaveis: GastoComForma[];
  fixos: GastoComForma[];
  /** Parcelas do mês corrente (o balde `finance-installments`, já do perfil). */
  parcelas: Parcela[];
  /** As faturas que VENCEM neste mês (faturasAVencer) — cada uma é dinheiro saindo da conta. */
  faturas: Pick<FaturaDoMes, "card" | "total">[];
  /** O cartão tem dia de vencimento cadastrado? Sem isso não há fatura e o crédito conta no mês. */
  temVencimento: (card: string) => boolean;
}

export interface SaldoEmConta {
  saldo: number;
  receitas: number;
  /** Pix, débito, dinheiro, boleto… (variáveis + fixos) — inclui o que não tem forma de pagamento. */
  debitoDireto: number;
  /** Soma das faturas que vencem no mês. */
  faturas: number;
  /** Crédito/parcela em cartão sem vencimento cadastrado (contado no mês, como no Saldo do Mês). */
  creditoSemFatura: number;
  /** Quantos lançamentos vieram sem forma de pagamento (pra avisar no ⓘ). */
  semForma: number;
  /** Cartões com crédito lançado mas sem vencimento cadastrado (pra apontar a ⚙️). */
  cartoesSemVencimento: string[];
}

export function calcularSaldoEmConta(e: EntradaSaldoEmConta): SaldoEmConta {
  let debitoDireto = 0;
  let creditoSemFatura = 0;
  let semForma = 0;
  const semVenc = new Set<string>();

  const lancamento = (g: GastoComForma) => {
    const v = n(g?.value);
    const forma = typeof g?.paymentMethod === "string" ? g.paymentMethod : "";
    if (!forma) semForma += 1;
    if (saiDaConta(forma)) { debitoDireto += v; return; }
    const card = typeof g?.cardName === "string" && g.cardName ? g.cardName : "";
    if (!card || !e.temVencimento(card)) {
      creditoSemFatura += v;
      if (card) semVenc.add(card);
    }
    // crédito em cartão COM vencimento: entra pela fatura que vence, não aqui
  };
  for (const g of arr<GastoComForma>(e.variaveis)) lancamento(g);
  for (const f of arr<GastoComForma>(e.fixos)) lancamento(f);

  for (const p of arr<Parcela>(e.parcelas)) {
    const v = valorDaParcelaNoMes(p);
    if (v <= 0) continue;
    const card = typeof p?.cardName === "string" && p.cardName ? p.cardName : "";
    if (!card || !e.temVencimento(card)) {
      creditoSemFatura += v;
      if (card) semVenc.add(card);
    }
  }

  const faturas = arr<Pick<FaturaDoMes, "card" | "total">>(e.faturas).reduce((s, f) => s + n(f?.total), 0);
  const receitas = n(e.receitas);
  const saldo = receitas - debitoDireto - faturas - creditoSemFatura;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return {
    saldo: r2(saldo), receitas: r2(receitas), debitoDireto: r2(debitoDireto), faturas: r2(faturas),
    creditoSemFatura: r2(creditoSemFatura), semForma, cartoesSemVencimento: Array.from(semVenc).sort(),
  };
}
