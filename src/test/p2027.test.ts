/**
 * /2027 (23/11) — a página do carrossel 2027 (2027.html + src/p2027/), atrás da chave PAGINA_2027 "off".
 *   1. o preço mora num lugar só (src/p2027/preco.ts) e bate com a linha "p2027" do servidor; o HTML não tem preço escrito à mão;
 *   2. a chave: off → /organizar com a mesma query; ?qa=1 / fora do domínio / ?p2027=on / volta do banco abrem; as rotas existem;
 *   3. o que a página afirma é o que o app e o servidor fazem (âncora 97,90, código de 8 números, só crédito, sem grátis/bônus,
 *      avaliações literais das páginas no ar, as 6 áreas na ordem do post, sem TikTok);
 *   4. o checkout no cartão do preço (layout "cartao"): só e-mail, Pix | Cartão de crédito, "Pagar R$ 27,90 no Pix/cartão",
 *      Pix e cartão até o pago (Purchase 1× com eventID = PI, pós-compra ali), e em produção só paga se o servidor devolver 2790/p2027;
 *   5. a página (main.ts): monta o checkout no lugar do esqueleto, leva o e-mail digitado nele, mede a barra, e quem já pagou na aba
 *      vê "Você já comprou" + o passo a passo de entrar no app.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { abrirCheckout, _zerar, type OpcoesCheckout } from "@/landing/stripe-checkout";
import { _zerarPosCompra } from "@/landing/pos-compra-app";
import { PRECO_2027_CENTAVOS, aplicarPreco, precoTexto } from "@/p2027/preco";
import { OFERTAS_STRIPE } from "../../supabase/functions/_shared/stripe-ofertas";

const RAIZ = resolve(__dirname, "../..");
const HTML_CRU = readFileSync(resolve(RAIZ, "2027.html"), "utf8");
const HTML = aplicarPreco(HTML_CRU);
const semMarcacao = (h: string) => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&#8209;/g, "-").replace(/\s+/g, " ");
const TEXTO = semMarcacao(HTML);
const W = window as unknown as Record<string, unknown>;
const corpoDoHtml = () => HTML.slice(HTML.indexOf("<body>") + 6, HTML.indexOf("</body>")).replace(/<script>[\s\S]*?<\/script>/g, "");

describe("1 · o preço num lugar só", () => {
  it("PRECO_2027_CENTAVOS = 2790 = a linha p2027 do servidor; o HTML só tem %PRECO_2027% (nenhum 27,90 escrito à mão)", () => {
    expect(PRECO_2027_CENTAVOS).toBe(2790);
    expect(OFERTAS_STRIPE.p2027.centavos).toBe(PRECO_2027_CENTAVOS);
    expect(precoTexto()).toBe("27,90");
    expect(HTML_CRU).not.toContain("27,90");
    expect((HTML_CRU.match(/%PRECO_2027%/g) ?? []).length).toBeGreaterThanOrEqual(5); // número, botão, dúvida, fecho, barra
    expect(TEXTO).toMatch(/R\$\s*27,90 uma vez só/);
    const outro = semMarcacao(aplicarPreco(HTML_CRU, 1990));
    expect(outro).not.toContain("27,90");
    expect(outro).toContain("Pagar R$ 19,90 no Pix");
  });
  it("o build e o dev trocam o preço (vite.config.ts) e a página entra no build e na Vercel", () => {
    const vite = readFileSync(resolve(RAIZ, "vite.config.ts"), "utf8");
    expect(vite).toContain('import { aplicarPreco } from "./src/p2027/preco"');
    expect(vite).toContain('p2027: path.resolve(__dirname, "2027.html")');
    expect(vite).toContain('req.url = req.url!.replace(/^\\/2027\\/?/, "/2027.html")');
    expect(vite).toContain("precoDa2027()");
    const vercel = JSON.parse(readFileSync(resolve(RAIZ, "vercel.json"), "utf8"));
    const rw = vercel.rewrites as Array<{ source: string; destination: string }>;
    expect(rw).toEqual(expect.arrayContaining([{ source: "/2027", destination: "/2027.html" }, { source: "/2027/", destination: "/2027.html" }]));
    // antes do "pega tudo" do SPA
    expect(rw.findIndex((r) => r.source === "/2027")).toBeLessThan(rw.findIndex((r) => r.destination === "/index.html"));
  });
});

describe("2 · a chave PAGINA_2027", () => {
  const cabeca = HTML_CRU.match(/<script>\s*\/\*[\s\S]*?\*\/\s*(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];
  const rodar = (fonte: string, busca: string, host = "www.coreaplicativo.com.br", sessao: Record<string, string> = {}) => {
    const attrs: Record<string, string> = {}; const replace = vi.fn();
    const ss = { getItem: (k: string) => sessao[k] ?? null, setItem: (k: string, v: string) => { sessao[k] = v; } };
    new Function("location", "document", "sessionStorage", fonte)({ search: busca, hostname: host, hash: "", replace }, { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } } }, ss);
    return { attrs, replace, sessao };
  };
  it("nasce OFF: no domínio de produção, sem nada na URL, vai pro /organizar com a mesma query e a página nem pinta", () => {
    expect(HTML_CRU).toMatch(/var PAGINA_2027 = "off";/);
    const r = rodar(cabeca, "?utm_content=c7&fbclid=x");
    expect(r.replace).toHaveBeenCalledWith("/organizar?utm_content=c7&fbclid=x");
    expect(r.attrs["data-desligada"]).toBe("");
    expect(HTML_CRU).toContain("html[data-desligada] body{display:none}");
  });
  it("com a chave off abre: ?qa=1 (prévia), fora do domínio (prévia), ?p2027=on (vale pra aba) e a volta do banco", () => {
    expect(rodar(cabeca, "?qa=1").replace).not.toHaveBeenCalled();
    expect(rodar(cabeca, "", "localhost").replace).not.toHaveBeenCalled();
    expect(rodar(cabeca, "", "core-git-lp-2027.vercel.app").replace).not.toHaveBeenCalled();
    const comAba = rodar(cabeca, "?p2027=on&utm_source=x");
    expect(comAba.replace).not.toHaveBeenCalled();
    expect(rodar(cabeca, "?utm_source=x", "www.coreaplicativo.com.br", comAba.sessao).replace).not.toHaveBeenCalled(); // recarregou sem o parâmetro
    expect(rodar(cabeca, "?payment_intent=pi_3Abc&redirect_status=succeeded").replace).not.toHaveBeenCalled();
    expect(rodar(cabeca.replace('var PAGINA_2027 = "off"', 'var PAGINA_2027 = "on"'), "?utm_content=c7").replace).not.toHaveBeenCalled();
  });
});

describe("3 · o que a página afirma", () => {
  it("âncora R$ 97,90 (o anual do app hoje; nunca 99,90, sem 'no app'/'do site'); 'Paga uma vez'; 'Não vence em dezembro'", () => {
    expect(TEXTO).toContain("O plano anual do CORE custa R$ 97,90.");
    expect(TEXTO).not.toContain("99,90");
    expect(TEXTO).not.toMatch(/R\$ 97,90 (no app|do site)/);
    const paywall = readFileSync(resolve(RAIZ, "src/lib/paywall-teste.ts"), "utf8");
    expect(paywall).toMatch(/anual: \{ preco: "R\$ 97,90"/);
    expect(TEXTO).toContain("Paga uma vez, usa pra sempre.");
    expect(TEXTO).toContain("Não vence em dezembro: continua seu em 2028, 2029…");
  });
  it("o código de entrar tem 8 números (o app), o botão é 'Entrar' (não 'Começar') e o e-mail da venda traz as lojas", () => {
    const entrar = readFileSync(resolve(RAIZ, "src/components/auth/EntrarComCodigo.tsx"), "utf8");
    expect(entrar).toMatch(/const TAMANHO = 8;/);
    expect(TEXTO).toContain("código de 8 números");
    const welcome = readFileSync(resolve(RAIZ, "src/components/app/AppWelcome.tsx"), "utf8");
    expect(welcome).toContain("Já tenho conta? <b>Entrar</b>");
    for (const m of TEXTO.matchAll(/Começar/g)) expect(TEXTO.slice(Math.max(0, m.index! - 10), m.index!)).toMatch(/não em “$/);
    const email = readFileSync(resolve(RAIZ, "supabase/functions/_shared/email-venda.ts"), "utf8");
    expect(email).toContain("App Store</a>");
    expect(email).toContain("Google Play</a>");
  });
  it("sem 'grátis' (só 'Não tem versão grátis'), sem 'bônus', sem débito, sem CPF/telefone, sem nota média ou contagem de avaliações", () => {
    expect(TEXTO.match(/grátis/gi)).toHaveLength(2); // "Não tem versão grátis: tem garantia." e "Tem versão grátis? Não."
    expect(TEXTO).toContain("Não tem versão grátis: tem garantia.");
    expect(TEXTO).not.toMatch(/bônus|débito|CPF|telefone|WhatsApp/i);
    expect(TEXTO).not.toMatch(/\d[,.]\d\s*(★|estrelas)|\d+\s+avaliações|nota média/i);
    // o formulário (esqueleto) só pede o e-mail
    expect((HTML.match(/<input /g) ?? []).length).toBe(1);
    expect(HTML).toMatch(/<input class="ct-campo" id="sk-email" type="email"/);
    expect(TEXTO).toContain("Cartão de crédito");
  });
  it("as 6 áreas do post, com os nomes e a ordem do post, + 10 áreas que existem no app", () => {
    const lista = [...HTML.matchAll(/<ul class="lista"[\s\S]*?<\/ul>/g)][0][0];
    expect([...lista.matchAll(/<li>([^<]+)<\/li>/g)].map((m) => m[1])).toEqual(["Finanças ✅", "Hábitos ✅", "Casa, Rotina e Compras ✅", "Leitura ✅", "Alimentação ✅", "Desenvolvimento Pessoal ✅"]);
    const grade = [...HTML.matchAll(/<li class="area [^"]+"><h3>([^<]+)<\/h3>/g)].map((m) => m[1]);
    expect(grade).toEqual(["Finanças ✅", "Hábitos ✅", "Casa, Rotina e Compras ✅", "Leitura ✅", "Alimentação ✅", "Desenvolvimento Pessoal ✅"]);
    const modulos = readFileSync(resolve(RAIZ, "src/lib/modulos.tsx"), "utf8");
    const pilulas = [...HTML.matchAll(/<li style="--p:[^"]+">([^<]+)<\/li>/g)].map((m) => m[1]);
    expect(pilulas).toHaveLength(10);
    for (const nome of pilulas) expect(modulos).toContain(`label: "${nome}"`);
    expect(TEXTO).not.toMatch(/módulos/i);
  });
  it("as avaliações são as das páginas no ar, literais (cortes só com '…'), com 1º nome, loja e estrelas", () => {
    const tudo = semMarcacao(readFileSync(resolve(RAIZ, "tudo.html"), "utf8"));
    const citacoes = [...HTML.matchAll(/<(?:blockquote|p class="depo-txt")>“([^”]+)”<\/(?:blockquote|p)>/g)].map((m) => m[1]);
    expect(citacoes.length).toBe(5);
    for (const c of citacoes) for (const pedaco of c.split("…").map((s) => s.trim()).filter(Boolean)) expect(tudo).toContain(pedaco);
    for (const nome of ["Susam", "Sabryna", "Rebeca", "Elisa", "Paulo"]) expect(TEXTO).toContain(nome);
    expect(TEXTO).not.toContain("ganhando mais"); // o trecho de renda do Paulo fica de fora
  });
  it("a faixa do dono (🔥 ACESSO VITALÍCIO · só hoje, DD/MM), a garantia escrita, a empresa e o contato perto do botão", () => {
    expect(HTML).toContain("<b>🔥 ACESSO VITALÍCIO</b><span>&nbsp;· só hoje<b id=\"faixa-data\"></b></span>");
    expect(HTML).toMatch(/timeZone: "America\/Sao_Paulo", day: "2-digit", month: "2-digit"/);
    expect(TEXTO).toContain("7 dias pra ver se é pra você.");
    expect(TEXTO).toContain("Não renova. Nada é cobrado depois");
    const cartao = semMarcacao(HTML.slice(HTML.indexOf('id="cartao"'), HTML.indexOf('id="garantia"')));
    expect(cartao).toContain("CNPJ 55.041.112/0001-82");
    expect(cartao).toContain("contato@coreaplicativo.com.br");
    expect(cartao).toContain("Depois de pagar: baixe o CORE e toque em Entrar com este e-mail.");
  });
  it("pixel: a Meta como na /tudo (os 2 pixels, ViewContent, Purchase pelo checkout); sem TikTok", () => {
    const pagamento = readFileSync(resolve(RAIZ, "src/p2027/payment.ts"), "utf8");
    expect(pagamento).toContain('f("init", "998037194527241"); f("init", "1104688251942954"); f("track", "PageView");');
    expect(pagamento).toContain('fireMetaEvent("ViewContent"');
    expect(pagamento).toMatch(/name === "Purchase" \|\| name === "InitiateCheckout"/);
    for (const arq of ["src/p2027/payment.ts", "src/p2027/main.ts", "2027.html"]) expect(readFileSync(resolve(RAIZ, arq), "utf8")).not.toMatch(/ttq|TiktokAnalyticsObject|analytics\.tiktok\.com/);
  });
});

/* ───────── 4 · o checkout no cartão do preço ───────── */
const criar = vi.fn(); const status = vi.fn(); const confirmPixPayment = vi.fn(); const createPaymentMethod = vi.fn(); const confirmPayment = vi.fn();
const pixel = vi.fn(); const evento = vi.fn();
const QR = "00020101021226870014br.gov.bcb.pix-QA-2027-NAO-PAGAVEL";
let host: HTMLElement;
const opcoes = (extra: Partial<OpcoesCheckout> = {}): OpcoesCheckout => ({ pk: "pk_test_QA", precoCentavos: PRECO_2027_CENTAVOS, parcelasMax: 1, producao: false, pedeCpf: false, somentePix: false, layout: "cartao", montarEm: host, storagePrefix: "p2027-qa", pagina: "p2027", trocaCartao: false, medirCarteira: false, posApp: true, pixCopiaPrimeiro: "sempre", evento, pixel, atrib: { utm_campaign: "qa" }, sessao: "s-2027", aparelho: "d-2027", urlChegada: "https://www.coreaplicativo.com.br/2027?utm_campaign=qa", fbclid: null, ...extra });
const flush = async () => { await new Promise((r) => setTimeout(r, 20)); };
const digitar = (sel: string, v: string) => { const i = host.querySelector(sel) as HTMLInputElement; i.value = v; i.dispatchEvent(new Event("input")); };

