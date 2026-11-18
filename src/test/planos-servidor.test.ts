/**
 * /escolha (18/11, PLANOS_PAGINA) — o SERVIDOR da página dos 2 planos, com a Stripe e o banco falsos:
 *   tabela: "planos" = 9790 (12x), "planos_mensal" = 3490; a /oferta e o /funil-app não mudam;
 *   ações: Pix/cartão do vitalício na família "planos" (chaves "planos-…"), mensal no cartão, mensal no Pix Automático
 *          (Subscription com pix + mandato, segredo da 1ª fatura pro navegador; desligado no servidor = 503), e o QR do Pix mensal
 *          ANULADO antes de qualquer outra cobrança na mesma ref;
 *   webhook: vitalício 9790 libera + Purchase (97,90, event_id = PI) + comissão FIXA 33,95; mensal: 1ª fatura libera + Purchase
 *            (34,90, event_id = assinatura); renovação estende SEM Purchase e a comissão nasce só no 2º pagamento (1×);
 *            falhou → past_due; cancelou → cancel_scheduled (até o fim do mês pago); acabou → canceled; fatura velha não encurta.
 */
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { tratarStripe, type DepsStripe } from "../../supabase/functions/_shared/stripe";
import { metadataDoPedido, respostaStatus, validarPedidoStripe, type ChamarStripe } from "../../supabase/functions/_shared/stripe-criar";
import { assinarAppWeb, assinarPixPlanos, cartaoAppWeb, FAMILIA_APP_WEB, FAMILIA_PLANOS, familiaDaPagina, piDaFatura, pixAppWeb, validarAcaoAppWeb, type DepsAppWeb } from "../../supabase/functions/_shared/stripe-app-web";
import { COMISSAO_FIXA_PLANOS_CENTS, MENSAL_PLANOS, OFERTAS_STRIPE, mensalDaPagina } from "../../supabase/functions/_shared/stripe-ofertas";
import { decidirIndicacao, compraValeLink } from "../../supabase/functions/_shared/indique";

type Linha = Record<string, unknown>;
const WHSEC = "whsec_teste123";
const AGORA = new Date("2026-11-18T15:00:00Z");
const REF = "9b1b2c3d-1111-4222-8333-944455556666";
const PRECO = "price_mensal34";

function bancoFalso() {
  const db = { subscriptions: [] as Linha[], webhook_events: new Map<string, string>(), analytics_events: [] as Linha[], support_tickets: [] as Linha[], users: new Map<string, { id: string; email: string | null }>() };
  let seq = 0;
  const from = (tabela: string) => {
    const filtros: Array<(r: Linha) => boolean> = [];
    let op: { tipo: "select" | "insert" | "update" | "delete"; dados?: Linha } = { tipo: "select" };
    let unico = false, contar = false;
    const exec = async () => {
      await new Promise((r) => setTimeout(r, 0));
      const casa = (r: Linha) => filtros.every((f) => f(r));
      if (tabela === "webhook_events") {
        if (op.tipo === "insert") { const id = String(op.dados!.id); if (db.webhook_events.has(id)) return { error: { code: "23505", message: "duplicate" } }; db.webhook_events.set(id, String(op.dados!.event ?? "")); return { error: null }; }
        const linhas = [...db.webhook_events.entries()].map(([id, event]) => ({ id, event }));
        if (op.tipo === "delete") { for (const l of linhas.filter(casa)) db.webhook_events.delete(l.id); return { error: null }; }
        const a = linhas.filter(casa); return { data: unico ? a[0] ?? null : a, error: null };
      }
      const tb = tabela === "subscriptions" ? db.subscriptions : tabela === "support_tickets" ? db.support_tickets : db.analytics_events;
      if (contar) return { count: tb.filter(casa).length, error: null };
      if (op.tipo === "insert") { tb.push({ id: `l${++seq}`, created_at: new Date(Date.now() + seq).toISOString(), ...op.dados }); return { error: null }; }
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
      limit: () => q, order: () => q,
      in: (k: string, vs: unknown[]) => { filtros.push((r) => vs.includes(r[k])); return q; },
      maybeSingle: () => { unico = true; return q; },
      then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => exec().then(ok, erro),
    };
    return q;
  };
  const auth = { admin: {
    getUserById: async (id: string) => ({ data: { user: db.users.get(id) ?? null }, error: null }),
    updateUserById: async (id: string, a: Linha) => { const u = db.users.get(id)!; u.email = String(a.email ?? ""); return { data: { user: u }, error: null }; },
    createUser: async (a: Linha) => { const id = `u_novo${++seq}`; const u = { id, email: String(a.email) }; db.users.set(id, u); return { data: { user: u }, error: null }; },
  } };
  return { db, admin: { from, auth } };
}

