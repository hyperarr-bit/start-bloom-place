/**
 * LANDING /organizar — BRAÇO v2 "vitrine" (30/10), o A/B "AB_LP" (braço "atual" × "v2"), LIGADO no código desde 07/11 (antes desligado).
 *
 * Por quê (lp-web/funil 30/10 + lp-analise/topo 29/10): 61% não rolam a 1ª tela (75% somem em < 3 s); a oferta ficava
 * 4,7 telas abaixo; a pergunta de área era tocada por 1%; "É um app de verdade?" é a dúvida nº 1; quem volta do banco
 * paga 81%. Aqui:
 *   1. o sorteio no <head>: chave "off" = todo mundo no "atual" (sem criar id); "on" = estável por aparelho, pelo MESMO
 *      id do AB_CHECKOUT com outra conta (independentes); forçável por ?lp=v2|atual, ?lp=auto desfaz;
 *   2. o braço "atual" é a página de hoje BYTE A BYTE: o HTML e o CSS, tirando o que é só do v2, batem com o
 *      landing.html do origin/main de 30/10 (src/test/fixtures/landing-atual-30-10.html);
 *   3. o braço v2 = v3 "produto em uso" (novidades-guardadas/2026-10-30/lp-v3/SINTESE.md): a 1ª tela com UM celular real
 *      (a Home do dia) + preço + botão; "Sim, é um app de verdade" com 3 painéis (os 16 no celular, Finanças com o card
 *      R$ 146, Rotina); a ordem dos blocos por CSS; o cartão de 8 linhas com "Vitalício"; a faixa sem "só hoje"; a tela do
 *      Pix com 3 passos + QR e código lado a lado + "Pagou? Volte aqui"; o pós-compra com os selos das lojas primeiro; a demo
 *      só no toque; o botão fixo quando o botão do topo sai da tela;
 *   4. nos DOIS braços (técnico, sem mudança visual): braco_lp em todo evento; o pixel no 1º quadro (≤ 1,5 s, sem esperar
 *      o load); a demo do atual só depois do pixel / perto da tela / no toque; a 2ª chance do chunk do Pix;
 *   5. o AB_CHECKOUT continua nos dois braços; o fluxo inteiro no v2: oferta → e-mail → Pix → pago → conta com as lojas.
 * A página roda de verdade (landing.html + landing.ts) no jsdom, com o Pix SIMULADO (fora do domínio de produção).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { bracoCheckoutDoAparelho, bracoLpDoAparelho, bracoLpDoHtml } from "@/landing/regras";
import { carregarComRetry } from "@/landing/carregar";

const raiz = resolve(__dirname, "../..");
const HTML = readFileSync(resolve(raiz, "landing.html"), "utf8");
const MAIN = readFileSync(resolve(__dirname, "fixtures/landing-atual-30-10.html"), "utf8");

/* ───────── o script do <head>, rodado num ambiente falso (com cookie) ───────── */
const scriptDaCabeca = HTML.match(/<script>\s*(\(function \(\) \{\s*var LANDING_NOVA[\s\S]*?\}\)\(\);)\s*<\/script>/)![1].replace(/var AB_PIX = "(on|off|b)"/, 'var AB_PIX = "off"'); // 03/11: o AB_PIX (ligado no código) cria o id do aparelho — aqui os sorteios antigos são testados sozinhos
const comChaves = (lp: "on" | "off", checkout: "on" | "off") =>
  scriptDaCabeca.replace(/var AB_LP = "(on|off)"/, `var AB_LP = "${lp}"`).replace(/var AB_CHECKOUT = "(on|off|email)"/, `var AB_CHECKOUT = "${checkout}"`);

function rodar(fonte: string, url: string, store: Record<string, string> = {}, cookie: { v: string } = { v: "" }) {
  const u = new URL(url, "https://www.coreaplicativo.com.br");
  const attrs: Record<string, string> = {};
  const location = { search: u.search, hash: u.hash, pathname: u.pathname, hostname: "www.coreaplicativo.com.br", protocol: "https:", replace: vi.fn() };
  const localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
  };
  const preloads: Record<string, string>[] = [];
  const document = {
    documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } },
    createElement: () => { const el: Record<string, string> = {}; (el as unknown as { setAttribute: (k: string, v: string) => void }).setAttribute = (k, v) => { el[k] = v; }; return el; },
    head: { appendChild: (el: Record<string, string>) => { preloads.push(el); } },
    get cookie() { return cookie.v; },
    set cookie(c: string) { const [par] = c.split(";"); cookie.v = par; },
  } as unknown as { cookie: string };
  const window: Record<string, unknown> = { localStorage, crypto: { randomUUID: () => randomUUID() } };
  new Function("location", "document", "window", "localStorage", "URLSearchParams", "Math", "fetch", "sessionStorage", fonte)(
    location, document, window, localStorage, URLSearchParams, Math, undefined, { getItem: () => null },
  );
  return { attrs, store, cookie, preloads, mem: window.__landing as Record<string, unknown> };
}

