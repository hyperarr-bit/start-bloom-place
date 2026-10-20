/**
 * 1.0.17 QA (gravação no Simulador, 20/10): folhas da missão, o Montar Finanças e o tour da Home saíam da tela num quadro.
 * `saidaCalma` deixa uma CÓPIA visual sumindo devagar — e a cópia nunca pode ser enxergada pelo app (testid, camada de
 * guia, role="dialog", data-momento: a festa, o tour e a intro procuram por eles) nem receber toque.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { saidaCalma } from "@/lib/movimento";

const ua = navigator.userAgent;
afterEach(() => { Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true }); document.body.innerHTML = ""; vi.useRealTimers(); });

const folha = () => {
  const el = document.createElement("div");
  el.setAttribute("data-testid", "plano-amanha-a"); el.setAttribute("data-camada-guia", "missao-doses-plano"); el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
  el.innerHTML = '<div data-momento="x"><button data-testid="plano-a-combinado">Combinado</button></div>';
  el.getBoundingClientRect = () => ({ top: 0, left: 0, width: 390, height: 844, right: 390, bottom: 844, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(el);
  return el;
};

describe("saidaCalma", () => {
  it("nos testes (jsdom) não faz nada — o estado e as consultas seguem iguais", () => {
    saidaCalma(folha());
    expect(document.querySelectorAll("[data-saida-calma]").length).toBe(0);
  });

  it("no aparelho: a cópia entra sem testid, camada, role nem toque, e sai sozinha", () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 (iPhone)", configurable: true });
    const animar = vi.fn(() => ({ onfinish: null }));
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = animar;
    const el = folha();
    saidaCalma(el, 300);
    const copia = document.querySelector<HTMLElement>("[data-saida-calma]");
    expect(copia).not.toBeNull();
    expect(animar).toHaveBeenCalled();
    expect(copia!.style.pointerEvents).toBe("none");
    expect(copia!.getAttribute("aria-hidden")).toBe("true");
    for (const sel of ["[data-testid]", "[data-camada-guia]", "[role]", "[data-momento]", "[aria-modal]"]) {
      expect(copia!.matches(sel) || !!copia!.querySelector(sel), sel).toBe(false);
    }
    expect(document.querySelectorAll('[data-testid="plano-a-combinado"]').length).toBe(1); // só o original
    vi.advanceTimersByTime(800);
    expect(document.querySelector("[data-saida-calma]")).toBeNull();
    delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
  });
});
