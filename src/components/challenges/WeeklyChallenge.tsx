import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Target, ChevronRight, RotateCcw, X } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import {
  CHALLENGES, challengeByKey, mondayOf, weekDates,
  EMPTY_CHALLENGES, type ChallengesState,
} from "./challenges";

interface Props {
  /** Gastos variáveis (finance-expenses) — a fonte de avaliação da semana. */
  expenses: any[];
}

/**
 * Card "Desafio da semana" do Dashboard.
 * Sem desafio ativo → catálogo pra escolher. Ativo → progresso vivo.
 * Vitória entra no histórico na hora (alimenta as insígnias de desafio);
 * semana virou sem cumprir → derrota registrada e catálogo de novo.
 */
export const WeeklyChallenge = ({ expenses }: Props) => {
  const [state, setState] = usePersistedState<ChallengesState>("finance-challenges", EMPTY_CHALLENGES);
  // Opt-out: quem não curte a mecânica esconde de vez (reativa em Conquistas)
  const [hidden, setHidden] = usePersistedState<boolean>("finance-challenges-hidden", false);

  const thisMonday = mondayOf(new Date());

  // Finaliza semana antiga (derrota se não venceu) — lazy, sem cron.
  useEffect(() => {
    if (!state.active || state.active.weekStart === thisMonday) return;
    const already = state.history.some(
      (h) => h.weekStart === state.active!.weekStart && h.key === state.active!.key,
    );
    setState({
      active: null,
      history: already
        ? state.history
        : [...state.history, { key: state.active.key, weekStart: state.active.weekStart, result: "loss" as const }],
    });
  }, [state, thisMonday, setState]);

  const active = state.active && state.active.weekStart === thisMonday ? state.active : null;
  const def = active ? challengeByKey(active.key) : null;

  const evaluation = useMemo(() => {
    if (!active || !def) return null;
    const days = weekDates(active.weekStart);
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const elapsedDays = Math.min(Math.max(days.indexOf(todayStr) + 1, 1), 7);
    const weekSet = new Set(days);
    const weekExpenses = expenses.filter((e) => weekSet.has(e.date));

    const prevBase = new Date(`${active.weekStart}T12:00:00`);
    prevBase.setDate(prevBase.getDate() - 7);
    const prevSet = new Set(weekDates(mondayOf(prevBase)));
    const prevWeekTotal = expenses
      .filter((e) => prevSet.has(e.date))
      .reduce((s, e) => s + (e.value || 0), 0);

    return def.evaluate({ weekExpenses, prevWeekTotal, elapsedDays });
  }, [active, def, expenses]);

  // Vitória vira histórico imediatamente (dedupe por semana+key) — alimenta
  // as insígnias de desafio sem esperar a semana acabar.
  useEffect(() => {
    if (!active || !evaluation?.done) return;
    const already = state.history.some(
      (h) => h.weekStart === active.weekStart && h.key === active.key && h.result === "win",
    );
    if (already) return;
    setState({
      ...state,
      history: [...state.history, { key: active.key, weekStart: active.weekStart, result: "win" }],
    });
    trackEvent("challenge_won", { challenge: active.key });
  }, [active, evaluation?.done, state, setState]);

  const pick = (key: string) => {
    trackEvent("challenge_start", { challenge: key });
    setState({ ...state, active: { key, weekStart: thisMonday } });
  };

  const wins = state.history.filter((h) => h.result === "win").length;

  const hide = () => {
    trackEvent("challenge_optout", {});
    setHidden(true);
    toast("Desafios ocultos. Reative quando quiser na página de Conquistas.");
  };

  /* ------------------------------------------------------------- render */

  if (hidden) return null;

  if (!active || !def) {
    return (
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-accent" /> DESAFIO DA SEMANA
          </h4>
          <div className="flex items-center gap-2">
            {wins > 0 && <span className="text-[10px] text-muted-foreground font-semibold">{wins} vencido{wins > 1 ? "s" : ""} 🏆</span>}
            <button onClick={hide} aria-label="Ocultar desafios" className="grid place-items-center w-6 h-6 rounded-full hover:bg-muted transition-colors">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {CHALLENGES.map((c) => (
            <button
              key={c.key}
              onClick={() => pick(c.key)}
              className="w-full flex items-center gap-3 rounded-xl border border-border bg-background p-3 text-left hover:border-accent/50 active:scale-[0.99] transition-all"
            >
              <span className="text-xl shrink-0">{c.emoji}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-bold leading-tight">{c.title}</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">{c.desc}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  const ev = evaluation!;
  const stateColor = ev.done ? "text-emerald-500" : ev.failed ? "text-muted-foreground" : "text-accent";

  return (
    <div className={`bg-card rounded-lg border p-4 ${ev.done ? "border-emerald-500/40" : "border-border"}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-accent" /> DESAFIO DA SEMANA
        </h4>
        <div className="flex items-center gap-2">
          {wins > 0 && <span className="text-[10px] text-muted-foreground font-semibold">{wins} 🏆</span>}
          <button onClick={hide} aria-label="Ocultar desafios" className="grid place-items-center w-6 h-6 rounded-full hover:bg-muted transition-colors">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <motion.span
          key={ev.done ? "won" : "going"}
          initial={{ scale: 0.6 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 12 }}
          className="grid place-items-center w-11 h-11 rounded-xl bg-secondary text-2xl shrink-0"
        >
          {ev.done ? "🏆" : def.emoji}
        </motion.span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">{ev.done ? "Desafio cumprido!" : def.title}</p>
          <p className={`text-[11.5px] mt-0.5 ${stateColor}`}>{ev.statusText}</p>
        </div>
      </div>

      {!ev.failed && (
        <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${ev.done ? "bg-emerald-500" : "bg-accent"}`}
            initial={{ width: 0 }}
            animate={{ width: `${ev.pct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      )}

      {(ev.failed || ev.done) && (
        <button
          onClick={() => setState({ ...state, active: null })}
          className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> Escolher outro desafio
        </button>
      )}
    </div>
  );
};
