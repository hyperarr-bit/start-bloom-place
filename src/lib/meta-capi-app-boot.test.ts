/**
 * O boot do app grava os atributos de anúncio sem segurar a abertura.
 * Não chama setFBAnonymousID: isso é a integração nativa RevenueCat → Meta,
 * que fica desligada. O servidor lê $fbAnonId no webhook.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rc = vi.hoisted(() => ({
  collect: vi.fn(async () => {}),
  setAttributes: vi.fn(async (_: Record<string, string>) => {}),
  setFBAnonymousID: vi.fn(async () => {}),
  getAppUserID: vi.fn(async () => ({ appUserID: "$RCAnonymousID:abc.def_123" })),
  ids: { gaid: "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE", anonId: "XZ-anon-meta", idfv: "11111111-2222-3333-4444-555555555555" },
}));
vi.mock("@revenuecat/purchases-capacitor", () => ({
  PRODUCT_CATEGORY: { SUBSCRIPTION: "SUBSCRIPTION", NON_SUBSCRIPTION: "NON_SUBSCRIPTION" },
  Purchases: {
    configure: async () => {},
    logIn: async () => ({}),
    logOut: async () => ({}),
    syncPurchases: async () => {},
    getOfferings: async () => ({ current: { availablePackages: [{ product: { identifier: "core_mensal" } }] } }),
    getCustomerInfo: async () => ({ customerInfo: { entitlements: { active: {} } } }),
    collectDeviceIdentifiers: () => rc.collect(),
    setAttributes: (a: Record<string, string>) => rc.setAttributes(a),
    setFBAnonymousID: () => rc.setFBAnonymousID(),
    getAppUserID: () => rc.getAppUserID(),
  },
}));
vi.mock("@capacitor/core", () => ({
  registerPlugin: () => ({ idPublicidade: async () => rc.ids }),
}));
vi.mock("@capacitor/app", () => ({
  App: { getInfo: async () => ({ version: "1.0.13", build: "35", id: "br.com.coreaplicativo.app" }) },
}));
vi.mock("@/lib/analytics", () => ({
  trackEvent: () => {},
  trackEventBeacon: () => {},
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      getUser: async () => ({ data: { user: null } }),
    },
    functions: { invoke: async () => ({ data: null, error: null }) },
    from: () => ({ insert: async () => {} }),
  },
}));

beforeEach(() => {
  vi.resetModules();
  rc.collect.mockReset().mockResolvedValue(undefined);
  rc.setAttributes.mockReset().mockResolvedValue(undefined);
  rc.setFBAnonymousID.mockReset();
  rc.getAppUserID.mockReset().mockResolvedValue({ appUserID: "$RCAnonymousID:abc.def_123" });
  rc.ids = {
    gaid: "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE",
    anonId: "XZ-anon-meta",
    idfv: "11111111-2222-3333-4444-555555555555",
  };
  vi.stubEnv("VITE_REVENUECAT_IOS_KEY", "appl_teste");
  vi.stubEnv("VITE_REVENUECAT_ANDROID_KEY", "goog_teste");
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  sessionStorage.clear();
});

describe("RevenueCat recebe o anonymousID da Meta sem travar o boot", () => {
  it("collectDeviceIdentifiers ok: setAttributes só com $fbAnonId, e a abertura segue", async () => {
    const m = await import("@/lib/revenuecat");
    await expect(m.initRevenueCat()).resolves.toBe("pronto");
    await vi.waitFor(() => expect(rc.setAttributes).toHaveBeenCalled());
    expect(rc.collect).toHaveBeenCalled();
    expect(rc.setAttributes).toHaveBeenCalledWith({ $fbAnonId: "XZ-anon-meta" });
    expect(rc.setFBAnonymousID).not.toHaveBeenCalled();
  });

  it("collectDeviceIdentifiers ausente no plugin: o iPhone manda $idfv e $idfa na mão", async () => {
    rc.collect.mockRejectedValue(new Error("ponte velha"));
    const m = await import("@/lib/revenuecat");
    await expect(m.initRevenueCat()).resolves.toBe("pronto");
    await vi.waitFor(() => expect(rc.setAttributes).toHaveBeenCalled());
    expect(rc.setAttributes).toHaveBeenCalledWith({
      $fbAnonId: "XZ-anon-meta",
      $idfv: "11111111-2222-3333-4444-555555555555",
      $idfa: "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE",
    });
  });

  it("setAttributes que rejeita não derruba o init", async () => {
    rc.setAttributes.mockRejectedValue(new Error("rede"));
    const m = await import("@/lib/revenuecat");
    await expect(m.initRevenueCat()).resolves.toBe("pronto");
    await vi.waitFor(() => expect(rc.setAttributes).toHaveBeenCalled());
  });

  it("no Android o GAID não vira $idfa", async () => {
    (window as { Capacitor?: { getPlatform: () => string; isNativePlatform: () => boolean } }).Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "android",
    };
    rc.collect.mockRejectedValue(new Error("sem método"));
    const m = await import("@/lib/revenuecat");
    await m.initRevenueCat();
    await vi.waitFor(() => expect(rc.setAttributes).toHaveBeenCalled());
    expect(rc.setAttributes).toHaveBeenCalledWith({ $fbAnonId: "XZ-anon-meta" });
  });

  it("logIn manda de novo, pra conta não ficar sem o id que nasceu no anônimo", async () => {
    const m = await import("@/lib/revenuecat");
    await m.initRevenueCat();
    await vi.waitFor(() => expect(rc.setAttributes).toHaveBeenCalledTimes(1));
    await m.identificarRevenueCat("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    await vi.waitFor(() => expect(rc.setAttributes).toHaveBeenCalledTimes(2));
  });
});
