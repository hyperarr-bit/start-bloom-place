/**
 * "LEVE ALGUÉM JUNTO" NO PÓS-PAGO DA /organizar (01/11, UPSELL_POS) — a página de verdade (landing.html + landing.ts +
 * upsell-presente.ts) no jsdom, com o Pix SIMULADO (fora do domínio de produção nada vai pra rede).
 *   · a chave: padrão "2027" = nem o atributo existe (o <head> sai igual, a página do 2027 igual, nenhum evento/CSS do presente);
 *     "presente" (ou ?upsell=presente, guardado) = html[data-upsell-pos="presente"];
 *   · "presente": a página própria (faixa, barra fixa) → Quero (copiou, QR, 24 h) → pago → o cartão do WhatsApp (o código,
 *     o nome no cartão, Copiar link) → conta pronta com as lojas; "Agora não" → conta pronta (e não volta); recarga = o MESMO QR;
 *   · nunca as duas ofertas; nunca pra quem não comprou pra sempre; sem Purchase; eventos com braco_lp/braco_checkout;
 *   · o servidor: 1 Pix por compra (chave própria), só pra compra pra sempre, presente já pago → o cartão (nunca 2º Pix).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { VALOR_PRESENTE_LP, ehPraSempreOferta, estadoPresenteLpQueVolta, upsellPosDoHtml } from "@/landing/regras";
import { NOTA_PRESENTE_LP, PASSOS_PRESENTE_LP, SUB_PRESENTE_LP, TITULO_PRESENTE_LP } from "@/landing/upsell-presente";
import { chavePixUpsell, chavePresenteLanding, chavePresenteDia3, presentePagoDaChave } from "../../supabase/functions/_shared/pix-upsell";
import { PRECO_PRESENTE_CENTAVOS } from "../../supabase/functions/_shared/presente";
import { linkDoPresente, mensagemDoPresente } from "@/lib/presente";

const raiz = resolve(__dirname, "../..");
const HTML = readFileSync(resolve(raiz, "landing.html"), "utf8");
const corpo = HTML.match(/<body>([\s\S]*)<\/body>/)![1].replace(/<script type="module"[^>]*><\/script>/, "");
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Ev = Record<string, unknown> & { nome: string };
const eventos = (): Ev[] => ((window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding ?? []);
const nomes = () => eventos().map((e) => e.nome);
const apagarCookies = () => { for (const c of document.cookie.split(";")) { const n = c.split("=")[0].trim(); if (n) document.cookie = `${n}=; Max-Age=0; Path=/`; } };

class IOQuieto { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } constructor(_cb: unknown) {} }
const IO_DO_SETUP = (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver;
const trocarIO = (v: unknown) => { (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = v; (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = v; };
afterEach(() => {
  trocarIO(IO_DO_SETUP);
  document.getElementById("pr-pag")?.remove(); document.getElementById("u27-pag")?.remove();
  document.documentElement.style.removeProperty("overflow");
});

const fbq = vi.fn();
async function abrirPagina(o: { lp?: "atual" | "v2"; checkout?: "livre" | "email"; pos?: "2027" | "presente"; oferta?: "sempre" | "ano"; limpar?: boolean; antes?: () => void } = {}) {
  await dormir(25);
  vi.resetModules();
  if (o.limpar !== false) { localStorage.clear(); sessionStorage.clear(); apagarCookies(); }
  window.history.replaceState(null, "", "/organizar");
  (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
  (window as unknown as { fbq?: unknown }).fbq = fbq; fbq.mockClear();
  delete (window as unknown as { __landingSimularU2027?: unknown }).__landingSimularU2027;
  trocarIO(IOQuieto);
  const d = document.documentElement;
  d.setAttribute("data-t", "a"); d.setAttribute("data-oferta", o.oferta ?? "sempre"); d.setAttribute("data-checkout", o.checkout ?? "email"); d.setAttribute("data-lp", o.lp ?? "atual");
  d.setAttribute("data-u2027", "on");
  if (o.pos === "presente") d.setAttribute("data-upsell-pos", "presente"); else d.removeAttribute("data-upsell-pos");
  document.getElementById("lp-u27-css")?.remove(); document.getElementById("lp-presente-css")?.remove();
  document.body.removeAttribute("style");
  document.body.innerHTML = corpo;
  o.antes?.();
  await import("@/landing/landing");
}
// a máquina pode estar carregada (o 1º teste da página paga a importação a frio): folga nos tempos, nunca na lógica
vi.setConfig({ testTimeout: 40_000 });
const espera = (sel: string, ms = 12_000) => vi.waitFor(() => { const el = document.querySelector(sel); if (!el) throw new Error(sel); return el as HTMLElement; }, { timeout: ms, interval: 40 });
const clicar = (sel: string) => (document.querySelector(sel) as HTMLElement).click();
const digitar = (id: string, v: string) => { const c = document.getElementById(id) as HTMLInputElement; c.value = v; c.dispatchEvent(new Event("input")); };
const simular = () => (window as unknown as { __landingSimular: { pagar: () => void; pagarU2027: () => void } }).__landingSimular;

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
  it("a chave vem do <html>: só data-upsell-pos=\"presente\" troca; o resto (sem atributo, lixo) = 2027", () => {
    expect(upsellPosDoHtml({ getAttribute: () => "presente" })).toBe("presente");
    expect(upsellPosDoHtml({ getAttribute: () => null })).toBe("2027");
    expect(upsellPosDoHtml({ getAttribute: () => "x" })).toBe("2027");
  });
  it("só compra PRA SEMPRE leva o presente (o LN_ano279 é de 1 ano)", () => {
    expect(ehPraSempreOferta("LN_sempre279")).toBe(true);
    expect(ehPraSempreOferta("LN_anosempre478")).toBe(true);
    expect(ehPraSempreOferta("LN_ano279")).toBe(false);
    expect(ehPraSempreOferta(null)).toBe(false);
  });
  it("R$ 14,90 = o preço do servidor (pv149)", () => {
    expect(Math.round(VALOR_PRESENTE_LP * 100)).toBe(PRECO_PRESENTE_CENTAVOS);
  });
  it("o estado volta só pra MESMA compra; QR vencido → oferta; cartão sem pedido → oferta (nunca cartão vazio)", () => {
    const agora = Date.parse("2026-11-01T12:00:00Z");
    const pix = { orderId: "qr_pv", qrCode: "000201x", qrCodeBase64: null, expiresAt: new Date(agora + 3600e3).toISOString(), donoIgual: true };
    expect(estadoPresenteLpQueVolta({ v: 1, compra: "c1", etapa: "qr", pix, salvoEm: agora, copiado: true }, "c1", agora)).toMatchObject({ etapa: "qr", pix, copiado: true });
    expect(estadoPresenteLpQueVolta({ v: 1, compra: "c1", etapa: "qr", pix, salvoEm: agora }, "c2", agora)).toMatchObject({ compra: "c2", etapa: "oferta" });
    expect(estadoPresenteLpQueVolta({ v: 1, compra: "c1", etapa: "qr", pix: { ...pix, expiresAt: new Date(agora - 1).toISOString() }, salvoEm: agora }, "c1", agora).etapa).toBe("oferta");
    expect(estadoPresenteLpQueVolta({ v: 1, compra: "c1", etapa: "cartao", pix: null, salvoEm: agora }, "c1", agora).etapa).toBe("oferta");
    expect(estadoPresenteLpQueVolta({ v: 1, compra: "c1", etapa: "cartao", pix: null, salvoEm: agora, pedido: "qr_pv", codigo: "ABCD2345" }, "c1", agora)).toMatchObject({ etapa: "cartao", pedido: "qr_pv", codigo: "ABCD2345" });
    expect(estadoPresenteLpQueVolta({ v: 1, compra: "c1", etapa: "fim", pix: null, salvoEm: agora - 3 * 86_400_000 }, "c1", agora).etapa).toBe("oferta");
    expect(estadoPresenteLpQueVolta("lixo", "c1", agora).etapa).toBe("oferta");
  });
  it("os textos: curtos, sem gênero, sem pressão (sem 'só hoje', contagem, brinde, desconto riscado)", () => {
    const tudo = [TITULO_PRESENTE_LP, SUB_PRESENTE_LP, ...PASSOS_PRESENTE_LP, NOTA_PRESENTE_LP].join(" ");
    expect(TITULO_PRESENTE_LP).toBe("Leve alguém junto");
    expect(SUB_PRESENTE_LP).toBe("Dê o CORE pra sempre pra quem você quer bem.");
    expect(tudo).not.toMatch(/só hoje|hoje|últim|acaba|minutos|grátis|brinde|\bamig[oa]\b|\bele\b|\bela\b|namorad/i);
  });
  it("o cartão usa o MESMO link e a MESMA mensagem da /presente/dar (src/lib/presente reexporta ./presente-link)", () => {
    expect(linkDoPresente("ABCD2345")).toBe("https://www.coreaplicativo.com.br/presente/ABCD2345");
    expect(mensagemDoPresente("ABCD2345", "Ana")).toBe("Ana te deu o CORE pra sempre 💛\nAbre aqui pra ativar o seu: https://www.coreaplicativo.com.br/presente/ABCD2345");
  });
});

describe("a chave no <head> do landing.html (UPSELL_POS, padrão \"2027\")", () => {
  const cabeca = HTML.match(/<script>\s*(\(function \(\) \{\s*var LANDING_NOVA[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];
  /** o <head> SEM o bloco novo (o que está no ar desde 31/10) — pra provar que com "2027" a saída é a mesma */
  const cabecaAntes = cabeca
    .replace(/\s*var UPSELL_POS = "[^"]*";[^\n]*/, "")
    .replace(/\s*\/\/ 01\/11: QUAL oferta[\s\S]*?if \(pos === "presente"\) d\.setAttribute\("data-upsell-pos", "presente"\);/, "");
  type Pote = { m: Record<string, string> };
  function rodar(fonte: string, url: string, store: Record<string, string> = {}, cookie: Pote = { m: {} }, pos?: "2027" | "presente") {
    const jar = cookie.m;
    const u = new URL(url, "https://www.coreaplicativo.com.br");
    const attrs: Record<string, string> = {};
    const doc = {
      documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } },
      createElement: () => ({ setAttribute() {} }), head: { appendChild() {} },
      get cookie() { return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; "); },
      set cookie(c: string) { const [par] = c.split(";"); const i = par.indexOf("="); const k = par.slice(0, i).trim(); if (/Max-Age=0/.test(c)) delete jar[k]; else jar[k] = par.slice(i + 1); },
    };
    const ls = { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
    const win: Record<string, unknown> = { localStorage: ls, crypto: { randomUUID: () => "id-aparelho-123" } };
    const f = pos ? fonte.replace(/var UPSELL_POS = "(2027|presente)"/, `var UPSELL_POS = "${pos}"`) : fonte;
    new Function("location", "document", "window", "localStorage", "URLSearchParams", "Math", f)(
      { search: u.search, hash: "", pathname: u.pathname, hostname: "www.coreaplicativo.com.br", protocol: "https:", replace: vi.fn() }, doc, win, ls, URLSearchParams, Math,
    );
    return { attrs, store, jar, mem: win.__landing as Record<string, unknown> };
  }
  it("no código: UPSELL_POS = \"2027\" (pronto e DESLIGADO), junto do UPSELL_2027", () => {
    expect(HTML).toMatch(/var UPSELL_POS = "2027";/);
    expect(cabeca.indexOf("var UPSELL_POS")).toBeLessThan(cabeca.indexOf("var UPSELL_2027"));
    expect(cabecaAntes).not.toContain("upsell"); // a régua de comparação é mesmo o <head> sem o bloco novo
  });
  it("com \"2027\" o <head> faz EXATAMENTE o que fazia: mesmos atributos, mesmo window.__landing, mesmo localStorage/cookies", () => {
    for (const url of ["/organizar", "/organizar?u2027=off", "/organizar?lp=v2&checkout=livre", "/organizar?utm_source=ig"]) {
      const novo = rodar(cabeca, url), velho = rodar(cabecaAntes, url);
      expect(novo.attrs).toEqual(velho.attrs);
      expect(novo.mem).toEqual(velho.mem);
      expect(novo.store).toEqual(velho.store);
      expect(novo.jar).toEqual(velho.jar);
      expect(novo.attrs["data-upsell-pos"]).toBeUndefined();
    }
  });
  it("\"presente\" no código liga pra todos; ?upsell=presente força e FICA (localStorage + cookie); ?upsell=2027 força o 2027; ?upsell=auto desfaz", () => {
    expect(rodar(cabeca, "/organizar", {}, { m: {} }, "presente").attrs["data-upsell-pos"]).toBe("presente");
    const store: Record<string, string> = {}; const cookie: Pote = { m: {} };
    expect(rodar(cabeca, "/organizar?upsell=presente", store, cookie).attrs["data-upsell-pos"]).toBe("presente");
    expect(rodar(cabeca, "/organizar", store, cookie).attrs["data-upsell-pos"]).toBe("presente");
    expect(cookie.m.landing_upsell_force).toBe("presente");
    expect(rodar(cabeca, "/organizar", {}, cookie).attrs["data-upsell-pos"]).toBe("presente"); // o Instagram zerou o storage: o cookie segura
    expect(rodar(cabeca, "/organizar?upsell=2027", store, cookie, "presente").attrs["data-upsell-pos"]).toBeUndefined();
    expect(rodar(cabeca, "/organizar?upsell=auto", store, cookie).attrs["data-upsell-pos"]).toBeUndefined();
    expect(store["landing-upsell-force"]).toBeUndefined();
    expect(cookie.m.landing_upsell_force).toBeUndefined();
  });
});

