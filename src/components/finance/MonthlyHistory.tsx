import { useMemo } from "react";
import { AreaChart, Area, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts";
import { TrendingUp, TrendingDown, Calendar, ChevronRight } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { getMonthTotals } from "@/components/finance/storage-keys";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface MonthData {
  month: string;
  short: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

interface MonthlyHistoryProps {
  onOpenMonth?: (month: string) => void;
}

export const MonthlyHistory = ({ onOpenMonth }: MonthlyHistoryProps) => {
  const { get } = useUserData();

  const monthsData = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const results: MonthData[] = [];

    // Go back 6 months (not including current)
    for (let i = 6; i >= 1; i--) {
      const monthIdx = (currentMonth - i + 12) % 12;
      const monthName = MONTH_NAMES[monthIdx];
      const totals = getMonthTotals(monthName, (key, fallback) => get(key, fallback));
      const totalDespesas = totals.custosFixos + totals.custosVariaveis;

      if (totals.receitas > 0 || totalDespesas > 0) {
        results.push({
          month: monthName,
          short: MONTH_SHORT[monthIdx],
          receitas: totals.receitas,
          despesas: totalDespesas,
          saldo: totals.receitas - totalDespesas,
        });
      }
    }

    return results;
  }, [get]);

  if (monthsData.length === 0) return null;

  // Compute trends
  const lastMonth = monthsData[monthsData.length - 1];
  const prevMonth = monthsData.length > 1 ? monthsData[monthsData.length - 2] : null;

  const incomeTrend = prevMonth && prevMonth.receitas > 0
    ? ((lastMonth.receitas - prevMonth.receitas) / prevMonth.receitas) * 100
    : 0;

  const expenseTrend = prevMonth && prevMonth.despesas > 0
    ? ((lastMonth.despesas - prevMonth.despesas) / prevMonth.despesas) * 100
    : 0;

  const avgSaldo = monthsData.reduce((s, m) => s + m.saldo, 0) / monthsData.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-xs font-bold uppercase tracking-wider">Histórico Mensal</h3>
      </div>

      {/* Mini evolution chart */}
      <div className="bg-card rounded-xl border border-border p-4">
        <p className="text-xs text-muted-foreground mb-3">Receitas vs Despesas</p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={monthsData} barGap={2}>
            <XAxis dataKey="short" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
            />
            <Bar dataKey="receitas" name="Receitas" fill="hsl(var(--card-receitas-text))" radius={[4, 4, 0, 0]} barSize={16} />
            <Bar dataKey="despesas" name="Despesas" fill="hsl(var(--card-despesas-text))" radius={[4, 4, 0, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Saldo evolution sparkline */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground">Evolução do Saldo</p>
          <div className="flex items-center gap-1">
            {avgSaldo >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-destructive" />
            )}
            <span className={`text-xs font-bold ${avgSaldo >= 0 ? "text-emerald-500" : "text-destructive"}`}>
              R$ {Math.abs(Math.round(avgSaldo)).toLocaleString("pt-BR")}/mês
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={monthsData}>
            <defs>
              <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="short" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
            />
            <Area
              type="monotone"
              dataKey="saldo"
              name="Saldo"
              stroke="hsl(var(--primary))"
              fill="url(#saldoGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Trend indicators */}
      {prevMonth && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-card rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground mb-1">Receita vs mês anterior</p>
            <div className="flex items-center gap-1.5">
              {incomeTrend >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-destructive" />
              )}
              <span className={`text-sm font-bold ${incomeTrend >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                {incomeTrend >= 0 ? "+" : ""}{incomeTrend.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="bg-card rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground mb-1">Despesa vs mês anterior</p>
            <div className="flex items-center gap-1.5">
              {expenseTrend <= 0 ? (
                <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <TrendingUp className="w-3.5 h-3.5 text-destructive" />
              )}
              <span className={`text-sm font-bold ${expenseTrend <= 0 ? "text-emerald-500" : "text-destructive"}`}>
                {expenseTrend >= 0 ? "+" : ""}{expenseTrend.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Month cards - clickable */}
      <div className="space-y-1.5">
        {monthsData.map((m) => (
          <button
            key={m.month}
            onClick={() => onOpenMonth?.(m.month)}
            className="w-full flex items-center gap-3 bg-card rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-muted-foreground">{m.short}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{m.month}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="text-emerald-500">+R$ {m.receitas.toLocaleString("pt-BR")}</span>
                <span className="text-destructive">-R$ {m.despesas.toLocaleString("pt-BR")}</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`text-xs font-bold ${m.saldo >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                {m.saldo >= 0 ? "+" : ""}R$ {m.saldo.toLocaleString("pt-BR")}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};
