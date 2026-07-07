import { Badge } from "./types";
import { tierOf, TIER_META } from "./BadgeMedallion";

/**
 * Gera a arte de compartilhamento da insígnia (1080×1350, formato de feed) e
 * abre o share nativo do celular; sem suporte, baixa o PNG. Desenho 100% em
 * canvas — mesma linguagem do medalhão SVG (metal por raridade + emoji),
 * fundo grafite premium com glow da marca.
 */

const W = 1080;
const H = 1350;

const drawMedallion = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, badge: Badge) => {
  const meta = TIER_META[tierOf(badge.xp)];

  // serrilhado
  const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  ringGrad.addColorStop(0, meta.ring[0]);
  ringGrad.addColorStop(0.5, meta.ring[1]);
  ringGrad.addColorStop(1, meta.ring[2]);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r * 0.87, cy + Math.sin(a) * r * 0.87, r * 0.075, 0, Math.PI * 2);
    ctx.fillStyle = ringGrad;
    ctx.fill();
  }

  // glow
  ctx.save();
  ctx.shadowColor = meta.glow === "none" ? "rgba(0,0,0,0.35)" : meta.ring[1];
  ctx.shadowBlur = 60;

  // anel
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.87, 0, Math.PI * 2);
  ctx.fillStyle = ringGrad;
  ctx.fill();
  ctx.restore();

  // disco
  const discGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r * 0.75);
  discGrad.addColorStop(0, meta.disc[0]);
  discGrad.addColorStop(1, meta.disc[1]);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.73, 0, Math.PI * 2);
  ctx.fillStyle = discGrad;
  ctx.fill();

  // brilho superior
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.2, cy - r * 0.32, r * 0.42, r * 0.25, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fill();
  ctx.restore();

  // emoji
  ctx.font = `${Math.round(r * 0.72)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badge.icon, cx, cy + r * 0.03);
};

export const renderBadgeImage = (badge: Badge): Promise<Blob | null> => {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  const meta = TIER_META[tierOf(badge.xp)];

  // fundo grafite + glow da marca
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1c1917");
  bg.addColorStop(1, "#292524");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 430, 60, W / 2, 430, 600);
  glow.addColorStop(0, "rgba(210,45,128,0.22)");
  glow.addColorStop(1, "rgba(210,45,128,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // eyebrow
  ctx.fillStyle = "#D22D80";
  ctx.font = "bold 34px -apple-system, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.letterSpacing = "8px";
  ctx.fillText("CONQUISTA DESBLOQUEADA", W / 2, 160);
  ctx.letterSpacing = "0px";

  drawMedallion(ctx, W / 2, 460, 240, badge);

  // raridade
  ctx.fillStyle = meta.ring[1];
  ctx.font = "bold 32px -apple-system, 'Segoe UI', Roboto, sans-serif";
  ctx.letterSpacing = "6px";
  ctx.fillText(`INSÍGNIA ${meta.label.toUpperCase()} · +${badge.xp} XP`, W / 2, 790);
  ctx.letterSpacing = "0px";

  // nome + descrição
  ctx.fillStyle = "#fafaf9";
  ctx.font = "bold 84px -apple-system, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(badge.name, W / 2, 900);
  ctx.fillStyle = "#a8a29e";
  ctx.font = "42px -apple-system, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(badge.description, W / 2, 970);

  // rodapé: wordmark + data
  ctx.font = "bold 64px -apple-system, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#fafaf9";
  const word = "core";
  const wWord = ctx.measureText(word).width;
  const x0 = W / 2 - wWord / 2;
  ctx.textAlign = "left";
  ctx.fillText("c", x0, 1200);
  const wC = ctx.measureText("c").width;
  ctx.fillStyle = "#D22D80";
  ctx.fillText("o", x0 + wC, 1200);
  const wO = ctx.measureText("o").width;
  ctx.fillStyle = "#fafaf9";
  ctx.fillText("re", x0 + wC + wO, 1200);

  ctx.textAlign = "center";
  ctx.fillStyle = "#78716c";
  ctx.font = "32px -apple-system, 'Segoe UI', Roboto, sans-serif";
  const date = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  ctx.fillText(date, W / 2, 1260);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
};

/** Compartilha via share nativo; fallback: download do PNG. Retorna o método usado. */
export const shareBadge = async (badge: Badge): Promise<"shared" | "downloaded" | "failed"> => {
  const blob = await renderBadgeImage(badge);
  if (!blob) return "failed";
  const file = new File([blob], `core-conquista-${badge.id}.png`, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Conquista: ${badge.name}` });
      return "shared";
    } catch {
      // usuário cancelou o share — não força download
      return "failed";
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
};
