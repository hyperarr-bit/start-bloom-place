/**
 * A prévia dos Stories cabe no palco MESMO quando o rodapé cresce depois de
 * montar (varredura 27/09). Na prévia direta (planner → "Postar minha
 * conquista", card do álbum → "Compartilhar") o "Postar vídeo" só entra quando
 * a detecção do vídeo responde — depois da 1ª pintura. A altura do palco era
 * lida uma vez só, e a arte ficava do tamanho do palco antigo: ~27 px por baixo
 * do cabeçalho e ~27 px por cima do rodapé (cobrindo o alto do "Trocar
 * conquista"). Agora o palco é medido ao vivo, sem o recuo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";

vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: () => {},
}));

import { Previa } from "@/components/conquistas/SeletorDeArte";

const dims = { w: 358, h: 616 };
let redimensionar: (() => void) | null = null;

class ResizeObserverFalso {
  constructor(cb: ResizeObserverCallback) {
    redimensionar = () => cb([], this as unknown as ResizeObserver);
  }
  observe() {}
  unobserve() {}
  disconnect() { redimensionar = null; }
}

const ehPalco = (el: HTMLElement) => el.getAttribute("data-testid") === "previa-palco";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverFalso);
  // o jsdom não faz layout: o palco "mede" o que o teste mandar (px-4 py-1.5 = 16/6 px de recuo)
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get() { return ehPalco(this) ? dims.w + 32 : 0; } });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get() { return ehPalco(this) ? dims.h + 12 : 0; } });
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element, pseudo?: string | null) => {
    const cs = real(el, pseudo);
    if (!(el instanceof HTMLElement) || !ehPalco(el)) return cs;
    return new Proxy(cs, {
      get: (alvo, k) => (k === "paddingLeft" || k === "paddingRight" ? "16px" : k === "paddingTop" || k === "paddingBottom" ? "6px" : Reflect.get(alvo, k)),
    });
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
});

const larguraDaArte = () => (screen.getByTestId("arte-teste").parentElement!.parentElement as HTMLElement).style.width;

describe("prévia dos Stories: a arte cabe no palco", () => {
  it("usa a caixa SEM o recuo e acompanha o palco quando o rodapé cresce depois de montar", () => {
    dims.w = 358;
    dims.h = 616;
    render(<Previa titulo="Minha conquista do mês" elemento={<div data-testid="arte-teste" />} onPostar={() => {}} onFechar={() => {}} />);
    // 616 de altura útil → 616 × 1080/1920 = 346 de largura (cabe nos 358 úteis)
    expect(larguraDaArte()).toBe("346px");

    // o "Postar vídeo" entrou no rodapé: o palco encolhe 52 px e a arte vai junto
    dims.h = 564;
    act(() => redimensionar?.());
    expect(larguraDaArte()).toBe("317px");
  });

  it("o X não encolhe com o título comprido (era 29 px em 360)", () => {
    render(<Previa titulo="Meu álbum de figurinhas com um nome bem comprido" elemento={<div data-testid="arte-teste" />} onPostar={() => {}} onFechar={() => {}} />);
    expect(screen.getByTestId("previa-fechar").className).toMatch(/(^|\s)shrink-0(\s|$)/);
  });

  it("tela estreita e alta: a largura útil manda (sem encostar nas bordas)", () => {
    dims.w = 288;
    dims.h = 700;
    render(<Previa titulo="Meu álbum" elemento={<div data-testid="arte-teste" />} onPostar={() => {}} onFechar={() => {}} />);
    expect(larguraDaArte()).toBe("288px");
  });
});