describe("4 · o checkout dentro do cartão do preço (layout 'cartao')", () => {
  beforeEach(() => {
    vi.stubGlobal("scrollTo", vi.fn());
    Element.prototype.scrollIntoView = vi.fn();
    document.body.innerHTML = '<div id="cartao"><div id="pagamento"><div data-esqueleto>esqueleto</div></div></div>';
    host = document.getElementById("pagamento")!;
    sessionStorage.clear(); vi.clearAllMocks();
    criar.mockResolvedValue({ ok: true, pi: "pi_2027", clientSecret: "pi_2027_secret_QA" });
    status.mockResolvedValue({ ok: true, pago: false, status: "requires_action" });
    confirmPixPayment.mockResolvedValue({ paymentIntent: { id: "pi_2027", status: "requires_action", next_action: { type: "pix_display_qr_code", pix_display_qr_code: { data: QR } } } });
    createPaymentMethod.mockResolvedValue({ paymentMethod: { id: "pm_qa", card: { brand: "visa", last4: "4242" } } });
    confirmPayment.mockResolvedValue({ paymentIntent: { id: "pi_2027", status: "succeeded" } });
    const elements = () => ({ create: () => ({ mount: () => {}, on: (ev: string, fn: () => void) => { if (ev === "ready") queueMicrotask(fn); }, destroy: () => {} }), submit: async () => ({}) });
    W.__ofertaApi = { criar, status };
    W.__stripeFalso = { elements, confirmPixPayment, createPaymentMethod, confirmPayment };
  });
  afterEach(() => { _zerar(); _zerarPosCompra(); delete W.__ofertaApi; delete W.__stripeFalso; vi.unstubAllGlobals(); });

  it("a estrutura: só o e-mail (rótulo com a dica), Pix | Cartão de crédito com bolinha, 'Pagar R$ 27,90 no Pix' e a linha de depois", async () => {
    await abrirCheckout(opcoes());
    await flush();
    const oc = host.querySelector("#oc")!;
    expect(host.querySelector("[data-esqueleto]")).toBeNull();
    expect(oc.className).toBe("oc oc-inline oc-cartao");
    expect(oc.getAttribute("role")).toBe("region");
    expect(host.querySelector(".ct-rot")!.textContent).toBe("Seu e-mail · é com ele que você entra no app");
    expect(host.querySelectorAll("input")).toHaveLength(1);
    expect((host.querySelector("#oc-email") as HTMLInputElement).type).toBe("email");
    expect(host.querySelector("#oc-nome")).toBeNull();
    expect([...host.querySelectorAll("[data-metodo]")].map((b) => b.textContent)).toEqual(["Pixna hora", "Cartãode crédito"]);
    expect(host.querySelectorAll(".ct-bol")).toHaveLength(2);
    expect(host.querySelector("[data-metodo='pix']")!.getAttribute("aria-checked")).toBe("true");
    expect(host.querySelector("#oc-pagar")!.textContent).toMatch(/^Pagar R\$\s27,90 no Pix$/);
    (host.querySelector("[data-metodo='card']") as HTMLElement).click();
    await flush();
    expect(host.querySelector("#oc-pagar")!.textContent).toMatch(/^Pagar R\$\s27,90 no cartão$/);
    expect(host.querySelector(".ct-depois")!.textContent).toBe("Depois de pagar: baixe o CORE e toque em Entrar com este e-mail.");
    expect(host.textContent).not.toMatch(/CPF|Nome completo|parcela|débito/i);
    expect(document.body.style.position).toBe(""); // nada por cima: a página continua rolando
  });
  it("Pix: só o e-mail vai pra Stripe; o pedido diz só a página (p2027), nunca o valor; o Pix aparece ali; pagou → Purchase 1× (eventID = PI) e o pós-compra do app", async () => {
    await abrirCheckout(opcoes());
    await flush();
    host.querySelector("#oc-email")!.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(pixel.mock.calls.filter((c) => c[0] === "InitiateCheckout")).toHaveLength(1);
    digitar("#oc-email", "Maria.Teste@Example.com ");
    (host.querySelector("#oc-pagar") as HTMLElement).click();
    await flush();
    expect(confirmPixPayment).toHaveBeenCalledWith("pi_2027_secret_QA", { payment_method: { billing_details: { email: "maria.teste@example.com" } } }, { handleActions: false });
    for (const [corpo] of criar.mock.calls) { expect(corpo.pagina).toBe("p2027"); expect(corpo).not.toHaveProperty("amount"); expect(corpo).not.toHaveProperty("preco_centavos"); }
    expect(host.querySelector("[data-testid='oferta-pix']")).not.toBeNull();
    expect((host.querySelector("#oc-codigo") as HTMLInputElement).value).toBe(QR);
    expect(evento.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(["landing_stripe_email_comecou", "landing_stripe_email_valido", "landing_stripe_pagar", "landing_stripe_pix_gerado"]));
    status.mockResolvedValue({ ok: true, pago: true, status: "succeeded", metodo: "pix" });
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();
    const compras = pixel.mock.calls.filter((c) => c[0] === "Purchase");
    expect(compras).toHaveLength(1);
    expect(compras[0][2]).toBe("pi_2027");
    expect(compras[0][1]).toMatchObject({ value: 27.9, currency: "BRL" });
    expect(evento.mock.calls.some((c) => c[0] === "landing_stripe_pago")).toBe(true);
    expect(host.querySelector("[data-testid='pos-compra']")).not.toBeNull();
    expect(host.textContent).toContain("Você já pagou. Não compre de novo no app.");
    expect(host.querySelectorAll("a[data-loja]").length).toBeGreaterThanOrEqual(2); // App Store e Google Play
    expect(JSON.stringify(evento.mock.calls)).not.toContain("maria.teste");
  });
  it("cartão: o e-mail vai no PaymentMethod (sem nome) e o pago acontece ali mesmo", async () => {
    await abrirCheckout(opcoes());
    await flush();
    (host.querySelector("[data-metodo='card']") as HTMLElement).click();
    await flush();
    digitar("#oc-email", "qa@example.com");
    (host.querySelector("#oc-pagar") as HTMLElement).click();
    await flush();
    expect(createPaymentMethod).toHaveBeenCalledWith(expect.objectContaining({ params: { billing_details: { email: "qa@example.com" } } }));
    expect(confirmPayment).toHaveBeenCalledOnce();
    expect(host.querySelector("[data-testid='pos-compra']")).not.toBeNull();
    expect(pixel.mock.calls.filter((c) => c[0] === "Purchase")).toHaveLength(1);
  });
  it("em produção só paga se o servidor devolver o MESMO valor, a moeda e a página (servidor velho = não cobra outro valor)", async () => {
    criar.mockResolvedValue({ ok: true, pi: "pi_2027", clientSecret: "pi_2027_secret_QA", amount: 1990, currency: "brl", pagina: "tudo" });
    await abrirCheckout(opcoes({ producao: true }));
    await flush();
    expect(evento.mock.calls.some((c) => c[0] === "landing_erro" && c[1]?.onde === "stripe_preco_divergente")).toBe(true);
    expect(host.querySelector("#oc-pagar")!.textContent).toBe("Tentar de novo");
    _zerar(); host.innerHTML = ""; evento.mockClear(); sessionStorage.clear();
    criar.mockResolvedValue({ ok: true, pi: "pi_2027", clientSecret: "pi_2027_secret_QA", amount: 2790, currency: "brl", pagina: "p2027" });
    await abrirCheckout(opcoes({ producao: true }));
    await flush();
    expect(evento.mock.calls.some((c) => c[0] === "landing_erro")).toBe(false);
    expect(host.querySelector("#oc-pagar")!.textContent).toMatch(/^Pagar R\$\s27,90 no Pix$/);
  });
  it("o e-mail que a pessoa já tinha digitado (no esqueleto) entra no campo, sem a linha 'Trocar'", async () => {
    await abrirCheckout(opcoes({ emailInicial: "ana@example.com" }));
    await flush();
    expect((host.querySelector("#oc-email") as HTMLInputElement).value).toBe("ana@example.com");
    expect(host.querySelector("#oc-email-ok")).toBeNull();
  });
});

