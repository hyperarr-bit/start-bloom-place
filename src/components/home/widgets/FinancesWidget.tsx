import { useNavigate } from "react-router-dom";
import { DollarSign, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { useUserData } from "@/hooks/use-user-data";
import { WidgetSize } from "@/hooks/use-home-widgets";
import { useState } from "react";

export const FinancesWidget = ({ size = "small" }: { size?: WidgetSize }) => {
  const navigate = useNavigate();
  const data = useLifeHubData();
  const { get, set } = useUserData();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickAmount, setQuickAmount] = useState("");

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleQuickExpense = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!quickName || !quickAmount) return;
    const currentExpenses = get<any[]>("finance-expenses", []);
    const newExpense = {
      id: Date.now().toString(),
      description: quickName,
      category: "outros",
      value: parseFloat(quickAmount),
      date: new Date().toISOString().slice(0, 10),
    };
    set("finance-expenses", [...currentExpenses, newExpense]);
    setQuickName("");
    setQuickAmount("");
    setShowQuickAdd(false);
  };

  const allExpenses = [
    ...get<any[]>("finance-expenses", []),
    ...get<any[]>("finance-fixed-expenses", []),
  ];
  const lastExpenses = allExpenses.slice(-2).reverse();

  if (size === "small") {
    return (
      <button onClick={() => navigate("/financas")} className="w-full text-left bg-card rounded-2xl p-4 shadow-sm hover:shadow-md border border-border/50 transition-all">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-400/20">
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Finanças</h3>
            <p className={`text-sm font-bold ${data.monthBalance >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(data.monthBalance)}</p>
            {data.nextBillName && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">📅 {data.nextBillName}</p>}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="w-full text-left bg-card rounded-2xl p-4 shadow-sm border border-border/50">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => navigate("/financas")} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-400/20">
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Finanças</h3>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setShowQuickAdd(!showQuickAdd); }}
          className="w-7 h-7 rounded-full bg-amber-400/20 text-amber-600 flex items-center justify-center hover:bg-amber-400/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className={`text-xl font-bold ${data.monthBalance >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(data.monthBalance)}</p>

      {lastExpenses.length > 0 && (
        <div className="mt-2 space-y-1">
          {lastExpenses.map((exp: any) => (
            <div key={exp.id} className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground truncate flex-1">{exp.description || exp.name}</span>
              <span className="text-destructive font-medium ml-2">-{fmt(Number(exp.value) || Number(exp.amount) || 0)}</span>
            </div>
          ))}
        </div>
      )}

      {data.nextBillName && <p className="text-[10px] text-muted-foreground mt-2">📅 Próxima: {data.nextBillName}</p>}

      {showQuickAdd && (
        <form onSubmit={handleQuickExpense} className="mt-3 space-y-2 border-t border-border/50 pt-3" onClick={e => e.stopPropagation()}>
          <input
            value={quickName}
            onChange={e => setQuickName(e.target.value)}
            placeholder="Descrição"
            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-input bg-background"
          />
          <div className="flex gap-2">
            <input
              value={quickAmount}
              onChange={e => setQuickAmount(e.target.value)}
              placeholder="Valor"
              type="number"
              step="0.01"
              className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-input bg-background"
            />
            <button type="submit" className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
              Salvar
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
