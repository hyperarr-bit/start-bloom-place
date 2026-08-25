import { useState, useEffect, useRef } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Brain, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Timer 25/5/15 compartilhado. Nasceu na aba FOCO da Rotina e agora também
 *  serve a aba MEU DIA da Carreira — as chaves persistidas são as mesmas de
 *  sempre, então quem já usava não perde as sessões nem o histórico. */
export const PomodoroTimer = () => {
  const [mode, setMode] = useState<"focus" | "break" | "longBreak">("focus");
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessions, setSessions] = usePersistedState<number>("pomodoro-sessions-today", 0);
  const [totalFocusMin, setTotalFocusMin] = usePersistedState<number>("pomodoro-total-focus", 0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // Fim da contagem no RELÓGIO DE PAREDE (20/08, review ★4: "o Pomodoro
  // pausa quando a tela é bloqueada"). Com a tela travada o WebView congela
  // os setInterval — contar por tick fazia o timer parar junto. O restante
  // agora deriva SEMPRE de fimEm - agora; o tick só re-renderiza, e ao
  // voltar do bloqueio o visibilitychange recalcula e o timer "alcança" o
  // tempo real (inclusive completando a sessão se o prazo venceu no escuro).
  const fimEm = useRef(0);

  const durations = { focus: 25 * 60, break: 5 * 60, longBreak: 15 * 60 };

  useEffect(() => {
    if (!isRunning) fimEm.current = 0; // pausa/troca: a retomada re-ancora
    if (isRunning && timeLeft > 0) {
      if (!fimEm.current) fimEm.current = Date.now() + timeLeft * 1000;
      const tick = () => setTimeLeft(Math.max(0, Math.round((fimEm.current - Date.now()) / 1000)));
      intervalRef.current = setInterval(tick, 1000);
      const aoVoltar = () => { if (document.visibilityState === "visible") tick(); };
      document.addEventListener("visibilitychange", aoVoltar);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        document.removeEventListener("visibilitychange", aoVoltar);
      };
    } else if (timeLeft === 0) {
      fimEm.current = 0;
      setIsRunning(false);
      if (mode === "focus") {
        setSessions(s => s + 1);
        setTotalFocusMin(t => t + 25);
        // Auto switch to break
        const nextMode = (sessions + 1) % 4 === 0 ? "longBreak" : "break";
        setMode(nextMode);
        setTimeLeft(durations[nextMode]);
      } else {
        setMode("focus");
        setTimeLeft(durations.focus);
      }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, timeLeft]);

  const switchMode = (m: "focus" | "break" | "longBreak") => {
    setIsRunning(false);
    setMode(m);
    setTimeLeft(durations[m]);
  };

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const progress = ((durations[mode] - timeLeft) / durations[mode]) * 100;

  const modeColors = { focus: "from-red-500 to-orange-500 dark:from-red-700 dark:to-orange-700", break: "from-green-400 to-emerald-500 dark:from-green-700 dark:to-emerald-700", longBreak: "from-blue-400 to-indigo-500 dark:from-blue-700 dark:to-indigo-700" };
  const modeLabels = { focus: "FOCO", break: "PAUSA", longBreak: "PAUSA LONGA" };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className={`bg-gradient-to-r ${modeColors[mode]} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-white" />
          <span className="font-bold text-sm text-white">POMODORO — {modeLabels[mode]}</span>
        </div>
        <span className="text-white text-xs font-medium">{sessions} sessões hoje • {totalFocusMin}min foco total</span>
      </div>
      <div className="p-6 flex flex-col items-center gap-4">
        <div className="flex gap-2">
          {(["focus", "break", "longBreak"] as const).map(m => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${mode === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              {modeLabels[m]}
            </button>
          ))}
        </div>

        <div className="relative w-40 h-40 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="70" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
            <circle cx="80" cy="80" r="70" fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeDasharray={440} strokeDashoffset={440 - (440 * progress) / 100} strokeLinecap="round" className="transition-all duration-1000" />
          </svg>
          <span className="text-4xl font-mono font-black">{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}</span>
        </div>

        <div className="flex gap-3">
          <Button size="sm" onClick={() => setIsRunning(!isRunning)} className="gap-2">
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isRunning ? "Pausar" : "Iniciar"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setIsRunning(false); setTimeLeft(durations[mode]); }}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex gap-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`w-3 h-3 rounded-full ${i < (sessions % 4) ? "bg-red-500" : "bg-muted"}`} />
          ))}
        </div>
      </div>
    </div>
  );
};
