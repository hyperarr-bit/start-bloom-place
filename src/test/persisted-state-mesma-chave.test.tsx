/**
 * Duas partes da tela lendo a MESMA chave (28/09): a tarefa criada pela ação
 * rápida da Home não aparecia no widget "Tarefas de hoje" até recarregar. A
 * escrita de uma instância do usePersistedState agora chega às outras da mesma
 * chave — e só da mesma chave.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { usePersistedState } from "@/hooks/use-persisted-state";

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const escritas: string[] = [];
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; escritas.push(key); },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor, escritas };
};

const Escreve = ({ chave }: { chave: string }) => {
  const [lista, setLista] = usePersistedState<string[]>(chave, []);
  return <button onClick={() => setLista((l) => [...l, "nova"])}>escrever {chave} ({lista.length})</button>;
};
const Le = ({ chave, id }: { chave: string; id: string }) => {
  const [lista] = usePersistedState<string[]>(chave, []);
  return <p data-testid={id}>{lista.join(",")}</p>;
};

describe("usePersistedState: mesma chave em dois lugares", () => {
  it("a escrita de um aparece no outro na hora; outra chave não mexe; o store recebe UMA escrita", async () => {
    const store = criarStore({ "a": ["x"], "b": ["y"] });
    render(
      <UserDataContext.Provider value={store.valor}>
        <Escreve chave="a" />
        <Le chave="a" id="le-a" />
        <Le chave="b" id="le-b" />
      </UserDataContext.Provider>,
    );
    expect(screen.getByTestId("le-a")).toHaveTextContent("x");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /escrever a/ })); await Promise.resolve(); });
    expect(screen.getByTestId("le-a")).toHaveTextContent("x,nova");
    expect(screen.getByTestId("le-b")).toHaveTextContent("y");
    expect(store.escritas).toEqual(["a"]);
  });
});
