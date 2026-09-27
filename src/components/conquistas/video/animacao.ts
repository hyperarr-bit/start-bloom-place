import type { Raridade } from "@/components/gamification/types";
import { CORES_ANEL, HALO_ANEL, corDoAnel } from "../adesivos-raridade";

/**
 * A ANIMAÇÃO DO ÁLBUM (27/09, dono: "compartilhar meu planner nos Stories
 * podia ser um GIF que abre e mostra os adesivos"). 5 s, 30 fps, 9:16:
 *
 *   0,0–0,55  a capa assenta na mesa (cresce de 96,5 % e desce 18 px)
 *   0,8–1,5   a capa abre na lombada (scaleX = cos θ até 168°, com a sombra
 *             correndo sobre a página e o verso escuro ficando por baixo)
 *   1,6+      os mais raros pipocam um a um a cada 0,3 s (do mais raro pro
 *             mais comum): clarão, sobrepasso, anel holográfico/ouro girando,
 *             faíscas no lendário
 *   depois    o nome e o nível sobem embaixo; um brilho varre os épicos e
 *             lendários
 *   últimos   0,35 s: funde de volta pro 1º quadro, pra o vídeo fechar em
 *             laço sem pulo (Reels/feed repetem)
 *
 * Tudo é `drawImage` das camadas pré-renderizadas (fundo, capa, página,
 * espiral, sprite dos adesivos, bloco do nome) com transform — nada é
 * rasterizado por quadro. O anel, as faíscas, o clarão e o brilho são
 * desenhados no canvas (poucos arcos). As coordenadas são do espaço 1080 ×
 * 1920; `escala` ajusta pra 720p.
 */

export const DURACAO = 5;
export const FPS = 30;
export const LARGURA = 1080;
export const ALTURA = 1920;

export interface AdesivoAnimado {
  /** Recorte no sprite. */
  sx: number; sy: number; sw: number; sh: number;
  /** Onde cola (espaço 1080). */
  x: number; y: number; w: number; h: number;
  /** Centro e lado do adesivo (o anel, o clarão e as faíscas giram em volta dele). */
  cx: number; cy: number; tam: number;
  raridade: Raridade;
}

export interface Camadas {
  fundo: CanvasImageSource;
  /** Capa e página saem com uma margem transparente em volta (a sombra). */
  capa: CanvasImageSource;
  pagina: CanvasImageSource;
  margem: number;
  espiral: CanvasImageSource;
  espiralW: number;
  sprite: CanvasImageSource | null;
  adesivos: AdesivoAnimado[];
  texto: CanvasImageSource;
  textoY: number;
  textoH: number;
  /** A caixa da capa/página. */
  caixa: { x: number; y: number; w: number; h: number };
  /** A lombada (x onde a capa dobra). */
  dobra: number;
}

const T = { assenta: [0, 0.55], abre: [0.8, 1.5], pop0: 1.6, passoPop: 0.3, durPop: 0.45, fimLoop: 0.35 } as const;

