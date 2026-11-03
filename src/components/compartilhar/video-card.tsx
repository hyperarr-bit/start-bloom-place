import type { ReactNode } from "react";
import { gerarCanvasEMedir } from "@/components/conquistas/gerar-imagem";
import type { Roteiro } from "@/components/conquistas/video/camadas";
import { codificarRoteiro, type EtapaVideo, type VideoGerado } from "@/components/conquistas/video/gerar-video";
import { suporteVideo } from "@/components/conquistas/video/suporte";
import { AGUA_FINAL, AlturaExtraCtx, CORES_AGUA, CardDeCompartilhar, ONDA, pecasDaAbertura, type Camada, type CamadaDaPeca } from "./cards";
import { caminhoDaOnda } from "./onda";
import { numeroBR } from "./textos";
import { FORMATOS, type DadosCard } from "./tipos";

/**
 * O VÍDEO DOS CARDS (29/09): cada card vira uma animação curta que CONTA o
 * número — os dias do calendário acendem um por um e o número sobe junto;
 * no "mês no azul" a água do saldo sobe, passa do zero e vira azul.
 *
 * Como o vídeo das Conquistas (video/camadas.tsx): o card é fotografado UMA
 * vez por camada com o html-to-image ("fundo", "apagado", "aceso",
 * "textos" — o mesmo card, no mesmo lugar) e o canvas só recorta e move. O
 * número é desenhado no canvas (fillText) exatamente onde ele fica no card:
 * a posição, a linha de base, o corpo, a cor e o espaçamento são MEDIDOS no
 * DOM montado. A água é o MESMO caminho da imagem parada (onda.ts). O último
 * quadro é igual à imagem.
 *
 * A codificação é a das Conquistas (`codificarRoteiro`): WebCodecs com o
 * vigia de travamento, MediaRecorder de reserva, e null → a imagem.
 */

export const FPS_CARD = 30;

interface Caixa { x: number; y: number; w: number; h: number }

export interface MedidasDoCard {
  largura: number;
  altura: number;
  numero: { texto: string; x: number; base: number; tam: number; cor: string; espacamento: number; caixa: Caixa } | null;
  /** As casas que acendem (na ordem do DOM = a ordem do tempo). */
  celulas: (Caixa & { feito: boolean })[];
  blocos: Record<string, Caixa>;
}

const caixaDe = (el: Element, raiz: DOMRect): Caixa => {
  const r = el.getBoundingClientRect();
  return { x: r.left - raiz.left, y: r.top - raiz.top, w: r.width, h: r.height };
};

/** Mede o card montado (roda dentro do gerador, com a fonte carregada). */
export function medirCard(alvo: HTMLElement): MedidasDoCard {
  const raiz = alvo.getBoundingClientRect();
  const numEl = alvo.querySelector<HTMLElement>("[data-numero]");
  let numero: MedidasDoCard["numero"] = null;
  if (numEl) {
    const cs = getComputedStyle(numEl);
    const base = numEl.querySelector("[data-base]");
    const cx = caixaDe(numEl, raiz);
    numero = {
      texto: (numEl.textContent ?? "").trim(),
      x: cx.x,
      base: base ? caixaDe(base, raiz).y : cx.y + cx.h * 0.8,
      tam: parseFloat(cs.fontSize) || 100,
      cor: cs.color || "#fff",
      espacamento: parseFloat(cs.letterSpacing) || 0,
      caixa: cx,
    };
  }
  const celulas = Array.from(alvo.querySelectorAll<HTMLElement>("[data-cel]")).map((el) => ({ ...caixaDe(el, raiz), feito: el.hasAttribute("data-feito") }));
  const blocos: Record<string, Caixa> = {};
  alvo.querySelectorAll<HTMLElement>("[data-bloco]").forEach((el) => { blocos[el.dataset.bloco!] = caixaDe(el, raiz); });
  return { largura: raiz.width, altura: raiz.height, numero, celulas, blocos };
}

