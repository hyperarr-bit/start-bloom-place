/**
 * Varredura 26/10 (item 7): com "Reduzir movimento" a borda de voltar das subpáginas do Você sumia (a página caía no
 * caminho sem animação). O GESTO tem que existir sempre; só a animação some.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const reduzir = vi.hoisted(() => ({ v: true }));
vi.mock("framer-motion", async (orig) => ({ ...(await orig<typeof import("framer-motion")>()), useReducedMotion: () => reduzir.v }));

import { PageTransition } from "@/components/PageTransition";
import { PUSH_IOS, _zerarPilhaIos } from "@/lib/navegacao-ios";

const Sonda = () => <p data-testid="rota">{useLocation().pathname}</p>;
const montar = () => render(
  <MemoryRouter initialEntries={[{ pathname: "/voce/inicio", state: { push: PUSH_IOS } }]}>
    <Routes>
      <Route path="/voce/inicio" element={<PageTransition><p>personalizar</p></PageTransition>} />
      <Route path="*" element={<Sonda />} />
    </Routes>
  </MemoryRouter>,
);
const arrastar = (dx: number) => {
  const borda = screen.getByTestId("pt-borda-voltar");
  fireEvent.pointerDown(borda, { clientX: 2, pointerId: 1, timeStamp: 0 });
  fireEvent.pointerMove(borda, { clientX: 2 + dx / 2, pointerId: 1, timeStamp: 200 });
  fireEvent.pointerMove(borda, { clientX: 2 + dx, pointerId: 1, timeStamp: 400 });
  fireEvent.pointerUp(borda, { clientX: 2 + dx, pointerId: 1, timeStamp: 410 });
};

// o jsdom não tem PointerEvent (o fireEvent cairia num Event sem clientX/pointerId)
if (typeof window.PointerEvent === "undefined") {
  class PE extends MouseEvent { pointerId: number; constructor(t: string, i: PointerEventInit = {}) { super(t, i); this.pointerId = i.pointerId ?? 1; } }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = PE;
}
beforeEach(() => { _zerarPilhaIos(); reduzir.v = true; });
afterEach(() => cleanup());

describe("a borda de voltar com Reduzir movimento", () => {
  it("existe na subpágina empilhada, sem a transição de push", () => {
    montar();
    expect(screen.getByTestId("pt-borda-voltar")).toBeTruthy();
    expect(document.querySelector('[data-transicao="push"]')?.getAttribute("style") ?? "").not.toMatch(/translate/);
  });
  it("soltar além de 100 px volta na hora (sem animar)", () => {
    montar();
    arrastar(140);
    expect(screen.getByTestId("rota").textContent).toBe("/voce");
  });
  it("arrasto curto (abaixo de 24 px) não volta", () => {
    montar();
    arrastar(20);
    expect(screen.queryByTestId("rota")).toBeNull();
    expect(screen.getByText("personalizar")).toBeTruthy();
  });
});
