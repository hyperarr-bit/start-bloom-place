/**
 * P2 da varredura novato (26/10): a rodada 4 (8d6f9a29) apagou o CSS da dica do "+" de home-e.css e a dica sem estilo
 * esmagava a barra de vidro (Conquistas/Você sumiam, o "+" ia pra esquerda, o texto ficava solto). jsdom não carrega
 * CSS — esta trava lê o arquivo: toda classe da dica que o BarraVidro usa existe, e o balão é ABSOLUTO (fora do fluxo).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(raiz, "components/home-nova/e/home-e.css"), "utf8");
const barra = fs.readFileSync(path.join(raiz, "components/home-nova/e/BarraVidro.tsx"), "utf8");
const regra = (seletor: string): string | null => {
  const i = css.indexOf(`${seletor} {`);
  if (i < 0) return null;
  return css.slice(i, css.indexOf("}", i) + 1);
};

describe("a dica do '+' tem CSS (não some de novo numa limpeza)", () => {
  it("toda classe he-dica-mais* usada no BarraVidro está definida em home-e.css", () => {
    const usadas = [...new Set(barra.match(/he-dica-mais[\w-]*/g) ?? [])];
    expect(usadas.length).toBeGreaterThanOrEqual(3);
    for (const c of usadas) expect(regra(`.${c}`), c).not.toBeNull();
  });
  it("o balão fica fora do fluxo (absoluto, preso acima do '+'), com a ponta, a variante escura e o reduzir movimento", () => {
    expect(regra(".he-dica-mais")).toMatch(/position:\s*absolute/);
    expect(regra(".he-dica-mais")).toMatch(/bottom:\s*calc\(100% \+ 12px\)/);
    expect(regra(".he-dica-mais-ponta")).toMatch(/position:\s*absolute/);
    expect(css).toMatch(/\.dark \.he-dica-mais \{/);
    expect(css).toMatch(/@keyframes he-dica-entra/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{ \.he-dica-mais \{ animation: none; \}/);
  });
});
