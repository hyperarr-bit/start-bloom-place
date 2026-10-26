/** Varredura 26/10 (item 6): o ✓ das bolinhas da semana com contraste ≥ 3:1 em toda faixa do fogo. */
import { describe, it, expect } from "vitest";
import { tintaDoCheck, TINTA_ESCURA_DO_CHECK } from "@/components/fogo/FolhaSequencia";
import { FOGOS_CADERNO } from "@/components/conquistas/nova/fogo-caderno";

const lum = (hex: string) => { const n = hex.replace("#", ""); const v = (n.length === 3 ? n.split("").map((c) => c + c) : [n.slice(0, 2), n.slice(2, 4), n.slice(4, 6)]).map((x) => { const c = parseInt(x, 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const razao = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe("a tinta do ✓ sobre a cor da faixa", () => {
  it("âmbar, petróleo, violeta e ouro: ✓ escuro; magenta: branco — e todos ≥ 3:1", () => {
    expect(tintaDoCheck("#e1bd60")).toBe(TINTA_ESCURA_DO_CHECK);
    expect(tintaDoCheck("#6aa3a6")).toBe(TINTA_ESCURA_DO_CHECK);
    expect(tintaDoCheck("#ad93c6")).toBe(TINTA_ESCURA_DO_CHECK);
    expect(tintaDoCheck("#d4b36b")).toBe(TINTA_ESCURA_DO_CHECK);
    expect(tintaDoCheck("#bb4d85")).toBe("#fff");
    expect(tintaDoCheck("rgb(187, 77, 133)")).toBe("#fff");
    expect(tintaDoCheck("hsl(var(--x))")).toBe("#fff"); // cor que não dá pra medir: o de sempre
  });
  it("toda faixa do caderno passa de 3:1", () => {
    for (const f of FOGOS_CADERNO) {
      const t = tintaDoCheck(f.meio);
      expect(razao(f.meio.slice(0, 7), t === "#fff" ? "#ffffff" : t), f.nome).toBeGreaterThanOrEqual(3);
    }
  });
});
