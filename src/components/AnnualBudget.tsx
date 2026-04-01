import { useMemo } from "react";
import { getMonthTotals, getCurrentMonthName } from "@/components/finance/storage-keys";

const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const AnnualBudget = () => {
  const currentMonth = getCurrentMonthName();

  const computedData = useMemo(() => {
    return months.map((month) => {
      const totals = getMonthTotals(month);
      return {
        month,
        ...totals,
        isCurrent: month === currentMonth,
        hasData: totals.receitas + totals.custosFixos + totals.custosVariaveis + totals.dividas > 0,
      };
    });
  }, [currentMonth]);

  const sumCol = (field: "receitas" | "custosFixos" | "custosVariaveis" | "dividas") =>
    computedData.reduce((s, d) => s + d[field], 0);

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border animate-fade-in">
      <div className="table-header-dark rounded-t-lg">ORÇAMENTO E BALANÇO ANUAL</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[550px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mês</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">RECEITAS</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">C. FIXOS</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">C. VARIÁVEIS</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">DÍVIDAS</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">BALANÇO</th>
            </tr>
          </thead>
          <tbody>
            {computedData.map((row) => {
              const balance = row.receitas - row.custosFixos - row.custosVariaveis - row.dividas;
              return (
                <tr key={row.month} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${row.isCurrent ? "bg-primary/5" : ""}`}>
                  <td className="px-3 py-1.5 font-medium">
                    {row.month}
                    {row.isCurrent && <span className="text-[8px] ml-1 text-primary">●</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {row.receitas > 0 ? row.receitas.toLocaleString("pt-BR") : ""}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {row.custosFixos > 0 ? row.custosFixos.toLocaleString("pt-BR") : ""}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {row.custosVariaveis > 0 ? row.custosVariaveis.toLocaleString("pt-BR") : ""}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {row.dividas > 0 ? row.dividas.toLocaleString("pt-BR") : ""}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-medium tabular-nums ${balance >= 0 ? "text-success" : "text-destructive"}`}>
                    {balance !== 0 ? `${balance >= 0 ? "+" : ""}${balance.toLocaleString("pt-BR")}` : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/30">
              <td className="px-3 py-2 font-medium text-muted-foreground">TOTAL</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums">{sumCol("receitas").toLocaleString("pt-BR")}</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums">{sumCol("custosFixos").toLocaleString("pt-BR")}</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums">{sumCol("custosVariaveis").toLocaleString("pt-BR")}</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums">{sumCol("dividas").toLocaleString("pt-BR")}</td>
              <td className={`px-3 py-2 text-right font-bold tabular-nums ${(sumCol("receitas") - sumCol("custosFixos") - sumCol("custosVariaveis") - sumCol("dividas")) >= 0 ? "text-success" : "text-destructive"}`}>
                {(sumCol("receitas") - sumCol("custosFixos") - sumCol("custosVariaveis") - sumCol("dividas")).toLocaleString("pt-BR")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
