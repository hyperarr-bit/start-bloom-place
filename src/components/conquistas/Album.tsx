import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { animate } from "framer-motion";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { RARIDADE_LABEL, raridadeDe, type Badge, type Raridade } from "@/components/gamification/types";
import { rotuloProgresso, textoFalta } from "@/lib/conquistas-registro";
import { trackEvent } from "@/lib/analytics";
import { AdesivoRaro } from "./adesivos-raridade";
import { giroDoAdesivo } from "./adesivos-arte";
import { Destacar } from "./GradeAdesivos";
import { SeloNivel } from "./SeloNivel";
import { contagemDaPagina, resumoRaridades, tituloDaPagina, type PaginaAlbum } from "./album-paginas";
import "./conquistas.css";

/**
 * O ÁLBUM DENTRO DO PLANNER (27/09): "MEU ÁLBUM · SETEMBRO · 2026", páginas
 * que viram com o dedo (scroll-snap nativo), pelos botões ‹ › ou pelas setas
 * do teclado, as bolinhas de página e, no rodapé, o nível, o XP que falta e
 * quantos adesivos de cada raridade. A 1ª página são os mais raros (3 × 2,
 * grandes, com o chip); as outras são a coleção por raridade (4 × 3), com a
 * vaga tracejada + silhueta + progresso no lugar do que falta. Ao abrir, os
 * mais raros pipocam um a um e os contadores contam de zero. Toque num
 * adesivo abre o detalhe de sempre.
 */

export interface DadosAlbum {
  paginas: PaginaAlbum[];
  nivel: string;
  xp: number;
  faltaXp: number;
  proximoNivel: string | null;
  adesivos: number;
  total: number;
  porRaridade: Record<Raridade, { abertos: number; total: number }>;
  /** "SETEMBRO · 2026" */
  mes: string;
  diasDeSequencia: number;
}

interface Props extends DadosAlbum {
  /** Largura útil da página (sem o recuo dos furos). */
  largura: number;
  /** Primeira abertura: pipoca e conta de zero. */
  animar: boolean;
  reduzir: boolean;
  onSelecionar: (b: Badge) => void;
}

/** Conta de zero até `ate` na abertura (com `animar`); depois disso mostra o número direto. */
const Contador = ({ ate, animar, atraso = 0 }: { ate: number; animar: boolean; atraso?: number }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!animar || !el) return;
    el.textContent = "0";
    const c = animate(0, ate, {
      duration: 0.7,
      delay: atraso / 1000,
      ease: "easeOut",
      onUpdate: (v) => { el.textContent = String(Math.round(v)); },
      onComplete: () => { el.textContent = String(ate); },
    });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animar]);
  return <span ref={ref}>{ate}</span>;
};

const Vaga = ({ b, tam, indice, grande, pop, ativa, onSelecionar }: { b: Badge; tam: number; indice: number; grande: boolean; pop: boolean; ativa: boolean; onSelecionar: (b: Badge) => void }) => {
  const raridade = raridadeDe(b);
  const rotulo = b.unlocked ? null : rotuloProgresso(b);
  return (
    <button
      type="button"
      onClick={() => onSelecionar(b)}
      tabIndex={ativa ? 0 : -1}
      data-vaga={b.id}
      data-aberto={b.unlocked ? "true" : "false"}
      data-raridade={raridade}
      className={`alb-vaga${pop ? " alb-pop" : ""}`}
      style={{ "--d": `${pop ? 380 + indice * 110 : 0}ms`, width: grande ? tam + 12 : tam + 4 } as CSSProperties}
    >
      <span className="alb-slot" data-vazia={b.unlocked ? undefined : ""} data-rar={raridade} style={{ width: tam, height: tam }}>
        <AdesivoRaro id={b.id} raridade={raridade} tamanho={tam} trancado={!b.unlocked} giro={b.unlocked ? giroDoAdesivo(indice) : 0} bordaGrossa={grande} />
        {!b.unlocked && (
          <span className="ad-pill" data-testid="pilula-progresso">
            {rotulo ?? <Lock className="w-3 h-3" aria-label="Trancado" />}
          </span>
        )}
      </span>
      <span className={`alb-nome ${b.unlocked ? "text-foreground" : "text-muted-foreground"}`}>{b.name}</span>
      {/* o chip diz a raridade; no que falta diz "a caminho" (a cor do chip já é a da raridade) */}
      {grande && (raridade !== "comum" || !b.unlocked) && (
        <span className="chip-rar" data-rar={raridade} style={{ height: 15, fontSize: 8 }}>
          {b.unlocked ? RARIDADE_LABEL[raridade] : "A caminho"}
        </span>
      )}
    </button>
  );
};

