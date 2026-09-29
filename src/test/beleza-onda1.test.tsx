/**
 * BELEZA — ONDA 1 do "módulo completo" (28/09, decisões do dono): abas SKINCARE ·
 * CABELO · MEUS PRODUTOS · CUIDADOS. Cada teste monta a peça real e confere o DADO
 * gravado (formato das chaves de conta real), não só a tela.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock, Toaster: () => null }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...real, trackEvent: () => {}, trackEventBeacon: () => {}, markActivation: async () => {} };
});
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));
vi.mock("@/lib/image-upload", () => ({ uploadFromInput: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getUser: async () => ({ data: { user: null } }) },
    storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })) }) },
  },
}));

import Beleza from "@/pages/Beleza";

beforeAll(() => {
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
    Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverStub });
    Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ResizeObserverStub });
  }
});
beforeEach(() => { toastMock.mockClear(); toastMock.error.mockClear(); toastMock.success.mockClear(); });
afterEach(() => { vi.useRealTimers(); });

const HOJE = localDayKey();

/** Store reativo: gravar re-renderiza (a Beleza lê as chaves direto do store). */
const criarStoreReativo = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = JSON.parse(JSON.stringify(inicial));
  const Provider = ({ children }: { children: ReactNode }) => {
    const [estado, setEstado] = useState<Record<string, unknown>>(() => ({ ...dados }));
    const set = useCallback((chave: string, valor: unknown) => {
      dados[chave] = valor;
      setEstado((p) => ({ ...p, [chave]: valor }));
    }, []);
    const valor = useMemo<UserDataContextType>(() => ({
      get: <T,>(k: string, f: T) => (k in estado ? (estado[k] as T) : f),
      set, loaded: true, isGuest: true, fetchKey: async () => null,
    }), [estado, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  const montar = (ui: ReactNode, rota = "/beleza") => render(<MemoryRouter initialEntries={[rota]}><Provider>{ui}</Provider></MemoryRouter>);
  return { dados, montar };
};

/* ═════════════════════════════ ABAS ═════════════════════════════ */

describe("Abas: ROTINA virou SKINCARE e o DIÁRIO virou 'Fotos da pele'", () => {
  const comFoto = {
    "skincare-diary": [
      { id: "d1", date: HOJE, skinStatus: "boa", mood: "😊", notes: "Pele calma depois do retinol", photoUrl: "https://x/foto-1.webp" },
      { id: "d2", date: "2026-09-01", skinStatus: "acne", mood: "😐", notes: "Espinha no queixo", photoUrl: "https://x/foto-2.webp" },
    ],
  };

  it("não existe mais aba ROTINA nem DIÁRIO; as fotos de quem já tinha aparecem em SKINCARE, mesma chave", () => {
    const store = criarStoreReativo(comFoto);
    store.montar(<Beleza />);
    expect(screen.getByRole("button", { name: /SKINCARE/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^✨\s*ROTINA$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /DIÁRIO/ })).not.toBeInTheDocument();
    const fotos = screen.getByTestId("fotos-da-pele");
    expect(within(fotos).getByRole("heading", { name: /FOTOS DA PELE/ })).toBeInTheDocument();
    expect(within(fotos).getByText("Pele calma depois do retinol")).toBeInTheDocument();
    expect(within(fotos).getByText("Espinha no queixo")).toBeInTheDocument();
    expect(within(fotos).getByText(/2 registros • 2 fotos/)).toBeInTheDocument();
    // abrir não grava nada
    expect(store.dados["skincare-diary"]).toEqual(comFoto["skincare-diary"]);
  });

  it("o link antigo (?aba=diario) abre SKINCARE com as fotos; ?aba=produtos abre MEUS PRODUTOS", () => {
    const a = criarStoreReativo(comFoto);
    const t = a.montar(<Beleza />, "/beleza?aba=diario");
    expect(screen.getByRole("button", { name: /SKINCARE/ }).className).toMatch(/notion-tab-active/);
    expect(screen.getByTestId("fotos-da-pele")).toBeInTheDocument();
    t.unmount();
    criarStoreReativo({}).montar(<Beleza />, "/beleza?aba=produtos");
    expect(screen.getByRole("button", { name: /MEUS PRODUTOS/ }).className).toMatch(/notion-tab-active/);
    expect(screen.queryByTestId("fotos-da-pele")).not.toBeInTheDocument();
  });
});