export interface CamadasDoCard {
  fundo: HTMLCanvasElement;
  apagado: HTMLCanvasElement;
  aceso: HTMLCanvasElement;
  textos: HTMLCanvasElement;
  /** 30/10: os mini-cards da abertura da retrospectiva, um por camada (eles se sobrepõem). */
  pecas?: HTMLCanvasElement[];
  medidas: MedidasDoCard;
}

type Formato916 = "stories" | "feed";

/**
 * (02/11) Só a retrospectiva em TELA CHEIA passa opções; sem elas (postar, Conquistas) é tudo como antes.
 *  · `extra`: px a mais de altura do card (o celular é mais comprido que 9:16 — cards.tsx › AlturaExtraCtx);
 *  · `suspense`: segundos em que só a FRASE aparece antes do número/prova entrar contando.
 */
export interface OpcoesDoRoteiro {
  extra?: number;
  suspense?: number;
  /**
   * (03/11, dono: "na última parece um pancadão… uma pancada de luz") CALMO, só na tela cheia: o que é GRANDE (os
   * blocos do resumo, o nome do perfil, a caixa do fechamento, as capas) entra com fade + leve subida + 0,98→1, em
   * cascata curta (~80 ms), SEM o clarão branco e sem o "pulo" (overshoot); o brilho das casinhas pequenas fica mais
   * fraco; o número termina de contar sem pulsar. O vídeo/imagem de postar não passa isto: continua igual.
   */
  calmo?: boolean;
}

/** Fotografa as camadas (e mede na 1ª). A abertura da retrospectiva: fundo, textos e um mini-card por camada. */
export async function prepararCamadasDoCard(dados: DadosCard, formato: Formato916, moeda?: ReactNode, onPasso?: (feitas: number, de: number) => void, extra = 0): Promise<CamadasDoCard | null> {
  const { w } = FORMATOS[formato];
  const h = FORMATOS[formato].h + extra;
  const foto = (camada: Camada) => <AlturaExtraCtx.Provider value={extra}><CardDeCompartilhar dados={dados} formato={formato} camada={camada} moeda={moeda} /></AlturaExtraCtx.Provider>;
  const nPecas = dados.tipo === "retro-abertura" ? pecasDaAbertura(dados).length : 0;
  const lista: Camada[] = dados.tipo === "retro-abertura"
    ? ["textos", ...Array.from({ length: nPecas }, (_, i) => `peca${i}` as CamadaDaPeca)]
    : ["apagado", "aceso", "textos"];
  const total = lista.length + 1;
  const primeira = await gerarCanvasEMedir(foto("fundo"), { largura: w, altura: h }, medirCard);
  onPasso?.(1, total);
  if (!primeira) return null;
  const fotos = new Map<Camada, HTMLCanvasElement>();
  for (const [i, c] of lista.entries()) {
    const r = await gerarCanvasEMedir(foto(c), { largura: w, altura: h }, () => null);
    onPasso?.(i + 2, total);
    if (!r) return null;
    fotos.set(c, r.canvas);
  }
  const textos = fotos.get("textos")!;
  return {
    fundo: primeira.canvas,
    // a abertura não tem "apagado"/"aceso" (o roteiro dela não usa): fica o fundo, sem fotografar à toa
    apagado: fotos.get("apagado") ?? primeira.canvas,
    aceso: fotos.get("aceso") ?? primeira.canvas,
    textos,
    ...(nPecas ? { pecas: Array.from({ length: nPecas }, (_, i) => fotos.get(`peca${i}` as CamadaDaPeca)!) } : {}),
    medidas: primeira.medida,
  };
}

/* ------------------------------------------------------------------------- *
 * A coreografia
 * ------------------------------------------------------------------------- */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const prog = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(1e-6, b - a));
