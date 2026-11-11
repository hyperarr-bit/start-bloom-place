/**
 * /vida (04/11) — a LP v3 num LINK PRÓPRIO pagando pela HOTMART (R$ 97,90). O /organizar não muda.
 *
 *   1. o <head>: /organizar não ganha nada (nem data-pagina, nem data-checkout-ext, nem mem novo); /vida = sempre v2, sem
 *      sorteio, sem ler/gravar a força do ?lp; CHECKOUT_HOTMART off → Pix; on → Hotmart; on + URL placeholder → Pix; ?hotmart=on|off|auto;
 *   2. o HTML: o /organizar continua byte a byte (o landing-v2.test.ts compara com a fixture); todo elemento novo é só do v2;
 *      o preço escrito no HTML é o da constante; nada de 27,90 no braço Hotmart;
 *   3. a página no jsdom: on = o botão grava o pedido e vai pra Hotmart com sck/src(/email), sem Pix na página; off/placeholder =
 *      o Pix próprio; os eventos levam pagina:"vida" + braco_checkout_ext; no /organizar não;
 *   4. as rotas (vercel.json / vite.config.ts) e a página de obrigado.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { checkoutExtDoHtml, limparCodigo, paginaDoHtml, reaisDeCentavos, urlCheckoutHotmart, urlHotmartValida } from "@/landing/hotmart";

const raiz = resolve(__dirname, "../..");
const HTML = readFileSync(resolve(raiz, "landing.html"), "utf8");
const OBRIGADO = readFileSync(resolve(raiz, "vida-obrigado.html"), "utf8");
const scriptDaCabeca = HTML.match(/<script>\s*(\(function \(\) \{\s*var LANDING_NOVA[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];
const URL_REAL = "https://pay.hotmart.com/A12345678B";
const comChave = (hm: "on" | "off", url = URL_REAL, parcelas?: string) => {
  let f = scriptDaCabeca.replace(/var CHECKOUT_HOTMART = "(on|off)"/, `var CHECKOUT_HOTMART = "${hm}"`).replace(/var HOTMART_CHECKOUT_URL = "[^"]*"/, `var HOTMART_CHECKOUT_URL = "${url}"`);
  if (parcelas !== undefined) f = f.replace(/var HOTMART_PARCELAS_TEXTO = "[^"]*"/, `var HOTMART_PARCELAS_TEXTO = "${parcelas}"`);
  return f;
};

function rodar(fonte: string, url: string, store: Record<string, string> = {}) {
  const u = new URL(url, "https://www.coreaplicativo.com.br");
  const attrs: Record<string, string> = {};
  const location = { search: u.search, hash: u.hash, pathname: u.pathname, hostname: "www.coreaplicativo.com.br", protocol: "https:", replace: vi.fn() };
  const localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
  };
  const ck = { v: "" };
  const document = {
    documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } },
    createElement: () => ({ setAttribute: () => {} }),
    head: { appendChild: () => {} },
    get cookie() { return ck.v; },
    set cookie(c: string) { ck.v = c.split(";")[0]; },
  };
  const window: Record<string, unknown> = { localStorage, crypto: { randomUUID: () => randomUUID() } };
  new Function("location", "document", "window", "localStorage", "URLSearchParams", "Math", "fetch", "sessionStorage", fonte)(
    location, document, window, localStorage, URLSearchParams, Math, undefined, { getItem: () => null },
  );
  return { attrs, store, mem: window.__landing as Record<string, unknown> };
}

/* ───────── 1. o <head> ───────── */
describe("o <head>: /organizar intocado; /vida decide pela rota e pela chave CHECKOUT_HOTMART", () => {
  it("no código: CHECKOUT_HOTMART on (04/11, dono ligou), a URL real do checkout do dono (produto 8885020), preço 9790, parcelas com texto", () => {
    expect(HTML).toMatch(/var CHECKOUT_HOTMART = "on";/);
    expect(HTML).toMatch(/var HOTMART_CHECKOUT_URL = "https:\/\/pay\.hotmart\.com\/K108338476R\?checkoutMode=10";/);
    expect(urlHotmartValida("https://pay.hotmart.com/K108338476R?checkoutMode=10")).toBe(true);
    expect(HTML).toMatch(/var HOTMART_PRECO_CENTAVOS = 9790;/);
    expect(HTML).toMatch(/var HOTMART_PARCELAS_TEXTO = "Pix ou cartão, em até 12x";/);
  });

  it("/organizar: com a chave ON e URL real, NADA muda (sem data-pagina, sem data-checkout-ext, mem sem campos novos) — e os mesmos atributos da chave off", () => {
    for (const url of ["/organizar", "/organizar?lp=v2", "/organizar?hotmart=on", "/vidas", "/organizar/vida"]) {
      const on = rodar(comChave("on"), url, {});
      const off = rodar(comChave("off"), url, {});
      expect(on.attrs["data-pagina"]).toBeUndefined();
      expect(on.attrs["data-checkout-ext"]).toBeUndefined();
      expect(on.mem.pagina).toBeUndefined();
      expect(on.mem.checkout_ext).toBeUndefined();
      expect(on.store["landing-hotmart-force"]).toBeUndefined();
      const semId = (a: Record<string, string>) => { const { "data-pix": _sorteado, "data-lp": _lp, ...resto } = a; return resto; }; // o AB_PIX e o AB_LP (ligados) sorteiam por aparelho novo
      expect(semId(on.attrs)).toEqual(semId(off.attrs));
    }
    expect(rodar(comChave("on"), "/organizar").attrs["data-lp"]).toMatch(/^(atual|v2)$/); // 07/11: AB_LP on = o /organizar sorteia atual × v2 (a chave Hotmart não mexe nisso)
  });

  it("/vida = sempre o braço v2, sem sorteio e sem ler nem gravar a força do ?lp do /organizar", () => {
    const store: Record<string, string> = { "landing-lp-force": "atual" };
    // AB_VIDA off aqui (ligado no main desde 04/11: com ele, metade dos aparelhos novos cai no braço "atual" — o teste oscilava)
    const r = rodar(comChave("off").replace(/var AB_VIDA = "(on|off)"/, 'var AB_VIDA = "off"'), "/vida?lp=atual", store);
    expect(r.attrs["data-lp"]).toBe("v2");
    expect(r.attrs["data-pagina"]).toBe("vida");
    expect(r.mem).toMatchObject({ lp: "v2", lp_forcado: false, pagina: "vida" });
    expect(store["landing-lp-force"]).toBe("atual"); // a força do /organizar ficou como estava
    expect(rodar(comChave("off"), "/vida/").attrs["data-pagina"]).toBe("vida");
  });

  it("off → Pix próprio; on → Hotmart; on com a URL no placeholder (ou inválida) → Pix", () => {
    expect(rodar(comChave("off"), "/vida").attrs["data-checkout-ext"]).toBe("pix");
    const on = rodar(comChave("on"), "/vida");
    expect(on.attrs["data-checkout-ext"]).toBe("hotmart");
    expect(on.mem).toMatchObject({ checkout_ext: "hotmart", ab_hotmart: "on", hotmart_url: URL_REAL, hotmart_preco_centavos: 9790 });
    expect(rodar(comChave("on", "https://pay.hotmart.com/PREENCHER"), "/vida").attrs["data-checkout-ext"]).toBe("pix");
    expect(rodar(comChave("on", "https://outro.site/X1"), "/vida").attrs["data-checkout-ext"]).toBe("pix");
    expect(rodar(comChave("on", ""), "/vida").attrs["data-checkout-ext"]).toBe("pix");
  });

  it("?hotmart=on|off força e fica neste navegador; ?hotmart=auto desfaz; o placeholder vale também pro forçado", () => {
    const store: Record<string, string> = {};
    expect(rodar(comChave("off"), "/vida?hotmart=on", store).attrs["data-checkout-ext"]).toBe("hotmart");
    expect(rodar(comChave("off"), "/vida", store).mem).toMatchObject({ checkout_ext: "hotmart", hotmart_forcado: true });
    expect(rodar(comChave("on"), "/vida?hotmart=off", store).attrs["data-checkout-ext"]).toBe("pix");
    expect(rodar(comChave("on"), "/vida?hotmart=auto", store).attrs["data-checkout-ext"]).toBe("hotmart");
    expect(store["landing-hotmart-force"]).toBeUndefined();
    expect(rodar(comChave("off", "https://pay.hotmart.com/PREENCHER"), "/vida?hotmart=on", {}).attrs["data-checkout-ext"]).toBe("pix");
  });

  it('HOTMART_PARCELAS_TEXTO "" esconde a linha das parcelas antes de pintar', () => {
    expect(rodar(comChave("on", URL_REAL, ""), "/vida").attrs["data-hm-sem-parcelas"]).toBe("");
    expect(rodar(comChave("on"), "/vida").attrs["data-hm-sem-parcelas"]).toBeUndefined();
  });
});

