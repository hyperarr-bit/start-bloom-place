/**
 * Chamado do iPhone 1.0.9 (07/10): "A água eu já mudei para 1 litro por vez,
 * que é minha quantidade da garrafa. E não muda aí no início" — a ação rápida
 * da Home dizia "+ 200ml Água" cravado, fosse qual fosse o copo escolhido em
 * Saúde (`core-saude-copo-ml`). O toque já somava a porção certa; só o texto
 * mentia.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { QuickActions } from "@/components/home/QuickActions";
import { localDayKey } from "@/lib/utils";
import { normalizarCopoMl, rotuloAcaoAgua, rotuloMl } from "@/lib/saude-copo";
import { toast } from "sonner";

vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => true, plataformaApp: () => "ios" }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "uid-1" }, session: null, loading: false, isSubscribed: true, subLoaded: true }) }));

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
const renderCom = (store = criarStore()) => {
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}><QuickActions /></UserDataContext.Provider></MemoryRouter>);
  return store;
};

describe("ação rápida de água usa o copo/garrafa configurado em Saúde", () => {
  it("garrafa de 1 litro: o botão diz '+ 1L Água' e cada toque soma 1 porção (1000ml no toast)", () => {
    const store = renderCom(criarStore({ "core-saude-copo-ml": 1000 }));
    const botao = screen.getByRole("button", { name: /1L Água/ });
    expect(botao).toBeInTheDocument();
    expect(screen.queryByText(/200ml/)).toBeNull();
    fireEvent.click(botao);
    const hoje = localDayKey();
    expect((store.dados["core-saude-water"] as Record<string, number>)[hoje]).toBe(1);
    expect((store.dados["water-log"] as Record<string, number>)[hoje]).toBe(1);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("1000ml"));
  });

  it("sem configurar nada: o botão diz o padrão real de Saúde (250ml), não 200", () => {
    renderCom();
    expect(screen.getByRole("button", { name: /\+ 250ml Água/ })).toBeInTheDocument();
  });

  it("copo de 500ml salvo como texto (app antigo): continua lendo certo", () => {
    renderCom(criarStore({ "core-saude-copo-ml": "500" }));
    expect(screen.getByRole("button", { name: /\+ 500ml Água/ })).toBeInTheDocument();
  });

  it("regra do copo: faixa 50–2000, padrão 250, rótulo em L a partir de 1000", () => {
    expect(normalizarCopoMl(undefined)).toBe(250);
    expect(normalizarCopoMl("abc")).toBe(250);
    expect(normalizarCopoMl(10)).toBe(50);
    expect(normalizarCopoMl(9999)).toBe(2000);
    expect(rotuloMl(200)).toBe("200ml");
    expect(rotuloMl(1000)).toBe("1L");
    expect(rotuloMl(1500)).toBe("1,5L");
    expect(rotuloAcaoAgua(750)).toBe("+ 750ml Água");
  });
});
