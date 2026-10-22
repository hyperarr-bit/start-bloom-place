/**
 * `folha_apple_resultado` (10/10, 1.0.14): um evento por folha da Apple, com o
 * desfecho (sucesso | cancelou | erro), o tempo desde o toque e se foi a
 * segunda chance. Nasce no revenuecat.ts, sem mexer em paywall nenhum.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Produto = { identifier: string; priceString: string; price: number; currencyCode: string; introPrice?: unknown };
const rc = vi.hoisted(() => ({
  offering: null as null | { identifier: string; availablePackages: Array<{ identifier: string; product: Produto }> },
  produtos: {} as Record<string, Produto>,
  purchasePackage: vi.fn(async (_: unknown): Promise<unknown> => ({ customerInfo: { entitlements: { active: { pro: { periodType: "TRIAL", expirationDateMillis: Date.now() + 3 * 86400e3 } } } } })),
  purchaseStoreProduct: vi.fn(async (_: unknown): Promise<unknown> => ({ customerInfo: { entitlements: { active: {} } } })),
  setAttributes: vi.fn(async (_: unknown) => {}),
}));
vi.mock("@revenuecat/purchases-capacitor", () => ({
  PRODUCT_CATEGORY: { SUBSCRIPTION: "SUBSCRIPTION", NON_SUBSCRIPTION: "NON_SUBSCRIPTION" },
  Purchases: {
    configure: async () => {},
    logIn: async () => ({}),
    logOut: async () => ({}),
    syncPurchases: async () => {},
    setAttributes: (a: unknown) => rc.setAttributes(a),
    getOfferings: async () => ({ current: rc.offering }),
    getProducts: async ({ productIdentifiers }: { productIdentifiers: string[] }) => ({ products: productIdentifiers.map((id) => rc.produtos[id]).filter(Boolean) }),
    checkTrialOrIntroductoryPriceEligibility: async ({ productIdentifiers }: { productIdentifiers: string[] }) =>
      Object.fromEntries(productIdentifiers.map((id) => [id, { status: 2 }])),
    purchasePackage: (a: unknown) => rc.purchasePackage(a),
    purchaseStoreProduct: (a: unknown) => rc.purchaseStoreProduct(a),
    getCustomerInfo: async () => ({ customerInfo: { entitlements: { active: {} } } }),
  },
}));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>, "evento" | "beacon"]>);
vi.mock("@/lib/analytics", () => ({
  trackEvent: (n: string, d: Record<string, unknown>) => { eventos.push([n, d, "evento"]); },
  trackEventBeacon: (n: string, d: Record<string, unknown>) => { eventos.push([n, d, "beacon"]); },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) }, functions: { invoke: async () => ({ data: null, error: null }) } },
}));

const P97: Produto = { identifier: "core_anual_97", priceString: "R$ 97,90", price: 97.9, currencyCode: "BRL", introPrice: { price: 0, periodUnit: "DAY", periodNumberOfUnits: 3 } };
const folhas = () => eventos.filter((e) => e[0] === "folha_apple_resultado").map((e) => e[1]);
/** 1.0.18: por onde cada folha saiu — o sucesso vai por beacon (o gate recarrega o app logo depois da compra) */
const canais = () => eventos.filter((e) => e[0] === "folha_apple_resultado").map((e) => e[2]);

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.stubEnv("VITE_REVENUECAT_IOS_KEY", "appl_teste");
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  rc.offering = { identifier: "default", availablePackages: [{ identifier: "$rc_annual", product: P97 }] };
  rc.produtos = { core_anual_97: P97 };
  rc.purchasePackage.mockClear(); rc.purchaseStoreProduct.mockClear(); rc.setAttributes.mockClear();
  eventos.length = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-10T15:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  delete (window as { Capacitor?: unknown }).Capacitor;
});

const carregar = async () => {
  const m = await import("@/lib/revenuecat");
  await m.initRevenueCat();
  await m.prefetchAnualIos();
  return m;
};

