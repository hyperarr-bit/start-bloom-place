/**
 * A MINIATURA DO PLANNER NA OFERTA DO 2027 (31/10, versão B): 2 folhas reais do planner (capa + "Meu ano"), geradas
 * pelo MESMO código que monta o planner (src/lib/planner-2027.ts) com os dados de exemplo, nas 2 direções.
 *   npx vite-node scripts/planner-2027-miniaturas.ts
 * → public/landing/planner-2027-core.webp e public/landing/planner-2027-codex.webp (640×460, fundo transparente).
 * Rode de novo sempre que o desenho das folhas mudar (o teste planner-2027 confere que os arquivos existem).
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { cssDoPlanner, folhasDoPlanner, EXEMPLO_DO_PLANNER, A4_PX, type EstiloPlanner } from "../src/lib/planner-2027";

const raiz = path.resolve(__dirname, "..");
const b64 = (f: string) => fs.readFileSync(path.join(raiz, "public/fonts", f)).toString("base64");
const FONTES = `@font-face{font-family:'Instrument Serif';font-style:italic;font-weight:400;src:url(data:font/woff2;base64,${b64("instrument-serif-italic-latin.woff2")}) format('woff2')}
@font-face{font-family:'Inter';font-style:normal;font-weight:300 900;src:url(data:font/woff2;base64,${b64("inter-latin.woff2")}) format('woff2')}`;
const L = 640, H = 460;

async function main() {
  const b = await chromium.launch();
  for (const estilo of ["core", "codex"] as EstiloPlanner[]) {
    const [capa, ano] = folhasDoPlanner(EXEMPLO_DO_PLANNER, estilo);
    const folha = (html: string, alt: number, giro: number, x: number, y: number, z: number) => {
      const k = alt / A4_PX.altura;
      return `<div style="position:absolute;left:${x}px;top:${y}px;width:${A4_PX.largura * k}px;height:${alt}px;transform:rotate(${giro}deg);z-index:${z};border-radius:10px;overflow:hidden;box-shadow:0 14px 34px -10px rgba(30,20,40,.38),0 2px 6px rgba(30,20,40,.12)">
        <div class="pl pl-${estilo}" style="width:${A4_PX.largura}px;height:${A4_PX.altura}px;transform:scale(${k});transform-origin:0 0">${html}</div></div>`;
    };
    const page = await b.newPage({ viewport: { width: L, height: H } });
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
      <style>${FONTES}
      html,body{margin:0;background:transparent}${cssDoPlanner(estilo)}</style></head>
      <body><div style="position:relative;width:${L}px;height:${H}px">${folha(capa, 372, -6, 46, 52, 1)}${folha(ano, 420, 3.5, 300, 18, 2)}</div></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const png = await page.screenshot({ omitBackground: true });
    // PNG → WebP pelo canvas do próprio Chromium (sem dependência nova)
    const webp = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      c.getContext("2d")!.drawImage(img, 0, 0);
      return c.toDataURL("image/webp", 0.86).split(",")[1];
    }, png.toString("base64"));
    const destino = path.join(raiz, `public/landing/planner-2027-${estilo}.webp`);
    fs.writeFileSync(destino, Buffer.from(webp, "base64"));
    console.log(destino, Math.round(fs.statSync(destino).size / 1024), "KB");
    await page.close();
  }
  await b.close();
}
void main();
