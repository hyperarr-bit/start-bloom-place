import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Bell, ChevronRight, Share2, Shield, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { trackEvent } from "@/lib/analytics";
import { normalizarDias, somarDias } from "@/lib/sequencia";
import { ROTULOS_DA_SEMANA, segundaDaSemana, semanaDaSequencia, type DiaDaSemana, type EstadoDia } from "@/lib/sequencia-semana";
import { RARIDADE_LABEL, raridadeDe, type Badge } from "@/components/gamification/types";
import { rotuloProgresso } from "@/lib/conquistas-registro";
import { AdesivoRaro } from "../adesivos-raridade";
import { giroDoAdesivo } from "../adesivos-arte";
import { Fogo } from "../Fogo";
import { varsDaFaixa } from "../CardSequencia";
import { LembreteDaSequencia } from "../LembreteDaSequencia";
import type { Sequencia } from "../use-conquistas";
import { EVENTOS2, ehMarcoDeFesta, marcoDoAdesivo, podeCompartilhar } from "./recompensas";
import { resumoRaridadesCurto, type ColecaoNova, type EstadoConquistasNova } from "./use-conquistas-nova";
import "../conquistas.css";
import "./conquistas-nova.css";

/**
 * As CAMADAS da Conquistas 2 (16/10): o toast do adesivo comum/raro, a festa
 * do marco (7/30/100), o detalhe da sequência (4 semanas, protetores, próximos
 * prêmios, lembrete) e a coleção inteira em grade ("ver todos", secundária).
 */

/* ------------------------------------------------------------------ toast */

export interface PropsToast {
  badge: Badge;
  /** Vários no mesmo dia viram um toast só ("3 adesivos novos"). */
  quantidade?: number;
  colecao?: string;
  /** No teste grátis com a Missão valendo: "Seu adesivo está esperando no álbum" — mais baixo, sem festa. */
  suave?: boolean;
  onToque?: () => void;
}

/** O aviso pequeno do adesivo comum/raro (3,5 s, por cima de qualquer tela; o toque abre o álbum na página dele). */
export const ToastAdesivo = ({ badge, quantidade = 1, colecao, suave, onToque }: PropsToast) => {
  const r = raridadeDe(badge);
  useEffect(() => { trackEvent(EVENTOS2.toastView, { id: badge.id, raridade: r, quantidade, suave: !!suave }); }, [badge.id, r, quantidade, suave]);
  return (
    <button type="button" className="cn-toast" data-rar={r} data-suave={suave ? "" : undefined} data-testid="cn-toast" data-quantidade={quantidade} onClick={() => { trackEvent(EVENTOS2.toastToque, { id: badge.id, quantidade, suave: !!suave }); onToque?.(); }}>
      <span className="shrink-0 grid place-items-center w-12 h-12"><AdesivoRaro id={badge.id} raridade={r} tamanho={46} giro={-5} /></span>
      <span className="flex-1 min-w-0">
        <span className="cn-toast-eyebrow block">{quantidade > 1 ? `${quantidade} adesivos novos` : r === "comum" ? "Adesivo novo" : `Adesivo ${RARIDADE_LABEL[r].toLowerCase()}`}</span>
        <span className="cn-toast-nome block truncate">{quantidade > 1 ? `${badge.name} e mais ${quantidade - 1}` : badge.name}</span>
        <span className="cn-toast-sub block truncate">{colecao ? `${colecao} · ` : ""}toque pra colar no álbum</span>
      </span>
      <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="cn-toast-barra" aria-hidden />
    </button>
  );
};

/* ------------------------------------------------------------------ a festa do marco */

const CORES_CONFETE = ["#d22d80", "#F5B301", "#4F8BFF", "#22c55e", "#fb923c", "#8b5cf6"];

