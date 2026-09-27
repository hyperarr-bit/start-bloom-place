import { createContext, useContext, useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import { animate } from "framer-motion";

/**
 * A PRANCHETA da retrospectiva (26/09, sistema de temas).
 *
 * As três peles foram desenhadas pelo designer numa tela de 430×932, com
 * cada peça no lugar exato (polaroid torta, lacre no canto, número de 224 px).
 * Em vez de refazer cada página em layout fluido (e perder o desenho), a
 * página é desenhada nessas unidades e a prancheta inteira é ESCALADA pra
 * largura do aparelho: em 360 px tudo vira 0,84 do tamanho — como os
 * Stories fazem. A altura é que varia: 932 é o desenho, e as páginas se
 * apertam até 760 (`m(932, 760)` interpola cada medida). Abaixo de 760 a
 * prancheta encolhe inteira e sobra margem dos lados (celular 16:9).
 *
 * `fs(px)`: texto pequeno nunca fica abaixo de 9 px de verdade depois da
 * escala (kicker de 9,5 em 360 px sairia com 8). Na miniatura da folha de
 * temas não vale (lá é desenho reduzido de propósito).
 */

export const LARGURA_DA_PRANCHETA = 430;
export const ALTURA_DO_DESENHO = 932;
export const ALTURA_MINIMA = 760;
/** Texto nunca menor que isso na tela (px reais). */
const MENOR_TEXTO = 9;

export interface Prancheta {
  /** escala (px reais por unidade de desenho) */
  s: number;
  /** altura útil (dentro da área segura) em unidades de desenho */
  H: number;
  /** altura da tela inteira (o fundo sangra atrás das barras do sistema) */
  cheia: number;
  /** miniatura da folha de temas: sem contagem animada nem texto mínimo */
  miniatura: boolean;
}

export const PranchetaCtx = createContext<Prancheta>({ s: 1, H: ALTURA_DO_DESENHO, cheia: ALTURA_DO_DESENHO, miniatura: false });
export const usePrancheta = () => useContext(PranchetaCtx);

/** Medida no desenho de 932 e no de 760 → a medida desta tela. */
export const interpolar = (H: number) => (v932: number, v760: number) =>
  v760 + ((v932 - v760) * (H - ALTURA_MINIMA)) / (ALTURA_DO_DESENHO - ALTURA_MINIMA);

export const useMedidas = () => {
  const p = usePrancheta();
  const m = interpolar(p.H);
  return {
    ...p,
    /** posição/medida: interpola (e segue a reta acima de 932) */
    m,
    /** tamanho: interpola, mas nunca maior que o desenho */
    t: (v932: number, v760: number) => Math.min(v932, m(v932, v760)),
    /** tamanho de fonte com o piso de legibilidade */
    fs: (px: number) => (p.miniatura ? px : Math.max(px, MENOR_TEXTO / Math.max(0.1, p.s))),
  };
};

/**
 * Camada escalada: 430 × `altura` unidades, desenhada em `escala` a partir de
 * (x, y) em px reais.
 */
export const Camada = ({ x, y, altura, escala, children, style, className, testId }: {
  x: number; y: number; altura: number; escala: number; children?: ReactNode; style?: CSSProperties; className?: string; testId?: string;
}) => (
  <div
    className={className}
    data-testid={testId}
    style={{
      position: "absolute", left: x, top: y, width: LARGURA_DA_PRANCHETA, height: altura,
      transform: `scale(${escala})`, transformOrigin: "0 0", ...style,
    }}
  >
    {children}
  </div>
);

/** A página inteira reduzida (a folha de temas). `largura` em px reais. */
export const Miniatura = ({ largura, children, fundoCor }: { largura: number; children: ReactNode; fundoCor: string }) => {
  const s = largura / LARGURA_DA_PRANCHETA;
  return (
    <div style={{ position: "relative", width: largura, height: ALTURA_DO_DESENHO * s, overflow: "hidden", background: fundoCor }} aria-hidden>
      <PranchetaCtx.Provider value={{ s, H: ALTURA_DO_DESENHO, cheia: ALTURA_DO_DESENHO, miniatura: true }}>
        <Camada x={0} y={0} altura={ALTURA_DO_DESENHO} escala={s}>{children}</Camada>
      </PranchetaCtx.Provider>
    </div>
  );
};

/** Número que "conta" até o valor — o momento-assinatura dos wrappeds. */
export const CountUp = ({ to, render = (v) => `${Math.round(v)}`, delay = 0.25, duration = 1 }: {
  to: number;
  render?: (v: number) => string;
  delay?: number;
  duration?: number;
}) => {
  const { miniatura } = usePrancheta();
  const [v, setV] = useState(miniatura ? to : 0);
  useEffect(() => {
    if (miniatura) { setV(to); return; }
    const controls = animate(0, to, { delay, duration, ease: [0.16, 1, 0.3, 1], onUpdate: setV });
    return () => controls.stop();
  }, [to, delay, duration, miniatura]);
  return <>{render(v)}</>;
};

/* ------------------------------------------------ medir texto (canvas) */

let medidor: CanvasRenderingContext2D | null | undefined;
/** Largura do texto em px na fonte dada (null sem canvas — jsdom). */
export const medirTexto = (texto: string, fonte: string): number | null => {
  if (medidor === undefined) {
    const semCanvas = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);
    try { medidor = semCanvas ? null : document.createElement("canvas").getContext("2d"); } catch { medidor = null; }
  }
  if (!medidor) return null;
  medidor.font = fonte;
  return medidor.measureText(texto).width;
};

