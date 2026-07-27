import type { RetroMes } from "@/lib/retrospectiva";
import { drawEmoji } from "@/lib/canvas-emoji";

/**
 * Arte de compartilhamento da retrospectiva (1080×1920, formato story).
 * Mesma linguagem dos slides: grafite + magenta, números gigantes, perfil do
 * mês no centro. Share nativo com fallback de download.
 *
 * 27/07: os quatro números do meio não são mais fixos em dinheiro. Quem não
 * usa Finanças estava gerando um card com quatro "R$ 0" — pior do que não ter
 * botão de compartilhar. Agora o card mostra os quatro números que a pessoa
 * de fato tem, na ordem em que importam.
 */

const W = 1080;
const H = 1920;

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

type Destaque = { label: string; value: string; color?: string };

/** Os até-4 números do card, escolhidos pelo que a pessoa realmente registrou. */
const destaquesDe = (r: RetroMes): Destaque[] => {
  const out: Destaque[] = [];
  const f = r.financas;
  const v = r.vida;

  if (f) {
    out.push({ label: "entrou", value: fmt(f.income), color: "#6ee7b7" });
    out.push({ label: "saiu", value: fmt(f.outflow), color: "#fda4af" });
    out.push({ label: f.balance >= 0 ? "sobrou" : "faltou", value: fmt(Math.abs(f.balance)) });
    out.push({
      label: "guardou",
      value: `${f.savingsRate.toFixed(0)}%`,
      color: f.savingsRate >= 0 ? "#6ee7b7" : "#fda4af",
    });
  }
  if (v) {
    if (v.diasAtivos > 0) out.push({ label: "dias ativos", value: `${v.diasAtivos}`, color: "#fcd34d" });
    if (v.melhorSequencia >= 3) out.push({ label: "melhor sequência", value: `${v.melhorSequencia}`, color: "#fcd34d" });
    if (v.livros.length > 0) out.push({ label: v.livros.length === 1 ? "livro" : "livros", value: `${v.livros.length}`, color: "#7dd3fc" });
    if (v.treinos > 0) out.push({ label: "treinos", value: `${v.treinos}`, color: "#fda4af" });
    if (v.diasDeDiario > 0) out.push({ label: "dias de diário", value: `${v.diasDeDiario}`, color: "#c4b5fd" });
    if (v.humorMedio !== null) out.push({ label: "humor médio", value: `${v.humorMedio.toFixed(1)}/5`, color: "#c4b5fd" });
  }
  return out.slice(0, 4);
};

/** A linha do rodapé sai do que o mês foi, não de um slogan fixo de finanças. */
const rodapeDe = (r: RetroMes): string => {
  const v = r.vida;
  if (v && v.livros.length > 0) return `${v.livros.length} ${v.livros.length === 1 ? "livro" : "livros"} · ${v.diasAtivos} dias no jogo`;
  if (v && v.diasAtivos > 0) return `${v.diasAtivos} de ${v.diasPossiveis} dias no jogo`;
  if (r.financas) return "seu dinheiro, sob controle";
  return "sua vida, organizada";
};

export const renderWrappedImage = async (r: RetroMes): Promise<"shared" | "downloaded" | "failed"> => {
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
  ctx.fillText(r.mes, W / 2, 330);

  // perfil — emoji via offscreen (direto em fonte grande some no iOS)
  drawEmoji(ctx, r.perfil.emoji, W / 2, 570, 180);
  ctx.fillStyle = "#ffffff";
  ctx.font = font("800", 88);
  ctx.fillText(r.perfil.name, W / 2, 790);
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = font("normal", 40);
  ctx.fillText(r.perfil.line, W / 2, 860);

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

  // grade 2×2 que se adapta: com 1 ou 2 números eles ficam centralizados em
  // vez de encostados na esquerda com metade do card vazia.
  const destaques = destaquesDe(r);
  destaques.forEach((s, i) => {
    const ultimaSozinha = destaques.length % 2 === 1 && i === destaques.length - 1;
    const x = ultimaSozinha ? W / 2 : i % 2 === 0 ? W * 0.28 : W * 0.72;
    const y = 1090 + Math.floor(i / 2) * 210;
    stat(x, y, s.label, s.value, s.color ?? "#ffffff");
  });

  const rodape = r.financas?.topCategories[0]
    ? { titulo: "MAIOR CATEGORIA", texto: `${r.financas.topCategories[0].label} · ${fmt(r.financas.topCategories[0].value)}` }
    : r.vida?.livros[0]
    ? { titulo: "O LIVRO DO MÊS", texto: r.vida.livros[0].titulo }
    : null;

  if (rodape) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = font("bold", 32);
    ctx.fillText(rodape.titulo, W / 2, 1510);
    ctx.fillStyle = "#f0abfc";
    ctx.font = font("800", 60);
    // título de livro pode ser longo: encolhe até caber em vez de vazar
    let tam = 60;
    while (tam > 34 && ctx.measureText(rodape.texto).width > W - 160) {
      tam -= 4;
      ctx.font = font("800", tam);
    }
    ctx.fillText(rodape.texto, W / 2, 1585);
  }

  // Wordmark inteiro numa cor só. Antes o "o" saía magenta — um floreio que
  // só existia aqui: as artes de insígnia e de perfil sempre desenharam
  // "core" neutro, e o ícone do app é grafite chapado. Assinatura de marca
  // que muda de arte pra arte não é assinatura.
  ctx.fillStyle = "#fafaf9";
  ctx.font = font("800", 72);
  ctx.fillText("core", W / 2, 1780);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = font("normal", 30);
  ctx.fillText(rodapeDe(r), W / 2, 1835);

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) return "failed";
  const file = new File([blob], `core-retrospectiva-${r.mes.toLowerCase()}.png`, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Minha retrospectiva de ${r.mes}` });
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
