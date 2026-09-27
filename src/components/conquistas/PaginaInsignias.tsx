import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { Insignia } from "./Insignia";
import { NOME_FAIXA, fraseDe, linhaDe, type Insignia as DadosInsignia, type PaginaOrdenada } from "./insignias";
import { SeloNivel } from "./SeloNivel";
import "./conquistas.css";

/**
 * A PÁGINA DAS INSÍGNIAS dentro do planner (27/09; a moldura fixa em 27/09 à
 * noite — dono: "quero que fique nesta proporção, não precisa alongar o
 * planner"). A página tem EXATAMENTE o tamanho da capa fechada; o que cabe é
 * o conteúdo:
 *
 *   1ª página · o HERÓI à esquerda (a conquista do mês, com a frase em serif
 *   e "19 treinos · OURO") e 4 insígnias em 2 × 2 à direita;
 *   páginas seguintes · grades de 4 × 2 (primeiro as com dado, por orgulho ×
 *   faixa; depois as trancadas em contorno com o progresso), deslizando
 *   como o álbum (scroll-snap), com as bolinhas e as setas;
 *   rodapé · o selo, "Nível Ouro · 1.200 XP · faltam 400 pra Platina",
 *   "27 insígnias · 2 de ouro · 3 com R$/peso escondidas" e "27 de 53".
 *
 * As ações ("Postar minha conquista", "Fechar o planner") ficam FORA da
 * moldura, no PlannerAberto. Só a página atual e as vizinhas montam.
 */

export interface Geometria {
  W: number; H: number; padE: number; padD: number; padT: number; padB: number;
  cab: number; dots: number; rodape: number; corpo: number; linha: number;
  pinGrade: number; heroiPin: number; heroiCol: number; gradeDir: number; pinDireita: number; porPagina: number;
}

/** Tudo cabe na moldura (largura × altura da capa): os tamanhos dos pins vêm daqui. */
/** Coluna do herói de cima pra baixo, em px: rótulo, respiro, [pin], respiro, frase (2 linhas), respiro, linha do valor.
 *  A geometria desconta EXATAMENTE isto do corpo — antes descontava 62 de 68 e o flex espremia o rótulo
 *  (o acento de "MÊS" sumia no Android, 27/09) e cortaria a 2ª linha da frase. */
export const COLUNA_HEROI = { rotulo: 11, antesPin: 3, antesFrase: 6, frase: 30, antesLinha: 4, linha: 14 } as const;
const RESTO_DA_COLUNA = Object.values(COLUNA_HEROI).reduce((a, b) => a + b, 0);

export const geometriaDaPagina = (largura: number, altura: number): Geometria => {
  const padE = 24, padD = 14, padT = 10, padB = 8;
  const W = largura - padE - padD;
  const H = altura - padT - padB;
  const cab = 12, dots = 14, rodape = 28, gaps = 5 + 4 + 3;
  const corpo = Math.max(100, Math.floor(H - cab - dots - rodape - gaps));
  const linha = Math.floor((corpo - 6) / 2);
  const nome = 20;
  const pinGrade = Math.max(40, Math.min(linha - nome - 3, Math.floor(W / 4) - 8));
  const heroiPin = Math.max(72, Math.floor(corpo - RESTO_DA_COLUNA));
  const heroiCol = heroiPin + 8;
  const gradeDir = W - heroiCol - 8;
  const pinDireita = Math.max(40, Math.min(linha - nome - 3, Math.floor(gradeDir / 2) - 10));
  return { W, H, padE, padD, padT, padB, cab, dots, rodape, corpo, linha, pinGrade, heroiPin, heroiCol, gradeDir, pinDireita, porPagina: 8 };
};

/** Quantas da 1ª página vão à direita do herói; o resto em páginas de `porPagina`. */
export const NA_PRIMEIRA = 4;
export const paginasDoResto = (resto: DadosInsignia[], comHeroi: boolean, porPagina = 8): DadosInsignia[][] => {
  const primeira = comHeroi ? resto.slice(0, NA_PRIMEIRA) : resto.slice(0, porPagina);
  const out: DadosInsignia[][] = [primeira];
  for (let i = primeira.length; i < resto.length; i += porPagina) out.push(resto.slice(i, i + porPagina));
  return out;
};

export interface DadosPagina {
  ordenada: PaginaOrdenada;
  nivel: string;
  xp: number;
  faltaXp: number;
  proximoNivel: string | null;
  /** "SETEMBRO · 2026" */
  mes: string;
  mesIdx: number;
  total: number;
  valoresLigados: boolean;
}

