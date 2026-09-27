import { FORMAS, centroDoMiolo, tamanhoDoNumero, type Metal } from "../Insignia";
import { fmtNum, type Fmt, type Forma } from "../insignias";
import { FITA_FOTO, OBJETO_CONQUISTA, TEXTO_CONQUISTA } from "../Stories";
import { LARGURA, ALTURA } from "./animacao";

/**
 * A ANIMAÇÃO DE "MINHA CONQUISTA DO MÊS" (27/09, LEIA §6) — 5,5 s, 30 fps:
 *
 *   0,0–0,4   a fita desce e assenta
 *   0,25–0,85 o pin CAI E PRENDE no papel (desce com sombra grande que
 *             encolhe, passa de 1,25× pra 1×, um "toque" de pressão) e um
 *             clarão de metal
 *   0,95–2,05 o NÚMERO conta de zero até o valor (fillText, Inter 900,
 *             o mesmo lugar do SVG)
 *   2,0–3,25  a frase, a linha e o nome sobem
 *   3,4–4,3   a luz varre o metal (faixa clipada na forma do pin)
 *
 * Tudo é drawImage das fotos (fundo, fita, objeto SEM número, texto) com
 * transform; só o número, a sombra, o clarão e a luz são desenhados. As
 * coordenadas são do espaço 1080 × 1920; `escala` ajusta pra 720p.
 *
 * "Minhas 3 conquistas" (dono: UM arquivo) encadeia 3 cenas destas (2,9 s
 * cada, com fusão) e fecha no resumo.
 */

export const DURACAO_CONQUISTA = 5.5;
export const SEGMENTO_TRES = 2.9;
export const RESUMO_TRES = 2.6;
export const FUSAO = 0.25;
export const DURACAO_TRES = 3 * SEGMENTO_TRES + RESUMO_TRES;

export interface PinNoCanvas {
  forma: Forma;
  metal: Metal;
  valor: number;
  fmt: Fmt;
  arredonda: boolean;
}

export interface CamadasConquista {
  fundo: CanvasImageSource;
  fita: CanvasImageSource;
  objeto: CanvasImageSource;
  texto: CanvasImageSource;
  pin: PinNoCanvas;
}

export interface CamadasTres {
  cenas: CamadasConquista[];
  resumo: CanvasImageSource;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const prog = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const saiCubico = (u: number) => 1 - Math.pow(1 - u, 3);
const saiVolta = (u: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };

/** Os instantes de uma cena (a solo tem folga; na sequência de 3 tudo é mais apertado). */
export interface TemposDaCena { fita: [number, number]; objeto: [number, number]; press: [number, number]; clarao: [number, number]; numero: [number, number]; frase: [number, number]; linha: [number, number]; nome: [number, number]; luz: [number, number] }
export const TEMPOS_SOLO: TemposDaCena = { fita: [0, 0.4], objeto: [0.25, 0.8], press: [0.8, 1.05], clarao: [0.78, 1.25], numero: [0.95, 2.05], frase: [2.0, 2.45], linha: [2.4, 2.8], nome: [2.85, 3.25], luz: [3.4, 4.3] };
export const TEMPOS_SEQ: TemposDaCena = { fita: [0, 0.3], objeto: [0.15, 0.6], press: [0.6, 0.8], clarao: [0.58, 0.95], numero: [0.7, 1.5], frase: [1.35, 1.7], linha: [1.55, 1.85], nome: [1.7, 2.0], luz: [2.05, 2.7] };

/** O caminho do contorno do pin no canvas (a forma escalada de 120 pro tamanho na arte). */
export function caminhoDoPin(forma: Forma, x: number, y: number, tam: number): Path2D {
  const p = new Path2D();
  const m = new DOMMatrix().translate(x, y).scale(tam / 120);
  p.addPath(new Path2D(FORMAS[forma](1)), m);
  return p;
}

/** O número contando, no lugar exato do SVG (x = 60, y = cy + 9 da caixa de 120). */
export function desenharNumero(ctx: CanvasRenderingContext2D, pin: PinNoCanvas, x: number, y: number, tam: number, fracao: number) {
  const val = pin.valor * saiCubico(fracao);
  const txt = fmtNum(pin.arredonda ? Math.round(val) : val, pin.fmt);
  const k = tam / 120;
  const tn = tamanhoDoNumero(txt, pin.fmt) * k;
  const cy = centroDoMiolo(pin.forma);
  ctx.save();
  ctx.font = `900 ${tn}px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  try { (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${(tn > 24 * k ? -1.2 : -0.3) * k}px`; } catch { /* WebView sem letterSpacing: sem espaçamento */ }
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.3 * k;
  ctx.strokeStyle = pin.metal.escuro;
  ctx.strokeText(txt, x + 60 * k, y + (cy + 9) * k);
  ctx.fillStyle = "#fff";
  ctx.fillText(txt, x + 60 * k, y + (cy + 9) * k);
  ctx.restore();
}

/** A luz que varre o metal: uma faixa branca inclinada, clipada na forma. */
function desenharLuz(ctx: CanvasRenderingContext2D, forma: Forma, x: number, y: number, tam: number, v: number) {
  const k = tam / 120;
  ctx.save();
  ctx.clip(caminhoDoPin(forma, x, y, tam));
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.9 * Math.sin(v * Math.PI);
  ctx.translate(x + (-30 + v * 190) * k, y);
  ctx.transform(1, 0, Math.tan(-18 * Math.PI / 180), 1, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 30 * k, 0);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.5, "rgba(255,255,255,.7)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-10 * k, -20 * k, 50 * k, 160 * k);
  ctx.restore();
}

