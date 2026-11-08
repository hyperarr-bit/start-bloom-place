/**
 * /organizar — O CHECKOUT NOVO (08/11, chave CHECKOUT_ORG_V2 no <head>; novidades-guardadas/2026-11-07/checkout-organizar/SPEC.md).
 *
 * 1. A chave no <head>: "off" no código; "on" = todo o /organizar (sem sorteio, sem id de aparelho); ?cko=v2|atual força (localStorage +
 *    cookie), ?cko=auto desfaz; /vida, /oferta e /vitalicio não leem; oferta "ano" = sempre o atual.
 * 2. Chave off idêntica: o roteiro fixo (./organizar-cko-roteiro.ts) dá EXATAMENTE a fixture gravada do HEAD 08bc1145 antes de mexer
 *    (os 2 braços do AB_LP × os 2 do AB_PIX), tirando só braco_cko/cko_forcado dos eventos. Idem com ?cko=atual e a chave "on".
 * 3. Com data-cko="v2": o MESMO roteiro pela camada dá o MESMO cartão do QR em diante (QR dos 2 braços do AB_PIX, pago, conta com as lojas,
 *    "Você já tem o CORE", Pix vivo reaberto, Instagram zerando o storage, presente), os MESMOS eventos de hoje (fora os landing_cko_*) e o
 *    MESMO pixel. E o que é só da camada: textos, Dúvidas, fechar (X/Esc/voltar) sem sair do site, o código de 8 números nela, os botões que
 *    rolam quando já tem Pix/conta, a oferta "ano", o módulo que não carrega, a recarga com a camada aberta.
 * A página roda de verdade (landing.html + landing.ts) no jsdom, com o Pix SIMULADO (fora do domínio de produção). O caminho do dinheiro de
 * verdade (asaas-pix, Purchase, atribuição) está em ./organizar-checkout-v2-asaas.test.ts.
 */
import { afterEach, describe, it, expect, vi } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  HTML, abrirPagina, botaoFixo, camadaAberta, clicar, digitar, dormir, encerrarPagina, espera, esperaCamada, esperaCamadaFechar, eventos, fbq, limparEventos, nomes,
  roteiroHoje, roteiroV2, semCampoDoCartao, semCko, simularPago, type Lp, type Pix, type Roteiro,
} from "./organizar-cko-roteiro";
import { bracoCkoDoHtml } from "@/landing/regras";

