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
import { bracoEmailOfertaDoAparelho, bracoTopoOfertaDoAparelho } from "@/landing/regras";

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
  const links: Array<{ href?: string }> = [];
  const document = { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } }, createElement: () => ({ setAttribute: () => {} }), head: { appendChild: (l: { href?: string }) => { links.push(l); } }, get cookie() { return ck.v; }, set cookie(c: string) { ck.v = c.split(";")[0]; } };
  const window: Record<string, unknown> = { localStorage, crypto: { randomUUID: () => randomUUID() } };
  new Function("location", "document", "window", "localStorage", "URLSearchParams", "Math", "fetch", "sessionStorage", fonte)(location, document, window, localStorage, URLSearchParams, Math, undefined, { getItem: () => null });
  return { attrs, store, replace, links, mem: (window.__landing ?? {}) as Record<string, unknown> };
}
const semSorteio = (a: Record<string, string>) => { const { "data-pix": _p, "data-vida": _v, "data-lp": _l, ...r } = a; return r; };

describe("o <head> da /oferta", () => {
  it("no código: CHECKOUT_STRIPE on, pk real, 6790, sem parcelas", () => {
    expect(HTML).toMatch(/var CHECKOUT_STRIPE = "on";/);
    expect(HTML).toMatch(/var STRIPE_PK = "pk_live_51TJnAQQdjmrIbUhHDSWqG1trOT6mFfV87AC4Vv47kFJTAFOhYsNmvryGRnf3x824Ke3mXSsWiFCovKPIR6Kqx0IX00VcuAawhC";/);
    expect(HTML).toMatch(/var STRIPE_PRECO_CENTAVOS = 6790;/);
    expect(HTML).toMatch(/var STRIPE_PARCELAS_MAX = 1;/);
    expect(HTML).toMatch(/var STRIPE_PARCELAS_TEXTO = "Pix ou cartão";/);
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
let opcoesElements: Record<string, unknown> | null = null;
let opcoesCartao: Record<string, unknown> | null = null;
let metodosCriados: Array<Record<string, unknown>> = [];
let enviosDoCartao = 0;
let cbsElemento: Record<string, (e: Record<string, unknown>) => void> = {};
async function abrirPagina(o: { pagina?: "oferta" | null; oem?: "atual" | "pagina"; url?: string; pedeCpf?: boolean; segurarReady?: boolean; antes?: () => void; criar?: (c: Chamada) => Promise<Record<string, unknown>>; status?: () => Promise<Record<string, unknown>> } = {}) {
  await dormir(20);
  (await import("@/landing/stripe-checkout"))._zerar(); // a espera do Pix da página anterior não vaza pra esta
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
  opcoesElements = null; opcoesCartao = null; metodosCriados = []; enviosDoCartao = 0; cbsElemento = {};
  (window as unknown as { __stripeFalso?: unknown }).__stripeFalso = {
    elements: (eo: Record<string, unknown>) => { opcoesElements = eo; return {
      create: (_t: string, co: Record<string, unknown>) => { opcoesCartao = co; return {
        mount: (el: HTMLElement) => { el.innerHTML = '<div data-testid="pe-falso">PE</div>'; if (!o.segurarReady) setTimeout(() => cbsElemento.ready?.({}), 0); },
        on: (e: string, cb: (x: Record<string, unknown>) => void) => { cbsElemento[e] = cb; },
      }; },
      submit: async () => { enviosDoCartao += 1; return {}; },
    }; },
    createPaymentMethod: async (c: Record<string, unknown>) => { metodosCriados.push(c); return { paymentMethod: { id: "pm_1" } }; },
    confirmPayment: async (...args: unknown[]) => { confirmados.push({ tipo: "card", args }); return { paymentIntent: { id: "pi_123", status: "succeeded" } }; },
    confirmPixPayment: async (...args: unknown[]) => { confirmados.push({ tipo: "pix", args }); return pixRetorno ?? { paymentIntent: { id: "pi_123", status: "requires_action", next_action: { type: "pix_display_qr_code", pix_display_qr_code: { data: "00020126PIXSTRIPE", image_url_png: "https://qr.stripe.com/x.png", expires_at: 1893456000 } } } }; },
  };
  const d = document.documentElement;
  for (const a of ["data-pagina", "data-checkout-ext", "data-hm-sem-parcelas", "data-pix", "data-vida", "data-checkout-aberto", "data-oem", "data-otp"]) d.removeAttribute(a);
  d.setAttribute("data-t", "a"); d.setAttribute("data-oferta", "sempre"); d.setAttribute("data-checkout", "email"); d.setAttribute("data-lp", "atual");
  const pagina = o.pagina === undefined ? "oferta" : o.pagina;
  if (pagina) { d.setAttribute("data-pagina", pagina); d.setAttribute("data-checkout-ext", "stripe"); }
  if (pagina && o.oem) d.setAttribute("data-oem", o.oem);
  (window as unknown as { __landing?: unknown }).__landing = pagina ? { pagina, checkout_ext: "stripe", stripe_pk: PK, stripe_preco_centavos: 6790, stripe_parcelas: "Pix ou cartão, em até 12x", stripe_parcelas_max: 12, stripe_pede_cpf: o.pedeCpf === true, ...(o.oem ? { oem: o.oem, ab_oferta_email: "on", oem_forcado: false } : {}) } : undefined;
  document.head.querySelectorAll("style[data-teste-st]").forEach((s) => s.remove());
  const st = document.createElement("style"); st.setAttribute("data-teste-st", ""); st.textContent = estilo; document.head.appendChild(st);
  document.body.removeAttribute("style");
  document.body.innerHTML = corpo;
  const m = await import("@/landing/stripe-checkout"); m._zerar();
  await import("@/landing/landing");
}
const camada = () => document.querySelector<HTMLElement>("#oc");
const aberta = () => !!camada() && !camada()!.hidden;
const pagar = () => document.getElementById("oc-pagar") as HTMLButtonElement;
const botaoMetodo = (m: "pix" | "card") => document.querySelector<HTMLButtonElement>(`[data-metodo="${m}"]`)!;
async function abrirCheckout() {
  (document.getElementById("lp-hotmart-atual") as HTMLButtonElement).click();
  await vi.waitFor(() => { if (!document.querySelector('[data-testid="pe-falso"]') || pagar().hasAttribute("aria-disabled")) throw new Error("sem PE"); }, { timeout: 3000, interval: 20 });
}
const digitarEmail = (v: string) => { const c = document.getElementById("oc-email") as HTMLInputElement; c.value = v; c.dispatchEvent(new Event("input")); };
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
    botaoMetodo("card").click();
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
    botaoMetodo("card").click();
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
    // 11/11: o catch-all do vercel.json agora deixa /assets de fora: "/((?!assets(?:/|$)).*)" → /index.html
    const CATCH_ALL = "/((?!assets(?:/|$)).*)";
    expect(i(CATCH_ALL)).toBe(v.rewrites.length - 1);
    expect(v.rewrites[i("/oferta")].destination).toBe("/landing.html");
    expect(v.rewrites[i("/oferta/")].destination).toBe("/landing.html");
    expect(i("/oferta/")).toBeLessThan(i(CATCH_ALL));
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

describe("reconferência: espera do cartão", () => {
  it("4: 1 resposta ok:false isolada não mostra 'Pagamento recebido?'; 3 seguidas mostram", async () => {
    const respostas = [{ ok: false }, { ok: true, status: "processing", pago: false }, { ok: false }, { ok: false }, { ok: false }];
    let i = 0;
    await abrirPagina({ status: async () => respostas[Math.min(i++, respostas.length - 1)] });
    await abrirCheckout();
    (window as unknown as { __stripeFalso: Record<string, unknown> }).__stripeFalso.confirmPayment = async () => ({ paymentIntent: { id: "pi_123", status: "processing" } });
    botaoMetodo("card").click();
    const campo = document.getElementById("oc-email") as HTMLInputElement;
    campo.value = "maria@gmail.com"; campo.dispatchEvent(new Event("input"));
    (document.getElementById("oc-pagar") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-aguardando"]')) throw new Error("sem espera"); }, { timeout: 3000, interval: 20 });
    await vi.waitFor(() => { if (i < 2) throw new Error("poucas"); }, { timeout: 5000, interval: 50 });
    expect(document.querySelector('[data-testid="oferta-recebido"]')).toBeNull(); // 1 erro e depois ok: segue esperando
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-recebido"]')) throw new Error("sem recebido"); }, { timeout: 12000, interval: 100 });
    expect(i).toBeGreaterThanOrEqual(5);
  }, 20000);
});

/* ───────── CPF (nota fiscal, 04/11) ───────── */
import { cpfValido, mascararCpf, soDigitosCpf } from "../../supabase/functions/_shared/cpf";
describe("CPF no checkout da /oferta", () => {
  const VALIDO = "52998224725";
  it("máscara 000.000.000-00 (digitando e colando com/sem pontuação) e dígitos verificadores", () => {
    expect(mascararCpf("529")).toBe("529");
    expect(mascararCpf("5299822")).toBe("529.982.2");
    expect(mascararCpf("52998224725")).toBe("529.982.247-25");
    expect(mascararCpf("529.982.247-25")).toBe("529.982.247-25");
    expect(mascararCpf("529 982 247 25 999")).toBe("529.982.247-25");
    expect(soDigitosCpf("529.982.247-25")).toBe(VALIDO);
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("529.982.247-24")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("5299822472")).toBe(false);
    expect(HTML).toMatch(/var STRIPE_PEDE_CPF = false;/);
  });
  it("o <head> passa STRIPE_PEDE_CPF pra página", () => {
    expect(rodar(comStripe("on"), "/oferta").mem.stripe_pede_cpf).toBe(false);
    expect(rodar(comStripe("on").replace("var STRIPE_PEDE_CPF = false;", "var STRIPE_PEDE_CPF = true;"), "/oferta").mem.stripe_pede_cpf).toBe(true);
  });
  it("STRIPE_PEDE_CPF false → o campo não existe", async () => {
    await abrirPagina({ pedeCpf: false });
    await abrirCheckout();
    expect(document.getElementById("oc-cpf")).toBeNull();
  });
  it("o campo abaixo do e-mail: teclado numérico, máscara ao digitar/colar, 'pra nota fiscal'; CPF inválido bloqueia o pagar", async () => {
    await abrirPagina({ pedeCpf: true });
    await abrirCheckout();
    const cpf = document.getElementById("oc-cpf") as HTMLInputElement;
    const email = document.getElementById("oc-email")!;
    expect(email.compareDocumentPosition(cpf) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cpf.getAttribute("inputmode")).toBe("numeric");
    expect(document.querySelector('label[for="oc-cpf"]')!.textContent).toMatch(/nota fiscal/i);
    cpf.value = "52998224725"; cpf.dispatchEvent(new Event("input"));
    expect(cpf.value).toBe("529.982.247-25");
    (email as HTMLInputElement).value = "maria@gmail.com"; email.dispatchEvent(new Event("input"));
    cpf.value = "529.982.247-24"; cpf.dispatchEvent(new Event("input"));
    (document.getElementById("oc-pagar") as HTMLButtonElement).click();
    await dormir(30);
    expect(document.getElementById("oc-cpf-erro")!.hidden).toBe(false);
    expect(document.getElementById("oc-cpf-erro")!.textContent).toContain("Confira o CPF");
    expect(confirmados).toHaveLength(0);
    expect(criadas).toHaveLength(1); // só o de abrir; o pagar nem chamou o servidor
    expect(dos("landing_cpf_erro")[0]).toEqual(expect.objectContaining({ motivo: "invalido" }));
  });
  it("CPF válido vai SÓ pro stripe-criar (dígitos) — nunca pra evento, pixel, storage", async () => {
    await abrirPagina({ pedeCpf: true });
    await abrirCheckout();
    const cpf = document.getElementById("oc-cpf") as HTMLInputElement;
    cpf.value = "529.982.247-25"; cpf.dispatchEvent(new Event("input"));
    const email = document.getElementById("oc-email") as HTMLInputElement;
    email.value = "maria@gmail.com"; email.dispatchEvent(new Event("input"));
    botaoMetodo("card").click();
    (document.getElementById("oc-pagar") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pago"]')) throw new Error("sem pago"); }, { timeout: 3000, interval: 20 });
    expect(criadas[1]).toMatchObject({ cpf: VALIDO, email: "maria@gmail.com" });
    const tudo = JSON.stringify(eventos()) + JSON.stringify(fbq.mock.calls) + JSON.stringify({ ...sessionStorage }) + JSON.stringify({ ...localStorage }) + document.cookie;
    expect(tudo).not.toContain(VALIDO);
    expect(tudo).not.toContain("529.982.247-25");
    expect(JSON.stringify((confirmados[0].args[0] as Record<string, unknown>).confirmParams)).not.toContain(VALIDO); // nada de tax_id na Stripe.js
  });
});

describe("CPF: colar com texto e vazio", () => {
  it("colar 'CPF: 529.982.247-25' não corta (sem maxlength; a máscara limita a 11 dígitos)", async () => {
    await abrirPagina({ pedeCpf: true });
    await abrirCheckout();
    const cpf = document.getElementById("oc-cpf") as HTMLInputElement;
    expect(cpf.hasAttribute("maxlength")).toBe(false);
    cpf.value = "CPF: 529.982.247-25"; cpf.dispatchEvent(new Event("input"));
    expect(cpf.value).toBe("529.982.247-25");
  });
  it("vazio → 'Digite seu CPF (pra nota fiscal).'", async () => {
    await abrirPagina({ pedeCpf: true });
    await abrirCheckout();
    const email = document.getElementById("oc-email") as HTMLInputElement;
    email.value = "maria@gmail.com"; email.dispatchEvent(new Event("input"));
    (document.getElementById("oc-pagar") as HTMLButtonElement).click();
    await dormir(30);
    expect(document.getElementById("oc-cpf-erro")!.textContent).toBe("Digite seu CPF (pra nota fiscal).");
    expect(confirmados).toHaveLength(0);
    expect(dos("landing_cpf_erro")[0]).toEqual(expect.objectContaining({ motivo: "vazio" }));
  });
});

/* ───────── 06/11: nossos botões Pix | Cartão, medição, velocidade e a carteira ───────── */
describe("Pix e Cartão: nossos botões", () => {
  it("abre no Pix: 2 botões, o texto do copia e cola, 'Gerar Pix de R$ 67,90' e nada de QR pra escanear", async () => {
    await abrirPagina();
    await abrirCheckout();
    expect(botaoMetodo("pix").getAttribute("aria-checked")).toBe("true");
    expect(botaoMetodo("card").getAttribute("aria-checked")).toBe("false");
    expect(document.querySelector('[role="radiogroup"]')!.textContent).toMatch(/Pix\s*Cartão/);
    const painel = document.querySelector<HTMLElement>('[data-testid="oferta-painel-pix"]')!;
    expect(painel.hidden).toBe(false);
    expect(painel.textContent).toContain("Pix copia e cola");
    expect(painel.textContent).toContain("Aprovado na hora. Você copia o código e paga no app do seu banco.");
    expect(pagar().textContent).toBe("Gerar Pix de R$\u00a067,90");
    expect(camada()!.textContent).not.toMatch(/escanear/i);
    expect(document.getElementById("oc-pe")!.hasAttribute("data-oculto")).toBe(true);
  });
  it("o Payment Element é SÓ de cartão, sem intent, sem carteira e sem País obrigatório; o preço do servidor não muda", async () => {
    await abrirPagina();
    await abrirCheckout();
    expect(opcoesElements).toMatchObject({ mode: "payment", amount: 6790, currency: "brl", allowedPaymentMethodTypes: ["card"], paymentMethodCreation: "manual" });
    expect(opcoesElements).not.toHaveProperty("clientSecret");
    expect(opcoesCartao).toMatchObject({ wallets: { applePay: "never", googlePay: "never", link: "never" }, fields: { billingDetails: { email: "never", address: "if_required" } } });
  });
  it("tocar em Cartão mostra o Element e 'Pagar R$ 67,90'; voltar pro Pix guarda o Element sem desmontar", async () => {
    await abrirPagina();
    await abrirCheckout();
    botaoMetodo("card").click();
    expect(botaoMetodo("card").getAttribute("aria-checked")).toBe("true");
    expect(document.querySelector<HTMLElement>('[data-testid="oferta-painel-pix"]')!.hidden).toBe(true);
    expect(document.getElementById("oc-pe")!.hasAttribute("data-oculto")).toBe(false);
    expect(pagar().textContent).toBe("Pagar R$\u00a067,90");
    botaoMetodo("pix").click();
    expect(document.getElementById("oc-pe")!.hasAttribute("data-oculto")).toBe(true);
    expect(document.querySelector('[data-testid="pe-falso"]')).not.toBeNull();
    expect(pagar().textContent).toBe("Gerar Pix de R$\u00a067,90");
  });
  it("as setas trocam o método (radiogroup) e só o marcado entra no Tab", async () => {
    await abrirPagina();
    await abrirCheckout();
    botaoMetodo("pix").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(botaoMetodo("card").getAttribute("aria-checked")).toBe("true");
    expect(botaoMetodo("card").tabIndex).toBe(0);
    expect(botaoMetodo("pix").tabIndex).toBe(-1);
  });
  it("Pix não encosta no Element: sem submit, sem PaymentMethod, confirmPixPayment com o e-mail", async () => {
    await abrirPagina();
    await abrirCheckout();
    digitarEmail("ana@exemplo.com");
    pagar().click();
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pix"]')) throw new Error("sem pix"); }, { timeout: 3000, interval: 20 });
    expect(enviosDoCartao).toBe(0);
    expect(metodosCriados).toHaveLength(0);
    expect(confirmados[0].args[0]).toBe("pi_123_secret_abc");
    expect(confirmados[0].args[1]).toEqual({ payment_method: { billing_details: { email: "ana@exemplo.com" } } });
    expect(criadas[1]).toMatchObject({ pi: "pi_123", email: "ana@exemplo.com" });
    expect(dos("landing_stripe_pix_gerado")).toHaveLength(1);
  });
  it("cartão: valida, cria o PaymentMethod com o e-mail e confirma no PI do servidor pelo payment_method (sem elements)", async () => {
    await abrirPagina();
    await abrirCheckout();
    botaoMetodo("card").click();
    digitarEmail("maria@gmail.com");
    pagar().click();
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pago"]')) throw new Error("sem pago"); }, { timeout: 3000, interval: 20 });
    expect(enviosDoCartao).toBe(1);
    expect(metodosCriados[0]).toMatchObject({ params: { billing_details: { email: "maria@gmail.com" } } });
    const arg = confirmados[0].args[0] as Record<string, unknown>;
    expect(arg).toMatchObject({ clientSecret: "pi_123_secret_abc", redirect: "if_required", confirmParams: { payment_method: "pm_1" } });
    expect(arg).not.toHaveProperty("elements");
    expect(String((arg.confirmParams as Record<string, unknown>).return_url)).toContain("/oferta");
  });
  it("a tela do Pix, o Purchase e o pós-compra continuam: fechar e reabrir no Pix gerado volta no mesmo código", async () => {
    await abrirPagina();
    await abrirCheckout();
    digitarEmail("ana@exemplo.com");
    pagar().click();
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pix"]')) throw new Error("sem pix"); }, { timeout: 3000, interval: 20 });
    window.dispatchEvent(new PopStateEvent("popstate"));
    (document.getElementById("lp-hotmart-atual") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (!aberta()) throw new Error("fechada"); }, { timeout: 2000, interval: 20 });
    expect((document.getElementById("oc-codigo") as HTMLInputElement).value).toBe("00020126PIXSTRIPE");
    expect(confirmados).toHaveLength(1);
    statusPago = true;
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pago"]')) throw new Error("sem pago"); }, { timeout: 5000, interval: 50 });
    expect(fbq.mock.calls.filter((c) => c[1] === "Purchase")).toEqual([["track", "Purchase", expect.objectContaining({ value: 67.9, currency: "BRL" }), { eventID: "pi_123" }]]);
  });
});

describe("velocidade: paralelo e Pagar travado", () => {
  it("o Element monta sem esperar o stripe-criar; Pagar fica travado até ele responder, e o toque travado é medido", async () => {
    let soltar: (v: Record<string, unknown>) => void = () => {};
    await abrirPagina({ criar: () => new Promise((ok) => { soltar = ok; }) });
    (document.getElementById("lp-hotmart-atual") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="pe-falso"]')) throw new Error("sem PE"); }, { timeout: 3000, interval: 20 });
    expect(criadas).toHaveLength(1); // o criar segue pendente e o Element já está lá
    expect(pagar().getAttribute("aria-disabled")).toBe("true");
    expect(pagar().textContent).toBe("Carregando…");
    digitarEmail("ana@exemplo.com");
    pagar().click();
    await dormir(20);
    expect(confirmados).toHaveLength(0);
    expect(dos("landing_stripe_pagar")).toHaveLength(0);
    expect(dos("landing_stripe_pagar_travado")[0]).toMatchObject({ metodo: "pix" });
    expect(dos("landing_stripe_carregou")).toHaveLength(0);
    soltar({ ok: true, clientSecret: "pi_123_secret_abc", pi: "pi_123" });
    await vi.waitFor(() => { if (pagar().hasAttribute("aria-disabled")) throw new Error("travado"); }, { timeout: 2000, interval: 20 });
    expect(pagar().textContent).toBe("Gerar Pix de R$\u00a067,90");
    expect(dos("landing_stripe_carregou")).toHaveLength(1);
    expect(typeof dos("landing_stripe_carregou")[0].ms).toBe("number");
  });
  it("Pix pronto com o Element ainda carregando: o Pix paga; o Cartão espera, travado, e destrava no ready", async () => {
    await abrirPagina({ segurarReady: true });
    await abrirCheckout();
    expect(pagar().textContent).toBe("Gerar Pix de R$\u00a067,90");
    botaoMetodo("card").click();
    expect(pagar().getAttribute("aria-disabled")).toBe("true");
    expect(document.getElementById("oc-pe-carregando")!.hidden).toBe(false);
    expect(document.getElementById("oc-pe")!.hasAttribute("data-oculto")).toBe(true);
    pagar().click();
    await dormir(10);
    expect(dos("landing_stripe_pagar_travado")[0]).toMatchObject({ metodo: "card" });
    cbsElemento.ready({});
    expect(pagar().hasAttribute("aria-disabled")).toBe(false);
    expect(pagar().textContent).toBe("Pagar R$\u00a067,90");
    expect(document.getElementById("oc-pe-carregando")!.hidden).toBe(true);
    expect(document.getElementById("oc-pe")!.hasAttribute("data-oculto")).toBe(false);
    expect(dos("landing_stripe_cartao_pronto")).toHaveLength(1);
  });
  it("o Element nunca avisa que carregou: o Cartão destrava depois da folga (não fica preso) e isso é registrado", async () => {
    await abrirPagina({ segurarReady: true });
    await abrirCheckout();
    vi.useFakeTimers();
    try {
      botaoMetodo("card").click();
      vi.advanceTimersByTime(8100);
      expect(pagar().textContent).toBe("Pagar R$\u00a067,90");
      expect(dos("landing_erro").map((e) => e.onde)).toContain("stripe_cartao_sem_ready");
    } finally { vi.useRealTimers(); }
  });
  it("o banco recusou no 3DS por redirecionamento: volta marcado no Cartão, com o aviso", async () => {
    await abrirPagina({ url: "/oferta?payment_intent=pi_123&redirect_status=failed", status: async () => ({ ok: true, status: "requires_payment_method", pago: false }) });
    await vi.waitFor(() => { if (pagar()?.textContent !== "Pagar R$\u00a067,90") throw new Error("carregando"); }, { timeout: 3000, interval: 20 });
    expect(botaoMetodo("card").getAttribute("aria-checked")).toBe("true");
    expect(document.getElementById("oc-erro")!.textContent).toContain("O banco não aprovou");
  });
  it("o stripe-criar falhou: 'Tentar de novo' refaz a carga na mesma tela, sem perder o e-mail", async () => {
    let vez = 0;
    await abrirPagina({ criar: async () => (++vez === 1 ? { ok: false, erro: "x" } : { ok: true, clientSecret: "pi_123_secret_abc", pi: "pi_123" }) });
    (document.getElementById("lp-hotmart-atual") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (pagar()?.textContent !== "Tentar de novo") throw new Error("sem erro"); }, { timeout: 3000, interval: 20 });
    expect(document.getElementById("oc-erro")!.textContent).toContain("Não consegui abrir o pagamento");
    digitarEmail("ana@exemplo.com");
    pagar().click();
    await vi.waitFor(() => { if (pagar().textContent !== "Gerar Pix de R$\u00a067,90") throw new Error("sem retry"); }, { timeout: 3000, interval: 20 });
    expect(document.getElementById("oc-erro")!.hidden).toBe(true);
    expect((document.getElementById("oc-email") as HTMLInputElement).value).toBe("ana@exemplo.com");
    expect(confirmados).toHaveLength(0);
  });
  it("o Element de cartão não carregou: o Pix continua pagando; no Cartão aparece o erro e 'Tentar de novo'", async () => {
    await abrirPagina({ segurarReady: true });
    await abrirCheckout();
    cbsElemento.loaderror({ error: { type: "api_error", code: "x" } });
    expect(pagar().textContent).toBe("Gerar Pix de R$\u00a067,90");
    botaoMetodo("card").click();
    expect(pagar().textContent).toBe("Tentar de novo");
    expect(document.getElementById("oc-erro")!.textContent).toContain("O cartão não carregou");
    botaoMetodo("pix").click();
    expect(pagar().textContent).toBe("Gerar Pix de R$\u00a067,90");
    expect(document.getElementById("oc-erro")!.hidden).toBe(true);
  });
  it("preaquecerStripe: fora de produção não baixa nada; em produção baixa 1× e o checkout reaproveita; a landing chama quando a oferta aparece", async () => {
    const m = await import("@/landing/stripe-checkout");
    m._zerar();
    const tags = () => document.head.querySelectorAll('script[src^="https://js.stripe.com/v3"]');
    tags().forEach((t) => t.remove());
    m.preaquecerStripe(PK, false);
    expect(tags()).toHaveLength(0);
    m.preaquecerStripe(PK, true);
    m.preaquecerStripe(PK, true);
    expect(tags()).toHaveLength(1);
    expect(document.head.querySelector('link[rel="preconnect"][href="https://api.stripe.com"]')).not.toBeNull();
    tags().forEach((t) => t.dispatchEvent(new Event("error")));
    expect(tags()).toHaveLength(0); // falhou: a tag sai, e abrir o checkout tenta de novo
    m.preaquecerStripe(PK, true);
    expect(tags()).toHaveLength(1);
    tags().forEach((t) => t.dispatchEvent(new Event("load"))); // carregou sem window.Stripe (bloqueador): também não pode travar o "Tentar de novo"
    expect(tags()).toHaveLength(0);
    m.preaquecerStripe(PK, true);
    expect(tags()).toHaveLength(1);
    tags().forEach((t) => t.remove());
    m._zerar();
    expect(readFileSync(resolve(raiz, "src/landing/landing.ts"), "utf8")).toMatch(/aoVerOferta = \(\) => ocioso\(\(\) => \{ void carregarStripeCheckout\(\)\.then\(\(m\) => m\.preaquecerStripe\(ST_PK, PRODUCAO\)\)/);
  });
});

describe("medição do checkout", () => {
  it("carregar não é escolher: landing_stripe_metodo só com toque, via 'toque', e repetir o marcado não conta", async () => {
    await abrirPagina();
    await abrirCheckout();
    expect(dos("landing_stripe_carregou")).toHaveLength(1);
    expect(dos("landing_stripe_metodo")).toHaveLength(0);
    botaoMetodo("pix").click();
    expect(dos("landing_stripe_metodo")).toHaveLength(0);
    botaoMetodo("card").click();
    expect(dos("landing_stripe_metodo")).toHaveLength(1);
    expect(dos("landing_stripe_metodo")[0]).toMatchObject({ metodo: "card", via: "toque" });
  });
  it("e-mail: começou e válido 1× por pedido, e o e-mail nunca vai em evento", async () => {
    await abrirPagina();
    await abrirCheckout();
    digitarEmail("m"); digitarEmail("ma"); digitarEmail("maria@gmail.com"); digitarEmail("maria@gmail.co"); digitarEmail("maria@gmail.com");
    expect(dos("landing_stripe_email_comecou")).toHaveLength(1);
    expect(dos("landing_stripe_email_valido")).toHaveLength(1);
    window.dispatchEvent(new PopStateEvent("popstate"));
    await abrirCheckout();
    digitarEmail("maria2@gmail.com");
    expect(dos("landing_stripe_email_comecou")).toHaveLength(1);
    expect(JSON.stringify(eventos())).not.toContain("gmail");
  });
  it("erro da Stripe ao tocar em Pagar: cartão incompleto fica registrado e nada é cobrado", async () => {
    await abrirPagina();
    await abrirCheckout();
    botaoMetodo("card").click();
    digitarEmail("maria@gmail.com");
    (window as unknown as { __stripeFalso: Record<string, unknown> }).__stripeFalso.createPaymentMethod = async () => ({ error: { type: "validation_error", code: "incomplete_number", message: "O número do cartão está incompleto." } });
    pagar().click();
    await vi.waitFor(() => { if (document.getElementById("oc-erro")!.hidden) throw new Error("sem erro"); }, { timeout: 3000, interval: 20 });
    expect(document.getElementById("oc-erro")!.textContent).toContain("incompleto");
    expect(dos("landing_stripe_pagar_erro")[0]).toMatchObject({ metodo: "card", etapa: "cartao", tipo: "validation_error", code: "incomplete_number" });
    expect(confirmados).toHaveLength(0);
    expect(pagar().textContent).toBe("Pagar R$\u00a067,90");
    expect(pagar().hasAttribute("aria-busy")).toBe(false);
  });
  it("erro do Pix e exceção da Stripe.js também ficam registrados, e o botão volta", async () => {
    await abrirPagina();
    await abrirCheckout();
    digitarEmail("ana@exemplo.com");
    const falso = (window as unknown as { __stripeFalso: Record<string, unknown> }).__stripeFalso;
    falso.confirmPixPayment = async () => ({ error: { type: "api_error", code: "pix_off", message: "Pix fora do ar." } });
    pagar().click();
    await vi.waitFor(() => { if (!dos("landing_stripe_pagar_erro").length) throw new Error("sem erro"); }, { timeout: 3000, interval: 20 });
    expect(dos("landing_stripe_pagar_erro")[0]).toMatchObject({ metodo: "pix", etapa: "pix", code: "pix_off" });
    falso.confirmPixPayment = async () => { throw new TypeError("quebrou"); };
    pagar().click();
    await vi.waitFor(() => { if (dos("landing_stripe_pagar_erro").length < 2) throw new Error("sem exceção"); }, { timeout: 3000, interval: 20 });
    expect(dos("landing_stripe_pagar_erro")[1]).toMatchObject({ etapa: "excecao", code: "TypeError" });
    expect(pagar().textContent).toBe("Gerar Pix de R$\u00a067,90");
  });
  it("saída com o checkout aberto: aba escondida e pagehide contam 1×, com o estado; a volta é medida; fechado não conta", async () => {
    const vis = (v: string) => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => v }); document.dispatchEvent(new Event("visibilitychange")); };
    await abrirPagina();
    await abrirCheckout();
    try {
      digitarEmail("maria");
      vis("hidden");
      window.dispatchEvent(new Event("pagehide"));
      expect(dos("landing_stripe_saiu")).toHaveLength(1);
      expect(dos("landing_stripe_saiu")[0]).toMatchObject({ via: "oculta", fase: "form", metodo: "pix", email: "digitou", carregou: true, vez: 1 });
      vis("visible");
      expect(dos("landing_stripe_voltou")).toHaveLength(1);
      window.dispatchEvent(new Event("pagehide"));
      expect(dos("landing_stripe_saiu")[1]).toMatchObject({ via: "pagehide", vez: 2 });
      vis("visible");
      window.dispatchEvent(new PopStateEvent("popstate"));
      vis("hidden");
      expect(dos("landing_stripe_saiu")).toHaveLength(2);
    } finally { delete (document as unknown as { visibilityState?: string }).visibilityState; }
  });
  it("o voltar do navegador agora conta como fechado; o X não conta 2×", async () => {
    await abrirPagina();
    await abrirCheckout();
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(dos("landing_stripe_fechado").map((e) => e.via)).toEqual(["voltar"]);
    await abrirCheckout();
    (document.getElementById("oc-x") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (aberta()) throw new Error("aberta"); }, { timeout: 2000, interval: 20 });
    expect(dos("landing_stripe_fechado").map((e) => e.via)).toEqual(["voltar", "x"]);
  });
  it("todo evento novo leva os braços da landing", async () => {
    await abrirPagina();
    await abrirCheckout();
    botaoMetodo("card").click();
    digitarEmail("maria@gmail.com");
    for (const nome of ["landing_stripe_carregou", "landing_stripe_cartao_pronto", "landing_stripe_metodo", "landing_stripe_email_comecou", "landing_stripe_email_valido"]) {
      expect(dos(nome)[0]).toMatchObject({ pagina: "oferta", braco_checkout_ext: "stripe", braco_lp: "atual", braco_oferta: "sempre" });
    }
  });
});

describe("carteira: só medição, desligada", () => {
  const abrirDireto = async (medirCarteira?: boolean) => {
    const m = await import("@/landing/stripe-checkout");
    const lista: Array<{ nome: string; dados?: Record<string, unknown> }> = [];
    m._zerar();
    await m.abrirCheckout({ pk: PK, precoCentavos: 6790, parcelasMax: 1, producao: false, medirCarteira, evento: (nome, dados) => lista.push({ nome, dados }), pixel: () => {}, atrib: {}, sessao: "s", aparelho: "a", urlChegada: "https://x/oferta", fbclid: null });
    await vi.waitFor(() => { if (!lista.some((e) => e.nome === "landing_stripe_carregou")) throw new Error("carregando"); }, { timeout: 3000, interval: 20 });
    await dormir(10);
    return lista;
  };
  it("a chave fica off no código; desligada, não consulta nada", async () => {
    expect(readFileSync(resolve(raiz, "src/landing/stripe-checkout.ts"), "utf8")).toMatch(/const MEDIR_CARTEIRA = "off" as/);
    await abrirPagina();
    const paymentRequest = vi.fn();
    (window as unknown as { __stripeFalso: Record<string, unknown> }).__stripeFalso.paymentRequest = paymentRequest;
    const l = await abrirDireto();
    expect(paymentRequest).not.toHaveBeenCalled();
    expect(l.some((e) => e.nome === "landing_stripe_carteira")).toBe(false);
  });
  it("ligada: 1 evento com o que o aparelho tem, sem desenhar nada e sem ligar a carteira no Element", async () => {
    await abrirPagina();
    const paymentRequest = vi.fn(() => ({ canMakePayment: async () => ({ applePay: true, googlePay: false }) }));
    (window as unknown as { __stripeFalso: Record<string, unknown> }).__stripeFalso.paymentRequest = paymentRequest;
    const l = await abrirDireto(true);
    expect(paymentRequest).toHaveBeenCalledWith(expect.objectContaining({ country: "BR", currency: "brl", total: { label: "CORE", amount: 6790 } }));
    expect(l.filter((e) => e.nome === "landing_stripe_carteira")).toEqual([{ nome: "landing_stripe_carteira", dados: { apple_pay: true, google_pay: false, apple_aparelho: "sem_api", demorou: false } }]);
    expect(opcoesCartao).toMatchObject({ wallets: { applePay: "never", googlePay: "never" } });
    expect(camada()!.textContent).not.toMatch(/Apple Pay|Google Pay/);
  });
  it("ligada e a consulta quebra: o pagamento segue", async () => {
    await abrirPagina();
    (window as unknown as { __stripeFalso: Record<string, unknown> }).__stripeFalso.paymentRequest = () => { throw new Error("sem"); };
    const l = await abrirDireto(true);
    expect(l.find((e) => e.nome === "landing_stripe_carteira")?.dados).toMatchObject({ apple_pay: false, erro: true });
    expect(pagar().textContent).toBe("Gerar Pix de R$\u00a067,90");
  });
});

/* ───────── 06/11: crítica independente ───────── */
const opcoesDiretas = (extra: Record<string, unknown> = {}) => ({ pk: PK, precoCentavos: 6790, parcelasMax: 1, producao: false, evento: (nome: string, dados?: Record<string, unknown>) => { eventos().push({ nome, ...dados }); }, pixel: () => {}, atrib: {}, sessao: "s", aparelho: "a", urlChegada: "https://x/oferta", fbclid: null, ...extra });

describe("M1: Stripe.js pendurado não prende a pessoa", () => {
  const tags = () => document.head.querySelectorAll('script[src^="https://js.stripe.com/v3"]');
  const semStripeFalso = () => { (window as unknown as { __stripeFalso?: unknown }).__stripeFalso = undefined; };
  afterEach(() => { vi.useRealTimers(); tags().forEach((t) => t.remove()); });

  it("o script nunca responde: em 12 s a tag sai, landing_erro e 'Tentar de novo', que baixa de novo", async () => {
    await abrirPagina();
    semStripeFalso();
    const m = await import("@/landing/stripe-checkout");
    m._zerar();
    vi.useFakeTimers();
    await m.abrirCheckout(opcoesDiretas({ producao: true }));
    await vi.advanceTimersByTimeAsync(11_900);
    expect(pagar().textContent).toBe("Carregando…");
    expect(tags()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(tags()).toHaveLength(0);
    expect(pagar().textContent).toBe("Tentar de novo");
    expect(pagar().hasAttribute("aria-disabled")).toBe(false);
    expect(document.getElementById("oc-erro")!.textContent).toContain("O pagamento não carregou");
    expect(dos("landing_erro").map((e) => e.onde)).toContain("stripe_js");
    pagar().click();
    await vi.advanceTimersByTimeAsync(10);
    expect(tags()).toHaveLength(1);
    expect(pagar().textContent).toBe("Carregando…");
  });
  it("depois do preload: o relógio conta do preload, e quem abre no meio não espera outros 12 s", async () => {
    await abrirPagina();
    semStripeFalso();
    const m = await import("@/landing/stripe-checkout");
    m._zerar();
    vi.useFakeTimers();
    m.preaquecerStripe(PK, true);
    await vi.advanceTimersByTimeAsync(5_000);
    await m.abrirCheckout(opcoesDiretas({ producao: true }));
    expect(tags()).toHaveLength(1); // reaproveita o do preload
    await vi.advanceTimersByTimeAsync(7_100);
    expect(pagar().textContent).toBe("Tentar de novo");
    expect(tags()).toHaveLength(0);
  });
  it("preload pendurado com a oferta na tela e ninguém no checkout: desiste quieto, e abrir tenta de novo", async () => {
    await abrirPagina();
    semStripeFalso();
    const m = await import("@/landing/stripe-checkout");
    m._zerar();
    vi.useFakeTimers();
    m.preaquecerStripe(PK, true);
    await vi.advanceTimersByTimeAsync(12_100);
    expect(tags()).toHaveLength(0);
    await m.abrirCheckout(opcoesDiretas({ producao: true }));
    await vi.advanceTimersByTimeAsync(10);
    expect(tags()).toHaveLength(1);
    expect(pagar().textContent).toBe("Carregando…");
  });
  it("carregou a tempo: o teto não derruba nada depois", async () => {
    await abrirPagina();
    semStripeFalso();
    const m = await import("@/landing/stripe-checkout");
    m._zerar();
    vi.useFakeTimers();
    m.preaquecerStripe(PK, true);
    const tag = tags()[0];
    await vi.advanceTimersByTimeAsync(1_000);
    (window as unknown as { Stripe?: unknown }).Stripe = () => ({});
    tag.dispatchEvent(new Event("load"));
    await vi.advanceTimersByTimeAsync(20_000);
    expect(tags()).toHaveLength(1);
    (window as unknown as { Stripe?: unknown }).Stripe = undefined;
  });
});

describe("M2: erro síncrono no cartão não derruba o Pix", () => {
  it("elements() lança: o Pix gera normal; no Cartão, erro e 'Tentar de novo'", async () => {
    await abrirPagina();
    (window as unknown as { __stripeFalso: Record<string, unknown> }).__stripeFalso.elements = () => { throw new TypeError("quebrou"); };
    (document.getElementById("lp-hotmart-atual") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (pagar()?.textContent !== "Gerar Pix de R$\u00a067,90") throw new Error("carregando"); }, { timeout: 3000, interval: 20 });
    expect(dos("landing_erro")[0]).toMatchObject({ onde: "stripe_cartao", msg: "TypeError" });
    expect(dos("landing_erro").map((e) => e.onde)).not.toContain("stripe_js");
    botaoMetodo("card").click();
    expect(pagar().textContent).toBe("Tentar de novo");
    expect(document.getElementById("oc-erro")!.textContent).toContain("O cartão não carregou");
    botaoMetodo("pix").click();
    digitarEmail("ana@exemplo.com");
    pagar().click();
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pix"]')) throw new Error("sem pix"); }, { timeout: 3000, interval: 20 });
    expect(confirmados[0].tipo).toBe("pix");
  });
});

describe("M3: trocar o Pix gerado pelo cartão", () => {
  const PIX = { data: "000PIXVELHO", image_url_png: "https://qr/velho.png", expires_at: 1893456000 };
  async function naTelaDoPix(responder: (c: Chamada) => Record<string, unknown>, extra: Record<string, unknown> = { trocaCartao: true }) {
    await abrirPagina({ criar: async (c) => (c.trocar_pix ? responder(c) : c.pi === "pi_novo" ? { ok: true, clientSecret: "pi_novo_secret", pi: "pi_novo", status: "requires_payment_method", pix: null } : { ok: true, clientSecret: "pi_123_secret_abc", pi: "pi_123" }) });
    const m = await import("@/landing/stripe-checkout");
    m._zerar();
    await m.abrirCheckout(opcoesDiretas(extra));
    await vi.waitFor(() => { if (pagar()?.hasAttribute("aria-disabled")) throw new Error("carregando"); }, { timeout: 3000, interval: 20 });
    digitarEmail("ana@exemplo.com");
    pagar().click();
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pix"]')) throw new Error("sem pix"); }, { timeout: 3000, interval: 20 });
    return m;
  }
  const trocar = () => document.getElementById("oc-trocar") as HTMLButtonElement;

  it("a chave nasce off e, desligada, o link não aparece", async () => {
    expect(readFileSync(resolve(raiz, "src/landing/stripe-checkout.ts"), "utf8")).toMatch(/const PIX_TROCA_CARTAO = "off" as/);
    await naTelaDoPix(() => ({ ok: false }), {});
    expect(trocar()).toBeNull();
  });
  it("servidor cancelou e devolveu outro PI: volta no Cartão, com o e-mail, e paga no PI novo; reabrir não traz o QR", async () => {
    const m = await naTelaDoPix(() => ({ ok: true, clientSecret: "pi_novo_secret", pi: "pi_novo", status: "requires_payment_method", pix: null }));
    expect(trocar().textContent).toBe("Prefiro pagar com cartão");
    trocar().click();
    await vi.waitFor(() => { if (!document.getElementById("oc-email")) throw new Error("sem form"); }, { timeout: 3000, interval: 20 });
    expect(criadas.find((c) => c.trocar_pix)).toMatchObject({ pi: "pi_123", trocar_pix: true, email: null });
    expect(botaoMetodo("card").getAttribute("aria-checked")).toBe("true");
    expect((document.getElementById("oc-email") as HTMLInputElement).value).toBe("ana@exemplo.com");
    expect(JSON.parse(sessionStorage.getItem("oferta-stripe-pi")!).pi).toBe("pi_novo");
    expect(dos("landing_stripe_pix_trocou")[0]).toMatchObject({ ok: true });
    window.dispatchEvent(new PopStateEvent("popstate"));
    await m.abrirCheckout(opcoesDiretas({ trocaCartao: true }));
    await vi.waitFor(() => { if (pagar()?.textContent !== "Pagar R$\u00a067,90") throw new Error("carregando"); }, { timeout: 3000, interval: 20 });
    expect(document.querySelector('[data-testid="oferta-pix"]')).toBeNull();
    expect(criadas.at(-1)).toMatchObject({ pi: "pi_novo" });
    pagar().click();
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pago"]')) throw new Error("sem pago"); }, { timeout: 3000, interval: 20 });
    expect(confirmados.at(-1)!.args[0]).toMatchObject({ clientSecret: "pi_novo_secret", confirmParams: { payment_method: "pm_1" } });
  });
  it("servidor antigo devolve o mesmo PI com o Pix: fica no Pix, avisa, e o cartão não abre (não dá pra pagar 2×)", async () => {
    await naTelaDoPix(() => ({ ok: true, clientSecret: "pi_123_secret_abc", pi: "pi_123", status: "requires_action", pix: PIX }));
    trocar().click();
    await vi.waitFor(() => { if (document.getElementById("oc-erro")!.hidden) throw new Error("sem erro"); }, { timeout: 3000, interval: 20 });
    expect(document.getElementById("oc-erro")!.textContent).toBe("Não deu pra trocar agora. Este Pix continua valendo.");
    expect(document.querySelector('[data-testid="oferta-pix"]')).not.toBeNull();
    expect(document.getElementById("oc-email")).toBeNull();
    expect(dos("landing_stripe_pix_trocou")[0]).toMatchObject({ ok: false, motivo: "mesmo_pi" });
    expect(JSON.parse(sessionStorage.getItem("oferta-stripe-pi")!).pi).toBe("pi_123");
  });
  it("PI novo mas ainda com Pix, ou falha: também fica no Pix", async () => {
    await naTelaDoPix(() => ({ ok: true, clientSecret: "x_secret", pi: "pi_outro", pix: PIX }));
    trocar().click();
    await vi.waitFor(() => { if (document.getElementById("oc-erro")!.hidden) throw new Error("sem erro"); }, { timeout: 3000, interval: 20 });
    expect(document.getElementById("oc-email")).toBeNull();
    await naTelaDoPix(() => ({ ok: false }));
    trocar().click();
    await vi.waitFor(() => { if (document.getElementById("oc-erro")!.hidden) throw new Error("sem erro"); }, { timeout: 3000, interval: 20 });
    expect(dos("landing_stripe_pix_trocou")[0]).toMatchObject({ ok: false, motivo: "falhou" });
  });
  it("o Pix caiu antes do cancelamento: vai pro pago, sem abrir o cartão", async () => {
    await naTelaDoPix(() => ({ ok: true, clientSecret: "pi_123_secret_abc", pi: "pi_123", status: "succeeded", pix: null }));
    trocar().click();
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pago"]')) throw new Error("sem pago"); }, { timeout: 3000, interval: 20 });
    expect(dos("landing_stripe_pix_trocou")[0]).toMatchObject({ ok: false, motivo: "ja_pago" });
  });
});

describe("B3: reabrir depois de pago", () => {
  it("redesenha o pago, sem landing_stripe_pago nem Purchase de novo, e não volta pro formulário", async () => {
    await abrirPagina();
    await abrirCheckout();
    botaoMetodo("card").click();
    digitarEmail("maria@gmail.com");
    pagar().click();
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pago"]')) throw new Error("sem pago"); }, { timeout: 3000, interval: 20 });
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(aberta()).toBe(false);
    const criadosAntes = criadas.length;
    (document.getElementById("lp-hotmart-atual") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (!aberta()) throw new Error("fechada"); }, { timeout: 2000, interval: 20 });
    expect(document.querySelector('[data-testid="oferta-pago"]')!.textContent).toContain("maria@gmail.com");
    expect(document.getElementById("oc-email")).toBeNull();
    expect(dos("landing_stripe_pago")).toHaveLength(1);
    expect(fbq.mock.calls.filter((c) => c[1] === "Purchase")).toHaveLength(1);
    expect(criadas).toHaveLength(criadosAntes);
  });
});

