import { useState } from "react";
import { localDayKey } from "@/lib/utils";
import { Plus, Trash2, TrendingUp } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

interface PetExpense {
  id: string;
  petId: string;
  category: string;
  description: string;
  value: number;
  date: string;
}

const categories = ["Ração", "Veterinário", "Banho/Tosa", "Medicamento", "Brinquedo", "Outro"];

export const PetExpenses = () => {
  const { get, set } = useUserData();
  const pets = get<any[]>("pet-list", []);
  const expenses = get<PetExpense[]>("pet-expenses", []);
  const [petId, setPetId] = useState("");
  const [category, setCategory] = useState("Ração");
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(localDayKey());

  const addExpense = () => {
    const v = parseFloat(value);
    if (!v || v <= 0) return;
    const updated = [...expenses, { id: Date.now().toString(), petId, category, description: description.trim(), value: v, date }];
    set("pet-expenses", updated);
    setDescription(""); setValue("");
  };

  const removeExpense = (id: string) => set("pet-expenses", expenses.filter(e => e.id !== id));

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthExpenses = expenses.filter(e => e.date.startsWith(currentMonth));
  const totalMonth = monthExpenses.reduce((s, e) => s + e.value, 0);

  const byCat = categories.map(c => ({
    cat: c,
    total: monthExpenses.filter(e => e.category === c).reduce((s, e) => s + e.value, 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  return (
    <div className="mt-3 space-y-3">
      {/* Summary */}
      <div className="bg-card rounded-xl border border-border p-3 text-center">
        <p className="text-[10px] text-muted-foreground">Gastos este mês</p>
        <p className="text-xl font-bold">R$ {totalMonth.toFixed(2)}</p>
        {byCat.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 mt-2">
            {byCat.map(c => (
              <span key={c.cat} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">
                {c.cat}: R$ {c.total.toFixed(0)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-blue-200 dark:bg-blue-900/60 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-200">Gastos</span>
          </div>
          <span className="text-[10px] text-blue-600 dark:text-blue-300">{expenses.length}</span>
        </div>

        <div className="bg-blue-50/50 dark:bg-blue-950/20 p-2 space-y-1.5">
          <div className="grid grid-cols-12 gap-1 px-2 py-1">
            <span className="col-span-2 text-[9px] font-bold uppercase text-muted-foreground">Pet</span>
            <span className="col-span-3 text-[9px] font-bold uppercase text-muted-foreground">Categoria</span>
            <span className="col-span-3 text-[9px] font-bold uppercase text-muted-foreground">Descrição</span>
            <span className="col-span-2 text-[9px] font-bold uppercase text-muted-foreground">Data</span>
            <span className="col-span-2 text-[9px] font-bold uppercase text-muted-foreground text-right">Valor</span>
          </div>

          {monthExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(e => {
            const pet = pets.find((p: any) => p.id === e.petId);
            return (
              <div key={e.id} className="grid grid-cols-12 gap-1 items-center bg-background/60 rounded-lg px-2 py-1.5 group">
                <span className="col-span-2 text-[10px] truncate">{pet?.name || "—"}</span>
                <span className="col-span-3 text-[10px] text-muted-foreground truncate">{e.category}</span>
                <span className="col-span-3 text-xs truncate">{e.description || "—"}</span>
                <span className="col-span-2 text-[10px] text-muted-foreground">{format(new Date(e.date), "dd/MM")}</span>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <span className="text-xs font-bold text-destructive">-R${e.value.toFixed(0)}</span>
                  <button onClick={() => removeExpense(e.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {monthExpenses.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic py-3 text-center">Nenhum gasto este mês</p>
          )}

          <div className="border border-dashed border-border/60 bg-background/50 rounded-lg p-2 space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <select value={petId} onChange={e => setPetId(e.target.value)} className="h-7 text-[11px] bg-background border border-input rounded-md px-2">
                <option value="">Pet</option>
                {pets.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={category} onChange={e => setCategory(e.target.value)} className="h-7 text-[11px] bg-background border border-input rounded-md px-2">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Input placeholder="Descrição" value={description} onChange={e => setDescription(e.target.value)} className="h-7 text-[11px]" />
              <Input type="number" placeholder="R$" value={value} onChange={e => setValue(e.target.value)} className="h-7 text-[11px]" />
              <div className="relative">
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-7 text-[11px] appearance-none [&::-webkit-date-and-time-value]:text-left" />
              </div>
            </div>
            <button onClick={addExpense} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md py-1 transition-colors">
              <Plus className="w-3 h-3" /> Adicionar gasto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
