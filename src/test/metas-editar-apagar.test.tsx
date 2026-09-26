/**
 * Metas (25/09) — chamado do app: "sem querer cliquei o enter quando estava
 * escrevendo uma meta e não consigo mais editar ou apagar". A troca de nome
 * nunca era ligada e a lixeira só aparecia com 2+ metas. E criar a 1ª meta com
 * as etiquetas na tela derrubava a página (hook depois de um return).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { GoalsBoardV2 } from "@/components/hiperfoco/GoalsBoardV2";
import { EtiquetasDasMetas } from "@/pages/DesenvolvimentoPessoal";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isSubscribed: true, user: null }) }));

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
const renderizar = (store: ReturnType<typeof criarStore>) =>
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}><GoalsBoardV2 /></UserDataContext.Provider></MemoryRouter>);
const metas = (store: ReturnType<typeof criarStore>) => (store.dados["goals-board-v2"] ?? []) as Array<{ id: string; title: string }>;

const criarMetaComEnter = (texto: string) => {
  fireEvent.click(screen.getByText(/Nova meta/i));
  const campo = screen.getByPlaceholderText("Nome da meta...");
  fireEvent.change(campo, { target: { value: texto } });
  fireEvent.keyDown(campo, { key: "Enter" });
};

describe("Metas — editar e apagar", () => {
  beforeEach(() => { vi.spyOn(window, "confirm").mockReturnValue(true); });

  it("meta criada sem querer com Enter pode ser renomeada pelo lápis", () => {
    const store = criarStore({ "goals-board-v2": [] });
    renderizar(store);
    criarMetaComEnter("Aprender ingl");
    fireEvent.click(screen.getByRole("button", { name: "Renomear meta" }));
    const nome = screen.getByLabelText("Nome da meta");
    fireEvent.change(nome, { target: { value: "Aprender inglês" } });
    fireEvent.blur(nome);
    expect(metas(store).map((m) => m.title)).toContain("Aprender inglês");
  });

  it("dá pra apagar mesmo sendo a única meta (com confirmação)", () => {
    const store = criarStore({ "goals-board-v2": [] });
    renderizar(store);
    criarMetaComEnter("Meta errad");
    expect(metas(store)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Apagar meta" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(metas(store)).toHaveLength(0);
    expect(screen.getByText(/Nova meta/i)).toBeInTheDocument(); // voltou pra lista sem quebrar
  });

  it("cancelar a confirmação não apaga", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const store = criarStore({ "goals-board-v2": [] });
    renderizar(store);
    criarMetaComEnter("Correr 5 km");
    fireEvent.click(screen.getByRole("button", { name: "Apagar meta" }));
    expect(metas(store)).toHaveLength(1);
  });

  it("nome apagado por inteiro não fica em branco", () => {
    const store = criarStore({ "goals-board-v2": [] });
    renderizar(store);
    criarMetaComEnter("X");
    fireEvent.click(screen.getByRole("button", { name: "Renomear meta" }));
    const nome = screen.getByLabelText("Nome da meta");
    fireEvent.change(nome, { target: { value: "   " } });
    fireEvent.blur(nome);
    expect(metas(store)[0].title).toBe("Minha meta");
  });
});

describe("Etiquetas das metas — 1ª meta não derruba a tela", () => {
  it("sem metas não aparece; quando nasce a 1ª, aparece sem erro de hooks", () => {
    const store = criarStore({ "goals-board-v2": [] });
    const ui = () => <MemoryRouter><UserDataContext.Provider value={store.valor}><EtiquetasDasMetas /></UserDataContext.Provider></MemoryRouter>;
    const { container, rerender } = render(ui());
    expect(container.textContent).toBe("");
    store.dados["goals-board-v2"] = [{ id: "g1", title: "Primeira meta", heroImage: "", referenceImages: [], problems: [], steps: [], notes: "" }];
    expect(() => rerender(ui())).not.toThrow();
    expect(screen.getByText(/Primeira meta/)).toBeInTheDocument();
  });
});