/* ───────── 2. o HTML ───────── */
const corpoDe = (html: string) => html.match(/<body>([\s\S]*)<\/body>/)![1];
describe("o HTML do braço Hotmart", () => {
  const div = document.createElement("div");
  div.innerHTML = corpoDe(HTML);
  it("todo elemento com data-so-ext é de um braço (v2 ou atual); o CSS só mostra o da Hotmart com html[data-checkout-ext=hotmart] (o /organizar nunca tem)", () => {
    const els = [...div.querySelectorAll("[data-so-ext]")];
    expect(els.length).toBeGreaterThan(20);
    for (const el of els) expect(el.closest('[data-so-lp="v2"], [data-so-lp="atual"]')).not.toBeNull();
    expect(HTML).toContain('html:not([data-checkout-ext="hotmart"]):not([data-checkout-ext="stripe"]) [data-so-ext="hotmart"], html[data-checkout-ext="hotmart"] [data-so-ext="pix"], html[data-checkout-ext="stripe"] [data-so-ext="pix"] { display: none !important; }');
  });
  it("o preço escrito no HTML do braço Hotmart é o da constante (sem piscar) e nada de 27,90 / 'no Pix' nele", () => {
    const hm = [...div.querySelectorAll('[data-so-ext="hotmart"]')].filter((e) => e.closest('[data-so-lp="v2"]'));
    const texto = hm.map((e) => e.textContent ?? "").join(" | ");
    expect(texto).not.toMatch(/27,90|27\s*,90/);
    expect(texto).not.toMatch(/no Pix(?! ou)/);
    const precos = [...div.querySelectorAll("[data-hm-preco]")].map((e) => (e.textContent ?? "").replace(/\s+/g, ""));
    expect(precos.length).toBeGreaterThanOrEqual(4);
    for (const p of precos) expect(p).toBe(reaisDeCentavos(9790).replace(/\s+/g, ""));
    expect(texto).toMatch(/Pagamento seguro pela Hotmart/);
    expect(div.querySelector("[data-hm-parcelas]")!.textContent).toBe("Pix ou cartão, em até 12x");
  });
  it("preço do braço Hotmart (v3 e atual): espaço NÃO separável entre R$ e o número — o R$ nunca fica sozinho no fim da linha", () => {
    const hm = [...div.querySelectorAll('[data-so-ext="hotmart"]')];
    const comPreco = hm.filter((e) => /R\$/.test(e.textContent ?? ""));
    expect(comPreco.length).toBeGreaterThanOrEqual(8);
    for (const e of comPreco) expect(e.textContent).not.toMatch(/R\$[ \t\n]/);
    expect(reaisDeCentavos(9790)).toBe("R$\u00a097,90");
  });
  it("cada texto do braço Pix da /vida que fala de Pix tem o par do Hotmart (preço, sub, passo, FAQ, fim, selo), nos 2 braços", () => {
    const n = (sel: string, lp: string) => [...div.querySelectorAll(sel)].filter((e) => e.closest(`[data-so-lp="${lp}"]`)).length;
    expect(n('[data-so-ext="pix"]', "v2")).toBe(n('[data-so-ext="hotmart"]', "v2") - 3); // + parcelas, botão e erro do botão
    expect(n('[data-so-ext="pix"]', "atual")).toBe(n('[data-so-ext="hotmart"]', "atual") - 6); // + parcelas, botão e o selo da Stripe (/oferta) + o e-mail no cartão (11/11) + o painel do topo e o script dele (11/11, só com html[data-otp="anuncio"])
  });
  it("o CSS some com o Pix (e-mail antes, #lp-pagar, #lp-pix) e com a âncora 'De R$ 97,90' quando a /vida é Hotmart — só com html[data-checkout-ext]", () => {
    expect(HTML).toContain('html[data-checkout-ext="hotmart"] .lp-email-antes, html[data-checkout-ext="hotmart"] #lp-pagar, html[data-checkout-ext="hotmart"] #lp-pagar-erro, html[data-checkout-ext="hotmart"] #lp-pix, html[data-checkout-ext="hotmart"] .lp-ancora, html[data-checkout-ext="stripe"]');
  });
});