describe("UPSELL_POS \"2027\" (padrão): o 2027 de sempre, nada do presente", () => {
  for (const lp of ["atual", "v2"] as const) {
    it(`${lp}: pagou → o "Seu 2027" (R$ 19,90) — sem elemento, evento ou CSS do presente`, async () => {
      await abrirPagina({ lp });
      await pagarVitalicio("email");
      const oferta = await espera('[data-testid="u2027-oferta"]');
      expect(oferta.querySelector('[data-testid="u2027-preco"]')!.textContent).toBe("R$ 19,90");
      await vi.waitFor(() => expect(nomes()).toContain("landing_u2027_pix_pronto"), { timeout: 3000 });
      expect(document.querySelector('[data-testid^="presente-"]')).toBeNull();
      expect(document.getElementById("pr-pag")).toBeNull();
      expect(document.getElementById("lp-presente-css")).toBeNull();
      expect(nomes().some((n) => n.startsWith("landing_presente"))).toBe(false);
      expect(eventos().some((e) => "upsell_pos" in e)).toBe(false);
      clicar("#u27-nao");
      await espera('[data-testid="landing-conta"]');
    });
  }
});

describe("UPSELL_POS \"presente\": a página própria → Pix → cartão do WhatsApp → conta pronta", () => {
  for (const lp of ["atual", "v2"] as const) for (const checkout of ["email", "livre"] as const) {
    it(`${lp} · ${checkout}`, async () => {
      await abrirPagina({ lp, checkout, pos: "presente" });
      const escrito = vi.fn(async () => {});
      Object.defineProperty(navigator, "clipboard", { value: { writeText: escrito }, configurable: true });
      try {
        await pagarVitalicio(checkout);
        const pag = await espera('[data-testid="presente-pagina"]');
        const oferta = await espera('[data-testid="presente-oferta"]');
        expect(pag.getAttribute("role")).toBe("dialog");
        expect(pag.querySelector('[data-testid="presente-faixa"]')!.textContent).toBe("Pagamento confirmado · o CORE é seu pra sempre");
        expect(oferta.querySelector("h1")!.textContent).toBe("Leve alguém junto");
        expect(oferta.textContent).toContain("Dê o CORE pra sempre pra quem você quer bem.");
        expect([...oferta.querySelectorAll('[data-testid="presente-passos"] li')].map((l) => l.textContent)).toEqual(["1Você paga o Pix", "2Manda o link no WhatsApp", "3A pessoa abre e cria a conta dela"]);
        expect(oferta.textContent).toContain("Vale pra 1 pessoa que ainda não tem o CORE.");
        const barra = pag.querySelector('[data-testid="presente-barra"]')!;
        expect(barra.querySelector('[data-testid="presente-preco"]')!.textContent).toBe("R$ 14,90");
        expect(barra.textContent).toContain("uma vez, sem mensalidade");
        expect(document.getElementById("pr-quero")!.textContent).toBe("Quero · copiar o Pix");
        expect(document.getElementById("pr-nao")!.textContent).toBe("Agora não · ver minha conta");
        expect(pag.textContent).not.toMatch(/só hoje|últim|acaba|grátis|brinde|R\$ 27,90.*R\$ 14,90/i);
        // UMA oferta só: nada do 2027
        expect(document.querySelector('[data-testid^="u2027-"]')).toBeNull();
        expect(document.getElementById("lp-u27-css")).toBeNull();
        expect(document.querySelector('[data-testid="landing-conta"]')).toBeNull();
        expect(document.getElementById("lp-card")!.dataset.fase).toBe("conta");
        // o Pix já está sendo gerado (pré-aquecido)
        await vi.waitFor(() => expect(nomes()).toContain("landing_presente_pix_pronto"), { timeout: 3000 });
        clicar("#pr-quero");
        const qr = await espera('[data-testid="presente-qr"]');
        expect(escrito).toHaveBeenCalled(); // copiou no toque
        expect(qr.querySelector('[data-testid="presente-copiado"]')!.textContent).toContain("Código copiado.");
        expect(qr.querySelector('[data-testid="presente-codigo-pix"]')!.textContent).toMatch(/^000201/);
        expect(qr.querySelector('[data-testid="presente-volte"]')!.textContent).toContain("Pagou? Volte aqui.");
        expect(qr.textContent).toContain("Vale por 24 horas.");
        expect(qr.textContent).toContain("O link também vai pro seu e-mail.");
        expect(pag.querySelector('[data-testid="presente-faixa"]')!.textContent).toBe("Seu CORE (R$ 27,90) está pago · este Pix é só do presente");
        simular().pagarU2027(); // o Pix do presente simulado (a mesma porta do 2027)
        const cartao = await espera('[data-testid="presente-cartao"]');
        expect(cartao.textContent).toContain("Presente pago · R$ 14,90");
        expect(cartao.querySelector("h1")!.textContent).toBe("Agora é só mandar 💌");
        const link = await vi.waitFor(() => { const t = document.querySelector('[data-testid="presente-link"]')!.textContent!; if (!/presente\/SMPX/.test(t)) throw new Error(t + " " + JSON.stringify(nomes())); return t; }, { timeout: 4000 });
        const codigo = link.split("/presente/")[1];
        expect(document.querySelector('[data-testid="presente-cartao-de"]')!.textContent).toBe("Você ganhou o CORE pra sempre 💛");
        digitar("pr-nome", "Maria");
        expect(document.querySelector('[data-testid="presente-cartao-de"]')!.textContent).toBe("Maria te deu o CORE pra sempre 💛");
        const zap = document.getElementById("pr-zap") as HTMLAnchorElement;
        zap.addEventListener("click", (k) => k.preventDefault()); // o jsdom não navega
        zap.click();
        expect(decodeURIComponent(zap.href)).toContain(`Maria te deu o CORE pra sempre 💛\nAbre aqui pra ativar o seu: https://www.coreaplicativo.com.br/presente/${codigo}`);
        clicar("#pr-copiar-link");
        await vi.waitFor(() => expect(document.getElementById("pr-copiar-link")!.textContent).toBe("Link copiado"));
        expect(escrito).toHaveBeenLastCalledWith(`https://www.coreaplicativo.com.br/presente/${codigo}`);
        clicar("#pr-continuar");
        const conta = await espera('[data-testid="landing-conta"]');
        expect(conta.querySelector('a[href*="apps.apple.com"]')).not.toBeNull();
        expect(conta.querySelector('a[href*="play.google.com"]')).not.toBeNull();
        expect(document.getElementById("pr-pag")).toBeNull();
        expect(document.getElementById("lp-card")!.hasAttribute("data-u27")).toBe(false);
        expect(nomes()).toEqual(expect.arrayContaining(["landing_presente_view", "landing_presente_quero", "landing_presente_pix_pronto", "landing_presente_copiado", "landing_presente_ja_paguei", "landing_presente_pago", "landing_presente_codigo", "landing_presente_whatsapp", "landing_presente_link_copiado", "landing_presente_continuar"].filter((n) => n !== "landing_presente_ja_paguei")));
        expect(nomes().some((n) => n.startsWith("landing_u2027"))).toBe(false);
        for (const e of eventos().filter((x) => x.nome.startsWith("landing_presente"))) {
          expect(e).toMatchObject({ braco_lp: lp, braco_checkout: checkout, upsell_pos: "presente" });
          expect(String(e.order_id)).toMatch(/^simulado-/);
          expect(JSON.stringify(e)).not.toContain("maria@email.com");
        }
        expect(eventos().find((e) => e.nome === "landing_presente_whatsapp")).toMatchObject({ com_nome: true });
        expect(eventos().find((e) => e.nome === "landing_presente_pago")).toMatchObject({ valor: 14.9 });
        expect(fbq.mock.calls.filter((c) => c[1] === "Purchase")).toHaveLength(0);
      } finally { Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true }); }
    });
  }
});