const saiCubico = (u: number) => 1 - Math.pow(1 - u, 3);
const saiQuartico = (u: number) => 1 - Math.pow(1 - u, 4);
/** (03/11, calmo) Casa maior que isto (px do card) entra suave, sem clarão; a cascata e quanto cada uma leva. */
const CASA_GRANDE = 180;
const PASSO_SUAVE = 0.08;
const DURA_SUAVE = 0.55;
const saiVolta = (u: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };

/** "18" → 18/"" · "18%" → 18/"%" · "4/5" → 4/"/5" · "1.234" → 1234/"" */
export function partesDoNumero(texto: string): { valor: number; sufixo: string } | null {
  const m = /^(\d{1,3}(?:\.\d{3})+|\d+)(.*)$/.exec(texto.trim());
  if (!m) return null;
  return { valor: Number(m[1].replace(/\./g, "")), sufixo: m[2] };
}

/** O texto do número no meio da contagem (com o sufixo e o separador de milhar). */
export const textoContando = (valor: number, sufixo: string) => `${numeroBR(valor)}${sufixo}`;

/** Desenha o número com o espaçamento do card (canvas sem letterSpacing: letra a letra). */
function desenharNumero(ctx: CanvasRenderingContext2D, n: NonNullable<MedidasDoCard["numero"]>, texto: string, escala = 1) {
  ctx.save();
  ctx.font = `900 ${n.tam}px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  ctx.fillStyle = n.cor;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const cx = n.x, cy = n.base;
  if (escala !== 1) {
    // pulsa em volta do centro da caixa do número
    const mx = n.caixa.x + n.caixa.w / 2, my = n.caixa.y + n.caixa.h / 2;
    ctx.translate(mx, my);
    ctx.scale(escala, escala);
    ctx.translate(-mx, -my);
  }
  if (typeof c.letterSpacing === "string") {
    c.letterSpacing = `${n.espacamento}px`;
    ctx.fillText(texto, cx, cy);
  } else {
    let x = cx;
    for (const ch of texto) {
      ctx.fillText(ch, x, cy);
      x += ctx.measureText(ch).width + n.espacamento;
    }
  }
  ctx.restore();
}

/**
 * Recorta um pedaço de uma camada e desenha no mesmo lugar (com deslocamento/
 * escala/alfa). O recorte é preso aos limites da camada: WebKit antigo não
 * desenha nada (ou erra) quando o retângulo de origem sai da imagem.
 */
function pedaco(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, c: Caixa, { alfa = 1, dy = 0, escala = 1, folga = 16 }: { alfa?: number; dy?: number; escala?: number; folga?: number } = {}) {
  if (alfa <= 0) return;
  const x0 = Math.max(0, Math.floor(c.x - folga)), y0 = Math.max(0, Math.floor(c.y - folga));
  const x1 = Math.min(img.width, Math.ceil(c.x + c.w + folga)), y1 = Math.min(img.height, Math.ceil(c.y + c.h + folga));
  const w = x1 - x0, h = y1 - y0;
  if (w <= 0 || h <= 0) return;
  ctx.save();
  ctx.globalAlpha = alfa;
  if (escala !== 1) {
    const mx = c.x + c.w / 2, my = c.y + c.h / 2;
    ctx.translate(mx, my + dy);
    ctx.scale(escala, escala);
    ctx.translate(-mx, -my);
    ctx.drawImage(img, x0, y0, w, h, x0, y0, w, h);
  } else {
    ctx.drawImage(img, x0, y0, w, h, x0, y0 + dy, w, h);
  }
  ctx.restore();
}

export interface TemposDoCard {
  duracao: number;
  apagado: [number, number];
  rotulo: [number, number];
  acende: [number, number];
  /** Quanto dura o "pop" de cada casa. */
  pop: number;
  estatisticas: [number, number];
  assinatura: [number, number];
}

/**
 * Os tempos da coreografia, conforme quantas casas acendem (até ~2,4 s acendendo). (03/11) `passoMax`/`pop`: o
 * modo calmo usa uma cascata mais curta (0,08 s) e cada bloco grande leva mais (0,5 s) — o padrão é o de sempre.
 */
export function temposDoCard(nCasas: number, { passoMax = 0.16, pop = 0.3 }: { passoMax?: number; pop?: number } = {}): TemposDoCard {
  const inicio = 0.75;
  const passo = nCasas > 0 ? Math.min(passoMax, 2.4 / nCasas) : 0;
  const fim = inicio + passo * Math.max(0, nCasas - 1) + pop;
  const duracao = Math.max(5.5, fim + 2.2);
  return {
    duracao,
    apagado: [0.1, 0.55],
    rotulo: [0.35, 0.8],
    acende: [inicio, fim],
    pop,
    estatisticas: [fim + 0.15, fim + 0.6],
    assinatura: [fim + 0.4, fim + 0.85],
  };
}

/**
 * O roteiro geral: a prova acende casa por casa e o número conta junto.
 * (02/11) `suspense` > 0 (tela cheia): a FRASE (título/rótulo) aparece sozinha primeiro e o número + a prova
 * entram `suspense` segundos depois, contando — o "segura… e revela".
 */
export function roteiroQueAcende(cam: CamadasDoCard, largura: number, altura: number, suspense = 0, calmo = false): Roteiro {
  const m = cam.medidas;
  const casas = m.celulas.filter((c) => c.feito);
  // sem casas (a insígnia, a figurinha): a prova inteira é uma "casa" só
  const alvos = casas.length ? casas : m.blocos.prova ? [m.blocos.prova] : [];
  const unica = !casas.length;
  // (03/11) calmo: casas GRANDES (os blocos do resumo, as linhas das metas) ou a prova única entram suaves, sem clarão
  const suave = calmo && (unica || alvos.some((c) => Math.max(c.w, c.h) > CASA_GRANDE));
  const pop = suave ? DURA_SUAVE : 0.3;
  const T = comSuspense(temposDoCard(alvos.length, suave ? { passoMax: PASSO_SUAVE, pop } : {}), suspense);
  const partes = m.numero ? partesDoNumero(m.numero.texto) : null;
  const passo = alvos.length > 1 ? (T.acende[1] - pop - T.acende[0]) / (alvos.length - 1) : 0;
  const desenhar = (ctx: CanvasRenderingContext2D, t: number, escala: number) => {
    ctx.save();
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.globalAlpha = 1;
    ctx.drawImage(cam.fundo, 0, 0, largura, altura);
    // o esqueleto da prova (o calendário apagado) chega
    const pa = saiCubico(prog(t, T.apagado[0], T.apagado[1]));
    if (pa > 0) { ctx.globalAlpha = pa; ctx.drawImage(cam.apagado, 0, (1 - pa) * 24, largura, altura); ctx.globalAlpha = 1; }
    // as casas acendem, uma por uma, com um "pop"
    let acesas = 0;
    alvos.forEach((c, i) => {
      const inicio = T.acende[0] + i * passo;
      if (suave) {
        // fade + leve subida + 0,98→1, ease-out — sem brilho e sem passar do tamanho
        const u = prog(t, inicio, inicio + DURA_SUAVE);
        if (u <= 0) return;
        acesas++;
        const p = saiQuartico(u);
        pedaco(ctx, cam.aceso, c, { alfa: p, escala: 0.98 + 0.02 * p, dy: (1 - p) * (unica ? 56 : 32), folga: unica ? 60 : 10 });
        return;
      }
      const u = prog(t, inicio, inicio + (unica ? 0.55 : T.pop));
      if (u <= 0) return;
      acesas++;
      const e = unica ? 1.25 - 0.25 * saiVolta(u) : 0.55 + 0.45 * saiVolta(u);
      // a folga do recorte não pode pegar a casa vizinha (nos quadradinhos pequenos do "desde março")
      // 23/10: a prova única (as capas, a moeda) também SOBE enquanto aparece (o dono: "coisas subindo")
      pedaco(ctx, cam.aceso, c, { alfa: Math.min(1, u * 3), escala: e, dy: unica ? (1 - saiCubico(u)) * 160 : 0, folga: unica ? 60 : Math.max(2, Math.min(10, Math.min(c.w, c.h) * 0.12)) });
      // o brilho de acender
      if (u < 1) {
        const r = Math.max(c.w, c.h) * (0.5 + 0.7 * u);
        const g = ctx.createRadialGradient(c.x + c.w / 2, c.y + c.h / 2, 0, c.x + c.w / 2, c.y + c.h / 2, r);
        g.addColorStop(0, `rgba(255,255,255,${((calmo ? 0.3 : 0.55) * (1 - u)).toFixed(3)})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(c.x + c.w / 2, c.y + c.h / 2, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });
    // o número conta junto com as casas (e pulsa quando fecha)
    if (m.numero) {
      const pn = saiCubico(prog(t, 0.2 + suspense, 0.55 + suspense));
      if (pn > 0) {
        let texto = m.numero.texto;
        if (partes && alvos.length) {
          // com uma prova só (as capas, a moeda), o número sobe junto com ela
          const v = t >= T.acende[1] ? partes.valor : unica ? Math.round(partes.valor * saiCubico(prog(t, T.acende[0], T.acende[1]))) : Math.round((partes.valor * acesas) / alvos.length);
          texto = textoContando(v, partes.sufixo);
        }
        // (calmo: o número chega no valor e fica — sem o pulo do pulso)
        const pulso = calmo ? 1 : 1 + 0.05 * Math.sin(prog(t, T.acende[1] - 0.05, T.acende[1] + 0.35) * Math.PI);
        ctx.save();
        ctx.globalAlpha = pn;
        ctx.translate(0, (1 - pn) * 30);
        desenharNumero(ctx, m.numero, texto, pulso);
        ctx.restore();
      }
    }
    // os textos sobem em ordem: rótulo, estatísticas, assinatura (o resto junto com o rótulo)
    const bloco = (nome: string, [a, b]: [number, number]) => {
      const c = m.blocos[nome];
      if (!c) return;
      const p = saiCubico(prog(t, a, b));
      pedaco(ctx, cam.textos, c, { alfa: p, dy: (1 - p) * 28 });
    };
    // com uma prova só (a moeda, a figurinha), o rótulo vem DEPOIS dela
    const tRotulo: [number, number] = unica ? [T.acende[1] - 0.05, T.acende[1] + 0.4] : T.rotulo;
    // com suspense, a frase vem ANTES de tudo (é ela que segura a revelação); a legenda continua depois da prova
    const tFrase: [number, number] = suspense > 0 ? [0.1, 0.55] : tRotulo;
    bloco("titulo", tFrase);
    bloco("rotulo", tFrase);
    bloco("legenda", tRotulo);
    bloco("nivel", [T.acende[1] - 0.1, T.acende[1] + 0.35]);
    bloco("estatisticas", T.estatisticas);
    bloco("assinatura", T.assinatura);
    ctx.restore();
  };
  return { duracao: T.duracao, desenhar };
}

