import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * Webhook da KIWIFY (20/07) — checkout hospedado do funil v3 (/plano).
 *
 * Compra aprovada → grant VITALÍCIO por E-MAIL (o cadastro do funil vem
 * ANTES do checkout e o e-mail chega prefilado — vínculo garantido) +
 * e-mail de boas-vindas + Meta CAPI (valor real, event_id = order_id) +
 * UTMify. Reembolso/chargeback → status canceled.
 *
 * SEGURANÇA: assinatura HMAC-SHA1 do corpo com o token do webhook
 * (?signature= na query, padrão Kiwify). Sem KIWIFY_WEBHOOK_TOKEN → 500.
 * Idempotência: webhook_events (`kiwify:{status}:{order_id}`).
 * Valor: Commissions.charge_amount em centavos (2790 cheio / 1490 roleta).
 */

const APP_URL = "https://www.coreaplicativo.com.br";
const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[KIWIFY-WEBHOOK] ${step}${d}`);
};
const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const utcStamp = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

type Admin = ReturnType<typeof createClient>;

async function hmacSha1Hex(chave: string, corpo: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(chave), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(corpo));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function acharUidPorEmail(admin: Admin, email: string): Promise<string | null> {
  const alvo = email.toLowerCase();
  const { data: sub } = await admin.from("subscriptions").select("user_id").ilike("customer_email", alvo).limit(1).maybeSingle();
  if (sub?.user_id) return sub.user_id as string;
  for (let page = 1; page <= 40; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) { logStep("listUsers error", { message: error.message }); break; }
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === alvo);
    if (hit) return hit.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function sendToUtmify(admin: Admin, args: { userId: string; email: string; orderId: string; amountCents: number; name: string | null; tracking: Record<string, string | null> }) {
  const token = Deno.env.get("UTMIFY_API_TOKEN");
  if (!token) return;
  try {
    const pick = (d: Record<string, string | null>) => ({
      utm_source: d.utm_source || null, utm_medium: d.utm_medium || null,
      utm_campaign: d.utm_campaign || null, utm_content: d.utm_content || null, utm_term: d.utm_term || null,
    });
    // UTM: tracking do próprio pedido Kiwify > eventos do comprador
    let utm = pick(args.tracking ?? {});
    if (!utm.utm_campaign) {
      const { data: rows } = await admin.from("analytics_events")
        .select("event_data").eq("user_id", args.userId)
        .order("created_at", { ascending: false }).limit(60);
      const hit = (rows ?? []).find((r: { event_data: Record<string, string> }) => r.event_data?.utm_campaign)
        ?? (rows ?? []).find((r: { event_data: Record<string, string> }) => r.event_data?.utm_source);
      if (hit) utm = pick(hit.event_data);
    }
    const nowStamp = utcStamp(new Date());
    const isDownsell = args.amountCents < 2000;
    const payload = {
      orderId: args.orderId, platform: "Kiwify", paymentMethod: "pix", status: "paid",
      createdAt: nowStamp, approvedDate: nowStamp, refundedAt: null,
      customer: { name: args.name || args.email.split("@")[0], email: args.email, phone: null, document: null, country: "BR" },
      products: [{ id: isDownsell ? "downsell" : "lifetime", name: isDownsell ? "CORE Vitalício (oferta)" : "CORE Vitalício", planId: null, planName: "lifetime", quantity: 1, priceInCents: args.amountCents }],
      trackingParameters: { src: null, sck: null, ...utm },
      commission: { totalPriceInCents: args.amountCents, gatewayFeeInCents: 0, userCommissionInCents: args.amountCents },
      isTest: false,
    };
    const res = await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-token": token }, body: JSON.stringify(payload),
    });
    logStep(res.ok ? "UTMify sent" : "UTMify error", { status: res.status });
  } catch (e) { logStep("UTMify failed", { message: (e as Error).message }); }
}

async function sendMetaCapi(admin: Admin, args: { userId: string; email: string; orderId: string; amountCents: number }) {
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
        action_source: "website", event_source_url: `${APP_URL}/plano`,
        user_data: { em: [await sha(args.email)], external_id: [await sha(args.userId)], ...(fbc ? { fbc } : {}) },
        custom_data: { value: args.amountCents / 100, currency: "BRL", content_name: args.amountCents < 2000 ? "CORE Vitalício (oferta)" : "CORE Vitalício" },
      }],
    };
    const res = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const out = await res.json().catch(() => ({}));
    logStep(res.ok ? "Meta CAPI sent" : "Meta CAPI error", { status: res.status, body: JSON.stringify(out).slice(0, 140) });
  } catch (e) { logStep("Meta CAPI failed", { message: String(e).slice(0, 140) }); }
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const token = Deno.env.get("KIWIFY_WEBHOOK_TOKEN");
  if (!token) { logStep("Missing KIWIFY_WEBHOOK_TOKEN"); return new Response("Server misconfiguration", { status: 500 }); }

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

  try {
    const raw = await req.text();
    // assinatura HMAC-SHA1 (query ?signature=; alguns envios usam header)
    const url = new URL(req.url);
    const assinatura = url.searchParams.get("signature") ?? req.headers.get("x-kiwify-signature") ?? "";
    const esperada = await hmacSha1Hex(token, raw);
    if (assinatura !== esperada) {
      logStep("Invalid signature", { veio: assinatura.slice(0, 12) });
      return new Response("Unauthorized", { status: 401 });
    }

    const body = JSON.parse(raw || "{}");
    const pedido = body.order ?? body; // Kiwify manda plano OU embrulhado
    const status = String(pedido.order_status ?? body.webhook_event_type ?? "").toLowerCase();
    const orderId = String(pedido.order_id ?? pedido.order_ref ?? "");
    const email = String(pedido.Customer?.email ?? pedido.customer?.email ?? "").toLowerCase();
    const nome = String(pedido.Customer?.full_name ?? pedido.Customer?.first_name ?? "").trim() || null;
    const amountCents = Number(pedido.Commissions?.charge_amount ?? pedido.charge_amount ?? 0) || 2790;
    const tracking = (pedido.TrackingParameters ?? {}) as Record<string, string | null>;
    logStep("Webhook received", { status, orderId: orderId.slice(0, 18), email: email.slice(0, 3) + "***", amountCents });

    if (!orderId) return jsonResponse({ received: true, note: "no_order_id" });

    // idempotência por (status, pedido)
    const { error: dupErr } = await admin.from("webhook_events").insert({ id: `kiwify:${status}:${orderId}`, source: "kiwify", event: status });
    if (dupErr && (dupErr as { code?: string }).code === "23505") {
      return jsonResponse({ received: true, duplicate: true });
    }

    const aprovado = ["paid", "approved", "order_approved", "compra aprovada", "compra_aprovada"].some((s) => status.includes(s));
    const estorno = ["refund", "chargeback", "reembols", "charged_back"].some((s) => status.includes(s));

    if (aprovado) {
      if (!email) return jsonResponse({ received: true, warning: "no_email" });
      const uid = await acharUidPorEmail(admin, email);
      if (!uid) {
        // compra com e-mail sem conta (digitou outro no checkout) — loga alto
        // pra aparecer no suporte; o grant manual via admin-suporte resolve
        logStep("NO USER for paid order", { email: email.slice(0, 3) + "***", orderId });
        return jsonResponse({ received: true, warning: "no_user_found" });
      }
      const now = new Date();
      const fim = new Date(now); fim.setFullYear(fim.getFullYear() + 100);
      const payload = {
        user_id: uid, status: "active", plan: "lifetime", billing_period: "lifetime",
        payment_method: "pix", abacatepay_billing_id: orderId, customer_email: email,
        amount_cents: amountCents, current_period_start: now.toISOString(), current_period_end: fim.toISOString(),
      };
      const { data: existing } = await admin.from("subscriptions").select("id, status, plan").eq("user_id", uid).maybeSingle();
      const jaLiberado = existing?.status === "active" && existing?.plan === "lifetime";
      if (existing?.id) await admin.from("subscriptions").update(payload).eq("id", existing.id);
      else await admin.from("subscriptions").insert(payload);
      logStep("Access granted", { uid, amountCents, jaLiberado });

      if (!jaLiberado) {
        await sendToUtmify(admin, { userId: uid, email, orderId, amountCents, name: nome, tracking });
        await sendMetaCapi(admin, { userId: uid, email, orderId, amountCents });
        try {
          const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
          const from = Deno.env.get("WELCOME_EMAIL_FROM") || Deno.env.get("RECOVERY_EMAIL_FROM") || "onboarding@resend.dev";
          if (resendKey) {
            await fetch("https://api.resend.com/emails", {
              method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from, to: [email],
                subject: "Seu acesso vitalício ao CORE tá ativo ✅",
                html: `<p>Pagamento confirmado! Seu acesso vitalício ao CORE está <b>ativo</b>. Entre com <b>${email}</b> e a senha que você criou: <a href="${APP_URL}/bem-vindo?e=${encodeURIComponent(email)}">acessar o CORE agora</a>.</p>`,
              }),
            });
            logStep("Welcome email sent");
          }
        } catch (e) { logStep("Welcome email failed", { message: String(e).slice(0, 100) }); }
      }
      return jsonResponse({ received: true, granted: true });
    }

    if (estorno) {
      if (email) {
        const uid = await acharUidPorEmail(admin, email);
        if (uid) {
          await admin.from("subscriptions").update({ status: "canceled" }).eq("user_id", uid);
          logStep("Access revoked", { uid, status });
        }
      }
      return jsonResponse({ received: true, revoked: true });
    }

    logStep("Unhandled status", { status });
    return jsonResponse({ received: true });
  } catch (e) {
    logStep("ERROR", { message: e instanceof Error ? e.message : String(e) });
    return jsonResponse({ received: true, error: "internal" });
  }
});
