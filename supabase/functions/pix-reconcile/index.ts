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
const PRECOS_CENTAVOS: Record<string, number> = { lifetime: 9790, downsell: 1990, w97: 9790 };
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

    // agrupa por usuário; ignora QR sem user (não deveria existir — create exige JWT)
    type Ordem = {
      orderId: string; offer: string; criadoEm: string; amountCents: number | null;
      // sinais de match pro CAPI — o cakto-pix grava tudo isso no create (10/08)
      fbp: string | null; fbc: string | null; ip: string | null; ua: string | null; sourceUrl: string | null;
    };
    const porUser = new Map<string, Ordem[]>();
    for (const q of qrs ?? []) {
      const uid = q.user_id as string | null;
      const oid = String(q.event_data?.order_id ?? "");
      if (!uid || !oid) continue;
      const offer = q.event_data?.offer === "downsell" ? "downsell" : "lifetime";
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
          else if (ehUuid(o.orderId)) v = await statusCakto(await caktoToken(), o.orderId);
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
          amount_cents: o.amountCents ?? PRECOS_CENTAVOS[o.offer],
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
                  content_name: o.offer === "downsell" ? "CORE Vitalício (oferta)" : "CORE Vitalício",
                },
              }],
            };
            const capiRes = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${capiToken}`, {
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