/** Os tempos com o suspense: tudo menos a frase anda `s` segundos pra frente. */
export function comSuspense(T: TemposDoCard, s: number): TemposDoCard {
  if (!s) return T;
  const mais = ([a, b]: [number, number]): [number, number] => [a + s, b + s];
  return { ...T, duracao: T.duracao + s, apagado: mais(T.apagado), rotulo: [0.1, 0.55], acende: mais(T.acende), estatisticas: mais(T.estatisticas), assinatura: mais(T.assinatura) };
}

/**
 * O roteiro da ÁGUA ("mês no azul" e "guardei X%"): a água sobe do pé do
 * card; no azul ela vem VERMELHA até passar da linha do zero e vira azul
 * (o saldo passando de negativo pra positivo). As ondas andam e param na
 * mesma fase da imagem parada.
 */
export function roteiroDaAgua(cam: CamadasDoCard, largura: number, altura: number, formato: Formato916, comVermelho: boolean, suspense = 0): Roteiro {
  const m = cam.medidas;
  const superficieFinal = AGUA_FINAL[formato];
  const zero = Math.min(altura - 160, superficieFinal + (formato === "stories" ? 520 : 360));
  const duracao = 5.6 + suspense;
  const sobe: [number, number] = [0.45 + suspense, 2.9 + suspense];
  const nivel = (t: number) => {
    const u = saiCubico(prog(t, sobe[0], sobe[1]));
    return altura + 40 - (altura + 40 - superficieFinal) * u;
  };
  // quando a superfície cruza o zero
  let tZero = sobe[1];
  for (let t = sobe[0]; t <= sobe[1]; t += 0.01) if (nivel(t) <= zero) { tZero = t; break; }
  const casas = m.celulas.filter((c) => c.feito);
  const partes = m.numero ? partesDoNumero(m.numero.texto) : null;
  const desenhar = (ctx: CanvasRenderingContext2D, t: number, escala: number) => {
    ctx.save();
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.globalAlpha = 1;
    ctx.drawImage(cam.fundo, 0, 0, largura, altura);
    // o título em cima
    const pt = saiCubico(prog(t, 0.1, 0.6));
    if (m.blocos.titulo) pedaco(ctx, cam.textos, m.blocos.titulo, { alfa: pt, dy: (1 - pt) * 30 });
    // a linha do zero (some depois que a água passa)
    const vermelho = comVermelho ? 1 - clamp01((t - tZero) / 0.35) : 0;
    const linhaAlfa = comVermelho ? clamp01((t - 0.3 - suspense) / 0.3) * (1 - clamp01((t - tZero - 0.25) / 0.4)) : 0;
    // a água
    const s = nivel(t);
    let caminho: Path2D | null = null;
    if (s < altura + 30) {
      const fase = ONDA.faseFinal + (t - duracao) * 2.1;
      const amp = ONDA.amplitude * (1 + 0.6 * (1 - saiCubico(prog(t, sobe[0], sobe[1] + 0.6))));
      caminho = new Path2D(caminhoDaOnda({ largura, altura, superficie: s, amplitude: amp, comprimento: ONDA.comprimento, fase }));
      const pinta = (cores: readonly string[], alfa: number) => {
        if (alfa <= 0) return;
        const g = ctx.createLinearGradient(0, s, 0, altura);
        g.addColorStop(0, cores[0]);
        g.addColorStop(1, cores[1]);
        ctx.save();
        ctx.globalAlpha = alfa;
        ctx.fillStyle = g;
        ctx.fill(caminho!);
        ctx.restore();
      };
      pinta(CORES_AGUA.azul, 1);
      pinta(CORES_AGUA.vermelho, vermelho);
    }
    if (linhaAlfa > 0) {
      ctx.save();
      ctx.globalAlpha = linhaAlfa;
      ctx.strokeStyle = s < zero ? "rgba(255,255,255,.85)" : "rgba(31,31,36,.45)";
      ctx.lineWidth = 4;
      ctx.setLineDash([16, 14]);
      ctx.beginPath();
      ctx.moveTo(0, zero);
      ctx.lineTo(largura, zero);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "800 30px Inter, -apple-system, sans-serif";
      ctx.fillStyle = s < zero ? "#ffffff" : "rgba(31,31,36,.6)";
      ctx.fillText("SALDO ZERO", 84, zero - 18);
      ctx.restore();
    }
    // "no azul." aparece DENTRO da água: a própria água vai revelando as letras (depois de passar do zero)
    if (m.blocos.rotulo && caminho && t >= tZero) {
      ctx.save();
      ctx.clip(caminho);
      pedaco(ctx, cam.textos, m.blocos.rotulo, { alfa: saiCubico(prog(t, tZero, tZero + 0.25)) });
      ctx.restore();
    }
    // o número (poupança) conta enquanto a água sobe — e só aparece dentro dela
    if (m.numero && partes && caminho) {
      const pn = saiCubico(prog(t, sobe[0] + 0.3, sobe[0] + 0.7));
      if (pn > 0) {
        const v = Math.round(partes.valor * saiCubico(prog(t, sobe[0] + 0.3, sobe[1] + 0.3)));
        ctx.save();
        ctx.clip(caminho);
        ctx.globalAlpha = pn;
        desenharNumero(ctx, m.numero, textoContando(v, partes.sufixo));
        ctx.restore();
      }
    }
    // as moedas (poupança) acendem uma por uma; as fichas dos meses entram
    const t0 = sobe[1] - 0.2;
    casas.forEach((c, i) => {
      const u = prog(t, t0 + i * 0.12, t0 + i * 0.12 + 0.3);
      if (u > 0) pedaco(ctx, cam.aceso, c, { alfa: Math.min(1, u * 3), escala: 0.55 + 0.45 * saiVolta(u), folga: 10 });
    });
    if (m.blocos.prova) {
      const pp = saiCubico(prog(t, t0, t0 + 0.4));
      // o esqueleto (moedas vazias) — ou as fichas dos meses, que estão nos textos
      pedaco(ctx, cam.apagado, m.blocos.prova, { alfa: pp, dy: (1 - pp) * 20 });
      pedaco(ctx, cam.textos, m.blocos.prova, { alfa: pp, dy: (1 - pp) * 20 });
    }
    const fim = t0 + Math.max(0.4, casas.length * 0.12 + 0.3);
    const bloco = (nome: string, a: number) => { const c = m.blocos[nome]; if (!c) return; const p = saiCubico(prog(t, a, a + 0.45)); pedaco(ctx, cam.textos, c, { alfa: p, dy: (1 - p) * 28 }); };
    bloco("legenda", fim);
    bloco("estatisticas", fim + 0.15);
    bloco("assinatura", fim + 0.4);
    ctx.restore();
  };
  return { duracao, desenhar };
}

