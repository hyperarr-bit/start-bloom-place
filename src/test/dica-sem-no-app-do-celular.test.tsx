/**
 * "NO APP DO CELULAR" DENTRO DO APP (17/10, revisão tela a tela #86): o cartão "DICAS PRA COMEÇAR" da
 * Beleza dizia, DENTRO do app nativo, "No app do celular, ligue o lembrete da manhã e da noite…" — ali a
 * frase soa errada (a pessoa já está no app). No app a dica vira só o que fazer; no site continua como
 * está (lá ela explica onde o aviso toca). Mesma regra pras outras dicas com a frase: Relações (Dicas para
 * começar), Pet ("O que vem pronto") e a linha do aviso de validade em MEUS PRODUTOS (que só existe no app).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }), Toaster: () => null }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
// o cliente do Supabase aponta pra PRODUÇÃO: nenhum evento sai daqui
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getUser: async () => ({ data: { user: null } }) },
    storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })) }) },
  },
}));

import Beleza from "@/pages/Beleza";
import Relacionamentos from "@/pages/Relacionamentos";
import Pet from "@/pages/Pet";
import { ProductShelf } from "@/components/beleza/ProductShelf";
import { CHAVE_FORCA_INTRO } from "@/lib/intro-modulo";

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
afterEach(() => { cleanup(); localStorage.clear(); delete (window as { Capacitor?: unknown }).Capacitor; });

/** O app da loja (o runtime do Capacitor injeta o global; lib/native-shell lê dele). */
const noApp = () => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
/** No site o "Dicas pra começar" só aparece com a intro (no app ela já nasce ligada): a força de QA liga. */
const noSiteComDicas = () => { localStorage.setItem(CHAVE_FORCA_INTRO, "on"); };

const abrir = (ui: ReactNode, rota: string, inicial: Record<string, unknown> = {}) => {
  const Provider = ({ children }: { children: ReactNode }) => {
    const [estado, setEstado] = useState<Record<string, unknown>>(() => ({ ...inicial }));
    const set = useCallback((k: string, v: unknown) => setEstado((p) => ({ ...p, [k]: v })), []);
    const valor = useMemo<UserDataContextType>(() => ({
      get: <T,>(k: string, f: T) => (k in estado ? (estado[k] as T) : f),
      set, loaded: true, isGuest: false, fetchKey: async () => null,
    }), [estado, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  return render(<MemoryRouter initialEntries={[rota]}><Provider>{ui}</Provider></MemoryRouter>);
};
const texto = () => document.body.textContent ?? "";

describe("Beleza: 'DICAS PRA COMEÇAR' (o print #86)", () => {
  it("no app: 'Ligue o lembrete da manhã e da noite — ele diz o passo do dia', sem 'No app do celular'", () => {
    noApp();
    abrir(<Beleza />, "/beleza");
    expect(screen.getByText("Ligue o lembrete da manhã e da noite — ele diz o passo do dia")).toBeInTheDocument();
    expect(texto()).not.toMatch(/no app do celular/i);
  });

  it("no site continua como está: 'No app do celular, ligue o lembrete…'", () => {
    noSiteComDicas();
    abrir(<Beleza />, "/beleza");
    expect(screen.getByText("No app do celular, ligue o lembrete da manhã e da noite — ele diz o passo do dia")).toBeInTheDocument();
  });
});

describe("as outras dicas com a frase", () => {
  it("Relações ('Dicas para começar'): no app 'Ligue os avisos: …'; no site 'No app do celular, ligue os avisos: …'", () => {
    noApp();
    abrir(<Relacionamentos />, "/relacionamentos");
    expect(screen.getByText("Ligue os avisos: na véspera, no dia e o “faz tempo que…”")).toBeInTheDocument();
    expect(texto()).not.toMatch(/no app do celular/i);
    cleanup();
    delete (window as { Capacitor?: unknown }).Capacitor;
    noSiteComDicas();
    abrir(<Relacionamentos />, "/relacionamentos");
    expect(screen.getByText("No app do celular, ligue os avisos: na véspera, no dia e o “faz tempo que…”")).toBeInTheDocument();
  });

  it("Pet ('O que vem pronto' da 1ª vez): no app o aviso começa por 'Da vacina…'; no site, 'No app do celular: da vacina…'", () => {
    noApp();
    abrir(<Pet />, "/pet");
    expect(screen.getByText("Da vacina, do vermífugo e do remédio. Nasce desligado — você liga se quiser.")).toBeInTheDocument();
    expect(texto()).not.toMatch(/no app do celular/i);
    cleanup();
    delete (window as { Capacitor?: unknown }).Capacitor;
    abrir(<Pet />, "/pet");
    expect(screen.getByText("No app do celular: da vacina, do vermífugo e do remédio. Nasce desligado — você liga se quiser.")).toBeInTheDocument();
  });

  it("MEUS PRODUTOS: a linha do aviso de validade (só existe no app) diz só a hora", () => {
    noApp();
    abrir(<ProductShelf />, "/beleza");
    expect(screen.getByTestId("lembrete-validade").textContent).toMatch(/às \d{1,2}(:\d{2}|h)/);
    expect(screen.getByTestId("lembrete-validade").textContent).not.toMatch(/no app do celular/i);
  });
});
