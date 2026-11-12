/**
 * /simples — A LP DE UMA TELA (11/11; dono: "faz uma nova LP, vai ser só isso aí do print… muda anual pra vitalício, tira as notas de
 * aplicativo, troca a home antiga pela atual, quando clica no botão vai para o checkout" · "cria em uma nova, não substitui").
 *
 * 1. O <head>: só no /simples nasce html[data-uma], sempre no braço "atual" da página, na oferta "sempre" e com a camada do checkout
 *    (data-cko="v2"), sem ler chave, ?lp, ?cko, ?oferta nem força guardada — e sem gravar nada por causa disso. Nas outras rotas, nada muda.
 * 2. As rotas (vercel.json e vite.config.ts) e a marcação: o que o print tem, sem nota de loja, sem "só hoje", com "Vitalício".
 * 3. A página rodando (jsdom, Pix SIMULADO): o botão abre a camada; do QR em diante é o cartão de hoje no lugar da 1ª tela; a conta mostra
 *    as duas lojas; os eventos saem com braco_cko "v2" (e, no envio, com o path "/simples"); a demo nunca é pedida.
 */
import { afterEach, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { HTML, abrirPagina, camadaAberta, clicar, digitar, dormir, encerrarPagina, espera, esperaCamada, esperaCamadaFechar, eventos, simularPago } from "./organizar-cko-roteiro";

const raiz = resolve(__dirname, "../..");
afterEach(() => { encerrarPagina(); });

const cabeca = HTML.match(/<script>\s*(\(function \(\) \{\s*var LANDING_NOVA[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];
function rodar(url: string, store: Record<string, string> = {}, ck: { v: string } = { v: "" }) {
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
  new Function("location", "document", "window", "localStorage", "URLSearchParams", "Math", "fetch", "sessionStorage", cabeca)(location, document, window, localStorage, URLSearchParams, Math, undefined, { getItem: () => null });
  return { attrs, store, cookie: ck, mem: window.__landing as Record<string, unknown> };
}

describe("/simples no <head>", () => {
  it("sempre: data-uma, página \"atual\", oferta \"sempre\" e a camada do checkout — em qualquer aparelho, com ou sem barra no fim", () => {
    for (let i = 0; i < 40; i++) {
      const r = rodar(i % 2 ? "/simples" : "/simples/", { "landing-device-id": randomUUID() });
      expect(r.attrs).toMatchObject({ "data-uma": "", "data-lp": "atual", "data-oferta": "sempre", "data-cko": "v2" });
      expect(r.mem).toMatchObject({ uma: true, lp: "atual", oferta: "sempre", cko: "v2", cko_forcado: false, lp_forcado: false, oferta_forcada: false });
      expect(r.attrs["data-pagina"]).toBeUndefined(); // por baixo é o /organizar (Pix do Asaas), não a /vida nem a /oferta
      expect(r.attrs["data-lpo"]).toBeUndefined();
    }
  });
  it("não lê ?lp, ?cko, ?oferta nem as forças guardadas do /organizar — e não grava nenhuma", () => {
    const store: Record<string, string> = { "landing-lp-force": "v2", "landing-cko-force": "atual", "landing-oferta-force": "ano" };
    const ck = { v: "landing_cko_force=atual" };
    const r = rodar("/simples?lp=v2&cko=atual&oferta=ano&utm_content=c7", store, ck);
    expect(r.attrs).toMatchObject({ "data-uma": "", "data-lp": "atual", "data-oferta": "sempre", "data-cko": "v2" });
    expect(r.mem).toMatchObject({ cko_forcado: false, lp_forcado: false, oferta_forcada: false });
    expect(store).toMatchObject({ "landing-lp-force": "v2", "landing-cko-force": "atual", "landing-oferta-force": "ano" }); // as forças do /organizar ficam como estavam
    expect(ck.v).toContain("landing_cko_force=atual");
  });
  it("as outras rotas não ganham nada do /simples", () => {
    for (const url of ["/organizar", "/organizar?lp=v2", "/oferta", "/vida", "/vitalicio", "/simples/outra", "/simplesmente"]) {
      const r = rodar(url);
      expect(r.attrs["data-uma"]).toBeUndefined();
      expect(r.mem.uma).toBeUndefined();
    }
    expect(rodar("/organizar").attrs["data-cko"]).toBe("atual"); // a chave CHECKOUT_ORG_V2 continua "off"
    expect(HTML).toMatch(/var CHECKOUT_ORG_V2 = "off";/);
  });
});

describe("/simples: rotas e marcação", () => {
  it("vercel.json e vite.config.ts mandam /simples (com e sem barra) pra landing.html, antes do pega-tudo", () => {
    const rw = (JSON.parse(readFileSync(resolve(raiz, "vercel.json"), "utf8")) as { rewrites: Array<{ source: string; destination: string }> }).rewrites;
    const i1 = rw.findIndex((x) => x.source === "/simples"), i2 = rw.findIndex((x) => x.source === "/simples/"), geral = rw.findIndex((x) => x.source.startsWith("/(("));
    expect(rw[i1]?.destination).toBe("/landing.html");
    expect(rw[i2]?.destination).toBe("/landing.html");
    expect(geral).toBeGreaterThan(Math.max(i1, i2));
    expect(readFileSync(resolve(raiz, "vite.config.ts"), "utf8")).toMatch(/\\\/simples\\\/\?\(\\\?\|\$\)/);
  });
  it("a 1ª tela fica num <template> (as outras páginas não pintam nem baixam nada dela) com o que o print tem", () => {
    const tpl = HTML.match(/<template id="lp-uma">([\s\S]*?)<\/template>/)![1];
    const texto = tpl.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
    expect(texto).toContain("Sua vida organizada num app só.");
    expect(texto).toContain("Dinheiro, rotina, treino e mais 13 áreas. No iPhone, no Android e no computador.");
    expect(texto).toContain("Seu dia"); expect(texto).toContain("Finanças"); expect(texto).toContain("Rotina");
    expect(texto).toContain("R$ 27,90 Vitalício para sempre");
    expect(texto).not.toMatch(/97,90|De R\$/); // dono (11/11): "tira essa comparação de preço, deixa só vitalício - para sempre"
    expect(texto).toContain("Quero organizar minha vida");
    expect(texto).toContain("Pix único · sem renovação automática · 7 dias de garantia");
    // pedidos do dono: "muda anual pra vitalício", "tira as notas de aplicativo"; e a página nova não tem "só hoje"
    expect(texto).not.toMatch(/1 ano inteiro|4,8|4,6|★|Google Play|App Store|só hoje|Só hoje/);
    expect(tpl.match(/<img [^>]*src="\/landing\/(uma-home|uma-financas|uma-rotina)\.webp"/g)).toHaveLength(3);
    for (const f of ["uma-home", "uma-financas", "uma-rotina"]) expect(readFileSync(resolve(raiz, `public/landing/${f}.webp`)).length).toBeGreaterThan(5000);
    expect(tpl).toMatch(/<button type="button" class="lp-cta uma-cta" data-ir="oferta">/);
    // fora do template não existe nenhum #uma na página
    expect(HTML.replace(/<template id="lp-uma">[\s\S]*?<\/template>/, "")).not.toMatch(/id="uma"/);
  });
});

describe("/simples rodando (Pix simulado)", () => {
  const abrir = (o: Partial<Parameters<typeof abrirPagina>[0]> = {}) => abrirPagina({ lp: "atual", pix: "atual", cko: "v2", uma: true, url: "/simples", u2027: false, ...o });
  const html = () => document.documentElement;
  it("o botão abre a camada; do QR em diante o cartão de hoje toma o lugar da 1ª tela; a conta mostra as duas lojas", async () => {
    await abrir();
    expect(document.querySelectorAll("#uma")).toHaveLength(1);
    expect(html().hasAttribute("data-uma-cartao")).toBe(false); // na oferta: só a 1ª tela
    clicar("#uma .uma-cta");
    await esperaCamada();
    expect(eventos().find((e) => e.nome === "landing_cta")).toMatchObject({ onde: "topo", fase: "oferta", braco_cko: "v2" });
    digitar("cko-email", "maria@exemplo.com");
    clicar("#cko-gerar");
    await esperaCamadaFechar();
    await espera('#lp-card[data-fase="qr"]');
    expect(html().hasAttribute("data-uma-cartao")).toBe(true);
    expect(eventos().find((e) => e.nome === "landing_pix_gerado")).toMatchObject({ oferta: "LN_sempre279", valor: 27.9, braco_cko: "v2" });
    simularPago();
    await espera("#lp-card a[data-loja]");
    expect([...document.querySelectorAll<HTMLElement>("#lp-card a[data-loja]")].map((a) => a.dataset.loja).sort()).toEqual(["android", "ios"]);
    expect(html().hasAttribute("data-uma-cartao")).toBe(true);
    // a demo (o app inteiro) nunca é pedida no /simples
    await dormir(50);
    expect(document.getElementById("lp-demo-frame")!.getAttribute("src")).toBeNull();
    expect(location.pathname).toBe("/simples"); // o envio de todo evento leva o path da página: é por ele que o /simples se separa do /organizar
    expect(eventos().every((e) => e.braco_cko === "v2")).toBe(true);
    // sair e reabrir: quem já pagou cai direto na conta, não na página de venda
    await abrir({ limpar: false });
    await espera("#lp-card a[data-loja]");
    expect(html().hasAttribute("data-uma-cartao")).toBe(true);
    expect(camadaAberta()).toBe(false);
  }, 60_000);
  it("a regra de esconder: com data-uma só ficam a marca, a 1ª tela e (do QR em diante) o cartão", () => {
    const css = HTML.match(/<style>(html\[data-uma\][\s\S]*?)<\/style>/)![1];
    expect(css).toContain("html[data-uma] main.lp > :not(.lp-barra):not(#uma):not(#oferta), html[data-uma] #fim, html[data-uma] #lp-fixo { display: none !important; }");
    expect(css).toContain("html[data-uma]:not([data-uma-cartao]):not([data-u27-pag]):not([data-cko-falhou]) #oferta { display: none !important; }");
    expect(css).toContain("html[data-uma][data-uma-cartao] #uma, html[data-uma][data-u27-pag] #uma, html[data-uma][data-cko-falhou] #uma { display: none !important; }");
    for (const regra of css.split("}")) if (regra.trim()) expect(regra.trim().startsWith("html[data-uma]")).toBe(true); // fora do /simples nenhuma regra casa
  });
});