describe("o sorteio da página (AB_LP, head do landing.html)", () => {
  it("10/11 desligado no código (dono); o rollback \"off\" põe todo mundo no braço atual, sem criar id de aparelho quando o checkout também está off", () => {
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
// 04/11: + as regras da /vida (data-checkout-ext / data-so-ext / data-hm-*) — só casam com atributos que o /organizar nunca tem
const soV2 = /data-lp="v2"|data-so-lp|\.lp2-|BRAÇO v2|data-checkout-ext|data-so-ext|data-hm-|data-oem|\.lp-email-oferta|data-otp|\.lp-topo-fo/; // 11/11: + o painel do topo da /oferta (data-otp / .lp-topo-foto / .lp-topo-fone) — só aparece com html[data-otp="anuncio"]

describe("braço atual = a página de hoje (origin/main 30/10), sem tirar nem pôr", () => {
  it("o HTML do corpo, tirando o que é só do v2 (e o atributo data-so-lp), é IGUAL ao de hoje", () => {
    const novo = document.createElement("div");
    novo.innerHTML = corpoDe(HTML);
    // 06/11 (A/B da /oferta): o template da página nova e o script dele só agem com html[data-lpo="nova"]; o resto do corpo não muda
    const tplNova = novo.querySelector("#lpo-nova")!; tplNova.nextElementSibling!.remove(); tplNova.remove();
    // 11/11 (/simples): idem — o template da LP de uma tela e o script dele só agem com html[data-uma]
    const tplUma = novo.querySelector("#lp-uma")!; tplUma.nextElementSibling!.remove(); tplUma.remove();
    novo.querySelectorAll('[data-so-lp="v2"]').forEach((el) => el.remove());
    novo.querySelectorAll("[data-so-lp]").forEach((el) => el.removeAttribute("data-so-lp"));
    // 04/11 (A/B da /vida): o que é só da Hotmart nunca aparece no /organizar (sem html[data-checkout-ext]); o atributo data-so-ext sai
    novo.querySelectorAll('[data-so-ext="hotmart"]').forEach((el) => el.remove());
    novo.querySelectorAll("[data-so-ext]").forEach((el) => el.removeAttribute("data-so-ext"));
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
    for (const l of doV2.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.trim()).filter((l) => l && l !== "}" && !l.startsWith("@media"))) expect(l).toMatch(soV2);
  });
  it("o CSS do v2 esconde o que é do atual, e o atual (ou sem atributo) esconde o que é do v2", () => {
    expect(HTML).toContain('html:not([data-lp="v2"]) [data-so-lp="v2"], html[data-lp="v2"] [data-so-lp="atual"] { display: none !important; }');
  });
  it("as chaves de hoje seguem como no origin/main (AB_CHECKOUT on; título/oferta off)", () => {
    expect(HTML).toMatch(/var AB_CHECKOUT = "email";/); // 31/10 noite (dono: "fixa sobe"): o A/B do checkout acabou, todo mundo no e-mail
    for (const k of ["AB_TITULO", "AB_OFERTA", "LANDING_NOVA"]) {
      const re = new RegExp(`var ${k} = "(on|off)"`);
      expect(HTML.match(re)![1]).toBe(MAIN.match(re)![1]);
    }
  });
});

/* ───────── 3. o que o v2 (= v3 "produto em uso", SINTESE.md) tem ───────── */
const txt = (el: Element | null) => (el?.innerHTML ?? "").replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
describe("braço v2 · a 1ª tela: uma frase, UM celular real, um preço, um botão", () => {
  // 04/11: o v2 do /organizar (e da /vida com a chave off) = sem os elementos do braço Hotmart da /vida (landing-hotmart.test.ts)
  const html = () => { const d = document.createElement("div"); d.innerHTML = corpoDe(HTML); d.querySelectorAll('[data-so-ext="hotmart"]').forEach((el) => el.remove()); return d; };
  it("#topo-v2: faixa com CORE, título (a = dor nº 1; b = a legenda do anúncio, por ?t=b), 1 celular com a Home, lojas em texto, preço vitalício, botão, miúda — 7 elementos", () => {
    const d = html();
    const topo = d.querySelector("#topo-v2")!;
    expect(topo.getAttribute("data-so-lp")).toBe("v2");
    expect(txt(topo.querySelector("h1.lp2-h1-a"))).toBe("Sua vida organizada num app só.");
    expect(txt(topo.querySelector("h1.lp2-h1-b"))).toBe("16 áreas da vida. Em um só app.");
    expect(HTML).toContain('html[data-lp="v2"][data-t="b"] .lp2-h1-a, html[data-lp="v2"]:not([data-t="b"]) .lp2-h1-b { display: none; }');
    // UM celular, em proporção real (só a largura é fixa; o print nunca é esticado), com a Home do dia em @3x (≥ 3× dos 219 px CSS de tela)
    const fones = topo.querySelectorAll(".lp2-fone");
    expect(fones).toHaveLength(1);
    const img = fones[0].querySelector("img")!;
    // r2 (técnico 9.1): sem src no HTML — o script inline do #topo-v2 põe o src SÓ no v2 (o preload do <head> é consumido: 1 pedido, 0 avisos no WebKit)
    expect(img.hasAttribute("src")).toBe(false);
    expect(img.getAttribute("data-src")).toBe("/landing/v3-home.webp");
    expect(img.hasAttribute("loading")).toBe(false);
    expect(Number(img.getAttribute("width"))).toBeGreaterThanOrEqual(657);
    expect(img.getAttribute("alt")).toMatch(/Home do CORE/);
    expect(existsSync(resolve(raiz, "public/landing/v3-home.webp"))).toBe(true);
    expect(HTML).toMatch(/\.lp2-hero-cel \.lp2-fone \{ --w: 232px; padding-bottom: 0; border-bottom-left-radius: 0; border-bottom-right-radius: 0; \}/); // 30/10 noite (dono): o celular segue reto pra baixo do painel
    expect(HTML).toMatch(/\.lp2-fone img \{ display: block; width: 100%; height: auto; \}/);
    expect(HTML).toMatch(/\.lp2-fone \{[^}]*border-radius: calc\(var\(--w\) \* \.14\)/); // moldura proporcional à largura
    // sem grade solta, sem card solto, sem sub, sem pílulas, sem vídeo, sem pergunta, sem âncora de preço (o "sem sentido" da v2)
    expect(topo.querySelector(".lp2-grade, .lp2-card, .lp-sub, .lp-pergunta, .lp-area, video, iframe")).toBeNull();
    expect(topo.textContent).not.toMatch(/97,90|App Store: R\$/);
    // r2 (primeira-tela 4 / técnico 9.4): a linha das lojas é um <button> de verdade (teclado, leitor de tela), não um <ul> com cursor
    const ondeBtn = topo.querySelector(".lp2-onde")!;
    expect(ondeBtn.tagName).toBe("BUTTON");
    expect(ondeBtn.getAttribute("type")).toBe("button");
    expect(ondeBtn.getAttribute("aria-label")).toMatch(/ver as telas do app/i);
    const onde = [...topo.querySelectorAll(".lp2-onde span")];
    expect(onde.map((l) => l.textContent)).toEqual(["App Store", "Google Play", "Computador"]);
    expect(new Set(onde.map((l) => l.querySelector("svg")!.innerHTML)).size).toBe(3);
    expect(topo.querySelector("a")).toBeNull(); // nenhum link pra fora antes do preço
    expect(txt(topo.querySelector(".lp2-preco")).replace("&nbsp;", " ")).toMatch(/^R\$ 27,90 ?Vitalício ?Pagamento único no Pix$/);
    const cta = topo.querySelector("#lp-cta-topo")!;
    expect(cta.getAttribute("data-ir")).toBe("oferta");
    expect(txt(cta)).toBe("Quero organizar minha vida");
    expect(HTML).toMatch(/\.lp2-topo \.lp-cta \{[^}]*white-space: nowrap/);
    expect(topo.querySelector(".lp2-miuda")!.textContent).toBe("Nada é cobrado depois · 7 dias de garantia"); // r1: "Paga 1 vez" já está em "Pagamento único no Pix" 60 px acima
    expect(topo.querySelector(".lp2-onde")!.getAttribute("data-ir")).toBe("dentro-v2"); // r1: a linha das lojas rola até "Sim, é um app de verdade"
    expect(HTML).toContain('.lp2-onde span:not(:last-child)::after { content: "·"'); // o separador no item anterior (nunca órfão no começo da 2ª linha)
    // r2 (primeira-tela 1): sem nowrap na legenda do preço (com +30% vazava pela borda e a página ganhava rolagem horizontal); min-width 0 deixa quebrar
    expect(HTML).not.toMatch(/\.lp2-preco-txt span \{[^}]*white-space: nowrap/);
    expect(HTML).toMatch(/\.lp2-preco-txt \{[^}]*min-width: 0/);
    const elementos = [topo.querySelector("h1.lp2-h1-a"), topo.querySelector(".lp2-fone"), topo.querySelector(".lp2-onde"), topo.querySelector(".lp2-preco"), cta, topo.querySelector(".lp2-miuda")];
    expect(elementos.every(Boolean)).toBe(true); // + a faixa = 7
  });
  it("a faixa do v2 é a MESMA do ar (dono 30/10 noite: '🔥 ACESSO VITALÍCIO · só hoje, DD/MM'); a barra de marca some no v2; a do atual continua com a data", () => {
    const d = html();
    const faixas = [...d.querySelectorAll(".lp-promo")];
    const v2 = faixas.find((f) => f.getAttribute("data-so-lp") === "v2")!;
    const atual = faixas.find((f) => f.getAttribute("data-so-lp") === "atual")!;
    expect(v2.querySelector("b")!.textContent).toBe("🔥 ACESSO VITALÍCIO");
    expect(v2.querySelector("span")!.textContent).toBe("· só hoje");
    expect(v2.querySelector("#lp2-promo-data")).not.toBeNull();
    expect(HTML).toContain('html[data-lp="v2"] .lp-promo { order: -2; }');
    expect(atual.querySelector("#lp-promo-data")).not.toBeNull();
    expect(HTML).toContain('html[data-lp="v2"] .lp-barra { display: none; }');
  });
});

describe("braço v2 · 'Sim, é um app de verdade': 3 painéis empilhados no estilo das fotos de loja", () => {
  // 04/11: o v2 do /organizar (e da /vida com a chave off) = sem os elementos do braço Hotmart da /vida (landing-hotmart.test.ts)
  const html = () => { const d = document.createElement("div"); d.innerHTML = corpoDe(HTML); d.querySelectorAll('[data-so-ext="hotmart"]').forEach((el) => el.remove()); return d; };
  it("os 16 DENTRO do celular em 1º (a imagem do anúncio, a 1 rolagem da dobra), depois Finanças com o card R$ 146 ampliado e a legenda que explica o número, depois Rotina; nunca fita", () => {
    const d = html();
    const sec = d.querySelector("#dentro-v2")!;
    expect(sec.getAttribute("data-so-lp")).toBe("v2");
    expect(sec.querySelector("h2")!.textContent).toBe("Sim, é um app de verdade.");
    expect(sec.querySelector(".lp-p")!.textContent).toBe("Telas reais do app, com dados de exemplo.");
    const fotos = [...sec.querySelectorAll(".lp2-foto")];
    expect(fotos.map((f) => f.className)).toEqual(["lp2-foto magenta", "lp2-foto ambar", "lp2-foto verde"]);
    expect(fotos.map((f) => txt(f.querySelector("h3")))).toEqual(["16 áreas da vida em um só app.", "Saiba quanto pode gastar hoje.", "Seus hábitos, dia após dia."]);
    expect(fotos.map((f) => f.querySelector("figcaption p")!.textContent)).toEqual([
      "Use as que quiser e esconda o resto.",
      "Anote o que entra e o que sai. O resto o CORE calcula.", // r1: "quanto pode gastar hoje" ficava 3× em 120 px
      "Marque o que fez e veja a sequência crescer.",
    ]);
    const imgs = fotos.map((f) => f.querySelector(".lp2-fone-tela img")!);
    expect(imgs.map((i) => i.getAttribute("data-src"))).toEqual(["/landing/v3-modulos.webp", "/landing/v3-financas.webp", "/landing/v3-rotina.webp"]);
    for (const i of imgs) { expect(Number(i.getAttribute("width"))).toBeGreaterThanOrEqual(850); expect(i.getAttribute("alt")).toBeTruthy(); } // 3× dos 283 px CSS de tela
    const zoom = fotos[1].querySelector(".lp2-zoom img")!;
    expect(zoom.getAttribute("data-src")).toBe("/landing/v3-posso-gastar.webp");
    expect(Number(zoom.getAttribute("width"))).toBeGreaterThanOrEqual(1026); // 3× dos 342 px CSS da figura (escala 1,0: título do card ≈ 13 px)
    expect(zoom.getAttribute("alt")).toMatch(/R\$ 146/);
    expect(HTML).toMatch(/\.lp2-zoom \{[^}]*width: 342px/);
    // r1 (prova-e-meio 1.1): o painel da Rotina mostra a faixa "41 dias seguidos" (o que a legenda promete) como zoom por cima da tabela
    const zoomVerde = fotos[2].querySelector(".lp2-zoom img")!;
    expect(zoomVerde.getAttribute("data-src")).toBe("/landing/v3-sequencia.webp");
    expect(zoomVerde.getAttribute("alt")).toMatch(/41 dias seguidos/);
    expect(Number(zoomVerde.getAttribute("width"))).toBeGreaterThanOrEqual(1026);
    expect(fotos[0].querySelector(".lp2-zoom")).toBeNull();
    // r2 (prova-e-meio MÉDIA 1.1): o painel não tem altura fixa; o corte do print é no celular (max-height da tela em --w) e o zoom é FILHO do
    // celular (top em --w) — com a fonte do sistema a +15/+30% a legenda cresce, o celular desce e o zoom acompanha o card
    expect(fotos[1].querySelector(".lp2-fone > .lp2-zoom")).not.toBeNull();
    expect(fotos[2].querySelector(".lp2-fone > .lp2-zoom")).not.toBeNull();
    expect(HTML).not.toMatch(/\.lp2-foto(\.\w+)? \{[^}]*height: \d+px/);
    // r3 (oferta M1 / pix M1 / visitante-frio M1): height, não max-height — no WebKit um <img> sem src não reserva altura; o painel nasce no tamanho final
    expect(HTML).toMatch(/\.lp2-foto \.lp2-fone-tela \{ height: calc\(var\(--w\) \* var\(--corte\)\)/);
    expect(HTML).not.toMatch(/\.lp2-foto \.lp2-fone-tela \{ max-height/);
    for (const [f, ar] of [["v3-modulos", "900/1045"], ["v3-financas", "900/993"], ["v3-rotina", "900/1269"], ["v3-posso-gastar", "1026/280"], ["v3-sequencia", "1050/252"]]) expect(d.querySelector(`img[data-src="/landing/${f}.webp"]`)!.getAttribute("style")).toBe(`aspect-ratio:${ar}`);
    expect(HTML).toMatch(/\.lp2-zoom \{ position: absolute; top: calc\(var\(--w\) \* var\(--zoom-y\)\)/);
    for (const c of ["magenta", "ambar", "verde"]) expect(HTML).toMatch(new RegExp(`\\.lp2-foto\\.${c} \\{ --corte: [\\d.]+;`));
    expect(HTML).toMatch(/\.lp2-foto\.ambar \{[^}]*--zoom-y: [\d.]+;/);
    expect(HTML).toMatch(/\.lp2-foto\.verde \{[^}]*--zoom-y: [\d.]+;/);
    for (const f of ["v3-modulos", "v3-financas", "v3-rotina", "v3-posso-gastar", "v3-sequencia"]) expect(existsSync(resolve(raiz, `public/landing/${f}.webp`))).toBe(true);
    expect(sec.querySelector(".lp2-fita, .lp2-tel")).toBeNull();
    expect(HTML).not.toMatch(/overflow-x: auto;[^}]*scroll-snap-type: x/);
    expect(HTML).toMatch(/\.lp2-fone \{ --w: 300px/); // ≥ 70% dos 390
  });
  it("a ordem dos blocos por CSS: 1ª tela → por dentro → oferta → avaliações → como → dúvidas → demo; os blocos de hoje (os 16 em HTML, antes/depois, avaliações, como, dúvidas) ficam só no atual", () => {
    const ordem = (id: string) => Number(HTML.match(new RegExp(`html\\[data-lp="v2"\\] #${id} \\{ order: (-?\\d+)`))![1]);
    const seq = ["topo-v2", "dentro-v2", "oferta", "avaliacoes-v2", "como-v2", "duvidas-v2", "demo"].map(ordem);
    expect([...seq].sort((a, b) => a - b)).toEqual(seq);
    expect(HTML).toMatch(/html\[data-lp="v2"\] main\.lp \{ display: flex; flex-direction: column; \}/);
    const d = html();
    for (const id of ["modulos", "antes", "avaliacoes", "como", "duvidas"]) expect(d.querySelector(`#${id}`)!.getAttribute("data-so-lp")).toBe("atual");
    for (const id of ["avaliacoes-v2", "como-v2", "duvidas-v2"]) expect(d.querySelector(`#${id}`)!.getAttribute("data-so-lp")).toBe("v2");
  });
});

describe("braço v2 · cartão, avaliações, como funciona, dúvidas, demo, fim e barra fixa", () => {
  // 04/11: o v2 do /organizar (e da /vida com a chave off) = sem os elementos do braço Hotmart da /vida (landing-hotmart.test.ts)
  const html = () => { const d = document.createElement("div"); d.innerHTML = corpoDe(HTML); d.querySelectorAll('[data-so-ext="hotmart"]').forEach((el) => el.remove()); return d; };
  it("o cartão: 8 linhas, 1 fato por linha — 'Vitalício por R$ 27,90', 'Pagamento único no Pix. Nada é cobrado depois.' 1x, 2 checks (app de verdade com a mesma conta · 7 dias), e-mail do AB_CHECKOUT, botão, CNPJ; sem âncora, sem linha repetida embaixo do botão", () => {
    const card = html().querySelector("#lp-card")!;
    card.querySelectorAll('[data-so-lp="atual"], [data-so-oferta="ano"]').forEach((el) => el.remove());
    const t = card.textContent!.replace(/\s+/g, " ");
    expect(t).toContain("CORE · as 16 áreas da vida"); // r2 (oferta 2): a faixa diz o que o cartão não diz (o "16" do anúncio); "Acesso vitalício" repetia o "Vitalício por" 3 linhas abaixo
    expect(t).not.toContain("Acesso vitalício");
    expect((t.match(/vitalício/gi) ?? []).length).toBe(1);
    expect(t).not.toContain("sem renovação"); // r1: 5 jeitos de dizer "não renova" em 6 linhas
    expect(t).toContain("CORE · CNPJ 55.041.112/0001-82"); // r2 (oferta 3): 1 linha (o "O Pix sai aqui mesmo" já está no botão)
    expect(t).not.toContain("O Pix sai aqui mesmo");
    expect(card.querySelector('.lp-seguro[data-so-lp="v2"]')).not.toBeNull();
    expect(t).toContain("Vitalício por R$ 27,90");
    expect(t).toContain("Pagamento único. Nada é cobrado depois."); // r3 (oferta B1): cabe em 1 linha em 390 (sem "depois." sozinho); "no Pix" está no botão, 3 linhas abaixo
    const checks = [...card.querySelectorAll(".lp-checks li")].map((l) => l.textContent!.replace(/\s+/g, " ").trim());
    expect(checks).toEqual(["App de verdade: App Store, Google Play e computador, com a mesma conta.", "7 dias de garantia. Não gostou? Devolvemos 100%."]); // r1: sem o 📱 (o ✓ já é o marcador)
    expect(card.querySelector("#lp-pagar + #lp-pagar-erro")).not.toBeNull(); // r1: o erro de gerar o Pix colado no botão (só v2)
    expect(card.querySelector("#lp-pagar-erro")!.getAttribute("data-so-lp")).toBe("v2");
    expect(HTML).toMatch(/html\[data-lp="v2"\] \.lp-seguro \{[^}]*font-size: 12px/);
    expect(t).not.toMatch(/97,90|só hoje|De R\$|Aqui:|Paga 1 vez/i);
    expect(card.querySelector(".lp-ancora, .lp2-confianca")).toBeNull();
    expect((t.match(/pagamento único/gi) ?? []).length).toBe(1);
    expect((t.match(/7 dias/gi) ?? []).length).toBe(1);
    expect((t.match(/cobrado depois/gi) ?? []).length).toBe(1);
    expect(card.querySelector(".lp-email-antes")!.getAttribute("data-so-checkout")).toBe("email");
    expect(card.querySelector("#lp-pagar-txt")!.textContent).toBe("Pagar R$ 27,90 no Pix");
    expect(html().querySelector("#oferta .lp-garantia")!.getAttribute("data-so-lp")).toBe("atual");
  });
  it("avaliações do v2 (30/10 noite, dono: 'faz as 2'; r1 31/10: App Store primeiro): 4 textos reais das lojas, 'Muito bom…' em 1º; cada uma com ★★★★★ e 'apelido · loja · mês/ano' — o apelido EXATO da loja; os 2 do Google Play com o nome que o dono conferiu na Play (31/10: Sabrina Feitosa, Elisa Medeiros); sem nota média nem quantidade", () => {
    const d = html();
    const deHoje = [...d.querySelectorAll("#avaliacoes blockquote")].map((b) => b.textContent);
    const doV2 = [...d.querySelectorAll("#avaliacoes-v2 .lp-aval")];
    expect(doV2).toHaveLength(4);
    expect(doV2[0].querySelector("blockquote")!.textContent).toBe("“Muito bom pra quem quer se organizar em todas as áreas da vida.”");
    const linhas = doV2.map((a) => ({
      texto: a.querySelector("blockquote")!.textContent,
      estrelas: a.querySelector(".lp2-estrelas")!.textContent,
      rotulo: a.querySelector(".lp2-estrelas")!.getAttribute("aria-label"),
      nome: a.querySelector(".lp2-aval-nome")!.getAttribute("data-nome"),
      legenda: a.querySelector("figcaption")!.textContent,
      icone: a.querySelector("figcaption svg path")!.getAttribute("d")!.slice(0, 6),
    }));
    for (const l of linhas) { expect(deHoje).toContain(l.texto); expect(l.estrelas).toBe("★★★★★"); expect(l.rotulo).toBe("5 de 5 estrelas"); }
    // r1 (persona 6): o apelido é TEXTO da página, já no HTML (sem JS também aparece)
    expect(linhas.map((l) => [l.nome, l.legenda])).toEqual([
      ["camvbs", "camvbs ·App Store · out/2026"],
      ["ywonvu", "ywonvu ·App Store · set/2026"],
      ["Sabrina Feitosa", "Sabrina Feitosa ·Google Play · set/2026"],
      ["Elisa Medeiros", "Elisa Medeiros ·Google Play · ago/2026"],
    ]);
    expect(linhas.map((l) => l.icone)).toEqual(["M16.4 ", "M16.4 ", "M3.6 2", "M3.6 2"]); // o ícone da loja certa (Apple × Play)
    // r1 (persona 5): sem negrito preto no apelido (o mesmo peso e cor da loja); vazio = some (fica só "Google Play · set/2026")
    expect(HTML).not.toMatch(/\.lp2-aval-nome::after/);
    expect(HTML).toContain('.lp2-aval-nome[data-nome=""] { display: none; }');
    expect(d.querySelector("#avaliacoes-v2")!.textContent).not.toMatch(/\d[,.]\d|\d+ avaliações/);
  });
  it("como funciona (v2): 3 passos — Pix aqui na página · entre com o e-mail da compra (vale nos 2 braços do checkout; lojas em texto, sem link) · comece pelo dinheiro", () => {
    const d = html();
    const passos = [...d.querySelectorAll("#como-v2 .lp-passo > b")].map((b) => b.textContent);
    expect(passos).toEqual(["Pague no Pix, aqui na página.", "Entre no CORE com o seu e‑mail.", "Comece pelo dinheiro."]); // r3 (visitante-frio 5): no braço livre ela ainda não deu e-mail nenhum quando lê isso; hífen que não quebra (a +15% em 360 virava "e-/mail")
    expect(d.querySelector("#como-v2")!.textContent).toContain("Em 5 minutos você já vê quanto pode gastar hoje.");
    expect(d.querySelector("#como-v2")!.textContent).not.toContain("Anote o que entra"); // r2 (prova-e-meio 1.5): já é a legenda do painel de Finanças
    expect(d.querySelector("#como-v2 a")).toBeNull();
    expect([...d.querySelectorAll("#como-v2 .lp2-disp span")].map((s) => s.textContent)).toEqual(["App Store", "Google Play", "Computador"]);
  });
  it("dúvidas (v2): as 5 reais na ordem da dor; 'Renova sozinho? Tem mensalidade?'; computador 'igual ao celular'; contato@ (nunca suporte@)", () => {
    const d = html();
    expect([...d.querySelectorAll("#duvidas-v2 summary")].map((s) => s.textContent)).toEqual(["É um app de verdade?", "Renova sozinho? Tem mensalidade?", "Tem versão grátis?", "Funciona no computador?", "Como falo com vocês?"]);
    const t = d.querySelector("#duvidas-v2")!.textContent!;
    expect(t).toContain("igual ao celular");
    expect(t).toContain("contato@coreaplicativo.com.br");
    expect(t).not.toMatch(/suporte@|conecta (no|com o) banco/);
    // r1: "Tem versão grátis?" diz PRA QUAL e-mail (quem abre essa dúvida está medindo o risco de pedir o dinheiro de volta)
    expect(d.querySelectorAll('#duvidas-v2 a[href="mailto:contato@coreaplicativo.com.br"]')).toHaveLength(1); // "Como falo com vocês?"
    // r3 (oferta B2): "Tem versão grátis?" aponta a demonstração 1 tela abaixo (botão em texto que rola até #demo); sem "grátis" na resposta
    const gratis = [...d.querySelectorAll("#duvidas-v2 details")].find((x) => x.querySelector("summary")!.textContent === "Tem versão grátis?")!;
    expect(gratis.querySelector("p")!.textContent).toBe("Não, mas dá pra mexer na demonstração logo abaixo, e você tem 7 dias de garantia: se não gostar, devolvemos 100% no Pix.");
    expect(gratis.querySelector('button.lp2-link[data-ir="demo"]')!.textContent).toBe("demonstração logo abaixo");
  });
  it("a demo no v2 (30/10 noite, dono: 'a proporção ficou estranha'): na página um cartão no estilo do 'Por dentro' (celular em proporção real, corte reto) + 'Testar o app aqui' + pílulas; o iframe só tem src no toque; o .lp-celular vira a camada de TELA CHEIA (fixa, 100dvh, voltar em cima, preço + botão embaixo)", () => {
    const d = html();
    const cartao = d.querySelector("#lp2-demo-cartao")!;
    expect(cartao.getAttribute("data-so-lp")).toBe("v2");
    expect(cartao.classList.contains("lp2-foto")).toBe(true);
    const img = cartao.querySelector(".lp2-fone .lp2-fone-tela img")!;
    expect(img.getAttribute("data-src")).toBe("/landing/v3-home.webp"); // a da 1ª tela: 0 bytes a mais
    expect(img.getAttribute("style")).toBe("aspect-ratio:720/1070"); // proporção real (nunca esticado)
    expect(HTML).toMatch(/\.lp2-foto \.lp2-fone \{[^}]*border-bottom-left-radius: 0; border-bottom-right-radius: 0; \}/); // o corte reto dos painéis
    const botao = d.querySelector("#lp-demo-abrir")!;
    expect(botao.getAttribute("data-so-lp")).toBe("v2");
    expect(botao.closest("#lp-celular")).toBeNull(); // fora da camada (na página)
    expect(txt(botao)).toBe("Testar Finanças aqui"); // r2 (persona 5): o cartão é a Home e o toque abre Finanças — o botão diz onde abre
    expect([...d.querySelectorAll("#demo .lp-pilula[data-m]")].map((b) => b.getAttribute("data-m"))).toEqual(["financas", "rotina", "treino", "dieta", "saude"]); // o HTML é do atual também
    // r2 (persona 4/5): no v2 ficam só Rotina e Treino (Finanças = o botão; Dieta cortada e Saúde fora da tela, sem recorte do cabeçalho)
    expect(HTML).toContain('html[data-lp="v2"] .lp-pilula[data-m="financas"], html[data-lp="v2"] .lp-pilula[data-m="dieta"], html[data-lp="v2"] .lp-pilula[data-m="saude"] { display: none; }');
    expect(d.querySelector("#lp-demo-frame")!.getAttribute("src")).toBeNull();
    // a camada: o próprio .lp-celular (o iframe nunca muda de lugar no DOM — mover recarrega)
    expect(HTML).toContain('html[data-lp="v2"] .lp-celular { position: fixed; z-index: 200; top: 0; left: 0; right: 0; width: 100%; height: 100vh; height: 100dvh;');
    expect(HTML).toContain('html[data-lp="v2"][data-demo-cheia] .lp-celular { visibility: visible; transform: none;');
    expect(d.querySelector("#lp-celular .lp2-cheia-topo #lp2-cheia-voltar")).not.toBeNull();
    expect(txt(d.querySelector("#lp2-cheia-voltar"))).toBe("Voltar");
    expect(txt(d.querySelector("#lp-celular .lp2-cheia-onde"))).toBe("Demonstração · Finanças");
    expect(txt(d.querySelector("#lp-celular .lp2-cheia-baixo"))).toBe("R$ 27,90Vitalício · PixQuero organizar minha vida");
    expect(HTML).toMatch(/\.lp2-cheia-topo \{[^}]*padding: env\(safe-area-inset-top\)/);
    expect(HTML).toMatch(/\.lp2-cheia-baixo \{[^}]*calc\(10px \+ env\(safe-area-inset-bottom\)\)/);
    expect([...d.querySelectorAll('#demo [data-so-lp="v2"]')].map((e) => e.textContent)).toContain("Quer mexer antes de pagar?");
  });
  it("um verbo só no v2 — topo, fixo (com o preço ao lado, numa linha) e fim dizem 'Quero organizar minha vida'; o atual segue 'Quero organizar tudo'", () => {
    const d = html();
    const v2 = (sel: string) => [...d.querySelectorAll(sel)].find((b) => b.getAttribute("data-so-lp") === "v2")!;
    const atual = (sel: string) => [...d.querySelectorAll(sel)].find((b) => b.getAttribute("data-so-lp") === "atual")!.textContent!.replace(/\s+/g, " ").trim();
    expect(txt(v2("#lp-fixo button"))).toBe("Quero organizar minha vida");
    expect(txt(v2("#lp-fixo .lp2-fixo-p"))).toMatch(/^R\$ 27,90 ?Vitalício · Pix$/);
    expect(HTML).toContain("@media (max-width: 374px) { .lp2-topo .lp-h1 { font-size: 27px; } .lp2-fixo-p i { display: none; }"); // r1: em 360 some só o "· Pix", "Vitalício" fica
    expect(txt(v2("#fim button"))).toBe("Quero organizar minha vida");
    expect(txt(v2("#fim h2"))).toBe("Sua vida organizada num app só.");
    expect(txt(v2("#fim p"))).toBe("Vitalício por R$ 27,90 · Pix na hora");
    // r2 (oferta 1): sem nowrap no botão fixo (com +30% cortava "Quero organizar minha vic" e dava rolagem horizontal no Chromium); min-width 0 + a barra com overflow hidden
    expect(HTML).not.toMatch(/html\[data-lp="v2"\] \.lp-fixo \.lp-cta \{[^}]*white-space: nowrap/);
    expect(HTML).toMatch(/html\[data-lp="v2"\] \.lp-fixo \.lp-cta \{[^}]*min-width: 0/);
    expect(HTML).toMatch(/html\[data-lp="v2"\] \.lp-fixo \{[^}]*overflow: hidden/);
    expect(atual("#lp-fixo button")).toBe("Quero organizar tudo · R$ 27,90");
    expect(atual("#fim button")).toBe("Quero organizar tudo");
  });
  it("sem link clicável pra loja antes do preço (regra do dono 28/10): os selos só no pós-compra", () => {
    const d = html();
    d.querySelectorAll("#lp-pix").forEach((el) => el.remove());
    expect(d.querySelectorAll('a[href*="apps.apple.com"], a[href*="play.google.com"]')).toHaveLength(0);
  });
  it("toda imagem do v3 mora dentro de [data-so-lp=v2] SEM src no HTML (data-src: o atual nunca a pede); a da 1ª tela ganha src + prioridade alta por um script inline SÓ no v2; as do 'Por dentro' são lazy + fetchpriority=low e só ganham src depois do celular da 1ª tela (r2 técnico 9.1/9.2)", () => {
    const d = html();
    expect(d.querySelector('img[src*="/landing/v3-"]')).toBeNull();
    const imgs = [...d.querySelectorAll('img[data-src*="/landing/v3-"]')];
    expect(imgs).toHaveLength(7); // 30/10 noite: + a Home no cartão da demo (a mesma URL da 1ª tela: 0 bytes a mais)
    for (const i of imgs) { expect(i.closest('[data-so-lp="v2"]')).not.toBeNull(); expect(i.hasAttribute("src")).toBe(false); }
    const home = d.querySelector("#lp2-fone-home img")!;
    expect(home.hasAttribute("fetchpriority")).toBe(false);
    expect(home.hasAttribute("loading")).toBe(false); // r2: o par preload + lazy→eager fazia o WebKit pedir 2× e avisar
    const script = d.querySelector("#topo-v2 script")!;
    expect(script.textContent).toMatch(/getAttribute\("data-lp"\) === "v2"[\s\S]*fetchPriority = "high"; fh\.src = fh\.getAttribute\("data-src"\)/);
    expect(script.textContent).toMatch(/img\[data-src\]:not\(\[src\]\)/); // as outras ganham src depois do herói carregado + HTML lido (teto 3 s)
    expect(script.textContent).toMatch(/setTimeout\(solta, 3000\)/);
    // r3 (técnico 9.2): os 2 zooms (11 + 10 KB) sem lazy — o script inline já segura o src até o herói chegar; assim o painel chega inteiro
    for (const i of imgs.filter((x) => x !== home)) { expect(i.getAttribute("fetchpriority")).toBe("low"); expect(i.getAttribute("loading")).toBe(i.closest(".lp2-zoom") ? null : "lazy"); }
    // r1 (7.3): no v2 o fundo do "Testar o app" é o print de Finanças já baixado (escala 0,94), trocado no parse; o atual segue com o de hoje
    const demoScript = d.querySelector("#lp-celular script")!;
    expect(demoScript.getAttribute("data-so-lp")).toBe("v2");
    expect(demoScript.textContent).toContain('document.getElementById("lp-demo-img").removeAttribute("src")'); // r1 da tela cheia (31/10): no v2 o print do módulo entra só no toque (o da camada)
    expect(HTML).toContain('html[data-lp="v2"] .lp-celular img#lp-demo-img { display: none; }'); // na tela cheia nunca o print do atual (esticado)
    // r2 da tela cheia (persona MÉDIA 1): o carregamento é o cabeçalho recortado + esqueletos — dentro de [data-so-lp=v2], sem src no HTML
    const esq = d.querySelector("#lp-celular .lp2-cheia-esq")!;
    expect(esq.getAttribute("data-so-lp")).toBe("v2");
    expect(esq.getAttribute("aria-hidden")).toBe("true");
    expect(esq.querySelector("img.lp2-cheia-cab")!.hasAttribute("src")).toBe(false);
    expect(esq.querySelectorAll(".lp2-cheia-cards i")).toHaveLength(6);
    for (const m of ["financas", "rotina", "treino"]) expect(existsSync(resolve(raiz, `public/landing/v3-cheia-${m}.webp`))).toBe(true);
    expect(d.querySelector("#lp-demo-img")!.getAttribute("src")).toBe("/landing/demo-financas.webp");
    expect(d.querySelector('img[src*="/landing/v2-"]')).toBeNull();
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
async function abrirPagina(lp: "atual" | "v2" | null, checkout: "livre" | "email" = "livre", estadoDoHistorico: unknown = null, antesDoScript?: () => void) {
  await dormir(25); // o rAF (landing_html) da página anterior esvazia antes de zerar a lista de eventos
  vi.resetModules();
  localStorage.clear(); sessionStorage.clear(); apagarCookies();
  window.history.replaceState(estadoDoHistorico, "", "/organizar"); // 30/10 noite: um estado = a aba recarregou com ele (a tela cheia da demo aberta)
  (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
  IOFake.inst = [];
  trocarIO(IOFake);
  document.documentElement.setAttribute("data-t", "a");
  document.documentElement.setAttribute("data-oferta", "sempre");
  document.documentElement.setAttribute("data-checkout", checkout);
  if (lp) document.documentElement.setAttribute("data-lp", lp); else document.documentElement.removeAttribute("data-lp");
  document.documentElement.removeAttribute("data-demo-cheia"); document.body.removeAttribute("style"); // a tela cheia de um teste anterior
  document.body.innerHTML = corpo;
  antesDoScript?.();
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
    expect(src).toMatch(/requestAnimationFrame\(\(\) => ocioso\(carregarTerceiros, 1500\)\)/);
    expect(src).not.toMatch(/depoisDoLoad\(carregarTerceiros/); // o pixel não espera mais o load (só a demo do atual espera)
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
    expect(frame().getAttribute("src")).toBe("/organizar/demo?m=financas&lp=v2"); // &lp=v2: o número da demo nos R$ 146 da página
    expect(celular.hasAttribute("data-abrindo")).toBe(true);
    expect(eventos().find((e) => e.nome === "landing_demo_aberta")).toMatchObject({ via: "tela_cheia", origem: "botao" });
    expect(eventos().find((e) => e.nome === "landing_cta" && e.onde === "testar_app")).toBeTruthy();
    await abrirPagina("v2");
    (document.querySelector('.lp-pilula[data-m="treino"]') as HTMLButtonElement).click();
    expect(frame().getAttribute("src")).toBe("/organizar/demo?m=treino&lp=v2");
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
    // crítica r1 (oferta M1 / visitante-frio 1): voltou ao topo → o botão do topo reapareceu → a barra some (liga E desliga)
    dispara((o) => o.alvos.includes(cta), [{ isIntersecting: true, target: cta, boundingClientRect: { top: 541 } }]);
    expect(fixo.hasAttribute("data-on")).toBe(false);
    dispara((o) => o.alvos.includes(cta), [{ isIntersecting: false, target: cta, boundingClientRect: { top: -120 } }]);
    expect(fixo.hasAttribute("data-on")).toBe(true);
    // com a oferta na tela, o fixo some (como hoje) — mas no v2 "viu a oferta" NÃO vem do bloco (crítica 8.1)…
    const oferta = document.getElementById("oferta")!;
    dispara((o) => o.alvos.includes(oferta) && o.opts.threshold === 0.15, [{ isIntersecting: true, target: oferta, boundingClientRect: { top: 200 } }]);
    expect(fixo.hasAttribute("data-on")).toBe(false);
    expect(nomes()).not.toContain("landing_oferta_vista");
    // …vem do BOTÃO DE PAGAR ≥ 50% visível
    const pagarEl = document.getElementById("lp-pagar")!;
    const obsPagar = IOFake.inst.find((o) => o.alvos.includes(pagarEl) && o.opts.threshold === 0.5);
    expect(obsPagar).toBeDefined();
    obsPagar!.cb([{ isIntersecting: true, target: pagarEl, boundingClientRect: { top: 500 } }], obsPagar!);
    expect(eventos().find((e) => e.nome === "landing_oferta_vista")).toMatchObject({ via: "botao_50" });
    obsPagar!.cb([{ isIntersecting: true, target: pagarEl, boundingClientRect: { top: 500 } }], obsPagar!);
    expect(eventos().filter((e) => e.nome === "landing_oferta_vista")).toHaveLength(1);
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
    expect(src).toContain('criarCarregadorCompartilhado(() => import("./pagamento")');
    expect(src).toContain("void pg(false).catch(() => null)");
    expect(src).toContain('onde: "chunk_pagamento"');
    expect(readFileSync(resolve(raiz, "src/landing/carregar.ts"), "utf8")).toContain("limparMarcaDeRecarga");
  });
});

describe("braço v2 + AB_CHECKOUT: o fluxo inteiro, nos dois braços do e-mail", () => {
  it.each(["atual", "v2"] as const)("%s: guarda o email antes do carregamento e o restaura sem criar Pix automaticamente", async (lp) => {
    await abrirPagina(lp, "email");
    digitar("lp-email-antes", "cliente@example.com");
    pagar();
    const guardado = localStorage.getItem("landing-estado-v1")!;
    expect(JSON.parse(guardado)).toMatchObject({ fase: "gerando", emailPix: "cliente@example.com", pix: null });
    // Deixa a tentativa simulada terminar antes de reconstruir o documento.
    await espera("#lp-copiar");
    await abrirPagina(lp, "email", null, () => localStorage.setItem("landing-estado-v1", guardado));
    expect((document.getElementById("lp-email-antes") as HTMLInputElement).value).toBe("cliente@example.com");
    expect(document.getElementById("lp-copiar")).toBeNull();
    expect(nomes()).not.toContain("landing_pix_gerado");
  });
  it("v2 · livre: oferta → Pix (3 passos, QR e código lado a lado, 'Pagou? Volte aqui', e-mail sem '(opcional)') → 'Pronto! Falta o seu e-mail' → conta pronta: e-mail em caixa, selos das lojas de 48 px, site, 1º passo; sem 'Mudar o plano'", async () => {
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
    expect(pix.querySelector(".lp2-qr-linha #lp-qr")).not.toBeNull(); // QR à esquerda…
    expect(pix.querySelector(".lp2-qr-linha .lp2-qr-lado .lp-codigo")).not.toBeNull(); // …código + Copiar à direita
    expect(pix.querySelector(".lp2-qr-linha .lp2-qr-lado #lp-copiar")).not.toBeNull();
    expect(pix.querySelector(".lp2-qr-dica")!.textContent).toBe("Ou leia o QR code com a câmera do banco, em outro aparelho."); // r1: a dica não repete os passos 1 e 3
    expect(pix.querySelector('label[for="lp-email-pix"]')!.textContent).toBe("Seu e-mail (se quiser) · pra entrar no app depois"); // r1: não parece etapa antes do banco
    expect(pix.querySelector('[data-testid="landing-volte"] #lp-validade')!.textContent).toMatch(/Este código vale por \d\d:\d\d/); // crítica 4.3
    expect(pix.querySelectorAll("#lp-validade")).toHaveLength(1);
    expect(document.getElementById("lp-ja-paguei")!.textContent).toBe("Já paguei e não mudou?"); // crítica 4.2
    expect(pix.querySelector('[data-testid="landing-copiado"]')).toBeNull(); // a caixa verde virou o passo 1
    expect(pix.textContent).not.toContain("Esperando o pagamento");
    expect(document.getElementById("lp-ja-paguei")).not.toBeNull();
    expect(document.getElementById("lp-mudar")).toBeNull();
    expect(document.getElementById("lp-email-pix")).not.toBeNull(); // braço livre: o opcional segue
    expect(pix.querySelector(".lp-codigo")!.textContent).toMatch(/^000201/);
    simular().pagar();
    const pago = await espera('[data-testid="landing-pago"]');
    expect(pago.querySelector("h3")!.textContent).toBe("Pronto! Falta o seu e‑mail.");
    expect(document.getElementById("lp-criar")!.textContent).toContain("Liberar meu acesso");
    digitar("lp-email", "maria@email.com");
    (document.getElementById("lp-criar") as HTMLButtonElement).click();
    const conta = await espera('[data-testid="landing-conta"]');
    expect(conta.querySelector("h3")!.textContent).toBe("Sua conta está pronta.");
    expect(conta.textContent).toContain("O CORE é seu pra sempre.");
    expect(conta.textContent).toMatch(/entre com este e-mail/i);
    expect(conta.querySelector(".lp2-email-caixa")!.textContent).toBe("maria@email.com");
    const selos = [...conta.querySelectorAll(".lp2-selos a[data-loja] img")];
    expect(selos.map((i) => i.getAttribute("height"))).toEqual(["48", "48"]);
    expect(conta.querySelector('a[href*="apps.apple.com"]')).not.toBeNull();
    expect(conta.querySelector('a[href*="play.google.com"]')).not.toBeNull();
    expect(conta.querySelector("#lp-abrir")).not.toBeNull(); // o site (no computador, principal; no celular, "Ou abrir no site agora")
    expect(conta.querySelector(".lp2-passo1")!.textContent).toContain("1º passo: anote o que entra e o que sai.");
    expect(conta.querySelector(".lp2-como-entrar")!.textContent).toMatch(/Entrar sem senha.*código chega neste e-mail/); // r1: "e a senha?"
    expect(conta.textContent).toContain("contato@coreaplicativo.com.br");
    expect(conta.textContent).not.toMatch(/comprovante/i);
    expect(document.getElementById("lp-fixo")!.hasAttribute("data-on")).toBe(false);
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

/* ───────── CRÍTICA r1 (30/10) ───────── */
describe("crítica r1 · 4.1: o QR não pode sair da tela quando aparece (v2)", () => {
  it("o CSS do v2 desliga o scroll anchoring (a âncora virava o #antes, abaixo do cartão na tela)", () => {
    expect(HTML).toMatch(/html\[data-lp="v2"\], html\[data-lp="v2"\] body, html\[data-lp="v2"\] main\.lp \{ overflow-anchor: none; \}/);
  });
  it("v2: gerando → QR → pago → conta — a cada troca de tela do cartão a página rola até o cartão (start); o atual rola como hoje", async () => {
    const rolou = vi.fn();
    Element.prototype.scrollIntoView = function (this: Element, o?: unknown) { rolou(this.id, o); };
    await abrirPagina("v2", "livre");
    expect(rolou).not.toHaveBeenCalled(); // abrir na oferta: nada
    pagar();
    expect(rolou).toHaveBeenLastCalledWith("lp-card", { behavior: "smooth", block: "start" }); // gerando
    rolou.mockClear();
    await espera('[data-testid="landing-codigo"]');
    expect(rolou).toHaveBeenCalledWith("lp-card", { behavior: "smooth", block: "start" }); // o QR apareceu
    rolou.mockClear();
    (document.getElementById("lp-copiar") as HTMLButtonElement).click(); // re-render da MESMA tela: não rola de novo
    await dormir(30);
    expect(rolou).not.toHaveBeenCalled();
    simular().pagar();
    await espera('[data-testid="landing-pago"]');
    expect(rolou).toHaveBeenCalledWith("lp-card", { behavior: "smooth", block: "start" });
    rolou.mockClear();
    digitar("lp-email", "x@y.com"); (document.getElementById("lp-criar") as HTMLButtonElement).click();
    await espera('[data-testid="landing-conta"]');
    expect(rolou).toHaveBeenCalledWith("lp-card", { behavior: "smooth", block: "start" });
  });
  it("v2 · email com conta: a tela do código rola pro cartão; o erro de Pix também", async () => {
    const rolou = vi.fn();
    Element.prototype.scrollIntoView = function (this: Element, o?: unknown) { rolou(this.id, o); };
    await abrirPagina("v2", "email");
    digitar("lp-email-antes", "maria+existe@email.com");
    pagar();
    await espera('[data-testid="landing-email-tem-conta"]');
    expect(rolou).toHaveBeenCalledWith("lp-card", { behavior: "smooth", block: "start" });
  });
});

describe("crítica r1 · 7.1 / 8.1 / 8.2: rede e medição", () => {
  it("7.1 / r2 2.3 / r1 do v3: toda imagem do v2 é data-src no HTML (fora do v2 fica display:none e não baixa); só a da 1ª tela ganha src + high em tempo de parse no v2, com preload no <head> só no v2; o atual não injeta preload nenhum", () => {
    const d = document.createElement("div"); d.innerHTML = corpoDe(HTML);
    const imgs = [...d.querySelectorAll('[data-so-lp="v2"] img:not(.lp2-cheia-cab)')];
    expect(imgs.length).toBe(7);
    expect(d.querySelector(".lp2-cheia-cab")!.hasAttribute("src")).toBe(false); // r2 da tela cheia: o cabeçalho recortado ganha src pelo landing.ts (perto do cartão / no toque)
    for (const i of imgs) { expect(i.hasAttribute("src")).toBe(false); expect(i.getAttribute("data-src")).toMatch(/^\/landing\/v3-/); expect(i.getAttribute("fetchpriority")).not.toBe("high"); }
    // r1 do v3: o preload da imagem da 1ª tela SÓ no v2 (o <img> vira eager no parse, então é consumido); no atual, nenhum
    expect(HTML).not.toMatch(/rel="preload" as="image"/);
    for (const u of ["/organizar", "/organizar?lp=atual"]) expect(rodar(comChaves("off", "off"), u).preloads).toEqual([]);
    expect(rodar(comChaves("off", "off"), "/organizar?lp=v2").preloads).toEqual([expect.objectContaining({ rel: "preload", as: "image", href: "/landing/v3-home.webp", fetchpriority: "high" })]);
  });
  it("8.1: no braço atual 'viu a oferta' continua sendo 15% do bloco (como hoje); no v2 só o botão ≥ 50% — o bloco #oferta na tela não dispara nada", async () => {
    await abrirPagina("atual");
    const oferta = document.getElementById("oferta")!;
    dispara((o) => o.alvos.includes(oferta), [{ isIntersecting: true, target: oferta, boundingClientRect: { top: 200 } }]);
    expect(eventos().find((e) => e.nome === "landing_oferta_vista")).toMatchObject({ via: "bloco_15" });
    expect(IOFake.inst.find((o) => o.opts.threshold === 0.5)).toBeUndefined();
    await abrirPagina("v2");
    const oferta2 = document.getElementById("oferta")!;
    dispara((o) => o.alvos.includes(oferta2) && o.opts.threshold === 0.15, [{ isIntersecting: true, target: oferta2, boundingClientRect: { top: 200 } }]);
    expect(nomes()).not.toContain("landing_oferta_vista");
    // r2 2.5: nem o landing_bloco "oferta" sai com 15% no v2 — só com ≥ 50% do bloco
    expect(eventos().find((e) => e.nome === "landing_bloco" && e.bloco === "oferta")).toBeUndefined();
    const obs50 = IOFake.inst.find((o) => o.alvos.includes(oferta2) && o.opts.threshold === 0.5)!;
    obs50.cb([{ isIntersecting: true, target: oferta2, boundingClientRect: { top: 100 } }], obs50);
    obs50.cb([{ isIntersecting: true, target: oferta2, boundingClientRect: { top: 100 } }], obs50);
    expect(eventos().filter((e) => e.nome === "landing_bloco" && e.bloco === "oferta")).toEqual([expect.objectContaining({ via: "50" })]);
  });
  it("8.2: landing_fita {indice, legenda} 1x por painel do 'Por dentro' (≥ 60% na tela; a legenda é o título do painel), só no v2", async () => {
    await abrirPagina("v2");
    const telas = [...document.querySelectorAll("#dentro-v2 .lp2-foto")];
    expect(telas).toHaveLength(3);
    const obs = IOFake.inst.find((o) => o.alvos.includes(telas[1]))!;
    expect(obs.opts.threshold).toBe(0.6);
    // r1 (técnico 7.2): cruzar o painel de passagem (a rolagem suave do botão do topo) não conta — precisa ficar ≥ 500 ms
    obs.cb([{ isIntersecting: true, target: telas[0], boundingClientRect: { top: 100 } }], obs);
    obs.cb([{ isIntersecting: false, target: telas[0], boundingClientRect: { top: -900 } }], obs);
    obs.cb([{ isIntersecting: true, target: telas[1], boundingClientRect: { top: 100 } }], obs);
    obs.cb([{ isIntersecting: true, target: telas[1], boundingClientRect: { top: 100 } }], obs);
    expect(nomes()).not.toContain("landing_fita");
    await dormir(650);
    expect(eventos().filter((e) => e.nome === "landing_fita")).toEqual([expect.objectContaining({ indice: 1, legenda: "Saiba quanto pode gastar hoje.", braco_lp: "v2" })]);
    await abrirPagina("atual");
    expect(IOFake.inst.find((o) => o.opts.threshold === 0.6)).toBeUndefined();
  });
});

/* ───────── CRÍTICA r1 do v3 (30/10): estado da compra na página inteira, código vencido, arranque ───────── */
describe("crítica r1 do v3 · depois do Pix gerado/pago a página não vende de novo; código vencido avisa; arranque sem rolagem suave", () => {
  const rotulos = () => ({
    topo: document.getElementById("lp-cta-topo")!.textContent!.trim(),
    fixo: [...document.querySelectorAll("#lp-fixo button")].find((b) => b.getAttribute("data-so-lp") === "v2")!.textContent!.trim(),
    fim: [...document.querySelectorAll("#fim button")].find((b) => b.getAttribute("data-so-lp") === "v2")!.textContent!.trim(),
    fimP: [...document.querySelectorAll("#fim p")].find((b) => b.getAttribute("data-so-lp") === "v2")!.textContent,
    fixoP: [...document.querySelectorAll("#lp-fixo .lp2-fixo-p > *")].map((e) => e.textContent).join(" ").replace(/\s+/g, " ").trim(),
  });
  const saiuDoTopo = () => { const cta = document.getElementById("lp-cta-topo")!; dispara((o) => o.alvos.includes(cta), [{ isIntersecting: false, target: cta, boundingClientRect: { top: -120 } }]); };

  it("v2 · fase qr: topo, fixo e fim viram 'Voltar pro meu Pix'; o fixo mostra 'Pix gerado · vale por mm:ss' e continua disponível", async () => {
    await abrirPagina("v2", "livre");
    expect(rotulos()).toMatchObject({ topo: "Quero organizar minha vida", fixo: "Quero organizar minha vida", fim: "Quero organizar minha vida", fimP: "Vitalício por R$ 27,90 · Pix na hora", fixoP: "R$ 27,90 Vitalício · Pix" });
    pagar();
    await espera('[data-testid="landing-codigo"]');
    expect(rotulos()).toMatchObject({ topo: "Voltar pro meu Pix", fixo: "Voltar pro meu Pix", fim: "Voltar pro meu Pix", fimP: "Seu Pix está logo acima." });
    expect(rotulos().fixoP).toMatch(/^Pix gerado vale por \d\d:\d\d$/);
    expect(document.getElementById("fim")!.dataset.fase).toBe("qr");
    saiuDoTopo();
    expect(document.getElementById("lp-fixo")!.hasAttribute("data-on")).toBe(true); // com o Pix vivo o fixo é o atalho de volta
    const fixoBtn = [...document.querySelectorAll("#lp-fixo button")].find((b) => b.getAttribute("data-so-lp") === "v2") as HTMLButtonElement;
    fixoBtn.click();
    expect(eventos().filter((e) => e.nome === "landing_cta").pop()).toMatchObject({ onde: "fixo", fase: "qr" });
  });

  it("v2 · pago e conta: o fixo some de vez (mesmo com o topo fora da tela); topo e fim dizem 'Liberar meu acesso' → 'Ver minha conta'", async () => {
    await abrirPagina("v2", "livre");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    simular().pagar();
    await espera('[data-testid="landing-pago"]');
    saiuDoTopo();
    expect(document.getElementById("lp-fixo")!.hasAttribute("data-on")).toBe(false);
    expect(rotulos()).toMatchObject({ topo: "Liberar meu acesso", fim: "Liberar meu acesso", fimP: "Pagamento confirmado. Falta só o seu e-mail." });
    digitar("lp-email", "maria@email.com");
    (document.getElementById("lp-criar") as HTMLButtonElement).click();
    await espera('[data-testid="landing-conta"]');
    saiuDoTopo();
    expect(document.getElementById("lp-fixo")!.hasAttribute("data-on")).toBe(false);
    expect(rotulos()).toMatchObject({ topo: "Ver minha conta", fim: "Ver minha conta", fimP: "Sua conta está pronta.", fixoP: "R$ 27,90 Vitalício · Pix" });
    expect(document.getElementById("fim")!.dataset.fase).toBe("conta");
  });

  it("v2 · 'Você já tem o CORE' (marcador do aparelho) tem o MESMO desenho da conta pronta: e-mail em caixa, selos de 48 px, como entrar, 1º passo; fixo off; topo/fim 'Ver minha conta'", async () => {
    await abrirPagina("v2", "livre");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    simular().pagar();
    await espera('[data-testid="landing-pago"]');
    digitar("lp-email", "ana@email.com");
    (document.getElementById("lp-criar") as HTMLButtonElement).click();
    await espera('[data-testid="landing-conta"]');
    // o estado do Pix some (como na recarga de uma 2ª visita), o marcador da compra (com o e-mail) fica
    localStorage.removeItem("landing-estado-v1");
    vi.resetModules();
    (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
    IOFake.inst = [];
    document.body.innerHTML = corpo;
    await import("@/landing/landing");
    const card = await espera('[data-testid="landing-ja-tem"]');
    expect(card.querySelector("h3")!.textContent).toBe("Você já tem o CORE");
    expect(card.querySelector(".lp2-email-caixa")!.textContent).toBe("ana@email.com");
    expect([...card.querySelectorAll(".lp2-selos a[data-loja] img")].map((i) => i.getAttribute("height"))).toEqual(["48", "48"]);
    expect(card.querySelector(".lp2-como-entrar")!.textContent).toContain("Entrar sem senha");
    expect(card.querySelector(".lp2-passo1")).not.toBeNull();
    expect(card.querySelector("#lp-nao-fui-eu")).not.toBeNull();
    expect(card.querySelector(".lp-loja-bloco")).toBeNull(); // o desenho do atual não aparece no v2
    saiuDoTopo();
    expect(document.getElementById("lp-fixo")!.hasAttribute("data-on")).toBe(false);
    expect(rotulos()).toMatchObject({ topo: "Ver minha conta", fim: "Ver minha conta", fimP: "Sua conta está pronta." });
  });

  it("v2 · o código venceu: o cartão volta pra oferta COM o aviso ('Esse código venceu… se você já pagou, o acesso chega no seu e-mail'), landing_pix_venceu sai; gerar outro limpa o aviso", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await abrirPagina("v2", "livre");
      pagar();
      await espera('[data-testid="landing-codigo"]');
      const guardado = JSON.parse(localStorage.getItem("landing-estado-v1")!);
      // o Pix passa a vencer daqui a 1,5 s (o relógio do cartão confere a cada 1 s)
      guardado.pix.criadoEm = Date.now() - 30 * 60_000 + 1500;
      localStorage.setItem("landing-estado-v1", JSON.stringify(guardado));
      vi.resetModules();
      (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
      IOFake.inst = [];
      document.body.innerHTML = corpo;
      await import("@/landing/landing");
      await espera('[data-testid="landing-codigo"]');
      await vi.advanceTimersByTimeAsync(3200);
      expect(document.querySelector('[data-testid="landing-codigo"]')).toBeNull();
      expect(document.getElementById("lp-card")!.dataset.fase).toBe("oferta");
      const aviso = document.querySelector('[data-testid="landing-venceu"]')!;
      // r3 (oferta M2 / pix 3): sem e-mail conhecido (braço livre, campo do QR vazio) a frase NÃO promete e-mail — é esta tela que confirma
      expect(aviso.textContent).toBe("Esse código venceu. Se você já pagou, esta tela confirma sozinha em instantes. Se não, é só gerar outro.");
      expect(eventos().find((e) => e.nome === "landing_pix_venceu")).toMatchObject({ via: "relogio" });
      expect(nomes()).toContain("landing_pix_venceu");
      expect(rotulos().topo).toBe("Quero organizar minha vida");
      pagar();
      await vi.advanceTimersByTimeAsync(2500);
      await espera('[data-testid="landing-codigo"]');
      expect(document.querySelector('[data-testid="landing-venceu"]')).toBeNull();
    } finally { vi.useRealTimers(); }
  });

  it("v2 · recarregou com um Pix que venceu há < 10 min: a oferta volta com o mesmo aviso (não some em silêncio)", async () => {
    await abrirPagina("v2", "livre");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    const guardado = JSON.parse(localStorage.getItem("landing-estado-v1")!);
    guardado.pix.criadoEm = Date.now() - 32 * 60_000; // venceu há 2 min
    await abrirPagina("v2", "livre");
    localStorage.setItem("landing-estado-v1", JSON.stringify(guardado));
    vi.resetModules();
    document.body.innerHTML = corpo;
    await import("@/landing/landing");
    expect(document.querySelector('[data-testid="landing-codigo"]')).toBeNull();
    expect(document.querySelector('[data-testid="landing-venceu"]')!.textContent).toMatch(/Esse código venceu/);
    // venceu há 1 h: nada de aviso (começa do zero, como antes)
    guardado.pix.criadoEm = Date.now() - 90 * 60_000;
    await abrirPagina("v2", "livre");
    localStorage.setItem("landing-estado-v1", JSON.stringify(guardado));
    vi.resetModules();
    document.body.innerHTML = corpo;
    await import("@/landing/landing");
    expect(document.querySelector('[data-testid="landing-venceu"]')).toBeNull();
  });

  it("v2 · o arranque com Pix vivo rola até o cartão SEM smooth e desliga a restauração de rolagem (Chromium recarregava com o QR fora da tela); o atual não mexe nisso", async () => {
    const rolou = vi.fn();
    Element.prototype.scrollIntoView = function (this: Element, o?: unknown) { rolou(this.id, o); };
    await abrirPagina("v2", "livre");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    const guardado = localStorage.getItem("landing-estado-v1")!;
    await abrirPagina("v2", "livre");
    localStorage.setItem("landing-estado-v1", guardado);
    vi.resetModules(); rolou.mockClear();
    history.scrollRestoration = "auto";
    document.body.innerHTML = corpo;
    await import("@/landing/landing");
    expect(rolou).toHaveBeenCalledWith("lp-card", { behavior: "auto", block: "start" });
    expect(rolou).not.toHaveBeenCalledWith("lp-card", { behavior: "smooth", block: "start" });
    expect(history.scrollRestoration).toBe("manual");
    await abrirPagina("atual", "livre");
    localStorage.setItem("landing-estado-v1", guardado);
    vi.resetModules(); rolou.mockClear();
    history.scrollRestoration = "auto";
    document.body.innerHTML = corpo;
    await import("@/landing/landing");
    expect(history.scrollRestoration).toBe("auto");
  });

  it("v2 · o erro de gerar o Pix aparece colado no botão (#lp-pagar-erro), não solto abaixo do CNPJ; some ao tentar de novo", async () => {
    await abrirPagina("v2", "livre");
    const erro = document.getElementById("lp-pagar-erro")!;
    expect(erro.hidden).toBe(true);
    // o Pix simulado nunca falha (o erro real vem do chunk/função): o teste garante a casa do erro — entre o botão e a linha do CNPJ
    const html = document.getElementById("lp-pagar")!.parentElement!.innerHTML;
    expect(html.indexOf('id="lp-pagar"')).toBeLessThan(html.indexOf('id="lp-pagar-erro"'));
    expect(html.indexOf('id="lp-pagar-erro"')).toBeLessThan(html.indexOf("lp-seguro"));
  });

  it("v2 · 'App Store · Google Play · Computador' da 1ª tela é tocável: rola até #dentro-v2 e grava landing_lojas_topo", async () => {
    const rolou = vi.fn();
    Element.prototype.scrollIntoView = function (this: Element, o?: unknown) { rolou(this.id, o); };
    await abrirPagina("v2", "livre");
    (document.querySelector(".lp2-onde") as HTMLElement).click();
    expect(rolou).toHaveBeenCalledWith("dentro-v2", { behavior: "smooth", block: "start" });
    expect(nomes()).toContain("landing_lojas_topo");
    expect(nomes()).not.toContain("landing_cta");
  });
});

describe("crítica r2 · 2.4: uma página velha (de outro teste) não escreve na lista de eventos da nova", () => {
  it("os timers da página anterior (pixel → demo 'fundo') só escrevem na lista em que ela nasceu", async () => {
    await abrirPagina("atual");
    const listaVelha = eventos();
    await abrirPagina("v2"); // antes de os timers da anterior (≈ 400 ms) dispararem
    await dormir(900);
    expect(listaVelha.map((e) => e.nome)).toContain("landing_demo_aberta"); // a velha recebeu o seu "fundo"
    expect(nomes()).not.toContain("landing_demo_aberta"); // a nova (v2) ficou limpa
    expect(frame().getAttribute("src")).toBeNull();
  });
});

describe("crítica r2 do v3 · aviso do vencido no topo do cartão, 'Copiado ✓', Enter no e-mail do QR, código pós-pago mantido, selos sem _blank", () => {
  it("v2 · Pix vencido: o aviso é a 1ª linha do cartão (antes de 'Vitalício por'), e o botão vira 'Gerar outro Pix · R$ 27,90' até gerar; depois volta a 'Pagar R$ 27,90 no Pix'", async () => {
    await abrirPagina("v2", "livre");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    const guardado = JSON.parse(localStorage.getItem("landing-estado-v1")!);
    guardado.pix.criadoEm = Date.now() - 32 * 60_000; // venceu há 2 min
    localStorage.setItem("landing-estado-v1", JSON.stringify(guardado));
    vi.resetModules();
    (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
    IOFake.inst = [];
    document.body.innerHTML = corpo;
    await import("@/landing/landing");
    const corpoCard = document.querySelector("#lp-card .lp-card-corpo")!;
    const aviso = document.querySelector('[data-testid="landing-venceu"]')!;
    expect(corpoCard.firstElementChild).toBe(aviso); // antes de "Vitalício por", não depois do CNPJ
    expect(aviso.className).toContain("lp2-aviso-topo");
    expect(document.getElementById("lp-pix")!.querySelector('[data-testid="landing-venceu"]')).toBeNull();
    expect(document.getElementById("lp-pagar-txt")!.textContent).toBe("Gerar outro Pix · R$ 27,90");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    expect(document.querySelector('[data-testid="landing-venceu"]')).toBeNull();
    expect(document.getElementById("lp-pagar-txt")!.textContent).toBe("Pagar R$ 27,90 no Pix");
  });

  it("v2 · 'Copiar de novo' responde 'Copiado ✓' por 1,5 s (sem re-render do cartão) e volta ao rótulo", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    try {
      await abrirPagina("v2", "livre");
      pagar();
      await espera('[data-testid="landing-codigo"]');
      const btn = document.getElementById("lp-copiar")!;
      const rotulo = btn.querySelector("span")!;
      const antes = rotulo.textContent;
      btn.click();
      await vi.waitFor(() => { if (rotulo.textContent !== "Copiado ✓" && document.querySelector("#lp-copiar span")?.textContent !== "Copiado ✓") throw new Error("sem Copiado"); });
      expect(writeText).toHaveBeenCalled();
      expect(eventos().filter((e) => e.nome === "landing_pix_copiado" && e.via === "botao")).toHaveLength(1);
      await dormir(1700);
      const depois = document.querySelector("#lp-copiar span")!.textContent;
      expect(depois === antes || depois === "Copiar de novo").toBe(true);
      expect(document.querySelector('[data-testid="landing-codigo"]')).not.toBeNull();
    } finally { Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true }); }
  });

  it("v2 · Enter no e-mail opcional da tela do QR salva (como o toque em 'Salvar')", async () => {
    await abrirPagina("v2", "livre");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    digitar("lp-email-pix", "ana@exemplo.com");
    const campo = document.getElementById("lp-email-pix") as HTMLInputElement;
    campo.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await vi.waitFor(() => { if (!document.querySelector(".lp-email-opc .lp-ok-linha")) throw new Error("não salvou"); });
    expect(document.querySelector(".lp-email-opc .lp-ok-linha")!.textContent).toContain("ana@exemplo.com");
    expect(eventos().find((e) => e.nome === "landing_email_pix")).toMatchObject({ ok: true });
  });

  it("v2 · código errado depois de pagar: o digitado fica no campo e o botão continua habilitado (como no código antes do Pix)", async () => {
    await abrirPagina("v2", "livre");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    simular().pagar();
    await espera('[data-testid="landing-pago"]');
    digitar("lp-email", "ana+existe@exemplo.com");
    (document.getElementById("lp-criar") as HTMLButtonElement).click();
    await espera("#lp-codigo");
    expect((document.getElementById("lp-entrar") as HTMLButtonElement).disabled).toBe(true);
    digitar("lp-codigo", "00000000");
    expect((document.getElementById("lp-entrar") as HTMLButtonElement).disabled).toBe(false);
    (document.getElementById("lp-entrar") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (!document.querySelector('[data-testid="landing-pago"] .lp-erro')) throw new Error("sem erro"); });
    expect(document.querySelector('[data-testid="landing-pago"] .lp-erro')!.textContent).toContain("Código errado");
    expect((document.getElementById("lp-codigo") as HTMLInputElement).value).toBe("00000000");
    expect((document.getElementById("lp-entrar") as HTMLButtonElement).disabled).toBe(false);
    expect(HTML).toContain('html[data-lp="v2"] .lp-pago .lp-form .lp-erro { text-align: center; }');
    digitar("lp-codigo", "12345678");
    (document.getElementById("lp-entrar") as HTMLButtonElement).click();
    await espera('[data-testid="landing-conta"]');
  });

  it("v2 · os selos das lojas do pós-compra abrem na mesma aba (sem target=_blank: dentro do navegador do Instagram um _blank pode não abrir nada); o atual segue como hoje", async () => {
    await abrirPagina("v2", "livre");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    simular().pagar();
    await espera('[data-testid="landing-pago"]');
    digitar("lp-email", "ana@exemplo.com");
    (document.getElementById("lp-criar") as HTMLButtonElement).click();
    const conta = await espera('[data-testid="landing-conta"]');
    const selos = [...conta.querySelectorAll(".lp2-selos a[data-loja]")];
    expect(selos).toHaveLength(2);
    for (const a of selos) expect(a.hasAttribute("target")).toBe(false);
    expect(readFileSync(resolve(raiz, "src/landing/landing.ts"), "utf8")).toMatch(/<div class="lp-loja-bloco">[\s\S]*target="_blank"/); // o atual continua com _blank
  });

  it("v2 · braço email: pagar sem e-mail dá um erro de 1 linha que não repete o rótulo ('Falta o seu e-mail pra gerar o Pix.'); o atual mantém a frase de hoje", async () => {
    await abrirPagina("v2", "email");
    pagar();
    await dormir(50);
    expect(document.getElementById("lp-email-antes-erro")!.textContent).toBe("Falta o seu e-mail pra gerar o Pix.");
    await abrirPagina("atual", "email");
    pagar();
    await dormir(50);
    expect(document.getElementById("lp-email-antes-erro")!.textContent).toBe("Coloque seu e-mail: é por onde você entra no CORE.");
  });

  /* ───────── rodada 4 (crítica r3) ───────── */
  it("r3 · regras: o Pix vencido não leva o e-mail junto (estadoQueVolta devolve oferta COM email/emailPix)", async () => {
    const { estadoQueVolta } = await import("@/landing/regras");
    const pix = { orderId: "o1", qrCode: "000", qrCodeBase64: null, expiresAt: null, criadoEm: Date.now() - 40 * 60_000, oferta: "LN_sempre279" as const };
    const v = estadoQueVolta({ v: 1, fase: "qr", pix, anteriores: [], pago: null, email: null, emailPix: "ana@exemplo.com", salvoEm: Date.now() });
    expect(v).toMatchObject({ fase: "oferta", pix: null, emailPix: "ana@exemplo.com" });
    expect(estadoQueVolta({ v: 1, fase: "qr", pix, anteriores: [], pago: null, email: null, emailPix: null, salvoEm: Date.now() - 3 * 86400e3 }).emailPix).toBeNull(); // velho: zera tudo
  });

  it("r3 · braço email + Pix vencido na recarga: o campo volta preenchido, o aviso fala do e-mail, 'Gerar outro Pix' gera de primeira; landing_pix_venceu {via: recarga} sai 1× por pedido", async () => {
    await abrirPagina("v2", "email");
    digitar("lp-email-antes", "ana@exemplo.com");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    const guardado = JSON.parse(localStorage.getItem("landing-estado-v1")!);
    expect(guardado.emailPix).toBe("ana@exemplo.com");
    guardado.pix.criadoEm = Date.now() - 32 * 60_000; // venceu há 2 min
    const recarregar = async () => {
      localStorage.setItem("landing-estado-v1", JSON.stringify(guardado));
      vi.resetModules(); IOFake.inst = [];
      (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
      document.body.innerHTML = corpo;
      await import("@/landing/landing");
    };
    await recarregar();
    expect(document.querySelector('[data-testid="landing-venceu"]')!.textContent).toBe("Esse código venceu. Se você já pagou, o acesso chega no seu e-mail em instantes. Se não, é só gerar outro.");
    expect((document.getElementById("lp-email-antes") as HTMLInputElement).value).toBe("ana@exemplo.com");
    expect(eventos().filter((e) => e.nome === "landing_pix_venceu")).toEqual([expect.objectContaining({ via: "recarga", order_id: guardado.pix.orderId })]);
    expect(document.getElementById("lp-pagar-txt")!.textContent).toBe("Gerar outro Pix · R$ 27,90");
    pagar();
    await dormir(30);
    expect(document.getElementById("lp-email-antes-erro")?.textContent || "").toBe(""); // não cai no "Falta o seu e-mail"
    await espera('[data-testid="landing-codigo"]');
    expect(document.querySelector('[data-testid="landing-venceu"]')).toBeNull();
    // a mesma aba recarrega de novo com o mesmo pedido vencido: o evento não repete
    await recarregar();
    expect(eventos().filter((e) => e.nome === "landing_pix_venceu")).toHaveLength(0);
  });

  it("r3 · braço livre + e-mail salvo na tela do QR: o aviso do vencido volta a prometer o e-mail", async () => {
    await abrirPagina("v2", "livre");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    digitar("lp-email-pix", "ana@exemplo.com");
    (document.getElementById("lp-email-pix-ok") as HTMLButtonElement).click();
    await vi.waitFor(() => { if (!JSON.parse(localStorage.getItem("landing-estado-v1")!).emailPix) throw new Error("e-mail"); });
    const guardado = JSON.parse(localStorage.getItem("landing-estado-v1")!);
    guardado.pix.criadoEm = Date.now() - 32 * 60_000;
    await abrirPagina("v2", "livre");
    localStorage.setItem("landing-estado-v1", JSON.stringify(guardado));
    vi.resetModules(); document.body.innerHTML = corpo;
    await import("@/landing/landing");
    expect(document.querySelector('[data-testid="landing-venceu"]')!.textContent).toMatch(/o acesso chega no seu e-mail/);
  });

  it("r3 · barra fixa: liga também com o botão do topo ainda ABAIXO da dobra (fonte grande), e desliga quando ele entra", async () => {
    await abrirPagina("v2");
    const cta = document.getElementById("lp-cta-topo")!;
    const fixo = document.getElementById("lp-fixo")!;
    dispara((o) => o.alvos.includes(cta), [{ isIntersecting: false, target: cta, boundingClientRect: { top: 720 }, rootBounds: { height: 690 } } as unknown as Entrada]);
    expect(fixo.hasAttribute("data-on")).toBe(true);
    dispara((o) => o.alvos.includes(cta), [{ isIntersecting: true, target: cta, boundingClientRect: { top: 600 }, rootBounds: { height: 690 } } as unknown as Entrada]);
    expect(fixo.hasAttribute("data-on")).toBe(false);
    dispara((o) => o.alvos.includes(cta), [{ isIntersecting: false, target: cta, boundingClientRect: { top: -120 } }]);
    expect(fixo.hasAttribute("data-on")).toBe(true);
  });

  it("r3 · o Pix vivo também mora num cookie (core_ln_pix): localStorage zerado + recarga reabre o MESMO QR (sem 2º Pix); pagar apaga o cookie", async () => {
    await abrirPagina("v2", "livre");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    const { orderId } = JSON.parse(localStorage.getItem("landing-estado-v1")!).pix;
    expect(document.cookie).toMatch(/core_ln_pix=/);
    const { lerPixVivo } = await import("@/landing/marcador");
    expect(lerPixVivo()).toMatchObject({ orderId, oferta: "LN_sempre279" });
    localStorage.clear();
    vi.resetModules(); IOFake.inst = []; document.body.innerHTML = corpo;
    await import("@/landing/landing");
    await espera('[data-testid="landing-codigo"]');
    expect(JSON.parse(localStorage.getItem("landing-estado-v1")!).pix.orderId).toBe(orderId);
    simular().pagar();
    await espera('[data-testid="landing-pago"]');
    expect(document.cookie).not.toMatch(/core_ln_pix=/);
  });

  it("r3 · o localStorage sumiu com a página viva (Instagram): a chave é re-semeada do heap ao voltar pra aba e a cada render", async () => {
    await abrirPagina("v2", "livre");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    localStorage.removeItem("landing-estado-v1");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(JSON.parse(localStorage.getItem("landing-estado-v1")!).fase).toBe("qr");
    localStorage.removeItem("landing-estado-v1");
    window.dispatchEvent(new Event("pageshow"));
    expect(JSON.parse(localStorage.getItem("landing-estado-v1")!).fase).toBe("qr");
    localStorage.removeItem("landing-estado-v1");
    digitar("lp-email-pix", "ana@exemplo.com");
    (document.getElementById("lp-email-pix-ok") as HTMLButtonElement).click(); // salva → render
    await vi.waitFor(() => { if (!localStorage.getItem("landing-estado-v1")) throw new Error("não re-semeou"); });
    expect(JSON.parse(localStorage.getItem("landing-estado-v1")!).fase).toBe("qr");
  });

  it("r3 · arranque no cartão (Pix vivo / aviso / já tem): scrollRestoration manual e, se a página crescer nos primeiros 6 s, o cartão é re-encostado no topo (WebKit)", async () => {
    type RO = { cb: () => void };
    const ros: RO[] = [];
    class ROFake { constructor(public cb: () => void) { ros.push(this); } observe() { /* noop */ } disconnect() { /* noop */ } }
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ROFake;
    try {
      await abrirPagina("v2", "livre");
      pagar();
      await espera('[data-testid="landing-codigo"]');
      const guardado = localStorage.getItem("landing-estado-v1")!;
      // recarga com o Pix vivo
      history.scrollRestoration = "auto";
      await abrirPagina("v2", "livre");
      localStorage.setItem("landing-estado-v1", guardado);
      ros.length = 0;
      const rolou = vi.fn();
      Element.prototype.scrollIntoView = function (this: Element, o?: unknown) { rolou(this.id, o); };
      vi.resetModules(); IOFake.inst = []; document.body.innerHTML = corpo;
      await import("@/landing/landing");
      expect(history.scrollRestoration).toBe("manual");
      expect(ros).toHaveLength(1);
      const card = document.getElementById("lp-card")!;
      rolou.mockClear();
      card.getBoundingClientRect = () => ({ top: 204, bottom: 900, left: 0, right: 390, width: 390, height: 696, x: 0, y: 204, toJSON: () => null });
      ros[0].cb();
      expect(rolou).toHaveBeenCalledWith("lp-card", { behavior: "auto", block: "start" });
      card.getBoundingClientRect = () => ({ top: 0, bottom: 696, left: 0, right: 390, width: 390, height: 696, x: 0, y: 0, toJSON: () => null });
      rolou.mockClear(); ros[0].cb();
      expect(rolou).not.toHaveBeenCalled(); // já está no topo
      card.getBoundingClientRect = () => ({ top: 786, bottom: 1400, left: 0, right: 390, width: 390, height: 614, x: 0, y: 786, toJSON: () => null });
      window.dispatchEvent(new Event("touchstart")); // a pessoa rolou por conta própria: nunca mais puxa
      rolou.mockClear(); ros[0].cb();
      expect(rolou).not.toHaveBeenCalled();
      // recarga com o código VENCIDO (aviso): também manual + observador
      const g = JSON.parse(guardado); g.pix.criadoEm = Date.now() - 32 * 60_000;
      history.scrollRestoration = "auto";
      await abrirPagina("v2", "livre");
      localStorage.setItem("landing-estado-v1", JSON.stringify(g));
      ros.length = 0;
      vi.resetModules(); IOFake.inst = []; document.body.innerHTML = corpo;
      await import("@/landing/landing");
      expect(document.querySelector('[data-testid="landing-venceu"]')).not.toBeNull();
      expect(history.scrollRestoration).toBe("manual");
      expect(ros).toHaveLength(1);
      // abrindo na oferta limpa: nem manual, nem observador
      history.scrollRestoration = "auto";
      ros.length = 0;
      await abrirPagina("v2", "livre");
      expect(history.scrollRestoration).toBe("auto");
      expect(ros).toHaveLength(0);
    } finally { delete (window as unknown as { ResizeObserver?: unknown }).ResizeObserver; }
  });

  it("r3 · título B (?t=b): o painel 1 troca o h3 ('Todas as 16, dentro do app.') pra não repetir o h1, e a legenda do landing_fita é a do título visível", async () => {
    expect(HTML).toContain('html[data-lp="v2"][data-t="b"] .lp2-h3-a, html[data-lp="v2"]:not([data-t="b"]) .lp2-h3-b { display: none; }');
    await abrirPagina("v2");
    document.documentElement.setAttribute("data-t", "b");
    vi.resetModules(); IOFake.inst = []; (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
    document.body.innerHTML = corpo;
    await import("@/landing/landing");
    const painel1 = document.querySelector("#dentro-v2 .lp2-foto")!;
    expect(txt(painel1.querySelector("h3.lp2-h3-a"))).toBe("16 áreas da vida em um só app.");
    expect(txt(painel1.querySelector("h3.lp2-h3-b"))).toBe("Todas as 16, dentro do app.");
    dispara((o) => o.opts.threshold === 0.6, [{ isIntersecting: true, target: painel1, boundingClientRect: { top: 100 } }]);
    await dormir(600);
    expect(eventos().find((e) => e.nome === "landing_fita")).toMatchObject({ indice: 0, legenda: "Todas as 16, dentro do app." });
    document.documentElement.setAttribute("data-t", "a");
  });

  it("r3 · 1ª tela: a linha das lojas tem alvo de toque ampliado (::before −10/+10), a miúda tem 13 px, 'no Pix' não fica sozinho; demo com a nota da data; passo 2 com o separador antes da palavra", () => {
    expect(HTML).toContain('.lp2-onde::before { content: ""; position: absolute; left: 0; right: 0; top: -10px; bottom: -10px; }');
    expect(HTML).toMatch(/\.lp2-onde \{ position: relative; display: flex;/);
    expect(HTML).toMatch(/\.lp2-miuda \{ margin: 6px 0 0; text-align: center; font-size: 13px;/);
    expect(HTML).toContain('<span class="lp2-preco-txt"><b>Vitalício</b><span>Pagamento único no&nbsp;Pix</span></span>');
    expect(HTML).toContain('<p class="lp-demo-nota" data-so-lp="v2">Dados de exemplo · nada é salvo.</p>'); // r1 da tela cheia (persona 3): o cartão é a Home de um dia fixo — sem prometer "a data de hoje" embaixo dele
    expect(HTML).toContain('.lp-preco-sub[data-so-lp="v2"] { font-size: 14px; }');
    expect(HTML).toContain('<p class="lp-demo-nota" data-so-lp="atual">Nada do que você mexer aqui é salvo.</p>');
    expect(HTML).toContain('.lp2-disp span + span::before { content: "·";');
    expect(HTML).not.toContain('.lp2-disp span:not(:last-child)::after');
    expect(HTML).toMatch(/\.lp2-foto\.ambar \{ --corte: \.70;/);
  });
});

/* ───────── 30/10 noite (dono no iPhone: "a proporção do app ficou estranha"): a demo em TELA CHEIA, sem sair da página ───────── */
describe("v2 · a demo em tela cheia (voltar do celular, seta, comprar, recarga) + o número da demo", () => {
  const html = document.documentElement;
  const aberta = () => html.hasAttribute("data-demo-cheia");
  const voltou = () => vi.waitFor(() => { if (aberta()) throw new Error("ainda aberta"); }, { timeout: 2000, interval: 10 });
  const fechadas = () => eventos().filter((e) => e.nome === "landing_demo_fechada");
  const abertas = () => eventos().filter((e) => e.nome === "landing_demo_aberta");
  const clicar = (sel: string) => (document.querySelector(sel) as HTMLElement).click();
  const fingirRolagem = (y: number) => { Object.defineProperty(window, "scrollY", { value: y, configurable: true }); };

  it("abre pelo botão: a camada aparece, a página trava no y de antes (body fixed em −y), 1 entrada no histórico com a marca; a seta fecha por history.back() e devolve o y", async () => {
    await abrirPagina("v2");
    const rolagens: number[] = [];
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(((_x: number, y: number) => { rolagens.push(y); }) as typeof window.scrollTo);
    fingirRolagem(3210);
    const tamanho = history.length;
    clicar("#lp-demo-abrir");
    expect(aberta()).toBe(true);
    expect(frame().getAttribute("src")).toBe("/organizar/demo?m=financas&lp=v2");
    expect(history.length).toBe(tamanho + 1);
    expect(history.state).toMatchObject({ lpDemoCheia: 1, y: 3210, m: "financas" });
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-3210px");
    expect(document.getElementById("lp-celular")!.getAttribute("aria-modal")).toBe("true");
    expect(abertas()).toEqual([expect.objectContaining({ via: "tela_cheia", origem: "botao", modulo: "financas", vez: 1 })]);
    expect(document.activeElement?.id).toBe("lp2-cheia-voltar");
    fingirRolagem(0); // com o body fixo a janela não rola
    clicar("#lp2-cheia-voltar");
    await voltou();
    expect(history.state?.lpDemoCheia).toBeUndefined();
    expect(document.body.style.position).toBe("");
    expect(rolagens.at(-1)).toBe(3210); // a pessoa volta EXATAMENTE onde estava
    expect(fechadas()).toEqual([expect.objectContaining({ via: "seta", modulo: "financas" })]);
    expect(typeof fechadas()[0].ms).toBe("number");
    scrollTo.mockRestore();
  });

  it("o voltar do celular (history.back() de fora) fecha com via 'voltar'; abrir/fechar 3× não empilha histórico nem eventos repetidos; o iframe carrega 1 vez só", async () => {
    await abrirPagina("v2");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const tamanhos: number[] = [];
    for (let i = 0; i < 3; i++) {
      clicar("#lp-demo-abrir");
      expect(aberta()).toBe(true);
      tamanhos.push(history.length);
      history.back(); // o gesto/botão de voltar do aparelho
      await voltou();
    }
    expect(new Set(tamanhos).size).toBe(1); // a entrada da tela cheia é reaproveitada (pushState depois do back troca a "frente"): o histórico não cresce
    expect(abertas().map((e) => e.vez)).toEqual([1, 2, 3]);
    expect(fechadas().map((e) => e.via)).toEqual(["voltar", "voltar", "voltar"]);
    expect(frame().getAttribute("src")).toBe("/organizar/demo?m=financas&lp=v2");
    scrollTo.mockRestore();
  });

  it("a pílula abre a tela cheia JÁ no módulo (barra de cima com o nome); outra pílula depois troca o módulo da demo", async () => {
    await abrirPagina("v2");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    clicar('.lp-pilula[data-m="rotina"]');
    expect(aberta()).toBe(true);
    expect(frame().getAttribute("src")).toBe("/organizar/demo?m=rotina&lp=v2");
    expect(document.getElementById("lp2-cheia-modulo")!.textContent).toBe("Rotina");
    expect(abertas()[0]).toMatchObject({ origem: "pilula", modulo: "rotina" });
    expect(eventos().find((e) => e.nome === "landing_demo_modulo")).toMatchObject({ modulo: "rotina", via: "pilula" });
    clicar("#lp2-cheia-voltar"); await voltou();
    clicar('.lp-pilula[data-m="treino"]');
    expect(document.getElementById("lp2-cheia-modulo")!.textContent).toBe("Treino");
    expect(history.state).toMatchObject({ lpDemoCheia: 1, m: "treino" });
    clicar("#lp2-cheia-voltar"); await voltou();
    scrollTo.mockRestore();
  });

  it("a barra de baixo ('Quero organizar minha vida'): landing_cta {onde: demo_tela_cheia}, fecha (via comprar) e leva ao cartão da oferta (sem rolagem suave)", async () => {
    await abrirPagina("v2");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const rolou: Array<[string, unknown]> = [];
    const antes = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element, o?: unknown) { rolou.push([this.id, o]); };
    try {
      clicar("#lp-demo-abrir");
      expect(document.querySelector(".lp2-cheia-baixo .lp2-fixo-p")!.textContent).toBe("R$ 27,90Vitalício · Pix");
      clicar("#lp2-cheia-comprar");
      await voltou();
      expect(eventos().find((e) => e.nome === "landing_cta" && e.onde === "demo_tela_cheia")).toMatchObject({ fase: "oferta" });
      expect(fechadas()).toEqual([expect.objectContaining({ via: "comprar" })]);
      expect(rolou.at(-1)).toEqual(["oferta", { behavior: "auto", block: "start" }]);
    } finally { Element.prototype.scrollIntoView = antes; scrollTo.mockRestore(); }
  });

  it("a seta ← do próprio módulo (a demo avisa 'seta' e depois o destino) fecha UMA vez e devolve o y; algo que só existe com conta fecha e leva ao cartão", async () => {
    await abrirPagina("v2");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    clicar("#lp-demo-abrir");
    const daDemo = (data: unknown) => window.dispatchEvent(new MessageEvent("message", { data, origin: location.origin, source: frame().contentWindow }));
    daDemo({ tipo: "landing:oferta", destino: "seta" });
    daDemo({ tipo: "landing:oferta", destino: "/organizar/oferta" });
    await voltou();
    expect(fechadas().map((e) => e.via)).toEqual(["seta_app"]);
    clicar("#lp-demo-abrir");
    daDemo({ tipo: "landing:oferta", destino: "/conquistas" });
    await voltou();
    expect(fechadas().map((e) => e.via)).toEqual(["seta_app", "oferta_app"]);
    scrollTo.mockRestore();
  });

  it("recarregou com a tela cheia aberta (o Instagram recarrega a aba): reabre no mesmo módulo e trava no mesmo y, sem 2ª entrada; voltar fecha e devolve o y", async () => {
    const rolagens: number[] = [];
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(((_x: number, y: number) => { rolagens.push(y); }) as typeof window.scrollTo);
    history.pushState(null, "", "/organizar"); // a entrada de baixo (a página antes de abrir)
    const tamanho = history.length;
    await abrirPagina("v2", "livre", { lpDemoCheia: 1, y: 2800, m: "treino" });
    expect(aberta()).toBe(true);
    expect(history.length).toBe(tamanho);
    expect(frame().getAttribute("src")).toBe("/organizar/demo?m=treino&lp=v2");
    expect(document.body.style.top).toBe("-2800px");
    expect(abertas()[0]).toMatchObject({ origem: "recarga", modulo: "treino" });
    clicar("#lp2-cheia-voltar");
    await voltou();
    expect(rolagens.at(-1)).toBe(2800);
    scrollTo.mockRestore();
  });

  it("recarregou com a marca da tela cheia MAS com Pix vivo: o cartão manda (não reabre a demo, o iframe não baixa) e a marca sai do histórico", async () => {
    await abrirPagina("v2", "livre");
    pagar();
    await espera('[data-testid="landing-codigo"]');
    const guardado = localStorage.getItem("landing-estado-v1")!;
    await abrirPagina("v2", "livre", { lpDemoCheia: 1, y: 2800, m: "financas" });
    localStorage.setItem("landing-estado-v1", guardado);
    vi.resetModules();
    (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
    html.removeAttribute("data-demo-cheia"); document.body.removeAttribute("style");
    document.body.innerHTML = corpo;
    await import("@/landing/landing");
    expect(aberta()).toBe(false);
    expect(frame().getAttribute("src")).toBeNull();
    expect(history.state?.lpDemoCheia).toBeUndefined();
    expect(document.getElementById("lp-card")!.dataset.fase).toBe("qr");
  });

  it("o Pix mudou de tela com a demo aberta (pagou no banco e voltou com ela aberta): a camada fecha na hora (via 'fase') e a página solta pra rolar até o cartão", async () => {
    await abrirPagina("v2");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    pagar(); await espera('[data-testid="landing-codigo"]');
    clicar("#lp-demo-abrir");
    expect(aberta()).toBe(true);
    // a barra de baixo segue a fase (como o botão fixo): "Voltar pro meu Pix" + "Pix gerado · vale por"
    expect(txt(document.getElementById("lp2-cheia-comprar"))).toBe("Voltar pro meu Pix");
    expect(document.querySelector(".lp2-cheia-baixo .lp2-fixo-p b")!.textContent).toBe("Pix gerado");
    simular().pagar();
    await vi.waitFor(() => { if (document.getElementById("lp-card")!.dataset.fase !== "pago") throw new Error("pago"); }, { timeout: 4000, interval: 40 });
    expect(aberta()).toBe(false);
    expect(document.body.style.position).toBe("");
    expect(fechadas().map((e) => e.via)).toEqual(["fase"]);
    await dormir(50);
    expect(history.state?.lpDemoCheia).toBeUndefined();
    scrollTo.mockRestore();
  });

  /* ── r1 da tela cheia (31/10) ── */
  it("r2 · ao abrir, SÓ o que não muda: o cabeçalho do módulo recortado da própria demo (Finanças/Rotina/Treino; Dieta = só os esqueletos) + esqueletos no lugar dos cards; nada de print com número de outro dia", async () => {
    await abrirPagina("v2");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const cel = document.getElementById("lp-celular")!;
    const cab = document.querySelector("#lp-celular .lp2-cheia-cab") as HTMLImageElement;
    const doAtual = document.getElementById("lp-demo-img") as HTMLImageElement;
    expect(cel.hasAttribute("data-tem-print")).toBe(false);
    clicar("#lp-demo-abrir");
    expect(cel.hasAttribute("data-tem-print")).toBe(true);
    expect(cel.hasAttribute("data-abrindo")).toBe(true); // os esqueletos aparecem (CSS) até a demo pintar
    expect(cab.getAttribute("src")).toBe("/landing/v3-cheia-financas.webp");
    expect(doAtual.getAttribute("src") ?? "").not.toMatch(/v3-/); // o print inteiro (v3-financas, outro dia) não entra mais na camada
    clicar("#lp2-cheia-voltar"); await voltou();
    clicar('.lp-pilula[data-m="rotina"]');
    expect(cab.getAttribute("src")).toBe("/landing/v3-cheia-rotina.webp");
    clicar("#lp2-cheia-voltar"); await voltou();
    clicar('.lp-pilula[data-m="treino"]');
    expect(cab.getAttribute("src")).toBe("/landing/v3-cheia-treino.webp");
    clicar("#lp2-cheia-voltar"); await voltou();
    clicar('.lp-pilula[data-m="dieta"]'); // escondida no v2, mas o caminho existe (recarga/avançar com m=dieta)
    expect(cel.hasAttribute("data-tem-print")).toBe(false);
    clicar("#lp2-cheia-voltar"); await voltou();
    expect(HTML).toContain('html[data-lp="v2"] .lp-celular[data-abrindo] .lp2-cheia-esq { display: block; position: absolute; z-index: 1; top: var(--lp2-topo-h, 48px);');
    expect(HTML).toContain('html[data-lp="v2"] .lp-celular[data-pronta] .lp2-cheia-esq { opacity: 0; pointer-events: none; }');
    expect(HTML).toContain('html[data-lp="v2"] .lp2-cheia-topo, html[data-lp="v2"] .lp2-cheia-baixo { position: relative; z-index: 3; }');
    expect(HTML).toContain('html[data-lp="v2"] .lp-celular { overscroll-behavior: contain; }');
    scrollTo.mockRestore();
  });

  it("r1 · fechada, a camada é inert; o foco que ficou dentro (o iframe) volta pro 'Testar o app aqui'; as pílulas do v2 são um grupo de botões (sem aria-pressed); o cartão é aria-hidden", async () => {
    await abrirPagina("v2");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const cel = document.getElementById("lp-celular")!;
    expect(cel.hasAttribute("inert")).toBe(true);
    const pil = document.querySelector("#demo .lp-pilulas")!;
    expect(pil.getAttribute("role")).toBe("group");
    expect(pil.querySelectorAll("[aria-pressed]")).toHaveLength(0);
    expect(document.getElementById("lp2-demo-cartao")!.getAttribute("aria-hidden")).toBe("true");
    clicar('.lp-pilula[data-m="treino"]');
    expect(cel.hasAttribute("inert")).toBe(false);
    expect(pil.querySelectorAll("[aria-pressed]")).toHaveLength(0); // abrir num módulo não "marca" pílula
    frame().focus(); // WebKit: o toque não focou o botão; o teclado entrou no app
    clicar("#lp2-cheia-voltar"); await voltou();
    expect(cel.hasAttribute("inert")).toBe(true);
    expect(document.activeElement?.id).toBe("lp-demo-abrir");
    scrollTo.mockRestore();
  });

  it("r1 · a restauração de rolagem só volta ao 'auto' DEPOIS do popstate do nosso back() (aparelho lento: a reserva de 700 ms fecha antes)", async () => {
    await abrirPagina("v2");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    history.scrollRestoration = "auto";
    const real = history.back.bind(history);
    const back = vi.spyOn(history, "back").mockImplementation(() => { window.setTimeout(real, 1300); }); // o popstate chega em 1,3 s
    clicar("#lp-demo-abrir");
    expect(history.scrollRestoration).toBe("manual");
    clicar("#lp2-cheia-comprar");
    await voltou(); // a reserva (700 ms) fechou
    await dormir(400);
    expect(history.scrollRestoration).toBe("manual"); // antes: "auto" aqui — o popstate atrasado restauraria o y antigo
    await vi.waitFor(() => { if (history.state?.lpDemoCheia) throw new Error("ainda sem popstate"); }, { timeout: 2000, interval: 20 });
    await vi.waitFor(() => { if (history.scrollRestoration !== "auto") throw new Error("ainda manual"); }, { timeout: 1500, interval: 20 });
    expect(fechadas().map((e) => e.via)).toEqual(["comprar"]);
    back.mockRestore(); scrollTo.mockRestore();
  });

  it("r1 · avaliações: o apelido é texto, escrito pelo script a partir do data-nome (o dono só preenche o data-nome); vazio = nada", async () => {
    await abrirPagina("v2", "livre", null, () => {
      const spans = document.querySelectorAll<HTMLElement>("#avaliacoes-v2 .lp2-aval-nome");
      spans.forEach((s) => { s.textContent = ""; });
      spans[2].setAttribute("data-nome", "Mariana S."); // o dono preencheu o 1º do Google Play
      spans[3].setAttribute("data-nome", ""); // e o 2º fica vazio (31/10: os 2 da Play têm nome no HTML; aqui testa o vazio)
    });
    const legendas = [...document.querySelectorAll("#avaliacoes-v2 figcaption")].map((f) => f.textContent);
    expect(legendas).toEqual(["camvbs ·App Store · out/2026", "ywonvu ·App Store · set/2026", "Mariana S. ·Google Play · set/2026", "Google Play · ago/2026"]); // r2 (persona 3): sem espaço no fim do apelido — o gap do figcaption separa (era espaço duplo)
    expect(document.querySelector("#avaliacoes-v2 .lp2-aval-nome")!.textContent).toBe("camvbs ·");
  });

  it("r1 · a demo aberta pelo v2 esconde a seta ← do cabeçalho do módulo (a barra '← Voltar' da página é a única saída) e contém o overscroll; o atual não muda", () => {
    const fonte = readFileSync(resolve(raiz, "src/pages/organizar/DemoDaLanding.tsx"), "utf8");
    expect(fonte).toContain('if (!numeroDaLanding) return;');
    expect(fonte).toContain('header.sticky > div > :first-child:is([aria-label="Voltar"], [aria-label="Todos os módulos"]) { display: none !important; }');
    expect(fonte).toContain('raiz.style.overscrollBehavior = "contain";');
    // cada um dos 16 módulos tem UM header.sticky, e a seta é o 1º filho do div dele (o seletor acima não pega outra coisa)
    for (const m of ["Index", "Rotina", "Treino", "Dieta", "Saude", "Casa", "Estudos", "Carreira", "Biblioteca", "Beleza", "Viagens", "Hiperfoco", "Relacionamentos", "Pet", "Detox", "DesenvolvimentoPessoal"]) {
      const f = readFileSync(resolve(raiz, `src/pages/${m}.tsx`), "utf8");
      expect((f.match(/<header className="[^"]*sticky/g) ?? []).length, m).toBe(1);
      const depois = f.slice(f.search(/<header className="[^"]*sticky/)).replace(/\{\/\*[\s\S]*?\*\/\}/g, ""); // sem os comentários JSX
      const div = depois.indexOf("<div");
      const primeiro = depois.slice(div).split("\n").slice(1).map((l) => l.trim()).find(Boolean);
      expect(primeiro, m).toMatch(/^<(button|Button)\b/);
      expect(depois.slice(div, div + 900), m).toMatch(/voltarDoModulo/);
    }
  });

  /* ── r2 da tela cheia (31/10) ── */
  it("r2 · o 'avançar' do navegador reabre SEM empilhar outra entrada: abrir → voltar → avançar → '← Voltar' deixa o histórico do tamanho de antes da reabertura e sem a marca (recarregar não reabre)", async () => {
    await abrirPagina("v2");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    history.pushState(null, "", "/organizar"); // a entrada da página
    const tamanho = history.length;
    clicar("#lp-demo-abrir");
    expect(history.length).toBe(tamanho + 1);
    history.back(); await voltou();
    history.forward();
    await vi.waitFor(() => { if (!aberta()) throw new Error("ainda fechada"); }, { timeout: 2000, interval: 10 });
    expect(abertas().at(-1)).toMatchObject({ origem: "avancar" });
    expect(history.length).toBe(tamanho + 1); // antes: tamanho + 2 (pushState em cima da entrada que já tinha a marca)
    expect(history.state).toMatchObject({ lpDemoCheia: 1, m: "financas" });
    clicar("#lp2-cheia-voltar"); await voltou();
    await vi.waitFor(() => { if (history.state?.lpDemoCheia) throw new Error("ainda marcada"); }, { timeout: 2000, interval: 10 });
    expect(history.length).toBe(tamanho + 1);
    expect(fechadas().map((e) => e.via)).toEqual(["voltar", "seta"]);
    scrollTo.mockRestore();
  });

  it("r2 · aberta, a camada é a única coisa no teclado: os irmãos de cada ancestral (o resto do #demo, as outras seções, a barra fixa) ganham inert; ao fechar, só os que a camada marcou perdem", async () => {
    await abrirPagina("v2");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const jaInerte = document.getElementById("como-v2")!; jaInerte.setAttribute("inert", ""); // inert de outra origem: fica
    clicar("#lp-demo-abrir");
    for (const id of ["lp2-demo-cartao", "lp-demo-abrir", "oferta", "duvidas-v2", "avaliacoes-v2", "lp-fixo"]) expect(document.getElementById(id)!.hasAttribute("inert"), id).toBe(true);
    expect(document.querySelector("#demo .lp-pilulas")!.hasAttribute("inert")).toBe(true);
    expect(document.getElementById("lp-celular")!.hasAttribute("inert")).toBe(false);
    expect(document.getElementById("demo")!.hasAttribute("inert")).toBe(false);
    expect(document.getElementById("lp")!.hasAttribute("inert")).toBe(false);
    clicar("#lp2-cheia-voltar"); await voltou();
    for (const id of ["lp2-demo-cartao", "lp-demo-abrir", "oferta", "duvidas-v2", "avaliacoes-v2", "lp-fixo"]) expect(document.getElementById(id)!.hasAttribute("inert"), id).toBe(false);
    expect(jaInerte.hasAttribute("inert")).toBe(true);
    expect(document.getElementById("lp-celular")!.hasAttribute("inert")).toBe(true);
    // a barra de baixo (comprar) solta a página ANTES de rolar até o cartão
    clicar("#lp-demo-abrir");
    clicar("#lp2-cheia-comprar"); await voltou();
    expect(document.getElementById("oferta")!.hasAttribute("inert")).toBe(false);
    scrollTo.mockRestore();
  });

  it("r2 · o cabeçalho recortado baixa quando o cartão da demo chega perto (nunca o iframe); antes disso, nada", async () => {
    const pedidos: string[] = [];
    const ImagemReal = window.Image;
    class ImagemEspia { decoding = ""; set src(u: string) { pedidos.push(u); } }
    (window as unknown as { Image: unknown }).Image = ImagemEspia;
    try {
      await abrirPagina("v2");
      expect(pedidos).toEqual([]);
      const io = IOFake.inst.find((o) => o.alvos.some((a) => a.id === "lp2-demo-cartao"))!;
      expect(io.opts.rootMargin).toBe("800px 0px");
      dispara((o) => o === io, [{ isIntersecting: true, target: document.getElementById("lp2-demo-cartao")! } as unknown as Entrada]);
      expect(pedidos).toEqual(["/landing/v3-cheia-financas.webp", "/landing/v3-cheia-rotina.webp", "/landing/v3-cheia-treino.webp"]);
      expect(frame().getAttribute("src")).toBeNull();
    } finally { (window as unknown as { Image: unknown }).Image = ImagemReal; }
  });

  it("braço atual: nada disso existe — a pílula troca o módulo da caixa de hoje, sem camada, sem histórico; o iframe pede a URL de sempre", async () => {
    await abrirPagina("atual");
    const tamanho = history.length;
    clicar('.lp-pilula[data-m="treino"]');
    expect(aberta()).toBe(false);
    expect(history.length).toBe(tamanho);
    expect(document.body.style.position).toBe("");
    expect(frame().getAttribute("src")).toBe("/organizar/demo?m=treino");
    expect(abertas()[0]).toMatchObject({ via: "pilula" });
  });
});

describe("o número da demo da landing v2 (lib/preview-seeds-financas-landing)", () => {
  it("'quanto posso gastar hoje' = R$ 146 em TODO dia de meses de 28, 29, 30 e 31 dias, pela conta do app; gastos só até ontem, valores inteiros ≥ 1; freela só no começo do mês e redondo", async () => {
    const { financasNoNumeroDaLanding } = await import("@/lib/preview-seeds-financas-landing");
    const { getSeedsForModule } = await import("@/lib/preview-seeds");
    const { computeDailyBudget, computeMonthlyOutflow, computeLooseBillsOutflow } = await import("@/lib/finance-totals");
    const { somaParcelasDoMes } = await import("@/lib/finance-parcelas");
    const sementes = getSeedsForModule("financas");
    for (const [ano, mes] of [[2026, 1], [2028, 1], [2026, 8], [2026, 9]]) { // fev/26 (28), fev/28 (29), set/26 (30), out/26 (31)
      const dias = new Date(ano, mes + 1, 0).getDate();
      for (let dia = 1; dia <= dias; dia++) {
        const agora = new Date(ano, mes, dia, 12);
        const s = financasNoNumeroDaLanding(sementes, agora);
        const renda = s["finance-incomes"].reduce((t: number, i: { value: number }) => t + i.value, 0);
        const variaveis = s["finance-expenses"].reduce((t: number, e: { value: number }) => t + e.value, 0);
        const fixos = s["finance-fixed-expenses"].reduce((t: number, e: { value: number }) => t + e.value, 0);
        const saida = computeMonthlyOutflow(variaveis, fixos, somaParcelasDoMes(s["finance-installments"]), computeLooseBillsOutflow(s["finance-dueDays"], s["finance-fixed-expenses"]));
        const conta = computeDailyBudget(renda, saida, s["finance-dueDays"], s["finance-fixed-expenses"], agora);
        expect(Math.round(conta.perDay), `${dia}/${mes + 1}/${ano}`).toBe(146);
        for (const e of s["finance-expenses"]) { expect(Number(e.date.slice(8))).toBeLessThan(dia); expect(Number.isInteger(e.value) && e.value >= 1).toBe(true); expect(e.date.slice(0, 7)).toBe(`${ano}-${String(mes + 1).padStart(2, "0")}`); }
        const freela = s["finance-incomes"].find((i: { description: string }) => i.description === "Freela");
        if (dia >= 15) expect(freela).toBeUndefined();
        if (freela && dia > 1) expect(freela.value % 50).toBe(0);
        // crédito só até o dia 20 (o fechamento do Nubank): depois iria pra fatura do mês seguinte
        for (const e of s["finance-expenses"]) if (e.paymentMethod === "credito") expect(Number(e.date.slice(8))).toBeLessThanOrEqual(20);
        // r2 da tela cheia (persona 7): nada de "Uber −R$ 6" — cada lançamento ≥ 60% do mês normal (o menor do mês normal é R$ 28 → ≥ R$ 17),
        // e do dia 3 em diante pelo menos 2 lançamentos (sai lançamento pequeno em vez de encolher todos)
        for (const e of s["finance-expenses"]) expect(e.value, `${e.description} ${dia}/${mes + 1}`).toBeGreaterThanOrEqual(17);
        if (dia >= 3) expect(s["finance-expenses"].length, `${dia}/${mes + 1}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
  it("o resto das sementes não muda (renda 6.200, fixos, parcela, metas…); sem Finanças nas sementes, devolve igual", async () => {
    const { financasNoNumeroDaLanding } = await import("@/lib/preview-seeds-financas-landing");
    const { getSeedsForModule } = await import("@/lib/preview-seeds");
    const sementes = getSeedsForModule("financas");
    const s = financasNoNumeroDaLanding(sementes, new Date(2026, 9, 30, 12));
    expect(s["finance-incomes"]).toEqual(sementes["finance-incomes"]); // fim do mês: sem freela
    for (const k of ["finance-fixed-expenses", "finance-installments", "finance-goals", "finance-dueDays", "finance-investments"]) expect(s[k]).toBe(sementes[k]);
    const rotina = getSeedsForModule("rotina");
    expect(financasNoNumeroDaLanding(rotina)).toBe(rotina);
  });
  it("a demo só usa as sementes da landing com &lp=v2 (ou com a página de cima no v2): o braço atual, o /preview, o /experimente e o /liberar seguem iguais", () => {
    const fonte = readFileSync(resolve(raiz, "src/pages/organizar/DemoDaLanding.tsx"), "utf8");
    expect(fonte).toMatch(/params\.get\("lp"\) === "v2" \|\| paginaDeCimaEhV2\(\)/);
    expect(fonte).toMatch(/semente=\{numeroDaLanding \? financasNoNumeroDaLanding : undefined\}/);
    const landing = readFileSync(resolve(raiz, "src/landing/landing.ts"), "utf8");
    expect(landing).toContain("const urlDemo = (m: ModuloLanding) => (V2 ? `/organizar/demo?m=${m}&lp=v2` : `/organizar/demo?m=${m}`);");
  });
});
