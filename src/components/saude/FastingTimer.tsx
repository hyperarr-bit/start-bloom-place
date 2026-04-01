import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Timer, Play, Square } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";

const FASTING_PHASES = [
  { hours: 0, label: "Digestão", emoji: "🍽️" },
  { hours: 4, label: "Pós-absorção", emoji: "⚡" },
  { hours: 8, label: "Gluconeogênese", emoji: "🔄" },
  { hours: 12, label: "Cetose Leve", emoji: "🔥" },
  { hours: 16, label: "Queima de Gordura", emoji: "💪" },
  { hours: 20, label: "Autofagia", emoji: "🧬" },
];

export const FastingTimer = () => {
  const [fastingStart, setFastingStart] = usePersistedState<string | null>("core-saude-fasting-start", null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!fastingStart) { setElapsed(0); return; }
    const update = () => setElapsed(Math.floor((Date.now() - new Date(fastingStart).getTime()) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [fastingStart]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  const currentPhase = [...FASTING_PHASES].reverse().find(p => hours >= p.hours) || FASTING_PHASES[0];
  const nextPhase = FASTING_PHASES.find(p => p.hours > hours);

  const toggle = () => {
    setFastingStart(fastingStart ? null : new Date().toISOString());
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-4">
        <Timer className="w-4 h-4 text-[hsl(var(--saude-blue))]" />
        <span className="text-xs font-bold uppercase tracking-wider">Relógio de Jejum</span>
      </div>

      {fastingStart ? (
        <div className="space-y-4">
          <div className="text-center">
            <div className="font-mono text-3xl font-black tracking-tighter text-foreground">
              {String(hours).padStart(2, "0")}
              <span className="text-muted-foreground">:</span>
              {String(minutes).padStart(2, "0")}
              <span className="text-muted-foreground text-xl">:{String(seconds).padStart(2, "0")}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-muted">
            <span className="text-lg">{currentPhase.emoji}</span>
            <span className="text-sm font-bold text-foreground">{currentPhase.label}</span>
          </div>

          <div className="flex gap-1">
            {FASTING_PHASES.map((phase) => (
              <div
                key={phase.label}
                className={`flex-1 h-1.5 rounded-full transition-colors ${hours >= phase.hours ? "bg-[hsl(var(--saude-blue))]" : "bg-muted"}`}
              />
            ))}
          </div>

          {nextPhase && (
            <p className="text-[11px] text-muted-foreground text-center">
              Próxima fase: <span className="font-bold">{nextPhase.emoji} {nextPhase.label}</span> em {nextPhase.hours - hours}h
            </p>
          )}

          <button
            onClick={toggle}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-bold transition-colors border border-destructive/20"
          >
            <Square className="w-3.5 h-3.5" /> Encerrar Jejum
          </button>
        </div>
      ) : (
        <div className="text-center space-y-3">
          <p className="text-xs text-muted-foreground">Nenhum jejum ativo</p>
          <button
            onClick={toggle}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[hsl(var(--saude-blue)/0.12)] hover:bg-[hsl(var(--saude-blue)/0.2)] text-[hsl(var(--saude-blue))] text-sm font-bold transition-colors border border-[hsl(var(--saude-blue)/0.2)]"
          >
            <Play className="w-4 h-4" /> Iniciar Jejum
          </button>
        </div>
      )}
    </div>
  );
};
