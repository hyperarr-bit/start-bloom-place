import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Target, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUserData } from "@/hooks/use-user-data";

interface CountdownItem {
  id: string;
  label: string;
  date: string;
}

const KEY = "core-home-countdowns";

export const CountdownWidget = () => {
  const { get, set: setData } = useUserData();
  const [items, setItems] = useState<CountdownItem[]>(() => get(KEY, []));
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDate, setNewDate] = useState("");

  useEffect(() => {
    setData(KEY, items);
  }, [items, setData]);

  const addItem = () => {
    if (!newLabel.trim() || !newDate) return;
    setItems(prev => [...prev, { id: Date.now().toString(), label: newLabel.trim(), date: newDate }]);
    setNewLabel("");
    setNewDate("");
    setAdding(false);
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const getDaysLeft = (date: string) => {
    const diff = new Date(date + "T23:59:59").getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  };

  return (
    <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">🎯 Contagem Regressiva</h4>
        <button onClick={() => setAdding(!adding)} className="w-5 h-5 rounded-md bg-muted flex items-center justify-center hover:bg-muted/80">
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {adding && (
        <div className="flex gap-2 mb-3">
          <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Meta ou evento" className="text-xs h-8" onKeyDown={e => e.key === "Enter" && addItem()} />
          <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="text-xs h-8 w-32" />
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Adicione uma data importante</p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 3).map(item => {
            const days = getDaysLeft(item.date);
            return (
              <motion.div key={item.id} className="flex items-center gap-2" initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}>
                <Target className="w-3 h-3 text-primary/50 flex-shrink-0" />
                <span className="text-xs flex-1 truncate">{item.label}</span>
                <span className="text-xs font-bold text-primary tabular-nums">{days}d</span>
                <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
