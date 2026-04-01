import { motion } from "framer-motion";
import { useUserData } from "@/hooks/use-user-data";

export const BudgetRemainingWidget = () => {
  const { get } = useUserData();
  const incomes = get<any[]>("finance-incomes", []);
  const variableExpenses = get<any[]>("finance-expenses", []);
  const fixedExpenses = get<any[]>("finance-fixed-expenses", []);
  const totalIncome = incomes.reduce((s: number, i: any) => s + (Number(i.value) || Number(i.amount) || 0), 0);
  const totalExpense = variableExpenses.reduce((s: number, e: any) => s + (Number(e.value) || Number(e.amount) || 0), 0)
    + fixedExpenses.reduce((s: number, e: any) => s + (Number(e.value) || Number(e.amount) || 0), 0);
  const remaining = totalIncome - totalExpense;
  const pct = totalIncome > 0 ? Math.min((totalExpense / totalIncome) * 100, 100) : 0;

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();
  const dailyBudget = daysLeft > 0 ? remaining / daysLeft : 0;

  return (
    <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">💰 Orçamento Restante</h4>
      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-lg font-bold ${remaining >= 0 ? "text-emerald-600" : "text-destructive"}`}>
          {remaining.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-2">
        <motion.div
          className={`h-full rounded-full ${pct > 90 ? "bg-destructive" : pct > 70 ? "bg-warning" : "bg-emerald-500"}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {daysLeft > 0
          ? `≈ ${dailyBudget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/dia por ${daysLeft} dias`
          : "Último dia do mês"
        }
      </p>
    </div>
  );
};