describe("stripe-criar pendurado", () => {
  afterEach(() => { vi.useRealTimers(); });
  it("ao abrir: em 12 s, landing_erro e 'Tentar de novo', que chama de novo e libera; a resposta atrasada não mexe em nada", async () => {
    let vez = 0;
    let atrasada: (v: Record<string, unknown>) => void = () => {};
    await abrirPagina({ criar: () => (++vez === 1 ? new Promise((ok) => { atrasada = ok; }) : Promise.resolve({ ok: true, clientSecret: "pi_123_secret_abc", pi: "pi_123" })) });
    const m = await import("@/landing/stripe-checkout");
    m._zerar();
    vi.useFakeTimers();
    await m.abrirCheckout(opcoesDiretas());
    await vi.advanceTimersByTimeAsync(11_900);
    expect(pagar().textContent).toBe("Carregando…");
    await vi.advanceTimersByTimeAsync(200);
    expect(pagar().textContent).toBe("Tentar de novo");
    expect(pagar().hasAttribute("aria-disabled")).toBe(false);
    expect(document.getElementById("oc-erro")!.textContent).toContain("Não consegui abrir o pagamento");
    expect(dos("landing_erro").find((e) => e.onde === "stripe_criar")).toMatchObject({ msg: "teto" });
    pagar().click();
    await vi.advanceTimersByTimeAsync(10);
    expect(vez).toBe(2);
    expect(pagar().textContent).toBe("Gerar Pix de R$\u00a067,90");
    atrasada({ ok: true, clientSecret: "pi_velho_secret", pi: "pi_velho" });
    await vi.advanceTimersByTimeAsync(10);
    expect(pagar().textContent).toBe("Gerar Pix de R$\u00a067,90");
    expect(JSON.parse(sessionStorage.getItem("oferta-stripe-pi")!).pi).toBe("pi_123");
  });
  it("ao tocar em pagar: em 12 s o botão volta com o erro, e nada é confirmado", async () => {
    await abrirPagina({ criar: (c) => (c.email ? new Promise(() => {}) : Promise.resolve({ ok: true, clientSecret: "pi_123_secret_abc", pi: "pi_123" })) });
    await abrirCheckout();
    digitarEmail("ana@exemplo.com");
    vi.useFakeTimers();
    pagar().click();
    await vi.advanceTimersByTimeAsync(11_900);
    expect(pagar().getAttribute("aria-busy")).toBe("true");
    await vi.advanceTimersByTimeAsync(200);
    expect(pagar().hasAttribute("aria-busy")).toBe(false);
    expect(pagar().textContent).toBe("Gerar Pix de R$\u00a067,90");
    expect(document.getElementById("oc-erro")!.textContent).toContain("Não consegui registrar o pagamento");
    expect(dos("landing_stripe_pagar_erro")[0]).toMatchObject({ metodo: "pix", etapa: "criar" });
    expect(dos("landing_erro").find((e) => e.onde === "stripe_criar")).toMatchObject({ msg: "teto" });
    expect(confirmados).toHaveLength(0);
  });
});