/**
 * Uma cena da conquista no instante `t` (segundos) — sem a fusão. `tempos`
 * escolhe a coreografia solo ou a apertada da sequência.
 */
export function desenharCenaConquista(ctx: CanvasRenderingContext2D, c: CamadasConquista, t: number, tempos: TemposDaCena) {
  const { tam, cx, cy } = OBJETO_CONQUISTA;
  ctx.drawImage(c.fundo, 0, 0, LARGURA, ALTURA);

  // a fita
  const pf = saiCubico(prog(t, tempos.fita[0], tempos.fita[1]));
  if (pf > 0) {
    ctx.save();
    ctx.globalAlpha = pf;
    ctx.drawImage(c.fita, 0, FITA_FOTO.y + (1 - pf) * -30, LARGURA, FITA_FOTO.h);
    ctx.restore();
  }

  // o pin cai e prende
  const u = prog(t, tempos.objeto[0], tempos.objeto[1]);
  if (u > 0) {
    const e = saiVolta(u);
    const press = 1 - 0.03 * Math.sin(prog(t, tempos.press[0], tempos.press[1]) * Math.PI);
    const s = (1.25 - 0.25 * e) * press;
    const dy = (1 - saiCubico(u)) * -90;
    ctx.save();
    ctx.globalAlpha = Math.min(1, u * 3);
    ctx.translate(cx, cy + dy);
    ctx.scale(s, s);
    ctx.shadowColor = `rgba(0,0,0,${(0.35 - 0.15 * u).toFixed(3)})`;
    ctx.shadowBlur = 30 * (1 - u) + 6;
    ctx.shadowOffsetY = 40 * (1 - u) + 6;
    ctx.drawImage(c.objeto, -tam / 2, -tam / 2, tam, tam);
    ctx.restore();

    // o número, contando
    const n = prog(t, tempos.numero[0], tempos.numero[1]);
    if (n > 0) {
      ctx.save();
      ctx.translate(cx, cy + dy);
      ctx.scale(s, s);
      desenharNumero(ctx, c.pin, -tam / 2, -tam / 2, tam, n);
      ctx.restore();
    }

    // o clarão de prender
    const v = prog(t, tempos.clarao[0], tempos.clarao[1]);
    if (v > 0 && v < 1) {
      const r = (78 / 120) * tam * (0.4 + v * 0.9);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = Math.sin(v * Math.PI) * 0.85;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(255,255,255,.95)");
      g.addColorStop(0.45, "rgba(255,255,255,.5)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // a luz varre o metal
    const w = prog(t, tempos.luz[0], tempos.luz[1]);
    if (w > 0 && w < 1 && u >= 1) desenharLuz(ctx, c.pin.forma, cx - tam / 2, cy - tam / 2, tam, w);
  }

  // os textos sobem, um por vez (fatias do bloco fotografado)
  const fatia = (de: number, ate: number, a: number, b: number) => {
    const p = saiCubico(prog(t, a, b));
    if (p <= 0) return;
    ctx.save();
    ctx.globalAlpha = p;
    ctx.drawImage(c.texto, 0, de, LARGURA, ate - de, 0, TEXTO_CONQUISTA.y + de + (1 - p) * 26, LARGURA, ate - de);
    ctx.restore();
  };
  fatia(TEXTO_CONQUISTA.frase[0], TEXTO_CONQUISTA.frase[1], tempos.frase[0], tempos.frase[1]);
  fatia(TEXTO_CONQUISTA.linha[0], TEXTO_CONQUISTA.linha[1], tempos.linha[0], tempos.linha[1]);
  fatia(TEXTO_CONQUISTA.nome[0], TEXTO_CONQUISTA.nome[1], tempos.nome[0], tempos.nome[1]);
}

/** Pinta o quadro do vídeo "Minha conquista do mês". */
export function desenharQuadroConquista(ctx: CanvasRenderingContext2D, c: CamadasConquista, t: number, escala: number) {
  ctx.save();
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  desenharCenaConquista(ctx, c, t, TEMPOS_SOLO);
  ctx.restore();
}

/** Pinta o quadro do vídeo "Minhas 3 conquistas": 3 cenas com fusão e o resumo no fim. */
export function desenharQuadroTres(ctx: CanvasRenderingContext2D, c: CamadasTres, t: number, escala: number) {
  ctx.save();
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const n = c.cenas.length;
  const fimCenas = n * SEGMENTO_TRES;
  if (t < fimCenas) {
    const i = Math.min(n - 1, Math.floor(t / SEGMENTO_TRES));
    const local = t - i * SEGMENTO_TRES;
    desenharCenaConquista(ctx, c.cenas[i], local, TEMPOS_SEQ);
    // a fusão pra próxima cena (ou pro resumo) nos últimos 0,25 s
    const restante = SEGMENTO_TRES - local;
    if (restante < FUSAO) {
      const a = 1 - restante / FUSAO;
      ctx.globalAlpha = a;
      if (i + 1 < n) desenharCenaConquista(ctx, c.cenas[i + 1], 0, TEMPOS_SEQ);
      else ctx.drawImage(c.resumo, 0, 0, LARGURA, ALTURA);
      ctx.globalAlpha = 1;
    }
  } else {
    // a fusão da última cena já trouxe o resumo: aqui ele só fica (o fim é o quadro parado, sem outro fade)
    ctx.drawImage(c.resumo, 0, 0, LARGURA, ALTURA);
  }
  ctx.restore();
}
