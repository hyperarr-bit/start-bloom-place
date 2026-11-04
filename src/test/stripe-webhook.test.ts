/**
 * STRIPE (04/11, /oferta) — supabase/functions/_shared/stripe.ts e stripe-criar.ts com um banco falso:
 * assinatura errada/sem secret → 401; payment_intent.succeeded → libera 1× + 1 Purchase (event_id = PI, valor real) + stripe_venda
 * (pix|card, parcelas) + e-mail + aviso; repetido não duplica; outro valor/página → ignorado + alarme 1×; estorno/chargeback
 * desliga só a linha; pago depois do estorno não libera; Pix tardio (webhook depois) libera; e-mail que falha → 500 até 5×.
 * stripe-criar: valor SEMPRE do servidor, Pix + cartão + parcelas, limite por IP; stripe-status não vaza; /vendas com Stripe.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";
import { assinaturaOk, tratarStripe, STRIPE_PRECO_CENTAVOS, type DepsStripe } from "../../supabase/functions/_shared/stripe";
import { ipPodeCriar, metadataDoPedido, paramsAtualizar, paramsCriar, respostaStatus, validarPedidoStripe, LIMITE_POR_IP } from "../../supabase/functions/_shared/stripe-criar";
import { tituloVenda, vendaPix } from "../../supabase/functions/_shared/aviso-venda";
import { funilOferta, resumoDoDia, taxaSiteCents, vendasDoDia } from "../../supabase/functions/_shared/vendas-painel";

const WHSEC = "whsec_teste123";
type Linha = Record<string, unknown>;
const AGORA = new Date("2026-11-04T15:00:00Z");

function bancoFalso() {
  const db = { subscriptions: [] as Linha[], webhook_events: new Map<string, string>(), analytics_events: [] as Linha[], users: new Map<string, { id: string; email: string | null }>() };
  let seq = 0;
  const from = (tabela: string) => {
    const filtros: Array<(r: Linha) => boolean> = [];
    let op: { tipo: "select" | "insert" | "update" | "delete"; dados?: Linha } = { tipo: "select" };
    let unico = false, contar = false;
    const exec = async () => {
      await new Promise((r) => setTimeout(r, 0));
      const casa = (r: Linha) => filtros.every((f) => f(r));
      if (tabela === "webhook_events") {
        if (op.tipo === "insert") { const id = String(op.dados!.id); if (db.webhook_events.has(id)) return { error: { code: "23505", message: "duplicate" } }; db.webhook_events.set(id, new Date().toISOString()); return { error: null }; }
        const linhas = [...db.webhook_events.entries()].map(([id, processed_at]) => ({ id, processed_at }));
        if (op.tipo === "delete") { for (const l of linhas.filter(casa)) db.webhook_events.delete(l.id); return { error: null }; }
        const a = linhas.filter(casa); return { data: unico ? a[0] ?? null : a, error: null };
      }
      const tb = tabela === "subscriptions" ? db.subscriptions : db.analytics_events;
      if (contar) return { count: tb.filter(casa).length, error: null };
      if (op.tipo === "insert") { tb.push({ id: `l${++seq}`, created_at: new Date().toISOString(), ...op.dados }); return { error: null }; }
      if (op.tipo === "update") { for (const r of tb.filter(casa)) Object.assign(r, op.dados); return { error: null }; }
      const a = tb.filter(casa).map((r) => ({ ...r })); return { data: unico ? a[0] ?? null : a, error: null };
    };
    const q: Record<string, unknown> = {
      select: (_c?: string, o?: { head?: boolean }) => { if (op.tipo !== "update") op = { tipo: "select" }; if (o?.head) contar = true; return q; },
      insert: (d: Linha) => { op = { tipo: "insert", dados: d }; return q; },
      update: (d: Linha) => { op = { tipo: "update", dados: d }; return q; },
      delete: () => { op = { tipo: "delete" }; return q; },
      eq: (k: string, v: unknown) => { const [col, sub] = k.split("->>"); filtros.push((r) => (sub ? String((r[col] as Linha | undefined)?.[sub] ?? "") : r[k]) === v); return q; },
      gte: (k: string, v: string) => { filtros.push((r) => String(r[k] ?? "") >= v); return q; },
      limit: () => q,
      maybeSingle: () => { unico = true; return q; },
      then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => exec().then(ok, erro),
    };
    return q;
  };
  const auth = { admin: {
    getUserById: async (id: string) => ({ data: { user: db.users.get(id) ?? null }, error: null }),
    updateUserById: async (id: string, a: Linha) => { const e = String(a.email ?? ""); if ([...db.users.values()].some((u) => u.email === e && u.id !== id)) return { data: null, error: { message: "already registered" } }; const u = db.users.get(id)!; u.email = e; return { data: { user: u }, error: null }; },
    createUser: async (a: Linha) => { const id = `u_novo${++seq}`; const u = { id, email: String(a.email) }; db.users.set(id, u); return { data: { user: u }, error: null }; },
  } };
  return { db, admin: { from, auth } };
}

function montar() {
  const b = bancoFalso();
  const saida = { emails: [] as Array<{ para: string; html: string }>, capi: [] as Linha[], avisos: [] as string[], push: [] as Array<{ titulo: string }>, logs: [] as string[] };
  let falharEmail = false;
  const deps: DepsStripe = {
    admin: b.admin as never, secret: WHSEC,
    acharConta: async (e) => [...b.db.users.values()].find((u) => u.email === e.toLowerCase())?.id ?? null,
    enviarEmail: async (para, _a, html) => { if (falharEmail) return false; saida.emails.push({ para, html }); return true; },
    mandarCapi: async (c) => { saida.capi.push(c); return true; },
    avisarVenda: async (id) => { saida.avisos.push(id); },
    avisarDono: async (titulo) => { saida.push.push({ titulo }); },
    buscarCobranca: async () => ({ metodo: "card", parcelas: 3 }),
    log: (p, d) => { saida.logs.push(`${p} ${JSON.stringify(d ?? {})}`); },
    agora: () => AGORA,
  };
  return { ...b, deps, saida, falhar: (v: boolean) => { falharEmail = v; } };
}
const assinar = (corpo: string, t = Math.floor(AGORA.getTime() / 1000), segredo = WHSEC) => `t=${t},v1=${createHmac("sha256", segredo).update(`${t}.${corpo}`).digest("hex")}`;
let nEvt = 0;
const evento = (type: string, object: Linha, id = `evt_${++nEvt}`) => JSON.stringify({ id, type, data: { object } });
const pi = (o: Partial<Linha> & { metadata?: Linha } = {}) => ({
  id: "pi_3Abc", object: "payment_intent", amount: 6790, amount_received: 6790, currency: "brl", status: "succeeded", livemode: true, latest_charge: "ch_1",
  ...o, metadata: { ref: "0f8a5c2e-1111-4222-8333-944455556666", pagina: "oferta", email: "maria@exemplo.com", fbp: "fb.1.1.abc", fbclid: "IwAR_x", ip: "200.1.2.3", ua: "Mozilla/5.0 iPhone", url: "https://www.coreaplicativo.com.br/oferta?utm_content=c7", criado_em: "2026-11-04T14:58:00.000Z", ...(o.metadata ?? {}) },
});
const mandar = (m: ReturnType<typeof montar>, corpo: string, assinatura = assinar(corpo)) => tratarStripe(m.deps, { assinatura, corpo });

describe("assinatura", () => {
  it("errada, de outro segredo, velha (> 5 min), ausente ou sem secret → 401 e nada acontece", async () => {
    const m = montar();
    const c = evento("payment_intent.succeeded", pi());
    expect((await mandar(m, c, "t=1,v1=abc")).status).toBe(401);
    expect((await mandar(m, c, assinar(c, undefined, "whsec_outro"))).status).toBe(401);
    expect((await mandar(m, c, assinar(c, Math.floor(AGORA.getTime() / 1000) - 400))).status).toBe(401);
    expect((await tratarStripe({ ...m.deps, secret: null }, { assinatura: assinar(c), corpo: c })).status).toBe(401);
    expect((await mandar(m, `${c} `, assinar(c))).status).toBe(401); // corpo mexido
    expect(m.db.subscriptions).toHaveLength(0);
    expect(m.db.webhook_events.size).toBe(0);
    expect(await assinaturaOk(c, `${assinar(c)},v1=lixo`, WHSEC, Math.floor(AGORA.getTime() / 1000))).toBe(true); // vários v1 (rotação do segredo)
  });
});

describe("payment_intent.succeeded", () => {
  it("libera o VITALÍCIO (linha stripe, valor real, PI no pedido) + 1 e-mail + 1 Purchase (event_id = PI) + stripe_venda (card, 3x) + aviso", async () => {
    const m = montar();
    m.db.users.set("u_anon", { id: "u_anon", email: null });
    const r = await mandar(m, evento("payment_intent.succeeded", pi({ metadata: { user_id: "u_anon" } })));
    expect(r).toMatchObject({ status: 200, corpo: { liberado: true, novo: true, via: "ref_batizada" } });
    expect(m.db.subscriptions).toHaveLength(1);
    expect(m.db.subscriptions[0]).toMatchObject({ user_id: "u_anon", status: "active", plan: "lifetime", billing_period: "lifetime", payment_method: "stripe", abacatepay_billing_id: "pi_3Abc", amount_cents: 6790, customer_email: "maria@exemplo.com" });
    expect(m.db.users.get("u_anon")!.email).toBe("maria@exemplo.com");
    expect(m.saida.emails).toHaveLength(1);
    expect(m.saida.capi).toHaveLength(1);
    const ev = (m.saida.capi[0].data as Linha[])[0] as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(ev).toMatchObject({ event_name: "Purchase", event_id: "pi_3Abc", event_source_url: "https://www.coreaplicativo.com.br/oferta?utm_content=c7" });
    expect(ev.custom_data).toMatchObject({ value: 67.9, currency: "BRL", content_name: "CORE vitalício (Stripe)" });
    expect(ev.user_data).toMatchObject({ fbp: "fb.1.1.abc", client_ip_address: "200.1.2.3", client_user_agent: "Mozilla/5.0 iPhone" });
    expect(ev.user_data.fbc).toBe(`fb.1.${Date.parse("2026-11-04T14:58:00.000Z")}.IwAR_x`);
    const v = m.db.analytics_events.filter((e) => e.event_name === "stripe_venda");
    expect(v).toHaveLength(1);
    expect(v[0].event_data).toMatchObject({ pi: "pi_3Abc", valor_cents: 6790, metodo: "card", parcelas: 3, pagina: "oferta" });
    expect(m.saida.avisos).toHaveLength(1);
    expect(m.saida.logs.join("\n")).not.toContain("maria@exemplo.com");
  });

  it("repetido (mesmo evento) e reenvio com outro id de evento → nada em dobro", async () => {
    const m = montar();
    const c = evento("payment_intent.succeeded", pi(), "evt_fixo");
    await mandar(m, c);
    expect((await mandar(m, c)).corpo).toMatchObject({ duplicado: true });
    await mandar(m, evento("payment_intent.succeeded", pi()));
    expect(m.db.subscriptions).toHaveLength(1);
    expect(m.saida.emails).toHaveLength(1);
    expect(m.saida.capi).toHaveLength(1);
    expect(m.saida.avisos).toHaveLength(1);
    expect(m.db.analytics_events.filter((e) => e.event_name === "stripe_venda")).toHaveLength(1);
  });

  for (const [motivo, o] of [["valor", { amount: 2790, amount_received: 2790 }], ["valor", { currency: "usd" }], ["outra_pagina", { metadata: { pagina: "vida" } }], ["status", { status: "processing" }]] as const) {
    it(`ignorado (${motivo}: ${JSON.stringify(o)}) → não libera + stripe_venda_ignorada + push "Venda Stripe IGNORADA" 1× por PI`, async () => {
      const m = montar();
      await mandar(m, evento("payment_intent.succeeded", pi(o as Partial<Linha>)));
      await mandar(m, evento("payment_intent.succeeded", pi(o as Partial<Linha>)));
      expect(m.db.subscriptions).toHaveLength(0);
      expect(m.saida.capi).toHaveLength(0);
      const al = m.db.analytics_events.filter((e) => e.event_name === "stripe_venda_ignorada");
      expect(al).toHaveLength(1);
      expect(al[0].event_data).toMatchObject({ motivo, pi: "pi_3Abc", email: "ma***@exemplo.com" });
      expect(m.saida.push).toEqual([{ titulo: `⚠️ Venda Stripe IGNORADA: ${motivo}` }]);
    });
  }

  it("Pix tardio: o webhook chega depois (página fechada) e libera igual, pelo e-mail (sem sessão)", async () => {
    const m = montar();
    m.db.users.set("u_maria", { id: "u_maria", email: "maria@exemplo.com" });
    m.deps.buscarCobranca = async () => ({ metodo: "pix", parcelas: null });
    const r = await mandar(m, evento("payment_intent.succeeded", pi({ id: "pi_pix9" })));
    expect(r.corpo).toMatchObject({ novo: true, via: "email" });
    expect(m.db.subscriptions[0]).toMatchObject({ user_id: "u_maria", abacatepay_billing_id: "pi_pix9" });
    expect(m.db.analytics_events.find((e) => e.event_name === "stripe_venda")!.event_data).toMatchObject({ metodo: "pix", parcelas: null });
  });

  it("sessão de OUTRA conta (outro e-mail) → a compra vai pro e-mail do comprador + stripe_conta_divergente 1×", async () => {
    const m = montar();
    m.db.users.set("u_logada", { id: "u_logada", email: "joao@outro.com" });
    const r = await mandar(m, evento("payment_intent.succeeded", pi({ metadata: { user_id: "u_logada" } })));
    expect(r.corpo).toMatchObject({ via: "nova" });
    expect(m.db.subscriptions[0].user_id).not.toBe("u_logada");
    await mandar(m, evento("payment_intent.succeeded", pi({ metadata: { user_id: "u_logada" } })));
    expect(m.db.analytics_events.filter((e) => e.event_name === "stripe_conta_divergente")).toHaveLength(1);
  });

  it("quem já tem o Pix ANUAL ganha uma linha nova (a do Pix fica intacta)", async () => {
    const m = montar();
    m.db.users.set("u_maria", { id: "u_maria", email: "maria@exemplo.com" });
    m.db.subscriptions.push({ id: "anual", user_id: "u_maria", status: "active", plan: "core-pro", billing_period: "annual", payment_method: "pix", abacatepay_billing_id: "qr_anual", amount_cents: 2790, current_period_end: "2027-10-30T00:00:00Z" });
    await mandar(m, evento("payment_intent.succeeded", pi()));
    expect(m.db.subscriptions).toHaveLength(2);
    expect(m.db.subscriptions.find((x) => x.id === "anual")).toMatchObject({ payment_method: "pix", status: "active" });
  });

  it("e-mail que falha → 500 (a Stripe reenvia) sem 2º crédito/Purchase; 5ª falha → 200 + stripe_email_falhou + push 1×", async () => {
    const m = montar();
    m.falhar(true);
    const c = evento("payment_intent.succeeded", pi(), "evt_email");
    const st: number[] = [];
    for (let i = 0; i < 6; i++) st.push((await mandar(m, c)).status);
    expect(st).toEqual([500, 500, 500, 500, 200, 200]);
    expect(m.db.subscriptions).toHaveLength(1);
    expect(m.saida.capi).toHaveLength(1);
    expect(m.db.analytics_events.filter((e) => e.event_name === "stripe_email_falhou")).toHaveLength(1);
    expect(m.saida.push.filter((p) => p.titulo.includes("e-mail da compra NÃO saiu"))).toHaveLength(1);
    const m2 = montar();
    m2.falhar(true);
    const c2 = evento("payment_intent.succeeded", pi(), "evt_email2");
    expect((await mandar(m2, c2)).status).toBe(500);
    m2.falhar(false);
    expect((await mandar(m2, c2)).status).toBe(200);
    expect(m2.saida.emails).toHaveLength(1);
    expect(m2.saida.capi).toHaveLength(1);
  });
});

describe("estorno / chargeback", () => {
  it("charge.refunded (total) desliga só a linha do PI; parcial não desliga", async () => {
    const m = montar();
    await mandar(m, evento("payment_intent.succeeded", pi()));
    m.db.subscriptions.push({ id: "outra", user_id: "x", status: "active", payment_method: "pix", abacatepay_billing_id: "qr_1" });
    expect((await mandar(m, evento("charge.refunded", { id: "ch_1", payment_intent: "pi_3Abc", refunded: false, amount_refunded: 1000 }))).corpo).toMatchObject({ ignorado: "parcial" });
    expect(m.db.subscriptions[0].status).toBe("active");
    expect((await mandar(m, evento("charge.refunded", { id: "ch_1", payment_intent: "pi_3Abc", refunded: true }))).corpo).toMatchObject({ desligado: true });
    expect(m.db.subscriptions.find((x) => x.abacatepay_billing_id === "pi_3Abc")!.status).toBe("canceled");
    expect(m.db.subscriptions.find((x) => x.id === "outra")!.status).toBe("active");
  });
  it("charge.dispute.created desliga; fora de ordem: estorno ANTES do succeeded → o succeeded não libera (alarme 'estornada')", async () => {
    const m = montar();
    await mandar(m, evento("charge.dispute.created", { id: "dp_1", payment_intent: "pi_3Abc", charge: "ch_1" }));
    const r = await mandar(m, evento("payment_intent.succeeded", pi()));
    expect(r.corpo).toMatchObject({ ignorado: "estornada" });
    expect(m.db.subscriptions).toHaveLength(0);
    expect(m.saida.capi).toHaveLength(0);
  });
  it("outros eventos → 200 e nada", async () => {
    const m = montar();
    expect((await mandar(m, evento("payment_intent.created", pi({ status: "requires_payment_method" })))).corpo).toMatchObject({ ignorado: "evento" });
    expect(m.db.webhook_events.size).toBe(0);
  });
});

describe("stripe-criar / stripe-status", () => {
  const REF = "0f8a5c2e-1111-4222-8333-944455556666";
  it("o valor é SEMPRE o do servidor (6790 BRL): o corpo da página com 'amount'/'valor' não muda nada; Pix + cartão + parcelas; Pix 30 min", () => {
    const p = validarPedidoStripe({ ref: REF, amount: 1, valor: 1, preco_centavos: 1, email: "Maria@Exemplo.com", url: "https://evil.com/x", atrib: { utm_content: "c7", lixo: "z" } })!;
    expect(p).not.toHaveProperty("amount");
    expect(p.url).toBeNull();
    expect(p.email).toBe("maria@exemplo.com");
    const md = metadataDoPedido(p, { userId: "u1", ip: "1.2.3.4", ua: "UA", agoraIso: "2026-11-04T15:00:00Z" });
    expect(md).toMatchObject({ ref: REF, pagina: "oferta", email: "maria@exemplo.com", user_id: "u1", ip: "1.2.3.4", ua: "UA", utm_content: "c7" });
    expect(md).not.toHaveProperty("lixo");
    const pares = paramsCriar(md, p.email);
    expect(pares).toContainEqual(["amount", String(STRIPE_PRECO_CENTAVOS)]);
    expect(pares.filter(([k]) => k === "amount")).toHaveLength(1);
    expect(pares).toContainEqual(["currency", "brl"]);
    expect(pares.filter(([k]) => k === "payment_method_types[]").map(([, v]) => v)).toEqual(["card", "pix"]);
    expect(pares).toContainEqual(["payment_method_options[card][installments][enabled]", "true"]);
    expect(pares).toContainEqual(["payment_method_options[pix][expires_after_seconds]", "1800"]);
    expect(paramsAtualizar(md, "maria@exemplo.com").some(([k]) => k === "amount")).toBe(false);
    expect(validarPedidoStripe({ ref: "x" })).toBeNull();
    expect(validarPedidoStripe({ ref: REF, pi: "nao_e_pi" })!.pi).toBeNull();
    const fn = readFileSync(resolve(__dirname, "../../supabase/functions/stripe-criar/index.ts"), "utf8");
    expect(fn).toContain('"Idempotency-Key"');
    expect(fn).toContain("`oferta-${p.ref}`");
  });
  it(`limite de ${LIMITE_POR_IP} PaymentIntents por IP em 10 min`, async () => {
    const m = montar();
    const agora = AGORA.getTime();
    for (let i = 0; i < LIMITE_POR_IP; i++) m.db.analytics_events.push({ event_name: "stripe_order_created", created_at: new Date(agora - 60_000).toISOString(), event_data: { client_ip: "9.9.9.9" } });
    expect(await ipPodeCriar(m.admin as never, "9.9.9.9", agora)).toBe(false);
    expect(await ipPodeCriar(m.admin as never, "8.8.8.8", agora)).toBe(true);
  });
  it("stripe-status: só responde o PI daquela ref, e só status/pago/método", () => {
    const piObj = { metadata: { ref: REF, pagina: "oferta", email: "maria@exemplo.com" }, status: "succeeded", latest_charge: { payment_method_details: { type: "pix" } }, amount: 6790, customer: "cus_1" };
    const r = respostaStatus(piObj, REF);
    expect(r).toEqual({ ok: true, status: "succeeded", pago: true, metodo: "pix" });
    expect(respostaStatus(piObj, "outra-ref-123456")).toEqual({ ok: false });
    expect(respostaStatus({ ...piObj, metadata: { ref: REF, pagina: "vida" } }, REF)).toEqual({ ok: false });
  });
});

describe("/vendas com a Stripe", () => {
  const linha = { id: "s1", status: "active", payment_method: "stripe", amount_cents: 6790, abacatepay_billing_id: "pi_1", billing_period: "lifetime", plan: "lifetime", current_period_start: "2026-11-04T15:00:00Z", current_period_end: "2126-11-04T15:00:00Z", created_at: "2026-11-04T15:00:00Z", customer_email: "maria@exemplo.com" };
  it("venda do site (gateway stripe), título 'Stripe do site'", () => {
    const v = vendaPix(linha)!;
    expect(v).toMatchObject({ origem: "pix", gateway: "stripe", valor_cents: 6790 });
    expect(tituloVenda(v)).toBe("💰 Venda · R$ 67,90 · Stripe do site (vitalício)");
  });
  it("taxas (conferir): cartão 3,99% + R$ 0,39; Pix 1,19%; sem método = cartão", () => {
    expect(taxaSiteCents({ valor_cents: 6790, gateway: "stripe", metodo: "card" })).toBe(310);
    expect(taxaSiteCents({ valor_cents: 6790, gateway: "stripe", metodo: "pix" })).toBe(81);
    expect(taxaSiteCents({ valor_cents: 6790, gateway: "stripe" })).toBe(310);
    const vd = vendasDoDia([linha, { ...linha, id: "s2", abacatepay_billing_id: "pi_2" }], [], new Map(), [], "2026-11-04", new Map([["pi_2", "pix" as const]]));
    expect(vd.itens.map((i) => i.metodo).sort()).toEqual(["pix", undefined].sort());
    const r = resumoDoDia(vd, "2026-11-04", 0, { testes: 0, pagaram: 0, situacao: "aberta", liquido: 0, gasto: 0 });
    expect(r.site.liquido).toBe(Math.round(((6790 - 310) + (6790 - 81))) / 100);
  });
  it("funil /oferta: visitas, abriram o checkout, pagaram (só PI ativo), R$ por visita, Pix × cartão", () => {
    const ev = [
      { event_name: "landing_html", sid: "a", pagina: "oferta" }, { event_name: "landing_stripe_aberto", sid: "a", pagina: "oferta" },
      { event_name: "landing_html", sid: "b", pagina: "oferta" }, { event_name: "landing_html", sid: "o" }, { event_name: "landing_html", sid: "v", pagina: "vida" },
    ];
    const f = funilOferta(ev, [{ pi: "pi_1", valor_cents: "6790", metodo: "pix" }, { pi: "pi_1", valor_cents: 6790, metodo: "pix" }, { pi: "pi_forjado", valor_cents: 6790, metodo: "card" }], new Set(["pi_1"]));
    expect(f).toEqual({ visitas: 2, abriramCheckout: 1, pagaram: 1, receita: 67.9, porVisita: 33.95, pix: 1, cartao: 0 });
  });
  it("migração nova: cópia da 20261105 + os eventos stripe_* nas 2 policies", () => {
    const m = (f: string) => readFileSync(resolve(__dirname, "../../supabase/migrations", f), "utf8");
    const novo = m("20261106120000_stripe_oferta_servidor.sql");
    expect(novo.match(/'stripe_order_created', 'stripe_venda', 'stripe_venda_ignorada', 'stripe_email_falhou', 'stripe_conta_divergente'/g)).toHaveLength(2);
    expect(novo.split("\n").filter((l) => /CREATE INDEX/i.test(l) && !l.trim().startsWith("--"))).toHaveLength(0);
  });
});
