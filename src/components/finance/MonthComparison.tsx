import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ArrowLeftRight, ChevronDown } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { getFinanceStorageKeys } from "@/components/finance/storage-keys";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface CategoryData {
  category: string;
  monthA: number;
  monthB: number;
}

interface MonthDetail {
  receitas: number;
  custosFixos: number;
  custosVariaveis: number;
  saldo: number;
  fixedItems: { name: string; value: number }[];
  variableItems: { name: string; value: number }[];
  incomeItems: { name: string; value: number }[];
}

const getMonthDetail = (month: string, get: (key: string, fallback: any) => any): MonthDetail => {
  const keys = getFinanceStorageKeys(month);
  const incomes = get(keys.incomes, []);
  const expenses = get(keys.expenses, []);
  const fixed = get(keys.fixed, []);

  const totalReceitas = incomes.reduce((s: number, i: any) => s + (i.value || 0), 0);
  const totalFixed = fixed.reduce((s: number, e: any) => s + (e.value || 0), 0);
  const totalVar = expenses.reduce((s: number, e: any) => s + (e.value || 0), 0);

  return {
    receitas: totalReceitas,
    custosFixos: totalFixed,
    custosVariaveis: totalVar,
    saldo: totalReceitas - totalFixed - totalVar,
    fixedItems: fixed.map((e: any) => ({ name: e.name || e.description || "Sem nome", value: e.value || 0 })),
    variableItems: expenses.map((e: any) => ({ name: e.name || e.description || "Sem nome", value: e.value || 0 })),
    incomeItems: incomes.map((i: any) => ({ name: i.name || i.source || "Sem nome", value: i.value || 0 })),
  };
};

const MonthSelector = ({ value, onChange, months }: { value: string; onChange: (m: string) => void; months: string[] }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none bg-muted border border-border rounded-lg px-3 py-2 pr-8 text-xs font-medium w-full focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      {months.map((m) => (
        <option key={m} value={m}>{m}</option>
      ))}
    </select>
    <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
  </div>
);

