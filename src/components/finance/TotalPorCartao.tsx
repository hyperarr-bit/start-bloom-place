import { CartaoConfig } from "@/components/finance/CartaoConfig";
import { useFinanceCards } from "@/lib/finance-cards";
import { valorDaParcelaNoMes, nomeDoMes, somarMeses, type Parcela } from "@/lib/finance-parcelas";
import { mesDoGasto, rotuloVencimento, contaNoMesDoVencimento } from "@/lib/finance-fatura";
import { ehEstimativaDaFatura } from "@/lib/finance-faturas";
import { mesCorrenteId } from "@/lib/virada-contas";

/**
 * 💳 TOTAL POR CARTÃO NO MÊS — saiu de dentro do InstallmentTracker (1.0.16) sem mudar a conta nem
 * o visual: o PAINEL LIMPO do Dashboard (conta nova, lib/financas-painel-limpo) mostra o mesmo card.
 * Parcelas do mês + gastos no crédito que caem na fatura deste mês (regra do fechamento /
 * "conta no mês do vencimento", lib/finance-fatura). Sem nada no cartão, não renderiza.
 *
 * 1.0.16 — A FATURA DO MONTAR: o custo fixo "Fatura do cartão" que o "Vamos montar suas Finanças"
 * cria (`ehEstimativaDaFatura`, lib/finance-faturas) é a fatura do mês, mais ou menos — entra na
 * coluna de gastos do cartão dele (são as compras do cartão, chutadas). Só ele: os outros custos
 * fixos no cartão seguem fora, como sempre (cliente antigo vê exatamente o mesmo número). Quando o
 * mesmo cartão também tem compras ou parcelas anotadas no mês, aparece o aviso pra apagar a
 * estimativa — senão a fatura conta duas vezes.
 */
const brl = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  /** As parcelas que a lista mostra (as do mês + as previstas de outros meses). */
  parcelas: Parcela[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variableExpenses?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variableExpensesAnterior?: any[];
  /** Custos fixos do mês — só a estimativa da fatura do Montar é lida daqui. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fixos?: any[];
  /** "YYYY-MM" do mês da tela. Ausente = mês corrente. */
  mes?: string;
}

