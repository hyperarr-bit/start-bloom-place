import { useLayoutEffect, useState } from "react";

interface Props {
  cx: number;
  cy: number;
  r: number;
  texto: string;
  fontSize: number;
  fill: string;
  fontWeight?: number;
}

const FONTE = "Inter, -apple-system, sans-serif";

let medidor: CanvasRenderingContext2D | null | undefined;
/** Largura de cada letra (canvas 2D — mede igual em qualquer motor). */
const medirLetras = (texto: string, fontSize: number, fontWeight: number): number[] | null => {
  if (medidor === undefined) {
    // jsdom (testes) não tem canvas: cai na estimativa sem sujar o console
    const semCanvas = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);
    try { medidor = semCanvas ? null : document.createElement("canvas").getContext("2d"); } catch { medidor = null; }
  }
  if (!medidor) return null;
  // mede em tamanho grande e escala (em 7 px o arredondamento do canvas distorce)
  medidor.font = `${fontWeight} 100px Inter, -apple-system, sans-serif`;
  return Array.from(texto).map((ch) => (medidor!.measureText(ch).width * fontSize) / 100);
};

/** Largura aproximada quando não dá pra medir (teste, SSR): maiúscula larga, espaço e ponto estreitos. */
const estimar = (texto: string, fontSize: number) =>
  Array.from(texto).map((ch) => fontSize * (ch === " " ? 0.28 : ch === "·" ? 0.3 : /[IÍ1]/.test(ch) ? 0.34 : /[MW]/.test(ch) ? 0.9 : 0.68));

/**
 * Texto em anel que FECHA o círculo (26/09), letra por letra.
 *
 * A 1ª versão usava <textPath> + letter-spacing: no Chrome fechava certinho,
 * mas o WebKit (iPhone) trata o espaçamento do textPath do jeito dele — o anel
 * do selo saía embolado e, na foto dos Stories, a frase atropelava o começo.
 * Agora cada letra é posicionada e girada na mão: mede a largura de cada uma,
 * distribui a sobra do círculo por igual entre elas e todo motor desenha igual.
 * Começa às 9 horas e corre no sentido horário (por cima), como o textPath.
 * `data-ajustado` avisa o gerador dos Stories que o anel já foi medido com a
 * fonte carregada.
 */
export const TextoEmAnel = ({ cx, cy, r, texto, fontSize, fill, fontWeight = 800 }: Props) => {
  const [larguras, setLarguras] = useState<number[] | null>(null);

  useLayoutEffect(() => {
    let vivo = true;
    const medir = () => {
      if (!vivo) return;
      const m = medirLetras(texto, fontSize, fontWeight);
      if (m) setLarguras(m);
    };
    medir();
    document.fonts?.ready.then(medir).catch(() => {});
    return () => { vivo = false; };
  }, [texto, fontSize, fontWeight]);

  const w = larguras ?? estimar(texto, fontSize);
  const letras = Array.from(texto);
  const total = w.reduce((s, x) => s + x, 0);
  const sobra = (2 * Math.PI * r - total) / letras.length;
  let andado = 0;

  return (
    <g data-anel="" data-ajustado={larguras ? "" : undefined} fill={fill} stroke="none" fontFamily={FONTE} fontSize={fontSize} fontWeight={fontWeight}>
      {letras.map((ch, i) => {
        const meio = andado + w[i] / 2 + sobra / 2;
        andado += w[i] + sobra;
        if (ch === " ") return null;
        // -90°: a letra desenhada no topo do círculo vai pro começo (9 horas)
        const graus = -90 + (meio / r) * (180 / Math.PI);
        return (
          <text key={i} x={cx} y={cy - r} textAnchor="middle" transform={`rotate(${graus.toFixed(2)} ${cx} ${cy})`}>
            {ch}
          </text>
        );
      })}
    </g>
  );
};
