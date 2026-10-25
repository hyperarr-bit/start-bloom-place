/**
 * 26/10 (dono, iPhone): o rodapé da aba Você mostrava "CORE 1.0.133 (134)" — a versão do ANDROID — no iPhone.
 * Agora é `versaoVisivel()` (lib/versao-visivel): no iPhone a do project.pbxproj (__APP_VERSION_IOS__), como no
 * "Meu acesso"; Android/web, a do build.gradle. Nas duas versões da aba (a de hoje e a da Home nova).
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), trackEvent: vi.fn() }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => true, plataformaApp: () => "ios", isIOS: () => true, isAndroid: () => false }));
const auth = vi.hoisted(() => ({
  user: { id: "u1", email: "fulana@exemplo.com.br", created_at: "2026-08-01T12:00:00Z", user_metadata: {} },
  session: null, loading: false, isSubscribed: true, subLoaded: true, signOut: () => {},
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth, AuthProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/lib/admin", () => ({ checkIsAdmin: vi.fn(async () => false) }));
vi.mock("@/integrations/supabase/client", () => {
  const q: Record<string, unknown> = {};
  Object.assign(q, {
    select: () => q, eq: () => q, in: () => q, order: () => q, range: () => q, limit: () => q, gte: () => q, lte: () => q, neq: () => q, is: () => q,
    maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
    insert: async () => ({ data: null, error: null }), upsert: async () => ({ data: null, error: null }),
    update: () => q, delete: () => q, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r),
  });
  return {
    supabase: {
      from: () => q, rpc: async () => ({ data: null, error: null }), functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
      auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }), removeChannel: vi.fn(),
    },
  };
});

import Voce from "@/pages/Voce";
import { CHAVE_FORCA_HOME_NOVA, _zerarHomeNova } from "@/lib/home-nova";
import { _zerarConsultaAdmin } from "@/hooks/use-home-nova";
import { criarNuvem, prepararJsdom } from "./compat-comum";

const g = globalThis as unknown as { __APP_VERSION__?: string; __APP_VERSION_IOS__?: string };
const montar = async () => {
  const n = criarNuvem({ "core-user-name": "João Victor", "core-onboarding-done": "true" });
  render(<MemoryRouter initialEntries={["/voce"]}><n.Provedor><Voce /></n.Provedor></MemoryRouter>);
  await act(() => new Promise((r) => setTimeout(r, 30)));
};

beforeAll(() => { prepararJsdom(); Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo; });
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); _zerarHomeNova(); _zerarConsultaAdmin(); g.__APP_VERSION__ = "1.0.133 (134)"; g.__APP_VERSION_IOS__ = "1.0.19 (46)"; });
afterEach(() => { cleanup(); delete g.__APP_VERSION__; delete g.__APP_VERSION_IOS__; });

describe("o rodapé da aba Você no iPhone", () => {
  it("aba de hoje (chave off): a versão do iOS, não a do Android", async () => {
    await montar();
    await waitFor(() => expect(screen.getByText(/CORE 1\.0\.19 \(46\)/)).toBeTruthy());
    expect(screen.queryByText(/1\.0\.133/)).toBeNull();
  });
  it("aba da Home nova (chave on): idem", async () => {
    localStorage.setItem(CHAVE_FORCA_HOME_NOVA, "on");
    await montar();
    await waitFor(() => expect(screen.getByTestId("tela-voce").getAttribute("data-layout")).toBe("e"));
    expect(screen.getByText(/CORE 1\.0\.19 \(46\)/)).toBeTruthy();
    expect(screen.queryByText(/1\.0\.133/)).toBeNull();
  });
});
