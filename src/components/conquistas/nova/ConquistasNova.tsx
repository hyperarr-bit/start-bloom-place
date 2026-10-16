import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Check, ChevronRight, Share2, Shield, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { trackEvent } from "@/lib/analytics";
import { localDayKey, mesAtualExtenso, parseLocalDay } from "@/lib/utils";
import { normalizarDias, somarDias } from "@/lib/sequencia";
import { ROTULOS_DA_SEMANA, segundaDaSemana, semanaDaSequencia, type DiaDaSemana, type EstadoDia } from "@/lib/sequencia-semana";
import { RARIDADE_LABEL, raridadeDe, type Badge } from "@/components/gamification/types";
import { rotuloProgresso } from "@/lib/conquistas-registro";
import { AdesivoRaro } from "../adesivos-raridade";
import { giroDoAdesivo } from "../adesivos-arte";
import { Fogo } from "../Fogo";
import { varsDaFaixa } from "../CardSequencia";
import type { Sequencia } from "../use-conquistas";
import { EVENTOS2, ehMarcoDeFesta, marcoDoAdesivo, podeCompartilhar, type ProximoPremio } from "./recompensas";
import { resumoRaridadesCurto, useConquistasNova, type ColecaoNova, type EstadoConquistasNova } from "./use-conquistas-nova";
import "../conquistas.css";
import "./conquistas-nova.css";

/**
 * CONQUISTAS 2 (16/10, protótipo em /dev/conquistas-nova — NÃO ligado no app).
 * Só SEQUÊNCIA + ADESIVOS: sai a capa do planner, as insígnias, o nível, a
 * roseta e o seletor de capas (os arquivos ficam; esta tela não os usa).
 *
 * Três direções de visual na mesma mecânica (`direcao`):
 *  a · "Página de figurinhas": papel, washi, serif — a semana são 7 vagas onde
 *      o dia anotado cola uma chama; a coleção por módulo em fileiras no papel.
 *  b · "Fogo & trilha": o número de dias e o fogo no centro de um anel de 7
 *      arcos (a semana), a TRILHA dos prêmios (hoje → amanhã → 7 → 14 → 30) e a
 *      coleção em grade com os anéis de raridade.
 *  c · "Agenda da semana": a tabela do planner (dia da semana com a sua cor,
 *      quadradinho de marcar), o post-it do prêmio de amanhã e as coleções em
 *      linhas com faixa colorida e barra.
 *
 * O que as 3 têm em comum (a mecânica, ver recompensas.ts): o prêmio de amanhã
 * sempre visível, os adesivos novos de 2/3/14 dias, toast pros comuns e raros,
 * tela cheia só nos marcos de 7/30/100, compartilhar só nos marcos.
 */

export type Direcao = "a" | "b" | "c";

export interface PropsConquistasNova {
  direcao: Direcao;
  /** Dia da missão do teste grátis (1..3) quando a pessoa está no teste; fora dele, null. */
  testeDia?: 1 | 2 | 3 | null;
  /** Protótipo: abre já com uma camada (toast de adesivo comum, festa do marco, coleção, detalhe da sequência). */
  camada?: "toast" | "marco" | "colecao" | "sequencia" | null;
  onVoltar?: () => void;
}

