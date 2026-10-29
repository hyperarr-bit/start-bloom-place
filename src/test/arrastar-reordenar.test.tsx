/**
 * "A TELA É MUITO SENSÍVEL" (avaliação 5★ da App Store, 28/10) — lib/arrastar-reordenar + hooks/use-long-press:
 *   · a regra única: o dedo segura PARADO ~550 ms (tolerância 5 px) pra arrastar; o mouse começa com 5 px;
 *   · sem PointerSensor (ele pega o dedo e arrastava com 5 px de rolagem);
 *   · o "segurar pra editar" dos widgets só dispara com o dedo parado — rolar (mexer o dedo, ou a página rolar) desarma.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, renderHook, fireEvent, act, cleanup } from "@testing-library/react";
import { MouseSensor, PointerSensor, TouchSensor } from "@dnd-kit/core";
import {
  DISTANCIA_MOUSE_PX, RESTRICAO_MOUSE, RESTRICAO_TOQUE, SEGURAR_PRA_ARRASTAR_MS, TOLERANCIA_DEDO_PX, criarSegurarParado, useSensoresDeReordenar,
} from "@/lib/arrastar-reordenar";
import { useLongPress } from "@/hooks/use-long-press";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("as constantes", () => {
  it("segurar entre 500 e 600 ms, tolerância pequena; mouse por distância", () => {
    expect(SEGURAR_PRA_ARRASTAR_MS).toBeGreaterThanOrEqual(500);
    expect(SEGURAR_PRA_ARRASTAR_MS).toBeLessThanOrEqual(600);
    expect(TOLERANCIA_DEDO_PX).toBeGreaterThan(0);
    expect(TOLERANCIA_DEDO_PX).toBeLessThanOrEqual(6);
    expect(RESTRICAO_TOQUE).toEqual({ delay: SEGURAR_PRA_ARRASTAR_MS, tolerance: TOLERANCIA_DEDO_PX });
    expect(RESTRICAO_MOUSE).toEqual({ distance: DISTANCIA_MOUSE_PX });
  });
  it("os sensores do dnd-kit: Mouse (distância) + Touch (segurar parado); nenhum PointerSensor", () => {
    vi.useRealTimers();
    const { result } = renderHook(() => useSensoresDeReordenar());
    const sensores = result.current.map((s) => s.sensor);
    expect(sensores).toContain(MouseSensor);
    expect(sensores).toContain(TouchSensor);
    expect(sensores).not.toContain(PointerSensor);
    const toque = result.current.find((s) => s.sensor === TouchSensor)!;
    expect(toque.options).toEqual({ activationConstraint: RESTRICAO_TOQUE });
    const mouse = result.current.find((s) => s.sensor === MouseSensor)!;
    expect(mouse.options).toEqual({ activationConstraint: RESTRICAO_MOUSE });
  });
  it("a Home clássica usa os sensores compartilhados (sem PointerSensor/delay próprio no arquivo)", async () => {
    vi.useRealTimers();
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const fonte = readFileSync(resolve(__dirname, "../pages/Home.tsx"), "utf8");
    expect(fonte).toContain("useSensoresDeReordenar()");
    expect(fonte).not.toMatch(/useSensor\(|activationConstraint:/);
  });
});

describe("segurar PARADO (criarSegurarParado)", () => {
  it("dedo parado pelo tempo todo: dispara 1x, só no fim", () => {
    const f = vi.fn();
    const s = criarSegurarParado(f);
    s.iniciar(100, 100);
    vi.advanceTimersByTime(SEGURAR_PRA_ARRASTAR_MS - 1);
    expect(f).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(f).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("tremidinha dentro da tolerância ainda vale", () => {
    const f = vi.fn();
    const s = criarSegurarParado(f);
    s.iniciar(100, 100);
    s.mover(103, 98);
    vi.advanceTimersByTime(SEGURAR_PRA_ARRASTAR_MS);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("ROLAR (o dedo anda mais que a tolerância) nunca ativa — nem se o dedo parar depois", () => {
    const f = vi.fn();
    const s = criarSegurarParado(f);
    s.iniciar(100, 300);
    vi.advanceTimersByTime(120);
    s.mover(100, 260); // rolando
    vi.advanceTimersByTime(SEGURAR_PRA_ARRASTAR_MS * 3); // e parou com o dedo na tela
    expect(f).not.toHaveBeenCalled();
    expect(s.armado()).toBe(false);
  });
  it("soltar antes do tempo (um toque) não ativa", () => {
    const f = vi.fn();
    const s = criarSegurarParado(f);
    s.iniciar(10, 10);
    vi.advanceTimersByTime(200);
    s.soltar();
    vi.advanceTimersByTime(SEGURAR_PRA_ARRASTAR_MS);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("useLongPress (o 'segurar pra editar' dos widgets)", () => {
  const Alvo = ({ f }: { f: () => void }) => {
    const h = useLongPress(f);
    return <div data-testid="alvo" {...h} />;
  };
  const toque = (x: number, y: number) => ({ touches: [{ clientX: x, clientY: y }] });

  it("dedo parado ~550 ms: entra no modo de editar", () => {
    const f = vi.fn();
    const { getByTestId } = render(<Alvo f={f} />);
    fireEvent.touchStart(getByTestId("alvo"), toque(50, 50));
    act(() => { vi.advanceTimersByTime(SEGURAR_PRA_ARRASTAR_MS); });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("o tempo antigo (200 ms) não basta mais", () => {
    const f = vi.fn();
    const { getByTestId } = render(<Alvo f={f} />);
    fireEvent.touchStart(getByTestId("alvo"), toque(50, 50));
    act(() => { vi.advanceTimersByTime(300); });
    fireEvent.touchEnd(getByTestId("alvo"));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(f).not.toHaveBeenCalled();
  });
  it("rolar a Home com o dedo em cima de um widget (touchmove além da tolerância) NÃO entra no modo de editar", () => {
    const f = vi.fn();
    const { getByTestId } = render(<Alvo f={f} />);
    fireEvent.touchStart(getByTestId("alvo"), toque(50, 400));
    fireEvent.touchMove(getByTestId("alvo"), toque(50, 380));
    act(() => { vi.advanceTimersByTime(2000); });
    expect(f).not.toHaveBeenCalled();
  });
  it("a página rolando (rolagem nativa, sem touchmove) também desarma; o toque cancelado pelo sistema também", () => {
    const f = vi.fn();
    const { getByTestId } = render(<Alvo f={f} />);
    fireEvent.touchStart(getByTestId("alvo"), toque(50, 400));
    act(() => { vi.advanceTimersByTime(100); window.dispatchEvent(new Event("scroll")); vi.advanceTimersByTime(2000); });
    expect(f).not.toHaveBeenCalled();
    fireEvent.touchStart(getByTestId("alvo"), toque(50, 400));
    fireEvent.touchCancel(getByTestId("alvo"));
    act(() => { vi.advanceTimersByTime(2000); });
    expect(f).not.toHaveBeenCalled();
  });
  it("mouse: segurar parado vale; arrastar o mouse desarma", () => {
    const f = vi.fn();
    const { getByTestId } = render(<Alvo f={f} />);
    fireEvent.mouseDown(getByTestId("alvo"), { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(getByTestId("alvo"), { clientX: 40, clientY: 10 });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(f).not.toHaveBeenCalled();
    fireEvent.mouseDown(getByTestId("alvo"), { clientX: 10, clientY: 10 });
    act(() => { vi.advanceTimersByTime(SEGURAR_PRA_ARRASTAR_MS); });
    expect(f).toHaveBeenCalledTimes(1);
  });
});
