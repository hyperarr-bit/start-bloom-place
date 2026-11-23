/**
 * /tudo (23/11) — a página de venda É o checkout.
 *   1. o padrão do stripe-checkout (sem montarEm, sem layout "cakto") continua IGUAL: camada por cima, scroll travado, histórico,
 *      InitiateCheckout ao abrir, billing_details só com o e-mail (é o que a /oferta e o /organizar usam);
 *   2. montarEm: o formulário dentro da página — sem dialog, sem travar a rolagem, sem histórico, sem puxar o foco, Esc não fecha;
 *      InitiateCheckout só no 1º toque/foco (1×); o Pix gerado aparece ali mesmo; pago → Purchase 1× com eventID = PI + pós-compra ali;
 *   3. layout "cakto": a estrutura da Cakto (Nome completo, Email, PIX | Cartão de Crédito, Resumo do pedido, Pagar com …); o nome é
 *      obrigatório e vai SÓ pra Stripe (nunca pro stripe-lp27-criar nem pra evento);
 *   4. o <head> da tudo.html: PAGINA_TUDO "off" → /organizar com a mesma query; ?tudo=on mostra; as rotas existem.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { abrirCheckout, _zerar, estaAberto, type OpcoesCheckout } from "@/landing/stripe-checkout";
import { _zerarPosCompra } from "@/landing/pos-compra-app";

const criar = vi.fn(); const status = vi.fn(); const confirmPixPayment = vi.fn(); const createPaymentMethod = vi.fn(); const confirmPayment = vi.fn();
const pixel = vi.fn(); const evento = vi.fn();
const base: OpcoesCheckout = { pk: "pk_test_QA", precoCentavos: 2790, parcelasMax: 1, producao: false, pagina: "lp27", storagePrefix: "tudo-qa", trocaCartao: false, medirCarteira: false, evento, pixel, atrib: { utm_campaign: "qa" }, sessao: "s-tudo", aparelho: "d-tudo", urlChegada: "https://www.coreaplicativo.com.br/tudo?utm_campaign=qa", fbclid: null };
const flush = async () => { await new Promise((r) => setTimeout(r, 20)); };
const QR = "00020101021226870014br.gov.bcb.pix-QA-NAO-PAGAVEL";
let host: HTMLElement;
const inline = (extra: Partial<OpcoesCheckout> = {}): OpcoesCheckout => ({ ...base, layout: "cakto", montarEm: host, posApp: true, ...extra });
const digitar = (sel: string, v: string) => { const i = document.querySelector(sel) as HTMLInputElement; i.value = v; i.dispatchEvent(new Event("input")); };

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
  Element.prototype.scrollIntoView = vi.fn();
  document.body.innerHTML = '<main><p id="antes">venda</p><section id="checkout"><div id="checkout-inline"><div class="ck-espera">Carregando…</div></div></section></main>';
  host = document.getElementById("checkout-inline")!;
  sessionStorage.clear(); vi.clearAllMocks();
  criar.mockResolvedValue({ ok: true, pi: "pi_tudo", clientSecret: "pi_tudo_secret_QA" });
  status.mockResolvedValue({ ok: true, pago: false, status: "requires_action" });
  confirmPixPayment.mockResolvedValue({ paymentIntent: { id: "pi_tudo", status: "requires_action", next_action: { type: "pix_display_qr_code", pix_display_qr_code: { data: QR } } } });
  createPaymentMethod.mockResolvedValue({ paymentMethod: { id: "pm_qa", card: { brand: "visa", last4: "4242" } } });
  confirmPayment.mockResolvedValue({ paymentIntent: { id: "pi_tudo", status: "succeeded" } });
  const elements = () => ({ create: () => ({ mount: () => {}, on: (ev: string, fn: () => void) => { if (ev === "ready") queueMicrotask(fn); }, destroy: () => {} }), submit: async () => ({}) });
  (window as any).__ofertaApi = { criar, status };
  (window as any).__stripeFalso = { elements, confirmPixPayment, createPaymentMethod, confirmPayment };
});
afterEach(() => { _zerar(); _zerarPosCompra(); delete (window as any).__ofertaApi; delete (window as any).__stripeFalso; vi.unstubAllGlobals(); });

describe("o padrão (/oferta, /organizar) não muda", () => {
  it("sem montarEm: camada por cima (dialog), scroll travado, uma entrada no histórico, InitiateCheckout ao abrir, sem o CSS do inline", async () => {
    const hist = history.length;
    await abrirCheckout({ ...base });
    await flush();
    const oc = document.getElementById("oc")!;
    expect(oc.parentElement).toBe(document.body);
    expect(oc.className).toBe("oc");
    expect(oc.getAttribute("role")).toBe("dialog");
    expect(oc.getAttribute("aria-modal")).toBe("true");
    expect(document.body.style.position).toBe("fixed");
    expect(document.documentElement.hasAttribute("data-checkout-aberto")).toBe(true);
    expect(history.length).toBe(hist + 1);
    expect(document.getElementById("oc-x")).not.toBeNull();
    expect(document.getElementById("oc-estilo-inline")).toBeNull();
    expect(host.querySelector("#oc")).toBeNull();
    expect(pixel.mock.calls.filter((c) => c[0] === "InitiateCheckout")).toHaveLength(1);
    // o formulário de sempre: sem nome, botões "Pix"/"Cartão", "Gerar Pix de R$ 27,90"
    expect(document.getElementById("oc-nome")).toBeNull();
    expect(document.querySelector(".ck-resumo")).toBeNull();
    expect(document.getElementById("oc-pagar")!.textContent).toMatch(/^Gerar Pix de R\$\s27,90$/);
  });
  it("sem layout cakto: o Pix leva só o e-mail na Stripe (billing_details igual ao de antes)", async () => {
    await abrirCheckout({ ...base });
    await flush();
    digitar("#oc-email", "qa@example.com");
    (document.getElementById("oc-pagar") as HTMLElement).click();
    await flush();
    expect(confirmPixPayment).toHaveBeenCalledWith("pi_tudo_secret_QA", { payment_method: { billing_details: { email: "qa@example.com" } } }, { handleActions: false });
  });
});

describe("montarEm: o checkout dentro da página", () => {
  it("monta no elemento, sem dialog, sem travar a rolagem, sem histórico, sem X, sem puxar o foco", async () => {
    const hist = history.length;
    const focado = document.activeElement;
    await abrirCheckout(inline());
    await flush();
    const oc = host.querySelector("#oc")!;
    expect(oc).not.toBeNull();
    expect(host.querySelector(".ck-espera")).toBeNull(); // o "Carregando…" saiu
    expect(oc.classList.contains("oc-inline")).toBe(true);
    expect(oc.getAttribute("role")).toBe("region");
    expect(oc.hasAttribute("aria-modal")).toBe(false);
    expect(document.body.style.position).toBe("");
    expect(document.body.style.overflow).toBe("");
    expect(document.documentElement.hasAttribute("data-checkout-aberto")).toBe(false);
    expect(history.length).toBe(hist);
    expect(document.getElementById("oc-x")).toBeNull();
    expect(document.getElementById("oc-estilo-inline")).not.toBeNull();
    await new Promise((r) => setTimeout(r, 50));
    expect(document.activeElement).toBe(focado);
    // Esc não fecha (não é camada)
    oc.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(estaAberto()).toBe(true);
    expect(host.querySelector("#oc")).not.toBeNull();
  });
  it("InitiateCheckout só no 1º toque/foco dentro do checkout, 1×", async () => {
    await abrirCheckout(inline());
    await flush();
    expect(pixel.mock.calls.some((c) => c[0] === "InitiateCheckout")).toBe(false);
    host.querySelector("#oc-nome")!.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    host.querySelector("#oc-email")!.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    host.querySelector("[data-metodo='card']")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    const ic = pixel.mock.calls.filter((c) => c[0] === "InitiateCheckout");
    expect(ic).toHaveLength(1);
    expect(ic[0][2]).toMatch(/^ic-/);
    expect(evento.mock.calls.filter((c) => c[0] === "landing_stripe_comecou")).toHaveLength(1);
  });
  it("Pix: o QR aparece no mesmo lugar; pagou → Purchase 1× com eventID = PI e o pós-compra do app ali mesmo", async () => {
    await abrirCheckout(inline());
    await flush();
    digitar("#oc-nome", "Maria Teste");
    digitar("#oc-email", "qa@example.com");
    (host.querySelector("#oc-pagar") as HTMLElement).click();
    await flush();
    expect(host.querySelector("[data-testid='oferta-pix']")).not.toBeNull();
    expect((host.querySelector("#oc-codigo") as HTMLInputElement).value).toBe(QR);
    expect(pixel.mock.calls.some((c) => c[0] === "Purchase")).toBe(false);
    status.mockResolvedValue({ ok: true, pago: true, status: "succeeded", metodo: "pix" });
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();
    const compras = pixel.mock.calls.filter((c) => c[0] === "Purchase");
    expect(compras).toHaveLength(1);
    expect(compras[0][2]).toBe("pi_tudo");
    expect(compras[0][1]).toMatchObject({ value: 27.9, currency: "BRL" });
    expect(host.querySelector("[data-testid='pos-compra']")).not.toBeNull();
    expect(document.body.style.position).toBe(""); // pagou e a página continua rolando
    // de novo (outra consulta): nada se repete
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();
    expect(pixel.mock.calls.filter((c) => c[0] === "Purchase")).toHaveLength(1);
  });
  it("recarregou com o Pix gerado: o servidor devolve o MESMO Pix e ele volta na página (mesma ref, mesmo PI)", async () => {
    sessionStorage.setItem("tudo-qa-stripe-ref", "ref-tudo-recarga-1");
    sessionStorage.setItem("tudo-qa-stripe-pi", JSON.stringify({ ref: "ref-tudo-recarga-1", pi: "pi_tudo" }));
    criar.mockResolvedValue({ ok: true, pi: "pi_tudo", clientSecret: "pi_tudo_secret_QA", status: "requires_action", pix: { data: QR } });
    await abrirCheckout(inline());
    await flush();
    expect(criar.mock.calls[0][0]).toMatchObject({ ref: "ref-tudo-recarga-1", pi: "pi_tudo" });
    expect(host.querySelector("[data-testid='oferta-pix']")).not.toBeNull();
    expect((host.querySelector("#oc-codigo") as HTMLInputElement).value).toBe(QR);
    expect(confirmPixPayment).not.toHaveBeenCalled();
  });
  it("volta do banco (3DS) confirmada pelo servidor → pago na página", async () => {
    status.mockResolvedValue({ ok: true, pago: true, status: "succeeded", metodo: "card" });
    await abrirCheckout(inline({ voltaDoBanco: { pi: "pi_tudo", status: "succeeded" } }));
    await flush();
    expect(status).toHaveBeenCalledWith(expect.objectContaining({ pi: "pi_tudo" }));
    expect(host.querySelector("[data-testid='pos-compra']")).not.toBeNull();
    expect(pixel.mock.calls.filter((c) => c[0] === "Purchase")).toHaveLength(1);
  });
});

describe("layout cakto", () => {
  it("a estrutura: produto, Nome completo, Email, Forma de Pagamento (PIX | Cartão de Crédito), Resumo do pedido com Total, Compra segura", async () => {
    await abrirCheckout(inline());
    await flush();
    const t = host.textContent ?? "";
    expect(host.querySelector(".ck-produto h2")!.textContent).toBe("CORE · Acesso vitalício");
    expect([...host.querySelectorAll(".ck-rot")].map((l) => l.textContent)).toEqual(["Nome completo", "E-mail", "Nome no cartão"]);
    expect([...host.querySelectorAll("[data-metodo]")].map((b) => b.textContent)).toEqual(["PIX", "Cartão de Crédito"]);
    expect(host.querySelector("[data-metodo='pix']")!.getAttribute("aria-checked")).toBe("true");
    expect(t).toContain("Forma de Pagamento");
    expect(t).toContain("Resumo do pedido");
    expect(host.querySelector(".ck-total")!.textContent).toMatch(/Total\s*R\$\s27,90/);
    expect(t).toContain("Compra segura");
    expect(host.querySelector(".ck-segura")!.textContent).toContain("Garantia de 7 dias");
    expect(t).not.toMatch(/parcela|taxa de servi|CPF|celular/i);
    expect(host.querySelector("#oc-pagar")!.textContent).toBe("Pagar com Pix");
    (host.querySelector("[data-metodo='card']") as HTMLElement).click();
    await flush();
    expect(host.querySelector("#oc-pagar")!.textContent).toBe("Pagar com Cartão de Crédito");
    expect((host.querySelector("#ck-titular") as HTMLElement).hidden).toBe(false);
  });
  it("Nome completo é obrigatório e vai só pra Stripe: nunca no pedido do servidor nem em evento", async () => {
    await abrirCheckout(inline());
    await flush();
    digitar("#oc-email", "qa@example.com");
    (host.querySelector("#oc-pagar") as HTMLElement).click();
    await flush();
    expect(confirmPixPayment).not.toHaveBeenCalled();
    expect((host.querySelector("#oc-nome-erro") as HTMLElement).hidden).toBe(false);
    digitar("#oc-nome", "  Maria   Teste ");
    (host.querySelector("#oc-pagar") as HTMLElement).click();
    await flush();
    expect(confirmPixPayment).toHaveBeenCalledWith("pi_tudo_secret_QA", { payment_method: { billing_details: { email: "qa@example.com", name: "Maria Teste" } } }, { handleActions: false });
    for (const [corpo] of criar.mock.calls) { expect(corpo.pagina).toBe("lp27"); expect(JSON.stringify(corpo)).not.toContain("Maria"); expect(corpo).not.toHaveProperty("amount"); }
    expect(JSON.stringify(evento.mock.calls)).not.toContain("Maria");
    expect(JSON.stringify(evento.mock.calls)).not.toContain("qa@example.com");
  });
  it("cartão: o Nome no cartão vai no PaymentMethod (sem ele, o Nome completo)", async () => {
    await abrirCheckout(inline());
    await flush();
    (host.querySelector("[data-metodo='card']") as HTMLElement).click();
    await flush();
    digitar("#oc-nome", "Maria Teste");
    digitar("#oc-email", "qa@example.com");
    digitar("#oc-titular", "MARIA T SILVA");
    (host.querySelector("#oc-pagar") as HTMLElement).click();
    await flush();
    expect(createPaymentMethod).toHaveBeenCalledWith(expect.objectContaining({ params: { billing_details: { email: "qa@example.com", name: "MARIA T SILVA" } } }));
    expect(confirmPayment).toHaveBeenCalledOnce();
    expect(host.querySelector("[data-testid='pos-compra']")).not.toBeNull();
    expect(pixel.mock.calls.filter((c) => c[0] === "Purchase")).toHaveLength(1);
  });
});

describe("revisão 23/11", () => {
  it("landing_stripe_aberto do inline sai marcado (montou por rolagem, não é 'abriu')", async () => {
    await abrirCheckout(inline());
    await flush();
    expect(evento.mock.calls.find((c) => c[0] === "landing_stripe_aberto")?.[1]).toMatchObject({ inline: true });
  });
  it("padrão: landing_stripe_aberto sem a marca inline", async () => {
    await abrirCheckout({ ...base });
    await flush();
    expect(evento.mock.calls.find((c) => c[0] === "landing_stripe_aberto")?.[1]).toEqual({ fase: "form" });
  });
  it("Pix gerado no inline: topo com a miniatura; 'Voltar' esquece a ref/PI da aba e volta pro formulário com ref NOVA, com o que foi digitado", async () => {
    await abrirCheckout(inline());
    await flush();
    digitar("#oc-nome", "Maria Teste");
    digitar("#oc-email", "qa@example.com");
    (host.querySelector("#oc-pagar") as HTMLElement).click();
    await flush();
    expect(host.querySelector(".oc-pix .ck-produto")).not.toBeNull();
    const refAntiga = criar.mock.calls[0][0].ref;
    expect(sessionStorage.getItem("tudo-qa-stripe-ref")).toBe(refAntiga);
    criar.mockResolvedValue({ ok: true, pi: "pi_tudo2", clientSecret: "pi_tudo2_secret_QA" });
    (host.querySelector("#oc-voltar-pix") as HTMLElement).click();
    await flush();
    expect(host.querySelector("[data-testid='oferta-pix']")).toBeNull();
    expect((host.querySelector("#oc-nome") as HTMLInputElement).value).toBe("Maria Teste");
    expect((host.querySelector("#oc-email") as HTMLInputElement).value).toBe("qa@example.com");
    const ultimo = criar.mock.calls[criar.mock.calls.length - 1][0];
    expect(ultimo.ref).not.toBe(refAntiga);
    expect(ultimo.pi).toBeNull();
    expect(sessionStorage.getItem("tudo-qa-stripe-ref")).toBe(ultimo.ref);
    expect(evento.mock.calls.some((c) => c[0] === "landing_stripe_pix_voltou")).toBe(true);
    // o PI velho que "cair" depois não leva esta tela pro pago (a página só pergunta pelo PI novo)
    status.mockImplementation(async (c: { pi: string }) => (c.pi === "pi_tudo" ? { ok: true, pago: true, status: "succeeded" } : { ok: true, pago: false, status: "requires_payment_method" }));
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();
    expect(host.querySelector("#oc-nome")).not.toBeNull();
  });
  it("a camada (padrão) não tem o 'Voltar' do inline", async () => {
    await abrirCheckout({ ...base });
    await flush();
    digitar("#oc-email", "qa@example.com");
    (document.getElementById("oc-pagar") as HTMLElement).click();
    await flush();
    expect(document.querySelector("[data-testid='oferta-pix']")).not.toBeNull();
    expect(document.getElementById("oc-voltar-pix")).toBeNull();
  });
  it("pixCopiaPrimeiro 'sempre': copiar primeiro também fora do Android; true continua só no Android", async () => {
    await abrirCheckout(inline({ pixCopiaPrimeiro: "sempre" }));
    await flush();
    digitar("#oc-nome", "Maria Teste"); digitar("#oc-email", "qa@example.com");
    (host.querySelector("#oc-pagar") as HTMLElement).click();
    await flush();
    expect(host.querySelector("[data-testid='oferta-pix']")!.getAttribute("data-layout")).toBe("copia_primeiro");
    _zerar(); host.innerHTML = ""; sessionStorage.clear();
    await abrirCheckout({ ...base, pixCopiaPrimeiro: true });
    await flush();
    digitar("#oc-email", "qa@example.com");
    (document.getElementById("oc-pagar") as HTMLElement).click();
    await flush();
    expect(document.querySelector("[data-testid='oferta-pix']")!.getAttribute("data-layout")).toBeNull(); // jsdom não é Android
  });
});

describe("tudo.html e as rotas", () => {
  const raiz = resolve(__dirname, "../..");
  const HTML = readFileSync(resolve(raiz, "tudo.html"), "utf8");
  const cabeca = HTML.match(/<script>\s*\/\*[\s\S]*?\*\/\s*(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];
  const rodar = (fonte: string, busca: string) => {
    const attrs: Record<string, string> = {}; const replace = vi.fn();
    new Function("location", "document", fonte)({ search: busca, replace }, { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } } });
    return { attrs, replace };
  };
  it("nasce off: vai pro /organizar com a mesma query (página escondida)", () => {
    expect(HTML).toMatch(/var PAGINA_TUDO = "off";/);
    const r = rodar(cabeca, "?utm_content=c7&fbclid=x");
    expect(r.replace).toHaveBeenCalledWith("/organizar?utm_content=c7&fbclid=x");
    expect(r.attrs["data-desligada"]).toBe("");
  });
  it("?tudo=on mostra com a chave off; on mostra pra todo mundo", () => {
    expect(rodar(cabeca, "?tudo=on&qa=1").replace).not.toHaveBeenCalled();
    expect(rodar(cabeca.replace('var PAGINA_TUDO = "off"', 'var PAGINA_TUDO = "on"'), "?utm_content=c7").replace).not.toHaveBeenCalled();
  });
  it("a oferta: de R$97,90 por R$27,90, vitalício; sem parcela, sem taxa; diz que é app", () => {
    const texto = HTML.replace(/<[^>]+>/g, " ");
    expect(texto).toMatch(/de\s+R\$97,90\s+por\s+R\$27,90/);
    expect(texto).toMatch(/vitalício/i);
    expect(texto).toMatch(/iPhone, Android e computador/);
    expect(texto).not.toMatch(/parcela|taxa de servi/i);
    expect(texto).toContain("No app, R$ 97,90 por ano. Aqui, R$ 27,90 uma vez só, pra sempre.");
    expect(texto).toContain("Garantia de 7 dias · Pix ou cartão");
    expect(texto).toContain("CORE · SEU 2027 ORGANIZADO");
  });
  it("as rotas /tudo e /tudo/ existem na Vercel e no Vite", () => {
    const vercel = JSON.parse(readFileSync(resolve(raiz, "vercel.json"), "utf8"));
    const rw = (vercel.rewrites ?? vercel.routes ?? []) as Array<{ source: string; destination: string }>;
    expect(rw).toEqual(expect.arrayContaining([{ source: "/tudo", destination: "/tudo.html" }, { source: "/tudo/", destination: "/tudo.html" }]));
    const vite = readFileSync(resolve(raiz, "vite.config.ts"), "utf8");
    expect(vite).toContain('tudo: path.resolve(__dirname, "tudo.html")');
  });
});
