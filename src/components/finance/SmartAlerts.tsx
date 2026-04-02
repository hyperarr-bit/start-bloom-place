import { useMemo } from "react";
import { Bell, AlertTriangle, CheckCircle, X, Clock } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";

interface SmartAlertsProps {
  dueDays: { day: number; bills: { name: string; paid: boolean }[] }[];
  categoryBudgets: Record<string, number>;
  expensesByCategory: Record<string, number>;
  savingsRate: number;
}

interface Alert {
  id: string;
  type: "warning" | "danger" | "success" | "info";
  icon: typeof Bell;
  message: string;
}

export const SmartAlerts = ({ dueDays, categoryBudgets, expensesByCategory, savingsRate }: SmartAlertsProps) => {
  const [dismissed, setDismissed] = usePersistedState<string[]>("finance-dismissed-alerts", []);

  const today = new Date().getDate();

  const alerts = useMemo(() => {
    const result: Alert[] = [];

    // Bills due soon (3 days before)
    dueDays.forEach(dd => {
      const unpaid = dd.bills.filter(b => !b.paid);
      if (unpaid.length > 0) {
        const daysUntil = dd.day >= today ? dd.day - today : 30 - today + dd.day;
        if (daysUntil <= 3 && daysUntil >= 0) {
          unpaid.forEach(bill => {
            result.push({
              id: `bill-${dd.day}-${bill.name}`,
              type: daysUntil === 0 ? "danger" : "warning",
              icon: Clock,
              message: daysUntil === 0
                ? `"${bill.name}" vence HOJE (dia ${dd.day})`
                : `"${bill.name}" vence em ${daysUntil} dia${daysUntil > 1 ? "s" : ""} (dia ${dd.day})`,
            });
          });
        }
      }
    });

    // Category budget exceeded 80%
    Object.entries(categoryBudgets).forEach(([cat, limit]) => {
      const spent = expensesByCategory[cat] || 0;
      const pct = limit > 0 ? (spent / limit) * 100 : 0;
      if (pct >= 100) {
        result.push({
          id: `cat-exceeded-${cat}`,
          type: "danger",
          icon: AlertTriangle,
          message: `Limite de "${cat}" excedido: R$ ${spent.toLocaleString("pt-BR")} / R$ ${limit.toLocaleString("pt-BR")}`,
        });
      } else if (pct >= 80) {
        result.push({
          id: `cat-warning-${cat}`,
          type: "warning",
          icon: AlertTriangle,
          message: `Atenção: "${cat}" em ${Math.round(pct)}% do limite (R$ ${spent.toLocaleString("pt-BR")} / R$ ${limit.toLocaleString("pt-BR")})`,
        });
      }
    });

    // Savings rate celebration
    if (savingsRate >= 30) {
      result.push({
        id: "savings-great",
        type: "success",
        icon: CheckCircle,
        message: `Taxa de economia de ${savingsRate.toFixed(0)}% — excelente! Continue assim`,
      });
    } else if (savingsRate >= 20) {
      result.push({
        id: "savings-good",
        type: "success",
        icon: CheckCircle,
        message: `Taxa de economia de ${savingsRate.toFixed(0)}% — bom trabalho!`,
      });
    }

    return result;
  }, [dueDays, categoryBudgets, expensesByCategory, savingsRate, today]);

  const visibleAlerts = alerts.filter(a => !dismissed.includes(a.id));

  if (visibleAlerts.length === 0) return null;

  const dismiss = (id: string) => setDismissed([...dismissed, id]);

  const typeStyles: Record<string, string> = {
    warning: "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-300",
    danger: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300",
    success: "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300",
    info: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300",
  };

  const iconStyles: Record<string, string> = {
    warning: "text-yellow-500",
    danger: "text-red-500",
    success: "text-green-500",
    info: "text-blue-500",
  };

  return (
    <div className="space-y-2 animate-fade-in">
      {visibleAlerts.map(alert => (
        <div key={alert.id} className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${typeStyles[alert.type]}`}>
          <alert.icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${iconStyles[alert.type]}`} />
          <span className="flex-1">{alert.message}</span>
          <button onClick={() => dismiss(alert.id)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
};
