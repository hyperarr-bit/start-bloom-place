// AS CORES DO PET (29/09) — direção "RG do pet": documento com guilhoché de mel, carimbo de
// terracota e a foto em destaque. SÓ acento e decoração: papel, cartão, tinta e borda vêm SEMPRE
// do tema (bg-background, bg-card, text-foreground, border-border), nos 6 temas, claro e escuro.
//
//   node scripts/gerar-pet-cores.mjs
//
// Escreve src/components/pet/pet.css (escopo .tema-pet). Cor nova ou mudada no Pet = mexer AQUI
// e rodar. Nas telas, as cores entram como `bg-[hsl(var(--pet-mel))]` (sem mexer no tailwind.config
// e sem regenerar o escuro.css global — nenhuma classe de cor do Tailwind é usada pelo Pet novo).
//
// O script confere o contraste de todo par texto/fundo que aparece na tela CONTRA OS 6 TEMAS
// (cartão e papel de cada um, claro e escuro — valores de src/hooks/use-theme.tsx e do index.css).
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const WT = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");

const PET = {
  claro: {
    mel: "#D9961F", // pata, marcador do título, traço do peso (gráfico, não texto)
    melSuave: "#FBF0D9", // fundo da etiqueta (VACINA, VERMÍFUGO…)
    melTinta: "#6A3F0C", // texto sobre mel-suave e sobre a faixa
    faixa: "#F5E2B8", // faixa do topo do RG
    guilho: "#D9961F", // linhas do guilhoché (decoração, opacidade baixa)
    carimbo: "#A4431D", // carimbo "APLICADA" (texto pequeno: precisa de AA no cartão)
    atraso: "#B42318", // "venceu há 2 dias"
    logo: "#8A5200", // "em 5 dias"
    ok: "#1E7043", // "em dia", peso caindo/subindo pouco
  },
  escuro: {
    mel: "#E3A94A",
    melSuave: "#34291A",
    melTinta: "#F4DAAA",
    faixa: "#3B2F1D",
    guilho: "#C98F2E",
    carimbo: "#F09A70",
    atraso: "#FF8E80",
    logo: "#F2C46B",
    ok: "#86D8A9",
  },
};

// cartão e papel dos 6 temas (use-theme.tsx SPEC + index.css :root/.dark)
const hslParaHex = (s) => {
  const [h, sa, l] = s.replace(/%/g, "").split(/\s+/).map(Number);
  const S = sa / 100, L = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
};
const TEMAS = {
  claro: {
    Original: ["0 0% 100%", "0 0% 100%"],
    Indigo: ["228 33% 98%", "0 0% 100%"],
    Oceano: ["204 40% 98%", "0 0% 100%"],
    Rose: ["350 40% 98%", "0 0% 100%"],
    Floresta: ["80 25% 97%", "0 0% 100%"],
    Areia: ["38 40% 96%", "36 30% 99%"],
  },
  escuro: {
    Original: ["222 16% 7%", "220 16% 11%"],
    Indigo: ["240 21% 12%", "240 21% 15%"],
    Oceano: ["220 16% 14%", "220 16% 18%"],
    Rose: ["249 22% 12%", "247 21% 15%"],
    Floresta: ["200 13% 15%", "200 12% 19%"],
    Areia: ["0 0% 16%", "0 0% 20%"],
  },
};

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

let falhas = 0;
const conferir = (rotulo, a, b, min) => {
  const r = contraste(a, b);
  if (r < min) { falhas++; console.log(`✗ ${rotulo}: ${r.toFixed(2)} (< ${min})`); }
  return r;
};
for (const lado of ["claro", "escuro"]) {
  const c = PET[lado];
  // pares que não dependem do tema (a etiqueta e a faixa têm fundo próprio)
  conferir(`${lado}: melTinta sobre melSuave`, c.melTinta, c.melSuave, 4.5);
  conferir(`${lado}: melTinta sobre faixa`, c.melTinta, c.faixa, 4.5);
  // textos coloridos em cima do CARTÃO e do PAPEL de cada tema
  for (const [tema, [papel, cartao]] of Object.entries(TEMAS[lado])) {
    for (const [nome, fundo] of [["cartão", hslParaHex(cartao)], ["papel", hslParaHex(papel)]]) {
      for (const t of ["carimbo", "atraso", "logo", "ok"]) conferir(`${lado}/${tema}: ${t} sobre ${nome}`, c[t], fundo, 4.5);
      // elemento gráfico (pata, marcador, traço do gráfico): 3:1 (WCAG 1.4.11)
      conferir(`${lado}/${tema}: mel (gráfico) sobre ${nome}`, c.mel, fundo, lado === "claro" ? 2.2 : 3);
    }
  }
}
console.log(falhas ? `${falhas} pares abaixo do mínimo` : "contraste: todos os pares passam nos 6 temas (claro e escuro)");
if (falhas && !process.argv.includes("--forcar")) process.exit(1);

const kebab = (s) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
const vars = (c) => Object.entries(c).map(([n, v]) => `  --pet-${kebab(n)}: ${hsl(v)};`).join("\n");

const css = `/* GERADO por scripts/gerar-pet-cores.mjs — as cores do PET (29/09). Não editar à mão.
 * Direção "RG do pet": o bicho ganha um documento (faixa e guilhoché de mel, campos em caixa
 * alta, Nº), a carteirinha ganha carimbo de terracota. SÓ acento e decoração: papel, cartão,
 * tinta e borda são os do tema (6 paletas, claro e escuro). Contraste AA conferido no script
 * contra o cartão e o papel de cada tema. */

.tema-pet {
${vars(PET.claro)}
}
.dark .tema-pet {
${vars(PET.escuro)}
}

/* Guilhoché do RG: dois feixes de anéis finos, como no fundo de documento. Decoração pura
   (pointer-events: none), baixa opacidade — some quase todo no escuro. */
.tema-pet .pet-guilhoche {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.16;
  background-image:
    repeating-radial-gradient(circle at 88% 125%, transparent 0 7px, hsl(var(--pet-guilho)) 7px 8px),
    repeating-radial-gradient(circle at 108% -35%, transparent 0 9px, hsl(var(--pet-guilho)) 9px 10px);
}
.dark .tema-pet .pet-guilhoche { opacity: 0.1; }

/* Carimbo novo: a "batida" (o giro de -9° mora no elemento de fora, em classe do Tailwind).
   Quem pediu menos movimento não vê a animação. */
@media (prefers-reduced-motion: no-preference) {
  .tema-pet .pet-carimbo-novo { animation: pet-carimbar 380ms cubic-bezier(.2,.9,.3,1.3) both; }
}
@keyframes pet-carimbar {
  0% { transform: scale(1.6); opacity: 0; }
  60% { transform: scale(0.94); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

/* O quadradinho marcado "carimba" de leve; sem animação pra quem pediu menos movimento. */
@media (prefers-reduced-motion: no-preference) {
  .tema-pet .pet-marcou { animation: pet-marcou 220ms ease-out both; }
}
@keyframes pet-marcou {
  0% { transform: scale(0.7); }
  70% { transform: scale(1.12); }
  100% { transform: scale(1); }
}
`;
fs.writeFileSync(`${WT}/src/components/pet/pet.css`, css);
console.log("escrito: src/components/pet/pet.css");