describe("UPSELL_POS \"presente\": as saídas e as voltas", () => {
  it("\"Agora não\" → conta pronta; recarregar NÃO mostra o presente de novo (nem o 2027)", async () => {
    await abrirPagina({ lp: "v2", pos: "presente" });
    await pagarVitalicio("email");
    await espera('[data-testid="presente-oferta"]');
    clicar("#pr-nao");
    const conta = await espera('[data-testid="landing-conta"]');
    expect(conta.textContent).not.toMatch(/14,90|30 dias/);
    expect(eventos().find((e) => e.nome === "landing_presente_nao")).toMatchObject({ de: "oferta" });
    await abrirPagina({ lp: "v2", pos: "presente", limpar: false });
    await espera('[data-testid="landing-conta"]');
    await dormir(200);
    expect(document.querySelector('[data-testid="presente-oferta"]')).toBeNull();
    expect(document.querySelector('[data-testid^="u2027-"]')).toBeNull();
  });

  it("o Voltar do celular na oferta = \"Agora não\" (fecha a página, conta pronta)", async () => {
    await abrirPagina({ lp: "atual", pos: "presente" });
    await pagarVitalicio("email");
    await espera('[data-testid="presente-oferta"]');
    window.history.replaceState(null, "", "/organizar"); // o pushState da página sai da pilha (o que o Voltar faz)
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    await espera('[data-testid="landing-conta"]');
    expect(eventos().find((e) => e.nome === "landing_presente_nao")).toMatchObject({ de: "voltar" });
  });

  it("recarregar no QR (o banco recarrega a aba) reabre o MESMO código — até sem o localStorage (cookie); \"Agora não\" do QR → conta", async () => {
    await abrirPagina({ lp: "atual", pos: "presente" });
    await pagarVitalicio("email");
    await espera('[data-testid="presente-oferta"]');
    clicar("#pr-quero");
    const codigo = (await espera('[data-testid="presente-codigo-pix"]')).textContent;
    await abrirPagina({ lp: "atual", pos: "presente", limpar: false });
    expect((await espera('[data-testid="presente-codigo-pix"]')).textContent).toBe(codigo);
    await abrirPagina({ lp: "atual", pos: "presente", limpar: false, antes: () => { localStorage.removeItem("landing-presente-v1"); } });
    expect((await espera('[data-testid="presente-codigo-pix"]')).textContent).toBe(codigo);
    clicar("#pr-sair");
    await espera('[data-testid="landing-conta"]');
    expect(eventos().find((e) => e.nome === "landing_presente_nao")).toMatchObject({ de: "qr" });
  });

  it("recarregar no cartão volta no cartão com o MESMO código (o link não se perde)", async () => {
    await abrirPagina({ lp: "atual", pos: "presente" });
    await pagarVitalicio("email");
    await espera('[data-testid="presente-oferta"]');
    clicar("#pr-quero");
    await espera('[data-testid="presente-qr"]');
    clicar("#pr-ja-paguei");
    const cartao = await espera('[data-testid="presente-cartao"]');
    expect(cartao.textContent).toContain("Agora é só mandar");
    const link = await vi.waitFor(() => { const t = document.querySelector('[data-testid="presente-link"]')!.textContent!; if (!/presente\//.test(t)) throw new Error(t); return t; }, { timeout: 4000 });
    await abrirPagina({ lp: "atual", pos: "presente", limpar: false });
    const de2 = await espera('[data-testid="presente-cartao"]');
    expect(de2.querySelector('[data-testid="presente-link"]')!.textContent).toBe(link);
  });

  it("o Pix falhou → erro na barra e o 2º toque gera", async () => {
    await abrirPagina({ lp: "v2", pos: "presente" });
    (window as unknown as { __landingSimularU2027: { falhar: boolean } }).__landingSimularU2027 = { falhar: true };
    await pagarVitalicio("email");
    await espera('[data-testid="presente-oferta"]');
    clicar("#pr-quero");
    await vi.waitFor(() => expect(document.querySelector('[data-testid="presente-barra"] .lp-erro')?.textContent).toMatch(/Não consegui gerar o Pix/), { timeout: 3000 });
    (window as unknown as { __landingSimularU2027: { falhar: boolean } }).__landingSimularU2027.falhar = false;
    clicar("#pr-quero");
    await espera('[data-testid="presente-qr"]');
  });

  it("nunca pra quem comprou 1 ano (LN_ano279): conta pronta, sem oferta nenhuma", async () => {
    await abrirPagina({ lp: "atual", pos: "presente", oferta: "ano" });
    await pagarVitalicio("email");
    await espera('[data-testid="landing-conta"]', 8000);
    await dormir(200);
    expect(document.querySelector('[data-testid^="presente-"]')).toBeNull();
    expect(document.querySelector('[data-testid^="u2027-"]')).toBeNull();
    expect(nomes().some((n) => n.startsWith("landing_presente_view") || n.startsWith("landing_u2027_view"))).toBe(false);
  });
});

/* ───────── o servidor (banco falso) ───────── */
type Linha = Record<string, unknown>;
function bancoFalso(t: Record<string, Linha[]>) {
  return {
    from: (nome: string) => {
      const tab = (t[nome] ??= []);
      const f: Array<[string, unknown]> = [];
      const exec = () => ({ data: tab.filter((l) => f.every(([c, v]) => l[c] === v)), error: null });
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (c: string, v: unknown) => { f.push([c, v]); return q; },
        maybeSingle: async () => ({ data: exec().data[0] ?? null, error: null }),
        then: (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(exec()).then(ok, ko),
      };
      return q;
    },
  };
}

describe("o servidor: o presente da /organizar", () => {
  it("a chave é POR COMPRA e separada da do dia 3", () => {
    expect(chavePresenteLanding("LN_abc")).toBe("pv149-lp:LN_abc");
    expect(chavePresenteLanding("x")).not.toBe(chavePresenteDia3("x"));
  });
  it("presente já pago por esta chave (o QR guardado OU um anterior) → { pedido, codigo }; de outro dono / nada pago → null", async () => {
    const guardado = JSON.stringify({ orderId: "qr_novo", payload: "000201", expiresAt: "2026-11-02T12:00:00Z", dono: "u1", oferta: "pv149", anteriores: ["qr_velho"] });
    const banco = bancoFalso({
      webhook_events: [{ id: chavePixUpsell(chavePresenteLanding("LN_c1")), event: guardado }],
      presentes: [{ codigo: "ABCD2345", comprador_id: "u1", pedido: "qr_velho", de_nome: "Ana", resgatado_por: null }],
    });
    expect(await presentePagoDaChave(banco, chavePresenteLanding("LN_c1"), "u1")).toEqual({ pedido: "qr_velho", codigo: "ABCD2345", de: "Ana" });
    expect(await presentePagoDaChave(banco, chavePresenteLanding("LN_c1"), "u2")).toBeNull();
    expect(await presentePagoDaChave(banco, chavePresenteLanding("LN_outra"), "u1")).toBeNull();
    const semPago = bancoFalso({ webhook_events: [{ id: chavePixUpsell(chavePresenteLanding("LN_c1")), event: guardado }], presentes: [] });
    expect(await presentePagoDaChave(semPago, chavePresenteLanding("LN_c1"), "u1")).toBeNull();
    expect(await presentePagoDaChave({ from: () => { throw new Error("rede"); } }, "x", "u1")).toBeNull(); // nunca lança
  });
  it("asaas-pix: o ramo do presente com `compra` = dono da compra, SÓ pra sempre, 24 h pelo garantirPixUpsell, presente pago → cartão; o check confere o dono antes da Asaas", () => {
    const src = readFileSync(resolve(raiz, "supabase/functions/asaas-pix/index.ts"), "utf8");
    const ramo = src.slice(src.indexOf("01/11 (landing /organizar, UPSELL_POS"), src.indexOf("/* 21/10: o presente (pv149) é upsell de quem JÁ é pra sempre"));
    expect(ramo).toContain("compraDoUpsell(supabaseAdmin, compra)");
    expect(ramo).toContain("sessaoPodePedir(c, user.id)");
    expect(ramo).toMatch(/ehPraSempreLanding\(c\.oferta\) \|\| !temPraSempre\(await linhasDaConta\(supabaseAdmin, c\.dono\)\)/);
    expect(ramo).toContain("presentePagoDaChave(supabaseAdmin, chavePresenteLanding(compra), c.dono)");
    expect(ramo).toContain("chave: chavePresenteLanding(compra), dono: c.dono");
    expect(ramo).not.toMatch(/sendMetaCapi|markPixPurchasePending/);
    // o ramo vem ANTES do caminho antigo do pv149 (30 min) — o /hoje e o /inicio (sem `compra`) seguem iguais
    expect(src.indexOf("01/11 (landing /organizar, UPSELL_POS")).toBeLessThan(src.indexOf("if (ehOfertaPresente(offer)) {\n        let praSempre"));
    expect(src).toMatch(/ehOfertaPresente\(String\(body\.offer \?\? ""\)\) && typeof body\.compra === "string" && !!body\.compra\) \{\s*const regP = await registroDoPedido/);
  });
});
