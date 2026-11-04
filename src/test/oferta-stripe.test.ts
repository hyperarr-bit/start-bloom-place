/**
 * /oferta (04/11) — a página atual do /organizar a R$ 67,90 com o checkout STRIPE em tela cheia (Pix + cartão), sem sair do site.
 *   1. o <head>: off / pk no placeholder → vai pro /organizar; on → data-pagina oferta, página atual, oferta "sempre";
 *      /organizar e /vida iguais com a chave ligada;
 *   2. a página: nenhum 27,90 (nem 97,90) visível; R$ 67,90 com espaço não separável;
 *   3. o checkout: abre por cima (dialog, scroll travado), fecha no X / Esc / voltar do navegador; e-mail obrigatório; o valor
 *      não sai da página (só a ref); cartão → pago; Pix → QR no nosso layout → status pago → pago; Purchase com eventID = PI.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pkStripeValida, reaisDeCentavos } from "@/landing/hotmart";

const raiz = resolve(__dirname, "../..");
const HTML = readFileSync(resolve(raiz, "landing.html"), "utf8");
const scriptDaCabeca = HTML.match(/<script>\s*(\(function \(\) \{\s*var LANDING_NOVA[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];
const PK = "pk_test_EXEMPLO123";
const comStripe = (on: "on" | "off", pk = PK) => scriptDaCabeca.replace(/var CHECKOUT_STRIPE = "(on|off)"/, `var CHECKOUT_STRIPE = "${on}"`).replace(/var STRIPE_PK = "[^"]*"/, `var STRIPE_PK = "${pk}"`);

function rodar(fonte: string, url: string, store: Record<string, string> = {}) {
  const u = new URL(url, "https://www.coreaplicativo.com.br");
  const attrs: Record<string, string> = {};
  const replace = vi.fn();
  const location = { search: u.search, hash: u.hash, pathname: u.pathname, hostname: "www.coreaplicativo.com.br", protocol: "https:", replace };
  const localStorage = { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; } };
  const ck = { v: "" };
  const document = { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } }, createElement: () => ({ setAttribute: () => {} }), head: { appendChild: () => {} }, get cookie() { return ck.v; }, set cookie(c: string) { ck.v = c.split(";")[0]; } };
  const window: Record<string, unknown> = { localStorage, crypto: { randomUUID: () => randomUUID() } };
  new Function("location", "document", "window", "localStorage", "URLSearchParams", "Math", "fetch", "sessionStorage", fonte)(location, document, window, localStorage, URLSearchParams, Math, undefined, { getItem: () => null });
  return { attrs, store, replace, mem: (window.__landing ?? {}) as Record<string, unknown> };
}
const semSorteio = (a: Record<string, string>) => { const { "data-pix": _p, "data-vida": _v, "data-lp": _l, ...r } = a; return r; };

describe("o <head> da /oferta", () => {
  it("no código: CHECKOUT_STRIPE off, pk no placeholder, 6790, 12 parcelas", () => {
    expect(HTML).toMatch(/var CHECKOUT_STRIPE = "off";/);
    expect(HTML).toMatch(/var STRIPE_PK = "pk_live_PREENCHER";/);
    expect(HTML).toMatch(/var STRIPE_PRECO_CENTAVOS = 6790;/);
    expect(HTML).toMatch(/var STRIPE_PARCELAS_MAX = 12;/);
    expect(pkStripeValida("pk_live_PREENCHER")).toBe(false);
    expect(pkStripeValida(PK)).toBe(true);
  });
  it("off, ou pk no placeholder/inválida → vai pro /organizar com a mesma query (página escondida), sem data-pagina", () => {
    for (const f of [comStripe("off"), comStripe("on", "pk_live_PREENCHER"), comStripe("on", "sk_live_x"), comStripe("on", "")]) {
      const r = rodar(f, "/oferta?utm_content=c7&fbclid=x");
      expect(r.replace).toHaveBeenCalledWith("/organizar?utm_content=c7&fbclid=x");
      expect(r.attrs["data-desligada"]).toBe("");
      expect(r.attrs["data-pagina"]).toBeUndefined();
    }
  });
  it("on → data-pagina oferta, checkout stripe, a página ATUAL (sem sorteio, ignora ?lp/?vida) e a oferta 'sempre' (ignora ?oferta=ano)", () => {
    const store: Record<string, string> = { "landing-lp-force": "v2", "landing-oferta-force": "ano" };
    const r = rodar(comStripe("on"), "/oferta?lp=v2&oferta=ano&vida=v3", store);
    expect(r.replace).not.toHaveBeenCalled();
    expect(r.attrs).toMatchObject({ "data-pagina": "oferta", "data-checkout-ext": "stripe", "data-lp": "atual", "data-oferta": "sempre" });
    expect(r.attrs["data-vida"]).toBeUndefined();
    expect(r.mem).toMatchObject({ pagina: "oferta", checkout_ext: "stripe", stripe_pk: PK, stripe_preco_centavos: 6790, lp_forcado: false, oferta_forcada: false });
    expect(store).toMatchObject({ "landing-lp-force": "v2", "landing-oferta-force": "ano" }); // não mexeu na força do /organizar
    expect(rodar(comStripe("on"), "/oferta/").attrs["data-pagina"]).toBe("oferta");
  });
  it("/organizar e /vida: com CHECKOUT_STRIPE on, os mesmos atributos e a mesma memória da chave off (byte a byte no comportamento)", () => {
    for (const url of ["/organizar", "/organizar?oferta=ano", "/organizar?lp=v2", "/vida", "/vida?vida=atual", "/ofertas"]) {
      const on = rodar(comStripe("on"), url, {}), off = rodar(comStripe("off"), url, {});
      expect(semSorteio(on.attrs)).toEqual(semSorteio(off.attrs));
      expect(on.attrs["data-checkout-ext"]).not.toBe("stripe");
      expect(on.mem.stripe_pk).toBeUndefined();
      expect(on.replace).not.toHaveBeenCalled();
    }
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
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Ev = Record<string, unknown> & { nome: string };
const eventos = (): Ev[] => ((window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding ?? []);
const dos = (nome: string) => eventos().filter((e) => e.nome === nome);

type Chamada = Record<string, unknown>;
let criadas: Chamada[] = [];
let statusPago = false;
let confirmados: Array<{ tipo: string; args: unknown[] }> = [];
let pixRetorno: Record<string, unknown> | null = null;
let fbq: ReturnType<typeof vi.fn>;
async function abrirPagina(o: { pagina?: "oferta" | null; url?: string; antes?: () => void; criar?: (c: Chamada) => Promise<Record<string, unknown>>; status?: () => Promise<Record<string, unknown>> } = {}) {
  await dormir(20);
  vi.resetModules();
  localStorage.clear(); sessionStorage.clear();
  o.antes?.();
  window.history.replaceState(null, "", o.url ?? "/oferta?utm_content=c7&fbclid=abc");
  (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
  criadas = []; statusPago = false; confirmados = []; pixRetorno = null;
  fbq = vi.fn();
  (window as unknown as { fbq?: unknown }).fbq = fbq;
  (window as unknown as { __ofertaApi?: unknown }).__ofertaApi = {
    criar: async (c: Chamada) => { criadas.push(c); return o.criar ? o.criar(c) : { ok: true, clientSecret: "pi_123_secret_abc", pi: "pi_123" }; },
    status: async () => (o.status ? o.status() : { ok: true, status: statusPago ? "succeeded" : "requires_action", pago: statusPago, metodo: statusPago ? "pix" : null }),
  };
  let tipo = "card";
  const cbs: Array<(e: { value?: { type?: string } }) => void> = [];
  (window as unknown as { __stripeFalso?: unknown }).__stripeFalso = {
    elements: () => ({ create: () => ({ mount: (el: HTMLElement) => { el.innerHTML = '<div data-testid="pe-falso">PE</div>'; }, on: (_e: string, cb: (e: { value?: { type?: string } }) => void) => cbs.push(cb) }), submit: async () => ({}) }),
    confirmPayment: async (...args: unknown[]) => { confirmados.push({ tipo: "card", args }); return { paymentIntent: { id: "pi_123", status: "succeeded" } }; },
    confirmPixPayment: async (...args: unknown[]) => { confirmados.push({ tipo: "pix", args }); return pixRetorno ?? { paymentIntent: { id: "pi_123", status: "requires_action", next_action: { type: "pix_display_qr_code", pix_display_qr_code: { data: "00020126PIXSTRIPE", image_url_png: "https://qr.stripe.com/x.png", expires_at: 1893456000 } } } }; },
    _escolher: (t: string) => { tipo = t; cbs.forEach((cb) => cb({ value: { type: tipo } })); },
  };
  const d = document.documentElement;
  for (const a of ["data-pagina", "data-checkout-ext", "data-hm-sem-parcelas", "data-pix", "data-vida", "data-checkout-aberto"]) d.removeAttribute(a);
  d.setAttribute("data-t", "a"); d.setAttribute("data-oferta", "sempre"); d.setAttribute("data-checkout", "email"); d.setAttribute("data-lp", "atual");
  const pagina = o.pagina === undefined ? "oferta" : o.pagina;
  if (pagina) { d.setAttribute("data-pagina", pagina); d.setAttribute("data-checkout-ext", "stripe"); }
  (window as unknown as { __landing?: unknown }).__landing = pagina ? { pagina, checkout_ext: "stripe", stripe_pk: PK, stripe_preco_centavos: 6790, stripe_parcelas: "Pix ou cartão, em até 12x", stripe_parcelas_max: 12 } : undefined;
  document.head.querySelectorAll("style[data-teste-st]").forEach((s) => s.remove());
  const st = document.createElement("style"); st.setAttribute("data-teste-st", ""); st.textContent = estilo; document.head.appendChild(st);
  document.body.removeAttribute("style");
  document.body.innerHTML = corpo;
  const m = await import("@/landing/stripe-checkout"); m._zerar();
  await import("@/landing/landing");
}
const camada = () => document.querySelector<HTMLElement>("#oc");
const aberta = () => !!camada() && !camada()!.hidden;
async function abrirCheckout() {
  (document.getElementById("lp-hotmart-atual") as HTMLButtonElement).click();
  await vi.waitFor(() => { if (!document.querySelector('[data-testid="pe-falso"]')) throw new Error("sem PE"); }, { timeout: 3000, interval: 20 });
}
afterEach(() => { (window as unknown as { __ofertaApi?: unknown }).__ofertaApi = undefined; (window as unknown as { __stripeFalso?: unknown }).__stripeFalso = undefined; });

describe("a /oferta no jsdom", () => {
  it("nenhum 27,90 (nem 97,90) visível; R$ 67,90 com espaço não separável no cartão, no fim e na barra; Pix ou cartão; sem âncora", async () => {
    await abrirPagina();
    const t = textoVisivel(document.body);
    expect(t).not.toMatch(/27,90|97,90/);
    const s = t.replace(/\s+/g, "");
    for (const f of ["Pra sempre por R$ 67,90", "Pix ou cartão, em até 12x", "Sua vida inteira num app só, por R$ 67,90. Pra sempre.", "Pagamento seguro · Pix ou cartão", "Quero organizar tudo"]) expect(s).toContain(f.replace(/\s+/g, ""));
    expect(s).not.toContain("Hotmart");
    for (const el of document.querySelectorAll("[data-hm-preco]")) if (!escondido(el)) expect(el.textContent).toMatch(/^R\$ 67/);
    expect(reaisDeCentavos(6790)).toBe("R$ 67,90");
    expect(escondido(document.getElementById("lp-pagar")!)).toBe(true);
    expect(escondido(document.querySelector(".lp-email-antes")!)).toBe(true);
    expect(escondido(document.querySelector(".lp-ancora")!)).toBe(true);
    for (const e of eventos().filter((x) => x.nome.startsWith("landing_"))) expect(e).toMatchObject({ pagina: "oferta", braco_checkout_ext: "stripe" });
  });

  it("o botão abre o checkout em tela cheia (dialog, scroll travado, entrada no histórico); X, Esc e o voltar do navegador fecham sem sair", async () => {
    await abrirPagina();
    const url = location.href;
    await abrirCheckout();
    expect(aberta()).toBe(true);
    expect(camada()!.getAttribute("role")).toBe("dialog");
    expect(camada()!.getAttribute("aria-modal")).toBe("true");
    expect(document.body.style.position).toBe("fixed");
    expect(document.documentElement.hasAttribute("data-checkout-aberto")).toBe(true);
    expect(camada()!.textContent).toContain("CORE · Acesso vitalício");
    expect(camada()!.textContent).toContain("R$ 67,90");
    expect(camada()!.textContent).toContain("16 áreas");
    expect(camada()!.textContent).toContain("7 dias de garantia");
    expect(dos("landing_stripe_aberto")).toHaveLength(1);
    expect(fbq).toHaveBeenCalledWith("track", "InitiateCheckout", expect.objectContaining({ value: 67.9 }), expect.anything());
    window.dispatchEvent(new PopStateEvent("popstate")); // o voltar do navegador
    expect(aberta()).toBe(false);
    expect(document.body.style.position).toBe("");
    expect(location.href).toBe(url);
    await abrirCheckout();
    camada()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await vi.waitFor(() => { if (aberta()) throw new Error("aberta"); }, { timeout: 2000, interval: 20 });
    await abrirCheckout();
    (document.getElementById("oc-x") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (aberta()) throw new Error("aberta"); }, { timeout: 2000, interval: 20 });
    expect(dos("landing_stripe_fechado").map((e) => e.via)).toEqual(expect.arrayContaining(["esc", "x"]));
  });

  it("o valor nunca sai da página (o servidor decide): o corpo do stripe-criar leva a ref e os sinais, sem preço; e-mail obrigatório e corrigido", async () => {
    await abrirPagina();
    await abrirCheckout();
    expect(criadas).toHaveLength(1);
    for (const c of criadas) for (const k of Object.keys(c)) expect(k).not.toMatch(/valor|amount|preco|price/i);
    expect(criadas[0]).toMatchObject({ pagina: "oferta", fbclid: "abc", atrib: { utm_content: "c7" } });
    expect(String(criadas[0].ref)).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    (document.getElementById("oc-pagar") as HTMLButtonElement).click();
    await dormir(20);
    expect(document.getElementById("oc-email-erro")!.hidden).toBe(false);
    expect(confirmados).toHaveLength(0);
    const campo = document.getElementById("oc-email") as HTMLInputElement;
    campo.value = "maria@gmial.com"; campo.dispatchEvent(new Event("input"));
    expect(document.getElementById("oc-sug")!.textContent).toContain("maria@gmail.com");
    (document.getElementById("oc-sug") as HTMLButtonElement).click();
    expect(campo.value).toBe("maria@gmail.com");
  });

  it("cartão: confirmPayment com redirect 'if_required' → pago (lojas primeiro, Entrar, guia) + Purchase com eventID = PI; a ref é a mesma no criar e no atualizar", async () => {
    await abrirPagina();
    await abrirCheckout();
    const campo = document.getElementById("oc-email") as HTMLInputElement;
    campo.value = "maria@gmail.com"; campo.dispatchEvent(new Event("input"));
    (document.getElementById("oc-pagar") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pago"]')) throw new Error("sem pago"); }, { timeout: 3000, interval: 20 });
    expect(confirmados[0].tipo).toBe("card");
    expect(confirmados[0].args[0]).toMatchObject({ redirect: "if_required", clientSecret: "pi_123_secret_abc" });
    expect(criadas[1]).toMatchObject({ pi: "pi_123", email: "maria@gmail.com", ref: criadas[0].ref });
    const pago = document.querySelector('[data-testid="oferta-pago"]')!;
    const ordem = [...pago.querySelectorAll(".oc-selos, .oc-ce, .oc-guia")].map((e) => e.className);
    expect(ordem[0]).toBe("oc-selos");
    expect(pago.textContent).toContain("Já tenho conta? Entrar");
    expect(pago.textContent).toContain("maria@gmail.com");
    expect(pago.querySelector('a[href="https://www.coreaplicativo.com.br/guia/core-comece-aqui.pdf"]')).not.toBeNull();
    expect(fbq).toHaveBeenCalledWith("track", "Purchase", expect.objectContaining({ value: 67.9, currency: "BRL" }), { eventID: "pi_123" });
    expect(dos("landing_stripe_pago")[0]).toMatchObject({ metodo: "card", pi: "pi_123" });
  });

  it("Pix: confirmPixPayment(handleActions:false) → QR + copia-e-cola no NOSSO layout → stripe-status pago → pago", async () => {
    await abrirPagina();
    await abrirCheckout();
    (window as unknown as { __stripeFalso: { _escolher: (t: string) => void } }).__stripeFalso._escolher("pix");
    const campo = document.getElementById("oc-email") as HTMLInputElement;
    campo.value = "ana@exemplo.com"; campo.dispatchEvent(new Event("input"));
    (document.getElementById("oc-pagar") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pix"]')) throw new Error("sem pix"); }, { timeout: 3000, interval: 20 });
    expect(confirmados[0].tipo).toBe("pix");
    expect(confirmados[0].args[2]).toMatchObject({ handleActions: false });
    expect((document.getElementById("oc-codigo") as HTMLInputElement).value).toBe("00020126PIXSTRIPE");
    expect(document.querySelector<HTMLImageElement>("#oc-qr img")!.src).toBe("https://qr.stripe.com/x.png");
    expect(document.querySelector('[data-testid="oferta-pix"]')!.textContent).toContain("Esperando o Pix");
    statusPago = true;
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pago"]')) throw new Error("sem pago"); }, { timeout: 5000, interval: 50 });
    expect(dos("landing_stripe_pago")[0]).toMatchObject({ metodo: "pix" });
  });

  it("cartão recusado → mensagem da Stripe, continua no formulário, sem pago", async () => {
    await abrirPagina();
    await abrirCheckout();
    (window as unknown as { __stripeFalso: Record<string, unknown> }).__stripeFalso.confirmPayment = async () => ({ error: { type: "card_error", code: "card_declined", message: "Seu cartão foi recusado." } });
    const campo = document.getElementById("oc-email") as HTMLInputElement;
    campo.value = "maria@gmail.com"; campo.dispatchEvent(new Event("input"));
    (document.getElementById("oc-pagar") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (document.getElementById("oc-erro")!.hidden) throw new Error("sem erro"); }, { timeout: 3000, interval: 20 });
    expect(document.getElementById("oc-erro")!.textContent).toContain("recusado");
    expect(document.querySelector('[data-testid="oferta-pago"]')).toBeNull();
    expect(dos("landing_stripe_recusado")[0]).toMatchObject({ code: "card_declined" });
  });

  it("/organizar: o botão da Stripe fica escondido e não abre nada; o Pix de 27,90 continua", async () => {
    await abrirPagina({ pagina: null, url: "/organizar" });
    expect(escondido(document.getElementById("lp-hotmart-atual")!)).toBe(true);
    expect(textoVisivel(document.body).replace(/\s+/g, "")).toContain("PrasemprePorR$27,90".replace("Por", "por"));
    (document.getElementById("lp-hotmart-atual") as HTMLButtonElement).click();
    await dormir(60);
    expect(camada()).toBeNull();
  });

  it("rotas: /oferta e /oferta/ → landing.html (vercel e vite); a função do webhook sem JWT", () => {
    const v = JSON.parse(readFileSync(resolve(raiz, "vercel.json"), "utf8")) as { rewrites: Array<{ source: string; destination: string }> };
    const i = (s: string) => v.rewrites.findIndex((r) => r.source === s);
    expect(v.rewrites[i("/oferta")].destination).toBe("/landing.html");
    expect(v.rewrites[i("/oferta/")].destination).toBe("/landing.html");
    expect(i("/oferta/")).toBeLessThan(i("/(.*)"));
    expect(readFileSync(resolve(raiz, "vite.config.ts"), "utf8")).toContain('replace(/^\\/oferta\\/?/, "/landing.html")');
    expect(readFileSync(resolve(raiz, "supabase/config.toml"), "utf8")).toMatch(/\[functions\.stripe-webhook\]\nverify_jwt = false/);
  });
});

/* ───────── revisão 05/11 ───────── */
describe("revisão: fechar de verdade, recarga, volta do banco, InitiateCheckout 1×", () => {
  it("1: a camada fechada some (regra .oc[hidden] vence o display:flex) — X, Esc e voltar", async () => {
    const fonte = readFileSync(resolve(raiz, "src/landing/stripe-checkout.ts"), "utf8");
    expect(fonte).toContain(".oc[hidden]{display:none!important}");
    await abrirPagina();
    await abrirCheckout();
    expect(getComputedStyle(camada()!).display).toBe("flex");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(camada()!.hidden).toBe(true);
    expect(getComputedStyle(camada()!).display).toBe("none");
  });
  it("2: recarga com a ref e o pi guardados na aba → o stripe-criar recebe o MESMO pi e o Pix pendente volta com o MESMO QR", async () => {
    const REF = "0f8a5c2e-1111-4222-8333-944455556666";
    await abrirPagina({
      antes: () => { sessionStorage.setItem("oferta-stripe-ref", REF); sessionStorage.setItem("oferta-stripe-pi", JSON.stringify({ ref: REF, pi: "pi_123" })); },
      criar: async () => ({ ok: true, clientSecret: "pi_123_secret_abc", pi: "pi_123", status: "requires_action", pix: { data: "000201PIXMESMO", image_url_png: "https://qr/mesmo.png", expires_at: 1893456000 } }),
    });
    (document.getElementById("lp-hotmart-atual") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pix"]')) throw new Error("sem pix"); }, { timeout: 3000, interval: 20 });
    expect(criadas[0]).toMatchObject({ ref: REF, pi: "pi_123" });
    expect((document.getElementById("oc-codigo") as HTMLInputElement).value).toBe("000201PIXMESMO");
    expect(document.querySelector<HTMLImageElement>("#oc-qr img")!.src).toBe("https://qr/mesmo.png");
    expect(confirmados).toHaveLength(0); // não gerou outro Pix
  });
  it("2: o pi novo fica guardado junto da ref (a próxima recarga reaproveita)", async () => {
    await abrirPagina();
    await abrirCheckout();
    const ref = sessionStorage.getItem("oferta-stripe-ref");
    expect(JSON.parse(sessionStorage.getItem("oferta-stripe-pi")!)).toEqual({ ref, pi: "pi_123" });
  });
  it("3: volta do 3DS por redirecionamento sem conseguir conferir (outro navegador) → 'Pagamento recebido?' com as lojas; a URL fica limpa", async () => {
    await abrirPagina({ url: "/oferta?utm_content=c7&payment_intent=pi_999&payment_intent_client_secret=pi_999_secret&redirect_status=succeeded", status: async () => ({ ok: false }) });
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-recebido"]')) throw new Error("sem recebido"); }, { timeout: 3000, interval: 20 });
    const t = document.querySelector('[data-testid="oferta-recebido"]')!.textContent!;
    expect(t).toContain("Pagamento recebido?");
    expect(t).toContain("O acesso chega no seu e-mail em até 1 minuto");
    expect(document.querySelector('[data-testid="oferta-recebido"] a[data-loja="ios"]')).not.toBeNull();
    expect(location.search).toBe("?utm_content=c7");
    expect(dos("landing_stripe_recebido_sem_confirmar")).toHaveLength(1);
  });
  it("3: volta do banco que confirma → pago", async () => {
    await abrirPagina({ url: "/oferta?payment_intent=pi_123&redirect_status=succeeded", status: async () => ({ ok: true, status: "succeeded", pago: true, metodo: "card" }) });
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pago"]')) throw new Error("sem pago"); }, { timeout: 3000, interval: 20 });
    expect(location.search).toBe("");
  });
  it("5: InitiateCheckout 1× por ref (abrir e fechar 3× não repete)", async () => {
    await abrirPagina();
    for (let i = 0; i < 3; i++) { await abrirCheckout(); window.dispatchEvent(new PopStateEvent("popstate")); }
    expect(fbq.mock.calls.filter((c) => c[1] === "InitiateCheckout")).toHaveLength(1);
    expect(dos("landing_stripe_aberto")).toHaveLength(3);
  });
});
