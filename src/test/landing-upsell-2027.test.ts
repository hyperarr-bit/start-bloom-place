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
import { LACO_U2027, criarUpsell2027, type ApiU2027 } from "@/landing/upsell-2027";

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
    // crítica r1: "Código copiado" atravessa a recarga do banco (cookie com "c" no campo do dono)
    expect(paraCookie({ ...e, copiado: true })).toContain("~0c~");
    expect(doCookie(paraCookie({ ...e, copiado: true }))).toMatchObject({ copiado: true, pix: { donoIgual: false } });
    expect(doCookie(paraCookie(e))!.copiado).toBeUndefined();
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
  it("31/10 ~18h LIGADO no código; desligado (rollback), nem o atributo existe (o braço atual fica igual)", () => {
    expect(HTML).toMatch(/var UPSELL_2027 = "on";/);
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
    expect(cookie.m!.landing_device_id).toBeUndefined(); // 31/10 noite: AB_CHECKOUT "email" fixo e AB_LP off = nenhum sorteio, nenhum id de aparelho
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
        // crítica r1: a 1ª linha diz o que ela já tem; o título sem "já"; sem "orçamento do ano"; sem "no app" (o Android não tem)
        expect(oferta.querySelector('[data-testid="u2027-linha"]')!.textContent).toBe("O CORE é seu pra sempre. O acesso também vai pro seu e-mail."); // crítica r2: nos 2 braços
        expect(oferta.querySelector("h3")!.textContent).toBe("Seu 2027 organizado");
        expect(oferta.textContent).toContain("3 metas, quanto gastar e guardar por mês, 12 revisões do mês e o cofrinho de 52 semanas.");
        expect(oferta.textContent).toContain("Por enquanto fica no site e no app do iPhone.");
        expect(oferta.textContent).not.toMatch(/no app e no site|Fica no app/);
        const nao = document.getElementById("u27-nao")!;
        expect(nao.textContent).toBe("Agora não · ver minha conta");
        expect(nao.className).toBe("u27-sair"); // botão secundário (44 px no CSS), nos 2 braços
        expect(oferta.querySelector('[data-testid="u2027-preco"]')!.textContent).toBe("R$ 19,90");
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
        // crítica r2 (compradora 1): o QR diz que o CORE já está pago e que este Pix é só do 2027
        expect(qr.querySelector('[data-testid="u2027-ja-pago"]')!.textContent).toBe("Seu CORE (R$ 27,90) está pago. Este Pix é só do 2027.");
        expect(qr.querySelector('[data-testid="u2027-qual"]')).toBeNull(); // ela acabou de ver a oferta
        expect(document.documentElement.getAttribute("data-u27-pag")).toBe("pos"); // a garantia do vitalício sai de baixo do 2027
        expect(document.getElementById("u27-sair")!.textContent).toBe("Agora não"); // sai pra conta pronta, sem trava
        simular().pagarU2027();
        const pronto = await espera('[data-testid="u2027-pronto"]');
        expect(pronto.querySelector("h3")!.textContent).toBe("Pronto, seu 2027 tá no seu CORE");
        expect([...pronto.querySelectorAll(".u27-lista li")].map((l) => l.textContent)).toEqual(["Planejar 2027 em 5 minutos", "12 revisões do mês", "Cofrinho das 52 semanas", "Planner 2027 pra imprimir"]);
        expect(pronto.querySelector('[data-testid="u2027-onde"]')!.textContent).toContain("Fica no módulo Desenvolvimento Pessoal, aba Seu 2027. Por enquanto, no site e no app do iPhone.");
        expect(pronto.textContent).not.toContain("Dev. Pessoal");
        expect(pronto.textContent).toContain("maria@email.com");
        clicar("#u27-continuar");
        const conta = await espera('[data-testid="landing-conta"]');
        expect(conta.querySelector('a[href*="apps.apple.com"]')).not.toBeNull();
        expect(conta.querySelector('a[href*="play.google.com"]')).not.toBeNull();
        expect(document.getElementById("lp-card")!.hasAttribute("data-u27")).toBe(false);
        expect(document.documentElement.hasAttribute("data-u27-pag")).toBe(false); // a conta pronta de sempre
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
    expect(document.getElementById("u27-nao")!.textContent).toBe("Agora não · ver minha conta");
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
    const codigo = "00020101021226870014br.gov.bcb.pix2565qrcode.exemplo.com/pix/v2/EMAIL-2027-5204000053039865405" + "19.905802BR6304ABCD";
    const url = `/organizar?r=u2027&compra=qr_vitalicio_77&pedido=qr_u27_77&pix=${encodeURIComponent(codigo)}&vence=${vence}&utm_source=email_compra`;
    await abrirPagina({ lp: "atual", u2027: false, url });
    const qr = await espera('[data-testid="u2027-qr"]');
    expect(qr.querySelector('[data-testid="u2027-codigo"]')!.textContent).toBe(codigo);
    expect(qr.querySelector('[data-testid="u2027-volte"]')!.textContent).toContain("Quando o pagamento cair, o 2027 entra na sua conta e a gente avisa por e-mail.");
    expect(qr.textContent).toContain("Vale por mais 19 h.");
    // crítica r2: chegou sem a tela da oferta → diz que o CORE está pago, que este Pix é só do 2027 e o que é o 2027
    expect(qr.querySelector('[data-testid="u2027-ja-pago"]')!.textContent).toBe("Seu CORE está pago. Este Pix é só do 2027.");
    expect(qr.querySelector('[data-testid="u2027-qual"]')!.textContent).toBe("Seu 2027 organizado · 3 metas, revisões do mês e cofrinho");
    // crítica r2 (compradora 5): pelo link a página de venda do vitalício some (só o cartão) e a garantia do vitalício também
    expect(document.documentElement.getAttribute("data-u27-pag")).toBe("link");
    expect(document.getElementById("lp-u27-pag-css")!.textContent).toMatch(/main\.lp>:not\(\.lp-barra\):not\(#oferta\)/);
    expect(eventos().find((e) => e.nome === "landing_u2027_volta_email")).toMatchObject({ restaurado: "link", order_id: "qr_vitalicio_77" });
    expect(document.getElementById("lp-card")!.dataset.fase).toBe("conta"); // a oferta do vitalício some atrás do Pix do 2027
    clicar("#u27-sair");
    // crítica r1 (ALTA): quem já pagou NUNCA cai na venda do vitalício ao sair — "Você já tem o CORE" + lojas, sem "Não fui eu"
    const jaTem = await espera('[data-testid="landing-ja-tem"]');
    expect(jaTem.querySelector('a[href*="apps.apple.com"]')).not.toBeNull();
    expect(jaTem.querySelector('a[href*="play.google.com"]')).not.toBeNull();
    expect(document.getElementById("lp-nao-fui-eu")).toBeNull();
    expect(document.getElementById("lp-card")!.dataset.fase).toBe("conta");
    expect(document.getElementById("lp-card")!.hasAttribute("data-u27-link")).toBe(true); // a faixa "OFERTA ESPECIAL · HOJE" some
    expect(eventos().find((e) => e.nome === "landing_ja_tem")).toMatchObject({ via: "link_u2027" });
    // a recarga pelo mesmo link fica na conta (não reabre o QR nem a venda)
    await abrirPagina({ lp: "atual", u2027: false, url, limpar: false });
    await espera('[data-testid="landing-ja-tem"]');
    await dormir(150);
    expect(document.querySelector('[data-testid="u2027-qr"]')).toBeNull();
    expect(document.getElementById("lp-card")!.dataset.fase).toBe("conta");
  });

  for (const lp of ["atual", "v2"] as const) {
    it(`${lp}: link do e-mail VENCIDO num navegador sem sessão → "Esse código venceu" (sem "Quero") → "Ver minha conta" = já tem o CORE`, async () => {
      const url = `/organizar?r=u2027&compra=qr_vitalicio_78&pedido=qr_u27_78&pix=${encodeURIComponent("000201" + "x".repeat(40))}&vence=${Date.now() - 1000}`;
      await abrirPagina({ lp, u2027: false, url, antes: () => { (window as unknown as { __landingSimularU2027: unknown }).__landingSimularU2027 = { semSessao: true }; } });
      (window as unknown as { __landingSimularU2027: unknown }).__landingSimularU2027 = { semSessao: true };
      await espera('[data-testid="u2027-conferindo"]', 2000).catch(() => null); // não pisca um "Quero" antes de saber
      const v = await espera('[data-testid="u2027-venceu"]');
      expect(v.querySelector("h3")!.textContent).toBe("Esse código venceu");
      expect(document.getElementById("u27-quero")).toBeNull();
      expect(v.textContent).toContain("O CORE que você pagou continua seu");
      expect(nomes()).toContain("landing_u2027_venceu");
      expect(nomes()).not.toContain("landing_u2027_view");
      clicar("#u27-conta");
      await espera('[data-testid="landing-ja-tem"]');
      expect(pix().textContent).not.toMatch(/R\$ 27,90|Pagar/);
    });
  }

  it("voltar do banco (recarga) depois de copiar mantém \"Código copiado\" (ela já colou)", async () => {
    await abrirPagina({ lp: "v2", u2027: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(async () => {}) }, configurable: true });
    try {
      await pagarVitalicio("livre");
      await espera('[data-testid="u2027-oferta"]');
      clicar("#u27-quero");
      expect((await espera('[data-testid="u2027-copiado"]')).textContent).toContain("Código copiado.");
      await abrirPagina({ lp: "v2", u2027: true, limpar: false, antes: () => { localStorage.removeItem("landing-u2027-v1"); } });
      const c = await espera('[data-testid="u2027-copiado"]');
      expect(c.textContent).toContain("Código copiado.");
      expect(document.querySelector('[data-testid="u2027-volte"]')!.textContent).toContain("Pagou? Volte aqui.");
    } finally { Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true }); }
  });

  it("quem já tem o CORE (marcador do aparelho) vê \"Você já tem o CORE\" — nunca a oferta do 2027", async () => {
    await abrirPagina({ lp: "v2", u2027: true, antes: () => { localStorage.setItem("landing-comprou-v1", JSON.stringify({ v: 1, em: Date.now(), oferta: "LN_sempre279", email: "ana@email.com" })); } });
    await espera('[data-testid="landing-ja-tem"]');
    await dormir(150);
    expect(document.querySelector('[data-testid^="u2027-"]')).toBeNull();
    expect(nomes().some((n) => n.startsWith("landing_u2027"))).toBe(false);
  });
});