/* ───────── 3. a página no jsdom ───────── */
const corpo = corpoDe(HTML).replace(/<script type="module"[^>]*><\/script>/, "");
const estilo = HTML.match(/<style>([\s\S]*?)<\/style>/)![1];
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Ev = Record<string, unknown> & { nome: string };
const eventos = (): Ev[] => ((window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding ?? []);
const dos = (nome: string) => eventos().filter((e) => e.nome === nome);
const apagarCookies = () => { for (const c of document.cookie.split(";")) { const n = c.split("=")[0].trim(); if (n) document.cookie = `${n}=; Max-Age=0; Path=/`; } };
let irPara: string[] = [];
async function abrir(o: { pagina?: "vida" | null; ext?: "hotmart" | "pix"; url?: string; hmUrl?: string; parcelas?: string; antes?: () => void; vida?: "v3" | "atual" }) {
  await dormir(25);
  vi.resetModules();
  localStorage.clear(); sessionStorage.clear(); apagarCookies();
  o.antes?.();
  window.history.replaceState(null, "", o.url ?? "/vida?utm_content=criativo_7&ad_id=120250&fbclid=abc");
  (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
  irPara = [];
  (window as unknown as { __landingIrPara?: (u: string) => void }).__landingIrPara = (u) => { irPara.push(u); };
  const d = document.documentElement;
  for (const a of ["data-pagina", "data-checkout-ext", "data-hm-sem-parcelas", "data-pix", "data-vida"]) d.removeAttribute(a);
  d.setAttribute("data-t", "a"); d.setAttribute("data-oferta", "sempre"); d.setAttribute("data-checkout", "email"); d.setAttribute("data-lp", o.vida === "atual" ? "atual" : "v2");
  const pagina = o.pagina === undefined ? "vida" : o.pagina;
  if (pagina) { d.setAttribute("data-pagina", pagina); d.setAttribute("data-checkout-ext", o.ext ?? "hotmart"); d.setAttribute("data-vida", o.vida ?? "v3"); }
  (window as unknown as { __landing?: unknown }).__landing = pagina
    ? { pagina, checkout_ext: o.ext ?? "hotmart", hotmart_url: o.hmUrl ?? URL_REAL, hotmart_preco_centavos: 9790, hotmart_parcelas: o.parcelas ?? "Pix ou cartão, em até 12x" }
    : undefined;
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  document.head.querySelectorAll("style[data-teste-hm]").forEach((s) => s.remove());
  const st = document.createElement("style"); st.setAttribute("data-teste-hm", ""); st.textContent = estilo; document.head.appendChild(st);
  document.body.innerHTML = corpo;
  await import("@/landing/landing");
}
const visivel = (sel: string) => getComputedStyle(document.querySelector(sel)!).display !== "none";

describe("a /vida no jsdom", () => {
  it("Hotmart ON: o botão vai pro checkout com sck=<ref> e src=<utm_content>, grava o evento + InitiateCheckout, e NÃO gera Pix", async () => {
    await abrir({});
    expect(visivel("#lp-hotmart")).toBe(true);
    expect(visivel("#lp-pagar")).toBe(false);
    expect(visivel(".lp-email-antes")).toBe(false);
    expect(visivel("#lp-pix")).toBe(false);
    const fbq = vi.fn();
    (window as unknown as { fbq?: unknown }).fbq = fbq;
    (document.getElementById("lp-hotmart") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (!irPara.length) throw new Error("não saiu"); }, { timeout: 3000, interval: 30 });
    const u = new URL(irPara[0]);
    expect(`${u.origin}${u.pathname}`).toBe(URL_REAL);
    const ev = dos("landing_hotmart_redirect")[0];
    expect(u.searchParams.get("sck")).toBe(ev.ref);
    expect(String(ev.ref)).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(u.searchParams.get("src")).toBe("criativo_7");
    expect(u.searchParams.get("email")).toBeNull(); // a página não sabia o e-mail
    expect(ev).toMatchObject({ pagina: "vida", braco_checkout_ext: "hotmart", valor: 97.9 });
    expect(fbq).toHaveBeenCalledWith("track", "InitiateCheckout", expect.objectContaining({ value: 97.9, currency: "BRL" }), { eventID: `ic-${ev.ref}` });
    expect(dos("landing_pix_gerado")).toHaveLength(0);
    expect(document.getElementById("lp-pix")!.innerHTML.trim()).toBe("");
    for (const e of eventos().filter((x) => x.nome.startsWith("landing_"))) expect(e).toMatchObject({ pagina: "vida", braco_checkout_ext: "hotmart" });
    (window as unknown as { fbq?: unknown }).fbq = undefined;
  });

  it("Hotmart ON: sem utm_content o src é o ad_id", async () => {
    await abrir({ url: "/vida?ad_id=999888" });
    (document.getElementById("lp-hotmart") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (!irPara.length) throw new Error("não saiu"); }, { timeout: 3000, interval: 30 });
    expect(new URL(irPara[0]).searchParams.get("src")).toBe("999888");
  });

  it("Hotmart ON: os preços da página são o da constante (fixo e tela cheia também) e as parcelas aparecem; parcelas \"\" somem", async () => {
    await abrir({});
    expect(document.querySelector(".lp-fixo .lp2-fixo-p b")!.textContent).toBe("R$\u00a097,90");
    expect(document.querySelector(".lp2-cheia-baixo .lp2-fixo-p b")!.textContent).toBe("R$\u00a097,90");
    expect(document.querySelector('#fim p[data-so-lp="v2"][data-so-ext="hotmart"]')!.textContent).toContain("R$\u00a097,90");
    expect(document.querySelector("[data-hm-parcelas]")).not.toBeNull();
    await abrir({ parcelas: "" });
    expect(document.querySelector("[data-hm-parcelas]")).toBeNull();
  });

  it("2 toques seguidos = 1 ida só", async () => {
    await abrir({});
    const b = document.getElementById("lp-hotmart") as HTMLButtonElement;
    b.click(); b.click();
    await vi.waitFor(() => { if (!irPara.length) throw new Error("não saiu"); }, { timeout: 3000, interval: 30 });
    await dormir(50);
    expect(irPara).toHaveLength(1);
    expect(dos("landing_hotmart_redirect")).toHaveLength(1);
  });

  it("chave OFF (data-checkout-ext=pix): a /vida é a v3 com o Pix próprio de 27,90 — o botão Hotmart some e o Pix gera", async () => {
    await abrir({ ext: "pix" });
    expect(visivel("#lp-hotmart")).toBe(false);
    expect(visivel("#lp-pagar")).toBe(true);
    expect(document.getElementById("lp-pagar-txt")!.textContent).toBe("Pagar R$ 27,90 no Pix");
    expect(document.querySelector(".lp-fixo .lp2-fixo-p b")!.textContent).toBe("R$ 27,90");
    (document.getElementById("lp-hotmart") as HTMLButtonElement).click(); // escondido e sem ouvinte
    await dormir(80);
    expect(irPara).toHaveLength(0);
    for (const e of eventos().filter((x) => x.nome.startsWith("landing_"))) expect(e).toMatchObject({ pagina: "vida", braco_checkout_ext: "pix" });
  });

  it("J: voltou do checkout pelo bfcache do Safari (pageshow persisted) → o botão destrava na hora", async () => {
    await abrir({});
    const b = document.getElementById("lp-hotmart") as HTMLButtonElement;
    b.click();
    await vi.waitFor(() => { if (!irPara.length) throw new Error("não saiu"); }, { timeout: 3000, interval: 30 });
    expect(b.getAttribute("aria-busy")).toBe("true");
    expect(b.textContent).toContain("Abrindo o pagamento");
    const ev = new Event("pageshow"); Object.defineProperty(ev, "persisted", { value: true });
    window.dispatchEvent(ev);
    expect(b.getAttribute("aria-busy")).toBeNull();
    expect(b.textContent).toContain("Quero organizar minha vida");
    b.click();
    await vi.waitFor(() => { if (irPara.length < 2) throw new Error("não saiu de novo"); }, { timeout: 3000, interval: 30 });
  });

  it("URL no placeholder com o atributo hotmart (página velha em cache): o landing.ts também não vai pra Hotmart", async () => {
    await abrir({ hmUrl: "https://pay.hotmart.com/PREENCHER" });
    (document.getElementById("lp-hotmart") as HTMLButtonElement).click();
    await dormir(80);
    expect(irPara).toHaveLength(0);
  });

  it("/organizar: nenhum evento ganha pagina/braco_checkout_ext", async () => {
    await abrir({ pagina: null, url: "/organizar" });
    const l = eventos().filter((x) => x.nome.startsWith("landing_"));
    expect(l.length).toBeGreaterThan(0);
    for (const e of l) { expect(e).not.toHaveProperty("pagina"); expect(e).not.toHaveProperty("braco_checkout_ext"); }
  });
});

