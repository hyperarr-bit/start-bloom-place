/**
 * 26/10 (adendo do dono) — O ACENDER do CoreFire na pílula da Home nova:
 *  (a) registrou com a Home na tela (apagado → aceso sem desmontar): acende NO MESMO quadro — o svg vira `done` e o
 *      cf-ignite já está lá (a opacidade sobe .52 → 1 dentro dele, sem pulo);
 *  (b) voltou pra Home depois de registrar num módulo (monta já garantido): ~0,4 s APAGADO e então acende;
 *  (c) 1x por dia: reabrir/trocar de aba no mesmo dia monta aceso, sem acender; sair durante o "apagado" não gasta o dia;
 *  (d) o cartão das Conquistas e a folha nunca acendem sozinhos; prefers-reduced-motion não tem o "apagado → acende".
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";

const reduzir = vi.hoisted(() => ({ valor: false }));
vi.mock("framer-motion", async (orig) => ({ ...(await orig<typeof import("framer-motion")>()), useReducedMotion: () => reduzir.valor }));

import { PilulaFogoE, ESPERA_ANTES_DE_ACENDER_MS } from "@/components/home-nova/e/PilulaFogoE";
import { FogoSequencia } from "@/components/fogo/FogoSequencia";
import { CHAVE_FOGO_ACESO_HOME_NOVA } from "@/lib/home-nova";
import { localDayKey } from "@/lib/utils";

const seq = (dias: number, hojeFeito: boolean) => ({ dias, hojeFeito, faixa: undefined as never });
const fogo = () => screen.getByTestId("fg-seq");
const svg = () => fogo().querySelector("svg.core-fire") as SVGElement;

beforeEach(() => { localStorage.clear(); reduzir.valor = false; vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("o acender da pílula", () => {
  it("(a) apagado → aceso com a Home na tela: aceso e acendendo no MESMO render; marca o dia", () => {
    const { rerender } = render(<PilulaFogoE seq={seq(4, false)} onTocar={() => {}} />);
    expect(fogo().getAttribute("data-fogo")).toBe("apagado");
    expect(svg().getAttribute("data-status")).toBe("pending");
    rerender(<PilulaFogoE seq={seq(5, true)} onTocar={() => {}} />);
    // sem avançar o relógio nem esperar efeito: o mesmo quadro já tem done + cf-ignite + as 3 faíscas
    expect(svg().getAttribute("data-status")).toBe("done");
    expect(svg().querySelector(".cf-ignite")).toBeTruthy();
    expect(svg().querySelectorAll(".cf-spark").length).toBe(3);
    expect(localStorage.getItem(CHAVE_FOGO_ACESO_HOME_NOVA)).toBe(localDayKey());
    act(() => { vi.advanceTimersByTime(1200); });
    expect(svg().querySelector(".cf-ignite")).toBeNull();
    expect(svg().getAttribute("data-status")).toBe("done");
  });

  it("(b) voltou pra Home já garantido: monta APAGADO ~0,4 s e acende; (c) reabrir no mesmo dia não acende de novo", () => {
    const { unmount } = render(<PilulaFogoE seq={seq(5, true)} onTocar={() => {}} />);
    expect(fogo().getAttribute("data-fogo")).toBe("apagado");
    expect(svg().querySelector(".cf-ignite")).toBeNull();
    expect(localStorage.getItem(CHAVE_FOGO_ACESO_HOME_NOVA)).toBeNull();
    act(() => { vi.advanceTimersByTime(ESPERA_ANTES_DE_ACENDER_MS); });
    expect(fogo().getAttribute("data-fogo")).toBe("aceso");
    expect(svg().querySelector(".cf-ignite")).toBeTruthy();
    expect(localStorage.getItem(CHAVE_FOGO_ACESO_HOME_NOVA)).toBe(localDayKey());
    unmount();
    render(<PilulaFogoE seq={seq(5, true)} onTocar={() => {}} />);
    expect(fogo().getAttribute("data-fogo")).toBe("aceso");
    act(() => { vi.advanceTimersByTime(2000); });
    expect(svg().querySelector(".cf-ignite")).toBeNull();
  });

  it("(c) saiu da Home durante o 'apagado' (trocou de aba): o dia não é gasto — acende na volta", () => {
    const { unmount } = render(<PilulaFogoE seq={seq(5, true)} onTocar={() => {}} />);
    act(() => { vi.advanceTimersByTime(ESPERA_ANTES_DE_ACENDER_MS - 100); });
    unmount();
    expect(localStorage.getItem(CHAVE_FOGO_ACESO_HOME_NOVA)).toBeNull();
    render(<PilulaFogoE seq={seq(5, true)} onTocar={() => {}} />);
    act(() => { vi.advanceTimersByTime(ESPERA_ANTES_DE_ACENDER_MS); });
    expect(svg().querySelector(".cf-ignite")).toBeTruthy();
  });

  it("(d) prefers-reduced-motion: monta aceso direto, sem o acender", () => {
    reduzir.valor = true;
    render(<PilulaFogoE seq={seq(5, true)} onTocar={() => {}} />);
    expect(fogo().getAttribute("data-fogo")).toBe("aceso");
    act(() => { vi.advanceTimersByTime(2000); });
    expect(svg().querySelector(".cf-ignite")).toBeNull();
    expect(svg().querySelector("animate")).toBeNull();
  });

  it("(d) cartão/folha (sem `acender`): montar e remontar aceso nunca toca o acender", () => {
    const { unmount } = render(<FogoSequencia dias={30} estado="aceso" />);
    expect(svg().querySelector(".cf-ignite")).toBeNull();
    unmount();
    render(<FogoSequencia dias={30} estado="aceso" />);
    expect(svg().querySelector(".cf-ignite")).toBeNull();
  });

  it("o cf-ignite sai do desbotado do pendente (.52) e chega em 1 junto com o pulo", () => {
    const css = readFileSync(resolve(process.cwd(), "src/components/fogo/core-fire/core-fire.css"), "utf8");
    expect(css).toMatch(/@keyframes cf-ignite \{ 0% \{[^}]*opacity: \.52;[^}]*\} 38% \{[^}]*opacity: 1;/);
    expect(css).toMatch(/\.core-fire\[data-status="pending"\] \{ opacity: \.52; \}/);
  });
});
