/**
 * "Reativar desafios semanais" saiu de Conquistas (27/09): a linha tracejada
 * "Desafios semanais estão desligados · Ligar de novo" fica no Painel de
 * Finanças, no lugar do card — e o toast do ocultar aponta pra lá.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState, type ReactNode } from "react";

const toasts = vi.hoisted(() => [] as string[]);
vi.mock("sonner", () => {
  const toast = ((m: string) => { toasts.push(m); }) as unknown as { (m: string): void; success: (m: string) => void; error: (m: string) => void };
  toast.success = (m: string) => { toasts.push(`ok:${m}`); };
  toast.error = (m: string) => { toasts.push(`erro:${m}`); };
  return { toast };
});
vi.mock("@/lib/analytics", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/analytics")>()), trackEvent: () => {} }));

import { UserDataContext } from "@/hooks/use-user-data";
import { WeeklyChallenge } from "@/components/challenges/WeeklyChallenge";

function montarStore(inicial: Record<string, unknown>) {
  const dados: Record<string, unknown> = { ...inicial };
  let ouvinte: (() => void) | null = null;
  const valor = () => ({
    get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f),
    set: (k: string, v: unknown) => { dados[k] = v; ouvinte?.(); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  });
  return { dados, valor, ouvir: (fn: () => void) => { ouvinte = fn; } };
}
const Provedor = ({ store, children }: { store: ReturnType<typeof montarStore>; children: ReactNode }) => {
  const [, setN] = useState(0);
  store.ouvir(() => setN((n) => n + 1));
  return <UserDataContext.Provider value={{ ...store.valor() }}>{children}</UserDataContext.Provider>;
};

beforeEach(() => { toasts.length = 0; });

describe("desafios semanais: desligar e ligar de novo no Painel", () => {
  it("ocultar avisa que religa no Painel e deixa a linha tracejada no lugar do card", () => {
    const store = montarStore({});
    render(<Provedor store={store}><WeeklyChallenge expenses={[]} /></Provedor>);
    expect(screen.getByText("DESAFIO DA SEMANA")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar desafios" }));
    expect(store.dados["finance-challenges-hidden"]).toBe(true);
    expect(toasts).toContain("Desafios ocultos. Reative quando quiser aqui no Painel.");
    const linha = screen.getByTestId("desafios-desligados");
    expect(linha).toHaveTextContent("Desafios semanais estão desligados");
    expect(screen.queryByText("DESAFIO DA SEMANA")).toBeNull();
  });

  it("'Ligar de novo' traz o card de volta na hora", () => {
    const store = montarStore({ "finance-challenges-hidden": true });
    render(<Provedor store={store}><WeeklyChallenge expenses={[]} /></Provedor>);
    fireEvent.click(screen.getByRole("button", { name: "Ligar de novo" }));
    expect(store.dados["finance-challenges-hidden"]).toBe(false);
    expect(screen.getByText("DESAFIO DA SEMANA")).toBeInTheDocument();
    expect(screen.queryByTestId("desafios-desligados")).toBeNull();
    expect(toasts.some((t) => t.startsWith("ok:"))).toBe(true);
  });
});