/**
 * O roteiro da ABERTURA da retrospectiva (30/10, a entrada do protótipo do
 * Codex): o cabeçalho já está lá; "Seu outubro," e "do seu jeito." sobem por
 * trás de uma máscara (uma linha depois da outra), a frase aparece, os
 * mini-cards entram um por um vindo de baixo e a assinatura chega por último.
 * O último quadro é igual à imagem.
 */
export const TEMPOS_DA_ABERTURA = {
  linhas: [[0.05, 0.75], [0.22, 0.92]] as [number, number][],
  sub: [0.65, 1.25] as [number, number],
  /** início do 1º mini-card, o intervalo entre eles e quanto cada um leva */
  pecas: { inicio: 0.55, passo: 0.16, dura: 0.6, sobe: 100 },
  assinatura: [1.8, 2.4] as [number, number],
  duracao: 4.5,
};

export function roteiroDaAbertura(cam: CamadasDoCard, largura: number, altura: number): Roteiro {
  const m = cam.medidas;
  const T = TEMPOS_DA_ABERTURA;
  const desenhar = (ctx: CanvasRenderingContext2D, t: number, escala: number) => {
    ctx.save();
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.globalAlpha = 1;
    ctx.drawImage(cam.fundo, 0, 0, largura, altura);
    // as duas linhas do título: sobem de dentro da própria caixa (a máscara)
    (["titulo1", "titulo2"] as const).forEach((nome, i) => {
      const c = m.blocos[nome];
      if (!c) return;
      const p = saiCubico(prog(t, T.linhas[i][0], T.linhas[i][1]));
      if (p <= 0) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(c.x - 20, c.y, c.w + 40, c.h);
      ctx.clip();
      pedaco(ctx, cam.textos, c, { dy: (c.h + 8) * (1 - p), folga: 0 });
      ctx.restore();
    });
    const aparece = (img: HTMLCanvasElement, c: Caixa | undefined, [a, b]: [number, number], sobe: number, folga = 16) => {
      if (!c) return;
      const p = saiCubico(prog(t, a, b));
      pedaco(ctx, img, c, { alfa: p, dy: sobe * (1 - p), folga });
    };
    aparece(cam.textos, m.blocos.sub, T.sub, 25);
    (cam.pecas ?? []).forEach((img, i) => {
      const a = T.pecas.inicio + i * T.pecas.passo;
      // a sombra do mini-card passa da caixa: folga larga (a camada só tem ele)
      aparece(img, m.blocos[`peca${i}`], [a, a + T.pecas.dura], T.pecas.sobe, 60);
    });
    aparece(cam.textos, m.blocos.assinatura, T.assinatura, 8);
    ctx.restore();
  };
  return { duracao: T.duracao, desenhar };
}

