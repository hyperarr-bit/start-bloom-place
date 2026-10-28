import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { FotoWebKit } from "./foto-contexto";

/**
 * Foto de um componente pros Stories (26/09): monta o componente FORA da tela
 * (numa raiz React própria), espera fonte, imagem e os anéis de texto
 * ajustarem, e fotografa com html-to-image. A arte é o próprio componente da
 * tela — não um desenho paralelo em canvas que envelhece diferente.
 *
 * pixelRatio 1: o componente já é desenhado em 1080×1920; o padrão (o DPR do
 * aparelho, 3 no celular) geraria 3240×5760 e estouraria o canvas do iPhone.
 *
 * `gerarCanvas` (27/09) é a mesma foto devolvida como canvas — as camadas do
 * vídeo do álbum (fundo, capa, página, adesivos) saem daqui e são animadas
 * num canvas só com transform.
 */

type HtmlToImage = typeof import("html-to-image");
interface Medidas { largura: number; altura: number }

const quadro = () => new Promise<void>((ok) => requestAnimationFrame(() => ok()));
const esperar = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

/** WebKit (iPhone/Safari): a 1ª passada do html-to-image costuma sair sem a fonte/imagem embutida. */
const ehWebKit = () => {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return /AppleWebKit/.test(ua) && !/Chrome|CriOS|Android|Edg/.test(ua);
};

async function fontesProntas() {
  try {
    await document.fonts?.ready;
    await Promise.all([
      document.fonts.load("italic 400 48px 'Instrument Serif'"),
      document.fonts.load("800 32px Inter"),
      document.fonts.load("900 32px Inter"),
      document.fonts.load("600 24px Inter"),
    ]);
  } catch {
    /* sem FontFace API: segue com o que tiver */
  }
}

/*
 * SOMBRA DE CABEÇA PRA BAIXO NO WEBKIT (26/09, pego no WebKit do Playwright):
 * na foto (SVG com foreignObject), o WebKit desenha o deslocamento vertical de
 * box-shadow/text-shadow/drop-shadow INVERTIDO — a sombra da etiqueta e da
 * tag saía como uma faixa escura EM CIMA delas. A tela em si fica certa; só a
 * foto erra. Em vez de supor, mede uma vez: fotografa um quadradinho com
 * sombra pra baixo e vê de que lado ela saiu. Se inverteu, a foto vira o
 * sinal das sombras antes (e o WebKit desvira). Se um dia o WebKit consertar,
 * a medida diz "não inverte" e nada muda.
 */
let sombraInvertida: Promise<boolean> | null = null;
const medirSombraInvertida = (lib: HtmlToImage) => {
  if (!ehWebKit()) return Promise.resolve(false);
  sombraInvertida ??= (async () => {
    // o deslocamento pra fora da tela fica no PAI: o html-to-image copia o transform do próprio alvo
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;left:0;top:0;width:40px;height:60px;transform:translateX(-600px);pointer-events:none";
    d.innerHTML = '<div style="position:relative;width:40px;height:60px;background:#fff"><div style="position:absolute;left:10px;top:20px;width:20px;height:20px;background:#fff;box-shadow:0 12px 0 0 #000"></div></div>';
    document.body.appendChild(d);
    try {
      const canvas = await lib.toCanvas(d.firstElementChild as HTMLElement, { width: 40, height: 60, pixelRatio: 1 });
      const g = canvas.getContext("2d");
      if (!g) return false;
      const acima = g.getImageData(20, 14, 1, 1).data[0];
      const abaixo = g.getImageData(20, 46, 1, 1).data[0];
      return acima < 100 && abaixo > 155;
    } catch {
      return false;
    } finally {
      d.remove();
    }
  })();
  return sombraInvertida;
};

/** Separa uma lista CSS por vírgulas de fora dos parênteses ("rgba(0, 0, 0, .5) 0px 2px, …"). */
const partes = (lista: string) => {
  const out: string[] = [];
  let nivel = 0, atual = "";
  for (const ch of lista) {
    if (ch === "(") nivel++;
    if (ch === ")") nivel--;
    if (ch === "," && nivel === 0) { out.push(atual.trim()); atual = ""; } else atual += ch;
  }
  if (atual.trim()) out.push(atual.trim());
  return out;
};

