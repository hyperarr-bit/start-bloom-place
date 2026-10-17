import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Target, ChevronRight, RotateCcw, X, Check } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { avisarEscritaDeFora, usePersistedState } from "@/hooks/use-persisted-state";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { PERFIL_PESSOAL } from "@/lib/finance-perfil";
import { desafiosRodizioLigado } from "@/lib/desafios-rodizio";
import {
  CHALLENGES, challengeByKey, mondayOf, avaliarDesafio, gastosParaDesafio, lerDesafios,
  EMPTY_CHALLENGES, type ChallengesState, type OfertaDaSemana, type RegistroDesafio,
} from "./challenges";
import { type Avaliacao, avaliarNoCatalogo, defDoCatalogo, montarDados } from "./catalogo";
import { escolher, fecharSemana, montarOfertas, ofertasVisiveis } from "./rodizio";

const CHAVE = "finance-challenges";

interface Props {
  /** Gastos variáveis (finance-expenses) — a fonte de avaliação da semana. */
  expenses: any[];
  /** Só a página /dev/desafios: fixa o "agora" pra fotografar qualquer dia da semana. */
  agoraDev?: Date;
}

const diaLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Card "Desafio da semana" do Dashboard.
 * Sem desafio ativo → as opções pra escolher. Ativo → progresso vivo.
 * Vitória entra no histórico na hora (alimenta as insígnias de desafio);
 * semana virou sem cumprir → derrota registrada e opções de novo.
 *
 * RODÍZIO (17/10, lib/desafios-rodizio + ./rodizio): com a chave ligada, toda
 * segunda o card monta 4 opções (variação/revanche do da semana passada +
 * novas elegíveis, calendário na frente), grava em `ofertas` como escrita de
 * SISTEMA (não é gesto da pessoa: não conta como lançamento nem como dia
 * anotado); cada desafio vence pela própria regra (o dono tirou o mínimo de
 * dias anotados em 17/10: "é pra ser divertido"). Com a chave desligada, o
 * card de sempre (CHALLENGES). O `active` sem `nivel` — escolhido pelo app
 * antigo — segue a regra antiga até fechar.
 */
