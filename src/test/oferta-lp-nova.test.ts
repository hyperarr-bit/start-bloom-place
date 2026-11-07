/**
 * /oferta · A/B da página (06/11, AB_OFERTA_LP). Trava:
 *   1. o <head>: off = todos no atual; on = 50/50 estável por aparelho (bit próprio); ?lpo=nova|atual|auto; nada fora da /oferta;
 *      o <head> com o bloco novo dá o mesmo resultado do <head> sem ele, em todas as rotas;
 *   2. braço atual: nada da página nova aparece, baixa ou muda (DOM, pedido do PI, Purchase, landing_cta);
 *   3. braço nova: todo botão abre o checkout; braco_lp_oferta em evento, metadata e Purchase; blocos medidos iguais; sem demo;
 *   4. a página: oferta, faixa, verdade (sem 27,90, nota, estrela, parcela enquanto STRIPE_PARCELAS_MAX = 1), 1ª tela leve; arquivos existem.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { URL_APP_STORE, bracoLpDoAparelho, bracoLpOfertaDoAparelho, bracoLpOfertaDoHtml, bracoPixDoAparelho, urlPlay } from "@/landing/regras";
import { metadataDoPedido, validarPedidoStripe } from "../../supabase/functions/_shared/stripe-criar";

const raiz = resolve(__dirname, "../..");
const HTML = readFileSync(resolve(raiz, "landing.html"), "utf8");
const cabeca = HTML.match(/<script>\s*(\(function \(\) \{\s*var LANDING_NOVA[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];
const comChave = (v: "on" | "off") => cabeca.replace(/var AB_OFERTA_LP = "(on|off)"/, `var AB_OFERTA_LP = "${v}"`);
/** o <head> como era antes do A/B: sem o bloco do braço */
const semOBloco = cabeca.replace(/\n\s*\/\/ 06\/11: o braço da PÁGINA da \/oferta[\s\S]*?\n {8}\}\n(?= {8}\/\/ 04\/11: \/vida — a chave CHECKOUT_HOTMART)/, "\n");

function rodar(fonte: string, url: string, store: Record<string, string> = {}, cookie = "") {
  const u = new URL(url, "https://www.coreaplicativo.com.br");
  const attrs: Record<string, string> = {};
  const location = { search: u.search, hash: u.hash, pathname: u.pathname, hostname: "www.coreaplicativo.com.br", protocol: "https:", replace: vi.fn() };
  const localStorage = { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; } };
  const ck = { v: cookie };
  const links: Array<{ href?: string }> = [];
  const document = {
    documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } },
    createElement: () => ({ setAttribute: () => {} }), head: { appendChild: (l: { href?: string }) => { links.push(l); } },
    get cookie() { return ck.v; },
    set cookie(s: string) { const [par] = s.split(";"); const [k, v] = par.split("="); const resto = ck.v.split("; ").filter((x) => x && !x.startsWith(`${k}=`)); ck.v = (/Max-Age=0/.test(s) ? resto : [...resto, `${k}=${v}`]).join("; "); },
  };
  const window: Record<string, unknown> = { localStorage, crypto: { randomUUID: () => randomUUID() } };
  new Function("location", "document", "window", "localStorage", "URLSearchParams", "Math", "fetch", "sessionStorage", fonte)(location, document, window, localStorage, URLSearchParams, Math, undefined, { getItem: () => null, setItem: () => {} });
  return { attrs, store, links, cookie: ck.v, replace: location.replace, mem: (window.__landing ?? {}) as Record<string, unknown> };
}

