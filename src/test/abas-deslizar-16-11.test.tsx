/**
 * 16/11 (App Store 4★ de 06/11, "Fluidez baixa: o deslizar da tela mexe ícones que não deveriam").
 *
 * A fileira de abas dos módulos entra no modo de editar (abas balançando, com ×) quando a pessoa SEGURA uma aba por
 * 500 ms. Deslizar a fileira pro lado (ou a página) começando em cima de uma aba é rolagem nativa no iPhone e o touchmove
 * nem sempre chega ao botão: o tempo seguia correndo e as abas "mexiam" no meio do deslizar. Trava: rolagem e
 * touchcancel desarmam o segurar; segurar parado continua entrando no modo de editar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import { useState, type ReactNode } from "react";

vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: () => Promise.resolve(),
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { useAbasOcultas, type AbaOcultavel } from "@/hooks/use-abas-ocultas";
import { AbasOcultaveis } from "@/components/ui/abas-ocultaveis";
import { _zerarTodasAsAbas } from "@/lib/abas-ocultas";
import { _zerarHomeNova } from "@/lib/home-nova";

const ABAS: AbaOcultavel[] = [
  { id: "dashboard", label: "DASHBOARD", icon: "📊" },
  { id: "financeiro", label: "MEU FINANCEIRO", icon: "💰" },
  { id: "investimentos", label: "INVESTIMENTOS", icon: "📈" },
];

const store: UserDataContextType = {
  get: <T,>(_k: string, fallback: T) => fallback,
  set: () => {},
  loaded: true, isGuest: false, fetchKey: async () => null,
};
const Com = ({ children }: { children: ReactNode }) => <UserDataContext.Provider value={store}>{children}</UserDataContext.Provider>;
const Pagina = () => {
  const [ativa, setAtiva] = useState("financeiro");
  const abas = useAbasOcultas("financas", ABAS);
  return <AbasOcultaveis abas={abas} ativa={ativa} onTrocar={setAtiva} />;
};
const balancando = () => document.querySelectorAll(".animate-jiggle").length;
const aba = () => document.querySelector<HTMLElement>('[data-spotlight="tab-dashboard"]')!;

beforeEach(() => {
  localStorage.clear();
  _zerarTodasAsAbas(); _zerarHomeNova();
  vi.useFakeTimers();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("fileira de abas: deslizar não entra no modo de editar", () => {
  it("segurar PARADO 500 ms continua entrando no modo de editar", () => {
    render(<Com><Pagina /></Com>);
    fireEvent.touchStart(aba(), { touches: [{ clientX: 10, clientY: 10 }] });
    act(() => { vi.advanceTimersByTime(600); });
    expect(balancando()).toBeGreaterThan(0);
  });

  it("deslizar a fileira (rolagem nativa, sem touchmove) NÃO entra no modo de editar", () => {
    render(<Com><Pagina /></Com>);
    fireEvent.touchStart(aba(), { touches: [{ clientX: 10, clientY: 10 }] });
    act(() => { vi.advanceTimersByTime(100); });
    // o iPhone rola a faixa das abas: chega só o scroll do contêiner (não borbulha; a captura no window pega)
    const faixa = aba().closest(".overflow-x-auto") ?? document.body;
    fireEvent.scroll(faixa);
    act(() => { vi.advanceTimersByTime(800); });
    expect(balancando()).toBe(0);
  });

  it("rolar a página também desarma", () => {
    render(<Com><Pagina /></Com>);
    fireEvent.touchStart(aba(), { touches: [{ clientX: 10, clientY: 10 }] });
    fireEvent.scroll(window);
    act(() => { vi.advanceTimersByTime(800); });
    expect(balancando()).toBe(0);
  });

  it("o sistema cancelar o toque (touchcancel) desarma", () => {
    render(<Com><Pagina /></Com>);
    fireEvent.touchStart(aba(), { touches: [{ clientX: 10, clientY: 10 }] });
    fireEvent.touchCancel(aba());
    act(() => { vi.advanceTimersByTime(800); });
    expect(balancando()).toBe(0);
  });
});
