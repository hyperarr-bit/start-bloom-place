/**
 * A ÁGUA DO "MÊS NO AZUL" (29/09): o contorno da onda como texto de caminho
 * SVG. É o MESMO caminho no card parado (<path d>) e no vídeo
 * (`new Path2D(d)`), então o último quadro do vídeo é igual à imagem.
 */

export interface Onda {
  /** Largura e altura da área (o card inteiro). */
  largura: number;
  altura: number;
  /** Onde fica a superfície (y, em px, do topo). */
  superficie: number;
  /** Altura da crista (px). */
  amplitude: number;
  /** Comprimento de uma onda (px). */
  comprimento: number;
  /** Deslocamento da onda (radianos) — o vídeo anda com isso. */
  fase: number;
  /** Segmentos (mais = mais liso). */
  passos?: number;
}

/** A forma cheia: a superfície ondulada e tudo abaixo dela até o pé do card. */
export function caminhoDaOnda({ largura, altura, superficie, amplitude, comprimento, fase, passos = 72 }: Onda): string {
  const k = (Math.PI * 2) / comprimento;
  const pontos: string[] = [];
  for (let i = 0; i <= passos; i++) {
    const x = (largura * i) / passos;
    // duas senoides somadas: a onda não fica "de desenho animado"
    const y = superficie + amplitude * (0.72 * Math.sin(k * x + fase) + 0.28 * Math.sin(k * 1.9 * x - fase * 1.4 + 1.1));
    pontos.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  pontos.push(`L${largura},${altura}`, `L0,${altura}`, "Z");
  return pontos.join(" ");
}
