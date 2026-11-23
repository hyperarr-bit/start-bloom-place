/**
 * /dia (23/11) — a "versão CORE do Porquim" (SPEC: novidades-guardadas/2026-11-23/porquim-core/SPEC.md).
 *   1. as chaves do <head>: PAGINA_DIA nasce "off" (→ /organizar com a mesma query), ?dia=on só na aba, OFERTA_DIA e TOPO_DIA;
 *   2. os textos-chave da SPEC, os 3 botões, as imagens (reais, com tamanho, leves) e as palavras proibidas;
 *   3. a oferta: um objeto só (src/dia/oferta.ts) = os 5 textos que mudam + a linha do servidor (27 → lp27, 67 → oferta sem braço);
 *   4. o checkout: o caminho PADRÃO do stripe-checkout (camada), sem parcela, sem CPF; pago → Purchase 1× (eventID = PI) e o
 *      pós-compra direto pro app com as duas lojas;
 *   5. os eventos levam funil "dia" e nunca e-mail; em prévia nada vai pro banco;
 *   6. as rotas, o cabeçalho de pagamento, o build e o binário das lojas; nenhuma outra página mudou.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { abrirCheckout, _zerar, type OpcoesCheckout } from "@/landing/stripe-checkout";
import { _zerarPosCompra } from "@/landing/pos-compra-app";
import { OFERTAS, ofertaDe, opcoesDaOferta, topoDe, type ChaveOferta } from "@/dia/oferta";

const trackEventBeacon = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", () => ({ trackEventBeacon, captureLandingMeta: vi.fn() }));

const raiz = resolve(__dirname, "../..");
const ler = (arq: string) => readFileSync(resolve(raiz, arq), "utf8");
const HTML = ler("dia.html");
const semNbsp = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
/** o corpo da página num documento à parte (sem rodar script nenhum) */
const pagina = () => new DOMParser().parseFromString(HTML, "text/html");
const textoDe = (d: Document) => { const c = d.getElementById("pagina")!.cloneNode(true) as HTMLElement; c.querySelectorAll("script,noscript").forEach((n) => n.remove()); return semNbsp(c.textContent ?? ""); };

/* ───────────────────────── 1. as chaves ───────────────────────── */
describe("as chaves do <head>", () => {
  const cabeca = HTML.match(/<script>\s*\/\*[\s\S]*?\*\/\s*(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];
  const loja = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
  const rodar = (fonte: string, busca: string, o: { host?: string; hash?: string; storage?: ReturnType<typeof loja> | null } = {}) => {
    const attrs: Record<string, string> = {}; const replace = vi.fn();
    const storage = o.storage === null ? { getItem: () => { throw new Error("sem storage"); }, setItem: () => { throw new Error("sem storage"); } } : (o.storage ?? loja());
    new Function("location", "document", "sessionStorage", fonte)({ search: busca, hash: o.hash ?? "", hostname: o.host ?? "www.coreaplicativo.com.br", replace }, { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } } }, storage);
    return { attrs, replace };
  };
  const ligada = cabeca.replace('var PAGINA_DIA = "off"', 'var PAGINA_DIA = "on"');

  it("nasce desligada, com a oferta 27, o topo lista e a faixa 'paga uma vez'", () => {
    expect(HTML).toMatch(/var FAIXA_DIA = "uma-vez";/);
    expect(HTML).toMatch(/var PAGINA_DIA = "off";/);
    expect(HTML).toMatch(/var OFERTA_DIA = "27";/);
    expect(HTML).toMatch(/var TOPO_DIA = "lista";/);
    expect(ligada).not.toBe(cabeca);
  });
  it("off: vai pro /organizar com a mesma query e esconde a página", () => {
    const r = rodar(cabeca, "?utm_content=c7&fbclid=x");
    expect(r.replace).toHaveBeenCalledWith("/organizar?utm_content=c7&fbclid=x");
    expect(r.attrs["data-desligada"]).toBe("");
    expect(rodar(cabeca, "").replace).toHaveBeenCalledWith("/organizar");
    expect(rodar(cabeca, "?utm_source=x", { hash: "#preco" }).replace).toHaveBeenCalledWith("/organizar?utm_source=x#preco"); // o #hash do link também vai
    expect(HTML).toContain("html[data-desligada] body { display: none; }");
  });
  it("?dia=on abre só naquela aba (sessão): vale nas próximas cargas da aba e não vale em outra", () => {
    const aba = loja();
    const r = rodar(cabeca, "?dia=on&utm_content=c7", { storage: aba });
    expect(r.replace).not.toHaveBeenCalled();
    expect(r.attrs).toEqual({ "data-oferta": "27", "data-topo": "lista", "data-faixa": "uma-vez" });
    expect(rodar(cabeca, "?utm_content=c7", { storage: aba }).replace).not.toHaveBeenCalled(); // a mesma aba, sem o parâmetro (volta do banco)
    expect(rodar(cabeca, "?utm_content=c7").replace).toHaveBeenCalled(); // outra aba
    expect(rodar(cabeca, "?dia=on", { storage: null }).replace).not.toHaveBeenCalled(); // sem storage: o parâmetro basta
    expect(HTML).not.toMatch(/localStorage|cookie/i); // nada de gravar por 30 dias
  });
  it("on: abre pra todo mundo, sem redirecionar", () => {
    const r = rodar(ligada, "?utm_content=c7");
    expect(r.replace).not.toHaveBeenCalled();
    expect(r.attrs).toEqual({ "data-oferta": "27", "data-topo": "lista", "data-faixa": "uma-vez" });
  });
  it("OFERTA_DIA e TOPO_DIA: só os valores previstos; qualquer outra coisa cai no padrão", () => {
    expect(rodar(ligada.replace('var OFERTA_DIA = "27"', 'var OFERTA_DIA = "67"'), "").attrs["data-oferta"]).toBe("67");
    expect(rodar(ligada.replace('var OFERTA_DIA = "27"', 'var OFERTA_DIA = "97"'), "").attrs["data-oferta"]).toBe("27");
    expect(rodar(ligada.replace('var TOPO_DIA = "lista"', 'var TOPO_DIA = "gesto"'), "").attrs["data-topo"]).toBe("gesto");
    expect(rodar(ligada.replace('var TOPO_DIA = "lista"', 'var TOPO_DIA = "x"'), "").attrs["data-topo"]).toBe("lista");
    expect(rodar(ligada.replace('var FAIXA_DIA = "uma-vez"', 'var FAIXA_DIA = "hoje"'), "").attrs["data-faixa"]).toBe("hoje");
    expect(rodar(ligada.replace('var FAIXA_DIA = "uma-vez"', 'var FAIXA_DIA = "amanha"'), "").attrs["data-faixa"]).toBe("uma-vez");
  });
  it("?oferta e ?topo só trocam na prévia (fora do domínio ou ?qa=1); no domínio, o link não muda o preço", () => {
    expect(rodar(ligada, "?oferta=67&topo=gesto").attrs).toEqual({ "data-oferta": "27", "data-topo": "lista", "data-faixa": "uma-vez" });
    expect(rodar(ligada, "?oferta=67&topo=gesto&faixa=hoje").attrs["data-faixa"]).toBe("uma-vez");
    expect(rodar(ligada, "?oferta=67&topo=gesto&faixa=hoje&qa=1").attrs).toEqual({ "data-oferta": "67", "data-topo": "gesto", "data-faixa": "hoje" });
    expect(rodar(ligada, "?oferta=67", { host: "localhost" }).attrs["data-oferta"]).toBe("67");
    expect(rodar(ligada, "?oferta=12&topo=zzz", { host: "localhost" }).attrs).toEqual({ "data-oferta": "27", "data-topo": "lista", "data-faixa": "uma-vez" });
  });
  it("a faixa do topo: 'paga uma vez' no HTML; 'só hoje, DD/MM' só com FAIXA_DIA 'hoje' (nenhuma urgência por padrão)", () => {
    const d = pagina();
    expect(semNbsp(d.querySelector(".promo")!.textContent!)).toBe("🔥 ACESSO VITALÍCIO · paga uma vez");
    expect(textoDe(d)).not.toMatch(/só hoje/i);
    const troca = HTML.match(/<script>\s*\/\* FAIXA_DIA "hoje"[\s\S]*?\*\/\s*(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];
    new Function("document", troca)(d); // sem a chave: nada muda
    expect(semNbsp(d.querySelector(".promo")!.textContent!)).toBe("🔥 ACESSO VITALÍCIO · paga uma vez");
    d.documentElement.setAttribute("data-faixa", "hoje");
    new Function("document", troca)(d);
    expect(semNbsp(d.querySelector(".promo")!.textContent!)).toMatch(/^🔥 ACESSO VITALÍCIO · só hoje, \d\d\/\d\d$/);
    expect(textoDe(d).match(/só hoje/g)).toHaveLength(1); // e só no topo
  });
  it("antes de ligar a oferta 67: o aviso da mistura com o sorteio da /oferta está escrito no <head>", () => {
    for (const t of ['ANTES DE LIGAR OFERTA_DIA "67"', "ST_oferta", "AB_PRECO_OFERTA", "EXCLUIR os PIs com url /dia", "SPEC 3.4"]) expect(HTML).toContain(t);
  });
  it("a ordem do topo é só CSS (html[data-topo='gesto']) e o noindex está lá", () => {
    expect(HTML).toContain('html[data-topo="gesto"] .pg .troca .gesto { order: 1;');
    expect(HTML).toContain('html[data-topo="gesto"] .pg .troca .palco { order: 2;');
    expect(HTML).toContain('<meta name="robots" content="noindex,follow" />');
  });
});