const FIXTURE = resolve(__dirname, "fixtures/organizar-hoje-07-11.json");
const COMBOS: Array<[Lp, Pix]> = [["atual", "atual"], ["atual", "b"], ["v2", "atual"], ["v2", "b"]];
const fixture = () => JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, Roteiro>;
const FONTE_CAMADA = readFileSync(resolve(__dirname, "../landing/checkout-organizar.ts"), "utf8");
/** o código do módulo, sem os comentários (que citam o checkout da /oferta e o preço de hoje) */
const CODIGO_CAMADA = FONTE_CAMADA.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** o jsdom não tem scrollIntoView (o landing.ts engole o erro): aqui ele vira um espião */
const espiarRolagem = () => { const f = vi.fn(); (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = f; return f; };
const soltarRolagem = () => { delete (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView; };

// 08/11 (revisão): a página de cada teste "fecha" no fim (ouvintes e timers dela saem) — nenhuma página velha mexe na do teste seguinte
afterEach(() => { encerrarPagina(); soltarRolagem(); });
/** os roteiros longos (5 páginas por par): 1 teste por par, com teto folgado — numa máquina carregada 4 pares num teste só passavam de 120 s */
const TETO_PAR = 300_000;

/* ───────── 1. a chave no <head> ───────── */
const cabeca = HTML.match(/<script>\s*(\(function \(\) \{\s*var LANDING_NOVA[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];
const comChave = (v: "on" | "off") => cabeca.replace(/var CHECKOUT_ORG_V2 = "(on|off)"/, `var CHECKOUT_ORG_V2 = "${v}"`);
function rodar(fonte: string, url: string, store: Record<string, string> = {}, ck: { v: string } = { v: "" }) {
  const u = new URL(url, "https://www.coreaplicativo.com.br");
  const attrs: Record<string, string> = {};
  const location = { search: u.search, hash: u.hash, pathname: u.pathname, hostname: "www.coreaplicativo.com.br", protocol: "https:", replace: vi.fn() };
  const localStorage = { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; } };
  const document = {
    documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } },
    createElement: () => ({ setAttribute: () => {} }), head: { appendChild: () => {} },
    get cookie() { return ck.v; },
    set cookie(c: string) { const [par] = c.split(";"); const [nome] = par.split("="); const resto = ck.v.split("; ").filter((x) => x && !x.startsWith(`${nome}=`)); if (!/Max-Age=0/.test(c)) resto.push(par); ck.v = resto.join("; "); },
  };
  const window: Record<string, unknown> = { localStorage, crypto: { randomUUID: () => randomUUID() } };
  new Function("location", "document", "window", "localStorage", "URLSearchParams", "Math", "fetch", "sessionStorage", fonte)(location, document, window, localStorage, URLSearchParams, Math, undefined, { getItem: () => null });
  return { attrs, store, cookie: ck, mem: window.__landing as Record<string, unknown> };
}

describe("a chave CHECKOUT_ORG_V2 no <head>", () => {
  it("no código: \"off\" — o /organizar inteiro no checkout de hoje, sem força, sem cookie nem storage por causa dela", () => {
    expect(HTML).toMatch(/var CHECKOUT_ORG_V2 = "off";/);
    for (const url of ["/organizar", "/organizar?lp=v2", "/organizar?utm_content=c7"]) {
      const store: Record<string, string> = {}; const ck = { v: "" };
      const r = rodar(cabeca, url, store, ck);
      expect(r.attrs["data-cko"]).toBe("atual");
      expect(r.mem).toMatchObject({ cko: "atual", ab_cko: "off", cko_forcado: false });
      expect(store["landing-cko-force"]).toBeUndefined();
      expect(ck.v).not.toContain("landing_cko_force");
    }
  });
  it("\"on\" = TODO o /organizar no v2, nos 2 braços do AB_LP, sem sorteio (o mesmo aparelho e aparelhos diferentes)", () => {
    for (let i = 0; i < 50; i++) {
      const r = rodar(comChave("on"), "/organizar", { "landing-device-id": randomUUID() });
      expect(r.attrs["data-cko"]).toBe("v2");
      expect(r.mem).toMatchObject({ cko: "v2", ab_cko: "on", cko_forcado: false });
    }
    expect(rodar(comChave("on"), "/organizar?lp=atual").attrs).toMatchObject({ "data-lp": "atual", "data-cko": "v2" });
    expect(rodar(comChave("on"), "/organizar?lp=v2").attrs).toMatchObject({ "data-lp": "v2", "data-cko": "v2" });
  });
  it("a chave não mexe em nada dos outros sorteios (mesmos data-* e o mesmo id de aparelho, só o data-cko a mais)", () => {
    for (const url of ["/organizar", "/organizar?lp=v2&pix=b", "/organizar?checkout=livre"]) {
      const id = randomUUID();
      const off = rodar(comChave("off"), url, { "landing-device-id": id }), on = rodar(comChave("on"), url, { "landing-device-id": id });
      const { "data-cko": _a, ...aOff } = off.attrs; const { "data-cko": _b, ...aOn } = on.attrs;
      expect(aOn).toEqual(aOff);
      expect(on.store).toEqual(off.store);
    }
  });
  it("?cko=v2|atual força com a chave off ou on (fica: localStorage + cookie de 30 dias); ?cko=auto desfaz; o cookie segura o storage zerado", () => {
    const store: Record<string, string> = {}; const ck = { v: "" };
    const a = rodar(comChave("off"), "/organizar?cko=v2", store, ck);
    expect(a.attrs["data-cko"]).toBe("v2");
    expect(a.mem).toMatchObject({ cko: "v2", cko_forcado: true });
    expect(store["landing-cko-force"]).toBe("v2");
    expect(ck.v).toContain("landing_cko_force=v2");
    expect(rodar(comChave("off"), "/organizar", store, ck).attrs["data-cko"]).toBe("v2"); // fica
    expect(rodar(comChave("off"), "/organizar", {}, ck).attrs["data-cko"]).toBe("v2"); // o Instagram zerou o storage: o cookie segura
    const b = rodar(comChave("on"), "/organizar?cko=atual", store, ck);
    expect(b.attrs["data-cko"]).toBe("atual");
    expect(b.mem.cko_forcado).toBe(true);
    const c = rodar(comChave("on"), "/organizar?cko=auto", store, ck);
    expect(store["landing-cko-force"]).toBeUndefined();
    expect(ck.v).not.toContain("landing_cko_force");
    expect(c.attrs["data-cko"]).toBe("v2");
    expect(c.mem.cko_forcado).toBe(false);
    expect(rodar(comChave("off"), "/organizar?cko=zzz", {}).attrs["data-cko"]).toBe("atual"); // valor estranho = a chave
  });
  it("/vida, /oferta e /vitalicio não leem nada (nem com a chave on, ?cko=v2 ou a força guardada)", () => {
    for (const url of ["/vida?cko=v2", "/oferta?cko=v2", "/vitalicio?cko=v2", "/vida", "/oferta"]) {
      const store: Record<string, string> = { "landing-cko-force": "v2" };
      const r = rodar(comChave("on"), url, store, { v: "landing_cko_force=v2" });
      expect(r.attrs["data-cko"]).toBeUndefined();
      expect(r.mem.cko).toBeUndefined();
      expect(r.mem.cko_forcado).toBeUndefined();
      expect(store["landing-cko-force"]).toBe("v2"); // nem apaga
    }
  });
  it("oferta \"ano\" (só por ?oferta=ano): sempre o atual (o banner diz vitalício)", () => {
    expect(rodar(comChave("on"), "/organizar?oferta=ano").attrs["data-cko"]).toBe("atual");
    expect(rodar(comChave("off"), "/organizar?oferta=ano&cko=v2").attrs["data-cko"]).toBe("atual");
  });
  it("bracoCkoDoHtml: só 'v2' vira v2; sem atributo = atual", () => {
    expect(bracoCkoDoHtml({ getAttribute: () => "v2" })).toBe("v2");
    expect(bracoCkoDoHtml({ getAttribute: () => "atual" })).toBe("atual");
    expect(bracoCkoDoHtml({ getAttribute: () => null })).toBe("atual");
  });
  it("o CSS que esconde o e-mail do cartão só pega com data-cko=\"v2\" (e volta se o módulo da camada falhar), fora do 1º <style>", () => {
    expect(HTML).toContain('<style>html[data-cko="v2"]:not([data-cko-falhou]) .lp-email-antes { display: none !important; } html[data-cko="v2"] [data-ir="oferta"][aria-busy="true"], html[data-cko="v2"] #lp-pagar[aria-busy="true"] { opacity: .75; pointer-events: none; }</style>');
    expect(HTML.match(/<style>([\s\S]*?)<\/style>/)![1]).not.toContain("data-cko");
  });
});

/* ───────── 2. chave off idêntica ───────── */
describe("chave off idêntica: o /organizar de hoje, nos 2 braços do AB_LP × 2 do AB_PIX", () => {
  it.each(COMBOS)("o roteiro fixo dá exatamente a fixture gravada antes de mexer (cartão em cada estado, eventos e pixel) — AB_LP %s × AB_PIX %s", async (lp, pix) => {
    const k = `${lp}|${pix}`;
    const gravar = process.env.GRAVAR_FIXTURE_CKO === "1";
    if (!gravar) expect(existsSync(FIXTURE)).toBe(true); // sem a fixture e sem pedir pra gravar: falha (nunca grava escondido)
    const r = await roteiroHoje(lp, pix);
    if (gravar) {
      mkdirSync(resolve(__dirname, "fixtures"), { recursive: true });
      const tudo = existsSync(FIXTURE) ? fixture() : {};
      tudo[k] = r;
      writeFileSync(FIXTURE, JSON.stringify(tudo, null, 1) + "\n");
    }
    const fx = fixture();
    expect(r.estados, k).toEqual(fx[k].estados);
    expect(r.eventos, k).toEqual(fx[k].eventos);
    expect(r.pixel, k).toEqual(fx[k].pixel);
    expect(document.getElementById("cko")).toBeNull(); // a camada nem existe
  }, TETO_PAR);
  it.each([["atual", "atual"], ["v2", "b"]] as Array<[Lp, Pix]>)("com ?cko=atual (forçado) e o atributo \"atual\": o mesmo roteiro, a mesma fixture; os eventos só ganham braco_cko \"atual\" — AB_LP %s × AB_PIX %s", async (lp, pix) => {
    const fx = fixture();
    const r = await roteiroHoje(lp, pix, { cko: "atual", ckoForcado: true });
    expect(r.estados).toEqual(fx[`${lp}|${pix}`].estados);
    expect(r.eventos).toEqual(fx[`${lp}|${pix}`].eventos);
    expect(r.pixel).toEqual(fx[`${lp}|${pix}`].pixel);
    for (const e of eventos().filter((x) => x.nome.startsWith("landing_"))) expect(e).toMatchObject({ braco_cko: "atual", cko_forcado: true });
  }, TETO_PAR);
});

/* ───────── 3. o checkout novo ───────── */
describe("checkout novo (data-cko=\"v2\"): o mesmo Pix, a mesma tela do QR em diante, nos 2 braços do AB_LP × 2 do AB_PIX", () => {
  it.each(COMBOS)("o roteiro pela camada: o cartão do QR em diante, os eventos de hoje e o pixel = a fixture; a camada fecha sozinha no QR e não sobra entrada no histórico — AB_LP %s × AB_PIX %s", async (lp, pix) => {
    const fx = fixture();
    const cartao = ["qr", "conta", "qr_codigo", "ja_tem", "qr_reaberto", "qr_cookie", "presente", "conta_depois_presente", "oferta"];
    {
      const k = `${lp}|${pix}`;
      const r = await roteiroV2(lp, pix);
      for (const e of cartao) expect(semCampoDoCartao(r.estados[e]), `${k} ${e}`).toBe(semCampoDoCartao(fx[k].estados[e]));
      expect(semCampoDoCartao(r.estados.cartao_no_codigo), `${k} cartão com o código na camada`).toBe(semCampoDoCartao(fx[k].estados.oferta));
      for (const e of Object.keys(fx[k].eventos)) expect(r.eventos[e], `${k} eventos ${e}`).toEqual(fx[k].eventos[e]);
      for (const e of Object.keys(fx[k].pixel)) expect(r.pixel[e], `${k} pixel ${e}`).toEqual(fx[k].pixel[e]);
      // a camada: erro do vazio, sugestão, gerando e o código de 8 números aparecem NELA
      expect(r.camada.erro_vazio).toContain("Falta o seu e-mail pra gerar o Pix.");
      expect(r.camada.sugestao).toContain("Você quis dizer <b>maria@gmail.com</b>?");
      expect(r.camada.gerando).toContain('data-testid="landing-gerando"');
      expect(r.camada.gerando).toContain(lp === "v2" ? "Sem CPF. Leva 2 segundos." : "Sem CPF, sem cadastro. Leva 2 segundos.");
      expect(r.camada.codigo).toContain("Esse e-mail já tem conta");
      expect(r.camada.codigo).toContain("Código de 8 números");
      // os eventos novos: abriu (de onde), fechou (por quê) — e nenhum leva e-mail
      expect(r.eventosCko.A.find((e) => e.nome === "landing_cko_aberto")).toMatchObject({ de: "fixo", vez: 1, email_pre: false, aviso_vencido: false, braco_cko: "v2" });
      expect(r.eventosCko.B.find((e) => e.nome === "landing_cko_aberto")).toMatchObject({ de: "cartao" });
      expect(r.eventosCko.A.find((e) => e.nome === "landing_cko_fechado")).toMatchObject({ via: "pix", fase: "gerando", email_digitado: true });
      expect(r.eventosCko.B.find((e) => e.nome === "landing_cko_fechado")).toMatchObject({ via: "pix" });
      expect(r.eventosCko.C.find((e) => e.nome === "landing_cko_fechado")).toMatchObject({ via: "ja_tem" });
      expect(r.eventosCko.A.filter((e) => e.nome === "landing_cko_email_comecou")).toHaveLength(1);
      for (const l of Object.values(r.eventosCko)) expect(JSON.stringify(l)).not.toMatch(/@|12345678/);
    }
    expect(camadaAberta()).toBe(false);
    expect((history.state as { ckoOrg?: number } | null)?.ckoOrg).toBeUndefined();
  }, TETO_PAR);

  it("a camada: banner, e-mail, Pix copia e cola, Gerar Pix de R$ 27,90, depois, garantia, Dúvidas e CNPJ + contato — nada de Stripe, Hubla, cartão, CPF ou order bump", async () => {
    await abrirPagina({ lp: "atual", pix: "atual", cko: "v2" });
    clicar(botaoFixo("atual"));
    await esperaCamada();
    const c = document.getElementById("cko")!;
    const t = (sel: string) => (c.querySelector(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();
    expect(c.getAttribute("role")).toBe("dialog");
    expect(t(".cko-barra")).toBe("COREPagamento seguro×");
    expect(t(".cko-b-sobre")).toBe("ACESSO VITALÍCIO");
    expect(t("#cko-tit")).toBe("Um app pra vida inteira.");
    expect(t(".cko-b-preco")).toBe("R$ 27,90uma vez só"); // <b> + <span>
    expect(t(".cko-b-lojas")).toBe("App StoreGoogle Play");
    expect(c.querySelector<HTMLImageElement>(".cko-b-fone img")!.getAttribute("src")).toBe("/landing/ck-banner-home.webp");
    expect(t('label[for="cko-email"]')).toBe("Seu e-mail · é por onde você entra no CORE");
    expect(c.querySelector("#cko-email")!.getAttribute("enterkeyhint")).toBe("go");
    expect(t(".cko-pix")).toBe("Pix copia e cola. Você copia o código e paga no app do seu banco.");
    expect(t("#cko-gerar")).toBe("Gerar Pix de R$ 27,90");
    expect(t(".cko-depois")).toBe("Depois, baixe o CORE e entre com este e-mail.");
    expect(t(".cko-garantia")).toBe("Garantia de 7 dias: devolvemos 100% no Pix.");
    expect(t(".cko-duvidas > summary")).toBe("Dúvidas: é mensal? é app de verdade?");
    expect([...c.querySelectorAll("details[data-duvida]")].map((d) => d.getAttribute("data-duvida"))).toEqual(["mensal", "app", "entrar", "banco", "garantia"]);
    expect(t('details[data-duvida="banco"] p')).toBe("NATALIA DE JESUS E SILVA SANTOS LTDA. É a nossa empresa (CNPJ 55.041.112/0001-82).");
    expect(t(".cko-rodape")).toBe("CORE · CNPJ 55.041.112/0001-82contato@coreaplicativo.com.br");
    const tudo = c.textContent ?? "";
    expect(tudo).not.toMatch(/Stripe|Hubla|Cartão|cartão|CPF|parcel/i);
    expect(c.querySelectorAll('input[type="checkbox"], [data-metodo]')).toHaveLength(0); // sem order bump, sem blocos de método
    expect(CODIGO_CAMADA).not.toMatch(/Stripe|Hubla/i);
    expect(document.documentElement.hasAttribute("data-cko-aberto")).toBe(true);
    expect(document.body.style.position).toBe("fixed"); // a página trava por baixo
  });

  it("o preço sai da landing (VALOR_OFERTA → precoTxt): trocar o valor troca o banner e o botão; nenhum preço escrito no módulo", async () => {
    expect(CODIGO_CAMADA).not.toMatch(/R\$ ?\d|27,90|67,90|97,90/);
    vi.resetModules();
    document.body.innerHTML = "";
    const m = await import("@/landing/checkout-organizar");
    const ev: Array<[string, unknown]> = [];
    m.abrirCko({ de: "teste", vez: 1, ms: 0, precoTxt: "R$ 31,50", pedeEmail: false, emailInicial: "", aviso: "Esse código venceu.", nomeNoBanco: "X LTDA", cnpj: "00.000.000/0001-00", evento: (n, d) => ev.push([n, d]), aoGerar: () => {}, aoMontarForm: () => {}, aoFechar: () => {} });
    expect(document.querySelector(".cko-b-preco b")!.textContent).toBe("R$ 31,50");
    expect(document.getElementById("cko-gerar")!.textContent).toBe("Gerar Pix de R$ 31,50");
    expect(document.querySelector('[data-testid="cko-aviso"]')!.textContent).toBe("Esse código venceu.");
    expect(document.getElementById("cko-email")).toBeNull(); // braço "livre" do AB_CHECKOUT: sem campo
    expect(document.querySelector(".cko-depois")!.textContent).toBe("Depois, baixe o CORE e entre com o seu e-mail.");
    expect(ev[ev.length - 1]).toEqual(["landing_cko_aberto", { de: "teste", vez: 1, email_pre: false, aviso_vencido: true, ms: 0 }]);
    m._zerar();
  });

  it("Dúvidas: abrir a lista abre 'mensal' e 'app' já respondidas (sem contar); cada pergunta conta 1× por abertura", async () => {
    await abrirPagina({ lp: "v2", pix: "atual", cko: "v2" });
    clicar("#lp-pagar");
    await esperaCamada();
    const lista = document.querySelector<HTMLDetailsElement>(".cko-duvidas")!;
    lista.open = true;
    await dormir(30);
    expect([...lista.querySelectorAll<HTMLDetailsElement>("details[data-duvida]")].filter((d) => d.open).map((d) => d.dataset.duvida)).toEqual(["mensal", "app"]);
    const banco = lista.querySelector<HTMLDetailsElement>('details[data-duvida="banco"]')!;
    banco.open = true; await dormir(20); banco.open = false; await dormir(20); banco.open = true; await dormir(20);
    lista.open = false; await dormir(20);
    const ev = eventos().filter((e) => /^landing_cko_duvida/.test(e.nome)).map((e) => [e.nome, e.aberto ?? e.qual]);
    expect(ev).toEqual([["landing_cko_duvidas", true], ["landing_cko_duvida", "banco"], ["landing_cko_duvidas", false]]);
    expect(nomes()).not.toContain("landing_duvida_aberta"); // as Dúvidas da página têm o evento delas; as da camada, o seu
  });

  it("fechar pelo X, pelo Esc e pelo voltar do navegador: volta pra página, sem sair do site (1 entrada no histórico, nunca 2)", async () => {
    await abrirPagina({ lp: "atual", pix: "atual", cko: "v2" });
    const antes = history.length;
    clicar(botaoFixo("atual"));
    await esperaCamada();
    expect(history.length).toBe(antes + 1);
    expect((history.state as { ckoOrg?: number }).ckoOrg).toBe(1);
    digitar("cko-email", "ana@email.com");
    clicar("#cko-x");
    await esperaCamadaFechar();
    expect((history.state as { ckoOrg?: number } | null)?.ckoOrg).toBeUndefined();
    expect(document.body.style.position).toBe("");
    // reabriu: o e-mail digitado continua lá
    clicar(botaoFixo("atual"));
    await esperaCamada();
    expect((document.getElementById("cko-email") as HTMLInputElement).value).toBe("ana@email.com");
    document.getElementById("cko")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await esperaCamadaFechar();
    clicar(botaoFixo("atual"));
    await esperaCamada();
    history.back(); // o voltar do celular
    await esperaCamadaFechar();
    const fechados = eventos().filter((e) => e.nome === "landing_cko_fechado").map((e) => e.via);
    expect(fechados).toEqual(["x", "esc", "voltar"]);
    expect(eventos().filter((e) => e.nome === "landing_cko_aberto").map((e) => e.vez)).toEqual([1, 2, 3]);
    expect(nomes()).not.toContain("landing_pix_gerado");
    expect(document.getElementById("lp-card")!.getAttribute("data-fase")).toBe("oferta");
  });

  it("fechou pelo X com o Pix sendo gerado: o QR aparece no cartão (como hoje), sem 2º Pix", async () => {
    await abrirPagina({ lp: "atual", pix: "b", cko: "v2" });
    clicar(botaoFixo("atual"));
    await esperaCamada();
    digitar("cko-email", "ana@email.com");
    clicar("#cko-gerar");
    clicar("#cko-x");
    await esperaCamadaFechar();
    await espera('#lp-card [data-testid="landing-pixb"]');
    expect(nomes().filter((n) => n === "landing_pix_gerado")).toHaveLength(1);
    expect(eventos().find((e) => e.nome === "landing_cko_fechado")).toMatchObject({ via: "x", fase: "gerando" });
  });

  it("'Usar outro e-mail' no código da camada volta pro formulário com o campo limpo; 'Mandar de novo' manda o evento de hoje", async () => {
    await abrirPagina({ lp: "atual", pix: "atual", cko: "v2" });
    clicar("#lp-pagar");
    await esperaCamada();
    digitar("cko-email", "maria+existe@email.com");
    clicar("#cko-gerar");
    await espera('#cko [data-testid="landing-email-tem-conta"]');
    expect(document.getElementById("lp-card")!.getAttribute("data-fase")).toBe("oferta");
    clicar("#lp-reenviar");
    await dormir(400);
    clicar("#lp-outro-email");
    await espera("#cko #cko-email");
    expect((document.getElementById("cko-email") as HTMLInputElement).value).toBe("");
    expect(eventos().filter((e) => e.nome === "landing_cta").map((e) => e.onde)).toEqual(["pagar", "reenviar_codigo", "outro_email"]);
    // fechar no meio do código e reabrir: o código volta (o `antes` fica na memória da página)
    digitar("cko-email", "maria+existe@email.com");
    clicar("#cko-gerar");
    await espera('#cko [data-testid="landing-email-tem-conta"]');
    clicar("#cko-x");
    await esperaCamadaFechar();
    clicar("#lp-pagar");
    await espera('#cko [data-testid="landing-email-tem-conta"]');
    clicar("#cko-x"); // não deixar a camada aberta pro próximo teste
    await esperaCamadaFechar();
  });

  it("com Pix vivo, conta pronta ou \"Você já tem o CORE\", os botões fazem o de hoje (rolam até o cartão), sem abrir a camada", async () => {
    // Pix vivo
    await abrirPagina({ lp: "v2", pix: "atual", cko: "v2" });
    clicar("#lp-pagar");
    await esperaCamada();
    digitar("cko-email", "ana@email.com");
    clicar("#cko-gerar");
    await espera('#lp-card [data-testid="landing-codigo"]');
    await esperaCamadaFechar();
    const rolar = espiarRolagem();
    clicar(botaoFixo("v2"));
    clicar("#lp-cta-topo");
    await dormir(100);
    expect(camadaAberta()).toBe(false);
    expect(rolar).toHaveBeenCalled();
    // pago → conta
    simularPago();
    await espera('[data-testid="landing-conta"]');
    clicar('#fim button[data-so-lp="v2"]');
    await dormir(100);
    expect(camadaAberta()).toBe(false);
    // quem já comprou neste aparelho (o marcador) e volta outro dia: "Você já tem o CORE" e nada de camada
    localStorage.removeItem("landing-estado-v1");
    await abrirPagina({ lp: "atual", pix: "atual", cko: "v2", limpar: false });
    await espera('[data-testid="landing-ja-tem"]');
    clicar('#fim button[data-so-lp="atual"]');
    await dormir(100);
    expect(camadaAberta()).toBe(false);
    expect(eventos().filter((e) => e.nome === "landing_cko_aberto")).toHaveLength(0);
    soltarRolagem();
  });

  it("oferta \"ano\" (só por ?oferta=ano): a camada não abre; o cartão gera o Pix como hoje", async () => {
    await abrirPagina({ lp: "atual", pix: "atual", cko: "v2", oferta: "ano" });
    digitar("lp-email-antes", "ana@email.com");
    clicar(botaoFixo("atual"));
    clicar("#lp-pagar");
    await espera('[data-testid="landing-codigo"]');
    expect(document.getElementById("cko")).toBeNull();
    expect(eventos().find((e) => e.nome === "landing_pix_gerado")).toMatchObject({ oferta: "LN_ano279" });
  });

  it("o módulo da camada não carrega: o cartão volta a ser o de hoje (com o campo) e a página vai até ele; landing_erro chunk_cko", async () => {
    vi.doMock("@/landing/checkout-organizar", () => { throw new Error("chunk 404"); });
    try {
      await abrirPagina({ lp: "atual", pix: "atual", cko: "v2" });
      const rolar = espiarRolagem();
      clicar(botaoFixo("atual"));
      await vi.waitFor(() => { if (!document.documentElement.hasAttribute("data-cko-falhou")) throw new Error("ainda não"); }, { timeout: 4000 });
      expect(eventos().filter((e) => e.nome === "landing_erro").map((e) => [e.onde, e.tentativa])).toEqual([["chunk_cko", 1], ["chunk_cko", 2]]);
      expect(rolar).toHaveBeenCalled();
      soltarRolagem();
      // dali em diante o cartão é o de hoje
      digitar("lp-email-antes", "ana@email.com");
      clicar("#lp-pagar");
      await espera('[data-testid="landing-codigo"]');
      expect(camadaAberta()).toBe(false);
    } finally {
      vi.doUnmock("@/landing/checkout-organizar");
    }
  });

  it("o módulo da camada não carrega e o e-mail já tem conta: o código de 8 números aparece no cartão (1 e-mail de código, não 1 por toque)", async () => {
    vi.doMock("@/landing/checkout-organizar", () => { throw new Error("chunk 404"); });
    try {
      await abrirPagina({ lp: "atual", pix: "atual", cko: "v2" });
      clicar(botaoFixo("atual"));
      await vi.waitFor(() => { if (!document.documentElement.hasAttribute("data-cko-falhou")) throw new Error("ainda não"); }, { timeout: 4000 });
      digitar("lp-email-antes", "maria+existe@email.com");
      clicar("#lp-pagar");
      await espera('#lp-card [data-testid="landing-email-tem-conta"]');
      expect(document.getElementById("lp-card")!.getAttribute("data-fase")).toBe("codigo");
      expect(document.querySelectorAll("#lp-codigo-antes")).toHaveLength(1);
    } finally {
      vi.doUnmock("@/landing/checkout-organizar");
    }
  });

  it("fechou pelo X no \"Gerando…\" com e-mail que já tem conta: o código aparece no cartão (como hoje)", async () => {
    await abrirPagina({ lp: "atual", pix: "atual", cko: "v2" });
    clicar(botaoFixo("atual"));
    await esperaCamada();
    digitar("cko-email", "maria+existe@email.com");
    clicar("#cko-gerar");
    clicar("#cko-x");
    await esperaCamadaFechar();
    await espera('#lp-card [data-testid="landing-email-tem-conta"]');
    expect(eventos().find((e) => e.nome === "landing_cko_fechado")).toMatchObject({ via: "x", fase: "gerando" });
    expect(document.querySelectorAll("#lp-codigo-antes")).toHaveLength(1);
  });

  it("fechou pelo X no código: o código volta pro cartão; reabriu: o código fica só na camada (nunca 2 #lp-codigo-antes)", async () => {
    await abrirPagina({ lp: "v2", pix: "atual", cko: "v2" });
    clicar("#lp-pagar");
    await esperaCamada();
    digitar("cko-email", "maria+existe@email.com");
    clicar("#cko-gerar");
    await espera('#cko [data-testid="landing-email-tem-conta"]');
    expect(document.querySelectorAll("#lp-codigo-antes")).toHaveLength(1);
    clicar("#cko-x");
    await esperaCamadaFechar();
    await espera('#lp-card [data-testid="landing-email-tem-conta"]');
    expect(document.querySelectorAll("#lp-codigo-antes")).toHaveLength(1);
    clicar(botaoFixo("v2"));
    await espera('#cko [data-testid="landing-email-tem-conta"]');
    expect(document.getElementById("lp-card")!.getAttribute("data-fase")).toBe("oferta");
    expect(document.querySelectorAll("#lp-codigo-antes")).toHaveLength(1);
    // o código digitado na camada entra pelo campo DELA
    digitar("lp-codigo-antes", "12345678");
    expect((document.getElementById("lp-entrar-pagar") as HTMLButtonElement).disabled).toBe(false);
    clicar("#cko-x"); // não deixar a camada aberta pro próximo teste (o popstate dele chegaria a esta página)
    await esperaCamadaFechar();
  });

  it("ao abrir, o foco vai pro título da camada (o teclado não sobe sozinho); fechou pela pessoa, volta pro botão; fechou no QR, o foco sai", async () => {
    await abrirPagina({ lp: "atual", pix: "atual", cko: "v2" });
    const botao = document.querySelector<HTMLElement>("#lp-pagar")!;
    botao.focus();
    clicar("#lp-pagar");
    await esperaCamada();
    await vi.waitFor(() => { if (document.activeElement?.id !== "cko-tit") throw new Error(String(document.activeElement?.id)); }, { timeout: 1000 });
    expect(document.getElementById("cko-tit")!.getAttribute("tabindex")).toBe("-1");
    clicar("#cko-x");
    await esperaCamadaFechar();
    expect(document.activeElement).toBe(botao);
    botao.focus();
    clicar("#lp-pagar");
    await esperaCamada();
    const campo = document.getElementById("cko-email") as HTMLInputElement;
    campo.focus();
    digitar("cko-email", "ana@email.com");
    clicar("#cko-gerar");
    await espera('#lp-card [data-testid="landing-codigo"]');
    await esperaCamadaFechar();
    expect(document.activeElement === botao).toBe(false);
    expect(document.querySelector("#cko #cko-email")).toBeNull(); // a camada fechada não guarda tela
  });

  it("tocou no botão antes de o módulo da camada chegar: o botão fica aria-busy na hora e solta quando a camada abre", async () => {
    // o módulo demora 400 ms pra chegar (4G): o toque logo depois do load cai antes dele
    vi.doMock("@/landing/checkout-organizar", async () => { await dormir(400); return await vi.importActual<object>("@/landing/checkout-organizar"); });
    try {
      await abrirPagina({ lp: "v2", pix: "atual", cko: "v2" });
      const b = document.querySelector<HTMLElement>("#lp-cta-topo")!;
      expect(b.dataset.ir).toBe("oferta");
      expect(camadaAberta()).toBe(false);
      clicar("#lp-cta-topo");
      expect(b.getAttribute("aria-busy")).toBe("true");
      await esperaCamada();
      expect(b.hasAttribute("aria-busy")).toBe(false);
      expect(eventos().filter((e) => e.nome === "landing_cko_aberto")).toHaveLength(1);
    } finally {
      vi.doUnmock("@/landing/checkout-organizar");
    }
  });

  it("o módulo da camada pendurou (rede lenta): passados 3,5 s o botão solta, o cartão de hoje volta (com o campo) e a página vai até ele; chegando depois, a camada NÃO abre", async () => {
    // o import não falha: só demora 5 s (o carregarComRetry não tem teto — só tenta de novo quando falha)
    vi.doMock("@/landing/checkout-organizar", async () => { await dormir(5000); return await vi.importActual<object>("@/landing/checkout-organizar"); });
    try {
      await abrirPagina({ lp: "v2", pix: "atual", cko: "v2" });
      const rolar = espiarRolagem();
      const b = document.querySelector<HTMLElement>("#lp-cta-topo")!;
      clicar("#lp-cta-topo");
      expect(b.getAttribute("aria-busy")).toBe("true");
      await dormir(3000);
      expect(b.getAttribute("aria-busy")).toBe("true"); // antes do teto: ainda esperando
      expect(document.documentElement.hasAttribute("data-cko-falhou")).toBe(false);
      await vi.waitFor(() => { if (!document.documentElement.hasAttribute("data-cko-falhou")) throw new Error("ainda não"); }, { timeout: 1500, interval: 20 });
      expect(b.hasAttribute("aria-busy")).toBe(false);
      expect(eventos().filter((e) => e.nome === "landing_erro").map((e) => [e.onde, e.de])).toEqual([["chunk_cko_lento", "topo"]]);
      expect(rolar.mock.contexts.some((el) => (el as Element).id === "oferta")).toBe(true);
      // o módulo chega depois: nada abre por cima
      await dormir(2200);
      expect(camadaAberta()).toBe(false);
      expect(eventos().filter((e) => e.nome === "landing_cko_aberto")).toHaveLength(0);
      // dali em diante é o cartão de hoje: o botão fixo rola, o "Pagar" gera o Pix com o e-mail do campo
      clicar(botaoFixo("v2"));
      await dormir(30);
      expect(camadaAberta()).toBe(false);
      digitar("lp-email-antes", "ana@email.com");
      clicar("#lp-pagar");
      await espera('#lp-card [data-testid="landing-codigo"]');
      expect(camadaAberta()).toBe(false);
      expect(eventos().filter((e) => e.nome === "landing_erro")).toHaveLength(1); // o teto conta 1× só
    } finally {
      vi.doUnmock("@/landing/checkout-organizar");
    }
  }, 30_000);

  it("WebKit: a demo em tela cheia fechou sem o popstate do back() dela (a entrada da demo sobrou): a camada toma o lugar dessa entrada; o X volta pra página e a demo não reabre", async () => {
    await abrirPagina({ lp: "v2", pix: "atual", cko: "v2" });
    clicar("#lp-demo-abrir");
    await vi.waitFor(() => { if (!document.documentElement.hasAttribute("data-demo-cheia")) throw new Error("demo fechada"); }, { timeout: 2000 });
    expect(history.state).toMatchObject({ lpDemoCheia: 1 });
    const tamanho = history.length;
    const back = vi.spyOn(history, "back").mockImplementation(() => {}); // o back() da demo se perde (medido no WebKit: nenhum popstate)
    try {
      clicar("#lp2-cheia-comprar");
      await esperaCamada(); // a reserva de 700 ms da demo fecha e chama a camada
    } finally {
      back.mockRestore();
    }
    expect(document.documentElement.hasAttribute("data-demo-cheia")).toBe(false);
    expect(history.length).toBe(tamanho); // nada empilhado por cima da sobra
    const h = history.state as Record<string, unknown>;
    expect(h.ckoOrg).toBe(1);
    expect(h.lpDemoCheia).toBeUndefined(); // a marca da demo saiu: o X não cai nela
    clicar("#cko-x");
    await esperaCamadaFechar();
    await dormir(150);
    expect(document.documentElement.hasAttribute("data-demo-cheia")).toBe(false); // a demo NÃO reabriu
    const depois = history.state as Record<string, unknown> | null;
    expect(depois?.lpDemoCheia).toBeUndefined();
    expect(depois?.ckoOrg).toBeUndefined();
    expect(eventos().filter((e) => e.nome === "landing_demo_aberta")).toHaveLength(1);
  });

  it("a aba recarregou com a camada aberta (o Instagram recarrega): a marca sai do histórico e a camada não reabre", async () => {
    await abrirPagina({ lp: "atual", pix: "atual", cko: "v2" });
    clicar(botaoFixo("atual"));
    await esperaCamada();
    expect((history.state as { ckoOrg?: number }).ckoOrg).toBe(1);
    digitar("cko-email", "ana@email.com");
    await dormir(400); // o e-mail vai pra entrada do histórico (300 ms depois de digitar)
    expect(history.state).toMatchObject({ ckoOrg: 1, ckoEmail: "ana@email.com" });
    expect(typeof (history.state as { ckoY?: number }).ckoY).toBe("number");
    const rolar = espiarRolagem();
    await abrirPagina({ lp: "atual", pix: "atual", cko: "v2", limpar: false, manterHist: true }); // a recarga: a mesma entrada, com a marca
    await dormir(50);
    const h = history.state as { ckoOrg?: number; ckoY?: number; ckoEmail?: string } | null;
    expect(h?.ckoOrg).toBeUndefined();
    expect(h?.ckoY).toBeUndefined();
    expect(h?.ckoEmail).toBeUndefined();
    expect(camadaAberta()).toBe(false);
    // a página vai até o cartão (ela estava pagando) e o e-mail volta: a próxima abertura já vem preenchida
    expect(rolar.mock.contexts.some((el) => (el as Element).id === "oferta")).toBe(true);
    soltarRolagem();
    expect((document.getElementById("lp-email-antes") as HTMLInputElement).value).toBe("ana@email.com");
    clicar(botaoFixo("atual"));
    await esperaCamada();
    expect((document.getElementById("cko-email") as HTMLInputElement).value).toBe("ana@email.com");
  });

  it("v2 da página: o \"Quero organizar minha vida\" da demo em tela cheia fecha a demo e abre a camada", async () => {
    await abrirPagina({ lp: "v2", pix: "atual", cko: "v2" });
    clicar("#lp-demo-abrir");
    await vi.waitFor(() => { if (!document.documentElement.hasAttribute("data-demo-cheia")) throw new Error("demo fechada"); }, { timeout: 2000 });
    clicar("#lp2-cheia-comprar");
    await esperaCamada();
    expect(document.documentElement.hasAttribute("data-demo-cheia")).toBe(false);
    expect(eventos().find((e) => e.nome === "landing_cko_aberto")).toMatchObject({ de: "demo_tela_cheia" });
    expect(eventos().find((e) => e.nome === "landing_cta" && e.onde === "demo_tela_cheia")).toBeTruthy();
  });

  it("todo evento landing_* leva braco_cko \"v2\" + cko_forcado; o Purchase e a CAPI não mudam (ver o teste do Asaas falso)", async () => {
    await abrirPagina({ lp: "atual", pix: "atual", cko: "v2", ckoForcado: true });
    clicar(botaoFixo("atual"));
    await esperaCamada();
    digitar("cko-email", "ana@email.com");
    clicar("#cko-gerar");
    await espera('#lp-card [data-testid="landing-codigo"]');
    const l = eventos().filter((e) => e.nome.startsWith("landing_"));
    expect(l.length).toBeGreaterThan(5);
    for (const e of l) expect(e).toMatchObject({ braco_cko: "v2", cko_forcado: true });
    expect(semCko(limparEventos(eventos())).map((e) => e.nome)).toEqual(["landing_oferta_vista", "landing_email_antes_visto", "landing_cta", "landing_cta", "landing_email_antes_ok", "landing_pix_gerado", "landing_pix_copiado"]);
    expect(fbq.mock.calls.map((c) => c[1])).toEqual(["ViewContent", "InitiateCheckout"]);
  });
});
