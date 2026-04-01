import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { TravelExpense, genId, formatCurrency } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, DollarSign, TrendingUp } from "lucide-react";

const CATEGORIES = [
  { key: "hospedagem", emoji: "🏨", label: "Hospedagem", color: "bg-purple-200 dark:bg-purple-800/50", body: "bg-purple-50 dark:bg-purple-950/20" },
  { key: "transporte", emoji: "🚗", label: "Transporte", color: "bg-yellow-200 dark:bg-yellow-800/50", body: "bg-yellow-50 dark:bg-yellow-950/20" },
  { key: "alimentação", emoji: "🍽️", label: "Alimentação", color: "bg-orange-200 dark:bg-orange-800/50", body: "bg-orange-50 dark:bg-orange-950/20" },
  { key: "passeios", emoji: "🎯", label: "Passeios", color: "bg-green-200 dark:bg-green-800/50", body: "bg-green-50 dark:bg-green-950/20" },
  { key: "compras", emoji: "🛍️", label: "Compras", color: "bg-pink-200 dark:bg-pink-800/50", body: "bg-pink-50 dark:bg-pink-950/20" },
  { key: "outros", emoji: "📦", label: "Outros", color: "bg-gray-200 dark:bg-gray-800/50", body: "bg-gray-50 dark:bg-gray-950/20" },
];

