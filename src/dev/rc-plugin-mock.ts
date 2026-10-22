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
 *   1.0.18 — os ERROS DA LOJA do iPhone (paywall com retentativa automática + caixa "Tentar de novo"):
 *   "erro-loja"     → { code: "2" } "There was a problem with the App Store." (sempre)
 *   "erro-rede"     → { code: "10" } "Error performing request." (sempre)
 *   "bloqueado"     → { code: "3" } "The device or user is not allowed to make the purchase."
 *   "erro-loja-Nx" / "erro-rede-Nx" → as N primeiras folhas desta abertura falham (code 2 / 10) e a seguinte compra:
 *                     1x = a retentativa automática resolve; 2x = aparece a caixa e o "Tentar de novo" compra
 *   O modo também pode vir de `localStorage.__rc_mock_modo` (o QA de aparelho grava com o app parado).
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
  try {
    localStorage.setItem(CHAVE, JSON.stringify([...compras(), id]));
    // 10/10 (lib/rc-mock): o use-auth do build de TESTE lê isto como assinatura — o servidor
    // nunca recebe webhook do RevenueCat no Simulador, e sem a marca a pessoa caía no gate.
    localStorage.setItem("__rc_mock_assinante", "1");
    localStorage.setItem("__rc_mock_produto", id);
    if (!localStorage.getItem("__rc_mock_compra_em")) localStorage.setItem("__rc_mock_compra_em", String(Date.now()));
  } catch { /* noop */ }
};
// 10/10: o entitlement da compra simulada, como o RevenueCat devolveria — TRIAL de 3 dias no
// anual do iPhone (oferta introdutória), NORMAL no resto. É o que conferirTrialCartao,
// anotarTrialDaCompra, compraNaLojaSemConta e reconciliarSePreciso leem.
const entitlementDaCompra = () => {
  const ids = compras();
  const id = ids[ids.length - 1];
  if (!id || ehVitalicio(id)) return {};
  let compraEm = Date.now();
  try { compraEm = Number(localStorage.getItem("__rc_mock_compra_em")) || compraEm; } catch { /* noop */ }
  const trial = /^core_anual(_\d+)?$/.test(id);
  const fim = compraEm + (trial ? 3 : /^core_anual/.test(id) ? 365 : 30) * 86_400_000;
  return {
    pro: {
      identifier: "pro", isActive: true, willRenew: true, periodType: trial ? "TRIAL" : "NORMAL",
      productIdentifier: id, store: "APP_STORE", latestPurchaseDateMillis: compraEm, expirationDateMillis: fim,
      originalPurchaseDateMillis: compraEm, billingIssueDetectedAt: null, unsubscribeDetectedAt: null,
    },
  };
};

const modo = (): string => {
  if ((window as any).__rcModo) return (window as any).__rcModo;
  try { return localStorage.getItem("__rc_mock_modo") || "compra"; } catch { return "compra"; }
};
let falhas = 0;
/** os erros da loja simulados (1.0.18); o "erro-loja-Nx" falha só nas N primeiras folhas desta abertura do app */
const erroDaLojaSimulado = (m: string): void => {
  if (m === "cancela") throw { code: "1", message: "Purchase was cancelled. (mock)" };
  if (m === "pendente") throw { code: "20", message: "PAYMENT_PENDING_ERROR (mock)" };
  if (m === "erro-loja") throw { code: "2", message: "There was a problem with the App Store. (mock)" };
  if (m === "erro-rede") throw { code: "10", message: "Error performing request. (mock)" };
  if (m === "bloqueado") throw { code: "3", message: "The device or user is not allowed to make the purchase. (mock)" };
  const n = /^erro-(loja|rede)-(\d+)x$/.exec(m);
  if (n && falhas < Number(n[2])) {
    falhas += 1;
    throw n[1] === "rede"
      ? { code: "10", message: `Error performing request. (mock ${falhas}/${n[2]})` }
      : { code: "2", message: `There was a problem with the App Store. (mock ${falhas}/${n[2]})` };
  }
};

