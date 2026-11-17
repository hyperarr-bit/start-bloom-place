/**
 * /oferta (23/11) — o INDIQUE E GANHE no pós-pago (chave INDIQUE_OFERTA, "off" no código), no lugar do presente de R$ 24,90.
 *   head: off (padrão) = os MESMOS atributos e a MESMA memória de antes da chave existir; ?indique=on liga só na /oferta;
 *   off: o ?ref= nem é lido (o pedido é o de hoje), o pago abre o presente como hoje e nada do indique aparece;
 *   on: o ?ref= vai no pedido (atrib.indicador), o cartão NÃO é salvo, o presente NÃO aparece; o pago ganha um CARTÃO no fim
 *       (nada cobre o "Já tenho conta? Entrar") → "Quero meu link" abre a folha já gerando → link + WhatsApp + painel.
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
// 17/11 (subida): a chave LIGADA no código. Os testes de "off" forçam a chave por aqui, sem depender do padrão do arquivo.
const cabecaOff = cabeca.replace(/var INDIQUE_OFERTA = "(on|off)"/, 'var INDIQUE_OFERTA = "off"');
const semChave = cabecaOff.replace(/\s*\/\/ 23\/11: o indique e ganhe no lugar do presente \(INDIQUE_OFERTA\)[\s\S]*?mem\.indique = "on"; \}\n/, "\n");

describe("o <head>: INDIQUE_OFERTA", () => {
  it('no código: "on" (ligada na subida de 17/11; rollback = "off")', () => { expect(HTML).toMatch(/var INDIQUE_OFERTA = "on";/); });
  it('ligada: a /oferta abre com o indique; ?indique=off desliga no aparelho; /vitalicio e /organizar nunca', () => {
    expect(rodar(cabeca, "/oferta", {}).mem.indique).toBe("on");
    expect(rodar(cabeca, "/oferta?indique=off", {}).mem.indique).toBeUndefined();
    expect(rodar(cabeca, "/vitalicio", {}).mem.indique).toBeUndefined();
    expect(rodar(cabeca, "/organizar", {}).mem.indique).toBeUndefined();
  });
  it("off = a /oferta de hoje: os MESMOS atributos e a MESMA memória de antes da chave existir", () => {
    expect(semChave).not.toBe(cabeca);
    for (const url of ["/oferta", "/oferta?ref=ANA7K2", "/oferta?utm_content=c7", "/vitalicio", "/organizar", "/simples"]) {
      const hoje = rodar(semChave, url), agora = rodar(cabecaOff, url);
      expect(semSorteio(agora.attrs)).toEqual(semSorteio(hoje.attrs));
      const { otp: _a, pix: _c, ...ma } = agora.mem; const { otp: _b, pix: _d, ...mb } = hoje.mem;
      expect(ma).toEqual(mb);
      expect(agora.attrs["data-indique"]).toBeUndefined();
    }
  });
  it("?indique=on liga só na /oferta (fica no aparelho); auto desfaz; /vitalicio e /organizar nunca", () => {
    const store: Record<string, string> = {};
    expect(rodar(cabecaOff, "/oferta?indique=on", store).mem).toMatchObject({ indique: "on", indique_forcado: true });
    expect(rodar(cabecaOff, "/oferta", store).mem.indique).toBe("on");
    expect(rodar(cabecaOff, "/oferta?indique=auto", store).mem.indique).toBeUndefined();
    expect(rodar(cabecaOff, "/vitalicio?indique=on", {}).mem.indique).toBeUndefined();
    expect(rodar(cabecaOff, "/organizar?indique=on", {}).mem.indique).toBeUndefined();
    expect(rodar(cabecaOff.replace('var INDIQUE_OFERTA = "off"', 'var INDIQUE_OFERTA = "on"'), "/oferta", {}).mem.indique).toBe("on");
  });
});

/* ───────── a página no jsdom (o mesmo jeito do oferta-presente.test.ts) ───────── */
const corpo = HTML.match(/<body>([\s\S]*)<\/body>/)![1].replace(/<script type="module"[^>]*><\/script>/, "");
const estilo = HTML.match(/<style>([\s\S]*?)<\/style>/)![1];
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Ev = Record<string, unknown> & { nome: string };
const eventos = (): Ev[] => ((window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding ?? []);
const dos = (nome: string) => eventos().filter((e) => e.nome === nome);
let criadas: Array<Record<string, unknown>> = [];
let statusPago = false;
async function abrirPagina(o: { indique?: boolean; manterAba?: boolean } = {}) {
  await dormir(20);
  (await import("@/landing/stripe-checkout"))._zerar();
  (await import("@/landing/indique"))._zerarIndique();
  (await import("@/landing/indique"))._zerarIndicador();
  vi.resetModules();
  localStorage.clear(); if (!o.manterAba) sessionStorage.clear();
  document.cookie = "landing_indicador=; Max-Age=0; Path=/";
  document.querySelectorAll("#pr-pag, #oc, #igt").forEach((x) => x.remove());
  window.history.replaceState(null, "", "/oferta?ref=ana7k2&utm_content=c7");
  (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
  (window as unknown as { __landingSimularIndique?: unknown }).__landingSimularIndique = undefined;
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
  // o presente (UPSELL_OFERTA) está LIGADO no ar desde 15/11: "hoje" = up_oferta "on"
  (window as unknown as { __landing?: unknown }).__landing = { pagina: "oferta", checkout_ext: "stripe", stripe_pk: "pk_test_X1", stripe_preco_centavos: 6790, stripe_parcelas: "Pix ou cartão", stripe_parcelas_max: 1, up_oferta: "on", ...(o.indique ? { indique: "on" } : {}) };
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

describe("o pós-pago da /oferta com o indique e ganhe", () => {
  it("chave OFF: nenhuma TELA do indique, o presente abre como hoje — mas o ?ref= VAI no pedido (esconder a tela não perde comissão)", async () => {
    await abrirPagina();
    await pagarCom("card");
    await esperar('[data-testid="presente-sim"]'); // o presente de 24,90 de hoje
    // críticas 17/11 (rollback "esconder a vitrine"): o link que já está no WhatsApp continua gravando a comissão
    expect(criadas.length).toBeGreaterThan(0);
    for (const c of criadas) expect(c.atrib).toMatchObject({ indicador: "ANA7K2", utm_content: "c7" });
    expect(criadas.some((c) => c.salvar_cartao === true)).toBe(true); // como hoje (presente ligado)
    expect(document.querySelector("#igt")).toBeNull();
    expect(document.querySelector('[data-testid="indique-cartao"]')).toBeNull();
    expect(eventos().filter((e) => String(e.nome).startsWith("landing_indique"))).toHaveLength(0); // nada da tela
    expect(dos("landing_indicado")[0]).toMatchObject({ indicador: "ANA7K2", tela: "off" });
  }, 20000);

  it("recarregou a aba depois de pagar (Instagram): faixa no topo com o ACESSO primeiro e o link de indicação de volta", async () => {
    await abrirPagina({ indique: true });
    await pagarCom("card");
    await esperar('[data-testid="indique-cartao"]');
    expect(document.querySelector('[data-testid="indique-faixa"]')).toBeNull(); // com a tela de pago, nada de faixa
    await abrirPagina({ indique: true, manterAba: true }); // a recarga: a página de venda volta, a aba lembra a compra
    await esperar('[data-testid="indique-faixa"]');
    const faixa = document.querySelector('[data-testid="indique-faixa"]')!;
    const botoes = [...faixa.querySelectorAll("a, button")].map((x) => x.textContent);
    expect(botoes).toEqual(["Como entrar no app", "Seu link de indicação"]); // o acesso vem primeiro
    expect(faixa.querySelector("a")!.getAttribute("href")).toBe("/como-entrar");
    document.querySelector<HTMLButtonElement>('[data-testid="indique-faixa-link"]')!.click();
    await esperar('[data-testid="indique-tela"]');
    // sem a compra na aba (outra aba / mais de 3 h): nada
    await abrirPagina({ indique: true });
    await dormir(30);
    expect(document.querySelector('[data-testid="indique-faixa"]')).toBeNull();
  }, 20000);

  it("clique de ANÚNCIO depois do link da amiga: o indicador guardado sai (o CORE não paga anúncio + comissão)", async () => {
    const { capturarIndicador, chegouPorAnuncio, _zerarIndicador } = await import("@/landing/indique");
    const mem: Record<string, string> = {};
    const st = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; } };
    let biscoito = "";
    const ck = { ler: () => biscoito || null, gravar: (_n: string, v: string) => { biscoito = v; } };
    _zerarIndicador();
    expect(capturarIndicador("?ref=ana7k2", st, ck, 1000)).toBe("ANA7K2");
    expect(capturarIndicador("", st, ck, 2000)).toBe("ANA7K2"); // voltou sozinha: vale
    expect(capturarIndicador("?fbclid=abc&utm_source=FB", st, ck, 3000)).toBeNull(); // veio pelo anúncio: o último clique é dele
    _zerarIndicador();
    expect(capturarIndicador("", st, ck, 4000)).toBeNull(); // nem a memória, nem o storage, nem o cookie trazem de volta
    expect(chegouPorAnuncio("?utm_source=ig&utm_medium=paid")).toBe(true);
    expect(chegouPorAnuncio("?utm_source=email&utm_medium=acesso")).toBe(false);
    expect(chegouPorAnuncio("?utm_source=whatsapp")).toBe(false);
    expect(capturarIndicador("?ref=bia22x&fbclid=abc", st, ck, 5000)).toBe("BIA22X"); // o próprio link com fbclid (story da amiga) vale
  });

  it("chave ON + cartão: ?ref= no pedido, cartão NÃO salvo, sem presente; nada cobre o pago; cartão → TELA CHEIA → link + WhatsApp", async () => {
    await abrirPagina({ indique: true });
    await pagarCom("card");
    expect(criadas.length).toBeGreaterThan(0);
    for (const c of criadas) { expect(c.atrib).toMatchObject({ indicador: "ANA7K2", utm_content: "c7" }); expect(c).not.toHaveProperty("salvar_cartao"); }
    await esperar('[data-testid="indique-cartao"]');
    await dormir(300);
    expect(document.querySelector("#igt")).toBeNull(); // nada abre sozinho por cima do "Já tenho conta? Entrar"
    expect(document.querySelector("#pr-pag")).toBeNull(); // o presente não aparece
    const pago = document.querySelector('[data-testid="oferta-pago"]')!;
    expect(pago.querySelector('[data-testid="indique-cartao"]')!.textContent).toContain("Indique e ganhe");
    expect(pago.textContent).toContain("Já tenho conta?"); // a tela de pago de sempre, inteira
    expect(dos("landing_indique_view")[0]).toMatchObject({ pi: "pi_123", estilo: "c" }); // a versão C é a padrão
    document.querySelector<HTMLButtonElement>('[data-testid="indique-abrir"]')!.click();
    await esperar('[data-testid="indique-tela"]');
    const tela = document.querySelector<HTMLElement>('[data-testid="indique-tela"]')!;
    expect(tela.getAttribute("data-estilo")).toBe("bitepal"); // a pele
    expect(tela.getAttribute("data-versao")).toBe("c");
    const texto = tela.textContent!.replace(/\s+/g, " ");
    expect(texto).toContain("Convide suas amigas");
    expect(texto).toContain("por amiga"); // o número-herói conta até o valor (animação)
    await vi.waitFor(() => { if (!/33,95/.test(document.querySelector("[data-testid=\x27indique-heroi\x27]")!.textContent ?? "")) throw new Error("contando"); }, { timeout: 3000 });
    expect(texto).toContain("50% de cada compra");
    expect(texto).toContain("sem limite de amigas");
    expect(texto).toContain("Vale a compra pelo seu link, no site");
    expect(texto).not.toMatch(/prazo de reembolso/); // revisão: não lembrar do reembolso logo depois de pagar
    expect(texto).toContain("Ela paga o mesmo preço");
    expect(texto).not.toMatch(/67,90|de graça|de volta/); // versão C: nada lembra o preço pago
    expect(texto).toContain("Como entrar no app"); // a saída pro acesso, sempre, no topo
    expect(dos("landing_indique_tela")[0]).toMatchObject({ via: "cartao" });
    document.querySelector<HTMLButtonElement>('[data-testid="indique-quero"]')!.click();
    await esperar('[data-testid="indique-link"]');
    expect(document.querySelector('[data-testid="indique-link"]')!.textContent).toBe("coreaplicativo.com.br/oferta?ref=ANA7K2");
    const zap = document.querySelector<HTMLAnchorElement>('[data-testid="indique-whatsapp"]')!;
    expect(zap.href).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(decodeURIComponent(zap.href)).toContain("oferta?ref=ANA7K2");
    expect(document.querySelector('[data-testid="indique-story"]')).not.toBeNull();
    expect(dos("landing_indique_pronto")).toHaveLength(1);
    expect(document.querySelector('[data-testid="indique-painel"]')!.getAttribute("href")).toMatch(/\/indique\//);
    // 17/11 (subida): onde o link mora depois — o caminho no app, com a mini-trilha
    const caminho = document.querySelector('[data-testid="indique-caminho"]')!.textContent ?? "";
    // críticas 17/11 (persona): 1º o endereço que funciona sem login em qualquer aparelho; o caminho no CORE só como 2ª linha (computador)
    expect(caminho).toContain("Perdeu o link? Entre em coreaplicativo.com.br/indique e digite seu e-mail");
    expect(caminho).toContain("ou, no computador");
    expect(caminho).not.toMatch(/no app|aberto no site/);
    expect(document.querySelector('[data-testid="indique-caminho"] a')!.getAttribute("href")).toBe("/indique");
    expect(document.querySelector('[data-testid="indique-tela"]')!.getAttribute("data-etapa")).toBe("link"); // a cena sai (altura do Instagram)
    expect(caminho).toMatch(/Você\s*→[^]*Indique e ganhe/);
    document.querySelector<HTMLButtonElement>('[data-testid="indique-fechar"]')!.click();
    expect(document.querySelector("#igt")).toBeNull();
    expect(document.querySelector('[data-testid="indique-cartao"]')!.textContent).toContain("Ver meu link");
  }, 20000);

  it("momento B DESLIGADO (revisão 17/11): voltar da loja NÃO abre a tela cheia (a 1ª volta é a hora de entrar no app); 'Como entrar' fecha e volta pro acesso", async () => {
    await abrirPagina({ indique: true });
    await pagarCom("pix");
    await esperar('[data-testid="indique-cartao"]');
    const loja = document.querySelector<HTMLAnchorElement>('[data-testid="oferta-pago"] a[data-loja]')!;
    loja.addEventListener("click", (e) => e.preventDefault());
    loja.click();
    window.dispatchEvent(new Event("focus"));
    await dormir(700);
    expect(document.querySelector("#igt")).toBeNull();
    document.querySelector<HTMLButtonElement>('[data-testid="indique-abrir"]')!.click();
    await esperar('[data-testid="indique-tela"]');
    document.querySelector<HTMLButtonElement>('[data-testid="indique-ver-acesso"]')!.click();
    expect(document.querySelector("#igt")).toBeNull();
    expect(dos("landing_indique_fechou").at(-1)).toMatchObject({ via: "ver_acesso" });
  }, 20000);

  it("?indique-estilo=site → a mesma tela na cara do site (as bolinhas amiga 1 + amiga 2)", async () => {
    await abrirPagina({ indique: true });
    window.history.replaceState(null, "", "/oferta?indique-estilo=site");
    await pagarCom("card");
    await esperar('[data-testid="indique-abrir"]');
    document.querySelector<HTMLButtonElement>('[data-testid="indique-abrir"]')!.click();
    await esperar('[data-testid="indique-tela"]');
    expect(document.querySelector('[data-testid="indique-tela"]')!.getAttribute("data-estilo")).toBe("site");
    try { localStorage.removeItem("indique-estilo-force"); } catch { /* noop */ }
  }, 20000);

  it("chave ON: falha ao gerar → mensagem curta (compra garantida) e tentar de novo; 'Agora não' → o cartão fica e reabre", async () => {
    await abrirPagina({ indique: true });
    await pagarCom("pix");
    await esperar('[data-testid="indique-abrir"]');
    (window as unknown as { __landingSimularIndique?: unknown }).__landingSimularIndique = { falhar: true };
    document.querySelector<HTMLButtonElement>('[data-testid="indique-abrir"]')!.click();
    await esperar('[data-testid="indique-quero"]');
    document.querySelector<HTMLButtonElement>('[data-testid="indique-quero"]')!.click();
    await esperar('[data-testid="indique-erro"]');
    expect(document.querySelector('[data-testid="indique-erro"]')!.textContent).toContain("Sua compra está garantida");
    expect(document.querySelector('[data-testid="indique-quero"]')!.textContent).toBe("Tentar de novo");
    document.querySelector<HTMLButtonElement>('[data-testid="indique-agora-nao"]')!.click();
    expect(document.querySelector("#igt")).toBeNull();
    const cartao = document.querySelector('[data-testid="indique-cartao"]')!;
    expect(cartao.textContent).toContain("Quero meu link");
    (window as unknown as { __landingSimularIndique?: unknown }).__landingSimularIndique = undefined;
    cartao.querySelector("button")!.click();
    await esperar('[data-testid="indique-quero"]');
    document.querySelector<HTMLButtonElement>('[data-testid="indique-quero"]')!.click();
    await esperar('[data-testid="indique-link"]');
  }, 20000);
});
