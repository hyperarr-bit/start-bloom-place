import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Instagram, Lock, X } from "lucide-react";
import { RARIDADE_PLURAL, categoriaDe, fracaoDe, raridadeDe, type Badge, type Raridade } from "@/components/gamification/types";
import { rotuloProgresso, textoFalta } from "@/lib/conquistas-registro";
import { parseLocalDay } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { AdesivoRaro, ChipRaridade } from "./adesivos-raridade";
import { giroDoAdesivo } from "./adesivos-arte";
import { CapaAlbum } from "./CapaAlbum";
import { Destacar } from "./GradeAdesivos";
import { ORDEM_RARIDADE, RARIDADE_FEM, TITULO_SECAO, contagemDaPagina, resumoRaridades, tituloDaPagina, type PaginaAlbum } from "./album-paginas";
import "./conquistas.css";

/**
 * O ÁLBUM DE FIGURINHAS EM TELA CHEIA (27/09): mesa escura, o álbum com a
 * lombada magenta e a pilha de páginas à direita; a capa VIRA na lombada e
 * revela a página 1, e as figurinhas COLAM uma a uma. Páginas: OS MAIS RAROS
 * (banda magenta; com pouca figurinha, PRÓXIMAS A COLAR e a dica), depois
 * LENDÁRIOS (foil ouro) · ÉPICOS (holográfico) · RAROS (azul) · COMUNS
 * (grafite) — cada VAGA numerada ("Nº 46"), tracejada quando vazia com a
 * silhueta e a pílula do progresso; colada, a figurinha cobre o número, um
 * pouco torta. Abas coloridas na borda pulam de seção; setas e bolinhas
 * embaixo; a página vira como folha. Toque numa vaga abre o detalhe.
 *
 * A lógica das páginas é a de `album-paginas.ts` (não muda nada dela).
 */

/** O número da figurinha = a posição na coleção (a ordem do catálogo, como num álbum de verdade). */
export const numeroDaFigurinha = (adesivos: Badge[], id: string): number => adesivos.findIndex((b) => b.id === id) + 1;
export const nDeDois = (n: number) => String(n).padStart(2, "0");

const ROTA_PADRAO = (b: Badge) => b.rota ?? { caminho: categoriaDe(b.category).rota, nome: b.category === "sequencia" || b.category === "geral" ? "Home" : categoriaDe(b.category).label };

interface VagaProps {
  b: Badge;
  n: number;
  tam: number;
  indice: number;
  /** Atraso (ms) pra colar com o pop; undefined = já colada. */
  cola?: number;
  ativa: boolean;
  onSelecionar: (b: Badge) => void;
}

const Vaga = ({ b, n, tam, indice, cola, ativa, onSelecionar }: VagaProps) => {
  const raridade = raridadeDe(b);
  const cx = tam + 14;
  const rotulo = b.unlocked ? null : rotuloProgresso(b);
  return (
    <button type="button" className="vaga" data-id={b.id} data-vaga={b.id} data-aberta={b.unlocked ? "true" : "false"} data-rar={raridade} onClick={() => onSelecionar(b)} tabIndex={ativa ? 0 : -1} style={{ width: cx }}>
      <span className="vaga-caixa" style={{ width: cx, height: cx }}>
        <span className="vaga-n">Nº {nDeDois(n)}</span>
        {b.unlocked ? (
          <span className="vaga-fig" data-cola={cola !== undefined ? "" : undefined} style={{ "--d": `${cola ?? 0}ms` } as CSSProperties}>
            <AdesivoRaro id={b.id} raridade={raridade} tamanho={tam} giro={giroDoAdesivo(indice)} />
          </span>
        ) : (
          <span className="vaga-fig" style={{ opacity: 0.9 }}>
            <AdesivoRaro id={b.id} raridade={raridade} tamanho={tam - 8} trancado />
          </span>
        )}
        {!b.unlocked && b.progresso && b.progresso.atual > 0 && <span className="vaga-pill" data-testid="pilula-figurinha">{rotulo ?? <Lock className="w-3 h-3" aria-label="Trancado" />}</span>}
      </span>
      <span className="vaga-nome" data-falta={b.unlocked ? undefined : ""}>{b.name}</span>
    </button>
  );
};

