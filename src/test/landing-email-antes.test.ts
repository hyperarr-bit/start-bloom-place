/**
 * E-MAIL ANTES DO PIX NA LANDING /organizar (29/10) — o A/B "AB_CHECKOUT" (braço "livre" × "email").
 *
 * Por quê (lp-analise/pix, 29/10): 2 de ~36 pagantes ficaram sem e-mail (pagaram no banco e não voltaram) e ~10 Pix não
 * pagos ficaram sem contato pra lembrete. Aqui:
 *   1. o sorteio no <head>: estável por aparelho (landing_device_id), forçável por ?checkout=, chave "off" = todo mundo
 *      no checkout de hoje; a conta do <head> é a MESMA do regras.ts;
 *   2. o braço "livre" é IGUAL a hoje (cartão idêntico ao HTML, e-mail opcional na tela do QR);
 *   3. o braço "email": vazio/ inválido (erro, sem Pix), válido (Pix + "o acesso chega em…", sem o opcional), e-mail com
 *      conta (código ANTES do Pix), com conta e vitalício ("Você já tem o CORE"), erro do servidor;
 *   4. a volta pelo e-mail de lembrete (?r=t12 reabre o Pix vivo; ?r=t20h volta pra oferta).
 * A página roda de verdade (landing.html + landing.ts) no jsdom, com o Pix SIMULADO (fora do domínio de produção).
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { bracoCheckoutDoAparelho, checarEmailAntes, sugestaoDeEmail, voltaDoLembrete } from "@/landing/regras";

const raiz = resolve(__dirname, "../..");
const HTML = readFileSync(resolve(raiz, "landing.html"), "utf8");

/* ───────── o script do <head>, rodado num ambiente falso (com cookie) ───────── */
const scriptDaCabeca = HTML.match(/<script>\s*(\(function \(\) \{\s*var LANDING_NOVA[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];
const ligado = scriptDaCabeca.replace('var AB_CHECKOUT = "off"', 'var AB_CHECKOUT = "on"');

function rodar(fonte: string, url: string, store: Record<string, string> = {}, cookie: { v: string; ultimo?: string } = { v: "" }) {
  const u = new URL(url, "https://www.coreaplicativo.com.br");
  const attrs: Record<string, string> = {};
  const location = { search: u.search, hash: u.hash, pathname: u.pathname, hostname: "www.coreaplicativo.com.br", protocol: "https:", replace: vi.fn() };
  const localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
  };
  const document = {
    documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } },
    get cookie() { return cookie.v; },
    set cookie(c: string) { const [par] = c.split(";"); cookie.v = par; cookie.ultimo = c; },
  } as unknown as { cookie: string };
  const window: Record<string, unknown> = { localStorage, crypto: { randomUUID: () => `${Math.random().toString(16).slice(2, 10)}-0000-4000-8000-${Date.now().toString(16).padStart(12, "0").slice(-12)}` } };
  // eslint-disable-next-line no-new-func
  new Function("location", "document", "window", "localStorage", "URLSearchParams", "Math", "fetch", "sessionStorage", fonte)(
    location, document, window, localStorage, URLSearchParams, Math, undefined, { getItem: () => null },
  );
  return { attrs, store, cookie, mem: window.__landing as Record<string, unknown> };
}

describe("o sorteio do checkout (head do landing.html)", () => {
  it("a chave vem DESLIGADA no código: todo mundo no checkout de hoje (livre), sem criar id de aparelho", () => {
    expect(HTML).toMatch(/var AB_CHECKOUT = "off";/);
    const r = rodar(scriptDaCabeca, "/organizar");
    expect(r.attrs["data-checkout"]).toBe("livre");
    expect(r.store["landing-device-id"]).toBeUndefined();
    expect(r.cookie.v).toBe("");
    expect(r.mem).toMatchObject({ checkout: "livre", ab_checkout: "off", checkout_forcado: false });
  });

  it("forçável por ?checkout=email|livre (fica neste navegador), com a chave desligada ou ligada", () => {
    const store: Record<string, string> = {};
    expect(rodar(scriptDaCabeca, "/organizar?checkout=email", store).attrs["data-checkout"]).toBe("email");
    expect(rodar(scriptDaCabeca, "/organizar", store).attrs["data-checkout"]).toBe("email"); // ficou
    expect(rodar(scriptDaCabeca, "/organizar", store).mem.checkout_forcado).toBe(true);
    expect(rodar(ligado, "/organizar?checkout=livre", store).attrs["data-checkout"]).toBe("livre");
    expect(rodar(scriptDaCabeca, "/organizar?checkout=zzz", {}).attrs["data-checkout"]).toBe("livre");
  });

  it("ligada: estável por aparelho — o id fica no localStorage E no cookie do domínio; sem o localStorage, o cookie segura o braço", () => {
    const store: Record<string, string> = {};
    const cookie: { v: string; ultimo?: string } = { v: "" };
    const a = rodar(ligado, "/organizar", store, cookie);
    const id = store["landing-device-id"];
    expect(id).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(cookie.v).toBe(`landing_device_id=${id}`);
    expect((cookie as { ultimo?: string }).ultimo).toContain("Domain=.coreaplicativo.com.br");
    expect(a.attrs["data-checkout"]).toBe(bracoCheckoutDoAparelho(id));
    for (let i = 0; i < 5; i++) expect(rodar(ligado, "/organizar", store, cookie).attrs["data-checkout"]).toBe(a.attrs["data-checkout"]);
    // o Instagram zerou o localStorage: o cookie devolve o MESMO id e o MESMO braço
    const b = rodar(ligado, "/organizar", {}, cookie);
    expect(b.attrs["data-checkout"]).toBe(a.attrs["data-checkout"]);
  });

  it("a conta do <head> é a mesma do regras.ts e divide ~50/50", () => {
    const ids = Array.from({ length: 400 }, (_, i) => `${(i * 2654435761 >>> 0).toString(16).padStart(8, "0")}-1111-4222-8333-${String(i).padStart(12, "0")}`);
    let email = 0;
    for (const id of ids) {
      const r = rodar(ligado, "/organizar", { "landing-device-id": id });
      expect(r.attrs["data-checkout"]).toBe(bracoCheckoutDoAparelho(id));
      if (r.attrs["data-checkout"] === "email") email++;
    }
    expect(email / ids.length).toBeGreaterThan(0.4);
    expect(email / ids.length).toBeLessThan(0.6);
  });
});

describe("regras do campo e do link do lembrete", () => {
  it("checarEmailAntes: vazio, inválido e válido (minúsculo, sem espaço)", () => {
    expect(checarEmailAntes("  ")).toMatchObject({ ok: false, motivo: "vazio" });
    expect(checarEmailAntes("maria@")).toMatchObject({ ok: false, motivo: "invalido" });
    expect(checarEmailAntes("maria@email")).toMatchObject({ ok: false, motivo: "invalido" });
    expect(checarEmailAntes(" Maria.Souza@Gmail.com ")).toEqual({ ok: true, email: "maria.souza@gmail.com" });
  });
  it("sugestaoDeEmail: só os erros conhecidos de domínio", () => {
    expect(sugestaoDeEmail("maria@gmial.com")).toBe("maria@gmail.com");
    expect(sugestaoDeEmail("Maria@Hotmal.com")).toBe("maria@hotmail.com");
    expect(sugestaoDeEmail("maria@gmail.com")).toBeNull();
    expect(sugestaoDeEmail("maria@empresa.com.br")).toBeNull();
  });
  it("voltaDoLembrete: t12 com o Pix vivo reabre; vencido/sem código não; t20h só volta", () => {
    const agora = Date.parse("2026-10-29T15:20:00Z");
    const pix = "00020101021226870014br.gov.bcb.pix2565qrcode.asaas.com/pix/v2/abc5204000053039865405279005802BR5904CORE6009SAO PAULO62070503***6304ABCD";
    const q = (o: Record<string, string>) => new URLSearchParams(o);
    const viva = voltaDoLembrete(q({ r: "t12", pedido: "a6e3b0f1c2d34e5f9a8b7c6d5e4f3a2b", pix, vence: String(agora + 15 * 60_000), o: "LN_sempre279" }), agora);
    expect(viva?.pix).toMatchObject({ orderId: "a6e3b0f1c2d34e5f9a8b7c6d5e4f3a2b", qrCode: pix, oferta: "LN_sempre279", doEmail: true });
    expect(voltaDoLembrete(q({ r: "t12", pedido: "a6e3b0f1c2d34e5f9a8b7c6d5e4f3a2b", pix, vence: String(agora + 30_000), o: "LN_sempre279" }), agora)?.pix).toBeNull();
    expect(voltaDoLembrete(q({ r: "t12", pedido: "a6e3b0f1c2d34e5f9a8b7c6d5e4f3a2b", pix: "<script>", vence: String(agora + 9e5), o: "LN_sempre279" }), agora)?.pix).toBeNull();
    expect(voltaDoLembrete(q({ r: "t20h", pedido: "a6e3b0f1c2d34e5f9a8b7c6d5e4f3a2b" }), agora)).toEqual({ toque: "t20h", pedido: "a6e3b0f1c2d34e5f9a8b7c6d5e4f3a2b", pix: null });
    expect(voltaDoLembrete(q({ utm_source: "x" }), agora)).toBeNull();
  });
});

/* ───────────────────────── a página de verdade no jsdom (Pix simulado) ───────────────────────── */
const corpo = HTML.match(/<body>([\s\S]*)<\/body>/)![1].replace(/<script type="module"[^>]*><\/script>/, "");
type Ev = Record<string, unknown> & { nome: string };
const eventos = (): Ev[] => ((window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding ?? []);
const nomes = () => eventos().map((e) => e.nome);
const apagarCookies = () => {
  for (const c of document.cookie.split(";")) { const n = c.split("=")[0].trim(); if (n) document.cookie = `${n}=; Max-Age=0; Path=/`; }
};
async function abrirPagina(checkout: "livre" | "email" | null, opts: { limpar?: boolean; url?: string } = {}) {
  vi.resetModules();
  if (opts.limpar !== false) { localStorage.clear(); apagarCookies(); }
  window.history.replaceState(null, "", opts.url ?? "/organizar");
  (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
  delete (window as unknown as { __landingSimularJaTem?: boolean }).__landingSimularJaTem;
  document.documentElement.setAttribute("data-t", "a");
  document.documentElement.setAttribute("data-oferta", "sempre");
  if (checkout) document.documentElement.setAttribute("data-checkout", checkout); else document.documentElement.removeAttribute("data-checkout");
  document.body.innerHTML = corpo;
  await import("@/landing/landing");
}
const espera = (sel: string, ms = 4000) => vi.waitFor(() => { const el = document.querySelector(sel); if (!el) throw new Error(sel); return el; }, { timeout: ms, interval: 40 });
const pagar = () => (document.getElementById("lp-pagar") as HTMLButtonElement).click();
const digitar = (id: string, v: string) => { const c = document.getElementById(id) as HTMLInputElement; c.value = v; c.dispatchEvent(new Event("input")); };
const simular = () => (window as unknown as { __landingSimular: { pagar: () => void } }).__landingSimular;
const limpo = (el: Element) => el.outerHTML.replace(/\s+/g, " ");

describe("braço livre: a página de hoje, sem tirar nem pôr", () => {
  it("o cartão sai IDÊNTICO ao HTML; o campo do braço email existe mas o CSS do <head> o esconde fora do braço email", async () => {
    await abrirPagina("livre");
    await new Promise((r) => setTimeout(r, 30));
    const original = document.createElement("div");
    original.innerHTML = corpo;
    expect(limpo(document.getElementById("lp-card")!)).toBe(limpo(original.querySelector("#lp-card")!));
    expect(document.querySelector(".lp-email-antes")!.getAttribute("data-so-checkout")).toBe("email");
    expect(HTML).toContain('html:not([data-checkout="email"]) [data-so-checkout="email"] { display: none !important; }');
  });

  it("toque em pagar → Pix na hora (sem pedir e-mail) e o e-mail OPCIONAL continua na tela do QR; eventos levam braco_checkout", async () => {
    await abrirPagina("livre");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    expect(document.getElementById("lp-email-pix")).not.toBeNull();
    expect(document.querySelector('[data-testid="landing-email-garantido"]')).toBeNull();
    expect(nomes()).not.toContain("landing_email_antes_ok");
    expect(nomes()).not.toContain("landing_email_antes_erro");
    const landing = eventos().filter((e) => e.nome.startsWith("landing_"));
    expect(landing.length).toBeGreaterThan(2);
    for (const e of landing) expect(e.braco_checkout).toBe("livre");
  });

  it("sem o atributo (página velha em cache / jsdom) = livre", async () => {
    await abrirPagina(null);
    pagar();
    await espera('[data-testid="landing-codigo"]');
    expect(eventos().find((e) => e.nome === "landing_pix_gerado")).toMatchObject({ braco_checkout: "livre", email_antes: false });
  });
});

describe("braço email: o e-mail ANTES do Pix", () => {
  it("vazio → erro no campo, nada de Pix; inválido → outro erro", async () => {
    await abrirPagina("email");
    pagar();
    await new Promise((r) => setTimeout(r, 50));
    const erro = document.getElementById("lp-email-antes-erro")!;
    expect(erro.hidden).toBe(false);
    expect(erro.textContent).toContain("Coloque seu e-mail");
    expect(document.getElementById("lp-email-antes")!.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById("lp-card")!.getAttribute("data-fase")).toBe("oferta");
    digitar("lp-email-antes", "maria@");
    expect(erro.hidden).toBe(true); // digitou: o erro some
    pagar();
    await new Promise((r) => setTimeout(r, 50));
    expect(erro.textContent).toContain("parece errado");
    expect(nomes()).not.toContain("landing_pix_gerado");
    expect(eventos().filter((e) => e.nome === "landing_email_antes_erro").map((e) => e.motivo)).toEqual(["vazio", "invalido"]);
  });

  it("domínio com erro de digitação → sugestão tocável (não bloqueia)", async () => {
    await abrirPagina("email");
    digitar("lp-email-antes", "maria@gmial.com");
    document.getElementById("lp-email-antes")!.dispatchEvent(new Event("blur"));
    const s = document.getElementById("lp-email-antes-sugestao") as HTMLButtonElement;
    expect(s.hidden).toBe(false);
    expect(s.textContent).toContain("maria@gmail.com");
    s.click();
    expect((document.getElementById("lp-email-antes") as HTMLInputElement).value).toBe("maria@gmail.com");
    expect(s.hidden).toBe(true);
    expect(nomes()).toContain("landing_email_antes_sugestao");
  });

  it("válido → Pix; na tela do QR o opcional SOME e entra 'o acesso chega em…'; pagou → conta pronta direto (sem pedir e-mail)", async () => {
    await abrirPagina("email");
    digitar("lp-email-antes", "Maria@Email.com");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    expect(document.getElementById("lp-email-pix")).toBeNull();
    expect(document.querySelector('[data-testid="landing-email-garantido"]')!.textContent).toContain("maria@email.com");
    expect(eventos().find((e) => e.nome === "landing_email_antes_ok")).toMatchObject({ via: "nova", braco_checkout: "email" });
    expect(eventos().find((e) => e.nome === "landing_pix_gerado")).toMatchObject({ email_antes: true, braco_checkout: "email" });
    simular().pagar();
    const conta = await espera('[data-testid="landing-conta"]');
    expect(conta.textContent).toContain("maria@email.com");
    expect(document.getElementById("lp-email")).toBeNull();
    expect(JSON.parse(localStorage.getItem("landing-comprou-v1")!)).toMatchObject({ email: "maria@email.com" });
  });

  it("landing_email_antes_visto 1x quando a oferta aparece (só no braço email)", async () => {
    const vistos: Array<(e: Array<{ isIntersecting: boolean; target: Element; boundingClientRect: { top: number } }>) => void> = [];
    const IO = class { constructor(cb: (typeof vistos)[number]) { vistos.push(cb); } observe() {} disconnect() {} };
    const antes = (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IO;
    try {
      await abrirPagina("email");
      const oferta = document.getElementById("oferta")!;
      vistos.at(-1)!([{ isIntersecting: true, target: oferta, boundingClientRect: { top: 10 } }]);
      vistos.at(-1)!([{ isIntersecting: true, target: oferta, boundingClientRect: { top: 10 } }]);
      expect(nomes().filter((n) => n === "landing_email_antes_visto")).toHaveLength(1);
      await abrirPagina("livre");
      vistos.at(-1)!([{ isIntersecting: true, target: document.getElementById("oferta")!, boundingClientRect: { top: 10 } }]);
      expect(nomes()).toContain("landing_oferta_vista");
      expect(nomes()).not.toContain("landing_email_antes_visto");
    } finally {
      (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver = antes;
    }
  });

  it("e-mail que JÁ tem conta → código ANTES do Pix; código errado → erro; certo → Pix na conta dela", async () => {
    await abrirPagina("email");
    digitar("lp-email-antes", "maria+existe@email.com");
    pagar();
    const c = await espera('[data-testid="landing-email-tem-conta"]');
    expect(c.textContent).toContain("Esse e-mail já tem conta");
    expect(c.textContent).toContain("maria+existe@email.com");
    expect(document.getElementById("lp-card")!.getAttribute("data-fase")).toBe("codigo"); // o CSS esconde a oferta
    expect(nomes()).not.toContain("landing_pix_gerado");
    expect(eventos().find((e) => e.nome === "landing_email_antes_erro")).toMatchObject({ motivo: "tem_conta" });
    digitar("lp-codigo-antes", "111111");
    (document.getElementById("lp-entrar-pagar") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('[data-testid="landing-email-tem-conta"] .lp-erro')?.textContent).toContain("Código errado"), { timeout: 3000 });
    digitar("lp-codigo-antes", "123456");
    (document.getElementById("lp-entrar-pagar") as HTMLButtonElement).click();
    await espera('[data-testid="landing-codigo"]');
    expect(document.querySelector('[data-testid="landing-email-garantido"]')!.textContent).toContain("maria+existe@email.com");
    expect(eventos().find((e) => e.nome === "landing_email_antes_ok")).toMatchObject({ via: "codigo" });
    expect(eventos().filter((e) => e.nome === "landing_cta").map((e) => e.onde)).toEqual(["pagar", "pagar_codigo", "pagar_codigo"]);
  });

  it("'Usar outro e-mail' volta pra oferta com o campo limpo", async () => {
    await abrirPagina("email");
    digitar("lp-email-antes", "maria+existe@email.com");
    pagar();
    await espera('[data-testid="landing-email-tem-conta"]');
    (document.getElementById("lp-outro-email") as HTMLButtonElement).click();
    expect(document.querySelector('[data-testid="landing-email-tem-conta"]')).toBeNull();
    expect(document.getElementById("lp-card")!.getAttribute("data-fase")).toBe("oferta");
    expect((document.getElementById("lp-email-antes") as HTMLInputElement).value).toBe("");
  });

  it("e-mail com conta E vitalício → depois do código, 'Você já tem o CORE' (o servidor recusa o Pix)", async () => {
    await abrirPagina("email");
    digitar("lp-email-antes", "maria+jatem@email.com");
    pagar();
    await espera('[data-testid="landing-email-tem-conta"]');
    digitar("lp-codigo-antes", "123456");
    (document.getElementById("lp-entrar-pagar") as HTMLButtonElement).click();
    const card = await espera('[data-testid="landing-ja-tem"]');
    expect(card.textContent).toContain("maria+jatem@email.com");
    expect(nomes()).not.toContain("landing_pix_gerado");
    expect(eventos().find((e) => e.nome === "landing_ja_tem")).toMatchObject({ via: "servidor", braco_checkout: "email" });
  });

  it("o servidor não conseguiu salvar o e-mail → volta pra oferta com o erro no campo, sem Pix", async () => {
    await abrirPagina("email");
    digitar("lp-email-antes", "maria+falha@email.com");
    pagar();
    await vi.waitFor(() => expect(document.getElementById("lp-email-antes-erro")!.hidden).toBe(false), { timeout: 3000 });
    expect(document.getElementById("lp-card")!.getAttribute("data-fase")).toBe("oferta");
    expect(nomes()).not.toContain("landing_pix_gerado");
    expect(eventos().find((e) => e.nome === "landing_email_antes_erro")).toMatchObject({ motivo: "falhou" });
  });

  it("fechou e reabriu a aba com o Pix vivo: o QR volta com 'o acesso chega em…' e o campo vem preenchido depois", async () => {
    await abrirPagina("email");
    digitar("lp-email-antes", "maria@email.com");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    await abrirPagina("email", { limpar: false });
    await espera('[data-testid="landing-email-garantido"]');
    expect((document.getElementById("lp-email-antes") as HTMLInputElement).value).toBe("maria@email.com");
  });
});

describe("a volta pelo e-mail de lembrete", () => {
  const pix = "00020101021226870014br.gov.bcb.pix2565qrcode.asaas.com/pix/v2/abc5204000053039865405279005802BR5904CORE6009SAO PAULO62070503***6304ABCD";
  it("t12 noutro navegador (sem estado): o MESMO Pix reabre; 'Já paguei' diz que o acesso chega no e-mail", async () => {
    const vence = Date.now() + 15 * 60_000;
    await abrirPagina("email", { url: `/organizar?r=t12&pedido=a6e3b0f1c2d34e5f9a8b7c6d5e4f3a2b&pix=${encodeURIComponent(pix)}&vence=${vence}&o=LN_sempre279&utm_source=lembrete_pix&utm_content=t12` });
    const codigo = await espera('[data-testid="landing-codigo"]');
    expect(codigo.textContent).toBe(pix);
    expect(document.querySelector(".lp-esperando")!.textContent).toContain("o acesso chega no seu e-mail");
    expect(eventos().find((e) => e.nome === "landing_lembrete_volta")).toMatchObject({ toque: "t12", order_id: "a6e3b0f1c2d34e5f9a8b7c6d5e4f3a2b", restaurado: "link", utm_source: "lembrete_pix" });
  });
  it("t20h: volta pra oferta (gera outro em 1 toque) e registra a volta", async () => {
    await abrirPagina("livre", { url: "/organizar?r=t20h&pedido=a6e3b0f1c2d34e5f9a8b7c6d5e4f3a2b&utm_source=lembrete_pix&utm_content=t20h" });
    expect(document.getElementById("lp-card")!.getAttribute("data-fase")).toBe("oferta");
    expect(eventos().find((e) => e.nome === "landing_lembrete_volta")).toMatchObject({ toque: "t20h", restaurado: "nao" });
  });
});
