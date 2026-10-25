/**
 * 26/10 — O FOGO UNIFICADO (components/fogo/FogoSequencia): um componente só pra pílula da Home nova, a folha da
 * sequência e o cartão da sequência das Conquistas do Codex — o desenho do `Fogo` compartilhado com a paleta suave
 * do caderno (fogoDoCaderno), os estados aceso / apagado / neutro, a chama viva só no aceso, o acender 1x e a subida
 * de faixa do caderno; prefers-reduced-motion desliga as animações.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const reduzir = vi.hoisted(() => ({ valor: false }));
vi.mock("framer-motion", async (orig) => ({ ...(await orig<typeof import("framer-motion")>()), useReducedMotion: () => reduzir.valor }));

import { FogoSequencia, estadoDoFogo } from "@/components/fogo/FogoSequencia";
import { FogoDaSequencia } from "@/components/conquistas/nova/FogoDaSequencia";
import { fogoDoCaderno } from "@/components/conquistas/nova/fogo-caderno";
import { criarNuvem, prepararJsdom } from "./compat-comum";

beforeAll(() => prepararJsdom());
afterEach(() => { cleanup(); reduzir.valor = false; });

describe("os estados", () => {
  it("estadoDoFogo: 0 dias = neutro; sequência viva sem hoje = apagado; hoje garantido = aceso", () => {
    expect(estadoDoFogo({ dias: 0, hojeFeito: false })).toBe("neutro");
    expect(estadoDoFogo({ dias: 0, hojeFeito: true })).toBe("neutro");
    expect(estadoDoFogo({ dias: 5, hojeFeito: false })).toBe("apagado");
    expect(estadoDoFogo({ dias: 5, hojeFeito: true })).toBe("aceso");
  });

  it("as cores são as da sequência das Conquistas (fogoDoCaderno): laranja 1+, laranja vivo 3+, amarelo dourado 7+, petróleo 14+, violeta 30+, ouro 100+", () => {
    for (const [dias, id, nome] of [[1, "laranja", "fogo laranja"], [3, "laranja", "fogo laranja vivo"], [7, "ambar", "fogo amarelo dourado"], [14, "petroleo", "fogo petróleo"], [30, "violeta", "fogo violeta"], [100, "dourado", "fogo ouro"]] as const) {
      const { container, unmount } = render(<FogoSequencia dias={dias} />);
      const raiz = container.querySelector("[data-testid='fg-seq']") as HTMLElement;
      expect(raiz.getAttribute("data-faixa"), String(dias)).toBe(id);
      expect(raiz.getAttribute("data-fogo")).toBe("aceso");
      const svg = raiz.querySelector("svg") as SVGElement;
      expect(svg.getAttribute("data-fogo")).toBe(id);
      // o contorno da chama é o pigmento suave do caderno, não o tom escuro de texto
      const corpo = svg.querySelector("path") as SVGElement;
      expect(corpo.getAttribute("stroke")).toBe(fogoDoCaderno(dias).chamaContorno);
      expect(fogoDoCaderno(dias).nome).toBe(nome);
      expect(raiz.querySelector(".fogo-gota")).toBeTruthy(); // a gota de dentro (alvo da tremulação)
      unmount();
    }
  });

  it("neutro (0 dias): o cinza do caderno, sem chama viva nem ouro", () => {
    render(<FogoSequencia dias={0} />);
    const raiz = screen.getByTestId("fg-seq");
    expect(raiz.getAttribute("data-fogo")).toBe("neutro");
    expect(raiz.getAttribute("data-faixa")).toBe("apagado");
    expect(raiz.querySelector("svg")?.getAttribute("data-fogo")).toBe("apagado");
    expect(raiz.hasAttribute("data-viva")).toBe(false);
    expect(raiz.hasAttribute("data-ouro")).toBe(false);
  });

  it("apagado (hoje ainda não garantido): a mesma faixa, mas PARADA (sem data-viva); aceso: viva", () => {
    const { rerender } = render(<FogoSequencia dias={9} estado="apagado" />);
    const raiz = screen.getByTestId("fg-seq");
    expect(raiz.getAttribute("data-fogo")).toBe("apagado");
    expect(raiz.getAttribute("data-faixa")).toBe("ambar");
    expect(raiz.hasAttribute("data-viva")).toBe(false);
    rerender(<FogoSequencia dias={9} estado="aceso" />);
    expect(raiz.getAttribute("data-fogo")).toBe("aceso");
    expect(raiz.hasAttribute("data-viva")).toBe(true);
    rerender(<FogoSequencia dias={9} estado="aceso" viva={false} />);
    expect(raiz.hasAttribute("data-viva")).toBe(false);
  });

  it("acender: o pulso só quando pedido; ouro (100+) marca data-ouro e a faísca só com `faisca`", () => {
    const { rerender } = render(<FogoSequencia dias={120} acender />);
    const raiz = screen.getByTestId("fg-seq");
    expect(raiz.hasAttribute("data-acende")).toBe(true);
    expect(raiz.hasAttribute("data-ouro")).toBe(true);
    expect(raiz.querySelector(".cn-fogo-faisca")).toBeNull();
    rerender(<FogoSequencia dias={120} faisca />);
    expect(raiz.hasAttribute("data-acende")).toBe(false);
    expect(raiz.querySelector(".cn-fogo-faisca")?.textContent).toBe("✦");
  });

  it("prefers-reduced-motion: sem chama viva, sem acender, sem subida", () => {
    reduzir.valor = true;
    render(<FogoSequencia dias={9} acender subiu />);
    const raiz = screen.getByTestId("fg-seq");
    expect(raiz.hasAttribute("data-viva")).toBe(false);
    expect(raiz.hasAttribute("data-acende")).toBe(false);
    expect(raiz.hasAttribute("data-subiu")).toBe(false);
  });
});

describe("o cartão da sequência das Conquistas (o mesmo componente, o mesmo render de antes)", () => {
  it("rende `cn-fogo` com o fogo de 42, data-ouro e a faísca no ouro, e a chama viva", () => {
    const n = criarNuvem({});
    render(<n.Provedor><FogoDaSequencia dias={120} /></n.Provedor>);
    const fogo = screen.getByTestId("cn-fogo");
    expect(fogo.classList.contains("cn-fogo")).toBe(true);
    expect(fogo.classList.contains("fg-seq")).toBe(true);
    expect(fogo.hasAttribute("data-ouro")).toBe(true);
    expect(fogo.querySelector(".cn-fogo-faisca")?.textContent).toBe("✦");
    expect(fogo.querySelector("svg")?.getAttribute("width")).toBe("42");
    expect(fogo.querySelector("svg")?.getAttribute("data-fogo")).toBe("dourado");
    expect(fogo.hasAttribute("data-viva")).toBe(true);
  });
  it("0 dias: apagado (cinza), sem ouro", () => {
    const n = criarNuvem({});
    render(<n.Provedor><FogoDaSequencia dias={0} /></n.Provedor>);
    const fogo = screen.getByTestId("cn-fogo");
    expect(fogo.querySelector("svg")?.getAttribute("data-fogo")).toBe("apagado");
    expect(fogo.hasAttribute("data-ouro")).toBe(false);
    expect(fogo.hasAttribute("data-viva")).toBe(false);
  });
});
