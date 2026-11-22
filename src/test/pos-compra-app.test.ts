/**
 * /oferta (22/11) — o PÓS-COMPRA QUE LEVA PRO APP (chave POS_COMPRA_APP, "on" no código).
 *   head: ?poscompra=off devolve o pós-pago de hoje; só a /oferta lê;
 *   off: o pago de hoje (indique e ganhe como hoje);
 *   on:  "Pronto! Seu CORE está liberado" + passo a passo; sem indique, sem presente; e-mail na tela; selos certos; aviso de não
 *        comprar de novo; nenhum preço; ?ref= continua no pedido; recarga reabre o passo a passo.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { aparelhoPelaUa, htmlPosCompra, htmlPassos, lerCompraPos, guardarCompraPos, VALE_MS, EMAIL_SUPORTE } from "@/landing/pos-compra-app";

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
const cabecaOff = cabeca.replace(/var POS_COMPRA_APP = "(on|off)"/, 'var POS_COMPRA_APP = "off"');
const semChave = cabecaOff.replace(/\s*\/\/ 22\/11: o pós-compra que leva pro app \(POS_COMPRA_APP\)[\s\S]*?mem\.pos_app = "on"; \}\n/, "\n");

describe("o <head>: POS_COMPRA_APP", () => {
  it('no código: "on" (rollback = "off")', () => { expect(HTML).toMatch(/var POS_COMPRA_APP = "on";/); });
  it("ligada: só a /oferta; ?poscompra=off desliga no aparelho; auto desfaz", () => {
    expect(rodar(cabeca, "/oferta").mem.pos_app).toBe("on");
    expect(rodar(cabeca, "/oferta").attrs["data-pos-app"]).toBe("on");
    const store: Record<string, string> = {};
    expect(rodar(cabeca, "/oferta?poscompra=off", store).mem.pos_app).toBeUndefined();
    expect(rodar(cabeca, "/oferta", store).mem.pos_app).toBeUndefined();
    expect(rodar(cabeca, "/oferta?poscompra=auto", store).mem.pos_app).toBe("on");
    for (const url of ["/vitalicio", "/organizar", "/vida", "/simples", "/escolha"]) expect(rodar(cabeca, url).mem.pos_app).toBeUndefined();
  });
  it("off = os MESMOS atributos e a MESMA memória de antes da chave existir", () => {
    expect(semChave).not.toBe(cabecaOff);
    for (const url of ["/oferta", "/oferta?ref=ANA7K2", "/vitalicio", "/organizar"]) {
      const hoje = rodar(semChave, url), agora = rodar(cabecaOff, url);
      expect(semSorteio(agora.attrs)).toEqual(semSorteio(hoje.attrs));
      const { otp: _a, pix: _c, ...ma } = agora.mem; const { otp: _b, pix: _d, ...mb } = hoje.mem;
      expect(ma).toEqual(mb);
    }
  });
});

describe("o conteúdo do passo a passo", () => {
  it("aparelho pelo navegador", () => {
    expect(aparelhoPelaUa("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Instagram 300")).toBe("ios");
    expect(aparelhoPelaUa("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("ios"); // iPad
    expect(aparelhoPelaUa("Mozilla/5.0 (Linux; Android 14; SM-A146M) [FBAN/EMA;FB_IAB/Instagram]")).toBe("android");
    expect(aparelhoPelaUa("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("computador");
  });
  it("nenhum preço, nenhuma oferta; o suporte é contato@ (nunca suporte@)", () => {
    for (const ap of ["ios", "android", "computador"] as const) {
      const h = htmlPosCompra("bia@exemplo.com", ap) + htmlPassos(ap, null);
      expect(h).not.toMatch(/R\$|\d+,\d{2}/);
      expect(h).not.toMatch(/indique|indicação|presente|2027|amiga/i);
      expect(h).toContain(EMAIL_SUPORTE);
      expect(h).not.toContain("suporte@");
      expect(h).toContain("Você já pagou. Não compre de novo no app.");
    }
  });
  it("o caminho do app de hoje (1.0.29): Entrar → e-mail → Receber código → 8 números; e a saída da tela de planos", () => {
    const ios = htmlPassos("ios", "bia@exemplo.com");
    expect(ios).toContain("“Já tenho conta? Entrar”");
    expect(ios).toContain("“Receber código”");
    expect(ios).toContain("8 números");
    expect(ios).toContain("“Já é cliente? Entre com seu e-mail”");
    expect(ios).toContain("/como-entrar/v2/ios-1-abrir.webp");
    const and = htmlPassos("android", "bia@exemplo.com");
    expect(and).toContain("“Entrar na minha conta”");
    expect(and).toContain("<b>X</b>");
    expect(and).toContain("/como-entrar/v2/android-2-email.webp");
    // as duas lojas aparecem sempre (regra fixa do dono), a do aparelho primeiro
    for (const h of [ios, and, htmlPassos("computador", null)]) { expect(h).toContain('data-loja="ios"'); expect(h).toContain('data-loja="android"'); }
    expect(ios.indexOf('data-loja="ios"')).toBeLessThan(ios.indexOf('data-loja="android"'));
    expect(and.indexOf('data-loja="android"')).toBeLessThan(and.indexOf('data-loja="ios"'));
  });
  it("as imagens citadas existem", () => {
    const h = ["ios", "android"].map((a) => htmlPassos(a as "ios", null)).join("");
    for (const m of h.matchAll(/\/como-entrar\/v2\/([a-z0-9-]+\.webp)/g)) expect(() => readFileSync(resolve(raiz, "public/como-entrar/v2", m[1]))).not.toThrow();
  });
  it("a compra fica na aba por 6 h", () => {
    sessionStorage.clear();
    guardarCompraPos({ pi: "pi_9", email: "bia@exemplo.com" }, 1000);
    expect(lerCompraPos(2000)).toEqual({ pi: "pi_9", email: "bia@exemplo.com" });
    expect(lerCompraPos(1000 + VALE_MS + 1)).toBeNull();
    sessionStorage.clear();
  });
});

/* ───────── a página no jsdom (o mesmo jeito do oferta-indique.test.ts) ───────── */
const corpo = HTML.match(/<body>([\s\S]*)<\/body>/)![1].replace(/<script type="module"[^>]*><\/script>/, "");
const estilo = HTML.match(/<style>([\s\S]*?)<\/style>/)![1];
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Ev = Record<string, unknown> & { nome: string };
const eventos = (): Ev[] => ((window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding ?? []);
const dos = (nome: string) => eventos().filter((e) => e.nome === nome);
let criadas: Array<Record<string, unknown>> = [];
let statusPago = false;
async function abrirPagina(o: { pos?: boolean; manterAba?: boolean } = {}) {
  await dormir(20);
  (await import("@/landing/stripe-checkout"))._zerar();
  (await import("@/landing/indique"))._zerarIndique();
  (await import("@/landing/indique"))._zerarIndicador();
  (await import("@/landing/pos-compra-app"))._zerarPosCompra();
  vi.resetModules();
  localStorage.clear();
  if (!o.manterAba) sessionStorage.clear();
  document.cookie = "landing_indicador=; Max-Age=0; Path=/";
  document.querySelectorAll("#pr-pag, #oc, #igt, #pc-faixa, .pc-cheia").forEach((x) => x.remove());
  window.history.replaceState(null, "", "/oferta?ref=ana7k2&utm_content=c7");
  (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
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
  // produção de hoje: indique ligado (INDIQUE_OFERTA "on"), presente desligado
  (window as unknown as { __landing?: unknown }).__landing = { pagina: "oferta", checkout_ext: "stripe", stripe_pk: "pk_test_X1", stripe_preco_centavos: 6790, stripe_parcelas: "Pix ou cartão", stripe_parcelas_max: 1, indique: "on", ...(o.pos ? { pos_app: "on" } : {}) };
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
  const c = document.getElementById("oc-email") as HTMLInputElement; c.value = "bia@exemplo.com"; c.dispatchEvent(new Event("input"));
  if (metodo === "card") { document.querySelector<HTMLButtonElement>('[data-metodo="card"]')!.click(); await dormir(10); }
  pagar().click();
  if (metodo === "pix") {
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pix"]')) throw new Error("sem pix"); }, { timeout: 3000, interval: 20 });
    statusPago = true;
  }
  await vi.waitFor(() => { if (!document.querySelector('[data-testid="oferta-pago"]')) throw new Error("sem pago"); }, { timeout: 6000, interval: 40 });
}
const esperar = (sel: string, t = 4000) => vi.waitFor(() => { if (!document.querySelector(sel)) throw new Error(`sem ${sel}`); }, { timeout: t, interval: 30 });
afterEach(() => { (window as unknown as { __ofertaApi?: unknown }).__ofertaApi = undefined; (window as unknown as { __stripeFalso?: unknown }).__stripeFalso = undefined; });

describe("o pós-pago da /oferta com POS_COMPRA_APP", () => {
  it("OFF: o pago de hoje (Compra confirmada + Já tenho conta? Entrar + o cartão do indique), nada do pós-compra novo", async () => {
    await abrirPagina();
    await pagarCom("card");
    await esperar('[data-testid="indique-cartao"]');
    const pago = document.querySelector('[data-testid="oferta-pago"]')!;
    expect(pago.textContent).toContain("Compra confirmada!");
    expect(pago.textContent).toContain("Já tenho conta?");
    expect(document.querySelector('[data-testid="pos-compra"]')).toBeNull();
    expect(dos("pos_compra_view")).toHaveLength(0);
  }, 20000);

  it("ON + cartão: o passo a passo, sem indique nem presente; e-mail na tela; selos certos; aviso; ?ref= ainda no pedido", async () => {
    await abrirPagina({ pos: true });
    await pagarCom("card");
    await esperar('[data-testid="pos-compra"]');
    await dormir(300);
    const pos = document.querySelector<HTMLElement>('[data-testid="pos-compra"]')!;
    const texto = pos.textContent!.replace(/\s+/g, " ");
    expect(texto).toContain("Pronto! Seu CORE está liberado");
    expect(pos.querySelector('[data-testid="pos-email"]')!.textContent).toContain("bia@exemplo.com");
    expect(texto).toContain("Você já pagou. Não compre de novo no app.");
    expect(texto).not.toMatch(/R\$|67,90/);
    expect(document.querySelector('[data-testid="indique-cartao"]')).toBeNull();
    expect(document.querySelector("#igt")).toBeNull();
    expect(document.querySelector("#pr-pag")).toBeNull();
    expect(eventos().filter((e) => String(e.nome).startsWith("landing_indique") || String(e.nome).startsWith("landing_presente"))).toHaveLength(0);
    for (const c of criadas) { expect(c.atrib).toMatchObject({ indicador: "ANA7K2" }); expect(c).not.toHaveProperty("salvar_cartao"); }
    // as lojas: links oficiais, dentro do [data-testid=oferta-pago] (a atribuição de sempre vale)
    const ios = pos.querySelector<HTMLAnchorElement>('a[data-loja="ios"]')!, and = pos.querySelector<HTMLAnchorElement>('a[data-loja="android"]')!;
    expect(ios.getAttribute("href")).toMatch(/^https:\/\/apps\.apple\.com\/br\/app\/id6806913181/);
    expect(and.getAttribute("href")).toMatch(/^https:\/\/play\.google\.com\/store\/apps\/details\?id=br\.com\.coreaplicativo\.app/);
    expect(ios.closest('[data-testid="oferta-pago"]')).not.toBeNull();
    expect(dos("pos_compra_view")[0]).toMatchObject({ tem_email: true, via: "pago" });
    expect(JSON.stringify(eventos())).not.toContain("bia@exemplo.com"); // nenhum evento leva o e-mail
    // Purchase continua 1×
    expect(dos("landing_stripe_pago")).toHaveLength(1);
  }, 20000);

  it("ON: abas, lojas, copiar, navegador e ajuda medem; Pix também cai no passo a passo", async () => {
    await abrirPagina({ pos: true });
    await pagarCom("pix");
    await esperar('[data-testid="pos-compra"]');
    document.querySelector<HTMLButtonElement>('[data-testid="pos-aba-ios"]')!.click();
    expect(document.querySelector('[data-testid="pos-passos"]')!.getAttribute("data-aparelho")).toBe("ios");
    expect(dos("pos_compra_aba")[0]).toMatchObject({ aba: "ios" });
    const ios = document.querySelector<HTMLAnchorElement>('#pc-conteudo a[data-loja="ios"]')!;
    ios.addEventListener("click", (e) => e.preventDefault());
    ios.click();
    expect(dos("pos_compra_loja")[0]).toMatchObject({ loja: "ios" });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(async () => {}) }, configurable: true });
    document.querySelector<HTMLButtonElement>('[data-testid="pos-copiar"]')!.click();
    await vi.waitFor(() => { if (!dos("pos_compra_copiar_email").length) throw new Error("sem cópia"); });
    expect(dos("pos_compra_copiar_email")[0]).toMatchObject({ ok: true });
    const nav = document.querySelector<HTMLAnchorElement>('[data-testid="pos-navegador"]')!;
    nav.addEventListener("click", (e) => e.preventDefault()); nav.click();
    expect(dos("pos_compra_navegador")).toHaveLength(1);
    const aj = document.querySelector<HTMLAnchorElement>("a[data-ajuda]")!;
    expect(aj.getAttribute("href")).toBe("mailto:contato@coreaplicativo.com.br");
    aj.addEventListener("click", (e) => e.preventDefault()); aj.click();
    expect(dos("pos_compra_ajuda")).toHaveLength(1);
  }, 20000);

  it("ON: recarregou a aba depois de pagar → o passo a passo abre de novo; fechar deixa a faixa", async () => {
    await abrirPagina({ pos: true });
    await pagarCom("card");
    await esperar('[data-testid="pos-compra"]');
    await abrirPagina({ pos: true, manterAba: true });
    await esperar('[data-testid="pos-tela-cheia"]');
    expect(document.querySelector('[data-testid="pos-tela-cheia"]')!.textContent).toContain("bia@exemplo.com");
    expect(dos("pos_compra_view")[0]).toMatchObject({ via: "recarga" });
    expect(document.querySelector('[data-testid="indique-faixa"]')).toBeNull();
    document.querySelector<HTMLButtonElement>('[data-testid="pos-tela-cheia"] .pc-cheia-barra button')!.click();
    expect(document.querySelector('[data-testid="pos-tela-cheia"]')).toBeNull();
    await esperar('[data-testid="pos-faixa"]');
    document.querySelector<HTMLButtonElement>('[data-testid="pos-faixa-abrir"]')!.click();
    await esperar('[data-testid="pos-tela-cheia"]');
    // sem compra na aba: nada
    await abrirPagina({ pos: true });
    await dormir(50);
    expect(document.querySelector('[data-testid="pos-tela-cheia"], [data-testid="pos-faixa"]')).toBeNull();
  }, 30000);
});

