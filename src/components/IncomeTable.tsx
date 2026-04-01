import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

      <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[360px]">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Descrição</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs">Valor</th>
            <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Data</th>
            <th className="px-3 py-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {incomes.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center">
                <p className="text-xs text-muted-foreground">Nenhuma receita cadastrada</p>
                <p className="text-[10px] text-muted-foreground mt-1">Adicione seu salário, freelances, rendas extras...</p>
              </td>
            </tr>
          )}
          {incomes.map((income) => (
            <tr key={income.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
              <td className="px-3 py-2">
                <span className="category-badge bg-income text-income-foreground">{income.description}</span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {income.value.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
              </td>
              <td className="px-3 py-2 text-center text-muted-foreground text-xs">
                {new Date(income.date + "T00:00:00").toLocaleDateString("pt-BR", { month: "short", day: "numeric", year: "numeric" })}
              </td>
              <td className="px-3 py-2">
                <button onClick={() => deleteIncome(income.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
          <tr className="bg-muted/20">
            <td className="px-3 py-2">
              <Input
                placeholder="+ New"
                value={newIncome.description}
                onChange={(e) => setNewIncome({ ...newIncome, description: e.target.value })}
                className="h-7 text-xs border-0 bg-transparent shadow-none px-0 focus-visible:ring-0"
              />
            </td>
            <td className="px-3 py-2">
              <Input
                type="number"
                placeholder="0"
                value={newIncome.value}
                onChange={(e) => setNewIncome({ ...newIncome, value: e.target.value })}
                className="h-7 text-xs border-0 bg-transparent shadow-none px-0 text-right focus-visible:ring-0"
              />
            </td>
            <td className="px-3 py-2">
              <Input
                type="date"
                value={newIncome.date}
                onChange={(e) => setNewIncome({ ...newIncome, date: e.target.value })}
                className="h-7 text-xs border-0 bg-transparent shadow-none px-0 focus-visible:ring-0"
              />
            </td>
            <td className="px-3 py-2">
              <button onClick={addIncome} className="text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="border-t border-border">
            <td className="px-3 py-2 text-xs text-muted-foreground">SUM</td>
            <td className="px-3 py-2 text-right font-bold tabular-nums" colSpan={3}>
              {total.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
            </td>
          </tr>
        </tfoot>
      </table>
      </div>
    </div>
  );
};