/* ───────── 5 · a página (main.ts) ───────── */
const pagina = vi.hoisted(() => ({ event: vi.fn(), initPixel: vi.fn(), mountPayment: vi.fn(async (_alvo: HTMLElement, _o?: Record<string, unknown>) => {}) }));
vi.mock("@/p2027/payment", () => ({ event: pagina.event, initPixel: pagina.initPixel, mountPayment: pagina.mountPayment, bankReturn: undefined, QA: true, STORAGE_PREFIX: "p2027-qa", PRECO_CENTAVOS: 2790 }));

describe("5 · a página (main.ts)", () => {
  class IOParado { observe() {} unobserve() {} disconnect() {} }
  const ioDoSetup = window.IntersectionObserver;
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks(); sessionStorage.clear();
    vi.stubGlobal("scrollTo", vi.fn());
    W.IntersectionObserver = IOParado; // ninguém "chega perto" sozinho: o pagamento só monta pelo toque
    Element.prototype.scrollIntoView = vi.fn();
    document.documentElement.removeAttribute("data-desligada");
    document.body.innerHTML = corpoDoHtml();
  });
  afterEach(() => { _zerarPosCompra(); vi.unstubAllGlobals(); W.IntersectionObserver = ioDoSetup; });

  it("abre: landing_view + o pixel; toque na barra fixa → landing_checkout_click {barra_fixa, sem preço} e o pagamento monta no #pagamento (1×)", async () => {
    await import("@/p2027/main");
    expect(pagina.initPixel).toHaveBeenCalledOnce();
    expect(pagina.event).toHaveBeenCalledWith("landing_view");
    expect(pagina.mountPayment).not.toHaveBeenCalled();
    expect(document.querySelector(".p27-qa")?.textContent).toBe("PRÉVIA · PAGAMENTO SIMULADO · SEM COBRANÇA");
    (document.querySelector("#barra a") as HTMLElement).click();
    expect(pagina.event).toHaveBeenCalledWith("landing_checkout_click", { placement: "barra_fixa", com_preco: false });
    expect(pagina.mountPayment).toHaveBeenCalledOnce();
    expect(pagina.mountPayment.mock.calls[0][0]).toBe(document.getElementById("pagamento"));
    (document.querySelector(".fecho [data-ir]") as HTMLElement).click();
    expect(pagina.event).toHaveBeenCalledWith("landing_checkout_click", { placement: "fecho", com_preco: false });
    expect(pagina.mountPayment).toHaveBeenCalledOnce();
  });
  it("mexeu no esqueleto: monta na hora e o e-mail que ela digitou vai junto", async () => {
    await import("@/p2027/main");
    const sk = document.getElementById("sk-email") as HTMLInputElement;
    sk.value = "  ana@example.com ";
    document.querySelector("[data-esqueleto]")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(pagina.mountPayment).toHaveBeenCalledOnce();
    expect(pagina.mountPayment.mock.calls[0][1]).toMatchObject({ emailInicial: "ana@example.com" });
  });
  it("o 'pago' do checkout tira o preço do cartão e a barra (o cartão vira o pós-compra)", async () => {
    await import("@/p2027/main");
    (document.querySelector("#barra a") as HTMLElement).click();
    const { evento: ev } = pagina.mountPayment.mock.calls[0][1] as { evento: (n: string, d?: Record<string, unknown>) => void };
    ev("landing_stripe_pago", { metodo: "pix", pi: "pi_x" });
    expect(pagina.event).toHaveBeenCalledWith("landing_stripe_pago", { metodo: "pix", pi: "pi_x" });
    expect(document.getElementById("cartao")!.hasAttribute("data-pago")).toBe(true);
    expect(document.getElementById("barra")!.classList.contains("on")).toBe(false);
  });
  it("já pagou nesta aba: 'Você já comprou o CORE ✓' no lugar do pagamento + o passo a passo em tela cheia; nada de PaymentIntent novo", async () => {
    sessionStorage.setItem("oferta-pos-compra", JSON.stringify({ pi: "pi_velho", email: "ana@example.com", em: Date.now() }));
    await import("@/p2027/main");
    await vi.waitFor(() => expect(document.querySelector("[data-testid='p2027-ja-comprou']")).not.toBeNull(), { timeout: 5000 });
    expect(document.querySelector("[data-testid='pos-tela-cheia']")).not.toBeNull();
    expect(document.getElementById("cartao")!.hasAttribute("data-pago")).toBe(true);
    expect(pagina.mountPayment).not.toHaveBeenCalled();
  });
});
