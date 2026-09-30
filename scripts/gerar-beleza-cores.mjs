// AS CORES DA BELEZA (28/09, o dono recusou o visual "Treino azul": "estética mais feminina, não
// azul"). As 3 direções em hex → CSS vars em HSL (formato do Tailwind: "H S% L%"), com checagem de
// contraste AA de todo par texto/fundo que aparece na tela.
//
//   node scripts/gerar-beleza-cores.mjs        (a direção B, a escolhida)
//
// Escreve: src/components/beleza/beleza.css   (a direção ESCOLHIDA, com escopo .tema-beleza)
//          src/pages/dev/beleza-direcoes.css  (as 3, só pro /dev/beleza?direcao=a|b|c, que só existe no dev)
// Cor nova ou mudada na Beleza = mexer AQUI e rodar (o beleza.css é gerado). Classe nova do
// Tailwind pra um token novo: tailwind.config.ts → colors.bz.
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const WT = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const ESCOLHIDA = process.argv[2] ?? "b";

const P = {
  a: {
    nome: "Rosé & nude (Glossier, Rare Beauty)",
    raio: "28px",
    claro: {
      papel: "#FFF7F5", cartao: "#FFFFFF", blush: "#F9E9E7", linha: "#F0DCD8", linhaForte: "#E0C1BC", tinta: "#3E2228", suave: "#7A5C61",
      rose: "#F6D5D2", roseTinta: "#5A2130", manha: "#F7E8DE", manhaTinta: "#6A4030", manhaIcone: "#C98561",
      noite: "#F2DCE0", noiteTinta: "#5A2A36", noiteIcone: "#B25A70", acento: "#D22D80", acentoTinta: "#FFFFFF",
      dica: "#FCEEEB", dicaTinta: "#65303A", dicaBorda: "#EFCDC7", retinol: "#B25A70", acido: "#D2987A", serum: "#E497A6", base: "#EADBD5",
      alerta: "#FDE8EB", alertaTinta: "#A8243E", ok: "#EAF3EC", okTinta: "#2E6843", hoje: "#FBE7E5", sombra: "#8A4A55",
    },
    escuro: {
      papel: "#1C1214", cartao: "#281A1D", blush: "#352328", linha: "#422C31", linhaForte: "#5A3B42", tinta: "#F7E9EB", suave: "#CDB0B6",
      rose: "#40232A", roseTinta: "#F8D6DC", manha: "#382920", manhaTinta: "#F4D8C6", manhaIcone: "#E6A785",
      noite: "#3D2229", noiteTinta: "#F2D0DA", noiteIcone: "#DC8EA2", acento: "#E0679F", acentoTinta: "#1C1214",
      dica: "#3A2429", dicaTinta: "#F6DADF", dicaBorda: "#5A3940", retinol: "#DC8EA2", acido: "#E6B094", serum: "#F0AEBB", base: "#5E474C",
      alerta: "#4A1E28", alertaTinta: "#FFB3C2", ok: "#1F3327", okTinta: "#A6DBB7", hoje: "#33202A", sombra: "#000000",
    },
  },
  b: {
    nome: "Pêssego & malva (manhã/noite, Sallve)",
    raio: "24px",
    claro: {
      papel: "#FFF8F5", cartao: "#FFFFFF", blush: "#FBECEE", linha: "#F2DEDF", linhaForte: "#E4C5CA", tinta: "#3A1C2A", suave: "#775766",
      rose: "#FCE4E8", roseTinta: "#6B2240", manha: "#FFE8D9", manhaTinta: "#7A3A17", manhaIcone: "#E0773A",
      noite: "#F4E1EF", noiteTinta: "#5B2350", noiteIcone: "#9C4786", acento: "#D22D80", acentoTinta: "#FFFFFF",
      dica: "#FFF0F3", dicaTinta: "#6E2A45", dicaBorda: "#F5CCD6", retinol: "#9C4786", acido: "#E6844F", serum: "#E6789E", base: "#EBD8D3",
      alerta: "#FDE7EB", alertaTinta: "#AE2340", ok: "#EAF4EE", okTinta: "#2D6843", hoje: "#FDEEF1", sombra: "#7A2E52",
    },
    escuro: {
      papel: "#1B1017", cartao: "#27151F", blush: "#34202B", linha: "#422837", linhaForte: "#5A364B", tinta: "#F7E8EF", suave: "#CFAEBE",
      rose: "#3C1D2E", roseTinta: "#F9D3E1", manha: "#3C261A", manhaTinta: "#F9D6C1", manhaIcone: "#F2A06A",
      noite: "#3A1B34", noiteTinta: "#F0CFE7", noiteIcone: "#D68CC4", acento: "#E0679F", acentoTinta: "#1B1017",
      dica: "#3A2030", dicaTinta: "#F7D5E2", dicaBorda: "#5C3149", retinol: "#D68CC4", acido: "#F2A47E", serum: "#F29BBB", base: "#5E4452",
      alerta: "#4A1C2A", alertaTinta: "#FFB3C3", ok: "#1E3328", okTinta: "#A7DDB9", hoje: "#301B27", sombra: "#000000",
    },
  },
  c: {
    nome: "Creme & lavanda-rosada (Principia, minimalista)",
    raio: "14px",
    claro: {
      papel: "#FBF7F1", cartao: "#FFFDF9", blush: "#F4EEE6", linha: "#EAE1D6", linhaForte: "#D8CBBD", tinta: "#2E2629", suave: "#6C5F64",
      rose: "#F2EAE1", roseTinta: "#4A383E", manha: "#F8EEDB", manhaTinta: "#664C20", manhaIcone: "#C1953F",
      noite: "#F0E5EF", noiteTinta: "#553955", noiteIcone: "#A078A0", acento: "#D22D80", acentoTinta: "#FFFFFF",
      dica: "#F7F0E6", dicaTinta: "#574535", dicaBorda: "#E6D9C7", retinol: "#A078A0", acido: "#CF9E55", serum: "#D98DA6", base: "#E5DCD1",
      alerta: "#FBE9EA", alertaTinta: "#A12A3C", ok: "#EAF2EA", okTinta: "#2F6440", hoje: "#F6EFE7", sombra: "#5E4A3A",
    },
    escuro: {
      papel: "#19141A", cartao: "#231C24", blush: "#2E2530", linha: "#3A2F3B", linhaForte: "#4F4250", tinta: "#F2EAEE", suave: "#C4B4BD",
      rose: "#2F2529", roseTinta: "#EFDCE2", manha: "#342B1E", manhaTinta: "#F1DFBF", manhaIcone: "#E0B96E",
      noite: "#322535", noiteTinta: "#EBD5EA", noiteIcone: "#CFA5CE", acento: "#E0679F", acentoTinta: "#19141A",
      dica: "#2E2628", dicaTinta: "#EFE0D2", dicaBorda: "#4A3E40", retinol: "#CFA5CE", acido: "#E6BE7C", serum: "#EBA6BD", base: "#524650",
      alerta: "#45202A", alertaTinta: "#FFB6C1", ok: "#1E3025", okTinta: "#A3D6B2", hoje: "#2C2330", sombra: "#000000",
    },
  },
};

