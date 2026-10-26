import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, Check, ChevronRight, Info, Shield, X } from "lucide-react";
import type { Sequencia } from "@/components/conquistas/use-conquistas";
import { raridadeDe, type Badge } from "@/components/gamification/types";
import { AdesivoRaro } from "@/components/conquistas/adesivos-raridade";
import { marcoDoAdesivo } from "@/components/conquistas/nova/recompensas";
import { fogoDoCaderno, proximoFogoDoCaderno } from "@/components/conquistas/nova/fogo-caderno";
import { ROTULOS_DA_SEMANA, segundaDaSemana, semanaDaSequencia, type EstadoDia } from "@/lib/sequencia-semana";
import { normalizarDias, somarDias } from "@/lib/sequencia";
import { trackEvent } from "@/lib/analytics";
import { useLembreteDaSequencia } from "@/components/conquistas/LembreteDaSequencia";
import { FogoSequencia, estadoDoFogo } from "./FogoSequencia";
import { Alca, useFolhaArrastavel, CLASSE_FUNDO_FOLHA, FaixaDoRelogioSobFolha, propsDaFolha } from "@/components/home-nova/e/folha-arrasto";
import "./fogo-sequencia.css";

/**
 * A FOLHA DA SEQUÊNCIA, UNIFICADA (26/10, aprovada pelo dono) — UMA folha pros dois lugares: o toque no fogo da Home
 * nova e "Ver detalhes da sequência" nas Conquistas (com e sem a chave home_nova; lá ela substitui a folha do Codex).
 * RODADA 3 (adendo do dono): os PERSONAGENS voltam a ser o foco, como na versão do Codex. De cima pra baixo:
 *  1. o FOGO UNIFICADO (animado) + "27 dias seguidos"; "Recorde de N dias" SÓ se o recorde for maior; X e arrastar fecham;
 *  2. "Sua evolução" em DESTAQUE: cards GRANDES (~60 % da largura, o próximo inteiro + a beirada do seguinte), abrindo
 *     CENTRALIZADO no PRÓXIMO marco (silhueta + barrinha + "Faltam 3 dias" + borda suave na cor da próxima faixa); à
 *     esquerda os conquistados coloridos com "✓ Conquistada"; à direita os futuros em silhueta "A conquistar"; tocar
 *     amplia (a camada do Codex); sem repetir o rótulo da arte;
 *  3. o status: "✓ Hoje já conta" (linha discreta) ou o card leve "Pra continuar hoje: <ação>" com o botão (o único
 *     destaque com botão);
 *  4. a SEMANA em 7 bolinhas com os estados reais (registrado = a cor da faixa com ✓ · protetor = escudo · hoje =
 *     tracejado se não garantido · perdido = vazio · futuro = só a letra) + "Ver as últimas 4 semanas" (mesmas cores);
 *  5. o card compacto: "🛡 2 protetores guardados ⓘ" + "🔔 Me lembrar da sequência" / "Lembrete ligado · 20h" (só no app);
 *  6. o rodapé pequeno "O que conta…".
 * Ao abrir, sem rolar: topo + personagens + status; o resto com uma rolagem curta. Estilo da E (sem bordas, sombras
 * mínimas) conversando com o azul-tinta das Conquistas. Eventos: sequencia_folha_aberta / sequencia_folha_acao com
 * `origem: home | conquistas`.
 */
export interface PropsFolhaSequencia {
  aberta: boolean;
  onFechar: () => void;
  seq: Sequencia;
  /** as figurinhas da sequência (1/3/7/14/30/100), na ordem — a `trilha` das Conquistas */
  trilha: Badge[];
  origem: "home" | "conquistas";
  /** toque numa figurinha: a ampliação (nas Conquistas, a camada do Codex; na Home, vai pras Conquistas ampliando) */
  onAdesivo: (b: Badge) => void;
  /** "Pra continuar hoje" / "Lembrete ligado" → a rota */
  onIr: (rota: string) => void;
}

const LETRA: Record<string, string> = { SEG: "S", TER: "T", QUA: "Q", QUI: "Q", SEX: "S", SÁB: "S", DOM: "D" };
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** A frase da próxima faixa, nos nomes do caderno ("Faltam 3 dias pro fogo petróleo"); null no topo. */
export const fraseDaProximaFaixaDoCaderno = (dias: number): string | null => {
  const prox = proximoFogoDoCaderno(dias);
  if (!prox) return null;
  const faltam = Math.max(1, prox.min - dias);
  return `${faltam === 1 ? "Falta" : "Faltam"} ${plural(faltam, "dia", "dias")} pro ${prox.nome}`;
};

