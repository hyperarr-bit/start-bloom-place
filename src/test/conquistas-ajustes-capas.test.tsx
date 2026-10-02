/**
 * Ajustes das capas (02/10, dono): a gravação ("NÍVEL", o nome do nível e o "core") segue o METAL do
 * nível — igual em todas as capas e igual à insígnia — com contraste garantido em capa clara e escura;
 * a linha da sequência na Home tem UMA cor (a do score do tema).
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { CAPAS, CapaPlanner, ORDEM_CAPAS } from "@/components/conquistas/CapaPlanner";
import { METAIS, gravacaoDoNivel } from "@/components/conquistas/SeloNivel";
import { LinhaSequencia } from "@/components/conquistas/LinhaSequencia";
import { faixaDoFogo } from "@/lib/fogo-sequencia";
import type { Sequencia } from "@/components/conquistas/use-conquistas";

afterEach(cleanup);

const NIVEIS = Object.keys(METAIS);

const luz = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string) => {
  const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Cores do foil (stops do gradiente) de cada texto gravado da capa, na ordem: NÍVEL, nome, core. */
const gravacoes = (cont: HTMLElement) => {
  const textos = [...cont.querySelectorAll("svg text")].filter((t) => ["NÍVEL"].includes(t.textContent ?? "") || t.closest("[data-nivel-capa]") || t.closest("[data-marca-core]"));
  return textos.map((t) => {
    const id = /url\(#(.+)\)/.exec(t.getAttribute("fill") ?? "")![1];
    const grad = (t as SVGTextElement).ownerSVGElement!.querySelector(`#${CSS.escape(id)}`)!;
    return { texto: t.textContent, cores: [...grad.querySelectorAll("stop")].map((s) => s.getAttribute("stop-color")), contorno: t.getAttribute("stroke") };
  });
};

describe("a gravação da capa segue o metal do nível", () => {
  for (const nivel of NIVEIS) {
    it(`${nivel}: NÍVEL, nome e core têm as cores do metal ${nivel} (as da insígnia) em TODAS as capas`, () => {
      for (const capa of ORDEM_CAPAS) {
        const { container, unmount } = render(<CapaPlanner capa={capa} nome="Ana Beatriz" membroDesde="julho de 2026" dias={12} nivel={nivel} />);
        const g = gravacoes(container);
        expect(g.map((x) => x.texto)).toEqual(["NÍVEL", nivel, "core"]);
        for (const x of g) {
          expect(x.cores).toEqual(METAIS[nivel].foil); // do metal do nível, não da capa
          expect(x.contorno).toBe(METAIS[nivel].contorno);
        }
        unmount();
      }
    });
  }

  it("a cor da gravação depende só do nível: gravacaoDoNivel não conhece a capa", () => {
    expect(gravacaoDoNivel.length).toBe(1);
    expect(gravacaoDoNivel("Platina").paradas).toEqual(METAIS.Platina.foil);
    expect(gravacaoDoNivel("Platina").paradas).not.toEqual(gravacaoDoNivel("Ouro").paradas);
    // nível desconhecido cai no ouro (como a insígnia)
    expect(gravacaoDoNivel("???").paradas).toEqual(METAIS.Ouro.foil);
  });

  it("contraste: o contorno escuro separa cada metal (parada mais clara ≥ 7:1) e segura o metal em cada capa", () => {
    for (const nivel of NIVEIS) {
      const { paradas, contorno } = gravacaoDoNivel(nivel);
      const clara = [...paradas].sort((a, b) => luz(b) - luz(a))[0];
      expect(contraste(clara, contorno), `${nivel}: metal claro × contorno`).toBeGreaterThanOrEqual(7);
      // o miolo do metal (parada do meio do degradê) também se lê sobre o contorno
      expect(contraste(paradas[2], contorno), `${nivel}: miolo × contorno`).toBeGreaterThanOrEqual(3);
      for (const capa of ORDEM_CAPAS) {
        const bg = CAPAS[capa].bg;
        // a gravação (metal + contorno) se destaca da capa por pelo menos um dos dois tons
        const melhor = Math.max(contraste(clara, bg), contraste(contorno, bg));
        expect(melhor, `${nivel} na capa ${capa}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("linha da sequência na Home: fogo e dias na cor da faixa, 'garantido' na cor do score", () => {
  const HOJE = "2026-10-07";
  const seq = (p: Partial<Sequencia>): Sequencia => ({ dias: 12, hojeFeito: false, saldo: 1, usados: [], recorde: 12, hoje: HOJE, lista: [], acao: { texto: "marque um hábito" } as Sequencia["acao"], faixa: faixaDoFogo(12), protegidoOntem: false, ...p });
  // (renderToStaticMarkup: o jsdom joga fora `color: hsl(var(--x))` — o HTML do servidor guarda o estilo como está)
  const html = (p: Partial<Sequencia>) => renderToStaticMarkup(<StaticRouter location="/home"><LinhaSequencia seq={seq(p)} /></StaticRouter>);
  const SCORE = "color:hsl(var(--score-ring, var(--warning)))";
  const tag = (marcado: string, id: string) => new RegExp(`<[^>]*data-testid="${id}"[^>]*>[\\s\\S]*?</`).exec(marcado)?.[0] ?? new RegExp(`<[^>]*data-testid="${id}"[^>]*>`).exec(marcado)?.[0] ?? "";

  it("o 'garantido hoje' usa a cor do score; nada de verde", () => {
    const h = html({ dias: 12, hojeFeito: true });
    expect(tag(h, "linha-sequencia-garantido")).toContain(SCORE);
    expect(tag(h, "linha-sequencia-ponto")).toContain(SCORE); // o "·" entre os dias e o garantido também segue o tema
    expect(h).not.toContain("--success");
  });

  it("em cada faixa (3, 8, 20, 45, 120 dias) o fogo e os dias seguem a cor da faixa", () => {
    for (const dias of [3, 8, 20, 45, 120]) {
      const f = faixaDoFogo(dias);
      const h = html({ dias, faixa: f, hojeFeito: true });
      expect(tag(h, "linha-sequencia-fogo"), `${dias} dias`).toContain(`data-fogo="${f.id}"`);
      expect(tag(h, "linha-sequencia-dias"), `${dias} dias`).toContain(f.hojeTexto);
      expect(tag(h, "linha-sequencia-dias"), `${dias} dias`).not.toContain("--score-ring");
    }
  });

  it("sem sequência: fogo apagado (cinza), sem cor de faixa nem de score", () => {
    const h = tag(html({ dias: 0 }), "linha-sequencia-fogo");
    expect(h).not.toContain("--score-ring");
    expect(h).not.toContain("data-fogo");
  });
});
