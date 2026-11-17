/**
 * INDIQUE E GANHE — a arte do story (1080×1920), desenhada no canvas do próprio celular, e o "compartilhar/baixar".
 * Usada no pós-pago da /oferta (src/landing/indique.ts) e no painel /indique/:token.
 */
const MAGENTA = "#d02c7d";

export const textoStory = (link: string) => `Organizei minha vida num app só 💗 Finanças, rotina, treino… tudo no CORE. Link: ${link.replace(/^https:\/\/(www\.)?/, "")}`;

export function desenharStory(canvas: HTMLCanvasElement, link: string) {
  canvas.width = 1080; canvas.height = 1920;
  const c = canvas.getContext("2d");
  if (!c) return;
  const g = c.createLinearGradient(0, 0, 0, 1920);
  g.addColorStop(0, "#fbd3e6"); g.addColorStop(0.55, "#f3f2f7"); g.addColorStop(1, "#f3f2f7");
  c.fillStyle = g; c.fillRect(0, 0, 1080, 1920);
  c.fillStyle = MAGENTA; c.font = "900 46px Inter, sans-serif"; c.fillText("CORE", 96, 220);
  c.fillStyle = "#17111c"; c.font = "900 120px Inter, sans-serif";
  ["Organizei", "minha vida", "num app só."].forEach((t, i) => c.fillText(t, 96, 520 + i * 132));
  c.fillStyle = "#4a4550"; c.font = "500 50px Inter, sans-serif";
  ["Finanças, rotina, treino, saúde…", "tudo no mesmo lugar."].forEach((t, i) => c.fillText(t, 96, 1020 + i * 70));
  c.fillStyle = "#17111c";
  if (typeof c.roundRect === "function") { c.beginPath(); c.roundRect(96, 1440, 888, 190, 95); c.fill(); } else c.fillRect(96, 1440, 888, 190);
  c.fillStyle = "#fff"; c.font = "800 46px Inter, sans-serif"; c.fillText("Toque no link 👇", 150, 1520);
  c.fillStyle = "#ff9cc9"; c.font = "700 36px Inter, sans-serif"; c.fillText(link.replace(/^https:\/\/(www\.)?/, "").slice(0, 46), 150, 1584);
}

/** navegador de dentro do Instagram/Facebook: o compartilhar com arquivo e o download costumam não fazer nada (críticas 17/11) */
export const navegadorDeApp = (ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean => /Instagram|FBAN|FBAV|FB_IAB/i.test(ua);

/**
 * A arte numa camada da página: "Toque e segure a imagem pra salvar, depois poste no story". É o caminho que funciona em qualquer
 * navegador (inclusive o do Instagram, onde o compartilhar e o download não respondem). Fecha no botão ou tocando fora.
 */
export function mostrarArteStory(url: string): HTMLElement {
  document.getElementById("igt-story")?.remove();
  const d = document.createElement("div");
  d.id = "igt-story"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("data-testid", "indique-story-arte");
  d.style.cssText = "position:fixed;inset:0;z-index:2147482500;background:rgba(23,17,28,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;font-family:Inter,-apple-system,sans-serif";
  d.innerHTML = '<img alt="Arte do story com o seu link" style="max-width:100%;max-height:68vh;border-radius:16px;-webkit-touch-callout:default" />' +
    '<p style="margin:0;color:#fff;font-weight:700;font-size:15px;line-height:1.4;text-align:center;max-width:320px">Toque e segure a imagem pra salvar, depois poste no story.</p>' +
    '<button type="button" data-testid="indique-story-fechar" style="border:0;border-radius:999px;background:#fff;color:#17111C;font-weight:800;font-size:15px;min-height:48px;padding:0 22px;cursor:pointer">Fechar</button>';
  d.querySelector("img")!.setAttribute("src", url);
  const fechar = () => d.remove();
  d.querySelector("button")!.addEventListener("click", fechar);
  d.addEventListener("click", (ev) => { if (ev.target === d) fechar(); });
  document.body.appendChild(d);
  return d;
}

/**
 * Gera a arte e abre o "compartilhar" do celular (com o arquivo). Sem ele, no navegador do Instagram, ou se o compartilhar der erro,
 * mostra a arte na página pra salvar com o dedo (nunca um botão que não faz nada). Cancelar o compartilhar não abre nada.
 */
export async function compartilharStory(link: string, ua?: string): Promise<"compartilhou" | "cancelou" | "mostrou" | "falhou"> {
  try {
    const cv = document.createElement("canvas");
    desenharStory(cv, link);
    const blob: Blob | null = await new Promise((ok) => { try { cv.toBlob(ok, "image/png"); } catch { ok(null); } });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (blob && !navegadorDeApp(ua)) {
      const arq = new File([blob], "core-story.png", { type: "image/png" });
      if (nav.canShare?.({ files: [arq] })) {
        try { await nav.share({ files: [arq], text: textoStory(link) }); return "compartilhou"; }
        catch (e) { if ((e as { name?: string })?.name === "AbortError") return "cancelou"; }
      }
    }
    let url = "";
    try { url = cv.toDataURL("image/png"); } catch { /* canvas sem suporte */ }
    if (!url || url === "data:,") return "falhou";
    mostrarArteStory(url);
    return "mostrou";
  } catch { return "falhou"; }
}
