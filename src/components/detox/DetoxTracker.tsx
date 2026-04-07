import { useState } from "react";
import { Plus, Trash2, RotateCcw, Flame, Shield, ChevronDown, Leaf } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { differenceInDays, format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";

interface DetoxHabit {
  id: string;
  name: string;
  icon: string;
  startDate: string;
  relapses: string[];
  record: number;
}

const iconOptions = ["🚬", "🍺", "📱", "🍔", "🎮", "☕", "🍫", "💊", "🔞", "🎰"];

export const DetoxTracker = () => {
  const { get, set } = useUserData();
  const habits = get<DetoxHabit[]>("detox-habits", []);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📱");
  const [selectedHabit, setSelectedHabit] = useState<string | null>(null);

  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const addHabit = () => {
    if (!name.trim()) return;
    const updated = [...habits, { id: Date.now().toString(), name: name.trim(), icon, startDate: new Date().toISOString().split("T")[0], relapses: [], record: 0 }];
    set("detox-habits", updated);
    setName("");
  };

  const relapse = (id: string) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const updated = habits.map(h => {
      if (h.id !== id) return h;
      const currentStreak = getStreak(h);
      const newRecord = Math.max(h.record, currentStreak);
      return { ...h, relapses: [...h.relapses, todayStr], startDate: todayStr, record: newRecord };
    });
    set("detox-habits", updated);
  };

  const removeHabit = (id: string) => set("detox-habits", habits.filter(h => h.id !== id));

  const getStreak = (h: DetoxHabit) => {
    const lastRelapse = h.relapses.length > 0 ? h.relapses[h.relapses.length - 1] : null;
    const from = lastRelapse || h.startDate;
    return differenceInDays(new Date(), new Date(from));
  };

  return (
    <div className="mt-3">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-lime-200 dark:bg-lime-900/60 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="w-3.5 h-3.5 text-lime-700 dark:text-lime-300" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-lime-800 dark:text-lime-200">Hábitos</span>
          </div>
          <span className="text-[10px] text-lime-600 dark:text-lime-300">{habits.length}</span>
        </div>

        <div className="bg-lime-50/50 dark:bg-lime-950/20 p-2 space-y-2">
          {habits.map(h => {
            const streak = getStreak(h);
            const best = Math.max(h.record, streak);
            const isExpanded = selectedHabit === h.id;

            return (
              <div
                key={h.id}
                className="bg-background/60 rounded-lg p-2.5 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => setSelectedHabit(isExpanded ? null : h.id)}
              >
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
                  <div className="flex gap-1 items-center">
                    <button
                      onClick={e => { e.stopPropagation(); relapse(h.id); }}
                      className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                      title="Recaí"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); removeHabit(h.id); }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </div>

                <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-lime-400 to-green-500 transition-all duration-600"
                    style={{ width: `${Math.min((streak / Math.max(best, 30)) * 100, 100)}%` }}
                  />
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-[10px] text-muted-foreground mb-2">{format(today, "MMMM yyyy")}</p>
                    <div className="grid grid-cols-7 gap-1">
                      {["D", "S", "T", "Q", "Q", "S", "S"].map((d, idx) => (
                        <span key={idx} className="text-[8px] text-center text-muted-foreground font-medium">{d}</span>
                      ))}
                      {Array.from({ length: monthStart.getDay() }).map((_, idx) => <div key={`empty-${idx}`} />)}
                      {daysInMonth.map(day => {
                        const ds = format(day, "yyyy-MM-dd");
                        const isRelapse = h.relapses.includes(ds);
                        const isFuture = day > today;
                        const isPure = !isRelapse && !isFuture && day >= new Date(h.startDate);
                        return (
                          <div
                            key={ds}
                            className={`aspect-square rounded flex items-center justify-center text-[9px] font-medium ${
                              isFuture ? "bg-muted/20 text-muted-foreground/30" :
                              isRelapse ? "bg-destructive/30 text-destructive" :
                              isPure ? "bg-green-500/30 text-green-400" :
                              "bg-muted/30 text-muted-foreground/50"
                            }`}
                          >
                            {day.getDate()}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-3 mt-2.5 justify-center">
                      <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded bg-green-500/30" /> Puro
                      </span>
                      <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded bg-destructive/30" /> Recaída
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {habits.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic py-3 text-center">Nenhum hábito rastreado ainda</p>
          )}

          <div className="border border-dashed border-border/60 bg-background/50 rounded-lg p-2 space-y-1.5">
            <div className="flex gap-1 flex-wrap justify-center">
              {iconOptions.map(ic => (
                <button
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className={`text-lg p-1 rounded-lg transition-all ${icon === ic ? "bg-primary/20 ring-1 ring-primary scale-110" : "opacity-50 hover:opacity-80"}`}
                >
                  {ic}
                </button>
              ))}
            </div>
            <Input placeholder="O que quer parar? (ex: Redes Sociais)" value={name} onChange={e => setName(e.target.value)} className="h-7 text-[11px]" onKeyDown={e => e.key === "Enter" && addHabit()} />
            <button onClick={addHabit} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md py-1 transition-colors">
              <Plus className="w-3 h-3" /> Iniciar Detox
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
