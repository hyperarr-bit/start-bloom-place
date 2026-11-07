/**
 * STRIPE (04/11) — a venda da /oferta (a página atual do /organizar a R$ 67,90, checkout Stripe em tela cheia: Pix + cartão
 * parcelado). As regras do webhook, sem Deno: banco, e-mail, CAPI, push e a Stripe vêm injetados (testado no vitest:
 * src/test/stripe-webhook.test.ts). Mesma régua do Hotmart (_shared/hotmart.ts), com o PaymentIntent no lugar da transação.
 *
 *   assinatura  header stripe-signature "t=…,v1=…" = HMAC-SHA256 de "<t>.<corpo cru>" com STRIPE_WEBHOOK_SECRET (whsec_…),
 *               tolerância de 5 min. Sem secret = 401 sempre.
 *   pago        payment_intent.succeeded, só 6790 BRL e metadata.pagina "oferta" (outro → alarme "Venda Stripe IGNORADA" + push,
 *               1× por PI). Conta: metadata.user_id (a sessão — gravado pelo NOSSO stripe-criar) → e-mail → conta nova; a sessão
 *               de outra conta (outro e-mail) → a compra vai pro e-mail do comprador (stripe_conta_divergente). Libera o
 *               VITALÍCIO pelo creditarPedido (linha nova, payment_method "stripe", abacatepay_billing_id = id do PI). Depois, 1×
 *               por PI: e-mail da compra (falhou → 500 até 5×, depois alarme), stripe_venda (valor, pix|card, parcelas),
 *               Purchase CAPI nos 2 pixels (event_id = id do PI, valor real) e o aviso do dono.
 *   estorno     charge.refunded (total) e charge.dispute.created → a linha daquele PI vira canceled; pago depois não libera.
 * Idempotência: `stripe-evt:<id do evento>` + as travas por PI. Nada de e-mail/segredo no log.
 * CPF (nota fiscal, 04/11): fica SÓ na metadata[cpf] do PaymentIntent na Stripe (gravado pelo atualizar do stripe-criar). Não há
 * tabela própria pra nota no banco, e a linha da assinatura não é lugar de CPF: a nota é emitida lendo o PI na Stripe
 * (Pagamentos → o PI → Metadados → cpf). Este webhook nunca lê, grava ou loga o CPF.
 */
import { creditarPedido } from "./grant-pix.ts";
import { assuntoVenda, htmlVenda } from "./email-venda.ts";
import { acharContaHotmart, eventoPurchaseHotmart, mascararEmail, type AdminHotmart, type RegistroHotmart } from "./hotmart.ts";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };

/** o preço da /oferta (o stripe-criar cobra ISTO; o webhook só libera ISTO) */
export const STRIPE_PRECO_CENTAVOS = 6790;
export const PAGINA_STRIPE = "oferta";
export const GATEWAY_STRIPE = "stripe";
export const OFERTA_STRIPE = "ST_oferta";
export const TOLERANCIA_ASSINATURA_S = 300;
export const MAX_TENTATIVAS_EMAIL = 5;

/* ───────────────────────── assinatura ───────────────────────── */
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export async function hmacHex(secret: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
}
const iguais = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

/** stripe-signature válido? (t dentro da tolerância e algum v1 bate) */
export async function assinaturaOk(corpo: string, header: string | null | undefined, secret: string | null | undefined, agoraS = Math.floor(Date.now() / 1000), tolerancia = TOLERANCIA_ASSINATURA_S): Promise<boolean> {
  if (!secret || !header) return false;
  const partes = header.split(",").map((p) => p.trim().split("="));
  const t = Number(partes.find(([k]) => k === "t")?.[1]);
  const v1 = partes.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!Number.isFinite(t) || !v1.length || Math.abs(agoraS - t) > tolerancia) return false;
  const esperado = await hmacHex(secret, `${t}.${corpo}`);
  return v1.some((v) => iguais(v, esperado));
}

/* ───────────────────────── leitura ───────────────────────── */
export type IntentoStripe = {
  id: string; amount: number; amount_received?: number; currency: string; status: string; livemode?: boolean;
  metadata: Record<string, string>; receipt_email?: string | null; latest_charge?: string | null;
};
const t = (v: unknown, n = 300): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function lerIntento(o: unknown): IntentoStripe | null {
  const x = (o ?? {}) as Record<string, unknown>;
  const id = t(x.id, 80);
  if (!id || !/^pi_/.test(id)) return null;
  const md: Record<string, string> = {};
  for (const [k, v] of Object.entries((x.metadata ?? {}) as Record<string, unknown>)) if (typeof v === "string") md[k] = v.slice(0, 500);
  return {
    id, amount: Number(x.amount) || 0, amount_received: Number(x.amount_received) || 0, currency: String(x.currency ?? "").toLowerCase(),
    status: String(x.status ?? ""), livemode: x.livemode === true, metadata: md, receipt_email: t(x.receipt_email, 254),
    latest_charge: typeof x.latest_charge === "string" ? x.latest_charge : null,
  };
}

