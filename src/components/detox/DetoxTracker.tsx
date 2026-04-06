import { useState } from "react";
import { Plus, Trash2, RotateCcw, Flame, Shield, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

const iconOptions = ["🚬", "🍺", "📱", "🍔", "🎮", "☕", "🍫", "💊", "🔞"];

export const DetoxTracker = () => {
  const { get, set } = useUserData();
  const habits = get<DetoxHabit[]>("detox-habits", []);
  const [showForm, setShowForm] = useState(false);
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
    setShowForm(false);
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
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{habits.length} hábito{habits.length !== 1 ? "s" : ""} rastreado{habits.length !== 1 ? "s" : ""}</p>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs text-primary font-bold">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </motion.button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card rounded-xl border border-border p-3 space-y-2 overflow-hidden"
          >
            <div className="flex gap-1.5 flex-wrap justify-center">
              {iconOptions.map(ic => (
                <motion.button
                  key={ic}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setIcon(ic)}
                  className={`text-xl p-1.5 rounded-lg transition-all ${icon === ic ? "bg-primary/20 ring-2 ring-primary scale-110" : "hover:bg-muted/50"}`}
                >
                  {ic}
                </motion.button>
              ))}
            </div>
            <Input placeholder="O que quer parar? (ex: Redes Sociais)" value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" />
            <motion.button whileTap={{ scale: 0.95 }} onClick={addHabit} className="w-full bg-primary text-primary-foreground rounded-lg py-1.5 text-xs font-bold">
              🌿 Iniciar Detox
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {habits.length === 0 && !showForm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 text-muted-foreground text-sm">
          <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-4xl mb-2">🌿</motion.div>
          Adicione hábitos que quer controlar
        </motion.div>
      )}

      <AnimatePresence mode="popLayout">
        {habits.map((h, i) => {
          const streak = getStreak(h);
          const best = Math.max(h.record, streak);
          const isExpanded = selectedHabit === h.id;

          return (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.06 }}
              layout
              className="bg-card rounded-xl border border-border p-3 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedHabit(isExpanded ? null : h.id)}
            >
              <div className="flex items-center gap-3">
                <motion.span
                  className="text-2xl"
                  whileHover={{ scale: 1.2, rotate: 10 }}
                >
                  {h.icon}
                </motion.span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{h.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Flame className="w-3 h-3 text-orange-400" />
                      <motion.span key={streak} initial={{ scale: 1.5 }} animate={{ scale: 1 }}>
                        {streak}
                      </motion.span>
                      {" "}dia{streak !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Shield className="w-3 h-3 text-primary" /> Recorde: {best}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 items-center">
                  <motion.button
                    whileTap={{ scale: 0.8, rotate: -180 }}
                    onClick={(e) => { e.stopPropagation(); relapse(h.id); }}
                    className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                    title="Recaí"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.8 }}
                    onClick={(e) => { e.stopPropagation(); removeHabit(h.id); }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </motion.button>
                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </motion.div>
                </div>
              </div>

              {/* Streak progress bar */}
              <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-lime-400 to-green-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((streak / Math.max(best, 30)) * 100, 100)}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 pt-3 border-t border-border overflow-hidden"
                  >
                    <p className="text-[10px] text-muted-foreground mb-2">{format(today, "MMMM yyyy")}</p>
                    <div className="grid grid-cols-7 gap-1">
                      {["D", "S", "T", "Q", "Q", "S", "S"].map((d, idx) => (
                        <span key={idx} className="text-[8px] text-center text-muted-foreground font-medium">{d}</span>
                      ))}
                      {Array.from({ length: monthStart.getDay() }).map((_, idx) => <div key={`empty-${idx}`} />)}
                      {daysInMonth.map((day, di) => {
                        const ds = format(day, "yyyy-MM-dd");
                        const isRelapse = h.relapses.includes(ds);
                        const isFuture = day > today;
                        const isPure = !isRelapse && !isFuture && day >= new Date(h.startDate);
                        return (
                          <motion.div
                            key={ds}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: di * 0.01 }}
                            className={`aspect-square rounded flex items-center justify-center text-[9px] font-medium ${
                              isFuture ? "bg-muted/20 text-muted-foreground/30" :
                              isRelapse ? "bg-destructive/30 text-destructive" :
                              isPure ? "bg-green-500/30 text-green-400" :
                              "bg-muted/30 text-muted-foreground/50"
                            }`}
                          >
                            {day.getDate()}
                          </motion.div>
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
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
