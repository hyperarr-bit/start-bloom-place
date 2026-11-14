/**
 * FUNIL APP WEB (14/11, /funil-app) — o servidor, com a Stripe e o banco falsos:
 *   tabela de ofertas: a /oferta segue IGUAL (6790, "oferta-<ref>", content_name de sempre); app_web = 9790, "appweb-<ref>";
 *   Pix: gera 1× por ref (a 2ª chamada devolve o MESMO QR, sem confirmar de novo);
 *   cartão: mata o Pix vivo ANTES (trava contra pagar 2×), parcela 1x–3x pelo available_plans, recusa → recusado;
 *   mensal: preço da env conferido (3490 BRL/mês), Customer + Subscription + confirma a 1ª fatura; recusado → a MESMA
 *           assinatura com o cartão novo; sem env → 503;
 *   webhook: vitalício app_web libera a 9790 (6790 não), PI de fatura não alarma, invoice.paid grava/renova a linha mensal,
 *            payment_failed → past_due, cancelar no fim → cancel_scheduled, deleted → canceled.
 */
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { tratarStripe, type DepsStripe } from "../../supabase/functions/_shared/stripe";
import { criarOuReaproveitar, metadataDoPedido, paramsCriar, respostaStatus, validarPedidoStripe, type ChamarStripe } from "../../supabase/functions/_shared/stripe-criar";
import { assinarAppWeb, cartaoAppWeb, pixAppWeb, validarAcaoAppWeb, type DepsAppWeb } from "../../supabase/functions/_shared/stripe-app-web";
import { OFERTAS_STRIPE, precoMensalConfere } from "../../supabase/functions/_shared/stripe-ofertas";

type Linha = Record<string, unknown>;
const WHSEC = "whsec_teste123";
const AGORA = new Date("2026-11-14T15:00:00Z");
const REF = "7a1b2c3d-1111-4222-8333-944455556666";
const PRECO = "price_mensal34";

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
        if (op.tipo === "insert") { const id = String(op.dados!.id); if (db.webhook_events.has(id)) return { error: { code: "23505", message: "duplicate" } }; db.webhook_events.set(id, "x"); return { error: null }; }
        const linhas = [...db.webhook_events.keys()].map((id) => ({ id }));
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