/* ───────── 11/11: o e-mail no cartão da oferta (AB_OFERTA_EMAIL) — "atual" pede o e-mail dentro do checkout; "pagina" pede em cima do botão ───────── */
const comEmailNaPagina = (ab: "on" | "off" | "todos") => comStripe("on").replace(/var AB_OFERTA_EMAIL = "(on|off|todos)"/, `var AB_OFERTA_EMAIL = "${ab}"`);
describe("11/11 · o <head>: o braço do e-mail da /oferta", () => {
  it("a chave existe; off → todo mundo 'atual', sem sorteio e sem forçar", () => {
    expect(HTML).toMatch(/var AB_OFERTA_EMAIL = "(on|off|todos)";/);
    for (let i = 0; i < 40; i++) {
      const r = rodar(comEmailNaPagina("off"), "/oferta");
      expect(r.attrs["data-oem"]).toBe("atual");
      expect(r.mem).toMatchObject({ oem: "atual", ab_oferta_email: "off", oem_forcado: false });
    }
  });
  it("on → metade em cada braço pelo bit 20 do aparelho (igual ao regras.ts), fixo por aparelho", () => {
    const c = { atual: 0, pagina: 0 };
    for (let i = 0; i < 400; i++) {
      const id = randomUUID();
      const store: Record<string, string> = { "landing-device-id": id };
      const r = rodar(comEmailNaPagina("on"), "/oferta", store);
      expect(r.attrs["data-oem"]).toBe(bracoEmailOfertaDoAparelho(id));
      expect(r.mem).toMatchObject({ ab_oferta_email: "on", oem_forcado: false });
      expect(rodar(comEmailNaPagina("on"), "/oferta?utm_content=x", store).attrs["data-oem"]).toBe(r.attrs["data-oem"]);
      c[r.attrs["data-oem"] as "atual" | "pagina"] += 1;
    }
    expect(c.atual).toBeGreaterThan(150);
    expect(c.pagina).toBeGreaterThan(150);
  });
  it("todos → todo aparelho no braço 'pagina', sem sorteio e sem marcar forçado; ?oem=atual ainda força a tela de hoje (QA)", () => {
    for (let i = 0; i < 200; i++) {
      const r = rodar(comEmailNaPagina("todos"), "/oferta?utm_content=c7", { "landing-device-id": randomUUID() });
      expect(r.attrs["data-oem"]).toBe("pagina");
      expect(r.mem).toMatchObject({ oem: "pagina", ab_oferta_email: "todos", oem_forcado: false });
    }
    const f = rodar(comEmailNaPagina("todos"), "/oferta?oem=atual", {});
    expect(f.attrs["data-oem"]).toBe("atual");
    expect(f.mem.oem_forcado).toBe(true);
    for (const url of ["/vitalicio", "/organizar", "/vida", "/oferta?lpo=nova"]) expect(rodar(comEmailNaPagina("todos"), url, {}).attrs["data-oem"]).toBeUndefined();
  });
  it("?oem=pagina força (mesmo com a chave off), fica no aparelho e marca a medição; ?oem=auto desfaz", () => {
    const store: Record<string, string> = {};
    const a = rodar(comEmailNaPagina("off"), "/oferta?oem=pagina", store);
    expect(a.attrs["data-oem"]).toBe("pagina");
    expect(a.mem).toMatchObject({ oem: "pagina", oem_forcado: true });
    expect(store["landing-oem-force"]).toBe("pagina");
    const b = rodar(comEmailNaPagina("off"), "/oferta", store);
    expect(b.attrs["data-oem"]).toBe("pagina");
    expect(b.mem.oem_forcado).toBe(true);
    const c = rodar(comEmailNaPagina("off"), "/oferta?oem=auto", store);
    expect(c.attrs["data-oem"]).toBe("atual");
    expect(c.mem.oem_forcado).toBe(false);
    expect(store["landing-oem-force"]).toBeUndefined();
  });
  it("só a /oferta na página de hoje: /vitalicio, /organizar, /vida e o braço 'nova' não ganham data-oem, nem com ?oem=pagina", () => {
    for (const url of ["/vitalicio?oem=pagina", "/organizar?oem=pagina", "/vida?oem=pagina", "/oferta?lpo=nova&oem=pagina"]) {
      const r = rodar(comEmailNaPagina("on"), url, {});
      expect(r.attrs["data-oem"]).toBeUndefined();
      expect(r.mem.oem).toBeUndefined();
    }
  });
});