export const SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif";
export const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export interface Fonte { familia: "serif" | "inter"; peso?: number; italico?: boolean; /** letter-spacing em em */ espaco?: number }

/** Largura estimada quando não dá pra medir (serifada itálica é estreita; Inter 900 é larga). */
const estimar = (texto: string, f: Fonte) => texto.length * (f.familia === "serif" ? 0.46 : (f.peso ?? 400) >= 800 ? 0.64 : 0.56);

/** Largura de `texto` em `tamanho` px (com o letter-spacing). */
export const larguraDe = (texto: string, tamanho: number, f: Fonte) => {
  const base = medirTexto(texto, `${f.italico ? "italic " : ""}${f.peso ?? 400} 100px ${f.familia === "serif" ? SERIF : INTER}`);
  const em = base !== null ? base / 100 : estimar(texto, f);
  return (em + (f.espaco ?? 0) * texto.length) * tamanho;
};

/** O maior tamanho (até `max`) em que a linha mais larga cabe em `largura`. */
export const tamanhoQueCabe = (linhas: string[], f: Fonte, largura: number, max: number, min = max * 0.4) => {
  const maior = Math.max(1, ...linhas.map((l) => larguraDe(l, 1, f)));
  return Math.max(min, Math.min(max, largura / maior));
};

/** Muda quando as fontes terminam de carregar — quem mede texto recalcula. */
export const useFontesProntas = () => {
  const [n, setN] = useState(0);
  useEffect(() => {
    const fontes = typeof document !== "undefined" ? document.fonts : undefined;
    if (!fontes) return;
    let vivo = true;
    const marcar = () => { if (vivo) setN((x) => x + 1); };
    fontes.ready.then(marcar).catch(() => {});
    fontes.addEventListener?.("loadingdone", marcar);
    return () => { vivo = false; fontes.removeEventListener?.("loadingdone", marcar); };
  }, []);
  return n;
};

/* ------------------------------------------------------ texto em foil */

/** As paradas do foil dourado (as mesmas do `--foil` dos mockups). */
export const PARADAS_DO_FOIL: [number, string][] = [
  [0, "#fff3c4"], [0.22, "#e9c65a"], [0.48, "#b8860b"], [0.62, "#fff1b0"], [0.78, "#d4a629"], [1, "#8f6a0c"],
];
export const FOIL = `linear-gradient(135deg, ${PARADAS_DO_FOIL.map(([p, c]) => `${c} ${p * 100}%`).join(", ")})`;

/** Foil em CSS — só pra TELA (o `background-clip: text` não sai na foto do Safari). */
export const foilCss: CSSProperties = {
  backgroundImage: FOIL,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextFillColor: "transparent",
};

/**
 * Foil em SVG (degradê no preenchimento do texto): é o que vai pra FOTO dos
 * Stories — sai igual no Chrome e no WebKit. Uma linha por item de `linhas`.
 */
export const TextoFoil = ({
  linhas, tamanho, fonte, largura, alturaDaLinha = 1, baseline = 0.8, sombra, pronto = true, testId, alinhar = "start",
}: {
  linhas: string[];
  tamanho: number;
  fonte: Fonte;
  largura: number;
  alturaDaLinha?: number;
  /** onde fica a linha de base na 1ª linha (fração do tamanho) */
  baseline?: number;
  sombra?: string;
  /** as fontes já carregaram e o tamanho foi medido com elas (o gerador dos Stories espera) */
  pronto?: boolean;
  testId?: string;
  alinhar?: "start" | "middle";
}) => {
  const id = `foil${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const altura = tamanho * (baseline + (linhas.length - 1) * alturaDaLinha + 0.26);
  return (
    <svg
      width={largura}
      height={altura}
      style={{ display: "block", overflow: "visible", filter: sombra }}
      data-anel=""
      data-ajustado={pronto ? "" : undefined}
      data-testid={testId}
      role="img"
      aria-label={linhas.join(" ")}
    >
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={largura} y2={altura}>
          {PARADAS_DO_FOIL.map(([p, c]) => <stop key={p} offset={p} stopColor={c} />)}
        </linearGradient>
      </defs>
      {linhas.map((l, i) => (
        <text
          key={i}
          x={alinhar === "middle" ? largura / 2 : 0}
          y={tamanho * (baseline + i * alturaDaLinha)}
          textAnchor={alinhar}
          fill={`url(#${id})`}
          fontFamily={fonte.familia === "serif" ? SERIF : INTER}
          fontStyle={fonte.italico ? "italic" : "normal"}
          fontWeight={fonte.peso ?? 400}
          fontSize={tamanho}
          letterSpacing={(fonte.espaco ?? 0) * tamanho}
        >
          {l}
        </text>
      ))}
    </svg>
  );
};
