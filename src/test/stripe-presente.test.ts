/**
 * PRESENTE PELA STRIPE (15/11) — o servidor do upsell de R$ 24,90 da /oferta, com a Stripe e o banco falsos:
 *   stripe-criar: o salvar_cartao só vale na /oferta e só entra no ATUALIZAR (o criar idempotente não muda) — sem ele, nada muda;
 *   compra: só PI pago da /oferta, 6790, da MESMA ref; a conta (token) acha o PI pela linha vitalícia stripe 6790;
 *   1 toque: só com o cartão salvo (setup_future_usage); customer novo da compra + anexa + confirma com Idempotency-Key própria;
 *            2 toques = 1 cobrança; recusa → o MESMO PI aceita o Pix; 3DS → client_secret; outro customer → recusa;
 *   Pix: o MESMO QR enquanto vale; pago → o código do presente (2490) na conta da compra;
 *   webhook: presente_oferta 2490 vira o código (sem Purchase pra Meta, sem crédito pra quem pagou); sem a conta → 500.
 */
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { paramsAtualizar, paramsCriar, validarPedidoStripe, type ChamarStripe } from "../../supabase/functions/_shared/stripe-criar";
import { cartaoPresente, cartaoSalvo, compraDoDono, compraPorRef, estadoPresente, nomePresente, pixPresente, PRESENTE_STRIPE, type DepsPresente } from "../../supabase/functions/_shared/stripe-presente";
import { tratarStripe, type DepsStripe } from "../../supabase/functions/_shared/stripe";
import { compraOfertaStripe } from "../../supabase/functions/_shared/presente-dia3";

type L = Record<string, unknown>;
const REF = "7a1b2c3d-1111-4222-8333-944455556666";

function banco() {
  const db: Record<string, L[]> = { subscriptions: [], analytics_events: [], presentes: [], webhook_events: [] };
  let seq = 0;
  const from = (tabela: string) => {
    const filtros: Array<(r: L) => boolean> = [];
    let op: { tipo: string; dados?: L } = { tipo: "select" };
    let unico = false;
    const exec = async () => {
      const tb = db[tabela] ?? (db[tabela] = []);
      const casa = (r: L) => filtros.every((f) => f(r));
      if (op.tipo === "insert") {
        const d = op.dados!;
        if (tabela === "webhook_events" && tb.some((r) => r.id === d.id)) return { error: { code: "23505" } };
        if (tabela === "presentes" && tb.some((r) => r.pedido === d.pedido || r.codigo === d.codigo)) return { error: { code: "23505" } };
        tb.push({ created_at: new Date(Date.now() + ++seq).toISOString(), resgatado_por: null, de_nome: null, ...d }); return { error: null };
      }
      if (op.tipo === "update") { for (const r of tb.filter(casa)) Object.assign(r, op.dados); return { error: null }; }
      if (op.tipo === "delete") { db[tabela] = tb.filter((r) => !casa(r)); return { error: null }; }
      const a = tb.filter(casa).map((r) => ({ ...r }));
      return { data: unico ? a[0] ?? null : a, error: null };
    };
    const q: L = {
      select: () => { if (op.tipo !== "update") op = { tipo: "select" }; return q; },
      insert: (d: L) => { op = { tipo: "insert", dados: d }; return q; },
      update: (d: L) => { op = { tipo: "update", dados: d }; return q; },
      delete: () => { op = { tipo: "delete" }; return q; },
      eq: (k: string, v: unknown) => { const [c, s] = k.split("->>"); filtros.push((r) => (s ? (r[c] as L | undefined)?.[s] : r[k]) === v); return q; },
      is: (k: string, v: unknown) => { filtros.push((r) => (r[k] ?? null) === v); return q; },
      order: () => q, limit: () => q, gte: () => q,
      maybeSingle: () => { unico = true; return q; },
      then: (ok: (v: unknown) => unknown, er: (e: unknown) => unknown) => exec().then(ok, er),
    };
    return q;
  };
  return { db, admin: { from } };
}