describe("o <head>", () => {
  it("no código: as duas chaves desligadas", () => {
    expect(HTML).toMatch(/var AB_OFERTA_LP = "off";/);
    expect(HTML).toMatch(/var LPO_STRIPE_CEDO = "off";/);
  });
  it("o regex do 'antes' tirou o bloco (senão a comparação abaixo não prova nada)", () => {
    expect(cabeca).toContain("data-lpo");
    expect(semOBloco).not.toContain("data-lpo");
    expect(semOBloco.length).toBeGreaterThan(cabeca.length - 4000);
  });
  it("chave off: 200 aparelhos, todos no atual, sem preload da página nova", () => {
    for (let i = 0; i < 200; i++) {
      const r = rodar(comChave("off"), "/oferta?utm_content=c7", { "landing-device-id": randomUUID() });
      expect(r.attrs["data-lpo"]).toBe("atual");
      expect(r.mem).toMatchObject({ lpo: "atual", ab_lp_oferta: "off", lpo_forcado: false });
      expect(r.links).toHaveLength(0);
    }
  });
  it("chave off: fora o data-lpo e as 3 marcas do braço, o <head> dá o mesmo resultado de antes em toda rota", () => {
    for (const url of ["/oferta", "/oferta/", "/oferta?lp=v2&oferta=ano", "/organizar", "/organizar?lp=v2", "/vida", "/vida?vida=atual", "/ofertas", "/comece"]) {
      const id = randomUUID();
      const novo = rodar(comChave("off"), url, { "landing-device-id": id }), antes = rodar(semOBloco, url, { "landing-device-id": id });
      const { "data-lpo": _a, ...attrs } = novo.attrs;
      const { lpo: _b, ab_lp_oferta: _c, lpo_forcado: _d, lpo_stripe_cedo: _e, lpo_link: _f, ...mem } = novo.mem;
      expect(attrs).toEqual(antes.attrs);
      expect(mem).toEqual(antes.mem);
      expect(novo.store).toEqual(antes.store);
      expect(novo.cookie).toEqual(antes.cookie);
    }
  });
  it("/organizar, /vida e o resto: nada do braço, nem com a chave on, nem com ?lpo=nova, nem com a força guardada", () => {
    for (const url of ["/organizar?lpo=nova", "/vida?lpo=nova", "/comece?lpo=nova", "/ofertas?lpo=nova"]) {
      const store = { "landing-device-id": randomUUID(), "landing-lpo-force": "nova" };
      const r = rodar(comChave("on"), url, store, "landing_lpo_force=nova");
      expect(r.attrs["data-lpo"]).toBeUndefined();
      expect(r.mem.lpo).toBeUndefined();
      expect(r.links).toHaveLength(rodar(semOBloco, url, { "landing-device-id": store["landing-device-id"] }).links.length); // a /vida no v3 tem o preload dela; nada a mais
      expect(store["landing-lpo-force"]).toBe("nova");
    }
  });
  it("chave on: 50/50, estável por aparelho, a mesma conta do regras.ts, com preload só na nova", () => {
    let nova = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const id = randomUUID();
      const a = rodar(comChave("on"), "/oferta", { "landing-device-id": id }), b = rodar(comChave("on"), "/oferta", { "landing-device-id": id });
      expect(a.attrs["data-lpo"]).toBe(b.attrs["data-lpo"]);
      expect(a.attrs["data-lpo"]).toBe(bracoLpOfertaDoAparelho(id));
      expect(a.links).toHaveLength(a.attrs["data-lpo"] === "nova" ? 1 : 0);
      if (a.attrs["data-lpo"] === "nova") { nova++; expect(a.links[0].href).toBe("/landing/v3-home.webp"); }
      expect(a.attrs["data-lp"]).toBe("atual"); // o braço do /organizar não muda
      expect(a.attrs["data-oferta"]).toBe("sempre");
    }
    expect(nova / N).toBeGreaterThan(0.46);
    expect(nova / N).toBeLessThan(0.54);
  });
  it("o sorteio é independente dos outros (Pix, página do /organizar)", () => {
    const c: Record<string, number> = {};
    for (let i = 0; i < 8000; i++) { const id = randomUUID(); const k = `${bracoLpOfertaDoAparelho(id)}|${bracoPixDoAparelho(id)}|${bracoLpDoAparelho(id)}`; c[k] = (c[k] ?? 0) + 1; }
    expect(Object.keys(c)).toHaveLength(8);
    for (const n of Object.values(c)) expect(n / 8000).toBeGreaterThan(0.09);
  });
  it("?lpo=nova|atual força com a chave off (fica: storage e cookie); ?lpo=auto desfaz; o cookie segura o storage zerado", () => {
    const store: Record<string, string> = {};
    const r1 = rodar(comChave("off"), "/oferta?lpo=nova", store);
    expect(r1.attrs["data-lpo"]).toBe("nova");
    expect(r1.mem.lpo_forcado).toBe(true);
    expect(rodar(comChave("off"), "/oferta", store).attrs["data-lpo"]).toBe("nova");
    expect(rodar(comChave("off"), "/oferta", {}, r1.cookie).attrs["data-lpo"]).toBe("nova"); // Instagram zerou o storage
    const r2 = rodar(comChave("off"), "/oferta?lpo=auto", store, r1.cookie);
    expect(r2.attrs["data-lpo"]).toBe("atual");
    expect(r2.mem.lpo_forcado).toBe(false);
    expect(store["landing-lpo-force"]).toBeUndefined();
    expect(r2.cookie).not.toContain("landing_lpo_force");
    const id = "12345678-aaaa-bbbb-cccc-1234567890ab";
    expect(rodar(comChave("on"), "/oferta?lpo=atual", { "landing-device-id": id }).attrs["data-lpo"]).toBe("atual");
    expect(rodar(comChave("on"), "/oferta?lpo=lixo", { "landing-device-id": id }).attrs["data-lpo"]).toBe(bracoLpOfertaDoAparelho(id));
  });
  it("07/11 /vitalicio: sempre a nova, com a chave off, sem ler nem gravar a força; a /oferta segue na de hoje", () => {
    const store: Record<string, string> = {};
    for (const url of ["/vitalicio", "/vitalicio/", "/vitalicio?lpo=atual", "/vitalicio?utm_content=c7"]) {
      const r = rodar(comChave("off"), url, store);
      expect(r.attrs["data-lpo"]).toBe("nova");
      expect(r.attrs["data-pagina"]).toBe("oferta");
      expect(r.attrs["data-checkout-ext"]).toBe("stripe");
      expect(r.mem.lpo_link).toBe(true);
      expect(r.mem.lpo_forcado).toBe(false);
      expect(r.mem.oferta).toBe("sempre");
      expect(r.replace).not.toHaveBeenCalled();
      expect(r.cookie).not.toContain("landing_lpo_force");
    }
    expect(store["landing-lpo-force"]).toBeUndefined();
    const oferta = rodar(comChave("off"), "/oferta", store);
    expect(oferta.attrs["data-lpo"]).toBe("atual");
    expect(oferta.mem.lpo_link).toBe(false);
  });
  it("CHECKOUT_STRIPE off: a /oferta vai pro /organizar e o braço nem é sorteado", () => {
    const r = rodar(comChave("on").replace(/var CHECKOUT_STRIPE = "on"/, 'var CHECKOUT_STRIPE = "off"'), "/oferta?lpo=nova");
    expect(r.replace).toHaveBeenCalled();
    expect(r.attrs["data-lpo"]).toBeUndefined();
  });
  it("o html: só 'nova' é nova", () => {
    const el = (v: string | null) => ({ getAttribute: () => v });
    expect(bracoLpOfertaDoHtml(el("nova"))).toBe("nova");
    for (const v of ["atual", null, "x"]) expect(bracoLpOfertaDoHtml(el(v))).toBe("atual");
  });
});

