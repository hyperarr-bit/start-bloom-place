import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

/* usePersistedState (varredura 26/09): o setter grava no store FORA do
 * updater do setState e continua acumulando atualizações em sequência. */
const gravados: [string, unknown][] = [];
vi.mock("@/hooks/use-user-data", () => {
  const api = {
    get: (_k: string, fallback: unknown) => fallback,
    set: (k: string, v: unknown) => { gravados.push([k, v]); },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { useUserData: () => api };
});

import { usePersistedState } from "@/hooks/use-persisted-state";

describe("usePersistedState", () => {
  it("duas atualizações funcionais seguidas somam e gravam o valor final", () => {
    const { result } = renderHook(() => usePersistedState<number>("contador-teste", 0));
    act(() => {
      result.current[1]((n) => n + 1);
      result.current[1]((n) => n + 1);
    });
    expect(result.current[0]).toBe(2);
    expect(gravados.filter(([k]) => k === "contador-teste").map(([, v]) => v)).toEqual([1, 2]);
  });

  it("não avisa 'Cannot update a component while rendering'", () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => usePersistedState<string[]>("lista-teste", []));
    act(() => result.current[1]((l) => [...l, "a"]));
    expect(result.current[0]).toEqual(["a"]);
    expect(erro.mock.calls.flat().join(" ")).not.toMatch(/Cannot update a component/);
    erro.mockRestore();
  });
});
