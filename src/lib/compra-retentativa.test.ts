/**
 * ERRO DA LOJA NA COMPRA, COM RETENTATIVA (1.0.18 — decepções 21/10, item 1). O que este arquivo trava:
 *   · o TIPO do erro (rede / loja / bloqueado / cancelou / outro) pelo código do RevenueCat e pela mensagem;
 *   · rede e loja: 1 retentativa automática 1,5 s depois, na mesma folha (um app_compra_retentativa, UM
 *     folha_apple_resultado); a 2ª vale — sucesso vira compra, falha vira app_compra_falhou com tipo + código;
 *   · bloqueado (código 3) e cancelou (código 1): nunca repetem;
 *   · codigoUltimaFalha / tipoUltimaFalha pro paywall mostrar a mensagem certa.
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
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", () => ({
  trackEvent: (n: string, d: Record<string, unknown>) => { eventos.push([n, d]); },
  trackEventBeacon: (n: string, d: Record<string, unknown>) => { eventos.push([n, d]); },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) }, functions: { invoke: async () => ({ data: null, error: null }) } },
}));

const P97: Produto = { identifier: "core_anual_97", priceString: "R$ 97,90", price: 97.9, currencyCode: "BRL", introPrice: { price: 0, periodUnit: "DAY", periodNumberOfUnits: 3 } };
const dos = (nome: string) => eventos.filter((e) => e[0] === nome).map((e) => e[1]);
const LOJA = { code: "2", message: "There was a problem with the App Store." };
const REDE = { code: "10", message: "A network error has occurred." };
const BLOQUEADO = { code: "3", message: "The device or user is not allowed to make the purchase." };
const CANCELOU = { code: "1", message: "Purchase was cancelled." };

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.stubEnv("VITE_REVENUECAT_IOS_KEY", "appl_teste");
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  rc.offering = { identifier: "default", availablePackages: [{ identifier: "$rc_annual", product: P97 }] };
  rc.produtos = { core_anual_97: P97 };
  rc.purchasePackage.mockClear(); rc.purchaseStoreProduct.mockClear();
  eventos.length = 0;
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(new Date("2026-10-21T15:00:00Z"));
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
/** a compra com o relógio andando pela retentativa */
const comprar = async (m: Awaited<ReturnType<typeof carregar>>) => {
  const p = m.comprarAnualIos();
  await vi.advanceTimersByTimeAsync(m.RETENTATIVA_DA_FOLHA_MS + 50);
  return p;
};

describe("o tipo do erro", () => {
  it("pelo código e pela mensagem; cancelou e bloqueado nunca são transitórios", async () => {
    const m = await import("@/lib/revenuecat");
    expect(m.tipoDoErroDaLoja(LOJA)).toBe("loja");
    expect(m.tipoDoErroDaLoja(REDE)).toBe("rede");
    expect(m.tipoDoErroDaLoja({ message: "Error performing request." })).toBe("rede");
    expect(m.tipoDoErroDaLoja(BLOQUEADO)).toBe("bloqueado");
    expect(m.tipoDoErroDaLoja(CANCELOU)).toBe("cancelou");
    expect(m.tipoDoErroDaLoja({ code: "5", message: "The product is not available for purchase." })).toBe("outro");
    expect(m.tipoDoErroDaLoja(new Error("boom"))).toBe("outro");
    expect([LOJA, REDE].map(m.erroTransitorioDaLoja)).toEqual([true, true]);
    expect([BLOQUEADO, CANCELOU, { code: "20", message: "pending" }].map(m.erroTransitorioDaLoja)).toEqual([false, false, false]);
  });
});

describe("a folha com retentativa", () => {
  it("loja falhou de passagem (código 2) e respondeu na 2ª: compra feita, 1 app_compra_retentativa, UM folha_apple_resultado (sucesso)", async () => {
    const m = await carregar();
    rc.purchasePackage.mockRejectedValueOnce(LOJA);
    expect(await comprar(m)).toBe(true);
    expect(rc.purchasePackage).toHaveBeenCalledTimes(2);
    expect(dos("app_compra_retentativa")).toEqual([expect.objectContaining({ produto: "core_anual_97", tipo: "loja", codigo: "2", erro: LOJA.message })]);
    expect(dos("folha_apple_resultado")).toEqual([expect.objectContaining({ resultado: "sucesso" })]);
    expect(dos("app_compra_falhou")).toEqual([]);
    expect(m.motivoUltimaCompra()).toBeNull();
  });

  it("falhou nas duas (rede): false, billing_erro, app_compra_falhou com tipo/código/transitorio, tipoUltimaFalha = rede; folha = erro, uma vez", async () => {
    const m = await carregar();
    rc.purchasePackage.mockRejectedValueOnce(REDE).mockRejectedValueOnce(REDE);
    expect(await comprar(m)).toBe(false);
    expect(rc.purchasePackage).toHaveBeenCalledTimes(2);
    expect(m.motivoUltimaCompra()).toBe("billing_erro");
    expect(m.tipoUltimaFalha()).toBe("rede");
    expect(m.codigoUltimaFalha()).toBe("10");
    expect(dos("app_compra_falhou")).toEqual([expect.objectContaining({ motivo: "billing_erro", tipo: "rede", codigo: "10", transitorio: true })]);
    expect(dos("folha_apple_resultado")).toEqual([expect.objectContaining({ resultado: "erro" })]);
  });

  it("a retentativa espera 1,5 s: antes disso a 2ª folha não abriu", async () => {
    const m = await carregar();
    rc.purchasePackage.mockRejectedValueOnce(LOJA);
    const p = m.comprarAnualIos();
    await vi.advanceTimersByTimeAsync(1000);
    expect(rc.purchasePackage).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600);
    expect(await p).toBe(true);
    expect(rc.purchasePackage).toHaveBeenCalledTimes(2);
  });

  it("bloqueado (código 3): sem retentativa, nao_permitido, tipo bloqueado; cancelou (código 1): sem retentativa, silencioso", async () => {
    const m = await carregar();
    rc.purchasePackage.mockRejectedValueOnce(BLOQUEADO);
    expect(await comprar(m)).toBe(false);
    expect(rc.purchasePackage).toHaveBeenCalledTimes(1);
    expect(m.motivoUltimaCompra()).toBe("nao_permitido");
    expect(m.tipoUltimaFalha()).toBe("bloqueado");
    expect(dos("app_compra_falhou")).toEqual([expect.objectContaining({ motivo: "nao_permitido", tipo: "bloqueado", codigo: "3" })]);
    expect(dos("app_compra_retentativa")).toEqual([]);

    eventos.length = 0; rc.purchasePackage.mockClear();
    rc.purchasePackage.mockRejectedValueOnce(CANCELOU);
    expect(await comprar(m)).toBe(false);
    expect(rc.purchasePackage).toHaveBeenCalledTimes(1);
    expect(m.motivoUltimaCompra()).toBe("cancelou");
    expect(m.tipoUltimaFalha()).toBe("cancelou");
    expect(dos("app_compra_retentativa")).toEqual([]);
    expect(dos("app_compra_falhou")).toEqual([expect.objectContaining({ motivo: "cancelou", tipo: "cancelou", transitorio: false })]);
  });
});