function stripe(o: { pm?: string; sfu?: boolean; metodo?: string; customer?: string | null; pmCustomer?: string | null } = {}) {
  const pis = new Map<string, L>();
  const idem = new Map<string, L>();
  const chamadas: Array<{ caminho: string; pares: Array<[string, string]> | null; idem?: string }> = [];
  let n = 0;
  const pm = o.pm ?? "pm_ok";
  pis.set("pi_main", {
    id: "pi_main", status: "succeeded", amount: 6790, amount_received: 6790, currency: "brl", customer: o.customer ?? null,
    metadata: { pagina: "oferta", ref: REF, email: "ana@exemplo.com" },
    payment_method_options: { card: o.sfu === false ? {} : { setup_future_usage: "on_session" } },
    latest_charge: { payment_method_details: { type: o.metodo ?? "card" } },
    payment_method: { id: pm, customer: o.pmCustomer ?? null, card: { brand: "visa", last4: "4242" } },
  });
  const f: ChamarStripe = async (caminho, pares, chave) => {
    chamadas.push({ caminho, pares, idem: chave });
    if (chave && idem.has(chave)) return idem.get(chave) as { ok: boolean; j: L };
    const kv = Object.fromEntries(pares ?? []);
    const md = Object.fromEntries((pares ?? []).filter(([k]) => k.startsWith("metadata[")).map(([k, v]) => [k.slice(9, -1), v]));
    const [base] = caminho.split("?");
    const p = base.split("/");
    let r: { ok: boolean; j: L };
    if (base === "payment_intents" && pares) { const id = `pi_p${++n}`; const x = { id, client_secret: `${id}_secret`, status: "requires_payment_method", amount: Number(kv.amount), currency: kv.currency, metadata: md, customer: null }; pis.set(id, x); r = { ok: true, j: x }; }
    else if (p[0] === "payment_intents" && p.length === 2) { const x = pis.get(p[1]); if (!x) r = { ok: false, j: {} }; else { if (pares) Object.assign(x, kv); r = { ok: true, j: x }; } }
    else if (p[0] === "payment_intents" && p[2] === "confirm") {
      const x = pis.get(p[1])!;
      if (kv["payment_method_data[type]"] === "pix") { x.status = "requires_action"; x.next_action = { type: "pix_display_qr_code", pix_display_qr_code: { data: `PIX-${x.id}`, expires_at: 1763300000 } }; r = { ok: true, j: x }; }
      else if (kv.payment_method === "pm_recusa") { x.status = "requires_payment_method"; r = { ok: false, j: { error: { type: "card_error", code: "card_declined", decline_code: "insufficient_funds" } } }; }
      else if (kv.payment_method === "pm_3ds") { x.status = "requires_action"; x.next_action = { type: "use_stripe_sdk" }; r = { ok: true, j: x }; }
      else { x.status = "succeeded"; x.next_action = null; r = { ok: true, j: { ...x } }; }
    }
    else if (base === "customers" && pares) r = { ok: true, j: { id: `cus_${++n}`, metadata: md } };
    else if (p[0] === "customers") r = { ok: true, j: { id: p[1], metadata: { pi_principal: p[1] === "cus_outro" ? "pi_x" : "pi_main" } } };
    else if (p[0] === "payment_methods" && p[2] === "attach") r = { ok: true, j: { id: p[1], customer: kv.customer } };
    else r = { ok: false, j: {} };
    if (chave) idem.set(chave, r);
    return r;
  };
  return { f, pis, chamadas };
}
const deps = (b: ReturnType<typeof banco>, s: ReturnType<typeof stripe>): DepsPresente => ({ admin: b.admin, stripe: s.f, log: () => {} });

describe("stripe-criar: salvar o cartão (só com a chave)", () => {
  it("sem salvar_cartao o pedido e os parâmetros são os de hoje", () => {
    const p = validarPedidoStripe({ ref: REF, email: "a@b.com" })!;
    expect(p.salvarCartao).toBeUndefined();
    expect(paramsAtualizar({ email: "a@b.com" }, "a@b.com").some(([k]) => k.includes("setup_future_usage"))).toBe(false);
    expect(paramsCriar(REF).some(([k]) => k.includes("setup_future_usage"))).toBe(false);
  });
  it("com salvar_cartao: só na /oferta, só no atualizar, só no cartão", () => {
    expect(validarPedidoStripe({ ref: REF, salvar_cartao: true })!.salvarCartao).toBe(true);
    expect(validarPedidoStripe({ ref: REF, salvar_cartao: true, pagina: "app_web" })!.salvarCartao).toBeUndefined();
    expect(validarPedidoStripe({ ref: REF, salvar_cartao: true, pagina: "lp27" })!.salvarCartao).toBeUndefined();
    expect(paramsAtualizar({}, "a@b.com", {}, null, true)).toContainEqual(["payment_method_options[card][setup_future_usage]", "on_session"]);
  });
});