/** a Stripe falsa: PIs, assinaturas (cartão: fatura com payment_intent; Pix: fatura no formato novo, payments + confirmation_secret) */
function stripeFalsa() {
  const pis = new Map<string, Linha>();
  const subs = new Map<string, Linha>();
  const faturas = new Map<string, Linha>();
  const idems = new Map<string, string>();
  const chamadas: Array<{ caminho: string; pares: Array<[string, string]> | null; idem?: string; versao?: string }> = [];
  const ctl = { voidFalha: false };
  let n = 0;
  const pixNa = (id: string) => ({ type: "pix_display_qr_code", pix_display_qr_code: { data: `00020126PIX-${id}`, image_url_png: `https://qr/${id}.png`, expires_at: 1763480000 } });
  const novoPi = (dados: Linha) => { const id = `pi_${++n}`; const p = { id, client_secret: `${id}_secret_x`, status: "requires_payment_method", metadata: {}, next_action: null, ...dados }; pis.set(id, p); return p; };
  const expandir = (s: Linha) => {
    const f = faturas.get(String(s.latest_invoice))!;
    return { ...s, latest_invoice: { ...f, payment_intent: pis.get(String(f.pi)) } };
  };
  const f: ChamarStripe = async (caminho, pares, idem, versao) => {
    chamadas.push({ caminho, pares, idem, versao });
    const kv = Object.fromEntries(pares ?? []);
    const md = Object.fromEntries((pares ?? []).filter(([k]) => k.startsWith("metadata[")).map(([k, v]) => [k.slice(9, -1), v]));
    const [base, query] = caminho.split("?");
    const partes = base.split("/");
    if (base === "payment_intents" && pares) {
      if (idem && idems.has(idem)) return { ok: true, j: pis.get(idems.get(idem)!)! };
      const p = novoPi({ amount: Number(kv.amount), currency: kv.currency, metadata: md });
      if (idem) idems.set(idem, String(p.id));
      return { ok: true, j: p };
    }
    if (partes[0] === "payment_intents" && partes.length === 2) {
      const p = pis.get(partes[1]); if (!p) return { ok: false, j: {} };
      if (!pares) return { ok: true, j: p };
      if (kv.payment_method) { p.payment_method = kv.payment_method; p.payment_method_options = { card: { installments: { available_plans: [2, 3, 6, 12].map((count) => ({ count, interval: "month", type: "fixed_count" })) } } }; }
      p.metadata = { ...(p.metadata as Linha), ...md };
      return { ok: true, j: p };
    }
    if (partes[0] === "payment_intents" && partes[2] === "confirm") {
      const p = pis.get(partes[1])!;
      if (kv["payment_method_data[type]"] === "pix") { p.status = "requires_action"; p.next_action = pixNa(String(p.id)); return { ok: true, j: p }; }
      p.status = "succeeded"; p.plano = kv["payment_method_options[card][installments][plan][count]"] ?? null;
      for (const s of subs.values()) if (faturas.get(String(s.latest_invoice))?.pi === p.id) s.status = "active";
      return { ok: true, j: p };
    }
    if (partes[0] === "payment_intents" && partes[2] === "cancel") { const p = pis.get(partes[1])!; p.status = "canceled"; p.next_action = null; return { ok: true, j: p }; }
    if (partes[0] === "prices") return { ok: true, j: { id: PRECO, unit_amount: 3490, currency: "brl", recurring: { interval: "month", interval_count: 1 }, active: true } };
    if (base === "customers" && pares) { if (idem && idems.has(idem)) return { ok: true, j: { id: idems.get(idem) } }; const id = `cus_${++n}`; if (idem) idems.set(idem, id); return { ok: true, j: { id } }; }
    if (partes[0] === "customers" || partes[0] === "payment_methods") return { ok: true, j: { id: partes[1] } };
    if (base === "subscriptions" && pares) {
      if (idem && idems.has(idem)) return { ok: true, j: expandir(subs.get(idems.get(idem)!)!) };
      const pix = kv["payment_settings[payment_method_types][0]"] === "pix";
      const pi = novoPi({ amount: 3490, currency: "brl", customer: kv.customer });
      const fid = `in_${++n}`;
      faturas.set(fid, { id: fid, status: "open", pi: pi.id });
      const s = { id: `sub_${++n}`, created: n, status: "incomplete", customer: kv.customer, metadata: md, latest_invoice: fid, pix, params: kv };
      subs.set(String(s.id), s); if (idem) idems.set(idem, String(s.id));
      return { ok: true, j: expandir(s) };
    }
    if (partes[0] === "subscriptions" && !pares) {
      const s = subs.get(partes[1]); if (!s) return { ok: false, j: {} };
      const fat = faturas.get(String(s.latest_invoice))!;
      if (query && /latest_invoice\.payments/.test(query)) return { ok: true, j: { ...s, latest_invoice: { id: fat.id, status: fat.status, payments: { data: [{ payment: { type: "payment_intent", payment_intent: fat.pi } }] }, confirmation_secret: { client_secret: `${fat.pi}_secret_x`, type: "payment_intent" } } } };
      if (query && /payment_intent/.test(query)) return { ok: true, j: expandir(s) };
      return { ok: true, j: s };
    }
    if (partes[0] === "invoices" && partes[2] === "void") {
      if (ctl.voidFalha) return { ok: false, j: { error: { code: "invoice_not_open" } } };
      const fat = faturas.get(partes[1])!; fat.status = "void";
      const p = pis.get(String(fat.pi))!; p.status = "canceled"; p.next_action = null;
      for (const s of subs.values()) if (s.latest_invoice === fat.id) s.status = "incomplete_expired";
      return { ok: true, j: fat };
    }
    return { ok: false, j: { error: { code: "rota_desconhecida" } } };
  };
  return { f, pis, subs, faturas, chamadas, ctl };
}