const Pagina = ({ p, indice, total, ativa, largura, animar, diasDeSequencia, onSelecionar }: { p: PaginaAlbum; indice: number; total: number; ativa: boolean; largura: number; animar: boolean; diasDeSequencia: number; onSelecionar: (b: Badge) => void }) => {
  const grande = p.tipo === "mais-raros";
  const colunas = grande ? 3 : 4;
  const gap = grande ? 8 : 4;
  const tam = grande
    ? Math.max(76, Math.min(96, Math.floor((largura - gap * 2) / 3) - 12))
    : Math.max(56, Math.min(72, Math.floor((largura - gap * 3) / 4) - 4));
  const itens = [...p.vagas, ...p.proximos];
  const proximo = p.proximos[0];
  return (
    <div
      className="alb-pagina"
      role="group"
      aria-roledescription="página"
      aria-label={`${tituloDaPagina(p)}, página ${indice + 1} de ${total}`}
      aria-hidden={!ativa}
      data-pagina={p.id}
      data-testid={`album-pagina-${indice}`}
    >
      <div className="grid justify-items-center" style={{ gridTemplateColumns: `repeat(${colunas}, 1fr)`, gap: `${grande ? 8 : 2}px ${gap}px`, marginTop: 8 }}>
        {itens.map((b, i) => (
          <Vaga key={b.id} b={b} tam={tam} indice={i} grande={grande} pop={animar && grande} ativa={ativa} onSelecionar={onSelecionar} />
        ))}
      </div>
      {grande && proximo && (
        <p className="text-[11px] text-muted-foreground mt-2.5 leading-[1.35]" data-testid="album-incentivo">
          {p.vagas.length ? "Os próximos já têm vaga marcada. " : "Cada coisa anotada cola um adesivo aqui. "}
          O mais perto: <b className="text-foreground">{proximo.name}</b> — <Destacar texto={textoFalta(proximo, diasDeSequencia)} />.
        </p>
      )}
    </div>
  );
};

