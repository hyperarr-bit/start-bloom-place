import { useState, useMemo } from "react";
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { getMonthTotals, getFinanceStorageKeys, readMonthData } from "@/components/finance/storage-keys";
import { useAuth } from "@/hooks/use-auth";

const ALL_MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const categoryLabels: Record<string, string> = {
  alimentacao: "Alimentação", restaurante: "Restaurante", mercado: "Mercado",
  transporte: "Transporte", combustivel: "Combustível", lazer: "Lazer",
  entretenimento: "Entretenimento", saude: "Saúde", farmacia: "Farmácia",
  vestuario: "Vestuário", beleza: "Beleza", educacao: "Educação",
  eletronicos: "Eletrônicos", servicos: "Serviços", delivery: "Delivery",
  presente: "Presentes", casa: "Casa", pets: "Pets", filhos: "Filhos",
  viagem: "Viagem", moradia: "Moradia", contas_casa: "Contas da Casa",
  condominio: "Condomínio", seguro: "Seguro", plano_saude: "Plano de Saúde",
  assinaturas: "Assinaturas", internet_telefone: "Internet/Telefone",
  academia: "Academia", transporte_fixo: "Transporte Fixo",
  fatura_cartao: "Fatura Cartão", financiamento: "Financiamento",
  pensao: "Pensão", outros: "Outros",
};

const COLORS = [
  "bg-purple-500", "bg-amber-500", "bg-emerald-500",
  "bg-blue-500", "bg-red-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500",
];

interface CategoryData {
  category: string;
  label: string;
  monthA: number;
  monthB: number;
}

const getExpensesByCategory = (month: string, userId: string | null): Record<string, number> => {
  const keys = getFinanceStorageKeys(month);
  const expenses = readMonthData(userId, keys.expenses) || [];
  const fixed = readMonthData(userId, keys.fixed) || [];
  const grouped: Record<string, number> = {};

  expenses.forEach((e: any) => {
    const cat = e.category || "outros";
    grouped[cat] = (grouped[cat] || 0) + (e.value || 0);
  });
  fixed.forEach((e: any) => {
    const cat = e.category || "outros";
    grouped[cat] = (grouped[cat] || 0) + (e.value || 0);
  });

  return grouped;
};

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

