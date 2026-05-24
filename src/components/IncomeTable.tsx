import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Income {
  id: string;
  description: string;
  value: number;
  date: string;
}

interface IncomeTableProps {
  incomes: Income[];
  setIncomes: (incomes: Income[]) => void;
}

export const IncomeTable = ({ incomes, setIncomes }: IncomeTableProps) => {
  const [newIncome, setNewIncome] = useState({ description: "", value: "", date: "" });

  const addIncome = () => {
    if (newIncome.description && newIncome.value) {
      setIncomes([
        ...incomes,
        {
          id: Date.now().toString(),
          description: newIncome.description,
          value: parseFloat(newIncome.value),
          date: newIncome.date || new Date().toISOString().split("T")[0],
        },
      ]);
      setNewIncome({ description: "", value: "", date: "" });
    }
  };

  const deleteIncome = (id: string) => {
    setIncomes(incomes.filter((i) => i.id !== id));
  };

  const total = incomes.reduce((sum, i) => sum + i.value, 0);

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border animate-fade-in">
      <div className="bg-income py-2 px-4">
        <span className="font-bold text-sm text-income-foreground tracking-wide">RECEITAS</span>
      </div>

      {/* Form sempre visível */}
      <div className="p-3 border-b border-border bg-muted/20 space-y-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="+ Nova receita"
            value={newIncome.description}
            onChange={(e) => setNewIncome({ ...newIncome, description: e.target.value })}
            className="h-9 text-xs flex-1"
          />
          <Input
            type="number"
            inputMode="decimal"
            placeholder="Valor"
            value={newIncome.value}
            onChange={(e) => setNewIncome({ ...newIncome, value: e.target.value })}
            className="h-9 text-xs w-20 text-right"
          />
          <button
            onClick={addIncome}
            data-spotlight="add-income"
            aria-label="Adicionar receita"
            className="h-9 w-9 flex-shrink-0 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <Input
          type="date"
          value={newIncome.date}
          onChange={(e) => setNewIncome({ ...newIncome, date: e.target.value })}
          className="h-8 text-xs w-full"
        />
      </div>

      {/* Lista */}
      <div>
        {incomes.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-muted-foreground">Nenhuma receita cadastrada</p>
            <p className="text-[10px] text-muted-foreground mt-1">Adicione seu salário, freelances, rendas extras...</p>
          </div>
        ) : (
          incomes.map((income) => (
            <div key={income.id} className="px-3 py-2 border-b border-border/50 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate block">{income.description}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(income.date + "T00:00:00").toLocaleDateString("pt-BR", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <span className="text-sm tabular-nums font-medium whitespace-nowrap">
                  R$ {income.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                <button onClick={() => deleteIncome(income.id)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Total */}
      <div className="px-3 py-2 border-t border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground">TOTAL</span>
        <span className="text-sm font-bold tabular-nums">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
      </div>
    </div>
  );
};