/**
 * A tinta do ✓ sobre a cor da faixa (varredura 26/10): o branco fixo dava 1,8:1 no âmbar, 2,0 no ouro e 2,7–2,8 no
 * violeta/petróleo (ícone pede ≥ 3:1). Branco só onde passa de 3:1 (o magenta); nas faixas claras, a tinta quase preta
 * do caderno (#2a1d05: 5,8–9,1:1).
 */
const luminancia = (cor: string): number | null => {
  const hex = cor.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})(?:[0-9a-f]{2})?$/i)?.[1];
  const rgb = hex
    ? (hex.length === 3 ? hex.split("").map((c) => parseInt(c + c, 16)) : [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)))
    : cor.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i)?.slice(1, 4).map(Number);
  if (!rgb || rgb.some((n) => !Number.isFinite(n))) return null;
  const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const TINTA_ESCURA_DO_CHECK = "#2a1d05";
export const tintaDoCheck = (fundo: string): string => {
  const l = luminancia(fundo);
  if (l === null) return "#fff";
  return 1.05 / (l + 0.05) >= 3 ? "#fff" : TINTA_ESCURA_DO_CHECK;
};

/** Uma bolinha de dia — a mesma em qualquer semana. */
const Bolinha = ({ estado, cor, tamanho = 36, rotulo }: { estado: EstadoDia; cor: string; tamanho?: number; rotulo?: string }) => {
  const base: React.CSSProperties = { width: tamanho, height: tamanho };
  const icone = Math.round(tamanho * 0.5);
  const comum = { "aria-label": rotulo, "data-estado": estado } as const;
  if (estado === "feito") return <span className="fs-bolinha" style={{ ...base, background: cor }} {...comum}><Check style={{ width: icone, height: icone, color: tintaDoCheck(cor) }} strokeWidth={2.8} aria-hidden /></span>;
  if (estado === "gelo") return <span className="fs-bolinha fs-bolinha-gelo" style={base} {...comum}><Shield style={{ width: icone - 2, height: icone - 2 }} strokeWidth={2.2} aria-hidden /></span>;
  if (estado === "hoje") return <span className="fs-bolinha" style={{ ...base, border: `1.5px dashed ${cor}` }} {...comum} />;
  if (estado === "vazio") return <span className="fs-bolinha fs-bolinha-vazia" style={base} {...comum} />;
  return <span className="fs-bolinha fs-bolinha-futuro" style={base} {...comum} />;
};

/** As últimas 4 semanas (28 dias, até o fim desta semana) com os MESMOS estados da semana — o "Ver mais". */
const QuatroSemanas = ({ seq, cor }: { seq: Sequencia; cor: string }) => {
  const anotados = useMemo(() => new Set(normalizarDias(seq.lista)), [seq.lista]);
  const protegidos = useMemo(() => new Set(seq.usados), [seq.usados]);
  const inicio = somarDias(segundaDaSemana(seq.hoje), -21);
  const dias = Array.from({ length: 28 }, (_, i) => somarDias(inicio, i));
  const estado = (d: string): EstadoDia => (anotados.has(d) ? "feito" : protegidos.has(d) ? "gelo" : d === seq.hoje ? "hoje" : d > seq.hoje ? "futuro" : "vazio");
  return (
    <div className="mt-3 grid grid-cols-7 gap-y-2 justify-items-center" data-testid="he-seq-quatro-semanas">
      {dias.map((d) => <Bolinha key={d} estado={estado(d)} cor={cor} tamanho={24} rotulo={d} />)}
    </div>
  );
};

