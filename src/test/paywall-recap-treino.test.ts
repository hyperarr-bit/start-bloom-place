import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * Resumo "o que você construiu" do paywall do app (26/09). O plano de treino
 * é um objeto por dia ({ SEGUNDA: { exercises: [...] } }), mas era lido como
 * lista — "Plano de treino montado" nunca aparecia pra quem montou o treino.
 */
let dados: Record<string, unknown> = {};
vi.mock("@/hooks/use-user-data", () => ({
  useUserData: () => ({
    get: (k: string, fallback: unknown) => (k in dados ? dados[k] : fallback),
    set: () => {},
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  }),
}));

import { useRecap } from "@/components/paywall/PaywallAssinatura";

describe("resumo do paywall: plano de treino", () => {
  beforeEach(() => { dados = {}; });

  it("plano com exercício em algum dia entra no resumo", () => {
    dados["saude-workouts-v2"] = { SEGUNDA: { exercises: [] }, QUARTA: { exercises: [{ name: "Agachamento" }] } };
    const { result } = renderHook(() => useRecap(null));
    expect(result.current).toContain("Plano de treino montado");
  });

  it("plano com os dias vazios não conta", () => {
    dados["saude-workouts-v2"] = { SEGUNDA: { exercises: [] }, QUARTA: {} };
    const { result } = renderHook(() => useRecap(null));
    expect(result.current).not.toContain("Plano de treino montado");
  });

  it("formato antigo em lista continua valendo", () => {
    dados["saude-workouts-v2"] = [{ name: "Treino A" }];
    const { result } = renderHook(() => useRecap(null));
    expect(result.current).toContain("Plano de treino montado");
  });

  it("sem nada construído cai na promessa do painel", () => {
    const { result } = renderHook(() => useRecap(null));
    expect(result.current).toEqual(["Seu painel te esperando do jeito que você deixou"]);
  });
});