/* ───────────────────────── o webhook ───────────────────────── */
export type CobrancaStripe = { metodo: "pix" | "card" | string | null; parcelas: number | null; email?: string | null };
export type DepsStripe = {
  admin: AdminHotmart;
  secret: string | null;
  acharConta: (email: string) => Promise<string | null>;
  enviarEmail: (para: string, assunto: string, html: string) => Promise<boolean>;
  mandarCapi: (corpo: Record<string, unknown>) => Promise<boolean>;
  avisarVenda: (linhaId: string) => Promise<void>;
  avisarDono: (titulo: string, corpo: string, tag: string) => Promise<void>;
  /** a cobrança do PI (método pix/card e parcelas) — GET /v1/charges/<id> no Deno */
  buscarCobranca: (chargeId: string) => Promise<CobrancaStripe | null>;
  log: (passo: string, d?: Record<string, unknown>) => void;
  agora?: () => Date;
};
export type Resposta = { status: number; corpo: Record<string, unknown> };
type Erro = { code?: string; message?: string } | null;

async function reservar(admin: ClienteMin, id: string, event: string): Promise<"ok" | "ja" | "erro"> {
  try {
    const { error } = await admin.from("webhook_events").insert({ id, source: "stripe", event });
    if (!error) return "ok";
    return (error as Erro)?.code === "23505" ? "ja" : "erro";
  } catch { return "erro"; }
}
async function soltar(admin: ClienteMin, id: string) { try { await admin.from("webhook_events").delete().eq("id", id); } catch { /* noop */ } }
async function existe(admin: ClienteMin, id: string): Promise<boolean> {
  try { const { data } = await admin.from("webhook_events").select("id").eq("id", id).maybeSingle(); return !!data; } catch { return false; }
}
async function contarFalhaEmail(admin: ClienteMin, pi: string): Promise<number> {
  for (let n = 1; n <= MAX_TENTATIVAS_EMAIL; n++) {
    const r = await reservar(admin, `stripe-email-falha:${pi}:${n}`, "email_falha");
    if (r === "ok") return n;
    if (r === "erro") return MAX_TENTATIVAS_EMAIL;
  }
  return MAX_TENTATIVAS_EMAIL;
}
const reais = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;

