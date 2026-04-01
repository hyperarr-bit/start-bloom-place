import { useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from "recharts";
import { AlertTriangle, Bell, CheckCircle, TrendingUp, TrendingDown, Calendar, DollarSign, Lightbulb } from "lucide-react";

interface Expense {
  id: string;
  description: string;
  category: string;
  value: number;
  date: string;
}

interface DueDay {
  day: number;
  bills: { id: string; name: string; paid: boolean }[];
}

interface AnnualData {
  month: string;
  receitas: number;
  custosFixos: number;
  custosVariaveis: number;
  dividas: number;
}

interface FixedExpense {
  id: string;
  description: string;
  category: string;
  value: number;
  paymentMethod: string;
  cardName?: string;
}

interface DashboardProps {
  totalIncome: number;
  totalExpenses: number;
  totalDebts: number;
  totalInvestments: number;
  expenses: Expense[];
  fixedExpenses: FixedExpense[];
  dueDays: DueDay[];
  annualData: AnnualData[];
  savingsRate: number;
}

const COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#6366f1", "#14b8a6"];

const categoryLabels: Record<string, string> = {
  vestuario: "Vestuário",
  restaurante: "Restaurante",
  educacao: "Educação",
  presente: "Presentes",
  lazer: "Lazer",
  eletrodomesticos: "Eletrodomésticos",
  mercado: "Mercado",
  transporte: "Transporte",
  saude: "Saúde",
  outros: "Outros",
};

export const Dashboard = ({
  totalIncome,
  totalExpenses,
  totalDebts,
  totalInvestments,
  expenses,
  fixedExpenses,
  dueDays,
  annualData,
  savingsRate,
}: DashboardProps) => {
  // Expense by category for pie chart (variable + fixed)
  const expensesByCategory = useMemo(() => {
    const grouped: Record<string, number> = {};
    expenses.forEach((e) => {
      const cat = e.category || "outros";
      grouped[cat] = (grouped[cat] || 0) + e.value;
    });
    fixedExpenses.forEach((e) => {
      const cat = e.category || "outros";
      grouped[cat] = (grouped[cat] || 0) + e.value;
    });
    return Object.entries(grouped)
      .map(([name, value]) => ({ name: categoryLabels[name] || name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, fixedExpenses]);

  // Bar chart data for monthly comparison
  const monthlyBarData = useMemo(() => {
    return annualData
      .filter((d) => d.receitas > 0 || d.custosFixos > 0 || d.custosVariaveis > 0)
      .slice(0, 6)
      .map((d) => ({
        month: d.month.substring(0, 3),
        Receitas: d.receitas,
        Despesas: d.custosFixos + d.custosVariaveis,
        Saldo: d.receitas - d.custosFixos - d.custosVariaveis - d.dividas,
      }));
  }, [annualData]);

  // Patrimony evolution (cumulative savings)
  const patrimonyData = useMemo(() => {
    let accumulated = totalInvestments;
    return annualData
      .filter((d) => d.receitas > 0)
      .slice(0, 6)
      .map((d) => {
        const saving = d.receitas - d.custosFixos - d.custosVariaveis - d.dividas;
        accumulated += saving * 0.2; // Assume 20% saved
        return { month: d.month.substring(0, 3), Patrimônio: Math.round(accumulated) };
      });
  }, [annualData, totalInvestments]);

  // Smart alerts
  const alerts = useMemo(() => {
    const list: { type: "warning" | "info" | "success"; icon: typeof AlertTriangle; text: string }[] = [];
    const today = new Date().getDate();

    // Bills due soon
    dueDays.forEach((d) => {
      const unpaidBills = d.bills.filter((b) => !b.paid);
      const daysUntilDue = d.day >= today ? d.day - today : 30 - today + d.day;
      if (unpaidBills.length > 0 && daysUntilDue <= 5 && daysUntilDue >= 0) {
        list.push({
          type: "warning",
          icon: Calendar,
          text: `${unpaidBills.length} conta(s) vencem em ${daysUntilDue} dia(s): ${unpaidBills.map((b) => b.name).join(", ")}`,
        });
      }
    });

    // Budget alert
    const budgetUsed = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;
    const dayOfMonth = today;
    const expectedUsage = (dayOfMonth / 30) * 100;
    if (budgetUsed > expectedUsage + 20) {
      list.push({
        type: "warning",
        icon: AlertTriangle,
        text: `Você já gastou ${budgetUsed.toFixed(0)}% do orçamento, mas estamos apenas no dia ${dayOfMonth}!`,
      });
    }

    // Savings rate
    if (savingsRate >= 20) {
      list.push({
        type: "success",
        icon: CheckCircle,
        text: `Excelente! Você está poupando ${savingsRate.toFixed(1)}% da sua renda este mês.`,
      });
    } else if (savingsRate > 0) {
      list.push({
        type: "info",
        icon: Lightbulb,
        text: `Sua taxa de poupança é ${savingsRate.toFixed(1)}%. Tente chegar a 20%!`,
      });
    } else {
      list.push({
        type: "warning",
        icon: TrendingDown,
        text: "Suas despesas estão maiores que sua renda. Revise seus gastos!",
      });
    }

    // Debt alert
    if (totalDebts > totalIncome * 2) {
      list.push({
        type: "warning",
        icon: AlertTriangle,
        text: `Suas dívidas (R$ ${totalDebts.toLocaleString("pt-BR")}) são mais que o dobro da sua renda mensal.`,
      });
    }

    return list.slice(0, 4);
  }, [dueDays, totalIncome, totalExpenses, savingsRate, totalDebts]);

  const balance = totalIncome - totalExpenses;

  return (
    <div className="space-y-4">
      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Receitas</p>
              <p className="text-xl font-bold text-green-400">R$ {totalIncome.toLocaleString("pt-BR")}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-400/30" />
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Despesas</p>
              <p className="text-xl font-bold text-red-400">R$ {totalExpenses.toLocaleString("pt-BR")}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-400/30" />
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Saldo do Mês</p>
              <p className={`text-xl font-bold ${balance >= 0 ? "text-green-400" : "text-red-400"}`}>
                {balance >= 0 ? "+" : ""}R$ {balance.toLocaleString("pt-BR")}
              </p>
            </div>
            {balance >= 0 ? <TrendingUp className="w-8 h-8 text-green-400/30" /> : <TrendingDown className="w-8 h-8 text-red-400/30" />}
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Investimentos</p>
              <p className="text-xl font-bold text-purple-400">R$ {totalInvestments.toLocaleString("pt-BR")}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-400/30" />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-xs font-bold mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            ALERTAS INTELIGENTES
          </h3>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 p-2 rounded text-xs ${
                  alert.type === "warning"
                    ? "bg-orange-500/10 border border-orange-500/20"
                    : alert.type === "success"
                    ? "bg-green-500/10 border border-green-500/20"
                    : "bg-blue-500/10 border border-blue-500/20"
                }`}
              >
                <alert.icon
                  className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    alert.type === "warning" ? "text-orange-400" : alert.type === "success" ? "text-green-400" : "text-blue-400"
                  }`}
                />
                <p>{alert.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Expense Pie Chart */}
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-xs font-bold mb-3">📊 GASTOS POR CATEGORIA</h3>
          {expensesByCategory.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={expensesByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                    {expensesByCategory.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1">
                {expensesByCategory.slice(0, 5).map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="flex-1 truncate">{cat.name}</span>
                    <span className="text-muted-foreground">R$ {cat.value.toLocaleString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sem despesas cadastradas</p>
          )}
        </div>

        {/* Monthly Bar Chart */}
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-xs font-bold mb-3">📈 RECEITAS VS DESPESAS</h3>
          {monthlyBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyBarData}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Preencha o orçamento anual para ver o gráfico</p>
          )}
        </div>
      </div>

      {/* Patrimony Evolution */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-xs font-bold mb-3">💰 EVOLUÇÃO DO PATRIMÔNIO</h3>
        {patrimonyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={patrimonyData}>
              <defs>
                <linearGradient id="colorPatrimony" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`} />
              <Area type="monotone" dataKey="Patrimônio" stroke="#8b5cf6" fill="url(#colorPatrimony)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Dados insuficientes</p>
        )}
      </div>
    </div>
  );
};