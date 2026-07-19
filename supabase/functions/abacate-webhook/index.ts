import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * Webhook da AbacatePay (19/07) — fecha o buraco do "pagou e não liberou".
 *
 * Por quê: o Pix in-app libera acesso no POLLING do app (abacate-pix check).
 * Quem paga no app do banco e não volta pra tela fica sem grant — 9 clientes
 * travados só em 18-19/07. O webhook avisa server-side no instante do
 * pagamento, independente do app estar aberto: libera + CAPI (valor real) +
 * UTMify + e-mail de boas-vindas.
 *
 * SEGURANÇA (dupla trava):
 *   1. secret na query (?webhookSecret=) — padrão AbacatePay.
 *   2. RECONFIRMA o pagamento na API da AbacatePay antes de liberar. Nunca
 *      confia só no corpo do webhook (à prova de payload forjado/variação).
 *
 * Associação compra→conta: pelo registro server-side pix_order_created
 * (order_id → user_id + offer + amount), gravado pela abacate-pix no create.
 * Fallback: eventos pix_generated do cliente.
 *
 * Dedup com o polling do app: o grant checa jaLiberado (assinatura já ativa
 * vitalícia) e só dispara tracking se for a 1ª vez. event_id = orderId no
 * CAPI ⇒ Meta deduplica pixel × servidor. webhook_events garante 1 processa-
 * mento por (evento, cobrança).
 */

