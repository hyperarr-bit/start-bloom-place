/**
 * LANDING NOVA (/organizar, 28/10 — DESLIGADA). Confere:
 *   · a CHAVE no <head> do landing.html: desligada = volta pro /inicio com a mesma query (o site de sempre);
 *     ?landing=on liga neste navegador; os A/B de título (a|b|c) e de oferta (ano|sempre) forçáveis e, ligados,
 *     estáveis por aparelho;
 *   · a divisão 50/50 do /inicio (index.html) desligada, forçável, e sem laço com a landing desligada (ld=1);
 *   · as ofertas LN_* iguais no site e no servidor, entrando nos mapas do /hoje (planos, boas-vindas com lojas);
 *   · a demo: rota dos 16 módulos troca na própria demo; o resto vira "oferta";
 *   · o Pix SIMULADO na página: gerando → QR + código → pago → e-mail → conta → "Abrir meu CORE" + lojas; sem upsell;
 *     e o estado volta depois de a aba recarregar (o banco).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CONCESSAO_HOJE, DESCRICAO_HOJE, OFERTAS_PLANO_HOJE, PRECOS_HOJE, ehPlanoHoje,
} from "../../supabase/functions/_shared/ofertas-hoje";
import { PRECOS_LANDING } from "../../supabase/functions/_shared/ofertas-landing";
import { emailVendaComLojas, nomeDoProduto, periodoDoEmailVenda, planoUtmify } from "../../supabase/functions/_shared/email-venda";
import {
  VALOR_OFERTA, desvioNaLanding, estadoQueVolta, moduloDaLanding, ofertaEscolhida, MODULOS_LANDING, MODULO_DA_AREA,
} from "@/landing/regras";
import { ehCaminhoDeDemo } from "@/lib/caminho-demo";

const raiz = resolve(__dirname, "../..");
const HTML = readFileSync(resolve(raiz, "landing.html"), "utf8");
const INDEX = readFileSync(resolve(raiz, "index.html"), "utf8");

/* ───────── o script do <head>, rodado de verdade num ambiente falso ───────── */
const scriptDaCabeca = HTML.match(/<script>\s*(\(function \(\) \{\s*var LANDING_NOVA[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];
/** 28/10: a /organizar foi LIGADA pelo dono (link simples); o comportamento "desligada" segue testado com a chave trocada. */
const scriptDesligado = scriptDaCabeca.replace(/var LANDING_NOVA = "on";[^\n]*/, 'var LANDING_NOVA = "off";');
const scriptDaDivisao = INDEX.match(/<script>\s*\/\/ ─── LANDING NOVA × \/inicio[\s\S]*?(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];

function rodar(fonte: string, url: string, store: Record<string, string> = {}, aleatorio = 0.3) {
  const u = new URL(url, "https://www.coreaplicativo.com.br");
  const attrs: Record<string, string> = {};
  const replace = vi.fn();
  const location = { search: u.search, hash: u.hash, pathname: u.pathname, hostname: "localhost", replace };
  const localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
  };
  const document = { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } } };
  const window: Record<string, unknown> = { localStorage };
  const Mat = Object.create(Math); Mat.random = () => aleatorio;
  // eslint-disable-next-line no-new-func
  new Function("location", "document", "window", "localStorage", "URLSearchParams", "Math", "fetch", "sessionStorage", fonte)(
    location, document, window, localStorage, URLSearchParams, Mat, undefined, { getItem: () => null },
  );
  return { attrs, replace, store, window };
}

describe("a chave da landing (head do landing.html)", () => {
  it("a página ligada (28/10, link simples /organizar); os A/B e a divisão do /inicio vêm DESLIGADOS no código", () => {
    expect(HTML).toMatch(/var LANDING_NOVA = "on";/);
    expect(HTML).toMatch(/var AB_TITULO = "off";/);
    expect(HTML).toMatch(/var AB_OFERTA = "off";/);
    expect(INDEX).toMatch(/var DIVISAO_INICIO_LANDING = "off";/);
  });

  it("desligada: volta pro /inicio com a MESMA query (+ ld=1) e não pinta nada", () => {
    const r = rodar(scriptDesligado, "/organizar?utm_campaign=x&fbclid=abc");
    expect(r.replace).toHaveBeenCalledWith("/inicio?utm_campaign=x&fbclid=abc&ld=1");
    expect(r.attrs["data-desligada"]).toBe("");
    expect(r.attrs["data-t"]).toBeUndefined();
  });

  it("?landing=on liga neste navegador (e ?landing=off tira)", () => {
    const store: Record<string, string> = {};
    const a = rodar(scriptDesligado, "/organizar?landing=on", store);
    expect(a.replace).not.toHaveBeenCalled();
    expect(a.attrs).toMatchObject({ "data-t": "a", "data-oferta": "sempre" });
    expect(rodar(scriptDesligado, "/organizar", store).replace).not.toHaveBeenCalled(); // ficou
    expect(rodar(scriptDesligado, "/organizar?landing=off", store).replace).toHaveBeenCalled();
    expect(rodar(scriptDesligado, "/organizar", store).replace).toHaveBeenCalled();
  });

  it("A/B desligados: sempre título A e oferta sempre (vitalício, 29/10); forçáveis por ?t= e ?oferta=", () => {
    expect(rodar(scriptDaCabeca, "/organizar?landing=on", {}, 0.9).attrs).toMatchObject({ "data-t": "a", "data-oferta": "sempre" });
    expect(rodar(scriptDaCabeca, "/organizar?landing=on&oferta=ano").attrs["data-oferta"]).toBe("ano");
    expect(rodar(scriptDaCabeca, "/organizar?landing=on&t=b&oferta=sempre").attrs).toMatchObject({ "data-t": "b", "data-oferta": "sempre" });
    expect(rodar(scriptDaCabeca, "/organizar?landing=on&t=c").attrs["data-t"]).toBe("c");
    expect(rodar(scriptDaCabeca, "/organizar?landing=on&t=z&oferta=x").attrs).toMatchObject({ "data-t": "a", "data-oferta": "sempre" });
  });

  it("A/B ligados: sorteio ESTÁVEL por aparelho", () => {
    const ligado = scriptDaCabeca.replace('var AB_TITULO = "off"', 'var AB_TITULO = "on"').replace('var AB_OFERTA = "off"', 'var AB_OFERTA = "on"');
    const store: Record<string, string> = {};
    const a = rodar(ligado, "/organizar?landing=on", store, 0.9);
    expect(a.attrs).toMatchObject({ "data-t": "c", "data-oferta": "sempre" });
    const b = rodar(ligado, "/organizar?landing=on", store, 0.1); // outro aleatório, mesmo aparelho
    expect(b.attrs).toMatchObject({ "data-t": "c", "data-oferta": "sempre" });
    expect(rodar(ligado, "/organizar?landing=on", {}, 0.1).attrs).toMatchObject({ "data-t": "a", "data-oferta": "ano" });
  });
});

describe("a divisão 50/50 do /inicio (index.html)", () => {
  it("desligada: o /inicio fica igual", () => {
    expect(rodar(scriptDaDivisao, "/inicio?utm_campaign=x", {}, 0.1).replace).not.toHaveBeenCalled();
    expect(rodar(scriptDaDivisao, "/comece", {}, 0.1).replace).not.toHaveBeenCalled();
  });
  it("forçada pra nova: vai pra /organizar com a mesma query + ld=1 + landing=on", () => {
    const r = rodar(scriptDaDivisao, "/inicio?utm_campaign=x&landing-divisao=nova");
    expect(r.replace).toHaveBeenCalledTimes(1);
    const destino = new URL(r.replace.mock.calls[0][0], "https://x.br");
    expect(destino.pathname).toBe("/organizar");
    expect(destino.searchParams.get("utm_campaign")).toBe("x");
    expect(destino.searchParams.get("ld")).toBe("1");
    expect(destino.searchParams.get("landing")).toBe("on");
  });
  it("ligada: sorteio estável; ld=1 (voltou da landing desligada) nunca divide de novo — sem laço", () => {
    const ligada = scriptDaDivisao.replace('var DIVISAO_INICIO_LANDING = "off"', 'var DIVISAO_INICIO_LANDING = "on"');
    const store: Record<string, string> = {};
    expect(rodar(ligada, "/inicio?a=1", store, 0.2).replace).toHaveBeenCalled(); // < 0,5 = nova
    expect(rodar(ligada, "/inicio?a=1", store, 0.9).replace).toHaveBeenCalled(); // o mesmo braço
    expect(rodar(ligada, "/inicio?a=1", {}, 0.9).replace).not.toHaveBeenCalled(); // braço inicio
    expect(rodar(ligada, "/inicio?a=1&ld=1", store, 0.2).replace).not.toHaveBeenCalled();
    // a landing desligada devolve com ld=1 → a divisão não manda de volta
    const volta = rodar(scriptDesligado, "/organizar?a=1&ld=1").replace.mock.calls[0][0] as string;
    expect(new URL(volta, "https://x.br").searchParams.get("ld")).toBe("1");
  });
  it("a demo dentro da landing não conta PageView do pixel", () => {
    expect(INDEX).toMatch(/if \(location\.pathname !== '\/organizar\/demo'\) \{\s*fbq\('init'/);
  });
});

describe("as ofertas da landing (site = servidor)", () => {
  it("valores iguais nos dois lados", () => {
    for (const [o, v] of Object.entries(VALOR_OFERTA)) expect(PRECOS_LANDING[o]).toBe(Math.round(v * 100));
  });
  it("braço ano (com e sem caixinha) e braço sempre", () => {
    expect(ofertaEscolhida("ano", false)).toBe("LN_ano279");
    expect(ofertaEscolhida("ano", true)).toBe("LN_anosempre478");
    expect(ofertaEscolhida("sempre", true)).toBe("LN_sempre279");
  });
  it("entram nos mapas do /hoje: preço, concessão, descrição sem acento, plano (boas-vindas)", () => {
    expect(PRECOS_HOJE.LN_ano279).toBe(2790);
    expect(PRECOS_HOJE.LN_anosempre478).toBe(4780);
    expect(CONCESSAO_HOJE.LN_ano279).toMatchObject({ periodo: "annual", dias: 365 });
    expect(CONCESSAO_HOJE.LN_anosempre478).toMatchObject({ periodo: "lifetime", dias: null });
    expect(CONCESSAO_HOJE.LN_sempre279).toMatchObject({ periodo: "lifetime", dias: null });
    for (const o of ["LN_ano279", "LN_anosempre478", "LN_sempre279"]) {
      expect(OFERTAS_PLANO_HOJE).toContain(o);
      expect(ehPlanoHoje(o)).toBe(true);
      expect(DESCRICAO_HOJE[o]).toMatch(/^[\x20-\x7e]+$/);
      expect(emailVendaComLojas(o)).toBe(true);
    }
    // nenhuma oferta antiga mudou
    expect(PRECOS_HOJE.h279).toBe(2790);
    expect(CONCESSAO_HOJE.hv279).toMatchObject({ periodo: "lifetime" });
  });
  it("e-mail e nome: o ano diz 1 ano (nunca vitalício); o pra sempre diz pra sempre", () => {
    expect(periodoDoEmailVenda("LN_ano279")).toBe("annual");
    expect(periodoDoEmailVenda("LN_anosempre478")).toBe("lifetime");
    expect(periodoDoEmailVenda("LN_sempre279")).toBe("lifetime");
    expect(nomeDoProduto({ offer: "LN_ano279" })).toBe("CORE Anual");
    expect(nomeDoProduto({ offer: "LN_sempre279" })).toBe("CORE pra sempre");
    expect(planoUtmify("LN_ano279")).toBe("annual");
  });
});

describe("a demo da landing", () => {
  it("a área abre o módulo certo; os 16 da grade são módulos válidos", () => {
    expect(MODULO_DA_AREA).toEqual({ tudo: "financas", dinheiro: "financas", rotina: "rotina", corpo: "treino" });
    expect(MODULOS_LANDING).toHaveLength(16);
    for (const m of MODULOS_LANDING) expect(HTML).toContain(`data-m="${m}"`);
    expect(moduloDaLanding("Finanças")).toBe("financas");
    expect(moduloDaLanding("mente")).toBe("hiperfoco");
    expect(moduloDaLanding("???")).toBe("financas");
  });
  it("rota de módulo troca NA demo; qualquer outra rota vira oferta; outro site segue", () => {
    expect(desvioNaLanding("/rotina?aba=semana")).toEqual({ tipo: "modulo", modulo: "rotina", aba: "semana" });
    expect(desvioNaLanding("/desenvolvimento")).toMatchObject({ tipo: "modulo", modulo: "desenvolvimento" });
    expect(desvioNaLanding("/home")).toMatchObject({ tipo: "conta" });
    expect(desvioNaLanding("/auth")).toMatchObject({ tipo: "conta" });
    expect(desvioNaLanding("https://google.com/x")).toBeNull();
    expect(desvioNaLanding("/organizar/demo?m=rotina")).toBeNull();
  });
  it("a demo é caminho de demonstração (módulos desligam foto, lembrete etc.)", () => {
    expect(ehCaminhoDeDemo("/organizar/demo")).toBe(true);
    expect(ehCaminhoDeDemo("/organizar")).toBe(false);
  });
});

describe("o estado do Pix que volta (a aba recarregou no banco)", () => {
  const pix = { orderId: "o1", qrCode: "000", qrCodeBase64: null, expiresAt: null, criadoEm: Date.now(), oferta: "LN_ano279" as const };
  it("QR vivo volta no QR; vencido volta pra oferta; pago sem e-mail pede e-mail; velho/corrompido zera", () => {
    expect(estadoQueVolta({ v: 1, fase: "qr", pix, anteriores: [], pago: null, email: null, emailPix: null, salvoEm: Date.now() }).fase).toBe("qr");
    expect(estadoQueVolta({ v: 1, fase: "qr", pix: { ...pix, criadoEm: Date.now() - 40 * 60_000 }, anteriores: [], pago: null, email: null, emailPix: null, salvoEm: Date.now() }).fase).toBe("oferta");
    expect(estadoQueVolta({ v: 1, fase: "gerando", pix: null, anteriores: [], pago: pix, email: null, emailPix: null, salvoEm: Date.now() }).fase).toBe("pago");
    expect(estadoQueVolta({ v: 1, fase: "pago", pix: null, anteriores: [], pago: pix, email: "a@b.co", emailPix: null, salvoEm: Date.now() }).fase).toBe("conta");
    expect(estadoQueVolta({ v: 1, fase: "conta", pago: pix, salvoEm: Date.now() - 3 * 86400e3 }).fase).toBe("oferta");
    expect(estadoQueVolta("lixo").fase).toBe("oferta");
  });
});

/* ───────── a página de verdade (HTML + landing.ts) no jsdom, com o Pix SIMULADO ───────── */
describe("o Pix na página (simulado, fora do domínio de produção)", () => {
  const corpo = HTML.match(/<body>([\s\S]*)<\/body>/)![1].replace(/<script type="module"[^>]*><\/script>/, "");
  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    document.documentElement.setAttribute("data-t", "a");
    document.documentElement.setAttribute("data-oferta", "ano");
    document.body.innerHTML = corpo;
    await import("@/landing/landing");
  });
  const espera = (sel: string, ms = 4000) => vi.waitFor(() => { const el = document.querySelector(sel); if (!el) throw new Error(sel); return el; }, { timeout: ms, interval: 50 });
  const eventos = () => ((window as unknown as { __eventosLanding: { nome: string }[] }).__eventosLanding ?? []).map((e) => e.nome);

  it("a caixinha soma no MESMO Pix (o botão mostra o total)", () => {
    expect(document.getElementById("lp-pagar-txt")!.textContent).toBe("Pagar R$ 27,90 no Pix");
    const cx = document.getElementById("lp-caixinha") as HTMLInputElement;
    expect(cx.checked).toBe(false); // desmarcada
    cx.checked = true; cx.dispatchEvent(new Event("change"));
    expect(document.getElementById("lp-pagar-txt")!.textContent).toBe("Pagar R$ 47,80 no Pix");
  });

  it("gerando → QR + código → pago → e-mail → conta pronta com Abrir meu CORE e as lojas; sem upsell", async () => {
    (document.getElementById("lp-pagar") as HTMLButtonElement).click();
    expect(document.querySelector('[data-testid="landing-gerando"]')!.textContent).toContain("Gerando o seu Pix");
    await espera('[data-testid="landing-codigo"]');
    expect(document.getElementById("lp-pix")!.textContent).toContain("Esta tela confirma sozinha quando o pagamento entrar");
    expect(document.getElementById("lp-email-pix")).not.toBeNull(); // o e-mail opcional
    expect(JSON.parse(localStorage.getItem("landing-estado-v1")!).fase).toBe("qr");
    (window as unknown as { __landingSimular: { pagar: () => void } }).__landingSimular.pagar();
    await espera('[data-testid="landing-pago"]');
    const email = document.getElementById("lp-email") as HTMLInputElement;
    email.value = "maria@email.com"; email.dispatchEvent(new Event("input"));
    (document.getElementById("lp-criar") as HTMLButtonElement).click();
    const conta = await espera('[data-testid="landing-conta"]');
    expect(conta.textContent).toContain("Abrir meu CORE");
    expect(conta.textContent).toContain("maria@email.com");
    expect(conta.querySelector('a[href*="apps.apple.com"]')).not.toBeNull();
    expect(conta.querySelector('a[href*="play.google.com"]')).not.toBeNull();
    expect(conta.textContent).not.toMatch(/pra sempre por|\+R\$|upgrade|2027/i);
    expect(eventos()).toEqual(expect.arrayContaining(["landing_pix_gerado", "landing_pix_copiado", "landing_pix_pago", "landing_email"]));
  });

  it("e-mail que já tem conta: pede o código (nunca 2ª conta)", async () => {
    (document.getElementById("lp-pagar") as HTMLButtonElement).click();
    await espera('[data-testid="landing-codigo"]');
    (window as unknown as { __landingSimular: { pagar: () => void } }).__landingSimular.pagar();
    await espera("#lp-email");
    const email = document.getElementById("lp-email") as HTMLInputElement;
    email.value = "maria+existe@email.com"; email.dispatchEvent(new Event("input"));
    (document.getElementById("lp-criar") as HTMLButtonElement).click();
    await espera("#lp-codigo");
    expect(document.getElementById("lp-pix")!.textContent).toContain("Esse e-mail já tem conta");
  });

  it("a página em si só fala 'vitalício' na faixa do topo (dono 29/10), e nunca 'teste grátis', 'sem cartão' nem nota/quantidade de avaliações", () => {
    const corpo = document.body.cloneNode(true) as HTMLElement;
    corpo.querySelector(".lp-promo")?.remove();
    const texto = corpo.textContent!.toLowerCase();
    expect(texto).not.toContain("vitalício");
    expect(texto).not.toContain("teste grátis");
    expect(texto).not.toContain("sem cartão");
    expect(texto).not.toMatch(/\d[,.]\d\s*(estrelas|★)|\d+\s+avalia/);
    expect(texto).not.toMatch(/open finance|inteligência artificial|google agenda/);
    expect(texto).toContain("contato@coreaplicativo.com.br");
  });
});
