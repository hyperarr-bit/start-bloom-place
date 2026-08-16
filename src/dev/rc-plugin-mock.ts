/**
 * MOCK do @revenuecat/purchases-capacitor — SÓ pro APK de TESTE do emulador.
 *
 * Existe porque o caminho do pagante era invalidável sem aparelho real: no
 * emulador o RevenueCat de verdade não tem catálogo (sem Google logado) e o
 * paywall inteiro morre em "indisponível" — cancelamento, downsell, compra e
 * cadastro-pós-compra ficavam sem teste até alguém pagar de verdade. Este
 * arquivo simula a loja com controle total via `window.__rcModo`:
 *
 *   "compra"   (padrão) → purchaseStoreProduct resolve na hora
 *   "cancela"  → lança { code: "1" } (pessoa fechou a folha do Google)
 *   "pendente" → lança { code: "20" } (escolheu Pix na folha, PAYMENT_PENDING)
 *
 * As compras simuladas persistem em localStorage — matar o app e reabrir
 * mantém a "compra no aparelho", que é exatamente o que o boot-check do
 * cadastro-pós-compra precisa enxergar.
 *
 * NUNCA entra no binário da loja: o alias do vite só liga com RC_MOCK=1, que
 * só o `npm run loja -- --teste` seta — e o build de produção ABORTA se a
 * flag estiver presente (trava no preparar-loja.mjs).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const CHAVE = "__rc_mock_compras";

const compras = (): string[] => {
  try { return JSON.parse(localStorage.getItem(CHAVE) || "[]"); } catch { return []; }
};
const gravarCompra = (id: string) => {
  try { localStorage.setItem(CHAVE, JSON.stringify([...compras(), id])); } catch { /* noop */ }
};

const modo = (): string => (window as any).__rcModo || "compra";

// v53: o mock separa compra ÚNICA (vitalício) de ASSINATURA — o boot-check
// do cadastro pós-compra olha nonSubscriptionTransactions pro vitalício e
// activeSubscriptions pras assinaturas (compraAssinaturaLocal).
const ehVitalicio = (id: string) => id.startsWith("core_vitalicio");
const info = () => ({
  customerInfo: {
    entitlements: { active: {} },
    nonSubscriptionTransactions: compras().filter(ehVitalicio).map((id) => ({ productIdentifier: id })),
    activeSubscriptions: compras().filter((id) => !ehVitalicio(id)),
  },
});

const PRECOS: Record<string, string> = {
  core_vitalicio: "R$ 27,90",
  core_vitalicio_19: "R$ 19,90",
  "core_anual:coreanual": "R$ 159,90",
  "core_mensal:coremensal": "R$ 24,90",
  "core_mensal:coremensalpix": "R$ 19,90",
};

export const PRODUCT_CATEGORY = { NON_SUBSCRIPTION: "NON_SUBSCRIPTION", SUBSCRIPTION: "SUBSCRIPTION" } as const;

export const Purchases: any = {
  async configure(_: any) {
    console.warn("[RC MOCK] loja simulada ativa — build de TESTE, nunca de loja");
  },
  async logIn(_: any) { return info(); },
  async logOut() { return info(); },
  async getOfferings() {
    // É AQUI que nasce o estado "sem_produto" do initRevenueCat (ele só chama
    // de "pronto" se existir pacote). Esvaziar só o getProducts não simulava
    // nada — o app seguia achando que tinha o que vender.
    if (modo() === "catalogo_vazio") return { current: { availablePackages: [] } };
    // v53: offering de assinatura ($rc_annual/$rc_monthly), como na loja real.
    return {
      current: {
        availablePackages: [
          { identifier: "$rc_annual", product: { identifier: "core_anual:coreanual", priceString: PRECOS["core_anual:coreanual"] } },
          { identifier: "$rc_monthly", product: { identifier: "core_mensal:coremensal", priceString: PRECOS["core_mensal:coremensal"] } },
        ],
      },
    };
  },
  async getProducts({ productIdentifiers }: { productIdentifiers: string[] }) {
    // 13/08: catálogo vazio é um estado REAL (build velha, Play fora do ar) e
    // tem tela própria ("As compras estão chegando"). Sem simular, o único
    // caminho em que a pré-folha ainda aparece ficava sem teste.
    if (modo() === "catalogo_vazio") return { products: [] };
    return {
      products: productIdentifiers.map((id) => ({
        identifier: id,
        priceString: PRECOS[id] ?? "R$ 0,00",
        title: "CORE vitalício (mock)",
      })),
    };
  },
  async purchaseStoreProduct({ product }: { product: { identifier: string } }) {
    const m = modo();
    if (m === "cancela") throw { code: "1", message: "Purchase was cancelled. (mock)" };
    if (m === "pendente") throw { code: "20", message: "PAYMENT_PENDING_ERROR (mock)" };
    gravarCompra(product.identifier);
    return info();
  },
  async purchasePackage({ aPackage }: { aPackage?: { product?: { identifier?: string } } } = {}) {
    const m = modo();
    if (m === "cancela") throw { code: "1", message: "Purchase was cancelled. (mock)" };
    if (m === "pendente") throw { code: "20", message: "PAYMENT_PENDING_ERROR (mock)" };
    gravarCompra(aPackage?.product?.identifier ?? "core_anual:coreanual");
    return info();
  },
  async getCustomerInfo() { return info(); },
  async restorePurchases() { return info(); },
};
