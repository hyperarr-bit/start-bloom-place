import { Badge } from "./types";
import { tierOf, TIER_META } from "./BadgeMedallion";
import { drawEmoji } from "@/lib/canvas-emoji";

/**
 * Arte de compartilhamento da insígnia (1080×1350, formato de feed).
 * Fundo grafite neutro (sem glow colorido), a cor fica por conta do metal do
 * medalhão — a estrela é a insígnia. Sem XP na imagem: quem vê de fora não
 * conhece o sistema de pontos; raridade comunica sozinha.
 */

const W = 1080;
const H = 1350;

const drawMedallion = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, badge: Badge) => {
  const meta = TIER_META[tierOf(badge.xp)];

  const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  ringGrad.addColorStop(0, meta.ring[0]);
  ringGrad.addColorStop(0.5, meta.ring[1]);
  ringGrad.addColorStop(1, meta.ring[2]);

  // serrilhado
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r * 0.87, cy + Math.sin(a) * r * 0.87, r * 0.075, 0, Math.PI * 2);
    ctx.fillStyle = ringGrad;
    ctx.fill();
  }

  // anel com sombra suave neutra
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 18;
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

  // emoji — via offscreen (ver canvas-emoji.ts; direto some no iOS)
  drawEmoji(ctx, badge.icon, cx, cy + r * 0.02, r * 0.95);
};

export const renderBadgeImage = (badge: Badge): Promise<Blob | null> => {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  const meta = TIER_META[tierOf(badge.xp)];

  // fundo grafite neutro com vinheta sutil
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#181512");
  bg.addColorStop(1, "#26221e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const vign = ctx.createRadialGradient(W / 2, H * 0.42, 200, W / 2, H * 0.42, 900);
  vign.addColorStop(0, "rgba(255,255,255,0.05)");
  vign.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, W, H);

  const font = (weight: string, size: number) =>
    `${weight} ${size}px -apple-system, 'Segoe UI', Roboto, sans-serif`;
  ctx.textAlign = "center";

  // eyebrow na cor do metal da insígnia
  ctx.fillStyle = meta.ring[1];
  ctx.font = font("bold", 34);
  ctx.letterSpacing = "9px";
  ctx.fillText("CONQUISTA DESBLOQUEADA", W / 2, 170);
  ctx.letterSpacing = "0px";

  drawMedallion(ctx, W / 2, 500, 250, badge);

  // raridade (sem XP — quem vê de fora não conhece o sistema de pontos)
  ctx.fillStyle = meta.ring[1];
  ctx.font = font("bold", 30);
  ctx.letterSpacing = "7px";
  ctx.fillText(`INSÍGNIA ${meta.label.toUpperCase()}`, W / 2, 850);
  ctx.letterSpacing = "0px";

  // nome + descrição
  ctx.fillStyle = "#faf8f5";
  ctx.font = font("800", 88);
  ctx.fillText(badge.name, W / 2, 960);
  ctx.fillStyle = "#a8a29e";
  ctx.font = font("normal", 42);
  ctx.fillText(badge.description, W / 2, 1030);

  // rodapé: wordmark neutro + data
  ctx.fillStyle = "#e7e5e4";
  ctx.font = font("800", 60);
  ctx.fillText("core", W / 2, 1210);
  ctx.fillStyle = "#78716c";
  ctx.font = font("normal", 30);
  const date = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  ctx.fillText(date, W / 2, 1265);

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
