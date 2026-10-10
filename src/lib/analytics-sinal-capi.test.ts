/**
 * A ficha do aparelho avisa o servidor (app-capi-sinal) sem colocar IP no
 * corpo. O IP sai do header, do lado de lá.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const sinal = vi.hoisted(() => ({
  invoke: vi.fn(async (_nome: string, _opts: { body: Record<string, string> }) => ({ data: { ok: true }, error: null })),
}));
const rc = vi.hoisted(() => ({
  getAppUserID: vi.fn(async () => ({ appUserID: "$RCAnonymousID:abc.def_123" })),
}));

vi.mock("@capacitor/core", () => ({
  registerPlugin: () => ({
    idPublicidade: async () => ({ gaid: "G", anonId: "XZ", idfv: "V" }),
  }),
}));
vi.mock("@capacitor/app", () => ({
  App: { getInfo: async () => ({ version: "1.0.13", build: "35", id: "br.com.coreaplicativo.app" }) },
}));
vi.mock("@revenuecat/purchases-capacitor", () => ({
  Purchases: { getAppUserID: () => rc.getAppUserID() },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    functions: { invoke: (nome: string, opts: { body: Record<string, string> }) => sinal.invoke(nome, opts) },
    from: () => ({ insert: async () => {} }),
  },
}));

beforeEach(() => {
  sinal.invoke.mockClear();
  rc.getAppUserID.mockClear().mockResolvedValue({ appUserID: "$RCAnonymousID:abc.def_123" });
  sessionStorage.clear();
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
});

describe("capturarDispositivoApp chama app-capi-sinal", () => {
  it("no shell, o corpo tem sessão e o id do RevenueCat, e não tem IP", async () => {
    sessionStorage.setItem("core_session_id", "6f1e2d3c-4b5a-6978-90ab-cdef12345678");
    const { capturarDispositivoApp } = await import("@/lib/analytics");
    await capturarDispositivoApp();
    await vi.waitFor(() => expect(sinal.invoke).toHaveBeenCalled());
    const chamada = sinal.invoke.mock.calls[0];
    expect(chamada?.[0]).toBe("app-capi-sinal");
    const body = chamada?.[1]?.body;
    expect(body).toEqual({
      session_id: "6f1e2d3c-4b5a-6978-90ab-cdef12345678",
      rc_app_user_id: "$RCAnonymousID:abc.def_123",
    });
    expect(Object.keys(body ?? {}).some((k) => /ip|agent/i.test(k))).toBe(false);
    expect(JSON.stringify(body)).not.toContain("203.0.113");
  });

  it("fora do app, não chama a função", async () => {
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => false, getPlatform: () => "web" };
    const { capturarDispositivoApp } = await import("@/lib/analytics");
    await capturarDispositivoApp();
    await new Promise((r) => setTimeout(r, 30));
    expect(sinal.invoke).not.toHaveBeenCalled();
  });
});