export const TotalPorCartao = ({ parcelas, variableExpenses = [], variableExpensesAnterior = [], fixos = [], mes }: Props) => {
  const { labelOf: getCardLabel, styleOf: getCardStyle, configOf } = useFinanceCards();
  const mesDaChave = mes ?? mesCorrenteId();
  // Group by card for the summary — merge installments + variable expenses
  const cardTotals = (Array.isArray(parcelas) ? parcelas : []).reduce((acc, i) => {
    const v = valorDaParcelaNoMes(i);
    if (v > 0) acc[i.cardName] = (acc[i.cardName] || 0) + v;
    return acc;
  }, {} as Record<string, number>);

  /* Gastos do cartão que caem na FATURA deste mês: os deste mês antes do
     fechamento + os do mês anterior depois do fechamento de lá (cartão sem
     fechamento cadastrado: tudo do mês, como sempre). */
  const mesAnterior = somarMeses(mesDaChave, -1);
  const comprasNoCartao: Record<string, number> = {};
  for (const e of variableExpenses) {
    if (e?.cardName && mesDoGasto(e, configOf, mesDaChave) === mesDaChave) comprasNoCartao[e.cardName] = (comprasNoCartao[e.cardName] || 0) + (e.value || 0);
  }
  for (const e of variableExpensesAnterior) {
    if (e?.cardName && mesDoGasto(e, configOf, mesAnterior) === mesDaChave) comprasNoCartao[e.cardName] = (comprasNoCartao[e.cardName] || 0) + (e.value || 0);
  }
  // a fatura chutada no Montar (custo fixo marcado) — vale todo mês, como o fixo que ela é
  const estimativa: Record<string, number> = {};
  for (const f of Array.isArray(fixos) ? fixos : []) {
    if (ehEstimativaDaFatura(f) && Number(f.value) > 0) estimativa[f.cardName] = (estimativa[f.cardName] || 0) + Number(f.value);
  }
  const variableCardSpending: Record<string, number> = { ...comprasNoCartao };
  for (const [card, v] of Object.entries(estimativa)) variableCardSpending[card] = (variableCardSpending[card] || 0) + v;

  // Merge into unified card totals
  const allCardTotals = { ...cardTotals };
  Object.entries(variableCardSpending).forEach(([card, amount]) => {
    allCardTotals[card] = (allCardTotals[card] || 0) + (amount as number);
  });

  /* Estimativa + compras anotadas que caem NESTA fatura = a mesma fatura duas vezes. Só compras (não
     parcela): no mês do Montar o cartão nasce com "conta no mês do vencimento" e a compra anotada vai
     pra fatura seguinte — o aviso só aparece quando elas chegam; a parcela conta no mês em que é
     lançada (simplificação do app inteiro) e avisaria cedo demais, quando a estimativa ainda vale. */
  const contandoDuasVezes = Object.keys(estimativa).filter((card) => (comprasNoCartao[card] || 0) > 0);
  const doCartao = (card: string) => {
    const nome = getCardLabel(card);
    return /^cart[aã]o$/i.test(nome.trim()) ? "do cartão" : `do cartão ${nome}`;
  };

  /* Card spending summary - parcelamentos + gastos variáveis. Com
     fechamento cadastrado a linha vira a FATURA do mês (07/09). */
  if (Object.keys(allCardTotals).length === 0) return null;
  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border animate-fade-in" data-testid="total-por-cartao">
      <div className="bg-muted/50 py-2 px-4">
        <span className="font-bold text-sm tracking-wide">💳 TOTAL POR CARTÃO NO MÊS</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Cartão</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs">Parcelas</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs">Gastos</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs">Total</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(allCardTotals)
              .sort(([, a], [, b]) => b - a)
              .map(([card, total]) => {
                const cfg = configOf(card);
                const vencimento = rotuloVencimento(cfg);
                return (
                  <tr key={card} className="border-b border-border/50">
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`category-badge ${getCardStyle(card)}`}>
                          {getCardLabel(card)}
                        </span>
                        {(cfg?.closingDay || contaNoMesDoVencimento(cfg)) && (
                          <span className="text-[10px] text-muted-foreground">
                            Fatura de {nomeDoMes(mesDaChave)}{vencimento ? ` · ${vencimento}` : ""}
                          </span>
                        )}
                        <CartaoConfig card={card} label={getCardLabel(card)} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground align-top">
                      {(cardTotals[card] || 0) > 0 ? `R$ ${brl(cardTotals[card] || 0)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground align-top">
                      {(variableCardSpending[card] || 0) > 0 ? `R$ ${brl(variableCardSpending[card] || 0)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold align-top">
                      R$ {brl(total)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <td className="px-3 py-2 text-xs font-bold">TOTAL CARTÕES</td>
              <td className="px-3 py-2 text-right tabular-nums text-xs font-medium">
                R$ {brl(Object.values(cardTotals).reduce((a, b) => a + b, 0))}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-xs font-medium">
                R$ {brl((Object.values(variableCardSpending) as number[]).reduce((a, b) => a + b, 0))}
              </td>
              <td className="px-3 py-2 text-right font-bold tabular-nums">
                R$ {brl(Object.values(allCardTotals).reduce((a, b) => a + b, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {contandoDuasVezes.map((card) => (
        <p key={card} className="px-4 py-2 text-[11px] leading-snug border-t border-border bg-amber-500/10 text-amber-700 dark:text-amber-300" data-testid="aviso-estimativa">
          Se você anota todas as compras {doCartao(card)} aqui, apaga a “Fatura do cartão” dos custos fixos — senão a fatura conta duas vezes.
        </p>
      ))}
    </div>
  );
};
