import { raridadeDe } from "@/components/gamification/types";
import { CAIXA_ESPIRAL_STORIES, CapaPlanner, DOBRA_STORIES, Espiral } from "../CapaPlanner";
import { BLOCO_NOME_FOTO, CelulaAdesivoFoto, GRADE_FOTO, PAGINA_FOTO, STORIES, StoriesAlbum, StoriesCapa } from "../Stories";
import { gerarCanvas } from "../gerar-imagem";
import type { ArteComVideo, DadosArtes } from "../artes-dados";
import type { AdesivoAnimado, Camadas } from "./animacao";

/**
 * AS CAMADAS DO VÍDEO (27/09): fotografa uma vez cada peça parada com o
 * html-to-image (a mesma foto das artes) e o canvas só move. Seis fotos:
 * fundo (papel + manchete + rodapé), capa fechada (sem a espiral), página do
 * álbum (sem os adesivos que vão pipocar), a espiral, o sprite com os
 * adesivos (as células da grade, lado a lado) e o bloco do nome. Capa e
 * página levam uma margem transparente: é onde a sombra delas cai.
 *
 * Guarda as últimas fotos por (arte, dados): a prévia ao vivo prepara, e o
 * "Postar vídeo" logo depois reaproveita sem fotografar de novo.
 */

export const MARGEM = 120;
/** O sprite tem 16 px de folga em cima: a borda branca do adesivo não pode ser cortada. */
const FOLGA_SPRITE = 16;

const chaveDe = (arte: ArteComVideo, d: DadosArtes) =>
  JSON.stringify([
    arte, d.capa, d.nome, d.membroDesde, d.dias, d.nivel, d.xp, d.adesivos, d.total, d.mes,
    d.maisRaros.map((b) => b.id),
    d.proximos.map((b) => [b.id, b.progresso?.atual ?? null]),
    Object.values(d.porRaridade).map((r) => r.abertos),
  ]);

const cache = new Map<string, Promise<Camadas | null>>();

async function montar(arte: ArteComVideo, d: DadosArtes, onEtapa?: (feita: number, de: number) => void): Promise<Camadas | null> {
  const total = 6;
  let feitas = 0;
  const passo = () => onEtapa?.(++feitas, total);
  const comMargem = { largura: PAGINA_FOTO.w + 2 * MARGEM, altura: PAGINA_FOTO.h + 2 * MARGEM };
  const envelope = (filho: JSX.Element, sombra: string) => (
    <div style={{ position: "relative", width: comMargem.largura, height: comMargem.altura }}>
      <div style={{ position: "absolute", left: MARGEM, top: MARGEM, borderRadius: "10px 44px 44px 10px", boxShadow: sombra }}>{filho}</div>
    </div>
  );

  const fundo = await gerarCanvas(
    arte === "capa"
      ? <StoriesCapa capa={d.capa} nome={d.nome} membroDesde={d.membroDesde} dias={d.dias} nivel={d.nivel} parte="fundo" />
      : <StoriesAlbum {...d} parte="fundo" />,
    { largura: STORIES.w, altura: STORIES.h },
  );
  passo();
  const capa = await gerarCanvas(envelope(<CapaPlanner capa={d.capa} formato="stories" nome={d.nome} membroDesde={d.membroDesde} dias={d.dias} nivel={d.nivel} semEspiral />, "none"), comMargem);
  passo();
  const pagina = await gerarCanvas(envelope(<StoriesAlbum {...d} parte="pagina" />, "0 60px 90px -40px rgba(0,0,0,.45)"), comMargem);
  passo();
  const espiral = await gerarCanvas(
    <div style={{ position: "relative", width: CAIXA_ESPIRAL_STORIES, height: PAGINA_FOTO.h }}><Espiral f="stories" /></div>,
    { largura: CAIXA_ESPIRAL_STORIES, altura: PAGINA_FOTO.h },
  );
  passo();
  const abertos = d.maisRaros.slice(0, GRADE_FOTO.colunas * 2);
  const alturaSprite = GRADE_FOTO.alt + FOLGA_SPRITE;
  const sprite = abertos.length
    ? await gerarCanvas(
        <div style={{ display: "flex", width: abertos.length * GRADE_FOTO.cel, height: alturaSprite, paddingTop: FOLGA_SPRITE, boxSizing: "border-box" }}>
          {abertos.map((b, i) => <CelulaAdesivoFoto key={b.id} b={b} indice={i} semAnel />)}
        </div>,
        { largura: abertos.length * GRADE_FOTO.cel, altura: alturaSprite },
      )
    : null;
  passo();
  const texto = await gerarCanvas(
    arte === "capa"
      ? <StoriesCapa capa={d.capa} nome={d.nome} membroDesde={d.membroDesde} dias={d.dias} nivel={d.nivel} adesivos={d.adesivos} total={d.total} parte="texto" />
      : <StoriesAlbum {...d} parte="texto" />,
    { largura: STORIES.w, altura: BLOCO_NOME_FOTO.h },
  );
  passo();
  if (!fundo || !capa || !pagina || !espiral || !texto || (abertos.length && !sprite)) return null;

  const adesivos: AdesivoAnimado[] = abertos.map((b, i) => {
    const col = i % GRADE_FOTO.colunas, lin = Math.floor(i / GRADE_FOTO.colunas);
    const x = PAGINA_FOTO.x + GRADE_FOTO.esq + col * (GRADE_FOTO.cel + GRADE_FOTO.gap);
    const y = PAGINA_FOTO.y + GRADE_FOTO.topo + lin * (GRADE_FOTO.alt + GRADE_FOTO.gap);
    return {
      sx: i * GRADE_FOTO.cel, sy: 0, sw: GRADE_FOTO.cel, sh: alturaSprite,
      x, y: y - FOLGA_SPRITE, w: GRADE_FOTO.cel, h: alturaSprite,
      cx: x + GRADE_FOTO.cel / 2, cy: y + GRADE_FOTO.tam / 2, tam: GRADE_FOTO.tam,
      raridade: raridadeDe(b),
    };
  });
  return {
    fundo, capa, pagina, margem: MARGEM, espiral, espiralW: CAIXA_ESPIRAL_STORIES, sprite, adesivos, texto,
    textoY: BLOCO_NOME_FOTO.y, textoH: BLOCO_NOME_FOTO.h,
    caixa: { x: PAGINA_FOTO.x, y: PAGINA_FOTO.y, w: PAGINA_FOTO.w, h: PAGINA_FOTO.h },
    dobra: PAGINA_FOTO.x + DOBRA_STORIES,
  };
}

export function prepararCamadas(arte: ArteComVideo, d: DadosArtes, onEtapa?: (feita: number, de: number) => void): Promise<Camadas | null> {
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
