import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { pedidosEmConflito } from "../_shared/registro-pedido.ts";
import { ehDaLoja, type LinhaAssinatura } from "../_shared/linha-pix.ts";
import { creditarPedido } from "../_shared/grant-pix.ts";
import { PRECO_2027_CENTAVOS, confirmarPacote2027, eh2027 } from "../_shared/pacote-2027.ts";
import { valorCobre } from "../_shared/trava-grant.ts";
import { nomeDoProduto } from "../_shared/email-venda.ts";
import { CONCESSAO_HOJE, PRECOS_HOJE, ehOfertaCasal, ehPlanoHoje, ehUpsellHoje } from "../_shared/ofertas-hoje.ts";
import { encaminharParaDestino } from "../_shared/destino-hoje.ts";
import { fetchNosPixels } from "../_shared/meta-pixels.ts";
import {
  CHAVE_KIT_CONTA, PRECOS_PLANO30, PRECOS_PRESENTE, chaveCapiPlano30, chaveCapiPresente, ehOfertaPlano30, ehOfertaPresente, garantirPresente, liberarPlano30,
  mandarLinkPorEmail, reservar,
} from "../_shared/presente.ts";

/**
 * RECONCILIAÇÃO DE PIX (22/07): rede de segurança pro buraco achado na
 * auditoria — 6 cobranças PAID na AbacatePay sem assinatura (webhook morto
 * desde ~20/07; o grant do front só roda com o modal aberto). Esta função
 * varre os pix_order_created recentes de usuários SEM assinatura, pergunta o
 * status DIRETO ao gateway (fonte da verdade) e credita o que estiver pago.
 *
 * - Idempotente: pula quem já tem assinatura ativa vitalícia.
 * - Multi-gateway: abacate (pix_char_*), pagarme (or_*), cakto (UUID),
 *   asaas (pixQrCodeId — o resto).
 * - Auditável: cada grant vira evento pix_reconciled em analytics_events.
 * - Chamada: POST com { token } == RECONCILE_TOKEN (cron externo ou manual);
 *   opcional { hours } (janela, default 48, máx 168) e { dryRun: true }.
 *
 * CAPI (12/08, auditoria): venda reconciliada AGORA dispara Purchase pra Meta.
 * A justificativa antiga ("arriscaria duplicar") estava errada — o event_id =
 * order_id existe exatamente pra deduplicar, e o cron roda a cada 15min, bem
 * dentro da janela de 7 dias que a CAPI aceita evento retroativo. Sem isso,
 * toda venda resgatada aqui era INVISÍVEL pro leilão (8 vendas desde 01/08):
 * com ~10 vendas/dia, cada uma é ~10% do sinal diário jogado fora. UTMify
 * continua de fora (painel secundário; prioridade é o algoritmo da Meta).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ABACATE_API = "https://api.abacatepay.com/v2";
const ASAAS_API = "https://api.asaas.com/v3";
const PAGARME_API = "https://api.pagar.me/core/v5";
const CAKTO_API = "https://api.cakto.com.br/public_api";
// 12/08: downsell era 1490 (preço de julho) — desde 10/08 a roleta cobra
// 19,90 (i9o4ob8). Só fallback de evento antigo sem amount_cents, mas fallback
// errado credita/reporta valor errado no dia em que for usado.
// 15/10: `a97` = o ANUAL da venda da web (/assinar): R$ 97,90, 365 dias (não vitalício). Mesma linha nas 3 funções.
// 16/10: `a69` = o PRESENTE do funil do app na web (/assinatura): o mesmo anual por R$ 69,90, 365 dias. Mesma linha nas 3.
// 18/10: as ofertas do funil web novo (/hoje) vêm de _shared/ofertas-hoje.ts — a MESMA fonte nas 3 funções.
// 21/10: `pv149` = o PRESENTE (R$ 14,90, _shared/presente.ts) — não credita ninguém aqui: vira código (passada própria);
// `pk99` = o plano de 30 dias (R$ 9,90) — grava o kit na conta de quem pagou (passada própria).
const PRECOS_CENTAVOS: Record<string, number> = { lifetime: 9790, downsell: 1990, w97: 9790, w25: 2490, w47: 4790, w27: 2790, a97: 9790, a69: 6990, ...PRECOS_HOJE, ...PRECOS_PRESENTE, ...PRECOS_PLANO30 };
/* 03/09: com a `w25` (1 mês pré-pago na web) o reconcile deixou de poder
 * chumbar "lifetime" — creditar vitalício pra quem pagou 24,90 é dar o
 * produto de graça, e é justamente aqui que ninguém olharia. */