interface PaginaProps {
  p: PaginaAlbum;
  indice: number;
  total: number;
  largura: number;
  adesivos: Badge[];
  ativa: boolean;
  /** Ids que colam com o pop nesta montagem (com o atraso base). */
  colar: Set<string> | null;
  atrasoBase: number;
  diasDeSequencia: number;
  onSelecionar: (b: Badge) => void;
}

const Pagina = ({ p, indice, total, largura, adesivos, ativa, colar, atrasoBase, diasDeSequencia, onSelecionar }: PaginaProps) => {
  const grande = p.tipo === "mais-raros";
  const col = grande ? 3 : 4, gap = grande ? 10 : 6;
  const tam = grande ? Math.min(84, Math.floor((largura - 34 - gap * 2) / 3) - 14) : Math.min(60, Math.floor((largura - 34 - gap * 3) / 4) - 14);
  const proximo = p.proximos[0];
  const colaDe = (b: Badge, j: number) => (colar && b.unlocked && colar.has(b.id) ? atrasoBase + j * 90 : undefined);
  return (
    <div className="alb-pag" data-pagina={p.id} data-testid={`album-tela-pagina-${indice}`} aria-hidden={!ativa}>
      {grande ? (
        <div className="alb-secao" data-rar="destaque"><span>{p.titulo}</span><b>{p.abertos} de {p.total}</b></div>
      ) : (
        <div className="alb-secao" data-rar={p.raridade}><span>{tituloDaPagina(p)}</span><b>{p.total > p.abertos ? contagemDaPagina(p) : `${p.abertos} de ${p.total} · completa!`}</b></div>
      )}
      <div className="alb-grade" style={{ gridTemplateColumns: `repeat(${col}, 1fr)`, gap: `${grande ? 10 : 4}px ${gap}px` }}>
        {p.vagas.map((b, j) => <Vaga key={b.id} b={b} n={numeroDaFigurinha(adesivos, b.id)} tam={tam} indice={j} cola={colaDe(b, j)} ativa={ativa} onSelecionar={onSelecionar} />)}
      </div>
      {grande && p.proximos.length > 0 && (
        <>
          <div className="alb-subsecao">PRÓXIMAS A COLAR</div>
          <div className="alb-grade" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: `10px ${gap}px` }}>
            {p.proximos.map((b, j) => <Vaga key={b.id} b={b} n={numeroDaFigurinha(adesivos, b.id)} tam={tam} indice={j} ativa={ativa} onSelecionar={onSelecionar} />)}
          </div>
        </>
      )}
      {grande && proximo && (
        <p className="alb-dica" data-testid="album-tela-dica">
          {p.vagas.length ? "As próximas já têm vaga marcada. " : "Cada coisa anotada cola uma figurinha aqui. "}
          A mais perto: <b>{proximo.name}</b> — <mark><Destacar texto={textoFalta(proximo, diasDeSequencia)} /></mark>.
        </p>
      )}
      <div className="alb-pag-num">{indice + 1} / {total}</div>
    </div>
  );
};

interface DetalheProps {
  b: Badge;
  n: number;
  desbloqueadoEm?: string;
  porRaridade: Record<Raridade, { abertos: number; total: number }>;
  diasDeSequencia: number;
  onFechar: () => void;
  onPostar: (b: Badge) => void;
  onIr: (caminho: string) => void;
}

