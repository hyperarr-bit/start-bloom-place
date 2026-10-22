/**
 * 1.0.18 (QA de aparelho 21/10, iPhone 17 Pro): o balão da dica do dia 2 nascia EMBAIXO (sem medida = "sem alvo"),
 * por cima da grade de módulos, e pulava pro score ~0,4–1,3 s depois; o toque no "Entendi" durante o pulo passava pelo
 * véu e abria o Treino. Agora ele só aparece quando a posição assentou (2 medidas iguais) ou em 1,5 s.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/hooks/use-life-hub-data", () => ({ useLifeHubData: () => ({ dayScore: 45 }) }));
vi.mock("@/lib/missao-doses", () => ({ eventoDaMissao: (x: unknown) => x }));

import { DicaDoDia, ASSENTAR_MAX_MS } from "@/components/missao-doses/DicaDoDia";

let alvo: HTMLElement | null = null;
let topoDoAlvo = 120;
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); alvo?.remove(); alvo = null; vi.useRealTimers(); });
const porAlvo = () => {
  alvo = document.createElement("div");
  alvo.setAttribute("data-tour", "score");
  alvo.getBoundingClientRect = () => ({ top: topoDoAlvo, bottom: topoDoAlvo + 150, left: 16, right: 374, width: 358, height: 150, x: 16, y: topoDoAlvo, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(alvo);
};
const balao = () => screen.getByRole("dialog");

describe("dica do dia 2: o balão não aparece antes de assentar (sem pulo, sem toque fantasma)", () => {
  it("com o alvo rolando: escondido e sem toque até 2 medidas iguais; aí aparece JÁ no lugar (abaixo do score)", () => {
    porAlvo(); topoDoAlvo = 400; // a rolagem suave ainda andando
    render(<DicaDoDia dia={2} aoFechar={() => {}} />);
    expect(screen.getByTestId("missao-dica")).not.toHaveAttribute("data-pronto");
    expect(balao().className).toMatch(/pointer-events-none/);
    expect(balao().className).toMatch(/invisible/);
    act(() => { vi.advanceTimersByTime(150); });
    topoDoAlvo = 200; // ainda rolando
    act(() => { vi.advanceTimersByTime(150); });
    expect(screen.getByTestId("missao-dica")).not.toHaveAttribute("data-pronto");
    topoDoAlvo = 120; // parou
    act(() => { vi.advanceTimersByTime(150); });
    act(() => { vi.advanceTimersByTime(150); });
    expect(screen.getByTestId("missao-dica")).toHaveAttribute("data-pronto");
    expect(balao().className).toMatch(/pointer-events-auto/);
    expect(balao().style.top).toBe(`${120 + 150 + 12}px`); // abaixo do score, nunca embaixo da tela
  });

  it("sem alvo na tela: espera assentar e aparece embaixo (como antes)", () => {
    render(<DicaDoDia dia={2} aoFechar={() => {}} />);
    expect(screen.getByTestId("missao-dica")).not.toHaveAttribute("data-pronto");
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByTestId("missao-dica")).toHaveAttribute("data-pronto");
    expect(balao().className).toMatch(/pointer-events-auto/);
  });

  it("alvo que nunca para: aparece no máximo em 1,5 s", () => {
    porAlvo();
    render(<DicaDoDia dia={2} aoFechar={() => {}} />);
    for (let t = 0; t < ASSENTAR_MAX_MS - 150; t += 150) { topoDoAlvo += 37; act(() => { vi.advanceTimersByTime(150); }); }
    expect(screen.getByTestId("missao-dica")).not.toHaveAttribute("data-pronto");
    topoDoAlvo += 37; act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByTestId("missao-dica")).toHaveAttribute("data-pronto");
  });
});
