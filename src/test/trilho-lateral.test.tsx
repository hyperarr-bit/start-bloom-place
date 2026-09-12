/**
 * Trilho lateral do computador (11/09): Home + módulos na ORDEM da pessoa,
 * ocultos de fora, ativo marcado, e a classe `com-trilho` no <body> só
 * enquanto a rota tem trilho (o funil não pode ficar deslocado).
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { TrilhoLateral } from "@/components/TrilhoLateral";

vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));

beforeAll(() => {
  window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
});

const Onde = () => <p data-testid="onde">{useLocation().pathname}</p>;
const montar = (rota: string, prefs: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { "core-module-prefs": prefs };
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: () => { throw new Error("o trilho não pode gravar"); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  };
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <UserDataContext.Provider value={valor}>
        <TrilhoLateral />
        <Routes><Route path="*" element={<Onde />} /></Routes>
      </UserDataContext.Provider>
    </MemoryRouter>,
  );
};

describe("TrilhoLateral", () => {
  it("segue a ordem da pessoa, esconde os ocultos e marca o módulo ativo", () => {
    montar("/treino", { order: ["treino", "biblioteca", "financas"], hidden: ["pet", "detox"], favorites: [] });
    const nav = screen.getByTestId("trilho-lateral").querySelector("nav") as HTMLElement;
    const rotulos = [...nav.querySelectorAll("button")].map(b => b.textContent?.trim());
    expect(rotulos.slice(0, 4)).toEqual(["Início", "Treino", "Biblioteca", "Finanças"]);
    expect(rotulos).not.toContain("Pet");
    expect(rotulos).not.toContain("Detox");
    expect(screen.getByRole("button", { name: "Treino" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Finanças" })).not.toHaveAttribute("aria-current");
    expect(document.body.classList.contains("com-trilho")).toBe(true);
  });

  it("clicar num módulo navega; fora das rotas do app o trilho some e a classe sai do body", () => {
    montar("/home");
    fireEvent.click(screen.getByRole("button", { name: "Biblioteca" }));
    expect(screen.getByTestId("onde").textContent).toBe("/biblioteca");
    expect(screen.getByTestId("trilho-lateral")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Início" }));
    expect(screen.getByTestId("onde").textContent).toBe("/home");
  });

  it("no funil (rota sem trilho) não renderiza nem desloca o body", () => {
    montar("/inicio");
    expect(screen.queryByTestId("trilho-lateral")).not.toBeInTheDocument();
    expect(document.body.classList.contains("com-trilho")).toBe(false);
  });
});
