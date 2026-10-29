import { useState, useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  concluirPomodoro, estadoDoPomodoro, iniciarPomodoro, irParaModo, ouvirPomodoro, pausarPomodoro, recomecarPomodoro, tempoRestante,
} from "@/lib/pomodoro-agora";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Brain, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Modo = "focus" | "break" | "longBreak";
type Minutos = Record<Modo, number>;

const PADRAO: Minutos = { focus: 25, break: 5, longBreak: 15 };
/** Tempos que dá pra escolher (26/09, chamado do app: "no foco não é possível
 *  alterar a quantidade de tempo? Só aparece 25 ou 5"). */
export const OPCOES_MINUTOS: Record<Modo, number[]> = {
  focus: [15, 25, 30, 45, 50, 60],
  break: [5, 10, 15],
  longBreak: [15, 20, 30],
};

/** Minutos válidos (1–180); qualquer coisa estranha no banco volta pro padrão. */
export const minutosValidos = (m: Partial<Minutos> | null | undefined): Minutos => {
  const ok = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 180 ? Math.round(v) : d);
  return { focus: ok(m?.focus, PADRAO.focus), break: ok(m?.break, PADRAO.break), longBreak: ok(m?.longBreak, PADRAO.longBreak) };
};

/** Dia local (YYYY-MM-DD) — o contador "sessões hoje" zera quando ele muda. */
export const diaLocal = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Quantos dias o registro por dia guarda (mais de um ano: a insígnia é do mês). */
export const DIAS_NO_LOG_DE_FOCO = 400;

/** `pomodoro-log[dia] += minutos`, guardando só os últimos 400 dias (dado torto vira {}). */
export const somarFocoDoDia = (log: unknown, dia: string, minutos: number): Record<string, number> => {
  const base = log && typeof log === "object" && !Array.isArray(log) ? (log as Record<string, unknown>) : {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(base)) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Number.isFinite(Number(v)) && Number(v) > 0) out[k] = Number(v);
  out[dia] = (out[dia] ?? 0) + Math.max(0, minutos);
  const dias = Object.keys(out).sort();
  for (const k of dias.slice(0, Math.max(0, dias.length - DIAS_NO_LOG_DE_FOCO))) delete out[k];
  return out;
};

/**
 * O TIMER ÚNICO (1.0.22, sem repetição): o estado mora em lib/pomodoro-agora (um só por aparelho) e TODA tela com
 * pomodoro usa este hook — Rotina › Foco, Carreira › Meu dia e o widget da Home mostram o mesmo relógio. Quem vê o
 * período acabar primeiro grava as chaves de sempre (`pomodoro-*`, mesmo formato) uma vez só.
 */
