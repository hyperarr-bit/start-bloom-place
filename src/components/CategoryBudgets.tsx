import { useState } from "react";
import { Gauge, Pencil, Check, X, Target } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";

const categories = [
  { value: "alimentacao", label: "Alimentação", color: "bg-orange-100/80 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300", bar: "bg-orange-500" },
  { value: "restaurante", label: "Restaurante", color: "bg-amber-100/80 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", bar: "bg-amber-500" },
  { value: "transporte", label: "Transporte", color: "bg-blue-100/80 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", bar: "bg-blue-500" },
  { value: "lazer", label: "Lazer", color: "bg-purple-100/80 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300", bar: "bg-purple-500" },
  { value: "saude", label: "Saúde", color: "bg-green-100/80 text-green-700 dark:bg-green-500/15 dark:text-green-300", bar: "bg-green-500" },
  { value: "educacao", label: "Educação", color: "bg-teal-100/80 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300", bar: "bg-teal-500" },
  { value: "vestuario", label: "Vestuário", color: "bg-violet-100/80 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", bar: "bg-violet-500" },
  { value: "eletronicos", label: "Eletrônicos", color: "bg-red-100/80 text-red-600 dark:bg-red-500/15 dark:text-red-300", bar: "bg-red-500" },
  { value: "presente", label: "Presente", color: "bg-fuchsia-100/80 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300", bar: "bg-fuchsia-500" },
  { value: "beleza", label: "Beleza", color: "bg-violet-100/80 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", bar: "bg-violet-500" },
  { value: "mercado", label: "Mercado", color: "bg-lime-100/80 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300", bar: "bg-lime-500" },
  { value: "casa", label: "Casa", color: "bg-yellow-100/80 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300", bar: "bg-yellow-500" },
  { value: "pets", label: "Pets", color: "bg-slate-200/80 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300", bar: "bg-slate-500" },
  { value: "filhos", label: "Filhos", color: "bg-blue-200/80 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300", bar: "bg-blue-400" },
  { value: "outros", label: "Outros", color: "bg-gray-100/80 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300", bar: "bg-gray-500" },
];

interface CategoryBudgetsProps {
  expenses: { category: string; value: number }[];
}

export const CategoryBudgets = ({ expenses }: CategoryBudgetsProps) => {
  const [budgets, setBudgets] = usePersistedState<Record<string, number>>("finance-category-budgets", {});
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const spentByCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.value;
    return acc;
  }, {});

  const activeCats = categories.filter(c => budgets[c.value] || spentByCategory[c.value] || editing === c.value);
  const unsetCats = categories.filter(c => !budgets[c.value] && editing !== c.value);

  const startEdit = (cat: string) => {
    setEditing(cat);
    setEditValue(budgets[cat]?.toString() || "");
  };

  const saveEdit = (cat: string) => {
    const val = parseFloat(editValue);
    if (val > 0) {
      setBudgets({ ...budgets, [cat]: val });
    }
    setEditing(null);
  };

  const removeLimit = (cat: string) => {
    const next = { ...budgets };
    delete next[cat];
    setBudgets(next);
    setEditing(null);
  };

  const getBarColor = (pct: number) => {
    if (pct >= 100) return "bg-red-500";
    if (pct >= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  const hasBudgets = Object.keys(budgets).length > 0;

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="bg-muted/40 px-4 py-2.5 flex items-center gap-2">
          <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-bold tracking-wide uppercase">Limites por Categoria</span>
        </div>

        {!hasBudgets && activeCats.length === 0 && !editing ? (
          <EmptyState
            icon={Target}
            title="Sem limites definidos"
            description="Defina limites para controlar seus gastos por categoria e acompanhar visualmente"
          />
        ) : (
          <div className="p-3 space-y-3">
            {/* Categories with budgets or spending */}
            {activeCats.map(cat => {
              const spent = spentByCategory[cat.value] || 0;
              const limit = budgets[cat.value] || 0;
              const pct = limit > 0 ? (spent / limit) * 100 : 0;
              const isEditing = editing === cat.value;

              return (
                <div key={cat.value} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cat.color}`}>
                      {cat.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && saveEdit(cat.value)}
                            className="h-6 w-20 text-[11px] px-1.5"
                            placeholder="Limite"
                            autoFocus
                          />
                          <button onClick={() => saveEdit(cat.value)} className="text-green-500 hover:text-green-400">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => removeLimit(cat.value)} className="text-red-400 hover:text-red-300">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            R$ {spent.toLocaleString("pt-BR")}
                            {limit > 0 && <span> / R$ {limit.toLocaleString("pt-BR")}</span>}
                          </span>
                          <button onClick={() => startEdit(cat.value)} className="text-muted-foreground hover:text-foreground transition-colors">
                            <Pencil className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {limit > 0 && (
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getBarColor(pct)}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  )}
                  {limit > 0 && pct >= 100 && (
                    <p className="text-[10px] text-red-400 font-medium">
                      ⚠ Limite excedido em R$ {(spent - limit).toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add limit for new category */}
        {unsetCats.length > 0 && (
          <div className="border-t border-border px-3 py-2">
            <p className="text-[10px] text-muted-foreground mb-1.5">Adicionar limite:</p>
            <div className="flex flex-wrap gap-1">
              {unsetCats.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => startEdit(cat.value)}
                  className={`text-[10px] px-2 py-0.5 rounded-full transition-colors hover:opacity-80 ${cat.color}`}
                >
                  + {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
