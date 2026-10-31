/**
 * "SEU 2027 ORGANIZADO" NO PÓS-PAGO DA /organizar (31/10) — a página de verdade (landing.html + landing.ts + upsell-2027.ts)
 * no jsdom, com o Pix SIMULADO (fora do domínio de produção nada vai pra rede), nos 2 braços de página × 2 de checkout.
 *   · chave off = a conta pronta de sempre, sem um evento a mais, sem CSS, sem módulo;
 *   · on = oferta (Pix pré-aquecido) → Quero (copiou, QR, 24 h, "Pagou? Volte aqui") → pago → Pronto → Continuar → conta
 *     pronta com App Store e Google Play;
 *   · "Agora não" → conta pronta, e não volta depois de recarregar; recarregar/voltar do banco reabre o MESMO QR (até sem o
 *     localStorage: o cookie); ?r=u2027 do e-mail reabre o Pix; "já tem o CORE" nunca mostra a oferta; sem Purchase.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { estadoU2027QueVolta, upsell2027DoHtml, validadeU2027, voltaDoEmailU2027 } from "@/landing/regras";
import { doCookie, paraCookie } from "@/landing/u2027-estado";

const raiz = resolve(__dirname, "../..");
const HTML = readFileSync(resolve(raiz, "landing.html"), "utf8");
const corpo = HTML.match(/<body>([\s\S]*)<\/body>/)![1].replace(/<script type="module"[^>]*><\/script>/, "");
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Ev = Record<string, unknown> & { nome: string };
const eventos = (): Ev[] => ((window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding ?? []);
const nomes = () => eventos().map((e) => e.nome);
const apagarCookies = () => { for (const c of document.cookie.split(";")) { const n = c.split("=")[0].trim(); if (n) document.cookie = `${n}=; Max-Age=0; Path=/`; } };

/* IntersectionObserver que nunca dispara sozinho (a demo não começa; os blocos ficam quietos) */
class IOQuieto { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } constructor(_cb: unknown) {} }
const IO_DO_SETUP = (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver;
const trocarIO = (v: unknown) => { (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = v; (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = v; };
afterEach(() => { trocarIO(IO_DO_SETUP); });

const fbq = vi.fn();
async function abrirPagina(o: { lp?: "atual" | "v2"; checkout?: "livre" | "email"; u2027?: boolean; url?: string; limpar?: boolean; antes?: () => void } = {}) {
  await dormir(25);
  vi.resetModules();
  if (o.limpar !== false) { localStorage.clear(); sessionStorage.clear(); apagarCookies(); }
  window.history.replaceState(null, "", o.url ?? "/organizar");
  (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
  (window as unknown as { fbq?: unknown }).fbq = fbq; fbq.mockClear();
  delete (window as unknown as { __landingSimularU2027?: unknown }).__landingSimularU2027;
  trocarIO(IOQuieto);
  const d = document.documentElement;
  d.setAttribute("data-t", "a"); d.setAttribute("data-oferta", "sempre"); d.setAttribute("data-checkout", o.checkout ?? "livre"); d.setAttribute("data-lp", o.lp ?? "atual");
  if (o.u2027) d.setAttribute("data-u2027", "on"); else d.removeAttribute("data-u2027");
  document.getElementById("lp-u27-css")?.remove();
  document.body.removeAttribute("style");
  document.body.innerHTML = corpo;
  o.antes?.();
  await import("@/landing/landing");
}
const espera = (sel: string, ms = 5000) => vi.waitFor(() => { const el = document.querySelector(sel); if (!el) throw new Error(sel); return el as HTMLElement; }, { timeout: ms, interval: 40 });
const clicar = (sel: string) => (document.querySelector(sel) as HTMLElement).click();
const digitar = (id: string, v: string) => { const c = document.getElementById(id) as HTMLInputElement; c.value = v; c.dispatchEvent(new Event("input")); };
const simular = () => (window as unknown as { __landingSimular: { pagar: () => void; pagarU2027: () => void } }).__landingSimular;
const pix = () => document.getElementById("lp-pix")!;

/** paga o vitalício e passa pelo e-mail (nos 2 braços do checkout) */
async function pagarVitalicio(checkout: "livre" | "email", email = "maria@email.com") {
  if (checkout === "email") digitar("lp-email-antes", email);
  clicar("#lp-pagar");
  await espera('[data-testid="landing-codigo"]');
  simular().pagar();
  if (checkout === "livre") {
    await espera('[data-testid="landing-pago"]');
    digitar("lp-email", email);
    clicar("#lp-criar");
  }
}

describe("as regras puras", () => {
  it("a chave vem do <html> (só data-u2027=\"on\" liga)", () => {
    expect(upsell2027DoHtml({ getAttribute: () => "on" })).toBe(true);
    expect(upsell2027DoHtml({ getAttribute: () => "off" })).toBe(false);
    expect(upsell2027DoHtml({ getAttribute: () => null })).toBe(false);
  });
  it("o estado volta só pra MESMA compra; QR vencido volta pra oferta; velho/corrompido = oferta", () => {
    const agora = Date.parse("2026-10-31T12:00:00Z");
    const pixV = { orderId: "qr_u27", qrCode: "000201x", qrCodeBase64: null, expiresAt: new Date(agora + 3600e3).toISOString(), donoIgual: true };
    expect(estadoU2027QueVolta({ v: 1, compra: "c1", etapa: "qr", pix: pixV, salvoEm: agora }, "c1", agora)).toMatchObject({ etapa: "qr", pix: pixV });
    expect(estadoU2027QueVolta({ v: 1, compra: "c1", etapa: "qr", pix: pixV, salvoEm: agora }, "c2", agora)).toMatchObject({ compra: "c2", etapa: "oferta", pix: null });
    expect(estadoU2027QueVolta({ v: 1, compra: "c1", etapa: "qr", pix: { ...pixV, expiresAt: new Date(agora - 1).toISOString() }, salvoEm: agora }, "c1", agora).etapa).toBe("oferta");
    expect(estadoU2027QueVolta({ v: 1, compra: "c1", etapa: "fim", pix: null, salvoEm: agora - 3 * 86_400_000 }, "c1", agora).etapa).toBe("oferta");
    expect(estadoU2027QueVolta("lixo", "c1", agora).etapa).toBe("oferta");
    expect(estadoU2027QueVolta({ v: 1, compra: "c1", etapa: "fim", pix: null, salvoEm: agora }, "c1", agora).etapa).toBe("fim");
  });
  it("o cookie guarda compra, etapa e o MESMO código (o Instagram zera o localStorage)", () => {
    const e = { v: 1 as const, compra: "c1", etapa: "qr" as const, pix: { orderId: "qr_u27", qrCode: "00020126580014br.gov.bcb.pix~x", qrCodeBase64: null, expiresAt: "2026-11-01T12:00:00.000Z", donoIgual: false }, salvoEm: 1 };
    expect(doCookie(paraCookie(e))).toMatchObject({ compra: "c1", etapa: "qr", pix: { orderId: "qr_u27", qrCode: e.pix.qrCode, expiresAt: e.pix.expiresAt, donoIgual: false } });
    expect(doCookie("c1~zzz~")).toBeNull();
  });
  it("a validade em palavras (24 h, nunca contagem regressiva de pressão)", () => {
    expect(validadeU2027(24 * 3600e3)).toBe("Vale por 24 horas.");
    expect(validadeU2027(5.5 * 3600e3)).toBe("Vale por mais 5 h.");
    expect(validadeU2027(12 * 60e3)).toBe("Vale por mais 12 min.");
    expect(validadeU2027(0)).toBe("Este código venceu.");
  });
  it("?r=u2027 sem compra válida não é volta", () => {
    expect(voltaDoEmailU2027(new URLSearchParams("r=u2027"))).toBeNull();
    expect(voltaDoEmailU2027(new URLSearchParams("r=t12&compra=qr_123456"))).toBeNull();
  });
});

describe("a chave no <head> do landing.html (UPSELL_2027, padrão off)", () => {
  const cabeca = HTML.match(/<script>\s*(\(function \(\) \{\s*var LANDING_NOVA[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];
  type Pote = { v: string; m?: Record<string, string> };
  function rodar(url: string, store: Record<string, string> = {}, cookie: Pote = { v: "" }, chave: "on" | "off" = "off") {
    cookie.m ??= {};
    const jar = cookie.m;
    const u = new URL(url, "https://www.coreaplicativo.com.br");
    const attrs: Record<string, string> = {};
    const doc = {
      documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } },
      createElement: () => ({ setAttribute() {} }), head: { appendChild() {} },
      get cookie() { return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; "); },
      set cookie(c: string) { const [par] = c.split(";"); const i = par.indexOf("="); const k = par.slice(0, i).trim(); if (/Max-Age=0/.test(c)) delete jar[k]; else jar[k] = par.slice(i + 1); cookie.v = jar.landing_u2027_force ? `landing_u2027_force=${jar.landing_u2027_force}` : ""; },
    };
    const ls = { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
    const win: Record<string, unknown> = { localStorage: ls, crypto: { randomUUID: () => "id-aparelho-123" } };
    const fonte = cabeca.replace(/var UPSELL_2027 = "(on|off)"/, `var UPSELL_2027 = "${chave}"`);
    new Function("location", "document", "window", "localStorage", "URLSearchParams", "Math", fonte)(
      { search: u.search, hash: "", pathname: u.pathname, hostname: "www.coreaplicativo.com.br", protocol: "https:", replace: vi.fn() }, doc, win, ls, URLSearchParams, Math,
    );
    return { attrs, store, cookie, mem: win.__landing as Record<string, unknown> };
  }
  it("vem DESLIGADO no código e, desligado, nem o atributo existe (o braço atual fica igual)", () => {
    expect(HTML).toMatch(/var UPSELL_2027 = "off";/);
    const r = rodar("/organizar");
    expect(r.attrs["data-u2027"]).toBeUndefined();
    expect(r.mem).toMatchObject({ u2027: "off", ab_u2027: "off", u2027_forcado: false });
  });
  it("\"on\" no código liga pra todos; ?u2027=on força e FICA (localStorage e cookie); ?u2027=off força desligado; ?u2027=auto desfaz", () => {
    expect(rodar("/organizar", {}, { v: "" }, "on").attrs["data-u2027"]).toBe("on");
    const store: Record<string, string> = {}; const cookie: { v: string; m?: Record<string, string> } = { v: "" };
    expect(rodar("/organizar?u2027=on", store, cookie).attrs["data-u2027"]).toBe("on");
    expect(rodar("/organizar", store, cookie).attrs["data-u2027"]).toBe("on");
    expect(cookie.v).toBe("landing_u2027_force=on");
    expect(rodar("/organizar", {}, cookie).attrs["data-u2027"]).toBe("on"); // sem o localStorage, o cookie segura
    expect(cookie.m!.landing_device_id).toBeDefined(); // o id do aparelho (AB_CHECKOUT on) convive com a força
    expect(rodar("/organizar?u2027=off", store, cookie, "on").attrs["data-u2027"]).toBeUndefined();
    expect(rodar("/organizar?u2027=auto", store, cookie).attrs["data-u2027"]).toBeUndefined();
    expect(store["landing-u2027-force"]).toBeUndefined();
    expect(cookie.v).toBe("");
  });
});

describe("chave DESLIGADA: a conta pronta de sempre", () => {
  for (const lp of ["atual", "v2"] as const) {
    it(`${lp}: pagou → e-mail → "Sua conta está pronta" na hora, sem evento/CSS do 2027`, async () => {
      await abrirPagina({ lp });
      await pagarVitalicio("livre");
      await espera('[data-testid="landing-conta"]');
      await dormir(100);
      expect(document.querySelector('[data-testid^="u2027-"]')).toBeNull();
      expect(nomes().some((n) => n.startsWith("landing_u2027"))).toBe(false);
      expect(document.getElementById("lp-u27-css")).toBeNull();
    });
  }
});

describe("chave LIGADA: oferta → Quero → QR → pago → Pronto → conta com as lojas (2 braços × 2 checkouts)", () => {
  for (const lp of ["atual", "v2"] as const) for (const checkout of ["livre", "email"] as const) {
    it(`${lp} · ${checkout}`, async () => {
      await abrirPagina({ lp, checkout, u2027: true });
      Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(async () => {}) }, configurable: true });
      try {
        await pagarVitalicio(checkout);
        const oferta = await espera('[data-testid="u2027-oferta"]');
        expect(oferta.textContent).toContain("Pagamento confirmado");
        expect(oferta.querySelector("h3")!.textContent).toBe("Seu 2027 já organizado");
        expect(oferta.textContent).toContain("3 metas, orçamento do ano, 12 revisões do mês e o cofrinho de 52 semanas.");
        expect(oferta.querySelector('[data-testid="u2027-preco"]')!.textContent).toBe("R$ 14,90");
        expect(oferta.textContent).toContain("uma vez, sem mensalidade");
        expect(oferta.textContent).not.toMatch(/só hoje|últim|acaba|minutos/i); // sem pressão falsa
        expect(document.querySelector('[data-testid="landing-conta"]')).toBeNull(); // no LUGAR de "Sua conta está pronta"
        expect(document.getElementById("lp-card")!.dataset.fase).toBe("conta");
        expect(document.getElementById("lp-card")!.hasAttribute("data-u27")).toBe(true); // a faixa "hoje" do cartão some no 2027
        // o Pix já está sendo gerado ao mostrar a oferta (pré-aquecido)
        await vi.waitFor(() => expect(nomes()).toContain("landing_u2027_pix_pronto"), { timeout: 3000 });
        expect(eventos().find((e) => e.nome === "landing_u2027_pix_pronto")).toMatchObject({ ok: true });
        clicar("#u27-quero");
        const qr = await espera('[data-testid="u2027-qr"]');
        expect(qr.querySelector('[data-testid="u2027-copiado"]')!.textContent).toContain("Código copiado.");
        expect(qr.querySelector('[data-testid="u2027-codigo"]')!.textContent).toMatch(/^000201/);
        expect(qr.querySelector('[data-testid="u2027-volte"]')!.textContent).toMatch(/Pagou\? Volte aqui\.Esta tela confirma sozinha\./);
        expect(qr.textContent).toContain("Vale por 24 horas.");
        expect(qr.textContent).toContain("O código também foi pro seu e-mail.");
        expect(document.getElementById("u27-sair")!.textContent).toBe("Agora não"); // sai pra conta pronta, sem trava
        simular().pagarU2027();
        const pronto = await espera('[data-testid="u2027-pronto"]');
        expect(pronto.querySelector("h3")!.textContent).toBe("Pronto, seu 2027 tá no seu CORE");
        expect([...pronto.querySelectorAll(".u27-lista li")].map((l) => l.textContent)).toEqual(["Planejar 2027 em 5 minutos", "12 revisões do mês", "Cofrinho das 52 semanas", "Planner 2027 pra imprimir"]);
        expect(pronto.querySelector('[data-testid="u2027-onde"]')!.textContent).toContain("Dev. Pessoal → Seu 2027");
        expect(pronto.textContent).toContain("maria@email.com");
        clicar("#u27-continuar");
        const conta = await espera('[data-testid="landing-conta"]');
        expect(conta.querySelector('a[href*="apps.apple.com"]')).not.toBeNull();
        expect(conta.querySelector('a[href*="play.google.com"]')).not.toBeNull();
        expect(document.getElementById("lp-card")!.hasAttribute("data-u27")).toBe(false);
        expect(nomes()).toEqual(expect.arrayContaining(["landing_u2027_view", "landing_u2027_quero", "landing_u2027_copiado", "landing_u2027_pago", "landing_u2027_continuar"]));
        for (const e of eventos().filter((x) => x.nome.startsWith("landing_u2027"))) {
          expect(e).toMatchObject({ braco_lp: lp, braco_checkout: checkout });
          expect(String(e.order_id)).toMatch(/^simulado-/); // a compra do vitalício
          expect(JSON.stringify(e)).not.toContain("maria@email.com"); // sem e-mail nos eventos
        }
        // sem Purchase (nem do upsell, nem de novo do vitalício) e sem InitiateCheckout do upsell
        expect(fbq.mock.calls.filter((c) => c[1] === "Purchase")).toHaveLength(0);
        expect(fbq.mock.calls.filter((c) => c[1] === "InitiateCheckout")).toHaveLength(1);
        expect(document.getElementById("lp-u27-css")).not.toBeNull();
      } finally { Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true }); }
    });
  }
});

describe("chave LIGADA: os caminhos de saída e de volta", () => {
  it("\"Agora não\" → conta pronta (sem plano de 30 dias); recarregar NÃO mostra a oferta de novo", async () => {
    await abrirPagina({ lp: "v2", u2027: true });
    await pagarVitalicio("livre");
    await espera('[data-testid="u2027-oferta"]');
    expect(document.getElementById("u27-nao")!.textContent).toBe("Agora não");
    clicar("#u27-nao");
    const conta = await espera('[data-testid="landing-conta"]');
    expect(conta.textContent).not.toMatch(/30 dias|9,90/);
    expect(eventos().find((e) => e.nome === "landing_u2027_nao")).toMatchObject({ de: "oferta" });
    await abrirPagina({ lp: "v2", u2027: true, limpar: false });
    await espera('[data-testid="landing-conta"]');
    await dormir(150);
    expect(document.querySelector('[data-testid="u2027-oferta"]')).toBeNull();
  });

  it("recarregar no meio (o banco recarrega a aba) reabre o MESMO QR — até sem o localStorage (cookie)", async () => {
    await abrirPagina({ lp: "atual", checkout: "email", u2027: true });
    await pagarVitalicio("email");
    await espera('[data-testid="u2027-oferta"]');
    clicar("#u27-quero");
    const codigo = (await espera('[data-testid="u2027-codigo"]')).textContent;
    const pedido = eventos().find((e) => e.nome === "landing_u2027_copiado")!.pedido_u2027;
    await abrirPagina({ lp: "atual", checkout: "email", u2027: true, limpar: false });
    expect((await espera('[data-testid="u2027-codigo"]')).textContent).toBe(codigo);
    // o Instagram zerou o localStorage (o estado do vitalício também): o cookie do 2027 + o marcador seguram
    const estadoVit = localStorage.getItem("landing-estado-v1");
    await abrirPagina({ lp: "atual", checkout: "email", u2027: true, limpar: false, antes: () => { localStorage.removeItem("landing-u2027-v1"); } });
    expect((await espera('[data-testid="u2027-codigo"]')).textContent).toBe(codigo);
    expect(estadoVit).not.toBeNull();
    expect(pedido).toMatch(/^simulado-u27-/);
    simular().pagarU2027();
    await espera('[data-testid="u2027-pronto"]');
  });

  it("voltar do \"banco\" (aba escondida → visível) mantém o QR na tela; o Pix gerado falhou → erro e o 2º toque gera", async () => {
    await abrirPagina({ lp: "v2", u2027: true });
    (window as unknown as { __landingSimularU2027: { falhar: boolean } }).__landingSimularU2027 = { falhar: true };
    await pagarVitalicio("livre");
    await espera('[data-testid="u2027-oferta"]');
    clicar("#u27-quero");
    await vi.waitFor(() => expect(pix().querySelector('[data-testid="u2027-oferta"] .lp-erro')?.textContent).toMatch(/Não consegui gerar o Pix/), { timeout: 3000 });
    (window as unknown as { __landingSimularU2027: { falhar: boolean } }).__landingSimularU2027.falhar = false;
    clicar("#u27-quero");
    await espera('[data-testid="u2027-qr"]');
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await dormir(50);
    expect(document.querySelector('[data-testid="u2027-qr"]')).not.toBeNull();
    clicar("#u27-sair");
    await espera('[data-testid="landing-conta"]');
    expect(eventos().find((e) => e.nome === "landing_u2027_nao")).toMatchObject({ de: "qr" });
  });

  it("?r=u2027 do e-mail (outro navegador, chave da página até desligada) reabre o MESMO Pix com o texto de quem não confirma aqui", async () => {
    const vence = Date.now() + 20 * 3600e3;
    const codigo = "00020101021226870014br.gov.bcb.pix2565qrcode.exemplo.com/pix/v2/EMAIL-2027-5204000053039865405" + "14.905802BR6304ABCD";
    const url = `/organizar?r=u2027&compra=qr_vitalicio_77&pedido=qr_u27_77&pix=${encodeURIComponent(codigo)}&vence=${vence}&utm_source=email_compra`;
    await abrirPagina({ lp: "atual", u2027: false, url });
    const qr = await espera('[data-testid="u2027-qr"]');
    expect(qr.querySelector('[data-testid="u2027-codigo"]')!.textContent).toBe(codigo);
    expect(qr.querySelector('[data-testid="u2027-volte"]')!.textContent).toContain("Quando o pagamento cair, o 2027 entra na sua conta e a gente avisa por e-mail.");
    expect(qr.textContent).toContain("Vale por mais 19 h.");
    expect(eventos().find((e) => e.nome === "landing_u2027_volta_email")).toMatchObject({ restaurado: "link", order_id: "qr_vitalicio_77" });
    expect(document.getElementById("lp-card")!.dataset.fase).toBe("conta"); // a oferta do vitalício some atrás do Pix do 2027
    clicar("#u27-sair");
    await vi.waitFor(() => expect(document.querySelector('[data-testid="u2027-qr"]')).toBeNull());
  });

  it("quem já tem o CORE (marcador do aparelho) vê \"Você já tem o CORE\" — nunca a oferta do 2027", async () => {
    await abrirPagina({ lp: "v2", u2027: true, antes: () => { localStorage.setItem("landing-comprou-v1", JSON.stringify({ v: 1, em: Date.now(), oferta: "LN_sempre279", email: "ana@email.com" })); } });
    await espera('[data-testid="landing-ja-tem"]');
    await dormir(150);
    expect(document.querySelector('[data-testid^="u2027-"]')).toBeNull();
    expect(nomes().some((n) => n.startsWith("landing_u2027"))).toBe(false);
  });
});