export const WeeklyChallenge = ({ expenses, agoraDev }: Props) => {
  const [state, setState] = usePersistedState<ChallengesState>(CHAVE, EMPTY_CHALLENGES);
  /* Opt-out: quem não curte a mecânica esconde de vez. Religa AQUI mesmo (27/09):
     a linha tracejada fica no lugar onde o card estava — quem escondeu ali
     reencontra ali. (Lida pelo store, não por snapshot: o adesivo "Desafiante"
     em Conquistas também religa, e o card tem que voltar na hora.) */
  const { get, set, loaded } = useUserData();
  const hidden = get<unknown>("finance-challenges-hidden", false) === true;
  const setHidden = (v: boolean) => set("finance-challenges-hidden", v);
  const perfil = get<string>("finance-perfil-ativo", PERFIL_PESSOAL) || PERFIL_PESSOAL;
  const rodizio = desafiosRodizioLigado();
  const agora = () => agoraDev ?? new Date();
  const thisMonday = mondayOf(agora());
  const ler = (chave: string) => get<unknown>(chave, undefined);
  /* Gastos da semana do desafio e das anteriores em TODOS os baldes (29/09): a
     semana que cruza o mês tem metade no arquivo do mês passado. */
  const dadosDa = (weekStart: string, meta: Record<string, unknown> = {}) => montarDados({ ler, weekStart, perfil, hoje: agora(), extras: expenses, meta });

  // O estado como o rodízio lê (campos novos só bem formados). O `state` cru
  // continua sendo a base de toda gravação, pra nada que outra versão gravou se perder.
  const estado = useMemo(() => lerDesafios(state), [state]);
  const base = (state && typeof state === "object" && !Array.isArray(state) ? state : {}) as Record<string, unknown>;
  const gravar = (patch: Partial<ChallengesState>) => setState({ ...base, ...estado, ...patch } as ChallengesState);

  const anunciarFechamento = (r: RegistroDesafio, origem: string) => {
    trackEvent(r.result === "win" ? "challenge_won" : "challenge_lost", { challenge: r.key, origem });
    trackEvent("desafio_fechado", { key: r.key, venceu: r.result === "win", motivo: r.motivo ?? (r.result === "win" ? "cumpriu" : "nao-cumpriu"), nivel: r.nivel ?? null, origem });
  };

  // Fecha a semana antiga AVALIANDO os 7 dias (29/09) — antes marcava derrota
  // sem olhar a semana, e quem cumpria sem abrir o Painel no domingo perdia.
  // O mesmo fechamento roda na abertura do app (hooks/use-fechamento-desafio);
  // os dois chegam ao mesmo resultado, e o repetido não entra duas vezes.
  useEffect(() => {
    if (!loaded) return;
    const fechado = fecharSemana(state, dadosDa, agora());
    if (!fechado) return;
    setState({ ...base, ...fechado.estado } as ChallengesState);
    if (fechado.registro) anunciarFechamento(fechado.registro, "card");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, thisMonday, setState, loaded]);

  const active = estado.active && estado.active.weekStart === thisMonday ? estado.active : null;
  // Semana passada ainda por fechar (o efeito acima grava no próximo render): as
  // ofertas esperam, senão nascem sem o resultado dela — sem variação/revanche e
  // com a chave da semana passada podendo repetir.
  const fechamentoPendente = !!estado.active && estado.active.weekStart < thisMonday;
  const defNovo = active?.nivel ? defDoCatalogo(active.key) : null;
  const defLegado = active && !defNovo ? challengeByKey(active.key) : null;
  const ativoConhecido = !!(defNovo || defLegado);

  // Os dados desta semana (títulos com número, elegibilidade, retrato da escolha).
  const dadosDaSemana = useMemo(() => dadosDa(thisMonday), [expenses, get, perfil, thisMonday]); // eslint-disable-line react-hooks/exhaustive-deps

  // As 4 opções da segunda: calculadas de forma estável pela semente da semana,
  // e gravadas uma vez (escrita de sistema + aviso pro snapshot deste card).
  const ofertasDaSemana = useMemo(
    () => (estado.ofertas?.weekStart === thisMonday ? estado.ofertas : montarOfertas(dadosDaSemana, estado)),
    [estado, thisMonday, dadosDaSemana],
  );
  const ofertasGravadasPara = useRef<string | null>(null);
  useEffect(() => {
    if (!loaded || hidden || !rodizio || fechamentoPendente || (active && ativoConhecido)) return;
    if (estado.ofertas?.weekStart === thisMonday || ofertasGravadasPara.current === thisMonday) return;
    ofertasGravadasPara.current = thisMonday;
    const novo = { ...base, ...estado, ofertas: ofertasDaSemana } as ChallengesState;
    set(CHAVE, novo, { system: true });
    avisarEscritaDeFora(CHAVE, novo);
    trackEvent("desafio_ofertas", { keys: ofertasDaSemana.itens.map((i) => i.key), niveis: ofertasDaSemana.itens.map((i) => i.nivel), weekStart: thisMonday });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, hidden, rodizio, fechamentoPendente, active, ativoConhecido, estado.ofertas?.weekStart, thisMonday, ofertasDaSemana]);

  const evaluation: Avaliacao | null = useMemo(() => {
    if (!active) return null;
    if (defNovo && active.nivel) return avaliarNoCatalogo(defNovo, active.nivel, dadosDa(active.weekStart, active.meta ?? {}));
    if (defLegado) return avaliarDesafio(defLegado, active.weekStart, gastosParaDesafio(ler, active.weekStart, perfil, expenses), agora());
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, defNovo, defLegado, expenses, get, perfil]);

  // Vitória vira histórico imediatamente (dedupe por semana+key) — alimenta
  // as insígnias de desafio sem esperar a semana acabar.
  useEffect(() => {
    if (!active || !evaluation?.done) return;
    const already = estado.history.some((h) => h.weekStart === active.weekStart && h.key === active.key && h.result === "win");
    if (already) return;
    const registro: RegistroDesafio = { key: active.key, weekStart: active.weekStart, result: "win" };
    if (active.nivel) { registro.nivel = active.nivel; registro.motivo = "cumpriu"; }
    gravar({ history: [...estado.history, registro] });
    anunciarFechamento(registro, "card");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, evaluation?.done, estado, setState]);

  const escolherOferta = (o: OfertaDaSemana) => {
    trackEvent("challenge_start", { challenge: o.key });
    trackEvent("desafio_escolhido", { key: o.key, nivel: o.nivel, origem: o.origem ?? "nova" });
    gravar({ active: escolher(o, dadosDaSemana), ofertas: ofertasDaSemana });
  };

  const escolherLegado = (key: string) => {
    trackEvent("challenge_start", { challenge: key });
    gravar({ active: { key, weekStart: thisMonday } });
  };

  /* Depois de vencer ou perder: libera pra escolher outro. A derrota entra no
     histórico aqui mesmo (com o motivo), pra chave descansar e a revanche valer. */
  const escolherOutro = () => {
    if (!active) return;
    let history = estado.history;
    if (evaluation?.failed && !history.some((h) => h.weekStart === active.weekStart && h.key === active.key)) {
      const registro: RegistroDesafio = { key: active.key, weekStart: active.weekStart, result: "loss" };
      if (active.nivel) { registro.nivel = active.nivel; registro.motivo = evaluation.motivo ?? "nao-cumpriu"; }
      history = [...history, registro];
      anunciarFechamento(registro, "card");
    }
    gravar({ active: null, history });
  };

  /* Botão de confirmação do desafio ("Revisei, todas valem"): gesto da pessoa, gravado no retrato. */
  const confirmar = () => {
    if (!active || !defNovo?.confirmacao) return;
    trackEvent("desafio_confirmado", { key: active.key, nivel: active.nivel ?? null });
    gravar({ active: { ...active, meta: { ...(active.meta ?? {}), [defNovo.confirmacao.chave]: diaLocal(agora()) } } });
  };

  const wins = estado.history.filter((h) => h.result === "win").length;

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
      <div className="rounded-xl border border-dashed border-border bg-card px-3.5 py-2.5 flex items-center gap-2.5 text-[12px] text-muted-foreground" data-testid="desafios-desligados" data-track-bloco="desafio-semana">
        <Target className="w-4 h-4 shrink-0" aria-hidden />
        <span className="min-w-0"><b className="text-foreground font-bold">Desafios semanais</b> estão desligados</span>
        <button type="button" onClick={religar} className="ml-auto shrink-0 h-[30px] px-3 rounded-lg bg-foreground text-background text-[12px] font-bold whitespace-nowrap active:scale-[0.98] transition-transform">
          Ligar de novo
        </button>
      </div>
    );
  }

  const cabecalho = (
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
  );

  if (!active || !ativoConhecido || !evaluation) {
    const opcaoClasse = "w-full flex items-center gap-3 rounded-xl border border-border bg-background p-3 text-left hover:border-accent/50 active:scale-[0.99] transition-all";
    if (!rodizio) {
      return (
        <div className="bg-card rounded-lg border border-border p-4">
          {cabecalho}
          {/* No computador os quatro desafios cabem em duas colunas: quatro
              linhas de 1.200 px com 30 caracteres cada é o que sobra de uma tela
              desenhada pro celular (web/PC, 11/09). */}
          <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-2">
            {CHALLENGES.map((c) => (
              <button key={c.key} onClick={() => escolherLegado(c.key)} className={opcaoClasse} data-track={`desafio-escolher:${c.key}`}>
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

    const abertas = ofertasVisiveis({ ...estado, ofertas: ofertasDaSemana }, thisMonday);
    const etiqueta = (o: OfertaDaSemana) => (o.origem === "variacao" ? `nível ${o.nivel}` : o.origem === "revanche" ? "revanche" : null);
    return (
      <div className="bg-card rounded-lg border border-border p-4" data-testid="desafio-ofertas" data-track-bloco="desafio-semana">
        {cabecalho}
        {abertas.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Você fechou os desafios desta semana. Segunda tem mais. 🎯</p>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground -mt-1.5 mb-2.5">
              {abertas.length > 1 ? `Escolhe 1 das ${abertas.length} pra esta semana` : "Escolhe pra esta semana"} · opções novas toda segunda
            </p>
            {/* No computador as quatro cabem em duas colunas, como o card de sempre (web/PC, 11/09). */}
            <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-2">
              {abertas.map((o) => {
                const def = defDoCatalogo(o.key);
                if (!def) return null;
                const tag = etiqueta(o);
                return (
                  <button key={o.key} onClick={() => escolherOferta(o)} className={opcaoClasse} data-testid={`oferta-${o.key}`} data-track={`desafio-escolher:${o.key}`}>
                    <span className="text-xl shrink-0">{def.emoji}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-bold leading-tight">
                        {def.titulo(o.nivel, dadosDaSemana)}
                        {tag && <span className="ml-1.5 align-middle inline-block rounded-md bg-accent/15 text-accent text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-[1px]">{tag}</span>}
                      </span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5">{def.desc(o.nivel, dadosDaSemana)}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  const ev = evaluation;
  const titulo = defNovo ? defNovo.titulo(active.nivel ?? 1, dadosDaSemana) : defLegado!.title;
  const emoji = defNovo ? defNovo.emoji : defLegado!.emoji;
  const stateColor = ev.done ? "text-emerald-500" : ev.failed ? "text-muted-foreground" : "text-accent";
  const confirmacao = defNovo?.confirmacao && !ev.done && !ev.failed ? defNovo.confirmacao : null;

  return (
    <div className={`bg-card rounded-lg border p-4 ${ev.done ? "border-emerald-500/40" : "border-border"}`} data-testid="desafio-ativo" data-track-bloco="desafio-semana">
      {cabecalho}

      <div className="flex items-center gap-3">
        <motion.span
          key={ev.done ? "won" : "going"}
          initial={{ scale: 0.6 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 12 }}
          className="grid place-items-center w-11 h-11 rounded-xl bg-secondary text-2xl shrink-0"
        >
          {ev.done ? "🏆" : emoji}
        </motion.span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">{ev.done ? "Desafio cumprido!" : titulo}</p>
          <p className={`text-[11.5px] mt-0.5 ${stateColor}`} data-testid="desafio-status">{ev.statusText}</p>
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

      {confirmacao && (
        <button
          type="button"
          onClick={confirmar}
          className="mt-3 inline-flex items-center gap-1.5 h-[30px] px-3 rounded-lg bg-foreground text-background text-[12px] font-bold active:scale-[0.98] transition-transform"
        >
          <Check className="w-3.5 h-3.5" /> {confirmacao.botao}
        </button>
      )}

      {(ev.failed || ev.done) && (
        <button
          onClick={escolherOutro}
          className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> Escolher outro desafio
        </button>
      )}
    </div>
  );
};
