/**
 * Renomear cartão (26/09) — chamado de 25/09: "criei o cartão com o nome
 * errado e não consigo mudar". O value não muda, então os gastos acompanham.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { CartaoConfig } from "@/components/finance/CartaoConfig";
import { CUSTOM_CARDS_KEY } from "@/lib/finance-cards";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor };
};

describe("Cartão personalizado — renomear", () => {
  it("troca o nome e mantém o mesmo id (os gastos acompanham)", () => {
    const store = criarStore({ [CUSTOM_CARDS_KEY]: [{ value: "k_abc", label: "Nubak", palette: 0 }] });
    render(<UserDataContext.Provider value={store.valor}><CartaoConfig card="k_abc" label="Nubak" /></UserDataContext.Provider>);
    fireEvent.click(screen.getByRole("button", { name: "Editar cartão Nubak" }));
    fireEvent.change(screen.getByLabelText("Nome do cartão"), { target: { value: "Nubank Roxinho" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar cartão" }));
    expect(store.dados[CUSTOM_CARDS_KEY]).toEqual([{ value: "k_abc", label: "Nubank Roxinho", palette: 0 }]);
  });

  it("nome repetido de outra bandeira é recusado e nada muda", () => {
    const store = criarStore({ [CUSTOM_CARDS_KEY]: [{ value: "k_abc", label: "Loja", palette: 0 }] });
    render(<UserDataContext.Provider value={store.valor}><CartaoConfig card="k_abc" label="Loja" /></UserDataContext.Provider>);
    fireEvent.click(screen.getByRole("button", { name: "Editar cartão Loja" }));
    fireEvent.change(screen.getByLabelText("Nome do cartão"), { target: { value: "itaú" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar cartão" }));
    expect(store.dados[CUSTOM_CARDS_KEY]).toEqual([{ value: "k_abc", label: "Loja", palette: 0 }]);
  });

  it("bandeira padrão não ganha campo de nome", () => {
    const store = criarStore();
    render(<UserDataContext.Provider value={store.valor}><CartaoConfig card="nubank" label="Nubank" /></UserDataContext.Provider>);
    fireEvent.click(screen.getByRole("button", { name: "Fechamento e vencimento do cartão Nubank" }));
    expect(screen.queryByLabelText("Nome do cartão")).not.toBeInTheDocument();
  });
});
