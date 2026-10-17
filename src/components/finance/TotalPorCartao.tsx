import { CartaoConfig } from "@/components/finance/CartaoConfig";
import { useFinanceCards } from "@/lib/finance-cards";
import { valorDaParcelaNoMes, nomeDoMes, somarMeses, type Parcela } from "@/lib/finance-parcelas";
import { mesDoGasto, rotuloVencimento, contaNoMesDoVencimento } from "@/lib/finance-fatura";
import { mesCorrenteId } from "@/lib/virada-contas";

/**
 * 💳 TOTAL POR CARTÃO NO MÊS — saiu de dentro do InstallmentTracker (1.0.16) sem mudar uma linha da
 * conta nem do visual: o PAINEL LIMPO do Dashboard (conta nova) mostra o mesmo card no topo.
 * Parcelas do mês + gastos no crédito que caem na fatura deste mês (regra do fechamento /
 * "conta no mês do vencimento", lib/finance-fatura). Sem nada no cartão, não renderiza.
 */
const brl = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  /** As parcelas que a lista mostra (as do mês + as previstas de outros meses). */
  parcelas: Parcela[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variableExpenses?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variableExpensesAnterior?: any[];
  /** "YYYY-MM" do mês da tela. Ausente = mês corrente. */
  mes?: string;
}

export const TotalPorCartao = ({ parcelas, variableExpenses = [], variableExpensesAnterior = [], mes }: Props) => {
  const { labelOf: getCardLabel, styleOf: getCardStyle, configOf } = useFinanceCards();
  const mesDaChave = mes ?? mesCorrenteId();
  // Group by card for the summary — merge installments + variable expenses
  const cardTotals = parcelas.reduce((acc, i) => {
    const v = valorDaParcelaNoMes(i);
    if (v > 0) acc[i.cardName] = (acc[i.cardName] || 0) + v;
    return acc;
  }, {} as Record<string, number>);

  /* Gastos do cartão que caem na FATURA deste mês: os deste mês antes do
     fechamento + os do mês anterior depois do fechamento de lá (cartão sem
     fechamento cadastrado: tudo do mês, como sempre). */
  const mesAnterior = somarMeses(mesDaChave, -1);
  const variableCardSpending: Record<string, number> = {};
  for (const e of variableExpenses) {
    if (e?.cardName && mesDoGasto(e, configOf, mesDaChave) === mesDaChave) variableCardSpending[e.cardName] = (variableCardSpending[e.cardName] || 0) + (e.value || 0);
  }
  for (const e of variableExpensesAnterior) {
    if (e?.cardName && mesDoGasto(e, configOf, mesAnterior) === mesDaChave) variableCardSpending[e.cardName] = (variableCardSpending[e.cardName] || 0) + (e.value || 0);
  }

  // Merge into unified card totals
  const allCardTotals = { ...cardTotals };
  Object.entries(variableCardSpending).forEach(([card, amount]) => {
    allCardTotals[card] = (allCardTotals[card] || 0) + (amount as number);
  });

  return (
    <>
      {/* Card spending summary - parcelamentos + gastos variáveis. Com
          fechamento cadastrado a linha vira a FATURA do mês (07/09). */}
      {Object.keys(allCardTotals).length > 0 && (
        <div className="bg-card rounded-lg overflow-hidden border border-border animate-fade-in">
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
        </div>
      )}
    </>
  );
};