describe("crítica r2: storage zerado com o QR do 2027 aberto (o Instagram) e a volta do banco", () => {
  for (const lp of ["atual", "v2"] as const) {
    it(`${lp}: localStorage.clear() + recarga → o MESMO código (pelo cookie), sem "Não fui eu"; pagou → "Pronto" → "Você já tem o CORE"`, async () => {
      await abrirPagina({ lp, checkout: "email", u2027: true });
      await pagarVitalicio("email");
      await espera('[data-testid="u2027-oferta"]');
      clicar("#u27-quero");
      const codigo = (await espera('[data-testid="u2027-codigo"]')).textContent;
      expect(document.cookie).toMatch(/landing_u2027=/);
      await abrirPagina({ lp, checkout: "email", u2027: true, limpar: false, antes: () => { localStorage.clear(); } });
      const qr = await espera('[data-testid="u2027-qr"]');
      expect(qr.querySelector('[data-testid="u2027-codigo"]')!.textContent).toBe(codigo);
      expect(document.querySelector('[data-testid="landing-ja-tem"]')).toBeNull();
      // a sessão foi junto com o storage: esta aba não confere sozinha — o texto honesto de quem confirma pelo e-mail
      expect(qr.querySelector('[data-testid="u2027-volte"]')!.textContent).toContain("Quando o pagamento cair, o 2027 entra na sua conta e a gente avisa por e-mail.");
      expect(qr.querySelector('[data-testid="u2027-ja-pago"]')!.textContent).toBe("Seu CORE está pago. Este Pix é só do 2027.");
      expect(qr.querySelector('[data-testid="u2027-qual"]')).not.toBeNull();
      expect(document.getElementById("lp-card")!.hasAttribute("data-u27")).toBe(true); // sem a faixa "OFERTA ESPECIAL · HOJE"
      expect(eventos().find((e) => e.nome === "landing_u2027_retomado")).toMatchObject({ etapa: "qr" });
      simular().pagarU2027();
      await espera('[data-testid="u2027-pronto"]');
      // e a recarga no "Pronto" (storage zerado de novo) volta pro "Pronto"
      await abrirPagina({ lp, checkout: "email", u2027: true, limpar: false, antes: () => { localStorage.clear(); } });
      await espera('[data-testid="u2027-pronto"]');
      clicar("#u27-continuar");
      await espera('[data-testid="landing-ja-tem"]');
      expect(document.getElementById("lp-nao-fui-eu")).toBeNull();
      expect(pix().textContent).not.toMatch(/Pagar|R\$ 27,90/);
    });
  }

  it("\"O código também foi pro seu e-mail\" volta com a recarga (guardado no estado e no cookie)", async () => {
    await abrirPagina({ lp: "v2", u2027: true });
    await pagarVitalicio("livre");
    await espera('[data-testid="u2027-oferta"]');
    clicar("#u27-quero");
    expect((await espera('[data-testid="u2027-qr"]')).textContent).toContain("O código também foi pro seu e-mail.");
    await abrirPagina({ lp: "v2", u2027: true, limpar: false, antes: () => { localStorage.removeItem("landing-u2027-v1"); } });
    expect((await espera('[data-testid="u2027-qr"]')).textContent).toContain("O código também foi pro seu e-mail.");
  });

  it("o cookie leva as marcas copiado (c) e e-mail (e)", () => {
    const agora = Date.parse("2026-10-31T12:00:00Z");
    const e = { v: 1 as const, compra: "c1", etapa: "qr" as const, pix: { orderId: "q1", qrCode: "000201abc", qrCodeBase64: null, expiresAt: new Date(agora + 3600e3).toISOString(), donoIgual: true }, salvoEm: agora, copiado: true, comEmail: true };
    const v = paraCookie(e);
    expect(v.split("~")[4]).toBe("1ce");
    expect(doCookie(v, agora)).toMatchObject({ copiado: true, comEmail: true, pix: { donoIgual: true } });
    expect(doCookie(paraCookie({ ...e, copiado: false, comEmail: false }), agora)).not.toHaveProperty("comEmail");
  });
});

