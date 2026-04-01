import { motion } from "framer-motion";
import { Droplets, Plus } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";

const todayStr = () => new Date().toISOString().slice(0, 10);

export const HydrationTracker = () => {
  const today = todayStr();
  const [waterLog, setWaterLog] = usePersistedState<Record<string, number>>("core-saude-water", {});
  const [waterGoal] = usePersistedState<number>("core-saude-water-goal", 8);

  const current = waterLog[today] || 0;
  const pct = Math.min(100, (current / waterGoal) * 100);
  const mlCurrent = current * 250;
  const mlGoal = waterGoal * 250;

  const addWater = () => {
    setWaterLog(prev => ({ ...prev, [today]: Math.min((prev[today] || 0) + 1, 20) }));
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-[hsl(var(--saude-blue))]" />
          <span className="text-xs font-bold uppercase tracking-wider">Hidratação</span>
        </div>
        <span className="text-xs text-muted-foreground">{mlCurrent}ml / {mlGoal}ml</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Visual cup */}
        <div className="relative w-14 h-20 rounded-b-2xl rounded-t-lg border-2 border-[hsl(var(--saude-blue)/0.3)] overflow-hidden flex-shrink-0">
          <motion.div
            className="absolute bottom-0 left-0 right-0"
            style={{ background: "hsl(var(--saude-blue) / 0.35)" }}
            initial={{ height: 0 }}
            animate={{ height: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-black text-foreground">{current}</span>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "hsl(var(--saude-blue))" }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>

          {/* Dot indicators */}
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: waterGoal }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${i < current ? "bg-[hsl(var(--saude-blue))]" : "bg-muted"}`}
              />
            ))}
          </div>

          {/* Add button */}
          <button
            onClick={addWater}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--saude-blue)/0.12)] hover:bg-[hsl(var(--saude-blue)/0.2)] text-[hsl(var(--saude-blue))] text-xs font-bold transition-colors w-full justify-center border border-[hsl(var(--saude-blue)/0.2)]"
          >
            <Plus className="w-3.5 h-3.5" /> +250ml
          </button>
        </div>
      </div>
    </div>
  );
};