/** a Stripe falsa: PIs, assinaturas, clientes. pm_recusa = recusado; pm_semparc = não parcela; pm_3ds = pede autenticação */
function stripeFalsa() {
  const pis = new Map<string, Linha>();
  const subs = new Map<string, Linha>();
  const idems = new Map<string, string>();
  const chamadas: Array<{ caminho: string; pares: Array<[string, string]> | null; idem?: string; versao?: string }> = [];
  const ctl = { preco: { id: PRECO, unit_amount: 3490, currency: "brl", recurring: { interval: "month", interval_count: 1 }, active: true } as Linha, cancelarFalha: false, pagarPixAoCancelar: false };
  let n = 0;
  const pixNa = (id: string) => ({ type: "pix_display_qr_code", pix_display_qr_code: { data: `00020126PIX-${id}`, image_url_png: `https://qr/${id}.png`, expires_at: 1763134200 } });
  const novoPi = (dados: Linha) => { const id = `pi_${++n}`; const p = { id, client_secret: `${id}_secret_x`, status: "requires_payment_method", metadata: {}, payment_method: null, next_action: null, ...dados }; pis.set(id, p); return p; };
  const f: ChamarStripe = async (caminho, pares, idem, versao) => {
    chamadas.push({ caminho, pares, idem, versao });
    const kv = Object.fromEntries(pares ?? []);
    const md = Object.fromEntries((pares ?? []).filter(([k]) => k.startsWith("metadata[")).map(([k, v]) => [k.slice(9, -1), v]));
    const [base] = caminho.split("?");
    const partes = base.split("/");
    if (base === "payment_intents" && pares) {
      if (idem && idems.has(idem)) return { ok: true, j: pis.get(idems.get(idem)!)! };
      const p = novoPi({ amount: Number(kv.amount), currency: kv.currency, metadata: md, description: kv.description });
      if (idem) idems.set(idem, String(p.id));
      return { ok: true, j: p };
    }
    if (partes[0] === "payment_intents" && partes.length === 2) {
      const p = pis.get(partes[1]); if (!p) return { ok: false, j: { error: { code: "resource_missing" } } };
      if (!pares) return { ok: true, j: p };
      if (kv.payment_method) {
        p.payment_method = kv.payment_method;
        const planos = kv.payment_method === "pm_semparc" ? [] : [1, 2, 3, 6, 12].filter((x) => x > 1).map((count) => ({ count, interval: "month", type: "fixed_count" }));
        p.payment_method_options = { card: { installments: { enabled: true, available_plans: planos, plan: null } } };
      }
      if (kv.receipt_email) p.receipt_email = kv.receipt_email;
      p.metadata = { ...(p.metadata as Linha), ...md };
      return { ok: true, j: p };
    }
    if (partes[0] === "payment_intents" && partes[2] === "cancel") {
      const p = pis.get(partes[1])!;
      if (ctl.pagarPixAoCancelar) { p.status = "succeeded"; p.next_action = null; return { ok: false, j: { error: { code: "payment_intent_unexpected_state" } } }; }
      if (ctl.cancelarFalha) return { ok: false, j: { error: { code: "x" } } };
      p.status = "canceled"; p.next_action = null; return { ok: true, j: p };
    }
    if (partes[0] === "payment_intents" && partes[2] === "confirm") {
      const p = pis.get(partes[1])!;
      if (kv["payment_method_data[type]"] === "pix") { p.status = "requires_action"; p.next_action = pixNa(String(p.id)); return { ok: true, j: p }; }
      const pm = kv.payment_method ?? String(p.payment_method ?? "");
      p.payment_method = pm;
      p.plano = kv["payment_method_options[card][installments][plan][count]"] ?? null;
      if (pm === "pm_recusa") { p.status = "requires_payment_method"; return { ok: false, j: { error: { type: "card_error", code: "card_declined", decline_code: "generic_decline", payment_intent: { id: p.id } } } }; }
      if (pm === "pm_3ds") { p.status = "requires_action"; p.next_action = { type: "use_stripe_sdk" }; return { ok: true, j: p }; }
      p.status = "succeeded"; p.next_action = null;
      const sub = [...subs.values()].find((s) => (s.latest_invoice as Linha).payment_intent === p.id);
      if (sub) sub.status = "active";
      return { ok: true, j: p };
    }
    if (partes[0] === "prices") return { ok: partes[1] === ctl.preco.id, j: ctl.preco };
    if (base === "customers" && pares) return { ok: true, j: { id: `cus_${++n}`, email: kv.email } };
    if (partes[0] === "customers" || partes[0] === "payment_methods") return { ok: true, j: { id: partes[1] } };
    if (base === "subscriptions" && pares) {
      if (idem && idems.has(idem)) return { ok: true, j: expandir(subs.get(idems.get(idem)!)!) };
      const pi = novoPi({ amount: 3490, currency: "brl", description: "Subscription creation", customer: kv.customer });
      const s = { id: `sub_${++n}`, status: "incomplete", customer: kv.customer, metadata: md, latest_invoice: { id: `in_${n}`, status: "open", payment_intent: pi.id } };
      subs.set(String(s.id), s); if (idem) idems.set(idem, String(s.id));
      return { ok: true, j: expandir(s) };
    }
    if (partes[0] === "subscriptions") { const s = subs.get(partes[1]); return s ? { ok: true, j: expandir(s) } : { ok: false, j: {} }; }
    return { ok: false, j: { error: { code: "rota_desconhecida" } } };
  };
  const expandir = (s: Linha) => ({ ...s, latest_invoice: { ...(s.latest_invoice as Linha), payment_intent: pis.get(String((s.latest_invoice as Linha).payment_intent)) } });
  return { f, pis, subs, chamadas, ctl };
}

const pedido = (o: Linha = {}) => validarPedidoStripe({ ref: REF, pagina: "app_web", email: "Maria@Exemplo.com", url: "https://www.coreaplicativo.com.br/funil-app", ...o })!;
const md = (p = pedido()) => metadataDoPedido(p, { userId: "u_anon", ip: "200.1.2.3", ua: "UA", agoraIso: "2026-11-14T14:58:00Z" });
function montar() {
  const b = bancoFalso(); const s = stripeFalsa();
  const deps: DepsAppWeb = { admin: b.admin as never, stripe: s.f, log: () => {}, precoMensal: PRECO };
  return { ...b, s, deps };
}
const ctx = { userId: "u_anon", ip: "200.1.2.3" };