const pedido = (o: Linha = {}) => validarPedidoStripe({ ref: REF, pagina: "planos", email: "Bia@Exemplo.com", url: "https://www.coreaplicativo.com.br/escolha?utm_content=c1", atrib: { utm_content: "c1", indicador: "ANA7K2" }, ...o })!;
const md = (p = pedido()) => metadataDoPedido(p, { userId: "u_anon", ip: "200.1.2.3", ua: "UA", agoraIso: "2026-11-18T14:58:00Z" });
const ctx = { userId: "u_anon", ip: "200.1.2.3" };
function montar(extra: Partial<DepsAppWeb> = {}) {
  const b = bancoFalso(); const s = stripeFalsa();
  const deps: DepsAppWeb = { admin: b.admin as never, stripe: s.f, log: () => {}, precoMensal: PRECO, familia: FAMILIA_PLANOS, pixMensal: true, ...extra };
  return { ...b, s, deps };
}

describe("tabela e pedido", () => {
  it("planos = 9790 em até 12x; planos_mensal = 3490; a /oferta e o /funil-app iguais; comissão fixa 3395", () => {
    expect(OFERTAS_STRIPE.planos).toMatchObject({ pagina: "planos", centavos: 9790, parcelasMax: 12, idem: "planos" });
    expect(OFERTAS_STRIPE.oferta).toMatchObject({ centavos: 6790, idem: "oferta" });
    expect(OFERTAS_STRIPE.app_web).toMatchObject({ centavos: 9790, parcelasMax: 3, idem: "appweb" });
    expect(mensalDaPagina("planos_mensal")).toBe(MENSAL_PLANOS);
    expect(mensalDaPagina("app_web_mensal")?.centavos).toBe(3490);
    expect(mensalDaPagina("oferta")).toBeNull();
    expect(COMISSAO_FIXA_PLANOS_CENTS).toBe(3395);
    expect(familiaDaPagina("planos")).toBe(FAMILIA_PLANOS);
    expect(familiaDaPagina("app_web")).toBe(FAMILIA_APP_WEB);
    expect(familiaDaPagina("oferta")).toBeNull();
  });
  it("validar: pagina planos fica planos (com o indicador); sem pagina = oferta; planos nunca salva cartão", () => {
    expect(pedido()).toMatchObject({ pagina: "planos", atrib: { indicador: "ANA7K2", utm_content: "c1" } });
    expect(pedido({ salvar_cartao: true }).salvarCartao).toBeUndefined();
    expect(validarPedidoStripe({ ref: REF })!.pagina).toBe("oferta");
    expect(validarAcaoAppWeb({ acao: "assinar_pix" })).toMatchObject({ acao: "assinar_pix", pm: null });
  });
  it("stripe-status responde pro PI do mensal da /escolha (planos_mensal) e do vitalício (planos)", () => {
    expect(respostaStatus({ metadata: { ref: REF, pagina: "planos_mensal" }, status: "succeeded" }, REF)).toMatchObject({ ok: true, pago: true });
    expect(respostaStatus({ metadata: { ref: REF, pagina: "planos" }, status: "requires_action" }, REF)).toMatchObject({ ok: true, pago: false });
    expect(respostaStatus({ metadata: { ref: REF, pagina: "outra" }, status: "succeeded" }, REF)).toEqual({ ok: false });
  });
});

