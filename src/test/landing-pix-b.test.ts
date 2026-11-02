/**
 * LANDING /organizar — A/B da TELA DO PIX (AB_PIX, 02/11): braço "b" = "Recibo da marca" (conceito 3 + enxertos dos juízes,
 * novidades-guardadas/2026-11-02/pix-b) contra o "atual" (a tela de hoje, byte a byte). E a MEDIÇÃO nos 2 braços ("mede certinho").
 *
 *   1. o sorteio no <head>: "off" = todo mundo no atual (é como vai no commit); "on" = 50/50 estável por aparelho (bit 8 de
 *      "pix:"+id, independente do checkout e da página); "b" = todo mundo no b; ?pix=atual|b força, ?pix=auto desfaz;
 *      PIX_MOTIVO "off" (chips do estado "voltou"); ?pixmotivo=on|off|auto;
 *   2. braco_pix em todo evento, nos 2 braços;
 *   3. o b renderiza o que deve (e só na fase qr); o atual não muda;
 *   4. a medição: landing_pix_saiu, landing_voltou {via}, landing_pix_ja_paguei, landing_pix_copiar_manual, landing_pix_rolou,
 *      landing_pix_abandono, landing_pix_qr_aberto, landing_pix_volta_vista, landing_pix_motivo.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { bracoCheckoutDoAparelho, bracoLpDoAparelho, bracoPixDoAparelho, bracoPixDoHtml, motivoPixDoHtml, NOME_NO_BANCO, CNPJ_NO_BANCO } from "@/landing/regras";
import { EMPRESA } from "@/lib/empresa";

const raiz = resolve(__dirname, "../..");
const HTML = readFileSync(resolve(raiz, "landing.html"), "utf8");
const FIXTURE = readFileSync(resolve(__dirname, "fixtures/landing-atual-30-10.html"), "utf8");
const scriptDaCabeca = HTML.match(/<script>\s*(\(function \(\) \{\s*var LANDING_NOVA[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];
const comPix = (v: "on" | "off" | "b", motivo: "on" | "off" = "off") =>
  scriptDaCabeca.replace(/var AB_PIX = "(on|off|b)"/, `var AB_PIX = "${v}"`).replace(/var PIX_MOTIVO = "(on|off)"/, `var PIX_MOTIVO = "${motivo}"`);

function rodar(fonte: string, url: string, store: Record<string, string> = {}, ck: { v: string } = { v: "" }) {
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
    createElement: () => ({ setAttribute: () => {} }),
    head: { appendChild: () => {} },
    get cookie() { return ck.v; },
    set cookie(c: string) { const [par] = c.split(";"); const [nome, valor] = par.split("="); const resto = ck.v.split("; ").filter((x) => x && !x.startsWith(`${nome}=`)); if (valor && !/Max-Age=0/.test(c)) resto.push(par); ck.v = resto.join("; "); },
  };
  const window: Record<string, unknown> = { localStorage, crypto: { randomUUID: () => randomUUID() } };
  new Function("location", "document", "window", "localStorage", "URLSearchParams", "Math", "fetch", "sessionStorage", fonte)(
    location, document, window, localStorage, URLSearchParams, Math, undefined, { getItem: () => null },
  );
  return { attrs, store, cookie: ck, mem: window.__landing as Record<string, unknown> };
}

describe("o sorteio da tela do Pix (AB_PIX, head do landing.html)", () => {
  it("vem DESLIGADO no código (todo mundo no atual) e os chips também", () => {
    expect(HTML).toMatch(/var AB_PIX = "off";/);
    expect(HTML).toMatch(/var PIX_MOTIVO = "off";/);
    const r = rodar(comPix("off"), "/organizar");
    expect(r.attrs["data-pix"]).toBe("atual");
    expect(r.attrs["data-pix-motivo"]).toBeUndefined();
    expect(r.mem).toMatchObject({ pix: "atual", ab_pix: "off", pix_forcado: false, pix_motivo: "off" });
    expect(r.store["landing-device-id"]).toBeUndefined(); // desligado, nem o id do aparelho nasce por causa dele
  });

  it('"on" = estável por aparelho e igual à conta do regras.ts; "b" = todo mundo no b', () => {
    for (let i = 0; i < 40; i++) {
      const store: Record<string, string> = {};
      const r = rodar(comPix("on"), "/organizar", store);
      const id = store["landing-device-id"];
      expect(r.attrs["data-pix"]).toBe(bracoPixDoAparelho(id));
      expect(rodar(comPix("on"), "/organizar", store).attrs["data-pix"]).toBe(r.attrs["data-pix"]); // volta do banco: o mesmo braço
    }
    expect(rodar(comPix("b"), "/organizar").attrs["data-pix"]).toBe("b");
  });

  it("?pix=b força e fica; ?pix=atual troca; ?pix=auto desfaz; valor estranho (o copia-e-cola do e-mail de lembrete) = chave", () => {
    const store: Record<string, string> = {};
    expect(rodar(comPix("off"), "/organizar?pix=b", store).attrs["data-pix"]).toBe("b");
    expect(rodar(comPix("off"), "/organizar", store).mem).toMatchObject({ pix: "b", pix_forcado: true });
    expect(rodar(comPix("off"), "/organizar?pix=atual", store).attrs["data-pix"]).toBe("atual");
    expect(rodar(comPix("b"), "/organizar", store).attrs["data-pix"]).toBe("atual"); // a força vence a chave
    expect(rodar(comPix("off"), "/organizar?pix=auto", store).attrs["data-pix"]).toBe("atual");
    expect(store["landing-pix-force"]).toBeUndefined();
    expect(rodar(comPix("b"), "/organizar?r=t12&pedido=abcdef123&pix=00020126580014br.gov.bcb.pix", store).attrs["data-pix"]).toBe("b");
    expect(store["landing-pix-force"]).toBeUndefined();
  });

  it("r1 (técnico): ?pix=b também fica num cookie — o Instagram zera o localStorage na volta do banco e o QA trocava de braço no meio do pedido; ?pix=auto apaga os 2", () => {
    const store: Record<string, string> = {}; const ck = { v: "" };
    expect(rodar(comPix("off"), "/organizar?pix=b", store, ck).attrs["data-pix"]).toBe("b");
    expect(ck.v).toContain("landing_pix_force=b");
    for (const k of Object.keys(store)) delete store[k]; // o storage zerado: o cookie segura
    expect(rodar(comPix("off"), "/organizar", store, ck)).toMatchObject({ attrs: { "data-pix": "b" }, mem: { pix: "b", pix_forcado: true } });
    expect(rodar(comPix("off"), "/organizar?pix=atual", store, ck).attrs["data-pix"]).toBe("atual");
    expect(ck.v).toContain("landing_pix_force=atual");
    expect(rodar(comPix("b"), "/organizar?pix=auto", store, ck).attrs["data-pix"]).toBe("b");
    expect(ck.v).not.toContain("landing_pix_force");
    expect(store["landing-pix-force"]).toBeUndefined();
    expect(rodar(comPix("off"), "/organizar", store, ck).mem).toMatchObject({ pix: "atual", pix_forcado: false });
  });

  it("?pixmotivo=on liga os chips e fica; auto desfaz", () => {
    const store: Record<string, string> = {};
    expect(rodar(comPix("off"), "/organizar?pixmotivo=on", store).attrs["data-pix-motivo"]).toBe("on");
    expect(rodar(comPix("off"), "/organizar", store).attrs["data-pix-motivo"]).toBe("on");
    expect(rodar(comPix("off"), "/organizar?pixmotivo=auto", store).attrs["data-pix-motivo"]).toBeUndefined();
    expect(rodar(comPix("off", "on"), "/organizar").attrs["data-pix-motivo"]).toBe("on");
  });

  it("50/50 e independente dos sorteios da página E do checkout (as 8 combinações em ~12,5%)", () => {
    const c: Record<string, number> = {};
    const N = 8000;
    for (let i = 0; i < N; i++) { const id = randomUUID(); const k = bracoPixDoAparelho(id) + "|" + bracoLpDoAparelho(id) + "|" + bracoCheckoutDoAparelho(id); c[k] = (c[k] ?? 0) + 1; }
    expect(Object.keys(c)).toHaveLength(8);
    for (const n of Object.values(c)) { expect(n / N).toBeGreaterThan(0.095); expect(n / N).toBeLessThan(0.155); }
  });

  it("bracoPixDoHtml: só 'b' vira b; sem atributo (página velha em cache) = atual; motivoPixDoHtml só com 'on'", () => {
    expect(bracoPixDoHtml({ getAttribute: () => "b" })).toBe("b");
    expect(bracoPixDoHtml({ getAttribute: () => "confianca" })).toBe("atual");
    expect(bracoPixDoHtml({ getAttribute: () => null })).toBe("atual");
    expect(motivoPixDoHtml({ getAttribute: () => "on" })).toBe(true);
    expect(motivoPixDoHtml({ getAttribute: () => null })).toBe(false);
  });

  it("o nome e o CNPJ no banco são os da empresa (lib/empresa) — o mesmo CNPJ que o Mercado Pago imprime", () => {
    expect(NOME_NO_BANCO).toBe(EMPRESA.razaoSocial);
    expect(CNPJ_NO_BANCO).toBe(EMPRESA.cnpj);
  });

  it("o CSS do b é escopado (html[data-pix=b] / .lp-pixb-*) e está igual na fixture do braço atual (o teste do v2 compara)", () => {
    const estilo = HTML.match(/<style>([\s\S]*?)<\/style>/)![1];
    const ini = estilo.indexOf("/* 02/11: AB_PIX braço \"b\"");
    expect(ini).toBeGreaterThan(0);
    const soB = /^html\[data-pix="b"\]|^\.lp-pixb|^button\.lp-pixb|^@keyframes lp-pixb|^\/\* 02\/11: AB_PIX/;
    const linhas: string[] = [];
    for (const l of estilo.slice(ini).split("\n").map((x) => x.trim()).filter(Boolean)) { if (!soB.test(l)) break; linhas.push(l); }
    expect(linhas.length).toBeGreaterThan(30); // o bloco inteiro, contíguo, só com regras do b
    expect(estilo.slice(ini)).toContain("/* ═════════ BRAÇO v2"); // e antes do bloco do v2 (o teste do v2 compara o CSS de hoje com a fixture)
    // as MESMAS linhas na fixture do braço atual (o landing-v2.test.ts compara o CSS de hoje linha a linha)
    for (const l of linhas) expect(FIXTURE).toContain(l);
    expect(HTML).toContain('html[data-pix="b"] .lp-card[data-fase="qr"] .lp-card-faixa { display: none; }');
    expect(HTML).toContain('html[data-pix="b"] .lp-card[data-fase="qr"] + .lp-garantia { display: none; }');
  });
});

/* ───────── a página de verdade no jsdom (Pix simulado) ───────── */
const corpoDe = (html: string) => html.match(/<body>([\s\S]*)<\/body>/)![1];
const corpo = corpoDe(HTML).replace(/<script type="module"[^>]*><\/script>/, "");
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Ev = Record<string, unknown> & { nome: string };
const eventos = (): Ev[] => ((window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding ?? []);
const dos = (nome: string) => eventos().filter((e) => e.nome === nome);
const apagarCookies = () => { for (const c of document.cookie.split(";")) { const n = c.split("=")[0].trim(); if (n) document.cookie = `${n}=; Max-Age=0; Path=/`; } };
type Sim = { pagar: () => void; voltou: () => void; vencer: () => void };
const simular = () => (window as unknown as { __landingSimular: Sim }).__landingSimular;
const visivel = (v: "visible" | "hidden") => { Object.defineProperty(document, "visibilityState", { value: v, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); };
let relogioBase = 0;
/** o Date.now() da página anda `ms` pra frente (o relógio de verdade continua — só o "quanto tempo fora" muda) */
const andar = (ms: number) => { relogioBase += ms; };
async function abrir(pix: "atual" | "b" | null, o: { lp?: "atual" | "v2"; checkout?: "livre" | "email"; motivo?: boolean; url?: string; manterStorage?: boolean } = {}) {
  await dormir(25);
  vi.resetModules();
  if (!o.manterStorage) { localStorage.clear(); sessionStorage.clear(); apagarCookies(); }
  window.history.replaceState(null, "", o.url ?? "/organizar");
  (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
  (window as unknown as { __landingSimularPixNaoCaiu?: boolean }).__landingSimularPixNaoCaiu = false;
  const d = document.documentElement;
  d.setAttribute("data-t", "a"); d.setAttribute("data-oferta", "sempre"); d.setAttribute("data-checkout", o.checkout ?? "email"); d.setAttribute("data-lp", o.lp ?? "atual");
  if (pix) d.setAttribute("data-pix", pix); else d.removeAttribute("data-pix");
  if (o.motivo) d.setAttribute("data-pix-motivo", "on"); else d.removeAttribute("data-pix-motivo");
  // sem disparar o visibilitychange: os listeners das páginas velhas (outros testes) ainda estão no document
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => {} }, configurable: true }); // o jsdom não copia; a página de verdade sim
  document.body.innerHTML = corpo;
  await import("@/landing/landing");
}
const espera = (sel: string, ms = 4000) => vi.waitFor(() => { const el = document.querySelector(sel); if (!el) throw new Error(sel); return el; }, { timeout: ms, interval: 40 });
const some = (sel: string, ms = 4000) => vi.waitFor(() => { if (document.querySelector(sel)) throw new Error(`ainda tem ${sel}`); }, { timeout: ms, interval: 40 });
const digitar = (id: string, v: string) => { const c = document.getElementById(id) as HTMLInputElement; c.value = v; c.dispatchEvent(new Event("input")); };
const txt = (el: Element | null) => (el?.innerHTML ?? "").replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
/** oferta → Pix gerado (no braço email, com o e-mail antes) */
async function gerarPix(email = "maria@exemplo.com") {
  const campo = document.getElementById("lp-email-antes") as HTMLInputElement | null;
  if (campo && document.documentElement.getAttribute("data-checkout") === "email") digitar("lp-email-antes", email);
  (document.getElementById("lp-pagar") as HTMLButtonElement).click();
  await espera('[data-testid="landing-codigo"]');
  return String(dos("landing_pix_gerado").at(-1)!.order_id);
}
const antesDe = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