/** O detalhe da vaga (folha por cima da mesa): "FIGURINHA Nº 46", o chip, o que falta ou quando colou. */
const DetalheFigurinha = ({ b, n, desbloqueadoEm, porRaridade, diasDeSequencia, onFechar, onPostar, onIr }: DetalheProps) => {
  const raridade = raridadeDe(b);
  const conta = porRaridade[raridade];
  const colada = desbloqueadoEm ? parseLocalDay(desbloqueadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }) : null;
  const destino = ROTA_PADRAO(b);
  return (
    <>
      <motion.div className="absolute inset-0 z-[5]" style={{ background: "rgba(0,0,0,.45)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onFechar} aria-hidden />
      <motion.div className="fig-detalhe" role="dialog" aria-modal="true" aria-label={b.name} data-testid="detalhe-vaga" data-vaga-detalhe={b.id} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 36 }}>
        <div className="fig-detalhe-puxador" />
        <div className="flex items-center gap-3.5">
          <span className="shrink-0 w-[116px] h-[116px] grid place-items-center"><AdesivoRaro id={b.id} raridade={raridade} tamanho={112} bordaGrossa trancado={!b.unlocked} /></span>
          <div className="min-w-0">
            <div className="pin-rot text-muted-foreground">Figurinha Nº {nDeDois(n)}</div>
            <div className="text-[20px] font-black tracking-tight leading-[1.1] mt-0.5 mb-1.5">{b.name}</div>
            <ChipRaridade raridade={raridade} tam="m" texto={b.unlocked ? RARIDADE_FEM[raridade] : `A caminho · ${RARIDADE_FEM[raridade]}`} />
          </div>
        </div>
        {b.unlocked ? (
          <p className="text-[13px] text-muted-foreground mt-3.5 leading-[1.4]">
            {colada ? <>Colada em <b className="text-foreground">{colada}</b>. </> : null}
            {conta ? `Uma das ${conta.total} ${RARIDADE_PLURAL[raridade]} do CORE` : RARIDADE_FEM[raridade]}{raridade === "epico" ? " — vem com a borda holográfica." : raridade === "lendario" ? " — brilha em ouro." : "."}
          </p>
        ) : (
          <>
            <p className="text-[13px] text-muted-foreground mt-3.5 leading-[1.4]">Falta <b className="text-foreground"><Destacar texto={textoFalta(b, diasDeSequencia)} /></b> pra colar.</p>
            {b.progresso && (
              <>
                <div className="det-barra"><i style={{ width: `${Math.round(fracaoDe(b) * 100)}%` }} /></div>
                <div className="text-[11px] font-extrabold text-muted-foreground mt-1 text-right tabular-nums">{rotuloProgresso(b)}</div>
              </>
            )}
          </>
        )}
        <div className="flex flex-col gap-1 mt-4">
          {b.unlocked ? (
            <button type="button" onClick={() => onPostar(b)} className="h-11 rounded-xl bg-foreground text-background font-bold text-[13.5px] inline-flex items-center justify-center gap-2" data-testid="vaga-postar">
              <Instagram className="w-4 h-4" aria-hidden /> Postar esta figurinha
            </button>
          ) : (
            <button type="button" onClick={() => onIr(destino.caminho)} className="h-11 rounded-xl bg-foreground text-background font-bold text-[13.5px] inline-flex items-center justify-center gap-2" data-testid="vaga-ir">
              Ir pra {destino.nome} <ChevronRight className="w-4 h-4" aria-hidden />
            </button>
          )}
          <button type="button" onClick={onFechar} className="h-10 rounded-xl text-[13px] font-bold text-muted-foreground">Fechar</button>
        </div>
      </motion.div>
    </>
  );
};

export interface AlbumTelaProps {
  aberto: boolean;
  paginas: PaginaAlbum[];
  adesivos: Badge[];
  desbloqueadas: Record<string, string>;
  /** Coladas desde a última abertura: colam com o pop quando a página aparece. */
  novas: string[];
  maisRaros: Badge[];
  abertos: number;
  total: number;
  porRaridade: Record<Raridade, { abertos: number; total: number }>;
  nome: string;
  nivel: string;
  ano: number;
  diasDeSequencia: number;
  onFechar: () => void;
  onCompartilhar: () => void;
  onCompartilharFigurinha: (b: Badge) => void;
}

