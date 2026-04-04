import { useState } from "react";
import { Plus, Trash2, RotateCcw, Flame, Shield } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { differenceInDays, format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";

interface DetoxHabit {
  id: string;
  name: string;
  icon: string;
  startDate: string;
  relapses: string[]; // dates of relapses
  record: number;
}

const iconOptions = ["🚬", "🍺", "📱", "🍔", "🎮", "☕", "🍫", "💊"];

export const DetoxTracker = () => {
  const { get, set } = useUserData();
  const habits = get<DetoxHabit[]>("detox-habits", []);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📱");

  const addHabit = () => {
    if (!name.trim()) return;
    const updated = [...habits, { id: Date.now().toString(), name: name.trim(), icon, startDate: new Date().toISOString().split("T")[0], relapses: [], record: 0 }];
    set("detox-habits", updated);
    setName("");
    setShowForm(false);
  };

  const relapse = (id: string) => {
    const today = new Date().toISOString().split("T")[0];
    const updated = habits.map(h => {
      if (h.id !== id) return h;
      const currentStreak = getStreak(h);
      const newRecord = Math.max(h.record, currentStreak);
      return { ...h, relapses: [...h.relapses, today], startDate: today, record: newRecord };
    });
    set("detox-habits", updated);
  };

  const removeHabit = (id: string) => set("detox-habits", habits.filter(h => h.id !== id));

  const getStreak = (h: DetoxHabit) => {
    const lastRelapse = h.relapses.length > 0 ? h.relapses[h.relapses.length - 1] : null;
    const from = lastRelapse || h.startDate;
    return differenceInDays(new Date(), new Date(from));
  };

  // Month grid for selected habit
  const [selectedHabit, setSelectedHabit] = useState<string | null>(null);
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const sel = habits.find(h => h.id === selectedHabit);

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{habits.length} hábito{habits.length !== 1 ? "s" : ""} rastreado{habits.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs text-primary font-bold">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-3 space-y-2">
          <div className="flex gap-1.5 flex-wrap">
            {iconOptions.map(ic => (
              <button key={ic} onClick={() => setIcon(ic)} className={`text-lg p-1 rounded ${icon === ic ? "bg-primary/20 ring-1 ring-primary" : ""}`}>
                {ic}
              </button>
            ))}
          </div>
          <Input placeholder="O que quer parar? (ex: Redes Sociais)" value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" />
          <button onClick={addHabit} className="w-full bg-primary text-primary-foreground rounded-lg py-1.5 text-xs font-bold">Iniciar Detox</button>
        </div>
      )}

      {habits.length === 0 && !showForm && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Adicione hábitos que quer controlar 🌿
        </div>
      )}

      {habits.map(h => {
        const streak = getStreak(h);
        const best = Math.max(h.record, streak);
        return (
          <div key={h.id} className="bg-card rounded-xl border border-border p-3" onClick={() => setSelectedHabit(selectedHabit === h.id ? null : h.id)}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{h.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{h.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Flame className="w-3 h-3 text-orange-400" /> {streak} dia{streak !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Shield className="w-3 h-3 text-primary" /> Recorde: {best}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={(e) => { e.stopPropagation(); relapse(h.id); }} className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors" title="Recaí">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); removeHabit(h.id); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {selectedHabit === h.id && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-[10px] text-muted-foreground mb-2">{format(today, "MMMM yyyy")}</p>
                <div className="grid grid-cols-7 gap-1">
                  {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                    <span key={i} className="text-[8px] text-center text-muted-foreground">{d}</span>
                  ))}
                  {Array.from({ length: monthStart.getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
                  {daysInMonth.map(day => {
                    const ds = format(day, "yyyy-MM-dd");
                    const isRelapse = h.relapses.includes(ds);
                    const isFuture = day > today;
                    const isPure = !isRelapse && !isFuture && day >= new Date(h.startDate);
                    return (
                      <div key={ds} className={`aspect-square rounded-sm flex items-center justify-center text-[9px] ${
                        isFuture ? "bg-muted/20 text-muted-foreground/30" :
                        isRelapse ? "bg-destructive/30 text-destructive" :
                        isPure ? "bg-green-500/30 text-green-400" :
                        "bg-muted/30 text-muted-foreground/50"
                      }`}>
                        {day.getDate()}
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-3 mt-2 justify-center">
                  <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-green-500/30" /> Puro
                  </span>
                  <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-destructive/30" /> Recaída
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