/** "Sua evolução": os personagens da sequência do Codex, GRANDES, abrindo centralizado no próximo marco. */
const Evolucao = ({ trilha, dias, recorde, onAdesivo, aberta }: { trilha: Badge[]; dias: number; recorde: number; onAdesivo: (b: Badge) => void; aberta: boolean }) => {
  const lista = useRef<HTMLOListElement>(null);
  // Voltei (sequencia-2) segue no catálogo e no álbum; esta faixa acompanha só a família de pedra (como no Codex)
  const personagens = trilha.filter((b) => b.id !== "sequencia-2" && marcoDoAdesivo(b.id) !== null);
  const iniciou = Math.max(dias, recorde) >= 1 || personagens.some((b) => b.unlocked);
  const proxima = personagens.find((b) => !b.unlocked);
  const destaque = iniciou ? proxima?.id ?? personagens.at(-1)?.id : "sequencia-1";
  const marcoDestaque = destaque ? marcoDoAdesivo(destaque) ?? 1 : 1;
  const corDaProxima = fogoDoCaderno(marcoDestaque).meio;
  // abre CENTRALIZADO no próximo marco (os conquistados ficam à esquerda; é arrastar pra ver)
  useEffect(() => {
    if (!aberta) return;
    const el = lista.current;
    const alvo = el?.querySelector<HTMLElement>("[data-destaque]");
    if (el && alvo) el.scrollLeft = Math.max(0, alvo.offsetLeft - (el.clientWidth - alvo.offsetWidth) / 2);
  }, [destaque, aberta]);
  if (personagens.length === 0) return null;
  return (
    <section className="mt-4" aria-labelledby="he-seq-evolucao-titulo" data-testid="he-seq-evolucao" data-destaque={destaque}>
      <div className="flex items-baseline justify-between px-0.5">
        <h4 id="he-seq-evolucao-titulo" className="text-[15px] font-bold fs-tinta">Sua evolução</h4>
        <span className="text-[11px] text-muted-foreground">Arraste pra ver</span>
      </div>
      <ol ref={lista} className="fs-evolucao fs-evolucao-grande" aria-label="Marcos da sequência" data-rola>
        {personagens.map((b) => {
          const marco = marcoDoAdesivo(b.id)!;
          const falta = Math.max(1, marco - dias);
          const emDestaque = b.id === destaque;
          const texto = b.unlocked ? "Conquistada" : iniciou && b.id === proxima?.id ? `${falta === 1 ? "Falta" : "Faltam"} ${plural(falta, "dia", "dias")}` : "A conquistar";
          const progresso = b.progresso ? Math.max(0, Math.min(1, b.progresso.atual / Math.max(1, b.progresso.alvo))) : 0;
          return (
            <li key={b.id} data-destaque={emDestaque ? "" : undefined} data-conquistada={b.unlocked ? "" : undefined} data-marco={marco}>
              <button
                type="button" className="fs-marco fs-marco-grande" data-testid="he-seq-marco" onClick={() => onAdesivo(b)} aria-label={`${b.name}: ${texto.toLowerCase()}`}
                style={emDestaque ? ({ "--fs-proxima": corDaProxima } as React.CSSProperties) : undefined}
              >
                <span className="fs-marco-arte"><AdesivoRaro id={b.id} raridade={raridadeDe(b)} tamanho={emDestaque ? 124 : 112} trancado={!b.unlocked} progresso={b.progresso} /></span>
                {!b.unlocked && emDestaque && iniciou && (
                  <span className="fs-marco-barra" aria-hidden><span style={{ width: `${Math.round(progresso * 100)}%`, background: corDaProxima }} /></span>
                )}
                <small className={b.unlocked ? "fs-marco-ok" : emDestaque ? "fs-tinta" : undefined}>{b.unlocked && <Check size={12} strokeWidth={3} aria-hidden />}{texto}</small>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

const Linha = ({ children, testid }: { children: ReactNode; testid?: string }) => <div className="rounded-[20px] px-4 py-3" style={{ background: "hsl(var(--muted) / 0.55)" }} data-testid={testid}>{children}</div>;

export const FolhaSequencia = ({ aberta, onFechar, seq, trilha, origem, onAdesivo, onIr }: PropsFolhaSequencia) => {
  const semMovimento = useReducedMotion();
  const semana = useMemo(() => semanaDaSequencia(seq.lista, seq.usados, seq.hoje), [seq.lista, seq.usados, seq.hoje]);
  const estado = estadoDoFogo(seq);
  const faixa = fogoDoCaderno(seq.dias);
  const cor = faixa.meio;
  const frase = fraseDaProximaFaixaDoCaderno(seq.dias);
  const acao = (seq.acao?.texto ?? "").replace(/\s+(de\s+)?hoje\b\.?$/i, "").trim();
  const [maisSemanas, setMaisSemanas] = useState(false);
  const [explicaProtetor, setExplicaProtetor] = useState(false);
  const lembrete = useLembreteDaSequencia();
  const arrasto = useFolhaArrastavel(onFechar, !!semMovimento); // rodada 3: arrastar pra baixo fecha

  useEffect(() => {
    if (!aberta) { setMaisSemanas(false); setExplicaProtetor(false); return; }
    trackEvent("sequencia_folha_aberta", { dias: seq.dias, garantido: seq.hojeFeito, faixa: faixa.id, origem });
  }, [aberta]); // eslint-disable-line react-hooks/exhaustive-deps

  const fazer = () => {
    trackEvent("sequencia_folha_acao", { acao: seq.acao.id, destino: seq.acao.rota, dias: seq.dias, origem });
    onFechar();
    window.setTimeout(() => onIr(seq.acao.rota), 180);
  };
  const tocarAdesivo = (b: Badge) => {
    trackEvent("sequencia_folha_acao", { acao: "figurinha", destino: b.id, dias: seq.dias, origem });
    onAdesivo(b);
  };
  const tocarLembrete = () => {
    if (lembrete.ligado) {
      trackEvent("sequencia_folha_acao", { acao: "lembretes", destino: "/notificacoes", dias: seq.dias, origem });
      onFechar();
      window.setTimeout(() => onIr("/notificacoes"), 180);
      return;
    }
    void lembrete.ligar();
  };

  return (
    <AnimatePresence>
      {aberta && (
        <>
          <FaixaDoRelogioSobFolha />
          <motion.button type="button" aria-label="Fechar" onClick={onFechar} className={CLASSE_FUNDO_FOLHA} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: semMovimento ? 0 : 0.2 }} />
          <motion.div
            role="dialog" aria-label="Sua sequência" data-testid="he-folha-sequencia" data-garantido={seq.hojeFeito ? "1" : "0"} data-origem={origem} data-faixa={faixa.id}
            className="fs-folha fixed inset-x-0 bottom-0 z-[71] max-w-lg mx-auto rounded-t-[28px] bg-card max-h-[92dvh] overflow-y-auto overscroll-contain px-5 pt-2.5 pb-[calc(var(--app-safe-bottom,0px)+16px)]"
            style={{ y: arrasto.y }} {...arrasto.folha}
            {...propsDaFolha(!!semMovimento)}
          >
            <Alca arrasto={arrasto} className="mb-0.5" />

            {/* 1. o fogo + os dias (+ o recorde só se for maior) */}
            <div className="flex items-center gap-3 pr-10">
              <FogoSequencia dias={seq.dias} estado={estado} tamanho={56} brilho={seq.dias >= 100} testid="he-seq-fogo" />
              <div className="min-w-0">
                <p className="flex items-baseline gap-1.5 fs-tinta">
                  <span className="text-[34px] leading-none font-bold tabular-nums tracking-[-0.03em]" data-testid="he-seq-dias">{seq.dias}</span>
                  <span className="text-[17px] font-semibold">{seq.dias === 1 ? "dia seguido" : "dias seguidos"}</span>
                </p>
                {seq.recorde > seq.dias && <p className="mt-1 text-[12.5px] text-muted-foreground" data-testid="he-seq-recorde">Recorde de {plural(seq.recorde, "dia", "dias")}</p>}
              </div>
            </div>
            <button type="button" onClick={onFechar} aria-label="Fechar" className="absolute top-3 right-4 w-9 h-9 rounded-full grid place-items-center bg-muted"><X className="w-4 h-4" strokeWidth={2.2} /></button>

            {/* 2. a evolução — os personagens em destaque (as artes do Codex) */}
            <Evolucao trilha={trilha} dias={seq.dias} recorde={seq.recorde} onAdesivo={tocarAdesivo} aberta={aberta} />

            {/* 3. o status */}
            <div className="mt-4">
              {seq.hojeFeito ? (
                <p className="flex items-center gap-2 px-1 text-[14px] font-semibold" data-testid="he-seq-garantido">
                  <Check className="w-[18px] h-[18px] shrink-0" strokeWidth={2.6} style={{ color: cor }} aria-hidden />
                  <span>Hoje já conta.{frase && <span className="font-normal text-muted-foreground"> {capitalizar(frase)}.</span>}{!frase && <span className="font-normal text-muted-foreground"> Você está no fogo ouro luminoso — o topo.</span>}</span>
                </p>
              ) : acao ? (
                <button type="button" onClick={fazer} data-testid="he-seq-acao" className="w-full rounded-[20px] px-4 py-3 flex items-center gap-3 text-left active:brightness-95" style={{ background: "hsl(var(--muted) / 0.55)" }}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Pra continuar hoje</span>
                    <span className="block text-[15px] font-semibold mt-0.5 fs-tinta truncate">{capitalizar(acao)}</span>
                  </span>
                  <span className="h-10 px-4 rounded-full text-[13.5px] font-bold shrink-0 grid place-items-center" style={{ background: "var(--hn-mais, hsl(var(--foreground)))", color: "var(--hn-mais-texto, hsl(var(--background)))" }}>Fazer agora</span>
                </button>
              ) : (
                <Linha testid="he-seq-acao-generica"><p className="text-[13.5px] text-muted-foreground leading-snug">Registre um cuidado no seu dia para continuar. Pode ser um copo d'água, um hábito ou uma tarefa.</p></Linha>
              )}
            </div>

            {/* 4. a semana atual (e, se quiser, as 4 semanas) */}
            <div className="mt-4">
              <div className="grid grid-cols-7 gap-1" data-testid="he-seq-semana">
                {semana.map((d) => (
                  <div key={d.dia} className="flex flex-col items-center gap-1.5" data-testid="he-seq-dia" data-estado={d.estado} data-hoje={d.ehHoje ? "1" : "0"}>
                    <span className={`text-[11.5px] leading-none font-semibold ${d.ehHoje ? "fs-tinta" : "text-muted-foreground"}`}>{LETRA[d.rotulo] ?? d.rotulo.charAt(0)}</span>
                    <Bolinha estado={d.estado} cor={cor} />
                  </div>
                ))}
              </div>
              {maisSemanas && (
                <>
                  <div className="mt-3 grid grid-cols-7 justify-items-center">{ROTULOS_DA_SEMANA.map((r) => <span key={r} className="text-[10px] font-semibold text-muted-foreground">{r.charAt(0)}</span>)}</div>
                  <QuatroSemanas seq={seq} cor={cor} />
                </>
              )}
              <button type="button" onClick={() => setMaisSemanas((v) => !v)} data-testid="he-seq-ver-mais" aria-expanded={maisSemanas} className="mt-1.5 w-full h-8 text-[12px] font-semibold text-muted-foreground">
                {maisSemanas ? "Ver menos" : "Ver as últimas 4 semanas"}
              </button>
            </div>

            {/* 5. o card compacto: protetores + o lembrete (só no app) */}
            <div className="mt-2 rounded-[20px] px-4 py-3" style={{ background: "hsl(var(--muted) / 0.55)" }}>
              <div className="flex items-center gap-2.5">
                <Shield className="w-[18px] h-[18px] text-sky-600 dark:text-sky-300 shrink-0" strokeWidth={2.2} aria-hidden />
                <p className="flex-1 text-[14px] font-semibold" data-testid="he-seq-protetores">{plural(seq.saldo, "protetor guardado", "protetores guardados")}</p>
                <button type="button" onClick={() => setExplicaProtetor((v) => !v)} aria-label="O que é um protetor" aria-expanded={explicaProtetor} data-testid="he-seq-protetores-info" className="w-8 h-8 -mr-1.5 rounded-full grid place-items-center text-muted-foreground"><Info className="w-[17px] h-[17px]" strokeWidth={2} /></button>
              </div>
              {explicaProtetor && <p className="mt-1.5 text-[12.5px] text-muted-foreground leading-snug" data-testid="he-seq-protetores-explica">A cada 7 dias seguidos você ganha 1. Um dia vazio? Ele segura a sequência.</p>}
              {lembrete.visivel && (
                <button type="button" onClick={tocarLembrete} disabled={lembrete.ligando} data-testid="he-seq-lembrete" data-ligado={lembrete.ligado ? "1" : "0"} className="mt-2.5 w-full flex items-center gap-2.5 text-left disabled:opacity-60">
                  <Bell className="w-[18px] h-[18px] text-amber-600 dark:text-amber-300 shrink-0" strokeWidth={2.2} aria-hidden />
                  <span className="flex-1 text-[13.5px] font-semibold">{lembrete.ligado ? `Lembrete ligado · ${lembrete.hora}h` : "Me lembrar da sequência"}</span>
                  {lembrete.ligado && <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" strokeWidth={2} aria-hidden />}
                </button>
              )}
            </div>

            {/* 6. o rodapé */}
            <p className="mt-3 px-1 text-[11.5px] text-muted-foreground leading-[1.4]" data-testid="he-seq-o-que-conta"><b className="font-semibold text-foreground">O que conta:</b> anotar qualquer coisa, em qualquer módulo — um gasto, um hábito, a água, uma página lida. Só abrir o app não conta.</p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