interface Props extends DadosPagina {
  largura: number;
  altura: number;
  /** Primeira abertura: os pins caem e prendem, os números contam de zero. */
  animar: boolean;
  reduzir: boolean;
  onSelecionar: (i: DadosInsignia) => void;
  onValores: () => void;
}

const Vaga = ({ i, tam, indice, animar, ativa, onSelecionar }: { i: DadosInsignia; tam: number; indice: number; animar: boolean; ativa: boolean; onSelecionar: (i: DadosInsignia) => void }) => {
  const trancada = !i.faixa;
  return (
    <button type="button" className="pin-vaga" onClick={() => onSelecionar(i)} tabIndex={ativa ? 0 : -1} data-vaga={i.id} data-faixa={i.faixa ?? "trancada"} style={{ width: tam + 16 }}>
      <span className="pin-obj">
        <Insignia ins={i} tamanho={tam} trancada={trancada} entrada={animar ? 330 + indice * 95 : undefined} contar={animar} />
        {trancada && i.valor > 0 && i.proxima && <span className="pin-pill" data-testid="pilula-insignia">{i.texto}/{i.proxima.alvo}</span>}
      </span>
      <span className="pin-nome" data-falta={trancada ? "" : undefined} style={{ height: 20 }}>{i.nome}</span>
    </button>
  );
};

const Heroi = ({ h, conquistado, g, mesIdx, animar, estreita, onSelecionar }: { h: DadosInsignia; conquistado: boolean; g: Geometria; mesIdx: number; animar: boolean; estreita: boolean; onSelecionar: (i: DadosInsignia) => void }) => {
  const falta = h.proxima ? Math.max(0, h.proxima.alvo - h.valor) : 0;
  return (
    <button type="button" className="flex flex-col items-center text-left shrink-0" style={{ width: g.heroiCol, height: g.corpo }} onClick={() => onSelecionar(h)} data-heroi={h.id} data-testid="heroi-insignia">
      <span className="pin-rot text-muted-foreground w-full text-center overflow-hidden text-ellipsis shrink-0" style={{ fontSize: 8, height: COLUNA_HEROI.rotulo, lineHeight: `${COLUNA_HEROI.rotulo}px`, letterSpacing: estreita || !conquistado ? ".08em" : undefined }}>{conquistado ? (estreita ? "Conquista do mês" : "A conquista do mês") : "Primeiras insígnias"}</span>
      <span className="pin-obj shrink-0" style={{ marginTop: COLUNA_HEROI.antesPin }}>
        <Insignia ins={h} tamanho={g.heroiPin} entrada={animar ? 330 : undefined} contar={animar} />
      </span>
      <span className="pin-frase w-full text-center shrink-0" style={{ marginTop: COLUNA_HEROI.antesFrase, height: COLUNA_HEROI.frase }}>
        {conquistado ? fraseDe(h, mesIdx) : `${h.texto} ${h.unid}. Faltam ${falta} pro bronze.`}
      </span>
      <span className="flex items-center justify-center gap-1.5 w-full shrink-0" style={{ marginTop: COLUNA_HEROI.antesLinha, height: COLUNA_HEROI.linha }}>
        <span className="text-[10.5px] font-bold text-muted-foreground truncate">{conquistado ? linhaDe(h, mesIdx) : "cada registro conta"}</span>
        {conquistado && h.faixa && <span className="chip-faixa" data-faixa={h.faixa}>{NOME_FAIXA[h.faixa]}</span>}
      </span>
    </button>
  );
};

