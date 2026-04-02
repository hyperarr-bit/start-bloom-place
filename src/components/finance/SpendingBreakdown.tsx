import { Layers, ShoppingCart } from "lucide-react";

interface SpendingBreakdownProps {
  totalIncome: number;
  totalFixed: number;
  totalVariable: number;
}

export const SpendingBreakdown = ({ totalIncome, totalFixed, totalVariable }: SpendingBreakdownProps) => {
  const totalSpent = totalFixed + totalVariable;
  const remaining = totalIncome - totalSpent;
  const fixedPct = totalIncome > 0 ? Math.min(Math.round((totalFixed / totalIncome) * 100), 100) : 0;
  const variablePct = totalIncome > 0 ? Math.min(Math.round((totalVariable / totalIncome) * 100), 100) : 0;
  const spentPct = totalIncome > 0 ? Math.min(Math.round((totalSpent / totalIncome) * 100), 100) : 0;

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <h3 className="text-xs font-bold mb-3 flex items-center gap-2">
        <Layers className="w-4 h-4" />
        RESUMO DE GASTOS
      </h3>

      {/* Stacked bar */}
      <div className="w-full h-3 rounded-full bg-muted overflow-hidden flex mb-3">
        {fixedPct > 0 && (
          <div
            className="h-full bg-chart-1 transition-all"
            style={{ width: `${fixedPct}%` }}
          />
        )}
        {variablePct > 0 && (
          <div
            className="h-full bg-chart-3 transition-all"
            style={{ width: `${variablePct}%` }}
          />
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        {/* Fixed */}
        <div>
          <div className="flex items-center justify-center gap-1 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-chart-1" />
            <span className="text-[10px] text-muted-foreground">Fixos</span>
          </div>
          <p className="text-sm font-bold">
            R$ {totalFixed.toLocaleString("pt-BR")}
          </p>
          <p className="text-[10px] text-muted-foreground">{fixedPct}% da renda</p>
        </div>

        {/* Variable */}
        <div>
          <div className="flex items-center justify-center gap-1 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-chart-3" />
            <span className="text-[10px] text-muted-foreground">Variáveis</span>
          </div>
          <p className="text-sm font-bold">
            R$ {totalVariable.toLocaleString("pt-BR")}
          </p>
          <p className="text-[10px] text-muted-foreground">{variablePct}% da renda</p>
        </div>

        {/* Remaining */}
        <div>
          <div className="flex items-center justify-center gap-1 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
            <span className="text-[10px] text-muted-foreground">Sobra</span>
          </div>
          <p className={`text-sm font-bold ${remaining >= 0 ? "text-emerald-500" : "text-destructive"}`}>
            R$ {remaining.toLocaleString("pt-BR")}
          </p>
          <p className="text-[10px] text-muted-foreground">{100 - spentPct}% da renda</p>
        </div>
      </div>
    </div>
  );
};