const DIAS_DA_OFERTA: Record<string, number | null> = {
  lifetime: null, downsell: null, w97: null, w25: 30, w47: null, w27: null, a97: 365, a69: 365,
  ...Object.fromEntries(Object.entries(CONCESSAO_HOJE).map(([k, c]) => [k, c.dias])),
};
/** O plano/período gravado na assinatura de cada oferta com prazo (o resto, `dias: null`, é vitalício). */
const PERIODO_DA_OFERTA: Record<string, { plano: string; periodo: string }> = {
  w25: { plano: "web", periodo: "monthly_prepaid" },
  a97: { plano: "core-pro", periodo: "annual" },
  a69: { plano: "core-pro", periodo: "annual" },
  ...Object.fromEntries(Object.entries(CONCESSAO_HOJE).filter(([, c]) => c.dias !== null).map(([k, c]) => [k, { plano: c.plano, periodo: c.periodo }])),
};
const ASAAS_PAGOS = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PIX-RECONCILE] ${step}${d}`);
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const asaasHeaders = (key: string) => ({
  access_token: key,
  "User-Agent": "CORE/1.0 (Supabase Edge)",
  "Content-Type": "application/json",
});
const basicAuth = (key: string) => `Basic ${btoa(`${key}:`)}`;

/** `valorReais`: só a Asaas devolve (15/10: o grant exige que cubra o preço da oferta). */
type Veredito = { pago: boolean; status: string; valorReais?: unknown };

/** 21/10 (upsell "Seu 2027", u2027): o Purchase 19,90 — o mesmo formato do Purchase da varredura (event_id = pedido,
 *  event_time = criação do QR, sinais do pix_order_created). */
type Pedido2027 = { uid: string; orderId: string; criadoEm: string; amountCents: number | null; fbp: string | null; fbc: string | null; ip: string | null; ua: string | null; sourceUrl: string | null };
async function capi2027(o: Pedido2027, email: string | null, cents: number): Promise<string> {
  if (!Deno.env.get("META_PIXEL_ID") || !Deno.env.get("META_CAPI_TOKEN")) return "skipped_no_secrets";
  try {
    const sha = async (val: string) => {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(val.trim().toLowerCase()));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    };
    const res = await fetchNosPixels({
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [{
        event_name: "Purchase", event_time: Math.floor(new Date(o.criadoEm).getTime() / 1000), event_id: o.orderId,
        action_source: "website", event_source_url: o.sourceUrl ?? "https://www.coreaplicativo.com.br",
        user_data: {
          ...(email ? { em: [await sha(email)] } : {}),
          external_id: [await sha(o.uid)],
          ...(o.fbc ? { fbc: o.fbc } : {}),
          ...(o.fbp ? { fbp: o.fbp } : {}),
          ...(o.ip && o.ua ? { client_ip_address: o.ip, client_user_agent: o.ua } : {}),
        },
        custom_data: { value: cents / 100, currency: "BRL", content_name: nomeDoProduto({ offer: "u2027" }) },
      }] }),
    });
    return res.ok ? "sent" : `error_${res.status}`;
  } catch {
    return "error_throw";
  }
}

async function statusAbacate(key: string, id: string): Promise<Veredito> {
  const res = await fetch(`${ABACATE_API}/transparents/check?id=${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) return { pago: false, status: `http_${res.status}` };
  const st = String(out?.data?.status ?? "UNKNOWN");
  return { pago: st === "PAID", status: st };
}

