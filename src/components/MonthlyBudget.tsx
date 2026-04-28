import { FileText, ChevronRight } from "lucide-react";
import { getFinanceStorageKeys, isCurrentMonth, getCurrentYear, readMonthData } from "@/components/finance/storage-keys";
import { useAuth } from "@/hooks/use-auth";

interface MonthBudget {
  month: string;
  value: number;
  hasNote: boolean;
}

interface MonthlyBudgetProps {
  budgets: MonthBudget[];
  setBudgets: (budgets: MonthBudget[]) => void;
  onOpenMonth?: (month: string) => void;
}

const currentMonthIndex = new Date().getMonth();

const hasMonthData = (userId: string | null, month: string) => {
  const keys = getFinanceStorageKeys(month, getCurrentYear());
  const incomes = readMonthData(userId, keys.incomes) || [];
  const expenses = readMonthData(userId, keys.expenses) || [];
  const fixed = readMonthData(userId, keys.fixed) || [];
  return incomes.length > 0 || expenses.length > 0 || fixed.length > 0;
};

export const MonthlyBudget = ({ budgets, setBudgets, onOpenMonth }: MonthlyBudgetProps) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border animate-fade-in">
      <div className="bg-accent/20 border-b border-border px-4 py-2 flex items-center gap-2">
        <span className="font-bold text-xs tracking-wide text-foreground">ORÇAMENTO MENSAL</span>
        <span>💰</span>
      </div>
      <div className="divide-y divide-border/50">
        {budgets.map((b, i) => {
          const hasData = hasMonthData(userId, b.month);
          const isCurrent = i === currentMonthIndex;
          return (
            <button
              key={b.month}
              onClick={() => onOpenMonth?.(b.month)}
              className={`w-full flex items-center px-3 py-2 hover:bg-muted/30 transition-colors text-left gap-2 ${
                isCurrent ? "bg-primary/5" : ""
              }`}
            >
              <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${
                isCurrent ? "text-primary" : "text-muted-foreground"
              }`} />
              <span className={`text-xs flex-1 ${
                isCurrent ? "font-bold text-primary" : ""
              }`}>
                {b.month}
                {isCurrent && <span className="text-[9px] ml-1 opacity-70">(atual)</span>}
              </span>
              {hasData && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-success/15 text-success font-medium">
                  ativo
                </span>
              )}
              <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
