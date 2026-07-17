import { useState } from "react";
import { motion } from "framer-motion";
import { localDayKey } from "@/lib/utils";
import { Droplets, Minus, Pencil, Plus } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";

const todayStr = () => localDayKey(); // dia LOCAL — toISOString virava amanhã depois das 21h (fix 16/07)

export const HydrationTracker = () => {
  const today = todayStr();
  const [waterLog, setWaterLog] = usePersistedState<Record<string, number>>("core-saude-water", {});
  const [waterGoalRaw, setWaterGoal] = usePersistedState<number>("core-saude-water-goal", 8);
  const waterGoal = Math.min(20, Math.max(1, Math.round(Number(waterGoalRaw) || 8)));
  const [editandoMeta, setEditandoMeta] = useState(false);
  // FIX 16/07: a ROTINA conta água em water-log — espelha os dois mundos
  // (lê o maior do dia, escreve nos dois) pra nenhuma tela mostrar zero
  const [waterLogRotina, setWaterLogRotina] = usePersistedState<Record<string, number>>("water-log", {});

  const current = Math.max(waterLog[today] || 0, waterLogRotina[today] || 0);
  const pct = Math.min(100, (current / waterGoal) * 100);
  const mlCurrent = current * 250;
  const mlGoal = waterGoal * 250;

  const addWater = () => {
    const n = Math.min(current + 1, 20);
    setWaterLog(prev => ({ ...prev, [today]: n }));
    setWaterLogRotina(prev => ({ ...prev, [today]: n }));
  };
  const ajustaMeta = (delta: number) => setWaterGoal(Math.min(20, Math.max(1, waterGoal + delta)));

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-[hsl(var(--saude-blue))]" />
          <span className="text-xs font-bold uppercase tracking-wider">Hidratação</span>
        </div>
        <button
          onClick={() => setEditandoMeta(v => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Editar meta de hidratação"
        >
          {mlCurrent}ml / {mlGoal}ml
          <Pencil className="w-3 h-3" />
        </button>
      </div>

      {editandoMeta && (
        <div className="flex items-center justify-between gap-3 mb-3 px-3 py-2.5 rounded-lg bg-[hsl(var(--saude-blue)/0.08)] border border-[hsl(var(--saude-blue)/0.2)]">
          <span className="text-xs font-bold">Meta diária</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => ajustaMeta(-1)}
              disabled={waterGoal <= 1}
              className="w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center disabled:opacity-30"
              aria-label="Diminuir meta"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-black w-24 text-center tabular-nums">
              {waterGoal} {waterGoal === 1 ? "copo" : "copos"} · {waterGoal * 250}ml
            </span>
            <button
              onClick={() => ajustaMeta(1)}
              disabled={waterGoal >= 20}
              className="w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center disabled:opacity-30"
              aria-label="Aumentar meta"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

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
            data-spotlight="add-water"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--saude-blue)/0.12)] hover:bg-[hsl(var(--saude-blue)/0.2)] text-[hsl(var(--saude-blue))] text-xs font-bold transition-colors w-full justify-center border border-[hsl(var(--saude-blue)/0.2)]"
          >
            <Plus className="w-3.5 h-3.5" /> +250ml
          </button>

        </div>
      </div>
    </div>
  );
};
