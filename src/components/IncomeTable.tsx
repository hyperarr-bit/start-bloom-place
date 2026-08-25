import { useState } from "react";
import { numeroBR } from "@/lib/data-normalizers";
import { localDayKey } from "@/lib/utils";
import { Plus, Trash2, Check, X } from "lucide-react";
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
  prefillExample?: boolean;
}

export const IncomeTable = ({ incomes, setIncomes, prefillExample = false }: IncomeTableProps) => {
  const [newIncome, setNewIncome] = useState(
    prefillExample && incomes.length === 0
      ? { description: "Salário", value: "3000", date: "" }
      : { description: "", value: "", date: "" }
  );

  const exampleActive =
    prefillExample &&
    incomes.length === 0 &&
    newIncome.description === "Salário" &&
    newIncome.value === "3000";


  const addIncome = () => {
    if (newIncome.description && newIncome.value) {
      setIncomes([
        ...incomes,
        {
          id: Date.now().toString(),
          description: newIncome.description,
          value: numeroBR(newIncome.value),
          date: newIncome.date || localDayKey(),
        },
      ]);
      setNewIncome({ description: "", value: "", date: "" });
    }
  };

  const deleteIncome = (id: string) => {
    setIncomes(incomes.filter((i) => i.id !== id));
  };

  /** Edição na própria linha — o mesmo motivo descrito em ExpenseTable. */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState({ description: "", value: "", date: "" });

  const comecarEdicao = (i: Income) => {
    setEditandoId(i.id);
    setRascunho({ description: i.description, value: String(i.value), date: i.date });
  };

  const salvarEdicao = () => {
    const valor = numeroBR(rascunho.value);
    if (!rascunho.description.trim() || !Number.isFinite(valor)) return;
    setIncomes(incomes.map((i) => i.id !== editandoId ? i : {
      ...i,
      description: rascunho.description.trim(),
      value: valor,
      date: rascunho.date || i.date,
    }));
    setEditandoId(null);
  };

  const total = incomes.reduce((sum, i) => sum + i.value, 0);

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border animate-fade-in">
      <div className="bg-income py-2 px-4">
        <span className="font-bold text-sm text-income-foreground tracking-wide">RECEITAS</span>
      </div>

      {/* Form sempre visível */}
      <div className="p-3 border-b border-border bg-muted/20 space-y-2">
        {/* O tutorial destaca a LINHA INTEIRA, não o "+" (27/07). A tarefa é
            escrever a receita, o valor e só então salvar — marcar só o botão
            mandava a pessoa apertar antes de ter o que salvar. */}
        <div className="flex items-center gap-2" data-spotlight="add-income">
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
            aria-label="Adicionar receita"
            className="h-9 w-9 flex-shrink-0 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <label className="h-9 px-2 text-xs flex items-center gap-1 rounded-md border border-input bg-background w-full">
          <span className="text-muted-foreground flex-shrink-0">Data:</span>
          <input
            type="date"
            value={newIncome.date}
            onChange={(e) => setNewIncome({ ...newIncome, date: e.target.value })}
            className="flex-1 min-w-0 w-full bg-transparent outline-none text-xs"
          />
        </label>
        {exampleActive && (
          <p className="text-[10px] text-muted-foreground">
            Exemplo pré-preenchido — você pode editar antes de salvar.
          </p>
        )}
      </div>

      {/* Lista */}
      <div>
        {incomes.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-muted-foreground">Nenhuma receita cadastrada</p>
            <p className="text-[10px] text-muted-foreground mt-1">Adicione seu salário, freelances, rendas extras...</p>
          </div>
        ) : (
          incomes.map((income) => editandoId === income.id ? (
            <div key={income.id} className="px-3 py-3 border-b border-border/50 bg-primary/[0.04] space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={rascunho.description}
                  onChange={(e) => setRascunho({ ...rascunho, description: e.target.value })}
                  className="h-9 text-xs flex-1"
                  placeholder="Descrição"
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  value={rascunho.value}
                  onChange={(e) => setRascunho({ ...rascunho, value: e.target.value })}
                  className="h-9 text-xs w-20 text-right"
                  placeholder="Valor"
                />
              </div>
              <label className="h-8 px-2 text-xs flex items-center gap-1 rounded-md border border-input bg-background w-full">
                <span className="text-muted-foreground flex-shrink-0">Data:</span>
                <input
                  type="date"
                  value={rascunho.date}
                  onChange={(e) => setRascunho({ ...rascunho, date: e.target.value })}
                  className="flex-1 min-w-0 w-full bg-transparent outline-none text-xs"
                />
              </label>
              <div className="flex items-center gap-2 pt-0.5">
                <button onClick={salvarEdicao} className="h-9 flex-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                  <Check className="w-3.5 h-3.5" /> Salvar
                </button>
                <button onClick={() => setEditandoId(null)} className="h-9 px-4 rounded-md border border-border text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <X className="w-3.5 h-3.5" /> Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div key={income.id} className="px-3 py-2 border-b border-border/50 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-2">
                <button onClick={() => comecarEdicao(income)} className="flex items-center gap-2 flex-1 min-w-0 text-left" aria-label={`Editar ${income.description}`}>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block">{income.description}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(income.date + "T00:00:00").toLocaleDateString("pt-BR", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <span className="text-sm tabular-nums font-medium whitespace-nowrap">
                    R$ {income.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </button>
                <button onClick={() => deleteIncome(income.id)} aria-label={`Apagar ${income.description}`} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
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
        <span className="text-sm font-bold tabular-nums">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
    </div>
  );
};
