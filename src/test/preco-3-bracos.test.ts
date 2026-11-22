/**
 * /oferta · SORTEIO DE PREÇO de 3 braços (22/11, AB_PRECO_OFERTA): R$ 27,90 · R$ 47,90 · R$ 67,90. Trava:
 *   1. o <head>: off = todo mundo no 67,90 IGUAL a hoje (nenhum atributo, nenhum campo novo, mesmo resultado do <head> sem o bloco);
 *      on = 1/3 por aparelho, fixo por aparelho, independente dos outros sorteios; ?preco=2790|4790|6790 força (até com a chave off);
 *      ?preco=auto desfaz; valor fora dos 3 é ignorado; nada fora da /oferta de hoje (/vitalicio, braço "nova", /organizar, /escolha);
 *   2. a página no jsdom, em cada braço: o preço do braço em TODO lugar (página, checkout, botão do Pix, tela do Pix, pago), nenhum
 *      "67,90" nos braços 27,90/47,90; braco_preco em todo evento landing_* (inclusive landing_cta) e no pedido do stripe-criar;
 *      Purchase/InitiateCheckout com o valor do braço; off = o pedido e os eventos sem o campo (como hoje);
 *   3. em produção, o PI que volta com outro valor (servidor velho/travado) não deixa pagar.
 * O servidor (stripe-criar recusa valor fora dos 3, webhook só libera com o braço gravado) está em src/test/stripe-webhook.test.ts.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { bracoPrecoOfertaDoAparelho, bracoTopoOfertaDoAparelho, bracoPixDoAparelho, BRACOS_PRECO } from "@/landing/regras";

const raiz = resolve(__dirname, "../..");
const HTML = readFileSync(resolve(raiz, "landing.html"), "utf8");
const cabeca = HTML.match(/<script>\s*(\(function \(\) \{\s*var LANDING_NOVA[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];
const comChave = (v: "on" | "off", extra: (s: string) => string = (s) => s) => extra(cabeca.replace(/var AB_PRECO_OFERTA = "(on|off)"/, `var AB_PRECO_OFERTA = "${v}"`));
/** o <head> de antes: sem o bloco do braço de preço */
const semOBloco = cabeca.replace(/\n {8}\/\/ 22\/11: o braço de PREÇO da \/oferta[\s\S]*?\n {8}\}\n(?= {8}\/\/ 02\/11: o braço da TELA DO PIX)/, "\n");

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
  it("no código: a chave nasce DESLIGADA e o 67,90 de sempre continua sendo o preço da /oferta", () => {
    expect(HTML).toMatch(/var AB_PRECO_OFERTA = "off";/);
    expect(HTML).toMatch(/var STRIPE_PRECO_CENTAVOS = 6790;/);
    expect(cabeca).toContain('"pco:"');
    expect(semOBloco).not.toContain('"pco:"'); // o regex do "antes" tirou o bloco (senão a comparação abaixo não prova nada)
    expect(semOBloco.length).toBeLessThan(cabeca.length - 1000);
  });

  it("chave off: 300 aparelhos em várias rotas → atributos e memória IGUAIS ao <head> sem o bloco (nenhum braco_preco, 6790)", () => {
    for (const url of ["/oferta?utm_content=c7", "/oferta/", "/vitalicio", "/organizar", "/escolha", "/vida", "/simples"]) {
      for (let i = 0; i < 40; i++) {
        const id = randomUUID();
        const a = rodar(comChave("off"), url, { "landing-device-id": id }), b = rodar(semOBloco, url, { "landing-device-id": id });
        expect(a.attrs).toEqual(b.attrs);
        expect(a.mem).toEqual(b.mem);
        expect(a.attrs["data-preco"]).toBeUndefined();
        expect(a.mem.braco_preco).toBeUndefined();
      }
    }
    expect(rodar(comChave("off"), "/oferta", { "landing-device-id": randomUUID() }).mem.stripe_preco_centavos).toBe(6790);
  });

  it("chave on: ~1/3 em cada preço (6.000 aparelhos), FIXO por aparelho, igual à conta do regras.ts", () => {
    const n: Record<string, number> = { "2790": 0, "4790": 0, "6790": 0 };
    for (let i = 0; i < 6000; i++) {
      const id = randomUUID();
      const r1 = rodar(comChave("on"), "/oferta", { "landing-device-id": id });
      const b = String(r1.attrs["data-preco"]);
      expect(BRACOS_PRECO).toContain(b);
      expect(b).toBe(bracoPrecoOfertaDoAparelho(id));
      expect(r1.mem).toMatchObject({ braco_preco: b, preco_forcado: false, ab_preco_oferta: "on", stripe_preco_centavos: Number(b) });
      if (i < 300) expect(rodar(comChave("on"), "/oferta?utm_content=outro", { "landing-device-id": id }).attrs["data-preco"]).toBe(b); // volta e vê o mesmo
      n[b] += 1;
    }
    for (const b of BRACOS_PRECO) { expect(n[b]).toBeGreaterThan(6000 * 0.3); expect(n[b]).toBeLessThan(6000 * 0.37); }
  });

  it("chave on: independente dos outros sorteios (topo bit 4, tela do Pix bit 8) — cada braço de preço tem ~metade de cada lado", () => {
    const cont: Record<string, { otp: number; pix: number; n: number }> = { "2790": { otp: 0, pix: 0, n: 0 }, "4790": { otp: 0, pix: 0, n: 0 }, "6790": { otp: 0, pix: 0, n: 0 } };
    for (let i = 0; i < 9000; i++) {
      const id = randomUUID(); const c = cont[bracoPrecoOfertaDoAparelho(id)];
      c.n += 1; if (bracoTopoOfertaDoAparelho(id) === "anuncio") c.otp += 1; if (bracoPixDoAparelho(id) === "b") c.pix += 1;
    }
    for (const c of Object.values(cont)) { expect(c.otp / c.n).toBeGreaterThan(0.45); expect(c.otp / c.n).toBeLessThan(0.55); expect(c.pix / c.n).toBeGreaterThan(0.45); expect(c.pix / c.n).toBeLessThan(0.55); }
  });

  it("?preco= força o braço (também com a chave off), guarda no aparelho (localStorage + cookie); ?preco=auto desfaz; valor fora dos 3 é ignorado", () => {
    for (const p of ["2790", "4790", "6790"]) {
      const store: Record<string, string> = { "landing-device-id": randomUUID() };
      const r = rodar(comChave("off"), `/oferta?preco=${p}`, store);
      expect(r.attrs["data-preco"]).toBe(p);
      expect(r.mem).toMatchObject({ braco_preco: p, preco_forcado: true, stripe_preco_centavos: Number(p) });
      expect(store["landing-preco-force"]).toBe(p);
      expect(r.cookie).toContain(`landing_preco_force=${p}`);
      // volta sem o parâmetro: a força fica (localStorage); com o storage zerado (Instagram), o cookie segura
      expect(rodar(comChave("off"), "/oferta", store).attrs["data-preco"]).toBe(p);
      expect(rodar(comChave("off"), "/oferta", { "landing-device-id": randomUUID() }, r.cookie).attrs["data-preco"]).toBe(p);
      const desfaz = rodar(comChave("off"), "/oferta?preco=auto", store, r.cookie);
      expect(desfaz.attrs["data-preco"]).toBeUndefined();
      expect(store["landing-preco-force"]).toBeUndefined();
      expect(desfaz.cookie).not.toContain("landing_preco_force");
    }
    for (const lixo of ["1990", "27.90", "2790.5", "0", "-2790", "abc", "99999"]) {
      const r = rodar(comChave("off"), `/oferta?preco=${encodeURIComponent(lixo)}`, { "landing-device-id": randomUUID() });
      expect(r.attrs["data-preco"]).toBeUndefined();
      expect(r.mem.braco_preco).toBeUndefined();
      expect(r.mem.stripe_preco_centavos).toBe(6790);
    }
  });

  it("nada fora da /oferta de hoje: /vitalicio, braço 'nova' (?lpo=nova), /organizar, /escolha e /vida nunca ganham braço, nem com chave on + ?preco", () => {
    for (const url of ["/vitalicio?preco=2790", "/oferta?lpo=nova&preco=2790", "/organizar?preco=2790", "/escolha?preco=2790", "/vida?preco=2790", "/simples?preco=2790"]) {
      const r = rodar(comChave("on"), url, { "landing-device-id": randomUUID() });
      expect(r.attrs["data-preco"]).toBeUndefined();
      expect(r.mem.braco_preco).toBeUndefined();
    }
  });
});