/* ───────── 11/11: a 1ª tela que continua o anúncio (AB_OFERTA_TOPO) — "atual" = a 1ª tela de hoje; "anuncio" = a tela de Finanças logo abaixo do título ───────── */
const comTopo = (ab: "on" | "off") => comStripe("on").replace(/var AB_OFERTA_TOPO = "(on|off)"/, `var AB_OFERTA_TOPO = "${ab}"`);
describe("11/11 · o <head>: o braço do topo da /oferta", () => {
  it("a chave existe e está em 50/50 no arquivo (dono, 11/11: 'liga'); off → todo mundo 'atual', sem sorteio, sem forçar e sem pedir a imagem", () => {
    expect(HTML).toMatch(/var AB_OFERTA_TOPO = "on";/); // 11/11 17h (dono: "liga"): 50/50
    for (let i = 0; i < 40; i++) {
      const r = rodar(comTopo("off"), "/oferta", { "landing-device-id": randomUUID() });
      expect(r.attrs["data-otp"]).toBe("atual");
      expect(r.mem).toMatchObject({ otp: "atual", ab_oferta_topo: "off", otp_forcado: false });
      expect(r.links).toHaveLength(0);
    }
  });
  it("on → metade em cada braço pelo bit 4 do aparelho (igual ao regras.ts), fixo por aparelho; só o 'anuncio' pede a imagem", () => {
    const c = { atual: 0, anuncio: 0 };
    for (let i = 0; i < 400; i++) {
      const id = randomUUID();
      const store: Record<string, string> = { "landing-device-id": id };
      const r = rodar(comTopo("on"), "/oferta", store);
      expect(r.attrs["data-otp"]).toBe(bracoTopoOfertaDoAparelho(id));
      expect(r.mem).toMatchObject({ ab_oferta_topo: "on", otp_forcado: false });
      expect(rodar(comTopo("on"), "/oferta?utm_content=x", store).attrs["data-otp"]).toBe(r.attrs["data-otp"]);
      expect(r.links.map((l) => l.href)).toEqual(r.attrs["data-otp"] === "anuncio" ? ["/landing/demo-financas.webp"] : []);
      c[r.attrs["data-otp"] as "atual" | "anuncio"] += 1;
    }
    expect(c.atual).toBeGreaterThan(150);
    expect(c.anuncio).toBeGreaterThan(150);
  });
  it("?otp=anuncio força (mesmo com a chave off), fica no aparelho e marca a medição; ?otp=auto desfaz", () => {
    const store: Record<string, string> = {};
    const a = rodar(comTopo("off"), "/oferta?otp=anuncio", store);
    expect(a.attrs["data-otp"]).toBe("anuncio");
    expect(a.mem).toMatchObject({ otp: "anuncio", otp_forcado: true });
    expect(store["landing-otp-force"]).toBe("anuncio");
    const b = rodar(comTopo("off"), "/oferta", store);
    expect(b.attrs["data-otp"]).toBe("anuncio");
    expect(b.mem.otp_forcado).toBe(true);
    const c = rodar(comTopo("off"), "/oferta?otp=auto", store);
    expect(c.attrs["data-otp"]).toBe("atual");
    expect(c.mem.otp_forcado).toBe(false);
    expect(store["landing-otp-force"]).toBeUndefined();
  });
  it("só a /oferta na página de hoje: /vitalicio, /organizar, /vida e o braço 'nova' não ganham data-otp, nem com ?otp=anuncio", () => {
    for (const url of ["/vitalicio?otp=anuncio", "/organizar?otp=anuncio", "/vida?otp=anuncio", "/oferta?lpo=nova&otp=anuncio"]) {
      const r = rodar(comTopo("on"), url, {});
      expect(r.attrs["data-otp"]).toBeUndefined();
      expect(r.mem.otp).toBeUndefined();
    }
  });
  it("o braço do topo não mexe no do e-mail (bits diferentes) e a página guarda a imagem sem src, escondida fora do braço", () => {
    for (let i = 0; i < 60; i++) {
      const id = randomUUID();
      const sem = rodar(comTopo("off"), "/oferta", { "landing-device-id": id }), com = rodar(comTopo("on"), "/oferta", { "landing-device-id": id });
      expect(com.attrs["data-oem"]).toBe(sem.attrs["data-oem"]);
    }
    expect(HTML).toMatch(/<img id="lp-topo-foto-img" data-src="\/landing\/demo-financas\.webp"/);
    expect(HTML).not.toMatch(/<img id="lp-topo-foto-img"[^>]* src=/);
    expect(HTML).toContain('html:not([data-otp="anuncio"]) .lp-topo-foto { display: none !important; }');
  });
});