export const AlbumTela = ({ aberto, paginas, adesivos, desbloqueadas, novas, maisRaros, abertos, total, porRaridade, nome, nivel, ano, diasDeSequencia, onFechar, onCompartilhar, onCompartilharFigurinha }: AlbumTelaProps) => {
  const reduzir = useReducedMotion();
  const navigate = useNavigate();
  const [atual, setAtual] = useState(0);
  const [virando, setVirando] = useState<{ p: PaginaAlbum; indice: number; dir: 1 | -1; chave: number } | null>(null);
  const [capaVisivel, setCapaVisivel] = useState(false);
  const [capaGirada, setCapaGirada] = useState(false);
  const [detalhe, setDetalhe] = useState<Badge | null>(null);
  const [largura, setLargura] = useState(330);
  const n = paginas.length;
  const novasSet = useRef<Set<string>>(new Set());

  useLayoutEffect(() => {
    if (typeof window !== "undefined") setLargura(Math.min(330, Math.max(240, window.innerWidth - 48)));
  }, [aberto]);

  // abrir: a capa vira na lombada e as figurinhas da 1ª página colam uma a uma
  useEffect(() => {
    if (!aberto) { setAtual(0); setVirando(null); setDetalhe(null); setCapaVisivel(false); setCapaGirada(false); return; }
    novasSet.current = new Set([...novas, ...paginas[0].vagas.map((b) => b.id)]);
    trackEvent("album_abrir", { adesivos: abertos, novas: novas.length });
    if (reduzir) return;
    setCapaVisivel(true);
    const t1 = setTimeout(() => setCapaGirada(true), 650);
    const t2 = setTimeout(() => setCapaVisivel(false), 650 + 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  // a tela por baixo não rola enquanto o álbum está aberto; Esc fecha
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (detalhe) setDetalhe(null);
      else onFechar();
    };
    window.addEventListener("keydown", tecla);
    return () => { document.body.style.overflow = anterior; window.removeEventListener("keydown", tecla); };
  }, [aberto, detalhe, onFechar]);

  const irPara = useCallback((i: number) => {
    const alvo = Math.max(0, Math.min(n - 1, i));
    if (alvo === atual) return;
    if (!reduzir) setVirando({ p: paginas[atual], indice: atual, dir: alvo > atual ? 1 : -1, chave: Date.now() });
    setAtual(alvo);
    trackEvent("album_pagina", { indice: alvo, secao: paginas[alvo]?.id });
  }, [atual, n, paginas, reduzir]);

  useEffect(() => {
    if (!virando) return;
    const t = setTimeout(() => setVirando(null), 600);
    return () => clearTimeout(t);
  }, [virando]);

  // cada figurinha cola UMA vez: depois que a página dela apareceu, sai da lista (voltar à página não cola de novo)
  useEffect(() => {
    if (!aberto) return;
    const ids = [...paginas[Math.min(atual, n - 1)].vagas, ...paginas[Math.min(atual, n - 1)].proximos].map((b) => b.id);
    const t = setTimeout(() => { for (const id of ids) novasSet.current.delete(id); }, 2600);
    return () => clearTimeout(t);
  }, [aberto, atual, paginas, n]);

  if (!aberto) return null;
  const pagina = paginas[Math.min(atual, n - 1)];
  const abas = [{ id: "mais-raros", rot: "★", rar: "destaque" as const }, ...ORDEM_RARIDADE.map((r) => ({ id: paginas.find((p) => p.raridade === r)?.id ?? "", rot: TITULO_SECAO[r].slice(0, 3), rar: r })).filter((s) => s.id)];
  const ativaAba = (s: { id: string; rar: string }) => pagina.id === s.id || (pagina.raridade && pagina.raridade === s.rar);
  const alturaCapa = Math.round(largura * 1.42);

  return (
    <motion.div className="alb-tela" role="dialog" aria-modal="true" aria-label="Álbum de figurinhas" data-testid="album-tela" data-atual={atual} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduzir ? 0.1 : 0.2 }}>
      <div className="alb-topo" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <button type="button" className="alb-redondo" onClick={onFechar} aria-label="Fechar o álbum" data-testid="album-fechar"><X className="w-5 h-5" /></button>
        <div className="flex-1 leading-[1.2] min-w-0">
          <b className="block text-[14px] font-black truncate">Álbum CORE {ano}</b>
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: "rgba(255,255,255,.65)" }}>{abertos} de {total} · faltam {total - abertos}</span>
        </div>
        <button type="button" className="alb-redondo" onClick={onCompartilhar} aria-label="Compartilhar meu álbum"><Instagram className="w-[18px] h-[18px]" /></button>
      </div>

      <div className="alb-mesa">
        <motion.div className="alb-livro" style={{ width: largura }} initial={reduzir ? false : { y: 26, scale: 0.965 }} animate={{ y: 0, scale: 1 }} transition={{ duration: 0.48, ease: "easeOut" }}>
          <div className="alb-lombada" />
          <div className="alb-pilha" />
          <div className="alb-folha" data-folha="" style={{ perspective: 1200 }}>
            <Pagina p={pagina} indice={atual} total={n} largura={largura} adesivos={adesivos} ativa colar={capaVisivel || novasSet.current.size ? novasSet.current : null} atrasoBase={capaVisivel ? 1350 : 260} diasDeSequencia={diasDeSequencia} onSelecionar={setDetalhe} />
            <AnimatePresence>
              {virando && (
                <motion.div key={virando.chave} className="alb-pag-vira" initial={{ rotateY: 0, opacity: 1 }} animate={{ rotateY: virando.dir > 0 ? -180 : 180, opacity: [1, 1, 0, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.56, ease: [0.45, 0, 0.55, 1] }} aria-hidden>
                  <Pagina p={virando.p} indice={virando.indice} total={n} largura={largura} adesivos={adesivos} ativa={false} colar={null} atrasoBase={0} diasDeSequencia={diasDeSequencia} onSelecionar={() => undefined} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="alb-abas" role="tablist" aria-label="Seções do álbum">
            {abas.map((s) => (
              <button key={s.id} type="button" role="tab" aria-selected={!!ativaAba(s)} className="alb-aba" data-rar={s.rar} data-ativa={ativaAba(s) ? "" : undefined} onClick={() => irPara(paginas.findIndex((p) => p.id === s.id))} data-testid={`album-aba-${s.rar}`}>{s.rot}</button>
            ))}
          </div>
          {/* a capa, por cima, girando na lombada ao abrir */}
          {capaVisivel && (
            <>
              <motion.div aria-hidden className="absolute inset-0" style={{ transformOrigin: "0 50%", transformStyle: "preserve-3d", backfaceVisibility: "hidden", zIndex: capaGirada ? 0 : 6, borderRadius: "6px 14px 14px 6px" }} initial={{ rotateY: 0 }} animate={{ rotateY: capaGirada ? -172 : 0 }} transition={{ duration: 0.76, ease: [0.45, 0, 0.55, 1] }} data-testid="album-capa-3d">
                <CapaAlbum largura={largura} altura={alturaCapa} maisRaros={maisRaros} abertos={abertos} total={total} nome={nome} ano={ano} style={{ height: "100%" }} />
              </motion.div>
              <motion.div aria-hidden className="absolute inset-0 pointer-events-none" style={{ zIndex: 5, borderRadius: "6px 14px 14px 6px", background: "linear-gradient(90deg, rgba(0,0,0,.45), rgba(0,0,0,0) 70%)" }} initial={{ opacity: 0 }} animate={{ opacity: capaGirada ? [0, 0.45, 0] : 0 }} transition={{ duration: 0.76 }} />
            </>
          )}
        </motion.div>
        <div className="alb-nav2">
          <button type="button" className="alb-seta" onClick={() => irPara(atual - 1)} disabled={atual === 0} aria-label="Página anterior" data-testid="album-tela-anterior"><ChevronLeft className="w-5 h-5" /></button>
          <div className="alb-dots2" aria-hidden>
            {paginas.map((p, i) => <i key={p.id} data-rar={p.raridade ?? "destaque"} data-ativo={i === atual ? "" : undefined} />)}
          </div>
          <button type="button" className="alb-seta" onClick={() => irPara(atual + 1)} disabled={atual >= n - 1} aria-label="Próxima página" data-testid="album-tela-proxima"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="alb-rodape2">
        <button type="button" onClick={onCompartilhar} className="w-full h-11 rounded-xl font-bold text-[13.5px] inline-flex items-center justify-center gap-2" style={{ background: "#fff", color: "#2b2b2f" }} data-testid="album-tela-compartilhar">
          Compartilhar meu álbum
        </button>
        <div className="alb-rodape2-linha"><span>{resumoRaridades(porRaridade)}</span><span>Nível {nivel}</span></div>
      </div>

      <AnimatePresence>
        {detalhe && (
          <DetalheFigurinha
            key={detalhe.id}
            b={detalhe}
            n={numeroDaFigurinha(adesivos, detalhe.id)}
            desbloqueadoEm={desbloqueadas[detalhe.id]}
            porRaridade={porRaridade}
            diasDeSequencia={diasDeSequencia}
            onFechar={() => setDetalhe(null)}
            onPostar={(b) => { setDetalhe(null); onCompartilharFigurinha(b); }}
            onIr={(caminho) => { setDetalhe(null); onFechar(); navigate(caminho); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