export async function tratarStripe(deps: DepsStripe, req: { assinatura: string | null; corpo: string }): Promise<Resposta> {
  const { admin, log } = deps;
  const agora = deps.agora ? deps.agora() : new Date();
  if (!(await assinaturaOk(req.corpo, req.assinatura, deps.secret, Math.floor(agora.getTime() / 1000)))) {
    log("assinatura recusada", { tem_secret: !!deps.secret, veio: !!req.assinatura });
    return { status: 401, corpo: { ok: false } };
  }
  let evt: { id?: string; type?: string; livemode?: boolean; data?: { object?: Record<string, unknown> } };
  try { evt = JSON.parse(req.corpo); } catch { return { status: 400, corpo: { ok: false } }; }
  // revisão 05/11: evento de TESTE (modo teste da Stripe / "enviar evento de teste") só vai pro log — nunca libera nem desliga
  if (evt.livemode !== true) { log("evento de teste (livemode false) — só log", { tipo: String(evt.type ?? "") }); return { status: 200, corpo: { ok: true, ignorado: "teste" } }; }
  const tipo = String(evt.type ?? ""), evtId = String(evt.id ?? "");
  const obj = evt.data?.object ?? {};
  const TRATA = ["payment_intent.succeeded", "charge.refunded", "charge.dispute.created"];
  if (!evtId || !TRATA.includes(tipo)) { log("evento sem ação", { tipo }); return { status: 200, corpo: { ok: true, ignorado: "evento" } }; }

  const chave = `stripe-evt:${evtId}`;
  if (await reservar(admin, chave, tipo) === "ja") { log("repetido", { tipo, evt: evtId }); return { status: 200, corpo: { ok: true, duplicado: true } }; }

  try {
    /* ── estorno: a linha daquele PI vira canceled; a marca segura um "pago" que chegar depois ── */
    if (tipo !== "payment_intent.succeeded") {
      const pi = t(obj.payment_intent, 80);
      const total = tipo === "charge.dispute.created" || obj.refunded === true;
      if (!pi || !total) { log("estorno parcial ou sem PI — nada a desligar", { tipo, pi }); return { status: 200, corpo: { ok: true, ignorado: "parcial" } }; }
      await reservar(admin, `stripe-estorno:${pi}`, tipo);
      const { error } = await admin.from("subscriptions").update({ status: "canceled" }).eq("abacatepay_billing_id", pi).eq("payment_method", GATEWAY_STRIPE);
      if (error) throw new Error(String((error as Erro)?.message ?? error));
      log("estorno — acesso desligado", { tipo, pi });
      return { status: 200, corpo: { ok: true, desligado: true } };
    }

    const pi = lerIntento(obj);
    if (!pi) { log("PaymentIntent ilegível", {}); return { status: 200, corpo: { ok: true, ignorado: "sem_pi" } }; }
    const valor = pi.amount_received || pi.amount;
    const md = pi.metadata;
    const email = (t(md.email, 254) ?? pi.receipt_email ?? "").toLowerCase() || null;
    const base = { pi: pi.id, valor, moeda: pi.currency, status: pi.status, email: mascararEmail(email), live: pi.livemode };

    const ignorar = async (motivo: string): Promise<Resposta> => {
      log(`venda ignorada: ${motivo}`, base);
      if (await reservar(admin, `stripe-ignorada:${pi.id}`, "ignorada") === "ok") {
        try { await admin.from("analytics_events").insert({ event_name: "stripe_venda_ignorada", user_id: null, event_data: { motivo, pi: pi.id, valor_cents: valor, moeda: pi.currency, pagina: md.pagina ?? null, email: mascararEmail(email) } }); } catch { /* o push ainda sai */ }
        await deps.avisarDono(`⚠️ Venda Stripe IGNORADA: ${motivo}`, `PI ${pi.id} · ${valor ? reais(valor) : "sem valor"} · ${pi.currency || "?"}`, `stripe-ignorada:${pi.id}`).catch(() => {});
      }
      return { status: 200, corpo: { ok: true, ignorado: motivo } };
    };
    if (pi.status !== "succeeded") return ignorar("status");
    if (md.pagina !== PAGINA_STRIPE) return ignorar("outra_pagina");
    if (pi.currency !== "brl" || valor !== STRIPE_PRECO_CENTAVOS) return ignorar("valor");
    if (await existe(admin, `stripe-estorno:${pi.id}`)) return ignorar("estornada");

    // a cobrança (método, parcelas e o e-mail de cobrança): 1 leitura, usada na conta e no stripe_venda
    const cob = pi.latest_charge ? await deps.buscarCobranca(pi.latest_charge).catch(() => null) : null;
    // revisão 2 (1): sem o e-mail na metadata, o billing_details.email da cobrança antes de cair em "sem_conta"
    let emailCompra = email && EMAIL_OK.test(email) ? email : null;
    if (!emailCompra) { const be = (cob?.email ?? "").trim().toLowerCase(); if (EMAIL_OK.test(be)) emailCompra = be; }
    const conta = await acharContaHotmart(admin, { refUserId: t(md.user_id, 64), email: emailCompra, acharConta: deps.acharConta });
    if (!conta) return ignorar("sem_conta");
    log("conta", { ...base, via: conta.via });
    if (conta.divergenteDe && await reservar(admin, `stripe-divergente:${pi.id}`, "divergente") === "ok") {
      try { await admin.from("analytics_events").insert({ event_name: "stripe_conta_divergente", user_id: conta.divergenteDe, event_data: { pi: pi.id, para: conta.userId, via: conta.via } }); } catch { /* registro é luxo */ }
    }

    const emailConta = conta.email ?? emailCompra;
    const g = await creditarPedido(admin, {
      userId: conta.userId, orderId: pi.id, gateway: GATEWAY_STRIPE, concessao: { dias: null }, agora,
      protegerVitalicio: true, offer: OFERTA_STRIPE, linhaNova: true,
      montarPayload: (fim) => ({
        user_id: conta.userId, status: "active", plan: "lifetime", billing_period: "lifetime",
        payment_method: GATEWAY_STRIPE, abacatepay_billing_id: pi.id, customer_email: emailConta, amount_cents: valor,
        current_period_start: agora.toISOString(), current_period_end: fim,
      }),
    });
    if (g.r === "erro" || g.r === "em_andamento") throw new Error(g.r === "erro" ? g.msg : "em_andamento");
    if (g.r === "preservado" || (g.r === "creditado" && g.jaLiberado)) {
      log("nada a creditar (já tinha vitalício)", base);
      return { status: 200, corpo: { ok: true, liberado: true, novo: false } };
    }
    if (g.r === "creditado") log("vitalício liberado", { ...base, acao: g.acao });

    // 1 de cada por PI (reserva em webhook_events) — roda no crédito E no "já creditado" (reenvio)
    let emailFalhou = false;
    if (emailConta && await reservar(admin, `stripe-email:${pi.id}`, "email") === "ok") {
      const ok = await deps.enviarEmail(emailConta, assuntoVenda("lifetime"), htmlVenda({ email: emailConta, nome: null, periodo: "lifetime", fim: g.r === "creditado" ? g.fim : null, hoje: true })).catch(() => false);
      if (!ok) { await soltar(admin, `stripe-email:${pi.id}`); emailFalhou = true; }
      log(ok ? "e-mail da compra enviado" : "e-mail da compra FALHOU", { para: mascararEmail(emailConta) });
    }
    if (await reservar(admin, `stripe-venda:${pi.id}`, "venda") === "ok") {
      let erroVenda: string | null = null;
      try {
        const { error } = await admin.from("analytics_events").insert({ event_name: "stripe_venda", user_id: conta.userId, event_data: { pi: pi.id, pagina: PAGINA_STRIPE, valor_cents: valor, metodo: cob?.metodo ?? null, parcelas: cob?.parcelas ?? null, via: conta.via, ref: md.ref ?? null, ...(md.braco_lp_oferta ? { braco_lp_oferta: md.braco_lp_oferta } : {}) } });
        if (error) erroVenda = String((error as Erro)?.message ?? error);
      } catch (e) { erroVenda = String((e as Error)?.message ?? e); }
      if (erroVenda) { await soltar(admin, `stripe-venda:${pi.id}`); log("stripe_venda não gravou — tenta no próximo reenvio", { pi: pi.id, msg: erroVenda.replace(/[^\s@]+@[^\s@]+/g, "***").slice(0, 120) }); }
    }
    if (await reservar(admin, `stripe-capi:${pi.id}`, "capi") === "ok") {
      const reg: RegistroHotmart = { userId: null, dados: { fbp: md.fbp, fbc: md.fbc, fbclid: md.fbclid, client_ip: md.ip, user_agent: md.ua, source_url: md.url }, criadoEm: md.criado_em ?? null, conflito: false };
      const corpo = await eventoPurchaseHotmart({ tx: pi.id, valorCents: valor, userId: conta.userId, email: emailConta, registro: reg, agoraMs: agora.getTime() });
      for (const d of (corpo.data as Array<Record<string, unknown>>)) {
        (d.custom_data as Record<string, unknown>).content_name = "CORE vitalício (Stripe)";
        if (!md.url) d.event_source_url = "https://www.coreaplicativo.com.br/oferta";
      }
      const ok = await deps.mandarCapi(corpo).catch(() => false);
      log(ok ? "Purchase CAPI enviado" : "Purchase CAPI falhou", { pi: pi.id });
    }
    try {
      const { data } = await admin.from("subscriptions").select("id").eq("abacatepay_billing_id", pi.id).eq("user_id", conta.userId).maybeSingle();
      if (data?.id && g.r === "creditado") await deps.avisarVenda(String(data.id));
    } catch { /* aviso é luxo */ }
    if (emailFalhou) {
      const n = await contarFalhaEmail(admin, pi.id);
      if (n < MAX_TENTATIVAS_EMAIL) throw new Error("email_falhou");
      log("e-mail da compra falhou 5× — desiste e avisa o dono", base);
      if (await reservar(admin, `stripe-email-alarme:${pi.id}`, "alarme") === "ok") {
        try { await admin.from("analytics_events").insert({ event_name: "stripe_email_falhou", user_id: conta.userId, event_data: { pi: pi.id, tentativas: n, email: mascararEmail(emailConta) } }); } catch { /* o push ainda sai */ }
        await deps.avisarDono("⚠️ Stripe: e-mail da compra NÃO saiu", `PI ${pi.id} · ${mascararEmail(emailConta)} · acesso liberado, mande o acesso à mão`, `stripe-email:${pi.id}`).catch(() => {});
      }
    }
    return { status: 200, corpo: { ok: true, liberado: true, novo: g.r === "creditado", via: conta.via } };
  } catch (e) {
    await soltar(admin, chave);
    log("ERRO — a Stripe vai reenviar", { tipo, msg: String((e as Error)?.message ?? e).replace(/[^\s@]+@[^\s@]+/g, "***").slice(0, 160) });
    return { status: 500, corpo: { ok: false } };
  }
}
