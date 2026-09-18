/**
 * MODO ESCURO COMO SISTEMA (17/09, ordem do dono: "pode mudar tudo, só não
 * toca no claro nem na estrutura").
 *
 * O app tem 547 cores vivas fixas (bg-amber-400, from-violet-600…) em 90
 * arquivos. Em vez de caçar uma a uma, este script gera src/styles/escuro.css:
 * dentro de `.dark`, cada utilitário de cor viva do Tailwind é REMAPEADO pra
 * versão de noite da mesma família — mais clara e menos saturada, verificada
 * ≥ 7:1 no card. O modo claro não muda em nada (tudo fica atrás de `.dark`),
 * e o funil/paywall (tema claro forçado, classe `tema-claro`) fica de fora.
 *
 * Três destinos por família de cor:
 *   texto   → tom de texto (ex.: amber → #D9B26A) — text-*, ícones
 *   meio    → tom médio (ex.: amber → #BF7F12) — barras de progresso, bolinhas,
 *             pílulas (rounded-full / h-1…h-3 / w-1…w-3), botões
 *   tinta   → fundo escuro tingido (ex.: amber → hsl(38 30% 12%)) — cabeçalhos,
 *             cards, gradientes
 *
 * Regenerar: node scripts/gerar-escuro.mjs
 */
import fs from "node:fs";

// família Tailwind → [texto, meio, tinta, borda]
// família Tailwind → [texto, meio, tinta (fundos vivos), borda, tinta suave (fundos pálidos: bg-*-50/100/200)]
// Tinta suave existe porque bg-amber-50 é o card INTEIRO (Estudos, Dev. Pessoal, cômodos da Casa):
// no escuro ele tem que ser quase grafite, só com um sopro da cor — senão vira um card marrom.
const FAM = {
  red:     ["#E68C8C", "#D25F5F", "hsl(0 24% 14%)",   "hsl(0 26% 30%)",   "hsl(0 14% 12%)"],
  rose:    ["#E68C9A", "#D2596F", "hsl(345 24% 14%)", "hsl(345 26% 30%)", "hsl(345 14% 12%)"],
  orange:  ["#E6A276", "#C4753A", "hsl(24 22% 13%)",  "hsl(24 26% 30%)",  "hsl(24 12% 12%)"],
  amber:   ["#D9B26A", "#BF7F12", "hsl(38 22% 12%)",  "hsl(38 26% 30%)",  "hsl(38 12% 12%)"],
  yellow:  ["#D9BE6A", "#B8931A", "hsl(45 20% 12%)",  "hsl(45 24% 30%)",  "hsl(45 10% 12%)"],
  lime:    ["#B5CF7A", "#7FA52E", "hsl(85 18% 12%)",  "hsl(85 22% 28%)",  "hsl(85 10% 12%)"],
  green:   ["#6FC79C", "#2AA379", "hsl(150 22% 11%)", "hsl(150 26% 28%)", "hsl(150 12% 12%)"],
  emerald: ["#6FC79C", "#2AA379", "hsl(160 22% 11%)", "hsl(160 26% 28%)", "hsl(160 12% 12%)"],
  teal:    ["#6BC4BA", "#2E9C9A", "hsl(175 22% 11%)", "hsl(175 26% 28%)", "hsl(175 12% 12%)"],
  cyan:    ["#6BC4D4", "#2F9DB0", "hsl(190 24% 12%)", "hsl(190 28% 28%)", "hsl(190 12% 12%)"],
  sky:     ["#7FB8E6", "#3A8FD0", "hsl(205 24% 13%)", "hsl(205 28% 30%)", "hsl(205 12% 12%)"],
  blue:    ["#86B4E8", "#3B8AE0", "hsl(220 24% 14%)", "hsl(220 28% 30%)", "hsl(220 12% 12%)"],
  indigo:  ["#9AA5EA", "#6E7FE0", "hsl(235 22% 15%)", "hsl(235 26% 32%)", "hsl(235 12% 12%)"],
  violet:  ["#A99FEA", "#8A7DE6", "hsl(255 22% 15%)", "hsl(255 26% 32%)", "hsl(255 12% 12%)"],
  purple:  ["#B49BE8", "#9370DE", "hsl(270 22% 15%)", "hsl(270 26% 32%)", "hsl(270 12% 12%)"],
  fuchsia: ["#DE8ECB", "#C95FB0", "hsl(300 20% 14%)", "hsl(300 24% 30%)", "hsl(300 10% 12%)"],
  pink:    ["#E08AB5", "#D4568C", "hsl(330 22% 14%)", "hsl(330 26% 30%)", "hsl(330 12% 12%)"],
};
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const VIVAS = [300, 400, 500, 600, 700]; // fundos que gritam no escuro
const PALIDAS = [50, 100, 200];           // fundos pastel do claro (sem dark: viram manchas claras)
const esc = (s) => s.replace(/[/.]/g, (c) => "\\" + c);
const N = ":not(.tema-claro *)"; // funil/paywall forçam o claro: ficam de fora
const PEQUENO = ":is(.rounded-full,.h-1,.h-1\\.5,.h-2,.h-2\\.5,.h-3,.w-1,.w-1\\.5,.w-2,.w-2\\.5,.w-3)";