/** Troca o sinal do 2º comprimento (o deslocamento vertical) de uma sombra computada. */
const virarY = (sombra: string) => {
  let n = 0;
  return sombra.replace(/-?\d*\.?\d+px/g, (m) => (++n === 2 ? `${-parseFloat(m)}px` : m));
};

function virarSombras(raiz: HTMLElement) {
  const todos = [raiz, ...Array.from(raiz.querySelectorAll<HTMLElement | SVGElement>("*"))];
  for (const el of todos) {
    const cs = getComputedStyle(el);
    const estilo = (el as HTMLElement).style;
    if (!estilo) continue;
    if (cs.boxShadow && cs.boxShadow !== "none") estilo.boxShadow = partes(cs.boxShadow).map(virarY).join(", ");
    if (cs.textShadow && cs.textShadow !== "none") estilo.textShadow = partes(cs.textShadow).map(virarY).join(", ");
    if (cs.filter && cs.filter.includes("drop-shadow")) {
      estilo.filter = cs.filter.replace(/drop-shadow\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g, (_m, dentro: string) => `drop-shadow(${virarY(dentro)})`);
    }
  }
}

/** Monta o elemento fora da tela, espera tudo assentar e entrega o nó pronto pra foto. */
async function comElementoMontado<T>(elemento: ReactElement, { largura, altura }: Medidas, foto: (alvo: HTMLElement, lib: HtmlToImage) => Promise<T>): Promise<T | null> {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.setAttribute("data-gerador-stories", "");
  host.style.cssText = `position:fixed;left:0;top:0;width:${largura}px;height:${altura}px;pointer-events:none;z-index:-1;transform:translateX(-${largura + 400}px);`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    // só baixa a biblioteca quando alguém compartilha
    const lib = await import("html-to-image");
    const inverte = await medirSombraInvertida(lib);
    root.render(<FotoWebKit.Provider value={inverte}>{elemento}</FotoWebKit.Provider>);
    await quadro();
    await quadro();
    await fontesProntas();
    await Promise.all(Array.from(host.querySelectorAll("img")).map((img) => img.decode?.().catch(() => undefined)));
    // anéis de texto medem de novo depois da fonte (TextoEmAnel marca data-ajustado)
    for (let i = 0; i < 40 && host.querySelector("[data-anel]:not([data-ajustado])"); i++) await quadro();
    await quadro();
    const alvo = host.firstElementChild as HTMLElement | null;
    if (!alvo) return null;
    if (inverte) virarSombras(alvo);
    return await foto(alvo, lib);
  } catch (e) {
    console.error("[conquistas] a imagem dos Stories falhou:", e);
    return null;
  } finally {
    root.unmount();
    host.remove();
  }
}

// SEM preferredFontFormat: na 1.11.13 ele usa uma regex global que guarda a
// posição entre chamadas — uma foto sim, outra não, a fonte sumia (a serifada
// da manchete caía na Georgia). Embutir woff2 + woff custa ~40 KB e acerta sempre.
const opcoesDe = ({ largura, altura }: Medidas) => ({ width: largura, height: altura, pixelRatio: 1, cacheBust: false });

/*
 * FIGURINHA SUMIA DO STORY NO IPHONE (dono, 27/10): a arte da figurinha é um WebP dentro de um <svg><image>, e o WebKit
 * desenha a foto (SVG com foreignObject) antes de decodificar a imagem embutida — o cartão saía com a frase e o nome e
 * um buraco no meio. Quem marca `data-foto-arte="<url>"` sai da foto do html-to-image e é pintado DEPOIS, direto no
 * canvas, na mesma caixa. A posição/giro vêm de 3 sondas nos cantos da caixa (0,0 · w,0 · 0,h) medidas na tela: vale
 * qualquer transform dos ancestrais (o herói da capa é translate + rotate no pai, a célula do álbum gira no próprio nó).
 */
interface ArtePorCima { url: string; w: number; h: number; m: [number, number, number, number, number, number] }

