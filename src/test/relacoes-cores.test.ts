/**
 * Cores de Relações (29/09): o módulo tem acento e decoração próprios, mas o
 * papel, o cartão e a tinta são SEMPRE do tema — 6 paletas × claro/escuro.
 * Este teste lê os tokens de `relacoes.css` e confere contraste AA (4,5:1)
 * de todo texto que usa cor própria, em cima do cartão de cada tema, do
 * papel kraft e dos lacres. Cor nova sem contraste não passa.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(path.resolve(__dirname, "../components/relacoes/relacoes.css"), "utf8");
const tema = fs.readFileSync(path.resolve(__dirname, "../hooks/use-theme.tsx"), "utf8");

const bloco = (seletor: string) => {
  const i = css.indexOf(`${seletor} {`);
  if (i < 0) throw new Error(`sem bloco ${seletor}`);
  const corpo = css.slice(i, css.indexOf("}", i));
  return Object.fromEntries([...corpo.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
};
const claro = bloco(".tema-relacoes");
const escuro = { ...claro, ...bloco(".dark .tema-relacoes") };

type Hsl = [number, number, number];
const hsl = (s: string): Hsl => {
  const m = /^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/.exec(s.trim());
  if (!m) throw new Error(`hsl inválido: ${s}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
const rgb = ([h, s, l]: Hsl) => {
  const S = s / 100, L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
};
const lum = (c: Hsl) => {
  const [r, g, b] = rgb(c).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: Hsl, b: Hsl) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// cartões e papéis de cada tema (o Original é o :root/.dark do index.css)
const CARTOES_CLAROS: Record<string, Hsl> = { original: [0, 0, 100] };
const CARTOES_ESCUROS: Record<string, Hsl> = { original: [220, 16, 11] };
for (const m of tema.matchAll(/(\w+): \{ \/\/[^\n]*\n\s*name: "([^"]+)"[^\n]*\n\s*light:\s+\{ paper: "([^"]+)", card: "([^"]+)"[^\n]*\n\s*dark:\s+\{ paper: "([^"]+)", card: "([^"]+)"/g)) {
  CARTOES_CLAROS[m[2]] = hsl(m[4]);
  CARTOES_CLAROS[`${m[2]} (papel)`] = hsl(m[3]);
  CARTOES_ESCUROS[m[2]] = hsl(m[6]);
  CARTOES_ESCUROS[`${m[2]} (papel)`] = hsl(m[5]);
}

const AA = 4.5;

describe("contraste das cores próprias de Relações", () => {
  it("achou as 6 paletas", () => {
    expect(Object.keys(CARTOES_CLAROS).filter((k) => !k.includes("papel"))).toHaveLength(6);
  });

  for (const [lado, tokens, cartoes] of [["claro", claro, CARTOES_CLAROS], ["escuro", escuro, CARTOES_ESCUROS]] as const) {
    it(`${lado}: texto azul-carta, lacre e "vou" sobre o cartão/papel de todo tema`, () => {
      for (const [nome, cartao] of Object.entries(cartoes)) {
        for (const t of ["rl-tinta", "rl-lacre", "rl-ok"]) {
          const c = contraste(hsl(tokens[t]), cartao);
          expect(c, `${t} em ${nome} (${lado}) = ${c.toFixed(2)}`).toBeGreaterThanOrEqual(AA);
        }
      }
    });

    it(`${lado}: recado no kraft e letra dos lacres`, () => {
      expect(contraste(hsl(tokens["rl-kraft-tinta"]), hsl(tokens["rl-kraft"]))).toBeGreaterThanOrEqual(AA);
      for (const s of ["familia", "amigos", "amor", "trabalho", "outros"]) {
        const c = contraste(hsl(tokens["rl-selo-texto"]), hsl(tokens[`rl-selo-${s}`]));
        expect(c, `letra no lacre ${s} (${lado}) = ${c.toFixed(2)}`).toBeGreaterThanOrEqual(AA);
      }
    });
  }

  it("o botão principal (magenta da marca) tem texto legível no Original claro e escuro", () => {
    expect(contraste([330, 65, 50], [0, 0, 100])).toBeGreaterThanOrEqual(AA); // claro: branco no magenta
    expect(contraste([330, 55, 62], [222, 16, 7])).toBeGreaterThanOrEqual(AA); // escuro: papel no magenta de noite
  });
});