// v53: o mock separa compra ÚNICA (vitalício) de ASSINATURA — o boot-check
// do cadastro pós-compra olha nonSubscriptionTransactions pro vitalício e
// activeSubscriptions pras assinaturas (compraAssinaturaLocal).
const ehVitalicio = (id: string) => id.startsWith("core_vitalicio");
// 07/10: `localStorage.__rc_mock_customer` (JSON) substitui o customerInfo inteiro — é como se
// ensaia cartão recusado (billingIssueDetectedAt), teste cancelado (unsubscribeDetectedAt) e
// acesso perdido (entitlement em `all` sem nada em `active`) sem aparelho nem conta real.
const info = () => {
  try {
    const forcado = JSON.parse(localStorage.getItem("__rc_mock_customer") || "null");
    if (forcado) return { customerInfo: forcado };
  } catch { /* noop */ }
  const ent = entitlementDaCompra();
  return {
    customerInfo: {
      entitlements: { active: ent, all: ent },
      nonSubscriptionTransactions: compras().filter(ehVitalicio).map((id) => ({ productIdentifier: id })),
      activeSubscriptions: compras().filter((id) => !ehVitalicio(id)),
    },
  };
};

// 20/09: preços do iPhone entram no mock (anual com 3 dias grátis) e podem ser
// trocados por `localStorage.__rc_mock_precos` (JSON id→priceString) pra
// ensaiar outra vitrine da App Store — ex.: "$14.99" na storefront dos EUA.
const PRECOS_BASE: Record<string, string> = {
  core_anual_97: "R$ 97,90",
  core_anual_69: "R$ 69,90", // 01/10: braço B do teste de preço do iPhone
  core_mensal: "R$ 24,90",
  core_mensal_19: "R$ 19,90", // 10/10: mensal de saída (offering mensal_19), produto a criar pelo dono
  core_vitalicio_97: "R$ 97,90",
  core_vitalicio: "R$ 27,90",
  core_vitalicio_19: "R$ 19,90",
  "core_anual:coreanual": "R$ 159,90",
  "core_mensal:coremensal": "R$ 24,90",
  "core_mensal:coremensalpix": "R$ 19,90",
};
const PRECOS: Record<string, string> = new Proxy(PRECOS_BASE, {
  get(alvo, id: string) {
    try {
      const extra = JSON.parse(localStorage.getItem("__rc_mock_precos") || "{}");
      if (typeof extra[id] === "string") return extra[id];
    } catch { /* noop */ }
    return alvo[id];
  },
});
// Oferta introdutória só no anual do iPhone (3 dias grátis), como na App Store.
const INTRO: Record<string, unknown> = {
  core_anual_97: { price: 0, priceString: "R$ 0,00", period: "P3D", periodUnit: "DAY", periodNumberOfUnits: 3, cycles: 1 },
  core_anual_69: { price: 0, priceString: "R$ 0,00", period: "P3D", periodUnit: "DAY", periodNumberOfUnits: 3, cycles: 1 },
};
// 17/10: `localStorage.__rc_mock_intro_dias` = "7" ensaia outra duração do teste grátis (o paywall lê da loja).
const introDe = (id: string): Record<string, unknown> | undefined => {
  const base = INTRO[id] as Record<string, unknown> | undefined;
  if (!base) return undefined;
  let dias = 0;
  try { dias = Number(localStorage.getItem("__rc_mock_intro_dias")) || 0; } catch { /* noop */ }
  return dias > 0 ? { ...base, period: `P${dias}D`, periodNumberOfUnits: dias } : base;
};
// 01/10: no iPhone a offering ATUAL decide o braço do teste de preço. `localStorage.__rc_mock_offering`
// = "anual_69" ensaia o braço B (produto core_anual_69); o padrão é "default" (core_anual_97).
const produtoMock = (id: string) => ({ identifier: id, priceString: PRECOS[id] ?? "R$ 0,00", ...VALOR(PRECOS[id] ?? "R$ 0,00"), title: `CORE ${id} (mock)`, ...(introDe(id) ? { introPrice: introDe(id) } : {}) });
const ehIos = () => { try { return (window as any).Capacitor?.getPlatform?.() === "ios"; } catch { return false; } };
const offeringIos = () => {
  let nome = "default";
  try { nome = localStorage.getItem("__rc_mock_offering") || "default"; } catch { /* noop */ }
  const anual = nome === "anual_69" ? "core_anual_69" : "core_anual_97";
  return { identifier: nome, availablePackages: [
    { identifier: "$rc_annual", packageType: "ANNUAL", product: produtoMock(anual) },
    { identifier: "$rc_monthly", packageType: "MONTHLY", product: produtoMock("core_mensal") },
  ] };
};

