import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * Webhook do ASAAS (21/07) — fecha o "pagou e não liberou" de quem paga no
 * app do banco e fecha a tela antes do polling confirmar.
 *
 * PARTICULARIDADES do Asaas que moldaram este código (pesquisadas + a doc):
 *  - Autenticação: NÃO tem assinatura HMAC. O mecanismo é um token estático no
 *    header `asaas-access-token`, configurado no cadastro do webhook.
 *  - Evento de Pix pago: PAYMENT_RECEIVED (saldo disponível). Escutamos também
 *    PAYMENT_CONFIRMED (pago, mas conta em antifraude pode segurar até 72h) —
 *    o cliente JÁ pagou, então liberamos nos dois.
 *  - Entrega "at least once" → idempotência OBRIGATÓRIA pelo `id` do EVENTO
 *    (evt_...), não pelo payment.id.
 *  - Se responder ≠ 200 ou demorar >10s, conta como falha; 15 falhas seguidas
 *    PAUSAM a fila (manual pra religar) e eventos com +14 dias somem. Então:
 *    responder 200 SEMPRE (inclusive em erro nosso) e rápido.
 *
 * SEGURANÇA (dupla trava, como nos outros webhooks):
 *   1. token no header asaas-access-token == ASAAS_WEBHOOK_SECRET.
 *   2. RECONFIRMA o pagamento na API do Asaas antes de liberar (nunca confia
 *      só no corpo do webhook).
 *
 * Associação compra→conta: o QR estático não carrega nosso usuário. O elo é o
 * pixQrCodeId do payment (= order_id gravado em pix_order_created no create).
 */

const ASAAS_API = "https://api.asaas.com/v3";
/* TEM QUE ESPELHAR o asaas-pix. Se uma oferta existe lá e não existe aqui, a
 * linha abaixo a rebaixa pra "lifetime" e a venda entra pelo preço errado —
 * dinheiro real registrado como outro valor, e o CAPI da Meta disparando o
 * número errado junto. Foi o que quase aconteceu com o w97 (01/09). */
