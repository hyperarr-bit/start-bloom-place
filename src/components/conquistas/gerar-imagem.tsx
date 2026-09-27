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
 */

type HtmlToImage = typeof import("html-to-image");

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

export async function gerarPng(elemento: ReactElement, { largura, altura }: { largura: number; altura: number }): Promise<Blob | null> {
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
    // SEM preferredFontFormat: na 1.11.13 ele usa uma regex global que guarda a
    // posição entre chamadas — uma foto sim, outra não, a fonte sumia (a serifada
    // da manchete caía na Georgia). Embutir woff2 + woff custa ~40 KB e acerta sempre.
    const opcoes = { width: largura, height: altura, pixelRatio: 1, cacheBust: false };
    let blob = await lib.toBlob(alvo, opcoes);
    if (ehWebKit()) {
      await esperar(80);
      blob = (await lib.toBlob(alvo, opcoes)) ?? blob;
    }
    return blob;
  } catch (e) {
    console.error("[conquistas] a imagem dos Stories falhou:", e);
    return null;
  } finally {
    root.unmount();
    host.remove();
  }
}
