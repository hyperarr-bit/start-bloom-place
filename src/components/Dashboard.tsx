import { useMemo } from "react";
import { localDayKey } from "@/lib/utils";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from "recharts";
import { AlertTriangle, Bell, CheckCircle, TrendingUp, TrendingDown, Calendar, DollarSign, Lightbulb, Clock, ArrowRight, Lock, ShoppingCart, CreditCard, Banknote, Smartphone, Receipt, Wallet } from "lucide-react";
import { getMonthTotals, getCurrentYear } from "@/components/finance/storage-keys";
import { computeDailyBudget, computeUnpaidBillsEstimate } from "@/lib/finance-totals";
import { useAuth } from "@/hooks/use-auth";
import { Progress } from "@/components/ui/progress";

const ALL_MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

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

interface FixedExpense {
  id: string;
  description: string;
  category: string;
  value: number;
  paymentMethod: string;
  cardName?: string;
}

interface Income {
  id: string;
  description: string;
  value: number;
  date?: string;
}

interface DashboardProps {
  totalIncome: number;
  totalExpenses: number;
  totalDebts: number;
  totalInvestments: number;
  expenses: Expense[];
  fixedExpenses: FixedExpense[];
  dueDays: DueDay[];
  savingsRate: number;
  incomes: Income[];
  /** Parcelas do mês — já dentro de totalExpenses; a previsão precisa do valor
   *  separado pra não projetar parcela fixa como gasto variável diário. */
  monthlyInstallments?: number;
  onNavigate?: (tab: string) => void;
}

const COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#6366f1", "#14b8a6"];

const categoryLabels: Record<string, string> = {
  alimentacao: "Alimentação",
  restaurante: "Restaurante",
  mercado: "Mercado",
  transporte: "Transporte",
  combustivel: "Combustível",
  lazer: "Lazer",
  entretenimento: "Entretenimento",
  saude: "Saúde",
  farmacia: "Farmácia",
  educacao: "Educação",
  vestuario: "Vestuário",
  beleza: "Beleza",
  eletronicos: "Eletrônicos",
  servicos: "Serviços",
  delivery: "Delivery",
  presente: "Presentes",
  casa: "Casa",
  pets: "Pets",
  filhos: "Filhos",
  viagem: "Viagem",
  moradia: "Moradia",
  contas_casa: "Contas da Casa",
  condominio: "Condomínio",
  seguro: "Seguro",
  plano_saude: "Plano de Saúde",
  assinaturas: "Assinaturas",
  internet_telefone: "Internet/Telefone",
  academia: "Academia",
  transporte_fixo: "Transporte Fixo",
  fatura_cartao: "Fatura Cartão",
  financiamento: "Financiamento",
  pensao: "Pensão",
  outros: "Outros",
};

const paymentMethodLabels: Record<string, string> = {
  pix: "Pix",
  credito: "Crédito",
  debito: "Débito",
  dinheiro: "Dinheiro",
  boleto: "Boleto",
  transferencia: "Transferência",
};

const paymentMethodColors: Record<string, string> = {
  pix: "bg-green-400",
  credito: "bg-purple-400",
  debito: "bg-blue-400",
  dinheiro: "bg-yellow-400",
  boleto: "bg-orange-400",
  transferencia: "bg-teal-400",
};

const paymentMethodIcons: Record<string, typeof CreditCard> = {
  pix: Smartphone,
  credito: CreditCard,
  debito: Wallet,
  dinheiro: Banknote,
  boleto: Receipt,
  transferencia: ArrowRight,
};