describe("tabela de ofertas: a /oferta não muda", () => {
  it("paramsCriar sem oferta = 6790 'oferta'; app_web = 9790; validar sem pagina = oferta", () => {
    expect(paramsCriar(REF)).toContainEqual(["amount", "6790"]);
    expect(paramsCriar(REF)).toContainEqual(["metadata[pagina]", "oferta"]);
    expect(paramsCriar(REF, OFERTAS_STRIPE.app_web)).toContainEqual(["amount", "9790"]);
    expect(paramsCriar(REF, OFERTAS_STRIPE.app_web)).toContainEqual(["metadata[pagina]", "app_web"]);
    expect(validarPedidoStripe({ ref: REF })!.pagina).toBe("oferta");
    expect(validarPedidoStripe({ ref: REF, pagina: "vida" })!.pagina).toBe("oferta");
    expect(validarPedidoStripe({ ref: REF, pagina: "app_web" })!.pagina).toBe("app_web");
    // o preço nunca vem do navegador
    expect(paramsCriar(REF, OFERTAS_STRIPE.app_web)).not.toContainEqual(["amount", "1"]);
  });
  it("criar /oferta: chave oferta-<ref>; app_web: appweb-<ref>; PI de outra página não serve", async () => {
    const m = montar();
    const r1 = await criarOuReaproveitar(m.deps, validarPedidoStripe({ ref: REF })!, {}, ctx);
    expect(m.s.chamadas.find((c) => c.caminho === "payment_intents")!.idem).toBe(`oferta-${REF}`);
    expect(m.s.pis.get(String(r1.corpo.pi))!.amount).toBe(6790);
    const outra = "8b1b2c3d-1111-4222-8333-944455556666";
    const r2 = await criarOuReaproveitar(m.deps, validarPedidoStripe({ ref: outra, pagina: "app_web" })!, {}, ctx);
    expect(m.s.pis.get(String(r2.corpo.pi))!.amount).toBe(9790);
    expect(m.s.chamadas.some((c) => c.idem === `appweb-${outra}`)).toBe(true);
    // o PI da /oferta (mesma ref) pedido como app_web → 404
    const r3 = await criarOuReaproveitar(m.deps, validarPedidoStripe({ ref: REF, pagina: "app_web", pi: String(r1.corpo.pi) })!, {}, ctx);
    expect(r3.status).toBe(404);
  });
  it("stripe-status responde pra app_web e app_web_mensal, não pra 'vida'", () => {
    expect(respostaStatus({ metadata: { ref: REF, pagina: "app_web" }, status: "succeeded" }, REF)).toMatchObject({ ok: true, pago: true });
    expect(respostaStatus({ metadata: { ref: REF, pagina: "app_web_mensal" }, status: "requires_action" }, REF)).toMatchObject({ ok: true, pago: false });
    expect(respostaStatus({ metadata: { ref: REF, pagina: "vida" }, status: "succeeded" }, REF)).toEqual({ ok: false });
  });
  it("ações: pm obrigatório no cartão/assinar; parcelas só no cartão", () => {
    expect(validarAcaoAppWeb({ acao: "pix" })).toMatchObject({ acao: "pix", pm: null });
    expect(validarAcaoAppWeb({ acao: "cartao" })).toBeNull();
    expect(validarAcaoAppWeb({ acao: "cartao", pm: "pm_123456", parcelas: 3 })).toMatchObject({ parcelas: 3 });
    expect(validarAcaoAppWeb({ acao: "assinar", pm: "pm_123456", parcelas: 3 })).toMatchObject({ parcelas: 1 });
    expect(validarAcaoAppWeb({ acao: "outra" })).toBeNull();
    expect(precoMensalConfere({ unit_amount: 3490, currency: "brl", recurring: { interval: "month" } })).toBe(true);
    expect(precoMensalConfere({ unit_amount: 2490, currency: "brl", recurring: { interval: "month" } })).toBe(false);
    expect(precoMensalConfere({ unit_amount: 3490, currency: "brl", recurring: { interval: "year" } })).toBe(false);
  });
});

