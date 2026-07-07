/**
 * Desenha emoji em canvas de forma confiável em qualquer plataforma.
 *
 * O bug que isso resolve: pedir `"Apple Color Emoji"` explicitamente em
 * tamanhos grandes faz o iOS/Safari não renderizar NADA (a fonte é bitmap e o
 * fallback não tem o glifo) — a insígnia compartilhada saía só com a borda,
 * sem o desenho. Solução: desenhar o emoji num canvas pequeno (tamanho seguro,
 * fonte genérica — o sistema resolve a fonte de emoji sozinho) e escalar via
 * drawImage.
 */
export const drawEmoji = (
  ctx: CanvasRenderingContext2D,
  emoji: string,
  cx: number,
  cy: number,
  size: number,
) => {
  const base = 128; // tamanho seguro em todas as plataformas
  const off = document.createElement("canvas");
  off.width = base;
  off.height = base;
  const octx = off.getContext("2d");
  if (!octx) return;
  octx.font = `${Math.round(base * 0.82)}px sans-serif`;
  octx.textAlign = "center";
  octx.textBaseline = "middle";
  octx.fillText(emoji, base / 2, base / 2 + base * 0.04);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(off, cx - size / 2, cy - size / 2, size, size);
};