/* ───────────────────────── 2. a página ───────────────────────── */
describe("a página (copy da SPEC, seção 4)", () => {
  const d = pagina();
  const texto = textoDe(d);

  it("os blocos, na ordem", () => {
    expect([...d.querySelectorAll("[data-bloco]")].map((e) => e.getAttribute("data-bloco"))).toEqual(["topo", "lista", "gesto", "dia", "cartoes", "como", "prova", "oferta", "garantia", "informacoes", "fim"]);
    expect(d.getElementById("preco")!.getAttribute("data-bloco")).toBe("oferta");
  });
  it("topo, lista e gesto", () => {
    expect(semNbsp(d.querySelector("h1")!.textContent!)).toBe("Sua vida organizada, em um só app.");
    expect(d.querySelector("h1 em")!.textContent).toBe("em um só app.");
    for (const t of ["🔥 ACESSO VITALÍCIO · paga uma vez", "Dinheiro, hábitos, treino e contas no mesmo lugar. Anota em segundos, sem planilha.", "07:30 · seu dia numa lista só", "Tela real do app, com dados de exemplo.",
      "Você anota.O app responde.", "08:10 · dinheiro", "Anotou o gasto. Já sabe quanto sobra hoje.", "146 − 87 = 59 pra hoje", "Simples assim.", "R$ 27,90, uma vez · 7 dias de garantia"]) expect(texto).toContain(t);
    expect([...d.querySelectorAll(".fatos b")].map((b) => b.textContent)).toEqual(["16 áreas", "Paga 1 vez só", "iPhone e Android"]);
    expect([...d.querySelectorAll(".gesto .rot")].map((p) => semNbsp(p.textContent!))).toEqual(["1Você anota", "2O app responde"]);
    expect(semNbsp(d.querySelector(".so-b")!.textContent!)).toBe("E o dia inteiro fica assim."); // só aparece no topo "gesto"
    // o preço aparece cedo: colado no 1º botão, bem antes do cartão do preço
    expect(semNbsp(d.querySelector(".gesto .miudo")!.textContent!)).toBe("R$ 27,90, uma vez · 7 dias de garantia");
    expect(texto.indexOf("27,90")).toBeLessThan(texto.indexOf("Mais tarde, no mesmo app."));
    // o recorte do gesto é só a faixa da conta (sem o "R$ 135 por dia" do card), e a moldura do celular é lisa
    const gesto = d.querySelector("img[src='/dia/gesto-app.webp']")!;
    expect(gesto.getAttribute("alt")).toBe("Trecho real do card Quanto posso gastar hoje, do app: Sobram R$ 59 pra hoje, já saiu R$ 87 dos R$ 146 do dia");
    expect([gesto.getAttribute("width"), gesto.getAttribute("height")]).toEqual(["720", "121"]);
    expect(HTML).not.toContain(".fone::before");
  });
  it("o resto do dia e os 7 cartões", () => {
    for (const t of ["Mais tarde, no mesmo app.", "12:30 · hábitos", "Marca o hábito. A sequência fica guardada.", "21:00 · contas", "Cadastra a conta uma vez. O app mostra antes de vencer.", "O aviso fica no app, dias antes.",
      "E o resto da vida também.", "arraste pro lado", "Telas reais do app, com dados de exemplo."]) expect(texto).toContain(t);
    expect(texto).not.toMatch(/nada 🙂|Não faz nada/);
    expect([...d.querySelectorAll(".cartao h3")].map((h) => h.textContent)).toEqual(["💪 Treino com séries e carga", "🎯 Um limite pra cada gasto", "💧 Água do dia", "📊 Pra onde foi o dinheiro", "🍽️ Cardápio da semana", "🏠 Casa por cômodo", "✨ 16 áreas. Use só as que quiser."]);
    expect([...d.querySelectorAll(".cartao p")].map((p) => p.textContent)).toEqual(["Você marca a série. O app lembra a carga da semana passada.", "Você define o teto. A barra mostra quanto já foi.", "Um toque a cada copo. O app mostra quanto falta.", "Seus gastos separados por categoria.", "Monta uma vez e consulta todo dia.", "Afazeres e lista de mercado, cada um no seu lugar.", "Comece por uma. Esconda o resto."]);
    expect(HTML).toContain("overscroll-behavior-x: contain");
    // cada recorte com a sua altura: nenhum corte forçado por CSS
    expect(HTML).not.toMatch(/img\.alto|class="alto"|object-fit/);
  });
  it("como funciona: é um app, antes do preço, com os selos das duas lojas sem link", () => {
    for (const t of ["É um app. Você baixa e usa.", "Como funciona", "Garanta seu acesso", "Você paga uma vez, aqui no site. Pix ou cartão.", "Baixe o app", "Na App Store ou no Google Play. Também abre no computador.",
      "Entre com o e-mail da compra", "Toque em Entrar. Já está tudo liberado.", "Você paga só aqui. No app, é só entrar. Não compre de novo.", "Sem mensalidade", "Não renova sozinho", "Você baixa depois de garantir o acesso."]) expect(texto).toContain(t);
    expect(texto.indexOf("É um app. Você baixa e usa.")).toBeLessThan(texto.indexOf("Menos que um lanche."));
    expect([...d.querySelectorAll(".selos img")].map((i) => i.getAttribute("src"))).toEqual(["/selos/app-store.svg", "/selos/google-play.png"]);
    expect(d.querySelector(".selos a")).toBeNull();
    expect([...d.querySelectorAll(".selos img")].map((i) => i.getAttribute("data-selo"))).toEqual(["ios", "android"]); // o toque é medido (dia_selo_toque)
    // o link "Ver o preço" do fim do bloco: só rola até o preço, nunca abre pagamento
    const ver = d.querySelector("[data-bloco='como'] a[data-cta='como']")!;
    expect(semNbsp(ver.textContent!)).toBe("Ver o preço");
    expect(ver.getAttribute("href")).toBe("#preco");
    expect(ver.hasAttribute("data-checkout")).toBe(false);
    expect(ver.classList.contains("cta")).toBe(false);
    // antes da compra ninguém é mandado pra loja: nenhum link pra fora
    expect([...d.querySelectorAll("#pagina a")].map((a) => a.getAttribute("href"))).toEqual(["#preco", "#preco", "mailto:contato@coreaplicativo.com.br", "/termos", "/privacidade", "/organizar", "/como-entrar"]);
    expect(d.querySelectorAll(".lojas").length).toBe(2); // topo e fecho
  });
  it("prova: nota e opiniões com loja e data, fora da 1ª tela", () => {
    for (const t of ["Quem usa, avalia assim.", "4,7★App Store99 avaliações", "4,9★Google Play221 avaliações", "“Simplesmente perfeito! Muito prático, completo e o melhor organizador que já tive.”", "★★★★★ App Store · 04/11/2026",
      "“…tem tudo que eu preciso em um só lugar desde vida pessoal e profissional…”", "★★★★★ Google Play · 05/11/2026", "“…bem produtivo para usar todos os dias…”", "★★★★★ App Store · 06/11/2026", "Notas e opiniões públicas das lojas, lidas em 23/11/2026."]) expect(texto).toContain(t);
    expect(d.querySelector("[data-bloco='topo']")!.textContent).not.toMatch(/4,7|4,9|avalia/);
    expect(d.querySelector("[data-bloco='lista']")!.textContent).not.toMatch(/4,7|4,9|avalia/);
  });
  it("preço, garantia, informações, fecho e rodapé", () => {
    const preco = semNbsp(d.getElementById("preco")!.textContent!);
    for (const t of ["Acesso vitalício paga uma vez", "Menos que um lanche.", "R$27,90", "Uma vez. É seu pra sempre.", "Não renova. Nada é cobrado depois.", "App só de finanças, por assinaturacerca de R$ 250por ano", "CORE, as 16 áreasR$ 27,90, uma vez",
      "Preços públicos de apps de finanças no Brasil, consultados em 23/11/2026.", "As 16 áreas liberadas", "App no iPhone, no Android e no computador", "7 dias de garantia: não gostou, devolvemos", "Quero meu acesso por R$ 27,90", "Pagamento aqui no site · Pix ou cartão", "CORE · CNPJ 55.041.112/0001-82"]) expect(preco).toContain(t);
    expect(preco).not.toMatch(/só hoje/i);
    expect(texto).not.toMatch(/experiment/i); // garantia não é teste grátis: nada de "experimente" perto de botão que cobra
    for (const t of ["7 dias de garantia.", "Até 7 dias depois da compra, é só mandar um e-mail pra contato@coreaplicativo.com.br. Devolvemos 100% do valor, sem perguntas.",
      "Informações", "Onde funcionaiPhone, Android e computador", "PagamentoUma vez · Pix ou cartão, aqui no site", "Renova sozinho?Não", "Garantia7 dias, 100% do valor de volta", "VendedorCORE · CNPJ 55.041.112/0001-82",
      "Amanhã cedo, seu diajá tem um lugar.", "Dinheiro, hábitos, treino, casa. Você escolhe por onde começar.", "Paga uma vez · Pix ou cartão7 dias de garantia", "contato@coreaplicativo.com.br · Termos · Privacidade"]) expect(texto).toContain(t);
  });
  it("exatamente 3 botões: o 1º só desce pro preço; os outros dois abrem o checkout; nenhum fixo", () => {
    const botoes = [...d.querySelectorAll(".cta")];
    expect(botoes.map((b) => semNbsp(b.textContent!))).toEqual(["Quero meu dia organizado", "Quero meu acesso por R$ 27,90", "Quero meu acesso por R$ 27,90"]);
    expect(botoes[0].tagName).toBe("A");
    expect(botoes[0].getAttribute("href")).toBe("#preco");
    expect(botoes[0].hasAttribute("data-checkout")).toBe(false);
    expect(botoes.slice(1).map((b) => b.getAttribute("data-checkout"))).toEqual(["oferta", "fim"]);
    expect(d.querySelectorAll("[data-checkout]").length).toBe(2);
    expect(HTML).not.toMatch(/position:\s*(fixed|sticky)/);
    expect(HTML).not.toMatch(/100vh|<video|<iframe/);
    expect(HTML).not.toMatch(/\bscroll-behavior\s*:/); // a descida animada é do main.ts; no CSS ela animava também a volta do checkout
  });
  it("palavras que a página não usa (fora dos recortes do app) e o tamanho do texto", () => {
    expect(texto).not.toMatch(/\bIA\b|áudio|\bfotos?\b|WhatsApp|automátic|grátis|por mês|por dia|12x|\b1x\b|5 segundos|parcela|R\$ ?97,90|R\$ ?99,90/i);
    const alts = [...d.querySelectorAll("img")].map((i) => i.getAttribute("alt") ?? "").join(" ");
    expect(alts).not.toMatch(/\bIA\b|áudio|WhatsApp|automátic|grátis/i);
    expect(texto.split(" ").length).toBeLessThanOrEqual(650);
    expect(d.documentElement.getAttribute("lang")).toBe("pt-BR");
  });
  it("sem JavaScript a página está inteira: o CSS mora no HTML, o módulo é o único script de fora e há a saída do <noscript>", () => {
    expect([...d.querySelectorAll("script[src]")].map((s) => s.getAttribute("src"))).toEqual(["/src/dia/main.ts"]);
    expect(d.querySelector("link[rel='stylesheet']")).toBeNull();
    expect(HTML).toMatch(/<noscript>[\s\S]*href="\/organizar"[\s\S]*href="\/como-entrar"[\s\S]*<\/noscript>/);
    expect(HTML).not.toMatch(/js\.stripe\.com|fbevents|connect\.facebook/); // a Stripe e o pixel só entram pelo módulo
    expect(HTML).toContain('<link rel="preload" as="font" type="font/woff2" href="/fonts/inter-latin.woff2" crossorigin />');
  });
  it("imagens: recortes reais em public/dia, webp, com tamanho declarado; só a do topo sem lazy; leves", () => {
    const imgs = [...d.querySelectorAll("img")];
    const recortes = imgs.filter((i) => i.getAttribute("src")!.startsWith("/dia/"));
    expect(recortes).toHaveLength(14);
    let total = 0;
    for (const i of imgs) {
      const src = i.getAttribute("src")!;
      expect(existsSync(resolve(raiz, "public" + src)), src).toBe(true);
      expect(Number(i.getAttribute("width")), src).toBeGreaterThan(0);
      expect(Number(i.getAttribute("height")), src).toBeGreaterThan(0);
      expect(i.getAttribute("alt"), src).toBeTruthy();
      if (src === "/dia/topo-lista.webp") { expect(i.getAttribute("fetchpriority")).toBe("high"); expect(i.hasAttribute("loading")).toBe(false); }
      else expect(i.getAttribute("loading"), src).toBe("lazy");
      if (src.startsWith("/dia/")) { expect(src).toMatch(/\.webp$/); total += statSync(resolve(raiz, "public" + src)).size; }
    }
    expect(statSync(resolve(raiz, "public/dia/topo-lista.webp")).size).toBeLessThanOrEqual(30 * 1024);
    expect(total).toBeLessThanOrEqual(250 * 1024);
    // o único celular: a lista do topo, na proporção 390:844
    expect(d.querySelectorAll(".fone").length).toBe(1);
    expect(HTML).toContain("aspect-ratio: 390 / 844");
    expect(Math.abs(600 / 1298 - 390 / 844)).toBeLessThan(0.002);
  });
});