describe("ações da /escolha", () => {
  it("Pix do vitalício: PI de 9790 da página planos, chave planos-<ref>, QR", async () => {
    const m = montar();
    const r = await pixAppWeb(m.deps, pedido(), md(), ctx);
    expect(r.corpo).toMatchObject({ ok: true, plano: "vitalicio" });
    expect(m.s.chamadas.find((c) => c.caminho === "payment_intents")?.idem).toBe(`planos-${REF}`);
    expect([...m.s.pis.values()][0]).toMatchObject({ amount: 9790, metadata: { pagina: "planos" } });
    expect(m.db.webhook_events.size).toBe(0); // a trava "planos-cobrando" foi solta
  });
  it("cartão do vitalício em 12x leva o plano na confirmação; 13x → 400", async () => {
    const m = montar();
    const r = await cartaoAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_visa424242", parcelas: 12, returnUrl: FAMILIA_PLANOS.retorno });
    expect(r.corpo).toMatchObject({ ok: true, pago: true, plano: "vitalicio", parcelas: 12 });
    expect([...m.s.pis.values()].find((p) => p.status === "succeeded")).toMatchObject({ amount: 9790, plano: "12" });
    expect((await cartaoAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_visa424242", parcelas: 13, returnUrl: "x" })).status).toBe(400);
  });
  it("mensal no cartão: assinatura com metadata planos_mensal e chaves planos-…", async () => {
    const m = montar();
    const r = await assinarAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_visa424242", returnUrl: "x" });
    expect(r.corpo).toMatchObject({ ok: true, pago: true, plano: "mensal" });
    const s = [...m.s.subs.values()][0];
    expect(s.metadata).toMatchObject({ pagina: "planos_mensal", ref: REF, indicador: "ANA7K2" });
    expect(m.s.chamadas.find((c) => c.caminho === "subscriptions")?.idem).toBe(`planos-sub-${REF}-1`);
  });
  it("Pix Automático: Subscription com pix + mandato (3490, mensal), versão nova da API, devolve o segredo da 1ª fatura; recarga = a MESMA", async () => {
    const m = montar();
    const r = await assinarPixPlanos(m.deps, pedido(), md(), ctx);
    expect(r.corpo).toMatchObject({ ok: true, plano: "mensal", metodo: "pix" });
    const c = r.corpo as { client_secret: string; pi: string; sub: string };
    expect(c.client_secret).toBe(`${c.pi}_secret_x`);
    const criar = m.s.chamadas.find((x) => x.caminho === "subscriptions")!;
    const kv = Object.fromEntries(criar.pares!);
    expect(kv).toMatchObject({
      "payment_settings[payment_method_types][0]": "pix", "payment_behavior": "default_incomplete",
      "payment_settings[payment_method_options][pix][mandate_options][amount]": "3490",
      "payment_settings[payment_method_options][pix][mandate_options][payment_schedule]": "monthly",
      "metadata[pagina]": "planos_mensal", "metadata[metodo]": "pix",
    });
    expect(criar.versao).toBe("2026-10-28.endive");
    expect(criar.idem).toBe(`planos-subpix-${REF}-1`);
    expect(m.s.pis.get(c.pi)!.metadata).toMatchObject({ ref: REF, pagina: "planos_mensal", sub: c.sub });
    // fechou e reabriu: a MESMA assinatura (nenhuma 2ª)
    const r2 = await assinarPixPlanos(m.deps, pedido(), md(), ctx);
    expect((r2.corpo as { sub: string }).sub).toBe(c.sub);
    expect(m.s.subs.size).toBe(1);
  });
  it("Pix Automático desligado no servidor (sem STRIPE_PIX_RECORRENTE) → 503, nada criado; no /funil-app → 400", async () => {
    const m = montar({ pixMensal: false });
    expect((await assinarPixPlanos(m.deps, pedido(), md(), ctx)).status).toBe(503);
    expect(m.s.subs.size).toBe(0);
    const a = montar({ familia: FAMILIA_APP_WEB });
    expect((await assinarPixPlanos(a.deps, pedido(), md(), ctx)).status).toBe(400);
  });
  it("trava contra 2×: QR do Pix mensal vivo → o cartão (vitalício ou mensal) ANULA a fatura antes de cobrar", async () => {
    const m = montar();
    const r = await assinarPixPlanos(m.deps, pedido(), md(), ctx);
    const pixPi = (r.corpo as { pi: string }).pi;
    const c = await cartaoAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_visa424242", parcelas: 1, returnUrl: "x" });
    expect(c.corpo).toMatchObject({ pago: true, plano: "vitalicio" });
    expect(m.s.chamadas.some((x) => /^invoices\/in_\d+\/void$/.test(x.caminho))).toBe(true);
    expect(m.s.pis.get(pixPi)!.status).toBe("canceled");
  });
  it("não conseguiu anular o Pix mensal → 409 pix_vivo (o cartão NÃO é cobrado)", async () => {
    const m = montar();
    await assinarPixPlanos(m.deps, pedido(), md(), ctx);
    m.s.ctl.voidFalha = true;
    const c = await assinarAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_visa424242", returnUrl: "x" });
    expect(c).toMatchObject({ status: 409, corpo: { erro: "pix_vivo" } });
    expect([...m.s.subs.values()].filter((s) => !s.pix)).toHaveLength(0);
  });
  it("Pix mensal já PAGO → qualquer outra cobrança na ref responde 'pago' (mensal) sem cobrar", async () => {
    const m = montar();
    await assinarPixPlanos(m.deps, pedido(), md(), ctx);
    [...m.s.subs.values()][0].status = "active";
    const c = await cartaoAppWeb(m.deps, pedido(), md(), ctx, { pm: "pm_visa424242", parcelas: 1, returnUrl: "x" });
    expect(c.corpo).toMatchObject({ pago: true, plano: "mensal" });
    expect([...m.s.pis.values()].filter((p) => p.amount === 9790)).toHaveLength(0);
  });
  it("piDaFatura lê os 2 formatos da API", () => {
    expect(piDaFatura({ payment_intent: "pi_a" })).toBe("pi_a");
    expect(piDaFatura({ payment_intent: { id: "pi_b" } })).toBe("pi_b");
    expect(piDaFatura({ payments: { data: [{ payment: { payment_intent: "pi_c" } }] } })).toBe("pi_c");
    expect(piDaFatura({})).toBeNull();
  });
});

/* ───────── webhook ───────── */
function montarWebhook() {
  const b = bancoFalso();
  const saida = { emails: [] as string[], capi: [] as Linha[], push: [] as string[], avisos: [] as string[], indicacoes: [] as Array<{ indicador: string; venda: Linha }> };
  const stripeAgora = { subs: new Map<string, Linha>() };
  const deps: DepsStripe = {
    admin: b.admin as never, secret: WHSEC,
    acharConta: async (e) => [...b.db.users.values()].find((u) => u.email === e.toLowerCase())?.id ?? null,
    enviarEmail: async (para) => { saida.emails.push(para); return true; },
    mandarCapi: async (c) => { saida.capi.push(c); return true; },
    avisarVenda: async (id) => { saida.avisos.push(id); },
    avisarDono: async (t) => { saida.push.push(t); },
    buscarCobranca: async () => ({ metodo: "card", parcelas: 12, cartaoFp: "fp1" }),
    buscarAssinatura: async (sub) => stripeAgora.subs.get(sub) ?? { id: sub, status: "active", metadata: {} },
    assinaturaDoPagamento: async () => null,
    cancelarAssinatura: async () => true,
    indique: { registrar: async (indicador, venda) => { saida.indicacoes.push({ indicador, venda: venda as unknown as Linha }); return { r: "gravada" }; }, cancelar: async () => ({ venda: "nenhuma" }) },
    log: () => {}, agora: () => AGORA,
  };
  return { ...b, deps, saida, stripeAgora };
}
let nEvt = 0;
const evento = (type: string, object: Linha) => JSON.stringify({ id: `evt_p${++nEvt}`, type, livemode: true, data: { object } });
const assinar = (corpo: string) => { const t = Math.floor(AGORA.getTime() / 1000); return `t=${t},v1=${createHmac("sha256", WHSEC).update(`${t}.${corpo}`).digest("hex")}`; };
const mandar = (m: ReturnType<typeof montarWebhook>, corpo: string) => tratarStripe(m.deps, { assinatura: assinar(corpo), corpo });
const piVit = (o: Linha = {}) => ({
  id: "pi_vit1", object: "payment_intent", amount: 9790, amount_received: 9790, currency: "brl", status: "succeeded", livemode: true, latest_charge: "ch_1",
  metadata: { ref: REF, pagina: "planos", email: "bia@exemplo.com", user_id: "u_anon", fbp: "fb.1.1.abc", ip: "200.1.2.3", ua: "UA", url: "https://www.coreaplicativo.com.br/escolha?utm_content=c1", indicador: "ANA7K2" }, ...o,
});
const META = { ref: REF, pagina: "planos_mensal", email: "bia@exemplo.com", user_id: "u_anon", fbp: "fb.1.1.abc", ip: "200.1.2.3", ua: "UA", url: "https://www.coreaplicativo.com.br/escolha", indicador: "ANA7K2" };
const P1 = { start: 1763478000, end: 1766070000 }, P2 = { start: 1766070000, end: 1768748400 }, P3 = { start: 1768748400, end: 1771426800 };
const fatura = (o: Linha = {}, meta: Linha = META, periodo = P1) => ({
  id: "in_1", object: "invoice", amount_paid: 3490, currency: "brl", billing_reason: "subscription_create", customer_email: "bia@exemplo.com", attempt_count: 1,
  parent: { subscription_details: { subscription: "sub_1", metadata: meta } }, payments: { data: [{ payment: { payment_intent: "pi_f1" } }] },
  lines: { data: [{ period: periodo }] }, ...o,
});
const iso = (s: number) => new Date(s * 1000).toISOString();

describe("webhook: vitalício da /escolha", () => {
  it("9790 → vitalício liberado, Purchase 97,90 (event_id = PI, content planos), stripe_venda planos, comissão FIXA 3395", async () => {
    const m = montarWebhook();
    m.db.users.set("u_anon", { id: "u_anon", email: null });
    const r = await mandar(m, evento("payment_intent.succeeded", piVit()));
    expect(r.corpo).toMatchObject({ liberado: true, novo: true });
    expect(m.db.subscriptions[0]).toMatchObject({ plan: "lifetime", billing_period: "lifetime", status: "active", abacatepay_billing_id: "pi_vit1", amount_cents: 9790 });
    const ev = (m.saida.capi[0].data as Linha[])[0] as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(ev).toMatchObject({ event_name: "Purchase", event_id: "pi_vit1" });
    expect(ev.custom_data).toMatchObject({ value: 97.9, content_name: "CORE vitalício (planos)" });
    expect(m.db.analytics_events.find((e) => e.event_name === "stripe_venda")!.event_data).toMatchObject({ pagina: "planos", plano: "vitalicio", valor_cents: 9790 });
    expect(m.saida.indicacoes).toHaveLength(1);
    expect(m.saida.indicacoes[0].venda).toMatchObject({ pi: "pi_vit1", comissaoFixaCents: 3395, produto: "web_planos_vitalicio" });
    // repetido: nada em dobro
    await mandar(m, evento("payment_intent.succeeded", piVit()));
    expect(m.saida.capi).toHaveLength(1);
    expect(m.db.subscriptions).toHaveLength(1);
  });
  it("valor errado na página planos (6790) → ignorado + alarme, sem acesso", async () => {
    const m = montarWebhook();
    const r = await mandar(m, evento("payment_intent.succeeded", piVit({ amount: 6790, amount_received: 6790 })));
    expect(r.corpo).toMatchObject({ ignorado: "valor" });
    expect(m.db.subscriptions).toHaveLength(0);
    expect(m.saida.push).toHaveLength(1);
  });
  it("PI da fatura do mensal (metadata planos_mensal) não vira venda avulsa nem alarme", async () => {
    const m = montarWebhook();
    const r = await mandar(m, evento("payment_intent.succeeded", piVit({ id: "pi_f1", amount: 3490, amount_received: 3490, metadata: { ref: REF, pagina: "planos_mensal" } })));
    expect(r.corpo).toMatchObject({ ignorado: "fatura" });
    expect(m.saida.push).toHaveLength(0);
  });
});

describe("webhook: mensal da /escolha (pagou, renovou, falhou, cancelou)", () => {
  it("1ª fatura → linha mensal até o fim do período + Purchase 34,90 (event_id = assinatura) + stripe_venda planos; SEM comissão ainda", async () => {
    const m = montarWebhook();
    m.db.users.set("u_anon", { id: "u_anon", email: null });
    m.stripeAgora.subs.set("sub_1", { id: "sub_1", status: "active", metadata: META });
    const r = await mandar(m, evento("invoice.paid", fatura()));
    expect(r.corpo).toMatchObject({ liberado: true, plano: "mensal" });
    expect(m.db.subscriptions[0]).toMatchObject({ plan: "monthly", billing_period: "monthly", status: "active", payment_method: "stripe", abacatepay_billing_id: "sub_1", current_period_end: iso(P1.end) });
    const ev = (m.saida.capi[0].data as Linha[])[0] as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(ev).toMatchObject({ event_name: "Purchase", event_id: "sub_1" });
    expect(ev.custom_data).toMatchObject({ value: 34.9, content_name: "CORE mensal (planos)" });
    expect(m.db.analytics_events.find((e) => e.event_name === "stripe_venda")!.event_data).toMatchObject({ pagina: "planos", plano: "mensal", metodo: "card" });
    expect(m.saida.indicacoes).toHaveLength(0);
  });
  it("renovou (2º pagamento) → o fim anda, NENHUM Purchase novo, comissão FIXA nasce 1× (chave = PI da fatura); 3º pagamento não paga de novo", async () => {
    const m = montarWebhook();
    m.db.users.set("u_anon", { id: "u_anon", email: null });
    m.stripeAgora.subs.set("sub_1", { id: "sub_1", status: "active", metadata: META });
    await mandar(m, evento("invoice.paid", fatura()));
    await mandar(m, evento("invoice.paid", fatura({ id: "in_2", billing_reason: "subscription_cycle", payments: { data: [{ payment: { payment_intent: "pi_f2" } }] } }, META, P2)));
    expect(m.db.subscriptions).toHaveLength(1);
    expect(m.db.subscriptions[0]).toMatchObject({ status: "active", current_period_end: iso(P2.end) });
    expect(m.saida.capi).toHaveLength(1);
    expect(m.saida.indicacoes).toHaveLength(1);
    expect(m.saida.indicacoes[0]).toMatchObject({ indicador: "ANA7K2", venda: { pi: "pi_f2", comissaoFixaCents: 3395, produto: "web_planos_mensal_card", userId: "u_anon" } });
    await mandar(m, evento("invoice.paid", fatura({ id: "in_3", billing_reason: "subscription_cycle", payments: { data: [{ payment: { payment_intent: "pi_f3" } }] } }, META, P3)));
    expect(m.saida.indicacoes).toHaveLength(1);
    expect(m.db.subscriptions[0].current_period_end).toBe(iso(P3.end));
    expect(m.saida.capi).toHaveLength(1);
  });
  it("Pix Automático: stripe_venda com metodo pix; renovação paga com atraso (fatura antiga) NÃO encurta o acesso", async () => {
    const m = montarWebhook();
    m.db.users.set("u_anon", { id: "u_anon", email: null });
    const metaPix = { ...META, metodo: "pix" };
    m.stripeAgora.subs.set("sub_1", { id: "sub_1", status: "active", metadata: metaPix });
    await mandar(m, evento("invoice.paid", fatura({}, metaPix)));
    expect(m.db.analytics_events.find((e) => e.event_name === "stripe_venda")!.event_data).toMatchObject({ metodo: "pix" });
    await mandar(m, evento("invoice.paid", fatura({ id: "in_3", billing_reason: "subscription_cycle" }, metaPix, P3)));
    await mandar(m, evento("invoice.paid", fatura({ id: "in_2", billing_reason: "subscription_cycle" }, metaPix, P2)));
    expect(m.db.subscriptions[0].current_period_end).toBe(iso(P3.end));
  });
  it("falhou → past_due (acesso até o fim do período + a carência de sempre); pagou de novo → active", async () => {
    const m = montarWebhook();
    m.db.users.set("u_anon", { id: "u_anon", email: null });
    m.stripeAgora.subs.set("sub_1", { id: "sub_1", status: "active", metadata: META });
    await mandar(m, evento("invoice.paid", fatura()));
    m.stripeAgora.subs.set("sub_1", { id: "sub_1", status: "past_due", metadata: META });
    await mandar(m, evento("invoice.payment_failed", fatura({ id: "in_2", billing_reason: "subscription_cycle", amount_paid: 0 }, META, P2)));
    expect(m.db.subscriptions[0]).toMatchObject({ status: "past_due", current_period_end: iso(P1.end) });
    m.stripeAgora.subs.set("sub_1", { id: "sub_1", status: "active", metadata: META });
    await mandar(m, evento("invoice.paid", fatura({ id: "in_2", billing_reason: "subscription_cycle" }, META, P2)));
    expect(m.db.subscriptions[0]).toMatchObject({ status: "active", current_period_end: iso(P2.end) });
  });
  it("cancelou → cancel_scheduled até o fim do mês pago (sem carência); acabou → canceled", async () => {
    const m = montarWebhook();
    m.db.users.set("u_anon", { id: "u_anon", email: null });
    m.stripeAgora.subs.set("sub_1", { id: "sub_1", status: "active", metadata: META });
    await mandar(m, evento("invoice.paid", fatura()));
    const agendada = { id: "sub_1", status: "active", cancel_at_period_end: true, items: { data: [{ current_period_end: P1.end }] }, metadata: META };
    m.stripeAgora.subs.set("sub_1", agendada);
    await mandar(m, evento("customer.subscription.updated", agendada));
    expect(m.db.subscriptions[0]).toMatchObject({ status: "cancel_scheduled", current_period_end: iso(P1.end) });
    m.stripeAgora.subs.set("sub_1", { id: "sub_1", status: "canceled", metadata: META });
    await mandar(m, evento("customer.subscription.deleted", { id: "sub_1", status: "canceled" }));
    expect(m.db.subscriptions[0].status).toBe("canceled");
    expect(m.saida.indicacoes).toHaveLength(0); // cancelou antes do 2º pagamento: nenhuma comissão
  });
  it("valor diferente de 3490 no mensal da /escolha → ignorado + alarme, sem linha", async () => {
    const m = montarWebhook();
    expect((await mandar(m, evento("invoice.paid", fatura({ amount_paid: 1990 })))).corpo).toMatchObject({ ignorado: "valor" });
    expect(m.db.subscriptions).toHaveLength(0);
  });
});

describe("indique: comissão fixa e o link do comprador da /escolha", () => {
  const q = { id: "a1", pausado: false, email: null, comprador_email: "outra@x.com", comprador_user_id: "u_x", aparelho: null, pix_chave: null, pix_tipo: null };
  const v = { pi: "pi_1", valorCents: 9790, email: "bia@exemplo.com", userId: "u_anon", aparelho: null, cpf: null, jaEraCliente: false, metodo: "card" };
  it("comissão fixa vale no lugar dos 50%; sem ela, 50% do pago (a /oferta igual)", () => {
    expect(decidirIndicacao(q, { ...v, comissaoFixaCents: 3395 }).comissao_cents).toBe(3395);
    expect(decidirIndicacao(q, { ...v, valorCents: 3490, comissaoFixaCents: 3395 }).comissao_cents).toBe(3395);
    expect(decidirIndicacao(q, { ...v, valorCents: 6790 }).comissao_cents).toBe(3395);
    expect(decidirIndicacao(q, v).comissao_cents).toBe(4895);
  });
  it("o vitalício da /escolha dá link de indicação; o PI do mensal não", () => {
    expect(compraValeLink({ id: "pi_1", status: "succeeded", metadata: { ref: REF, pagina: "planos" } }, REF)).toBe(true);
    expect(compraValeLink({ id: "pi_1", status: "succeeded", metadata: { ref: REF, pagina: "planos_mensal" } }, REF)).toBe(false);
    expect(compraValeLink({ id: "pi_1", status: "succeeded", metadata: { ref: REF } }, REF)).toBe(true);
  });
});
