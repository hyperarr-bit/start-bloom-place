import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PieChart, Pie, ResponsiveContainer } from "recharts";
import { instalarResizeObserverSePreciso } from "@/lib/resize-observer-fallback";

// jsdom NÃO tem ResizeObserver: é exatamente o Safari < 13.1 do crash.
describe("shim de ResizeObserver", () => {
  beforeEach(() => {
    // simulando navegador velho. O cast é necessário porque a lib DOM declara
    // ResizeObserver como obrigatório; `@ts-expect-error` aqui ficava sem uso
    // (o delete de propriedade opcional já é válido) e virava erro de tipo.
    delete (window as { ResizeObserver?: unknown }).ResizeObserver;
  });

  it("SEM o shim, o ResponsiveContainer do recharts derruba a árvore", () => {
    expect(() =>
      render(
        <ResponsiveContainer width="50%" height={180}>
          <PieChart>
            <Pie data={[{ name: "a", value: 1 }]} dataKey="value" />
          </PieChart>
        </ResponsiveContainer>,
      ),
    ).toThrow(/ResizeObserver/);
  });

  it("COM o shim, monta sem lançar", () => {
    instalarResizeObserverSePreciso();
    expect(typeof (window as unknown as { ResizeObserver?: unknown }).ResizeObserver).toBe("function");
    expect(() =>
      render(
        <div data-testid="wrap">
          <ResponsiveContainer width="50%" height={180}>
            <PieChart>
              <Pie data={[{ name: "a", value: 1 }]} dataKey="value" />
            </PieChart>
          </ResponsiveContainer>
        </div>,
      ),
    ).not.toThrow();
    expect(screen.getByTestId("wrap")).toBeTruthy();
  });

  it("emite o tamanho e para o timer sozinho no disconnect", async () => {
    instalarResizeObserverSePreciso();
    const RO = (window as unknown as { ResizeObserver: new (cb: (e: Array<{ contentRect: DOMRectReadOnly }>) => void) => { observe(e: Element): void; disconnect(): void } }).ResizeObserver;
    const el = document.createElement("div");
    document.body.appendChild(el);
    el.getBoundingClientRect = () => ({ width: 300, height: 180 }) as DOMRect;
    const vistos: string[] = [];
    const ro = new RO((entradas) => vistos.push(`${entradas[0].contentRect.width}x${entradas[0].contentRect.height}`));
    ro.observe(el);
    await new Promise((r) => setTimeout(r, 10));
    expect(vistos).toEqual(["300x180"]);
    el.getBoundingClientRect = () => ({ width: 420, height: 180 }) as DOMRect;
    await new Promise((r) => setTimeout(r, 320));
    expect(vistos).toEqual(["300x180", "420x180"]);
    ro.disconnect();
    el.getBoundingClientRect = () => ({ width: 999, height: 180 }) as DOMRect;
    await new Promise((r) => setTimeout(r, 320));
    expect(vistos).toEqual(["300x180", "420x180"]); // nada depois do disconnect
  });

  it("não substitui o ResizeObserver nativo quando existe", () => {
    class Nativo {}
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = Nativo;
    instalarResizeObserverSePreciso();
    expect((window as unknown as { ResizeObserver: unknown }).ResizeObserver).toBe(Nativo);
  });
});
