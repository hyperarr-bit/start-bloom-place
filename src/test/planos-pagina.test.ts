/**
 * /escolha (18/11, PLANOS_PAGINA) — a PÁGINA dos 2 planos:
 *   1. o <head>: chave off (a de hoje) → /escolha não vende (vai pra /oferta com a mesma query); on → data-pagina "planos";
 *      a /oferta, o /organizar, a /vida, o /vitalicio e o /simples dão os MESMOS atributos e a MESMA memória que o <head> de antes
 *      desta mudança (main ead00a4a), com a chave off E on;
 *   2. o HTML: os números escritos no cartão dos 2 planos = os do <head>; fora da /escolha nada do cartão novo aparece;
 *   3. a página no jsdom: 2 planos com os valores certos (12x de R$ 8,16), escolher plano → landing_plano {plano}; o botão abre o
 *      checkout no plano marcado; mensal no cartão → acao "assinar" (pagina planos, utm no pedido) → pago → Purchase 34,90 com
 *      eventID = assinatura; vitalício no Pix → QR → pago → Purchase 97,90 com eventID = PI; todo evento leva pagina "planos".
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { eventIdDaCompra, parcelaCentavos, reaisPlanos, textoParcela, vitalicioMenosQue3Meses } from "@/landing/planos-regras";

const raiz = resolve(__dirname, "../..");
const HTML = readFileSync(resolve(raiz, "landing.html"), "utf8");
const RE_CABECA = /<script>\s*(\(function \(\) \{\s*var LANDING_NOVA[\s\S]*?\}\)\(\);)\s*<\/script>/;
const scriptDaCabeca = HTML.match(RE_CABECA)![1];
/** o <head> de ANTES desta mudança (o main de onde o ramo saiu) — null se o git não estiver à mão */
const cabecaAntiga = (() => { try { return execSync("git show ead00a4a:landing.html", { cwd: raiz, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).match(RE_CABECA)?.[1] ?? null; } catch { return null; } })();
const comPlanos = (v: "on" | "off", fonte = scriptDaCabeca) => fonte.replace(/var PLANOS_PAGINA = "(on|off)"/, `var PLANOS_PAGINA = "${v}"`);

function rodar(fonte: string, url: string, host = "www.coreaplicativo.com.br") {
  const u = new URL(url, `https://${host}`);
  const store: Record<string, string> = {};
  const attrs: Record<string, string> = {};
  const replace = vi.fn();
  const location = { search: u.search, hash: u.hash, pathname: u.pathname, hostname: host, protocol: "https:", replace };
  const localStorage = { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; } };
  const ck = { v: "" };
  const document = { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } }, createElement: () => ({ setAttribute: () => {} }), head: { appendChild: () => {} }, get cookie() { return ck.v; }, set cookie(c: string) { ck.v = c.split(";")[0]; } };
  const window: Record<string, unknown> = { localStorage, crypto: { randomUUID: () => "11111111-2222-4333-8444-555555555555" } };
  // Math.random fixo: os sorteios por aparelho (e o AB_PIX) dão o mesmo braço nas 2 versões do <head>
  const M = Object.create(Math, { random: { value: () => 0.25 } });
  new Function("location", "document", "window", "localStorage", "URLSearchParams", "Math", "fetch", "sessionStorage", fonte)(location, document, window, localStorage, URLSearchParams, M, undefined, { getItem: () => null });
  return { attrs, replace, mem: (window.__landing ?? {}) as Record<string, unknown>, store };
}

