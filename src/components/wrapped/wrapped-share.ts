import type { WrappedData } from "./MonthlyWrapped";

/**
 * Arte de compartilhamento da retrospectiva (1080×1920, formato story).
 * Mesma linguagem dos slides: grafite + magenta, números gigantes, perfil do
 * mês no centro. Share nativo com fallback de download.
 */

const W = 1080;
const H = 1920;

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

export const renderWrappedImage = async (d: WrappedData): Promise<"shared" | "downloaded" | "failed"> => {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "failed";

  // fundo
  const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
  bg.addColorStop(0, "#D22D80");
  bg.addColorStop(0.35, "#1c1917");
  bg.addColorStop(1, "#1c1917");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 640, 80, W / 2, 640, 700);
  glow.addColorStop(0, "rgba(210,45,128,0.25)");
  glow.addColorStop(1, "rgba(210,45,128,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const font = (weight: string, size: number) =>
    `${weight} ${size}px -apple-system, 'Segoe UI', Roboto, sans-serif`;

  ctx.textAlign = "center";

  // header
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = font("bold", 36);
  ctx.letterSpacing = "10px";
  ctx.fillText("RETROSPECTIVA", W / 2, 210);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "#ffffff";
  ctx.font = font("800", 96);
  ctx.fillText(d.month, W / 2, 330);

  // perfil
  ctx.font = `140px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.fillText(d.profile.emoji, W / 2, 620);
  ctx.fillStyle = "#ffffff";
  ctx.font = font("800", 88);
  ctx.fillText(d.profile.name, W / 2, 790);
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = font("normal", 40);
  ctx.fillText(d.profile.line, W / 2, 860);

  // divisor
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(140, 960);
  ctx.lineTo(W - 140, 960);
  ctx.stroke();

  // stats em 2 colunas
  const stat = (x: number, y: number, label: string, value: string, color = "#ffffff") => {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = font("bold", 32);
    ctx.fillText(label.toUpperCase(), x, y);
    ctx.fillStyle = color;
    ctx.font = font("800", 66);
    ctx.fillText(value, x, y + 78);
  };

  stat(W * 0.28, 1090, "entrou", fmt(d.income), "#6ee7b7");
  stat(W * 0.72, 1090, "saiu", fmt(d.outflow), "#fda4af");
  stat(W * 0.28, 1300, d.balance >= 0 ? "sobrou" : "faltou", fmt(Math.abs(d.balance)));
  stat(W * 0.72, 1300, "guardou", `${d.savingsRate.toFixed(0)}%`, d.savingsRate >= 0 ? "#6ee7b7" : "#fda4af");

  if (d.topCategories[0]) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = font("bold", 32);
    ctx.fillText("MAIOR CATEGORIA", W / 2, 1510);
    ctx.fillStyle = "#f0abfc";
    ctx.font = font("800", 60);
    ctx.fillText(`${d.topCategories[0].label} · ${fmt(d.topCategories[0].value)}`, W / 2, 1585);
  }

  // wordmark
  ctx.font = font("800", 72);
  const word = "core";
  ctx.textAlign = "left";
  const total = ctx.measureText(word).width;
  let x = W / 2 - total / 2;
  ctx.fillStyle = "#fafaf9";
  ctx.fillText("c", x, 1780);
  x += ctx.measureText("c").width;
  ctx.fillStyle = "#D22D80";
  ctx.fillText("o", x, 1780);
  x += ctx.measureText("o").width;
  ctx.fillStyle = "#fafaf9";
  ctx.fillText("re", x, 1780);
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = font("normal", 30);
  ctx.fillText("seu dinheiro, sob controle", W / 2, 1835);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) return "failed";
  const file = new File([blob], `core-retrospectiva-${d.month.toLowerCase()}.png`, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Minha retrospectiva de ${d.month}` });
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
