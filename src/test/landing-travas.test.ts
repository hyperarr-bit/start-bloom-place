/**
 * AS TRAVAS DA LANDING /organizar (29/10).
 *
 * Caso real (29/10, 11h38 → 11h50, iPhone, navegador do Instagram): pagou o vitalício, criou a conta, entrou no app
 * DENTRO do iframe da demo, a conta foi excluída por lá (o `localStorage.clear()` da exclusão apagou o estado do Pix e a
 * sessão na MESMA origem), a página voltou na oferta e ela pagou de novo. Aqui:
 *   1. o marcador "já comprou" (cookie + localStorage) e o cartão "Você já tem o CORE";
 *   2. o servidor recusando o Pix de quem já tem o vitalício e não reescrevendo a linha num 2º pagamento (vira chamado);
 *   3. o chamado "Pix pago sem e-mail" 1x por pedido, com o nome do pagador da Asaas;
 *   4. a medição invisível (dúvidas, volta pra aba, id do aparelho) e que a página de quem NÃO comprou fica igual.
 * Fixtures no formato das linhas de verdade (subscriptions, analytics_events.pix_order_created, payloads da Asaas).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { creditarPedido } from "../../supabase/functions/_shared/grant-pix";
import {
  alertarPagoSemEmail, chaveDobro, chavePagador, chaveSemEmail, guardarNomeDoPagador, horaBrasilia, jaTemOCore, nomeDoPagadorAsaas,
  registrarPagoEmDobro, temVitalicioAtivo, varrerPagosSemEmail,
} from "../../supabase/functions/_shared/landing-travas";
import { voltaDaDemoDaLanding } from "@/landing/guarda-demo";

const raiz = resolve(__dirname, "../..");
const fonte = (f: string) => readFileSync(resolve(raiz, f), "utf8");

/* ───────────────────────── banco falso (interface mínima do supabase-js) ───────────────────────── */
type Linha = Record<string, unknown>;
function bancoFalso(inicial: Partial<Record<string, Linha[]>> = {}) {
  const tabelas: Record<string, Linha[]> = { subscriptions: [], webhook_events: [], analytics_events: [], support_tickets: [], ...inicial } as Record<string, Linha[]>;
  let seq = 0;
  const from = (tabela: string) => {
    const filtros: Array<(r: Linha) => boolean> = [];
    let op: { tipo: "select" | "insert" | "update"; dados?: Linha } = { tipo: "select" };
    const exec = async () => {
      await new Promise((r) => setTimeout(r, 0));
      const t = (tabelas[tabela] ??= []);
      if (op.tipo === "insert") {
        if (tabela === "webhook_events" && t.some((r) => r.id === op.dados!.id)) return { error: { code: "23505", message: "duplicate key" } };
        t.push({ id: op.dados!.id ?? `id${++seq}`, created_at: new Date().toISOString(), ...op.dados });
        return { error: null };
      }
      const achadas = t.filter((r) => filtros.every((f) => f(r)));
      if (op.tipo === "update") { achadas.forEach((r) => Object.assign(r, op.dados)); return { error: null }; }
      return { data: achadas.map((r) => ({ ...r })), error: null };
    };
    const q: Record<string, unknown> = {
      select: () => q,
      insert: (d: Linha) => { op = { tipo: "insert", dados: d }; return q; },
      update: (d: Linha) => { op = { tipo: "update", dados: d }; return q; },
      eq: (k: string, v: unknown) => { filtros.push((r) => r[k] === v); return q; },
      in: (k: string, vs: unknown[]) => { filtros.push((r) => vs.includes(r[k])); return q; },
      then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => exec().then(ok, erro),
    };
    return q;
  };
  return { tabelas, admin: { from } };
}

/* linhas no formato de public.subscriptions */
const linhaVitalicia = (o: Partial<Linha> = {}): Linha => ({
  id: "0b6c1e9a-1111-4c3e-9a51-6f0d6a7e0001", user_id: "a1b2c3d4-0000-4000-8000-000000000001", status: "active",
  plan: "lifetime", billing_period: "lifetime", payment_method: "pix", customer_email: "maria@email.com",
  abacatepay_billing_id: "a6e3b0f1c2d34e5f9a8b7c6d5e4f3a2b", revenuecat_subscription_id: null, amount_cents: 2790,
  current_period_start: "2026-10-29T14:38:07.120+00:00", current_period_end: "2126-10-29T14:38:07.120+00:00",
  created_at: "2026-10-29T14:38:07.200+00:00", ...o,
});
const UID = "a1b2c3d4-0000-4000-8000-000000000001";
const PEDIDO_1 = "a6e3b0f1c2d34e5f9a8b7c6d5e4f3a2b";
const PEDIDO_2 = "f1e2d3c4b5a697887766554433221100";

