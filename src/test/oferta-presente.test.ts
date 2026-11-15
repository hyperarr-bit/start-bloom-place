/**
 * /oferta (15/11) — o presente de R$ 24,90 no pós-pago (chave UPSELL_OFERTA, "off" no código).
 *   head: off (padrão) = nenhum atributo/memória nova; ?upoferta=on liga só na /oferta (nunca /vitalicio, /organizar);
 *   off: o pedido NÃO leva salvar_cartao e nada do presente aparece depois do pago (a /oferta de hoje);
 *   on + cartão: o pedido leva salvar_cartao; pago → "Sim, adicionar · R$ 24,90" no mesmo cartão (Visa •••• 4242) → cartão do presente;
 *   on + cartão recusado: mensagem curta + "Pagar com Pix · R$ 24,90" (a compra principal segue valendo);
 *   on + Pix: pago → "Quero · copiar o Pix" a R$ 24,90 → QR; eventos com pagina "oferta", valor 2490, via cartao_1toque | pix;
 *   /organizar segue a 14,90 (o módulo sem `valor` = VALOR_PRESENTE_LP).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

const raiz = resolve(__dirname, "../..");
const HTML = readFileSync(resolve(raiz, "landing.html"), "utf8");
const cabeca = HTML.match(/<script>\s*(\(function \(\) \{\s*var LANDING_NOVA[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];

function rodar(fonte: string, url: string, store: Record<string, string> = {}) {
  const u = new URL(url, "https://www.coreaplicativo.com.br");
  const attrs: Record<string, string> = {};
  const location = { search: u.search, hash: u.hash, pathname: u.pathname, hostname: "www.coreaplicativo.com.br", protocol: "https:", replace: vi.fn() };
  const localStorage = { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; } };
  const ck = { v: "" };
  const document = { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } }, createElement: () => ({ setAttribute: () => {} }), head: { appendChild: () => {} }, get cookie() { return ck.v; }, set cookie(c: string) { ck.v = c.split(";")[0]; } };
  const window: Record<string, unknown> = { localStorage, crypto: { randomUUID: () => randomUUID() } };
  new Function("location", "document", "window", "localStorage", "URLSearchParams", "Math", "fetch", "sessionStorage", fonte)(location, document, window, localStorage, URLSearchParams, Math, undefined, { getItem: () => null });
  return { attrs, mem: (window.__landing ?? {}) as Record<string, unknown> };
}
const semSorteio = (a: Record<string, string>) => { const { "data-pix": _p, "data-vida": _v, "data-lp": _l, "data-otp": _o, ...r } = a; return r; };
const semChave = cabeca.replace(/\s*\/\/ 15\/11: o presente de 24,90 no pós-pago \(UPSELL_OFERTA\)[\s\S]*?\n          \}\n/, "\n");

describe("o <head>: UPSELL_OFERTA", () => {
  it("no código: off", () => { expect(HTML).toMatch(/var UPSELL_OFERTA = "off";/); });
  it("off = a /oferta de hoje: os MESMOS atributos e a MESMA memória de antes da chave existir", () => {
    expect(semChave).not.toBe(cabeca);
    for (const url of ["/oferta", "/oferta?utm_content=c7", "/vitalicio", "/organizar", "/simples"]) {
      const hoje = rodar(semChave, url), agora = rodar(cabeca, url);
      expect(semSorteio(agora.attrs)).toEqual(semSorteio(hoje.attrs));
      const { otp: _a, pix: _c, ...ma } = agora.mem; const { otp: _b, pix: _d, ...mb } = hoje.mem; // sorteios por aparelho (id aleatório a cada rodada)
      expect(ma).toEqual(mb);
      expect(agora.attrs["data-up-oferta"]).toBeUndefined();
    }
  });
  it("?upoferta=on liga só na /oferta (fica no aparelho); auto desfaz; /vitalicio e /organizar nunca", () => {
    const store: Record<string, string> = {};
    const r = rodar(cabeca, "/oferta?upoferta=on", store);
    expect(r.attrs["data-up-oferta"]).toBe("on");
    expect(r.mem).toMatchObject({ up_oferta: "on", up_oferta_forcado: true });
    expect(rodar(cabeca, "/oferta", store).mem.up_oferta).toBe("on");
    expect(rodar(cabeca, "/vitalicio?upoferta=on", {}).mem.up_oferta).toBeUndefined();
    expect(rodar(cabeca, "/organizar?upoferta=on", {}).mem.up_oferta).toBeUndefined();
    expect(rodar(cabeca, "/oferta?upoferta=auto", store).mem.up_oferta).toBeUndefined();
    expect(rodar(cabeca.replace('var UPSELL_OFERTA = "off"', 'var UPSELL_OFERTA = "on"'), "/oferta", {}).mem.up_oferta).toBe("on");
  });
});

/* ───────── a página no jsdom (o mesmo jeito do oferta-stripe.test.ts) ───────── */
const corpo = HTML.match(/<body>([\s\S]*)<\/body>/)![1].replace(/<script type="module"[^>]*><\/script>/, "");
const estilo = HTML.match(/<style>([\s\S]*?)<\/style>/)![1];
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Ev = Record<string, unknown> & { nome: string };
const eventos = (): Ev[] => ((window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding ?? []);
const dos = (nome: string) => eventos().filter((e) => e.nome === nome);
let criadas: Array<Record<string, unknown>> = [];
let statusPago = false;
async function abrirPagina(o: { up?: boolean } = {}) {
  await dormir(20);
  (await import("@/landing/stripe-checkout"))._zerar();
  vi.resetModules();
  localStorage.clear(); sessionStorage.clear();
  document.cookie = "landing_presente=; Max-Age=0; Path=/";
  document.querySelectorAll("#pr-pag, #oc").forEach((x) => x.remove());
  window.history.replaceState(null, "", "/oferta?utm_content=c7");
  (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
  (window as unknown as { __landingSimularU2027?: unknown }).__landingSimularU2027 = undefined;
  criadas = []; statusPago = false;
  (window as unknown as { fbq?: unknown }).fbq = vi.fn();
  (window as unknown as { __ofertaApi?: unknown }).__ofertaApi = {
    criar: async (c: Record<string, unknown>) => { criadas.push(c); return { ok: true, clientSecret: "pi_123_secret_abc", pi: "pi_123" }; },
    status: async () => ({ ok: true, status: statusPago ? "succeeded" : "requires_action", pago: statusPago, metodo: statusPago ? "pix" : null }),
  };
  (window as unknown as { __stripeFalso?: unknown }).__stripeFalso = {
    elements: () => ({ create: () => ({ mount: (el: HTMLElement) => { el.innerHTML = '<div data-testid="pe-falso">PE</div>'; }, on: (e: string, cb: (x: Record<string, unknown>) => void) => { if (e === "ready") setTimeout(() => cb({}), 0); } }), submit: async () => ({}) }),
    createPaymentMethod: async () => ({ paymentMethod: { id: "pm_1", card: { brand: "visa", last4: "4242" } } }),
    confirmPayment: async () => ({ paymentIntent: { id: "pi_123", status: "succeeded" } }),
    confirmPixPayment: async () => ({ paymentIntent: { id: "pi_123", status: "requires_action", next_action: { type: "pix_display_qr_code", pix_display_qr_code: { data: "00020126PIXSTRIPE", expires_at: 1893456000 } } } }),
  };
  const d = document.documentElement;
  d.setAttribute("data-t", "a"); d.setAttribute("data-oferta", "sempre"); d.setAttribute("data-checkout", "email"); d.setAttribute("data-lp", "atual");
  d.setAttribute("data-pagina", "oferta"); d.setAttribute("data-checkout-ext", "stripe");
  (window as unknown as { __landing?: unknown }).__landing = { pagina: "oferta", checkout_ext: "stripe", stripe_pk: "pk_test_X1", stripe_preco_centavos: 6790, stripe_parcelas: "Pix ou cartão", stripe_parcelas_max: 1, ...(o.up ? { up_oferta: "on" } : {}) };
  document.head.querySelectorAll("style[data-teste-st]").forEach((s) => s.remove());
  const st = document.createElement("style"); st.setAttribute("data-teste-st", ""); st.textContent = estilo; document.head.appendChild(st);
  document.body.removeAttribute("style");
  document.body.innerHTML = corpo;
  (await import("@/landing/stripe-checkout"))._zerar();
  await import("@/landing/landing");
}
const pagar = () => document.getElementById("oc-pagar") as HTMLButtonElement;
async function pagarCom(metodo: "card" | "pix") {
  (document.getElementById("lp-hotmart-atual") as HTMLButtonElement).click();
  await vi.waitFor(() => { if (!document.querySelector('[data-testid="pe-falso"]') || pagar().hasAttribute("aria-disabled")) throw new Error("sem PE"); }, { timeout: 3000, interval: 20 });
  const c = document.getElementById("oc-email") as HTMLInputElement; c.value = "ana@exemplo.com"; c.dispatchEvent(new Event("input"));
  if (metodo === "card") { document.querySelector<HTMLButtonElement>('[data-metodo="card"]')!.click(); await dormir(10); }
  pagar().click();
  if (metodo === "pix") {
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pix"]')) throw new Error("sem pix"); }, { timeout: 3000, interval: 20 });
    statusPago = true;
  }
  await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pago"]')) throw new Error("sem pago"); }, { timeout: 6000, interval: 40 });
}
const presente = () => document.querySelector<HTMLElement>("#pr-pag");
const esperar = (sel: string, t = 4000) => vi.waitFor(() => { if (!document.querySelector(sel)) throw new Error(`sem ${sel}`); }, { timeout: t, interval: 30 });
afterEach(() => { (window as unknown as { __ofertaApi?: unknown }).__ofertaApi = undefined; (window as unknown as { __stripeFalso?: unknown }).__stripeFalso = undefined; });

describe("o pós-pago da /oferta", () => {
  it("chave OFF: o pedido não leva salvar_cartao e nada do presente aparece (a /oferta de hoje)", async () => {
    await abrirPagina();
    await pagarCom("card");
    await dormir(400);
    expect(criadas.length).toBeGreaterThan(0);
    for (const c of criadas) expect(c).not.toHaveProperty("salvar_cartao");
    expect(presente()).toBeNull();
    expect(dos("landing_presente_view")).toHaveLength(0);
  });

  it("ON + cartão: salvar_cartao no pedido → 'Sim, adicionar · R$ 24,90' no mesmo cartão → cartão do presente", async () => {
    await abrirPagina({ up: true });
    await pagarCom("card");
    expect(criadas.some((c) => c.salvar_cartao === true)).toBe(true);
    await esperar('[data-testid="presente-sim"]');
    const t = presente()!.textContent!.replace(/\s+/g, " ");
    expect(t).toContain("Leve alguém junto");
    expect(t).toContain("Sim, adicionar · R$ 24,90");
    expect(t).toContain("em vez de R$ 67,90");
    expect(t).toContain("No mesmo cartão Visa •••• 4242, sem digitar nada.");
    expect(t).not.toMatch(/14,90/);
    expect(document.querySelector('[data-testid="oferta-pago"]')).not.toBeNull(); // a tela de pago de sempre fica embaixo
    expect(dos("landing_presente_view")[0]).toMatchObject({ pagina: "oferta", valor: 2490, via: "cartao_1toque", order_id: "pi_123" });
    document.querySelector<HTMLButtonElement>('[data-testid="presente-sim"]')!.click();
    await esperar('[data-testid="presente-cobrando"]', 1000);
    await esperar('[data-testid="presente-cartao"]', 5000);
    expect(dos("landing_presente_pago")[0]).toMatchObject({ valor: 24.9, via: "cartao_1toque" });
    expect(presente()!.textContent).toContain("Presente pago · R$ 24,90");
    expect(dos("landing_presente_quero")).toHaveLength(1);
  }, 20000);

  it("ON + cartão recusado: mensagem curta, a compra segue valendo, e o Pix vira a saída", async () => {
    await abrirPagina({ up: true });
    await pagarCom("card");
    (window as unknown as { __landingSimularU2027?: unknown }).__landingSimularU2027 = { recusar: true };
    await esperar('[data-testid="presente-sim"]');
    document.querySelector<HTMLButtonElement>('[data-testid="presente-sim"]')!.click();
    await esperar('[data-testid="presente-erro"]', 5000);
    expect(document.querySelector('[data-testid="presente-erro"]')!.textContent).toBe("O banco não aprovou este valor. Sua compra do CORE continua garantida.");
    expect(document.querySelector('[data-testid="presente-quero"]')!.textContent).toBe("Pagar com Pix · R$ 24,90");
    expect(dos("landing_presente_recusado")).toHaveLength(1);
    document.querySelector<HTMLButtonElement>('[data-testid="presente-quero"]')!.click();
    await esperar('[data-testid="presente-qr"]', 5000);
    expect(dos("landing_presente_copiado").at(-1)).toMatchObject({ via: expect.any(String) });
    expect(dos("landing_presente_pix_pronto").at(-1)).toMatchObject({ pagina: "oferta", via: "pix" });
  }, 20000);

  it("ON + Pix: 'Quero · copiar o Pix' a R$ 24,90 → QR (Pix da Stripe); 'Agora não' volta pro pago de sempre", async () => {
    await abrirPagina({ up: true });
    await pagarCom("pix");
    await esperar('[data-testid="presente-quero"]');
    expect(presente()!.textContent).toContain("R$ 24,90");
    expect(document.querySelector('[data-testid="presente-quero"]')!.textContent).toBe("Quero · copiar o Pix");
    for (const c of criadas) expect(c).not.toHaveProperty("salvar_cartao"); // revisão A3: no Pix o cartão não é salvo
    expect(JSON.parse(sessionStorage.getItem("oferta-presente-compra") || "{}")).toMatchObject({ pi: "pi_123", metodo: "pix" }); // revisão B5
    expect(dos("landing_presente_view")[0]).toMatchObject({ pagina: "oferta", valor: 2490, via: "pix" });
    document.querySelector<HTMLButtonElement>('[data-testid="presente-agora-nao"]')!.click();
    await dormir(50);
    expect(presente()).toBeNull();
    expect(document.querySelector('[data-testid="oferta-pago"]')).not.toBeNull();
    expect(dos("landing_presente_nao")[0]).toMatchObject({ de: "oferta", pagina: "oferta" });
  }, 20000);
});
