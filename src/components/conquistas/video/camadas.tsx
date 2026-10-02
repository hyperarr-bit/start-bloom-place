import { raridadeDe } from "@/components/gamification/types";
import { metalDaInsignia } from "../Insignia";
import { BLOCO_NOME_FOTO, CapaAlbumFoto, CelulaFigurinhaFoto, FITA_FOTO, GRADE_FOTO, LIVRO_FOTO, OBJETO_CONQUISTA, STORIES, StoriesAlbum, StoriesConquista, StoriesTres, TEXTO_CONQUISTA } from "../Stories";
import { gerarCanvas } from "../gerar-imagem";
import type { ArteComVideo, DadosArtes } from "../artes-dados";
import type { Insignia } from "../insignias";
import { DURACAO, desenharQuadro, type AdesivoAnimado, type Camadas } from "./animacao";
import { DURACAO_CONQUISTA, DURACAO_TRES, desenharQuadroConquista, desenharQuadroTres, type CamadasConquista, type CamadasTres } from "./animacao-conquista";

/**
 * AS CAMADAS DOS VÍDEOS (27/09): fotografa uma vez cada peça parada com o
 * html-to-image (a mesma foto das artes) e o canvas só move. Cada arte vira
 * um ROTEIRO (duração + a função que pinta o instante t):
 *
 *  - álbum: fundo, capa do álbum, página sem as figurinhas, o sprite das
 *    figurinhas (as células lado a lado) e o bloco do nome — 5 fotos;
 *  - conquista: fundo, fita, o pin SEM número e o bloco de texto — 4 fotos;
 *  - 3 conquistas: 3 × (fundo com o marcador, fita, pin, texto) + o resumo.
 *
 * Guarda os últimos roteiros por (arte, dados): a prévia ao vivo prepara, e
 * o "Postar vídeo" logo depois reaproveita sem fotografar de novo.
 */

export interface Roteiro {
  duracao: number;
  desenhar: (ctx: CanvasRenderingContext2D, t: number, escala: number) => void;
}

export const MARGEM = 120;
/** O sprite tem 16 px de folga em cima: a borda branca da figurinha não pode ser cortada. */
const FOLGA_SPRITE = 16;

const chaveDe = (arte: ArteComVideo, d: DadosArtes) =>
  JSON.stringify([
    arte, d.nome, d.membroDesde, d.dias, d.nivel, d.xp, d.adesivos, d.total, d.mes, d.mesIdx, d.ano, d.valoresLigados,
    d.heroi ? [d.heroi.id, d.heroi.valor, d.heroi.sub] : null,
    d.tres.map((i) => [i.id, i.valor, i.sub]),
    d.maisRaros.map((b) => b.id),
    d.proximos.map((b) => [b.id, b.progresso?.atual ?? null]),
    Object.values(d.porRaridade).map((r) => r.abertos),
  ]);

const cache = new Map<string, Promise<Roteiro | null>>();

type Etapa = (feita: number, de: number) => void;

async function montarAlbum(d: DadosArtes, passo: () => void): Promise<Camadas | null> {
  const comMargem = { largura: LIVRO_FOTO.w + 2 * MARGEM, altura: LIVRO_FOTO.h + 2 * MARGEM };
  const envelope = (filho: JSX.Element, sombra: string) => (
    <div style={{ position: "relative", width: comMargem.largura, height: comMargem.altura }}>
      <div style={{ position: "absolute", left: MARGEM, top: MARGEM, borderRadius: "10px 44px 44px 10px", boxShadow: sombra }}>{filho}</div>
    </div>
  );
  const fundo = await gerarCanvas(<StoriesAlbum {...d} parte="fundo" />, { largura: STORIES.w, altura: STORIES.h });
  passo();
  const capa = await gerarCanvas(envelope(<CapaAlbumFoto maisRaros={d.maisRaros} adesivos={d.adesivos} total={d.total} nome={d.nome} ano={d.ano} capa={d.capa} nivel={d.nivel} />, "none"), comMargem);
  passo();
  const pagina = await gerarCanvas(envelope(<StoriesAlbum {...d} parte="pagina" />, "0 60px 90px -40px rgba(0,0,0,.45)"), comMargem);
  passo();
  const abertos = d.maisRaros.slice(0, GRADE_FOTO.colunas * 2);
  const alturaSprite = GRADE_FOTO.alt + FOLGA_SPRITE;
  const numero = (id: string) => d.figurinhas.findIndex((b) => b.id === id) + 1;
  const sprite = abertos.length
    ? await gerarCanvas(
        <div style={{ display: "flex", width: abertos.length * GRADE_FOTO.cel, height: alturaSprite, paddingTop: FOLGA_SPRITE, boxSizing: "border-box" }}>
          {abertos.map((b, i) => <CelulaFigurinhaFoto key={b.id} b={b} n={numero(b.id)} indice={i} semAnel />)}
        </div>,
        { largura: abertos.length * GRADE_FOTO.cel, altura: alturaSprite },
      )
    : null;
  passo();
  const texto = await gerarCanvas(<StoriesAlbum {...d} parte="texto" />, { largura: STORIES.w, altura: BLOCO_NOME_FOTO.h });
  passo();
  if (!fundo || !capa || !pagina || !texto || (abertos.length && !sprite)) return null;

  const adesivos: AdesivoAnimado[] = abertos.map((b, i) => {
    const col = i % GRADE_FOTO.colunas, lin = Math.floor(i / GRADE_FOTO.colunas);
    const x = LIVRO_FOTO.x + GRADE_FOTO.esq + col * (GRADE_FOTO.cel + GRADE_FOTO.gap);
    const y = LIVRO_FOTO.y + GRADE_FOTO.topo + lin * (GRADE_FOTO.alt + GRADE_FOTO.gap);
    // o centro da figurinha na célula (ver CelulaFigurinhaFoto: (cel − tam) / 2 + 4 do topo)
    return {
      sx: i * GRADE_FOTO.cel, sy: 0, sw: GRADE_FOTO.cel, sh: alturaSprite,
      x, y: y - FOLGA_SPRITE, w: GRADE_FOTO.cel, h: alturaSprite,
      cx: x + GRADE_FOTO.cel / 2, cy: y + (GRADE_FOTO.cel - GRADE_FOTO.tam) / 2 + 4 + GRADE_FOTO.tam / 2, tam: GRADE_FOTO.tam,
      raridade: raridadeDe(b),
    };
  });
  return {
    fundo, capa, pagina, margem: MARGEM, espiral: null, espiralW: 0, sprite, adesivos, texto,
    textoY: BLOCO_NOME_FOTO.y, textoH: BLOCO_NOME_FOTO.h,
    caixa: { x: LIVRO_FOTO.x, y: LIVRO_FOTO.y, w: LIVRO_FOTO.w, h: LIVRO_FOTO.h },
    dobra: LIVRO_FOTO.x + LIVRO_FOTO.lombada,
  };
}

