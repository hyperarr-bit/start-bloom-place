/**
 * LANDING /organizar — BRAÇO v2 "vitrine" (30/10), o A/B "AB_LP" (braço "atual" × "v2"), DESLIGADO no código.
 *
 * Por quê (lp-web/funil 30/10 + lp-analise/topo 29/10): 61% não rolam a 1ª tela (75% somem em < 3 s); a oferta ficava
 * 4,7 telas abaixo; a pergunta de área era tocada por 1%; "É um app de verdade?" é a dúvida nº 1; quem volta do banco
 * paga 81%. Aqui:
 *   1. o sorteio no <head>: chave "off" = todo mundo no "atual" (sem criar id); "on" = estável por aparelho, pelo MESMO
 *      id do AB_CHECKOUT com outra conta (independentes); forçável por ?lp=v2|atual, ?lp=auto desfaz;
 *   2. o braço "atual" é a página de hoje BYTE A BYTE: o HTML e o CSS, tirando o que é só do v2, batem com o
 *      landing.html do origin/main de 30/10 (src/test/fixtures/landing-atual-30-10.html);
 *   3. o braço v2: a vitrine (prints reais, preço e botão no topo), a ordem dos blocos por CSS (oferta logo depois do
 *      topo), o cartão com "Vitalício", a faixa sem "só hoje", a tela do Pix com 3 passos + "Pagou? Volte aqui",
 *      a demo só no toque, o botão fixo quando o botão do topo sai da tela;
 *   4. nos DOIS braços (técnico, sem mudança visual): braco_lp em todo evento; o pixel no 1º quadro (≤ 1,5 s, sem esperar
 *      o load); a demo do atual só depois do pixel / perto da tela / no toque; a 2ª chance do chunk do Pix;
 *   5. o AB_CHECKOUT continua nos dois braços; o fluxo inteiro no v2: oferta → e-mail → Pix → pago → conta com as lojas.
 * A página roda de verdade (landing.html + landing.ts) no jsdom, com o Pix SIMULADO (fora do domínio de produção).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { bracoCheckoutDoAparelho, bracoLpDoAparelho, bracoLpDoHtml } from "@/landing/regras";
import { carregarComRetry } from "@/landing/carregar";

const raiz = resolve(__dirname, "../..");
const HTML = readFileSync(resolve(raiz, "landing.html"), "utf8");
const MAIN = readFileSync(resolve(__dirname, "fixtures/landing-atual-30-10.html"), "utf8");

/* ───────── o script do <head>, rodado num ambiente falso (com cookie) ───────── */
const scriptDaCabeca = HTML.match(/<script>\s*(\(function \(\) \{\s*var LANDING_NOVA[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];
const comChaves = (lp: "on" | "off", checkout: "on" | "off") =>
  scriptDaCabeca.replace(/var AB_LP = "(on|off)"/, `var AB_LP = "${lp}"`).replace(/var AB_CHECKOUT = "(on|off)"/, `var AB_CHECKOUT = "${checkout}"`);

function rodar(fonte: string, url: string, store: Record<string, string> = {}, cookie: { v: string } = { v: "" }) {
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
    set cookie(c: string) { const [par] = c.split(";"); cookie.v = par; },
  } as unknown as { cookie: string };
  const window: Record<string, unknown> = { localStorage, crypto: { randomUUID: () => randomUUID() } };
  // eslint-disable-next-line no-new-func
  new Function("location", "document", "window", "localStorage", "URLSearchParams", "Math", "fetch", "sessionStorage", fonte)(
    location, document, window, localStorage, URLSearchParams, Math, undefined, { getItem: () => null },
  );
  return { attrs, store, cookie, mem: window.__landing as Record<string, unknown> };
}

describe("o sorteio da página (AB_LP, head do landing.html)", () => {
  it("vem DESLIGADO no código: todo mundo no braço atual, sem criar id de aparelho quando o checkout também está off", () => {
    expect(HTML).toMatch(/var AB_LP = "off";/);
    const r = rodar(comChaves("off", "off"), "/organizar?utm_campaign=x");
    expect(r.attrs["data-lp"]).toBe("atual");
    expect(r.store["landing-device-id"]).toBeUndefined();
    expect(r.cookie.v).toBe("");
    expect(r.mem).toMatchObject({ lp: "atual", ab_lp: "off", lp_forcado: false });
  });

  it("?lp=v2 força e FICA neste navegador; ?lp=atual idem; ?lp=auto desfaz (volta pro sorteio/chave)", () => {
    const store: Record<string, string> = {};
    expect(rodar(comChaves("off", "off"), "/organizar?lp=v2", store).attrs["data-lp"]).toBe("v2");
    expect(rodar(comChaves("off", "off"), "/organizar", store).attrs["data-lp"]).toBe("v2"); // ficou
    expect(rodar(comChaves("off", "off"), "/organizar", store).mem.lp_forcado).toBe(true);
    expect(rodar(comChaves("off", "off"), "/organizar?lp=atual", store).attrs["data-lp"]).toBe("atual");
    expect(rodar(comChaves("off", "off"), "/organizar", store).attrs["data-lp"]).toBe("atual");
    expect(rodar(comChaves("off", "off"), "/organizar?lp=auto", store).attrs["data-lp"]).toBe("atual");
    expect(store["landing-lp-force"]).toBeUndefined();
    expect(rodar(comChaves("off", "off"), "/organizar?lp=zzz", store).attrs["data-lp"]).toBe("atual"); // valor estranho = chave
  });

  it("ligado: estável por aparelho (localStorage E cookie); sem o localStorage o cookie segura o braço; a conta é a do regras.ts", () => {
    const store: Record<string, string> = {};
    const cookie = { v: "" };
    const a = rodar(comChaves("on", "off"), "/organizar", store, cookie);
    const id = store["landing-device-id"];
    expect(id).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(cookie.v).toBe(`landing_device_id=${encodeURIComponent(id)}`);
    expect(a.attrs["data-lp"]).toBe(bracoLpDoAparelho(id));
    for (let i = 0; i < 5; i++) expect(rodar(comChaves("on", "off"), "/organizar", store, cookie).attrs["data-lp"]).toBe(a.attrs["data-lp"]);
    const semLs = rodar(comChaves("on", "off"), "/organizar", {}, cookie); // o Instagram zerou o localStorage
    expect(semLs.attrs["data-lp"]).toBe(a.attrs["data-lp"]);
    expect(semLs.store["landing-device-id"]).toBe(id);
    expect(a.mem).toMatchObject({ lp: a.attrs["data-lp"], ab_lp: "on", lp_forcado: false });
  });

  it("divide ~50/50 e é INDEPENDENTE do sorteio do checkout no mesmo aparelho (as 4 combinações aparecem)", () => {
    const celulas: Record<string, number> = {};
    const N = 600;
    for (let i = 0; i < N; i++) {
      const r = rodar(comChaves("on", "on"), "/organizar");
      const id = r.store["landing-device-id"];
      expect(r.attrs["data-checkout"]).toBe(bracoCheckoutDoAparelho(id));
      expect(r.attrs["data-lp"]).toBe(bracoLpDoAparelho(id));
      const k = `${r.attrs["data-checkout"]}|${r.attrs["data-lp"]}`;
      celulas[k] = (celulas[k] ?? 0) + 1;
    }
    for (const k of ["livre|atual", "livre|v2", "email|atual", "email|v2"]) expect(celulas[k] / N).toBeGreaterThan(0.16);
    const v2 = (celulas["livre|v2"] + celulas["email|v2"]) / N;
    expect(v2).toBeGreaterThan(0.4); expect(v2).toBeLessThan(0.6);
  });

  it("o AB_CHECKOUT continua igual com o AB_LP ligado: o mesmo aparelho cai no mesmo braço do checkout com a chave do lp on ou off", () => {
    const store: Record<string, string> = {}; const cookie = { v: "" };
    const antes = rodar(comChaves("off", "on"), "/organizar", store, cookie).attrs["data-checkout"];
    const depois = rodar(comChaves("on", "on"), "/organizar", store, cookie);
    expect(depois.attrs["data-checkout"]).toBe(antes);
    expect(depois.attrs["data-lp"]).toBe(bracoLpDoAparelho(store["landing-device-id"]));
    // forçar o lp não mexe no checkout; forçar o checkout não mexe no lp
    expect(rodar(comChaves("on", "on"), "/organizar?lp=v2", store, cookie).attrs).toMatchObject({ "data-checkout": antes, "data-lp": "v2" });
    expect(rodar(comChaves("on", "on"), "/organizar?lp=auto&checkout=email", store, cookie).attrs).toMatchObject({ "data-checkout": "email", "data-lp": depois.attrs["data-lp"] });
  });

  it("bracoLpDoHtml: só 'v2' vira v2; sem atributo (página velha em cache) = atual", () => {
    expect(bracoLpDoHtml({ getAttribute: () => "v2" })).toBe("v2");
    expect(bracoLpDoHtml({ getAttribute: () => "atual" })).toBe("atual");
    expect(bracoLpDoHtml({ getAttribute: () => null })).toBe("atual");
  });
});

/* ───────── 2. o braço atual é a página de hoje, byte a byte ───────── */
const corpoDe = (html: string) => html.match(/<body>([\s\S]*)<\/body>/)![1];
const estiloDe = (html: string) => html.match(/<style>([\s\S]*?)<\/style>/)![1];
const soV2 = /data-lp="v2"|data-so-lp|\.lp2-|BRAÇO v2/;

describe("braço atual = a página de hoje (origin/main 30/10), sem tirar nem pôr", () => {
  it("o HTML do corpo, tirando o que é só do v2 (e o atributo data-so-lp), é IGUAL ao de hoje", () => {
    const novo = document.createElement("div");
    novo.innerHTML = corpoDe(HTML);
    novo.querySelectorAll('[data-so-lp="v2"]').forEach((el) => el.remove());
    novo.querySelectorAll("[data-so-lp]").forEach((el) => el.removeAttribute("data-so-lp"));
    const velho = document.createElement("div");
    velho.innerHTML = corpoDe(MAIN);
    const limpo = (el: HTMLElement) => el.innerHTML.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").trim();
    expect(limpo(novo)).toBe(limpo(velho));
  });
  it("o CSS de hoje continua inteiro e na ordem; o do v2 fica num bloco só, no fim, e toda regra dele é escopada (html[data-lp=v2] / .lp2-* / [data-so-lp])", () => {
    const [deHoje, doV2] = estiloDe(HTML).split("/* ═════════ BRAÇO v2");
    expect(doV2).toBeDefined();
    const linhas = (s: string) => s.split("\n").map((l) => l.trim()).filter((l) => l && !/data-so-lp/.test(l));
    expect(linhas(deHoje)).toEqual(linhas(estiloDe(MAIN)));
    for (const l of doV2.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("/*") && l !== "}" && !l.startsWith("@media"))) expect(l).toMatch(soV2);
  });
  it("o CSS do v2 esconde o que é do atual, e o atual (ou sem atributo) esconde o que é do v2", () => {
    expect(HTML).toContain('html:not([data-lp="v2"]) [data-so-lp="v2"], html[data-lp="v2"] [data-so-lp="atual"] { display: none !important; }');
  });
  it("as chaves de hoje seguem como no origin/main (AB_CHECKOUT on; título/oferta off)", () => {
    for (const k of ["AB_CHECKOUT", "AB_TITULO", "AB_OFERTA", "LANDING_NOVA"]) {
      const re = new RegExp(`var ${k} = "(on|off)"`);
      expect(HTML.match(re)![1]).toBe(MAIN.match(re)![1]);
    }
  });
});

/* ───────── 3. o que o v2 tem ───────── */
describe("braço v2: a vitrine, a ordem e o cartão", () => {
  const html = () => { const d = document.createElement("div"); d.innerHTML = corpoDe(HTML); return d; };
  it("a vitrine (#topo-v2) tem promessa, onde roda, 3 prints reais em celular na proporção do iPhone, preço vitalício e o botão — tudo antes de qualquer outro bloco", () => {
    const topo = html().querySelector("#topo-v2")!;
    expect(topo.getAttribute("data-so-lp")).toBe("v2");
    expect(topo.querySelector("h1")!.textContent).toBe("Sua vida organizada num app só.");
    expect(topo.querySelector(".lp2-onde")!.textContent).toMatch(/App Store.*Google Play.*Computador/);
    const imgs = [...topo.querySelectorAll(".lp2-cel img")].map((i) => i.getAttribute("src"));
    expect(imgs).toEqual(["/landing/v2-home.webp", "/landing/v2-financas.webp", "/landing/v2-meu-mes.webp"]);
    expect(HTML).toMatch(/\.lp2-cel \{[^}]*aspect-ratio: 390 \/ 844/);
    expect(HTML).toMatch(/\.lp2-cel img \{[^}]*width: 100%; height: auto/); // nunca esticado
    expect(topo.querySelector(".lp2-preco")!.textContent!.replace(/\s+/g, " ")).toMatch(/R\$ 27,90.*Vitalício · pagamento único no Pix.*Na App Store: R\$ 97,90 por ano/);
    expect(topo.querySelector("#lp-cta-topo")!.getAttribute("data-ir")).toBe("oferta");
    expect(topo.querySelector(".lp2-miuda")!.textContent).toBe("Paga 1 vez. Nada é cobrado depois. 7 dias de garantia.");
    expect(topo.querySelector("video")).toBeNull();
    expect(topo.querySelector(".lp-area, .lp-pergunta")).toBeNull(); // sem a pergunta de área
  });
  it("a ordem dos blocos por CSS: vitrine → oferta → antes/depois → avaliações → os 16 → como → demo (opcional) → dúvidas", () => {
    const ordem = (id: string) => Number(HTML.match(new RegExp(`html\\[data-lp="v2"\\] #${id} \\{ order: (-?\\d+)`))![1]);
    const seq = ["topo-v2", "oferta", "antes", "avaliacoes", "modulos", "como", "demo", "duvidas"].map(ordem);
    expect([...seq].sort((a, b) => a - b)).toEqual(seq);
    expect(HTML).toMatch(/html\[data-lp="v2"\] main\.lp \{ display: flex; flex-direction: column; \}/);
    expect(ordem("oferta")).toBe(ordem("topo-v2") + 1);
  });
  it("a faixa do v2 não tem 'só hoje' nem data; a do atual continua com a data", () => {
    const d = html();
    const faixas = [...d.querySelectorAll(".lp-promo")];
    const v2 = faixas.find((f) => f.getAttribute("data-so-lp") === "v2")!;
    const atual = faixas.find((f) => f.getAttribute("data-so-lp") === "atual")!;
    expect(v2.textContent).toMatch(/ACESSO VITALÍCIO/);
    expect(v2.textContent).not.toMatch(/hoje|\d\d\/\d\d/);
    expect(atual.querySelector("#lp-promo-data")).not.toBeNull();
  });
  it("o cartão v2: 'Vitalício por R$ 27,90', âncora honesta, 'App de verdade: App Store, Google Play e computador' e a linha de confiança embaixo do botão", () => {
    const card = html().querySelector("#lp-card")!;
    card.querySelectorAll('[data-so-lp="atual"], [data-so-oferta="ano"]').forEach((el) => el.remove());
    const t = card.textContent!.replace(/\s+/g, " ");
    expect(t).toContain("Acesso vitalício");
    expect(t).toContain("Na App Store: R$ 97,90 por ano. Aqui:");
    expect(t).toContain("Vitalício por R$ 27,90");
    expect(t).toContain("App de verdade: App Store, Google Play e computador");
    expect(t).toContain("Pague uma vez e é seu pra sempre. Nada é cobrado depois.");
    expect(t).toContain("7 dias de garantia");
    expect(t).not.toMatch(/só hoje|De R\$ 97,90/i);
    expect(card.querySelector("#lp-pagar + .lp2-confianca")!.textContent).toContain("Paga 1 vez. Nada é cobrado depois. 7 dias de garantia.");
    expect(card.querySelector(".lp-email-antes")!.getAttribute("data-so-checkout")).toBe("email"); // o A/B do e-mail continua no mesmo cartão
  });
  it("a demo no v2 é opcional: botão 'Testar o app' em cima do print; o iframe só tem src no toque (ver o teste de comportamento)", () => {
    const d = html();
    expect(d.querySelector("#lp-demo-abrir")!.getAttribute("data-so-lp")).toBe("v2");
    expect(d.querySelector("#lp-demo-frame")!.getAttribute("src")).toBeNull();
  });
  it("sem link clicável pra loja antes do preço (regra do dono 28/10): os selos só no pós-compra", () => {
    const d = html();
    d.querySelectorAll("#lp-pix").forEach((el) => el.remove());
    expect(d.querySelectorAll('a[href*="apps.apple.com"], a[href*="play.google.com"]')).toHaveLength(0);
  });
});

/* ───────── 4–5. a página de verdade no jsdom (Pix simulado) ───────── */
const corpo = corpoDe(HTML).replace(/<script type="module"[^>]*><\/script>/, "");
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Ev = Record<string, unknown> & { nome: string };
const eventos = (): Ev[] => ((window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding ?? []);
const nomes = () => eventos().map((e) => e.nome);
const apagarCookies = () => { for (const c of document.cookie.split(";")) { const n = c.split("=")[0].trim(); if (n) document.cookie = `${n}=; Max-Age=0; Path=/`; } };

/** IntersectionObserver de mentira: guarda as instâncias pra o teste disparar as entradas que quiser */
type Entrada = { isIntersecting: boolean; target: Element; boundingClientRect: { top: number } };
class IOFake {
  static inst: IOFake[] = [];
  alvos: Element[] = [];
  constructor(public cb: (e: Entrada[], o: IOFake) => void, public opts: { threshold?: number | number[]; rootMargin?: string } = {}) { IOFake.inst.push(this); }
  observe(el: Element) { this.alvos.push(el); }
  unobserve() { /* noop */ }
  disconnect() { this.alvos = []; }
  takeRecords() { return []; }
}
const dispara = (achar: (o: IOFake) => boolean, entradas: Entrada[]) => { const o = IOFake.inst.find(achar); if (!o) throw new Error("observador não achado"); o.cb(entradas, o); };

/* o IntersectionObserver do setup.ts dispara "visível" em todo observe (serve pros paywalls do app); aqui o de mentira
 * só dispara quando o teste manda — senão a demo do braço atual começaria "perto" na hora e nada daria pra medir */
const IO_DO_SETUP = (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver;
const trocarIO = (v: unknown) => { (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = v; (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = v; };
async function abrirPagina(lp: "atual" | "v2" | null, checkout: "livre" | "email" = "livre") {
  await dormir(25); // o rAF (landing_html) da página anterior esvazia antes de zerar a lista de eventos
  vi.resetModules();
  localStorage.clear(); sessionStorage.clear(); apagarCookies();
  window.history.replaceState(null, "", "/organizar");
  (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
  IOFake.inst = [];
  trocarIO(IOFake);
  document.documentElement.setAttribute("data-t", "a");
  document.documentElement.setAttribute("data-oferta", "sempre");
  document.documentElement.setAttribute("data-checkout", checkout);
  if (lp) document.documentElement.setAttribute("data-lp", lp); else document.documentElement.removeAttribute("data-lp");
  document.body.innerHTML = corpo;
  await import("@/landing/landing");
}
afterEach(() => { trocarIO(IO_DO_SETUP); });
const espera = (sel: string, ms = 4000) => vi.waitFor(() => { const el = document.querySelector(sel); if (!el) throw new Error(sel); return el; }, { timeout: ms, interval: 40 });
const pagar = () => (document.getElementById("lp-pagar") as HTMLButtonElement).click();
const digitar = (id: string, v: string) => { const c = document.getElementById(id) as HTMLInputElement; c.value = v; c.dispatchEvent(new Event("input")); };
const simular = () => (window as unknown as { __landingSimular: { pagar: () => void } }).__landingSimular;
const diag = () => (window as unknown as { __landingDiag: { terceirosEm: number | null; demoEm: number | null; demoVia: string | null } }).__landingDiag;
const frame = () => document.getElementById("lp-demo-frame") as HTMLIFrameElement;

describe("nos DOIS braços: braco_lp em todo evento, pixel cedo, demo preguiçosa", () => {
  it("todo evento landing_* leva braco_lp = v2 / atual / (sem atributo) atual", async () => {
    await abrirPagina("v2");
    pagar(); await espera('[data-testid="landing-codigo"]');
    const l = eventos().filter((e) => e.nome.startsWith("landing_"));
    expect(l.length).toBeGreaterThan(2);
    for (const e of l) expect(e.braco_lp).toBe("v2");
    expect(eventos().find((e) => e.nome === "landing_html")).toMatchObject({ braco_lp: "v2", braco_checkout: "livre", lp_forcado: false });
    await abrirPagina("atual");
    for (const e of eventos()) expect(e.braco_lp).toBe("atual");
    await abrirPagina(null);
    for (const e of eventos()) expect(e.braco_lp).toBe("atual");
  });

  it("o pixel entra no 1º quadro + ocioso (≤ 1,5 s), sem esperar o load (+800 ms) de antes; reserva aos 2,5 s", async () => {
    const src = readFileSync(resolve(raiz, "src/landing/landing.ts"), "utf8");
    expect(src).not.toMatch(/addEventListener\("load"/);
    expect(src).toMatch(/requestAnimationFrame\(\(\) => ocioso\(carregarTerceiros, 1500\)\)/);
    expect(src).toMatch(/window\.setTimeout\(carregarTerceiros, 2500\)/);
    expect(src).not.toMatch(/setTimeout\(carregarTerceiros, 6000\)/);
    await abrirPagina("atual");
    expect(diag().terceirosEm).toBeNull(); // ainda não (1º quadro + ocioso)
    await vi.waitFor(() => { if (diag().terceirosEm === null) throw new Error("pixel"); }, { timeout: 1600, interval: 20 });
  });

  it("braço atual: a demo começa DEPOIS do pixel (e em ocioso), não no load — a caixa já mostra a imagem leve até lá", async () => {
    await abrirPagina("atual");
    expect(frame().getAttribute("src")).toBeNull();
    expect(nomes()).not.toContain("landing_demo_aberta");
    await vi.waitFor(() => { if (!frame().getAttribute("src")) throw new Error("demo"); }, { timeout: 2500, interval: 20 });
    expect(frame().getAttribute("src")).toBe("/organizar/demo?m=financas");
    expect(diag()).toMatchObject({ demoVia: "fundo" });
    expect(diag().demoEm!).toBeGreaterThanOrEqual(diag().terceirosEm!);
    expect(eventos().find((e) => e.nome === "landing_demo_aberta")).toMatchObject({ via: "fundo", modulo: "financas" });
  });

  it("braço atual: a demo entrou ≥ 25% na tela (a pessoa rolou até ela) → começa na hora, antes do pixel", async () => {
    await abrirPagina("atual");
    const demo = document.getElementById("demo")!;
    dispara((o) => o.opts.threshold === 0.25, [{ isIntersecting: true, target: demo, boundingClientRect: { top: 10 } }]);
    expect(frame().getAttribute("src")).toBe("/organizar/demo?m=financas");
    expect(diag().demoVia).toBe("perto");
  });

  it("braço atual: o 1º toque numa área abre a demo no módulo certo (como hoje)", async () => {
    await abrirPagina("atual");
    (document.querySelector('.lp-area[data-a="rotina"]') as HTMLButtonElement).click();
    expect(frame().getAttribute("src")).toBe("/organizar/demo?m=rotina");
    expect(eventos().find((e) => e.nome === "landing_demo_aberta")).toMatchObject({ via: "area", modulo: "rotina" });
  });

  it("braço v2: a demo NUNCA começa sozinha — só no toque em 'Testar o app' (ou pílula/grade)", async () => {
    await abrirPagina("v2");
    await dormir(900); // o pixel já entrou (≤ 1,5 s no jsdom: rAF + 200 ms) e a demo continua parada
    expect(diag().terceirosEm).not.toBeNull();
    expect(frame().getAttribute("src")).toBeNull();
    expect(IOFake.inst.find((o) => o.opts.threshold === 0.25)).toBeUndefined(); // nem o observador "perto" existe no v2
    const celular = document.getElementById("lp-celular")!;
    expect(celular.hasAttribute("data-abrindo")).toBe(false);
    (document.getElementById("lp-demo-abrir") as HTMLButtonElement).click();
    expect(frame().getAttribute("src")).toBe("/organizar/demo?m=financas");
    expect(celular.hasAttribute("data-abrindo")).toBe(true);
    expect(eventos().find((e) => e.nome === "landing_demo_aberta")).toMatchObject({ via: "botao" });
    expect(eventos().find((e) => e.nome === "landing_cta" && e.onde === "testar_app")).toBeTruthy();
    await abrirPagina("v2");
    (document.querySelector('.lp-pilula[data-m="treino"]') as HTMLButtonElement).click();
    expect(frame().getAttribute("src")).toBe("/organizar/demo?m=treino");
    expect(diag().demoVia).toBe("pilula");
  });

  it("braço v2: o botão do topo rola pra oferta (landing_cta onde=topo) e, quando sai da tela por cima, o botão fixo entra", async () => {
    await abrirPagina("v2");
    const fixo = document.getElementById("lp-fixo")!;
    expect(fixo.hasAttribute("data-on")).toBe(false);
    const cta = document.getElementById("lp-cta-topo")!;
    cta.click();
    expect(eventos().find((e) => e.nome === "landing_cta")).toMatchObject({ onde: "topo" });
    dispara((o) => o.alvos.includes(cta), [{ isIntersecting: false, target: cta, boundingClientRect: { top: -120 } }]);
    expect(fixo.hasAttribute("data-on")).toBe(true);
    // com a oferta na tela, o fixo some (como hoje)
    const oferta = document.getElementById("oferta")!;
    dispara((o) => o.alvos.includes(oferta), [{ isIntersecting: true, target: oferta, boundingClientRect: { top: 200 } }]);
    expect(fixo.hasAttribute("data-on")).toBe(false);
    expect(nomes()).toContain("landing_oferta_vista");
  });
});

describe("a 2ª chance do chunk do Pix (src/landing/carregar.ts)", () => {
  it("carregou de primeira: nada acontece", async () => {
    const falhou = vi.fn(); const recarga = vi.fn();
    expect(await carregarComRetry(async () => 7, { aoFalhar: falhou, recarregar: true, recarregarPagina: recarga })).toBe(7);
    expect(falhou).not.toHaveBeenCalled(); expect(recarga).not.toHaveBeenCalled();
  });
  it("falhou 1x (rede piscou) → espera e tenta de novo → ok (tentativa 1 avisada, sem recarga)", async () => {
    let n = 0;
    const falhou = vi.fn(); const recarga = vi.fn(); const espera = vi.fn(async () => {});
    const r = await carregarComRetry(async () => { if (++n === 1) throw new Error("chunk"); return "ok"; }, { aoFalhar: falhou, recarregar: true, recarregarPagina: recarga, espera, esperaMs: 700 });
    expect(r).toBe("ok");
    expect(falhou).toHaveBeenCalledTimes(1); expect(falhou.mock.calls[0][0]).toBe(1);
    expect(espera).toHaveBeenCalledWith(700);
    expect(recarga).not.toHaveBeenCalled();
  });
  it("falhou 2x depois de um deploy (HTML velho pede chunk velho) → marca e recarrega a página UMA vez; na 2ª vez só propaga o erro", async () => {
    const falhou = vi.fn(); const recarga = vi.fn(); const marcou = vi.fn();
    let marcado = false;
    const o = { aoFalhar: falhou, recarregar: true, recarregarPagina: recarga, espera: async () => {}, jaRecarregou: () => marcado, marcarRecarga: () => { marcado = true; marcou(); } };
    await expect(carregarComRetry(async () => { throw new TypeError("'text/html' is not a valid JavaScript MIME type"); }, o)).rejects.toThrow(/text\/html/);
    expect(falhou.mock.calls.map((c) => c[0])).toEqual([1, 2, "recarga"]);
    expect(marcou).toHaveBeenCalledTimes(1); expect(recarga).toHaveBeenCalledTimes(1);
    await expect(carregarComRetry(async () => { throw new Error("de novo"); }, o)).rejects.toThrow("de novo");
    expect(recarga).toHaveBeenCalledTimes(1); // sem laço
  });
  it("o pré-aquecimento (recarregar=false) nunca recarrega a página", async () => {
    const recarga = vi.fn();
    await expect(carregarComRetry(async () => { throw new Error("x"); }, { recarregar: false, recarregarPagina: recarga, espera: async () => {}, jaRecarregou: () => false })).rejects.toThrow("x");
    expect(recarga).not.toHaveBeenCalled();
  });
  it("a landing usa o retry: o toque em pagar pode recarregar; o pré-aquecimento não; o erro vira landing_erro chunk_pagamento", () => {
    const src = readFileSync(resolve(raiz, "src/landing/landing.ts"), "utf8");
    expect(src).toContain('carregarComRetry(() => import("./pagamento")');
    expect(src).toContain("void pg(false).catch(() => null)");
    expect(src).toContain('onde: "chunk_pagamento"');
    expect(src).toContain("limparMarcaDeRecarga");
  });
});

describe("braço v2 + AB_CHECKOUT: o fluxo inteiro, nos dois braços do e-mail", () => {
  it("v2 · livre: oferta → Pix com os 3 passos e 'Pagou? Volte aqui' (e-mail opcional continua) → pago → e-mail → conta pronta com Abrir meu CORE + lojas; sem 'Mudar o plano'", async () => {
    await abrirPagina("v2", "livre");
    pagar();
    expect(document.querySelector('[data-testid="landing-gerando"]')!.textContent).toContain("Gerando o seu Pix");
    await espera('[data-testid="landing-codigo"]');
    const pix = document.getElementById("lp-pix")!;
    const passos = [...pix.querySelectorAll('[data-testid="landing-passos"] li')].map((li) => li.textContent!.replace(/\s+/g, " ").trim());
    expect(passos).toHaveLength(3);
    expect(passos[1]).toMatch(/banco.*Pix/);
    expect(passos[2]).toMatch(/Pix Copia e Cola/);
    expect(pix.querySelector('[data-testid="landing-volte"]')!.textContent).toMatch(/Pagou\? Volte aqui\. O acesso abre na hora/);
    expect(pix.querySelector(".lp2-garantia-mini")!.textContent).toContain("7 dias de garantia");
    expect(pix.querySelector('[data-testid="landing-copiado"]')).toBeNull(); // a caixa verde virou o passo 1
    expect(pix.textContent).not.toContain("Esperando o pagamento");
    expect(document.getElementById("lp-ja-paguei")).not.toBeNull();
    expect(document.getElementById("lp-mudar")).toBeNull();
    expect(document.getElementById("lp-email-pix")).not.toBeNull(); // braço livre: o opcional segue
    expect(pix.querySelector(".lp-codigo")!.textContent).toMatch(/^000201/);
    simular().pagar();
    await espera('[data-testid="landing-pago"]');
    digitar("lp-email", "maria@email.com");
    (document.getElementById("lp-criar") as HTMLButtonElement).click();
    const conta = await espera('[data-testid="landing-conta"]');
    expect(conta.textContent).toContain("Seu CORE é seu pra sempre.");
    expect(conta.textContent).toContain("Abrir meu CORE");
    expect(conta.textContent).toContain("entre com este e-mail: maria@email.com");
    expect(conta.querySelector('a[href*="apps.apple.com"]')).not.toBeNull();
    expect(conta.querySelector('a[href*="play.google.com"]')).not.toBeNull();
    expect(nomes()).toEqual(expect.arrayContaining(["landing_pix_gerado", "landing_pix_copiado", "landing_pix_pago", "landing_email"]));
    for (const e of eventos()) expect(e).toMatchObject({ braco_lp: "v2", braco_checkout: "livre" });
  });

  it("v2 · email: pagar sem e-mail → erro no campo, sem Pix; com e-mail → Pix com os 3 passos + 'o acesso chega em…' → pago → conta direto", async () => {
    await abrirPagina("v2", "email");
    pagar();
    await dormir(50);
    expect(document.getElementById("lp-email-antes-erro")!.hidden).toBe(false);
    expect(document.querySelector('[data-testid="landing-codigo"]')).toBeNull();
    expect(eventos().find((e) => e.nome === "landing_email_antes_erro")).toMatchObject({ motivo: "vazio", braco_lp: "v2" });
    digitar("lp-email-antes", "joana@email.com");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    expect(document.querySelector('[data-testid="landing-passos"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="landing-email-garantido"]')!.textContent).toContain("joana@email.com");
    expect(document.getElementById("lp-email-pix")).toBeNull();
    simular().pagar();
    const conta = await espera('[data-testid="landing-conta"]');
    expect(conta.textContent).toContain("joana@email.com");
    expect(conta.querySelector('a[href*="apps.apple.com"]')).not.toBeNull();
    for (const e of eventos()) expect(e).toMatchObject({ braco_lp: "v2", braco_checkout: "email" });
  });

  it("atual · email: a tela do Pix de hoje (caixa verde + 'Esperando o pagamento'), sem os passos do v2", async () => {
    await abrirPagina("atual", "email");
    digitar("lp-email-antes", "ana@email.com");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    expect(document.querySelector('[data-testid="landing-passos"]')).toBeNull();
    expect(document.querySelector('[data-testid="landing-volte"]')).toBeNull();
    expect(document.getElementById("lp-pix")!.textContent).toContain("Esperando o pagamento");
    expect(document.querySelector('[data-testid="landing-email-garantido"]')!.textContent).toContain("ana@email.com");
  });

  it("v2: o Pix vivo volta depois de a aba recarregar (o banco), com os 3 passos", async () => {
    await abrirPagina("v2", "livre");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    const guardado = localStorage.getItem("landing-estado-v1")!;
    await abrirPagina("v2", "livre");
    localStorage.setItem("landing-estado-v1", guardado);
    vi.resetModules();
    document.body.innerHTML = corpo;
    await import("@/landing/landing");
    expect(document.querySelector('[data-testid="landing-codigo"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="landing-passos"]')).not.toBeNull();
  });
});