describe("Pix do vitalício", () => {
  it("gera 1×: a 2ª chamada (fechou e reabriu) devolve o MESMO QR sem confirmar de novo", async () => {
    const m = montar();
    const r1 = await pixAppWeb(m.deps, pedido(), md(), ctx);
    expect(r1.corpo).toMatchObject({ ok: true, plano: "vitalicio" });
    expect((r1.corpo.pix as Linha).data).toContain("PIX-pi_1");
    const r2 = await pixAppWeb(m.deps, pedido(), md(), ctx);
    expect(r2.corpo).toMatchObject({ ok: true, mesmo: true, pi: r1.corpo.pi });
    expect(m.s.chamadas.filter((c) => c.caminho.endsWith("/confirm"))).toHaveLength(1);
    expect(m.s.pis.size).toBe(1);
    expect(m.s.pis.get("pi_1")!.amount).toBe(9790);
  });
  it("sem e-mail → 400", async () => {
    const m = montar();
    expect((await pixAppWeb(m.deps, pedido({ email: "" }), md(), ctx)).status).toBe(400);
  });
});

describe("cartão do vitalício (trava contra 2×, parcelas, recusa)", () => {
  it("Pix vivo → CANCELADO antes; o cartão vai num PI novo; 3x leva o plano na confirmação", async () => {
    const m = montar();
    await pixAppWeb(m.deps, pedido(), md(), ctx);
    const r = await cartaoAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_visa4242", parcelas: 3, returnUrl: "https://x" });
    expect(r.corpo).toMatchObject({ ok: true, pago: true, plano: "vitalicio", parcelas: 3 });
    expect(m.s.pis.get("pi_1")!.status).toBe("canceled");
    const novo = m.s.pis.get(String(r.corpo.pi))!;
    expect(novo.id).not.toBe("pi_1");
    expect(novo.amount).toBe(9790);
    expect(novo.plano).toBe("3");
    const ordem = m.s.chamadas.map((c) => c.caminho);
    expect(ordem.indexOf("payment_intents/pi_1/cancel")).toBeLessThan(ordem.indexOf(`payment_intents/${novo.id}/confirm`));
  });
  it("o Pix caiu enquanto trocava (cancelar falha e o PI está pago) → 'pago' e NADA é cobrado no cartão", async () => {
    const m = montar();
    await pixAppWeb(m.deps, pedido(), md(), ctx);
    m.s.ctl.pagarPixAoCancelar = true;
    const r = await cartaoAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_visa4242", parcelas: 1, returnUrl: "https://x" });
    expect(r.corpo).toMatchObject({ ok: true, pago: true, metodo: "pix" });
    expect(m.s.chamadas.some((c) => c.caminho.endsWith("/confirm") && c.caminho !== "payment_intents/pi_1/confirm")).toBe(false);
  });
  it("não conseguiu matar o Pix → 409 pix_vivo (nunca cobra o cartão com QR pagável)", async () => {
    const m = montar();
    await pixAppWeb(m.deps, pedido(), md(), ctx);
    m.s.ctl.cancelarFalha = true;
    const r = await cartaoAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_visa4242", parcelas: 1, returnUrl: "https://x" });
    expect(r).toMatchObject({ status: 409, corpo: { erro: "pix_vivo" } });
  });
  it("cartão que não parcela → parcelas_indisponiveis (sem confirmar); 1x limpa o plano", async () => {
    const m = montar();
    const r = await cartaoAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_semparc", parcelas: 3, returnUrl: "https://x" });
    expect(r.corpo).toMatchObject({ ok: false, erro: "parcelas_indisponiveis", max: 1 });
    expect(m.s.chamadas.some((c) => c.caminho.endsWith("/confirm"))).toBe(false);
    const r2 = await cartaoAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_semparc", parcelas: 1, returnUrl: "https://x" });
    expect(r2.corpo).toMatchObject({ ok: true, pago: true });
    const conf = m.s.chamadas.find((c) => c.caminho.endsWith("/confirm"))!;
    expect(conf.pares).toContainEqual(["payment_method_options[card][installments][plan]", ""]);
  });
  it("recusado (4000…0002) → recusado com o código; 3DS → acao + client_secret; parcelas fora de 1–3 → 400", async () => {
    const m = montar();
    expect((await cartaoAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_recusa", parcelas: 1, returnUrl: "https://x" })).corpo).toMatchObject({ ok: false, recusado: true, code: "generic_decline" });
    const r = await cartaoAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_3ds", parcelas: 1, returnUrl: "https://x" });
    expect(r.corpo).toMatchObject({ ok: true, acao: true });
    expect(String(r.corpo.client_secret)).toMatch(/_secret_/);
    expect((await cartaoAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_visa4242", parcelas: 4, returnUrl: "https://x" })).status).toBe(400);
  });
});

describe("mensal (assinatura no cartão)", () => {
  it("sem a env do preço ou preço errado → 503 mensal_indisponivel (nada criado)", async () => {
    const m = montar();
    expect((await assinarAppWeb({ ...m.deps, precoMensal: null }, pedido(), md(), ctx, { pm: "pm_visa4242", returnUrl: "https://x" })).corpo).toMatchObject({ erro: "mensal_indisponivel" });
    m.s.ctl.preco = { ...m.s.ctl.preco, unit_amount: 2490 };
    expect((await assinarAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_visa4242", returnUrl: "https://x" })).status).toBe(503);
    expect(m.s.subs.size).toBe(0);
  });
  it("cria Customer + Subscription (versão fixa da API), confirma a 1ª fatura e registra a ref", async () => {
    const m = montar();
    const r = await assinarAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_visa4242", returnUrl: "https://x" });
    expect(r.corpo).toMatchObject({ ok: true, pago: true, plano: "mensal" });
    const sub = [...m.s.subs.values()][0];
    expect(sub.status).toBe("active");
    expect((sub.metadata as Linha).pagina).toBe("app_web_mensal");
    expect((sub.metadata as Linha).user_id).toBe("u_anon");
    expect(m.s.chamadas.filter((c) => c.caminho === "subscriptions" || c.caminho === "customers").every((c) => c.versao === "2024-06-20")).toBe(true);
    const piFat = m.s.pis.get(String((sub.latest_invoice as Linha).payment_intent))!;
    expect((piFat.metadata as Linha).pagina).toBe("app_web_mensal");
    expect(m.db.analytics_events.find((e) => e.event_name === "stripe_assinatura_criada")).toMatchObject({ event_data: { ref: REF, sub: sub.id } });
    // de novo (recarga): já paga → pago, nenhuma assinatura nova
    expect((await assinarAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_outro999", returnUrl: "https://x" })).corpo).toMatchObject({ pago: true });
    expect(m.s.subs.size).toBe(1);
  });
  it("cartão recusado → a MESMA assinatura (incompleta) é paga com o cartão novo", async () => {
    const m = montar();
    expect((await assinarAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_recusa", returnUrl: "https://x" })).corpo).toMatchObject({ ok: false, recusado: true });
    const r = await assinarAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_visa4242", returnUrl: "https://x" });
    expect(r.corpo).toMatchObject({ ok: true, pago: true });
    expect(m.s.subs.size).toBe(1);
    expect(m.s.chamadas.some((c) => c.caminho === "payment_methods/pm_visa4242/attach")).toBe(true);
  });
  it("Pix vivo do vitalício morre antes do mensal; Pix já pago → 'pago' (vitalício), sem assinatura", async () => {
    const m = montar();
    await pixAppWeb(m.deps, pedido(), md(), ctx);
    await assinarAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_visa4242", returnUrl: "https://x" });
    expect(m.s.pis.get("pi_1")!.status).toBe("canceled");
    const m2 = montar();
    await pixAppWeb(m2.deps, pedido(), md(), ctx);
    m2.s.pis.get("pi_1")!.status = "succeeded";
    expect((await assinarAppWeb(m2.deps, pedido(), md(), ctx, { pm: "pm_visa4242", returnUrl: "https://x" })).corpo).toMatchObject({ pago: true, plano: "vitalicio" });
    expect(m2.s.subs.size).toBe(0);
  });
});

/* ───────── webhook ───────── */
function montarWebhook() {
  const b = bancoFalso();
  const saida = { emails: [] as string[], capi: [] as Linha[], push: [] as string[], avisos: [] as string[] };
  const deps: DepsStripe = {
    admin: b.admin as never, secret: WHSEC,
    acharConta: async (e) => [...b.db.users.values()].find((u) => u.email === e.toLowerCase())?.id ?? null,
    enviarEmail: async (para) => { saida.emails.push(para); return true; },
    mandarCapi: async (c) => { saida.capi.push(c); return true; },
    avisarVenda: async (id) => { saida.avisos.push(id); },
    avisarDono: async (t) => { saida.push.push(t); },
    buscarCobranca: async () => ({ metodo: "card", parcelas: 3 }),
    log: () => {}, agora: () => AGORA,
  };
  return { ...b, deps, saida };
}
let nEvt = 0;
const evento = (type: string, object: Linha) => JSON.stringify({ id: `evt_${++nEvt}`, type, livemode: true, data: { object } });
const assinar = (corpo: string) => { const t = Math.floor(AGORA.getTime() / 1000); return `t=${t},v1=${createHmac("sha256", WHSEC).update(`${t}.${corpo}`).digest("hex")}`; };
const mandar = (m: ReturnType<typeof montarWebhook>, corpo: string) => tratarStripe(m.deps, { assinatura: assinar(corpo), corpo });
const META_SUB = { ref: REF, pagina: "app_web_mensal", email: "maria@exemplo.com", user_id: "u_anon", fbp: "fb.1.1.abc", ip: "200.1.2.3", ua: "UA", url: "https://www.coreaplicativo.com.br/funil-app" };
const fatura = (o: Linha = {}) => ({
  id: "in_1", object: "invoice", amount_paid: 3490, currency: "brl", billing_reason: "subscription_create", customer_email: "maria@exemplo.com", attempt_count: 1,
  parent: { subscription_details: { subscription: "sub_1", metadata: META_SUB } },
  lines: { data: [{ period: { start: 1763132400, end: 1765724400 } }] }, ...o,
});

describe("webhook: vitalício app_web", () => {
  it("9790 com pagina app_web → vitalício liberado + Purchase com o content_name do funil; 6790 em app_web → ignorado", async () => {
    const m = montarWebhook();
    m.db.users.set("u_anon", { id: "u_anon", email: null });
    const pi = (amount: number, id: string) => ({ id, amount, amount_received: amount, currency: "brl", status: "succeeded", livemode: true, latest_charge: "ch_1", metadata: { ref: REF, pagina: "app_web", email: "maria@exemplo.com", user_id: "u_anon", url: "https://www.coreaplicativo.com.br/funil-app" } });
    const r = await mandar(m, evento("payment_intent.succeeded", pi(9790, "pi_ok")));
    expect(r.corpo).toMatchObject({ liberado: true, novo: true });
    expect(m.db.subscriptions[0]).toMatchObject({ plan: "lifetime", amount_cents: 9790, payment_method: "stripe", abacatepay_billing_id: "pi_ok" });
    const ev = ((m.saida.capi[0].data as Linha[])[0]) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(ev).toMatchObject({ event_id: "pi_ok" });
    expect(ev.custom_data).toMatchObject({ value: 97.9, content_name: "CORE vitalício (funil app web)" });
    expect(m.db.analytics_events.find((e) => e.event_name === "stripe_venda")).toMatchObject({ event_data: { pagina: "app_web", plano: "vitalicio", parcelas: 3 } });
    const m2 = montarWebhook();
    expect((await mandar(m2, evento("payment_intent.succeeded", pi(6790, "pi_barato")))).corpo).toMatchObject({ ignorado: "valor" });
    expect(m2.db.subscriptions).toHaveLength(0);
  });
  it("PI de fatura de assinatura (metadata app_web_mensal, ou sem página com customer) → sem alarme, sem linha", async () => {
    const m = montarWebhook();
    const r = await mandar(m, evento("payment_intent.succeeded", { id: "pi_fat", amount: 3490, currency: "brl", status: "succeeded", livemode: true, metadata: { ref: REF, pagina: "app_web_mensal" } }));
    expect(r.corpo).toMatchObject({ ignorado: "fatura" });
    const r2 = await mandar(m, evento("payment_intent.succeeded", { id: "pi_ren", amount: 3490, currency: "brl", status: "succeeded", livemode: true, customer: "cus_1", description: "Subscription update", metadata: {} }));
    expect(r2.corpo).toMatchObject({ ignorado: "fatura" });
    expect(m.saida.push).toHaveLength(0);
    expect(m.db.subscriptions).toHaveLength(0);
  });
});

describe("webhook: mensal", () => {
  it("1ª fatura → linha mensal (fim = fim do período), e-mail, Purchase (event_id = assinatura, 34,90), stripe_venda, aviso; repetida não duplica", async () => {
    const m = montarWebhook();
    m.db.users.set("u_anon", { id: "u_anon", email: null });
    const r = await mandar(m, evento("invoice.paid", fatura()));
    expect(r.corpo).toMatchObject({ liberado: true, plano: "mensal", via: "ref_batizada" });
    expect(m.db.subscriptions).toHaveLength(1);
    expect(m.db.subscriptions[0]).toMatchObject({ user_id: "u_anon", status: "active", plan: "monthly", billing_period: "monthly", payment_method: "stripe", abacatepay_billing_id: "sub_1", amount_cents: 3490, current_period_end: new Date(1765724400 * 1000).toISOString() });
    expect(m.saida.emails).toEqual(["maria@exemplo.com"]);
    const ev = ((m.saida.capi[0].data as Linha[])[0]) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(ev).toMatchObject({ event_name: "Purchase", event_id: "sub_1" });
    expect(ev.custom_data).toMatchObject({ value: 34.9, content_name: "CORE mensal (funil app web)" });
    expect(m.saida.avisos).toHaveLength(1);
    await mandar(m, evento("invoice.paid", fatura()));
    expect(m.db.subscriptions).toHaveLength(1);
    expect(m.saida.capi).toHaveLength(1);
  });
  it("formato antigo da API (invoice.subscription + subscription_details) também vale", async () => {
    const m = montarWebhook();
    m.db.users.set("u_anon", { id: "u_anon", email: null });
    const f = { ...fatura(), parent: undefined, subscription: "sub_1", subscription_details: { metadata: META_SUB } };
    expect((await mandar(m, evento("invoice.paid", f))).corpo).toMatchObject({ liberado: true });
  });
  it("renovação → a MESMA linha com o fim novo; falha → past_due; pago de novo → active", async () => {
    const m = montarWebhook();
    m.db.users.set("u_anon", { id: "u_anon", email: null });
    await mandar(m, evento("invoice.paid", fatura()));
    await mandar(m, evento("invoice.payment_failed", fatura({ id: "in_2", billing_reason: "subscription_cycle", amount_paid: 0, attempt_count: 1 })));
    expect(m.db.subscriptions[0].status).toBe("past_due");
    const r = await mandar(m, evento("invoice.paid", fatura({ id: "in_2", billing_reason: "subscription_cycle", lines: { data: [{ period: { start: 1765724400, end: 1768402800 } }] } })));
    expect(r.corpo).toMatchObject({ renovado: true });
    expect(m.db.subscriptions).toHaveLength(1);
    expect(m.db.subscriptions[0]).toMatchObject({ status: "active", current_period_end: new Date(1768402800 * 1000).toISOString() });
    expect(m.saida.capi).toHaveLength(1); // renovação não é Purchase novo
  });
  it("cancelou no fim do período → cancel_scheduled; desfez → active; encerrou → canceled", async () => {
    const m = montarWebhook();
    m.db.users.set("u_anon", { id: "u_anon", email: null });
    await mandar(m, evento("invoice.paid", fatura()));
    await mandar(m, evento("customer.subscription.updated", { id: "sub_1", status: "active", cancel_at_period_end: true, items: { data: [{ current_period_end: 1765724400 }] } }));
    expect(m.db.subscriptions[0].status).toBe("cancel_scheduled");
    await mandar(m, evento("customer.subscription.updated", { id: "sub_1", status: "active", cancel_at_period_end: false }));
    expect(m.db.subscriptions[0].status).toBe("active");
    await mandar(m, evento("customer.subscription.deleted", { id: "sub_1", status: "canceled" }));
    expect(m.db.subscriptions[0].status).toBe("canceled");
  });
  it("valor diferente de 3490 → ignorado + alarme; assinatura que não é do funil → só log", async () => {
    const m = montarWebhook();
    expect((await mandar(m, evento("invoice.paid", fatura({ amount_paid: 2490 })))).corpo).toMatchObject({ ignorado: "valor" });
    expect(m.saida.push).toHaveLength(1);
    const outra = fatura({ id: "in_9", parent: { subscription_details: { subscription: "sub_9", metadata: { pagina: "outra" } } } });
    expect((await mandar(m, evento("invoice.paid", outra))).corpo).toMatchObject({ ignorado: "outra_assinatura" });
    expect(m.db.subscriptions).toHaveLength(0);
  });
});