export const TravelBudget = () => {
  const [expenses, setExpenses] = usePersistedState<TravelExpense[]>("travel-expenses", []);
  const [budget, setBudget] = usePersistedState("travel-budget-total", 5000);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<TravelExpense>>({ category: "hospedagem", currency: "BRL" });
  const [tripFilter, setTripFilter] = useState("all");

  const trips = [...new Set(expenses.map(e => e.trip).filter(Boolean))];
  const filtered = tripFilter === "all" ? expenses : expenses.filter(e => e.trip === tripFilter);
  const totalSpent = filtered.reduce((s, e) => s + e.amount, 0);
  const remaining = budget - totalSpent;
  const percentage = Math.min((totalSpent / budget) * 100, 100);

  const save = () => {
    if (!form.description || !form.amount) return;
    setExpenses(prev => [...prev, {
      id: genId(), trip: form.trip || "", category: form.category || "outros",
      description: form.description || "", amount: form.amount || 0,
      currency: form.currency || "BRL", date: form.date || new Date().toISOString().slice(0, 10),
    }]);
    setForm({ category: "hospedagem", currency: "BRL" });
    setShowForm(false);
  };

  const dates = filtered.map(e => e.date).filter(Boolean);
  const uniqueDays = new Set(dates).size;
  const dailyAvg = uniqueDays > 0 ? totalSpent / uniqueDays : 0;

  return (
    <div className="space-y-4">
      {/* Budget hero - Notion-style */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-emerald-200 dark:bg-emerald-800/50 px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider">💰 ORÇAMENTO</span>
          <Input
            type="number"
            value={budget}
            onChange={e => setBudget(Number(e.target.value))}
            className="w-28 h-7 text-xs text-right rounded-lg bg-background/50"
          />
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4">
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-2xl font-black">{formatCurrency(totalSpent)}</p>
              <p className="text-[10px] text-muted-foreground">gasto</p>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold ${remaining < 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                {formatCurrency(remaining)}
              </p>
              <p className="text-[10px] text-muted-foreground">restante</p>
            </div>
          </div>
          <Progress value={percentage} className="h-2 rounded-full" />
          {remaining < 0 && <p className="text-[10px] text-red-500 font-bold mt-1">⚠️ Acima do orçamento!</p>}
        </div>
      </div>

      {/* Quick stats - Notion-style */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "GASTOS", value: filtered.length.toString(), color: "bg-sky-200 dark:bg-sky-800/50", body: "bg-sky-50 dark:bg-sky-950/20" },
          { label: "MÉDIA/DIA", value: formatCurrency(dailyAvg), color: "bg-orange-200 dark:bg-orange-800/50", body: "bg-orange-50 dark:bg-orange-950/20" },
          { label: "USADO", value: `${percentage.toFixed(0)}%`, color: "bg-purple-200 dark:bg-purple-800/50", body: "bg-purple-50 dark:bg-purple-950/20" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border overflow-hidden">
            <div className={`${s.color} px-2 py-1 text-center`}>
              <span className="text-[8px] font-bold uppercase tracking-wider">{s.label}</span>
            </div>
            <div className={`${s.body} p-2 text-center`}>
              <p className="text-xs font-bold">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Category breakdown - Notion-style */}
      <div className="grid grid-cols-3 gap-2">
        {CATEGORIES.map(cat => {
          const catTotal = filtered.filter(e => e.category === cat.key).reduce((s, e) => s + e.amount, 0);
          if (catTotal === 0) return null;
          const catPercent = totalSpent > 0 ? (catTotal / totalSpent) * 100 : 0;
          return (
            <div key={cat.key} className="rounded-xl border border-border overflow-hidden">
              <div className={`${cat.color} px-2 py-1 text-center`}>
                <span className="text-[9px] font-bold">{cat.emoji} {cat.label}</span>
              </div>
              <div className={`${cat.body} p-2 text-center`}>
                <p className="text-xs font-bold">{formatCurrency(catTotal)}</p>
                <p className="text-[8px] text-muted-foreground">{catPercent.toFixed(0)}%</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trip filter */}
      {trips.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button onClick={() => setTripFilter("all")} className={`shrink-0 rounded-full px-3 py-1 text-[10px] border transition-all ${tripFilter === "all" ? "bg-foreground text-background" : "border-border"}`}>Todas</button>
          {trips.map(t => (
            <button key={t} onClick={() => setTripFilter(t)} className={`shrink-0 rounded-full px-3 py-1 text-[10px] border transition-all ${tripFilter === t ? "bg-foreground text-background" : "border-border"}`}>{t}</button>
          ))}
        </div>
      )}

      <Button variant="outline" className="w-full rounded-xl h-9 text-xs border-dashed" onClick={() => setShowForm(!showForm)}>
        <Plus className="w-3 h-3 mr-1" /> Novo Gasto
      </Button>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <Input placeholder="Viagem" value={form.trip || ""} onChange={e => setForm(p => ({ ...p, trip: e.target.value }))} className="h-9 rounded-xl text-xs" />
          <Input placeholder="Descrição" value={form.description || ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="h-9 rounded-xl text-xs" />
          <div className="grid grid-cols-3 gap-2">
            <Input type="number" placeholder="Valor" value={form.amount || ""} onChange={e => setForm(p => ({ ...p, amount: Number(e.target.value) }))} className="h-9 rounded-xl text-xs" />
            <Select value={form.category || "hospedagem"} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
              <SelectTrigger className="h-9 rounded-xl text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.emoji} {c.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" value={form.date || ""} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="h-9 rounded-xl text-xs" />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} className="flex-1 rounded-xl h-8 text-xs">Salvar</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)} className="rounded-xl h-8 text-xs">Cancelar</Button>
          </div>
        </div>
      )}

      {/* Expense list */}
      <div className="space-y-1.5">
        {filtered.sort((a, b) => b.date.localeCompare(a.date)).map(e => {
          const cat = CATEGORIES.find(c => c.key === e.category);
          return (
            <div key={e.id} className="rounded-xl border border-border overflow-hidden group">
              <div className="flex items-center justify-between px-3 py-2 bg-card">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{cat?.emoji}</span>
                  <div>
                    <p className="text-xs font-medium">{e.description}</p>
                    <p className="text-[8px] text-muted-foreground">{e.date}{e.trip ? ` • ${e.trip}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">{formatCurrency(e.amount)}</span>
                  <button onClick={() => setExpenses(prev => prev.filter(x => x.id !== e.id))} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !showForm && (
        <div className="text-center py-8">
          <TrendingUp className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">Nenhum gasto registrado</p>
        </div>
      )}
    </div>
  );
};