/* ───────── a página no jsdom ───────── */
const corpo = HTML.match(/<body>([\s\S]*)<\/body>/)![1].replace(/<script type="module"[^>]*><\/script>/, "");
const estilo = HTML.match(/<style>([\s\S]*?)<\/style>/)![1];
type Ev = Record<string, unknown> & { nome: string };
const eventos = (): Ev[] => ((window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding ?? []);
const dos = (nome: string) => eventos().filter((e) => e.nome === nome);
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
const janela = window as unknown as Record<string, unknown>;
const IO_DO_SETUP = janela.IntersectionObserver;

class IOFalso {
  static todos: IOFalso[] = [];
  alvos: Element[] = [];
  constructor(public cb: (e: Array<{ target: Element; isIntersecting: boolean; intersectionRatio: number; boundingClientRect: { top: number } }>, o: IOFalso) => void) { IOFalso.todos.push(this); }
  observe(el: Element) { this.alvos.push(el); }
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
const ver = (el: Element, on = true, parte = on ? 1 : 0) => { for (const o of IOFalso.todos) if (o.alvos.includes(el)) o.cb([{ target: el, isIntersecting: on, intersectionRatio: parte, boundingClientRect: { top: 0 } }], o); };

let criadas: Array<Record<string, unknown>> = [];
let fbq: ReturnType<typeof vi.fn>;
async function abrirPagina(o: { braco?: "atual" | "nova"; ativo?: boolean; antes?: () => void; fila?: string; io?: boolean } = {}) {
  await dormir(20);
  vi.resetModules();
  localStorage.clear(); sessionStorage.clear();
  document.cookie.split(";").forEach((c) => { const n = c.split("=")[0].trim(); if (n) document.cookie = `${n}=; max-age=0; path=/`; });
  o.antes?.();
  window.history.replaceState(null, "", "/oferta?utm_content=c7&fbclid=abc");
  janela.__eventosLanding = []; janela.__lpoFila = o.fila ?? null; janela.__lpoPronta = false;
  criadas = [];
  fbq = vi.fn(); janela.fbq = fbq;
  IOFalso.todos = [];
  janela.IntersectionObserver = o.io ? IOFalso : IO_DO_SETUP;
  janela.__ofertaApi = {
    criar: async (c: Record<string, unknown>) => { criadas.push(c); return { ok: true, clientSecret: "pi_123_secret_abc", pi: "pi_123" }; },
    status: async () => ({ ok: true, status: "requires_action", pago: false, metodo: null }),
  };
  // 0170f5ce (main): o cartão espera o "ready" do elemento e cria o método antes de confirmar
  const cbs: Record<string, (x: Record<string, unknown>) => void> = {};
  janela.__stripeFalso = {
    elements: () => ({ create: () => ({ mount: (el: HTMLElement) => { el.innerHTML = '<div data-testid="pe-falso">PE</div>'; setTimeout(() => cbs.ready?.({}), 0); }, on: (e: string, cb: (x: Record<string, unknown>) => void) => { cbs[e] = cb; } }), submit: async () => ({}) }),
    createPaymentMethod: async () => ({ paymentMethod: { id: "pm_1" } }),
    confirmPayment: async () => ({ paymentIntent: { id: "pi_123", status: "succeeded" } }),
    confirmPixPayment: async () => ({}),
  };
  const braco = o.braco ?? "atual";
  const d = document.documentElement;
  for (const a of ["data-pix", "data-vida", "data-checkout-aberto"]) d.removeAttribute(a);
  d.setAttribute("data-t", "a"); d.setAttribute("data-oferta", "sempre"); d.setAttribute("data-checkout", "email"); d.setAttribute("data-lp", "atual");
  d.setAttribute("data-pagina", "oferta"); d.setAttribute("data-checkout-ext", "stripe"); d.setAttribute("data-lpo", braco);
  janela.__landing = { pagina: "oferta", checkout_ext: "stripe", stripe_pk: "pk_test_EXEMPLO123", stripe_preco_centavos: 6790, stripe_parcelas: "Pix ou cartão", stripe_parcelas_max: 1, stripe_pede_cpf: false, lpo: braco, ab_lp_oferta: o.ativo ? "on" : "off", lpo_forcado: false, lpo_stripe_cedo: "off" };
  document.head.querySelectorAll("style[data-teste-st]").forEach((s) => s.remove());
  const st = document.createElement("style"); st.setAttribute("data-teste-st", ""); st.textContent = estilo; document.head.appendChild(st);
  document.body.removeAttribute("style");
  document.body.innerHTML = corpo;
  if (braco === "nova") { const t = document.getElementById("lpo-nova") as HTMLTemplateElement; document.body.insertBefore(t.content.cloneNode(true), t); } // o que o script inline faz
  const m = await import("@/landing/stripe-checkout"); m._zerar();
  await import("@/landing/landing");
}
const peNaTela = () => vi.waitFor(() => { if (!document.querySelector('[data-testid="pe-falso"]')) throw new Error("sem PE"); }, { timeout: 3000, interval: 20 });
const fechar = async () => { (document.getElementById("oc-x") as HTMLButtonElement).click(); await vi.waitFor(() => { if (!document.querySelector<HTMLElement>("#oc")?.hidden) throw new Error("aberta"); }, { timeout: 2000, interval: 20 }); };
async function pagarNoCartao() {
  document.querySelector<HTMLButtonElement>('[data-metodo="card"]')!.click(); // 0170f5ce (main): o checkout ganhou os botões Pix e Cartão
  const campo = document.getElementById("oc-email") as HTMLInputElement;
  campo.value = "maria@gmail.com"; campo.dispatchEvent(new Event("input"));
  (document.getElementById("oc-pagar") as HTMLButtonElement).click();
  await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pago"]')) throw new Error("sem pago"); }, { timeout: 3000, interval: 20 });
}
const purchase = () => fbq.mock.calls.find((c) => c[1] === "Purchase")!;
afterEach(() => { janela.__ofertaApi = undefined; janela.__stripeFalso = undefined; janela.IntersectionObserver = IO_DO_SETUP; });

describe("braço atual, chave off: a página de hoje", () => {
  it("nada da nova no DOM vivo, no CSS do <head> ou nos pedidos; o template não renderiza", async () => {
    await abrirPagina();
    expect(document.getElementById("lpo")).toBeNull();
    expect(document.querySelector("[data-lpo-abre]")).toBeNull();
    expect(document.querySelector('img[src*="lpo-"]')).toBeNull();
    expect(estilo).not.toMatch(/lpo/);
    expect((document.getElementById("lpo-nova") as HTMLTemplateElement).childNodes).toHaveLength(0); // tudo fica no .content, inerte
    expect(document.querySelector("main.lp")).not.toBeNull();
  });
  it("landing_cta, pedido do PI e Purchase iguais aos de hoje; os eventos só ganham braco_lp_oferta/lpo_forcado", async () => {
    await abrirPagina();
    (document.getElementById("lp-hotmart-atual") as HTMLButtonElement).click();
    await peNaTela();
    expect(Object.keys(dos("landing_cta")[0])).not.toContain("de");
    expect(dos("landing_cta")[0]).toMatchObject({ onde: "stripe", fase: "oferta", braco_lp_oferta: "atual", lpo_forcado: false });
    expect(criadas[0].atrib).toEqual({ utm_content: "c7", tem_fbclid: "1" });
    await pagarNoCartao();
    expect(purchase()).toEqual(["track", "Purchase", { value: 67.9, currency: "BRL", content_name: "oferta_stripe" }, { eventID: "pi_123" }]);
    for (const e of eventos()) expect(e.braco_lp_oferta).toBe("atual");
  });
  it("a volta do banco (3DS) reabre o checkout como hoje", async () => {
    await abrirPagina({ antes: () => { sessionStorage.setItem("x", "1"); } });
    window.history.replaceState(null, "", "/oferta?payment_intent=pi_9&redirect_status=succeeded");
    vi.resetModules();
    janela.__eventosLanding = [];
    const m = await import("@/landing/stripe-checkout"); m._zerar();
    await import("@/landing/landing");
    await vi.waitFor(() => { if (!document.querySelector("#oc") || document.querySelector<HTMLElement>("#oc")!.hidden) throw new Error("fechado"); }, { timeout: 3000, interval: 20 });
    expect(location.search).not.toContain("payment_intent");
  });
  it("fora da /oferta os eventos não ganham o campo", async () => {
    await abrirPagina();
    vi.resetModules();
    window.history.replaceState(null, "", "/organizar");
    document.documentElement.removeAttribute("data-pagina"); document.documentElement.removeAttribute("data-checkout-ext"); document.documentElement.removeAttribute("data-lpo");
    janela.__landing = undefined; janela.__eventosLanding = [];
    document.body.innerHTML = corpo;
    await import("@/landing/landing");
    await vi.waitFor(() => { if (!eventos().length) throw new Error("sem evento"); }, { timeout: 2000, interval: 20 });
    for (const e of eventos()) { expect(e).not.toHaveProperty("braco_lp_oferta"); expect(e).not.toHaveProperty("lpo_forcado"); }
  });
  it("com o teste ligado, o braço atual leva o campo no PI e no Purchase (os dois braços ficam medidos igual)", async () => {
    await abrirPagina({ ativo: true });
    (document.getElementById("lp-hotmart-atual") as HTMLButtonElement).click();
    await peNaTela();
    expect(criadas[0].atrib).toMatchObject({ braco_lp_oferta: "atual" });
    await pagarNoCartao();
    expect(purchase()[2]).toMatchObject({ braco_lp_oferta: "atual", value: 67.9 });
  });
});

describe("braço nova", () => {
  it("todo botão abre o checkout direto, com o `de` no landing_cta", async () => {
    await abrirPagina({ braco: "nova", ativo: true });
    const botoes = [...document.querySelectorAll<HTMLButtonElement>("[data-lpo-abre]")];
    expect(botoes.map((b) => b.dataset.lpoAbre)).toEqual(["topo", "oferta", "fim", "fixo"]);
    for (const b of botoes) {
      b.click();
      await peNaTela();
      expect(document.querySelector<HTMLElement>("#oc")!.hidden).toBe(false);
      await fechar();
    }
    expect(dos("landing_cta").map((e) => [e.onde, e.de])).toEqual([["stripe", "topo"], ["stripe", "oferta"], ["stripe", "fim"], ["stripe", "fixo"]]);
    expect(dos("landing_stripe_aberto")).toHaveLength(4);
    expect(fbq.mock.calls.filter((c) => c[1] === "InitiateCheckout")).toHaveLength(1);
  });
  it("todo evento, o pedido do PI e o Purchase levam o braço; o Purchase mantém valor e eventID", async () => {
    await abrirPagina({ braco: "nova", ativo: true });
    document.querySelector<HTMLButtonElement>('[data-lpo-abre="topo"]')!.click();
    await peNaTela();
    expect(criadas[0].atrib).toEqual({ utm_content: "c7", tem_fbclid: "1", braco_lp_oferta: "nova" });
    await pagarNoCartao();
    expect(purchase()).toEqual(["track", "Purchase", { value: 67.9, currency: "BRL", content_name: "oferta_stripe", braco_lp_oferta: "nova" }, { eventID: "pi_123" }]);
    expect(fbq.mock.calls.find((c) => c[1] === "InitiateCheckout")![2]).not.toHaveProperty("braco_lp_oferta");
    expect(dos("landing_stripe_pago")).toHaveLength(1);
    expect(eventos().length).toBeGreaterThan(3);
    for (const e of eventos()) expect(e).toMatchObject({ braco_lp_oferta: "nova", pagina: "oferta" });
    expect(document.querySelector('[data-testid="oferta-pago"] .oc-selos')).not.toBeNull(); // pós-compra igual: lojas + e-mail
    expect(document.querySelector('[data-testid="oferta-pago"]')!.textContent).toContain("maria@gmail.com");
  });
  it("o servidor aceita o braço na metadata do PI (e só pelo atrib)", () => {
    const p = validarPedidoStripe({ ref: "0f8a5c2e-1111", atrib: { utm_content: "c7", braco_lp_oferta: "nova", outra: "x" } })!;
    expect(p.atrib).toEqual({ utm_content: "c7", braco_lp_oferta: "nova" });
    expect(metadataDoPedido(p, { userId: null, ip: null, ua: null, agoraIso: "2026-11-06T00:00:00Z" })).toMatchObject({ braco_lp_oferta: "nova", pagina: "oferta" });
  });
  it("a medição por bloco: os mesmos nomes da página atual, menos a demo; cada um conta 1×; a oferta dispara o ViewContent", async () => {
    await abrirPagina({ braco: "nova", io: true });
    const blocos = [...document.querySelectorAll<HTMLElement>("#lpo [data-bloco]")];
    const atuais = [...document.querySelectorAll<HTMLElement>('main [data-bloco][data-so-lp="atual"], main #oferta, main #demo, #fim')].map((e) => e.dataset.bloco);
    const nomes = blocos.map((e) => e.dataset.bloco!);
    expect(nomes).toEqual(["topo", "modulos", "antes", "como", "avaliacoes", "oferta", "duvidas", "fim"]);
    expect(new Set(atuais)).toEqual(new Set([...nomes, "demo"]));
    for (const b of blocos) { ver(b); ver(b, false); ver(b); }
    expect(dos("landing_bloco").map((e) => e.bloco)).toEqual(nomes);
    expect(dos("landing_oferta_vista")).toHaveLength(1);
    expect(fbq.mock.calls.filter((c) => c[1] === "ViewContent")).toHaveLength(1);
  });
  it("a dúvida aberta conta (landing_duvida_aberta), como na atual", async () => {
    await abrirPagina({ braco: "nova" });
    const d = document.querySelector<HTMLDetailsElement>("#lpo details")!;
    d.open = true; d.dispatchEvent(new Event("toggle"));
    expect(dos("landing_duvida_aberta")[0]).toMatchObject({ pergunta: "É mensalidade?", braco_lp_oferta: "nova" });
  });
  it("a demo nunca começa (nem o iframe de 4–5 MB nem a imagem)", async () => {
    await abrirPagina({ braco: "nova", io: true });
    ver(document.getElementById("demo")!);
    await dormir(60);
    expect((document.getElementById("lp-demo-frame") as HTMLIFrameElement).getAttribute("src")).toBeNull();
    expect(dos("landing_demo_aberta")).toHaveLength(0);
  });
  it("a barra fixa: some com um botão na tela, aparece sem nenhum", async () => {
    await abrirPagina({ braco: "nova", io: true });
    const barra = document.getElementById("lpo-fixo")!;
    const topo = document.querySelector('[data-lpo-abre="topo"]')!, oferta = document.querySelector('[data-lpo-abre="oferta"]')!;
    ver(topo);
    expect(barra.hasAttribute("data-on")).toBe(false);
    ver(topo, false);
    expect(barra.hasAttribute("data-on")).toBe(true);
    expect(barra.getAttribute("aria-hidden")).toBe("false");
    expect(barra.querySelector("button")!.tabIndex).toBe(0);
    ver(oferta);
    expect(barra.hasAttribute("data-on")).toBe(false);
    expect(barra.querySelector("button")!.tabIndex).toBe(-1);
    ver(oferta, true, 0.6); // cortado pela borda da tela não conta como botão na tela
    expect(barra.hasAttribute("data-on")).toBe(true);
  });
  it("o toque antes do landing.ts chegar não se perde (e abre 1× só)", async () => {
    await abrirPagina({ braco: "nova", fila: "topo" });
    await peNaTela();
    expect(dos("landing_cta")).toHaveLength(1);
    expect(dos("landing_cta")[0]).toMatchObject({ onde: "stripe", de: "topo" });
    expect(janela.__lpoFila).toBeNull();
  });
  it("quem já comprou neste aparelho vê o 'Você já tem o CORE' da página de hoje, e o evento segue no braço sorteado", async () => {
    const { marcarCompra } = await import("@/landing/marcador");
    await abrirPagina({ braco: "nova", antes: () => marcarCompra({ oferta: "LN_sempre279", email: "maria@gmail.com" }) });
    expect(document.getElementById("lpo")).toBeNull();
    expect(document.getElementById("lpo-fixo")).toBeNull();
    expect(document.documentElement.getAttribute("data-lpo")).toBe("atual");
    expect(document.querySelector('[data-testid="landing-ja-tem"]')).not.toBeNull();
    expect(document.getElementById("lp-pix")!.style.getPropertyValue("display")).toBe("block"); // o CSS da /oferta esconde o nó: sem isto o cartão fica em branco
    expect(document.querySelector("#lp-pix .lp-selos")).not.toBeNull();
    expect(document.getElementById("lp-pix")!.textContent).toContain("maria@gmail.com");
    expect(dos("landing_ja_tem")[0]).toMatchObject({ braco_lp_oferta: "nova" });
  });
  it("selo de loja é link pra ficha pública na mesma aba (sem _blank: no navegador do Instagram pode não abrir nada), e o toque conta como landing_loja onde: prova", async () => {
    await abrirPagina({ braco: "nova" });
    const links = [...document.querySelectorAll<HTMLAnchorElement>("#lpo .lpo-selos a")];
    expect(links.map((a) => a.href)).toEqual([URL_APP_STORE, urlPlay("oferta_lp")]);
    for (const a of links) { expect(a.hasAttribute("target")).toBe(false); a.addEventListener("click", (e) => e.preventDefault()); a.click(); }
    expect(dos("landing_loja").map((e) => [e.loja, e.onde])).toEqual([["ios", "prova"], ["android", "prova"]]);
  });
});

describe("depois de pagar", () => {
  it.each(["nova", "atual"] as const)("teste ativo, braço %s: marca a compra e o X leva ao 'Você já tem o CORE', sem vender de novo", async (braco) => {
    await abrirPagina({ braco, ativo: true });
    (braco === "nova" ? document.querySelector<HTMLButtonElement>('[data-lpo-abre="topo"]')! : document.getElementById("lp-hotmart-atual") as HTMLButtonElement).click();
    await peNaTela();
    await pagarNoCartao();
    expect(fbq.mock.calls.filter((c) => c[1] === "Purchase")).toHaveLength(1);
    expect(document.cookie).toContain("core_ln_comprou=");
    const { lerCompra } = await import("@/landing/marcador");
    expect(lerCompra()).toMatchObject({ oferta: "stripe", email: "maria@gmail.com" });
    await fechar();
    expect(document.getElementById("lpo")).toBeNull();
    expect(document.getElementById("lp-pix")!.style.getPropertyValue("display")).toBe("block");
    expect(document.querySelector('[data-testid="landing-ja-tem"]')!.textContent).toContain("maria@gmail.com");
    expect(document.getElementById("lp-card")!.dataset.fase).toBe("conta");
    expect(dos("landing_ja_tem")).toHaveLength(0); // é a volta de quem já comprou, não o fim desta compra
  });
  it.each(["nova", "atual"] as const)("Pix, braço %s: o e-mail fica na marca e no 'Você já tem o CORE', mesmo sem o campo na tela (e com a camada fechada)", async (braco) => {
    await abrirPagina({ braco, ativo: true });
    let pago = false;
    Object.assign(janela.__ofertaApi as object, { status: async () => ({ ok: true, status: pago ? "succeeded" : "requires_action", pago, metodo: pago ? "pix" : null }) });
    Object.assign(janela.__stripeFalso as object, { elements: () => ({ create: () => ({ mount: (el: HTMLElement) => { el.innerHTML = '<div data-testid="pe-falso">PE</div>'; }, on: (_n: string, cb: (e: { value: { type: string } }) => void) => { setTimeout(() => cb({ value: { type: "pix" } }), 0); } }), submit: async () => ({}) }) });
    Object.assign(janela.__stripeFalso as object, { confirmPixPayment: async () => ({ paymentIntent: { id: "pi_123", status: "requires_action", next_action: { pix_display_qr_code: { data: "000201PIX" } } } }) });
    (braco === "nova" ? document.querySelector<HTMLButtonElement>('[data-lpo-abre="topo"]')! : document.getElementById("lp-hotmart-atual") as HTMLButtonElement).click();
    await peNaTela();
    await dormir(10);
    const campo = document.getElementById("oc-email") as HTMLInputElement;
    campo.value = " Maria@Gmail.com "; campo.dispatchEvent(new Event("input"));
    (document.getElementById("oc-pagar") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pix"]')) throw new Error("sem QR"); }, { timeout: 3000, interval: 20 });
    expect(document.getElementById("oc-email")).toBeNull();
    await fechar();
    pago = true;
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pago"]')) throw new Error("sem pago"); }, { timeout: 8000, interval: 50 });
    const { lerCompra } = await import("@/landing/marcador");
    expect(lerCompra()).toMatchObject({ oferta: "stripe", email: "maria@gmail.com" });
    await fechar();
    expect(document.querySelector('[data-testid="landing-ja-tem"]')!.textContent).toContain("maria@gmail.com");
    expect(sessionStorage.getItem("oferta-email-pagando")).toBeNull();
  }, 15000);
  it("volta do banco (3DS): a página recarregou, o e-mail vem da aba", async () => {
    await abrirPagina({ ativo: true });
    Object.assign(janela.__ofertaApi as object, { status: async () => ({ ok: true, status: "succeeded", pago: true, metodo: "card" }) });
    sessionStorage.setItem("oferta-email-pagando", "maria@gmail.com");
    window.history.replaceState(null, "", "/oferta?payment_intent=pi_9&redirect_status=succeeded");
    vi.resetModules();
    const m = await import("@/landing/stripe-checkout"); m._zerar();
    await import("@/landing/landing");
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pago"]')) throw new Error("sem pago"); }, { timeout: 3000, interval: 20 });
    const { lerCompra } = await import("@/landing/marcador");
    expect(lerCompra()).toMatchObject({ oferta: "stripe", email: "maria@gmail.com" });
  });
  it("chave off: a página de hoje fica como no ar, sem marca", async () => {
    await abrirPagina();
    (document.getElementById("lp-hotmart-atual") as HTMLButtonElement).click();
    await peNaTela();
    await pagarNoCartao();
    await fechar();
    expect(document.cookie).not.toContain("core_ln_comprou=");
    expect(document.getElementById("lp-pix")!.style.getPropertyValue("display")).toBe("");
  });
});

describe("o aparelho no navegador do Instagram", () => {
  const zerar = () => {
    localStorage.clear(); sessionStorage.clear();
    document.cookie.split(";").forEach((c) => { const n = c.split("=")[0].trim(); if (n) document.cookie = `${n}=; max-age=0; path=/`; });
  };
  it("cookie e storage zerados com a página viva: o id volta ao sair da aba", async () => {
    await abrirPagina({ braco: "nova", ativo: true });
    const id = localStorage.getItem("landing-device-id")!;
    expect(id).toBeTruthy();
    zerar();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(localStorage.getItem("landing-device-id")).toBe(id);
    expect(document.cookie).toContain(`landing_device_id=${id}`);
  });
  it("chave off: nada é regravado", async () => {
    await abrirPagina();
    const id = localStorage.getItem("landing-device-id")!;
    zerar();
    document.dispatchEvent(new Event("visibilitychange"));
    // os ouvintes das páginas dos testes anteriores continuam no document e regravam o id DELES: o que importa é este id não voltar
    expect(localStorage.getItem("landing-device-id")).not.toBe(id);
    expect(document.cookie).not.toContain(`landing_device_id=${id}`);
  });
});

describe("o download cedo do Stripe.js (LPO_STRIPE_CEDO)", () => {
  const limpar = () => document.head.querySelectorAll('[href*="js.stripe.com"], [src*="js.stripe.com"]').forEach((e) => e.remove());
  afterEach(() => { limpar(); janela.Stripe = undefined; });
  it("pede o arquivo 1× e não cria <script>: o do checkout aproveita o download, sem carregar duas vezes", async () => {
    const { preaquecerStripe } = await import("@/landing/oferta-nova");
    limpar();
    preaquecerStripe(); preaquecerStripe();
    const l = document.head.querySelectorAll<HTMLLinkElement>('link[href*="js.stripe.com"]');
    expect(l).toHaveLength(1);
    expect(l[0].rel).toBe("preload");
    expect(l[0].as).toBe("script");
    expect(document.head.querySelector('script[src*="js.stripe.com"]')).toBeNull();
  });
  it("com o checkout já baixando, ou com o Stripe pronto, não faz nada", async () => {
    const { preaquecerStripe } = await import("@/landing/oferta-nova");
    limpar();
    const s = document.createElement("script"); s.setAttribute("src", "https://js.stripe.com/v3"); s.type = "text/plain"; document.head.appendChild(s);
    preaquecerStripe();
    expect(document.head.querySelector('link[href*="js.stripe.com"]')).toBeNull();
    limpar();
    janela.Stripe = () => {};
    preaquecerStripe();
    expect(document.head.querySelector('link[href*="js.stripe.com"]')).toBeNull();
  });
});

describe("o conteúdo da página nova", () => {
  const d = new DOMParser().parseFromString(corpo, "text/html");
  const t = (d.getElementById("lpo-nova") as HTMLTemplateElement).content;
  const texto = (t.querySelector("#lpo")!.textContent ?? "") + (t.querySelector("#lpo-fixo")!.textContent ?? "");
  const so = texto.replace(/\u00a0/g, " ");
  it("oferta: R$ 67,90 vitalício, 7 dias, Pix ou cartão; sem outro preço de venda", () => {
    expect(so).toContain("R$ 67,90. Uma vez só.");
    expect(so).toContain("Paga 1 vez. É seu pra sempre.");
    expect(so).toMatch(/Vitalício/);
    expect(so).toContain("7 dias de garantia");
    expect(so).toContain("Pix ou cartão.");
    expect(so).toContain("Nada é cobrado depois");
    expect(so).not.toMatch(/27,90|69,90|12x de|\d+x de R\$/);
    expect([...so.matchAll(/R\$ \d+,\d\d/g)].map((m) => m[0]).filter((p) => p !== "R$ 67,90").sort()).toEqual(["R$ 249,90", "R$ 97,90"]); // só as 2 comparações conferidas
  });
  it("parcelas: com STRIPE_PARCELAS_MAX = 1 a página não fala em 12x nem em parcela (o que ela promete tem de aparecer no checkout)", () => {
    const max = Number(HTML.match(/var STRIPE_PARCELAS_MAX = (\d+);/)![1]);
    if (max === 1) expect(so).not.toMatch(/\d+x\b|parcel/i);
  });
  it("verdade: sem nota, estrela, quantidade de avaliações, número de compradores, promessa proibida; 'De R$' riscado não existe", () => {
    expect(so).not.toMatch(/★|⭐|4,[0-9]{1,2}\b|\d+ avalia|mil (clientes|pessoas|compradores)|De R\$|Open Finance|automátic|inteligência artificial|\bIA\b|Google Agenda|TDAH|5 minutos/i);
    expect(so).toContain("Nesta oferta, não.");
    expect(so).toContain("Não. Você lança em segundos ou importa o extrato.");
    expect(so).toContain("Telas reais do app, com dados de exemplo.");
  });
  it("as avaliações são as das lojas (trechos conferidos)", () => {
    for (const f of ["Tem tudo que eu preciso em um só lugar.", "O melhor organizador que já tive.", "Muito bom pra quem quer se organizar em todas as áreas da vida.", "É maravilhoso pra se organizar e motivar. Vale cada centavo."]) expect(so).toContain(f);
  });
  it("a mesma avaliação não aparece como duas (o 'planner online' e o 'vale cada centavo' são da mesma pessoa)", () => {
    expect(so).toContain("Vale cada centavo.");
    expect(so).not.toContain("planner online");
  });
  it("a faixa é a mesma do ar", () => {
    const ar = d.querySelector('main .lp-promo[data-so-lp="atual"]')!;
    const nova = t.querySelector(".lp-promo")!;
    expect(nova.querySelector("b")!.textContent).toBe(ar.querySelector('b[data-so-oferta="sempre"]')!.textContent);
    expect(nova.querySelector("span")!.textContent).toBe(ar.querySelector("span")!.textContent);
  });
  it("sem fita, vídeo, iframe, campo ou order bump; todo botão abre o checkout", () => {
    expect(t.querySelector("video, iframe, input, select, textarea, form")).toBeNull();
    expect(t.querySelector('[type="checkbox"]')).toBeNull();
    const css = t.querySelector("style")!.textContent ?? "";
    expect(css).not.toMatch(/overflow-x:\s*(auto|scroll)|scroll-snap/);
    for (const b of t.querySelectorAll("button")) expect(b.hasAttribute("data-lpo-abre")).toBe(true);
  });
  it("1ª tela leve: 1 imagem, o resto preguiçoso; toda imagem tem tamanho e o arquivo existe", () => {
    const imgs = [...t.querySelectorAll("img")];
    expect(imgs.filter((i) => i.getAttribute("loading") !== "lazy").map((i) => i.getAttribute("src"))).toEqual(["/landing/v3-home.webp"]);
    for (const i of imgs) {
      expect(Number(i.getAttribute("width"))).toBeGreaterThan(0);
      expect(Number(i.getAttribute("height"))).toBeGreaterThan(0);
      expect(i.getAttribute("alt")).toBeTruthy();
      expect(existsSync(resolve(raiz, "public", i.getAttribute("src")!.slice(1)))).toBe(true);
    }
  });
  it("sem id repetido com a página de hoje (o landing.ts acha cada coisa pelo id)", () => {
    const ids = [...t.querySelectorAll("[id]")].map((e) => e.id);
    for (const id of ids) expect(d.getElementById(id) === null || d.getElementById(id) === t.getElementById?.(id)).toBe(true);
  });
  it("a chave de rollback fica no script que roda antes de pintar, e o script do corpo só age com data-lpo=nova", () => {
    expect(HTML).toMatch(/if \(document\.documentElement\.getAttribute\("data-lpo"\) === "nova"\) \{\s*\(function \(\) \{\s*var tpl = document\.getElementById\("lpo-nova"\)/);
  });
});
