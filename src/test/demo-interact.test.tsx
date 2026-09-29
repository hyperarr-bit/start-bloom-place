/**
 * Medição do que a pessoa FAZ na demo (28/09): até aqui só a navegação da demo era medida,
 * então "mexeu × só olhou" não tinha resposta. Conta a gravação que vem logo depois de um
 * toque/tecla; a gravação automática da montagem (sync custo fixo → contas) não conta; cada
 * chave conta uma vez por demo aberta.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { useEffect } from "react";

const eventos = vi.hoisted(() => [] as { nome: string; dados: Record<string, unknown> }[]);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (nome: string, dados: Record<string, unknown>) => { eventos.push({ nome, dados }); },
}));

import { PreviewUserDataProvider } from "@/hooks/use-preview-user-data";
import { useUserData } from "@/hooks/use-user-data";

const Filho = () => {
  const { set } = useUserData();
  // gravação automática na montagem, sem gesto da pessoa (como o sync de custo fixo)
  useEffect(() => { set("finance-dueDays", []); }, [set]);
  return (
    <>
      <button onClick={() => set("finance-expenses", [{ id: 1, value: 12 }])}>gasto</button>
      <button onClick={() => set("habits", [{ id: 1 }])}>hábito</button>
    </>
  );
};

const demo = () => eventos.filter((e) => e.nome === "demo_interact");

beforeEach(() => { eventos.length = 0; });

describe("demo_interact — o que a pessoa faz na demo", () => {
  it("gravação automática da montagem não conta", () => {
    render(<PreviewUserDataProvider moduleKey="financas"><Filho /></PreviewUserDataProvider>);
    expect(demo()).toEqual([]);
  });

  it("gravação logo depois de um toque conta, com módulo e chave, uma vez por chave", () => {
    const { getByText } = render(<PreviewUserDataProvider moduleKey="financas"><Filho /></PreviewUserDataProvider>);
    const gasto = getByText("gasto");
    act(() => { fireEvent.pointerDown(gasto); fireEvent.click(gasto); });
    act(() => { fireEvent.pointerDown(gasto); fireEvent.click(gasto); }); // 2º gasto: mesma chave
    const habito = getByText("hábito");
    act(() => { fireEvent.pointerDown(habito); fireEvent.click(habito); });
    expect(demo().map((e) => e.dados)).toEqual([
      { modulo: "financas", chave: "finance-expenses" },
      { modulo: "financas", chave: "habits" },
    ]);
  });
});
