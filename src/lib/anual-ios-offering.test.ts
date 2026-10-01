/**
 * O ANUAL DO iPHONE VEM DA OFFERING ATUAL (01/10, teste de preço 97,90 × 69,90
 * via RevenueCat Experiments). O experimento troca a offering por pessoa; o app
 * pega o pacote anual dela (core_anual_97 ou core_anual_69), mostra o preço do
 * produto que a loja devolveu e compra PELO PACOTE (é o que amarra a compra ao
 * braço). Sem pacote anual na offering, cai no produto core_anual_97 de sempre.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Produto = { identifier: string; priceString: string; price: number; currencyCode: string; introPrice?: unknown };
const rc = vi.hoisted(() => ({
  offering: null as null | { identifier: string; availablePackages: Array<{ identifier: string; product: Produto }> },
  produtos: {} as Record<string, Produto>,
  purchasePackage: vi.fn(async (_: unknown) => ({ customerInfo: { entitlements: { active: { pro: { periodType: "TRIAL", expirationDateMillis: Date.now() + 3 * 86400e3 } } } } })),
  purchaseStoreProduct: vi.fn(async (_: unknown) => ({ customerInfo: { entitlements: { active: {} } } })),
  getProducts: vi.fn(async ({ productIdentifiers }: { productIdentifiers: string[] }) => ({ products: productIdentifiers.map((id) => rc.produtos[id]).filter(Boolean) })),
}));
vi.mock("@revenuecat/purchases-capacitor", () => ({
  PRODUCT_CATEGORY: { SUBSCRIPTION: "SUBSCRIPTION", NON_SUBSCRIPTION: "NON_SUBSCRIPTION" },
  Purchases: {
    configure: async () => {},
    logIn: async () => ({}),
    logOut: async () => ({}),
    syncPurchases: async () => {},
    getOfferings: async () => ({ current: rc.offering }),
    getProducts: (a: { productIdentifiers: string[] }) => rc.getProducts(a),
    checkTrialOrIntroductoryPriceEligibility: async ({ productIdentifiers }: { productIdentifiers: string[] }) =>
      Object.fromEntries(productIdentifiers.map((id) => [id, { status: 2 }])),
    purchasePackage: (a: unknown) => rc.purchasePackage(a),
    purchaseStoreProduct: (a: unknown) => rc.purchaseStoreProduct(a),
    getCustomerInfo: async () => ({ customerInfo: { entitlements: { active: {} } } }),
  },
}));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", () => ({
  trackEvent: (n: string, d: Record<string, unknown>) => { eventos.push([n, d]); },
  trackEventBeacon: (n: string, d: Record<string, unknown>) => { eventos.push([n, d]); },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) }, functions: { invoke: async () => ({ data: null, error: null }) } },
}));

const P97: Produto = { identifier: "core_anual_97", priceString: "R$ 97,90", price: 97.9, currencyCode: "BRL", introPrice: { price: 0, periodUnit: "DAY", periodNumberOfUnits: 3 } };
const P69: Produto = { identifier: "core_anual_69", priceString: "R$ 69,90", price: 69.9, currencyCode: "BRL", introPrice: { price: 0, periodUnit: "DAY", periodNumberOfUnits: 3 } };
const MENSAL: Produto = { identifier: "core_mensal", priceString: "R$ 24,90", price: 24.9, currencyCode: "BRL" };

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_REVENUECAT_IOS_KEY", "appl_teste");
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  rc.offering = null;
  rc.produtos = { core_anual_97: P97, core_anual_69: P69, core_mensal: MENSAL };
  rc.purchasePackage.mockClear(); rc.purchaseStoreProduct.mockClear(); rc.getProducts.mockClear();
  eventos.length = 0;
});
afterEach(() => {
  vi.unstubAllEnvs();
  delete (window as { Capacitor?: unknown }).Capacitor;
});

const carregar = async () => {
  const m = await import("@/lib/revenuecat");
  await m.initRevenueCat();
  await m.prefetchAnualIos();
  return m;
};

describe("prefetchAnualIos — o pacote anual da offering atual", () => {
  it("braço B: offering 'anual_69' com o pacote anual = core_anual_69 → preço 69,90, por mês 5,83, oferta anual_69", async () => {
    rc.offering = { identifier: "anual_69", availablePackages: [{ identifier: "$rc_monthly", product: MENSAL }, { identifier: "$rc_annual", product: P69 }] };
    const m = await carregar();
    expect(m.temAnualIos()).toBe(true);
    expect(m.idProdutoAnualIos()).toBe("core_anual_69");
    expect(m.ofertaAnualIos()).toBe("anual_69");
    expect(m.precoAnualIos()).toBe("R$ 69,90");
    expect(m.precoMensalDoAnualIos()).toBe("R$ 5,83");
    expect(m.diasTrialIos()).toBe(3);
    expect(m.dadosDaOfertaIos()).toEqual({ oferta: "anual_69", produto: "core_anual_69", offering: "anual_69", preco: "R$ 69,90", pacote: true });
    expect(rc.getProducts).not.toHaveBeenCalled(); // não precisou da reserva
  });

  it("braço A: offering padrão com core_anual_97 → 97,90 / 8,16 / anual_97", async () => {
    rc.offering = { identifier: "default", availablePackages: [{ identifier: "$rc_annual", product: P97 }, { identifier: "$rc_monthly", product: MENSAL }] };
    const m = await carregar();
    expect(m.idProdutoAnualIos()).toBe("core_anual_97");
    expect(m.ofertaAnualIos()).toBe("anual_97");
    expect(m.precoAnualIos()).toBe("R$ 97,90");
    expect(m.precoMensalDoAnualIos()).toBe("R$ 8,16");
  });

  it("RESERVA: offering atual sem pacote anual (só o mensal) → core_anual_97 direto da loja, como antes", async () => {
    rc.offering = { identifier: "default", availablePackages: [{ identifier: "$rc_monthly", product: MENSAL }] };
    const m = await carregar();
    expect(rc.getProducts).toHaveBeenCalledWith(expect.objectContaining({ productIdentifiers: ["core_anual_97"] }));
    expect(m.idProdutoAnualIos()).toBe("core_anual_97");
    expect(m.precoAnualIos()).toBe("R$ 97,90");
    expect(m.dadosDaOfertaIos()).toMatchObject({ oferta: "anual_97", offering: null, pacote: false });
  });

  it("um pré-pago do Play dentro da offering (core_anual:coreanual97) NÃO é confundido com o anual da App Store", async () => {
    rc.offering = { identifier: "default", availablePackages: [{ identifier: "$rc_annual", product: { ...P97, identifier: "core_anual:coreanual97" } }] };
    const m = await carregar();
    expect(m.idProdutoAnualIos()).toBe("core_anual_97"); // veio da reserva (getProducts)
    expect(rc.getProducts).toHaveBeenCalled();
  });

  it("sem produto em lugar nenhum: temAnualIos false, preço null (a tela mostra um traço, nunca 97,90 inventado)", async () => {
    rc.offering = { identifier: "default", availablePackages: [{ identifier: "$rc_monthly", product: MENSAL }] };
    rc.produtos = { core_mensal: MENSAL };
    const m = await carregar();
    expect(m.temAnualIos()).toBe(false);
    expect(m.precoAnualIos()).toBeNull();
    expect(m.precoMensalDoAnualIos()).toBeNull();
    expect(m.idProdutoAnualIos()).toBe("core_anual_97"); // o que a reserva tentaria comprar
  });
});

describe("comprarAnualIos — pelo pacote quando veio da offering", () => {
  it("braço B: compra PELO PACOTE (purchasePackage) e o app_compra_opcao leva oferta/offering/preço", async () => {
    rc.offering = { identifier: "anual_69", availablePackages: [{ identifier: "$rc_annual", product: P69 }] };
    const m = await carregar();
    expect(await m.comprarAnualIos()).toBe(true);
    expect(rc.purchasePackage).toHaveBeenCalledTimes(1);
    expect((rc.purchasePackage.mock.calls[0][0] as { aPackage: { product: Produto } }).aPackage.product.identifier).toBe("core_anual_69");
    expect(rc.purchaseStoreProduct).not.toHaveBeenCalled();
    const opcao = eventos.find((e) => e[0] === "app_compra_opcao")?.[1];
    expect(opcao).toMatchObject({ produto: "core_anual_69", oferta: "anual_69", offering: "anual_69", preco: "R$ 69,90", pacote: true, trial: true });
    expect(m.ultimaCompraAnualFoiTrial()).toBe(true);
    expect(m.fimDaUltimaCompraTrial()).toBeGreaterThan(Date.now());
  });

  it("reserva: sem pacote na offering, compra pelo PRODUTO core_anual_97 (purchaseStoreProduct)", async () => {
    rc.offering = { identifier: "default", availablePackages: [{ identifier: "$rc_monthly", product: MENSAL }] };
    const m = await carregar();
    expect(await m.comprarAnualIos()).toBe(true);
    expect(rc.purchaseStoreProduct).toHaveBeenCalledTimes(1);
    expect((rc.purchaseStoreProduct.mock.calls[0][0] as { product: Produto }).product.identifier).toBe("core_anual_97");
    expect(rc.purchasePackage).not.toHaveBeenCalled();
    expect(eventos.find((e) => e[0] === "app_compra_opcao")?.[1]).toMatchObject({ produto: "core_anual_97", oferta: "anual_97", pacote: false });
  });

  it("a pessoa fechou a folha: motivo 'cancelou' com o produto do braço", async () => {
    rc.offering = { identifier: "anual_69", availablePackages: [{ identifier: "$rc_annual", product: P69 }] };
    rc.purchasePackage.mockRejectedValueOnce({ code: "1", message: "cancelled" });
    const m = await carregar();
    expect(await m.comprarAnualIos()).toBe(false);
    expect(m.motivoUltimaCompra()).toBe("cancelou");
    expect(eventos.find((e) => e[0] === "app_compra_falhou" || e[0] === "app_compra_cancelada")?.[1]).toMatchObject({ produto: "core_anual_69" });
  });
});