async function montarConquista(ins: Insignia, d: DadosArtes, passo: () => void, marcador?: string): Promise<CamadasConquista | null> {
  const pessoa = { nome: d.nome, membroDesde: d.membroDesde, nivel: d.nivel, mesIdx: d.mesIdx, ano: d.ano };
  const fundo = await gerarCanvas(<StoriesConquista ins={ins} {...pessoa} parte="fundo" />, { largura: STORIES.w, altura: STORIES.h });
  passo();
  const fita = await gerarCanvas(<StoriesConquista ins={ins} {...pessoa} parte="fita" marcador={marcador} />, { largura: STORIES.w, altura: FITA_FOTO.h });
  passo();
  const objeto = await gerarCanvas(<StoriesConquista ins={ins} {...pessoa} parte="objeto" />, { largura: OBJETO_CONQUISTA.tam, altura: OBJETO_CONQUISTA.tam });
  passo();
  const texto = await gerarCanvas(<StoriesConquista ins={ins} {...pessoa} parte="texto" />, { largura: STORIES.w, altura: TEXTO_CONQUISTA.h });
  passo();
  if (!fundo || !fita || !objeto || !texto) return null;
  return {
    fundo, fita, objeto, texto,
    pin: { forma: ins.forma, metal: metalDaInsignia(ins), valor: ins.valor, fmt: ins.fmt, arredonda: ins.fmt === "int" || ins.fmt === "pct" || ins.fmt === "pctneg" },
  };
}

async function montar(arte: ArteComVideo, d: DadosArtes, onEtapa?: Etapa): Promise<Roteiro | null> {
  let feitas = 0;
  const total = arte === "album" ? 5 : arte === "conquista" ? 4 : 13;
  const passo = () => onEtapa?.(++feitas, total);
  if (arte === "album") {
    const c = await montarAlbum(d, passo);
    return c ? { duracao: DURACAO, desenhar: (ctx, t, escala) => desenharQuadro(ctx, c, t, escala) } : null;
  }
  if (arte === "conquista") {
    if (!d.heroi) return null;
    const c = await montarConquista(d.heroi, d, passo);
    return c ? { duracao: DURACAO_CONQUISTA, desenhar: (ctx, t, escala) => desenharQuadroConquista(ctx, c, t, escala) } : null;
  }
  const tres = d.tres.slice(0, 3);
  if (tres.length < 3) return null;
  const cenas: CamadasConquista[] = [];
  for (let i = 0; i < 3; i++) {
    const c = await montarConquista(tres[i], d, passo, `${i + 1}/3`);
    if (!c) return null;
    cenas.push(c);
  }
  const resumo = await gerarCanvas(<StoriesTres tres={tres} nome={d.nome} membroDesde={d.membroDesde} nivel={d.nivel} mesIdx={d.mesIdx} />, { largura: STORIES.w, altura: STORIES.h });
  passo();
  if (!resumo) return null;
  const c: CamadasTres = { cenas, resumo };
  return { duracao: DURACAO_TRES, desenhar: (ctx, t, escala) => desenharQuadroTres(ctx, c, t, escala) };
}

export function prepararRoteiro(arte: ArteComVideo, d: DadosArtes, onEtapa?: Etapa): Promise<Roteiro | null> {
  const chave = chaveDe(arte, d);
  let p = cache.get(chave);
  if (!p) {
    p = montar(arte, d, onEtapa);
    cache.set(chave, p);
    if (cache.size > 3) cache.delete(cache.keys().next().value!);
    p.then((c) => { if (!c) cache.delete(chave); }, () => cache.delete(chave));
  }
  return p;
}

/** Só pra testes. */
export const limparCacheDeRoteiros = () => cache.clear();