/** Quanto o perfil segura o "Seu outubro foi…" antes do nome (vale também no vídeo de postar: sem isso o nome vinha antes da frase). */
export const SUSPENSE_DO_PERFIL = 0.8;

/** O roteiro de cada tipo de card. */
export function roteiroDoCard(dados: DadosCard, cam: CamadasDoCard, formato: Formato916, opcoes: OpcoesDoRoteiro = {}): Roteiro {
  const { w } = FORMATOS[formato];
  const h = FORMATOS[formato].h + (opcoes.extra ?? 0);
  const s = opcoes.suspense ?? 0;
  const calmo = !!opcoes.calmo;
  if (dados.tipo === "azul") return roteiroDaAgua(cam, w, h, formato, true, s);
  if (dados.tipo === "poupanca") return roteiroDaAgua(cam, w, h, formato, false, s);
  if (dados.tipo === "retro-abertura") return roteiroDaAbertura(cam, w, h);
  if (dados.tipo === "retro-perfil") return roteiroQueAcende(cam, w, h, Math.max(s, SUSPENSE_DO_PERFIL), calmo);
  return roteiroQueAcende(cam, w, h, s, calmo);
}

/* ------------------------------------------------------------------------- *
 * Gerar (e guardar o roteiro pra prévia ao vivo e o "Postar vídeo" logo depois)
 * ------------------------------------------------------------------------- */