describe("o e-mail da compra da /oferta (Stripe)", () => {
  it("leva o passo a passo do app de hoje, as 2 lojas e o aviso de não comprar de novo; sem preço e sem indique", async () => {
    const { htmlVenda, EMAIL_POS_COMPRA_APP } = await import("../../supabase/functions/_shared/email-venda");
    expect(EMAIL_POS_COMPRA_APP).toBe("on");
    const h = htmlVenda({ email: "bia@exemplo.com", periodo: "lifetime", hoje: true, tutorialApp: true });
    expect(h).toContain('data-bloco="como-entrar-app"');
    for (const t of ["“Já tenho conta? Entrar”", "“Receber código”", "8 números", "Você já pagou. Não compre de novo no app.", "“Já é cliente? Entre com seu e-mail”", "bia@exemplo.com", "apps.apple.com/br/app/id6806913181", "play.google.com/store/apps/details?id=br.com.coreaplicativo.app", "/como-entrar"]) expect(h).toContain(t);
    expect(h).not.toMatch(/R\$|indique|amiga/i);
    expect(h).not.toContain("suporte@");
    // sem a opção: o e-mail de hoje, igual
    expect(htmlVenda({ email: "bia@exemplo.com", periodo: "lifetime", hoje: true })).toContain('data-bloco="entrar"');
    expect(htmlVenda({ email: "bia@exemplo.com", periodo: "lifetime", hoje: true })).not.toContain("como-entrar-app");
  });
  it("o stripe-webhook manda o tutorial na /oferta no lugar do bloco do indique", () => {
    const s = readFileSync(resolve(raiz, "supabase/functions/_shared/stripe.ts"), "utf8");
    expect(s).toContain("tutorialNoEmail(oferta.pagina) ? { tutorialApp: true } :");
  });
});