/* crítica r1 (dinheiro-pix MÉDIA 4): o laço da tela do QR — o módulo direto, com a API "real" (não simulada) e relógio falso */
describe("o laço de conferência do QR (3 s → 30 s → para em 30 min; só com a aba à vista; nunca pra outra conta / e-mail)", () => {
  const PIX = (donoIgual: boolean) => ({ orderId: "qr_u27_laco", qrCode: "000201" + "y".repeat(40), qrCodeBase64: null, expiresAt: new Date(Date.now() + 24 * 3600e3).toISOString(), donoIgual, comEmail: false });
  let n = 0;
  function montar(donoIgual = true) {
    n++;
    localStorage.clear(); apagarCookies();
    document.body.innerHTML = '<div id="card"><div id="caixa"></div></div>';
    const conferir = vi.fn(async () => false);
    const api: ApiU2027 = { simulado: false, gerar: vi.fn(async () => PIX(donoIgual)), conferir };
    const u = criarUpsell2027(`compra_laco_${n}`, {
      caixa: document.getElementById("caixa")!, card: document.getElementById("card")!, api, evento: () => {},
      copiarNoToque: async (p) => { await p; return { ok: true, via: "teste" }; }, copiarTexto: async () => true, desenharQr: () => {},
      email: () => null, linhaConfirmada: () => "O CORE é seu pra sempre.", aoTerminar: () => {}, aoMudar: () => {},
    });
    return { u, conferir };
  }
  const visivel = (v: "visible" | "hidden") => { Object.defineProperty(document, "visibilityState", { value: v, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); };
  afterEach(() => { vi.useRealTimers(); visivel("visible"); });

  it("3 s nos 10 primeiros minutos, 30 s até 30 min, depois para (a volta da aba ainda confere)", async () => {
    vi.useFakeTimers();
    const { u, conferir } = montar();
    u.render();
    (document.getElementById("u27-quero") as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(50);
    expect(u.etapa()).toBe("qr");
    await vi.advanceTimersByTimeAsync(LACO_U2027.viraLentoMs);
    const rapido = conferir.mock.calls.length;
    expect(rapido).toBeGreaterThanOrEqual(195);
    expect(rapido).toBeLessThanOrEqual(201);
    await vi.advanceTimersByTimeAsync(LACO_U2027.paraMs - LACO_U2027.viraLentoMs);
    const lento = conferir.mock.calls.length - rapido;
    expect(lento).toBeGreaterThanOrEqual(39);
    expect(lento).toBeLessThanOrEqual(41);
    const n = conferir.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60 * 60e3);
    expect(conferir.mock.calls.length).toBe(n); // parou (era até 24 h a cada 3 s)
    visivel("hidden"); visivel("visible");
    await vi.advanceTimersByTimeAsync(10);
    expect(conferir.mock.calls.length).toBe(n + 1); // a volta do banco confere 1x
    u.parar();
  });
  it("com a aba escondida não consulta; ao voltar, confere e o laço volta", async () => {
    vi.useFakeTimers();
    const { u, conferir } = montar();
    u.render();
    (document.getElementById("u27-quero") as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(50);
    visivel("hidden");
    const n = conferir.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5 * 60e3);
    expect(conferir.mock.calls.length).toBe(n);
    visivel("visible");
    await vi.advanceTimersByTimeAsync(3100);
    expect(conferir.mock.calls.length).toBeGreaterThanOrEqual(n + 2);
    u.parar();
  });
  it("Pix de outra conta (a página não confirma sozinha): nenhum laço e nenhuma conferência na volta", async () => {
    vi.useFakeTimers();
    const { u, conferir } = montar(false);
    u.render();
    (document.getElementById("u27-quero") as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(50);
    expect(u.etapa()).toBe("qr");
    await vi.advanceTimersByTimeAsync(10 * 60e3);
    visivel("hidden"); visivel("visible");
    await vi.advanceTimersByTimeAsync(10);
    expect(conferir).not.toHaveBeenCalled();
    u.parar();
  });
});

/* 31/10 (upsell-tela-cheia, o "glitch" do dono): com o e-mail já dado, o QR pago vai DIRETO pra oferta — o cartão "pago"
 * ("Pronto! Falta o seu e-mail" / "Pagamento confirmado" com barrinha) não aparece em nenhum momento. */
describe("chave LIGADA: QR pago → oferta sem piscar o cartão de confirmação", () => {
  for (const lp of ["atual", "v2"] as const) {
    it(`${lp} · email: nenhuma mutação mostra landing-pago / u2027-carregando`, async () => {
      await abrirPagina({ lp, checkout: "email", u2027: true });
      const viu = new Set<string>();
      const mo = new MutationObserver(() => {
        for (const t of ["landing-pago", "u2027-carregando", "landing-preparando-conta"]) if (document.querySelector(`[data-testid="${t}"]`)) viu.add(t);
      });
      mo.observe(document.body, { childList: true, subtree: true });
      try {
        digitar("lp-email-antes", "maria@email.com");
        clicar("#lp-pagar");
        await espera('[data-testid="landing-codigo"]');
        simular().pagar();
        await espera('[data-testid="u2027-oferta"]');
        await dormir(300);
        expect([...viu]).toEqual([]);
      } finally { mo.disconnect(); }
    });
  }
});