export const AlbumDeAdesivos = ({ paginas, nivel, xp, faltaXp, proximoNivel, adesivos, total, porRaridade, mes, diasDeSequencia, largura, animar, reduzir, onSelecionar }: Props) => {
  const trilho = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);
  const n = paginas.length;
  const pagina = paginas[Math.min(atual, n - 1)];

  const irPara = useCallback((i: number) => {
    const alvo = Math.max(0, Math.min(n - 1, i));
    const el = trilho.current;
    if (el) {
      const x = alvo * el.clientWidth;
      if (typeof el.scrollTo === "function") el.scrollTo({ left: x, behavior: reduzir ? "auto" : "smooth" });
      else el.scrollLeft = x;
    }
    setAtual(alvo);
  }, [n, reduzir]);

  // com o dedo: a página atual é a que ficou na frente
  const aoRolar = () => {
    const el = trilho.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== atual && i >= 0 && i < n) setAtual(i);
  };

  const teclado = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); irPara(atual - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); irPara(atual + 1); }
    else if (e.key === "Home") { e.preventDefault(); irPara(0); }
    else if (e.key === "End") { e.preventDefault(); irPara(n - 1); }
  };

  // uma vez por página vista nesta abertura (a 1ª não conta: é o planner_abrir)
  const vistas = useRef(new Set<number>([0]));
  useEffect(() => {
    if (vistas.current.has(atual)) return;
    vistas.current.add(atual);
    trackEvent("album_pagina", { indice: atual, secao: paginas[atual]?.id });
  }, [atual, paginas]);

  return (
    <div data-testid="album" data-pagina-atual={atual}>
      <div className="flex items-center">
        <span className="text-[9.5px] font-extrabold tracking-[.18em] uppercase" style={{ color: "hsl(var(--accent))" }}>Meu álbum</span>
        <span className="ml-auto text-[9.5px] font-extrabold tracking-[.18em] uppercase text-muted-foreground">{mes}</span>
      </div>

      {/* ‹ TÍTULO · X de Y › */}
      <div className="flex items-center gap-1 mt-2">
        <button type="button" className="alb-nav" onClick={() => irPara(atual - 1)} disabled={atual === 0} aria-label="Página anterior" data-testid="album-anterior">
          <ChevronLeft className="w-4 h-4" aria-hidden />
        </button>
        {/* título em cima, contagem embaixo: as duas linhas cabem nos 30 px do botão e nada corre por baixo dele no 360 */}
        <div className="flex-1 min-w-0 leading-[1.15]">
          <div className="text-[11px] font-black tracking-[.12em] truncate" data-testid="album-titulo">{tituloDaPagina(pagina)}</div>
          <div className="text-[10px] font-bold text-muted-foreground tabular-nums truncate" data-testid="album-contagem">
            {pagina.tipo === "mais-raros" ? (
              <><Contador ate={pagina.abertos} animar={animar} /> de {pagina.total}</>
            ) : (
              contagemDaPagina(pagina)
            )}
          </div>
        </div>
        <button type="button" className="alb-nav" onClick={() => irPara(atual + 1)} disabled={atual >= n - 1} aria-label="Próxima página" data-testid="album-proxima">
          <ChevronRight className="w-4 h-4" aria-hidden />
        </button>
      </div>

      <div
        ref={trilho}
        className="alb-trilho"
        role="region"
        aria-roledescription="carrossel"
        aria-label="Páginas do álbum"
        tabIndex={0}
        onScroll={aoRolar}
        onKeyDown={teclado}
      >
        {paginas.map((p, i) => (
          <Pagina key={p.id} p={p} indice={i} total={n} ativa={i === atual} largura={largura} animar={animar} diasDeSequencia={diasDeSequencia} onSelecionar={onSelecionar} />
        ))}
      </div>

      <div className="alb-dots mt-2" role="tablist" aria-label="Páginas">
        {paginas.map((p, i) => (
          <button key={p.id} type="button" role="tab" aria-selected={i === atual} aria-label={tituloDaPagina(p)} className="alb-dot" data-ativo={i === atual ? "" : undefined} onClick={() => irPara(i)}>
            <i />
          </button>
        ))}
      </div>

      {/* rodapé: nível, XP que falta, adesivos por raridade */}
      <div className="flex items-center gap-2.5 mt-2.5 pt-2.5 border-t border-dashed border-border text-[11px] text-muted-foreground" data-testid="album-resumo">
        <SeloNivel nivel={nivel} tamanho={34} />
        <span className="min-w-0 flex-1 leading-[1.3]">
          <b className="text-foreground">Nível {nivel}</b> · {xp.toLocaleString("pt-BR")} XP
          {proximoNivel ? ` · faltam ${faltaXp.toLocaleString("pt-BR")} pra ${proximoNivel}` : " · o nível mais alto"}
          <br />
          <span className="text-[10.5px]">{resumoRaridades(porRaridade)}</span>
        </span>
        <span className="shrink-0 tabular-nums text-right whitespace-nowrap leading-tight">
          <b className="text-foreground text-[13px]"><Contador ate={adesivos} animar={animar} atraso={120} /> de {total}</b>
          <br />
          adesivos
        </span>
      </div>
    </div>
  );
};