/* ───────── a página no jsdom (mesma receita do oferta-stripe.test.ts) ───────── */
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
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Ev = Record<string, unknown> & { nome: string };
const eventos = (): Ev[] => ((window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding ?? []);
const PK = "pk_test_EXEMPLO123";
let criadas: Array<Record<string, unknown>> = [];
let statusPago = false;
let fbq: ReturnType<typeof vi.fn>;
async function abrirPagina(braco: "2790" | "4790" | "6790" | null, o: { forcado?: boolean; producao?: boolean } = {}) {
  await dormir(20);
  (await import("@/landing/stripe-checkout"))._zerar();
  vi.resetModules();
  localStorage.clear(); sessionStorage.clear();
  window.history.replaceState(null, "", "/oferta?utm_content=c7&fbclid=abc");
  (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
  criadas = []; statusPago = false;
  fbq = vi.fn();
  (window as unknown as { fbq?: unknown }).fbq = fbq;
  (window as unknown as { __ofertaApi?: unknown }).__ofertaApi = {
    criar: async (c: Record<string, unknown>) => { criadas.push(c); return { ok: true, clientSecret: "pi_123_secret_abc", pi: "pi_123", ...(c.braco_preco ? { amount: Number(c.braco_preco), currency: "brl" } : {}) }; },
    status: async () => ({ ok: true, status: statusPago ? "succeeded" : "requires_action", pago: statusPago, metodo: statusPago ? "pix" : null }),
  };
  (window as unknown as { __stripeFalso?: unknown }).__stripeFalso = {
    elements: () => ({ create: () => ({ mount: (el: HTMLElement) => { el.innerHTML = '<div data-testid="pe-falso">PE</div>'; }, on: (e: string, cb: (x: unknown) => void) => { if (e === "ready") setTimeout(() => cb({}), 0); } }), submit: async () => ({}) }),
    createPaymentMethod: async () => ({ paymentMethod: { id: "pm_1" } }),
    confirmPayment: async () => ({ paymentIntent: { id: "pi_123", status: "succeeded" } }),
    confirmPixPayment: async () => ({ paymentIntent: { id: "pi_123", status: "requires_action", next_action: { type: "pix_display_qr_code", pix_display_qr_code: { data: "00020126PIXSTRIPE", image_url_png: "https://qr.stripe.com/x.png", expires_at: Math.floor(Date.now() / 1000) + 1800 } } } }),
  };
  const d = document.documentElement;
  for (const a of ["data-pagina", "data-checkout-ext", "data-hm-sem-parcelas", "data-pix", "data-vida", "data-checkout-aberto", "data-oem", "data-otp", "data-preco"]) d.removeAttribute(a);
  d.setAttribute("data-t", "a"); d.setAttribute("data-oferta", "sempre"); d.setAttribute("data-checkout", "email"); d.setAttribute("data-lp", "atual");
  d.setAttribute("data-pagina", "oferta"); d.setAttribute("data-checkout-ext", "stripe"); d.setAttribute("data-lpo", "atual");
  if (braco) d.setAttribute("data-preco", braco);
  (window as unknown as { __landing?: unknown }).__landing = {
    pagina: "oferta", checkout_ext: "stripe", stripe_pk: PK, stripe_preco_centavos: braco ? Number(braco) : 6790, stripe_parcelas: "Pix ou cartão", stripe_parcelas_max: 1, lpo: "atual", ab_lp_oferta: "off",
    ...(braco ? { braco_preco: braco, preco_forcado: o.forcado === true, ab_preco_oferta: "on" } : {}),
  };
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
afterEach(() => { (window as unknown as { __ofertaApi?: unknown }).__ofertaApi = undefined; (window as unknown as { __stripeFalso?: unknown }).__stripeFalso = undefined; });
const semEspaco = (s: string) => s.replace(/\s+/g, "");
/** o R$ usa espaço que não quebra: compara com espaço comum */
const nb = (s: string | null | undefined) => String(s ?? "").replace(/\u00a0/g, " ");

describe("a /oferta em cada braço (jsdom)", () => {
  for (const [braco, txt, valor] of [["2790", "R$ 27,90", 27.9], ["4790", "R$ 47,90", 47.9]] as const) {
    it(`braço ${txt}: o preço em todo lugar, NENHUM 67,90 (página, checkout, Pix, pago); braco_preco nos eventos e no pedido; pixel com ${valor}`, async () => {
      await abrirPagina(braco);
      const pagina = textoVisivel(document.body);
      expect(pagina).not.toContain("67,90");
      expect(semEspaco(pagina)).toContain(semEspaco(`Pra sempre por ${txt}`));
      expect(semEspaco(pagina)).toContain(semEspaco(`Sua vida inteira num app só, por ${txt}. Pra sempre.`));
      for (const el of document.querySelectorAll("[data-hm-preco]")) expect(el.textContent).not.toContain("67");
      expect(fbq).toHaveBeenCalledWith("track", "ViewContent", expect.objectContaining({ value: valor }));

      await abrirCheckout();
      const camada = () => document.querySelector<HTMLElement>("#oc")!;
      expect(camada().textContent).not.toContain("67,90");
      expect(nb(camada().textContent)).toContain(txt);
      expect(nb(pagar().textContent)).toBe(`Gerar Pix de ${txt}`);
      expect(fbq).toHaveBeenCalledWith("track", "InitiateCheckout", expect.objectContaining({ value: valor }), expect.anything());
      expect(criadas[0]).toMatchObject({ pagina: "oferta", braco_preco: braco });
      for (const k of Object.keys(criadas[0])) expect(k).not.toMatch(/valor|amount|price/i); // só o braço vai; o valor é do servidor

      (document.querySelector('[data-metodo="card"]') as HTMLButtonElement).click();
      expect(nb(pagar().textContent)).toBe(`Pagar ${txt}`);
      (document.querySelector('[data-metodo="pix"]') as HTMLButtonElement).click();
      const campo = document.getElementById("oc-email") as HTMLInputElement;
      campo.value = "ana@exemplo.com"; campo.dispatchEvent(new Event("input"));
      pagar().click();
      await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pix"]')) throw new Error("sem pix"); }, { timeout: 3000, interval: 20 });
      const pix = nb(document.querySelector('[data-testid="oferta-pix"]')!.textContent);
      expect(pix).not.toContain("67,90");
      expect(pix).toContain(txt);
      expect(criadas.every((c) => c.braco_preco === braco)).toBe(true);

      statusPago = true;
      await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pago"]')) throw new Error("sem pago"); }, { timeout: 5000, interval: 50 });
      expect(camada().textContent).not.toContain("67,90");
      expect(fbq).toHaveBeenCalledWith("track", "Purchase", expect.objectContaining({ value: valor, currency: "BRL" }), { eventID: "pi_123" });

      const doLanding = eventos().filter((e) => e.nome.startsWith("landing_"));
      for (const nome of ["landing_html", "landing_cta", "landing_stripe_aberto", "landing_stripe_pagar", "landing_stripe_pix_gerado", "landing_stripe_pago"]) expect(doLanding.some((e) => e.nome === nome)).toBe(true);
      for (const e of doLanding) expect(e).toMatchObject({ braco_preco: braco, preco_forcado: false, pagina: "oferta" });
    });
  }

  it("braço 67,90 (sorteado): igual ao preço de hoje, com braco_preco 6790 nos eventos e no pedido", async () => {
    await abrirPagina("6790");
    expect(semEspaco(textoVisivel(document.body))).toContain(semEspaco("Pra sempre por R$ 67,90"));
    await abrirCheckout();
    expect(nb(pagar().textContent)).toBe("Gerar Pix de R$ 67,90");
    expect(criadas[0]).toMatchObject({ braco_preco: "6790" });
    for (const e of eventos().filter((x) => x.nome.startsWith("landing_"))) expect(e.braco_preco).toBe("6790");
  });

  it("chave off (sem braço): a /oferta de hoje — R$ 67,90, nenhum braco_preco no pedido nem nos eventos", async () => {
    await abrirPagina(null);
    expect(semEspaco(textoVisivel(document.body))).toContain(semEspaco("Pra sempre por R$ 67,90"));
    await abrirCheckout();
    expect(nb(pagar().textContent)).toBe("Gerar Pix de R$ 67,90");
    expect(criadas[0]).not.toHaveProperty("braco_preco");
    for (const e of eventos()) { expect(e).not.toHaveProperty("braco_preco"); expect(e).not.toHaveProperty("preco_forcado"); }
    expect(fbq).toHaveBeenCalledWith("track", "InitiateCheckout", expect.objectContaining({ value: 67.9 }), expect.anything());
  });

  it("forçado por ?preco=: todo evento diz preco_forcado (a leitura exclui o aparelho do dono)", async () => {
    await abrirPagina("2790", { forcado: true });
    await abrirCheckout();
    for (const e of eventos().filter((x) => x.nome.startsWith("landing_"))) expect(e).toMatchObject({ braco_preco: "2790", preco_forcado: true, medicao_forcada: true });
  });
});

describe("produção: o PI tem que vir com o valor do braço", () => {
  it("o servidor devolve 6790 (velho ou travado) pra um braço 2790 → landing_erro stripe_preco_divergente e o Pix não sai", async () => {
    const m = await import("@/landing/stripe-checkout");
    m._zerar();
    document.body.innerHTML = "";
    const evs: Array<[string, Record<string, unknown> | undefined]> = [];
    (window as unknown as { __ofertaApi?: unknown }).__ofertaApi = { criar: async () => ({ ok: true, clientSecret: "pi_9_secret", pi: "pi_9", amount: 6790, currency: "brl" }), status: async () => ({ ok: true, status: "requires_payment_method", pago: false }) };
    const confirmados: unknown[] = [];
    (window as unknown as { __stripeFalso?: unknown }).__stripeFalso = {
      elements: () => ({ create: () => ({ mount: () => {}, on: () => {} }), submit: async () => ({}) }),
      createPaymentMethod: async () => ({ paymentMethod: { id: "pm_1" } }),
      confirmPayment: async (...a: unknown[]) => { confirmados.push(a); return {}; }, confirmPixPayment: async (...a: unknown[]) => { confirmados.push(a); return {}; },
    };
    m.abrirCheckout({ pk: PK, precoCentavos: 2790, bracoPreco: 2790, parcelasMax: 1, producao: true, evento: (n, d) => { evs.push([n, d]); }, pixel: () => {}, atrib: {}, sessao: "s", aparelho: "a", urlChegada: "https://www.coreaplicativo.com.br/oferta", fbclid: null });
    await vi.waitFor(() => { if (!evs.some(([n, d]) => n === "landing_erro" && d?.onde === "stripe_preco_divergente")) throw new Error("sem alarme"); }, { timeout: 3000, interval: 20 });
    expect(confirmados).toHaveLength(0);
    m._zerar();
  });
});