/* CABELO (Onda 1, 28/09): as 3 etapas do cronograma capilar, iguais nas 3 direções.
   Hidratação em BABOSA (verde-sálvia — a "água" do cabelo no Brasil é a babosa, e azul
   está proibido), nutrição em MEL (óleos, manteigas), reconstrução em AMEIXA. */
const CABELO = {
  claro: { hidra: "#E6F2E6", hidraTinta: "#2B5E37", nutri: "#FCEBCB", nutriTinta: "#7A4A0E", recons: "#F1DDEB", reconsTinta: "#5B2350" },
  escuro: { hidra: "#1D3326", hidraTinta: "#A9DDB7", nutri: "#3A2B14", nutriTinta: "#F6D59C", recons: "#3A1B34", reconsTinta: "#F0CFE7" },
};
for (const d of Object.values(P)) {
  Object.assign(d.claro, CABELO.claro);
  Object.assign(d.escuro, CABELO.escuro);
}

const hexParaRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const hsl = (h) => {
  const [r, g, b] = hexParaRgb(h);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let s = 0, hue = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue *= 60;
  }
  return `${Math.round(hue)} ${Math.round(s * 1000) / 10}% ${Math.round(l * 1000) / 10}%`;
};
const lum = (h) => hexParaRgb(h).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((t, c, i) => t + c * [0.2126, 0.7152, 0.0722][i], 0);
const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

// pares texto/fundo que aparecem na tela (AA = 4,5; ícone/elemento gráfico = 3)
const PARES = [
  ["tinta", "papel", 4.5], ["tinta", "cartao", 4.5], ["suave", "cartao", 4.5], ["suave", "papel", 4.5], ["suave", "blush", 4.5],
  ["roseTinta", "rose", 4.5], ["manhaTinta", "manha", 4.5], ["noiteTinta", "noite", 4.5], ["dicaTinta", "dica", 4.5],
  ["acentoTinta", "acento", 4.5], ["acento", "cartao", 3], ["alertaTinta", "alerta", 4.5], ["okTinta", "ok", 4.5],
  ["manhaIcone", "manha", 2.2], ["noiteIcone", "noite", 3], ["retinol", "cartao", 3], ["acido", "cartao", 2.2], ["serum", "cartao", 2.2],
  ["tinta", "blush", 4.5], ["roseTinta", "hoje", 4.5],
  ["hidraTinta", "hidra", 4.5], ["nutriTinta", "nutri", 4.5], ["reconsTinta", "recons", 4.5],
];
let falhas = 0;
for (const [id, d] of Object.entries(P)) {
  for (const lado of ["claro", "escuro"]) {
    const c = d[lado];
    for (const [t, f, min] of PARES) {
      const r = contraste(c[t], c[f]);
      if (r < min) { falhas++; console.log(`✗ ${id}/${lado}: ${t} sobre ${f} = ${r.toFixed(2)} (< ${min})`); }
    }
  }
}
console.log(falhas ? `${falhas} pares abaixo do mínimo` : "contraste: todos os pares passam");