const mesCurto = (d = new Date()) => {
  const m = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${d.getFullYear()}`;
};

/* ------------------------------------------------------------------ cabeçalho */

const Cabecalho = ({ seq, onVoltar }: { seq: Sequencia; onVoltar: () => void }) => (
  <header className="border-b border-border bg-card sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
      <button type="button" onClick={onVoltar} className="hover:bg-muted rounded-md p-1 transition-colors" aria-label="Voltar">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <Fogo dias={seq.dias} faixa={seq.dias > 0 ? seq.faixa : undefined} tamanho={20} semBrilho />
      <h1 className="text-base font-bold tracking-tight">CONQUISTAS</h1>
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          <span className="hidden min-[400px]:inline">{mesAtualExtenso()}</span>
          <span className="min-[400px]:hidden">{mesCurto()}</span>
        </span>
        <ThemeToggle />
      </div>
    </div>
  </header>
);

/* ------------------------------------------------------------------ ação do dia (as 3 usam) */

const AcaoDoDia = ({ seq, escuro, onAcao }: { seq: Sequencia; escuro?: boolean; onAcao: (rota: string) => void }) => {
  const { hojeFeito, dias, acao } = seq;
  if (hojeFeito) {
    return (
      <p className={`text-[12.5px] leading-relaxed ${escuro ? "text-white/80" : "text-muted-foreground"}`} data-testid="cn-garantido">
        <span className="font-bold inline-flex items-center gap-1" style={{ color: escuro ? "#fde68a" : "hsl(var(--success))" }}>
          Hoje já tá garantido <Check className="w-4 h-4" strokeWidth={3} aria-hidden />
        </span>
        {` — ${dias} ${dias === 1 ? "dia seguido" : "dias seguidos"}.`}
      </p>
    );
  }
  return (
    <p className={`text-[12.5px] leading-relaxed ${escuro ? "text-white/80" : "text-muted-foreground"}`} data-testid="cn-acao">
      {dias > 0 ? <>Hoje falta <b className={escuro ? "text-white" : "text-foreground"}>1 coisa</b> pra manter: </> : <>Anote <b className={escuro ? "text-white" : "text-foreground"}>1 coisa</b> hoje pra começar: </>}
      <button type="button" className={escuro ? "cn-b-acao" : "cn-acao"} onClick={() => { trackEvent(EVENTOS2.acaoToque, { acao: acao.id, via: "principal" }); onAcao(acao.rota); }}>
        {acao.texto}
      </button>
    </p>
  );
};

/* ------------------------------------------------------------------ o prêmio de amanhã */

const quandoCurto = (p: ProximoPremio) => (p.quando === "hoje" ? "HOJE" : p.quando === "amanha" ? "AMANHÃ" : `EM ${p.faltam} DIAS`);

const TextoDoPremio = ({ premio, testeDia }: { premio: ProximoPremio; testeDia?: 1 | 2 | 3 | null }) => {
  const b = premio.adesivo;
  const r = b ? raridadeDe(b) : null;
  return (
    <>
      <span className="cn-caps block" style={{ color: "hsl(var(--accent))" }}>{premio.titulo}</span>
      <span className="block text-[16px] font-extrabold leading-tight mt-0.5">
        {b ? b.name : "+1 protetor"}
        {b && premio.daProtetor && <span className="text-muted-foreground font-bold text-[12px]"> + 1 protetor</span>}
      </span>
      <span className="block text-[11.5px] text-muted-foreground leading-[1.35] mt-0.5">
        {r && r !== "comum" ? `adesivo ${RARIDADE_LABEL[r].toLowerCase()} · ` : ""}
        {premio.quando === "hoje" ? "anote 1 coisa hoje e ele cola sozinho" : premio.quando === "amanha" ? "anote 1 coisa amanhã e ele cola sozinho" : `${premio.faltam} dias de anotação, qualquer módulo`}
        {testeDia && premio.marco === 3 ? " · é o 3º dia da sua missão" : ""}
      </span>
    </>
  );
};

/* ------------------------------------------------------------------ A · página de figurinhas */

const HeroA = ({ e, onDetalhe, onAcao }: { e: EstadoConquistasNova; onDetalhe: () => void; onAcao: (rota: string) => void }) => {
  const { seq } = e;
  const semana = useMemo(() => semanaDaSequencia(seq.lista, seq.usados, seq.hoje), [seq.lista, seq.usados, seq.hoje]);
  return (
    <section className="cn-card relative px-4 pt-5 pb-4" style={varsDaFaixa(seq.faixa)} aria-label="Sequência" data-testid="cn-hero">
      <span className="cn-washi" aria-hidden />
      <div className="cn-a-semana" role="list" aria-label="Semana">
        {semana.map((d, i) => (
          <div key={d.dia} className="cn-a-dia" role="listitem">
            <span className="cn-a-rot">{d.rotulo}</span>
            <span className="cn-a-vaga" data-estado={d.estado} style={{ "--giro": `${giroDoAdesivo(i)}deg` } as CSSProperties}>
              {d.estado === "feito" && <Fogo faixa={seq.faixa} tamanho={24} semBrilho />}
              {d.estado === "gelo" && <Shield className="w-4 h-4" strokeWidth={2.4} />}
              {d.estado === "hoje" && <span className="cn-a-hoje-txt">HOJE</span>}
            </span>
          </div>
        ))}
      </div>
      <button type="button" onClick={onDetalhe} className="mt-4 w-full flex items-end gap-2 text-left" data-testid="cn-abrir-sequencia">
        <Fogo dias={seq.dias} faixa={seq.dias > 0 ? seq.faixa : undefined} tamanho={40} viva={seq.dias > 0} />
        <span className="cn-a-numero">{seq.dias}</span>
        <span className="cn-serif text-[24px] leading-none pb-1 text-foreground/85">{seq.dias === 1 ? "dia seguido" : "dias seguidos"}</span>
        <span className="ml-auto pb-1 inline-flex items-center gap-1 text-[11.5px] font-bold text-muted-foreground whitespace-nowrap">
          <Shield className="w-3.5 h-3.5" aria-hidden /> {seq.saldo} {seq.saldo === 1 ? "protetor" : "protetores"} <ChevronRight className="w-3.5 h-3.5" aria-hidden />
        </span>
      </button>
      <div className="mt-2.5">
        <AcaoDoDia seq={seq} onAcao={onAcao} />
      </div>
    </section>
  );
};

const AmanhaA = ({ e, testeDia }: { e: EstadoConquistasNova; testeDia?: 1 | 2 | 3 | null }) => {
  const b = e.premio.adesivo;
  return (
    <section className="cn-card flex items-center gap-3.5 px-4 py-3.5 cn-pontilhado" aria-label="Próximo prêmio" data-testid="cn-amanha">
      <span className="relative shrink-0 grid place-items-center w-[66px] h-[66px]">
        {b ? <AdesivoRaro id={b.id} raridade={raridadeDe(b)} tamanho={60} trancado /> : <span className="w-14 h-14 rounded-full grid place-items-center bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"><Shield className="w-7 h-7" /></span>}
        <span className="cn-pill cn-pill-tinta absolute -bottom-1 left-1/2 -translate-x-1/2">{quandoCurto(e.premio)}</span>
      </span>
      <span className="flex-1 min-w-0"><TextoDoPremio premio={e.premio} testeDia={testeDia} /></span>
    </section>
  );
};

const ColecaoA = ({ e, onColecao, onAdesivo }: { e: EstadoConquistasNova; onColecao: (c: ColecaoNova | null) => void; onAdesivo: (b: Badge) => void }) => (
  <section className="cn-card cn-pontilhado" aria-labelledby="cn-titulo-adesivos" data-testid="cn-colecao">
    <div className="h-11 px-4 flex items-center gap-2 border-b border-border/70">
      <h2 id="cn-titulo-adesivos" className="text-[13px] font-extrabold tracking-wide">MEUS ADESIVOS</h2>
      <span className="ml-auto text-[12.5px] font-bold tabular-nums">{e.abertos} de {e.total}</span>
    </div>
    <div className="divide-y divide-border/60">
      {e.colecoes.map((c) => {
        const colados = c.adesivos.filter((b) => b.unlocked);
        const faltando = c.adesivos.filter((b) => !b.unlocked);
        const mostrar = [...colados.slice(0, Math.min(3, colados.length)), ...faltando.slice(0, 5 - Math.min(3, colados.length))].slice(0, 5);
        return (
          <div key={c.id} className="px-3 pt-2.5 pb-2">
            <button type="button" onClick={() => onColecao(c)} className="w-full flex items-baseline gap-2 text-left" data-testid={`cn-colecao-${c.id}`}>
              <span className="cn-serif cn-a-colecao-rotulo"><span className="not-italic text-[15px] mr-1" aria-hidden>{c.emoji}</span>{c.label}</span>
              <span className="text-[11px] font-bold text-muted-foreground">{c.abertos}/{c.total}</span>
              {c.total - c.abertos <= 3 ? <span className="ml-auto cn-pill cn-pill-acento">{c.frase}</span> : <ChevronRight className="ml-auto w-4 h-4 text-muted-foreground self-center" aria-hidden />}
            </button>
            <div className="cn-a-fileira mt-1.5">
              {mostrar.map((b, i) => (
                <button key={b.id} type="button" className="cn-a-slot" onClick={() => onAdesivo(b)} aria-label={b.name} data-aberto={b.unlocked ? "true" : "false"}>
                  <AdesivoRaro id={b.id} raridade={raridadeDe(b)} tamanho={54} trancado={!b.unlocked} giro={b.unlocked ? giroDoAdesivo(i) : 0} />
                  {!b.unlocked && rotuloProgresso(b) && <span className="cn-prog">{rotuloProgresso(b)}</span>}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
    <button type="button" onClick={() => onColecao(null)} className="w-full h-10 text-[12px] font-bold text-muted-foreground inline-flex items-center justify-center gap-1 border-t border-border/60">
      Ver a coleção inteira <ChevronRight className="w-3.5 h-3.5" aria-hidden />
    </button>
  </section>
);

/* ------------------------------------------------------------------ B · fogo & trilha */

const AnelSemana = ({ semana }: { semana: DiaDaSemana[] }) => {
  const r = 86, c = 98;
  const total = 2 * Math.PI * r;
  const folga = 10; // px entre arcos
  const arco = total / 7 - folga;
  return (
    <svg viewBox="0 0 196 196" aria-hidden>
      {semana.map((d, i) => (
        <circle
          key={d.dia}
          className="cn-b-seg"
          data-estado={d.estado}
          cx={c}
          cy={c}
          r={r}
          strokeDasharray={`${arco} ${total - arco}`}
          strokeDashoffset={-(i * (arco + folga) + folga / 2)}
        />
      ))}
    </svg>
  );
};

/** O arco de "hoje" tracejado precisa do próprio recorte: um arco só, tracejado, no lugar dele. */
const ArcoHoje = ({ indice }: { indice: number }) => {
  const r = 86, c = 98;
  const total = 2 * Math.PI * r;
  const folga = 10;
  const arco = total / 7 - folga;
  const ini = (i: number) => (i * (arco + folga) + folga / 2) / total * Math.PI * 2;
  const a0 = ini(indice), a1 = a0 + (arco / total) * Math.PI * 2;
  const p = (a: number) => `${(c + Math.cos(a) * r).toFixed(2)} ${(c + Math.sin(a) * r).toFixed(2)}`;
  return (
    <svg viewBox="0 0 196 196" aria-hidden>
      <path className="cn-b-seg" data-estado="hoje" d={`M ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)}`} />
    </svg>
  );
};

const HeroB = ({ e, onDetalhe, onAcao }: { e: EstadoConquistasNova; onDetalhe: () => void; onAcao: (rota: string) => void }) => {
  const { seq } = e;
  const semana = useMemo(() => semanaDaSequencia(seq.lista, seq.usados, seq.hoje), [seq.lista, seq.usados, seq.hoje]);
  const hojeIdx = semana.findIndex((d) => d.estado === "hoje");
  const semHoje = semana.map((d) => (d.estado === "hoje" ? { ...d, estado: "futuro" as EstadoDia } : d));
  return (
    <section className="cn-b-hero px-4 pt-5 pb-4" style={varsDaFaixa(seq.faixa)} aria-label="Sequência" data-testid="cn-hero">
      <button type="button" onClick={onDetalhe} className="relative block w-full text-center" data-testid="cn-abrir-sequencia">
        <div className="cn-b-anel">
          <AnelSemana semana={semHoje} />
          {hojeIdx >= 0 && <ArcoHoje indice={hojeIdx} />}
          <div className="cn-b-centro">
            <Fogo dias={seq.dias} faixa={seq.dias > 0 ? seq.faixa : undefined} tamanho={52} viva={seq.dias > 0} />
            <span className="cn-b-num">{seq.dias}</span>
            <span className="cn-b-rot">{seq.dias === 1 ? "DIA SEGUIDO" : "DIAS SEGUIDOS"}</span>
          </div>
        </div>
      </button>
      <div className="cn-b-letras mt-3 px-3">
        {semana.map((d) => (
          <span key={d.dia} className="cn-b-letra" data-estado={d.estado}><i /> {d.rotulo.charAt(0)}</span>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
        <span className="cn-b-stat"><b>{seq.recorde}</b><span>recorde</span></span>
        <span className="cn-b-stat"><b className="inline-flex items-center gap-1"><Shield className="w-3.5 h-3.5" aria-hidden /> {seq.saldo} de 2</b><span>protetores</span></span>
        <span className="cn-b-stat"><b>{seq.lista.length}</b><span>dias anotados</span></span>
      </div>
      <div className="mt-3">
        <AcaoDoDia seq={seq} escuro onAcao={onAcao} />
      </div>
    </section>
  );
};

const TrilhaB = ({ e, onAdesivo, testeDia }: { e: EstadoConquistasNova; onAdesivo: (b: Badge) => void; testeDia?: 1 | 2 | 3 | null }) => {
  const { premio, trilha, seq } = e;
  const nos = trilha.filter((b) => (marcoDoAdesivo(b.id) ?? 0) <= 100);
  const trilhoRef = useRef<HTMLDivElement>(null);
  // o próximo prêmio entra à vista (os colados ficam à esquerda)
  useEffect(() => {
    const t = trilhoRef.current;
    const alvo = t?.querySelector<HTMLElement>("[data-proximo]");
    if (!t || !alvo) return;
    t.scrollLeft = Math.max(0, alvo.offsetLeft - t.clientWidth / 2 + alvo.clientWidth / 2);
  }, [premio.marco]);
  return (
    <section className="cn-card" aria-label="Próximos prêmios" data-testid="cn-amanha" style={varsDaFaixa(seq.faixa)}>
      <div className="h-11 px-4 flex items-center gap-2 border-b border-border">
        <h2 className="text-[13px] font-extrabold tracking-wide">TRILHA DA SEQUÊNCIA</h2>
        <span className="ml-auto text-[11px] font-bold text-muted-foreground whitespace-nowrap">{trilha.filter((b) => b.unlocked).length} de {nos.length} marcos</span>
      </div>
      <div className="cn-trilha" ref={trilhoRef}>
        {nos.map((b) => {
          const m = marcoDoAdesivo(b.id)!;
          const proximo = m === premio.marco;
          const feito = b.unlocked && m <= seq.recorde && m <= seq.dias;
          return (
            <button
              key={b.id}
              type="button"
              className="cn-trilha-no"
              data-feito={b.unlocked ? "" : undefined}
              data-proximo={proximo ? "" : undefined}
              data-trancado={!b.unlocked ? "" : undefined}
              onClick={() => onAdesivo(b)}
              aria-label={`${m} dias: ${b.name}`}
            >
              <span className="cn-trilha-disco">
                <AdesivoRaro id={b.id} raridade={raridadeDe(b)} tamanho={proximo ? 50 : 38} trancado={!b.unlocked} />
              </span>
              <span className="cn-trilha-quando">{proximo ? quandoCurto(premio) : feito || b.unlocked ? "colado" : `${m} dias`}</span>
              <span className="cn-trilha-nome">{b.name}</span>
            </button>
          );
        })}
      </div>
      <div className="px-4 pb-3.5 pt-1 flex items-start gap-3 border-t border-dashed border-border mx-0">
        <span className="flex-1 min-w-0 pt-2"><TextoDoPremio premio={premio} testeDia={testeDia} /></span>
      </div>
    </section>
  );
};

const ColecaoB = ({ e, onColecao, onAdesivo }: { e: EstadoConquistasNova; onColecao: (c: ColecaoNova | null) => void; onAdesivo: (b: Badge) => void }) => {
  const [filtro, setFiltro] = useState<string>("todas");
  const c = e.colecoes.find((x) => x.id === filtro) ?? null;
  const lista = c ? c.adesivos : e.folha;
  const colados = lista.filter((b) => b.unlocked);
  const faltando = lista.filter((b) => !b.unlocked);
  const visiveis = [...colados.slice(0, 8), ...faltando.slice(0, 4)];
  const total = c ? c.total : e.total, abertos = c ? c.abertos : e.abertos;
  return (
    <section className="cn-card" aria-labelledby="cn-titulo-adesivos" data-testid="cn-colecao">
      <div className="h-11 px-4 flex items-center gap-2">
        <h2 id="cn-titulo-adesivos" className="text-[13px] font-extrabold tracking-wide">MEUS ADESIVOS</h2>
        <span className="ml-auto text-[12.5px] font-bold tabular-nums">{abertos} de {total}</span>
      </div>
      <div className="cn-b-chips">
        <button type="button" className="cn-b-chip" data-ativo={filtro === "todas" ? "" : undefined} onClick={() => setFiltro("todas")}>Todas <span className="n">{e.abertos}/{e.total}</span></button>
        {e.colecoes.map((x) => (
          <button key={x.id} type="button" className="cn-b-chip" data-ativo={filtro === x.id ? "" : undefined} onClick={() => setFiltro(x.id)} data-testid={`cn-colecao-${x.id}`}>
            <span aria-hidden>{x.emoji}</span> {x.label} <span className="n">{x.abertos}/{x.total}</span>
          </button>
        ))}
      </div>
      {c && c.total - c.abertos <= 3 && c.total > c.abertos && (
        <p className="px-4 -mt-1 pb-2 text-[11.5px] font-bold" style={{ color: "hsl(var(--accent))" }}>Faltam {c.total - c.abertos} pra fechar {c.label} — o mais perto: {c.proximo?.name}</p>
      )}
      <div className="cn-b-grade px-2 pb-2">
        {visiveis.map((b, i) => (
          <button key={b.id} type="button" className="cn-celula" onClick={() => onAdesivo(b)} data-aberto={b.unlocked ? "true" : "false"}>
            <span className="relative grid place-items-center w-[70px] h-[70px]">
              <AdesivoRaro id={b.id} raridade={raridadeDe(b)} tamanho={64} trancado={!b.unlocked} giro={b.unlocked ? giroDoAdesivo(i) : 0} entradaIndice={i < 8 ? i : undefined} />
              {!b.unlocked && rotuloProgresso(b) && <span className="cn-prog">{rotuloProgresso(b)}</span>}
            </span>
            <span className={`cn-celula-nome ${b.unlocked ? "text-foreground" : "text-muted-foreground"}`}>{b.name}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={() => onColecao(c)} className="w-full h-10 text-[12px] font-bold text-muted-foreground inline-flex items-center justify-center gap-1 border-t border-border">
        Ver {c ? `toda a coleção ${c.label}` : "todos"} · mais {Math.max(0, lista.length - visiveis.length)} <ChevronRight className="w-3.5 h-3.5" aria-hidden />
      </button>
    </section>
  );
};

/* ------------------------------------------------------------------ C · agenda da semana */

const COR_DIA_C = ["#3b82f6", "#6366f1", "#22c55e", "#eab308", "#ec4899", "#a855f7", "#8b5cf6"];
const TEXTO_DIA_C = ["#fff", "#fff", "#052e16", "#422006", "#fff", "#fff", "#fff"];
const COR_COLECAO_C: Record<string, string> = { sequencia: "#f97316", finance: "#f59e0b", rotina: "#10b981", leitura: "#8b5cf6", treino: "#3b82f6", dieta: "#22c55e", saude: "#ef4444", vida: "#14b8a6", geral: "#d22d80" };

const HeroC = ({ e, onDetalhe, onAcao }: { e: EstadoConquistasNova; onDetalhe: () => void; onAcao: (rota: string) => void }) => {
  const { seq } = e;
  const semana = useMemo(() => semanaDaSequencia(seq.lista, seq.usados, seq.hoje), [seq.lista, seq.usados, seq.hoje]);
  return (
    <section className="cn-card" style={varsDaFaixa(seq.faixa)} aria-label="Sequência" data-testid="cn-hero">
      <div className="cn-c-faixa" style={{ background: "linear-gradient(90deg, var(--fg-a), var(--fg-b))", color: "var(--fg-texto)" }}>
        <Fogo dias={seq.dias} faixa={seq.dias > 0 ? seq.faixa : undefined} tamanho={18} semBrilho />
        MINHA SEMANA
        <span className="ml-auto text-[11px] font-bold tracking-normal inline-flex items-center gap-1.5 normal-case"><Shield className="w-3.5 h-3.5" aria-hidden /> {seq.saldo} {seq.saldo === 1 ? "protetor" : "protetores"}</span>
      </div>
      <div className="cn-c-tabela" role="list" aria-label="Semana">
        {semana.map((d, i) => (
          <span key={d.dia} className="cn-c-cab" style={{ background: COR_DIA_C[i], color: TEXTO_DIA_C[i] }}>{d.rotulo}</span>
        ))}
        {semana.map((d) => (
          <span key={d.dia} className="cn-c-cel" data-hoje={d.ehHoje ? "" : undefined} role="listitem">
            <span className="cn-c-dia-num">{Number(d.dia.slice(8, 10))}</span>
            <span className="cn-c-quad" data-estado={d.estado}>
              {d.estado === "feito" && <Check className="w-4 h-4" strokeWidth={3.2} aria-hidden />}
              {d.estado === "gelo" && <Shield className="w-3.5 h-3.5" strokeWidth={2.6} aria-hidden />}
            </span>
          </span>
        ))}
      </div>
      <button type="button" onClick={onDetalhe} className="w-full px-4 pt-3 flex items-center gap-2 text-left" data-testid="cn-abrir-sequencia">
        <Fogo dias={seq.dias} faixa={seq.dias > 0 ? seq.faixa : undefined} tamanho={26} viva={seq.dias > 0} />
        <span className="text-[22px] font-black tracking-tight tabular-nums leading-none">{seq.dias}</span>
        <span className="text-[13px] font-bold leading-none">{seq.dias === 1 ? "dia seguido" : "dias seguidos"}</span>
        <span className="text-[11.5px] text-muted-foreground leading-none">· recorde {seq.recorde}</span>
        <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" aria-hidden />
      </button>
      <div className="px-4 pt-2 pb-3.5">
        <AcaoDoDia seq={seq} onAcao={onAcao} />
      </div>
    </section>
  );
};

const AmanhaC = ({ e, testeDia }: { e: EstadoConquistasNova; testeDia?: 1 | 2 | 3 | null }) => {
  const b = e.premio.adesivo;
  return (
    <section className="cn-postit mx-1 flex items-center gap-3.5 px-4 py-3.5" aria-label="Próximo prêmio" data-testid="cn-amanha">
      <span className="relative shrink-0 grid place-items-center w-[66px] h-[66px]">
        {b ? <AdesivoRaro id={b.id} raridade={raridadeDe(b)} tamanho={60} trancado /> : <Shield className="w-9 h-9" />}
        <span className="cn-pill absolute -bottom-1 left-1/2 -translate-x-1/2" style={{ background: "var(--cn-postit-texto)", color: "var(--cn-postit)" }}>{quandoCurto(e.premio)}</span>
      </span>
      <span className="flex-1 min-w-0 [&_.text-muted-foreground]:text-current [&_.text-muted-foreground]:opacity-80">
        <span className="cn-caps block opacity-80">{e.premio.titulo}</span>
        <span className="block text-[16px] font-extrabold leading-tight mt-0.5">{b ? b.name : "+1 protetor"}{b && e.premio.daProtetor && <span className="font-bold text-[12px] opacity-80"> + 1 protetor</span>}</span>
        <span className="block text-[11.5px] leading-[1.35] mt-0.5 opacity-85">
          {b && raridadeDe(b) !== "comum" ? `adesivo ${RARIDADE_LABEL[raridadeDe(b)].toLowerCase()} · ` : ""}
          {e.premio.quando === "hoje" ? "anote 1 coisa hoje e ele cola sozinho" : e.premio.quando === "amanha" ? "anote 1 coisa amanhã e ele cola sozinho" : `${e.premio.faltam} dias de anotação, qualquer módulo`}
          {testeDia && e.premio.marco === 3 ? " · o 3º dia da sua missão" : ""}
        </span>
      </span>
    </section>
  );
};

const ColecaoC = ({ e, onColecao }: { e: EstadoConquistasNova; onColecao: (c: ColecaoNova | null) => void }) => (
  <section className="cn-card" aria-labelledby="cn-titulo-adesivos" data-testid="cn-colecao">
    <div className="cn-c-faixa" style={{ background: "hsl(var(--accent))" }}>
      MEUS ADESIVOS
      <span className="ml-auto text-[12px] tabular-nums tracking-normal">{e.abertos} de {e.total}</span>
    </div>
    <div>
      {e.colecoes.map((c) => {
        const colados = c.adesivos.filter((b) => b.unlocked);
        const previa = [...colados.slice(0, 4), ...c.adesivos.filter((b) => !b.unlocked).slice(0, Math.max(0, 4 - colados.length))];
        const frac = c.total ? c.abertos / c.total : 0;
        return (
          <button key={c.id} type="button" className="cn-c-linha w-full text-left" onClick={() => onColecao(c)} data-testid={`cn-colecao-${c.id}`}>
            <span className="cn-c-banda" style={{ "--cor": COR_COLECAO_C[c.id] ?? "hsl(var(--accent))" } as CSSProperties} />
            <span className="flex items-center gap-3 px-3 py-2.5">
              <span className="cn-c-previa shrink-0">
                {previa.map((b, i) => (
                  <span key={b.id} className="w-9 h-9 grid place-items-center" style={{ marginLeft: i ? -6 : 0 }}>
                    <AdesivoRaro id={b.id} raridade={raridadeDe(b)} tamanho={36} trancado={!b.unlocked} />
                  </span>
                ))}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[13px] font-extrabold">{c.label}</span>
                  <span className="text-[11px] font-bold text-muted-foreground tabular-nums">{c.abertos}/{c.total}</span>
                  {c.total - c.abertos <= 3 && <span className="ml-auto text-[10.5px] font-bold" style={{ color: "hsl(var(--accent))" }}>{c.frase}</span>}
                </span>
                <span className="cn-barra block mt-1.5"><i style={{ width: `${Math.round(frac * 100)}%`, background: COR_COLECAO_C[c.id] }} /></span>
              </span>
              <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
            </span>
          </button>
        );
      })}
    </div>
  </section>
);

/* ------------------------------------------------------------------ camadas: coleção inteira */

const ColecaoTela = ({ e, inicial, onFechar, onAdesivo }: { e: EstadoConquistasNova; inicial: ColecaoNova | null; onFechar: () => void; onAdesivo: (b: Badge) => void }) => {
  const [filtro, setFiltro] = useState<string>(inicial?.id ?? "todas");
  const secoes = filtro === "todas" ? e.colecoes : e.colecoes.filter((c) => c.id === filtro);
  return (
    <div className="cn-tela" role="dialog" aria-modal="true" aria-label="Meus adesivos" data-testid="cn-colecao-tela">
      <div className="cn-tela-cab">
        <button type="button" onClick={onFechar} aria-label="Fechar" className="w-9 h-9 rounded-full grid place-items-center bg-muted"><X className="w-5 h-5" /></button>
        <div className="min-w-0">
          <h2 className="text-[15px] font-extrabold tracking-tight leading-none">MEUS ADESIVOS</h2>
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
              <h3 className="text-[12.5px] font-extrabold tracking-wide uppercase">{c.label}</h3>
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

/* ------------------------------------------------------------------ camadas: detalhe da sequência */

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

const DetalheSequencia = ({ e, aberto, onFechar }: { e: EstadoConquistasNova; aberto: boolean; onFechar: () => void }) => {
  const { seq, trilha } = e;
  const proximos = trilha.filter((b) => !b.unlocked).slice(0, 3);
  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[92dvh] overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom))]" data-testid="cn-detalhe-sequencia">
        <div className="max-w-sm mx-auto pt-1" style={varsDaFaixa(seq.faixa)}>
          <div className="flex items-center gap-3">
            <Fogo dias={seq.dias} faixa={seq.dias > 0 ? seq.faixa : undefined} tamanho={44} viva={seq.dias > 0} />
            <div>
              <SheetTitle className="text-[22px] font-black tracking-tight leading-none">{seq.dias} {seq.dias === 1 ? "dia seguido" : "dias seguidos"}</SheetTitle>
              <SheetDescription className="text-[12px] text-muted-foreground mt-1">{seq.faixa.nome} · recorde {seq.recorde} · {seq.lista.length} dias anotados</SheetDescription>
            </div>
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
            <p className="cn-caps text-muted-foreground pt-2 pb-1">Próximos prêmios</p>
            {proximos.map((b) => {
              const m = marcoDoAdesivo(b.id)!;
              const faltam = Math.max(1, m - seq.dias);
              return (
                <div key={b.id} className="cn-premio-linha">
                  <AdesivoRaro id={b.id} raridade={raridadeDe(b)} tamanho={40} trancado />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-extrabold leading-tight">{b.name}{m % 7 === 0 ? <span className="text-muted-foreground font-bold text-[11px]"> + 1 protetor</span> : ""}</p>
                    <p className="text-[11px] text-muted-foreground">{m} dias seguidos · adesivo {RARIDADE_LABEL[raridadeDe(b)].toLowerCase()}{ehMarcoDeFesta(b.id) ? " · festa e Stories" : ""}</p>
                  </div>
                  <span className="cn-pill cn-pill-suave">{faltam === 1 ? "amanhã" : `em ${faltam} dias`}</span>
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-[11.5px] text-muted-foreground leading-[1.4]">
            <b className="text-foreground">O que conta:</b> anotar qualquer coisa em qualquer módulo — um gasto, um hábito, a água, uma página lida. Abrir o app sem anotar não conta.
          </p>
          <button type="button" className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 h-10 text-[12.5px] font-bold" onClick={() => trackEvent(EVENTOS2.lembreteLigar, {})}>
            <Bell className="w-3.5 h-3.5" /> Me lembrar às 20h se o dia estiver vazio
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

/* ------------------------------------------------------------------ camadas: toast + festa do marco */

/** O aviso pequeno do adesivo comum/raro (3,5 s, por cima de qualquer tela, toque abre as Conquistas). */
export const ToastAdesivo = ({ badge, colecao, onToque }: { badge: Badge; colecao?: string; onToque?: () => void }) => {
  const r = raridadeDe(badge);
  useEffect(() => { trackEvent(EVENTOS2.toastView, { id: badge.id, raridade: r }); }, [badge.id, r]);
  return (
    <button type="button" className="cn-toast" data-rar={r} data-testid="cn-toast" onClick={() => { trackEvent(EVENTOS2.toastToque, { id: badge.id }); onToque?.(); }}>
      <span className="shrink-0 grid place-items-center w-12 h-12"><AdesivoRaro id={badge.id} raridade={r} tamanho={46} giro={-5} /></span>
      <span className="flex-1 min-w-0">
        <span className="cn-toast-eyebrow block">Adesivo {r === "comum" ? "novo" : RARIDADE_LABEL[r].toLowerCase()} colado</span>
        <span className="cn-toast-nome block truncate">{badge.name}</span>
        <span className="cn-toast-sub block truncate">{colecao ? `na coleção ${colecao} · ` : ""}ver nas Conquistas</span>
      </span>
      <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="cn-toast-barra" aria-hidden />
    </button>
  );
};

const CORES_CONFETE = ["#d22d80", "#F5B301", "#4F8BFF", "#22c55e", "#fb923c", "#8b5cf6"];

/** A festa do MARCO (7/30/100 dias): a única tela cheia que sobra — com o adesivo do marco no lugar da roseta. */
export const CelebracaoMarco = ({ badge, dias, direcao, seq, onContinuar, onCompartilhar }: { badge: Badge; dias: number; direcao: Direcao; seq: Sequencia; onContinuar: () => void; onCompartilhar?: () => void }) => {
  useEffect(() => { trackEvent(EVENTOS2.marcoView, { dias }); }, [dias]);
  const confetes = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ x: 3 + ((i * 53) % 94), w: 6 + (i % 3) * 2.5, cor: CORES_CONFETE[i % CORES_CONFETE.length], atraso: 0.3 + (i % 6) * 0.09, dur: 2.2 + (i % 4) * 0.3, giro: (i % 2 ? 1 : -1) * (160 + ((i * 37) % 180)) })), []);
  const escuro = direcao === "b";
  return (
    <div className="cn-festa" data-direcao={direcao} role="dialog" aria-modal="true" aria-label={`${dias} dias seguidos`} data-testid="cn-festa" style={varsDaFaixa(seq.faixa)}>
      <div aria-hidden className="absolute inset-0 pointer-events-none cn-pontilhado" />
      <div aria-hidden className="cn-festa-raios" />
      {confetes.map((c, i) => <span key={i} aria-hidden className="cn-confete" style={{ left: `${c.x}%`, width: c.w, height: c.w * 1.7, background: c.cor, "--atraso": `${c.atraso}s`, "--dur": `${c.dur}s`, "--giro": `${c.giro}deg` } as CSSProperties} />)}
      <div className="relative flex-1 flex flex-col items-center justify-center px-8 text-center">
        <p className="cn-caps mb-5" style={{ color: escuro ? "#fde68a" : "hsl(var(--accent))" }}>Marco de sequência</p>
        <div style={{ transform: "rotate(-5deg)" }}>
          <AdesivoRaro id={badge.id} raridade={raridadeDe(badge)} tamanho={200} bordaGrossa titulo={badge.name} />
        </div>
        <h2 className="mt-7 text-[32px] font-black tracking-tight leading-[1.05]">{dias} dias seguidos!</h2>
        <p className={`cn-serif mt-1.5 text-[23px] ${escuro ? "text-white/75" : "text-muted-foreground"}`}>Constância tem prêmio.</p>
        {dias % 7 === 0 && <span className="cn-festa-chip mt-5"><Shield className="w-3.5 h-3.5" /> +1 protetor guardado</span>}
      </div>
      <div className="relative w-full max-w-md mx-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-2.5">
        {podeCompartilhar(badge) && (
          <button type="button" className="cn-btn cn-btn-1" onClick={() => { trackEvent(EVENTOS2.marcoShare, { dias }); onCompartilhar?.(); }}>
            <Share2 className="w-4 h-4" /> Postar nos Stories
          </button>
        )}
        <button type="button" className="cn-btn cn-btn-2" onClick={onContinuar}>Continuar</button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ a tela */

export const ConquistasNova = ({ direcao, testeDia = null, camada = null, onVoltar }: PropsConquistasNova) => {
  const navigate = useNavigate();
  const e = useConquistasNova();
  const [detalhe, setDetalhe] = useState(camada === "sequencia");
  const [colecao, setColecao] = useState<{ aberta: boolean; de: ColecaoNova | null }>({ aberta: camada === "colecao", de: null });
  const [toast, setToast] = useState(camada === "toast");
  const [festa, setFesta] = useState(camada === "marco");
  const abriuEm = useRef(Date.now());

  useEffect(() => {
    trackEvent(EVENTOS2.abrir, { origem: "dev", dias: e.seq.dias, teste_dia: testeDia, direcao });
    trackEvent(EVENTOS2.amanhaVisto, { marco: e.premio.marco, quando: e.premio.quando });
    const t = abriuEm.current;
    return () => { trackEvent(EVENTOS2.tempo, { ms: Date.now() - t }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const voltar = () => (onVoltar ? onVoltar() : navigate("/home"));
  const irPara = (rota: string) => navigate(rota);
  const abrirDetalhe = () => { trackEvent(EVENTOS2.sequenciaAbrir, { dias: e.seq.dias }); setDetalhe(true); };
  const abrirColecao = (c: ColecaoNova | null) => { trackEvent(EVENTOS2.colecaoAbrir, { colecao: c?.id ?? "todas" }); setColecao({ aberta: true, de: c }); };
  const tocarAdesivo = (b: Badge) => { trackEvent(EVENTOS2.adesivoToque, { id: b.id, aberto: b.unlocked, colecao: b.category }); };

  // o adesivo do toast (protótipo): o último comum colado; a festa: o marco de 7
  const adesivoToast = e.folha.find((b) => b.unlocked && raridadeDe(b) === "comum") ?? e.folha[0];
  const adesivoMarco = e.adesivos.find((b) => b.id === "sequencia-7") ?? e.adesivos[0];
  const colecaoDoToast = e.colecoes.find((c) => c.id === adesivoToast?.category)?.label;

  const missao: ReactNode = testeDia ? (
    <div className="flex items-center gap-2 px-1" data-testid="cn-missao">
      <span className="cn-pill cn-pill-acento">Missão · dia {testeDia} de 3</span>
      <span className="text-[11.5px] text-muted-foreground">{testeDia === 3 ? "Último dia: anote 1 coisa e cola o adesivo raro." : testeDia === 2 ? "Voltou! Anote 1 coisa hoje e amanhã vem o raro." : "Anote 1 coisa hoje; amanhã já tem adesivo."}</span>
    </div>
  ) : null;

  return (
    <div className="cn min-h-screen bg-background" data-direcao={direcao} data-testid="conquistas-nova">
      <Cabecalho seq={e.seq} onVoltar={voltar} />
      <main className="cn-main min-h-[calc(100vh-57px)]">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-10 space-y-3.5">
          {missao}
          {direcao === "a" && (
            <>
              <HeroA e={e} onDetalhe={abrirDetalhe} onAcao={irPara} />
              <AmanhaA e={e} testeDia={testeDia} />
              <ColecaoA e={e} onColecao={abrirColecao} onAdesivo={tocarAdesivo} />
            </>
          )}
          {direcao === "b" && (
            <>
              <HeroB e={e} onDetalhe={abrirDetalhe} onAcao={irPara} />
              <TrilhaB e={e} onAdesivo={tocarAdesivo} testeDia={testeDia} />
              <ColecaoB e={e} onColecao={abrirColecao} onAdesivo={tocarAdesivo} />
            </>
          )}
          {direcao === "c" && (
            <>
              <HeroC e={e} onDetalhe={abrirDetalhe} onAcao={irPara} />
              <AmanhaC e={e} testeDia={testeDia} />
              <ColecaoC e={e} onColecao={abrirColecao} />
            </>
          )}
        </div>
      </main>

      <DetalheSequencia e={e} aberto={detalhe} onFechar={() => setDetalhe(false)} />
      {colecao.aberta && <ColecaoTela e={e} inicial={colecao.de} onFechar={() => setColecao({ aberta: false, de: null })} onAdesivo={tocarAdesivo} />}
      {toast && adesivoToast && <ToastAdesivo badge={adesivoToast} colecao={colecaoDoToast} onToque={() => setToast(false)} />}
      {festa && adesivoMarco && <CelebracaoMarco badge={adesivoMarco} dias={7} direcao={direcao} seq={e.seq} onContinuar={() => setFesta(false)} />}
    </div>
  );
};

/** Pra quem monta a tela por fora saber o dia da semana de hoje (testes). */
export const diaDaSemanaHoje = () => parseLocalDay(localDayKey()).getDay();
