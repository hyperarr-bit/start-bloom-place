import { Badge } from "./types";
import { getLevel } from "./types";
import { tierOf, TIER_META } from "./BadgeMedallion";
import { drawEmoji } from "@/lib/canvas-emoji";

/**
 * Arte do "cartão do membro" (1080×1350). Visual de cartão premium: grafite
 * neutro, tipografia grande, o metal do nível dá a cor. Sem XP — pra quem vê
 * de fora falam o nível, o streak e as insígnias.
 */

const W = 1080;
const H = 1350;

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

export const renderProfileImage = (
  name: string,
  totalXP: number,
  badges: Badge[],
  streak: number,
): Promise<Blob | null> => {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  const level = getLevel(totalXP);
  const unlocked = badges.filter((b) => b.unlocked);
  const top3 = [...unlocked].sort((a, b) => b.xp - a.xp).slice(0, 3);

  const font = (weight: string, size: number) =>
    `${weight} ${size}px -apple-system, 'Segoe UI', Roboto, sans-serif`;

  // fundo
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#181512");
  bg.addColorStop(1, "#26221e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ---- o cartão ----
  const cardX = 90, cardY = 300, cardW = W - 180, cardH = 620, r = 44;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 26;
  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  cardGrad.addColorStop(0, "#2b2724");
  cardGrad.addColorStop(1, "#1b1815");
  roundRect(ctx, cardX, cardY, cardW, cardH, r);
  ctx.fillStyle = cardGrad;
  ctx.fill();
  ctx.restore();

  // borda fina dourada suave
  roundRect(ctx, cardX, cardY, cardW, cardH, r);
  ctx.strokeStyle = "rgba(251,191,36,0.35)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // brilho diagonal sutil no cartão
  const shine = ctx.createLinearGradient(cardX, cardY, cardX + cardW * 0.7, cardY + cardH);
  shine.addColorStop(0, "rgba(255,255,255,0.07)");
  shine.addColorStop(0.5, "rgba(255,255,255,0)");
  roundRect(ctx, cardX, cardY, cardW, cardH, r);
  ctx.fillStyle = shine;
  ctx.fill();

  // conteúdo do cartão
  ctx.textAlign = "left";
  ctx.fillStyle = "#a8a29e";
  ctx.font = font("bold", 26);
  ctx.letterSpacing = "6px";
  ctx.fillText("CORE · CARTÃO DO MEMBRO", cardX + 56, cardY + 90);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = "#faf8f5";
  ctx.font = font("800", 68);
  ctx.fillText(name.slice(0, 18), cardX + 56, cardY + 200);

  // nível com emoji
  drawEmoji(ctx, level.icon, cardX + 82, cardY + 300, 64);
  ctx.fillStyle = "#fbbf24";
  ctx.font = font("bold", 44);
  ctx.fillText(`Nível ${level.name}`, cardX + 132, cardY + 316);

  // linha de stats
  ctx.fillStyle = "#d6d3d1";
  ctx.font = font("600", 34);
  ctx.fillText(`🔥 ${streak} dias de sequência`, cardX + 56, cardY + 410);
  ctx.fillText(`🏅 ${unlocked.length} de ${badges.length} conquistas`, cardX + 56, cardY + 470);

  // mini-medalhões das 3 melhores no canto direito
  top3.forEach((b, i) => {
    const meta = TIER_META[tierOf(b.xp)];
    const mx = cardX + cardW - 110;
    const my = cardY + 150 + i * 130;
    const grad = ctx.createLinearGradient(mx - 50, my - 50, mx + 50, my + 50);
    grad.addColorStop(0, meta.ring[0]);
    grad.addColorStop(1, meta.ring[2]);
    ctx.beginPath();
    ctx.arc(mx, my, 52, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(mx, my, 42, 0, Math.PI * 2);
    ctx.fillStyle = meta.disc[0];
    ctx.fill();
    drawEmoji(ctx, b.icon, mx, my, 56);
  });

  // headline acima do cartão
  ctx.textAlign = "center";
  ctx.fillStyle = "#faf8f5";
  ctx.font = font("800", 64);
  ctx.fillText("Minhas finanças, no controle", W / 2, 190);

  // rodapé
  ctx.fillStyle = "#e7e5e4";
  ctx.font = font("800", 58);
  ctx.fillText("core", W / 2, 1120);
  ctx.fillStyle = "#78716c";
  ctx.font = font("normal", 30);
  ctx.fillText("organize sua vida num só app", W / 2, 1172);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
};

export const shareProfile = async (
  name: string,
  totalXP: number,
  badges: Badge[],
  streak: number,
): Promise<"shared" | "downloaded" | "failed"> => {
  const blob = await renderProfileImage(name, totalXP, badges, streak);
  if (!blob) return "failed";
  const file = new File([blob], "core-meu-perfil.png", { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Meu perfil no CORE" });
      return "shared";
    } catch {
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