/** A festa do MARCO (7/30/100 dias): a única tela cheia que sobra — com o adesivo do marco e os Stories. */
export const CelebracaoMarco = ({ badge, dias, seq, onContinuar, onCompartilhar }: { badge: Badge; dias: number; seq: Sequencia; onContinuar: () => void; onCompartilhar?: () => unknown }) => {
  useEffect(() => { trackEvent(EVENTOS2.marcoView, { dias }); }, [dias]);
  const confetes = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ x: 3 + ((i * 53) % 94), w: 6 + (i % 3) * 2.5, cor: CORES_CONFETE[i % CORES_CONFETE.length], atraso: 0.3 + (i % 6) * 0.09, dur: 2.2 + (i % 4) * 0.3, giro: (i % 2 ? 1 : -1) * (160 + ((i * 37) % 180)) })), []);
  return (
    <div className="cn-festa" role="dialog" aria-modal="true" aria-label={`${dias} dias seguidos`} data-testid="cn-festa" data-momento="" style={varsDaFaixa(seq.faixa)}>
      <div aria-hidden className="absolute inset-0 pointer-events-none cn-pontilhado" />
      <div aria-hidden className="cn-festa-raios" />
      {confetes.map((c, i) => <span key={i} aria-hidden className="cn-confete" style={{ left: `${c.x}%`, width: c.w, height: c.w * 1.7, background: c.cor, "--atraso": `${c.atraso}s`, "--dur": `${c.dur}s`, "--giro": `${c.giro}deg` } as CSSProperties} />)}
      <div className="relative flex-1 flex flex-col items-center justify-center px-8 text-center">
        <p className="cn-caps mb-5" style={{ color: "#fde68a" }}>Sequência</p>
        <div style={{ transform: "rotate(-5deg)" }}>
          <AdesivoRaro id={badge.id} raridade={raridadeDe(badge)} tamanho={200} bordaGrossa titulo={badge.name} />
        </div>
        <h2 className="mt-7 text-[32px] font-black tracking-tight leading-[1.05]">{dias} dias seguidos!</h2>
        <p className="cn-serif mt-1.5 text-[23px] text-white/75">Constância tem prêmio.</p>
        {dias % 7 === 0 && <span className="cn-festa-chip mt-5"><Shield className="w-3.5 h-3.5" /> +1 protetor guardado</span>}
      </div>
      <div className="relative w-full max-w-md mx-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-2.5">
        {podeCompartilhar(badge) && onCompartilhar && (
          <button type="button" className="cn-btn cn-btn-1" onClick={() => { trackEvent(EVENTOS2.marcoShare, { dias }); void onCompartilhar(); }} data-testid="cn-festa-stories">
            <Share2 className="w-4 h-4" /> Postar nos Stories
          </button>
        )}
        <button type="button" className="cn-btn cn-btn-2" onClick={onContinuar} data-testid="cn-festa-continuar">Continuar</button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ o detalhe da sequência */

const R = 86, C = 98, FOLGA = 10;
const TOTAL = 2 * Math.PI * R;
const ARCO = TOTAL / 7 - FOLGA;

/** O ANEL DE 7 ARCOS da semana (direção B), com o fogo e o número no centro — agora só no detalhe (17/10). */
export const AnelDaSemana = ({ seq }: { seq: Sequencia }) => {
  const semana = useMemo(() => semanaDaSequencia(seq.lista, seq.usados, seq.hoje), [seq.lista, seq.usados, seq.hoje]);
  const hojeIdx = semana.findIndex((d) => d.estado === "hoje");
  const semHoje: DiaDaSemana[] = semana.map((d) => (d.estado === "hoje" ? { ...d, estado: "futuro" as EstadoDia } : d));
  const ini = (i: number) => (i * (ARCO + FOLGA) + FOLGA / 2) / TOTAL * Math.PI * 2;
  const a0 = ini(Math.max(0, hojeIdx)), a1 = a0 + (ARCO / TOTAL) * Math.PI * 2;
  const p = (a: number) => `${(C + Math.cos(a) * R).toFixed(2)} ${(C + Math.sin(a) * R).toFixed(2)}`;
  return (
    <div className="cn-b-anel" data-testid="cn-anel">
      <svg viewBox="0 0 196 196" aria-hidden>
        {semHoje.map((d, i) => (
          <circle key={d.dia} className="cn-b-seg" data-estado={d.estado} cx={C} cy={C} r={R} strokeDasharray={`${ARCO} ${TOTAL - ARCO}`} strokeDashoffset={-(i * (ARCO + FOLGA) + FOLGA / 2)} />
        ))}
        {/* o arco de "hoje" tracejado precisa do próprio recorte: um arco só, tracejado, no lugar dele */}
        {hojeIdx >= 0 && <path className="cn-b-seg" data-estado="hoje" d={`M ${p(a0)} A ${R} ${R} 0 0 1 ${p(a1)}`} />}
      </svg>
      <div className="cn-b-centro">
        <Fogo dias={seq.dias} faixa={seq.dias > 0 ? seq.faixa : undefined} tamanho={44} viva={seq.dias > 0} />
        <span className="cn-b-num">{seq.dias}</span>
        <span className="cn-b-rot">{seq.dias === 1 ? "DIA SEGUIDO" : "DIAS SEGUIDOS"}</span>
      </div>
    </div>
  );
};

const Calendario28 = ({ seq }: { seq: Sequencia }) => {
  const anotados = useMemo(() => new Set(normalizarDias(seq.lista)), [seq.lista]);
  const protegidos = useMemo(() => new Set(seq.usados), [seq.usados]);
  const inicio = somarDias(segundaDaSemana(seq.hoje), -21);
  const dias = Array.from({ length: 28 }, (_, i) => somarDias(inicio, i));
  const estado = (d: string): EstadoDia => (anotados.has(d) ? "feito" : protegidos.has(d) ? "gelo" : d === seq.hoje ? "hoje" : d > seq.hoje ? "futuro" : "vazio");
  return (
    <div>
      <div className="cn-cal mb-1">
        {ROTULOS_DA_SEMANA.map((r) => <span key={r} className="text-center text-[9px] font-extrabold text-muted-foreground">{r.charAt(0)}</span>)}
      </div>
      <div className="cn-cal" data-testid="cn-calendario">
        {dias.map((d) => <span key={d} className="cn-cal-dia" data-estado={estado(d)}>{Number(d.slice(8, 10))}</span>)}
      </div>
    </div>
  );
};

export const DetalheSequencia = ({ e, aberto, onFechar, onAdesivo }: { e: EstadoConquistasNova; aberto: boolean; onFechar: () => void; onAdesivo: (b: Badge) => void }) => {
  const { seq, trilha } = e;
  const proximos = trilha.filter((b) => !b.unlocked).slice(0, 3);
  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[92dvh] overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom))]" data-testid="cn-detalhe-sequencia">
        <div className="max-w-sm mx-auto pt-1" style={varsDaFaixa(seq.faixa)}>
          <AnelDaSemana seq={seq} />
          <div className="text-center mt-2">
            <SheetTitle className="text-[16px] font-black tracking-tight leading-none">{seq.dias} {seq.dias === 1 ? "dia seguido" : "dias seguidos"}</SheetTitle>
            <SheetDescription className="text-[12px] text-muted-foreground mt-1">{seq.faixa.nome} · recorde {seq.recorde} · {seq.lista.length} dias anotados</SheetDescription>
          </div>
          <div className="mt-4 rounded-2xl border border-border p-3">
            <p className="cn-caps text-muted-foreground mb-2">Últimas 4 semanas</p>
            <Calendario28 seq={seq} />
          </div>
          <div className="mt-3 rounded-2xl border border-border p-3 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl grid place-items-center bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"><Shield className="w-5 h-5" /></span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-extrabold leading-tight">{seq.saldo} de 2 protetores</p>
              <p className="text-[11.5px] text-muted-foreground leading-[1.35]">A cada 7 dias seguidos você ganha 1. Um dia vazio? Ele segura sozinho a sequência.</p>
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-border px-3 py-1">
            <p className="cn-caps text-muted-foreground pt-2 pb-1">Próximos adesivos</p>
            {proximos.map((b) => {
              const m = marcoDoAdesivo(b.id)!;
              const faltam = Math.max(1, m - seq.dias);
              return (
                <button type="button" key={b.id} className="cn-premio-linha w-full text-left" onClick={() => onAdesivo(b)}>
                  <AdesivoRaro id={b.id} raridade={raridadeDe(b)} tamanho={40} trancado />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-extrabold leading-tight">{b.name}{m % 7 === 0 ? <span className="text-muted-foreground font-bold text-[11px]"> e mais 1 protetor</span> : ""}</p>
                    <p className="text-[11px] text-muted-foreground">adesivo {RARIDADE_LABEL[raridadeDe(b)].toLowerCase()}{ehMarcoDeFesta(b.id) ? " · com comemoração e Stories" : ""}</p>
                  </div>
                  <span className="cn-pill cn-pill-suave">{faltam === 1 ? "amanhã" : `em ${faltam} dias`}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11.5px] text-muted-foreground leading-[1.4]">
            <b className="text-foreground">O que conta:</b> anotar qualquer coisa, em qualquer módulo — um gasto, um hábito, a água, uma página lida. Só abrir o app não conta.
          </p>
          {/* o lembrete das 20h de sempre (opt-in, mesmo id de notificação); só no app */}
          <div onClickCapture={() => trackEvent(EVENTOS2.lembreteLigar, {})} data-testid="cn-lembrete">
            <LembreteDaSequencia />
          </div>
          <p className="mt-2 text-[10.5px] text-muted-foreground inline-flex items-center gap-1"><Bell className="w-3 h-3" aria-hidden /> O lembrete avisa qual adesivo vem amanhã.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

/* ------------------------------------------------------------------ a coleção inteira (ver todos, secundária) */

export const ColecaoTela = ({ e, inicial, onFechar, onAdesivo }: { e: EstadoConquistasNova; inicial: ColecaoNova | null; onFechar: () => void; onAdesivo: (b: Badge) => void }) => {
  const [filtro, setFiltro] = useState<string>(inicial?.id ?? "todas");
  const secoes = filtro === "todas" ? e.colecoes : e.colecoes.filter((c) => c.id === filtro);
  return (
    <div className="cn-tela" role="dialog" aria-modal="true" aria-label="Todos os adesivos" data-testid="cn-colecao-tela">
      <div className="cn-tela-cab">
        <button type="button" onClick={onFechar} aria-label="Fechar" className="w-9 h-9 rounded-full grid place-items-center bg-muted"><X className="w-5 h-5" /></button>
        <div className="min-w-0">
          <h2 className="text-[15px] font-extrabold tracking-tight leading-none">TODOS OS ADESIVOS</h2>
          <p className="text-[11px] text-muted-foreground mt-1">{e.abertos} de {e.total} · {resumoRaridadesCurto(e.adesivos)}</p>
        </div>
      </div>
      <div className="cn-b-chips pt-3">
        <button type="button" className="cn-b-chip" data-ativo={filtro === "todas" ? "" : undefined} onClick={() => setFiltro("todas")}>Todas</button>
        {e.colecoes.map((x) => (
          <button key={x.id} type="button" className="cn-b-chip" data-ativo={filtro === x.id ? "" : undefined} onClick={() => setFiltro(x.id)}><span aria-hidden>{x.emoji}</span> {x.label} <span className="n">{x.abertos}/{x.total}</span></button>
        ))}
      </div>
      <div className="px-3 pb-10 space-y-3">
        {secoes.map((c) => (
          <section key={c.id} className="cn-card cn-pontilhado" aria-label={c.label}>
            <div className="h-10 px-3.5 flex items-center gap-2 border-b border-border/70">
              <span aria-hidden>{c.emoji}</span>
              <h3 className="cn-serif text-[19px] leading-none">{c.label}</h3>
              <span className="text-[11px] font-bold text-muted-foreground tabular-nums">{c.abertos} de {c.total}</span>
              <span className={`ml-auto cn-pill ${c.total - c.abertos <= 3 ? "cn-pill-acento" : "cn-pill-suave"}`}>{c.frase}</span>
            </div>
            <div className="cn-grade4 px-2 pt-3 pb-2">
              {c.adesivos.map((b, i) => (
                <button key={b.id} type="button" className="cn-celula" onClick={() => onAdesivo(b)} data-aberto={b.unlocked ? "true" : "false"}>
                  <span className="relative grid place-items-center w-[70px] h-[70px]">
                    <AdesivoRaro id={b.id} raridade={raridadeDe(b)} tamanho={64} trancado={!b.unlocked} giro={b.unlocked ? giroDoAdesivo(i) : 0} />
                    {!b.unlocked && rotuloProgresso(b) && <span className="cn-prog">{rotuloProgresso(b)}</span>}
                  </span>
                  <span className={`cn-celula-nome ${b.unlocked ? "text-foreground" : "text-muted-foreground"}`}>{b.name}</span>
                  {!b.unlocked && raridadeDe(b) !== "comum" && <span className="chip-rar" data-rar={raridadeDe(b)} style={{ height: 14, fontSize: 7.5 }}>{RARIDADE_LABEL[raridadeDe(b)]}</span>}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
