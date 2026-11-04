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
  it("no código: CHECKOUT_HOTMART off, URL no placeholder, preço 9790, parcelas com texto", () => {
    expect(HTML).toMatch(/var CHECKOUT_HOTMART = "off";/);
    expect(HTML).toMatch(/var HOTMART_CHECKOUT_URL = "https:\/\/pay\.hotmart\.com\/PREENCHER";/);
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
      const semId = (a: Record<string, string>) => { const { "data-pix": _sorteado, ...resto } = a; return resto; }; // o AB_PIX (ligado) sorteia por aparelho novo
      expect(semId(on.attrs)).toEqual(semId(off.attrs));
    }
    expect(rodar(comChave("on"), "/organizar").attrs["data-lp"]).toBe("atual"); // AB_LP off: o /organizar segue no atual
  });

  it("/vida = sempre o braço v2, sem sorteio e sem ler nem gravar a força do ?lp do /organizar", () => {
    const store: Record<string, string> = { "landing-lp-force": "atual" };
    const r = rodar(comChave("off"), "/vida?lp=atual", store);
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
  it("todo elemento com data-so-ext é só do v2 (o /organizar no braço atual remove todos — teste byte a byte do landing-v2)", () => {
    const els = [...div.querySelectorAll("[data-so-ext]")];
    expect(els.length).toBeGreaterThan(10);
    for (const el of els) expect(el.closest('[data-so-lp="v2"]')).not.toBeNull();
  });
  it("o preço escrito no HTML do braço Hotmart é o da constante (sem piscar) e nada de 27,90 / 'no Pix' nele", () => {
    const hm = [...div.querySelectorAll('[data-so-ext="hotmart"]')];
    const texto = hm.map((e) => e.textContent ?? "").join(" | ");
    expect(texto).not.toMatch(/27,90|27\s*,90/);
    expect(texto).not.toMatch(/no Pix(?! ou)/);
    const precos = [...div.querySelectorAll("[data-hm-preco]")].map((e) => (e.textContent ?? "").replace(/\s+/g, ""));
    expect(precos.length).toBeGreaterThanOrEqual(4);
    for (const p of precos) expect(p).toBe(reaisDeCentavos(9790).replace(/\s+/g, ""));
    expect(texto).toMatch(/Pagamento seguro pela Hotmart/);
    expect(div.querySelector("[data-hm-parcelas]")!.textContent).toBe("Pix ou cartão, em até 12x");
  });
  it("cada texto do braço Pix da /vida que fala de Pix tem o par do Hotmart (preço, sub, passo, FAQ, fim, selo)", () => {
    expect(div.querySelectorAll('[data-so-ext="pix"]').length).toBe(div.querySelectorAll('[data-so-ext="hotmart"]').length - 3); // + parcelas, botão e erro do botão
  });
  it("o CSS some com o Pix (e-mail antes, #lp-pagar, #lp-pix) no braço Hotmart — tudo escopado no v2", () => {
    expect(HTML).toContain('html[data-lp="v2"][data-checkout-ext="hotmart"] .lp-email-antes, html[data-lp="v2"][data-checkout-ext="hotmart"] #lp-pagar');
    expect(HTML).toContain('html[data-lp="v2"][data-checkout-ext="hotmart"] #lp-pix { display: none !important; }');
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
async function abrir(o: { pagina?: "vida" | null; ext?: "hotmart" | "pix"; url?: string; hmUrl?: string; parcelas?: string; antes?: () => void }) {
  await dormir(25);
  vi.resetModules();
  localStorage.clear(); sessionStorage.clear(); apagarCookies();
  o.antes?.();
  window.history.replaceState(null, "", o.url ?? "/vida?utm_content=criativo_7&ad_id=120250&fbclid=abc");
  (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
  irPara = [];
  (window as unknown as { __landingIrPara?: (u: string) => void }).__landingIrPara = (u) => { irPara.push(u); };
  const d = document.documentElement;
  for (const a of ["data-pagina", "data-checkout-ext", "data-hm-sem-parcelas", "data-pix"]) d.removeAttribute(a);
  d.setAttribute("data-t", "a"); d.setAttribute("data-oferta", "sempre"); d.setAttribute("data-checkout", "email"); d.setAttribute("data-lp", "v2");
  const pagina = o.pagina === undefined ? "vida" : o.pagina;
  if (pagina) { d.setAttribute("data-pagina", pagina); d.setAttribute("data-checkout-ext", o.ext ?? "hotmart"); }
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
    expect(document.querySelector(".lp-fixo .lp2-fixo-p b")!.textContent).toBe("R$ 97,90");
    expect(document.querySelector(".lp2-cheia-baixo .lp2-fixo-p b")!.textContent).toBe("R$ 97,90");
    expect(document.querySelector('#fim p[data-so-ext="hotmart"]')!.textContent).toContain("R$ 97,90");
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
  it("vercel.json e vite.config.ts: /vida → landing.html, /vida/obrigado → vida-obrigado.html (antes do catch-all); o /organizar igual", () => {
    const v = JSON.parse(readFileSync(resolve(raiz, "vercel.json"), "utf8")) as { rewrites: Array<{ source: string; destination: string }> };
    const i = (s: string) => v.rewrites.findIndex((r) => r.source === s);
    expect(v.rewrites[i("/vida")].destination).toBe("/landing.html");
    expect(v.rewrites[i("/vida/obrigado")].destination).toBe("/vida-obrigado.html");
    expect(v.rewrites[i("/organizar")].destination).toBe("/landing.html");
    expect(i("/vida/obrigado")).toBeLessThan(i("/(.*)"));
    const vite = readFileSync(resolve(raiz, "vite.config.ts"), "utf8");
    expect(vite).toContain('vidaObrigado: path.resolve(__dirname, "vida-obrigado.html")');
    expect(vite).toContain('req.url.replace("/vida/obrigado", "/vida-obrigado.html")');
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