const PRECOS_CENTAVOS: Record<string, number> = { lifetime: 2790, downsell: 1490, w97: 9790 };
const APP_URL = "https://www.coreaplicativo.com.br";
const PAGOS = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ASAAS-WEBHOOK] ${step}${d}`);
};
const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const utcStamp = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
const asaasHeaders = (key: string) => ({ access_token: key, "User-Agent": "CORE/1.0 (Supabase Edge)" });

type Admin = ReturnType<typeof createClient>;

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
      orderId: args.orderId, platform: "Asaas", paymentMethod: "pix", status: "paid",
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

async function sendMetaCapi(admin: Admin, args: { userId: string; email: string | null; orderId: string; offer: string; amountCents: number; fbp?: string | null; fbc?: string | null; sourceUrl?: string | null }) {
  const pixelId = Deno.env.get("META_PIXEL_ID");
  const token = Deno.env.get("META_CAPI_TOKEN");
  if (!pixelId || !token) return;
  try {
    const sha = async (v: string) => {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v.trim().toLowerCase()));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    };
    // fbc: 1º o cookie salvo no create (22/07 — sinal de navegador de
    // verdade), 2º reconstrução via fbclid dos eventos (fallback antigo).
    let fbc: string | null = args.fbc ?? null;
    if (!fbc) {
      const { data: rows } = await admin.from("analytics_events")
        .select("event_data, created_at").eq("user_id", args.userId)
        .order("created_at", { ascending: false }).limit(60);
      const hit = (rows ?? []).find((r: { event_data: Record<string, string> }) => r.event_data?.fbclid);
      if (hit) fbc = `fb.1.${new Date((hit as { created_at: string }).created_at).getTime()}.${(hit as { event_data: Record<string, string> }).event_data.fbclid}`;
    }
    const payload = {
      data: [{
        event_name: "Purchase", event_time: Math.floor(Date.now() / 1000), event_id: args.orderId,
        action_source: "website", event_source_url: args.sourceUrl || APP_URL,
        user_data: {
          ...(args.email ? { em: [await sha(args.email)] } : {}),
          external_id: [await sha(args.userId)],
          ...(fbc ? { fbc } : {}),
          ...(args.fbp ? { fbp: args.fbp } : {}),
        },
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

  const secret = Deno.env.get("ASAAS_WEBHOOK_SECRET");
  const apiKey = Deno.env.get("ASAAS_API_KEY") ?? "";
  if (!secret || !apiKey) { logStep("Missing ASAAS_WEBHOOK_SECRET/API_KEY"); return new Response("Server misconfiguration", { status: 500 }); }

  // TRAVA 1: token no header (padrão Asaas)
  if (req.headers.get("asaas-access-token") !== secret) { logStep("Invalid webhook token"); return new Response("Unauthorized", { status: 401 }); }

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({}));
    const eventId = String(body.id ?? "");        // evt_... — chave de idempotência
    const event = String(body.event ?? "");
    const payment = body.payment ?? {};
    const qrCodeId = String(payment.pixQrCodeId ?? "");
    logStep("Webhook received", { event, eventId: eventId.slice(0, 20), qrCodeId: qrCodeId.slice(0, 20) });

    // só cobrança paga interessa; o resto reconhecemos com 200 e ignoramos
    if (event !== "PAYMENT_RECEIVED" && event !== "PAYMENT_CONFIRMED") {
      return jsonResponse({ received: true, ignored: event });
    }
    if (!eventId) return jsonResponse({ received: true, note: "no_event_id" });

    // idempotência pelo ID DO EVENTO (entrega at-least-once → chega duplicado)
    const { error: dupErr } = await admin.from("webhook_events").insert({ id: `asaas:${eventId}`, source: "asaas", event });
    if (dupErr && (dupErr as { code?: string }).code === "23505") {
      logStep("Duplicate ignored", { eventId: eventId.slice(0, 20) });
      return jsonResponse({ received: true, duplicate: true });
    }

    if (!qrCodeId) { logStep("Pagamento sem pixQrCodeId (não é do nosso QR estático)", { paymentId: payment.id }); return jsonResponse({ received: true, warning: "no_qr" }); }

    // TRAVA 2: reconfirma na API — lista os payments desse QR e exige status pago
    const chk = await fetch(`${ASAAS_API}/payments?pixQrCodeId=${encodeURIComponent(qrCodeId)}&limit=10`, { headers: asaasHeaders(apiKey) });
    const chkOut = await chk.json().catch(() => ({}));
    const pago = (chkOut?.data ?? []).find((p: { status?: string }) => PAGOS.has(String(p?.status)));
    if (!pago) { logStep("Not paid on reconfirm — ignoring", { qrCodeId: qrCodeId.slice(0, 20) }); return jsonResponse({ received: true, status: "not_paid" }); }

    // resolve dono + oferta pelo registro do create (o QR estático não tem nosso user)
    let userId: string | null = null;
    let offer = "";
    const { data: reg } = await admin.from("analytics_events").select("user_id, event_data").eq("event_name", "pix_order_created").contains("event_data", { order_id: qrCodeId }).limit(1);
    const regData = (reg?.[0]?.event_data ?? {}) as Record<string, string>;
    if (reg?.[0]) { userId = reg[0].user_id as string; offer = String(regData.offer ?? ""); }
    if (!userId) { logStep("No user resolved for QR", { qrCodeId: qrCodeId.slice(0, 20) }); return jsonResponse({ received: true, warning: "no_user" }); }
    if (!(offer in PRECOS_CENTAVOS)) offer = "lifetime";
    const amountCents = PRECOS_CENTAVOS[offer];

    // grant idempotente + dedup com o polling do app
    const { data: existing } = await admin.from("subscriptions").select("id, status, plan").eq("user_id", userId).maybeSingle();
    const jaLiberado = existing?.status === "active" && existing?.plan === "lifetime";
    const { data: u } = await admin.auth.admin.getUserById(userId);
    const email = u?.user?.email ?? null;
    const now = new Date();
    const periodEnd = new Date(now); periodEnd.setFullYear(periodEnd.getFullYear() + 100);
    const payload = {
      user_id: userId, status: "active", plan: "lifetime", billing_period: "lifetime",
      payment_method: "pix", abacatepay_billing_id: qrCodeId, customer_email: email, amount_cents: amountCents,
      current_period_start: now.toISOString(), current_period_end: periodEnd.toISOString(),
    };
    if (existing?.id) await admin.from("subscriptions").update(payload).eq("id", existing.id);
    else await admin.from("subscriptions").insert(payload);
    logStep("Access granted", { userId, offer, qrCodeId: qrCodeId.slice(0, 20), jaLiberado });

    if (!jaLiberado) {
      const { data: p } = await admin.from("profiles").select("display_name").eq("id", userId).maybeSingle();
      const displayName = (p?.display_name ?? "").trim() || null;
      await sendToUtmify(admin, { userId, email, orderId: qrCodeId, offer, amountCents, name: displayName });
      await sendMetaCapi(admin, {
        userId, email, orderId: qrCodeId, offer, amountCents,
        fbp: regData.fbp ?? null, fbc: regData.fbc ?? null, sourceUrl: regData.source_url ?? null,
      });
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
    return jsonResponse({ received: true, error: "internal" }); // 200 SEMPRE — senão a fila do Asaas pausa
  }
});
