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
// rodada 3 (V2-B15): o "e-mail" que não quebra no hífen vem em <span class="nw"> — some sem deixar espaço (é a mesma palavra)
const semMarcacao = (h: string) => h.replace(/<span class="nw">([^<]*)<\/span>/g, "$1").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&#8209;/g, "-").replace(/\s+/g, " ");
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
  it("âncora R$ 97,90 (o anual do app hoje; nunca 99,90, sem 'no app'/'do site'); 'Paga uma vez'; 'Não vence no fim de 2027' (rodada 2: sem 'dezembro')", () => {
    expect(TEXTO).toContain("O plano anual do CORE custa R$ 97,90.");
    expect(TEXTO).not.toContain("99,90");
    expect(TEXTO).not.toMatch(/R\$ 97,90 (no app|do site)/);
    const paywall = readFileSync(resolve(RAIZ, "src/lib/paywall-teste.ts"), "utf8");
    expect(paywall).toMatch(/anual: \{ preco: "R\$ 97,90"/);
    expect(TEXTO).toContain("Paga uma vez, usa pra sempre.");
    expect(TEXTO).toContain("Não vence no fim de 2027: continua seu em 2028, 2029…");
    expect(TEXTO).not.toMatch(/dezembro/i); // em novembro, "dezembro" foi lido como o mês que vem (as 3 clientes)
  });
  it("rodada 2 · o cartão do preço: a tarja é 'OFERTA ESPECIAL' + 'pagamento único' (sem '· HOJE'); a faixa 'só hoje' do topo fica (regra do dono)", () => {
    expect(HTML).toContain('<p class="cartao-topo"><span>OFERTA ESPECIAL</span><span>pagamento único</span></p>');
    expect(TEXTO).not.toMatch(/ESPECIAL · HOJE/);
    expect(TEXTO.match(/só hoje/g)).toHaveLength(1); // só na faixa do topo
  });
  it("rodada 3 · as dúvidas, palavra por palavra (W2 + cliente fria): 'É só pra 2027?' sem '2027 é só o ano…'; a loja sem 'baixar é de graça'", () => {
    const dts = [...HTML.matchAll(/<dt>([^<]+)<\/dt>/g)].map((m) => m[1]);
    expect(dts.slice(0, 3)).toEqual(["É mensalidade?", "É só pra 2027?", "Funciona no meu celular?"]);
    expect(new Set(dts).size).toBe(dts.length); // cada dúvida uma vez só
    const resposta = (dt: string) => semMarcacao(HTML.slice(HTML.indexOf(`<dt>${dt}</dt>`)).match(/<dd>([\s\S]*?)<\/dd>/)![1]).trim();
    expect(resposta("É só pra 2027?")).toBe("Não. É seu pra sempre: você começa hoje e continua em 2028, 2029…");
    expect(resposta("Por que na loja o preço é outro?")).toBe("Nas lojas o CORE custa R$ 97,90 (e tem plano mensal). Por aqui a venda é direta com a gente, sem a loja no meio: R$ 27,90, uma vez só. O app é o mesmo. Depois de pagar aqui, baixe o CORE e toque em “Já tenho conta? Entrar” com o mesmo e-mail: não precisa comprar nada lá dentro.");
    expect(resposta("Funciona no meu celular?")).toBe("Sim. No iPhone e no Android. E no computador, pelo navegador, com a mesma conta.");
    expect(TEXTO).not.toContain("baixar é de graça");
    expect(TEXTO).not.toContain("2027 é só o ano");
    // o preço da dúvida da loja também vem de preco.ts
    expect(semMarcacao(aplicarPreco(HTML_CRU, 1990))).toContain("sem a loja no meio: R$ 19,90, uma vez só.");
  });
  it("rodada 3 · 1ª tela: 'É app: iPhone, Android e computador, com a mesma conta.' (sai 'Uma conta só pros três', lido como três pessoas)", () => {
    expect(TEXTO).toContain("É app: iPhone, Android e computador, com a mesma conta.");
    expect(TEXTO).not.toMatch(/pros três/);
  });
  it("rodada 3 · um nome só pro botão de entrar: o da 1ª tela do app hoje (“Já tenho conta? Entrar”), igual em toda a página", () => {
    const welcome = readFileSync(resolve(RAIZ, "src/components/app/AppWelcome.tsx"), "utf8");
    expect(welcome).toContain("Já tenho conta? <b>Entrar</b>");
    const entrar = [...TEXTO.matchAll(/Entrar/g)];
    expect(entrar.length).toBe(4); // passo 3, linha do esqueleto, dúvida da loja, dúvida "Paguei e não consegui entrar"
    for (const m of entrar) expect(TEXTO.slice(m.index! - 17, m.index! + 7)).toBe("“Já tenho conta? Entrar”");
    expect(TEXTO).not.toMatch(/Entrar na minha conta/);
    const passo3 = semMarcacao(HTML.slice(HTML.indexOf('<section class="depois"'), HTML.indexOf("</section>", HTML.indexOf('<section class="depois"'))));
    expect(passo3).toContain("Toca em “Já tenho conta? Entrar” (não em “Começar”)");
    expect(TEXTO.match(/Começar/g)).toHaveLength(1); // só no passo 3
    expect(TEXTO).toContain("No app, toque em “Já tenho conta? Entrar” com o mesmo e-mail da compra: o código de 8 números chega nele.");
    expect(TEXTO).not.toContain("não compre de novo dentro do app");
  });
  it("rodada 3 · 'Avaliações' uma vez só (o título não repete a palavra); a Susam termina com '…'; os textos alternativos dizem o que a imagem mostra", () => {
    expect(HTML).toContain('<p class="kicker">Avaliações</p>');
    expect(HTML).toContain("<h2>Reais, das lojas.</h2>");
    expect(TEXTO.match(/avaliações/gi)).toHaveLength(1);
    expect(TEXTO).not.toMatch(/quem usa conta/i);
    expect(HTML).toContain("<blockquote>“…Super prático, fácil de usar e está me ajudando muito a organizar melhor minha rotina…”</blockquote>");
    const alt = (src: string) => HTML.match(new RegExp(`src="${src}"[^>]*alt="([^"]+)"`))![1];
    expect(alt("/p2027/area-leitura.webp")).toBe("Tela real: o livro, na página 208 de 320");
    expect(alt("/p2027/area-metas.webp")).toBe("Tela real: a lista de metas");
    expect(alt("/p2027/area-habitos.webp")).toBe("Tela real: a grade de consistência dos hábitos, com dias marcados e dias em branco");
    expect(alt("/p2027/esconder.webp")).toBe("Tela real do app: Dev. Pessoal à mostra, com o olho aberto, e Casa guardada, com o olho fechado");
    expect(HTML).toMatch(/src="\/p2027\/esconder\.webp" width="700" height="231"/); // o recorte de 2 linhas (V2-M3)
  });
  it("rodada 3 (V2-B15/B6) · 'e-mail' nunca quebra no hífen: todo 'e-mail' do texto da página vem inteiro (span .nw); a página é só clara", () => {
    const corpo = corpoDoHtml().replace(/<[^>]*>/g, (tag) => (tag === '<span class="nw">' ? "«" : tag === "</span>" ? "»" : "<>"));
    const soltos = [...corpo.matchAll(/e-mail/g)].filter((m) => corpo.slice(m.index! - 1, m.index!) !== "«" || corpo.slice(m.index! + 6, m.index! + 7) !== "»");
    expect(soltos).toHaveLength(0);
    expect(corpo.match(/«e-mail»/g)!.length).toBeGreaterThanOrEqual(7);
    expect(readFileSync(resolve(RAIZ, "src/p2027/style.css"), "utf8")).toMatch(/\.nw\{white-space:nowrap\}/);
    expect(HTML).toContain('<meta name="color-scheme" content="only light">');
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
    expect(cartao).toContain("Depois de pagar: baixe o CORE e toque em “Já tenho conta? Entrar” com este e-mail.");
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
    expect(host.querySelector(".ct-depois")!.textContent).toBe("Depois de pagar: baixe o CORE e toque em “Já tenho conta? Entrar” com este e-mail.");
    expect(host.querySelector(".ct-depois .nw")!.textContent).toBe("e-mail"); // rodada 3 (V2-B15): não quebra no hífen
    expect(host.querySelector(".ct-rot .nw")!.textContent).toBe("e-mail");
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

  /* ───────── rodada 2 ───────── */
  const tocarPagar = async () => { (host.querySelector("#oc-pagar") as HTMLElement).click(); await flush(); };
  const chavesDaAba = () => Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i)!);

  it("rodada 2 (W-M2) · o e-mail fica na aba: o Pix mostra 'O acesso vai pro e-mail …' com o Corrigir; recarregou com o Pix aberto → o MESMO e-mail no Pix e no pago (com Copiar)", async () => {
    await abrirCheckout(opcoes());
    await flush();
    digitar("#oc-email", "Maria.Teste@Example.com");
    await tocarPagar();
    const linha = host.querySelector("[data-testid='pix-email']")!;
    expect(linha.textContent).toBe("O acesso vai pro e-mail maria.teste@example.comCorrigir");
    expect(linha.querySelector("button[data-corrigir-email]")!.textContent).toBe("Corrigir");
    expect(JSON.parse(sessionStorage.getItem("p2027-qa-stripe-email")!)).toEqual({ ref: sessionStorage.getItem("p2027-qa-stripe-ref"), email: "maria.teste@example.com" });
    // "recarrega" a aba: o servidor devolve o MESMO PI com o Pix pendente
    const ref = sessionStorage.getItem("p2027-qa-stripe-ref");
    _zerar(); host.innerHTML = "";
    criar.mockResolvedValue({ ok: true, pi: "pi_2027", clientSecret: "pi_2027_secret_QA", status: "requires_action", pix: { data: QR, expires_at: Math.floor(Date.now() / 1000) + 1500 } });
    await abrirCheckout(opcoes());
    await flush();
    expect(criar.mock.calls.at(-1)![0]).toMatchObject({ ref, pi: "pi_2027" });
    expect(host.querySelector("[data-testid='oferta-pix']")).not.toBeNull();
    expect(host.querySelector("[data-testid='pix-email']")!.textContent).toContain("maria.teste@example.com");
    status.mockResolvedValue({ ok: true, pago: true, status: "succeeded", metodo: "pix" });
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();
    expect(host.querySelector("[data-testid='pos-email']")!.textContent).toContain("maria.teste@example.com");
    expect(host.querySelector("[data-testid='pos-copiar']")).not.toBeNull();
    expect(sessionStorage.getItem("p2027-qa-stripe-email")).toBeNull(); // pago: sai junto da ref (o "Você já comprou" guarda o dele)
    expect(JSON.stringify(evento.mock.calls)).not.toContain("maria.teste");
  });
  it("rodada 2 · fora do layout 'cartao' (a /tudo usa 'cakto') nada muda: sem e-mail na aba, sem a linha do e-mail no Pix, sem a pergunta do e-mail", async () => {
    await abrirCheckout(opcoes({ layout: "cakto", storagePrefix: "tudo-qa", pagina: "tudo" }));
    await flush();
    digitar("#oc-nome", "Ana Teste");
    digitar("#oc-email", "ana@gmial.com");
    await tocarPagar();
    expect(host.querySelector("[data-testid='email-pergunta']")).toBeNull();
    expect(host.querySelector("[data-testid='oferta-pix']")).not.toBeNull();
    expect(host.querySelector("[data-testid='pix-email']")).toBeNull();
    expect(chavesDaAba().some((k) => k.endsWith("-stripe-email"))).toBe(false);
    expect(confirmPixPayment).toHaveBeenCalledWith("pi_2027_secret_QA", { payment_method: { billing_details: { email: "ana@gmial.com", name: "Ana Teste" } } }, { handleActions: false });
  });

  describe("rodada 2 (T-M1) · voltou do Pix e corrigiu o e-mail", () => {
    // o 1º pedido (ref da aba) é o "pi_velho"; depois do "Voltar" nasce outra ref → "pi_novo"
    const cenario = async (trocaOk: boolean) => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      try { return await passos(trocaOk); } finally { vi.useRealTimers(); }
    };
    const passos = async (trocaOk: boolean) => {
      let refVelha: string | null = null;
      criar.mockImplementation(async (c: Record<string, unknown>) => {
        refVelha ??= String(c.ref);
        const velho = c.ref === refVelha;
        if (velho && c.pi === "pi_velho" && c.email === "ana.certa@exemplo.com") return trocaOk ? { ok: true, pi: "pi_velho", clientSecret: "pi_velho_secret", status: "requires_action" } : { ok: false };
        return { ok: true, pi: velho ? "pi_velho" : "pi_novo", clientSecret: velho ? "pi_velho_secret" : "pi_novo_secret", status: "requires_action" };
      });
      confirmPixPayment.mockImplementation(async (cs: string) => ({ paymentIntent: { id: cs.split("_secret")[0], status: "requires_action", next_action: { type: "pix_display_qr_code", pix_display_qr_code: { data: QR, expires_at: Math.floor(Date.now() / 1000) + 1700 } } } }));
      await abrirCheckout(opcoes());
      await flush();
      digitar("#oc-email", "ana@exemplo.com");
      await tocarPagar();
      expect(host.querySelector("[data-testid='pix-email']")!.textContent).toContain("ana@exemplo.com");
      // rodada 3: o "Corrigir" do alto troca o e-mail no MESMO Pix (testes abaixo); este é o caminho do "Voltar" de baixo
      (host.querySelector("#oc-voltar-pix") as HTMLElement).click();
      await flush();
      expect(host.querySelector("[data-testid='aviso-pix-velho']")!.textContent).toMatch(/^O Pix anterior libera o acesso em ana@exemplo\.com \(vale até \d\dh\d\d\)\. Se você já pagou ele, não pague de novo\.$/);
      expect((host.querySelector("#oc-email") as HTMLInputElement).value).toBe("ana@exemplo.com");
      digitar("#oc-email", "ana.certa@exemplo.com");
      await tocarPagar();
      // o PI velho recebe o e-mail novo, 1 vez, com a ref dele
      const trocas = criar.mock.calls.filter(([c]) => c.pi === "pi_velho" && c.email === "ana.certa@exemplo.com");
      expect(trocas).toHaveLength(1);
      expect(trocas[0][0]).toMatchObject({ ref: refVelha, pagina: "p2027" });
      expect(host.querySelector("[data-testid='pix-email']")!.textContent).toContain("ana.certa@exemplo.com"); // o Pix novo
      // agora quem paga é o Pix VELHO (o código já estava copiado no banco)
      status.mockImplementation(async (c: { pi: string }) => (c.pi === "pi_velho" ? { ok: true, pago: true, status: "succeeded", metodo: "pix" } : { ok: true, pago: false, status: "requires_action" }));
      vi.advanceTimersByTime(5000);
      await flush();
      expect(evento.mock.calls.some((c) => c[0] === "landing_stripe_pix_velho_pago")).toBe(true);
      return host.querySelector("[data-testid='pos-email']")!.textContent ?? "";
    };
    it("a troca deu certo: pago o Pix velho, a tela mostra o e-mail corrigido (é pra ele que o acesso vai)", async () => {
      expect(await cenario(true)).toContain("ana.certa@exemplo.com");
      expect(evento.mock.calls.some((c) => c[0] === "landing_stripe_pix_velho_email" && c[1]?.ok === true)).toBe(true);
    });
    it("a troca falhou: pago o Pix velho, a tela mostra o e-mail que ESTÁ nele (o antigo), nunca um que não tem acesso", async () => {
      const t = await cenario(false);
      expect(t).toContain("ana@exemplo.com");
      expect(t).not.toContain("ana.certa");
    });
  });

  it("rodada 2 (T-M2) · Pix vencido (o servidor diz requires_payment_method): sai do 'Esperando o Pix' pro formulário com o aviso; Pagar gera outro QR no MESMO pedido", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      await abrirCheckout(opcoes());
      await flush();
      digitar("#oc-email", "bia@exemplo.com");
      await tocarPagar();
      expect(host.querySelector("[data-testid='oferta-pix']")).not.toBeNull();
      const ref = sessionStorage.getItem("p2027-qa-stripe-ref");
      status.mockResolvedValue({ ok: true, pago: false, status: "requires_payment_method" });
      vi.advanceTimersByTime(3000);
      await flush();
      expect(host.querySelector("[data-testid='oferta-pix']")).toBeNull();
      expect(host.querySelector("#oc-erro")!.textContent).toBe("Esse Pix venceu. Toque em Pagar pra gerar outro.");
      expect((host.querySelector("#oc-email") as HTMLInputElement).value).toBe("bia@exemplo.com");
      expect(evento.mock.calls.some((c) => c[0] === "landing_stripe_pix_vencido")).toBe(true);
      expect(criar.mock.calls.at(-1)![0]).toMatchObject({ ref, pi: "pi_2027" }); // mesmo pedido (mesma ref, mesmo PI): nada novo é cobrado
      expect(sessionStorage.getItem("p2027-qa-stripe-ref")).toBe(ref);
      confirmPixPayment.mockClear();
      status.mockResolvedValue({ ok: true, pago: false, status: "requires_action" });
      await tocarPagar();
      expect(confirmPixPayment).toHaveBeenCalledOnce();
      expect(confirmPixPayment.mock.calls[0][0]).toBe("pi_2027_secret_QA");
      expect(host.querySelector("[data-testid='oferta-pix']")).not.toBeNull();
    } finally { vi.useRealTimers(); }
  });
  /* ───────── rodada 3 (T2 + cliente fria) ───────── */
  const REAL = Date.UTC(2026, 10, 24, 15, 0, 0); // 24/11 12:00 em Brasília
  const MIN = 60_000;
  const horaDoAparelho = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`; };
  const qrDaStripe = (expiraEm: number) => ({ paymentIntent: { id: "pi_2027", status: "requires_action", next_action: { type: "pix_display_qr_code", pix_display_qr_code: { data: QR, expires_at: Math.floor(expiraEm / 1000) } } } });

  it("rodada 3 (T2-MÉDIA 1) · celular com a hora adiantada (1 h e 20 min): o Pix FICA; só vence 31 min depois de o QR chegar (tempo decorrido no aparelho)", async () => {
    for (const adiantado of [60, 20]) {
      let celular = REAL + adiantado * MIN;
      const spy = vi.spyOn(Date, "now").mockImplementation(() => celular);
      try {
        confirmPixPayment.mockResolvedValue(qrDaStripe(REAL + 30 * MIN)); // a Stripe carimba no relógio DELA (o certo)
        await abrirCheckout(opcoes());
        await flush();
        digitar("#oc-email", "bia@exemplo.com");
        await tocarPagar();
        expect(host.querySelector("[data-testid='oferta-pix']")).not.toBeNull();
        expect(host.querySelector("[data-testid='pix-validade']")!.textContent).toBe(`Vale por 30 minutos (até ${horaDoAparelho(celular + 30 * MIN)}). O acesso também chega no seu e-mail.`);
        // ela vai no app do banco e volta 12 e 29 min depois (no relógio do celular); o servidor ainda espera o Pix
        for (const m of [12, 29]) {
          celular = REAL + (adiantado + m) * MIN;
          document.dispatchEvent(new Event("visibilitychange"));
          await flush();
          expect(host.querySelector("[data-testid='oferta-pix']")).not.toBeNull();
        }
        expect(evento.mock.calls.some((c) => c[0] === "landing_stripe_pix_vencido")).toBe(false);
        // 32 min depois de o QR chegar: vence pelo relógio, mesma saída de quando o servidor diz que venceu (mesmo pedido)
        celular = REAL + (adiantado + 32) * MIN;
        document.dispatchEvent(new Event("visibilitychange"));
        await flush();
        expect(host.querySelector("[data-testid='oferta-pix']")).toBeNull();
        expect(host.querySelector("#oc-erro")!.textContent).toBe("Esse Pix venceu. Toque em Pagar pra gerar outro.");
      } finally { spy.mockRestore(); _zerar(); host.innerHTML = ""; sessionStorage.clear(); evento.mockClear(); }
    }
  });
  it("rodada 3 (T2-MÉDIA 1) · recarga com o Pix aberto: vale o servidor — o MESMO Pix volta mesmo com o celular 1 h adiantado (sem hora que pareça vencida); com o relógio certo, 'Vale até' a hora da Stripe", async () => {
    let celular = REAL + 60 * MIN;
    const spy = vi.spyOn(Date, "now").mockImplementation(() => celular);
    try {
      criar.mockResolvedValue({ ok: true, pi: "pi_2027", clientSecret: "pi_2027_secret_QA", status: "requires_action", pix: { data: QR, expires_at: Math.floor((REAL + 25 * MIN) / 1000) } });
      await abrirCheckout(opcoes());
      await flush();
      expect(host.querySelector("[data-testid='oferta-pix']")).not.toBeNull();
      expect((host.querySelector("#oc-codigo") as HTMLInputElement).value).toBe(QR);
      expect(host.querySelector("[data-testid='pix-validade']")!.textContent).toBe("O acesso também chega no seu e-mail.");
      document.dispatchEvent(new Event("visibilitychange")); // o relógio não derruba um Pix que voltou na recarga: só o servidor
      await flush();
      expect(host.querySelector("[data-testid='oferta-pix']")).not.toBeNull();
      _zerar(); host.innerHTML = "";
      celular = REAL;
      await abrirCheckout(opcoes());
      await flush();
      expect(host.querySelector("[data-testid='pix-validade']")!.textContent).toBe(`Vale até ${horaDoAparelho(REAL + 25 * MIN)}. O acesso também chega no seu e-mail.`);
    } finally { spy.mockRestore(); }
  });
  it("rodada 3 (T2-MÉDIA 1) · o Pix foi pago no banco e ela toca em Pagar no CARTÃO (mesmo pedido): tela de pago com o e-mail do Pix, nenhuma confirmação de cartão", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      await abrirCheckout(opcoes());
      await flush();
      digitar("#oc-email", "bia@exemplo.com");
      await tocarPagar();
      status.mockResolvedValue({ ok: true, pago: false, status: "requires_payment_method" }); // o servidor diz que venceu → formulário, mesmo pedido
      vi.advanceTimersByTime(3000);
      await flush();
      expect(host.querySelector("#oc-erro")!.textContent).toBe("Esse Pix venceu. Toque em Pagar pra gerar outro.");
      // ...mas o banco ainda passou o Pix: o servidor agora diz que o pedido está PAGO
      criar.mockResolvedValue({ ok: true, pi: "pi_2027", clientSecret: "pi_2027_secret_QA", status: "succeeded" });
      status.mockResolvedValue({ ok: true, pago: false, status: "succeeded", metodo: "pix" });
      (host.querySelector("[data-metodo='card']") as HTMLElement).click();
      await flush();
      digitar("#oc-email", "outra@exemplo.com");
      await tocarPagar();
      expect(confirmPayment).not.toHaveBeenCalled();
      expect(confirmPixPayment).toHaveBeenCalledOnce(); // só o do 1º Pix
      expect(host.querySelector("[data-testid='pos-compra']")).not.toBeNull();
      expect(host.querySelector("[data-testid='pos-email']")!.textContent).toContain("bia@exemplo.com"); // o e-mail que estava no pagamento
      expect(host.querySelector("[data-testid='pos-email']")!.textContent).not.toContain("outra@");
      expect(evento.mock.calls.some((c) => c[0] === "landing_stripe_ja_estava_pago")).toBe(true);
      expect(pixel.mock.calls.filter((c) => c[0] === "Purchase")).toHaveLength(1);
    } finally { vi.useRealTimers(); }
  });
  it("rodada 3 (T2-MÉDIA 1) · mesmo caso no Pix: Pagar num pedido já pago não gera QR novo, vai pro pago", async () => {
    await abrirCheckout(opcoes());
    await flush();
    criar.mockResolvedValue({ ok: true, pi: "pi_2027", clientSecret: "pi_2027_secret_QA", status: "succeeded" });
    status.mockResolvedValue({ ok: true, pago: false, status: "succeeded", metodo: "pix" });
    digitar("#oc-email", "bia@exemplo.com");
    await tocarPagar();
    expect(confirmPixPayment).not.toHaveBeenCalled();
    expect(host.querySelector("[data-testid='pos-compra']")).not.toBeNull();
  });
  it("rodada 3 (T2-BAIXA 2) · uma resposta ATRASADA dizendo 'venceu' (pedida antes do Pix novo do mesmo pedido) não derruba o Pix novo", async () => {
    await abrirCheckout(opcoes());
    await flush();
    digitar("#oc-email", "ana@exemplo.com");
    await tocarPagar();
    status.mockResolvedValue({ ok: true, pago: false, status: "requires_payment_method" });
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();
    expect(host.querySelector("#oc-erro")!.textContent).toBe("Esse Pix venceu. Toque em Pagar pra gerar outro.");
    let soltarVelha: (v: unknown) => void = () => {};
    status.mockImplementationOnce(() => new Promise((ok) => { soltarVelha = ok; }));
    status.mockResolvedValue({ ok: true, pago: false, status: "requires_action" });
    document.dispatchEvent(new Event("visibilitychange")); // internet lenta: a pergunta sai com o Pix ainda vencido
    await flush();
    await tocarPagar(); // Pix NOVO no mesmo pedido
    expect(host.querySelector("[data-testid='oferta-pix']")).not.toBeNull();
    soltarVelha({ ok: true, pago: false, status: "requires_payment_method" }); // chega a resposta velha
    await flush();
    expect(host.querySelector("[data-testid='oferta-pix']")).not.toBeNull();
    expect(evento.mock.calls.filter((c) => c[0] === "landing_stripe_pix_vencido")).toHaveLength(1);
  });
  it("rodada 3 (cliente fria + W2-B3) · a hora do Pix: 'Vale por 30 minutos (até 01h13)', 30 min no relógio e no fuso do aparelho", async () => {
    const spy = vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 10, 24, 3, 43, 0));
    try {
      await abrirCheckout(opcoes());
      await flush();
      digitar("#oc-email", "bia@exemplo.com");
      await tocarPagar();
      expect(host.querySelector("[data-testid='pix-validade']")!.textContent).toBe(`Vale por 30 minutos (até ${horaDoAparelho(Date.UTC(2026, 10, 24, 4, 13, 0))}). O acesso também chega no seu e-mail.`);
      expect(host.querySelector("[data-testid='pix-validade'] .nw")!.textContent).toBe("e-mail");
    } finally { spy.mockRestore(); }
  });
  it("rodada 3 (T2-BAIXA 1) · a pergunta 'Você quis dizer…?' some quando ela mexe no campo; o 'Sim' usa a sugestão do que está no campo AGORA", async () => {
    await abrirCheckout(opcoes());
    await flush();
    digitar("#oc-email", "mariasilva@gmial.com");
    await tocarPagar();
    expect(host.querySelector("[data-testid='email-pergunta']")).not.toBeNull();
    digitar("#oc-email", "maria.silva@gmail.com"); // ela mesma conserta
    expect(host.querySelector("[data-testid='email-pergunta']")).toBeNull();
    expect((host.querySelector("#oc-pagar") as HTMLElement).hidden).toBe(false);
    expect(confirmPixPayment).not.toHaveBeenCalled();
    await tocarPagar();
    expect(confirmPixPayment).toHaveBeenCalledWith("pi_2027_secret_QA", { payment_method: { billing_details: { email: "maria.silva@gmail.com" } } }, { handleActions: false });
    // o campo mudou sem aviso (preenchimento automático) e ela toca "Sim": vale a sugestão do que está no campo na hora do toque
    _zerar(); host.innerHTML = ""; sessionStorage.clear(); confirmPixPayment.mockClear();
    await abrirCheckout(opcoes());
    await flush();
    digitar("#oc-email", "ze@hotmial.com");
    await tocarPagar();
    (host.querySelector("#oc-email") as HTMLInputElement).value = "jose@hotmial.com";
    (host.querySelector("[data-testid='email-pergunta'] [data-usar]") as HTMLElement).click();
    await flush();
    expect(confirmPixPayment).toHaveBeenCalledWith("pi_2027_secret_QA", { payment_method: { billing_details: { email: "jose@hotmail.com" } } }, { handleActions: false });
  });

  describe("rodada 3 (T2-BAIXA 4 + cliente fria) · 'Corrigir' o e-mail com o Pix aberto troca o e-mail NO MESMO pagamento", () => {
    const gerarPix = async () => {
      await abrirCheckout(opcoes());
      await flush();
      digitar("#oc-email", "ana@exemplo.com");
      await tocarPagar();
      expect(host.querySelector("[data-testid='pix-email']")!.textContent).toContain("ana@exemplo.com");
    };
    const abrirEditor = async () => {
      (host.querySelector("[data-corrigir-email]") as HTMLElement).click();
      await flush();
      return host.querySelector("[data-testid='pix-email-editar']")!;
    };
    const salvar = async (ed: Element, novo: string) => {
      const campo = ed.querySelector("#ct-email-novo") as HTMLInputElement;
      campo.value = novo; campo.dispatchEvent(new Event("input"));
      (ed.querySelector("[data-salvar]") as HTMLElement).click();
      await flush();
    };
    it("deu certo: o MESMO Pix na tela (mesmo QR, nenhum QR novo, nenhum pedido novo, sem o aviso) com o e-mail novo; pagou → o pago mostra o novo", async () => {
      await gerarPix();
      const ref = sessionStorage.getItem("p2027-qa-stripe-ref");
      criar.mockClear(); confirmPixPayment.mockClear();
      criar.mockResolvedValue({ ok: true, pi: "pi_2027", clientSecret: "pi_2027_secret_QA", status: "requires_action" });
      // Cancelar não muda nada; e-mail incompleto não vai pro servidor
      let ed = await abrirEditor();
      expect((ed.querySelector("#ct-email-novo") as HTMLInputElement).value).toBe("ana@exemplo.com");
      (ed.querySelector("[data-cancelar]") as HTMLElement).click();
      expect(host.querySelector("[data-testid='pix-email']")!.textContent).toContain("ana@exemplo.com");
      ed = await abrirEditor();
      await salvar(ed, "ana@");
      expect(ed.querySelector("#ct-email-novo-erro")!.textContent).toBe("Confira o e-mail: parece que falta alguma coisa.");
      expect(criar).not.toHaveBeenCalled();
      await salvar(ed, "Ana.Certa@Exemplo.com ");
      expect(criar).toHaveBeenCalledOnce();
      expect(criar.mock.calls[0][0]).toMatchObject({ ref, pi: "pi_2027", email: "ana.certa@exemplo.com", pagina: "p2027" });
      expect(confirmPixPayment).not.toHaveBeenCalled();
      expect(host.querySelector("[data-testid='oferta-pix']")).not.toBeNull();
      expect((host.querySelector("#oc-codigo") as HTMLInputElement).value).toBe(QR);
      expect(host.querySelector("[data-testid='pix-email']")!.textContent).toBe("O acesso vai pro e-mail ana.certa@exemplo.comCorrigir");
      expect(host.querySelector("[data-testid='aviso-pix-velho']")).toBeNull();
      expect(host.querySelector("#oc-email")).toBeNull(); // não voltou pro formulário
      expect(sessionStorage.getItem("p2027-qa-stripe-ref")).toBe(ref);
      expect(JSON.parse(sessionStorage.getItem("p2027-qa-stripe-email")!).email).toBe("ana.certa@exemplo.com");
      expect(evento.mock.calls.some((c) => c[0] === "landing_stripe_pix_email_trocado" && c[1]?.ok === true)).toBe(true);
      status.mockResolvedValue({ ok: true, pago: true, status: "succeeded", metodo: "pix" });
      document.dispatchEvent(new Event("visibilitychange"));
      await flush();
      expect(host.querySelector("[data-testid='pos-email']")!.textContent).toContain("ana.certa@exemplo.com");
      expect(JSON.stringify(evento.mock.calls)).not.toContain("ana.certa");
    });
    it("o 'ir'/Enter do teclado no campo novo salva (o Salvar pode estar atrás do teclado)", async () => {
      await gerarPix();
      criar.mockClear();
      criar.mockResolvedValue({ ok: true, pi: "pi_2027", clientSecret: "pi_2027_secret_QA", status: "requires_action" });
      const ed = await abrirEditor();
      const campo = ed.querySelector("#ct-email-novo") as HTMLInputElement;
      expect(document.activeElement).toBe(campo); // o teclado já abre no campo
      campo.value = "ana.certa@exemplo.com"; campo.dispatchEvent(new Event("input"));
      campo.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await flush();
      expect(criar).toHaveBeenCalledOnce();
      expect(host.querySelector("[data-testid='pix-email']")!.textContent).toContain("ana.certa@exemplo.com");
    });
    it("falhou (rede ou servidor): o caminho de antes — formulário com o e-mail corrigido e o aviso dizendo pra que e-mail o Pix anterior libera", async () => {
      await gerarPix();
      criar.mockResolvedValue({ ok: false });
      await salvar(await abrirEditor(), "ana.certa@exemplo.com");
      expect(host.querySelector("[data-testid='oferta-pix']")).toBeNull();
      expect((host.querySelector("#oc-email") as HTMLInputElement).value).toBe("ana.certa@exemplo.com");
      const aviso = host.querySelector("[data-testid='aviso-pix-velho']")!;
      expect(aviso.textContent).toMatch(/^O Pix anterior libera o acesso em ana@exemplo\.com \(vale até \d\dh\d\d\)\. Se você já pagou ele, não pague de novo\.$/);
      expect(aviso.querySelector("b")!.textContent).toBe("ana@exemplo.com");
      expect(evento.mock.calls.some((c) => c[0] === "landing_stripe_pix_email_trocado" && c[1]?.ok === false && c[1]?.motivo === "falhou")).toBe(true);
    });
    it("o Pix já tinha sido pago quando ela salvou: tela de pago com o e-mail que ESTAVA no pagamento (o antigo); nada é confirmado de novo", async () => {
      await gerarPix();
      confirmPixPayment.mockClear();
      criar.mockResolvedValue({ ok: true, pi: "pi_2027", clientSecret: "pi_2027_secret_QA", status: "succeeded" });
      await salvar(await abrirEditor(), "ana.certa@exemplo.com");
      expect(host.querySelector("[data-testid='pos-compra']")).not.toBeNull();
      expect(host.querySelector("[data-testid='pos-email']")!.textContent).toContain("ana@exemplo.com");
      expect(host.querySelector("[data-testid='pos-email']")!.textContent).not.toContain("ana.certa");
      expect(confirmPixPayment).not.toHaveBeenCalled();
      expect(pixel.mock.calls.filter((c) => c[0] === "Purchase")).toHaveLength(1);
    });
    it("o Pix venceu enquanto ela corrigia: o e-mail novo fica no pagamento e ela volta pro formulário com 'Esse Pix venceu' (o próximo Pagar é no MESMO pedido)", async () => {
      await gerarPix();
      const ref = sessionStorage.getItem("p2027-qa-stripe-ref");
      criar.mockResolvedValue({ ok: true, pi: "pi_2027", clientSecret: "pi_2027_secret_QA", status: "requires_payment_method" });
      await salvar(await abrirEditor(), "ana.certa@exemplo.com");
      expect(host.querySelector("#oc-erro")!.textContent).toBe("Esse Pix venceu. Toque em Pagar pra gerar outro.");
      expect((host.querySelector("#oc-email") as HTMLInputElement).value).toBe("ana.certa@exemplo.com");
      expect(sessionStorage.getItem("p2027-qa-stripe-ref")).toBe(ref);
    });
  });

  it("rodada 2 (V-M7) · e-mail com erro de digitação: pergunta UMA vez antes de gerar o Pix, com 2 botões grandes; 'Sim, usar o corrigido' paga com o corrigido", async () => {
    await abrirCheckout(opcoes());
    await flush();
    digitar("#oc-email", "maria.silva@gmial.com");
    await tocarPagar();
    const p = host.querySelector("[data-testid='email-pergunta']")!;
    expect(p.textContent).toContain("Você quis dizer maria.silva@gmail.com?");
    expect([...p.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Sim, usar o corrigido", "Não, está certo assim"]);
    expect((host.querySelector("#oc-pagar") as HTMLElement).hidden).toBe(true);
    expect(confirmPixPayment).not.toHaveBeenCalled();
    expect(evento.mock.calls.some((c) => c[0] === "landing_stripe_pagar")).toBe(false);
    (p.querySelector("[data-usar]") as HTMLElement).click();
    await flush();
    expect(host.querySelector("[data-testid='email-pergunta']")).toBeNull();
    expect(confirmPixPayment).toHaveBeenCalledWith("pi_2027_secret_QA", { payment_method: { billing_details: { email: "maria.silva@gmail.com" } } }, { handleActions: false });
    expect(host.querySelector("[data-testid='pix-email']")!.textContent).toContain("maria.silva@gmail.com");
    expect(JSON.stringify(evento.mock.calls)).not.toContain("maria.silva");
  });
  it("rodada 2 (V-M7) · 'Não, está certo assim' paga com o que ela digitou, e a pergunta não volta pra esse e-mail", async () => {
    await abrirCheckout(opcoes());
    await flush();
    digitar("#oc-email", "ze@hotmial.com");
    await tocarPagar();
    (host.querySelector("[data-testid='email-pergunta'] [data-manter]") as HTMLElement).click();
    await flush();
    expect(confirmPixPayment).toHaveBeenCalledWith("pi_2027_secret_QA", { payment_method: { billing_details: { email: "ze@hotmial.com" } } }, { handleActions: false });
    expect(evento.mock.calls.some((c) => c[0] === "landing_stripe_email_pergunta_resposta" && c[1]?.escolha === "manteve")).toBe(true);
    (host.querySelector("#oc-voltar-pix") as HTMLElement).click(); // volta pro formulário e paga de novo com o MESMO e-mail
    await flush();
    await tocarPagar();
    expect(host.querySelector("[data-testid='email-pergunta']")).toBeNull();
    expect(confirmPixPayment).toHaveBeenCalledTimes(2);
  });

  it("rodada 2/3 (V-M2, V2-M1) · digitou no esqueleto ANTES e DURANTE a troca, letra por letra: o e-mail chega inteiro e o foco vai pro campo de verdade (payment.ts de verdade)", async () => {
    host.innerHTML = '<div data-esqueleto><input id="sk-email" type="email"></div>';
    const sk = host.querySelector("#sk-email") as HTMLInputElement;
    sk.focus();
    const real = await vi.importActual<typeof import("@/p2027/payment")>("@/p2027/payment");
    const letras = [..."ana@exemplo.com"];
    // cada tecla vai pro campo que está com o foco, no fim (o teclado de verdade; o cursor no fim é o que o V2 provou nos 2 motores,
    // scripts/04-checkout-atrasado.mjs — o jsdom não tem cursor em campo de e-mail)
    const tecla = (l: string) => { const a = document.activeElement; if (a instanceof HTMLInputElement) a.value += l; };
    for (const l of letras.slice(0, 3)) tecla(l); // "ana" antes do toque chegar no checkout
    const montando = real.mountPayment(host, { evento });
    for (const l of letras.slice(3, 7)) { tecla(l); await Promise.resolve(); } // "@exe" enquanto o pedaço do checkout chega
    await montando;
    for (const l of letras.slice(7)) tecla(l); // "mplo.com" depois da troca, no campo de verdade
    await flush();
    const novo = host.querySelector("#oc-email") as HTMLInputElement;
    expect(host.querySelector("#sk-email")).toBeNull();
    expect([...novo.value]).toEqual(letras);
    expect(document.activeElement).toBe(novo);
  });
});

describe("rodada 2 (T-BAIXA 1) · a faixa 'PRÉVIA'", () => {
  it("?print=1 só tira a faixa FORA do domínio de produção; no domínio, ?qa=1&print=1 continua com a faixa", async () => {
    const { faixaDaPrevia, DOMINIOS_PRODUCAO } = await import("@/p2027/previa");
    expect(faixaDaPrevia(true, "www.coreaplicativo.com.br", "?qa=1&print=1")).toBe(true);
    expect(faixaDaPrevia(true, "coreaplicativo.com.br", "?print=1&qa=1")).toBe(true);
    expect(faixaDaPrevia(true, "www.coreaplicativo.com.br", "?qa=1")).toBe(true);
    expect(faixaDaPrevia(true, "127.0.0.1", "?print=1")).toBe(false);
    expect(faixaDaPrevia(true, "127.0.0.1", "")).toBe(true);
    expect(faixaDaPrevia(false, "www.coreaplicativo.com.br", "?print=1")).toBe(false);
    // a mesma lista de domínios do <head> e do payment.ts
    expect([...DOMINIOS_PRODUCAO]).toEqual(["coreaplicativo.com.br", "www.coreaplicativo.com.br"]);
    expect(HTML_CRU).toContain('["coreaplicativo.com.br", "www.coreaplicativo.com.br"].indexOf(location.hostname)');
    expect(readFileSync(resolve(RAIZ, "src/p2027/main.ts"), "utf8")).toContain("faixaDaPrevia(QA, location.hostname, location.search)");
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
  it("rodada 2 (V-M3) · a barra fixa só liga quando a 1ª tela saiu INTEIRA da tela", async () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 0));
    const pos: Record<string, [number, number]> = { topo: [-560, 120], cartao: [2000, 2600], preco: [2100, 2160], fecho: [5000, 5300] };
    const orig = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const p = pos[this.id];
      return p ? ({ top: p[0], bottom: p[1], left: 0, right: 390, width: 390, height: p[1] - p[0], x: 0, y: p[0], toJSON: () => ({}) } as DOMRect) : orig.call(this);
    };
    try {
      await import("@/p2027/main");
      const barra = document.getElementById("barra")!;
      expect(barra.classList.contains("on")).toBe(false); // ainda há 120 px da 1ª tela à vista
      pos.topo = [-680, 0];
      window.dispatchEvent(new Event("resize"));
      await vi.waitFor(() => expect(barra.classList.contains("on")).toBe(true));
      expect(barra.classList.contains("com-preco")).toBe(false); // sem preço: o número ainda não passou pela tela
      const main = readFileSync(resolve(RAIZ, "src/p2027/main.ts"), "utf8");
      expect(main).toContain("const passouTopo = topo.getBoundingClientRect().bottom <= 0;");
    } finally { Element.prototype.getBoundingClientRect = orig; }
  });
  it("rodada 2 (T-BAIXA 2) · o 'Pagar' do esqueleto responde ao toque ('Carregando…') e monta o pagamento; o pedaço do checkout esquenta na 1ª rolagem", async () => {
    await import("@/p2027/main");
    const pg = document.querySelector("[data-sk-pagar]") as HTMLElement;
    pg.click();
    expect(pg.textContent).toBe("Carregando…");
    expect(pagina.mountPayment).toHaveBeenCalledOnce();
    expect(readFileSync(resolve(RAIZ, "src/p2027/main.ts"), "utf8")).toMatch(/window\.addEventListener\("scroll", \(\) => \{ void import\("@\/landing\/stripe-checkout"\)[\s\S]*?\{ once: true, passive: true \}\);/);
  });
  it("rodada 2 (V-M1) · teclado que sobe DEPOIS dos 350 ms (600 ms): a conta é refeita no resize da parte visível e o botão de pagar sobe pra vista", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q === "(pointer: coarse)", media: q, addEventListener() {}, removeEventListener() {} }));
    const vv = Object.assign(new EventTarget(), { height: 844, offsetTop: 0 });
    vi.stubGlobal("visualViewport", vv);
    const scrollBy = vi.fn(); vi.stubGlobal("scrollBy", scrollBy);
    await import("@/p2027/main");
    // o formulário de verdade no lugar do esqueleto (o mountPayment está simulado neste bloco)
    const alvo = document.getElementById("pagamento")!;
    alvo.innerHTML = '<input id="oc-email" type="email"><button id="oc-pagar" type="button">Pagar</button>';
    const campo = alvo.querySelector("#oc-email") as HTMLInputElement, botao = alvo.querySelector("#oc-pagar") as HTMLElement;
    campo.getBoundingClientRect = () => ({ top: 600, bottom: 652 } as DOMRect);
    botao.getBoundingClientRect = () => ({ top: 744, bottom: 800 } as DOMRect);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      campo.focus();
      vi.advanceTimersByTime(400); // os 350 ms passaram com a tela inteira: nada a fazer
      expect(scrollBy).not.toHaveBeenCalled();
      vv.height = 480; vv.dispatchEvent(new Event("resize")); // o teclado chegou aos 600 ms
      vi.advanceTimersByTime(100);
      expect(scrollBy).toHaveBeenCalledOnce();
      const arg = scrollBy.mock.calls[0][0] as { top: number };
      expect(arg.top).toBe(332); // 800 + 12 − 480: o botão inteiro na parte visível, o e-mail ainda abaixo do topo
      campo.blur(); vv.dispatchEvent(new Event("resize")); vi.advanceTimersByTime(100);
      expect(scrollBy).toHaveBeenCalledOnce(); // saiu do campo: não mexe mais
    } finally { vi.useRealTimers(); }
  });
  it("rodada 3 (V2-M2) · teclado aberto e o formulário cresce (a sugestão 'Você quis dizer…?' embaixo do campo): a conta é refeita e o botão de pagar volta pra vista", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q === "(pointer: coarse)", media: q, addEventListener() {}, removeEventListener() {} }));
    const vv = Object.assign(new EventTarget(), { height: 480, offsetTop: 0 }); // o teclado já está aberto
    vi.stubGlobal("visualViewport", vv);
    const scrollBy = vi.fn(); vi.stubGlobal("scrollBy", scrollBy);
    type Obs = { cb: () => void; alvo?: Element; desligado: boolean };
    const observadores: Obs[] = [];
    class RO { o: Obs; constructor(cb: () => void) { this.o = { cb, desligado: false }; observadores.push(this.o); } observe(el: Element) { this.o.alvo = el; } unobserve() {} disconnect() { this.o.desligado = true; } }
    vi.stubGlobal("ResizeObserver", RO);
    await import("@/p2027/main");
    const alvo = document.getElementById("pagamento")!;
    alvo.innerHTML = '<input id="oc-email" type="email"><button id="oc-pagar" type="button">Pagar</button>';
    const campo = alvo.querySelector("#oc-email") as HTMLInputElement, botao = alvo.querySelector("#oc-pagar") as HTMLElement;
    let fimDoBotao = 440;
    campo.getBoundingClientRect = () => ({ top: 300, bottom: 352 } as DOMRect);
    botao.getBoundingClientRect = () => ({ top: fimDoBotao - 56, bottom: fimDoBotao } as DOMRect);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      campo.focus();
      vi.advanceTimersByTime(400);
      expect(scrollBy).not.toHaveBeenCalled(); // 440 + 12 ≤ 480: o botão inteiro à vista
      const ro = observadores.find((x) => x.alvo === alvo)!;
      expect(ro).toBeTruthy();
      fimDoBotao = 496; // a sugestão apareceu: o botão desceu 56 px, pra trás do teclado (sem mudar o tamanho da tela)
      ro.cb(); vi.advanceTimersByTime(100);
      expect(scrollBy).toHaveBeenCalledOnce();
      expect((scrollBy.mock.calls[0][0] as { top: number }).top).toBe(28); // 496 + 12 − 480
      campo.blur();
      expect(ro.desligado).toBe(true); // saiu do campo: para de observar
    } finally { vi.useRealTimers(); }
  });
  it("rodada 3 · 'Corrigir' com o Pix aberto e o teclado em cima: o 'Salvar' do campo novo sobe pra vista (a mesma conta do botão de pagar)", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q === "(pointer: coarse)", media: q, addEventListener() {}, removeEventListener() {} }));
    const vv = Object.assign(new EventTarget(), { height: 330, offsetTop: 0 }); // 375×667 com o teclado
    vi.stubGlobal("visualViewport", vv);
    const scrollBy = vi.fn(); vi.stubGlobal("scrollBy", scrollBy);
    await import("@/p2027/main");
    const alvo = document.getElementById("pagamento")!;
    alvo.innerHTML = '<div class="oc-pix"><div class="ct-pix-editar"><input id="ct-email-novo" type="email"><button type="button" data-salvar>Salvar</button></div></div>';
    const campo = alvo.querySelector("#ct-email-novo") as HTMLInputElement, salvar = alvo.querySelector("[data-salvar]") as HTMLElement;
    campo.getBoundingClientRect = () => ({ top: 200, bottom: 252 } as DOMRect);
    salvar.getBoundingClientRect = () => ({ top: 312, bottom: 360 } as DOMRect);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      campo.focus();
      vi.advanceTimersByTime(400);
      expect(scrollBy).toHaveBeenCalledOnce();
      expect((scrollBy.mock.calls[0][0] as { top: number }).top).toBe(42); // 360 + 12 − 330
    } finally { vi.useRealTimers(); }
  });
  it("rodada 3 (V2-B7) · tocar em 'Cartão' no esqueleto já marca Cartão e o botão diz 'no cartão'; o formulário de verdade abre no Cartão", async () => {
    const tocouCartao = vi.fn();
    pagina.mountPayment.mockImplementationOnce(async (alvo: HTMLElement) => {
      await new Promise((r) => setTimeout(r, 5)); // o pedaço do checkout baixando
      alvo.innerHTML = '<button type="button" data-metodo="card">Cartão</button>';
      alvo.querySelector("button")!.addEventListener("click", tocouCartao);
    });
    await import("@/p2027/main");
    const esq = document.querySelector("[data-esqueleto]")!;
    const cartaoSk = esq.querySelector("[data-sk-metodo='card']") as HTMLElement;
    cartaoSk.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    cartaoSk.click();
    expect(cartaoSk.getAttribute("aria-checked")).toBe("true");
    expect(esq.querySelector("[data-sk-metodo='pix']")!.getAttribute("aria-checked")).toBe("false");
    expect(esq.querySelector("[data-sk-pagar]")!.textContent).toMatch(/^Pagar R\$\s27,90 no cartão$/);
    expect(pagina.mountPayment).toHaveBeenCalledOnce();
    (esq.querySelector("[data-sk-metodo='pix']") as HTMLElement).click(); // mudou de ideia: volta pro Pix
    expect(esq.querySelector("[data-sk-pagar]")!.textContent).toMatch(/^Pagar R\$\s27,90 no Pix$/);
    cartaoSk.click();
    await vi.waitFor(() => expect(tocouCartao).toHaveBeenCalledOnce());
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