export const MonthComparison = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const currentIdx = new Date().getMonth();
  const prevIdx = currentIdx === 0 ? 11 : currentIdx - 1;

  const [monthA, setMonthA] = useState(ALL_MONTHS[prevIdx]);
  const [monthB, setMonthB] = useState(ALL_MONTHS[currentIdx]);

  const totalsA = useMemo(() => getMonthTotals(monthA, userId), [monthA, userId]);
  const totalsB = useMemo(() => getMonthTotals(monthB, userId), [monthB, userId]);

  const categoryComparison = useMemo(() => {
    const catsA = getExpensesByCategory(monthA, userId);
    const catsB = getExpensesByCategory(monthB, userId);
    const allCats = new Set([...Object.keys(catsA), ...Object.keys(catsB)]);

    const data: CategoryData[] = [];
    allCats.forEach((cat) => {
      data.push({
        category: cat,
        label: categoryLabels[cat] || cat,
        monthA: catsA[cat] || 0,
        monthB: catsB[cat] || 0,
      });
    });

    return data.sort((a, b) => (b.monthA + b.monthB) - (a.monthA + a.monthB));
  }, [monthA, monthB, userId]);

  const maxCatValue = useMemo(() => {
    return Math.max(1, ...categoryComparison.map((c) => Math.max(c.monthA, c.monthB)));
  }, [categoryComparison]);

  const totalExpA = totalsA.custosFixos + totalsA.custosVariaveis;
  const totalExpB = totalsB.custosFixos + totalsB.custosVariaveis;
  const saldoA = totalsA.receitas - totalExpA;
  const saldoB = totalsB.receitas - totalExpB;

  const hasData = totalsA.receitas > 0 || totalsB.receitas > 0 || categoryComparison.length > 0;

  const DiffBadge = ({ a, b }: { a: number; b: number }) => {
    if (a === 0 && b === 0) return null;
    const diff = b - a;
    const pct = a > 0 ? ((diff / a) * 100) : 0;
    if (Math.abs(diff) < 1) return <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Minus className="w-3 h-3" />igual</span>;
    const isUp = diff > 0;
    return (
      <span className={`text-[10px] flex items-center gap-0.5 ${isUp ? "text-red-400" : "text-green-400"}`}>
        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isUp ? "+" : ""}{a > 0 ? `${pct.toFixed(0)}%` : fmt(Math.abs(diff))}
      </span>
    );
  };

  const SaldoDiffBadge = ({ a, b }: { a: number; b: number }) => {
    if (a === 0 && b === 0) return null;
    const diff = b - a;
    if (Math.abs(diff) < 1) return <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Minus className="w-3 h-3" />igual</span>;
    const isUp = diff > 0;
    return (
      <span className={`text-[10px] flex items-center gap-0.5 ${isUp ? "text-green-400" : "text-red-400"}`}>
        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isUp ? "+" : ""}{fmt(diff)}
      </span>
    );
  };

  return (
    <div className="bg-card rounded-lg border border-border p-4 animate-fade-in">
      <h3 className="text-xs font-bold mb-3">📈 COMPARAÇÃO MENSAL</h3>

      {/* Month selectors */}
      <div className="flex items-center gap-2 mb-3">
        <Select value={monthA} onValueChange={setMonthA}>
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_MONTHS.map((m) => (
              <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <Select value={monthB} onValueChange={setMonthB}>
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_MONTHS.map((m) => (
              <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!hasData ? (
        <p className="text-xs text-muted-foreground text-center py-8">
          Sem dados para comparar. Preencha pelo menos um mês.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Summary grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {/* Receitas */}
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Receitas</p>
              <p className="text-[11px] font-bold text-green-400 tabular-nums">{fmt(totalsA.receitas)}</p>
              <p className="text-[11px] font-bold text-green-400 tabular-nums">{fmt(totalsB.receitas)}</p>
            </div>
            {/* Despesas */}
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Despesas</p>
              <p className="text-[11px] font-bold text-red-400 tabular-nums">{fmt(totalExpA)}</p>
              <p className="text-[11px] font-bold text-red-400 tabular-nums">{fmt(totalExpB)}</p>
              <DiffBadge a={totalExpA} b={totalExpB} />
            </div>
            {/* Saldo */}
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Saldo</p>
              <p className={`text-[11px] font-bold tabular-nums ${saldoA >= 0 ? "text-green-400" : "text-red-400"}`}>{fmt(saldoA)}</p>
              <p className={`text-[11px] font-bold tabular-nums ${saldoB >= 0 ? "text-green-400" : "text-red-400"}`}>{fmt(saldoB)}</p>
              <SaldoDiffBadge a={saldoA} b={saldoB} />
            </div>
          </div>

          {/* Labels row */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{monthA.substring(0, 3)}</span>
            <span>{monthB.substring(0, 3)}</span>
          </div>

          {/* Category breakdown */}
          {categoryComparison.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Por Categoria</p>
              {categoryComparison.map((cat, i) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${COLORS[i % COLORS.length]}`} />
                      <span className="text-xs">{cat.label}</span>
                    </div>
                    <DiffBadge a={cat.monthA} b={cat.monthB} />
                  </div>
                  {/* Side by side bars */}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-7 flex-shrink-0">{monthA.substring(0, 3)}</span>
                      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-muted-foreground/40 rounded-full transition-all"
                          style={{ width: `${(cat.monthA / maxCatValue) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground w-16 text-right">{fmt(cat.monthA)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-7 flex-shrink-0">{monthB.substring(0, 3)}</span>
                      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${COLORS[i % COLORS.length].replace("bg-", "bg-")}`}
                          style={{ width: `${(cat.monthB / maxCatValue) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground w-16 text-right">{fmt(cat.monthB)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
