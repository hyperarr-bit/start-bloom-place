import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Check, Package } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Input } from "@/components/ui/input";

interface Supplement {
  id: string;
  name: string;
  time: string;
  stock: number;
  dosesPerDay: number;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

const nameColors = [
  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
];

export const PharmacyChecklist = () => {
  const today = todayStr();
  const [supplements, setSupplements] = usePersistedState<Supplement[]>("core-saude-supplements", []);
  const [supplementLog, setSupplementLog] = usePersistedState<Record<string, string[]>>("core-saude-supplement-log", {});
  const [newName, setNewName] = useState("");
  const [newTime, setNewTime] = useState("08:00");
  const takenToday = supplementLog[today] || [];

  const toggleTaken = (id: string) => {
    const alreadyTaken = takenToday.includes(id);
    const newTaken = alreadyTaken ? takenToday.filter(x => x !== id) : [...takenToday, id];
    setSupplementLog(prev => ({ ...prev, [today]: newTaken }));
    if (!alreadyTaken) {
      setSupplements(prev => prev.map(s => s.id === id ? { ...s, stock: Math.max(0, s.stock - 1) } : s));
    } else {
      setSupplements(prev => prev.map(s => s.id === id ? { ...s, stock: s.stock + 1 } : s));
    }
  };

  const addSupplement = () => {
    if (!newName.trim()) return;
    setSupplements(prev => [...prev, { id: Date.now().toString(), name: newName.trim(), time: newTime, stock: 30, dosesPerDay: 1 }]);
    setNewName("");
  };

  const removeSupplement = (id: string) => {
    setSupplements(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-card">
      {/* Colored header band */}
      <div className="bg-amber-100 dark:bg-amber-900/30 px-5 py-4 flex items-center justify-between">
        <h3 className="text-base font-black uppercase tracking-wide text-foreground">Vitaminas e Remédios</h3>
        <span className="text-3xl">💊</span>
      </div>

      {/* Table */}
      {supplements.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="w-10 px-3 py-3" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Horário</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Estoque</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {supplements.map((s, idx) => {
                  const taken = takenToday.includes(s.id);
                  const lowStock = s.stock <= 5;
                  const color = nameColors[idx % nameColors.length];
                  return (
                    <motion.tr
                      key={s.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`border-t border-border/50 transition-colors ${taken ? "bg-[hsl(var(--saude-green)/0.05)]" : "hover:bg-muted/30"}`}
                    >
                      <td className="px-3 py-3">
                        <button
                          onClick={() => toggleTaken(s.id)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${taken ? "bg-[hsl(var(--saude-green))] border-[hsl(var(--saude-green))]" : "border-muted-foreground/30 hover:border-[hsl(var(--saude-green)/0.5)]"}`}
                        >
                          {taken && <Check className="w-3 h-3 text-white" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${taken ? "line-through opacity-60" : ""} ${color}`}>
                          {s.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{s.time}</td>
                      <td className="px-4 py-3">
                        {lowStock ? (
                          <span className="flex items-center gap-1 text-[10px] text-[hsl(var(--saude-yellow))] font-semibold">
                            <Package className="w-3 h-3" /> {s.stock}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{s.stock}</span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <button onClick={() => removeSupplement(s.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {/* Empty rows for visual padding */}
              {supplements.length < 4 && Array.from({ length: 4 - supplements.length }).map((_, i) => (
                <tr key={`empty-${i}`} className="border-t border-border/50">
                  <td className="px-3 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-2 py-3" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Nenhum suplemento cadastrado</p>
        </div>
      )}

      {/* Add form */}
      <div className="px-4 pb-4 pt-2 flex gap-2">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addSupplement()}
          placeholder="Novo suplemento..."
          className="text-xs h-9 flex-1"
        />
        <Input
          type="time"
          value={newTime}
          onChange={e => setNewTime(e.target.value)}
          className="text-xs h-9 w-24"
        />
        <button
          onClick={addSupplement}
          className="h-9 w-9 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary flex items-center justify-center flex-shrink-0 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
