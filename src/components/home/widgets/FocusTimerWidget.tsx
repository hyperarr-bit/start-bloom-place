import { motion } from "framer-motion";
import { Play, Pause, RotateCcw } from "lucide-react";
import { usePomodoro } from "@/components/PomodoroTimer";

/**
 * TIMER DE FOCO da Home (28/09). Era fixo em 25 min enquanto o Pomodoro da
 * Rotina já deixava escolher de 15 a 60 (chamado de 26/09), contava por tique
 * e o foco feito aqui não entrava no "foco do mês" das insígnias.
 *
 * 1.0.22 (sem repetição, dono 28/10): deixou de ter relógio próprio — é o MESMO
 * timer da Rotina › Foco e da Carreira › Meu dia (usePomodoro + lib/pomodoro-agora).
 * Começar aqui e abrir a Rotina mostra o mesmo tempo correndo; a sessão conta uma vez.
 */
const ROTULO = { focus: "Timer de Foco", break: "Pausa", longBreak: "Pausa longa" } as const;

export const FocusTimerWidget = () => {
  const { durations, mode, isRunning: running, timeLeft: seconds, alternar, recomecar } = usePomodoro();
  const total = durations[mode];
  const minutos = Math.round(total / 60);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const pct = ((total - seconds) / total) * 100;

  return (
    <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm" data-testid="widget-foco">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">⏱️ {ROTULO[mode]} · {minutos} min</h4>
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
            <motion.circle
              cx="24" cy="24" r="20" fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="3" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 20}
              animate={{ strokeDashoffset: 2 * Math.PI * 20 * (1 - pct / 100) }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold tabular-nums" data-testid="widget-foco-tempo">{mins}:{secs.toString().padStart(2, "0")}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={alternar}
            aria-label={running ? "Pausar o foco" : "Começar o foco"}
            className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center"
          >
            {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={recomecar}
            aria-label="Recomeçar o foco"
            className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
