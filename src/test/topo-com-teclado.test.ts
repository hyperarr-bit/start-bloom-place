/* 1.0.22 (dono 29/10, prints do Simulador): com campo focado e a página no fim, o iPhone desloca a área visível
   (visualViewport.offsetTop) e o cabeçalho do módulo + a faixa do relógio subiam pra baixo do relógio. */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

class VV extends EventTarget { offsetTop = 0; scale = 1; height = 844; width = 390; }

describe("topo com o teclado (--vv-topo)", () => {
  it("o deslocamento da área visível vira --vv-topo; volta a nada quando some; zoom de pinça não conta", async () => {
    vi.resetModules();
    const vv = new VV();
    Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    try {
      const { instalarTopoComTeclado } = await import("@/lib/topo-com-teclado");
      instalarTopoComTeclado();
      const raiz = document.documentElement;
      expect(raiz.style.getPropertyValue("--vv-topo")).toBe("");
      vv.offsetTop = 155.4; vv.dispatchEvent(new Event("scroll"));
      expect(raiz.style.getPropertyValue("--vv-topo")).toBe("155px");
      vv.offsetTop = 0; vv.dispatchEvent(new Event("resize"));
      expect(raiz.style.getPropertyValue("--vv-topo")).toBe("");
      vv.scale = 2; vv.offsetTop = 300; vv.dispatchEvent(new Event("scroll"));
      expect(raiz.style.getPropertyValue("--vv-topo")).toBe("");
    } finally {
      raf.mockRestore();
      delete (window as unknown as { visualViewport?: unknown }).visualViewport;
    }
  });

  it("o CSS soma --vv-topo no cabeçalho fixo, nas faixas e na faixa do relógio; cabeçalho continua liso (dono 29/10: \"deixa como tá hoje\")", () => {
    const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");
    expect(css).toMatch(/header\.sticky\.top-0 \{\s*position: sticky;[^}]*top: calc\(var\(--app-safe-top\) \+ var\(--vv-topo, 0px\)\);/);
    expect(css).toMatch(/\.app-safe-top-guard \{[^}]*top: var\(--vv-topo, 0px\);/);
    expect(css).not.toMatch(/--cab-vidro/); // o vidro do cabeçalho ficou de fora
    const intro = readFileSync(resolve(__dirname, "../components/intro-modulo/intro-modulo.css"), "utf8");
    const missao = readFileSync(resolve(__dirname, "../components/missao-doses/missao-doses.css"), "utf8");
    expect(intro.match(/var\(--vv-topo, 0px\)/g)?.length).toBe(4);
    expect(missao.match(/var\(--vv-topo, 0px\)/g)?.length).toBe(2);
  });
});