describe("servidor · quem já tem o CORE pra sempre", () => {
  it("temVitalicioAtivo: vitalício vivo (Pix ou loja) conta; cancelado, anual e vencido não", () => {
    const agora = Date.parse("2026-10-29T15:00:00Z");
    expect(temVitalicioAtivo([linhaVitalicia()], agora)).toBe(true);
    expect(temVitalicioAtivo([linhaVitalicia({ payment_method: "play_store", revenuecat_subscription_id: "GPA.1" })], agora)).toBe(true);
    expect(temVitalicioAtivo([linhaVitalicia({ status: "canceled" })], agora)).toBe(false);
    expect(temVitalicioAtivo([linhaVitalicia({ plan: "core-pro", billing_period: "annual" })], agora)).toBe(false);
    expect(temVitalicioAtivo([linhaVitalicia({ current_period_end: "2026-10-01T00:00:00+00:00" })], agora)).toBe(false);
    expect(temVitalicioAtivo([], agora)).toBe(false);
  });

  it("jaTemOCore: pela conta da sessão, pelo e-mail (conta de outro uid) e nunca por e-mail sem conta", async () => {
    const { admin } = bancoFalso({ subscriptions: [linhaVitalicia()] });
    const achar = vi.fn(async (e: string) => (e === "maria@email.com" ? UID : null));
    expect(await jaTemOCore(admin, { userId: UID, emails: [], acharConta: achar })).toEqual({ jaTem: true, via: "conta" });
    // sessão anônima NOVA (o storage zerou), e-mail da compra anterior lembrado pela página
    expect(await jaTemOCore(admin, { userId: "anon-novo", emails: [null, "Maria@Email.com "], acharConta: achar })).toEqual({ jaTem: true, via: "email" });
    // visitante de sempre: sem e-mail, sem linha → gera
    expect(await jaTemOCore(admin, { userId: "anon-novo", emails: [null, undefined, "x"], acharConta: achar })).toEqual({ jaTem: false });
    expect(await jaTemOCore(admin, { userId: "anon-novo", emails: ["outra@email.com"], acharConta: achar })).toEqual({ jaTem: false });
    // falha ao achar a conta = deixa gerar
    expect(await jaTemOCore(admin, { userId: "anon-novo", emails: ["maria@email.com"], acharConta: async () => { throw new Error("rede"); } })).toEqual({ jaTem: false });
  });

  it("o create do asaas-pix recusa ANTES de gerar o QR (só nas ofertas da landing) e devolve ja_tem com 200", () => {
    const s = fonte("supabase/functions/asaas-pix/index.ts");
    const create = s.slice(s.indexOf('if (action === "create")'), s.indexOf('if (action === "check")'));
    const trava = create.indexOf("jaTemOCore(");
    expect(trava).toBeGreaterThan(0);
    expect(trava).toBeLessThan(create.indexOf("/pix/qrCodes/static"));
    expect(create).toMatch(/if \(ehOfertaLanding\(offer\)\)/);
    expect(create).toMatch(/jsonResponse\(\{ ja_tem: true, error: "ja_tem"/);
    // o e-mail opcional da tela do Pix também não vira destino de quem já tem
    expect(s).toMatch(/motivo: "ja_tem", ja_tem: true/);
  });

  it("os 3 caminhos que creditam protegem o vitalício nas ofertas da landing", () => {
    for (const f of ["asaas-pix/index.ts", "asaas-webhook/index.ts", "pix-reconcile/index.ts"]) {
      expect(fonte(`supabase/functions/${f}`)).toMatch(/protegerVitalicio: ehOfertaLanding\((o\.)?offer\)/);
    }
  });
});

describe("servidor · 2º pagamento NÃO sobrescreve a linha (vira chamado)", () => {
  const creditar = (admin: unknown, orderId: string, proteger = true) => creditarPedido(admin as never, {
    userId: UID, orderId, gateway: "asaas", concessao: { dias: null }, agora: new Date("2026-10-29T14:50:28.711Z"),
    protegerVitalicio: proteger, offer: "LN_sempre279",
    montarPayload: (fim) => ({
      user_id: UID, status: "active", plan: "lifetime", billing_period: "lifetime", payment_method: "pix", abacatepay_billing_id: orderId,
      customer_email: "maria@email.com", current_period_start: "2026-10-29T14:50:28.711Z", current_period_end: fim, amount_cents: 2790,
    }),
  });

  it("o caso de 29/10: vitalício pago às 11h38 + outro às 11h50 → linha intacta, 1 evento, 1 chamado (1x por pedido)", async () => {
    const { tabelas, admin } = bancoFalso({ subscriptions: [linhaVitalicia()] });
    const r = await creditar(admin, PEDIDO_2);
    expect(r).toEqual({ r: "preservado", motivo: "vitalicio_pagou_de_novo" });
    expect(tabelas.subscriptions).toHaveLength(1);
    expect(tabelas.subscriptions[0].abacatepay_billing_id).toBe(PEDIDO_1); // o pedido que valia continua lá
    expect(tabelas.subscriptions[0].current_period_start).toBe("2026-10-29T14:38:07.120+00:00");
    const ev = tabelas.analytics_events.filter((e) => e.event_name === "pix_pago_em_dobro");
    expect(ev).toHaveLength(1);
    expect(ev[0].event_data).toMatchObject({ order_id: PEDIDO_2, pedido_anterior: PEDIDO_1, amount_cents: 2790, offer: "LN_sempre279" });
    const t = tabelas.support_tickets;
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ user_id: UID, source: "pix_em_dobro", status: "open" });
    expect(String(t[0].message)).toContain("Pix pago em dobro · R$ 27,90 · 29/10 11:50");
    expect(String(t[0].message)).toContain(`Pedido a devolver: ${PEDIDO_2}`);
    // o check da página a cada 3 s + o webhook + o reconcile: nenhum chamado a mais
    await creditar(admin, PEDIDO_2); await creditar(admin, PEDIDO_2);
    expect(tabelas.support_tickets).toHaveLength(1);
    expect(tabelas.webhook_events.filter((w) => w.id === chaveDobro(PEDIDO_2))).toHaveLength(1);
  });

  it("o MESMO pedido de novo continua 'ja_creditado' (sem chamado); fora da landing segue o de sempre", async () => {
    const { tabelas, admin } = bancoFalso({ subscriptions: [linhaVitalicia()] });
    expect((await creditar(admin, PEDIDO_1)).r).toBe("ja_creditado");
    expect(tabelas.support_tickets).toHaveLength(0);
    const r = await creditar(admin, PEDIDO_2, false);
    expect(r).toMatchObject({ r: "creditado", jaLiberado: true });
  });

  it("registrarPagoEmDobro sozinho também é 1x por pedido", async () => {
    const { tabelas, admin } = bancoFalso();
    const a = { userId: UID, orderId: PEDIDO_2, amountCents: 2790, pedidoAnterior: PEDIDO_1 };
    expect(await registrarPagoEmDobro(admin, a)).toBe(true);
    expect(await registrarPagoEmDobro(admin, a)).toBe(false);
    expect(tabelas.support_tickets).toHaveLength(1);
  });
});

