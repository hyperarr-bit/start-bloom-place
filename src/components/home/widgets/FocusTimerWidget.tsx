import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { diaLocal, minutosValidos, somarFocoDoDia } from "@/components/PomodoroTimer";

/**
 * TIMER DE FOCO da Home (28/09). Era fixo em 25 min enquanto o Pomodoro da
 * Rotina já deixava escolher de 15 a 60 (chamado de 26/09: "só aparece 25 ou
 * 5, aí não adianta colocar os tempos de foco"), contava por tique (congelava
 * com a tela travada, o mesmo defeito que o Pomodoro teve em 20/08) e o foco
 * feito aqui não entrava no "foco do mês" das insígnias. Agora usa o tempo
 * escolhido (`pomodoro-duracoes`), conta no relógio de parede e grava nas
 * mesmas chaves do Pomodoro.
 */
export const FocusTimerWidget = () => {
  const [salvos] = usePersistedState<Partial<Record<"focus" | "break" | "longBreak", number>>>("pomodoro-duracoes", {});
  const minutos = minutosValidos(salvos).focus;
  const total = minutos * 60;
  const [seconds, setSeconds] = useState(total);
  const [running, setRunning] = useState(false);
  const fimEm = useRef(0);
  const [sessions, setSessions] = usePersistedState<number>("pomodoro-sessions-today", 0);
  const [diaSessoes, setDiaSessoes] = usePersistedState<string>("pomodoro-sessions-dia", "");
  const [, setTotalFocusMin] = usePersistedState<number>("pomodoro-total-focus", 0);
  const [, setFocoPorDia] = usePersistedState<Record<string, number>>("pomodoro-log", {});

  // Tempo trocado no Pomodoro (ou chegou do servidor depois do 1º desenho):
  // parado e cheio, o mostrador acompanha. Pausado no meio, não mexe.
  const cheioAntes = useRef(total);
  useEffect(() => {
    if (!running && seconds === cheioAntes.current && total !== seconds) setSeconds(total);
    cheioAntes.current = total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // Conta no relógio de parede: com a tela travada o WebView congela o
  // setInterval; ao voltar, o visibilitychange recalcula e o timer alcança.
  useEffect(() => {
    if (!running) { fimEm.current = 0; return; }
    if (!fimEm.current) fimEm.current = Date.now() + seconds * 1000;
    const tick = () => setSeconds(Math.max(0, Math.round((fimEm.current - Date.now()) / 1000)));
    const id = window.setInterval(tick, 1000);
    const aoVoltar = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", aoVoltar); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    if (!running || seconds > 0) return;
    setRunning(false);
    fimEm.current = 0;
    const hoje = diaLocal();
    setSessions(diaSessoes === hoje ? sessions + 1 : 1);
    setDiaSessoes(hoje);
    setTotalFocusMin((t) => t + minutos);
    setFocoPorDia((l) => somarFocoDoDia(l, hoje, minutos));
    toast.success(`Foco de ${minutos} min concluído`);
    setSeconds(total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, running]);

  const recomecar = () => { setRunning(false); fimEm.current = 0; setSeconds(total); };

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const pct = ((total - seconds) / total) * 100;

  return (
    <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm" data-testid="widget-foco">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">⏱️ Timer de Foco · {minutos} min</h4>
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
            onClick={() => setRunning(!running)}
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