function artesPorCima(alvo: HTMLElement): ArtePorCima[] {
  const base = alvo.getBoundingClientRect();
  const out: ArtePorCima[] = [];
  for (const el of Array.from(alvo.querySelectorAll<HTMLElement>("[data-foto-arte]"))) {
    const url = el.dataset.fotoArte;
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!url || !w || !h) continue;
    const estatico = getComputedStyle(el).position === "static";
    if (estatico) el.style.position = "relative";
    const ponto = (x: number, y: number) => {
      const s = document.createElement("i");
      s.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0;margin:0;padding:0;border:0`;
      el.appendChild(s);
      const r = s.getBoundingClientRect();
      s.remove();
      return { x: r.left - base.left, y: r.top - base.top };
    };
    const p0 = ponto(0, 0), p1 = ponto(w, 0), p2 = ponto(0, h);
    if (estatico) el.style.position = "";
    out.push({ url, w, h, m: [(p1.x - p0.x) / w, (p1.y - p0.y) / w, (p2.x - p0.x) / h, (p2.y - p0.y) / h, p0.x, p0.y] });
  }
  return out;
}

const carregar = (url: string) => new Promise<HTMLImageElement>((ok, falha) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = falha;
  img.src = url;
});

async function pintarPorCima(canvas: HTMLCanvasElement, artes: ArtePorCima[]) {
  const g = canvas.getContext("2d");
  if (!g) return;
  for (const a of artes) {
    const img = await carregar(a.url);
    await img.decode?.().catch(() => undefined);
    g.save();
    g.setTransform(...a.m);
    g.drawImage(img, 0, 0, a.w, a.h);
    g.restore();
  }
}

const paraBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));

/** A foto como canvas, com as artes marcadas pintadas por cima (sem elas, a foto de sempre). */
async function fotoEmCanvas(alvo: HTMLElement, lib: HtmlToImage, medidas: Medidas): Promise<HTMLCanvasElement> {
  const artes = artesPorCima(alvo);
  const opcoes = artes.length ? { ...opcoesDe(medidas), filter: (n: HTMLElement) => !(n instanceof HTMLElement && n.dataset?.fotoArte) } : opcoesDe(medidas);
  let canvas = await lib.toCanvas(alvo, opcoes);
  if (ehWebKit()) {
    await esperar(80);
    canvas = await lib.toCanvas(alvo, opcoes);
  }
  if (artes.length) await pintarPorCima(canvas, artes);
  return canvas;
}

export async function gerarPng(elemento: ReactElement, medidas: Medidas): Promise<Blob | null> {
  return comElementoMontado(elemento, medidas, async (alvo, lib) => {
    if (artesPorCima(alvo).length) return paraBlob(await fotoEmCanvas(alvo, lib, medidas));
    const opcoes = opcoesDe(medidas);
    let blob = await lib.toBlob(alvo, opcoes);
    if (ehWebKit()) {
      await esperar(80);
      blob = (await lib.toBlob(alvo, opcoes)) ?? blob;
    }
    return blob;
  });
}

/** A mesma foto, como canvas (as camadas do vídeo). */
export async function gerarCanvas(elemento: ReactElement, medidas: Medidas): Promise<HTMLCanvasElement | null> {
  return comElementoMontado(elemento, medidas, (alvo, lib) => fotoEmCanvas(alvo, lib, medidas));
}

/**
 * A foto como canvas + MEDIDAS tiradas do mesmo DOM montado (29/09, os cards
 * de compartilhar): o vídeo precisa saber onde cada casa do calendário, o
 * número e cada bloco de texto ficaram. `medir` roda com tudo assentado
 * (fonte carregada), antes da foto; as medidas são do espaço do card.
 */
export async function gerarCanvasEMedir<T>(elemento: ReactElement, medidas: Medidas, medir: (alvo: HTMLElement) => T): Promise<{ canvas: HTMLCanvasElement; medida: T } | null> {
  return comElementoMontado(elemento, medidas, async (alvo, lib) => {
    const medida = medir(alvo);
    const canvas = await fotoEmCanvas(alvo, lib, medidas);
    return { canvas, medida };
  });
}
