/**
 * 11/11 (velocidade 1.0.26): a capa lisa do TrackedModule (fb9dea5e) é só pra espera curta da conta.
 * Sem internet a conta não chega (`loaded` fica false) e a capa deixava a tela BRANCA pra sempre.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

const estado = { loaded: false, semConexao: null as null | "sem" | "lenta" | "demorando" };
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => estado }));
vi.mock("@/hooks/use-module-tracker", async () => {
  const { createContext } = await import("react");
  return { useModuleTracker: () => () => {}, TabTrackContext: createContext<(t: string) => void>(() => {}) };
});
vi.mock("@/lib/medicao-cards", () => ({ instalarMedicaoDeCards: () => () => {} }));
vi.mock("@/lib/medicao-total", () => ({ anotarAba: () => {} }));

import { TrackedModule, CAPA_MS } from "@/components/TrackedModule";

const conteudo = () => render(<TrackedModule moduleId="financas"><p>tela do módulo</p></TrackedModule>);
const setOnline = (v: boolean) => Object.defineProperty(navigator, "onLine", { configurable: true, get: () => v });

describe("TrackedModule: capa lisa só na espera curta", () => {
  beforeEach(() => { estado.loaded = false; estado.semConexao = null; setOnline(true); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); setOnline(true); });

  it("conta chegando (com rede): capa, e o módulo monta quando a conta chega", () => {
    const r = conteudo();
    expect(screen.queryByText("tela do módulo")).toBeNull();
    expect(document.querySelector("[data-capa-modulo]")).not.toBeNull();
    estado.loaded = true;
    r.rerender(<TrackedModule moduleId="financas"><p>tela do módulo</p></TrackedModule>);
    expect(screen.getByText("tela do módulo")).toBeTruthy();
  });

  it("aparelho sem internet: nunca branco — mostra a tela normal na hora", () => {
    setOnline(false);
    conteudo();
    expect(screen.getByText("tela do módulo")).toBeTruthy();
    expect(document.querySelector("[data-capa-modulo]")).toBeNull();
  });

  it("leitura falhou (sem conexão / lenta / demorando): tela normal", () => {
    for (const s of ["sem", "lenta", "demorando"] as const) {
      estado.semConexao = s;
      const r = conteudo();
      expect(screen.getByText("tela do módulo")).toBeTruthy();
      r.unmount();
    }
  });

  it("conta demorando sem aviso ainda: a capa sai depois de CAPA_MS", () => {
    conteudo();
    expect(screen.queryByText("tela do módulo")).toBeNull();
    act(() => { vi.advanceTimersByTime(CAPA_MS); });
    expect(screen.getByText("tela do módulo")).toBeTruthy();
  });
});