describe("o <head> da /escolha", () => {
  it("no código: PLANOS_PAGINA on (19/11, dono: pode subir) e PLANOS_PIX_MENSAL off; preços 9790 / 3490; 12 parcelas", () => {
    expect(HTML).toMatch(/var PLANOS_PAGINA = "on";/);
    expect(HTML).toMatch(/var PLANOS_PIX_MENSAL = "off";/);
    expect(HTML).toMatch(/var PLANOS_VITALICIO_CENTAVOS = 9790;/);
    expect(HTML).toMatch(/var PLANOS_MENSAL_CENTAVOS = 3490;/);
    expect(HTML).toMatch(/var PLANOS_PARCELAS_MAX = 12;/);
  });
  it("off → /escolha NÃO vende: vai pra /oferta com a mesma query, sem data-pagina; ?planos=on no domínio de produção não liga", () => {
    for (const url of ["/escolha?utm_content=c9&fbclid=x", "/escolha/?utm_content=c9&fbclid=x", "/escolha?planos=on&utm_content=c9&fbclid=x"]) {
      const r = rodar(comPlanos("off"), url);
      expect(r.replace).toHaveBeenCalledWith(`/oferta${new URL(url, "https://x").search}`);
      expect(r.attrs["data-desligada"]).toBe("");
      expect(r.attrs["data-pagina"]).toBeUndefined();
    }
  });
  it("off + ?planos=on FORA do domínio (prints/QA) → liga, marcado como forçado (a medição separa)", () => {
    const r = rodar(comPlanos("off"), "/escolha?planos=on", "localhost");
    expect(r.replace).not.toHaveBeenCalled();
    expect(r.attrs).toMatchObject({ "data-pagina": "planos", "data-checkout-ext": "stripe" });
    expect(r.mem).toMatchObject({ pagina: "planos", planos_forcado: true });
  });
  it("on → data-pagina planos, checkout stripe, a página de hoje (lp atual, oferta sempre), sem nenhum braço da /oferta; preços na memória", () => {
    const r = rodar(comPlanos("on"), "/escolha?utm_source=fb&lp=v2&oferta=ano");
    expect(r.replace).not.toHaveBeenCalled();
    expect(r.attrs).toMatchObject({ "data-pagina": "planos", "data-checkout-ext": "stripe", "data-lp": "atual", "data-oferta": "sempre" });
    for (const a of ["data-lpo", "data-oem", "data-otp", "data-indique", "data-up-oferta", "data-cko", "data-vida"]) expect(r.attrs[a]).toBeUndefined();
    expect(r.mem).toMatchObject({ pagina: "planos", checkout_ext: "stripe", planos_vitalicio_centavos: 9790, planos_mensal_centavos: 3490, planos_parcelas_max: 12, planos_pix_mensal: false, planos_forcado: false });
    expect(r.store["landing-lp-force"]).toBeUndefined(); // não grava força do /organizar
    expect(rodar(comPlanos("on"), "/escolha?pixmensal=on").mem.planos_pix_mensal).toBe(false); // ?pixmensal só fora de produção
    expect(rodar(comPlanos("on"), "/escolha?pixmensal=on", "localhost").mem.planos_pix_mensal).toBe(true);
  });
  it("a /oferta e as outras páginas: os MESMOS atributos e a MESMA memória com a chave off, on — e iguais ao <head> de antes (ead00a4a)", () => {
    const urls = ["/oferta", "/oferta?utm_content=c7&fbclid=x", "/oferta?indique=on", "/oferta?otp=anuncio", "/organizar", "/organizar?lp=v2", "/vida", "/vitalicio", "/simples", "/tiktok", "/escolhas", "/x/escolha"];
    for (const url of urls) {
      const off = rodar(comPlanos("off"), url), on = rodar(comPlanos("on"), url);
      expect(on.attrs).toEqual(off.attrs);
      expect(on.mem).toEqual(off.mem);
      expect(on.replace.mock.calls).toEqual(off.replace.mock.calls);
      expect(off.attrs["data-pagina"]).not.toBe("planos");
      if (cabecaAntiga) {
        const antes = rodar(cabecaAntiga, url);
        expect(off.attrs).toEqual(antes.attrs);
        expect(off.mem).toEqual(antes.mem);
        expect(off.replace.mock.calls).toEqual(antes.replace.mock.calls);
      }
    }
  });
});

