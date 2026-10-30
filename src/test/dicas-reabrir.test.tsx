/**
 * "Dicas para começar" fechado NÃO volta ao reabrir o app (auditoria 28/10). O cartão lia a marca
 * `core-tip-seen-*` uma vez só, na montagem — reabrir direto no módulo montava antes da conta chegar
 * (`get` devolve o padrão até `loaded`) e o cartão fechado voltava. Agora espera a conta e relê a marca.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const estado: { loaded: boolean; store: Record<string, unknown> } = { loaded: false, store: {} };
const set = vi.fn((k: string, v: unknown) => { estado.store[k] = v; });
vi.mock("@/hooks/use-user-data", () => ({
  useUserData: () => ({ loaded: estado.loaded, set, get: <T,>(k: string, f: T): T => (estado.loaded && k in estado.store ? (estado.store[k] as T) : f) }),
}));
vi.mock("@/lib/demo-do-funil", () => ({ useDemoDoFunil: () => false }));

import { ModuleTip } from "@/components/ModuleTip";
import { DicasDaBeleza } from "@/components/beleza/kit";

beforeEach(() => { estado.loaded = false; estado.store = {}; set.mockClear(); });

describe("dicas: fechar e reabrir", () => {
  it("ModuleTip: montado antes da conta chegar, com a marca gravada, não aparece quando a conta chega", () => {
    const { rerender } = render(<ModuleTip moduleId="casa" tips={["a"]} />);
    expect(screen.queryByText("Dicas para começar")).toBeNull(); // conta ainda não chegou: nada
    estado.store["core-tip-seen-casa"] = "true";
    estado.loaded = true;
    rerender(<ModuleTip moduleId="casa" tips={["a"]} />);
    expect(screen.queryByText("Dicas para começar")).toBeNull();
  });
  it("ModuleTip: conta nova vê; fechar grava a marca e some", () => {
    estado.loaded = true;
    render(<ModuleTip moduleId="casa" tips={["a"]} />);
    expect(screen.getByText("Dicas para começar")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Fechar dicas"));
    expect(set).toHaveBeenCalledWith("core-tip-seen-casa", "true");
  });
  it("DicasDaBeleza: mesma regra", () => {
    const { rerender } = render(<DicasDaBeleza dicas={["a"]} />);
    expect(screen.queryByTestId("dicas-beleza")).toBeNull();
    estado.store["core-tip-seen-beleza"] = "true";
    estado.loaded = true;
    rerender(<DicasDaBeleza dicas={["a"]} />);
    expect(screen.queryByTestId("dicas-beleza")).toBeNull();
    estado.store = {};
    rerender(<DicasDaBeleza dicas={["a"]} />);
    expect(screen.getByTestId("dicas-beleza")).toBeTruthy();
  });
});
