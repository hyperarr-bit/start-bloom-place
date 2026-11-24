/**
 * /organizar no checkout Stripe (22/11, chave ORGANIZAR_STRIPE; dono: "idêntico ao /organizar de hoje, exceto o pagamento"). Trava:
 *   1. o <head>: off = o /organizar de hoje (mesmos atributos e memória do <head> sem o bloco, em toda rota); on = os MESMOS atributos
 *      do off (nenhum CSS muda) e só a memória ganha org_stripe/stripe_pk; só na página atual do /organizar (nunca /oferta, /vida, /simples,
 *      /escolha, v2, "ano"); ?orgstripe=on|off força, auto desfaz; o sorteio de preço da /oferta nunca vale aqui;
 *   2. a página no jsdom: o HTML e o texto visível com a chave on são IGUAIS aos da chave off (diferenças permitidas: nenhuma na página —
 *      só o checkout, que é uma camada por cima, e os campos de medição dos eventos); o e-mail fica no cartão do preço (mesmo erro, mesma
 *      sugestão, mesmos eventos); com e-mail válido o "Pagar R$ 27,90 no Pix" abre o checkout Stripe JÁ com o e-mail (sem pedir 2×), Pix
 *      marcado, cartão à vista, sem CPF; pedido "organizar" sem braço; Purchase 27,90 com eventID = PI; Android: "Copiar código Pix" vira
 *      o botão principal + 3 passos; iPhone: a tela de sempre; carteira só medida; produção: PI que não volta 2790/organizar não paga.
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
  it("no código: ORGANIZAR_STRIPE ligado no ar (dono 22/11); o regex do 'antes' tirou o bloco", () => {
    expect(HTML).toMatch(/var ORGANIZAR_STRIPE = "on";/);
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
  it("chave on: os MESMOS atributos do off (a página não muda) e a memória ganha só org_stripe + stripe_pk; sem braço de preço", () => {
    for (const url of ["/organizar?utm_content=c7&preco=4790", "/organizar", "/organizar/"]) {
      const id = randomUUID();
      const on = rodar(comChave("on", "on"), url, { "landing-device-id": id }), off = rodar(comChave("off", "on"), url, { "landing-device-id": id });
      expect(on.attrs).toEqual(off.attrs);
      expect(on.attrs["data-pagina"]).toBeUndefined();
      expect(on.attrs["data-checkout-ext"]).toBeUndefined();
      const { org_stripe, org_stripe_forcado, ab_org_stripe, stripe_pk, ...resto } = on.mem;
      expect({ org_stripe, org_stripe_forcado, ab_org_stripe }).toEqual({ org_stripe: "on", org_stripe_forcado: false, ab_org_stripe: "on" });
      expect(String(stripe_pk)).toMatch(/^pk_live_/);
      expect(resto).toEqual(off.mem);
      expect(on.mem.braco_preco).toBeUndefined();
    }
  });
  it("chave on: nada fora da página atual do /organizar (/oferta, /vida, /simples, /tiktok, /escolha, v2 do AB_LP, oferta 'ano')", () => {
    for (const url of ["/oferta", "/vida", "/simples", "/tiktok", "/escolha", "/vitalicio", "/organizar?lp=v2", "/organizar?oferta=ano"]) {
      const r = rodar(comChave("on"), url, { "landing-device-id": randomUUID() });
      expect(r.mem.org_stripe).toBeUndefined();
    }
  });
  it("?orgstripe=on força com a chave off (localStorage + cookie); ?orgstripe=off desliga com a chave on; auto desfaz", () => {
    const store: Record<string, string> = {};
    const r = rodar(comChave("off"), "/organizar?orgstripe=on", store);
    expect(r.mem).toMatchObject({ org_stripe: "on", org_stripe_forcado: true });
    expect(store["landing-orgstripe-force"]).toBe("on");
    expect(rodar(comChave("off"), "/organizar", {}, r.cookie).mem.org_stripe).toBe("on");
    expect(rodar(comChave("on"), "/organizar?orgstripe=off", {}).mem.org_stripe).toBeUndefined();
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
/** o /organizar de hoje (braço atual, oferta sempre, e-mail antes do Pix) — com a chave on, a memória ganha só org_stripe + stripe_pk */
async function abrirPagina(o: { ua?: string; on?: boolean } = {}) {
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
    criar: async (c: Record<string, unknown>) => { criadas.push(c); return { ok: true, clientSecret: "pi_777_secret_abc", pi: "pi_777", amount: 1990, currency: "brl", pagina: "organizar" }; }, // 23/11: 19,90
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
  d.setAttribute("data-t", "a"); d.setAttribute("data-oferta", "sempre"); d.setAttribute("data-checkout", "email"); d.setAttribute("data-lp", "atual"); d.setAttribute("data-cko", "atual"); d.setAttribute("data-pix", "atual");
  (window as unknown as { __landing?: unknown }).__landing = { t: "a", oferta: "sempre", checkout: "email", lp: "atual", pix: "atual", cko: "atual", ...(o.on === false ? {} : { org_stripe: "on", org_stripe_forcado: false, ab_org_stripe: "on", stripe_pk: PK }) };
  document.head.querySelectorAll("style[data-teste-st]").forEach((s) => s.remove());
  const st = document.createElement("style"); st.setAttribute("data-teste-st", ""); st.textContent = estilo; document.head.appendChild(st);
  document.body.removeAttribute("style");
  document.body.innerHTML = corpo;
  const m = await import("@/landing/stripe-checkout"); m._zerar();
  await import("@/landing/landing");
  // a página assenta (1º quadro + landing_html) antes de qualquer comparação — sob carga a máquina demora
  await vi.waitFor(() => { if (!eventos().some((e) => e.nome === "landing_html")) throw new Error("sem landing_html"); }, { timeout: 10000, interval: 20 });
  await dormir(150);
}
const pagar = () => document.getElementById("oc-pagar") as HTMLButtonElement;
const campoCartao = () => document.getElementById("lp-email-antes") as HTMLInputElement;
/** o e-mail no CARTÃO do preço (como hoje) + "Pagar R$ 27,90 no Pix" → o checkout Stripe abre já com o e-mail */
async function pagarNoCartao(email = "ana@exemplo.com") {
  campoCartao().value = email; campoCartao().dispatchEvent(new Event("input"));
  (document.getElementById("lp-pagar") as HTMLButtonElement).click();
  await vi.waitFor(() => { if (!document.querySelector('[data-testid="pe-falso"]') || !pagar() || pagar().hasAttribute("aria-disabled")) throw new Error("sem PE"); }, { timeout: 10000, interval: 20 });
}
async function gerarPix() {
  pagar().click();
  await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pix"]')) throw new Error("sem pix"); }, { timeout: 10000, interval: 20 });
}
afterEach(() => { usarUa(UA_ORIGINAL); (window as unknown as { __ofertaApi?: unknown }).__ofertaApi = undefined; (window as unknown as { __stripeFalso?: unknown }).__stripeFalso = undefined; });
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
/** o que a medição pode trazer a mais com a chave on (o resto do evento é igual) */
const CAMPOS_DA_MEDICAO = ["pagina", "braco_checkout_ext", "org_stripe_forcado"];

