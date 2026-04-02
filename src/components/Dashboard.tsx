import { useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from "recharts";
import { AlertTriangle, Bell, CheckCircle, TrendingUp, TrendingDown, Calendar, DollarSign, Lightbulb, Clock, CreditCard, Receipt } from "lucide-react";
import { getMonthTotals } from "@/components/finance/storage-keys";

const ALL_MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface Expense {
  id: string;
  description: string;
  category: string;
  value: number;
  date: string;
  paymentMethod?: string;
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

interface DashboardProps {
  totalIncome: number;
  totalExpenses: number;
  totalDebts: number;
  totalInvestments: number;
  expenses: Expense[];
  fixedExpenses: FixedExpense[];
  dueDays: DueDay[];
  savingsRate: number;
  onNavigateToFinanceiro?: () => void;
}

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#6366f1", "#14b8a6", "#f97316"];

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

const categoryEmojis: Record<string, string> = {
  alimentacao: "🍽️", restaurante: "🍔", mercado: "🛒", transporte: "🚗", combustivel: "⛽",
  lazer: "🎮", entretenimento: "🎬", saude: "💊", farmacia: "💊", educacao: "📚",
  vestuario: "👕", beleza: "💅", eletronicos: "📱", servicos: "🔧", delivery: "🛵",
  presente: "🎁", casa: "🏠", pets: "🐾", filhos: "👶", viagem: "✈️",
  moradia: "🏠", contas_casa: "💡", condominio: "🏢", seguro: "🛡️", plano_saude: "🏥",
  assinaturas: "📺", internet_telefone: "📡", academia: "🏋️", transporte_fixo: "🚌",
  fatura_cartao: "💳", financiamento: "🏦", pensao: "👴", outros: "📦",
};

const PAYMENT_COLORS: Record<string, string> = {
  pix: "hsl(var(--chart-4))",
  credito: "hsl(var(--chart-1))",
  debito: "hsl(var(--chart-2))",
  dinheiro: "hsl(var(--chart-3))",
  boleto: "hsl(var(--chart-5))",
};

const PAYMENT_LABELS: Record<string, string> = {
  pix: "Pix",
  credito: "Cartão de Crédito",
  debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
  boleto: "Boleto",
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
  onNavigateToFinanceiro,
}: DashboardProps) => {
  // Compute annual data from actual monthly records
  const annualData = useMemo(() => {
    return ALL_MONTHS.map((month) => {
      const totals = getMonthTotals(month);
      return { month, ...totals };
    });
  }, []);

  // ── Month Progress ──
  const monthProgress = useMemo(() => {
    const now = new Date();
    const day = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const timePct = Math.round((day / daysInMonth) * 100);
    const totalFixed = fixedExpenses.reduce((s, e) => s + e.value, 0);
    const spentPct = totalIncome > 0 ? Math.min(Math.round(((totalExpenses + totalFixed) / totalIncome) * 100), 100) : 0;
    const ahead = spentPct > timePct + 10;
    return { day, daysInMonth, timePct, spentPct, ahead };
  }, [totalIncome, totalExpenses, fixedExpenses]);

  // ── Recent Transactions ──
  const recentTransactions = useMemo(() => {
    const all = [
      ...expenses.map((e) => ({ ...e, type: "variable" as const })),
      ...fixedExpenses.map((e) => ({ ...e, date: "", type: "fixed" as const })),
    ];
    return all
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 5);
  }, [expenses, fixedExpenses]);

  // ── Payment Method Distribution ──
  const paymentData = useMemo(() => {
    const grouped: Record<string, number> = {};
    expenses.forEach((e) => {
      const method = (e.paymentMethod || "outros").toLowerCase();
      grouped[method] = (grouped[method] || 0) + e.value;
    });
    fixedExpenses.forEach((e) => {
      const method = (e.paymentMethod || "outros").toLowerCase();
      grouped[method] = (grouped[method] || 0) + e.value;
    });
    return Object.entries(grouped)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({
        name: PAYMENT_LABELS[name] || name,
        value,
        fill: PAYMENT_COLORS[name] || "hsl(var(--muted-foreground))",
      }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, fixedExpenses]);

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
        accumulated += saving * 0.2;
        return { month: d.month.substring(0, 3), Patrimônio: Math.round(accumulated) };
      });
  }, [annualData, totalInvestments]);

  // Smart alerts
  const alerts = useMemo(() => {
    const list: { type: "warning" | "info" | "success"; icon: typeof AlertTriangle; text: string }[] = [];
    const today = new Date().getDate();

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

    if (savingsRate >= 20) {
      list.push({ type: "success", icon: CheckCircle, text: `Excelente! Você está poupando ${savingsRate.toFixed(1)}% da sua renda este mês.` });
    } else if (savingsRate > 0) {
      list.push({ type: "info", icon: Lightbulb, text: `Sua taxa de poupança é ${savingsRate.toFixed(1)}%. Tente chegar a 20%!` });
    } else {
      list.push({ type: "warning", icon: TrendingDown, text: "Suas despesas estão maiores que sua renda. Revise seus gastos!" });
    }

    if (totalDebts > totalIncome * 2) {
      list.push({ type: "warning", icon: AlertTriangle, text: `Suas dívidas (R$ ${totalDebts.toLocaleString("pt-BR")}) são mais que o dobro da sua renda mensal.` });
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

      {/* ── Month Progress Bar ── */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-xs font-bold mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          PROGRESSO DO MÊS
        </h3>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>Dia {monthProgress.day}/{monthProgress.daysInMonth}</span>
          <span className={monthProgress.ahead ? "text-destructive font-medium" : "text-foreground font-medium"}>
            {monthProgress.spentPct}% gasto
          </span>
        </div>
        {/* Time progress */}
        <div className="space-y-2">
          <div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>Tempo do mês</span>
              <span>{monthProgress.timePct}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-muted-foreground/40 transition-all"
                style={{ width: `${monthProgress.timePct}%` }}
              />
            </div>
          </div>
          {/* Spend progress */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>Orçamento gasto</span>
              <span>{monthProgress.spentPct}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  monthProgress.ahead ? "bg-destructive" : monthProgress.spentPct > 70 ? "bg-yellow-500" : "bg-emerald-500"
                }`}
                style={{ width: `${monthProgress.spentPct}%` }}
              />
            </div>
          </div>
        </div>
        {monthProgress.ahead && (
          <p className="text-[10px] text-destructive mt-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Gastos acima do esperado para este dia do mês
          </p>
        )}
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
          <h3 className="text-xs font-bold mb-3 flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            GASTOS POR CATEGORIA
          </h3>
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

        {/* Recent Transactions */}
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              ÚLTIMAS TRANSAÇÕES
            </h3>
            {onNavigateToFinanceiro && (
              <button
                onClick={onNavigateToFinanceiro}
                className="text-[10px] text-primary hover:underline"
              >
                Ver todas →
              </button>
            )}
          </div>
          {recentTransactions.length > 0 ? (
            <div className="space-y-2">
              {recentTransactions.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-base">{categoryEmojis[t.category] || "📦"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{t.description}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {t.date || "Fixo"} · {PAYMENT_LABELS[(t.paymentMethod || "").toLowerCase()] || t.paymentMethod || "—"}
                    </p>
                  </div>
                  <span className="font-semibold text-destructive whitespace-nowrap">
                    -R$ {t.value.toLocaleString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transação registrada</p>
          )}
        </div>
      </div>

      {/* Second Charts Row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Monthly Bar Chart */}
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-xs font-bold mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            RECEITAS VS DESPESAS
          </h3>
          {monthlyBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyBarData}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Receitas" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Preencha o orçamento anual para ver o gráfico</p>
          )}
        </div>

        {/* Payment Method Distribution */}
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-xs font-bold mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            GASTO POR MÉTODO DE PAGAMENTO
          </h3>
          {paymentData.length > 0 ? (
            <div className="space-y-3">
              {paymentData.map((item) => {
                const totalAll = paymentData.reduce((s, d) => s + d.value, 0);
                const pct = totalAll > 0 ? Math.round((item.value / totalAll) * 100) : 0;
                return (
                  <div key={item.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground">
                        R$ {item.value.toLocaleString("pt-BR")} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: item.fill }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados de pagamento</p>
          )}
        </div>
      </div>

      {/* Patrimony Evolution */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-xs font-bold mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          EVOLUÇÃO DO PATRIMÔNIO
        </h3>
        {patrimonyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={patrimonyData}>
              <defs>
                <linearGradient id="colorPatrimony" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`} />
              <Area type="monotone" dataKey="Patrimônio" stroke="hsl(var(--chart-1))" fill="url(#colorPatrimony)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Dados insuficientes</p>
        )}
      </div>
    </div>
  );
};