const ABACATE_API = "https://api.abacatepay.com/v2";
const PRECOS_CENTAVOS: Record<string, number> = { lifetime: 2790, downsell: 1490 };
const APP_URL = "https://www.coreaplicativo.com.br";

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ABACATE-WEBHOOK] ${step}${d}`);
};
const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const utcStamp = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

type Admin = ReturnType<typeof createClient>;

/** UTMify (espelha abacate-pix.sendToUtmify) — UTM dos eventos do comprador. */
async function sendToUtmify(admin: Admin, args: { userId: string; email: string | null; orderId: string; offer: string; amountCents: number; name: string | null }) {
  const token = Deno.env.get("UTMIFY_API_TOKEN");
  if (!token) return;
  try {
    const pick = (d: Record<string, string>) => ({
      utm_source: d.utm_source || null, utm_medium: d.utm_medium || null,
      utm_campaign: d.utm_campaign || null, utm_content: d.utm_content || null, utm_term: d.utm_term || null,
    });
    let utm = pick({});
    const { data: rows } = await admin.from("analytics_events")
      .select("event_data, session_id").eq("user_id", args.userId)
      .order("created_at", { ascending: false }).limit(60);
    const mine = (rows ?? []) as Array<{ event_data: Record<string, string>; session_id: string | null }>;
    let hit = mine.find((r) => r.event_data?.utm_campaign) ?? mine.find((r) => r.event_data?.utm_source);
    if (!hit?.event_data?.utm_campaign) {
      const sessions = [...new Set(mine.map((r) => r.session_id).filter(Boolean))].slice(0, 5) as string[];
      for (const sid of sessions) {
        const { data: anon } = await admin.from("analytics_events").select("event_data").eq("session_id", sid).is("user_id", null).limit(30);
        const anonHit = (anon ?? []).find((r: { event_data: Record<string, string> }) => r.event_data?.utm_campaign);
        if (anonHit) { hit = anonHit as typeof hit; break; }
      }
    }
    if (hit) utm = pick(hit.event_data);
    const nowStamp = utcStamp(new Date());
    const isDownsell = args.offer === "downsell";
    const payload = {
      orderId: args.orderId, platform: "AbacatePay", paymentMethod: "pix", status: "paid",
      createdAt: nowStamp, approvedDate: nowStamp, refundedAt: null,
      customer: { name: args.name || args.email?.split("@")[0] || "Cliente", email: args.email || "", phone: null, document: null, country: "BR" },
      products: [{ id: args.offer, name: isDownsell ? "CORE Vitalício (oferta)" : "CORE Vitalício", planId: null, planName: "lifetime", quantity: 1, priceInCents: args.amountCents }],
      trackingParameters: { src: null, sck: null, ...utm },
      commission: { totalPriceInCents: args.amountCents, gatewayFeeInCents: 0, userCommissionInCents: args.amountCents },
      isTest: false,
    };
    const res = await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-token": token }, body: JSON.stringify(payload),
    });
    logStep(res.ok ? "UTMify order sent" : "UTMify error", { orderId: args.orderId, status: res.status });
  } catch (e) { logStep("UTMify send failed", { message: (e as Error).message }); }
}

/**
 * CAPI direta do Meta. SEM IP/UA aqui (quem chama é a AbacatePay, não o
 * comprador — usar o IP dela pioraria o match). Match por email + external_id
 * + fbc reconstruído do fbclid dos eventos. event_id = orderId ⇒ dedup com o
 * pixel do navegador. Dormente sem META_PIXEL_ID/META_CAPI_TOKEN.
 */
async function sendMetaCapi(admin: Admin, args: { userId: string; email: string | null; orderId: string; offer: string; amountCents: number }) {
  const pixelId = Deno.env.get("META_PIXEL_ID");
  const token = Deno.env.get("META_CAPI_TOKEN");
  if (!pixelId || !token) return;
  try {
    const sha = async (v: string) => {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v.trim().toLowerCase()));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    };
    let fbc: string | null = null;
    const { data: rows } = await admin.from("analytics_events")
      .select("event_data, created_at").eq("user_id", args.userId)
      .order("created_at", { ascending: false }).limit(60);
    const hit = (rows ?? []).find((r: { event_data: Record<string, string> }) => r.event_data?.fbclid);
    if (hit) fbc = `fb.1.${new Date((hit as { created_at: string }).created_at).getTime()}.${(hit as { event_data: Record<string, string> }).event_data.fbclid}`;
    const payload = {
      data: [{
        event_name: "Purchase", event_time: Math.floor(Date.now() / 1000), event_id: args.orderId,
        action_source: "website", event_source_url: APP_URL,
        user_data: { ...(args.email ? { em: [await sha(args.email)] } : {}), external_id: [await sha(args.userId)], ...(fbc ? { fbc } : {}) },
        custom_data: { value: args.amountCents / 100, currency: "BRL", content_name: args.offer === "downsell" ? "CORE Vitalício (oferta)" : "CORE Vitalício" },
      }],
    };
    const res = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const out = await res.json().catch(() => ({}));
    logStep(res.ok ? "Meta CAPI sent" : "Meta CAPI error", { status: res.status, body: JSON.stringify(out).slice(0, 160) });
  } catch (e) { logStep("Meta CAPI failed", { message: String(e).slice(0, 150) }); }
}

const welcomeHtml = (firstName: string | null, email: string) => `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f5f2ec;font-family:Arial,Helvetica,sans-serif;color:#211d18;">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;"><tr><td style="padding:28px;">
    <h1 style="margin:0 0 12px;font-size:22px;">Pagamento confirmado ✅ Bem-vindo ao CORE${firstName ? `, ${firstName}` : ""} 🎉</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Seu acesso vitalício está <b>ativo</b>. Pra entrar, use:</p>
    <table role="presentation" width="100%" style="background:#f5f2ec;border-radius:12px;"><tr><td style="padding:14px 16px;font-size:13px;line-height:1.7;">
      <b>E-mail:</b> <span style="display:inline-block;margin:4px 0;padding:6px 10px;background:#fff;border-radius:8px;font-weight:700;">${email}</span><br>
      <b>Senha:</b> a mesma que você criou no cadastro.
    </td></tr></table>
    <a href="${APP_URL}/bem-vindo?e=${encodeURIComponent(email)}" style="display:block;margin-top:18px;background:#1f9d55;color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:15px 24px;border-radius:999px;text-align:center;">Acessar o CORE agora →</a>
    <p style="font-size:12px;color:#8a8378;margin:16px 0 0;">Esqueceu a senha? Use "Esqueci minha senha" com esse mesmo e-mail.</p>
  </td></tr></table>
