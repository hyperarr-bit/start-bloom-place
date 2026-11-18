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
import { COMISSAO_FIXA_PLANOS_CENTS, MENSAL_APP_WEB, MENSAL_PLANOS, OFERTAS_STRIPE, mensalDaPagina, ofertaDaPagina } from "./stripe-ofertas.ts";
import { avisarMensalStripeComVitalicio, registrarPagoEmDobro } from "./landing-travas.ts";
import { PRESENTE_STRIPE, compraIgnorada, donoDaCompra } from "./stripe-presente.ts";
import { garantirPresente, mandarLinkPorEmail } from "./presente.ts";
import { blocoIndiqueEmail, type VendaWeb } from "./indique.ts";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };

/** o preço da /oferta (o stripe-criar cobra ISTO; o webhook só libera ISTO). 14/11: a tabela de ofertas
 *  (_shared/stripe-ofertas.ts) manda — cada página só libera o preço DELA; estas constantes são a linha "oferta". */
export const STRIPE_PRECO_CENTAVOS = OFERTAS_STRIPE.oferta.centavos;
export const PAGINA_STRIPE = OFERTAS_STRIPE.oferta.pagina;
/** 18/11: a /escolha (2 planos) — o vitalício dela tem indique e ganhe com comissão FIXA (COMISSAO_FIXA_PLANOS_CENTS) */
export const PAGINA_PLANOS = OFERTAS_STRIPE.planos.pagina;
/** as páginas cujo vitalício grava venda indicada (o ?ref= da página vira metadata[indicador] do PI) */
const COM_INDIQUE = new Set([PAGINA_STRIPE, PAGINA_PLANOS]);
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
export type CobrancaStripe = { metodo: "pix" | "card" | string | null; parcelas: number | null; email?: string | null; /** 23/11 (indique): digital do cartão */ cartaoFp?: string | null };
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
  /** 14/11 (mensal do /funil-app): a assinatura (GET /v1/subscriptions/<id>) quando a fatura não traz a metadata */
  buscarAssinatura?: (subId: string) => Promise<Record<string, unknown> | null>;
  /** 14/11: a assinatura (sub_…) de um pagamento de FATURA — pelo invoice da cobrança ou do PI (null = não é de fatura / não achou) */
  assinaturaDoPagamento?: (pi: string, invoice: string | null) => Promise<string | null>;
  /** 14/11: cancela a assinatura na Stripe (imediato = já; senão no fim do período). true = a Stripe confirmou */
  cancelarAssinatura?: (subId: string, imediato: boolean) => Promise<boolean>;
  /** 18/11 (revisão /escolha): o PI que pagou a fatura in_… (a API nova manda invoice.payment_intent = null no webhook; o PI fica em
   *  invoice.payments, que só vem expandido). null = não achou. Ver leitoresFaturaStripe. */
  piDaFaturaPaga?: (invoiceId: string) => Promise<string | null>;
  /** 18/11 (revisão /escolha): a fatura in_… de um PI (estorno do mensal: a comissão pode ter sido gravada com o id da fatura).
   *  null = o PI não é de fatura. Lança se a Stripe não respondeu. Ver leitoresFaturaStripe. */
  faturaDoPagamento?: (pi: string) => Promise<string | null>;
  /** 23/11 (indique e ganhe, ./indique.ts): grava a venda indicada (metadata.indicador) e cancela no estorno. Erro → lança (500, a Stripe reenvia) */
  indique?: {
    registrar: (indicador: string, venda: VendaWeb) => Promise<unknown>;
    /** parcial = devolução de parte do valor (críticas 17/11: também cancela a comissão, mas não pausa o link de ninguém) */
    cancelar: (pi: string, opts?: { parcial?: boolean }) => Promise<unknown>;
  };
  /** 17/11: o bloco "Indique e ganhe" no e-mail de acesso da /oferta (envs INDIQUE_WEB=on + INDIQUE_EMAIL=on) — leva pra /indique */
  indiqueNoEmail?: boolean;
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
/** revisão A2: o presente que chega antes da compra principal espera até 5 reenvios da Stripe; depois, alarme */
export const MAX_ESPERA_PRESENTE = 5;
async function contarEsperaPresente(admin: ClienteMin, pi: string): Promise<number> {
  for (let n = 1; n <= MAX_ESPERA_PRESENTE; n++) {
    const r = await reservar(admin, `stripe-presente-espera:${pi}:${n}`, "espera");
    if (r === "ok") return n;
    if (r === "erro") return 1;
  }
  return MAX_ESPERA_PRESENTE;
}
const reais = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
/** 23/11: a comissão de indicação não gravou/cancelou — 1 alarme por PI (push + analytics), sem e-mail no corpo */
async function alarmeIndique(deps: DepsStripe, pi: string, onde: "venda" | "estorno", e: unknown, indicador?: string | null): Promise<void> {
  const msg = String((e as Error)?.message ?? e).replace(/[^\s@]+@[^\s@]+/g, "***").slice(0, 160);
  deps.log("indique — FALHOU (alarme)", { pi, onde, msg });
  if (await reservar(deps.admin, `stripe-indique-alarme:${onde}:${pi}`, "alarme") !== "ok") return;
  // críticas 17/11: o evento guarda o indicador — o pagar_semana tenta de novo sozinho (e o /admin tem "Reprocessar comissão" pelo PI)
  try { await deps.admin.from("analytics_events").insert({ event_name: "indique_falhou", user_id: null, event_data: { pi, onde, msg, ...(indicador ? { indicador: String(indicador).slice(0, 64) } : {}) } }); } catch { /* o push ainda sai */ }
  await deps.avisarDono(`⚠️ Indique e ganhe: ${onde === "venda" ? "comissão NÃO gravou" : "estorno NÃO cancelou a comissão"}`, `PI ${pi} · ${onde === "venda" ? "o Pix de segunda tenta de novo; ou /admin/afiliados → Reprocessar" : "confira no /admin/afiliados"}`, `stripe-indique:${onde}:${pi}`).catch(() => {});
}
/** estorno (inteiro ou parcial) → a comissão cai; se o Pix dela JÁ saiu, push pro dono (o próximo Pix do link desconta) */
async function cancelarIndique(deps: DepsStripe, pi: string, parcial: boolean, invoiceDoCharge: string | null = null): Promise<void> {
  try {
    const ci = await deps.indique!.cancelar(pi, parcial ? { parcial: true } : undefined) as { venda?: string; comissao_cents?: number } | null;
    deps.log("indique — estorno", { pi, parcial, ...(ci && typeof ci === "object" ? ci as Record<string, unknown> : {}) });
    if (ci?.venda === "ja_paga" && await reservar(deps.admin, `stripe-indique-ja-paga:${pi}`, "alarme") === "ok") {
      await deps.avisarDono("⚠️ Indique e ganhe: devolução DEPOIS do Pix da comissão", `PI ${pi} · ${reais(Number(ci.comissao_cents ?? 0))} já pagos · o próximo Pix desse link desconta (ou segura, se não cobrir)`, `stripe-indique-ja-paga:${pi}`).catch(() => {});
    }
    // 18/11 (revisão /escolha): a comissão do MENSAL pode ter sido gravada com o id da FATURA (in_…) — webhook na API nova sem o PI
    // na fatura. Nada achado pelo PI → acha a fatura do pagamento e cancela por ela também. A venda avulsa (/oferta) é achada pelo PI
    // e nunca chega aqui com comissão; sem comissão, é 1 leitura a mais na Stripe (o PI não tem fatura → para).
    if (ci && typeof ci === "object" && ci.venda !== "nenhuma") return;
    const inv = invoiceDoCharge && /^in_/.test(invoiceDoCharge) ? invoiceDoCharge : deps.faturaDoPagamento ? await deps.faturaDoPagamento(pi) : null;
    if (!inv) return;
    // a marca segura uma comissão gravada DEPOIS deste estorno com o id da fatura (registrarIndicacaoWeb confere stripe-estorno:<chave>)
    await reservar(deps.admin, `stripe-estorno:${inv}`, "estorno");
    const cf = await deps.indique!.cancelar(inv, parcial ? { parcial: true } : undefined) as { venda?: string; comissao_cents?: number } | null;
    deps.log("indique — estorno pela fatura", { pi, fatura: inv, parcial, ...(cf && typeof cf === "object" ? cf as Record<string, unknown> : {}) });
    if (cf?.venda === "ja_paga" && await reservar(deps.admin, `stripe-indique-ja-paga:${inv}`, "alarme") === "ok") {
      await deps.avisarDono("⚠️ Indique e ganhe: devolução DEPOIS do Pix da comissão", `Fatura ${inv} (PI ${pi}) · ${reais(Number(cf.comissao_cents ?? 0))} já pagos · o próximo Pix desse link desconta (ou segura, se não cobrir)`, `stripe-indique-ja-paga:${inv}`).catch(() => {});
    }
  } catch (e) { await alarmeIndique(deps, pi, "estorno", e); }
}

