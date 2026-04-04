import { useState } from "react";
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
  const [showForm, setShowForm] = useState(false);
  const [petId, setPetId] = useState("");
  const [category, setCategory] = useState("Ração");
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const addExpense = () => {
    const v = parseFloat(value);
    if (!v || v <= 0) return;
    const updated = [...expenses, { id: Date.now().toString(), petId, category, description: description.trim(), value: v, date }];
    set("pet-expenses", updated);
    setDescription(""); setValue("");
    setShowForm(false);
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
    <div className="space-y-3 mt-3">
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

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{expenses.length} gasto{expenses.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs text-primary font-bold">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-3 space-y-2">
          <select value={petId} onChange={e => setPetId(e.target.value)} className="w-full h-8 text-sm bg-background border border-input rounded-md px-2">
            <option value="">Selecionar pet</option>
            {pets.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-8 text-sm bg-background border border-input rounded-md px-2">
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Input placeholder="Descrição" value={description} onChange={e => setDescription(e.target.value)} className="h-8 text-sm" />
          <Input type="number" placeholder="Valor R$" value={value} onChange={e => setValue(e.target.value)} className="h-8 text-sm" />
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-sm" />
          <button onClick={addExpense} className="w-full bg-primary text-primary-foreground rounded-lg py-1.5 text-xs font-bold">Salvar</button>
        </div>
      )}

      {monthExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(e => {
        const pet = pets.find((p: any) => p.id === e.petId);
        return (
          <div key={e.id} className="bg-card rounded-lg border border-border p-2.5 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{e.description || e.category}</p>
              <p className="text-[10px] text-muted-foreground">{pet?.name || "Pet"} · {e.category} · {format(new Date(e.date), "dd/MM")}</p>
            </div>
            <span className="text-xs font-bold text-destructive">-R$ {e.value.toFixed(2)}</span>
            <button onClick={() => removeExpense(e.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