describe("servidor · Pix da landing pago SEM e-mail", () => {
  /* respostas da Asaas no formato da API v3 */
  const listaPagamentos = { object: "list", hasMore: false, totalCount: 1, limit: 10, offset: 0, data: [{
    object: "payment", id: "pay_8k2j3h4g5f6d", customer: "cus_000123456789", value: 27.9, netValue: 25.91, billingType: "PIX",
    status: "RECEIVED", pixQrCodeId: PEDIDO_1, description: "CORE pra sempre", externalReference: null, paymentDate: "2026-10-29",
  }] };
  const cliente = { object: "customer", id: "cus_000123456789", name: "MARIA DA SILVA  SOUZA", email: null, cpfCnpj: "***" };
  const buscar = vi.fn(async (url: string) => ({
    ok: true,
    json: async () => (url.includes("/payments?") ? listaPagamentos : url.includes("/customers/cus_000123456789") ? cliente : {}),
  }));

  it("nomeDoPagadorAsaas: pelo customer do pagamento (ou achando o pagamento pelo QR)", async () => {
    expect(await nomeDoPagadorAsaas(buscar, "k", { customerId: "cus_000123456789" })).toBe("MARIA DA SILVA SOUZA");
    expect(await nomeDoPagadorAsaas(buscar, "k", { qrCodeId: PEDIDO_1 })).toBe("MARIA DA SILVA SOUZA");
    expect(await nomeDoPagadorAsaas(async () => ({ ok: false, json: async () => ({}) }), "k", { customerId: "cus_x" })).toBeNull();
  });

  it("o webhook guarda o nome junto do pedido (webhook_events, 1x) — nunca no log", async () => {
    const { tabelas, admin } = bancoFalso();
    expect(await guardarNomeDoPagador(admin, PEDIDO_1, "MARIA DA SILVA SOUZA")).toBe(true);
    expect(await guardarNomeDoPagador(admin, PEDIDO_1, "outro")).toBe(false);
    expect(tabelas.webhook_events).toEqual([expect.objectContaining({ id: chavePagador(PEDIDO_1), source: "landing", event: "MARIA DA SILVA SOUZA" })]);
    const wh = fonte("supabase/functions/asaas-webhook/index.ts");
    const bloco = wh.slice(wh.indexOf("nomeDoPagadorAsaas(fetch"), wh.indexOf("nomeDoPagadorAsaas(fetch") + 400);
    expect(bloco).toMatch(/tem_nome: !!nome/); // o log diz SE tem nome, não o nome
    expect(bloco).not.toMatch(/logStep\([^\n]*[{,]\s*nome\s*[,}]/);
  });

  it("alertarPagoSemEmail: 'Pix pago sem e-mail · R$ X · horário · nome do pagador', 1x por pedido", async () => {
    const { tabelas, admin } = bancoFalso();
    const a = { userId: UID, orderId: PEDIDO_1, amountCents: 2790, pagoEm: "2026-10-29T11:33:41.000+00:00", nome: "MARIA DA SILVA SOUZA" };
    expect(await alertarPagoSemEmail(admin, a)).toBe(true);
    expect(await alertarPagoSemEmail(admin, a)).toBe(false);
    expect(tabelas.support_tickets).toHaveLength(1);
    expect(tabelas.support_tickets[0]).toMatchObject({ source: "pix_sem_email", status: "open", user_id: UID });
    expect(String(tabelas.support_tickets[0].message).split("\n")[0]).toBe("Pix pago sem e-mail · R$ 27,90 · 29/10 08:33 · pagador: MARIA DA SILVA SOUZA");
    expect(horaBrasilia("2026-10-29T14:50:28.711Z")).toBe("29/10 11:50");
  });

  it("a passada do reconcile: só pedido da landing, creditado, com 10 min+ e sem e-mail nem destino; 1x", async () => {
    const agora = Date.parse("2026-10-29T12:00:00Z");
    const pedido = (oid: string, offer: string, minAtras: number, uid = UID) => ({
      user_id: uid, created_at: new Date(agora - minAtras * 60_000).toISOString(),
      event_data: { order_id: oid, offer, amount_cents: 2790, gateway: "asaas", source_url: "https://www.coreaplicativo.com.br/organizar" },
    });
    const sem = linhaVitalicia({ customer_email: null, abacatepay_billing_id: "ped_sem", current_period_start: "2026-10-29T11:33:41.000Z" });
    const { tabelas, admin } = bancoFalso({
      subscriptions: [
        sem,
        linhaVitalicia({ id: "l2", user_id: "u-com", customer_email: null, abacatepay_billing_id: "ped_com_email_na_conta" }),
        linhaVitalicia({ id: "l3", user_id: "u-dest", customer_email: null, abacatepay_billing_id: "ped_destino" }),
        linhaVitalicia({ id: "l4", customer_email: null, abacatepay_billing_id: "ped_recente" }),
        linhaVitalicia({ id: "l5", customer_email: null, abacatepay_billing_id: "ped_hoje" }),
      ],
      webhook_events: [{ id: chavePagador("ped_sem"), source: "landing", event: "JOAO PAGADOR" }],
    });
    const args = {
      pedidos: [
        pedido("ped_sem", "LN_sempre279", 26), pedido("ped_com_email_na_conta", "LN_sempre279", 30, "u-com"), pedido("ped_destino", "LN_sempre279", 30, "u-dest"),
        pedido("ped_recente", "LN_sempre279", 3), pedido("ped_hoje", "h279", 30),
      ],
      agora,
      emailDaConta: async (uid: string) => (uid === "u-com" ? "tem@email.com" : null),
      temDestino: async (uid: string) => uid === "u-dest",
      nomeNaAsaas: vi.fn(async () => "NAO DEVE PRECISAR"),
    };
    expect(await varrerPagosSemEmail(admin, args)).toBe(1);
    expect(tabelas.support_tickets).toHaveLength(1);
    expect(String(tabelas.support_tickets[0].message)).toContain("pagador: JOAO PAGADOR");
    expect(String(tabelas.support_tickets[0].message)).toContain("Pedido: ped_sem");
    expect(args.nomeNaAsaas).not.toHaveBeenCalled();
    expect(tabelas.webhook_events.some((w) => w.id === chaveSemEmail("ped_sem"))).toBe(true);
    // o cron de 15 em 15 min: nada de chamado repetido
    expect(await varrerPagosSemEmail(admin, args)).toBe(0);
    expect(tabelas.support_tickets).toHaveLength(1);
    expect(fonte("supabase/functions/pix-reconcile/index.ts")).toMatch(/varrerPagosSemEmail\(admin/);
  });
});

describe("a demo da landing nunca vira o app de verdade", () => {
  it("dentro do iframe da /organizar, qualquer rota fora da demo volta pra demo; fora dele nada muda", () => {
    expect(voltaDaDemoDaLanding("/home", "/organizar")).toBe("/organizar/demo");
    expect(voltaDaDemoDaLanding("/voce", "/organizar/")).toBe("/organizar/demo");
    expect(voltaDaDemoDaLanding("/organizar/demo", "/organizar")).toBeNull();
    expect(voltaDaDemoDaLanding("/home", null)).toBeNull(); // o app normal, sem iframe
    expect(voltaDaDemoDaLanding("/home", "/preview")).toBeNull(); // outro iframe/página
    expect(fonte("src/App.tsx")).toMatch(/<GuardaDemoDaLanding \/>/);
  });
  it("excluir a conta apaga o 'já comprou' (o cookie sobrevive ao localStorage.clear)", () => {
    const s = fonte("src/components/account/DeleteAccountDialog.tsx");
    expect(s.indexOf("esquecerCompra()")).toBeGreaterThan(s.indexOf("localStorage.clear()"));
  });
});

/* ───────────────────────── a página de verdade (HTML + landing.ts) no jsdom, Pix SIMULADO ───────────────────────── */
const HTML = fonte("landing.html");
const corpo = HTML.match(/<body>([\s\S]*)<\/body>/)![1].replace(/<script type="module"[^>]*><\/script>/, "");
type Ev = Record<string, unknown> & { nome: string };
const eventos = (): Ev[] => ((window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding ?? []);
const apagarCookies = () => {
  for (const c of document.cookie.split(";")) {
    const n = c.split("=")[0].trim();
    if (n) document.cookie = `${n}=; Max-Age=0; Path=/`;
  }
};
async function abrirPagina(opts: { limpar?: boolean } = {}) {
  vi.resetModules();
  if (opts.limpar !== false) { localStorage.clear(); apagarCookies(); }
  (window as unknown as { __eventosLanding?: Ev[] }).__eventosLanding = [];
  delete (window as unknown as { __landingSimularJaTem?: boolean }).__landingSimularJaTem;
  document.documentElement.setAttribute("data-t", "a");
  document.documentElement.setAttribute("data-oferta", "sempre");
  document.body.innerHTML = corpo;
  await import("@/landing/landing");
}
const espera = (sel: string, ms = 4000) => vi.waitFor(() => { const el = document.querySelector(sel); if (!el) throw new Error(sel); return el; }, { timeout: ms, interval: 50 });
const simular = () => (window as unknown as { __landingSimular: { pagar: () => void } }).__landingSimular;

describe("a página · quem NÃO comprou vê tudo igual", () => {
  beforeEach(() => abrirPagina());

  it("o cartão da oferta e o resto da página saem IDÊNTICOS ao HTML (nada pintado por cima)", async () => {
    await new Promise((r) => setTimeout(r, 30));
    const original = document.createElement("div");
    original.innerHTML = corpo;
    const limpo = (el: Element) => el.outerHTML.replace(/\s+/g, " ");
    expect(limpo(document.getElementById("lp-card")!)).toBe(limpo(original.querySelector("#lp-card")!));
    expect(document.getElementById("lp-card")!.getAttribute("data-fase")).toBe("oferta");
    expect(document.getElementById("lp-pix")!.innerHTML).toBe("");
    expect(document.querySelector('[data-testid="landing-ja-tem"]')).toBeNull();
    // nenhum bloco da página mudou (o que o script mexe de propósito — a demo e o botão — fica igual ao HTML no 1º render)
    for (const id of ["oferta", "fim", "lp-fixo"]) {
      const el = document.getElementById(id); const or = original.querySelector(`#${id}`);
      if (el && or) expect(limpo(el)).toBe(limpo(or));
    }
    expect(eventos().map((e) => e.nome)).not.toContain("landing_ja_tem");
    expect(localStorage.getItem("landing-comprou-v1")).toBeNull();
    expect(document.cookie).not.toContain("core_ln_comprou");
  });
});

describe("a página · já comprou", () => {
  beforeEach(() => abrirPagina());

  it("pagou → o marcador vai pro cookie E pro localStorage; o storage zera (exclusão/Instagram) → 'Você já tem o CORE' + Abrir + lojas", async () => {
    (document.getElementById("lp-pagar") as HTMLButtonElement).click();
    await espera('[data-testid="landing-codigo"]');
    simular().pagar();
    await espera("#lp-email");
    expect(document.cookie).toContain("core_ln_comprou=");
    const email = document.getElementById("lp-email") as HTMLInputElement;
    email.value = "maria@email.com"; email.dispatchEvent(new Event("input"));
    (document.getElementById("lp-criar") as HTMLButtonElement).click();
    await espera('[data-testid="landing-conta"]');
    expect(JSON.parse(localStorage.getItem("landing-comprou-v1")!)).toMatchObject({ v: 1, oferta: "LN_sempre279", email: "maria@email.com" });

    // o que aconteceu às 11h48: o localStorage inteiro sumiu (estado do Pix + sessão), a aba recarregou
    localStorage.clear();
    await abrirPagina({ limpar: false });
    const card = await espera('[data-testid="landing-ja-tem"]');
    expect(card.textContent).toContain("Você já tem o CORE");
    expect(card.textContent).toContain("Abrir meu CORE");
    expect(card.querySelector('a[href*="apps.apple.com"]')).not.toBeNull();
    expect(card.querySelector('a[href*="play.google.com"]')).not.toBeNull();
    expect(document.getElementById("lp-card")!.getAttribute("data-fase")).toBe("conta"); // o CSS esconde a oferta
    expect(eventos()).toEqual(expect.arrayContaining([expect.objectContaining({ nome: "landing_ja_tem", via: "marcador" })]));
  });

  it("com o e-mail no localStorage o cartão diz com qual e-mail entrar; 'Não fui eu' devolve a oferta", async () => {
    localStorage.setItem("landing-comprou-v1", JSON.stringify({ v: 1, em: Date.now(), oferta: "LN_sempre279", email: "maria@email.com" }));
    await abrirPagina({ limpar: false });
    const card = await espera('[data-testid="landing-ja-tem"]');
    expect(card.textContent).toContain("maria@email.com");
    (document.getElementById("lp-nao-fui-eu") as HTMLButtonElement).click();
    expect(document.querySelector('[data-testid="landing-ja-tem"]')).toBeNull();
    expect(document.getElementById("lp-card")!.getAttribute("data-fase")).toBe("oferta");
    expect(localStorage.getItem("landing-comprou-v1")).toBeNull();
    expect(document.cookie).not.toContain("core_ln_comprou=1");
  });

  it("o servidor recusa (ja_tem): nada de QR, o cartão aparece e o aparelho fica marcado", async () => {
    (window as unknown as { __landingSimularJaTem?: boolean }).__landingSimularJaTem = true;
    (document.getElementById("lp-pagar") as HTMLButtonElement).click();
    await espera('[data-testid="landing-ja-tem"]');
    expect(document.querySelector('[data-testid="landing-codigo"]')).toBeNull();
    expect(eventos().map((e) => e.nome)).not.toContain("landing_pix_gerado");
    expect(eventos()).toEqual(expect.arrayContaining([expect.objectContaining({ nome: "landing_ja_tem", via: "servidor" })]));
    expect(document.cookie).toContain("core_ln_comprou=");
  });

  it("o e-mail opcional da tela do QR é de quem já tem o CORE: o QR sai e entra o cartão", async () => {
    (document.getElementById("lp-pagar") as HTMLButtonElement).click();
    await espera("#lp-email-pix");
    const campo = document.getElementById("lp-email-pix") as HTMLInputElement;
    campo.value = "maria+jatem@email.com"; campo.dispatchEvent(new Event("input"));
    (document.getElementById("lp-email-pix-ok") as HTMLButtonElement).click();
    const card = await espera('[data-testid="landing-ja-tem"]');
    expect(card.textContent).toContain("maria+jatem@email.com");
    expect(document.querySelector('[data-testid="landing-codigo"]')).toBeNull();
  });
});

describe("a página · medição invisível", () => {
  let visivel: DocumentVisibilityState = "visible";
  beforeEach(async () => {
    visivel = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visivel });
    await abrirPagina();
  });
  afterEach(() => vi.restoreAllMocks());

  it("landing_duvida_aberta {pergunta} ao abrir cada dúvida (1x por pergunta)", () => {
    const d = document.querySelectorAll<HTMLDetailsElement>("details")[0];
    d.open = true; d.dispatchEvent(new Event("toggle"));
    d.open = false; d.dispatchEvent(new Event("toggle"));
    d.open = true; d.dispatchEvent(new Event("toggle"));
    const abertas = eventos().filter((e) => e.nome === "landing_duvida_aberta");
    expect(abertas).toHaveLength(1);
    expect(abertas[0].pergunta).toBe("É um app de verdade?");
  });

  it("landing_voltou {fase, ausente_s, com_pix} depois de ≥5 s fora; volta rápida não conta", async () => {
    (document.getElementById("lp-pagar") as HTMLButtonElement).click();
    await espera('[data-testid="landing-codigo"]');
    const t0 = Date.now();
    const relogio = vi.spyOn(Date, "now");
    relogio.mockReturnValue(t0);
    visivel = "hidden"; document.dispatchEvent(new Event("visibilitychange"));
    relogio.mockReturnValue(t0 + 2000);
    visivel = "visible"; document.dispatchEvent(new Event("visibilitychange"));
    expect(eventos().filter((e) => e.nome === "landing_voltou" && e.com_pix)).toHaveLength(0);
    relogio.mockReturnValue(t0 + 3000);
    visivel = "hidden"; document.dispatchEvent(new Event("visibilitychange"));
    relogio.mockReturnValue(t0 + 3000 + 47_000);
    visivel = "visible"; document.dispatchEvent(new Event("visibilitychange"));
    // (os módulos dos testes anteriores continuam ouvindo o document; o desta página é o que está com o Pix na tela)
    const v = eventos().filter((e) => e.nome === "landing_voltou" && e.com_pix);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ fase: "qr", ausente_s: 47, com_pix: true });
  });

  it("todo evento landing_* leva o mesmo landing_device_id, que sobrevive à aba nova (cookie) e ao localStorage zerado", async () => {
    const ids = new Set(eventos().map((e) => e.landing_device_id));
    expect(ids.size).toBe(1);
    const id = [...ids][0] as string;
    expect(id).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(document.cookie).toContain(`landing_device_id=${id}`);
    localStorage.clear();
    sessionStorage.clear();
    await abrirPagina({ limpar: false });
    const d = document.querySelectorAll<HTMLDetailsElement>("details")[1];
    d.open = true; d.dispatchEvent(new Event("toggle"));
    expect(new Set(eventos().map((e) => e.landing_device_id))).toEqual(new Set([id]));
    expect(localStorage.getItem("landing-device-id")).toBe(id);
  });
});
