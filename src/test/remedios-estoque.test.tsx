/**
 * Estoque de remédios editável (25/09) — cliente perguntou "como alterar a
 * quantidade de medicamentos": todo remédio nascia com 30 e o número só descia
 * marcando "tomado". Agora tem "Qtd" no cadastro e o número da tabela é tocável.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { PharmacyChecklist } from "@/components/saude/PharmacyChecklist";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isSubscribed: true, user: null }) }));

type Remedio = { id: string; name: string; time: string; stock: number; dosesPerDay: number; quem?: string };
const CHAVE = "core-saude-supplements";

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
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}><PharmacyChecklist /></UserDataContext.Provider></MemoryRouter>);
const remedios = (store: ReturnType<typeof criarStore>) => (store.dados[CHAVE] ?? []) as Remedio[];

describe("Vitaminas e Remédios — quantidade em estoque", () => {
  it("cadastra com a quantidade digitada no Qtd", () => {
    const store = criarStore();
    renderizar(store);
    fireEvent.change(screen.getByPlaceholderText("Novo suplemento..."), { target: { value: "Losartana" } });
    fireEvent.change(screen.getByTestId("remedio-qtd"), { target: { value: "60" } });
    fireEvent.keyDown(screen.getByTestId("remedio-qtd"), { key: "Enter" });
    expect(remedios(store)[0]).toMatchObject({ name: "Losartana", stock: 60 });
    expect(screen.getByRole("button", { name: "Alterar estoque de Losartana (60)" })).toBeInTheDocument();
    expect(screen.getByTestId("remedio-qtd")).toHaveValue("30"); // volta pro padrão pro próximo
  });

  it("sem mexer no Qtd continua nascendo com 30; Qtd só aceita número", () => {
    const store = criarStore();
    renderizar(store);
    fireEvent.change(screen.getByTestId("remedio-qtd"), { target: { value: "2a0" } });
    expect(screen.getByTestId("remedio-qtd")).toHaveValue("20");
    fireEvent.change(screen.getByTestId("remedio-qtd"), { target: { value: "" } });
    fireEvent.change(screen.getByPlaceholderText("Novo suplemento..."), { target: { value: "Ômega 3" } });
    fireEvent.keyDown(screen.getByPlaceholderText("Novo suplemento..."), { key: "Enter" });
    expect(remedios(store)[0].stock).toBe(30);
  });

  it("toca no número, digita a quantidade nova e salva com Enter", () => {
    const store = criarStore({ [CHAVE]: [{ id: "r1", name: "Vitamina D3", time: "08:00", stock: 30, dosesPerDay: 1 }] });
    renderizar(store);
    fireEvent.click(screen.getByRole("button", { name: "Alterar estoque de Vitamina D3 (30)" }));
    const campo = screen.getByLabelText("Estoque de Vitamina D3");
    fireEvent.change(campo, { target: { value: "90" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(remedios(store)[0].stock).toBe(90);
    expect(screen.getByRole("button", { name: "Alterar estoque de Vitamina D3 (90)" })).toBeInTheDocument();
  });

  it("apagar o número e sair não zera o estoque; Esc cancela", () => {
    const store = criarStore({ [CHAVE]: [{ id: "r1", name: "Creatina", time: "17:00", stock: 42, dosesPerDay: 1 }] });
    renderizar(store);
    fireEvent.click(screen.getByRole("button", { name: /Alterar estoque de Creatina/ }));
    fireEvent.change(screen.getByLabelText("Estoque de Creatina"), { target: { value: "" } });
    fireEvent.blur(screen.getByLabelText("Estoque de Creatina"));
    expect(remedios(store)[0]?.stock ?? 42).toBe(42);
    fireEvent.click(screen.getByRole("button", { name: /Alterar estoque de Creatina/ }));
    fireEvent.change(screen.getByLabelText("Estoque de Creatina"), { target: { value: "5" } });
    fireEvent.keyDown(screen.getByLabelText("Estoque de Creatina"), { key: "Escape" });
    expect(screen.getByRole("button", { name: "Alterar estoque de Creatina (42)" })).toBeInTheDocument();
  });

  it("marcar como tomado desce 1 da quantidade nova", () => {
    const store = criarStore({ [CHAVE]: [{ id: "r1", name: "Vitamina D3", time: "08:00", stock: 30, dosesPerDay: 1 }] });
    renderizar(store);
    fireEvent.click(screen.getByRole("button", { name: "Alterar estoque de Vitamina D3 (30)" }));
    fireEvent.change(screen.getByLabelText("Estoque de Vitamina D3"), { target: { value: "60" } });
    fireEvent.keyDown(screen.getByLabelText("Estoque de Vitamina D3"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Marcar Vitamina D3 como tomado" }));
    expect(remedios(store)[0].stock).toBe(59);
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar Vitamina D3" }));
    expect(remedios(store)[0].stock).toBe(60);
  });
});