/**
 * 18/11 (revisão /escolha): as 2 leituras da fatura que o webhook usa na comissão do mensal, nas 2 formas da API:
 *  - piDaFaturaPaga(in_…): GET /invoices/<id>?expand[]=payments (versão nova) → o PI de payments.data[].payment.payment_intent
 *    (ou o invoice.payment_intent, se a conta responder no formato antigo);
 *  - faturaDoPagamento(pi_…): GET /invoice_payments?payment[type]=payment_intent&payment[payment_intent]=<pi> (versão nova) →
 *    data[0].invoice; se a lista não existir/estiver vazia, GET /payment_intents/<pi> na 2024-06-20 → o campo invoice.
 * `get` devolve o JSON (ok) ou null (não achou / 404); lança quando a Stripe não respondeu (o estorno vira alarme pro dono).
 */
export function leitoresFaturaStripe(get: (caminho: string, versao: string) => Promise<Record<string, unknown> | null>, versaoNova: string, versaoAntiga = "2024-06-20") {
  return {
    piDaFaturaPaga: async (invoiceId: string): Promise<string | null> => {
      if (!/^in_[A-Za-z0-9]+$/.test(invoiceId)) return null;
      const j = await get(`invoices/${invoiceId}?expand[]=payments`, versaoNova);
      return j ? piDaFaturaWebhook(j) : null;
    },
    faturaDoPagamento: async (pi: string): Promise<string | null> => {
      if (!/^pi_[A-Za-z0-9]+$/.test(pi)) return null;
      const lista = await get(`invoice_payments?payment[type]=payment_intent&payment[payment_intent]=${pi}&limit=1`, versaoNova).catch(() => null);
      for (const x of ((lista?.data as Array<{ invoice?: unknown }> | undefined) ?? [])) {
        const inv = typeof x.invoice === "string" ? x.invoice : String((x.invoice as { id?: string } | null | undefined)?.id ?? "");
        if (/^in_/.test(inv)) return inv;
      }
      const p = await get(`payment_intents/${pi}`, versaoAntiga);
      const inv = p ? (typeof p.invoice === "string" ? p.invoice : String((p.invoice as { id?: string } | null | undefined)?.id ?? "")) : "";
      return /^in_/.test(inv) ? inv : null;
    },
  };
}

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
  const TRATA = ["payment_intent.succeeded", "charge.refunded", "charge.dispute.created", ...EVENTOS_ASSINATURA];
  if (!evtId || !TRATA.includes(tipo)) { log("evento sem ação", { tipo }); return { status: 200, corpo: { ok: true, ignorado: "evento" } }; }

  const chave = `stripe-evt:${evtId}`;
  if (await reservar(admin, chave, tipo) === "ja") { log("repetido", { tipo, evt: evtId }); return { status: 200, corpo: { ok: true, duplicado: true } }; }

  try {
    /* ── 14/11: o mensal do /funil-app (assinatura recorrente no cartão) ── */
    if (EVENTOS_ASSINATURA.includes(tipo)) return await tratarAssinatura(deps, tipo, obj, agora);
    /* ── estorno: a linha daquele PI vira canceled; a marca segura um "pago" que chegar depois ── */
    if (tipo !== "payment_intent.succeeded") {
      const pi = t(obj.payment_intent, 80);
      const total = tipo === "charge.dispute.created" || obj.refunded === true;
      if (!pi || !total) {
        // críticas 17/11: devolução PARCIAL também cancela a comissão (nunca 50% cheio de uma venda que rendeu menos); o acesso fica
        if (pi && deps.indique && Number(obj.amount_refunded ?? 0) > 0) await cancelarIndique(deps, pi, true, t(obj.invoice, 80));
        log("estorno parcial ou sem PI — nada a desligar", { tipo, pi });
        return { status: 200, corpo: { ok: true, ignorado: "parcial" } };
      }
      // 23/11 (indique e ganhe): a comissão daquela venda cai; se era a compra de quem indica, o link dela é pausado
      // (erro aqui não segura o corte do acesso: alarme pro dono conferir a comissão no /admin)
      if (deps.indique) await cancelarIndique(deps, pi, false, t(obj.invoice, 80));
      // 14/11: a linha pode ser do vitalício (pedido = PI) OU do mensal (pedido = a assinatura da fatura estornada)
      const { data: doPi, error: erroDoPi } = await admin.from("subscriptions").select("id").eq("abacatepay_billing_id", pi).eq("payment_method", GATEWAY_STRIPE);
      // revisão 2: banco sem resposta → 500 (a Stripe reenvia); nunca "nada a cortar" no escuro
      if (erroDoPi) throw new Error(String((erroDoPi as Erro)?.message ?? erroDoPi));
      let alvo = pi;
      let sub: string | null = null;
      if (!((doPi ?? []) as unknown[]).length) {
        const inv = typeof obj.invoice === "string" ? obj.invoice : null;
        // sem conseguir ler a Stripe → 500 (ela reenvia); nunca "desligado" sem saber de quem é a cobrança
        sub = deps.assinaturaDoPagamento ? await deps.assinaturaDoPagamento(pi, inv) : null;
        if (!sub) {
          // estorno que chegou ANTES do pago (fora de ordem): a marca segura o "pago" que vier depois
          await reservar(admin, `stripe-estorno:${pi}`, tipo);
          log("estorno sem linha nossa ainda — marcado (o pago que chegar depois não libera)", { tipo, pi });
          return { status: 200, corpo: { ok: true, desligado: false, marcado: true } };
        }
        alvo = sub;
      }
      await reservar(admin, `stripe-estorno:${pi}`, tipo);
      if (sub) {
        // mensal estornado/contestado: a Stripe não pode cobrar de novo — cancela JÁ; sem a confirmação dela, a Stripe reenvia.
        // revisão 2: já encerrada na Stripe (cancelou antes, ou estorno + contestação) = ok — a Stripe recusa DELETE nela
        const agora2 = deps.buscarAssinatura ? await deps.buscarAssinatura(sub).catch(() => null) : null;
        const jaEncerrada = ["canceled", "incomplete_expired"].includes(String(agora2?.status ?? ""));
        const ok = jaEncerrada || (deps.cancelarAssinatura ? await deps.cancelarAssinatura(sub, true).catch(() => false) : false);
        if (!ok) throw new Error("cancelar_assinatura_falhou");
      }
      const { error } = await admin.from("subscriptions").update({ status: "canceled" }).eq("abacatepay_billing_id", alvo).eq("payment_method", GATEWAY_STRIPE);
      if (error) throw new Error(String((error as Erro)?.message ?? error));
      log("estorno — acesso desligado", { tipo, pi, sub });
      return { status: 200, corpo: { ok: true, desligado: true, ...(sub ? { sub } : {}) } };
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
    // 14/11: o PI de uma FATURA de assinatura (o mensal do /funil-app) é tratado no invoice.paid — sem alarme aqui
    if (await ehPiDeFaturaNossa(deps, obj, md, pi.id)) { log("PI de fatura de assinatura — fica pro invoice.paid", { pi: pi.id }); return { status: 200, corpo: { ok: true, ignorado: "fatura" } }; }
    // 15/11: o PRESENTE de R$ 24,90 da /oferta (_shared/stripe-presente.ts) — vira o código do presente na conta de quem comprou;
    // NÃO libera nada pra quem pagou e NÃO manda Purchase pra Meta (upsell). Sem a conta da compra principal ainda → 500 (a Stripe reenvia).
    if (md.pagina === PRESENTE_STRIPE.pagina) {
      if (pi.currency !== "brl" || valor !== PRESENTE_STRIPE.centavos) return ignorar("valor_presente");
      if (await existe(admin, `stripe-estorno:${pi.id}`)) return ignorar("estornada");
      const principal = t(md.pi_principal, 80);
      // revisão A2: a conta da compra também pelo pago em dobro e pelo e-mail (só leitura); sem ela, alarme pro dono — nunca 3 dias de reenvio mudo
      // revisão 2 (M-novo-1): 1º a linha da compra / o pago em dobro / o user_id da sessão (o mesmo que a principal prefere); o e-mail só no
      // ÚLTIMO envio, depois de esperar a compra principal (senão o presente podia ir pra outra conta da mesma pessoa)
      const contaExiste = async (uid: string) => { const u = await (admin as unknown as { auth?: { admin?: { getUserById?: (id: string) => Promise<{ data?: { user?: unknown } }> } } }).auth?.admin?.getUserById?.(uid).catch(() => null); return !!u?.data?.user; };
      let dono = principal ? await donoDaCompra(admin as unknown as ClienteMin, principal, { userId: t(md.user_id, 64), existe: contaExiste }) : null;
      if (!dono) {
        const ignorada = principal ? await compraIgnorada(admin as unknown as ClienteMin, principal) : true;
        const n = ignorada ? MAX_ESPERA_PRESENTE : await contarEsperaPresente(admin, pi.id);
        if (n < MAX_ESPERA_PRESENTE) throw new Error("presente_sem_conta_da_compra"); // a compra principal ainda não chegou: a Stripe reenvia
        if (principal && !ignorada) dono = await donoDaCompra(admin as unknown as ClienteMin, principal, { email, acharConta: deps.acharConta });
      }
      if (!dono) {
        log("presente pago SEM conta da compra — alarme", { pi: pi.id, principal });
        if (await reservar(admin, `stripe-presente-sem-conta:${pi.id}`, "alarme") === "ok") {
          try { await admin.from("analytics_events").insert({ event_name: "stripe_presente_sem_conta", user_id: null, event_data: { pi: pi.id, pi_principal: principal, valor_cents: valor, email: mascararEmail(email) } }); } catch { /* o push ainda sai */ }
          await deps.avisarDono("⚠️ Presente Stripe pago SEM conta", `PI ${pi.id} · ${reais(valor)} · compra ${principal ?? "?"} · gere o código à mão ou devolva`, `stripe-presente-sem-conta:${pi.id}`).catch(() => {});
        }
        return { status: 200, corpo: { ok: true, presente: true, sem_conta: true } };
      }
      const g = await garantirPresente(admin as unknown as ClienteMin, { orderId: pi.id, compradorId: dono, valorCentavos: PRESENTE_STRIPE.centavos });
      if (!g) throw new Error("presente_nao_gravou");
      if (await reservar(admin, `stripe-venda:${pi.id}`, "venda") === "ok") {
        const cob = pi.latest_charge ? await deps.buscarCobranca(pi.latest_charge).catch(() => null) : null;
        try { await admin.from("analytics_events").insert({ event_name: "stripe_presente_venda", user_id: dono, event_data: { pi: pi.id, pi_principal: principal, pagina: PRESENTE_STRIPE.pagina, valor_cents: valor, metodo: cob?.metodo ?? null, ref: md.ref ?? null } }); } catch { /* registro é luxo */ }
      }
      const r = await mandarLinkPorEmail(admin as unknown as ClienteMin, {
        orderId: pi.id, codigo: g.codigo, para: email, de: "",
        enviar: (c) => deps.enviarEmail(String((c.to as string[])[0]), String(c.subject), String(c.html)),
      });
      log("presente (Stripe) pago", { pi: pi.id, novo: g.novo, email: r });
      return { status: 200, corpo: { ok: true, presente: true, novo: g.novo } };
    }
    const oferta = ofertaDaPagina(md.pagina);
    if (!oferta) return ignorar("outra_pagina");
    if (pi.currency !== "brl" || valor !== oferta.centavos) return ignorar("valor");
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
      protegerVitalicio: true, offer: oferta.pagina === PAGINA_STRIPE ? OFERTA_STRIPE : oferta.offer, linhaNova: true,
      // revisão 2: aqui a renovação do mensal é cancelada na Stripe (cancelarMensalPorVitalicio); o chamado só sai se falhar
      avisarMensalStripe: false,
      montarPayload: (fim) => ({
        user_id: conta.userId, status: "active", plan: "lifetime", billing_period: "lifetime",
        payment_method: GATEWAY_STRIPE, abacatepay_billing_id: pi.id, customer_email: emailConta, amount_cents: valor,
        current_period_start: agora.toISOString(), current_period_end: fim,
      }),
    });
    if (g.r === "erro" || g.r === "em_andamento") throw new Error(g.r === "erro" ? g.msg : "em_andamento");
    // 23/11 (indique e ganhe): a venda veio por um link de indicação → grava a comissão (1× por PI; as travas de autoindicação
    // moram em ./indique.ts). Antes do "nada a creditar": num reenvio da Stripe a linha já existe e nada muda.
    // Erro aqui NUNCA segura a entrega de quem comprou (e-mail, CAPI): alarme pro dono e segue.
    if (deps.indique && md.indicador && COM_INDIQUE.has(oferta.pagina)) {
      try {
        const ri = await deps.indique.registrar(md.indicador, {
          pi: pi.id, valorCents: valor, email: emailConta ?? emailCompra, userId: conta.userId, aparelho: t(md.aparelho, 64), cpf: t(md.cpf, 14),
          jaEraCliente: g.r === "preservado", metodo: cob?.metodo ?? null, cartaoFp: cob?.cartaoFp ?? null, ip: t(md.ip, 64),
          // 18/11 (/escolha): comissão FIXA de R$ 33,95 (no lugar dos 50% do valor pago)
          ...(oferta.pagina === PAGINA_PLANOS ? { comissaoFixaCents: COMISSAO_FIXA_PLANOS_CENTS, produto: "web_planos_vitalicio" } : {}),
        });
        log("indique — venda indicada", { pi: pi.id, ...(ri && typeof ri === "object" ? ri as Record<string, unknown> : {}) });
      } catch (e) { await alarmeIndique(deps, pi.id, "venda", e, md.indicador); }
    }
    if (g.r === "preservado" || (g.r === "creditado" && g.jaLiberado)) {
      log("nada a creditar (já tinha vitalício)", base);
      return { status: 200, corpo: { ok: true, liberado: true, novo: false } };
    }
    if (g.r === "creditado") log("vitalício liberado", { ...base, acao: g.acao });
    // 14/11: comprou o vitalício com o mensal da Stripe cobrando → a renovação é cancelada (o mês pago segue até o fim)
    if (g.r === "creditado") await cancelarMensalPorVitalicio(deps, conta.userId, pi.id);

    // 1 de cada por PI (reserva em webhook_events) — roda no crédito E no "já creditado" (reenvio)
    let emailFalhou = false;
    if (emailConta && await reservar(admin, `stripe-email:${pi.id}`, "email") === "ok") {
      const ok = await deps.enviarEmail(emailConta, assuntoVenda("lifetime"), htmlVenda({ email: emailConta, nome: null, periodo: "lifetime", fim: g.r === "creditado" ? g.fim : null, hoje: true, ...(deps.indiqueNoEmail && COM_INDIQUE.has(oferta.pagina) ? { extra: blocoIndiqueEmail() } : {}) })).catch(() => false);
      if (!ok) { await soltar(admin, `stripe-email:${pi.id}`); emailFalhou = true; }
      log(ok ? "e-mail da compra enviado" : "e-mail da compra FALHOU", { para: mascararEmail(emailConta) });
    }
    if (await reservar(admin, `stripe-venda:${pi.id}`, "venda") === "ok") {
      let erroVenda: string | null = null;
      try {
        const { error } = await admin.from("analytics_events").insert({ event_name: "stripe_venda", user_id: conta.userId, event_data: { pi: pi.id, pagina: oferta.pagina, plano: "vitalicio", valor_cents: valor, metodo: cob?.metodo ?? null, parcelas: cob?.parcelas ?? null, via: conta.via, ref: md.ref ?? null, ...(md.braco_lp_oferta ? { braco_lp_oferta: md.braco_lp_oferta } : {}) } });
        if (error) erroVenda = String((error as Erro)?.message ?? error);
      } catch (e) { erroVenda = String((e as Error)?.message ?? e); }
      if (erroVenda) { await soltar(admin, `stripe-venda:${pi.id}`); log("stripe_venda não gravou — tenta no próximo reenvio", { pi: pi.id, msg: erroVenda.replace(/[^\s@]+@[^\s@]+/g, "***").slice(0, 120) }); }
    }
    if (await reservar(admin, `stripe-capi:${pi.id}`, "capi") === "ok") {
      const reg: RegistroHotmart = { userId: null, dados: { fbp: md.fbp, fbc: md.fbc, fbclid: md.fbclid, client_ip: md.ip, user_agent: md.ua, source_url: md.url }, criadoEm: md.criado_em ?? null, conflito: false };
      const corpo = await eventoPurchaseHotmart({ tx: pi.id, valorCents: valor, userId: conta.userId, email: emailConta, registro: reg, agoraMs: agora.getTime() });
      for (const d of (corpo.data as Array<Record<string, unknown>>)) {
        (d.custom_data as Record<string, unknown>).content_name = oferta.contentName;
        if (!md.url) d.event_source_url = oferta.urlPadrao;
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

/* ───────────────────────── 14/11: o MENSAL do /funil-app (assinatura recorrente no cartão) ─────────────────────────
 *   invoice.paid                   1ª fatura → acha a conta (metadata da assinatura: user_id da sessão → e-mail) e grava a
 *                                  linha mensal (plan/billing_period "monthly", payment_method "stripe", abacatepay_billing_id =
 *                                  id da assinatura, current_period_end = fim do período da fatura) + e-mail + stripe_venda +
 *                                  Purchase CAPI (event_id = id da assinatura, R$ 34,90) + aviso. Renovação → a MESMA linha
 *                                  ganha o fim novo e volta a "active" (stripe_assinatura_renovou). Só 3490 BRL.
 *   invoice.payment_failed         a linha vira "past_due" (o acesso segue até o fim do período + a carência de 7 dias do
 *                                  check-subscription; a Stripe tenta de novo e um invoice.paid depois devolve "active").
 *   customer.subscription.updated  cancelou no fim do período → "cancel_scheduled" (acesso até o fim, sem carência); desfez
 *                                  o cancelamento → "active".
 *   customer.subscription.deleted  acabou de vez → "canceled".
 * Assinatura que não é do /funil-app (metadata.pagina ≠ app_web_mensal e nenhuma linha nossa) → só log.
 * As versões da API mudam onde a assinatura mora na fatura (invoice.subscription × invoice.parent.subscription_details):
 * as duas são lidas. */
export const EVENTOS_ASSINATURA = ["invoice.paid", "invoice.payment_failed", "customer.subscription.updated", "customer.subscription.deleted"];

/** o PI é de uma fatura de assinatura NOSSA (o mensal do /funil-app)? Só silencia o alarme quando a assinatura é conhecida:
 *  a 1ª fatura tem metadata app_web_mensal; as renovações são achadas pela assinatura (linha nossa ou metadata dela).
 *  PI sem página que não for de assinatura nossa continua caindo no "Venda Stripe IGNORADA" (com push). */
export async function ehPiDeFaturaNossa(deps: DepsStripe, obj: Record<string, unknown>, md: Record<string, string>, piId: string): Promise<boolean> {
  if (mensalDaPagina(md.pagina)) return true; // 18/11: o /funil-app e a /escolha
  if (md.pagina) return false;
  const pareceFatura = !!obj.invoice || /^Subscription/i.test(String(obj.description ?? "")) || (typeof obj.customer === "string" && !!obj.customer);
  if (!pareceFatura || !deps.assinaturaDoPagamento) return false;
  const sub = await deps.assinaturaDoPagamento(piId, typeof obj.invoice === "string" ? obj.invoice : null).catch(() => null);
  if (!sub) return false;
  if (await linhaDaAssinatura(deps.admin as unknown as ClienteMin, sub)) return true;
  const s = deps.buscarAssinatura ? await deps.buscarAssinatura(sub).catch(() => null) : null;
  return !!mensalDaPagina(((s?.metadata ?? {}) as Record<string, unknown>).pagina);
}

/** o vitalício entrou por cima de um mensal da Stripe vivo: cancela a renovação no fim do período (sem cobrar de novo) + avisa */
async function cancelarMensalPorVitalicio(deps: DepsStripe, userId: string, pedido: string): Promise<void> {
  try {
    const { data } = await deps.admin.from("subscriptions").select("id, status, billing_period, payment_method, abacatepay_billing_id").eq("user_id", userId);
    const vivos = ((data ?? []) as Array<{ id: string; status?: string; billing_period?: string; payment_method?: string; abacatepay_billing_id?: string }>)
      .filter((l) => l.payment_method === GATEWAY_STRIPE && l.billing_period === "monthly" && (l.status === "active" || l.status === "past_due") && /^sub_/.test(String(l.abacatepay_billing_id ?? ""))); // cancel_scheduled já foi
    for (const l of vivos) {
      const ok = deps.cancelarAssinatura ? await deps.cancelarAssinatura(String(l.abacatepay_billing_id), false).catch(() => false) : false;
      if (ok) await deps.admin.from("subscriptions").update({ status: "cancel_scheduled" }).eq("id", l.id);
      deps.log(ok ? "mensal cancelado no fim do período (comprou o vitalício)" : "mensal NÃO cancelou (comprou o vitalício) — chamado aberto", { sub: l.abacatepay_billing_id, pedido });
      if (!ok) await avisarMensalStripeComVitalicio(deps.admin as never, { userId, sub: String(l.abacatepay_billing_id), pedido, origem: "Stripe (cancelar falhou)" }).catch(() => false);
      await deps.avisarDono(ok ? "Mensal Stripe cancelado: comprou o vitalício" : "⚠️ Comprou o vitalício e o mensal Stripe NÃO cancelou", `Assinatura ${l.abacatepay_billing_id} · vitalício ${pedido}${ok ? " · a renovação não acontece mais" : " · cancele na Stripe"}`, `stripe-mensal-vit:${l.abacatepay_billing_id}`).catch(() => {});
    }
  } catch (e) {
    // revisão 3: nada de engolir — sem conferir o mensal, o dono é avisado (o mensal pode seguir cobrando por cima do vitalício)
    deps.log("não deu pra conferir/cancelar o mensal (comprou o vitalício)", { pedido, msg: String((e as Error)?.message ?? e).slice(0, 80) });
    await deps.avisarDono("⚠️ Comprou o vitalício: não consegui conferir o mensal Stripe", `Vitalício ${pedido} · confira na Stripe se há mensal cobrando e cancele`, `stripe-mensal-vit-erro:${pedido}`).catch(() => {});
  }
}

type Fatura = { id: string; sub: string | null; meta: Record<string, string>; valor: number; moeda: string; fimS: number | null; inicioS: number | null; motivo: string; email: string | null; tentativa: number; /** 18/11: o PI que pagou a fatura (versão antiga: payment_intent; nova: payments) — a chave da comissão do mensal */ pi: string | null };
export function lerFatura(o: Record<string, unknown>): Fatura | null {
  const id = t(o.id, 80);
  if (!id || !/^in_/.test(id)) return null;
  const pai = (o.parent ?? {}) as { subscription_details?: { subscription?: unknown; metadata?: Record<string, unknown> } };
  const subAntigo = typeof o.subscription === "string" ? o.subscription : (o.subscription as { id?: string } | null)?.id ?? null;
  const sub = subAntigo ?? (typeof pai.subscription_details?.subscription === "string" ? pai.subscription_details.subscription : null);
  const metaCru = ((o.subscription_details as { metadata?: Record<string, unknown> } | undefined)?.metadata ?? pai.subscription_details?.metadata ?? {}) as Record<string, unknown>;
  const meta: Record<string, string> = {};
  for (const [k, v] of Object.entries(metaCru)) if (typeof v === "string") meta[k] = v.slice(0, 500);
  const linha = (((o.lines as { data?: unknown[] } | undefined)?.data ?? [])[0] ?? {}) as { period?: { end?: number; start?: number } };
  return {
    id, sub, meta, valor: Number(o.amount_paid) || 0, moeda: String(o.currency ?? "").toLowerCase(),
    fimS: Number(linha.period?.end) || Number(o.period_end) || null, inicioS: Number(linha.period?.start) || Number(o.period_start) || null,
    motivo: String(o.billing_reason ?? ""), email: t(o.customer_email, 254)?.toLowerCase() ?? null, tentativa: Number(o.attempt_count) || 0,
    pi: piDaFaturaWebhook(o),
  };
}
/** 18/11: o PI de uma fatura, nas 2 formas da API (payment_intent | payments.data[].payment.payment_intent) */
function piDaFaturaWebhook(o: Record<string, unknown>): string | null {
  const v = o.payment_intent;
  const direto = typeof v === "string" ? v : String((v as { id?: string } | null | undefined)?.id ?? "");
  if (/^pi_/.test(direto)) return direto;
  for (const x of ((o.payments as { data?: Array<{ payment?: { payment_intent?: unknown } }> } | undefined)?.data ?? [])) {
    const p = x.payment?.payment_intent;
    const id = typeof p === "string" ? p : String((p as { id?: string } | null | undefined)?.id ?? "");
    if (/^pi_/.test(id)) return id;
  }
  return null;
}
/** o fim do período da assinatura (versões novas: no item) */
function fimDaAssinatura(s: Record<string, unknown>): number | null {
  const doItem = Number((((s.items as { data?: unknown[] } | undefined)?.data ?? [])[0] as { current_period_end?: number } | undefined)?.current_period_end);
  return Number(s.current_period_end) || doItem || null;
}

async function linhaDaAssinatura(admin: ClienteMin, sub: string): Promise<{ id: string; user_id: string; status: string; current_period_end: string | null } | null> {
  try {
    const { data } = await admin.from("subscriptions").select("id, user_id, status, current_period_end").eq("abacatepay_billing_id", sub).eq("payment_method", GATEWAY_STRIPE).maybeSingle();
    return (data as { id: string; user_id: string; status: string; current_period_end: string | null } | null) ?? null;
  } catch { return null; }
}

async function tratarAssinatura(deps: DepsStripe, tipo: string, obj: Record<string, unknown>, agora: Date): Promise<Resposta> {
  const { admin, log } = deps;
  const iso = (s: number) => new Date(s * 1000).toISOString();

  if (tipo === "customer.subscription.updated" || tipo === "customer.subscription.deleted") {
    const subId = t(obj.id, 80);
    if (!subId || !/^sub_/.test(subId)) return { status: 200, corpo: { ok: true, ignorado: "sem_sub" } };
    const linha = await linhaDaAssinatura(admin, subId);
    if (!linha) { log("assinatura sem linha nossa — nada a fazer", { tipo, sub: subId }); return { status: 200, corpo: { ok: true, ignorado: "sem_linha" } }; }
    // 14/11 (revisão): eventos chegam fora de ordem — vale o estado ATUAL da assinatura na Stripe, não o do evento.
    // Sem conseguir ler a Stripe, nada é gravado (500 → a Stripe reenvia).
    let atual: Record<string, unknown> = obj;
    if (deps.buscarAssinatura) {
      const a = await deps.buscarAssinatura(subId).catch(() => null);
      if (!a) throw new Error("assinatura_ilegivel");
      atual = a;
    }
    const fim = fimDaAssinatura(atual);
    if (tipo === "customer.subscription.deleted" || String(atual.status) === "canceled" || String(atual.status) === "incomplete_expired") {
      const { error } = await admin.from("subscriptions").update({ status: "canceled" }).eq("id", linha.id);
      if (error) throw new Error(String((error as Erro)?.message ?? error));
      try { await admin.from("analytics_events").insert({ event_name: "stripe_assinatura_cancelada", user_id: linha.user_id, event_data: { sub: subId, quando: "fim" } }); } catch { /* registro é luxo */ }
      log("assinatura encerrada — acesso desligado", { sub: subId });
      return { status: 200, corpo: { ok: true, desligado: true } };
    }
    const agendou = atual.cancel_at_period_end === true || (Number(atual.cancel_at) > 0 && String(atual.status) === "active");
    if (agendou && linha.status !== "canceled") {
      const { error } = await admin.from("subscriptions").update({ status: "cancel_scheduled", ...(fim ? { current_period_end: iso(fim) } : {}) }).eq("id", linha.id);
      if (error) throw new Error(String((error as Erro)?.message ?? error));
      if (linha.status !== "cancel_scheduled") { try { await admin.from("analytics_events").insert({ event_name: "stripe_assinatura_cancelada", user_id: linha.user_id, event_data: { sub: subId, quando: "agendado" } }); } catch { /* luxo */ } }
      log("cancelamento agendado pro fim do período", { sub: subId });
      return { status: 200, corpo: { ok: true, agendado: true } };
    }
    if (!agendou && linha.status === "cancel_scheduled" && String(atual.status) === "active") {
      await admin.from("subscriptions").update({ status: "active" }).eq("id", linha.id);
      log("cancelamento desfeito", { sub: subId });
      return { status: 200, corpo: { ok: true, reativado: true } };
    }
    return { status: 200, corpo: { ok: true, ignorado: "sem_mudanca" } };
  }

  const f = lerFatura(obj);
  if (!f?.sub) { log("fatura sem assinatura", { tipo }); return { status: 200, corpo: { ok: true, ignorado: "sem_sub" } }; }
  let meta = f.meta;
  if (!meta.pagina && deps.buscarAssinatura) {
    const s = await deps.buscarAssinatura(f.sub).catch(() => null);
    const m = (s?.metadata ?? {}) as Record<string, unknown>;
    meta = {}; for (const [k, v] of Object.entries(m)) if (typeof v === "string") meta[k] = v.slice(0, 500);
  }
  const linha = await linhaDaAssinatura(admin, f.sub);
  if (!mensalDaPagina(meta.pagina) && !linha) { log("fatura de assinatura que não é nossa (/funil-app ou /escolha)", { tipo, sub: f.sub }); return { status: 200, corpo: { ok: true, ignorado: "outra_assinatura" } }; }
  // 18/11: a regra do mensal desta assinatura (/funil-app ou /escolha). Sem página (renovação de linha antiga) = a do /funil-app.
  const mensal = mensalDaPagina(meta.pagina) ?? MENSAL_APP_WEB;
  const doPlanos = mensal.pagina === MENSAL_PLANOS.pagina;
  const metodoMensal = meta.metodo === "pix" ? "pix" : "card";

  if (tipo === "invoice.payment_failed") {
    // 14/11 (revisão): falha ATRASADA de uma fatura que já foi paga (2ª tentativa ok) não pode derrubar pra past_due
    let stAtual: string | null = null;
    if (deps.buscarAssinatura) {
      const a = await deps.buscarAssinatura(f.sub).catch(() => null);
      if (!a) throw new Error("assinatura_ilegivel");
      stAtual = String(a.status ?? "");
    }
    if (stAtual === "active" || stAtual === "trialing") { log("falha velha — a assinatura está em dia", { sub: f.sub }); return { status: 200, corpo: { ok: true, ignorado: "em_dia" } }; }
    if (linha && (linha.status === "active" || linha.status === "past_due")) await admin.from("subscriptions").update({ status: "past_due" }).eq("id", linha.id);
    try { await admin.from("analytics_events").insert({ event_name: "stripe_assinatura_falhou", user_id: linha?.user_id ?? null, event_data: { sub: f.sub, fatura: f.id, tentativa: f.tentativa, motivo: f.motivo } }); } catch { /* luxo */ }
    log("cobrança do mensal falhou", { sub: f.sub, tentativa: f.tentativa });
    return { status: 200, corpo: { ok: true, falhou: true } };
  }

  // invoice.paid
  const base = { sub: f.sub, fatura: f.id, valor: f.valor, motivo: f.motivo };
  if (f.moeda !== "brl" || f.valor !== mensal.centavos) {
    log("fatura do mensal com valor diferente — ignorada", base);
    if (await reservar(admin, `stripe-ignorada:${f.id}`, "ignorada") === "ok") {
      try { await admin.from("analytics_events").insert({ event_name: "stripe_venda_ignorada", user_id: linha?.user_id ?? null, event_data: { motivo: "valor_mensal", fatura: f.id, sub: f.sub, valor_cents: f.valor, moeda: f.moeda } }); } catch { /* o push ainda sai */ }
      await deps.avisarDono("⚠️ Mensal Stripe com valor diferente", `Fatura ${f.id} · ${f.valor ? reais(f.valor) : "sem valor"} · ${f.moeda || "?"}`, `stripe-ignorada:${f.id}`).catch(() => {});
    }
    return { status: 200, corpo: { ok: true, ignorado: "valor" } };
  }
  const fim = f.fimS ? iso(f.fimS) : new Date(agora.getTime() + 31 * 86400_000).toISOString();
  if (await reservar(admin, `stripe-fatura:${f.id}`, "fatura") === "ja") return { status: 200, corpo: { ok: true, duplicado: true } };

  // revisão 2: o estado ATUAL da assinatura manda no status da linha — renovação de quem já agendou o cancelamento segue
  // cancel_scheduled; assinatura já encerrada (estorno antes do 1º pago) não ganha linha ativa nem Purchase
  let subAgora: Record<string, unknown> | null = null;
  if (deps.buscarAssinatura) {
    subAgora = await deps.buscarAssinatura(f.sub).catch(() => null);
    if (!subAgora) { await soltar(admin, `stripe-fatura:${f.id}`); throw new Error("assinatura_ilegivel"); }
  }
  const encerrada = ["canceled", "incomplete_expired"].includes(String(subAgora?.status ?? ""));
  const agendada = subAgora?.cancel_at_period_end === true;
  if (linha) {
    // renovação (ou a 1ª fatura que chegou de novo): a MESMA linha, fim novo
    // 18/11: o fim só ANDA pra frente (uma fatura antiga paga atrasada — retentativa do Pix Automático — nunca encurta o acesso)
    const fimFinal = linha.current_period_end && Date.parse(linha.current_period_end) > Date.parse(fim) ? new Date(Date.parse(linha.current_period_end)).toISOString() : fim;
    const { error } = await admin.from("subscriptions").update({ status: encerrada ? "canceled" : agendada ? "cancel_scheduled" : "active", current_period_end: fimFinal, amount_cents: f.valor }).eq("id", linha.id);
    if (error) { await soltar(admin, `stripe-fatura:${f.id}`); throw new Error(String((error as Erro)?.message ?? error)); }
    // revisão 3: pagou uma fatura de assinatura JÁ encerrada (a pessoa paga e não tem acesso) → o dono confere/devolve
    if (encerrada) await deps.avisarDono("⚠️ Mensal Stripe: fatura paga numa assinatura encerrada", `Assinatura ${f.sub} · fatura ${f.id} · ${reais(f.valor)} · sem acesso — devolver ou reativar`, `stripe-paga-encerrada:${f.id}`).catch(() => {});
    try { await admin.from("analytics_events").insert({ event_name: "stripe_assinatura_renovou", user_id: linha.user_id, event_data: { sub: f.sub, fatura: f.id, valor_cents: f.valor, motivo: f.motivo } }); } catch { /* luxo */ }
    log("mensal renovado", base);
    // 18/11 (/escolha, indique e ganhe): a comissão do mensal nasce no 2º PAGAMENTO pago — a 1ª renovação (subscription_cycle). 1× por
    // assinatura (reserva própria): a 3ª, 4ª… nunca pagam de novo. Comissão FIXA (R$ 33,95). Erro aqui nunca segura a renovação.
    if (doPlanos && deps.indique && meta.indicador && f.motivo === "subscription_cycle" && !encerrada && await reservar(admin, `stripe-indique-mensal:${f.sub}`, "indique") === "ok") {
      // revisão /escolha: na API nova o invoice.paid chega SEM o PI (payment_intent null; payments só expandido) → busca o PI
      // real da fatura; só sem ele a chave é o id da fatura (o estorno cobre os 2 formatos: cancelarIndique acha a fatura do PI)
      const piReal = f.pi ?? (deps.piDaFaturaPaga ? await deps.piDaFaturaPaga(f.id).catch(() => null) : null);
      const chave = piReal ?? f.id;
      try {
        const ri = await deps.indique.registrar(meta.indicador, {
          pi: chave, valorCents: f.valor, email: (meta.email ?? f.email ?? null), userId: linha.user_id, aparelho: t(meta.aparelho, 64), cpf: null,
          jaEraCliente: false, metodo: metodoMensal, cartaoFp: null, ip: t(meta.ip, 64),
          comissaoFixaCents: COMISSAO_FIXA_PLANOS_CENTS, produto: `web_planos_mensal_${metodoMensal}`,
        });
        log("indique — mensal no 2º pagamento", { sub: f.sub, pi: chave, ...(ri && typeof ri === "object" ? ri as Record<string, unknown> : {}) });
      } catch (e) { await alarmeIndique(deps, chave, "venda", e, meta.indicador); }
    }
    return { status: 200, corpo: { ok: true, renovado: true } };
  }

  if (encerrada) {
    log("1ª fatura de assinatura já encerrada (estorno antes do pago?) — sem linha, sem Purchase", base);
    await deps.avisarDono("⚠️ Mensal Stripe pago numa assinatura já encerrada", `Assinatura ${f.sub} · fatura ${f.id} · confira estorno na Stripe`, `stripe-encerrada:${f.sub}`).catch(() => {});
    return { status: 200, corpo: { ok: true, ignorado: "assinatura_encerrada" } };
  }
  // 1ª fatura: a conta e a linha
  const email = (meta.email ?? f.email ?? "").toLowerCase() || null;
  const conta = await acharContaHotmart(admin, { refUserId: t(meta.user_id, 64), email: email && EMAIL_OK.test(email) ? email : null, acharConta: deps.acharConta });
  if (!conta) {
    await soltar(admin, `stripe-fatura:${f.id}`);
    if (await reservar(admin, `stripe-ignorada:${f.id}`, "ignorada") === "ok") {
      try { await admin.from("analytics_events").insert({ event_name: "stripe_venda_ignorada", user_id: null, event_data: { motivo: "sem_conta_mensal", fatura: f.id, sub: f.sub } }); } catch { /* o push ainda sai */ }
      await deps.avisarDono("⚠️ Mensal Stripe pago SEM conta", `Assinatura ${f.sub} · ${reais(f.valor)} · confira o e-mail na Stripe e libere à mão`, `stripe-ignorada:${f.id}`).catch(() => {});
    }
    return { status: 200, corpo: { ok: true, ignorado: "sem_conta" } };
  }
  const emailConta = conta.email ?? email;
  // 14/11 (revisão): a conta JÁ tem acesso pago (vitalício ativo, ou OUTRO mensal da Stripe vivo — 2 abas/2 refs com o mesmo
  // e-mail): esta assinatura é dinheiro em dobro → pago_em_dobro (chamado pra devolver), a renovação dela é cancelada, o
  // dono é avisado e NÃO sai Purchase na Meta (vai ser devolvida). A linha entra mesmo assim (o registro do que foi cobrado).
  let dobro: string | null = null;
  let dobroCancelado = false;
  try {
    const { data: linhas } = await admin.from("subscriptions").select("id, billing_period, status, payment_method, abacatepay_billing_id").eq("user_id", conta.userId);
    const ls = (linhas ?? []) as Array<{ billing_period?: string; status?: string; payment_method?: string; abacatepay_billing_id?: string }>;
    const vit = ls.find((l) => l.billing_period === "lifetime" && l.status === "active");
    const outroMensal = ls.find((l) => l.payment_method === GATEWAY_STRIPE && l.billing_period === "monthly" && (l.status === "active" || l.status === "past_due") && l.abacatepay_billing_id !== f.sub);
    const anterior = vit ?? outroMensal;
    if (anterior) {
      dobro = vit ? "vitalicio" : "mensal";
      await registrarPagoEmDobro(admin as never, { userId: conta.userId, orderId: f.sub, amountCents: f.valor, pedidoAnterior: anterior.abacatepay_billing_id ?? null, offer: mensal.offer, agora }).catch(() => false);
      const ok = deps.cancelarAssinatura ? await deps.cancelarAssinatura(f.sub, false).catch(() => false) : false;
      dobroCancelado = ok;
      await deps.avisarDono(`⚠️ Mensal Stripe em dobro (já tinha ${dobro})`, `Assinatura ${f.sub} · ${reais(f.valor)} · ${ok ? "renovação cancelada" : "CANCELE na Stripe"} · devolver pelo chamado`, `stripe-dobro:${f.sub}`).catch(() => {});
    }
  } catch { /* a linha nova sai mesmo assim */ }
  const { error } = await admin.from("subscriptions").insert({
    user_id: conta.userId, status: agendada || dobroCancelado ? "cancel_scheduled" : "active", plan: "monthly", billing_period: "monthly", payment_method: GATEWAY_STRIPE,
    abacatepay_billing_id: f.sub, customer_email: emailConta, amount_cents: f.valor,
    current_period_start: f.inicioS ? iso(f.inicioS) : agora.toISOString(), current_period_end: fim,
  });
  if (error) { await soltar(admin, `stripe-fatura:${f.id}`); throw new Error(String((error as Erro)?.message ?? error)); }
  log("mensal liberado", { ...base, via: conta.via, email: mascararEmail(emailConta) });

  if (emailConta && await reservar(admin, `stripe-email:${f.sub}`, "email") === "ok") {
    const ok = await deps.enviarEmail(emailConta, assuntoVenda("monthly"), htmlVenda({ email: emailConta, nome: null, periodo: "monthly", fim, hoje: true })).catch(() => false);
    if (!ok) { await soltar(admin, `stripe-email:${f.sub}`); log("e-mail do mensal FALHOU", { para: mascararEmail(emailConta) }); }
  }
  if (await reservar(admin, `stripe-venda:${f.sub}`, "venda") === "ok") {
    try { await admin.from("analytics_events").insert({ event_name: "stripe_venda", user_id: conta.userId, event_data: { sub: f.sub, fatura: f.id, pagina: doPlanos ? PAGINA_PLANOS : "app_web", plano: "mensal", valor_cents: f.valor, metodo: metodoMensal, parcelas: 1, via: conta.via, ref: meta.ref ?? null } }); } catch { await soltar(admin, `stripe-venda:${f.sub}`); }
  }
  if (!dobro && await reservar(admin, `stripe-capi:${f.sub}`, "capi") === "ok") {
    const reg: RegistroHotmart = { userId: null, dados: { fbp: meta.fbp, fbc: meta.fbc, fbclid: meta.fbclid, client_ip: meta.ip, user_agent: meta.ua, source_url: meta.url }, criadoEm: meta.criado_em ?? null, conflito: false };
    const corpo = await eventoPurchaseHotmart({ tx: f.sub, valorCents: f.valor, userId: conta.userId, email: emailConta, registro: reg, agoraMs: agora.getTime() });
    for (const d of (corpo.data as Array<Record<string, unknown>>)) {
      (d.custom_data as Record<string, unknown>).content_name = mensal.contentName;
      if (!meta.url) d.event_source_url = mensal.urlPadrao;
    }
    const ok = await deps.mandarCapi(corpo).catch(() => false);
    log(ok ? "Purchase CAPI (mensal) enviado" : "Purchase CAPI (mensal) falhou", { sub: f.sub });
  }
  try {
    const nova = await linhaDaAssinatura(admin, f.sub);
    if (nova?.id) await deps.avisarVenda(nova.id);
  } catch { /* aviso é luxo */ }
  return { status: 200, corpo: { ok: true, liberado: true, plano: "mensal", via: conta.via } };
}