describe("a página do /organizar com a chave on é IDÊNTICA à de hoje (só o pagamento muda)", { timeout: 30000 }, () => {
  it("HTML do corpo e texto visível: on = off, antes de tocar em pagar. Diferença permitida: SÓ o preço (27,90 → 19,90, dono 23/11)", async () => {
    await abrirPagina({ on: false, ua: IPHONE });
    const htmlOff = document.body.innerHTML, textoOff = textoVisivel(document.body);
    const nomesOff = eventos().map((e) => e.nome);
    const eventosOff = eventos().map(({ t_ms: _t, tela1_ms: _t1, ttfb_ms: _tt, landing_session_id: _s, landing_device_id: _d, ...r }) => r);
    await abrirPagina({ on: true, ua: IPHONE });
    // 23/11 (dono: "troca o /organizar para 19,90"): com a chave on (checkout Stripe) a única diferença é o preço; off (Asaas) segue 27,90
    // (o <template> do /simples segue 27,90 — ele não pinta no /organizar e o /simples cobra 27,90 pelo Asaas)
    const semPreco = (h: string) => h.replace(/27,90|19,90/g, "PRECO");
    expect(semPreco(document.body.innerHTML)).toBe(semPreco(htmlOff));
    expect(textoVisivel(document.body)).toBe(textoOff.replace(/27,90/g, "19,90"));
    for (const t of ["De R$ 97,90 por ano", "Só hoje", "Pra sempre por R$ 27,90", "Pagar R$ 27,90 no Pix"]) expect(semEspaco(textoOff)).toContain(semEspaco(t));
    for (const t of ["De R$ 97,90 por ano", "Só hoje", "Pra sempre por R$ 19,90", "Pagar R$ 19,90 no Pix"]) expect(semEspaco(textoVisivel(document.body))).toContain(semEspaco(t));
    expect(textoVisivel(document.body)).not.toContain("27,90");
    expect(campoCartao()).not.toBeNull(); // o e-mail continua NO CARTÃO do preço
    // eventos: os mesmos nomes; cada um igual ao de hoje, fora os campos de medição permitidos
    expect(eventos().map((e) => e.nome)).toEqual(nomesOff);
    eventos().forEach(({ t_ms: _t, tela1_ms: _t1, ttfb_ms: _tt, landing_session_id: _s, landing_device_id: _d, ...r }, i) => {
      const extra = Object.keys(r).filter((k) => !(k in eventosOff[i]));
      expect(extra.every((k) => CAMPOS_DA_MEDICAO.includes(k))).toBe(true);
      expect(r).toMatchObject({ pagina: "organizar", braco_checkout_ext: "stripe" });
    });
  });

  it("e-mail vazio ou ruim: o erro aparece no cartão da página como hoje (mesmo evento) e o checkout NÃO abre; sugestão de domínio igual", async () => {
    await abrirPagina({ ua: IPHONE });
    (document.getElementById("lp-pagar") as HTMLButtonElement).click();
    await dormir(30);
    expect(document.getElementById("lp-email-antes-erro")!.hidden).toBe(false);
    expect(eventos().find((e) => e.nome === "landing_email_antes_erro")).toMatchObject({ motivo: "vazio" });
    expect(document.querySelector("#oc")).toBeNull();
    expect(criadas).toHaveLength(0);
    campoCartao().value = "ana@gmial.com"; campoCartao().dispatchEvent(new Event("input")); campoCartao().dispatchEvent(new Event("blur"));
    await dormir(20);
    expect(document.getElementById("lp-email-antes-sugestao")!.textContent).toContain("ana@gmail.com");
  });

  it("e-mail válido no cartão → checkout Stripe já com o e-mail (sem pedir de novo), Pix marcado, cartão à vista, sem CPF; R$ 19,90; Purchase = PI", async () => {
    await abrirPagina({ ua: IPHONE });
    await pagarNoCartao("ana@exemplo.com");
    const camada = () => document.querySelector<HTMLElement>("#oc")!;
    expect(document.querySelector('[data-testid="oferta-email-ok"]')!.textContent).toContain("ana@exemplo.com");
    expect(document.getElementById("oc-email-caixa")!.hidden).toBe(true); // o campo só volta no "Trocar"
    expect(nb(camada().textContent)).not.toMatch(/67,90|97,90/);
    expect(nb(camada().textContent)).toContain("R$ 19,90");
    expect(document.querySelector('[data-metodo="pix"]')!.getAttribute("aria-checked")).toBe("true");
    expect(nb(pagar().textContent)).toBe("Gerar Pix de R$ 19,90");
    expect(document.getElementById("oc-cpf")).toBeNull();
    expect(camada().textContent).not.toMatch(/em até \d+x/);
    (document.querySelector('[data-metodo="card"]') as HTMLButtonElement).click();
    expect(nb(pagar().textContent)).toBe("Pagar R$ 19,90");
    (document.querySelector('[data-metodo="pix"]') as HTMLButtonElement).click();
    expect(eventos().find((e) => e.nome === "landing_email_antes_ok")).toMatchObject({ via: "stripe" });
    expect(eventos().find((e) => e.nome === "landing_cta")).toMatchObject({ onde: "pagar", pagina: "organizar" });
    await gerarPix();
    expect(criadas.at(-1)).toMatchObject({ pagina: "organizar", email: "ana@exemplo.com" });
    for (const c of criadas) { expect(c).not.toHaveProperty("braco_preco"); expect((c.atrib as Record<string, unknown>).indicador).toBeUndefined(); }
    expect(sessionStorage.getItem("organizar-stripe-ref")).toBe(criadas[0].ref);
    expect(sessionStorage.getItem("oferta-stripe-ref")).toBeNull();
    expect(document.querySelector('[data-testid="oferta-pix"]')!.getAttribute("data-layout")).toBeNull(); // iPhone: a tela de sempre
    statusPago = true;
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pago"]')) throw new Error("sem pago"); }, { timeout: 10000, interval: 50 });
    expect(fbq).toHaveBeenCalledWith("track", "Purchase", expect.objectContaining({ value: 19.9, currency: "BRL" }), { eventID: "pi_777" });
    for (const e of eventos().filter((x) => x.nome.startsWith("landing_"))) { expect(e).toMatchObject({ pagina: "organizar" }); expect(e).not.toHaveProperty("braco_preco"); }
  });

  it("carteira: só medida (landing_stripe_carteira), nenhum botão de Apple/Google Pay aparece", async () => {
    await abrirPagina({ ua: ANDROID });
    await pagarNoCartao();
    await vi.waitFor(() => { if (!eventos().some((e) => e.nome === "landing_stripe_carteira")) throw new Error("sem carteira"); }, { timeout: 10000, interval: 20 });
    expect(eventos().find((e) => e.nome === "landing_stripe_carteira")).toMatchObject({ google_pay: true, apple_pay: false, pagina: "organizar" });
    expect(document.querySelector("#oc")!.textContent).not.toMatch(/Apple Pay|Google Pay/);
  });

  it("Android: 'Copiar código Pix' é o botão principal + 3 passos; copiar mede landing_pix_copiado com o layout e a plataforma", async () => {
    await abrirPagina({ ua: ANDROID });
    const escrito: string[] = [];
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t: string) => { escrito.push(t); } }, configurable: true });
    await pagarNoCartao();
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

  it("chave off: o 'Pagar R$ 27,90 no Pix' segue gerando o Pix do Asaas (nenhum checkout Stripe, nenhum pedido no stripe-criar)", async () => {
    await abrirPagina({ on: false, ua: IPHONE });
    campoCartao().value = "ana@exemplo.com"; campoCartao().dispatchEvent(new Event("input"));
    (document.getElementById("lp-pagar") as HTMLButtonElement).click();
    await dormir(300);
    expect(document.querySelector("#oc")).toBeNull();
    expect(criadas).toHaveLength(0);
    for (const e of eventos()) expect(e).not.toHaveProperty("org_stripe_forcado");
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
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="pe-falso"]') || pagar().hasAttribute("aria-disabled")) throw new Error("sem PE"); }, { timeout: 10000, interval: 20 });
    const c = document.getElementById("oc-email") as HTMLInputElement; c.value = "ana@exemplo.com"; c.dispatchEvent(new Event("input"));
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
    await vi.waitFor(() => { if (!evs.some(([n, d]) => n === "landing_erro" && d?.onde === "stripe_preco_divergente")) throw new Error("sem alarme"); }, { timeout: 10000, interval: 20 });
    expect(confirmados).toHaveLength(0);
    m._zerar();
  });
});