export function usePomodoro() {
  const [salvos, setSalvos] = usePersistedState<Minutos>("pomodoro-duracoes", PADRAO);
  const minutos = minutosValidos(salvos);
  const durations: Minutos = { focus: minutos.focus * 60, break: minutos.break * 60, longBreak: minutos.longBreak * 60 };
  const estado = useSyncExternalStore(ouvirPomodoro, estadoDoPomodoro, estadoDoPomodoro);
  const mode = estado.modo;
  const isRunning = estado.rodando;
  const [agora, setAgora] = useState(() => Date.now());
  const timeLeft = tempoRestante(estado, durations[mode], agora);

  const [sessions, setSessions] = usePersistedState<number>("pomodoro-sessions-today", 0);
  // "sessões HOJE" nunca zerava (26/09): a chave guardava só o número e somava
  // pra sempre. Agora anda junto do dia em que foi contada.
  const [diaSessoes, setDiaSessoes] = usePersistedState<string>("pomodoro-sessions-dia", "");
  const sessoesHoje = diaSessoes === diaLocal() ? sessions : 0;
  const [totalFocusMin, setTotalFocusMin] = usePersistedState<number>("pomodoro-total-focus", 0);
  // Foco por DIA (27/09): `pomodoro-log` { "AAAA-MM-DD": minutos } — é o que
  // deixa a insígnia "Horas de foco no mês" existir; o acumulado de sempre
  // (`pomodoro-total-focus`) continua sendo gravado do mesmo jeito.
  const [, setFocoPorDia] = usePersistedState<Record<string, number>>("pomodoro-log", {});

  // Fim da contagem no RELÓGIO DE PAREDE (20/08, review ★4: "o Pomodoro pausa quando a tela é bloqueada"): o
  // restante deriva SEMPRE de fimEm - agora; o tick só re-renderiza, e ao voltar do bloqueio o visibilitychange
  // recalcula e o timer "alcança" o tempo real (inclusive completando a sessão se o prazo venceu no escuro).
  useEffect(() => {
    if (!isRunning) return;
    const tick = () => setAgora(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    const aoVoltar = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [isRunning, estado.fimEm]);

  useEffect(() => {
    if (!isRunning || timeLeft > 0) return;
    const terminou = concluirPomodoro(estado.fimEm, Math.max(Date.now(), agora));
    if (!terminou) return; // outra tela já levou esta sessão
    if (terminou === "focus") {
      const hoje = diaLocal();
      const feitasHoje = diaSessoes === hoje ? sessions + 1 : 1;
      setSessions(feitasHoje);
      setDiaSessoes(hoje);
      setTotalFocusMin(t => t + minutos.focus);
      setFocoPorDia(l => somarFocoDoDia(l, hoje, minutos.focus));
      toast.success(`Foco de ${minutos.focus} min concluído`);
      // Auto switch to break
      irParaModo(feitasHoje % 4 === 0 ? "longBreak" : "break");
    } else {
      irParaModo("focus");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, timeLeft, estado.fimEm]);

  return {
    minutos, durations, mode, isRunning, timeLeft, sessoesHoje, totalFocusMin,
    alternar: () => (isRunning ? pausarPomodoro() : iniciarPomodoro(timeLeft)),
    recomecar: () => recomecarPomodoro(),
    switchMode: (m: Modo) => irParaModo(m),
    escolherMinutos: (m: number) => { setSalvos({ ...minutos, [mode]: m }); recomecarPomodoro(); },
  };
}

/** Timer compartilhado (Rotina › Foco e Carreira › Meu dia) — o mesmo estado do widget da Home (usePomodoro). As
 *  chaves persistidas são as mesmas de sempre, então quem já usava não perde as sessões nem o histórico. */
export const PomodoroTimer = () => {
  const { minutos, durations, mode, isRunning, timeLeft, sessoesHoje, totalFocusMin, alternar, recomecar, switchMode, escolherMinutos } = usePomodoro();

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const progress = ((durations[mode] - timeLeft) / durations[mode]) * 100;

  const modeColors = { focus: "from-red-500 to-orange-500 dark:from-red-700 dark:to-orange-700", break: "from-green-400 to-emerald-500 dark:from-green-700 dark:to-emerald-700", longBreak: "from-blue-400 to-indigo-500 dark:from-blue-700 dark:to-indigo-700" };
  const modeLabels = { focus: "FOCO", break: "PAUSA", longBreak: "PAUSA LONGA" };
  const rotuloTempo = { focus: "Tempo de foco", break: "Tempo de pausa", longBreak: "Pausa longa" };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className={`bg-gradient-to-r ${modeColors[mode]} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-white" />
          <span className="font-bold text-sm text-white">POMODORO — {modeLabels[mode]}</span>
        </div>
        <span className="text-white text-xs font-medium">{sessoesHoje} {sessoesHoje === 1 ? "sessão" : "sessões"} hoje • {totalFocusMin}min foco total</span>
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
          <Button size="sm" onClick={alternar} className="gap-2">
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isRunning ? "Pausar" : "Iniciar"}
          </Button>
          <Button size="sm" variant="outline" onClick={recomecar} aria-label="Recomeçar">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* Tempo escolhido: só com o timer parado, pra ninguém trocar sem querer no meio. */}
        {!isRunning && (
          <div className="w-full flex flex-col items-center gap-1.5" data-testid="pomodoro-tempos">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{rotuloTempo[mode]}</span>
            <div className="flex flex-wrap justify-center gap-1.5">
              {OPCOES_MINUTOS[mode].map(m => (
                <button
                  key={m}
                  onClick={() => escolherMinutos(m)}
                  aria-pressed={minutos[mode] === m}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${minutos[mode] === m ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-border hover:bg-muted"}`}
                >
                  {m} min
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`w-3 h-3 rounded-full ${i < (sessoesHoje % 4) ? "bg-red-500" : "bg-muted"}`} />
          ))}
        </div>
      </div>
    </div>
  );
};