/** (02/11) Guarda as CAMADAS (o caro); o roteiro é refeito na hora (barato) — o mesmo card com e sem suspense não fotografa duas vezes. */
const cache = new Map<string, Promise<CamadasDoCard | null>>();

export function prepararRoteiroDoCard(dados: DadosCard, formato: Formato916, moeda?: ReactNode, onPasso?: (f: number, de: number) => void, opcoes: OpcoesDoRoteiro = {}): Promise<Roteiro | null> {
  const extra = Math.max(0, Math.round(opcoes.extra ?? 0));
  const chave = JSON.stringify([formato, extra, dados]);
  let p = cache.get(chave);
  if (!p) {
    p = prepararCamadasDoCard(dados, formato, moeda, onPasso, extra);
    cache.set(chave, p);
    // cada card guarda 4 camadas de 1080×1920 (~33 MB): no máximo 2 na memória
    if (cache.size > 2) cache.delete(cache.keys().next().value!);
    p.then((c) => { if (!c) cache.delete(chave); }, () => cache.delete(chave));
  }
  return p.then((cam) => (cam ? roteiroDoCard(dados, cam, formato, { ...opcoes, extra }) : null));
}

/** Gera o MP4 do card no aparelho. null = não deu (quem chama manda a imagem). */
export async function gerarVideoDoCard(dados: DadosCard, formato: Formato916, onProgresso?: (fracao: number, etapa: EtapaVideo) => void, moeda?: ReactNode): Promise<VideoGerado | null> {
  const t0 = performance.now();
  if (!(await suporteVideo())) return null;
  const roteiro = await prepararRoteiroDoCard(dados, formato, moeda, (f, de) => onProgresso?.(0.04 + (0.26 * f) / de, "camadas"));
  if (!roteiro) return null;
  return codificarRoteiro(roteiro, onProgresso, t0, FORMATOS[formato].h);
}