describe("a compra principal", () => {
  it("só o PI pago da /oferta, 6790, da MESMA ref", async () => {
    const b = banco(), s = stripe();
    expect(await compraPorRef(deps(b, s), REF, "pi_main")).not.toBeNull();
    expect(await compraPorRef(deps(b, s), "outra-ref-123456", "pi_main")).toBeNull();
    s.pis.get("pi_main")!.amount_received = 2790;
    expect(await compraPorRef(deps(b, s), REF, "pi_main")).toBeNull();
  });
  it("pelo token: a linha vitalícia stripe de 6790 da conta", async () => {
    const b = banco(), s = stripe();
    b.db.subscriptions.push({ user_id: "u1", abacatepay_billing_id: "pi_main", status: "active", payment_method: "stripe", billing_period: "lifetime", amount_cents: 6790 });
    expect((await compraDoDono(deps(b, s), "u1"))?.id).toBe("pi_main");
    expect(await compraDoDono(deps(b, s), "u2")).toBeNull();
    expect(compraOfertaStripe(b.db.subscriptions as never)).toBe(true);
    expect(compraOfertaStripe([{ payment_method: "pix", status: "active", billing_period: "lifetime", amount_cents: 2790 }] as never)).toBe(false);
  });
  it("cartão salvo só com setup_future_usage e cobrança no cartão", async () => {
    expect(cartaoSalvo(stripe().pis.get("pi_main")!)).toMatchObject({ pm: "pm_ok", marca: "visa", final: "4242" });
    expect(cartaoSalvo(stripe({ sfu: false }).pis.get("pi_main")!)).toBeNull();
    expect(cartaoSalvo(stripe({ metodo: "pix" }).pis.get("pi_main")!)).toBeNull();
  });
});

describe("1 toque no cartão", () => {
  it("cobra 2490 no cartão salvo, cria o código quando a conta existe, e 2 toques = 1 cobrança", async () => {
    const b = banco(), s = stripe();
    b.db.subscriptions.push({ user_id: "u1", abacatepay_billing_id: "pi_main", payment_method: "stripe" });
    const c = (await compraPorRef(deps(b, s), REF, "pi_main"))!;
    const r = await cartaoPresente(deps(b, s), c);
    expect(r.corpo).toMatchObject({ ok: true, pago: true, preco: 2490 });
    expect(typeof r.corpo.codigo).toBe("string");
    const criar = s.chamadas.find((x) => x.caminho === "payment_intents" && x.pares)!;
    expect(criar.pares).toContainEqual(["amount", "2490"]);
    expect(criar.pares).toContainEqual(["metadata[pagina]", "presente_oferta"]);
    expect(criar.idem).toBe("presente-oferta-pi_main");
    expect(s.chamadas.some((x) => /payment_methods\/pm_ok\/attach/.test(x.caminho))).toBe(true);
    const r2 = await cartaoPresente(deps(b, s), c);
    expect(r2.corpo).toMatchObject({ ok: true, pago: true, codigo: r.corpo.codigo });
    expect(s.chamadas.filter((x) => /\/confirm$/.test(x.caminho))).toHaveLength(1);
    expect(b.db.presentes).toHaveLength(1);
    expect(b.db.presentes[0]).toMatchObject({ comprador_id: "u1", valor_centavos: 2490 });
  });
  it("sem cartão salvo → sem_cartao (a tela oferece o Pix)", async () => {
    const b = banco(), s = stripe({ sfu: false });
    const c = (await compraPorRef(deps(b, s), REF, "pi_main"))!;
    expect((await cartaoPresente(deps(b, s), c)).corpo).toMatchObject({ ok: false, motivo: "sem_cartao" });
    expect(s.chamadas.some((x) => x.caminho === "payment_intents" && x.pares)).toBe(false);
  });
  it("recusado → mensagem; o MESMO PI depois gera o Pix", async () => {
    const b = banco(), s = stripe({ pm: "pm_recusa" });
    const c = (await compraPorRef(deps(b, s), REF, "pi_main"))!;
    const r = await cartaoPresente(deps(b, s), c);
    expect(r.corpo).toMatchObject({ ok: false, recusado: true, code: "insufficient_funds" });
    const p = await pixPresente(deps(b, s), c);
    expect(p.corpo).toMatchObject({ ok: true, pago: false });
    expect((p.corpo.pix as L).orderId).toBe(r.corpo.pedido);
  });
  it("3DS → client_secret pra página terminar", async () => {
    const b = banco(), s = stripe({ pm: "pm_3ds" });
    const c = (await compraPorRef(deps(b, s), REF, "pi_main"))!;
    expect((await cartaoPresente(deps(b, s), c)).corpo).toMatchObject({ ok: true, acao: true });
  });
  it("cartão de OUTRO customer → recusa sem cobrar", async () => {
    const b = banco(), s = stripe({ pmCustomer: "cus_outro" });
    const c = (await compraPorRef(deps(b, s), REF, "pi_main"))!;
    expect((await cartaoPresente(deps(b, s), c)).corpo).toMatchObject({ ok: false, motivo: "outro_cliente" });
    expect(s.chamadas.some((x) => /\/confirm$/.test(x.caminho))).toBe(false);
  });
});

