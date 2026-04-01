import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { CurrencyRate, genId, convertCurrency } from "./types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ArrowRightLeft, RefreshCw } from "lucide-react";

const COMMON_CURRENCIES = [
  { from: "USD", to: "BRL", label: "Dólar → Real" },
  { from: "EUR", to: "BRL", label: "Euro → Real" },
  { from: "GBP", to: "BRL", label: "Libra → Real" },
  { from: "ARS", to: "BRL", label: "Peso Arg. → Real" },
];

export const CurrencyConverter = () => {
  const [rates, setRates] = usePersistedState<CurrencyRate[]>("travel-currency-rates", []);
  const [amount, setAmount] = useState("");
  const [selectedRate, setSelectedRate] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newRate, setNewRate] = useState({ from: "", to: "BRL", rate: "" });

  const addRate = () => {
    if (!newRate.from || !newRate.rate) return;
    setRates(prev => [...prev, { id: genId(), fromCurrency: newRate.from.toUpperCase(), toCurrency: newRate.to.toUpperCase(), rate: Number(newRate.rate) }]);
    setNewRate({ from: "", to: "BRL", rate: "" });
    setShowAdd(false);
  };

  const addCommon = (c: typeof COMMON_CURRENCIES[0]) => {
    if (rates.some(r => r.fromCurrency === c.from && r.toCurrency === c.to)) return;
    setRates(prev => [...prev, { id: genId(), fromCurrency: c.from, toCurrency: c.to, rate: 0 }]);
  };

  const updateRate = (id: string, rate: number) => setRates(prev => prev.map(r => r.id === id ? { ...r, rate } : r));
  const removeRate = (id: string) => { setRates(prev => prev.filter(r => r.id !== id)); if (selectedRate === id) setSelectedRate(null); };

  const active = rates.find(r => r.id === selectedRate);

  return (
    <div className="space-y-4">
      {/* Quick add - Notion-style */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-cyan-200 dark:bg-cyan-800/50 px-3 py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider">💱 MOEDAS RÁPIDAS</span>
        </div>
        <div className="bg-cyan-50 dark:bg-cyan-950/20 p-3 flex gap-1.5 flex-wrap">
          {COMMON_CURRENCIES.map(c => {
            const exists = rates.some(r => r.fromCurrency === c.from && r.toCurrency === c.to);
            return (
              <button key={c.from} onClick={() => !exists && addCommon(c)}
                className={`rounded-full px-3 py-1.5 text-[10px] border transition-all ${
                  exists ? "border-foreground/20 bg-foreground/5 font-medium" : "border-border hover:border-foreground/30 text-muted-foreground"
                }`}>
                {c.label} {exists ? "✓" : "+"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rates list - Notion-style */}
      <div className="space-y-2">
        {rates.map(r => (
          <div key={r.id}
            className={`rounded-xl border overflow-hidden cursor-pointer transition-all ${
              selectedRate === r.id ? "border-foreground shadow-sm" : "border-border hover:border-foreground/30"
            }`}
            onClick={() => setSelectedRate(r.id)}>
            <div className={`${selectedRate === r.id ? "bg-yellow-200 dark:bg-yellow-800/50" : "bg-card"} px-3 py-2 flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold">{r.fromCurrency}</span>
                <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-bold">{r.toCurrency}</span>
              </div>
              <div className="flex items-center gap-2">
                <Input type="number" value={r.rate || ""} onChange={e => { e.stopPropagation(); updateRate(r.id, Number(e.target.value)); }}
                  onClick={e => e.stopPropagation()} placeholder="Taxa" className="w-20 h-7 text-xs text-right rounded-lg" step="0.01" />
                <button onClick={e => { e.stopPropagation(); removeRate(r.id); }}>
                  <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Converter - Notion-style */}
      {active && active.rate > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-green-200 dark:bg-green-800/50 px-3 py-1.5 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              🔄 {active.fromCurrency} → {active.toCurrency} (Taxa: {active.rate})
            </span>
          </div>
          <div className="bg-green-50 dark:bg-green-950/20 p-4 space-y-3">
            <Input type="number" placeholder={`Valor em ${active.fromCurrency}`} value={amount}
              onChange={e => setAmount(e.target.value)} className="h-10 rounded-xl text-center text-sm font-bold" />
            {amount && (
              <div className="text-center">
                <p className="text-2xl font-black">
                  {convertCurrency(Number(amount), active.rate).toLocaleString("pt-BR", { style: "currency", currency: active.toCurrency === "BRL" ? "BRL" : "USD" })}
                </p>
                <p className="text-[9px] text-muted-foreground mt-1">
                  {Number(amount).toLocaleString()} {active.fromCurrency} × {active.rate} = {convertCurrency(Number(amount), active.rate).toLocaleString()} {active.toCurrency}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <Button variant="outline" className="w-full rounded-xl h-8 text-xs border-dashed" onClick={() => setShowAdd(!showAdd)}>
        <Plus className="w-3 h-3 mr-1" /> Moeda Personalizada
      </Button>

      {showAdd && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="De (USD)" value={newRate.from} onChange={e => setNewRate(p => ({ ...p, from: e.target.value }))} className="h-8 rounded-lg text-xs" />
            <Input placeholder="Para (BRL)" value={newRate.to} onChange={e => setNewRate(p => ({ ...p, to: e.target.value }))} className="h-8 rounded-lg text-xs" />
            <Input type="number" placeholder="Taxa" value={newRate.rate} onChange={e => setNewRate(p => ({ ...p, rate: e.target.value }))} className="h-8 rounded-lg text-xs" step="0.01" />
          </div>
          <Button onClick={addRate} className="w-full rounded-lg h-7 text-xs">Adicionar</Button>
        </div>
      )}

      {rates.length === 0 && (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">Defina taxas de câmbio fixas</p>
          <p className="text-[9px] text-muted-foreground">Funciona 100% offline!</p>
        </div>
      )}
    </div>
  );
};