const StatCard = ({ label, valueA, valueB, format }: { label: string; valueA: number; valueB: number; format?: (v: number) => string }) => {
  const fmt = format || ((v: number) => `R$ ${v.toLocaleString("pt-BR")}`);
  const diff = valueB > 0 ? ((valueA - valueB) / valueB) * 100 : 0;
  const isPositive = label === "Despesas" ? diff <= 0 : diff >= 0;

  return (
    <div className="bg-muted/40 rounded-lg p-2.5 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-bold">{fmt(valueA)}</span>
        {valueB > 0 && (
          <span className={`text-xs font-medium ${isPositive ? "text-emerald-500" : "text-destructive"}`}>
            {diff >= 0 ? "+" : ""}{diff.toFixed(0)}%
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{fmt(valueB)}</p>
    </div>
  );
};

export const MonthComparison = () => {
  const { get } = useUserData();
  const currentMonthIdx = new Date().getMonth();

  const availableMonths = useMemo(() => {
    const months: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const idx = (currentMonthIdx - i + 12) % 12;
      months.push(MONTH_NAMES[idx]);
    }
    return months;
  }, [currentMonthIdx]);

  const [monthA, setMonthA] = useState(availableMonths[availableMonths.length - 2] || availableMonths[0]);
  const [monthB, setMonthB] = useState(availableMonths[availableMonths.length - 1]);

  const detailA = useMemo(() => getMonthDetail(monthA, (k, f) => get(k, f)), [monthA, get]);
  const detailB = useMemo(() => getMonthDetail(monthB, (k, f) => get(k, f)), [monthB, get]);

  const chartData: CategoryData[] = useMemo(() => [
    { category: "Receitas", monthA: detailA.receitas, monthB: detailB.receitas },
    { category: "C. Fixos", monthA: detailA.custosFixos, monthB: detailB.custosFixos },
    { category: "C. Variáveis", monthA: detailA.custosVariaveis, monthB: detailB.custosVariaveis },
  ], [detailA, detailB]);

  const hasData = detailA.receitas > 0 || detailA.custosFixos > 0 || detailA.custosVariaveis > 0
    || detailB.receitas > 0 || detailB.custosFixos > 0 || detailB.custosVariaveis > 0;

  if (!hasData) return null;

  // Merge all expense items from both months for breakdown
  const allFixedNames = [...new Set([...detailA.fixedItems.map(i => i.name), ...detailB.fixedItems.map(i => i.name)])];
  const allVarNames = [...new Set([...detailA.variableItems.map(i => i.name), ...detailB.variableItems.map(i => i.name)])];

  const getItemValue = (items: { name: string; value: number }[], name: string) =>
    items.filter(i => i.name === name).reduce((s, i) => s + i.value, 0);

  const shortA = monthA.slice(0, 3);
  const shortB = monthB.slice(0, 3);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-xs font-bold uppercase tracking-wider">Comparar Meses</h3>
      </div>

      {/* Month selectors */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <MonthSelector value={monthA} onChange={setMonthA} months={availableMonths} />
          <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
          <MonthSelector value={monthB} onChange={setMonthB} months={availableMonths} />
        </div>

        {/* Bar chart comparison */}
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartData} barGap={4}>
            <XAxis dataKey="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              formatter={(value: number, name: string) => [
                `R$ ${value.toLocaleString("pt-BR")}`,
                name === "monthA" ? shortA : shortB
              ]}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
            />
            <Bar dataKey="monthA" name="monthA" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={20} />
            <Bar dataKey="monthB" name="monthB" fill="hsl(var(--primary) / 0.4)" radius={[4, 4, 0, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-primary" />
            <span className="text-xs text-muted-foreground">{shortA}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-primary/40" />
            <span className="text-xs text-muted-foreground">{shortB}</span>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Receitas" valueA={detailA.receitas} valueB={detailB.receitas} />
          <StatCard label="Despesas" valueA={detailA.custosFixos + detailA.custosVariaveis} valueB={detailB.custosFixos + detailB.custosVariaveis} />
          <StatCard label="Saldo" valueA={detailA.saldo} valueB={detailB.saldo} />
        </div>
      </div>

      {/* Category breakdown */}
      {(allFixedNames.length > 0 || allVarNames.length > 0) && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Detalhamento por Categoria</p>

          {allFixedNames.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Custos Fixos</p>
              {allFixedNames.map((name) => {
                const valA = getItemValue(detailA.fixedItems, name);
                const valB = getItemValue(detailB.fixedItems, name);
                return (
                  <BreakdownRow key={`f-${name}`} name={name} valA={valA} valB={valB} shortA={shortA} shortB={shortB} />
                );
              })}
            </div>
          )}

          {allVarNames.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Custos Variáveis</p>
              {allVarNames.map((name) => {
                const valA = getItemValue(detailA.variableItems, name);
                const valB = getItemValue(detailB.variableItems, name);
                return (
                  <BreakdownRow key={`v-${name}`} name={name} valA={valA} valB={valB} shortA={shortA} shortB={shortB} />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const BreakdownRow = ({ name, valA, valB, shortA, shortB }: { name: string; valA: number; valB: number; shortA: string; shortB: string }) => {
  const diff = valB > 0 ? ((valA - valB) / valB) * 100 : valA > 0 ? 100 : 0;
  // For expenses, going down is good
  const isGood = diff <= 0;
  const maxVal = Math.max(valA, valB, 1);

  return (
    <div className="bg-muted/30 rounded-lg p-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium truncate flex-1">{name}</span>
        {valB > 0 && (
          <span className={`text-xs font-bold ${isGood ? "text-emerald-500" : "text-destructive"}`}>
            {diff >= 0 ? "+" : ""}{diff.toFixed(0)}%
          </span>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-8">{shortA}</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(valA / maxVal) * 100}%` }} />
          </div>
          <span className="text-xs font-medium w-20 text-right">R$ {valA.toLocaleString("pt-BR")}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-8">{shortB}</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary/40 rounded-full transition-all" style={{ width: `${(valB / maxVal) * 100}%` }} />
          </div>
          <span className="text-xs font-medium w-20 text-right">R$ {valB.toLocaleString("pt-BR")}</span>
        </div>
      </div>
    </div>
  );
};
