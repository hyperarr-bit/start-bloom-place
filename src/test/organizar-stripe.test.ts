/**
 * /organizar no checkout Stripe (22/11, chave ORGANIZAR_STRIPE). Trava:
 *   1. o <head>: off = o /organizar de hoje (mesmos atributos e memória do <head> sem o bloco, em toda rota); on = data-pagina
 *      "organizar" + checkout-ext "stripe" + 2790, só na página atual do /organizar (nunca /oferta, /vida, /simples, /escolha, v2, "ano");
 *      ?orgstripe=on|off força (localStorage + cookie), auto desfaz; o sorteio de preço da /oferta nunca vale aqui;
 *   2. a página no jsdom com a chave on: R$ 27,90 em todo lugar (nenhum 67,90/97,90), Pix marcado, cartão à vista, sem CPF,
 *      "Gerar Pix de R$ 27,90"; pedido com pagina "organizar" e sem braço; eventos com pagina "organizar"; Purchase 27,90 com eventID = PI;
 *      Android: "Copiar código Pix" vira o botão principal + 3 passos (landing_pix_copiado com layout); iPhone: a tela de sempre;
 *      a carteira é só medida (landing_stripe_carteira), nada aparece; produção: PI que não volta 2790/organizar não paga.
 * O servidor (2790 só pra pagina "organizar"; webhook; /vendas separado) está em src/test/stripe-webhook.test.ts.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

const raiz = resolve(__dirname, "../..");
const HTML = readFileSync(resolve(raiz, "landing.html"), "utf8");
const cabeca = HTML.match(/<script>\s*(\(function \(\) \{\s*var LANDING_NOVA[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];
const comChave = (v: "on" | "off", precoAb: "on" | "off" = "off") => cabeca.replace(/var ORGANIZAR_STRIPE = "(on|off)"/, `var ORGANIZAR_STRIPE = "${v}"`).replace(/var AB_PRECO_OFERTA = "(on|off)"/, `var AB_PRECO_OFERTA = "${precoAb}"`);
const semOBloco = cabeca.replace(/\n {8}\/\/ 22\/11: o \/organizar no checkout Stripe \(ORGANIZAR_STRIPE\)\.[\s\S]*?\n {8}\}\n(?= {8}mem\.t = t;)/, "\n");

function rodar(fonte: string, url: string, store: Record<string, string> = {}, cookie = "") {
  const u = new URL(url, "https://www.coreaplicativo.com.br");
  const attrs: Record<string, string> = {};
  const location = { search: u.search, hash: u.hash, pathname: u.pathname, hostname: "www.coreaplicativo.com.br", protocol: "https:", replace: vi.fn() };
  const localStorage = { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; } };
  const ck = { v: cookie };
  const document = {
    documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } },
    createElement: () => ({ setAttribute: () => {} }), head: { appendChild: () => {} },
    get cookie() { return ck.v; },
    set cookie(s: string) { const [par] = s.split(";"); const [k, v] = par.split("="); const resto = ck.v.split("; ").filter((x) => x && !x.startsWith(`${k}=`)); ck.v = (/Max-Age=0/.test(s) ? resto : [...resto, `${k}=${v}`]).join("; "); },
  };
  const window: Record<string, unknown> = { localStorage, crypto: { randomUUID: () => randomUUID() } };
  new Function("location", "document", "window", "localStorage", "URLSearchParams", "Math", "fetch", "sessionStorage", fonte)(location, document, window, localStorage, URLSearchParams, Math, undefined, { getItem: () => null, setItem: () => {} });
  return { attrs, store, cookie: ck.v, mem: (window.__landing ?? {}) as Record<string, unknown> };
}

describe("o <head>", () => {
  it("no código: ORGANIZAR_STRIPE nasce off; o regex do 'antes' tirou o bloco", () => {
    expect(HTML).toMatch(/var ORGANIZAR_STRIPE = "off";/);
    expect(cabeca).toContain("landing_orgstripe_force");
    expect(semOBloco).not.toContain("landing_orgstripe_force");
  });
  it("chave off: em toda rota, os mesmos atributos e a mesma memória do <head> sem o bloco (o /organizar de hoje)", () => {
    for (const url of ["/organizar", "/organizar?utm_content=c7", "/organizar?lp=v2", "/organizar?oferta=ano", "/oferta", "/vida", "/simples", "/escolha", "/vitalicio", "/"]) {
      for (let i = 0; i < 20; i++) {
        const id = randomUUID();
        const a = rodar(comChave("off"), url, { "landing-device-id": id }), b = rodar(semOBloco, url, { "landing-device-id": id });
        expect(a.attrs).toEqual(b.attrs);
        expect(a.mem).toEqual(b.mem);
      }
    }
    const r = rodar(comChave("off"), "/organizar");
    expect(r.attrs["data-pagina"]).toBeUndefined();
    expect(r.attrs["data-checkout-ext"]).toBeUndefined();
  });
  it("chave on: /organizar vira pagina 'organizar' no Stripe a 2790 (sem braço de preço, nem com AB_PRECO_OFERTA on + ?preco=)", () => {
    const r = rodar(comChave("on", "on"), "/organizar?utm_content=c7&preco=4790", { "landing-device-id": randomUUID() });
    expect(r.attrs).toMatchObject({ "data-pagina": "organizar", "data-checkout-ext": "stripe", "data-lp": "atual", "data-oferta": "sempre" });
    expect(r.attrs["data-preco"]).toBeUndefined();
    expect(r.mem).toMatchObject({ pagina: "organizar", checkout_ext: "stripe", stripe_preco_centavos: 2790, org_stripe: "on", org_stripe_forcado: false, stripe_pede_cpf: false, stripe_parcelas_max: 1 });
    expect(r.mem.braco_preco).toBeUndefined();
    expect(String(r.mem.stripe_pk)).toMatch(/^pk_live_/);
  });
  it("chave on: nada fora da página atual do /organizar (/oferta, /vida, /simples, /tiktok, /escolha, v2 do AB_LP, oferta 'ano')", () => {
    for (const url of ["/oferta", "/vida", "/simples", "/tiktok", "/escolha", "/vitalicio", "/organizar?lp=v2", "/organizar?oferta=ano"]) {
      const r = rodar(comChave("on"), url, { "landing-device-id": randomUUID() });
      expect(r.mem.org_stripe).toBeUndefined();
      expect(r.attrs["data-pagina"]).not.toBe("organizar");
    }
  });
  it("?orgstripe=on força com a chave off (localStorage + cookie); ?orgstripe=off desliga com a chave on; auto desfaz", () => {
    const store: Record<string, string> = {};
    const r = rodar(comChave("off"), "/organizar?orgstripe=on", store);
    expect(r.mem).toMatchObject({ org_stripe: "on", org_stripe_forcado: true });
    expect(store["landing-orgstripe-force"]).toBe("on");
    expect(rodar(comChave("off"), "/organizar", {}, r.cookie).mem.org_stripe).toBe("on");
    expect(rodar(comChave("on"), "/organizar?orgstripe=off", {}).attrs["data-pagina"]).toBeUndefined();
    const d = rodar(comChave("off"), "/organizar?orgstripe=auto", store, r.cookie);
    expect(d.mem.org_stripe).toBeUndefined();
    expect(store["landing-orgstripe-force"]).toBeUndefined();
  });
});

/* ───────── a página no jsdom ───────── */
const corpoDe = (html: string) => html.match(/<body>([\s\S]*)<\/body>/)![1];
const corpo = corpoDe(HTML).replace(/<script type="module"[^>]*><\/script>/, "");
const estilo = HTML.match(/<style>([\s\S]*?)<\/style>/)![1];
const ESCONDE = [...estilo.matchAll(/([^{}]+)\{\s*display:\s*none\s*!important;\s*\}/g)].flatMap((m) => m[1].replace(/\/\*[\s\S]*?\*\//g, "").split(",").map((x) => x.trim()).filter(Boolean));
const escondido = (el: Element) => ESCONDE.some((sel) => { try { return el.matches(sel); } catch { return false; } });
function textoVisivel(el: Element): string {
  if (el.hasAttribute("hidden") || escondido(el) || getComputedStyle(el).display === "none" || el.tagName === "SCRIPT" || el.tagName === "STYLE") return "";
  let t = "";
  for (const n of el.childNodes) t += n.nodeType === Node.TEXT_NODE ? n.textContent : n.nodeType === Node.ELEMENT_NODE ? ` ${textoVisivel(n as Element)} ` : "";
  return t;
}
const nb = (s: string | null | undefined) => String(s ?? "").replace(/ /g, " ");
const semEspaco = (s: string) => nb(s).replace(/\s+/g, "");
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Ev = Record<string, unknown> & { nome: string };
const eventos = (): Ev[] => ((window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding ?? []);
const PK = "pk_test_EXEMPLO123";
const UA_ORIGINAL = navigator.userAgent;
const usarUa = (ua: string) => Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
let criadas: Array<Record<string, unknown>> = [];
let statusPago = false;
let fbq: ReturnType<typeof vi.fn>;
async function abrirPagina(o: { ua?: string } = {}) {
  await dormir(20);
  (await import("@/landing/stripe-checkout"))._zerar();
  vi.resetModules();
  localStorage.clear(); sessionStorage.clear();
  usarUa(o.ua ?? UA_ORIGINAL);
  window.history.replaceState(null, "", "/organizar?utm_content=c7&fbclid=abc");
  (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
  criadas = []; statusPago = false;
  fbq = vi.fn();
  (window as unknown as { fbq?: unknown }).fbq = fbq;
  (window as unknown as { __ofertaApi?: unknown }).__ofertaApi = {
    criar: async (c: Record<string, unknown>) => { criadas.push(c); return { ok: true, clientSecret: "pi_777_secret_abc", pi: "pi_777", amount: 2790, currency: "brl", pagina: "organizar" }; },
    status: async () => ({ ok: true, status: statusPago ? "succeeded" : "requires_action", pago: statusPago, metodo: statusPago ? "pix" : null }),
  };
  (window as unknown as { __stripeFalso?: unknown }).__stripeFalso = {
    elements: () => ({ create: () => ({ mount: (el: HTMLElement) => { el.innerHTML = '<div data-testid="pe-falso">PE</div>'; }, on: (e: string, cb: (x: unknown) => void) => { if (e === "ready") setTimeout(() => cb({}), 0); } }), submit: async () => ({}) }),
    createPaymentMethod: async () => ({ paymentMethod: { id: "pm_1" } }),
    paymentRequest: () => ({ canMakePayment: async () => ({ applePay: false, googlePay: true }) }),
    confirmPayment: async () => ({ paymentIntent: { id: "pi_777", status: "succeeded" } }),
    confirmPixPayment: async () => ({ paymentIntent: { id: "pi_777", status: "requires_action", next_action: { type: "pix_display_qr_code", pix_display_qr_code: { data: "00020126PIXSTRIPE2790", image_url_png: "https://qr.stripe.com/x.png", expires_at: Math.floor(Date.now() / 1000) + 1800 } } } }),
  };
  const d = document.documentElement;
  for (const a of ["data-pagina", "data-checkout-ext", "data-hm-sem-parcelas", "data-pix", "data-vida", "data-checkout-aberto", "data-oem", "data-otp", "data-preco", "data-lpo"]) d.removeAttribute(a);
  d.setAttribute("data-t", "a"); d.setAttribute("data-oferta", "sempre"); d.setAttribute("data-checkout", "email"); d.setAttribute("data-lp", "atual"); d.setAttribute("data-cko", "atual");
  d.setAttribute("data-pagina", "organizar"); d.setAttribute("data-checkout-ext", "stripe");
  (window as unknown as { __landing?: unknown }).__landing = { pagina: "organizar", checkout_ext: "stripe", stripe_pk: PK, stripe_preco_centavos: 2790, stripe_parcelas: "Pix ou cartão", stripe_parcelas_max: 1, stripe_pede_cpf: false, org_stripe: "on", org_stripe_forcado: false, ab_org_stripe: "on", lp: "atual", oferta: "sempre" };
  document.head.querySelectorAll("style[data-teste-st]").forEach((s) => s.remove());
  const st = document.createElement("style"); st.setAttribute("data-teste-st", ""); st.textContent = estilo; document.head.appendChild(st);
  document.body.removeAttribute("style");
  document.body.innerHTML = corpo;
  const m = await import("@/landing/stripe-checkout"); m._zerar();
  await import("@/landing/landing");
}
const pagar = () => document.getElementById("oc-pagar") as HTMLButtonElement;
async function abrirCheckout() {
  (document.getElementById("lp-hotmart-atual") as HTMLButtonElement).click();
  await vi.waitFor(() => { if (!document.querySelector('[data-testid="pe-falso"]') || pagar().hasAttribute("aria-disabled")) throw new Error("sem PE"); }, { timeout: 3000, interval: 20 });
}
async function gerarPix() {
  const campo = document.getElementById("oc-email") as HTMLInputElement;
  campo.value = "ana@exemplo.com"; campo.dispatchEvent(new Event("input"));
  pagar().click();
  await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pix"]')) throw new Error("sem pix"); }, { timeout: 3000, interval: 20 });
}
afterEach(() => { usarUa(UA_ORIGINAL); (window as unknown as { __ofertaApi?: unknown }).__ofertaApi = undefined; (window as unknown as { __stripeFalso?: unknown }).__stripeFalso = undefined; });
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

describe("o /organizar no Stripe (jsdom, chave on)", () => {
  it("R$ 27,90 em todo lugar (nenhum 67,90 nem 97,90); Pix marcado; cartão à vista sem CPF; pedido 'organizar' sem braço; eventos 'organizar'; Purchase 27,90 = PI", async () => {
    await abrirPagina({ ua: IPHONE });
    const pagina = textoVisivel(document.body);
    expect(pagina).not.toMatch(/67,90|97,90|47,90/);
    expect(semEspaco(pagina)).toContain(semEspaco("Pra sempre por R$ 27,90"));
    expect(fbq).toHaveBeenCalledWith("track", "ViewContent", expect.objectContaining({ value: 27.9 }));
    await abrirCheckout();
    const camada = () => document.querySelector<HTMLElement>("#oc")!;
    expect(nb(camada().textContent)).not.toMatch(/67,90|97,90/);
    expect(nb(camada().textContent)).toContain("R$ 27,90");
    expect(document.querySelector('[data-metodo="pix"]')!.getAttribute("aria-checked")).toBe("true");
    expect(nb(pagar().textContent)).toBe("Gerar Pix de R$ 27,90");
    expect(document.getElementById("oc-cpf")).toBeNull();
    expect(camada().textContent).not.toMatch(/em até \d+x/);
    (document.querySelector('[data-metodo="card"]') as HTMLButtonElement).click(); // cartão a 1 toque
    expect(nb(pagar().textContent)).toBe("Pagar R$ 27,90");
    (document.querySelector('[data-metodo="pix"]') as HTMLButtonElement).click();
    expect(criadas[0]).toMatchObject({ pagina: "organizar" });
    expect(criadas[0]).not.toHaveProperty("braco_preco");
    expect((criadas[0].atrib as Record<string, unknown>).indicador).toBeUndefined();
    expect(sessionStorage.getItem("organizar-stripe-ref")).toBe(criadas[0].ref); // o pedido do /organizar não se mistura com o da /oferta
    expect(sessionStorage.getItem("oferta-stripe-ref")).toBeNull();
    await gerarPix();
    expect(document.querySelector('[data-testid="oferta-pix"]')!.getAttribute("data-layout")).toBeNull(); // iPhone: a tela de sempre
    expect(nb(document.querySelector('[data-testid="oferta-pix"]')!.textContent)).toContain("R$ 27,90");
    statusPago = true;
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pago"]')) throw new Error("sem pago"); }, { timeout: 5000, interval: 50 });
    expect(fbq).toHaveBeenCalledWith("track", "Purchase", expect.objectContaining({ value: 27.9, currency: "BRL" }), { eventID: "pi_777" });
    const doLanding = eventos().filter((e) => e.nome.startsWith("landing_"));
    for (const nome of ["landing_html", "landing_cta", "landing_stripe_aberto", "landing_stripe_pix_gerado", "landing_stripe_pago"]) expect(doLanding.some((e) => e.nome === nome)).toBe(true);
    for (const e of doLanding) { expect(e).toMatchObject({ pagina: "organizar", braco_checkout_ext: "stripe" }); expect(e).not.toHaveProperty("braco_preco"); expect(e).not.toHaveProperty("braco_lp_oferta"); }
  });

  it("carteira: só medida (landing_stripe_carteira), nenhum botão de Apple/Google Pay aparece", async () => {
    await abrirPagina({ ua: ANDROID });
    await abrirCheckout();
    await vi.waitFor(() => { if (!eventos().some((e) => e.nome === "landing_stripe_carteira")) throw new Error("sem carteira"); }, { timeout: 3000, interval: 20 });
    expect(eventos().find((e) => e.nome === "landing_stripe_carteira")).toMatchObject({ google_pay: true, apple_pay: false, pagina: "organizar" });
    expect(document.querySelector("#oc")!.textContent).not.toMatch(/Apple Pay|Google Pay/);
  });

  it("Android: 'Copiar código Pix' é o botão principal + 3 passos; copiar mede landing_pix_copiado com o layout e a plataforma", async () => {
    await abrirPagina({ ua: ANDROID });
    const escrito: string[] = [];
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t: string) => { escrito.push(t); } }, configurable: true });
    await abrirCheckout();
    await gerarPix();
    const tela = document.querySelector('[data-testid="oferta-pix"]')!;
    expect(tela.getAttribute("data-layout")).toBe("copia_primeiro");
    const botao = document.querySelector<HTMLButtonElement>('[data-testid="oferta-pix-copiar"]')!;
    expect(botao.className).toContain("oc-cta");
    expect(botao.textContent).toBe("Copiar código Pix");
    expect([...tela.querySelectorAll(".oc-passos3 li")].map((l) => l.textContent?.replace(/^\d/, ""))).toEqual(["Abra o app do banco", "Pix copia e cola", "Volte aqui: libera sozinho"]);
    expect(eventos().find((e) => e.nome === "landing_stripe_pix_gerado")).toMatchObject({ layout_pix: "copia_primeiro", plataforma: "android" });
    botao.click();
    await vi.waitFor(() => { if (!eventos().some((e) => e.nome === "landing_pix_copiado")) throw new Error("sem copiado"); }, { timeout: 2000, interval: 20 });
    expect(escrito).toEqual(["00020126PIXSTRIPE2790"]);
    expect(botao.textContent).toBe("Código copiado ✓");
    expect(eventos().find((e) => e.nome === "landing_pix_copiado")).toMatchObject({ ok: true, via: "stripe", layout_pix: "copia_primeiro", plataforma: "android", pagina: "organizar" });
  });

  it("a /oferta continua com a tela do Pix de sempre também no Android (o 'copiar primeiro' é só do /organizar-Stripe)", async () => {
    const m = await import("@/landing/stripe-checkout");
    m._zerar();
    usarUa(ANDROID);
    document.body.innerHTML = "";
    sessionStorage.clear();
    (window as unknown as { __ofertaApi?: unknown }).__ofertaApi = { criar: async () => ({ ok: true, clientSecret: "pi_1_secret", pi: "pi_1" }), status: async () => ({ ok: true, status: "requires_action", pago: false }) };
    (window as unknown as { __stripeFalso?: unknown }).__stripeFalso = {
      elements: () => ({ create: () => ({ mount: (el: HTMLElement) => { el.innerHTML = '<div data-testid="pe-falso">PE</div>'; }, on: (e: string, cb: (x: unknown) => void) => { if (e === "ready") setTimeout(() => cb({}), 0); } }), submit: async () => ({}) }),
      createPaymentMethod: async () => ({ paymentMethod: { id: "pm_1" } }), confirmPayment: async () => ({}),
      confirmPixPayment: async () => ({ paymentIntent: { id: "pi_1", status: "requires_action", next_action: { type: "pix_display_qr_code", pix_display_qr_code: { data: "000201X", expires_at: Math.floor(Date.now() / 1000) + 1800 } } } }),
    };
    m.abrirCheckout({ pk: PK, precoCentavos: 6790, parcelasMax: 1, producao: false, evento: () => {}, pixel: () => {}, atrib: {}, sessao: "s", aparelho: "a", urlChegada: "https://www.coreaplicativo.com.br/oferta", fbclid: null });
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="pe-falso"]') || pagar().hasAttribute("aria-disabled")) throw new Error("sem PE"); }, { timeout: 3000, interval: 20 });
    await gerarPix();
    expect(document.querySelector('[data-testid="oferta-pix"]')!.getAttribute("data-layout")).toBeNull();
    expect(document.querySelector(".oc-copia #oc-copiar")).not.toBeNull();
    m._zerar();
  });

  it("produção: o servidor devolve a /oferta de 67,90 (velho) pro /organizar → landing_erro stripe_preco_divergente e o Pix não sai", async () => {
    const m = await import("@/landing/stripe-checkout");
    m._zerar();
    document.body.innerHTML = "";
    sessionStorage.clear();
    const evs: Array<[string, Record<string, unknown> | undefined]> = [];
    const confirmados: unknown[] = [];
    (window as unknown as { __ofertaApi?: unknown }).__ofertaApi = { criar: async () => ({ ok: true, clientSecret: "pi_9_secret", pi: "pi_9" }), status: async () => ({ ok: true, status: "requires_payment_method", pago: false }) };
    (window as unknown as { __stripeFalso?: unknown }).__stripeFalso = {
      elements: () => ({ create: () => ({ mount: () => {}, on: () => {} }), submit: async () => ({}) }),
      createPaymentMethod: async () => ({ paymentMethod: { id: "pm_1" } }),
      confirmPayment: async (...a: unknown[]) => { confirmados.push(a); return {}; }, confirmPixPayment: async (...a: unknown[]) => { confirmados.push(a); return {}; },
    };
    m.abrirCheckout({ pk: PK, precoCentavos: 2790, pagina: "organizar", storagePrefix: "organizar", parcelasMax: 1, producao: true, evento: (n, d) => { evs.push([n, d]); }, pixel: () => {}, atrib: {}, sessao: "s", aparelho: "a", urlChegada: "https://www.coreaplicativo.com.br/organizar", fbclid: null });
    await vi.waitFor(() => { if (!evs.some(([n, d]) => n === "landing_erro" && d?.onde === "stripe_preco_divergente")) throw new Error("sem alarme"); }, { timeout: 3000, interval: 20 });
    expect(confirmados).toHaveLength(0);
    m._zerar();
  });
});
