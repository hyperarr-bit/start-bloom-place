import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SelectEnxuto } from "@/components/ui/select-enxuto";

/* 07/11 (desempenho): o Select que só monta as opções com a lista aberta — fechado mostra o rótulo do escolhido
 * e não renderiza item nenhum; aberto, lista todas e escolher uma avisa e fecha. */

const OPCOES = Array.from({ length: 94 }, (_, i) => ({ value: `m${i}`, label: `mês ${i}` }));

// o jsdom não tem captura de ponteiro nem scrollIntoView; o Select do Radix chama os dois ao abrir
beforeAll(() => {
  const p = Element.prototype as unknown as Record<string, unknown>;
  if (typeof p.hasPointerCapture !== "function") p.hasPointerCapture = () => false;
  if (typeof p.setPointerCapture !== "function") p.setPointerCapture = () => {};
  if (typeof p.releasePointerCapture !== "function") p.releasePointerCapture = () => {};
  if (typeof p.scrollIntoView !== "function") p.scrollIntoView = () => {};
});

describe("SelectEnxuto", () => {
  it("fechado: mostra o rótulo e não monta nenhuma opção", () => {
    render(<SelectEnxuto value="m3" onValueChange={() => {}} opcoes={OPCOES} rotulo="mês 3" ariaLabel="Primeiro mês" />);
    const gatilho = screen.getByRole("combobox", { name: "Primeiro mês" });
    expect(gatilho).toHaveTextContent("mês 3");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(document.body.textContent).not.toContain("mês 50");
  });

  it("aberto: monta as opções; escolher avisa e fecha", () => {
    const onValueChange = vi.fn();
    render(<SelectEnxuto value="m3" onValueChange={onValueChange} opcoes={OPCOES} rotulo="mês 3" ariaLabel="Primeiro mês" />);
    const gatilho = screen.getByRole("combobox", { name: "Primeiro mês" });
    // o Radix abre no pointerdown (jsdom: sem hasPointerCapture — o Radix já trata)
    fireEvent.pointerDown(gatilho, { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.click(gatilho);
    const opcoes = screen.getAllByRole("option");
    expect(opcoes.length).toBe(94);
    fireEvent.click(screen.getByRole("option", { name: "mês 50" }));
    expect(onValueChange).toHaveBeenCalledWith("m50");
  });
});