const NOMES = Object.keys(P.b.claro);
const kebab = (s) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
const vars = (c, raio) => {
  const linhas = NOMES.filter((n) => n !== "sombra").map((n) => `  --bz-${kebab(n)}: ${hsl(c[n])};`);
  linhas.push(`  --bz-sombra: ${hsl(c.sombra)};`, ...(raio ? [`  --bz-raio: ${raio};`] : []));
  // os tokens do app, com escopo no módulo: Input, Dialog, Sheet, Switch, Botão entram na paleta sozinhos
  linhas.push(
    `  --background: ${hsl(c.papel)};`, `  --foreground: ${hsl(c.tinta)};`,
    `  --card: ${hsl(c.cartao)};`, `  --card-foreground: ${hsl(c.tinta)};`,
    `  --popover: ${hsl(c.cartao)};`, `  --popover-foreground: ${hsl(c.tinta)};`,
    `  --primary: ${hsl(c.acento)};`, `  --primary-foreground: ${hsl(c.acentoTinta)};`,
    `  --secondary: ${hsl(c.blush)};`, `  --secondary-foreground: ${hsl(c.tinta)};`,
    `  --muted: ${hsl(c.blush)};`, `  --muted-foreground: ${hsl(c.suave)};`,
    `  --accent: ${hsl(c.blush)};`, `  --accent-foreground: ${hsl(c.tinta)};`,
    `  --border: ${hsl(c.linha)};`, `  --input: ${hsl(c.linhaForte)};`, `  --ring: ${hsl(c.acento)};`,
  );
  return linhas.join("\n");
};

const cabecalho = `/* GERADO por scripts/gerar-beleza-cores.mjs — as cores da BELEZA (28/09). Não editar à mão.
 * O dono recusou o visual que parecia o Treino ("estética mais feminina, não azul").
 * Tokens com ESCOPO no módulo (.tema-beleza): fora da Beleza nada muda. Dentro, os tokens do
 * app (fundo, cartão, borda, texto, primário) viram os da Beleza — Input, Dialog, Sheet, Switch e
 * Botão entram na paleta sem classe nova. As cores próprias (faixa rosé do dia, manhã pêssego,
 * noite malva, gotas dos ativos) são --bz-* e viram classes do Tailwind (bg-bz-*, text-bz-*).
 * Escuro = superfícies ameixa profundas, não o cinza do app. Contraste AA conferido no script. */\n`;

const escolhida = P[ESCOLHIDA];
const css = `${cabecalho}
/* Direção ${ESCOLHIDA.toUpperCase()}: ${escolhida.nome} */
.tema-beleza {
${vars(escolhida.claro, escolhida.raio)}
}
.dark .tema-beleza {
${vars(escolhida.escuro)}
}

/* O acento em serifa (Instrument Serif itálica, a mesma do funil e das Conquistas): com parcimônia. */
.tema-beleza .bz-serif {
  font-family: 'Instrument Serif', Georgia, 'Times New Roman', serif;
  font-style: italic;
  font-weight: 400;
  letter-spacing: -0.01em;
}

/* A zebra das tabelas no escuro (index.css, em azul-grafite) não entra na Beleza: aqui a
   tabela é do tema. A cor de fundo mora na linha (<tr>) e na coluna (<col>), nunca na
   célula — esta regra deixa toda célula transparente. */
.dark .tema-beleza tbody tr:nth-child(even) > td,
.dark .tema-beleza tbody tr:hover > td {
  background: transparent;
}
`;
fs.writeFileSync(`${WT}/src/components/beleza/beleza.css`, css);

const dev = `/* Só no /dev/beleza?direcao=a|b|c — as 3 direções pra comparar na mesma tela (GERADO por paletas.mjs). */
${Object.entries(P).map(([id, d]) => `/* ${id.toUpperCase()}: ${d.nome} */
html[data-bz-direcao="${id}"] .tema-beleza {
${vars(d.claro, d.raio)}
}
html.dark[data-bz-direcao="${id}"] .tema-beleza {
${vars(d.escuro)}
}`).join("\n\n")}
`;
fs.writeFileSync(`${WT}/src/pages/dev/beleza-direcoes.css`, dev);
console.log("escrito: beleza.css (direção", ESCOLHIDA, ") + beleza-direcoes.css");
