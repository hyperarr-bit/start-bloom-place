/** Varredura 26/10 (item 9): com 4 widgets a página 3 não tinha como editar — "Editar" à direita das bolinhas, só na página 3. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CarrosselDia } from "@/components/home-nova/e/CarrosselDia";
import { EditarWidgets } from "@/components/home-nova/e/PaginaWidgets";

afterEach(() => cleanup());

describe("Editar dos widgets", () => {
  it("a ação da página aparece só com aquela página na tela e abre a folha", () => {
    const editar = vi.fn();
    const paginas = [<div key="a" />, <div key="b" />, <div key="c" />];
    const acoes = [null, null, <EditarWidgets key="e" onEditar={editar} />];
    render(<CarrosselDia paginas={paginas} rotulos={["1", "2", "3"]} paginaInicial={0} acoes={acoes} />);
    expect(screen.queryByTestId("he-widgets-editar")).toBeNull(); // página 1 na tela: nada
    cleanup();
    render(<CarrosselDia paginas={paginas} rotulos={["1", "2", "3"]} paginaInicial={2} acoes={acoes} />);
    fireEvent.click(screen.getByTestId("he-widgets-editar"));
    expect(editar).toHaveBeenCalledTimes(1);
  });
  it("a Home nova passa o Editar na página 3 sempre que há widget (inclusive com 4)", () => {
    const fonte = readFileSync(resolve(__dirname, "../components/home-nova/e/HomeE.tsx"), "utf8");
    expect(fonte).toMatch(/acoes=\{\[null, null, widgetsE\.ativos\.length > 0 \? <EditarWidgets onEditar=\{\(\) => setPicker\(true\)\} \/> : null\]\}/);
  });
});