/* ───────────────────────── 3. a oferta ───────────────────────── */
describe("a oferta (um objeto só)", () => {
  it("27 → linha lp27, R$ 27,90; 67 → linha oferta, R$ 67,90; a chave desconhecida cai no 27", () => {
    expect(OFERTAS["27"]).toMatchObject({ precoCentavos: 2790, valor: 27.9, pagina: "lp27", storagePrefix: "dia" });
    expect(OFERTAS["67"]).toMatchObject({ precoCentavos: 6790, valor: 67.9, pagina: "oferta", storagePrefix: "dia67" });
    expect(ofertaDe("67")).toBe(OFERTAS["67"]);
    for (const k of [null, undefined, "", "27", "97", "on"]) expect(ofertaDe(k)).toBe(OFERTAS["27"]);
    expect(topoDe("gesto")).toBe("gesto");
    for (const k of [null, "", "lista", "x"]) expect(topoDe(k)).toBe("lista");
  });
  it("o pedido ao checkout: à vista, sem CPF, Pix e cartão, layout novo, pós-compra do app; nada das opções novas da /tudo", () => {
    for (const k of ["27", "67"] as ChaveOferta[]) {
      const o = opcoesDaOferta(OFERTAS[k], false) as Partial<OpcoesCheckout>;
      expect(o).toEqual({ precoCentavos: OFERTAS[k].precoCentavos, parcelasMax: 1, producao: true, pedeCpf: false, somentePix: false, layout: "novo", storagePrefix: OFERTAS[k].storagePrefix, pagina: OFERTAS[k].pagina, trocaCartao: false, medirCarteira: false, posApp: true });
      for (const fora of ["bracoPreco", "montarEm", "pixCopiaPrimeiro", "presente", "indique", "emailInicial"]) expect(o).not.toHaveProperty(fora);
      expect(opcoesDaOferta(OFERTAS[k], true)).toMatchObject({ producao: false, storagePrefix: `${OFERTAS[k].storagePrefix}-qa` });
    }
  });
  it("o HTML traz os textos do 27 e, em data-v67, os do 67: o preço cedo, os do cartão e o botão (no preço e no fecho), e só eles", () => {
    const d = pagina();
    const lugares = [...d.querySelectorAll("[data-oferta-txt]")];
    expect(lugares.map((e) => e.getAttribute("data-oferta-txt"))).toEqual(["cedo", "frase", "numero", "compare", "botao", "botao"]);
    expect(d.querySelectorAll("[data-v67]").length).toBe(6);
    expect(Object.keys(OFERTAS["27"].textos).sort()).toEqual(["botao", "cedo", "compare", "frase", "numero"]);
    for (const e of lugares) {
      const k = e.getAttribute("data-oferta-txt") as keyof (typeof OFERTAS)["27"]["textos"];
      expect(semNbsp(e.textContent!)).toBe(OFERTAS["27"].textos[k]);
      expect(semNbsp(e.getAttribute("data-v67")!)).toBe(OFERTAS["67"].textos[k]);
    }
  });
  it("com a chave em 67, o script do fim troca só esses textos; com 27 não troca nada", () => {
    const troca = HTML.match(/<script>\s*\/\* OFERTA_DIA "67"[\s\S]*?\*\/\s*(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];
    const d27 = pagina(); d27.documentElement.setAttribute("data-oferta", "27");
    const antes = textoDe(d27);
    new Function("document", troca)(d27);
    expect(textoDe(d27)).toBe(antes);
    const d67 = pagina(); d67.documentElement.setAttribute("data-oferta", "67");
    new Function("document", troca)(d67);
    const depois = textoDe(d67);
    expect(depois).not.toContain("27,90");
    expect(depois).not.toContain("Menos que um lanche.");
    for (const t of ["Paga uma vez. Usa pra sempre.", "R$67,90", "CORE, as 16 áreasR$ 67,90, uma vez", "Quero meu acesso por R$ 67,90", "R$ 67,90, uma vez · 7 dias de garantia"]) expect(depois).toContain(t);
    expect(depois.match(/Quero meu acesso por R\$ 67,90/g)).toHaveLength(2);
    // tirando os 5 trechos, o resto da página é igual
    const neutro = (s: string) => s.replace("Menos que um lanche.", "§").replace("Paga uma vez. Usa pra sempre.", "§").replace(/[26]7,90/g, "§§");
    expect(neutro(depois)).toBe(neutro(antes));
    expect(depois).not.toMatch(/por mês|por dia|12x|\b1x\b|parcela/i);
  });
});

/* ───────────────────────── 4. o checkout ───────────────────────── */
describe("o checkout da /dia (o caminho padrão do stripe-checkout)", () => {
  const criar = vi.fn(); const status = vi.fn(); const confirmPixPayment = vi.fn(); const createPaymentMethod = vi.fn(); const confirmPayment = vi.fn();
  const pixel = vi.fn(); const evento = vi.fn();
  const QR = "00020101021226870014br.gov.bcb.pix-QA-NAO-PAGAVEL";
  const flush = async () => { await new Promise((r) => setTimeout(r, 20)); };
  const digitar = (sel: string, v: string) => { const i = document.querySelector(sel) as HTMLInputElement; i.value = v; i.dispatchEvent(new Event("input")); };
  const opcoes = (k: ChaveOferta): OpcoesCheckout => ({ pk: "pk_test_QA", ...opcoesDaOferta(OFERTAS[k], true), evento, pixel, atrib: { utm_campaign: "qa" }, sessao: "s-dia", aparelho: "d-dia", urlChegada: "https://www.coreaplicativo.com.br/dia?utm_campaign=qa", fbclid: null });

  beforeEach(() => {
    vi.stubGlobal("scrollTo", vi.fn());
    Element.prototype.scrollIntoView = vi.fn();
    document.body.innerHTML = '<div class="pg" id="pagina"><p>venda</p></div>';
    sessionStorage.clear(); vi.clearAllMocks();
    criar.mockResolvedValue({ ok: true, pi: "pi_dia", clientSecret: "pi_dia_secret_QA" });
    status.mockResolvedValue({ ok: true, pago: false, status: "requires_action" });
    confirmPixPayment.mockResolvedValue({ paymentIntent: { id: "pi_dia", status: "requires_action", next_action: { type: "pix_display_qr_code", pix_display_qr_code: { data: QR } } } });
    createPaymentMethod.mockResolvedValue({ paymentMethod: { id: "pm_qa", card: { brand: "visa", last4: "4242" } } });
    confirmPayment.mockResolvedValue({ paymentIntent: { id: "pi_dia", status: "succeeded" } });
    const elements = () => ({ create: () => ({ mount: () => {}, on: (ev: string, fn: () => void) => { if (ev === "ready") queueMicrotask(fn); }, destroy: () => {} }), submit: async () => ({}) });
    (window as any).__ofertaApi = { criar, status };
    (window as any).__stripeFalso = { elements, confirmPixPayment, createPaymentMethod, confirmPayment };
  });
  afterEach(() => { _zerar(); _zerarPosCompra(); delete (window as any).__ofertaApi; delete (window as any).__stripeFalso; vi.unstubAllGlobals(); });

  const pagarNoPix = async () => {
    digitar("#oc-email", "qa@example.com");
    (document.getElementById("oc-pagar") as HTMLElement).click();
    await flush();
    expect(document.querySelector("[data-testid='oferta-pix']")).not.toBeNull();
    expect(pixel.mock.calls.some((c) => c[0] === "Purchase")).toBe(false); // gerar o Pix não é compra
    status.mockResolvedValue({ ok: true, pago: true, status: "succeeded", metodo: "pix" });
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();
  };

  it("abre por cima da página (camada), no desenho novo; sem CPF, sem parcela, Pix e cartão; e-mail só dentro do checkout", async () => {
    await abrirCheckout(opcoes("27"));
    await flush();
    const oc = document.getElementById("oc")!;
    expect(oc.parentElement).toBe(document.body);
    expect(oc.className).toBe("oc oc-novo");
    expect(oc.getAttribute("role")).toBe("dialog");
    expect(document.getElementById("oc-estilo-inline")).toBeNull(); // nada do inline da /tudo
    expect(document.querySelector(".ck-produto")).toBeNull(); // nem do layout "cakto"
    expect(document.getElementById("oc-nome")).toBeNull();
    expect(document.getElementById("oc-cpf")).toBeNull();
    expect(document.getElementById("oc-email")).not.toBeNull();
    expect([...document.querySelectorAll("[data-metodo]")].map((b) => b.getAttribute("data-metodo"))).toEqual(["pix", "card"]);
    expect(oc.textContent).toContain("27,90");
    expect(oc.textContent).not.toMatch(/parcela|12x|\b1x\b|CPF/i);
    expect(document.getElementById("oc-pagar")!.textContent).toMatch(/^Gerar Pix de R\$\s27,90$/);
    expect(pixel.mock.calls.filter((c) => c[0] === "InitiateCheckout")).toHaveLength(1);
  });
  it("27: o pedido sai na linha lp27, sem braço de preço, sem valor do cliente, com a url de chegada da /dia e a aba separada das outras páginas", async () => {
    sessionStorage.setItem("oferta-stripe-ref", "pedido-da-oferta");
    sessionStorage.setItem("tudo-qa-stripe-ref", "pedido-da-tudo");
    await abrirCheckout(opcoes("27"));
    await flush();
    await pagarNoPix();
    for (const [corpo] of criar.mock.calls) {
      expect(corpo.pagina).toBe("lp27");
      expect(corpo).not.toHaveProperty("braco_preco");
      expect(corpo).not.toHaveProperty("amount");
      expect(corpo).not.toHaveProperty("salvar_cartao");
      expect(corpo.url).toBe("https://www.coreaplicativo.com.br/dia?utm_campaign=qa");
      expect(corpo.ref).not.toBe("pedido-da-oferta");
      expect(corpo.ref).not.toBe("pedido-da-tudo");
    }
    expect(sessionStorage.getItem("oferta-stripe-ref")).toBe("pedido-da-oferta");
    expect(sessionStorage.getItem("tudo-qa-stripe-ref")).toBe("pedido-da-tudo");
  });
  it("27: pagou → Purchase 1× (27,90, eventID = PI); nada se repete na consulta seguinte nem ao fechar e reabrir", async () => {
    await abrirCheckout(opcoes("27"));
    await flush();
    await pagarNoPix();
    const compras = pixel.mock.calls.filter((c) => c[0] === "Purchase");
    expect(compras).toHaveLength(1);
    expect(compras[0][1]).toMatchObject({ value: 27.9, currency: "BRL" });
    expect(compras[0][2]).toBe("pi_dia");
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();
    (document.getElementById("oc-x") as HTMLElement | null)?.click();
    await flush();
    await abrirCheckout(opcoes("27"));
    await flush();
    expect(pixel.mock.calls.filter((c) => c[0] === "Purchase")).toHaveLength(1);
    expect(evento.mock.calls.filter((c) => c[0] === "landing_stripe_pago")).toHaveLength(1);
  });
  it("67: o pedido sai na linha oferta, SEM braço de preço; pagou → Purchase 1× de 67,90", async () => {
    await abrirCheckout(opcoes("67"));
    await flush();
    expect(document.getElementById("oc")!.textContent).toContain("67,90");
    expect(document.getElementById("oc")!.textContent).not.toMatch(/27,90|parcela|12x/i);
    await pagarNoPix();
    for (const [corpo] of criar.mock.calls) { expect(corpo.pagina).toBe("oferta"); expect(corpo).not.toHaveProperty("braco_preco"); expect(corpo).not.toHaveProperty("amount"); }
    const compras = pixel.mock.calls.filter((c) => c[0] === "Purchase");
    expect(compras).toHaveLength(1);
    expect(compras[0][1]).toMatchObject({ value: 67.9, currency: "BRL" });
    expect(sessionStorage.getItem("oferta-stripe-ref")).toBeNull(); // não mexe na aba da /oferta
  });
  it("pago: o pós-compra direto pro app, com as duas lojas com link e o aviso de não comprar de novo; sem presente, sem indique", async () => {
    await abrirCheckout(opcoes("27"));
    await flush();
    await pagarNoPix();
    const pos = document.querySelector("[data-testid='pos-compra']")!;
    expect(pos).not.toBeNull();
    expect(pos.textContent).toContain("Pronto! Seu CORE está liberado");
    expect(pos.querySelector("[data-testid='pos-nao-compre']")!.textContent).toContain("Você já pagou. Não compre de novo no app.");
    (pos.querySelector("[data-testid='pos-aba-ios']") as HTMLElement).click();
    const lojas = () => [...pos.querySelectorAll<HTMLAnchorElement>("#pc-conteudo a[data-loja]")].map((a) => a.href);
    expect(lojas().some((h) => h.includes("apps.apple.com"))).toBe(true);
    expect(lojas().some((h) => h.includes("play.google.com"))).toBe(true);
    (pos.querySelector("[data-testid='pos-aba-android']") as HTMLElement).click();
    expect(lojas().some((h) => h.includes("apps.apple.com"))).toBe(true);
    expect(lojas().some((h) => h.includes("play.google.com"))).toBe(true);
    expect(document.body.textContent).not.toMatch(/presente|indique|24,90/i);
    expect(evento.mock.calls.some((c) => c[0] === "pos_compra_view")).toBe(true);
  });
  it("cartão: à vista (sem pedir parcela), Purchase 1×", async () => {
    await abrirCheckout(opcoes("27"));
    await flush();
    (document.querySelector("[data-metodo='card']") as HTMLElement).click();
    await flush();
    expect(document.getElementById("oc")!.textContent).not.toMatch(/parcela|12x|\b1x\b/i);
    digitar("#oc-email", "qa@example.com");
    (document.getElementById("oc-pagar") as HTMLElement).click();
    await flush();
    expect(confirmPayment).toHaveBeenCalledOnce();
    expect(JSON.stringify(confirmPayment.mock.calls)).not.toMatch(/installments/);
    expect(pixel.mock.calls.filter((c) => c[0] === "Purchase")).toHaveLength(1);
    expect(document.querySelector("[data-testid='pos-compra']")).not.toBeNull();
  });
  it("voltou do banco: o endereço não prova pagamento; só o servidor confirma", async () => {
    status.mockResolvedValue({ ok: false, pago: false });
    await abrirCheckout({ ...opcoes("27"), voltaDoBanco: { pi: "pi_dia", status: "succeeded" } });
    await flush();
    expect(status).toHaveBeenCalledWith(expect.objectContaining({ pi: "pi_dia" }));
    expect(pixel.mock.calls.some((c) => c[0] === "Purchase")).toBe(false);
    expect(document.querySelector("[data-testid='pos-compra']")).toBeNull();
  });
  it("nenhum evento leva o e-mail", async () => {
    await abrirCheckout(opcoes("27"));
    await flush();
    await pagarNoPix();
    expect(JSON.stringify(evento.mock.calls)).not.toContain("qa@example.com");
    expect(JSON.stringify(pixel.mock.calls)).not.toContain("qa@example.com");
  });
});

/* ───────────────────────── 5. eventos ───────────────────────── */
describe("eventos da /dia", () => {
  it("todo evento leva funil dia, jornada, path, oferta, topo e preço; em prévia nada vai pro banco", async () => {
    document.documentElement.setAttribute("data-oferta", "67");
    document.documentElement.setAttribute("data-topo", "gesto");
    vi.resetModules();
    trackEventBeacon.mockClear();
    const m = await import("@/dia/payment");
    expect(m.QA).toBe(true); // jsdom não é o domínio
    expect(m.OFERTA.chave).toBe("67");
    m.event("landing_cta", { onde: "gesto" });
    const ev = (window as any).__diaEvents.at(-1);
    expect(ev).toMatchObject({ name: "landing_cta", onde: "gesto", funil: "dia", jornada: "dia_v1", path: "/dia", oferta: "67", topo: "gesto", preco_centavos: 6790 });
    expect(typeof ev.landing_session_id).toBe("string");
    expect(typeof ev.landing_device_id).toBe("string");
    expect(JSON.stringify(ev)).not.toMatch(/@/);
    expect(trackEventBeacon).not.toHaveBeenCalled();
    m.initPixel();
    expect((window as any).fbq).toBeUndefined(); // prévia: sem pixel
    document.documentElement.removeAttribute("data-oferta"); document.documentElement.removeAttribute("data-topo");
  });
  it("o pixel é o das outras páginas (dois pixels, PageView, ViewContent 'CORE vitalício (dia)', Purchase pelo checkout) e só em produção", () => {
    const fonte = ler("src/dia/payment.ts");
    for (const t of ["f('init','998037194527241')", "f('init','1104688251942954')", "f('track','PageView')", "content_name:'CORE vitalício (dia)',value:OFERTA.valor,currency:'BRL'", "if(QA)return;", "if(!QA)trackEventBeacon(name,payload)",
      "if(!QA && (name==='Purchase'||name==='InitiateCheckout'||name==='ViewContent'||name==='CompleteRegistration'))fireMetaEvent(name,data,id)", "funil:'dia'", "jornada:'dia_v1'", "path:'/dia'", "...opcoesDaOferta(OFERTA,QA)", "urlChegada:source.url"]) expect(fonte).toContain(t);
    const main = ler("src/dia/main.ts");
    for (const t of ["event('landing_view')", "event('landing_cta',{onde:a.dataset.cta})", "event('landing_checkout_click',{onde:b.dataset.checkout})", "event('landing_section_view',{secao:", "event('landing_oferta_vista')", "event('dia_cartoes_arraste',{ate})", "event('landing_erro',", "event('dia_selo_toque',{loja:s.dataset.selo})"]) expect(main).toContain(t);
    expect(main).not.toMatch(/stripe-checkout|js\.stripe/); // a Stripe só entra pelo import() do toque (payment.ts)
    expect(fonte).toContain("await import('@/landing/stripe-checkout')");
  });
});

/* ───────────────────────── 5b. o main.ts rodando (carga adiada, descida, medição parada) ───────────────────────── */
describe("o main.ts na página: carga adiada, descida pro preço e medição só do que foi visto", () => {
  type Entrada = { target: Element; isIntersecting: boolean; intersectionRatio: number };
  class ObservadorFalso {
    static todos: ObservadorFalso[] = [];
    alvos: Element[] = [];
    constructor(public cb: (e: Entrada[]) => void, public opcoes?: IntersectionObserverInit) { ObservadorFalso.todos.push(this); }
    observe(e: Element) { this.alvos.push(e); }
    unobserve(e: Element) { this.alvos = this.alvos.filter((x) => x !== e); }
    disconnect() { this.alvos = []; }
  }
  const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const nomes = () => ((window as any).__diaEvents ?? []).map((e: any) => e.name + (e.secao ? ":" + e.secao : "") + (e.onde ? ":" + e.onde : "") + (e.loja ? ":" + e.loja : ""));
  const bloco = (n: string) => document.querySelector(`[data-bloco='${n}']`)!;
  const rolar = vi.fn();
  let topo: HTMLImageElement;
  const observadorDoSetup = (globalThis as any).IntersectionObserver;

  beforeEach(async () => {
    const d = pagina();
    d.querySelectorAll("body script, noscript").forEach((n) => n.remove());
    document.body.innerHTML = d.body.innerHTML;
    document.documentElement.removeAttribute("data-desligada");
    sessionStorage.clear();
    (window as any).__diaEvents = [];
    ObservadorFalso.todos = [];
    (window as any).IntersectionObserver = ObservadorFalso; (globalThis as any).IntersectionObserver = ObservadorFalso; // o setup define como gravável
    rolar.mockClear();
    Element.prototype.scrollIntoView = rolar;
    topo = document.querySelector(".fone img") as HTMLImageElement;
    Object.defineProperty(topo, "complete", { value: false, configurable: true }); // a imagem do topo ainda está chegando
    vi.resetModules();
  });
  afterEach(() => { (window as any).IntersectionObserver = observadorDoSetup; (globalThis as any).IntersectionObserver = observadorDoSetup; document.body.innerHTML = ""; });
  const carregar = async () => { await import("@/dia/main"); };
  const chegou = async () => { topo.dispatchEvent(new Event("load")); await vi.waitFor(() => expect(nomes()).toContain("landing_view")); };

  it("o pedaço pesado (pixel, medição, checkout) só é pedido depois da imagem do topo; os eventos esperam e saem na ordem", async () => {
    const fonte = ler("src/dia/main.ts");
    expect(fonte).not.toMatch(/^import\s*\{[^}]*\}\s*from\s*['"]\.\/(payment|dia-carga)['"]/m); // nada de import estático: é ele que punha os modulepreload no <head>
    expect(fonte).toContain("const carga:Promise<Carga>=imagemDoTopo.then(()=>import('./dia-carga'));");
    await carregar();
    (document.querySelector("[data-cta='gesto']") as HTMLElement).click(); // tocou antes de a imagem chegar
    await espera(60);
    expect(nomes()).toEqual([]); // nada saiu ainda (nem foi perdido)
    await chegou();
    expect(nomes()).toEqual(["landing_view", "landing_cta:gesto"]);
    const ev = (window as any).__diaEvents[0];
    expect(ev).toMatchObject({ funil: "dia", jornada: "dia_v1", path: "/dia", oferta: "27", topo: "lista" });
  });
  it("imagem que nunca chega: o teto de 1,5 s libera a carga (a medição não fica presa)", async () => {
    const m = await import("@/dia/main");
    expect(m.TETO_IMAGEM_MS).toBe(1500);
    await espera(m.TETO_IMAGEM_MS + 150);
    await vi.waitFor(() => expect(nomes()).toContain("landing_view"));
  });
  it("página desligada: nada é pedido nem medido", async () => {
    document.documentElement.setAttribute("data-desligada", "");
    await carregar();
    topo.dispatchEvent(new Event("load"));
    await espera(80);
    expect(nomes()).toEqual([]);
    expect(ObservadorFalso.todos).toHaveLength(0);
    document.documentElement.removeAttribute("data-desligada");
  });
  it("1º botão e 'Ver o preço': medem, descem até o #preco com animação por JS e nunca abrem pagamento", async () => {
    await carregar(); await chegou();
    for (const onde of ["gesto", "como"]) {
      const a = document.querySelector(`[data-cta='${onde}']`) as HTMLElement;
      const clique = new MouseEvent("click", { bubbles: true, cancelable: true });
      a.dispatchEvent(clique);
      expect(clique.defaultPrevented).toBe(true);
    }
    expect(rolar).toHaveBeenCalledTimes(2);
    expect(rolar.mock.instances.every((el) => el === document.getElementById("preco"))).toBe(true);
    expect(rolar).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    await vi.waitFor(() => expect(nomes().filter((n: string) => n.startsWith("landing_cta"))).toEqual(["landing_cta:gesto", "landing_cta:como"]));
    expect(document.getElementById("oc")).toBeNull();
    expect(nomes().some((n: string) => n.startsWith("landing_checkout_click"))).toBe(false);
  });
  it("a descida do 1º botão atravessa dia, cartões, como e prova sem contar nenhum; só o bloco onde a pessoa PAROU conta, 1 vez", async () => {
    const m = await import("@/dia/main"); await chegou();
    expect(m.PARADA_MS).toBeGreaterThanOrEqual(500);
    const [visto, metade] = ObservadorFalso.todos;
    expect(visto.alvos).toHaveLength(11);
    const entra = (n: string) => visto.cb([{ target: bloco(n), isIntersecting: true, intersectionRatio: 0.2 }]);
    const sai = (n: string) => visto.cb([{ target: bloco(n), isIntersecting: false, intersectionRatio: 0 }]);
    // a rolagem animada: cada bloco fica ~120 ms na tela
    for (const n of ["dia", "cartoes", "como", "prova"]) { entra(n); await espera(120); sai(n); }
    entra("oferta"); // parou no preço
    metade.cb([{ target: document.getElementById("preco")!, isIntersecting: true, intersectionRatio: 0.6 }]);
    await espera(m.PARADA_MS + 150);
    await vi.waitFor(() => expect(nomes()).toContain("landing_oferta_vista"));
    expect(nomes().filter((n: string) => n.startsWith("landing_section_view"))).toEqual(["landing_section_view:oferta"]);
    expect(visto.alvos).not.toContain(bloco("oferta")); // não conta de novo
    expect(visto.alvos).toContain(bloco("prova")); // o que só passou continua podendo contar depois
    // voltou e parou na prova: agora conta
    entra("prova"); await espera(m.PARADA_MS + 150);
    await vi.waitFor(() => expect(nomes()).toContain("landing_section_view:prova"));
    expect(nomes().filter((n: string) => n === "landing_oferta_vista")).toHaveLength(1);
  });
  it("o preço que só passou pela tela (a volta do checkout, a descida) não vira 'oferta vista'", async () => {
    const m = await import("@/dia/main"); await chegou();
    const metade = ObservadorFalso.todos[1];
    const preco = document.getElementById("preco")!;
    metade.cb([{ target: preco, isIntersecting: true, intersectionRatio: 0.7 }]);
    await espera(150);
    metade.cb([{ target: preco, isIntersecting: false, intersectionRatio: 0.1 }]);
    await espera(m.PARADA_MS + 150);
    expect(nomes()).not.toContain("landing_oferta_vista");
  });
  it("o toque nos selos das lojas é medido (dia_selo_toque) e não leva a lugar nenhum", async () => {
    await carregar(); await chegou();
    (document.querySelector("[data-selo='ios']") as HTMLElement).click();
    (document.querySelector("[data-selo='android']") as HTMLElement).click();
    await vi.waitFor(() => expect(nomes().filter((n: string) => n.startsWith("dia_selo_toque"))).toEqual(["dia_selo_toque:ios", "dia_selo_toque:android"]));
    expect(document.querySelector("[data-selo]")!.closest("a")).toBeNull();
  });
});

/* ───────────────────────── 6. rotas, build, lojas; o resto não mudou ───────────────────────── */
describe("rotas, build e o que NÃO mudou", () => {
  const vercel = JSON.parse(ler("vercel.json"));
  const vite = ler("vite.config.ts");
  const loja = ler("scripts/preparar-loja.mjs");
  it("as rotas /dia e /dia/ existem na Vercel e no Vite, com o Permissions-Policy de pagamento", () => {
    expect(vercel.rewrites).toEqual(expect.arrayContaining([{ source: "/dia", destination: "/dia.html" }, { source: "/dia/", destination: "/dia.html" }]));
    const cab = (vercel.headers as Array<{ source: string; headers: Array<{ key: string; value: string }> }>).find((h) => h.source === "/(dia|dia/)")!;
    expect(cab.headers.find((h) => h.key === "Permissions-Policy")!.value).toBe('camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")');
    const escolha = vercel.headers.find((h: { source: string }) => h.source === "/(escolha|escolha/)");
    expect(cab.headers).toEqual(escolha.headers); // o mesmo bloco que já existe no ar
    expect(vite).toContain('dia: path.resolve(__dirname, "dia.html")');
    expect(vite).toContain('req.url = req.url!.replace(/^\\/dia\\/?/, "/dia.html")');
  });
  it("a /dia não vai no binário das lojas", () => {
    expect(loja).toMatch(/"tudo\.html", "tudo",\n[^\n]*\n\s*"dia\.html", "dia"\];/);
    expect(loja).toMatch(/const SO_SITE = \[[^\]]*"dia\.html"\];/);
    // os pedaços de entrada (com a chave pública da Stripe e os ids de pixel) saem junto: dia-*.js, dia-carga-*.js e tudo-*.js|css
    const regra = new RegExp(loja.match(/if \(!\/(\^\(landing\|[^/]+)\/\.test\(f\)\) continue;/)![1]);
    for (const f of ["dia-Ut9k4Csb.js", "dia-carga-B1x_9-aa.js", "tudo-DwMVz28F.js", "tudo-S-nhKimt.css", "praSempre67-abc.js", "landing-abc.css"]) expect(regra.test(f), f).toBe(true);
    for (const f of ["dialog-abc.js", "diario-abc.js", "index-abc.js", "tudoMais.js", "client-C7ccVzNR.js", "payment-abc.js"]) expect(regra.test(f), f).toBe(false);
    expect(ler("src/dia/dia-carga.ts")).toContain("export * from './payment';");
    expect(ler("src/dia/main.ts")).toContain("import('./dia-carga')");
  });
  it("as outras rotas e entradas continuam lá, iguais", () => {
    expect(vercel.rewrites).toEqual(expect.arrayContaining([
      { source: "/tudo", destination: "/tudo.html" }, { source: "/tudo/", destination: "/tudo.html" },
      { source: "/pra-sempre", destination: "/pra-sempre.html" }, { source: "/pra-sempre-67", destination: "/pra-sempre-67.html" },
      { source: "/completo", destination: "/completo.html" },
    ]));
    expect(vercel.headers[0]).toMatchObject({ source: "/(.*)" });
    expect(vercel.headers[0].headers.find((h: { key: string }) => h.key === "Permissions-Policy").value).toBe("camera=(), microphone=(), geolocation=(), payment=()");
    for (const t of ['tudo: path.resolve(__dirname, "tudo.html")', 'praSempre: path.resolve(__dirname, "pra-sempre.html")', 'completo: path.resolve(__dirname, "completo.html")', 'landing: path.resolve(__dirname, "landing.html")']) expect(vite).toContain(t);
    for (const t of ['"completo.html", "completo", "pra-sempre.html", "pra-sempre-67.html", "pra-sempre",', '"tudo.html", "tudo",']) expect(loja).toContain(t);
  });
  it("o checkout compartilhado e as outras páginas não sabem da /dia (nenhuma opção nova, nenhum comportamento novo)", () => {
    const ck = ler("src/landing/stripe-checkout.ts");
    expect(ck).toContain('pagina?: "oferta" | "lp27" | "organizar";');
    expect(ck).toContain('layout?: "novo" | "cakto";');
    for (const arq of ["src/landing/stripe-checkout.ts", "src/landing/pos-compra-app.ts", "src/tudo/main.ts", "src/tudo/payment.ts", "src/pra-sempre/main.ts", "src/pra-sempre/payment.ts", "src/completo/payment.ts", "tudo.html", "pra-sempre.html", "pra-sempre-67.html", "completo.html", "landing.html"]) {
      const f = ler(arq);
      expect(f, arq).not.toMatch(/\/dia\b|src\/dia|PAGINA_DIA|OFERTA_DIA|TOPO_DIA|funil:\s*['"]dia['"]/);
    }
    expect(ler("tudo.html")).toMatch(/var PAGINA_TUDO = "on";/);
    expect(ler("src/tudo/payment.ts")).toContain("funil:'tudo',pagina:'tudo',jornada:'tudo_v1',path:'/tudo'");
    expect(ler("src/pra-sempre/payment.ts")).toContain("funil:'lp27',jornada:'lp27_v1',path:'/pra-sempre'");
  });
});