describe("as rotas e o HTML", () => {
  it("vercel e vite mandam /escolha (com e sem barra) pra landing.html antes do pega-tudo; a /escolha libera o Apple/Google Pay (payment) só nela", () => {
    const v = JSON.parse(readFileSync(resolve(raiz, "vercel.json"), "utf8")) as { rewrites: Array<{ source: string; destination: string }>; headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> };
    const i1 = v.rewrites.findIndex((r) => r.source === "/escolha"), i2 = v.rewrites.findIndex((r) => r.source === "/escolha/"), geral = v.rewrites.findIndex((r) => r.source.startsWith("/(("));
    expect(v.rewrites[i1]?.destination).toBe("/landing.html");
    expect(v.rewrites[i2]?.destination).toBe("/landing.html");
    expect(geral).toBeGreaterThan(Math.max(i1, i2));
    const todos = v.headers.find((h) => h.source === "/(.*)")!.headers.find((h) => h.key === "Permissions-Policy")!.value;
    expect(todos).toContain("payment=()"); // o resto do site igual
    const iTodos = v.headers.findIndex((h) => h.source === "/(.*)"), iEscolha = v.headers.findIndex((h) => h.source === "/(escolha|escolha/)");
    expect(iEscolha).toBeGreaterThan(iTodos); // a regra da /escolha vem DEPOIS (sobrescreve o cabeçalho)
    expect(v.headers[iEscolha].headers.find((h) => h.key === "Permissions-Policy")!.value).toContain('payment=(self "https://js.stripe.com")');
    expect(readFileSync(resolve(raiz, "vite.config.ts"), "utf8")).toMatch(/\\\/escolha\\\/\?\(\\\?\|\$\)/);
  });
  it("os números escritos no cartão = os do <head> (sem piscar); a parcela é a conta certa (arredonda pra cima)", () => {
    expect(HTML).toContain('<span class="pl-preco" data-pl-preco="vitalicio">R$&nbsp;97,90</span>');
    expect(HTML).toContain('<span data-pl-preco="mensal">R$&nbsp;34,90</span>');
    expect(HTML).toContain("ou 12x de R$&nbsp;8,16");
    expect(parcelaCentavos(9790, 12)).toBe(816);
    expect(parcelaCentavos(9790, 2)).toBe(4895);
    expect(textoParcela(9790, 12)).toBe("12x de R$ 8,16");
    expect(reaisPlanos(3490)).toBe("R$ 34,90");
    expect(vitalicioMenosQue3Meses(9790, 3490)).toBe(true);
    expect(vitalicioMenosQue3Meses(10500, 3490)).toBe(false);
    expect(eventIdDaCompra("vitalicio", { pi: "pi_1", sub: "sub_1" })).toBe("pi_1");
    expect(eventIdDaCompra("mensal", { pi: "pi_1", sub: "sub_1" })).toBe("sub_1");
    expect(eventIdDaCompra("mensal", { pi: "pi_1" })).toBeNull();
  });
  it("tudo que é só da /escolha mora no <template id=\"pl-tpl\"> (fora dela não existe na página), e cada peça acha o seu lugar; o 1º <style> não muda", () => {
    const tpl = HTML.match(/<template id="pl-tpl">([\s\S]*?)<\/template>/)![1];
    const fora = HTML.replace(/<template id="pl-tpl">[\s\S]*?<\/template>/, "").replace(/<style>[\s\S]*?<\/style>/g, "");
    expect(fora).not.toMatch(/<[a-z0-9]+[^>]*\sdata-so-planos/);
    const d = document.createElement("div"); d.innerHTML = corpoDe(HTML);
    const pecas = [...(d.querySelector("#pl-tpl") as HTMLTemplateElement).content.children];
    expect(pecas.length).toBe(9);
    for (const p of pecas) { expect(p.hasAttribute("data-so-planos")).toBe(true); const alvos = d.querySelectorAll(p.getAttribute("data-pl-depois")!); expect(alvos).toHaveLength(1); alvos[0].after(p.cloneNode(true)); } // na ordem: uma peça pode ir depois da anterior
    expect(tpl).toContain("Escolha seu plano");
    const primeiro = HTML.match(/<style>([\s\S]*?)<\/style>/)![1];
    expect(primeiro).not.toMatch(/planos/);
  });
});