const dateNow = Date.now;
afterEach(() => { vi.useRealTimers(); relogioBase = 0; Date.now = dateNow; Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true }); });
const relogioAndavel = () => { Date.now = () => dateNow() + relogioBase; };

describe("nos DOIS braços: braco_pix em todo evento; o atual é a tela de hoje", () => {
  it("todo evento landing_* leva braco_pix = b / atual / (sem atributo) atual", async () => {
    await abrir("b");
    await gerarPix();
    const l = eventos().filter((e) => e.nome.startsWith("landing_"));
    expect(l.length).toBeGreaterThan(3);
    for (const e of l) expect(e.braco_pix).toBe("b");
    expect(l.map((e) => e.nome)).toContain("landing_pix_gerado");
    await abrir("atual");
    for (const e of eventos()) expect(e.braco_pix).toBe("atual");
    await abrir(null);
    await gerarPix();
    for (const e of eventos()) expect(e.braco_pix).toBe("atual");
    expect(dos("landing_html")[0]).toMatchObject({ pix_forcado: false });
  });

  it("atual (e sem atributo): a tela do Pix de hoje — caixa verde, QR aberto, 'Copiar de novo', 'Esperando o pagamento', contador, 'Já paguei'; nada do b", async () => {
    for (const pix of ["atual", null] as const) {
      await abrir(pix);
      await gerarPix();
      expect(document.querySelector('[data-testid="landing-copiado"]')).not.toBeNull();
      expect(document.querySelector(".lp-esperando")).not.toBeNull();
      expect(txt(document.getElementById("lp-validade"))).toMatch(/^Este código vale por 29:5\d$/);
      expect(txt(document.getElementById("lp-copiar"))).toBe("Copiar de novo");
      expect(txt(document.getElementById("lp-ja-paguei"))).toBe("Já paguei");
      expect(document.querySelector(".lp-pixb")).toBeNull();
      expect(document.getElementById("lp-ver-qr")).toBeNull();
      expect(document.body.textContent).not.toContain(NOME_NO_BANCO);
      expect(document.body.textContent).not.toContain("No banco aparece");
    }
  });
});