export const PRODUCT_CATEGORY = { NON_SUBSCRIPTION: "NON_SUBSCRIPTION", SUBSCRIPTION: "SUBSCRIPTION" } as const;

// valor numérico + moeda a partir da string ("R$ 97,90" → 97.9 BRL; "$14.99" → 14.99 USD)
const VALOR = (s: string): { price: number; currencyCode: string } => {
  const n = Number(s.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) || 0;
  const currencyCode = /^R\$/.test(s) ? "BRL" : /^(US)?\$/.test(s) ? "USD" : /^€/.test(s) ? "EUR" : "BRL";
  return { price: n, currencyCode };
};

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
    if (ehIos()) {
      // 07/10: `all` com a offering do presente (anual_69 = core_anual_69), como no painel;
      // `localStorage.__rc_mock_presente_off` = "1" ensaia o metadata `presente: "off"`.
      let off = false;
      try { off = localStorage.getItem("__rc_mock_presente_off") === "1"; } catch { /* noop */ }
      // 10/10: as chaves remotas das ofertas de saída (ofertas-saida.ts) — `localStorage.__rc_mock_metadata`
      // (JSON) vira o metadata da offering ATUAL, como se fosse o painel do RevenueCat.
      let metadata: Record<string, unknown> = {};
      try { metadata = JSON.parse(localStorage.getItem("__rc_mock_metadata") || "{}"); } catch { /* noop */ }
      const atual = { ...offeringIos(), metadata };
      const anual69 = {
        identifier: "anual_69", metadata: off ? { presente: "off" } : {},
        availablePackages: [
          { identifier: "$rc_annual", packageType: "ANNUAL", product: produtoMock("core_anual_69") },
          { identifier: "$rc_monthly", packageType: "MONTHLY", product: produtoMock("core_mensal") },
        ],
      };
      // 10/10: a offering `mensal_19` (core_mensal_19 em $rc_monthly). `__rc_mock_mensal19_off` = "1"
      // ensaia a offering AUSENTE no painel (a chave ligada não pode inventar oferta).
      let semMensal19 = false;
      try { semMensal19 = localStorage.getItem("__rc_mock_mensal19_off") === "1"; } catch { /* noop */ }
      const mensal19 = {
        identifier: "mensal_19", metadata: {},
        availablePackages: [
          { identifier: "$rc_monthly", packageType: "MONTHLY", product: produtoMock("core_mensal_19") },
        ],
      };
      return { current: atual, all: { [atual.identifier]: atual, anual_69: anual69, ...(semMensal19 ? {} : { mensal_19: mensal19 }) } };
    }
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
        ...VALOR(PRECOS[id] ?? "R$ 0,00"),
        title: `CORE ${id} (mock)`,
        ...(introDe(id) ? { introPrice: introDe(id) } : {}),
      })),
    };
  },
  async checkTrialOrIntroductoryPriceEligibility({ productIdentifiers }: { productIdentifiers: string[] }) {
    const r: Record<string, { status: number; description: string }> = {};
    // 07/10: `localStorage.__rc_mock_inelegivel` = "1" ensaia quem JÁ usou o teste no grupo (status 1)
    let inelegivel = false;
    try { inelegivel = localStorage.getItem("__rc_mock_inelegivel") === "1"; } catch { /* noop */ }
    for (const id of productIdentifiers) r[id] = { status: INTRO[id] ? (inelegivel ? 1 : 2) : 3, description: "mock" };
    return r;
  },
  async purchaseStoreProduct({ product }: { product: { identifier: string } }) {
    erroDaLojaSimulado(modo());
    gravarCompra(product.identifier);
    return info();
  },
  async purchasePackage({ aPackage }: { aPackage?: { product?: { identifier?: string } } } = {}) {
    erroDaLojaSimulado(modo());
    gravarCompra(aPackage?.product?.identifier ?? "core_anual:coreanual");
    return info();
  },
  async getCustomerInfo() { return info(); },
  async restorePurchases() { return info(); },
  // 10/10: o init chama syncPurchases no boot (01/09); sem o método o mock só gerava um aviso no console
  async syncPurchases() { return info(); },
};
