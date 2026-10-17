/**
 * A CHAVE DO PAYWALL MINIMALISTA (17/10) — `paywall_minimalista: "on" | "off"`, LIGADA por padrão.
 * Ordem: força de QA do aparelho (`?paywall-minimalista=`) > metadata do RevenueCat (a `current` vence) > constante.
 * A metadata viaja pelo helper ÚNICO das offerings (registrarChavesDasOfferings em revenuecat.ts): no init e no prefetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const rc = vi.hoisted(() => ({ metadata: {} as Record<string, unknown> }));
const P97 = { identifier: "core_anual_97", priceString: "R$ 97,90", price: 97.9, currencyCode: "BRL", introPrice: { price: 0, priceString: "R$ 0,00", periodUnit: "DAY", periodNumberOfUnits: 3 } };
const P69 = { identifier: "core_anual_69", priceString: "R$ 69,90", price: 69.9, currencyCode: "BRL", introPrice: { price: 0, priceString: "R$ 0,00", periodUnit: "DAY", periodNumberOfUnits: 3 } };
vi.mock("@revenuecat/purchases-capacitor", () => ({
  PRODUCT_CATEGORY: { SUBSCRIPTION: "SUBSCRIPTION", NON_SUBSCRIPTION: "NON_SUBSCRIPTION" },
  Purchases: {
    configure: async () => {},
    setAttributes: async () => {},
    logIn: async () => ({}),
    logOut: async () => ({}),
    syncPurchases: async () => {},
    getOfferings: async () => {
      const atual = { identifier: "default", metadata: rc.metadata, availablePackages: [{ identifier: "$rc_annual", product: P97 }] };
      const anual69 = { identifier: "anual_69", metadata: {}, availablePackages: [{ identifier: "$rc_annual", product: P69 }] };
      return { current: atual, all: { default: atual, anual_69: anual69 } };
    },
    getProducts: async () => ({ products: [] }),
    checkTrialOrIntroductoryPriceEligibility: async () => ({ core_anual_97: { status: 2 }, core_anual_69: { status: 2 } }),
    getCustomerInfo: async () => ({ customerInfo: { entitlements: { active: {} } } }),
  },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: () => {}, trackEventBeacon: () => {} }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) }, functions: { invoke: async () => ({ data: null, error: null }) } },
}));

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  rc.metadata = {};
  vi.stubEnv("VITE_REVENUECAT_IOS_KEY", "appl_teste");
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
});
afterEach(() => {
  vi.unstubAllEnvs();
  delete (window as { Capacitor?: unknown }).Capacitor;
});

describe("a chave paywall_minimalista", () => {
  it("nasce ligada; a metadata `off` desliga (a `current` vence as outras offerings; valor estranho não conta)", async () => {
    const m = await import("@/lib/paywall-minimalista");
    expect(m.PAYWALL_MINIMALISTA).toBe("on");
    expect(m.paywallMinimalistaLigado()).toBe(true);
    m.registrarChavePaywallMinimalista({ current: { metadata: { paywall_minimalista: "off" } }, all: {} });
    expect(m.paywallMinimalistaLigado()).toBe(false);
    expect(m.lerChaveRemotaMinimalista({ current: { metadata: {} }, all: { a: { metadata: { paywall_minimalista: "off" } } } })).toBe("off");
    expect(m.lerChaveRemotaMinimalista({ current: { metadata: { paywall_minimalista: "ON" } }, all: { a: { metadata: { paywall_minimalista: "off" } } } })).toBe("on");
    expect(m.lerChaveRemotaMinimalista({ current: { metadata: { paywall_minimalista: "talvez" } }, all: {} })).toBeNull();
    expect(m.lerChaveRemotaMinimalista(null)).toBeNull();
    m.registrarChavePaywallMinimalista({ current: { metadata: {} }, all: {} });
    expect(m.paywallMinimalistaLigado()).toBe(true); // sem a chave na metadata: a constante
  });

  it("força de QA do aparelho (`?paywall-minimalista=on|off|auto`) vence a metadata; `auto` apaga; chave sem prefixo varrido", async () => {
    const m = await import("@/lib/paywall-minimalista");
    m.registrarChavePaywallMinimalista({ current: { metadata: { paywall_minimalista: "off" } }, all: {} });
    m.guardarForcaDoMinimalista("?paywall-minimalista=on");
    expect(m.paywallMinimalistaLigado()).toBe(true);
    m.guardarForcaDoMinimalista("?outra=1"); // sem o parâmetro: não mexe
    expect(m.paywallMinimalistaLigado()).toBe(true);
    m.guardarForcaDoMinimalista("?paywall-minimalista=auto");
    expect(localStorage.getItem(m.CHAVE_FORCA_PAYWALL_MINIMALISTA)).toBeNull();
    expect(m.paywallMinimalistaLigado()).toBe(false);
    m._zerarRemotaMinimalista();
    m.guardarForcaDoMinimalista("?paywall-minimalista=off");
    expect(m.paywallMinimalistaLigado()).toBe(false);
    expect(m.CHAVE_FORCA_PAYWALL_MINIMALISTA.startsWith("core-")).toBe(false); // as vassouras do cache não levam
  });

  it("a metadata viaja pelo registrarChavesDasOfferings do revenuecat.ts — no init e no prefetch do anual", async () => {
    const [loja, chave] = await Promise.all([import("@/lib/revenuecat"), import("@/lib/paywall-minimalista")]);
    rc.metadata = { paywall_minimalista: "off" };
    expect(chave.paywallMinimalistaLigado()).toBe(true); // antes da loja: a constante
    await loja.initRevenueCat();
    expect(chave.paywallMinimalistaLigado()).toBe(false);
    rc.metadata = { paywall_minimalista: "on" };
    await loja.prefetchAnualIos();
    expect(chave.paywallMinimalistaLigado()).toBe(true);
    expect(loja.precoAnualIos()).toBe("R$ 97,90");
  });

  it("o presente 69,90 traz o preço da oferta introdutória da loja (a linha enxuta da explicação diz 'Hoje — R$ 0,00' com ele)", async () => {
    const loja = await import("@/lib/revenuecat");
    await loja.initRevenueCat();
    expect(await loja.carregarPresente69()).toMatchObject({ preco: "R$ 69,90", comTrial: true, dias: 3, precoTeste: "R$ 0,00" });
  });
});