/** Os instantes que dependem de quantos adesivos pipocam. */
export const tempos = (n: number) => {
  const fimPops = T.pop0 + Math.max(0, n - 1) * T.passoPop + T.durPop;
  const texto = Math.min(fimPops + 0.1, DURACAO - 1.2);
  return { texto, brilho: texto + 0.4, loop: DURACAO - T.fimLoop };
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const prog = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const suave = (u: number) => u * u * (3 - 2 * u);
const saiCubico = (u: number) => 1 - Math.pow(1 - u, 3);
/** easeOutBack: passa de 1 e volta (o "pop"). */
const saiVolta = (u: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
};

/** O contorno da capa/página: cantos de 10 na lombada e 44 do lado de fora. */
function caminhoPagina(ctx: CanvasRenderingContext2D, { x, y, w, h }: Camadas["caixa"]) {
  const rE = 10, rD = 44;
  ctx.beginPath();
  ctx.moveTo(x + rE, y);
  ctx.lineTo(x + w - rD, y);
  ctx.arcTo(x + w, y, x + w, y + rD, rD);
  ctx.lineTo(x + w, y + h - rD);
  ctx.arcTo(x + w, y + h, x + w - rD, y + h, rD);
  ctx.lineTo(x + rE, y + h);
  ctx.arcTo(x, y + h, x, y + h - rE, rE);
  ctx.lineTo(x, y + rE);
  ctx.arcTo(x, y, x + rE, y, rE);
  ctx.closePath();
}

/** O anel da raridade (o mesmo do AnelRaridadeSvg), girando. */
export function desenharAnel(ctx: CanvasRenderingContext2D, cx: number, cy: number, tam: number, raridade: "epico" | "lendario", angulo: number) {
  const lado = tam * 1.18, rExt = lado / 2, rInt = rExt * 0.83;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angulo + (raridade === "lendario" ? 0.35 : 0));
  const halo = ctx.createRadialGradient(0, 0, rExt * 0.78, 0, 0, rExt * 1.08);
  halo.addColorStop(0, "rgba(255,255,255,0)");
  halo.addColorStop(1, HALO_ANEL[raridade]);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, rExt * 1.08, 0, Math.PI * 2);
  ctx.fill();
  const cores = CORES_ANEL[raridade];
  ctx.beginPath();
  ctx.arc(0, 0, rExt, 0, Math.PI * 2);
  ctx.arc(0, 0, rInt, 0, Math.PI * 2, true);
  if (typeof ctx.createConicGradient === "function") {
    const g = ctx.createConicGradient(-Math.PI / 2, 0, 0);
    cores.forEach((cor, i) => g.addColorStop(i / (cores.length - 1), cor));
    ctx.fillStyle = g;
    ctx.fill("evenodd");
  } else {
    // WebView sem conic-gradient: 72 fatias, como o SVG
    ctx.save();
    ctx.clip("evenodd");
    const n = 72;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 - Math.PI / 2, a1 = a0 + ((Math.PI * 2) / n) * 1.15;
      ctx.fillStyle = corDoAnel(cores, i / n);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, rExt + 1, a0, a1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.strokeStyle = "rgba(255,255,255,.35)";
  ctx.lineWidth = (rExt - rInt) * 0.22;
  ctx.beginPath();
  ctx.arc(0, 0, (rExt + rInt) / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

const FAISCAS: [number, number, number][] = [[-0.62, -0.5, 1], [0.66, -0.28, 0.75], [0.6, 0.56, 0.9], [-0.66, 0.42, 0.7], [0.08, -0.8, 0.6]];

function estrela4(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.closePath();
}

function desenharFaiscas(ctx: CanvasRenderingContext2D, a: AdesivoAnimado, t: number) {
  FAISCAS.forEach(([dx, dy, k], i) => {
    const vis = Math.max(0, Math.sin(t * 4.2 + i * 1.3));
    if (vis < 0.05) return;
    const x = a.cx + dx * a.tam, y = a.cy + dy * a.tam;
    const r = a.tam * 0.07 * k * (0.5 + 0.5 * vis);
    ctx.save();
    ctx.globalAlpha = vis;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    g.addColorStop(0, "rgba(255,232,154,.9)");
    g.addColorStop(1, "rgba(255,232,154,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe89a";
    estrela4(ctx, x, y, r);
    ctx.fill();
    ctx.restore();
  });
}

/** O brilho que varre o adesivo (uma faixa branca inclinada, presa ao círculo dele). */
function desenharBrilho(ctx: CanvasRenderingContext2D, a: AdesivoAnimado, v: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(a.cx, a.cy, a.tam * 0.52, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(a.cx, a.cy);
  ctx.rotate(-0.5);
  const faixa = a.tam * 0.36;
  const x0 = -a.tam * 1.1 + v * a.tam * 2.2;
  const g = ctx.createLinearGradient(x0 - faixa, 0, x0 + faixa, 0);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.5, "rgba(255,255,255,.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-a.tam * 1.5, -a.tam * 1.5, a.tam * 3, a.tam * 3);
  ctx.restore();
}

function desenharAdesivos(ctx: CanvasRenderingContext2D, c: Camadas, t: number) {
  if (!c.sprite) return;
  const { brilho } = tempos(c.adesivos.length);
  c.adesivos.forEach((a, i) => {
    const inicio = T.pop0 + i * T.passoPop;
    const u = prog(t, inicio, inicio + T.durPop);
    if (u <= 0) return;
    const s = saiVolta(u);
    const rot = ((1 - saiCubico(u)) * -16 * Math.PI) / 180;
    const brilha = a.raridade === "epico" || a.raridade === "lendario";
    ctx.save();
    ctx.globalAlpha = Math.min(1, u * 4);
    ctx.translate(a.cx, a.cy);
    ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.translate(-a.cx, -a.cy);
    if (u < 0.5) {
      // o clarão de colar
      const k = 1 - u / 0.5;
      const r = a.tam * 0.7 * (0.7 + u);
      const g = ctx.createRadialGradient(a.cx, a.cy, 0, a.cx, a.cy, r);
      g.addColorStop(0, `rgba(255,255,255,${(0.6 * k).toFixed(3)})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(a.cx, a.cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (brilha) desenharAnel(ctx, a.cx, a.cy, a.tam, a.raridade as "epico" | "lendario", t * 0.6 - rot);
    ctx.drawImage(c.sprite!, a.sx, a.sy, a.sw, a.sh, a.x, a.y, a.w, a.h);
    ctx.restore();
    if (u >= 1) {
      if (a.raridade === "lendario") desenharFaiscas(ctx, a, t);
      if (brilha) {
        const v = prog(t, brilho + i * 0.08, brilho + i * 0.08 + 0.6);
        if (v > 0 && v < 1) desenharBrilho(ctx, a, v);
      }
    }
  });
}

function desenharCena(ctx: CanvasRenderingContext2D, c: Camadas, t: number) {
  const { caixa, dobra, margem } = c;
  ctx.drawImage(c.fundo, 0, 0, LARGURA, ALTURA);
  const pAss = saiCubico(prog(t, T.assenta[0], T.assenta[1]));
  const pAbre = suave(prog(t, T.abre[0], T.abre[1]));
  const ang = pAbre * Math.PI * (168 / 180);
  const cos = Math.cos(ang);

  const comAssento = (desenhar: () => void) => {
    ctx.save();
    if (pAss < 1) {
      const s = 0.965 + 0.035 * pAss;
      const dy = 18 * (1 - pAss);
      const cx = caixa.x + caixa.w / 2, cy = caixa.y + caixa.h / 2;
      ctx.translate(cx, cy + dy);
      ctx.scale(s, s);
      ctx.translate(-cx, -cy);
    }
    desenhar();
    ctx.restore();
  };
  const naDobra = (sx: number, desenhar: () => void) => {
    ctx.save();
    ctx.translate(dobra, 0);
    ctx.scale(sx, 1);
    ctx.translate(-dobra, 0);
    desenhar();
    ctx.restore();
  };

  // depois de 90° o verso escuro da capa fica por BAIXO da página (como na tela). Na tela a capa
  // virada some quase toda pela borda da tela; aqui ela é encurtada (× 0,09) pra ser só a dobra
  // escura junto da lombada, não uma placa cobrindo o papel à esquerda.
  if (cos <= 0) {
    naDobra(cos * 0.09, () => {
      ctx.globalAlpha = 0.96;
      ctx.fillStyle = "#35363c";
      caminhoPagina(ctx, caixa);
      ctx.fill();
    });
  }
  if (pAbre > 0) {
    ctx.drawImage(c.pagina, caixa.x - margem, caixa.y - margem, caixa.w + 2 * margem, caixa.h + 2 * margem);
    desenharAdesivos(ctx, c, t);
    const sombra = Math.sin(pAbre * Math.PI) * 0.45;
    if (sombra > 0.01) {
      const g = ctx.createLinearGradient(dobra, 0, dobra + caixa.w * 0.7, 0);
      g.addColorStop(0, `rgba(0,0,0,${sombra.toFixed(3)})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      caminhoPagina(ctx, caixa);
      ctx.fill();
    }
  }
  if (cos > 0) {
    comAssento(() =>
      naDobra(cos, () => {
        ctx.drawImage(c.capa, caixa.x - margem, caixa.y - margem, caixa.w + 2 * margem, caixa.h + 2 * margem);
        const escurece = (1 - cos) * 0.55;
        if (escurece > 0.01) {
          ctx.fillStyle = `rgba(0,0,0,${escurece.toFixed(3)})`;
          caminhoPagina(ctx, caixa);
          ctx.fill();
        }
      }),
    );
  }
  // a espiral fica no lugar, por cima de tudo
  comAssento(() => ctx.drawImage(c.espiral, caixa.x, caixa.y, c.espiralW, caixa.h));

  const { texto } = tempos(c.adesivos.length);
  const pt = saiCubico(prog(t, texto, texto + 0.4));
  if (pt > 0) {
    ctx.save();
    ctx.globalAlpha = pt;
    ctx.drawImage(c.texto, 0, c.textoY + 18 * (1 - pt), LARGURA, c.textoH);
    ctx.restore();
  }
}

/** Pinta o quadro do instante `t` (segundos) num canvas de `escala` × 1080 × 1920. */
export function desenharQuadro(ctx: CanvasRenderingContext2D, c: Camadas, t: number, escala: number) {
  ctx.save();
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  desenharCena(ctx, c, t);
  // fecha o laço: funde pro 1º quadro
  const { loop } = tempos(c.adesivos.length);
  if (t > loop) {
    ctx.globalAlpha = suave(clamp01((t - loop) / (DURACAO - loop)));
    desenharCena(ctx, c, 0);
  }
  ctx.restore();
}