/* ───────── 4. o puro, as rotas e o obrigado ───────── */
describe("hotmart.ts, rotas e obrigado", () => {
  it("urlHotmartValida / urlCheckoutHotmart / limparCodigo", () => {
    expect(urlHotmartValida(URL_REAL)).toBe(true);
    expect(urlHotmartValida("https://pay.hotmart.com/PREENCHER")).toBe(false);
    expect(urlHotmartValida("http://pay.hotmart.com/X1")).toBe(false);
    const u = new URL(urlCheckoutHotmart(`${URL_REAL}?off=abc`, { ref: "ref-123456", src: "meu criativo/1", email: " Ana@Ex.com " }));
    expect(u.searchParams.get("off")).toBe("abc");
    expect(u.searchParams.get("sck")).toBe("ref-123456");
    expect(u.searchParams.get("src")).toBe("meu_criativo_1");
    expect(u.searchParams.get("email")).toBe("ana@ex.com");
    expect(new URL(urlCheckoutHotmart(URL_REAL, { ref: "ref-123456", email: "nao-e-email" })).searchParams.get("email")).toBeNull();
    expect(limparCodigo("a".repeat(300))).toHaveLength(100);
    expect(paginaDoHtml({ getAttribute: () => "vida" })).toBe("vida");
    expect(paginaDoHtml({ getAttribute: () => null })).toBeNull();
    expect(checkoutExtDoHtml({ getAttribute: () => "hotmart" })).toBe("hotmart");
    expect(checkoutExtDoHtml({ getAttribute: () => "x" })).toBeNull();
  });
  it("vercel.json e vite.config.ts: /vida e /vida/ → landing.html, /vida/obrigado e /vida/obrigado/ → vida-obrigado.html (antes do catch-all); o /organizar igual", () => {
    const v = JSON.parse(readFileSync(resolve(raiz, "vercel.json"), "utf8")) as { rewrites: Array<{ source: string; destination: string }> };
    const i = (s: string) => v.rewrites.findIndex((r) => r.source === s);
    expect(v.rewrites[i("/vida")].destination).toBe("/landing.html");
    expect(v.rewrites[i("/vida/obrigado")].destination).toBe("/vida-obrigado.html");
    expect(v.rewrites[i("/vida/")].destination).toBe("/landing.html"); // K (revisão): com barra também
    expect(v.rewrites[i("/vida/obrigado/")].destination).toBe("/vida-obrigado.html");
    expect(i("/vida/obrigado/")).toBeLessThan(i("/(.*)"));
    expect(v.rewrites[i("/organizar")].destination).toBe("/landing.html");
    expect(i("/vida/obrigado")).toBeLessThan(i("/(.*)"));
    const vite = readFileSync(resolve(raiz, "vite.config.ts"), "utf8");
    expect(vite).toContain('vidaObrigado: path.resolve(__dirname, "vida-obrigado.html")');
    expect(vite).toContain('replace(/^\\/vida\\/obrigado\\/?/, "/vida-obrigado.html")');
    const loja = readFileSync(resolve(raiz, "scripts/preparar-loja.mjs"), "utf8");
    expect(loja).toMatch(/"vida-obrigado\.html"\];/); // I (revisão): a página de obrigado não vai pro app de loja
    expect(loja).toContain('["landing.html", "vendas.html", "vida-obrigado.html"].some');
  });
  it("obrigado: lojas primeiro, e-mail em até 1 minuto, 'Já tenho conta? Entrar' (não 'Começar'), guia, contato, e SEM pixel/Purchase", () => {
    const d = document.createElement("div");
    d.innerHTML = corpoDe(OBRIGADO);
    const card = d.querySelector('[data-testid="vida-obrigado"]')!;
    const selos = card.querySelector(".ob-selos")!;
    expect(selos.querySelector('a[data-loja="ios"]')).not.toBeNull();
    expect(selos.querySelector('a[data-loja="android"]')).not.toBeNull();
    const ordem = [...card.querySelectorAll(".ob-selos, .ob-ce, .ob-guia")].map((e) => e.className);
    expect(ordem[0]).toBe("ob-selos");
    expect(card.textContent).toMatch(/e-mail da compra.*em até 1 minuto/);
    expect(card.textContent).toContain("Já tenho conta? Entrar");
    expect(card.textContent).toContain("não em “Começar”");
    expect(card.querySelector('a[href="https://www.coreaplicativo.com.br/guia/core-comece-aqui.pdf"]')).not.toBeNull();
    expect(card.textContent).toContain("contato@coreaplicativo.com.br");
    expect(OBRIGADO).not.toMatch(/fbq\(|fbevents|Purchase"/);
  });
});

/* ───────── A/B na /vida (AB_VIDA, 04/11): "v3" × "atual" (a página do /organizar com R$ 97,90 e a Hotmart) ───────── */
const comVida = (ab: "on" | "off", hm: "on" | "off" = "on") => comChave(hm).replace(/var AB_VIDA = "(on|off)"/, `var AB_VIDA = "${ab}"`);
describe("AB_VIDA no <head>", () => {
  it('no código: AB_VIDA "off" → todo mundo no v3 (data-lp v2), como antes', () => {
    expect(HTML).toMatch(/var AB_VIDA = "on";/);
    const r = rodar(comVida("off"), "/vida");
    expect(r.attrs).toMatchObject({ "data-vida": "v3", "data-lp": "v2", "data-pagina": "vida" });
    expect(r.mem).toMatchObject({ vida: "v3", ab_vida: "off", vida_forcado: false });
  });
  it('"on" = 50/50 estável por aparelho (o mesmo aparelho volta no mesmo braço); "atual" → data-lp atual', () => {
    const vistos = { v3: 0, atual: 0 };
    for (let i = 0; i < 80; i++) {
      const store: Record<string, string> = {};
      const r = rodar(comVida("on"), "/vida", store);
      const b = r.attrs["data-vida"] as "v3" | "atual";
      vistos[b]++;
      expect(r.attrs["data-lp"]).toBe(b === "atual" ? "atual" : "v2");
      expect(rodar(comVida("on"), "/vida", store).attrs["data-vida"]).toBe(b);
    }
    expect(vistos.v3).toBeGreaterThan(20);
    expect(vistos.atual).toBeGreaterThan(20);
  });
  it("?vida=atual|v3 força e fica; ?vida=auto desfaz; a força vence a chave", () => {
    const store: Record<string, string> = {};
    expect(rodar(comVida("off"), "/vida?vida=atual", store).attrs["data-vida"]).toBe("atual");
    expect(rodar(comVida("off"), "/vida", store).mem).toMatchObject({ vida: "atual", vida_forcado: true });
    expect(rodar(comVida("on"), "/vida?vida=v3", store).attrs["data-vida"]).toBe("v3");
    expect(rodar(comVida("off"), "/vida?vida=auto", store).attrs["data-vida"]).toBe("v3");
    expect(store["landing-vida-force"]).toBeUndefined();
  });
  it("/organizar com AB_VIDA on (e ?vida=atual): nada muda — sem data-vida, os mesmos atributos e a mesma memória da chave off", () => {
    for (const url of ["/organizar", "/organizar?vida=atual", "/organizar?lp=v2"]) {
      const on = rodar(comVida("on"), url, {});
      const off = rodar(comVida("off"), url, {});
      expect(on.attrs["data-vida"]).toBeUndefined();
      expect(on.mem.vida).toBeUndefined();
      expect(on.store["landing-vida-force"]).toBeUndefined();
      const sem = (a: Record<string, string>) => { const { "data-pix": _p, "data-lp": _l, ...r } = a; return r; }; // 07/11: AB_LP on também sorteia por aparelho novo
      expect(sem(on.attrs)).toEqual(sem(off.attrs));
    }
  });
});

/** as regras "display: none !important" da página (o jsdom não respeita o !important contra um display da própria classe) */
const ESCONDE = [...estilo.matchAll(/([^{}]+)\{\s*display:\s*none\s*!important;\s*\}/g)].flatMap((m) => m[1].replace(/\/\*[\s\S]*?\*\//g, "").split(",").map((x) => x.trim()).filter(Boolean));
const escondido = (el: Element) => ESCONDE.some((sel) => { try { return el.matches(sel); } catch { return false; } });
/** o texto que a pessoa VÊ (pula tudo que o CSS esconde, em qualquer ancestral) */
function textoVisivel(el: Element): string {
  if (getComputedStyle(el).display === "none" || el.hasAttribute("hidden") || escondido(el)) return "";
  if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return "";
  let t = "";
  for (const n of el.childNodes) t += n.nodeType === Node.TEXT_NODE ? n.textContent : n.nodeType === Node.ELEMENT_NODE ? ` ${textoVisivel(n as Element)} ` : "";
  return t;
}
describe("/vida braço atual no jsdom", () => {
  it("nenhum 27,90 na página visível; o preço é R$ 97,90 (título, fim, barra fixa, FAQ); sem âncora 'De R$ 97,90 por ano'; Pix ou cartão; selo da Hotmart", async () => {
    await abrir({ vida: "atual" });
    const t = textoVisivel(document.body).replace(/\s+/g, " ");
    expect(t).not.toMatch(/27,90|27\s*,\s*90/);
    expect(t).not.toMatch(/no Pix(?! ou)/);
    expect(t.replace(/\s+/g, "")).not.toContain("De R$ 97,90 por ano".replace(/\s+/g, ""));
    expect(t.replace(/\s+/g, "")).toContain("Pra sempre por R$ 97,90".replace(/\s+/g, ""));
    expect(t.replace(/\s+/g, "")).toContain("Pagamento único · nunca mais paga".replace(/\s+/g, ""));
    expect(t.replace(/\s+/g, "")).toContain("Pix ou cartão, em até 12x".replace(/\s+/g, ""));
    expect(t.replace(/\s+/g, "")).toContain("Pagamento seguro pela Hotmart".replace(/\s+/g, ""));
    expect(t.replace(/\s+/g, "")).toContain("Sua vida inteira num app só, por R$ 97,90. Pra sempre.".replace(/\s+/g, ""));
    expect(t.replace(/\s+/g, "")).toContain("Quero organizar tudo · R$ 97,90".replace(/\s+/g, ""));
    expect(t.replace(/\s+/g, "")).toContain("Devolvemos 100%, é só mandar um e-mail.".replace(/\s+/g, ""));
    expect(t.replace(/\s+/g, "")).toContain("Pague uma vez, no Pix ou no cartão".replace(/\s+/g, ""));
    const visivel2 = (sel: string) => { const el = document.querySelector(sel)!; return getComputedStyle(el).display !== "none" && !escondido(el); };
    expect(visivel2("#lp-hotmart-atual")).toBe(true);
    expect(visivel2("#lp-hotmart")).toBe(false);
    expect(visivel2("#lp-pagar")).toBe(false);
    expect(visivel2(".lp-email-antes")).toBe(false);
    expect(visivel2("#lp-pix")).toBe(false);
    expect(visivel2(".lp-ancora")).toBe(false);
    expect(visivel2("#topo")).toBe(true); // a página do /organizar (faixa e topo de hoje)
    expect(visivel2("#topo-v2")).toBe(false);
  });
  it("o botão 'Quero organizar tudo' vai pra Hotmart (sck=<ref>, src) pelo mesmo fluxo; todo evento leva braco_vida 'atual'; nada de Pix", async () => {
    await abrir({ vida: "atual" });
    const b = document.getElementById("lp-hotmart-atual") as HTMLButtonElement;
    b.click();
    await vi.waitFor(() => { if (!irPara.length) throw new Error("não saiu"); }, { timeout: 3000, interval: 30 });
    const u = new URL(irPara[0]);
    expect(`${u.origin}${u.pathname}`).toBe(URL_REAL);
    const ev = dos("landing_hotmart_redirect")[0];
    expect(u.searchParams.get("sck")).toBe(ev.ref);
    expect(u.searchParams.get("src")).toBe("criativo_7");
    expect(ev).toMatchObject({ pagina: "vida", braco_vida: "atual", braco_checkout_ext: "hotmart", braco_lp: "atual", valor: 97.9 });
    expect(dos("landing_pix_gerado")).toHaveLength(0);
    for (const e of eventos().filter((x) => x.nome.startsWith("landing_"))) expect(e.braco_vida).toBe("atual");
    expect(b.textContent).toContain("Abrindo o pagamento");
    const pv = new Event("pageshow"); Object.defineProperty(pv, "persisted", { value: true }); window.dispatchEvent(pv);
    expect(b.textContent).toContain("Quero organizar tudo");
  });
  it("braço v3: braco_vida 'v3' em todo evento", async () => {
    await abrir({ vida: "v3" });
    const l = eventos().filter((x) => x.nome.startsWith("landing_"));
    expect(l.length).toBeGreaterThan(0);
    for (const e of l) expect(e.braco_vida).toBe("v3");
  });
  it("/organizar no braço atual: nada da Hotmart visível, o Pix de 27,90 como hoje, sem braco_vida", async () => {
    await abrir({ pagina: null, vida: "atual", url: "/organizar" });
    const t = textoVisivel(document.body).replace(/\s+/g, " ");
    expect(t.replace(/\s+/g, "")).toContain("Pra sempre por R$ 27,90".replace(/\s+/g, ""));
    expect(t.replace(/\s+/g, "")).not.toContain("97,90 · Pix ou cartão".replace(/\s+/g, ""));
    expect(t.replace(/\s+/g, "")).not.toContain("Pagamento seguro pela Hotmart".replace(/\s+/g, ""));
    expect(escondido(document.querySelector("#lp-hotmart-atual")!)).toBe(true);
    expect(escondido(document.querySelector("#lp-pagar")!)).toBe(false);
    for (const e of eventos().filter((x) => x.nome.startsWith("landing_"))) expect(e).not.toHaveProperty("braco_vida");
  });
});

describe("revisão A/B (05/11): na /vida a oferta é sempre 'sempre' e o braço Hotmart não fala da caixa de e-mail", () => {
  it("?oferta=ano e a força guardada são ignorados na /vida (o /organizar segue respeitando)", () => {
    const store: Record<string, string> = { "landing-oferta-force": "ano" };
    const r = rodar(comVida("on"), "/vida?oferta=ano&vida=atual", store);
    expect(r.attrs["data-oferta"]).toBe("sempre");
    expect(r.mem.oferta_forcada).toBe(false);
    expect(store["landing-oferta-force"]).toBe("ano"); // não gravou nem apagou
    expect(rodar(comVida("on"), "/organizar?oferta=ano", {}).attrs["data-oferta"]).toBe("ano");
  });
  it("braço Hotmart (atual e v3): sem landing_email_antes_visto; /organizar segue mandando", async () => {
    type Cb = (e: Array<{ isIntersecting: boolean; target: Element; boundingClientRect: { top: number }; rootBounds?: null }>) => void;
    const vistos: Cb[] = [];
    const IO = class { constructor(cb: Cb) { vistos.push(cb); } observe() {} disconnect() {} };
    const antes = (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IO;
    const verOferta = () => {
      const alvos = ["oferta", "lp-hotmart", "lp-hotmart-atual", "lp-pagar"].map((id) => document.getElementById(id)!).filter(Boolean);
      for (const cb of vistos.splice(0)) { try { cb(alvos.map((target) => ({ isIntersecting: true, target, boundingClientRect: { top: 10 } }))); } catch { /* observador de outra coisa */ } }
    };
    try {
      for (const vida of ["atual", "v3"] as const) {
        await abrir({ vida });
        verOferta();
        expect(dos("landing_oferta_vista").length).toBeGreaterThan(0);
        expect(dos("landing_email_antes_visto")).toHaveLength(0);
      }
      await abrir({ pagina: null, vida: "atual", url: "/organizar" });
      verOferta();
      expect(dos("landing_email_antes_visto")).toHaveLength(1);
    } finally {
      (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver = antes;
    }
    const fonte = readFileSync(resolve(raiz, "src/landing/landing.ts"), "utf8");
    expect(fonte).toContain('if (brCheckout === "email" && !EXTERNO) evento("landing_email_antes_visto", {});');
  });
});
