/**
 * 26/10 — O FOGO UNIFICADO (components/fogo/FogoSequencia): um componente só pra pílula da Home nova, a folha da
 * sequência e o cartão da sequência das Conquistas do Codex — a chama sem borda do Codex (core-fire) com as cores das
 * figurinhas da família de pedra, a mesma paleta do caderno (fogoDoCaderno), os estados aceso / apagado / neutro, a chama viva só no aceso, o acender 1x e a subida
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

  it("as cores por marco são as das figurinhas da família de pedra: âmbar 1, petróleo 3, violeta 7, magenta 14, ouro 30, ouro luminoso 100 — a chama e o caderno na MESMA cor", () => {
    for (const [dias, id, tom, nome] of [[1, "ambar", "amber", "fogo âmbar"], [2, "ambar", "amber", "fogo âmbar"], [3, "petroleo", "petrol", "fogo petróleo"], [7, "violeta", "violet", "fogo violeta"], [14, "magenta", "home", "fogo magenta"], [30, "ouro", "gold", "fogo ouro"], [100, "dourado", "gold-bright", "fogo ouro luminoso"]] as const) {
      const { container, unmount } = render(<FogoSequencia dias={dias} />);
      const raiz = container.querySelector("[data-testid='fg-seq']") as HTMLElement;
      expect(raiz.getAttribute("data-faixa"), String(dias)).toBe(id);
      expect(raiz.getAttribute("data-tom")).toBe(tom);
      expect(raiz.getAttribute("data-fogo")).toBe("aceso");
      const svg = raiz.querySelector("svg.core-fire") as SVGElement;
      expect(svg.getAttribute("data-tone")).toBe(tom);
      expect(svg.getAttribute("data-status")).toBe("done");
      // chapada: corpo = o `meio` do caderno, miolo = o `claro`; nenhum contorno, nenhum degradê
      expect(svg.querySelector(".cf-body")?.getAttribute("fill")).toBe(fogoDoCaderno(dias).meio);
      expect(svg.querySelector(".cf-inner")?.getAttribute("fill")).toBe(fogoDoCaderno(dias).claro);
      expect(svg.querySelector("[stroke]")).toBeNull();
      expect(svg.querySelector("linearGradient")).toBeNull();
      expect(fogoDoCaderno(dias).nome).toBe(nome);
      unmount();
    }
    // 100+: o mesmo ouro do 30, só o miolo mais claro
    expect(fogoDoCaderno(100).meio).toBe(fogoDoCaderno(30).meio);
    expect(fogoDoCaderno(100).claro).toBe("#fff9e8");
  });

  it("neutro (0 dias): o cinza do caderno, sem chama viva nem ouro", () => {
    render(<FogoSequencia dias={0} />);
    const raiz = screen.getByTestId("fg-seq");
    expect(raiz.getAttribute("data-fogo")).toBe("neutro");
    expect(raiz.getAttribute("data-faixa")).toBe("apagado");
    expect(raiz.querySelector("svg")?.getAttribute("data-status")).toBe("unstarted");
    expect(raiz.querySelector("svg")?.getAttribute("data-tone")).toBe("gray");
    expect(raiz.querySelector("animate")).toBeNull();
    expect(raiz.hasAttribute("data-viva")).toBe(false);
    expect(raiz.hasAttribute("data-ouro")).toBe(false);
  });

  it("apagado (hoje ainda não garantido): a mesma faixa, mas PARADA (sem data-viva); aceso: viva", () => {
    const { rerender } = render(<FogoSequencia dias={9} estado="apagado" />);
    const raiz = screen.getByTestId("fg-seq");
    expect(raiz.getAttribute("data-fogo")).toBe("apagado");
    expect(raiz.getAttribute("data-faixa")).toBe("violeta");
    expect(raiz.hasAttribute("data-viva")).toBe(false);
    expect(raiz.querySelector("svg")?.getAttribute("data-status")).toBe("pending");
    expect(raiz.querySelector("svg")?.getAttribute("data-tone")).toBe("violet"); // a cor fica; só fica suave e parada
    expect(raiz.querySelector("animate")).toBeNull();
    rerender(<FogoSequencia dias={9} estado="aceso" />);
    expect(raiz.getAttribute("data-fogo")).toBe("aceso");
    expect(raiz.hasAttribute("data-viva")).toBe(true);
    expect(raiz.querySelectorAll("animate").length).toBe(2); // corpo e miolo, o fluxo contínuo do Codex
    rerender(<FogoSequencia dias={9} estado="aceso" viva={false} />);
    expect(raiz.hasAttribute("data-viva")).toBe(false);
    expect(raiz.querySelector("animate")).toBeNull();
  });

  it("acender: o pulso só quando pedido; ouro (100+) marca data-ouro e a faísca só com `faisca`", () => {
    const { rerender } = render(<FogoSequencia dias={120} acender />);
    const raiz = screen.getByTestId("fg-seq");
    expect(raiz.hasAttribute("data-acende")).toBe(true);
    expect(raiz.querySelector(".cf-ignite")).toBeTruthy(); // o acender do CoreFire (celebrationKey)
    expect(raiz.querySelectorAll(".cf-spark").length).toBe(3);
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
    expect(raiz.querySelector("animate")).toBeNull();
    expect(raiz.querySelector(".cf-ignite")).toBeNull();
  });

  it("montar sem `acender` nunca toca o acender; ligar `acender` toca 1x", () => {
    const { rerender } = render(<FogoSequencia dias={4} estado="aceso" />);
    const raiz = screen.getByTestId("fg-seq");
    expect(raiz.querySelector(".cf-ignite")).toBeNull();
    rerender(<FogoSequencia dias={4} estado="aceso" acender />);
    expect(raiz.querySelector(".cf-ignite")).toBeTruthy();
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
    expect(fogo.querySelector("svg")?.getAttribute("height")).toBe("37"); // 42 × 0,88: o mesmo peso da chama antiga
    expect(fogo.querySelector("svg")?.getAttribute("data-tone")).toBe("gold-bright");
    expect(fogo.hasAttribute("data-viva")).toBe(true);
  });
  it("0 dias: apagado (cinza), sem ouro", () => {
    const n = criarNuvem({});
    render(<n.Provedor><FogoDaSequencia dias={0} /></n.Provedor>);
    const fogo = screen.getByTestId("cn-fogo");
    expect(fogo.querySelector("svg")?.getAttribute("data-tone")).toBe("gray");
    expect(fogo.hasAttribute("data-ouro")).toBe(false);
    expect(fogo.hasAttribute("data-viva")).toBe(false);
  });
});