describe("Pix e estado", () => {
  it("o MESMO QR enquanto vale; estado sem criar nada; nome no cartão", async () => {
    const b = banco(), s = stripe({ metodo: "pix", sfu: false });
    const c = (await compraPorRef(deps(b, s), REF, "pi_main"))!;
    expect((await estadoPresente(deps(b, s), c)).corpo).toMatchObject({ ok: true, pago: false, cartao: null, pix: null });
    expect(s.chamadas.some((x) => x.caminho === "payment_intents" && x.pares)).toBe(false);
    const a = await pixPresente(deps(b, s), c);
    const bb = await pixPresente(deps(b, s), c);
    expect((bb.corpo.pix as L).qrCode).toBe((a.corpo.pix as L).qrCode);
    expect(bb.corpo.mesmo).toBe(true);
    // pagou: sem a conta da compra ainda → pago sem código; com ela → código
    s.pis.get(String((a.corpo.pix as L).orderId))!.status = "succeeded";
    expect((await estadoPresente(deps(b, s), c)).corpo).toMatchObject({ pago: true, codigo: null });
    b.db.subscriptions.push({ user_id: "u1", abacatepay_billing_id: "pi_main", payment_method: "stripe" });
    const e = await estadoPresente(deps(b, s), c);
    expect(typeof e.corpo.codigo).toBe("string");
    expect((await nomePresente(deps(b, s), c, e.corpo.pedido, "Ana <b>")).corpo).toMatchObject({ ok: true, de: "Ana b" });
  });
});

describe("webhook: presente_oferta", () => {
  const WH = "whsec_t";
  const assinar = (corpo: string, t: number) => `t=${t},v1=${createHmac("sha256", WH).update(`${t}.${corpo}`).digest("hex")}`;
  const evento = (amount: number) => JSON.stringify({ id: `evt_${amount}`, type: "payment_intent.succeeded", livemode: true, data: { object: { id: "pi_p9", amount, amount_received: amount, currency: "brl", status: "succeeded", metadata: { pagina: "presente_oferta", pi_principal: "pi_main", email: "ana@exemplo.com" } } } });
  const depsWh = (b: ReturnType<typeof banco>, extra: Partial<DepsStripe> = {}): DepsStripe => ({
    admin: b.admin as never, secret: WH, acharConta: async () => null, enviarEmail: async () => true, mandarCapi: async () => { throw new Error("sem Purchase no presente"); },
    avisarVenda: async () => {}, avisarDono: async () => {}, buscarCobranca: async () => ({ metodo: "card", parcelas: 1 }), log: () => {}, ...extra,
  });
  it("2490 → código na conta da compra, sem Purchase e sem linha nova em subscriptions", async () => {
    const b = banco();
    b.db.subscriptions.push({ user_id: "u1", abacatepay_billing_id: "pi_main", payment_method: "stripe" });
    const corpo = evento(2490), t = Math.floor(Date.now() / 1000);
    const r = await tratarStripe(depsWh(b), { corpo, assinatura: assinar(corpo, t) });
    expect(r.corpo).toMatchObject({ ok: true, presente: true });
    expect(b.db.presentes[0]).toMatchObject({ pedido: "pi_p9", comprador_id: "u1", valor_centavos: 2490 });
    expect(b.db.subscriptions).toHaveLength(1);
    expect(b.db.analytics_events.some((e) => e.event_name === "stripe_presente_venda")).toBe(true);
  });
  it("sem a conta da compra → 500 (a Stripe reenvia); valor errado → ignorado", async () => {
    const b = banco();
    const c1 = evento(2490), t = Math.floor(Date.now() / 1000);
    expect((await tratarStripe(depsWh(b), { corpo: c1, assinatura: assinar(c1, t) })).status).toBe(500);
    const c2 = evento(1490);
    expect((await tratarStripe(depsWh(b), { corpo: c2, assinatura: assinar(c2, t) })).corpo).toMatchObject({ ignorado: "valor_presente" });
  });
  it("o preço é do servidor", () => { expect(PRESENTE_STRIPE.centavos).toBe(2490); });
});