// Só gera regra pra classe que EXISTE no código (varre src/): o CSS cai de 217 KB pra o
// que o app usa de verdade, e uma classe nova entra na próxima rodada do script.
import path from "node:path";
const usadas = new Set();
const varre = (dir) => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) varre(p); else if (p !== "src/styles/escuro.css" && /\.(tsx?|css|html)$/.test(f)) for (const m of fs.readFileSync(p, "utf8").matchAll(/[a-z:]*(?:bg|text|border|from|via|to|fill|stroke)-[a-z]+-\d{2,3}(?:\/\d{1,3})?/g)) usadas.add(m[0]); } };
varre("src");
const usa = (cls) => usadas.has(cls);
const filtra = (lista) => lista.filter(usa);

let css = `/* GERADO por scripts/gerar-escuro.mjs — não editar na mão. Regras do modo escuro
 * como sistema: remapeia as cores vivas do Tailwind pra versão de noite. */\n`;
const linhas = [];
for (const [fam, [texto, meio, tinta, borda, suave]] of Object.entries(FAM)) {
  // TEXTO e ícones: toda sombra vira o tom de texto (o claro usa 600/700 em fundo claro e 100/200 em fundo colorido; no escuro os dois casos querem o mesmo tom)
  const txt = filtra(SHADES.map((s) => `text-${fam}-${s}`)); if (txt.length) linhas.push(`.dark :is(${txt.map((c) => "." + c).join(",")})${N}{color:${texto}}`);
  // FUNDOS vivos e pálidos → tinta; pequenos (barra/bolinha/pílula) e botões → meio
  const bgV = filtra(VIVAS.map((s) => `bg-${fam}-${s}`)); if (bgV.length) linhas.push(`.dark :is(${bgV.map((c) => "." + c).join(",")})${N}{background-color:${tinta}}`);
  const bgP = filtra(PALIDAS.map((s) => `bg-${fam}-${s}`)); if (bgP.length) linhas.push(`.dark :is(${bgP.map((c) => "." + c).join(",")})${N}{background-color:${suave}}`);
  if (bgV.length) linhas.push(`.dark :is(${bgV.map((c) => `${PEQUENO}.${c}`).join(",")},${bgV.map((c) => `button.${c}`).join(",")},${bgV.map((c) => `a.${c}`).join(",")})${N}{background-color:${meio}}`);
  // fundos com opacidade (bg-amber-400/20 dos tiles, /10, /15, /30…) → superfície interna; a cor fica no ícone
  const ops = [5, 10, 15, 20, 25, 30, 40];
  const bgOp = filtra([...VIVAS, ...PALIDAS].flatMap((s) => ops.map((o) => `bg-${fam}-${s}/${o}`)));
  if (bgOp.length) linhas.push(`.dark :is(${bgOp.map((c) => `[class~="${c}"]`).join(",")})${N}{background-color:hsl(var(--secondary))}`);
  // TINTAS QUE O APP JÁ TINHA no escuro (dark:bg-yellow-500/10, dark:from-yellow-500/10, dark:bg-amber-900/40…):
  // eram 1.291 variantes feitas caso a caso, cada uma com um marrom/oliva diferente. Todas viram a
  // mesma tinta suave da família — o card fica grafite com um sopro de cor, igual em todo módulo.
  const todas = [...VIVAS, ...PALIDAS, 800, 900, 950];
  const opsDark = [5, 10, 15, 20, 25, 30, 40, 50];
  const dBg = filtra(todas.flatMap((s) => opsDark.map((o) => `dark:bg-${fam}-${s}/${o}`)));
  if (dBg.length) linhas.push(`.dark :is(${dBg.map((c) => `[class~="${c}"]`).join(",")})${N}{background-color:${suave}}`);
  const dFrom = filtra(todas.flatMap((s) => opsDark.map((o) => `dark:from-${fam}-${s}/${o}`)));
  if (dFrom.length) linhas.push(`.dark :is(${dFrom.map((c) => `[class~="${c}"]`).join(",")})${N}{--tw-gradient-from:${suave} var(--tw-gradient-from-position);--tw-gradient-to:transparent var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}`);
  const dTo = filtra(todas.flatMap((s) => opsDark.map((o) => `dark:to-${fam}-${s}/${o}`)));
  if (dTo.length) linhas.push(`.dark :is(${dTo.map((c) => `[class~="${c}"]`).join(",")})${N}{--tw-gradient-to:${suave} var(--tw-gradient-to-position)}`);
  // BORDAS
  const bd = filtra(SHADES.filter((s) => s <= 700).map((s) => `border-${fam}-${s}`)); if (bd.length) linhas.push(`.dark :is(${bd.map((c) => "." + c).join(",")})${N}{border-color:${borda}}`);
  // GRADIENTES: from/via/to → tinta (o Tailwind guarda a cor em variáveis; trocar a variável basta)
  const g_from = filtra(VIVAS.map((s) => `from-${fam}-${s}`)); if (g_from.length) linhas.push(`.dark :is(${g_from.map((c) => "." + c).join(",")})${N}{--tw-gradient-from:${tinta} var(--tw-gradient-from-position);--tw-gradient-to:transparent var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}`);
  const g_via = filtra(VIVAS.map((s) => `via-${fam}-${s}`)); if (g_via.length) linhas.push(`.dark :is(${g_via.map((c) => "." + c).join(",")})${N}{--tw-gradient-to:transparent var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),${tinta} var(--tw-gradient-via-position),var(--tw-gradient-to)}`);
  const g_to = filtra(VIVAS.map((s) => `to-${fam}-${s}`)); if (g_to.length) linhas.push(`.dark :is(${g_to.map((c) => "." + c).join(",")})${N}{--tw-gradient-to:${tinta} var(--tw-gradient-to-position)}`);
  // fill/stroke de SVG inline (ícones lucide usam currentColor; isto cobre os raros fill-*)
  const s_fill = filtra(VIVAS.map((s) => `fill-${fam}-${s}`)); if (s_fill.length) linhas.push(`.dark :is(${s_fill.map((c) => "." + c).join(",")})${N}{fill:${meio}}`);
  const s_stroke = filtra(VIVAS.map((s) => `stroke-${fam}-${s}`)); if (s_stroke.length) linhas.push(`.dark :is(${s_stroke.map((c) => "." + c).join(",")})${N}{stroke:${meio}}`);
}
css += linhas.join("\n") + "\n";
css += `
/* Texto branco em cima de fundo que virou tinta: continua branco (contraste ok). Texto escuro
 * fixo (text-gray-900/800) em cima dessas tintas ficaria invisível — sobe pro texto do tema. */
.dark :is(${filtra(Object.keys(FAM).flatMap((f) => VIVAS.concat(PALIDAS).map((s) => `bg-${f}-${s}`))).map((c) => "." + c).join(",")}) :is(.text-gray-900,.text-gray-800,.text-gray-700,.text-slate-900,.text-slate-800,.text-neutral-900,.text-neutral-800,.text-zinc-900,.text-black)${N}{color:hsl(var(--foreground))}
/* Recharts: tooltip branco e borda branca das fatias viram superfície do tema. */
.dark .recharts-default-tooltip{background:hsl(var(--card)) !important;border:1px solid hsl(var(--border)) !important;border-radius:10px;color:hsl(var(--foreground))}
.dark .recharts-tooltip-label,.dark .recharts-tooltip-item{color:hsl(var(--foreground)) !important}
.dark .recharts-pie-sector .recharts-sector,.dark .recharts-sector{stroke:hsl(var(--card))}
.dark .recharts-cartesian-grid line{stroke:hsl(var(--border))}
/* Sombras coloridas e brilhos: no escuro sombra é preta. */
.dark [class*="shadow-"][class*="/"]:not(.tema-claro *){--tw-shadow-color:rgb(0 0 0 / .45)}
`;
fs.writeFileSync("src/styles/escuro.css", css);
console.log("escuro.css:", (css.length / 1024).toFixed(0), "KB,", linhas.length, "regras");
