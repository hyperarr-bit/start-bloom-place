/**
 * A RÉGUA DO PLANNER 2027 (crítica r1, 31/10): o que jsdom não mede. Monta as folhas (14 desde a v2) (src/lib/planner-2027.ts) nas 2
 * direções com contas de verdade — vazia, pouco, exemplo, LONGA (80 letras em toda meta e toda data, 2 datas por mês,
 * hábitos e contas de nome comprido) e 7 datas curtas — e confere no Chromium E no WebKit:
 *   1. nenhum texto passa da borda de dentro do painel (nem da folha);
 *   2. os 12 meses do calendário com as 7 colunas inteiras dentro do mês;
 *   3. nada estoura a área do corpo; nenhum painel esmagado;
 *   4. letra ≥ 18 px no layout de 1240 (≈ 8,6 pt impresso; v2 de 31/10, era 16);
 *   5. linha de escrever com contraste ≥ 1,8 com o papel do painel e 2 px;
 *   6. a impressão do site (Chromium, A4): uma página por folha;
 *   7. (crítica r2) nenhum painel com mais de 8% de papel liso embaixo (e mais de 1 linha de escrever); capa sem faixa
 *      vazia acima de 30% da folha.
 *   npx vite-node scripts/planner-2027-medir.ts [pasta-dos-prints]
 * Com a pasta: grava cada folha (1240×1754) e "lado a lado" A codex | B core. Sai com código 1 se algo falhar.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, webkit, type Browser } from "playwright-core";
import { cssDoPlanner, folhasDoPlanner, htmlDoPlannerNovo, EXEMPLO_DO_PLANNER, A4_PX, TOTAL_DE_FOLHAS, type DadosDoPlanner, type EstiloPlanner } from "../src/lib/planner-2027";
import { novoPlano2027 } from "../src/lib/pacote-2027";

const raiz = path.resolve(__dirname, "..");
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : "";
const b64 = (f: string) => fs.readFileSync(path.join(raiz, "public/fonts", f)).toString("base64");
const FONTES = `@font-face{font-family:'Instrument Serif';font-style:italic;font-weight:400;src:url(data:font/woff2;base64,${b64("instrument-serif-italic-latin.woff2")}) format('woff2')}
@font-face{font-family:'Inter';font-style:normal;font-weight:300 900;src:url(data:font/woff2;base64,${b64("inter-latin.woff2")}) format('woff2')}
@font-face{font-family:'Inter';font-style:normal;font-weight:300 900;src:url(data:font/woff2;base64,${b64("inter-latin-ext.woff2")}) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+20A0-20AB,U+20AD-20C0}`;

const L80 = (s: string) => (s + " " + "e mais um pouco de texto pra chegar no limite do campo").slice(0, 80);
const LONGA: DadosDoPlanner = {
  plano: {
    ...novoPlano2027(),
    metas: [L80("Juntar R$ 15 mil pra dar entrada no apartamento até dezembro de 2027 sem falta"), L80("Viajar com a família inteira pro Nordeste nas férias de julho"), L80("Correr a minha primeira meia maratona")],
    gastarMes: 12345.67, guardarMes: 2345.5,
    datas: Array.from({ length: 24 }, (_, i) => ({
      id: `d${i}`, tipo: (["aniversario", "checkup", "data"] as const)[i % 3],
      titulo: L80(i % 2 ? "Aniversário de casamento da minha sogra querida" : "Consulta de rotina com a dermatologista do convênio"),
      dia: `2027-${String(Math.floor(i / 2) + 1).padStart(2, "0")}-${i % 2 ? "28" : "03"}`,
    })),
    horaRevisao: "20:00", salvoEm: "2026-11-02T12:00:00.000Z",
  },
  cofrinho: { marcadas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], invertido: true },
  habitos: ["Beber 2 litros de água por dia", "Tomar o remédio da pressão", "Ler 20 páginas antes de dormir", "Caminhar 30 minutos depois do almoço", "Meditar 10 minutos de manhã", "Dormir antes das 23h", "Arrumar a cama ao acordar", "Alongar antes do trabalho", "Não usar o celular na mesa", "Escrever 3 coisas boas do dia", "Preparar a marmita da semana", "Ligar pra minha mãe"].map((h) => h.slice(0, 60)),
  contas: Array.from({ length: 14 }, (_, i) => ({ nome: `Conta com nome longo de verdade número ${i + 1} do mês`, valor: 1234.56 + i, dia: i + 1 })),
};
const CASOS: Record<string, DadosDoPlanner> = {
  vazio: { plano: novoPlano2027(), cofrinho: { marcadas: [], invertido: false }, habitos: [], contas: [] },
  pouco: { plano: { ...novoPlano2027(), metas: ["Guardar dinheiro", "", ""], salvoEm: "2026-11-02T12:00:00.000Z" }, cofrinho: { marcadas: [], invertido: false }, habitos: [], contas: [] },
  exemplo: EXEMPLO_DO_PLANNER,
  longo: LONGA,
  "7datas": { ...EXEMPLO_DO_PLANNER, plano: { ...EXEMPLO_DO_PLANNER.plano, datas: Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, tipo: "checkup" as const, titulo: "Dentista", dia: `2027-0${i + 1}-10` })) } },
};
const ESTILOS: EstiloPlanner[] = ["codex", "core"];

type Problema = { motor: string; caso: string; estilo: string; folha: number; o: string };
const problemas: Problema[] = [];
const medidas: Record<string, unknown> = {};

function pagina(estilo: EstiloPlanner, folha: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTES}html,body{margin:0}${cssDoPlanner(estilo)}</style></head>
  <body><div class="pl pl-${estilo}" style="width:${A4_PX.largura}px;height:${A4_PX.altura}px">${folha}</div></body></html>`;
}

/** roda dentro da página: tudo o que a régua confere numa folha */
function medirNaPagina() {
  const out: string[] = [];
  const folha = document.querySelector<HTMLElement>(".pl-folha")!;
  const F = folha.getBoundingClientRect();
  const rgb = (c: string) => (c.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number);
  const luz = (c: string) => { const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const cont = (a: string, b: string) => { const x = luz(a), y = luz(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  let menorFonte = 99, menorLinha = 99, menorEspessura = 99;
  const pauta = (el: Element) => el.closest(".pl-pauta");
  for (const el of Array.from(folha.querySelectorAll<HTMLElement>("*"))) {
    const temTexto = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent!.trim());
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (temTexto) {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      menorFonte = Math.min(menorFonte, fs);
      if (fs < 18) out.push(`letra ${fs}px: "${el.textContent!.trim().slice(0, 30)}"`);
      const painel = el.closest<HTMLElement>(".pl-painel, .pl-cards > div");
      if (painel && !pauta(el)) {
        const P = painel.getBoundingClientRect(), cs = getComputedStyle(painel);
        const dentro = P.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth) + 1.5;
        // o que vale é o que aparece: o fim visível do texto (a caixa, ou o pai que corta)
        if (r.right > dentro) out.push(`passa ${Math.round(r.right - dentro)}px do painel: "${el.textContent!.trim().slice(0, 30)}"`);
      }
      const pa = pauta(el);
      const escondida = pa && r.left >= pa.getBoundingClientRect().right - 1; // a linha da pauta que não coube (fica à direita, cortada)
      if (!escondida && (r.right > F.right - 60 || r.left < F.left + 60)) {
        if (!el.closest(".pl-capa-flores") && !el.closest(".pl-f-capa .pl-rod")) out.push(`fora da margem: "${el.textContent!.trim().slice(0, 30)}"`);
      }
    }
  }
  for (const ln of Array.from(folha.querySelectorAll<HTMLElement>(".pl-painel .pl-ln, .pl-painel .pl-caixa, .pl-painel .pl-hab i, .pl-painel .pl-trilha i, .pl-painel .pl-bolinhas i"))) {
    const cs = getComputedStyle(ln);
    const lado = ln.classList.contains("pl-ln") ? "Bottom" : "Top";
    const cor = cs[`border${lado}Color` as "borderBottomColor"], esp = parseFloat(cs[`border${lado}Width` as "borderBottomWidth"]);
    const painel = ln.closest<HTMLElement>(".pl-painel")!;
    const c = cont(cor, getComputedStyle(painel).backgroundColor);
    menorLinha = Math.min(menorLinha, c);
    menorEspessura = Math.min(menorEspessura, esp);
  }
  if (menorLinha < 1.8) out.push(`linha com contraste ${menorLinha.toFixed(2)}`);
  if (menorEspessura < 2) out.push(`linha com ${menorEspessura}px`);
  // calendário: 7 colunas inteiras dentro do mês
  folha.querySelectorAll<HTMLElement>(".pl-mes").forEach((mes) => {
    const M = mes.getBoundingClientRect();
    const cel = Array.from(mes.querySelectorAll<HTMLElement>(".pl-dias i, .pl-sem i")).map((i) => i.getBoundingClientRect());
    const xs = new Set(cel.map((q) => Math.round((q.left + q.right) / 2)));
    if (xs.size !== 7) out.push(`mês "${(mes.closest(".pl-painel")?.querySelector("h3") ?? mes.querySelector("h4"))?.textContent}" com ${xs.size} colunas`);
    if (cel.some((q) => q.right > M.right + 1)) out.push(`mês "${(mes.closest(".pl-painel")?.querySelector("h3") ?? mes.querySelector("h4"))?.textContent}" com dia fora`);
    const painel = mes.closest(".pl-painel")!.getBoundingClientRect();
    if (M.right > painel.right - 20) out.push(`mês "${(mes.closest(".pl-painel")?.querySelector("h3") ?? mes.querySelector("h4"))?.textContent}" passa do painel`);
  });
  // corpo e painéis
  const corpo = folha.querySelector<HTMLElement>(".pl-corpo");
  if (corpo && corpo.scrollHeight > corpo.clientHeight + 1) out.push(`corpo estoura ${corpo.scrollHeight - corpo.clientHeight}px`);
  folha.querySelectorAll<HTMLElement>(".pl-painel").forEach((p) => {
    if (p.getBoundingClientRect().height < (p.classList.contains("pl-enche") ? 148 : 110)) out.push(`painel esmagado: ${p.querySelector("h3")?.textContent}`);
    const filhos = Array.from(p.children) as HTMLElement[];
    const fundo = Math.max(...filhos.map((f) => f.getBoundingClientRect().bottom));
    if (fundo > p.getBoundingClientRect().bottom + 1 && !p.classList.contains("pl-area")) out.push(`painel corta embaixo: ${p.querySelector("h3")?.textContent} (${Math.round(fundo - p.getBoundingClientRect().bottom)}px)`);
  });
  // a pauta que enche o painel: pelo menos 1 linha à vista (a frase do ano, na conta mais cheia) e as que não cabem somem inteiras
  folha.querySelectorAll<HTMLElement>(".pl-pauta").forEach((pa) => {
    const P = pa.getBoundingClientRect();
    const vistas = Array.from(pa.children).filter((c) => c.getBoundingClientRect().right <= P.right + 1).length;
    if (vistas < 1) out.push(`pauta com ${vistas} linha(s) à vista`);
  });
  // crítica r2 (visual MEDIA 1): painel que SOBRA — papel liso embaixo do último conteúdo à vista ≤ 8% do painel
  const sobras: number[] = [];
  folha.querySelectorAll<HTMLElement>(".pl-painel").forEach((p) => {
    const P = p.getBoundingClientRect(), cs = getComputedStyle(p);
    const chao = P.bottom - parseFloat(cs.paddingBottom) - parseFloat(cs.borderBottomWidth);
    let fundo = P.top;
    for (const f of Array.from(p.querySelectorAll<HTMLElement>("*"))) {
      const r = f.getBoundingClientRect();
      if (!r.width || !r.height || f.classList.contains("pl-pauta")) continue;
      const pa = f.closest<HTMLElement>(".pl-pauta");
      if (pa && r.right > pa.getBoundingClientRect().right + 1) continue; // a linha que não coube (escondida à direita)
      if (r.bottom <= chao + 1) fundo = Math.max(fundo, r.bottom);
    }
    const sobra = (chao - fundo) / P.height;
    sobras.push(+sobra.toFixed(3));
    // (menos de 1 linha de escrever de sobra não conta: a pauta só mostra linhas inteiras)
    if (sobra > 0.08 && chao - fundo > 48) out.push(`painel sobra ${Math.round(sobra * 100)}% (${Math.round(chao - fundo)}px) embaixo: ${p.querySelector("h3")?.textContent}`);
  });
  // crítica r2 (visual MEDIA 2): capa — a maior faixa vazia (entre blocos, de cima a baixo) ≤ 30% da folha
  let faixaCapa = 0;
  const capa = folha.querySelector<HTMLElement>(".pl-capa");
  if (capa) {
    const blocos = [...Array.from(capa.children), folha.querySelector(".pl-rod")!].map((c) => c.getBoundingClientRect()).filter((r) => r.height > 0).sort((a, b) => a.top - b.top);
    let fim = F.top;
    for (const r of blocos) { faixaCapa = Math.max(faixaCapa, r.top - fim); fim = Math.max(fim, r.bottom); }
    faixaCapa = faixaCapa / F.height;
    if (faixaCapa > 0.3) out.push(`capa com faixa vazia de ${Math.round(faixaCapa * 100)}%`);
  }
  const rod = folha.querySelector<HTMLElement>(".pl-rod")!.getBoundingClientRect();
  const ultimo = corpo ? Math.max(...Array.from(corpo.children).map((c) => c.getBoundingClientRect().bottom)) : rod.top;
  return { problemas: out, menorFonte, menorLinha: +menorLinha.toFixed(2), menorEspessura, sobraAntesDoRodape: Math.round(rod.top - ultimo), maiorSobraDePainel: Math.max(0, ...sobras), faixaCapa: +faixaCapa.toFixed(3) };
}

async function rodar(motor: string, b: Browser) {
  const p = await b.newPage({ viewport: { width: A4_PX.largura, height: A4_PX.altura } });
  for (const [caso, d] of Object.entries(CASOS)) {
    for (const estilo of ESTILOS) {
      const folhas = folhasDoPlanner(d, estilo);
      for (let i = 0; i < folhas.length; i++) {
        await p.setContent(pagina(estilo, folhas[i]));
        await p.evaluate(() => document.fonts.ready);
        const m = await p.evaluate(medirNaPagina);
        medidas[`${motor}/${caso}/${estilo}/${i + 1}`] = { ...m, problemas: m.problemas.length };
        for (const o of m.problemas) problemas.push({ motor, caso, estilo, folha: i + 1, o });
        if (OUT && motor === "chromium" && ["exemplo", "vazio", "longo", "pouco"].includes(caso)) {
          fs.mkdirSync(path.join(OUT, "folhas"), { recursive: true });
          await p.screenshot({ path: path.join(OUT, "folhas", `${caso}-${estilo}-${String(i + 1).padStart(2, "0")}.png`) });
        }
      }
    }
  }
  await p.close();
}

async function ladoALado(b: Browser) {
  const p = await b.newPage({ viewport: { width: 1240 * 2 + 120, height: 1754 + 150 } });
  for (const caso of ["exemplo", "vazio", "longo", "pouco"]) {
    for (let i = 1; i <= TOTAL_DE_FOLHAS; i++) {
      const n = String(i).padStart(2, "0");
      const img = (e: string) => `data:image/png;base64,${fs.readFileSync(path.join(OUT, "folhas", `${caso}-${e}-${n}.png`)).toString("base64")}`;
      await p.setContent(`<body style="margin:0;background:#d6d3d1;font:600 34px Inter,Arial;color:#262626"><div style="display:flex;gap:40px;padding:30px 40px">
        <figure style="margin:0"><figcaption style="margin-bottom:16px">A · codex</figcaption><img src="${img("codex")}" width="1240" height="1754" style="box-shadow:0 4px 30px rgba(0,0,0,.25)"></figure>
        <figure style="margin:0"><figcaption style="margin-bottom:16px">B · core (padrão)</figcaption><img src="${img("core")}" width="1240" height="1754" style="box-shadow:0 4px 30px rgba(0,0,0,.25)"></figure></div></body>`);
      await p.waitForTimeout(80);
      fs.mkdirSync(path.join(OUT, "lado-a-lado"), { recursive: true });
      await p.screenshot({ path: path.join(OUT, "lado-a-lado", `${caso}-${n}.png`) });
    }
  }
  await p.close();
}

async function pdf(b: Browser) {
  const p = await b.newPage();
  const r: Record<string, number> = {};
  for (const caso of ["exemplo", "vazio", "longo"]) for (const estilo of ESTILOS) {
    await p.setContent(htmlDoPlannerNovo(CASOS[caso], estilo, "").replace("<style>", `<style>${FONTES}`));
    await p.evaluate(() => document.fonts.ready);
    const buf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
    const paginas = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    r[`${caso}-${estilo}`] = paginas;
    if (paginas !== TOTAL_DE_FOLHAS) problemas.push({ motor: "chromium", caso, estilo, folha: 0, o: `PDF com ${paginas} páginas` });
    if (OUT) { fs.mkdirSync(path.join(OUT, "pdf"), { recursive: true }); fs.writeFileSync(path.join(OUT, "pdf", `planner-2027-${caso}-${estilo}.pdf`), buf); }
  }
  await p.close();
  return r;
}

async function main() {
  const c = await chromium.launch();
  await rodar("chromium", c);
  const paginas = await pdf(c);
  if (OUT) await ladoALado(c);
  await c.close();
  const w = await webkit.launch();
  await rodar("webkit", w);
  await w.close();
  const resumo = { problemas: problemas.length, paginas, porCaso: Object.fromEntries(Object.keys(CASOS).map((k) => [k, problemas.filter((x) => x.caso === k).length])) };
  if (OUT) fs.writeFileSync(path.join(OUT, "medidas.json"), JSON.stringify({ resumo, problemas, medidas }, null, 1));
  console.log(JSON.stringify(resumo));
  for (const x of problemas.slice(0, 40)) console.log(`${x.motor} ${x.caso} ${x.estilo} f${x.folha}: ${x.o}`);
  process.exit(problemas.length ? 1 : 0);
}
void main();