describe("braço b · 'Recibo da marca' (fase qr)", () => {
  it("marca + nº do pedido, preço empilhado, passo ACIMA do botão, pílula 'Esperando o Pix · confirma sozinha · vale por', recibo (No banco aparece / Garantia / Acesso), QR dobrado, 'Ver QR code · Já paguei'", async () => {
    await abrir("b");
    const pedido = await gerarPix("maria@exemplo.com");
    const b = document.querySelector('[data-testid="landing-pixb"]')!;
    expect(b).not.toBeNull();
    expect(b.getAttribute("data-estado")).toBe("qr");
    expect(txt(b.querySelector(".lp-pixb-marca"))).toBe("CORE");
    expect(txt(b.querySelector(".lp-pixb-pedido"))).toBe(`Pedido ${pedido.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase()}`);
    expect(txt(b.querySelector(".lp-pixb-valor"))).toBe("R$ 27,90 Acesso vitalício · cobra 1 vez só");
    // o passo é o título, antes do botão (juiz visual/cliente fria: a 1ª coisa depois do preço é o que fazer, não "aguardando")
    const passo = b.querySelector('[data-testid="landing-pixb-passo"]')!, copiar = document.getElementById("lp-copiar")!, status = b.querySelector('[data-testid="landing-pixb-status"]')!;
    expect(txt(passo)).toBe("Código Pix copiado. Abra o banco → Pix → Copia e Cola.");
    expect(antesDe(b.querySelector(".lp-pixb-valor")!, passo)).toBe(true);
    expect(antesDe(passo, copiar)).toBe(true);
    expect(antesDe(copiar, status)).toBe(true);
    expect(txt(copiar)).toBe("Copiar de novo"); // r1: copiado=true → o botão não contradiz o título (como no atual)
    expect(txt(status)).toBe("Esperando o Pix vale por 29:59 Confirma sozinha. Pode ir ao banco e voltar."); // r1: "pode fechar" só no conferindo (o Instagram zera o storage)
    expect(document.getElementById("lp-validade")!.closest('[data-testid="landing-pixb-status"]')).toBe(status);
    // o recibo: o nome do banco como fato, com o CNPJ do Mercado Pago; garantia; o e-mail do acesso
    const banco = b.querySelector('[data-testid="landing-pixb-banco"]')!;
    expect(antesDe(status, banco)).toBe(true);
    expect(txt(banco)).toBe(`No banco aparece ${NOME_NO_BANCO} Nossa empresa · CNPJ ${CNPJ_NO_BANCO}`); // r1: cabe em 1 linha em 360/375
    const linhas = Array.from(b.querySelectorAll(".lp-pixb-l")).map(txt);
    expect(linhas).toEqual([txt(banco), "Garantia 7 dias · devolvemos 100% no Pix", "Acesso maria@exemplo.com"]);
    expect(txt(b.querySelector('[data-testid="landing-email-garantido"]'))).toBe("maria@exemplo.com");
    // "recorrente"/"Asaas" NUNCA na tela principal (lido frio vira aviso de golpe); nada de escassez
    expect(b.textContent).not.toMatch(/recorrente|Asaas|Só hoje|OFERTA ESPECIAL/i);
    // QR + código dobrados, mas presentes e completos (quem lê em outro aparelho acha)
    const qr = document.getElementById("lp-qr-dobrado")!;
    expect(qr.classList.contains("aberto")).toBe(false);
    expect(qr.querySelector("#lp-qr")).not.toBeNull();
    expect(txt(qr.querySelector('[data-testid="landing-codigo"]'))).toMatch(/^000201/);
    const links = Array.from(b.querySelectorAll(".lp-links button")).map(txt);
    expect(links).toEqual(["Ver QR code", "Já paguei"]);
    expect(document.getElementById("lp-mudar")).toBeNull();
    expect(document.getElementById("lp-card")!.dataset.fase).toBe("qr");
    // palavras no cartão (sem o código): enxuto
    const palavras = txt(b).replace(txt(qr.querySelector('[data-testid="landing-codigo"]')), "").split(" ").filter(Boolean).length;
    expect(palavras).toBeLessThan(80); // hoje: ~75 + a garantia fora do cartão
  });

  it("'Ver QR code' abre (rótulo vira 'Esconder QR') e manda landing_pix_qr_aberto 1× por pedido; fechar e abrir de novo não repete", async () => {
    await abrir("b");
    const pedido = await gerarPix();
    const ver = document.getElementById("lp-ver-qr") as HTMLButtonElement, qr = document.getElementById("lp-qr-dobrado")!;
    ver.click();
    expect(qr.classList.contains("aberto")).toBe(true);
    expect(txt(ver)).toBe("Esconder QR");
    expect(dos("landing_pix_qr_aberto")).toHaveLength(1);
    expect(dos("landing_pix_qr_aberto")[0]).toMatchObject({ order_id: pedido, braco_pix: "b" });
    ver.click();
    expect(qr.classList.contains("aberto")).toBe(false);
    expect(txt(ver)).toBe("Ver QR code");
    ver.click();
    expect(dos("landing_pix_qr_aberto")).toHaveLength(1);
  });

  it("o botão ('Copiar de novo' depois da cópia automática; 'Copiar código Pix' se ela falhou) responde 'Copiado ✓' por 1,5 s (sem perder a tela) e manda landing_pix_copiar_manual + landing_pix_copiado auto:false", async () => {
    await abrir("b");
    const pedido = await gerarPix();
    expect(dos("landing_pix_copiado")[0]).toMatchObject({ auto: true, order_id: pedido });
    const copiar = document.getElementById("lp-copiar") as HTMLButtonElement;
    copiar.click();
    await vi.waitFor(() => { expect(txt(document.getElementById("lp-copiar"))).toBe("Copiado ✓"); });
    expect(dos("landing_pix_copiar_manual")).toHaveLength(1);
    expect(dos("landing_pix_copiar_manual")[0]).toMatchObject({ ok: true, order_id: pedido, braco_pix: "b" });
    expect(dos("landing_pix_copiado").at(-1)).toMatchObject({ auto: false, via: "botao", order_id: pedido });
    expect(document.querySelector('[data-testid="landing-pixb"]')).not.toBeNull();
    await vi.waitFor(() => { expect(txt(document.getElementById("lp-copiar"))).toBe("Copiar de novo"); }, { timeout: 3000 });
    // a cópia automática falhou: título "Copie o código Pix." + botão "Copiar código Pix"
    const exec = document.execCommand;
    document.execCommand = () => false; // o plano C (textarea + execCommand) também falha
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { throw new Error("sem clipboard"); } }, configurable: true });
    await abrir("b");
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { throw new Error("sem clipboard"); } }, configurable: true });
    await gerarPix();
    document.execCommand = exec;
    expect(txt(document.querySelector('[data-testid="landing-pixb-passo"]'))).toBe("Copie o código Pix. Abra o banco → Pix → Copia e Cola.");
    expect(txt(document.getElementById("lp-copiar"))).toBe("Copiar código Pix");
  });

  it("'Já paguei' com o pagamento caído: landing_pix_ja_paguei {resultado: pago} e a fase 'pago' de hoje (igual nos 2 braços) → conta pronta", async () => {
    await abrir("b");
    const pedido = await gerarPix("maria@exemplo.com");
    (document.getElementById("lp-ja-paguei") as HTMLButtonElement).click();
    await espera('[data-testid="landing-pago"], [data-testid="landing-conta"]');
    expect(dos("landing_cta").some((e) => e.onde === "ja_paguei")).toBe(true);
    expect(dos("landing_pix_ja_paguei")[0]).toMatchObject({ order_id: pedido, resultado: "pago", braco_pix: "b" });
    expect(dos("landing_pix_pago")[0]).toMatchObject({ order_id: pedido });
    await espera('[data-testid="landing-conta"]');
    expect(document.querySelector(".lp-pixb")).toBeNull();
    expect(document.getElementById("lp-card")!.dataset.fase).toBe("conta");
    expect(document.body.textContent).toContain("Sua conta está pronta");
  });

  it("'Já paguei' sem o pagamento: 'Conferindo com o banco… pode fechar esta página' (com o e-mail), o link vira 'Conferindo…'; depois de 2,5 min volta a 'Esperando o Pix' com o aviso de hoje", async () => {
    await abrir("b");
    const pedido = await gerarPix("maria@exemplo.com");
    (window as unknown as { __landingSimularPixNaoCaiu: boolean }).__landingSimularPixNaoCaiu = true;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (document.getElementById("lp-ja-paguei") as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(700);
    const b = document.querySelector('[data-testid="landing-pixb"]')!;
    expect(b.getAttribute("data-estado")).toBe("conferindo");
    expect(dos("landing_pix_ja_paguei")[0]).toMatchObject({ order_id: pedido, resultado: "nao" });
    // r2 (persona M1 / visual M2): quem disse "já paguei" não recebe o botão preto "Copiar de novo" nem o "vale por" — o passo vira o status,
    // a pílula diz que pode fechar e por onde o acesso chega (o e-mail), o recibo fica inteiro
    expect(txt(b.querySelector('[data-testid="landing-pixb-passo"]'))).toBe("Conferindo com o banco… Às vezes leva alguns minutos.");
    expect(document.getElementById("lp-copiar")).toBeNull();
    expect(document.getElementById("lp-validade")).toBeNull();
    expect(txt(b.querySelector('[data-testid="landing-pixb-status"]'))).toBe("Pode fechar esta página O acesso chega em maria@exemplo.com assim que o Pix cair.");
    expect(txt(b.querySelector('[data-testid="landing-pixb-conferindo"]'))).toBe("O acesso chega em maria@exemplo.com assim que o Pix cair.");
    expect(Array.from(b.querySelectorAll(".lp-pixb-l dt")).map(txt)).toEqual(["No banco aparece", "Garantia", "Acesso"]);
    expect((document.getElementById("lp-ja-paguei") as HTMLButtonElement).disabled).toBe(true);
    expect(txt(document.getElementById("lp-ja-paguei"))).toBe("Conferindo…");
    expect(document.getElementById("lp-ver-qr")).not.toBeNull(); // quem precisar copiar abre o QR
    expect(document.querySelector(".lp-aviso")).toBeNull();
    await vi.advanceTimersByTimeAsync(150_500);
    const b2 = document.querySelector('[data-testid="landing-pixb"]')!;
    expect(b2.getAttribute("data-estado")).toBe("qr");
    expect(txt(b2.querySelector(".lp-aviso"))).toBe("Ainda não chegou. Confere no app do banco — quando cair, esta tela muda sozinha.");
    expect(txt(document.getElementById("lp-copiar"))).toBe("Copiar de novo");
    expect(txt(document.getElementById("lp-validade"))).toMatch(/^vale por 2[67]:\d\d$/);
    expect((document.getElementById("lp-ja-paguei") as HTMLButtonElement).disabled).toBe(false);
    // o pagamento cai durante o "conferindo": sai pro pago normal
    vi.useRealTimers();
    (window as unknown as { __landingSimularPixNaoCaiu: boolean }).__landingSimularPixNaoCaiu = true;
    (document.getElementById("lp-ja-paguei") as HTMLButtonElement).click();
    await vi.waitFor(() => { expect(document.querySelector('[data-testid="landing-pixb"]')!.getAttribute("data-estado")).toBe("conferindo"); });
    simular().pagar();
    await espera('[data-testid="landing-pago"], [data-testid="landing-conta"]');
  });

  it("voltou do banco sem pagar (≥ 5 s fora): 1ª linha pra quem pagou ('Pagou? Confirma em instantes.'), 2ª pra quem não ('O código continua copiado'); botão de CONTORNO; o recibo INTEIRO (nome no banco, garantia, acesso — sem 'Asaas'/'recorrente'); 'Falar com a gente' nos links; nada dobrado; 'Já paguei' continua; sem chips por padrão", async () => {
    await abrir("b");
    relogioAndavel();
    const pedido = await gerarPix();
    andar(3000);
    visivel("hidden");
    expect(dos("landing_pix_saiu")).toHaveLength(1);
    expect(dos("landing_pix_saiu")[0]).toMatchObject({ vez: 1, via: "aba", order_id: pedido, braco_pix: "b" });
    expect(Number(dos("landing_pix_saiu")[0].s_na_tela)).toBeGreaterThanOrEqual(2);
    andar(90_000);
    visivel("visible");
    expect(dos("landing_voltou")).toHaveLength(1);
    expect(dos("landing_voltou")[0]).toMatchObject({ fase: "qr", com_pix: true, order_id: pedido, via: "aba", ausente_s: 90, braco_pix: "b" });
    expect(dos("landing_pix_volta_vista")[0]).toMatchObject({ order_id: pedido, via: "aba" });
    const b = document.querySelector('[data-testid="landing-pixb"]')!;
    expect(b.getAttribute("data-estado")).toBe("voltou");
    // r2 (persona A1/M1, visual A1/M2): a 1ª linha fala com quem pagou, a 2ª com quem não; nada de "não pagou" (10% das confirmações levam 10+ min)
    const passo = b.querySelector('[data-testid="landing-pixb-passo"]')!, copiar = document.getElementById("lp-copiar")!, status = b.querySelector('[data-testid="landing-pixb-status"]')!;
    expect(txt(passo)).toBe("Pagou? Confirma em instantes. O código continua copiado, se precisar.");
    expect(txt(status)).toMatch(/^Esperando o Pix vale por 28:2\d Confirma sozinha\. Pode ir ao banco e voltar\.$/); // 93 s depois
    expect(antesDe(passo, copiar) && antesDe(copiar, status)).toBe(true);
    // o botão deixa de ser o preto: contorno (como o .lp-copiar de hoje), "Copiar de novo"
    expect(copiar.classList.contains("contorno")).toBe(true);
    expect(txt(copiar)).toBe("Copiar de novo");
    // o recibo fica INTEIRO — é o que responde a quem voltou do banco sem pagar; nada atrás de "Ver"
    expect(b.querySelector("details")).toBeNull();
    expect(b.querySelector('[data-testid="landing-pixb-duvida"]')).toBeNull();
    expect(b.querySelector('[data-testid="landing-pixb-volta"]')).toBeNull();
    expect(Array.from(b.querySelectorAll(".lp-pixb-l dt")).map(txt)).toEqual(["No banco aparece", "Garantia", "Acesso"]);
    const linhas = Array.from(b.querySelectorAll(".lp-pixb-l")).map(txt);
    // dono 02/11: sem a linha do "Asaas"/"recorrente" (nem aqui)
    expect(linhas[0]).toBe(`No banco aparece ${NOME_NO_BANCO} Nossa empresa · CNPJ ${CNPJ_NO_BANCO}`);
    expect(linhas[1]).toBe("Garantia 7 dias · devolvemos 100% no Pix");
    expect(linhas[2]).toBe("Acesso maria@exemplo.com");
    expect(b.textContent).not.toMatch(/não pagou/i);
    // "Falar com a gente" na linha dos links (a caixa certa: contato@), sem crescer o cartão
    const falar = b.querySelector("#lp-pixb-falar") as HTMLAnchorElement;
    expect(falar.closest(".lp-links")).not.toBeNull();
    expect(falar.getAttribute("href")).toBe("mailto:contato@coreaplicativo.com.br");
    expect(Array.from(b.querySelectorAll(".lp-links .lp-link")).map(txt)).toEqual(["Ver QR code", "Já paguei", "Falar com a gente"]);
    expect(b.querySelector('[data-testid="landing-pixb-chips"]')).toBeNull();
    expect(txt(document.getElementById("lp-ja-paguei"))).toBe("Já paguei");
    expect((document.getElementById("lp-ja-paguei") as HTMLButtonElement).disabled).toBe(false);
    expect(document.getElementById("lp-ver-qr")).not.toBeNull();
    // 2ª ida e volta: vez 2, o estado não se repete, nada quebra
    andar(2000); visivel("hidden"); andar(30_000); visivel("visible");
    expect(dos("landing_pix_saiu").at(-1)).toMatchObject({ vez: 2, via: "aba" });
    expect(dos("landing_voltou")).toHaveLength(2);
    expect(dos("landing_pix_volta_vista")).toHaveLength(1);
    // < 5 s fora não conta como ida ao banco
    visivel("hidden"); andar(2000); visivel("visible");
    expect(dos("landing_voltou")).toHaveLength(2);
  });

  it("com PIX_MOTIVO ligado: chips 'O que te travou?' no estado voltou; o toque manda landing_pix_motivo e vira 'Anotado'", async () => {
    await abrir("b", { motivo: true });
    relogioAndavel();
    const pedido = await gerarPix();
    simular().voltou();
    const chips = document.querySelector('[data-testid="landing-pixb-chips"]')!;
    expect(chips.previousElementSibling).toBe(document.querySelector('[data-testid="landing-pixb-status"]')); // r2 (persona B8): logo abaixo da pílula, antes do recibo
    expect(Array.from(chips.querySelectorAll("button")).map(txt)).toEqual(["O nome no banco", "O valor", "Deixo pra depois", "Outra coisa"]);
    (chips.querySelector('button[data-motivo="nome"]') as HTMLButtonElement).click();
    expect(dos("landing_pix_motivo")[0]).toMatchObject({ order_id: pedido, motivo: "nome", braco_pix: "b" });
    expect(document.querySelector('[data-testid="landing-pixb-chips"]')).toBeNull();
    expect(txt(document.querySelector('[data-testid="landing-pixb-motivo-ok"]'))).toBe("Anotado. Obrigada!");
    expect(document.querySelector('[data-testid="landing-pixb"]')!.getAttribute("data-estado")).toBe("voltou");
  });

  it("a volta por RECARGA (o Instagram recarrega a aba): landing_voltou {via: recarga} com o tempo fora, e o b mostra o bloco", async () => {
    await abrir("b");
    relogioAndavel();
    const pedido = await gerarPix();
    andar(4000);
    visivel("hidden");
    expect(localStorage.getItem("landing-pix-saiu-v1")).toContain(pedido);
    andar(80_000);
    await abrir("b", { manterStorage: true });
    relogioAndavel();
    await espera('[data-testid="landing-pixb"]');
    expect(dos("landing_voltou")).toHaveLength(1);
    expect(dos("landing_voltou")[0]).toMatchObject({ via: "recarga", com_pix: true, order_id: pedido, fase: "qr", braco_pix: "b" });
    expect(Number(dos("landing_voltou")[0].ausente_s)).toBeGreaterThanOrEqual(80);
    expect(dos("landing_pix_volta_vista")[0]).toMatchObject({ via: "recarga" });
    const b = document.querySelector('[data-testid="landing-pixb"]')!;
    expect(b.getAttribute("data-estado")).toBe("voltou");
    // r2 (persona M2): a página nova sabe que o código já foi copiado (marca da saída) — o título reconhece a volta e o botão é "Copiar de novo"
    expect(txt(b.querySelector('[data-testid="landing-pixb-passo"]'))).toBe("De volta? Se já pagou, confirma em instantes. O código continua copiado, se precisar.");
    expect(txt(document.getElementById("lp-copiar"))).toBe("Copiar de novo");
    expect(document.getElementById("lp-copiar")!.classList.contains("contorno")).toBe(true);
    expect(localStorage.getItem("landing-pix-saiu-v1")).toBeNull(); // a marca é de 1 uso
    // a 2ª saída desta página conta a partir da 1ª (vez 2)
    visivel("hidden");
    expect(dos("landing_pix_saiu").at(-1)).toMatchObject({ vez: 2 });
  });

  it("'Conferindo…' não dá lugar ao bloco 'De volta?' (ela disse que pagou); o Pix pago limpa tudo", async () => {
    await abrir("b");
    await gerarPix();
    (window as unknown as { __landingSimularPixNaoCaiu: boolean }).__landingSimularPixNaoCaiu = true;
    (document.getElementById("lp-ja-paguei") as HTMLButtonElement).click();
    await vi.waitFor(() => { expect(document.querySelector('[data-testid="landing-pixb"]')!.getAttribute("data-estado")).toBe("conferindo"); });
    simular().voltou();
    expect(document.querySelector('[data-testid="landing-pixb"]')!.getAttribute("data-estado")).toBe("conferindo");
    expect(dos("landing_voltou")).toHaveLength(1);
    expect(dos("landing_pix_volta_vista")).toHaveLength(0);
  });

  it("o código vence: o cartão volta pra oferta (como no atual) e o relógio da pílula diz 'venceu' antes", async () => {
    await abrir("b");
    await gerarPix();
    simular().vencer();
    await vi.waitFor(() => { expect(document.getElementById("lp-card")!.dataset.fase).toBe("oferta"); }, { timeout: 5000 });
    expect(document.querySelector(".lp-pixb")).toBeNull();
    expect(document.getElementById("lp-pagar")).not.toBeNull();
  });

  it("braço livre (sem e-mail antes): a linha 'Acesso' traz o campo opcional; salvar vira o e-mail na linha", async () => {
    await abrir("b", { checkout: "livre" });
    await gerarPix();
    const campo = document.getElementById("lp-email-pix") as HTMLInputElement;
    expect(campo).not.toBeNull();
    expect(campo.closest(".lp-pixb-l")!.querySelector("dt")!.textContent).toBe("Acesso");
    expect(txt(document.querySelector('[data-testid="landing-pixb-status"]'))).toMatch(/confirma sozinha/i);
    expect(document.querySelector('[data-testid="landing-email-garantido"]')).toBeNull();
    digitar("lp-email-pix", "ana@exemplo.com");
    (document.getElementById("lp-email-pix-ok") as HTMLButtonElement).click();
    await espera('[data-testid="landing-email-garantido"]');
    expect(txt(document.querySelector('[data-testid="landing-email-garantido"]'))).toBe("ana@exemplo.com");
    expect(document.getElementById("lp-email-pix")).toBeNull();
    expect(dos("landing_email_pix")[0]).toMatchObject({ ok: true });
  });

  it("chegou pelo e-mail de lembrete (?r=t12, doEmail): a pílula promete o e-mail, não 'confirma sozinha'; 'Já paguei' sem pago fala do e-mail", async () => {
    await abrir("b");
    await gerarPix("maria@exemplo.com");
    const codigo = txt(document.querySelector('[data-testid="landing-codigo"]'));
    await abrir("b", { url: `/organizar?r=t12&pedido=pedido-teste-123&pix=${encodeURIComponent(codigo)}&vence=${Date.now() + 20 * 60_000}&o=LN_sempre279` });
    await espera('[data-testid="landing-pixb"]');
    expect(dos("landing_lembrete_volta")[0]).toMatchObject({ restaurado: "link" });
    expect(txt(document.querySelector('[data-testid="landing-pixb-status"]'))).toMatch(/^Esperando o Pix vale por \d\d:\d\d Quando o Pix cair, o acesso chega no seu e-mail\.$/);
    expect(txt(document.querySelector('[data-testid="landing-email-garantido"]'))).toBe("no seu e-mail");
    (window as unknown as { __landingSimularPixNaoCaiu: boolean }).__landingSimularPixNaoCaiu = true;
    (document.getElementById("lp-ja-paguei") as HTMLButtonElement).click();
    await vi.waitFor(() => { expect(document.querySelector('[data-testid="landing-pixb"]')!.getAttribute("data-estado")).toBe("conferindo"); });
    expect(txt(document.querySelector('[data-testid="landing-pixb-conferindo"]'))).toBe("O acesso chega no seu e-mail assim que o Pix cair.");
  });

  it("página v2 + b: o cartão do Pix é o do b (sem os 3 passos do v2), e pagar segue pro pós-pago do v2", async () => {
    await abrir("b", { lp: "v2" });
    await gerarPix("maria@exemplo.com");
    expect(document.querySelector('[data-testid="landing-pixb"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="landing-passos"]')).toBeNull();
    expect(document.querySelector('[data-testid="landing-volte"]')).toBeNull();
    simular().pagar();
    await espera('[data-testid="landing-conta"]');
    expect(document.querySelector(".lp-pixb")).toBeNull();
  });

  it("Pix gerado de novo (depois de vencer) começa limpo: sem bloco 'De volta?', sem 'conferindo'", async () => {
    await abrir("b");
    await gerarPix();
    simular().voltou();
    expect(document.querySelector('[data-testid="landing-pixb"]')!.getAttribute("data-estado")).toBe("voltou");
    simular().vencer();
    await vi.waitFor(() => { expect(document.getElementById("lp-card")!.dataset.fase).toBe("oferta"); }, { timeout: 5000 });
    await gerarPix();
    expect(document.querySelector('[data-testid="landing-pixb"]')!.getAttribute("data-estado")).toBe("qr");
    expect(document.getElementById("lp-pixb-falar")).toBeNull();
    expect(dos("landing_pix_gerado")).toHaveLength(2);
  });
});

