import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Target, ChevronRight, RotateCcw, X } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { PERFIL_PESSOAL } from "@/lib/finance-perfil";
import {
  CHALLENGES, challengeByKey, mondayOf, avaliarDesafio, fecharSemanaDoDesafio, gastosParaDesafio,
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
  /* Opt-out: quem não curte a mecânica esconde de vez. Religa AQUI mesmo (27/09):
     a linha tracejada fica no lugar onde o card estava — quem escondeu ali
     reencontra ali. (Lida pelo store, não por snapshot: o adesivo "Desafiante"
     em Conquistas também religa, e o card tem que voltar na hora.) */
  const { get, set, loaded } = useUserData();
  const hidden = get<unknown>("finance-challenges-hidden", false) === true;
  const setHidden = (v: boolean) => set("finance-challenges-hidden", v);
  const perfil = get<string>("finance-perfil-ativo", PERFIL_PESSOAL) || PERFIL_PESSOAL;
  /* Gastos da semana do desafio e da anterior em TODOS os baldes (29/09): a
     semana que cruza o mês tem metade no arquivo do mês passado. */
  const gastosDa = (weekStart: string) => gastosParaDesafio((chave) => get<unknown>(chave, undefined), weekStart, perfil, expenses);

  const thisMonday = mondayOf(new Date());

  // Fecha a semana antiga AVALIANDO os 7 dias (29/09) — antes marcava derrota
  // sem olhar a semana, e quem cumpria sem abrir o Painel no domingo perdia.
  // O mesmo fechamento roda na abertura do app (hooks/use-fechamento-desafio);
  // os dois chegam ao mesmo resultado, e o repetido não entra duas vezes.
  useEffect(() => {
    if (!loaded) return;
    const fechado = fecharSemanaDoDesafio(state, gastosDa, new Date());
    if (fechado) setState(fechado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, thisMonday, setState, loaded]);

  const active = state.active && state.active.weekStart === thisMonday ? state.active : null;
  const def = active ? challengeByKey(active.key) : null;

  const evaluation = useMemo(() => {
    if (!active || !def) return null;
    return avaliarDesafio(def, active.weekStart, gastosDa(active.weekStart), new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, def, expenses, get, perfil]);

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
    toast("Desafios ocultos. Reative quando quiser aqui no Painel.");
  };

  const religar = () => {
    trackEvent("challenge_optin", {});
    setHidden(false);
    toast.success("Desafio da semana de volta no Painel! 🎯");
  };

  /* ------------------------------------------------------------- render */

  if (hidden) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-3.5 py-2.5 flex items-center gap-2.5 text-[12px] text-muted-foreground" data-testid="desafios-desligados">
        <Target className="w-4 h-4 shrink-0" aria-hidden />
        <span className="min-w-0"><b className="text-foreground font-bold">Desafios semanais</b> estão desligados</span>
        <button type="button" onClick={religar} className="ml-auto shrink-0 h-[30px] px-3 rounded-lg bg-foreground text-background text-[12px] font-bold whitespace-nowrap active:scale-[0.98] transition-transform">
          Ligar de novo
        </button>
      </div>
    );
  }

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
        {/* No computador os quatro desafios cabem em duas colunas: quatro
            linhas de 1.200 px com 30 caracteres cada é o que sobra de uma tela
            desenhada pro celular (web/PC, 11/09). */}
        <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-2">
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