const campoPagina = () => document.getElementById("lp-email-of") as HTMLInputElement;
const digitarNaPagina = (v: string) => { const c = campoPagina(); c.value = v; c.dispatchEvent(new Event("input")); };
const tocarNoBotao = () => (document.getElementById("lp-hotmart-atual") as HTMLButtonElement).click();
const esperarPix = () => vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pix"]')) throw new Error("sem pix"); }, { timeout: 3000, interval: 20 });
describe("11/11 · o e-mail no cartão da oferta, no jsdom", () => {
  it("braço atual: o campo não aparece, o checkout pede o e-mail lá dentro (como hoje) e todo evento leva braco_email_oferta", async () => {
    await abrirPagina({ oem: "atual" });
    expect(escondido(document.getElementById("lp-email-oferta")!)).toBe(true);
    await abrirCheckout();
    expect(aberta()).toBe(true);
    expect(document.getElementById("oc-email-ok")).toBeNull();
    expect(document.getElementById("oc-email-caixa")!.hidden).toBe(false);
    expect((document.getElementById("oc-email") as HTMLInputElement).value).toBe("");
    expect(dos("landing_stripe_email_valido")).toHaveLength(0);
    for (const e of eventos().filter((x) => x.nome.startsWith("landing_"))) expect(e).toMatchObject({ braco_email_oferta: "atual", oem_forcado: false });
  });
  it("sem data-oem (o <head> antigo em cache): igual a hoje, e os eventos não levam o braço", async () => {
    await abrirPagina();
    expect(escondido(document.getElementById("lp-email-oferta")!)).toBe(true);
    await abrirCheckout();
    expect(document.getElementById("oc-email-ok")).toBeNull();
    for (const e of eventos()) expect(e).not.toHaveProperty("braco_email_oferta");
  });
  it("braço pagina: o campo aparece em cima do botão; tocar sem e-mail (ou com e-mail quebrado) NÃO abre o checkout e mostra o erro", async () => {
    await abrirPagina({ oem: "pagina" });
    const caixa = document.getElementById("lp-email-oferta")!;
    expect(escondido(caixa)).toBe(false);
    expect(caixa.compareDocumentPosition(document.getElementById("lp-hotmart-atual")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    tocarNoBotao();
    await dormir(80);
    expect(aberta()).toBe(false);
    expect(document.getElementById("lp-email-of-erro")!.hidden).toBe(false);
    expect(document.getElementById("lp-email-of-erro")!.textContent).toContain("Digite seu e-mail");
    expect(dos("landing_email_antes_erro")[0]).toMatchObject({ motivo: "vazio", onde: "oferta_pagina", braco_email_oferta: "pagina" });
    digitarNaPagina("maria@");
    expect(document.getElementById("lp-email-of-erro")!.hidden).toBe(true); // digitar tira o erro
    tocarNoBotao();
    await dormir(80);
    expect(aberta()).toBe(false);
    expect(dos("landing_email_antes_erro")[1]).toMatchObject({ motivo: "invalido", onde: "oferta_pagina" });
    expect(dos("landing_stripe_aberto")).toHaveLength(0);
    expect(fbq.mock.calls.filter((c) => c[1] === "InitiateCheckout")).toHaveLength(0);
    expect(dos("landing_cta").filter((e) => e.onde === "stripe")).toHaveLength(2); // o toque continua medido
  });
  it("braço pagina com e-mail: o checkout abre com o e-mail pronto (linha + Trocar), sem campo, e o Pix sai com esse e-mail até o pago", async () => {
    await abrirPagina({ oem: "pagina" });
    digitarNaPagina("  Ana@Exemplo.com ");
    await abrirCheckout();
    expect(aberta()).toBe(true);
    expect(document.getElementById("oc-email-ok")!.textContent).toContain("ana@exemplo.com");
    expect(document.getElementById("oc-email-caixa")!.hidden).toBe(true);
    expect(dos("landing_oferta_email_comecou")).toHaveLength(1);
    expect(dos("landing_oferta_email_valido")).toHaveLength(1);
    expect(dos("landing_stripe_email_valido")).toHaveLength(1); // o funil do checkout continua comparável com o braço atual
    expect(dos("landing_stripe_aberto")[0]).toMatchObject({ braco_email_oferta: "pagina" });
    expect(fbq.mock.calls.filter((c) => c[1] === "InitiateCheckout")).toHaveLength(1);
    pagar().click();
    await esperarPix();
    expect(confirmados[0].tipo).toBe("pix");
    expect(confirmados[0].args[1]).toEqual({ payment_method: { billing_details: { email: "ana@exemplo.com" } } });
    expect(criadas[1]).toMatchObject({ pi: "pi_123", email: "ana@exemplo.com" });
    statusPago = true;
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pago"]')) throw new Error("sem pago"); }, { timeout: 5000, interval: 50 });
    expect(dos("landing_stripe_pago")[0]).toMatchObject({ metodo: "pix", braco_email_oferta: "pagina" });
    expect(fbq.mock.calls.filter((c) => c[1] === "Purchase")).toEqual([["track", "Purchase", expect.objectContaining({ value: 67.9, currency: "BRL" }), { eventID: "pi_123" }]]);
  });
  it("braço pagina no cartão: o PaymentMethod leva o e-mail da página", async () => {
    await abrirPagina({ oem: "pagina" });
    digitarNaPagina("maria@gmail.com");
    await abrirCheckout();
    botaoMetodo("card").click();
    pagar().click();
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pago"]')) throw new Error("sem pago"); }, { timeout: 3000, interval: 20 });
    expect(metodosCriados[0]).toMatchObject({ params: { billing_details: { email: "maria@gmail.com" } } });
  });
  it("Trocar: abre o campo com o e-mail e mede; fechar e reabrir não desfaz a troca; e-mail novo na página vence; o Pix sai com o último", async () => {
    await abrirPagina({ oem: "pagina" });
    digitarNaPagina("ana@exemplo.com");
    await abrirCheckout();
    (document.getElementById("oc-email-trocar") as HTMLButtonElement).click();
    expect(document.getElementById("oc-email-ok")).toBeNull();
    expect(document.getElementById("oc-email-caixa")!.hidden).toBe(false);
    expect((document.getElementById("oc-email") as HTMLInputElement).value).toBe("ana@exemplo.com");
    expect(dos("landing_stripe_email_trocar")).toHaveLength(1);
    digitarEmail("bia@exemplo.com");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(aberta()).toBe(false);
    await abrirCheckout(); // a página ainda diz ana@: a troca feita lá dentro fica
    expect(document.getElementById("oc-email-ok")!.textContent).toContain("bia@exemplo.com");
    window.dispatchEvent(new PopStateEvent("popstate"));
    digitarNaPagina("carla@exemplo.com");
    await abrirCheckout();
    expect(document.getElementById("oc-email-ok")!.textContent).toContain("carla@exemplo.com");
    pagar().click();
    await esperarPix();
    expect(confirmados[0].args[1]).toEqual({ payment_method: { billing_details: { email: "carla@exemplo.com" } } });
  });
  it("erro de digitação na página: sugere a correção, um toque conserta; recarregar a aba devolve o e-mail; Enter abre o checkout", async () => {
    await abrirPagina({ oem: "pagina" });
    digitarNaPagina("maria@gmial.com");
    const sug = document.getElementById("lp-email-of-sugestao") as HTMLButtonElement;
    expect(sug.hidden).toBe(false);
    expect(sug.textContent).toContain("maria@gmail.com");
    sug.click();
    expect(campoPagina().value).toBe("maria@gmail.com");
    expect(sug.hidden).toBe(true);
    expect(dos("landing_email_antes_sugestao")[0]).toMatchObject({ onde: "oferta_pagina" });
    expect(sessionStorage.getItem("oferta-email-pagina")).toBe("maria@gmail.com");
    await abrirPagina({ oem: "pagina", antes: () => sessionStorage.setItem("oferta-email-pagina", "maria@gmail.com") });
    expect(campoPagina().value).toBe("maria@gmail.com");
    campoPagina().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await vi.waitFor(() => { if (!aberta()) throw new Error("fechada"); }, { timeout: 3000, interval: 20 });
    expect(document.getElementById("oc-email-ok")!.textContent).toContain("maria@gmail.com");
    expect(dos("landing_cta").find((e) => e.onde === "stripe")).toMatchObject({ de: "email" });
  });
});
