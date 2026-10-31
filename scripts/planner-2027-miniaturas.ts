/**
 * A MINIATURA DO PLANNER NA OFERTA DO 2027 (31/10, versão B): 2 folhas reais do planner (capa + "Meu ano"), geradas
 * pelo MESMO código que monta o planner (src/lib/planner-2027.ts) com os dados de exemplo, nas 2 direções.
 *   npx vite-node scripts/planner-2027-miniaturas.ts
 * → public/landing/planner-2027-{core,codex}.webp (640×460, fundo transparente) + @2x/@3x (crítica r1: 640 px borrava no
 *   iPhone, DPR 3) + planner-2027-{core,codex}-ano.webp (a folha "Meu ano" sozinha, 1080 px: abre no toque, legível).
 * Rode de novo sempre que o desenho das folhas mudar (o teste planner-2027 confere que os arquivos existem).
 * 31/10 (upsell-tela-cheia): + "Meu mês" e "Minha semana" PREENCHIDAS (EXEMPLO_PREENCHIDO) pra página da oferta:
 *   planner-2027-{estilo}-{mes,semana}.webp (310 px de largura, 1x) e @2x, e -grande.webp (1080 px, abre no toque).
 *   Só essas: `npx vite-node scripts/planner-2027-miniaturas.ts preenchidas`.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { cssDoPlanner, folhasDoPlanner, EXEMPLO_DO_PLANNER, EXEMPLO_PREENCHIDO, A4_PX, type EstiloPlanner } from "../src/lib/planner-2027";

const raiz = path.resolve(__dirname, "..");
const b64 = (f: string) => fs.readFileSync(path.join(raiz, "public/fonts", f)).toString("base64");
const FONTES = `@font-face{font-family:'Instrument Serif';font-style:italic;font-weight:400;src:url(data:font/woff2;base64,${b64("instrument-serif-italic-latin.woff2")}) format('woff2')}
@font-face{font-family:'Inter';font-style:normal;font-weight:300 900;src:url(data:font/woff2;base64,${b64("inter-latin.woff2")}) format('woff2')}`;
const L = 640, H = 460;

async function main() {
  const b = await chromium.launch();
  const soPreenchidas = process.argv.includes("preenchidas");
  for (const estilo of ["core", "codex"] as EstiloPlanner[]) {
    const [capa, ano] = folhasDoPlanner(EXEMPLO_DO_PLANNER, estilo);
    const folha = (html: string, alt: number, giro: number, x: number, y: number, z: number) => {
      const k = alt / A4_PX.altura;
      return `<div style="position:absolute;left:${x}px;top:${y}px;width:${A4_PX.largura * k}px;height:${alt}px;transform:rotate(${giro}deg);z-index:${z};border-radius:10px;overflow:hidden;box-shadow:0 14px 34px -10px rgba(30,20,40,.38),0 2px 6px rgba(30,20,40,.12)">
        <div class="pl pl-${estilo}" style="width:${A4_PX.largura}px;height:${A4_PX.altura}px;transform:scale(${k});transform-origin:0 0">${html}</div></div>`;
    };
    const gravar = async (html: string, w: number, h: number, escala: number, nome: string, qualidade: number) => {
      const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: escala });
      await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
        <style>${FONTES}
        html,body{margin:0;background:transparent}${cssDoPlanner(estilo)}</style></head><body>${html}</body></html>`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      const png = await page.screenshot({ omitBackground: true });
      // PNG → WebP pelo canvas do próprio Chromium (sem dependência nova)
      const webp = await page.evaluate(async ([b64, q]) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        c.getContext("2d")!.drawImage(img, 0, 0);
        return c.toDataURL("image/webp", Number(q)).split(",")[1];
      }, [png.toString("base64"), String(qualidade)] as const);
      const destino = path.join(raiz, `public/landing/${nome}`);
      fs.writeFileSync(destino, Buffer.from(webp, "base64"));
      console.log(destino, Math.round(fs.statSync(destino).size / 1024), "KB");
      await page.close();
    };
    // 31/10: as 2 folhas preenchidas (a página da oferta: lado a lado, ~170 px cada no celular → 310/620 px)
    const cheias = folhasDoPlanner(EXEMPLO_PREENCHIDO, estilo);
    for (const [nome, html] of [["mes", cheias[5]], ["semana", cheias[6]]] as const) {
      const so = (larg: number) => { const k = larg / A4_PX.largura; return `<div style="width:${larg}px;height:${Math.round(A4_PX.altura * k)}px;overflow:hidden"><div class="pl pl-${estilo}" style="width:${A4_PX.largura}px;height:${A4_PX.altura}px;transform:scale(${k});transform-origin:0 0">${html}</div></div>`; };
      const alt = (larg: number) => Math.round(A4_PX.altura * (larg / A4_PX.largura));
      await gravar(so(310), 310, alt(310), 2, `planner-2027-${estilo}-${nome}.webp`, 0.84);
      await gravar(so(310), 310, alt(310), 3, `planner-2027-${estilo}-${nome}@2x.webp`, 0.78);
      await gravar(so(1080), 1080, alt(1080), 1, `planner-2027-${estilo}-${nome}-grande.webp`, 0.82);
    }
    if (soPreenchidas) continue;
    const duas = `<div style="position:relative;width:${L}px;height:${H}px">${folha(capa, 372, -6, 46, 52, 1)}${folha(ano, 420, 3.5, 300, 18, 2)}</div>`;
    await gravar(duas, L, H, 1, `planner-2027-${estilo}.webp`, 0.86);
    await gravar(duas, L, H, 2, `planner-2027-${estilo}@2x.webp`, 0.8);
    await gravar(duas, L, H, 3, `planner-2027-${estilo}@3x.webp`, 0.76);
    const ANO_L = 1080, k = ANO_L / A4_PX.largura, ANO_H = Math.round(A4_PX.altura * k);
    await gravar(`<div style="width:${ANO_L}px;height:${ANO_H}px;overflow:hidden"><div class="pl pl-${estilo}" style="width:${A4_PX.largura}px;height:${A4_PX.altura}px;transform:scale(${k});transform-origin:0 0">${ano}</div></div>`,
      ANO_L, ANO_H, 1, `planner-2027-${estilo}-ano.webp`, 0.82);
  }
  await b.close();
}
void main();