async function statusAsaas(key: string, qrCodeId: string): Promise<Veredito> {
  const res = await fetch(`${ASAAS_API}/payments?pixQrCodeId=${encodeURIComponent(qrCodeId)}&limit=10`, {
    headers: asaasHeaders(key),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) return { pago: false, status: `http_${res.status}` };
  const pago = (out?.data ?? []).find((p: { status?: string }) => ASAAS_PAGOS.has(String(p?.status)));
  return { pago: Boolean(pago), status: pago ? String(pago.status) : `pendente_${out?.totalCount ?? 0}`, valorReais: pago?.value };
}

async function statusPagarme(key: string, id: string): Promise<Veredito> {
  const res = await fetch(`${PAGARME_API}/orders/${encodeURIComponent(id)}`, {
    headers: { Authorization: basicAuth(key) },
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) return { pago: false, status: `http_${res.status}` };
  const st = String(out?.status ?? "unknown").toUpperCase();
  return { pago: st === "PAID", status: st };
}

// Cakto (24/07, gateway principal de novo): o id da ordem é um UUID e a API
// usa OAuth de curta duração — token pedido por varredura, sem cache (a
// função é fria e roda a cada 15min; um POST a mais não dói).
// Não existe retrieve unitário na API deles: é o LIST com filtro ?id= (doc
// docs.cakto.com.br/api-reference/orders/list; validado com cobrança real).
// Só "paid" credita — "authorized" é pré-captura de cartão, não Pix.
const ehUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

async function tokenCakto(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${CAKTO_API}/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) throw new Error(`cakto_token_http_${res.status}`);
  return data.access_token;
}

async function statusCakto(token: string, id: string): Promise<Veredito> {
  const res = await fetch(`${CAKTO_API}/orders/?id=${encodeURIComponent(id)}&limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) return { pago: false, status: `http_${res.status}:${JSON.stringify(out).slice(0, 120)}` };
  const ordem = (out?.results ?? []).find((o: { id?: string }) => String(o?.id) === id) ?? out?.results?.[0];
  const st = String(ordem?.status ?? `nao_encontrado_${out?.count ?? 0}`).toLowerCase();
  return { pago: st === "paid", status: st };
}

/** Resend (o mesmo remetente das boas-vindas). true = saiu. */
async function enviarResend(para: string, assunto: string, html: string): Promise<boolean> {
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!resendKey) return false;
  const from = Deno.env.get("WELCOME_EMAIL_FROM") || Deno.env.get("RECOVERY_EMAIL_FROM") || "onboarding@resend.dev";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [para], subject: assunto, html }),
  }).catch(() => null);
  return !!r?.ok;
}

/** 21/10 (presente): manda um corpo pronto do Resend (com reply_to). true = saiu. */
async function enviarCorpoResend(corpo: Record<string, unknown>): Promise<boolean> {
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!resendKey) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo),
  }).catch(() => null);
  return !!r?.ok;
}

/** 21/10: o Purchase do PRESENTE (14,90) e do plano de 30 dias (9,90) — o mesmo formato do Purchase da varredura
 *  (event_id = pedido, IP/UA do create). */
async function capiPresente(
  o: { uid: string; orderId: string; criadoEm: string; fbp: string | null; fbc: string | null; ip: string | null; ua: string | null; sourceUrl: string | null },
  email: string | null, cents: number, offer = "pv149",
): Promise<string> {
  if (!Deno.env.get("META_PIXEL_ID") || !Deno.env.get("META_CAPI_TOKEN")) return "skipped_no_secrets";
  try {
    const sha = async (val: string) => {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(val.trim().toLowerCase()));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    };
    const res = await fetchNosPixels({
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [{
        event_name: "Purchase", event_time: Math.floor(new Date(o.criadoEm).getTime() / 1000), event_id: o.orderId,
        action_source: "website", event_source_url: o.sourceUrl ?? "https://www.coreaplicativo.com.br",
        user_data: {
          ...(email ? { em: [await sha(email)] } : {}),
          external_id: [await sha(o.uid)],
          ...(o.fbc ? { fbc: o.fbc } : {}),
          ...(o.fbp ? { fbp: o.fbp } : {}),
          ...(o.ip && o.ua ? { client_ip_address: o.ip, client_user_agent: o.ua } : {}),
        },
        custom_data: { value: cents / 100, currency: "BRL", content_name: nomeDoProduto({ offer }) },
      }] }),
    });
    return res.ok ? "sent" : `error_${res.status}`;
  } catch {
    return "error_throw";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    // Dois caminhos de entrada (padrão recovery-emails): token dedicado
    // (RECONCILE_TOKEN, chamadas manuais) OU Bearer com a anon key do projeto
    // (pg_cron — a anon key já é pública no bundle; a segurança REAL é por
    // construção: a função só credita cobrança que o gateway confirma PAID,
    // não existe input que cunhe acesso).
    const esperado = Deno.env.get("RECONCILE_TOKEN") ?? "";
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    let autorizado =
      (esperado && String(body.token ?? "") === esperado) || (anon && bearer === anon);
    // 24/07: o runtime passou a injetar a chave NOVA (sb_publishable) em
    // SUPABASE_ANON_KEY enquanto o pg_cron manda o JWT anon legado — a
    // comparação de string nunca batia e o cron tomava 401 desde 22/07.
    // Validação de verdade: o auth server confere a ASSINATURA do bearer;
    // aceito se for a chave anon legítima deste projeto.
    if (!autorizado && bearer.split(".").length === 3) {
      try {
        const payload = JSON.parse(atob(bearer.split(".")[1]));
        const url = Deno.env.get("SUPABASE_URL") ?? "";
        if (payload?.role === "anon" && payload?.ref && url.includes(payload.ref)) {
          const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: bearer } });
          autorizado = r.ok;
        }
      } catch { /* segue não autorizado */ }
    }
    if (!autorizado) return jsonResponse({ error: "unauthorized" }, 401);
    const dryRun = body.dryRun === true;
    const hours = Math.min(Math.max(Number(body.hours) || 48, 1), 168);
    const desde = new Date(Date.now() - hours * 3600e3).toISOString();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const abacateKey = Deno.env.get("ABACATE_API_KEY") ?? "";
    const asaasKey = Deno.env.get("ASAAS_API_KEY") ?? "";
    const pagarmeKey = Deno.env.get("PAGARME_API_KEY") ?? "";
    const caktoId = Deno.env.get("CAKTO_CLIENT_ID") ?? "";
    const caktoSecret = Deno.env.get("CAKTO_CLIENT_SECRET") ?? "";
    // Token único por varredura; se a Cakto estiver fora, as ordens dela caem
    // em falhas[] e a próxima rodada tenta de novo — nunca credita no escuro.
    let caktoTokenMemo: string | null = null;
    const caktoToken = async () => (caktoTokenMemo ??= await tokenCakto(caktoId, caktoSecret));

    // Sonda de QA (token-gated, mesmo auth da função): devolve o veredito cru
    // de UMA ordem sem creditar nada — pra validar contrato de status após
    // mudança de gateway. { probe: "<orderId>" }.
    if (typeof body.probe === "string" && body.probe) {
      // segurança 21/10: a sonda só com o RECONCILE_TOKEN — a anon key é pública (está no bundle) e a sonda devolvia o
      // status/valor de QUALQUER pedido.
      if (!(esperado && String(body.token ?? "") === esperado)) return jsonResponse({ error: "unauthorized" }, 401);
      const id = String(body.probe);
      let v: Veredito;
      if (body.gw === "cakto") v = await statusCakto(await caktoToken(), id);
      else if (id.startsWith("pix_char_")) v = await statusAbacate(abacateKey, id);
      else if (id.startsWith("or_")) v = await statusPagarme(pagarmeKey, id);
      else if (ehUuid(id)) v = await statusCakto(await caktoToken(), id);
      else v = await statusAsaas(asaasKey, id);
      return jsonResponse({ ok: true, probe: id, veredito: v });
    }

    // QRs recentes (server-side, fonte: pix_order_created do create)
    const { data: qrs, error: qErr } = await admin
      .from("analytics_events")
      .select("user_id, event_data, created_at")
      .eq("event_name", "pix_order_created")
      .gte("created_at", desde)
      .order("created_at", { ascending: true })
      .limit(2000);
    if (qErr) return jsonResponse({ error: `query: ${qErr.message}` }, 500);
    /* segurança 21/10: pedido com registros que discordam (conta ou oferta) não é creditado por aqui — o cliente
     * conseguia gravar pix_order_created com o id de um pedido alheio. Fica no log pro suporte. */
    const emConflito = pedidosEmConflito(qrs);
    if (emConflito.size) console.log(`[PIX-RECONCILE] ALARME pedidos com registro em conflito: ${[...emConflito].map((o) => o.slice(0, 24)).join(", ")}`);

    // agrupa por usuário; ignora QR sem user (não deveria existir — create exige JWT)
    type Ordem = {
      orderId: string; offer: string; criadoEm: string; amountCents: number | null;
      // sinais de match pro CAPI — o cakto-pix grava tudo isso no create (10/08)
      fbp: string | null; fbc: string | null; ip: string | null; ua: string | null; sourceUrl: string | null;
    };
    /* 26/09: Pix ADIANTADO que nunca foi pra tela não tem como ter sido pago
     * (ninguém viu o código) — fica fora da varredura. Os exibidos têm
     * pix_generated com o mesmo order_id. Sem isto, o adiantamento (~3× mais
     * pedidos na Cakto) multiplicaria as consultas a cada 15 min. */
    const adiantados = (qrs ?? []).filter((q) => q.event_data?.adiantado === true)
      .map((q) => String(q.event_data?.order_id ?? "")).filter(Boolean);
    const exibidos = new Set<string>();
    for (let i = 0; i < adiantados.length; i += 100) {
      const { data: gs } = await admin.from("analytics_events").select("event_data")
        .eq("event_name", "pix_generated").gte("created_at", desde)
        .in("event_data->>order_id", adiantados.slice(i, i + 100));
      for (const g of gs ?? []) exibidos.add(String(g.event_data?.order_id ?? ""));
    }
    /** 21/10: os pedidos do "Seu 2027" (u2027) — passada própria (gravam o pacote na conta, não linha de assinatura). */
    const pedidos2027: Pedido2027[] = [];
    let adiantadosFora = 0;
    let ofertasDesconhecidas = 0;
    /** 21/10: os pedidos de PRESENTE (pv149) — passada própria no fim (viram código, não linha de quem pagou). */
    type PedidoExtra = { uid: string; orderId: string; criadoEm: string; amountCents: number | null; fbp: string | null; fbc: string | null; ip: string | null; ua: string | null; sourceUrl: string | null; area?: unknown };
    const pedidosPresente: PedidoExtra[] = [];
    /** 21/10: o downsell do plano de 30 dias (pk99) — passada própria no fim (grava o kit, não linha de assinatura). */
    const pedidosPlano30: PedidoExtra[] = [];

    const porUser = new Map<string, Ordem[]>();
    for (const q of qrs ?? []) {
      const uid = q.user_id as string | null;
      const oid = String(q.event_data?.order_id ?? "");
      if (!uid || !oid) continue;
      if (emConflito.has(oid)) continue;
      if (q.event_data?.adiantado === true && !exibidos.has(oid)) { adiantadosFora++; continue; }
      // 06/09: a oferta REAL do create (w25 = 30 dias, w47/w97 = vitalício) —
      // colapsar tudo em "lifetime" creditava pra sempre quem pagou 1 mês pela Cakto.
      const ofertaCrua = String(q.event_data?.offer ?? "");
      if (eh2027(ofertaCrua)) {
        pedidos2027.push({
          uid, orderId: oid, criadoEm: String(q.created_at), amountCents: Number(q.event_data?.amount_cents) || null,
          fbp: q.event_data?.fbp ?? null, fbc: q.event_data?.fbc ?? null, ip: q.event_data?.client_ip ?? null, ua: q.event_data?.user_agent ?? null, sourceUrl: q.event_data?.source_url ?? null,
        });
        continue;
      }
      /* 18/10 (/hoje): o hc199 ("vida a dois") não credita quem pagou — quem libera a outra conta é a página (ação
       * `parceiro` do asaas-pix); o Purchase sai do check/webhook. Fora da varredura, e fora da conta de desconhecidas. */
      if (ehOfertaCasal(ofertaCrua)) continue;
      if (ehOfertaPresente(ofertaCrua) || ehOfertaPlano30(ofertaCrua)) {
        (ehOfertaPresente(ofertaCrua) ? pedidosPresente : pedidosPlano30).push({
          uid, orderId: oid, criadoEm: String(q.created_at), amountCents: Number(q.event_data?.amount_cents) || null,
          fbp: q.event_data?.fbp ?? null, fbc: q.event_data?.fbc ?? null, ip: q.event_data?.client_ip ?? null, ua: q.event_data?.user_agent ?? null, sourceUrl: q.event_data?.source_url ?? null,
          area: q.event_data?.area ?? null,
        });
        continue;
      }
      /* 16/10: oferta desconhecida NUNCA vira vitalício (antes caía em "lifetime" — um a69 pago antes do deploy que o
       * conhece ganharia acesso pra sempre). Fica fora desta passada; o próximo cron, com a oferta na tabela, credita. */
      if (!(ofertaCrua in DIAS_DA_OFERTA)) { ofertasDesconhecidas++; continue; }
      const offer = ofertaCrua;
      // 01/08: o VALOR REAL do pedido vem do create (amount_cents no evento).
      // A tabela chumbada virou bug no dia em que o preço mudou (27,90→19,90):
      // o reconcile creditou 2790 pra quem pagou 1990. Preço de tabela agora é
      // só fallback de evento antigo sem amount.
      const amountCents = Number(q.event_data?.amount_cents) || null;
      if (!porUser.has(uid)) porUser.set(uid, []);
      porUser.get(uid)!.push({
        orderId: oid, offer, criadoEm: String(q.created_at), amountCents,
        fbp: q.event_data?.fbp ?? null,
        fbc: q.event_data?.fbc ?? null,
        ip: q.event_data?.client_ip ?? null,
        ua: q.event_data?.user_agent ?? null,
        sourceUrl: q.event_data?.source_url ?? null,
      });
    }

    // quem já tem assinatura ativa vitalícia sai da fila
    // 03/09: sai também quem tem MÊS pré-pago vigente (`w25`) — antes o filtro
    // só conhecia "lifetime" e um mês ativo cairia aqui todo ciclo do cron,
    // sendo recreditado de novo e de novo.
    const uids = [...porUser.keys()];
    const jaTem = new Set<string>();
    for (let i = 0; i < uids.length; i += 100) {
      const lote = uids.slice(i, i + 100);
      const { data: subs } = await admin
        .from("subscriptions").select("id, user_id, status, plan, billing_period, current_period_end, payment_method, revenuecat_subscription_id").in("user_id", lote);
      for (const s of subs ?? []) {
        if (s.status !== "active") continue;
        /* 01/10: linha da LOJA não tira ninguém da fila — quem está na carência
         * da App Store (linha play_store ativa até o fim da carência) e pagou o
         * Pix de 97,90 ficava "já tem" aqui e nunca era creditado pela rede. */
        if (ehDaLoja(s as LinhaAssinatura)) continue;
        if (s.billing_period === "lifetime" || s.plan === "lifetime") { jaTem.add(String(s.user_id)); continue; }
        if (s.current_period_end && new Date(s.current_period_end) > new Date()) jaTem.add(String(s.user_id));
      }
    }

    let sondadas = 0;
    const creditados: Array<Record<string, unknown>> = [];
    const falhas: Array<Record<string, unknown>> = [];

    /* 21/10 (upsell "Seu 2027", u2027): pagou e o check/webhook não gravaram → o pacote vai pra conta de quem pagou aqui +
     * Purchase 19,90 1x (a mesma trava do check/webhook). Quem já tem o pacote sai da fila numa consulta só. Entra em
     * `creditados` com `pacote2027: true`. */
    if (pedidos2027.length) {
      const { data: comPacote } = await admin.from("user_data").select("user_id").eq("key", "core-pacote-2027").in("user_id", [...new Set(pedidos2027.map((o) => o.uid))]);
      const jaTemPacote = new Set(((comPacote ?? []) as Array<{ user_id: string }>).map((r) => r.user_id));
      for (const o of pedidos2027) {
        if (jaTemPacote.has(o.uid)) continue;
        sondadas++;
        let v: Veredito;
        try { v = await statusAsaas(asaasKey, o.orderId); } catch (e) { falhas.push({ orderId: o.orderId, erro: String(e).slice(0, 120) }); continue; }
        if (!v.pago) continue;
        const cents = o.amountCents ?? PRECO_2027_CENTAVOS;
        if (!valorCobre(v.valorReais, cents)) { falhas.push({ orderId: o.orderId, erro: "valor_menor" }); continue; }
        if (dryRun) { creditados.push({ uid: o.uid, orderId: o.orderId, offer: "u2027", pacote2027: true, dryRun: true }); continue; }
        let capi = "ja_enviado";
        const p27 = await confirmarPacote2027(admin, {
          userId: o.uid, orderId: o.orderId, origem: "upsell",
          enviarCompra: async () => {
            const { data: au } = await admin.auth.admin.getUserById(o.uid);
            capi = await capi2027(o, au?.user?.email ?? null, cents);
          },
        });
        if (p27.r === "falhou") { falhas.push({ orderId: o.orderId, erro: "pacote2027_gravar" }); continue; }
        jaTemPacote.add(o.uid);
        await admin.from("analytics_events").insert({
          event_name: "pix_reconciled", user_id: o.uid,
          event_data: { order_id: o.orderId, offer: "u2027", pacote2027: true, gateway_status: v.status, amount_cents: cents, meta_capi: capi },
        });
        creditados.push({ uid: o.uid, orderId: o.orderId, offer: "u2027", pacote2027: true, capi });
      }
    }

    for (const [uid, ordens] of porUser) {
      /* 18/10 (/hoje): os upsells (hv47/hv27) são pagos por quem JÁ tem o plano ativo — a regra "já tem assinatura
       * sai da fila" deixaria esses fora da rede. Eles passam (1 pedido = 1 crédito segura a repetição). */
      if (jaTem.has(uid) && !ordens.some((o) => ehUpsellHoje(o.offer))) continue;
      for (const o of ordens) {
        if (jaTem.has(uid) && !ehUpsellHoje(o.offer)) continue;
        sondadas++;
        let v: Veredito;
        try {
          if (o.orderId.startsWith("pix_char_")) v = await statusAbacate(abacateKey, o.orderId);
          else if (o.orderId.startsWith("or_")) v = await statusPagarme(pagarmeKey, o.orderId);
          else if (ehUuid(o.orderId)) v = await statusCakto(await caktoToken(), o.orderId);
          else v = await statusAsaas(asaasKey, o.orderId);
        } catch (e) {
          falhas.push({ orderId: o.orderId, erro: String(e).slice(0, 120) });
          continue;
        }
        if (!v.pago) continue;
        const gw = o.orderId.startsWith("pix_char_") ? "abacate" : o.orderId.startsWith("or_") ? "pagarme" : ehUuid(o.orderId) ? "cakto" : "asaas";
        /* 15/10: na Asaas, o pagamento tem que cobrir o preço DESTE pedido (o valor gravado no create; sem ele, o da
         * tabela). Não a tabela direto: o downsell da Asaas é 14,90 e a tabela daqui (Cakto) diz 19,90. */
        if (gw === "asaas" && !valorCobre(v.valorReais, o.amountCents ?? PRECOS_CENTAVOS[o.offer])) {
          logStep("Valor pago menor que a oferta — não credita", { uid, orderId: o.orderId, offer: o.offer, valor: v.valorReais ?? null });
          falhas.push({ orderId: o.orderId, erro: "valor_menor" });
          continue;
        }

        logStep("PAGO sem assinatura", { uid, orderId: o.orderId, offer: o.offer, dryRun });
        if (dryRun) { creditados.push({ uid, ...o, dryRun: true }); break; }

        const { data: au } = await admin.auth.admin.getUserById(uid);
        const email = au?.user?.email ?? null;
        const inicio = new Date(o.criadoEm);
        const dias = DIAS_DA_OFERTA[o.offer] ?? null;
        const fim = new Date(inicio);
        if (dias === null) fim.setFullYear(fim.getFullYear() + 100);
        else fim.setDate(fim.getDate() + dias);
        const payload = {
          user_id: uid,
          status: "active",
          plan: dias === null ? "lifetime" : (PERIODO_DA_OFERTA[o.offer]?.plano ?? "web"),
          billing_period: dias === null ? "lifetime" : (PERIODO_DA_OFERTA[o.offer]?.periodo ?? "monthly_prepaid"),
          payment_method: "pix",
          abacatepay_billing_id: o.orderId,
          customer_email: email,
          current_period_start: inicio.toISOString(),
          current_period_end: fim.toISOString(),
          amount_cents: o.amountCents ?? PRECOS_CENTAVOS[o.offer],
        };
        /* 01/10: nunca na linha da loja (ver _shared/linha-pix.ts). `fim` vem
         * daqui (contado da criação do QR), não da decisão — a decisão só diz
         * em qual linha escrever. */
        // 15/10: decisão + trava "1 pedido = 1 crédito" em _shared/grant-pix.ts (o mesmo do webhook e do check da
        // página). `fim` segue sendo o daqui (contado da criação do QR): o payload ignora o fim decidido.
        /* 18/10: upsell do /hoje (hv47/hv27, vitalício) ganha LINHA NOVA — o plano comprado antes fica na linha dele
         * (valor e pedido preservados). O fim é o decidido (vitalício = +100 anos). */
        const linhaNova = CONCESSAO_HOJE[o.offer]?.linhaNova === true;
        const g = await creditarPedido(admin, {
          userId: uid, orderId: o.orderId, gateway: gw, concessao: { dias }, agora: inicio, linhaNova,
          montarPayload: (fimDecidido) => (linhaNova ? { ...payload, current_period_end: fimDecidido } : payload),
        });
        if (g.r === "preservado") { logStep("Vitalício pagou o mês — linha preservada", { uid, orderId: o.orderId }); break; }
        // revisor 15/10: `continue` (não `break`) — um pedido antigo já creditado não pode impedir o pedido NOVO da
        // mesma pessoa (cancelou/reembolsou o antigo e pagou outro em 48 h) de ser creditado pela rede de segurança
        if (g.r === "ja_creditado" || g.r === "em_andamento") { logStep("Pedido já creditado (ou sendo creditado) por outro caminho", { uid, orderId: o.orderId, r: g.r }); continue; }
        if (g.r === "erro") {
          falhas.push({ orderId: o.orderId, erro: g.msg.slice(0, 120) });
          continue;
        }
        /* Purchase pra Meta (12/08). Mesmo formato do sendMetaCapi do
         * cakto-webhook: event_id = order_id pago (dedup mata qualquer corrida
         * rara com o webhook/pixel), event_time = criação do QR (Pix expira em
         * 30min — o pagamento real está a minutos dali, e criadoEm é sempre
         * ≤ agora, nunca no futuro), sinais do próprio pix_order_created.
         * Falha aqui NUNCA derruba o grant — acesso primeiro, sinal depois. */
        let capi = "skipped_no_secrets";
        const pixelId = Deno.env.get("META_PIXEL_ID");
        const capiToken = Deno.env.get("META_CAPI_TOKEN");
        if (pixelId && capiToken) {
          try {
            const sha = async (val: string) => {
              const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(val.trim().toLowerCase()));
              return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
            };
            const cents = o.amountCents ?? PRECOS_CENTAVOS[o.offer];
            const capiPayload = {
              data: [{
                event_name: "Purchase",
                event_time: Math.floor(new Date(o.criadoEm).getTime() / 1000),
                event_id: o.orderId,
                action_source: "website",
                event_source_url: o.sourceUrl ?? "https://www.coreaplicativo.com.br",
                user_data: {
                  ...(email ? { em: [await sha(email)] } : {}),
                  external_id: [await sha(uid)],
                  ...(o.fbc ? { fbc: o.fbc } : {}),
                  ...(o.fbp ? { fbp: o.fbp } : {}),
                  // par obrigatório: um sem o outro a Meta descarta
                  ...(o.ip && o.ua ? { client_ip_address: o.ip, client_user_agent: o.ua } : {}),
                },
                custom_data: {
                  value: cents / 100, currency: "BRL",
                  content_name: nomeDoProduto({ offer: o.offer, downsell: o.offer === "downsell" }),
                },
              }],
            };
            const capiRes = await fetchNosPixels({
              method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(capiPayload),
            });
            const capiOut = await capiRes.json().catch(() => ({}));
            capi = capiRes.ok ? "sent" : `error_${capiRes.status}`;
            logStep(capiRes.ok ? "Meta CAPI sent" : "Meta CAPI error", { orderId: o.orderId, status: capiRes.status, body: JSON.stringify(capiOut).slice(0, 140) });
          } catch (e) {
            capi = "error_throw";
            logStep("Meta CAPI failed", { orderId: o.orderId, e: String(e).slice(0, 120) });
          }
        }
        await admin.from("analytics_events").insert({
          event_name: "pix_reconciled",
          user_id: uid,
          event_data: { order_id: o.orderId, offer: o.offer, gateway_status: v.status, amount_cents: o.amountCents ?? PRECOS_CENTAVOS[o.offer], meta_capi: capi },
        });
        creditados.push({ uid, email, orderId: o.orderId, offer: o.offer, criadoEm: o.criadoEm, status: v.status, capi });
        // 18/10 (/hoje): o e-mail de destino da tela do Pix (quem pagou e sumiu) — a compra vai pra essa conta
        if (ehPlanoHoje(o.offer) || ehUpsellHoje(o.offer)) {
          await encaminharParaDestino(admin as never, { uidAnonimo: uid, orderId: o.orderId, offer: o.offer, enviar: enviarResend }).catch(() => null);
        }
        if (ehUpsellHoje(o.offer)) continue; // 18/10: upsell não encerra a pessoa (pode haver o plano e outro upsell)
        jaTem.add(uid);
        break; // 1 grant por usuário basta (vitalício)
      }
    }

    /* 21/10 (UPSELL DE PRESENTE, pv149): pagou e o check/webhook não fecharam → o código nasce aqui (1 por pedido), o
     * Purchase 14,90 sai 1x (mesma trava do check/webhook) e o link vai por e-mail se a conta tem e-mail. Pedido que já
     * virou código sai da fila numa consulta só. */
    const presentes: Array<Record<string, unknown>> = [];
    if (pedidosPresente.length) {
      const { data: jaFeitos } = await admin.from("presentes").select("pedido").in("pedido", pedidosPresente.map((o) => o.orderId));
      const feitos = new Set(((jaFeitos ?? []) as Array<{ pedido: string }>).map((r) => r.pedido));
      for (const o of pedidosPresente) {
        if (feitos.has(o.orderId)) continue;
        sondadas++;
        let v: Veredito;
        try { v = await statusAsaas(asaasKey, o.orderId); } catch (e) { falhas.push({ orderId: o.orderId, erro: String(e).slice(0, 120) }); continue; }
        if (!v.pago) continue;
        const cents = o.amountCents ?? PRECOS_CENTAVOS.pv149;
        if (!valorCobre(v.valorReais, cents)) { falhas.push({ orderId: o.orderId, erro: "valor_menor" }); continue; }
        if (dryRun) { presentes.push({ uid: o.uid, orderId: o.orderId, dryRun: true }); continue; }
        const p = await garantirPresente(admin, { orderId: o.orderId, compradorId: o.uid, valorCentavos: cents });
        if (!p) { falhas.push({ orderId: o.orderId, erro: "presente_codigo" }); continue; }
        const { data: au } = await admin.auth.admin.getUserById(o.uid);
        const email = au?.user?.email ?? null;
        let capi = "ja_enviado";
        if (await reservar(admin, chaveCapiPresente(o.orderId), "capi")) capi = await capiPresente(o, email, cents);
        if (email) {
          const from = Deno.env.get("WELCOME_EMAIL_FROM") || Deno.env.get("RECOVERY_EMAIL_FROM") || "onboarding@resend.dev";
          await mandarLinkPorEmail(admin, { orderId: o.orderId, codigo: p.codigo, para: email, de: from, enviar: enviarCorpoResend });
        }
        await admin.from("analytics_events").insert({
          event_name: "pix_reconciled", user_id: o.uid,
          event_data: { order_id: o.orderId, offer: "pv149", presente: true, gateway_status: v.status, amount_cents: cents, meta_capi: capi },
        });
        presentes.push({ uid: o.uid, orderId: o.orderId, novo: p.novo, capi });
      }
    }

    /* 21/10 (downsell pk99): pagou o plano de 30 dias e o check/webhook não gravaram → grava o kit na conta de quem pagou
     * + Purchase 9,90 1x (mesma trava). Quem já tem o kit sai da fila numa consulta só. */
    const planos30: Array<Record<string, unknown>> = [];
    if (pedidosPlano30.length) {
      const { data: comKit } = await admin.from("user_data").select("user_id").eq("key", CHAVE_KIT_CONTA).in("user_id", [...new Set(pedidosPlano30.map((o) => o.uid))]);
      const jaTemKit = new Set(((comKit ?? []) as Array<{ user_id: string }>).map((r) => r.user_id));
      for (const o of pedidosPlano30) {
        if (jaTemKit.has(o.uid)) continue;
        sondadas++;
        let v: Veredito;
        try { v = await statusAsaas(asaasKey, o.orderId); } catch (e) { falhas.push({ orderId: o.orderId, erro: String(e).slice(0, 120) }); continue; }
        if (!v.pago) continue;
        const cents = o.amountCents ?? PRECOS_CENTAVOS.pk99;
        if (!valorCobre(v.valorReais, cents)) { falhas.push({ orderId: o.orderId, erro: "valor_menor" }); continue; }
        if (dryRun) { planos30.push({ uid: o.uid, orderId: o.orderId, dryRun: true }); continue; }
        const lib = await liberarPlano30(admin, { userId: o.uid, orderId: o.orderId, area: o.area });
        if (lib === "falhou") { falhas.push({ orderId: o.orderId, erro: "plano30_gravar" }); continue; }
        jaTemKit.add(o.uid);
        let capi = "ja_enviado";
        if (await reservar(admin, chaveCapiPlano30(o.orderId), "capi")) {
          const { data: au } = await admin.auth.admin.getUserById(o.uid);
          capi = await capiPresente(o, au?.user?.email ?? null, cents, "pk99");
        }
        await admin.from("analytics_events").insert({
          event_name: "pix_reconciled", user_id: o.uid,
          event_data: { order_id: o.orderId, offer: "pk99", plano30: true, gateway_status: v.status, amount_cents: cents, meta_capi: capi },
        });
        planos30.push({ uid: o.uid, orderId: o.orderId, capi });
      }
    }

    logStep("Fim", { janelaHoras: hours, usuarios: porUser.size, sondadas, adiantadosFora, ofertasDesconhecidas, creditados: creditados.length, presentes: presentes.length, planos30: planos30.length, falhas: falhas.length });
    return jsonResponse({ ok: true, dryRun, janelaHoras: hours, sondadas, adiantadosFora, ofertasDesconhecidas, creditados, presentes, planos30, falhas });
  } catch (e) {
    logStep("ERRO", { e: String(e).slice(0, 200) });
    return jsonResponse({ error: String(e).slice(0, 200) }, 500);
  }
});