export const Dashboard = ({
  totalIncome,
  totalExpenses,
  totalDebts,
  totalInvestments,
  expenses,
  fixedExpenses,
  dueDays,
  savingsRate,
  incomes,
  monthlyInstallments = 0,
  onNavigate,
}: DashboardProps) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const currentYear = getCurrentYear();

  // Compute annual data from actual monthly records (current year only)
  const annualData = useMemo(() => {
    return ALL_MONTHS.map((month) => {
      const totals = getMonthTotals(month, userId, currentYear);
      return { month, ...totals };
    });
  }, [currentYear, userId]);

  // Month progress data
  const monthProgress = useMemo(() => {
    const now = new Date();
    const day = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const timePercent = Math.round((day / daysInMonth) * 100);
    const budgetPercent = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0;
    return { day, daysInMonth, timePercent, budgetPercent };
  }, [totalIncome, totalExpenses]);

  // Last 5 transactions
  const lastTransactions = useMemo(() => {
    const allTransactions = [
      ...expenses.map((e) => ({ ...e, type: "variable" as const })),
      ...fixedExpenses.map((e) => ({ ...e, date: localDayKey(), type: "fixed" as const })),
    ];
    return allTransactions
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [expenses, fixedExpenses]);

  // Payment method breakdown
  const paymentBreakdown = useMemo(() => {
    const grouped: Record<string, number> = {};
    expenses.forEach((e) => {
      const method = (e as any).paymentMethod || "dinheiro";
      grouped[method] = (grouped[method] || 0) + e.value;
    });
    fixedExpenses.forEach((e) => {
      const method = e.paymentMethod || "boleto";
      grouped[method] = (grouped[method] || 0) + e.value;
    });
    const total = Object.values(grouped).reduce((s, v) => s + v, 0);
    return Object.entries(grouped)
      .map(([method, value]) => ({
        method,
        value,
        percent: total > 0 ? Math.round((value / total) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, fixedExpenses]);

  // Fixed vs Variable totals
  const fixedTotal = useMemo(() => fixedExpenses.reduce((s, e) => s + e.value, 0), [fixedExpenses]);
  const variableTotal = useMemo(() => expenses.reduce((s, e) => s + e.value, 0), [expenses]);
  const totalCosts = fixedTotal + variableTotal;

  // Expense by category for pie chart
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

  // Bar chart data — only consecutive months up to current month
  const currentMonthIdx = new Date().getMonth();
  const monthlyBarData = useMemo(() => {
    return annualData
      .slice(0, currentMonthIdx + 1)
      .filter((d) => d.receitas > 0 || d.custosFixos > 0 || d.custosVariaveis > 0)
      .map((d) => ({
        month: d.month.substring(0, 3),
        Receitas: d.receitas,
        Despesas: d.custosFixos + d.custosVariaveis,
        Saldo: d.receitas - d.custosFixos - d.custosVariaveis - d.dividas,
      }));
  }, [annualData, currentMonthIdx]);

  // Patrimony evolution — real accumulated balance across months
  // Patrimônio = investments base + sum of monthly balances (receitas - fixos - variáveis)
  const patrimonyData = useMemo(() => {
    let accumulated = totalInvestments;
    const result: { month: string; Patrimônio: number }[] = [];
    for (let i = 0; i <= currentMonthIdx; i++) {
      const d = annualData[i];
      const hasData = d.receitas > 0 || d.custosFixos > 0 || d.custosVariaveis > 0;
      if (!hasData && result.length === 0) continue; // skip leading empty months
      const monthBalance = d.receitas - d.custosFixos - d.custosVariaveis;
      accumulated += monthBalance;
      result.push({ month: d.month.substring(0, 3), Patrimônio: Math.round(accumulated) });
    }
    return result;
  }, [annualData, totalInvestments, currentMonthIdx]);

  // Smart alerts
  const alerts = useMemo(() => {
    const list: { type: "warning" | "info" | "success"; icon: typeof AlertTriangle; text: string }[] = [];
    const now = new Date();
    const today = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Contas: separa as ATRASADAS (dia já passou e não pagas) das próximas a vencer.
    const overdueNames: string[] = [];
    const upcomingAlerts: { type: "warning"; icon: typeof AlertTriangle; text: string }[] = [];
    dueDays.forEach((d) => {
      const billsArr = Array.isArray(d?.bills) ? d.bills : [];
      const unpaidBills = billsArr.filter((b) => !b?.paid);
      if (unpaidBills.length === 0) return;
      if (d.day < today) {
        unpaidBills.forEach((b) => overdueNames.push(b.name));
        return;
      }
      const daysUntilDue = d.day - today;
      if (daysUntilDue > 5) return;
      const names = unpaidBills.map((b) => b.name).join(", ");
      const when = daysUntilDue === 0 ? "vencem hoje" : daysUntilDue === 1 ? "vencem amanhã" : `vencem em ${daysUntilDue} dias`;
      upcomingAlerts.push({ type: "warning", icon: Calendar, text: `${unpaidBills.length} conta(s) ${when}: ${names}` });
    });
    // Atrasadas primeiro (mais urgente), depois as próximas a vencer.
    if (overdueNames.length > 0) {
      list.push({
        type: "warning",
        icon: AlertTriangle,
        text: `${overdueNames.length} conta(s) atrasada(s): ${overdueNames.join(", ")}`,
      });
    }
    upcomingAlerts.forEach((a) => list.push(a));

    // Ritmo de gasto: só alerta quando as despesas ainda NÃO passaram a renda
    // (esse caso já tem alerta próprio) e o gasto está bem à frente do ritmo do mês.
    const incomeUsedPct = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;
    const monthProgress = (today / daysInMonth) * 100;
    if (totalExpenses <= totalIncome && incomeUsedPct > monthProgress + 25 && today < daysInMonth - 2) {
      list.push({
        type: "warning",
        icon: AlertTriangle,
        text: `Você já usou ${incomeUsedPct.toFixed(0)}% da sua renda e o mês está só ${monthProgress.toFixed(0)}% completo. Segura o ritmo!`,
      });
    }

    if (totalIncome === 0 && totalExpenses === 0) {
      // Sem dados — não mostra alerta
    } else if (savingsRate >= 20) {
      list.push({ type: "success", icon: CheckCircle, text: `Excelente! Você está poupando ${savingsRate.toFixed(1)}% da sua renda este mês.` });
    } else if (savingsRate > 0) {
      list.push({ type: "info", icon: Lightbulb, text: `Sua taxa de poupança é ${savingsRate.toFixed(1)}%. Tente chegar a 20%!` });
    } else if (totalExpenses > totalIncome) {
      list.push({ type: "warning", icon: TrendingDown, text: "Suas despesas estão maiores que sua renda. Revise seus gastos!" });
    }

    if (totalDebts > totalIncome * 2) {
      list.push({ type: "warning", icon: AlertTriangle, text: `Suas dívidas (R$ ${totalDebts.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}) são mais que o dobro da sua renda mensal.` });
    }

    return list.slice(0, 4);
  }, [dueDays, totalIncome, totalExpenses, savingsRate, totalDebts]);

  const balance = totalIncome - totalExpenses;

  // Forecast: predicted end-of-month balance
  // Logic: totalExpenses already includes fixedExpenses that are recorded.
  // We only need to project future variable spending + unpaid bills NOT yet in totalExpenses.
  const forecast = useMemo(() => {
    const now = new Date();
    const day = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remainingDays = daysInMonth - day;

    // Fixed costs already recorded (these are already inside totalExpenses)
    const fixedCostsRecorded = fixedExpenses.reduce((s, e) => s + e.value, 0);

    // Variable expenses = totalExpenses minus fixed costs and installments
    // (parcelas são valor fixo do mês — não entram no ritmo diário projetado)
    const variableSpent = Math.max(0, totalExpenses - fixedCostsRecorded - monthlyInstallments);
    const dailyVariableRate = day > 0 ? variableSpent / day : 0;
    const projectedVariableRemaining = dailyVariableRate * remainingDays;

    // Unpaid bills: obrigações futuras ainda fora de totalExpenses — cálculo
    // compartilhado em lib/finance-totals (mesmo número no Pergunte ao CORE).
    const unpaidBillsEstimate = computeUnpaidBillsEstimate(dueDays, fixedExpenses);

    // Projected balance = income - what's already spent - future bills - future variable
    const projectedBalance = totalIncome - totalExpenses - unpaidBillsEstimate - projectedVariableRemaining;

    return {
      projectedBalance, dailyVariableRate, remainingDays, daysInMonth, day,
      fixedCostsRecorded, unpaidBillsEstimate, variableSpent, projectedVariableRemaining,
      totalAlreadySpent: totalExpenses,
    };
  }, [totalIncome, totalExpenses, fixedExpenses, dueDays, monthlyInstallments]);

  // Daily budget: how much you can spend per day
  // Logic: saldo atual = income - totalExpenses (already spent, includes fixed recorded)
  // Only reserve future unpaid bills (NOT fixed costs already recorded/spent)
  const dailyBudget = useMemo(() => {
    // Cálculo compartilhado (lib/finance-totals) — o Pergunte ao CORE responde
    // com exatamente este número.
    const base = computeDailyBudget(totalIncome, totalExpenses, dueDays, fixedExpenses);
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const fixedCostsRecorded = fixedExpenses.reduce((s, e) => s + e.value, 0);
    const idealPerDay = totalIncome > 0 ? (totalIncome - fixedCostsRecorded) / daysInMonth : 0;
    const status: "good" | "warning" | "danger" = base.cantSpend
      ? "danger"
      : base.perDay > idealPerDay * 0.8
      ? "good"
      : "warning";
    return { ...base, status, fixedCostsRecorded };
  }, [totalIncome, totalExpenses, fixedExpenses, dueDays]);

  // Top 5 largest expenses
  const top5Expenses = useMemo(() => {
    const all = [
      ...expenses.map((e) => ({ id: e.id, description: e.description, value: e.value, category: e.category })),
      ...fixedExpenses.map((e) => ({ id: e.id, description: e.description, value: e.value, category: e.category })),
    ];
    return all.sort((a, b) => b.value - a.value).slice(0, 5);
  }, [expenses, fixedExpenses]);

  const categoryBarColors: Record<string, string> = {
    alimentacao: "bg-orange-400", restaurante: "bg-amber-400", mercado: "bg-lime-500",
    transporte: "bg-blue-400", combustivel: "bg-zinc-400", lazer: "bg-purple-400",
    entretenimento: "bg-pink-400", saude: "bg-green-400", farmacia: "bg-red-400",
    vestuario: "bg-fuchsia-400", beleza: "bg-rose-400", educacao: "bg-teal-400",
    eletronicos: "bg-cyan-400", servicos: "bg-slate-400", delivery: "bg-yellow-400",
    presente: "bg-violet-400", casa: "bg-stone-400", pets: "bg-emerald-400",
    filhos: "bg-sky-400", viagem: "bg-indigo-400", outros: "bg-gray-400",
    moradia: "bg-orange-400", contas_casa: "bg-yellow-400", condominio: "bg-amber-400",
    seguro: "bg-sky-400", plano_saude: "bg-green-400", assinaturas: "bg-purple-400",
    internet_telefone: "bg-blue-400", academia: "bg-lime-500", transporte_fixo: "bg-indigo-400",
    fatura_cartao: "bg-rose-400", financiamento: "bg-red-400", pensao: "bg-stone-400",
  };
  const categoryTextColors: Record<string, string> = {
    alimentacao: "text-orange-400", restaurante: "text-amber-400", mercado: "text-lime-500",
    transporte: "text-blue-400", combustivel: "text-zinc-400", lazer: "text-purple-400",
    entretenimento: "text-pink-400", saude: "text-green-400", farmacia: "text-red-400",
    vestuario: "text-fuchsia-400", beleza: "text-rose-400", educacao: "text-teal-400",
    eletronicos: "text-cyan-400", servicos: "text-slate-400", delivery: "text-yellow-400",
    presente: "text-violet-400", casa: "text-stone-400", pets: "text-emerald-400",
    filhos: "text-sky-400", viagem: "text-indigo-400", outros: "text-gray-400",
    moradia: "text-orange-400", contas_casa: "text-yellow-400", condominio: "text-amber-400",
    seguro: "text-sky-400", plano_saude: "text-green-400", assinaturas: "text-purple-400",
    internet_telefone: "text-blue-400", academia: "text-lime-500", transporte_fixo: "text-indigo-400",
    fatura_cartao: "text-rose-400", financiamento: "text-red-400", pensao: "text-stone-400",
  };


  // Budget bar color
  const getBudgetColor = () => {
    const { timePercent, budgetPercent } = monthProgress;
    if (budgetPercent > timePercent + 15) return "bg-red-400";
    if (budgetPercent > timePercent - 5) return "bg-orange-400";
    return "bg-green-400";
  };

  return (
    <div className="space-y-4">
      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Receitas</p>
              <p className="text-xl font-bold text-green-400">R$ {totalIncome.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-400/30" />
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Despesas</p>
              <p className="text-xl font-bold text-red-400">R$ {totalExpenses.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-400/30" />
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Saldo do Mês</p>
              <p className={`text-xl font-bold ${balance >= 0 ? "text-green-400" : "text-red-400"}`}>
                {balance >= 0 ? "+" : ""}R$ {balance.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
              </p>
            </div>
            {balance >= 0 ? <TrendingUp className="w-8 h-8 text-green-400/30" /> : <TrendingDown className="w-8 h-8 text-red-400/30" />}
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Investimentos</p>
              <p className="text-xl font-bold text-purple-400">R$ {totalInvestments.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</p>
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
                  <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1">
                {expensesByCategory.slice(0, 5).map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="flex-1 truncate">{cat.name}</span>
                    <span className="text-muted-foreground">R$ {cat.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span>
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
                <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`} />
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
              <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`} />
              <Area type="monotone" dataKey="Patrimônio" stroke="#8b5cf6" fill="url(#colorPatrimony)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Dados insuficientes</p>
        )}
      </div>

      {/* Month Progress */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-xs font-bold mb-3">⏳ PROGRESSO DO MÊS</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Dia {monthProgress.day} de {monthProgress.daysInMonth} — {monthProgress.budgetPercent}% do orçamento usado
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground w-16">Tempo</span>
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${monthProgress.timePercent}%` }} />
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground w-10 text-right">{monthProgress.timePercent}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground w-16">Gastos</span>
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${getBudgetColor()}`} style={{ width: `${Math.min(monthProgress.budgetPercent, 100)}%` }} />
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground w-10 text-right">{monthProgress.budgetPercent}%</span>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-xs font-bold mb-3">💳 GASTO POR MÉTODO</h3>
        {paymentBreakdown.length > 0 ? (
          <div className="space-y-2.5">
            {paymentBreakdown.map((pm) => {
              const Icon = paymentMethodIcons[pm.method] || Wallet;
              return (
                <div key={pm.method} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs">{paymentMethodLabels[pm.method] || pm.method}</span>
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      R$ {pm.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ({pm.percent}%)
                    </span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${paymentMethodColors[pm.method] || "bg-gray-400"}`}
                      style={{ width: `${pm.percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">Sem dados de pagamento</p>
        )}
      </div>

      {/* Fixed vs Variable */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-xs font-bold mb-3">⚖️ FIXOS VS VARIÁVEIS</h3>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase mb-1">Custos Fixos</p>
            <p className="text-lg font-bold tabular-nums text-orange-400">
              R$ {fixedTotal.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {totalCosts > 0 ? Math.round((fixedTotal / totalCosts) * 100) : 0}% do total
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase mb-1">Custos Variáveis</p>
            <p className="text-lg font-bold tabular-nums text-blue-400">
              R$ {variableTotal.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {totalCosts > 0 ? Math.round((variableTotal / totalCosts) * 100) : 0}% do total
            </p>
          </div>
        </div>
        {totalCosts > 0 && (
          <div className="h-2 bg-secondary rounded-full overflow-hidden flex">
            <div className="h-full bg-orange-400 transition-all" style={{ width: `${Math.round((fixedTotal / totalCosts) * 100)}%` }} />
            <div className="h-full bg-blue-400 transition-all" style={{ width: `${Math.round((variableTotal / totalCosts) * 100)}%` }} />
          </div>
        )}
      </div>

      {/* Top 5 Maiores Gastos */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-xs font-bold mb-3">🏆 TOP 5 MAIORES GASTOS</h3>
        {top5Expenses.length > 0 ? (
          <div className="space-y-2">
            {top5Expenses.map((item, i) => {
              const barColor = categoryBarColors[item.category] || "bg-gray-400";
              const textColor = categoryTextColors[item.category] || "text-gray-400";
              return (
                <div key={item.id} className="bg-secondary/30 rounded-lg px-3 py-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs truncate flex-1 mr-2">
                      <span className="font-bold mr-1.5">{i + 1}.</span>
                      {item.description}
                    </span>
                    <span className={`text-xs tabular-nums font-semibold flex-shrink-0 ${textColor}`}>
                      R$ {item.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${top5Expenses[0] ? Math.round((item.value / top5Expenses[0].value) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">Sem despesas cadastradas</p>
        )}
      </div>

      {/* Últimas Transações */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-xs font-bold mb-3">🧾 ÚLTIMAS TRANSAÇÕES</h3>
        {lastTransactions.length > 0 ? (
          <div className="space-y-2">
            {lastTransactions.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                <span className="text-xs flex-1 truncate">{t.description}</span>
                <span className="text-xs tabular-nums text-red-400 font-medium">
                  -R$ {t.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-muted-foreground w-12 text-right">
                  {t.date.slice(8, 10)}/{t.date.slice(5, 7)}
                </span>
              </div>
            ))}
            {onNavigate && (
              <button
                onClick={() => onNavigate("financeiro")}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-2 transition-colors"
              >
                Ver todas <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">Sem transações registradas</p>
        )}
      </div>

      {/* Forecast + Daily Budget */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Previsão de Saldo */}
        <div className={`rounded-lg border p-4 ${forecast.projectedBalance >= 0 ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
          <h3 className="text-xs font-bold mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            PREVISÃO FIM DO MÊS
          </h3>
          <p className={`text-2xl font-bold tabular-nums ${forecast.projectedBalance >= 0 ? "text-green-400" : "text-red-400"}`}>
            {forecast.projectedBalance >= 0 ? "+" : ""}R$ {Math.round(forecast.projectedBalance).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Custos fixos reservados integralmente. Projeção baseada no ritmo de gastos variáveis.
          </p>
          <div className="mt-3 space-y-2">
            <div className="text-[10px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Receita total</span>
                <span className="text-green-400 tabular-nums">R$ {totalIncome.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span>
              </div>
              <p className="text-[9px] text-muted-foreground/60">Soma de todos os ganhos registrados no mês</p>
            </div>
            <div className="text-[10px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Já gasto (fixos + variáveis)</span>
                <span className="text-red-400 tabular-nums">-R$ {Math.round(forecast.totalAlreadySpent).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span>
              </div>
              <p className="text-[9px] text-muted-foreground/60">Tudo que já saiu da conta: contas pagas, compras, etc.</p>
            </div>
            {forecast.unpaidBillsEstimate > 0 && (
              <div className="text-[10px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contas pendentes (estimativa)</span>
                  <span className="text-orange-400 tabular-nums">-R$ {Math.round(forecast.unpaidBillsEstimate).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span>
                </div>
                <p className="text-[9px] text-muted-foreground/60">Contas nos vencimentos que ainda não foram marcadas como pagas</p>
              </div>
            )}
            <div className="text-[10px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Projeção variável ({forecast.remainingDays}d × R$ {Math.round(forecast.dailyVariableRate).toLocaleString("pt-BR", { maximumFractionDigits: 2 })})</span>
                <span className="text-yellow-400 tabular-nums">-R$ {Math.round(forecast.projectedVariableRemaining).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span>
              </div>
              <p className="text-[9px] text-muted-foreground/60">Estimativa do que você ainda vai gastar baseado no seu ritmo atual</p>
            </div>
            <div className="text-[10px] border-t border-border pt-1 mt-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Saldo projetado</span>
                <span className={`tabular-nums font-bold ${forecast.projectedBalance >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {forecast.projectedBalance >= 0 ? "+" : ""}R$ {Math.round(forecast.projectedBalance).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-[9px] text-muted-foreground/60">O que deve sobrar (ou faltar) no fim do mês</p>
            </div>
          </div>
        </div>

        {/* Quanto Posso Gastar Hoje */}
        <div className={`rounded-lg border p-4 ${
          dailyBudget.status === "good" ? "bg-green-500/5 border-green-500/20" :
          dailyBudget.status === "warning" ? "bg-orange-500/5 border-orange-500/20" :
          "bg-red-500/5 border-red-500/20"
        }`}>
          <h3 className="text-xs font-bold mb-2 flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            QUANTO POSSO GASTAR HOJE
          </h3>
          {dailyBudget.cantSpend ? (
            <>
              <p className="text-2xl font-bold tabular-nums text-red-400">R$ 0</p>
              <p className="text-[10px] text-red-400 mt-2 flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>Você não pode gastar — suas contas futuras consomem todo o saldo restante. Guarde o que puder.</span>
              </p>
            </>
          ) : (
            <p className={`text-2xl font-bold tabular-nums ${
              dailyBudget.status === "good" ? "text-green-400" :
              dailyBudget.status === "warning" ? "text-orange-400" :
              "text-red-400"
            }`}>
              R$ {Math.round(dailyBudget.perDay).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">
            {dailyBudget.remainingDays} dias restantes no mês
          </p>
          <div className="mt-3 space-y-2">
            <div className="text-[10px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo atual</span>
                <span className="tabular-nums">R$ {Math.round(dailyBudget.currentBalance).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span>
              </div>
              <p className="text-[9px] text-muted-foreground/60">Receita menos tudo que já foi gasto até agora</p>
            </div>
            {dailyBudget.unpaidBillsEstimate > 0 && (
              <div className="text-[10px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contas pendentes (reserva)</span>
                  <span className="text-orange-400 tabular-nums">-R$ {Math.round(dailyBudget.unpaidBillsEstimate).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span>
                </div>
                <p className="text-[9px] text-muted-foreground/60">Valor reservado para contas que ainda vão vencer este mês</p>
              </div>
            )}
            <div className="text-[10px] border-t border-border pt-1 mt-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Disponível livre</span>
                <span className={`tabular-nums font-medium ${dailyBudget.availableReal >= 0 ? "text-green-400" : "text-red-400"}`}>
                  R$ {Math.round(Math.max(0, dailyBudget.availableReal)).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-[9px] text-muted-foreground/60">O que sobra depois de reservar para contas futuras</p>
            </div>
            {!dailyBudget.cantSpend && (
              <div className="text-[10px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">÷ {dailyBudget.remainingDays} dias</span>
                  <span className="tabular-nums">= R$ {Math.round(dailyBudget.perDay).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}/dia</span>
                </div>
                <p className="text-[9px] text-muted-foreground/60">Disponível livre dividido pelos dias que faltam no mês</p>
              </div>
            )}
          </div>
          {!dailyBudget.cantSpend && dailyBudget.status === "warning" && (
            <p className="text-[10px] text-orange-400 mt-2 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              Atenção: ritmo de gastos acima do ideal
            </p>
          )}
        </div>
      </div>
    </div>
  );
};