describe("a medição nos DOIS braços (sem mudar o visual do atual)", () => {
  it("atual: landing_pix_saiu {s_na_tela, vez, order_id} na aba escondida; landing_voltou {via: aba, order_id}; nada muda na tela", async () => {
    await abrir("atual");
    relogioAndavel();
    const pedido = await gerarPix();
    const antes = document.getElementById("lp-pix")!.innerHTML;
    andar(6000);
    visivel("hidden");
    expect(dos("landing_pix_saiu")[0]).toMatchObject({ vez: 1, order_id: pedido, braco_pix: "atual" });
    expect(Number(dos("landing_pix_saiu")[0].s_na_tela)).toBeGreaterThanOrEqual(5);
    andar(100_000);
    visivel("visible");
    expect(dos("landing_voltou")[0]).toMatchObject({ via: "aba", com_pix: true, order_id: pedido, ausente_s: 100, braco_pix: "atual" });
    expect(dos("landing_pix_volta_vista")).toHaveLength(0);
    expect(document.getElementById("lp-pix")!.innerHTML).toBe(antes);
    expect(document.querySelector(".lp-pixb-volta")).toBeNull();
  });

  it("atual: a volta por recarga manda landing_voltou {via: recarga} (antes era invisível) e a tela é a de hoje", async () => {
    await abrir("atual");
    relogioAndavel();
    const pedido = await gerarPix();
    visivel("hidden");
    andar(60_000);
    await abrir("atual", { manterStorage: true });
    relogioAndavel();
    await espera('[data-testid="landing-codigo"]');
    expect(dos("landing_voltou")[0]).toMatchObject({ via: "recarga", order_id: pedido, com_pix: true, braco_pix: "atual" });
    expect(document.querySelector('[data-testid="landing-copiado"]')).toBeNull(); // na recarga o atual não repete "copiado" (copiado = null), como hoje
    expect(document.querySelector(".lp-esperando")).not.toBeNull();
    expect(document.querySelector(".lp-pixb")).toBeNull();
  });

  it("atual: landing_pix_ja_paguei {resultado} e landing_pix_copiar_manual, sem tirar landing_cta/landing_pix_copiado", async () => {
    await abrir("atual");
    const pedido = await gerarPix();
    (document.getElementById("lp-copiar") as HTMLButtonElement).click();
    await vi.waitFor(() => { expect(dos("landing_pix_copiar_manual")).toHaveLength(1); });
    expect(dos("landing_pix_copiar_manual")[0]).toMatchObject({ ok: true, order_id: pedido, braco_pix: "atual" });
    expect(dos("landing_pix_copiado").at(-1)).toMatchObject({ auto: false, via: "botao" });
    (window as unknown as { __landingSimularPixNaoCaiu: boolean }).__landingSimularPixNaoCaiu = true;
    (document.getElementById("lp-ja-paguei") as HTMLButtonElement).click();
    await vi.waitFor(() => { expect(dos("landing_pix_ja_paguei")).toHaveLength(1); });
    expect(dos("landing_pix_ja_paguei")[0]).toMatchObject({ order_id: pedido, resultado: "nao", braco_pix: "atual" });
    expect(dos("landing_cta").some((e) => e.onde === "ja_paguei")).toBe(true);
    expect(txt(document.querySelector(".lp-aviso"))).toBe("Ainda não chegou. Confere no app do banco — quando cair, esta tela muda sozinha.");
    expect(document.querySelector(".lp-pixb")).toBeNull();
    (window as unknown as { __landingSimularPixNaoCaiu: boolean }).__landingSimularPixNaoCaiu = false;
    (document.getElementById("lp-ja-paguei") as HTMLButtonElement).click();
    await espera('[data-testid="landing-pago"], [data-testid="landing-conta"]');
    expect(dos("landing_pix_ja_paguei").at(-1)).toMatchObject({ resultado: "pago" });
  });

  it("landing_pix_rolou 1× por pedido (≥ 40 px depois da rolagem programada E de um toque/roda real), nos 2 braços", async () => {
    for (const pix of ["atual", "b"] as const) {
      await abrir(pix);
      const pedido = await gerarPix();
      Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
      window.dispatchEvent(new Event("scroll"));
      expect(dos("landing_pix_rolou")).toHaveLength(0); // antes da linha de base (800 ms) não conta
      await dormir(900);
      Object.defineProperty(window, "scrollY", { value: 120, configurable: true });
      window.dispatchEvent(new Event("scroll"));
      expect(dos("landing_pix_rolou")).toHaveLength(0); // r2 (persona M3): scrollY mexeu SEM toque (barra do Instagram, teclado, rolagem suave) não conta
      window.dispatchEvent(new Event("touchstart"));
      Object.defineProperty(window, "scrollY", { value: 20, configurable: true });
      window.dispatchEvent(new Event("scroll"));
      expect(dos("landing_pix_rolou")).toHaveLength(0); // < 40 px
      Object.defineProperty(window, "scrollY", { value: 120, configurable: true });
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("scroll"));
      expect(dos("landing_pix_rolou")).toHaveLength(1);
      expect(dos("landing_pix_rolou")[0]).toMatchObject({ order_id: pedido, braco_pix: pix });
      Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    }
  });

  it("pagehide com o QR na tela e sem pagar: landing_pix_abandono {s_total, saidas, idas_banco, order_id} — a saída FINAL não é ida ao banco (saidas = as anteriores; idas_banco = voltas de ≥ 5 s); pagehide sem esconder antes = saiu {via: pagehide}; depois de pago, nada", async () => {
    for (const pix of ["atual", "b"] as const) {
      await abrir(pix);
      relogioAndavel();
      const pedido = await gerarPix();
      andar(3000); visivel("hidden"); andar(20_000); visivel("visible");
      andar(7000);
      visivel("hidden");
      window.dispatchEvent(new Event("pagehide"));
      expect(dos("landing_pix_saiu")).toHaveLength(2); // o hidden e o pagehide da mesma saída = 1 saída
      expect(dos("landing_pix_saiu").map((e) => e.via)).toEqual(["aba", "aba"]);
      const ab = dos("landing_pix_abandono");
      expect(ab).toHaveLength(1);
      // r2 (técnico M2): antes vinha saidas:2 (contava a própria saída final); agora 1 ida ao banco antes + 1 volta de ≥ 5 s
      expect(ab[0]).toMatchObject({ saidas: 1, idas_banco: 1, order_id: pedido, braco_pix: pix });
      expect(Number(ab[0].s_total)).toBeGreaterThanOrEqual(30);
      visivel("visible");
      // pagehide SEM esconder antes (navegou/recarregou com a aba visível): o saiu vai com via:"pagehide" e não vira "ida ao banco"
      window.dispatchEvent(new Event("pagehide"));
      expect(dos("landing_pix_saiu")).toHaveLength(3);
      expect(dos("landing_pix_saiu")[2]).toMatchObject({ via: "pagehide", vez: 3, order_id: pedido });
      expect(dos("landing_pix_abandono")[1]).toMatchObject({ saidas: 2, idas_banco: 1 });
      simular().pagar();
      await espera('[data-testid="landing-pago"], [data-testid="landing-conta"]');
      window.dispatchEvent(new Event("pagehide"));
      expect(dos("landing_pix_abandono")).toHaveLength(2);
      expect(dos("landing_pix_saiu")).toHaveLength(3);
    }
  });

  it("r1: todo evento leva pix_forcado (não só o landing_html) — a análise exclui os Pix de teste do dono/QA", async () => {
    (window as unknown as { __landing?: unknown }).__landing = { pix_forcado: true };
    await abrir("b");
    await gerarPix();
    for (const e of eventos()) expect(e.pix_forcado).toBe(true);
    (window as unknown as { __landing?: unknown }).__landing = undefined;
    await abrir("b");
    await gerarPix();
    for (const e of eventos()) expect(e.pix_forcado).toBe(false);
  });

  it("r1: a volta por RECARGA manda landing_pix_abandono_cancelado (a página velha mandou abandono no pagehide da recarga) e o s_total continua de onde parou, nos 2 braços", async () => {
    for (const pix of ["atual", "b"] as const) {
      await abrir(pix);
      relogioAndavel();
      const pedido = await gerarPix();
      andar(40_000);
      visivel("hidden");
      window.dispatchEvent(new Event("pagehide"));
      expect(dos("landing_pix_abandono")[0]).toMatchObject({ order_id: pedido, saidas: 0, idas_banco: 0 }); // r2: a saída final não é ida ao banco
      andar(60_000);
      await abrir(pix, { manterStorage: true });
      relogioAndavel();
      await espera('[data-testid="landing-codigo"]');
      expect(dos("landing_pix_abandono_cancelado")).toHaveLength(1);
      expect(dos("landing_pix_abandono_cancelado")[0]).toMatchObject({ order_id: pedido, braco_pix: pix, ausente_s: 60 });
      expect(dos("landing_voltou")[0]).toMatchObject({ via: "recarga", order_id: pedido });
      andar(10_000);
      visivel("hidden");
      window.dispatchEvent(new Event("pagehide"));
      const ab = dos("landing_pix_abandono").at(-1)!;
      expect(ab).toMatchObject({ order_id: pedido, saidas: 1, idas_banco: 1 }); // a 1ª saída (da marca) + a volta por recarga; a saída final de novo fora
      expect(Number(ab.s_total)).toBeGreaterThanOrEqual(110); // 40 + 60 + 10: não recomeçou na recarga
    }
  });

  it("r1 (técnico): o Instagram zera localStorage E sessionStorage na volta do banco — o cookie do Pix vivo (core_ln_pix) reabre o MESMO QR e o cookie da saída (core_ln_saiu) ainda vê a volta, nos 2 braços", async () => {
    for (const pix of ["atual", "b"] as const) {
      await abrir(pix);
      relogioAndavel();
      const pedido = await gerarPix("maria@exemplo.com");
      expect(document.cookie).toMatch(/core_ln_pix=/);
      andar(3000);
      visivel("hidden");
      expect(document.cookie).toMatch(/core_ln_saiu=/);
      localStorage.clear(); sessionStorage.clear();
      andar(70_000);
      await abrir(pix, { manterStorage: true });
      relogioAndavel();
      await espera('[data-testid="landing-codigo"]');
      expect(document.getElementById("lp-card")!.dataset.fase).toBe("qr"); // não voltou pra oferta (sem 2º Pix)
      expect(dos("landing_pix_restaurado")[0]).toMatchObject({ order_id: pedido, sem_sessao: true, com_email: true, braco_pix: pix });
      expect(dos("landing_voltou")[0]).toMatchObject({ via: "recarga", order_id: pedido, com_pix: true, braco_pix: pix, ausente_s: 70 });
      expect(document.cookie).not.toMatch(/core_ln_saiu=/); // a marca é de 1 uso
      // r2 (técnico ALTA 1 / persona M2): a SESSÃO foi junto com o storage — a página não promete mais "confirma sozinha" (modo do lembrete:
      // o acesso chega no e-mail, que o cookie do Pix vivo guardou e a linha "Acesso" ainda mostra)
      expect(document.querySelector('[data-testid="landing-email-garantido"]')!.textContent).toContain("maria@exemplo.com");
      if (pix === "b") {
        const b = document.querySelector('[data-testid="landing-pixb"]')!;
        expect(b.getAttribute("data-estado")).toBe("voltou");
        expect(txt(b.querySelector('[data-testid="landing-pixb-status"]'))).toMatch(/Quando o Pix cair, o acesso chega no seu e-mail\.$/);
        expect(txt(b.querySelector('[data-testid="landing-pixb-passo"]'))).toMatch(/^De volta\? Se já pagou, confirma em instantes\./);
        expect(b.textContent).not.toContain("Confirma sozinha");
      } else {
        expect(txt(document.querySelector(".lp-esperando"))).toBe("Esperando o pagamento Quando o pagamento cair, o acesso chega no seu e-mail.");
        expect(document.body.textContent).not.toContain("Esta tela confirma sozinha");
      }
      // "Já paguei" sem o banco confirmar: fala do e-mail, nunca "esta tela muda sozinha"
      (window as unknown as { __landingSimularPixNaoCaiu: boolean }).__landingSimularPixNaoCaiu = true;
      (document.getElementById("lp-ja-paguei") as HTMLButtonElement).click();
      await vi.waitFor(() => { expect(dos("landing_pix_ja_paguei")).toHaveLength(1); });
      if (pix === "atual") expect(txt(document.querySelector(".lp-aviso"))).toBe("Se você já pagou, o acesso chega no seu e-mail em instantes.");
      else expect(txt(document.querySelector('[data-testid="landing-pixb-conferindo"]'))).toBe("O acesso chega em maria@exemplo.com assim que o Pix cair.");
      simular().pagar();
      await espera('[data-testid="landing-pago"], [data-testid="landing-conta"]');
      expect(document.cookie).not.toMatch(/core_ln_pix=/);
    }
  });

  it("r2 (técnico): a sessão sobreviveu no localStorage (só o estado do Pix sumiu) → o QR restaurado segue 'confirma sozinha' (sem doEmail); o e-mail vem do cookie; o cookie não leva e-mail estranho", async () => {
    await abrir("b");
    relogioAndavel();
    const pedido = await gerarPix("maria@exemplo.com");
    expect(decodeURIComponent(document.cookie)).toContain('"e":"maria@exemplo.com"');
    andar(3000); visivel("hidden");
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem("sb-itoylenzvahbscgjgtqf-auth-token", "{}"); // a sessão (de mentira) ficou
    andar(20_000);
    await abrir("b", { manterStorage: true });
    relogioAndavel();
    await espera('[data-testid="landing-pixb"]');
    expect(dos("landing_pix_restaurado")[0]).toMatchObject({ order_id: pedido, sem_sessao: false, com_email: true });
    expect(txt(document.querySelector('[data-testid="landing-pixb-status"]'))).toMatch(/Confirma sozinha\. Pode ir ao banco e voltar\.$/);
    expect(txt(document.querySelector('[data-testid="landing-email-garantido"]'))).toBe("maria@exemplo.com");
    for (const e of eventos()) expect(JSON.stringify(e)).not.toMatch(/maria@exemplo/);
  });

  it("r1 (persona): o aviso 'Ainda não chegou…' do 'Já paguei' não sobrevive até a conta pronta, nos 2 braços", async () => {
    for (const pix of ["atual", "b"] as const) {
      await abrir(pix);
      await gerarPix("maria@exemplo.com");
      (window as unknown as { __landingSimularPixNaoCaiu: boolean }).__landingSimularPixNaoCaiu = true;
      (document.getElementById("lp-ja-paguei") as HTMLButtonElement).click();
      await vi.waitFor(() => { expect(dos("landing_pix_ja_paguei")).toHaveLength(1); });
      if (pix === "atual") expect(document.querySelector(".lp-aviso")).not.toBeNull();
      simular().pagar();
      await espera('[data-testid="landing-conta"]');
      expect(document.body.textContent).toContain("Sua conta está pronta");
      expect(document.body.textContent).not.toContain("Ainda não chegou");
      expect(document.querySelector("#lp-pix .lp-aviso")).toBeNull();
    }
  });

  it("nenhum evento novo leva e-mail, uid ou token", async () => {
    await abrir("b");
    relogioAndavel();
    await gerarPix("maria@exemplo.com");
    (document.getElementById("lp-copiar") as HTMLButtonElement).click();
    andar(3000); visivel("hidden"); andar(9000); visivel("visible");
    (document.getElementById("lp-ver-qr") as HTMLButtonElement).click();
    await dormir(50);
    for (const e of eventos()) {
      const s = JSON.stringify(e);
      expect(s).not.toMatch(/maria@exemplo|token|uid/i);
    }
    const nomes = new Set(eventos().map((e) => e.nome));
    for (const n of ["landing_pix_gerado", "landing_pix_copiado", "landing_pix_copiar_manual", "landing_pix_saiu", "landing_voltou", "landing_pix_volta_vista", "landing_pix_qr_aberto"]) expect(nomes.has(n)).toBe(true);
  });
});