export const PaginaInsignias = ({ ordenada, nivel, xp, faltaXp, proximoNivel, mes, mesIdx, total, valoresLigados, largura, altura, animar, reduzir, onSelecionar, onValores }: Props) => {
  const g = geometriaDaPagina(largura, altura);
  const { heroi, heroiConquistado, resto, escondidas, conquistadas, deOuro } = ordenada;
  const paginas = paginasDoResto(resto, !!heroi, g.porPagina);
  const n = paginas.length;
  const trilho = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);

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

  const vistas = useRef(new Set<number>([0]));
  useEffect(() => {
    if (vistas.current.has(atual)) return;
    vistas.current.add(atual);
    trackEvent("insignias_pagina", { indice: atual });
  }, [atual]);

  const visiveis = total - escondidas;
  // 360 px: o rótulo do herói e o rodapé encurtam (senão a 2ª linha corta justamente o "mostrar valores")
  const estreita = largura < 350;
  const linhaNivel = proximoNivel
    ? ` · faltam ${faltaXp.toLocaleString("pt-BR")}${estreita ? "" : ` pra ${proximoNivel}`}`
    : " · o nível mais alto";
  const linkValores = valoresLigados ? (estreita ? "R$ visíveis" : "R$ e peso visíveis") : estreita ? `${escondidas} com R$ escondidas` : `${escondidas} com R$/peso escondidas`;

  return (
    <div data-testid="pagina-insignias-miolo" data-pagina-atual={atual} style={{ width: g.W, height: g.H, display: "flex", flexDirection: "column" }}>
      <div className="flex items-center" style={{ height: g.cab }}>
        <span className="pin-rot" style={{ color: "hsl(var(--accent))" }}>Minhas insígnias{n > 1 && atual > 0 ? ` · ${atual + 1}/${n}` : ""}</span>
        <span className="ml-auto pin-rot text-muted-foreground">{mes}</span>
      </div>

      <div
        ref={trilho}
        className="pin-trilho"
        role="region"
        aria-roledescription="carrossel"
        aria-label="Páginas das insígnias"
        tabIndex={0}
        onScroll={aoRolar}
        onKeyDown={teclado}
        style={{ height: g.corpo, marginTop: 5 }}
      >
        {paginas.map((lista, p) => {
          const ativa = p === atual;
          const montar = Math.abs(p - atual) <= 1;
          return (
            <div key={p} className="pin-pagina" role="group" aria-roledescription="página" aria-label={`Página ${p + 1} de ${n}`} aria-hidden={!ativa} data-testid={`insignias-pagina-${p}`}>
              {montar && (p === 0 && heroi ? (
                <div className="flex items-start" style={{ gap: 8, height: g.corpo }}>
                  <Heroi h={heroi} conquistado={heroiConquistado} g={g} mesIdx={mesIdx} animar={animar} estreita={estreita} onSelecionar={onSelecionar} />
                  <div className="grid grid-cols-2 justify-items-center content-start" style={{ width: g.gradeDir, rowGap: 6, columnGap: 4 }}>
                    {lista.map((i, k) => <Vaga key={i.id} i={i} tam={g.pinDireita} indice={k + 1} animar={animar} ativa={ativa} onSelecionar={onSelecionar} />)}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 justify-items-center content-start" style={{ rowGap: 6, columnGap: 2, height: g.corpo }}>
                  {lista.map((i, k) => <Vaga key={i.id} i={i} tam={g.pinGrade} indice={k} animar={animar && p === 0} ativa={ativa} onSelecionar={onSelecionar} />)}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center" style={{ height: g.dots, marginTop: 4 }} data-testid="insignias-dots">
        <button type="button" className="pin-seta" onClick={() => irPara(atual - 1)} disabled={atual === 0} aria-label="Página anterior" data-testid="insignias-anterior"><ChevronLeft className="w-3.5 h-3.5" aria-hidden /></button>
        <div className="pin-dots" role="tablist" aria-label="Páginas">
          {paginas.map((_, i) => (
            <button key={i} type="button" role="tab" aria-selected={i === atual} aria-label={`Página ${i + 1}`} className="pin-dot" data-ativo={i === atual ? "" : undefined} onClick={() => irPara(i)}><i /></button>
          ))}
        </div>
        <button type="button" className="pin-seta" onClick={() => irPara(atual + 1)} disabled={atual >= n - 1} aria-label="Próxima página" data-testid="insignias-proxima"><ChevronRight className="w-3.5 h-3.5" aria-hidden /></button>
      </div>

      <div className="flex items-center gap-2 border-t border-dashed border-border text-muted-foreground" style={{ height: g.rodape, marginTop: 3, paddingTop: 3 }} data-testid="insignias-resumo">
        <SeloNivel nivel={nivel} tamanho={24} />
        <span className="min-w-0 flex-1 leading-[1.2]" style={{ fontSize: 9.5 }}>
          <span className="block truncate"><b className="text-foreground">Nível {nivel}</b> · {xp.toLocaleString("pt-BR")} XP{linhaNivel}</span>
          <span className="block truncate" style={{ fontSize: 9 }}>
            {conquistadas} {conquistadas === 1 ? "insígnia" : "insígnias"}{estreita ? "" : ` · ${deOuro} de ouro`}
            {" · "}
            <button type="button" onClick={onValores} className="underline underline-offset-2 decoration-dotted" data-testid="insignias-valores">
              {linkValores}
            </button>
          </span>
        </span>
        <span className="shrink-0 text-right leading-[1.05] tabular-nums whitespace-nowrap" style={{ fontSize: 8.5 }}>
          <b className="text-foreground" style={{ fontSize: 12 }}>{conquistadas}</b> de {visiveis}
          <br />
          insígnias
        </span>
      </div>
    </div>
  );
};
