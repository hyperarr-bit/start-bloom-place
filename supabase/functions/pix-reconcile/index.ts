import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * RECONCILIAÇÃO DE PIX (22/07): rede de segurança pro buraco achado na
 * auditoria — 6 cobranças PAID na AbacatePay sem assinatura (webhook morto
 * desde ~20/07; o grant do front só roda com o modal aberto). Esta função
 * varre os pix_order_created recentes de usuários SEM assinatura, pergunta o
 * status DIRETO ao gateway (fonte da verdade) e credita o que estiver pago.
 *
 * - Idempotente: pula quem já tem assinatura ativa vitalícia.
 * - Multi-gateway: abacate (pix_char_*), asaas (pixQrCodeId), pagarme (or_*).
 * - Auditável: cada grant vira evento pix_reconciled em analytics_events.
 * - Chamada: POST com { token } == RECONCILE_TOKEN (cron externo ou manual);
 *   opcional { hours } (janela, default 48, máx 168) e { dryRun: true }.
 *
 * NÃO dispara UTMify/CAPI: venda reconciliada chega tarde demais pra otimizar
 * leilão e arriscaria duplicar Purchase — prioridade aqui é acesso + caixa.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ABACATE_API = "https://api.abacatepay.com/v2";
const ASAAS_API = "https://api.asaas.com/v3";
const PAGARME_API = "https://api.pagar.me/core/v5";
const PRECOS_CENTAVOS: Record<string, number> = { lifetime: 2790, downsell: 1490 };
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

type Veredito = { pago: boolean; status: string };

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
  return { pago: Boolean(pago), status: pago ? String(pago.status) : `pendente_${out?.totalCount ?? 0}` };
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
    const autorizado =
      (esperado && String(body.token ?? "") === esperado) || (anon && bearer === anon);
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

    // QRs recentes (server-side, fonte: pix_order_created do create)
    const { data: qrs, error: qErr } = await admin
      .from("analytics_events")
      .select("user_id, event_data, created_at")
      .eq("event_name", "pix_order_created")
      .gte("created_at", desde)
      .order("created_at", { ascending: true })
      .limit(2000);
    if (qErr) return jsonResponse({ error: `query: ${qErr.message}` }, 500);

    // agrupa por usuário; ignora QR sem user (não deveria existir — create exige JWT)
    const porUser = new Map<string, Array<{ orderId: string; offer: string; criadoEm: string }>>();
    for (const q of qrs ?? []) {
      const uid = q.user_id as string | null;
      const oid = String(q.event_data?.order_id ?? "");
      if (!uid || !oid) continue;
      const offer = q.event_data?.offer === "downsell" ? "downsell" : "lifetime";
      if (!porUser.has(uid)) porUser.set(uid, []);
      porUser.get(uid)!.push({ orderId: oid, offer, criadoEm: String(q.created_at) });
    }

    // quem já tem assinatura ativa vitalícia sai da fila
    const uids = [...porUser.keys()];
    const jaTem = new Set<string>();
    for (let i = 0; i < uids.length; i += 100) {
      const lote = uids.slice(i, i + 100);
      const { data: subs } = await admin
        .from("subscriptions").select("user_id, status, plan").in("user_id", lote);
      for (const s of subs ?? []) {
        if (s.status === "active" && s.plan === "lifetime") jaTem.add(String(s.user_id));
      }
    }

    let sondadas = 0;
    const creditados: Array<Record<string, unknown>> = [];
    const falhas: Array<Record<string, unknown>> = [];

    for (const [uid, ordens] of porUser) {
      if (jaTem.has(uid)) continue;
      for (const o of ordens) {
        sondadas++;
        let v: Veredito;
        try {
          if (o.orderId.startsWith("pix_char_")) v = await statusAbacate(abacateKey, o.orderId);
          else if (o.orderId.startsWith("or_")) v = await statusPagarme(pagarmeKey, o.orderId);
          else v = await statusAsaas(asaasKey, o.orderId);
        } catch (e) {
          falhas.push({ orderId: o.orderId, erro: String(e).slice(0, 120) });
          continue;
        }
        if (!v.pago) continue;

        logStep("PAGO sem assinatura", { uid, orderId: o.orderId, offer: o.offer, dryRun });
        if (dryRun) { creditados.push({ uid, ...o, dryRun: true }); break; }

        const { data: au } = await admin.auth.admin.getUserById(uid);
        const email = au?.user?.email ?? null;
        const inicio = new Date(o.criadoEm);
        const fim = new Date(inicio); fim.setFullYear(fim.getFullYear() + 100);
        const payload = {
          user_id: uid,
          status: "active",
          plan: "lifetime",
          billing_period: "lifetime",
          payment_method: "pix",
          abacatepay_billing_id: o.orderId,
          customer_email: email,
          current_period_start: inicio.toISOString(),
          current_period_end: fim.toISOString(),
          amount_cents: PRECOS_CENTAVOS[o.offer],
        };
        const { data: existing } = await admin
          .from("subscriptions").select("id").eq("user_id", uid).maybeSingle();
        const { error: gErr } = existing?.id
          ? await admin.from("subscriptions").update(payload).eq("id", existing.id)
          : await admin.from("subscriptions").insert(payload);
        if (gErr) {
          falhas.push({ orderId: o.orderId, erro: gErr.message.slice(0, 120) });
          continue;
        }
        await admin.from("analytics_events").insert({
          event_name: "pix_reconciled",
          user_id: uid,
          event_data: { order_id: o.orderId, offer: o.offer, gateway_status: v.status, amount_cents: PRECOS_CENTAVOS[o.offer] },
        });
        creditados.push({ uid, email, ...o, status: v.status });
        jaTem.add(uid);
        break; // 1 grant por usuário basta (vitalício)
      }
    }

    logStep("Fim", { janelaHoras: hours, usuarios: porUser.size, sondadas, creditados: creditados.length, falhas: falhas.length });
    return jsonResponse({ ok: true, dryRun, janelaHoras: hours, sondadas, creditados, falhas });
  } catch (e) {
    logStep("ERRO", { e: String(e).slice(0, 200) });
    return jsonResponse({ error: String(e).slice(0, 200) }, 500);
  }
});