/* ───────── a página no jsdom ───────── */
const corpoDe = (html: string) => html.match(/<body>([\s\S]*)<\/body>/)![1];
const corpo = corpoDe(HTML).replace(/<script type="module"[^>]*><\/script>/, "");
const estilos = [...HTML.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Ev = Record<string, unknown> & { nome: string };
const eventos = (): Ev[] => ((window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding ?? []);
const dos = (nome: string) => eventos().filter((e) => e.nome === nome);
let acoes: Array<Record<string, unknown>> = [];
let statusPago = false;
let fbq: ReturnType<typeof vi.fn>;
async function abrirPagina(pagina: "planos" | "oferta" = "planos") {
  await dormir(20);
  (await import("@/landing/planos-checkout"))._zerar();
  (await import("@/landing/stripe-checkout"))._zerar();
  vi.resetModules();
  localStorage.clear(); sessionStorage.clear();
  window.history.replaceState(null, "", pagina === "planos" ? "/escolha?utm_source=fb&utm_content=c9&fbclid=abc" : "/oferta?utm_content=c7");
  (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
  acoes = []; statusPago = false;
  fbq = vi.fn();
  (window as unknown as { fbq?: unknown }).fbq = fbq;
  (window as unknown as { __planosApi?: unknown }).__planosApi = {
    acao: async (c: Record<string, unknown>) => {
      acoes.push(c);
      if (c.acao === "pix") return { ok: true, plano: "vitalicio", pi: "pi_vit9", pix: { data: "00020126PIXPLANOS", expires_at: 1893456000 } };
      if (c.acao === "assinar") return { ok: true, pago: true, plano: "mensal", pi: "pi_fat9", sub: "sub_9" };
      return { ok: true, pago: true, plano: "vitalicio", pi: "pi_card9", parcelas: c.parcelas };
    },
    status: async () => ({ ok: true, status: statusPago ? "succeeded" : "requires_action", pago: statusPago, metodo: "pix" }),
  };
  (window as unknown as { __planosStripe?: unknown }).__planosStripe = {
    elements: () => ({ create: () => ({ mount: (el: HTMLElement) => { el.innerHTML = '<div data-testid="pe-falso">PE</div>'; }, on: (e: string, cb: (x: Record<string, unknown>) => void) => { if (e === "ready") setTimeout(() => cb({}), 0); } }), submit: async () => ({}) }),
    createPaymentMethod: async () => ({ paymentMethod: { id: "pm_falso1" } }),
    handleNextAction: async () => ({ paymentIntent: { status: "succeeded" } }),
    confirmPixPayment: async () => ({}),
  };
  const d = document.documentElement;
  for (const a of ["data-pagina", "data-checkout-ext", "data-pix", "data-checkout-aberto", "data-oem", "data-otp", "data-indique"]) d.removeAttribute(a);
  d.setAttribute("data-t", "a"); d.setAttribute("data-oferta", "sempre"); d.setAttribute("data-checkout", "email"); d.setAttribute("data-lp", "atual");
  d.setAttribute("data-pagina", pagina); d.setAttribute("data-checkout-ext", "stripe");
  (window as unknown as { __landing?: unknown }).__landing = pagina === "planos"
    ? { pagina: "planos", checkout_ext: "stripe", stripe_pk: "pk_test_EXEMPLO123", planos_vitalicio_centavos: 9790, planos_mensal_centavos: 3490, planos_parcelas_max: 12, planos_pix_mensal: false }
    : { pagina: "oferta", checkout_ext: "stripe", stripe_pk: "pk_test_EXEMPLO123", stripe_preco_centavos: 6790, stripe_parcelas: "Pix ou cartão", stripe_parcelas_max: 1 };
  document.head.querySelectorAll("style[data-teste-pl]").forEach((s) => s.remove());
  const st = document.createElement("style"); st.setAttribute("data-teste-pl", ""); st.textContent = estilos; document.head.appendChild(st);
  document.body.removeAttribute("style");
  document.body.innerHTML = corpo;
  await import("@/landing/landing");
  await dormir(30);
}
const visivel = (el: Element | null) => !!el && !el.closest("[hidden]") && getComputedStyle(el as HTMLElement).display !== "none";
afterEach(() => { (window as unknown as { __planosApi?: unknown }).__planosApi = undefined; (window as unknown as { __planosStripe?: unknown }).__planosStripe = undefined; });

describe("a /escolha no jsdom", () => {
  it("mostra os 2 planos com os valores certos; some o 'só hoje', o 'Pra sempre por' e o preço único da /oferta", async () => {
    await abrirPagina();
    expect(visivel(document.getElementById("pl-planos"))).toBe(true);
    const vit = document.getElementById("pl-vitalicio")!, men = document.getElementById("pl-mensal")!;
    expect(vit.textContent).toContain("R$ 97,90");
    expect(vit.textContent).toContain("ou 12x de R$ 8,16");
    expect(vit.textContent).toContain("Mais escolhido");
    expect(vit.textContent).toContain("Pague uma vez, é seu pra sempre");
    expect(men.textContent).toContain("R$ 34,90");
    expect(men.textContent).toContain("/mês");
    expect(men.textContent).toContain("Cancele quando quiser");
    expect(vit.getAttribute("aria-checked")).toBe("true");
    for (const s of [".lp-promo[data-so-lp=\"atual\"]", ".lp-preco-tit[data-so-ext=\"hotmart\"][data-so-lp=\"atual\"]", ".lp-card-faixa > span[data-so-lp=\"atual\"]", "#fim h2[data-so-ext=\"hotmart\"][data-so-lp=\"atual\"]"]) expect(visivel(document.querySelector(s))).toBe(false);
    expect(document.querySelectorAll("[data-so-planos]").length).toBe(9);
    expect(visivel(document.getElementById("lp-hotmart-atual"))).toBe(true);
    for (const e of eventos().filter((x) => x.nome.startsWith("landing_"))) expect(e).toMatchObject({ pagina: "planos", utm_content: "c9" });
  });
  it("mensal no cartão: escolher → landing_plano {mensal}; o botão abre o checkout no mensal; pagar → acao assinar (pagina planos, utm) → pago → Purchase 34,90 com eventID = assinatura (1×)", async () => {
    await abrirPagina();
    (document.getElementById("pl-mensal") as HTMLButtonElement).click();
    expect(dos("landing_plano")).toEqual([expect.objectContaining({ plano: "mensal", onde: "cartao", pagina: "planos" })]);
    (document.getElementById("lp-hotmart-atual") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (!document.querySelector("#pc-pagar:not([aria-disabled])")) throw new Error("carregando"); }, { timeout: 3000, interval: 20 });
    expect(dos("landing_cta")).toEqual(expect.arrayContaining([expect.objectContaining({ onde: "planos", plano: "mensal" })]));
    expect(dos("landing_stripe_aberto")).toEqual([expect.objectContaining({ plano: "mensal", pagina: "planos" })]);
    expect(fbq).toHaveBeenCalledWith("track", "InitiateCheckout", expect.objectContaining({ value: 34.9 }), expect.anything());
    expect(document.querySelector("[data-metodo]")).toBeNull(); // Pix do mensal desligado: só cartão
    expect(document.getElementById("pc-pagar")!.textContent).toBe("Assinar por R$ 34,90/mês");
    const email = document.getElementById("pc-email") as HTMLInputElement;
    email.value = "bia@exemplo.com"; email.dispatchEvent(new Event("input"));
    (document.getElementById("pc-pagar") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="planos-pago"]')) throw new Error("sem pago"); }, { timeout: 3000, interval: 20 });
    expect(acoes).toHaveLength(1);
    expect(acoes[0]).toMatchObject({ acao: "assinar", pagina: "planos", pm: "pm_falso1", email: "bia@exemplo.com", atrib: expect.objectContaining({ utm_content: "c9", utm_source: "fb" }), fbclid: "abc" });
    expect(dos("landing_stripe_pagar")).toEqual([expect.objectContaining({ plano: "mensal", metodo: "card" })]);
    expect(dos("landing_stripe_pago")).toEqual([expect.objectContaining({ plano: "mensal", sub: "sub_9" })]);
    const compras = fbq.mock.calls.filter((c) => c[1] === "Purchase");
    expect(compras).toHaveLength(1);
    expect(compras[0][2]).toMatchObject({ value: 34.9, currency: "BRL" });
    expect(compras[0][3]).toEqual({ eventID: "sub_9" });
    const pago = document.querySelector('[data-testid="planos-pago"]')!;
    expect(pago.textContent).toContain("Assinatura confirmada!");
    expect(pago.querySelector('a[data-loja="ios"]')).not.toBeNull();
    expect(pago.querySelector('a[data-loja="android"]')).not.toBeNull();
    expect(pago.textContent).toContain("Abrir meu CORE");
    expect(eventos().some((e) => JSON.stringify(e).includes("bia@exemplo.com"))).toBe(false); // nenhum evento leva e-mail
  });
  it("vitalício no Pix: QR → o status pagou → Purchase 97,90 com eventID = PI; o cartão oferece até 12x", async () => {
    await abrirPagina();
    (document.getElementById("lp-hotmart-atual") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (!document.querySelector("#pc-pagar:not([aria-disabled])")) throw new Error("carregando"); }, { timeout: 3000, interval: 20 });
    const sel = document.getElementById("pc-parcelas-sel") as HTMLSelectElement;
    expect(sel.options).toHaveLength(12);
    expect(sel.options[11].textContent).toBe("12x de R$ 8,16 · total R$ 97,90");
    const email = document.getElementById("pc-email") as HTMLInputElement;
    email.value = "ana@exemplo.com"; email.dispatchEvent(new Event("input"));
    (document.getElementById("pc-pagar") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="planos-pix"]')) throw new Error("sem pix"); }, { timeout: 3000, interval: 20 });
    expect(acoes[0]).toMatchObject({ acao: "pix", pagina: "planos" });
    expect(dos("landing_stripe_pix_gerado")).toEqual([expect.objectContaining({ plano: "vitalicio", pi: "pi_vit9" })]);
    statusPago = true;
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="planos-pago"]')) throw new Error("sem pago"); }, { timeout: 5000, interval: 50 });
    const compras = fbq.mock.calls.filter((c) => c[1] === "Purchase");
    expect(compras).toHaveLength(1);
    expect(compras[0][2]).toMatchObject({ value: 97.9 });
    expect(compras[0][3]).toEqual({ eventID: "pi_vit9" });
    expect(dos("landing_stripe_pago")).toEqual([expect.objectContaining({ plano: "vitalicio", metodo: "pix" })]);
  });
  it("na /oferta (chave da /escolha não importa): o cartão dos 2 planos não aparece e o botão abre o checkout de sempre", async () => {
    await abrirPagina("oferta");
    expect(visivel(document.getElementById("pl-planos"))).toBe(false);
    expect(document.querySelectorAll("[data-so-planos]")).toHaveLength(0); // o template não entra na /oferta
    expect(eventos().some((e) => e.nome === "landing_plano")).toBe(false);
  });
});