</body></html>`;

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const secret = Deno.env.get("ABACATE_WEBHOOK_SECRET");
  const apiKey = Deno.env.get("ABACATE_API_KEY") ?? "";
  if (!secret || !apiKey) { logStep("Missing ABACATE_WEBHOOK_SECRET/API_KEY"); return new Response("Server misconfiguration", { status: 500 }); }

  // TRAVA 1: secret na query (?webhookSecret=)
  const url = new URL(req.url);
  if (url.searchParams.get("webhookSecret") !== secret) { logStep("Invalid webhook secret"); return new Response("Unauthorized", { status: 401 }); }

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({}));
    const event = String(body.event ?? body.type ?? "");
    const data = body.data ?? body.billing ?? {};
    // id da cobrança em qualquer forma que a AbacatePay mande
    const chargeId = String(
      data.id ?? data.pixQrCode?.id ?? data.billing?.id ?? data.charge?.id ?? data.transaction?.id ?? body.id ?? "",
    );
    logStep("Webhook received", { event, chargeId: chargeId.slice(0, 24) });
    if (!chargeId) return jsonResponse({ received: true, note: "no_charge_id" });

    // idempotência por (evento, cobrança)
    const { error: dupErr } = await admin.from("webhook_events").insert({ id: `${event}:${chargeId}`, source: "abacatepay", event });
    if (dupErr && (dupErr as { code?: string }).code === "23505") {
      logStep("Duplicate ignored", { event, chargeId: chargeId.slice(0, 24) });
      return jsonResponse({ received: true, duplicate: true });
    }

    // TRAVA 2: reconfirma o pagamento na API (nunca confia só no payload)
    const chk = await fetch(`${ABACATE_API}/transparents/check?id=${encodeURIComponent(chargeId)}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    const chkOut = await chk.json().catch(() => ({}));
    const status = chkOut?.data?.status ?? "UNKNOWN";
    if (status !== "PAID") { logStep("Not paid — ignoring", { chargeId: chargeId.slice(0, 24), status }); return jsonResponse({ received: true, status }); }

    // resolve dono + oferta: 1º pix_order_created (server), 2º pix_generated (cliente), 3º metadata da cobrança
    let userId: string | null = null;
    let offer = "";
    const { data: reg } = await admin.from("analytics_events").select("user_id, event_data").eq("event_name", "pix_order_created").contains("event_data", { order_id: chargeId }).limit(1);
    if (reg?.[0]) { userId = reg[0].user_id as string; offer = String((reg[0].event_data as Record<string, string>)?.offer ?? ""); }
    if (!userId) {
      const { data: gen } = await admin.from("analytics_events").select("user_id, event_data").in("event_name", ["pix_generated", "funnel_v2_pix_generated"]).contains("event_data", { order_id: chargeId }).limit(1);
      if (gen?.[0]) { userId = gen[0].user_id as string; offer = String((gen[0].event_data as Record<string, string>)?.offer ?? offer); }
    }
    if (!offer) {
      const ext = chkOut?.data?.metadata?.externalId as string | undefined;
      offer = ext?.split(":")[1] === "downsell" ? "downsell" : "lifetime";
    }
    if (!userId) { logStep("No user resolved for charge", { chargeId: chargeId.slice(0, 24) }); return jsonResponse({ received: true, warning: "no_user" }); }
    if (offer !== "downsell" && offer !== "lifetime") offer = "lifetime";
    const amountCents = PRECOS_CENTAVOS[offer];

    // grant idempotente + dedup com o polling do app (jaLiberado)
    const { data: existing } = await admin.from("subscriptions").select("id, status, plan").eq("user_id", userId).maybeSingle();
    const jaLiberado = existing?.status === "active" && existing?.plan === "lifetime";
    const { data: u } = await admin.auth.admin.getUserById(userId);
    const email = u?.user?.email ?? null;
    const now = new Date();
    const periodEnd = new Date(now); periodEnd.setFullYear(periodEnd.getFullYear() + 100);
    const payload = {
      user_id: userId, status: "active", plan: "lifetime", billing_period: "lifetime",
      payment_method: "pix", abacatepay_billing_id: chargeId, customer_email: email, amount_cents: amountCents,
      current_period_start: now.toISOString(), current_period_end: periodEnd.toISOString(),
    };
    if (existing?.id) await admin.from("subscriptions").update(payload).eq("id", existing.id);
    else await admin.from("subscriptions").insert(payload);
    logStep("Access granted", { userId, offer, chargeId: chargeId.slice(0, 24), jaLiberado });

    if (!jaLiberado) {
      const { data: p } = await admin.from("profiles").select("display_name").eq("id", userId).maybeSingle();
      const displayName = (p?.display_name ?? "").trim() || null;
      await sendToUtmify(admin, { userId, email, orderId: chargeId, offer, amountCents, name: displayName });
      await sendMetaCapi(admin, { userId, email, orderId: chargeId, offer, amountCents });
      try {
        const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
        const from = Deno.env.get("WELCOME_EMAIL_FROM") || Deno.env.get("RECOVERY_EMAIL_FROM") || "onboarding@resend.dev";
        if (resendKey && email) {
          const firstName = (displayName ?? "").split(" ")[0] || null;
          await fetch("https://api.resend.com/emails", {
            method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from, to: [email], subject: "Seu acesso vitalício ao CORE tá ativo ✅", html: welcomeHtml(firstName, email) }),
          });
          logStep("Welcome email sent", { to: email.slice(0, 3) + "***" });
        }
      } catch (e) { logStep("Welcome email failed", { message: String(e).slice(0, 120) }); }
    }
    return jsonResponse({ received: true, granted: true });
  } catch (error) {
    logStep("ERROR", { message: error instanceof Error ? error.message : String(error) });
    return jsonResponse({ received: true, error: "internal" }); // 200 pra AbacatePay não re-tentar em loop em erro nosso
  }
});