describe("folha_apple_resultado", () => {
  it("sucesso: um evento, com ms desde o toque que o paywall marcou e segunda_chance false", async () => {
    const m = await carregar();
    m.marcarToqueDeCompra(Date.now() - 4200);
    rc.purchasePackage.mockImplementationOnce(async () => { vi.setSystemTime(new Date("2026-10-10T15:00:06Z")); return { customerInfo: { entitlements: { active: {} } } }; });
    expect(await m.comprarAnualIos()).toBe(true);
    expect(folhas()).toEqual([{ resultado: "sucesso", produto: "core_anual_97", ms_desde_toque: 10200, segunda_chance: false }]);
    expect(canais()).toEqual(["beacon"]); // 1.0.18: sobrevive à recarga do gate
  });

  it("cancelou e tentou de novo: 'cancelou' e depois 'sucesso' com segunda_chance true", async () => {
    const m = await carregar();
    rc.purchasePackage.mockRejectedValueOnce({ code: "1", message: "Purchase was cancelled." });
    expect(await m.comprarAnualIos()).toBe(false);
    expect(folhas()).toEqual([expect.objectContaining({ resultado: "cancelou", produto: "core_anual_97", segunda_chance: false })]);
    vi.setSystemTime(new Date("2026-10-10T15:02:00Z"));
    expect(await m.comprarAnualIos()).toBe(true);
    expect(folhas()[1]).toMatchObject({ resultado: "sucesso", segunda_chance: true });
    expect(canais()).toEqual(["evento", "beacon"]); // cancelou segue pelo trackEvent de sempre; o sucesso por beacon
  });

  it("erro da loja: 'erro'; falhou ANTES de abrir a folha (catálogo vazio): nenhum folha_apple_resultado", async () => {
    const m = await carregar();
    rc.purchasePackage.mockRejectedValueOnce({ code: "2", message: "Store problem" });
    expect(await m.comprarAnualIos()).toBe(false);
    expect(folhas()).toEqual([expect.objectContaining({ resultado: "erro" })]);
    eventos.length = 0;
    rc.offering = null; rc.produtos = {};
    vi.resetModules();
    const m2 = await import("@/lib/revenuecat");
    await m2.initRevenueCat();
    expect(await m2.comprarAnualIos()).toBe(false);
    expect(folhas()).toEqual([]);
  });

  it("segunda chance expira: falha há mais de 15 min não marca a próxima", async () => {
    const m = await carregar();
    rc.purchasePackage.mockRejectedValueOnce({ code: "1", message: "cancelled" });
    await m.comprarAnualIos();
    vi.setSystemTime(new Date("2026-10-10T15:20:00Z"));
    await m.comprarAnualIos();
    expect(folhas()[1]).toMatchObject({ resultado: "sucesso", segunda_chance: false });
  });

  it("no Android a folha do Google não gera o evento da Apple", async () => {
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "android" };
    vi.stubEnv("VITE_REVENUECAT_ANDROID_KEY", "goog_teste");
    const m = await import("@/lib/revenuecat");
    await m.initRevenueCat();
    rc.produtos = { core_vitalicio: { identifier: "core_vitalicio", priceString: "R$ 27,90", price: 27.9, currencyCode: "BRL" } };
    await m.comprarVitalicio("core_vitalicio");
    expect(folhas()).toEqual([]);
  });
});

describe("atributos no RevenueCat", () => {
  it("logo depois do configure: core_turma e core_device_id (e nada de $fbAnonId)", async () => {
    await carregar();
    await Promise.resolve();
    expect(rc.setAttributes).toHaveBeenCalledTimes(1);
    const attrs = rc.setAttributes.mock.calls[0][0] as Record<string, string>;
    expect(attrs.core_turma).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(attrs.core_device_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(Object.keys(attrs)).toEqual(["core_turma", "core_device_id"]);
  });
});
