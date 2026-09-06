import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * Pix in-app via PAGAR.ME (21/07): braço B do teste A/B de gateway — a taxa
 * QR→pago da AbacatePay rodava ~48% e o dono quer medir se o trilho Stone
 * converte melhor. MESMO contrato de request/response da abacate-pix: o
 * PixCheckout só troca o nome da função.
 *
 * Diferenças de gateway que importam (testadas ao vivo em 21/07):
 *  - Pagar.me PSP EXIGE document (CPF) e phone no customer — sem CPF a charge
 *    nasce "failed" com "The customer Document is required". Sem CPF válido no
 *    request, devolvemos { error: "cpf_required" } e o client reabre o form.
 *    Telefone vai coringa (mesmo padrão DUMMY_PHONE da Cakto/Abacate).
 *  - Auth é HTTP Basic com a secret key como username e senha vazia.
 *  - O QR vem em charges[0].last_transaction (qr_code copia-e-cola; a URL de
 *    PNG deles pode exigir sessão, então mandamos qrCodeBase64: null e o
 *    client renderiza o QRCodeSVG a partir do copia-e-cola).
 *
 * Duas ações num endpoint só (paridade abacate-pix):
 *  - create: POST /core/v5/orders → QR + copia-cola + registro pix_order_created
 *  - check:  GET /core/v5/orders/{id}; quando paid, LIBERA na hora (upsert em
 *    subscriptions) + UTMify + Meta CAPI + e-mail de boas-vindas.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAGARME_API = "https://api.pagar.me/core/v5";
const PRECOS_CENTAVOS: Record<string, number> = { lifetime: 9790, downsell: 1490, w97: 9790, w25: 2490, w47: 4790 };
const CONCESSAO: Record<string, { plano: string; periodo: string; dias: number | null }> = {
  lifetime: { plano: "lifetime", periodo: "lifetime", dias: null },
  downsell: { plano: "lifetime", periodo: "lifetime", dias: null },
  w97: { plano: "lifetime", periodo: "lifetime", dias: null },
  w25: { plano: "web", periodo: "monthly_prepaid", dias: 30 },
  w47: { plano: "lifetime", periodo: "lifetime", dias: null }, // 06/09: vitalício web 47,90
};

// Pagar.me exige phone; não pedimos (fricção) — coringa, mesmo padrão dos
// outros gateways da casa.
const DUMMY_PHONE = { country_code: "55", area_code: "11", number: "999999999" };

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PAGARME-PIX] ${step}${d}`);
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const onlyDigits = (v?: string | null) => (v ?? "").replace(/\D/g, "");
const utcStamp = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
const basicAuth = (key: string) => `Basic ${btoa(`${key}:`)}`;

/** Espelho do sendToUtmify da abacate-pix — só muda platform. */
async function sendToUtmify(
  admin: ReturnType<typeof createClient>,
  args: { userId: string; email: string | null; orderId: string; offer: string; amountCents: number; name: string | null },
) {
  const token = Deno.env.get("UTMIFY_API_TOKEN");
  if (!token) { logStep("UTMify skipped: no token"); return; }
  try {
    const pick = (d: Record<string, string>) => ({
      utm_source: d.utm_source || null,
      utm_medium: d.utm_medium || null,
      utm_campaign: d.utm_campaign || null,
      utm_content: d.utm_content || null,
      utm_term: d.utm_term || null,
    });
    let utm = pick({});
    const { data: rows } = await admin
      .from("analytics_events")
      .select("event_data, session_id")
      .eq("user_id", args.userId)
      .order("created_at", { ascending: false })
      .limit(60);
    const mine = (rows ?? []) as Array<{ event_data: Record<string, string>; session_id: string | null }>;
    let hit = mine.find((r) => r.event_data?.utm_campaign) ?? mine.find((r) => r.event_data?.utm_source);
    if (!hit?.event_data?.utm_campaign) {
      const sessions = [...new Set(mine.map((r) => r.session_id).filter(Boolean))].slice(0, 5) as string[];
      for (const sid of sessions) {
        const { data: anon } = await admin
          .from("analytics_events")
          .select("event_data")
          .eq("session_id", sid)
          .is("user_id", null)
          .limit(30);
        const anonHit = (anon ?? []).find((r: { event_data: Record<string, string> }) => r.event_data?.utm_campaign);
        if (anonHit) { hit = anonHit as typeof hit; break; }
      }
    }
    if (hit) utm = pick(hit.event_data);

    const nowStamp = utcStamp(new Date());
    const isDownsell = args.offer === "downsell";
    const payload = {
      orderId: args.orderId,
      platform: "Pagarme",
      paymentMethod: "pix",
      status: "paid",
      createdAt: nowStamp,
      approvedDate: nowStamp,
      refundedAt: null,
      customer: {
        name: args.name || args.email?.split("@")[0] || "Cliente",
        email: args.email || "",
        phone: null,
        document: null,
        country: "BR",
      },
      products: [{
        id: args.offer,
        name: isDownsell ? "CORE Vitalício (oferta)" : "CORE Vitalício",
        planId: null,
        planName: "lifetime",
        quantity: 1,
        priceInCents: args.amountCents,
      }],
      trackingParameters: { src: null, sck: null, ...utm },
      commission: {
        totalPriceInCents: args.amountCents,
        gatewayFeeInCents: 0,
        userCommissionInCents: args.amountCents,
      },
      isTest: false,
    };
    const res = await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-token": token },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      logStep("UTMify error", { status: res.status, body: txt.slice(0, 300) });
    } else {
      logStep("UTMify order sent", { orderId: args.orderId, priceInCents: args.amountCents, utm_source: utm.utm_source });
    }
  } catch (e) {
    logStep("UTMify send failed", { message: (e as Error).message });
  }
}

/** Espelho do sendMetaCapi da abacate-pix (event_id = orderId → dedup). */
async function sendMetaCapi(
  admin: ReturnType<typeof createClient>,
  args: {
    userId: string; email: string | null; orderId: string; offer: string;
    amountCents: number; req: Request; fbp?: string | null; fbc?: string | null;
    sourceUrl?: string | null;
  },
) {
  const pixelId = Deno.env.get("META_PIXEL_ID");
  const token = Deno.env.get("META_CAPI_TOKEN");
  if (!pixelId || !token) return; // dormente
  try {
    const sha = async (v: string) => {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v.trim().toLowerCase()));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    };
    let fbc = args.fbc ?? null;
    if (!fbc) {
      const { data: rows } = await admin.from("analytics_events")
        .select("event_data, created_at").eq("user_id", args.userId)
        .order("created_at", { ascending: false }).limit(60);
      const hit = (rows ?? []).find((r: { event_data: Record<string, string> }) => r.event_data?.fbclid);
      if (hit) fbc = `fb.1.${new Date(hit.created_at).getTime()}.${hit.event_data.fbclid}`;
    }
    const ip = (args.req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
    const ua = args.req.headers.get("user-agent") || null;
    const payload = {
      data: [{
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: args.orderId,
        action_source: "website",
        event_source_url: args.sourceUrl || "https://www.coreaplicativo.com.br",
        user_data: {
          ...(args.email ? { em: [await sha(args.email)] } : {}),
          external_id: [await sha(args.userId)],
          ...(ip ? { client_ip_address: ip } : {}),
          ...(ua ? { client_user_agent: ua } : {}),
          ...(fbc ? { fbc } : {}),
          ...(args.fbp ? { fbp: args.fbp } : {}),
        },
        custom_data: {
          value: args.amountCents / 100,
          currency: "BRL",
          content_name: args.offer === "downsell" ? "CORE Vitalício (oferta)" : "CORE Vitalício",
        },
      }],
    };
    const res = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const out = await res.json().catch(() => ({}));
    logStep(res.ok ? "Meta CAPI sent" : "Meta CAPI error", { status: res.status, body: JSON.stringify(out).slice(0, 200) });
  } catch (e) {
    logStep("Meta CAPI failed (non-blocking)", { message: String(e).slice(0, 150) });
  }
}

/** E-mail de boas-vindas (mesmo template da abacate-pix). */
const welcomeHtml = (firstName: string | null, email: string) => `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f2ec;font-family:Arial,Helvetica,sans-serif;color:#211d18;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;">
    <tr><td style="padding:28px;">
      <h1 style="margin:0 0 12px;font-size:22px;">Bem-vindo ao CORE${firstName ? `, ${firstName}` : ""} 🎉</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Seu acesso vitalício está <b>ativo</b>. Pra entrar, use exatamente:</p>
      <table role="presentation" width="100%" style="background:#f5f2ec;border-radius:12px;"><tr><td style="padding:14px 16px;font-size:13px;line-height:1.7;">
        <b>E-mail:</b> <span style="display:inline-block;margin:4px 0;padding:6px 10px;background:#fff;border-radius:8px;font-weight:700;">${email}</span><br>
        <b>Senha:</b> a mesma que você criou no cadastro.
      </td></tr></table>
      <a href="https://www.coreaplicativo.com.br/bem-vindo?e=${encodeURIComponent(email)}" style="display:block;margin-top:18px;background:#1f9d55;color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:15px 24px;border-radius:999px;text-align:center;">Acessar o CORE agora →</a>
      <p style="font-size:12px;color:#8a8378;margin:16px 0 0;">Esqueceu a senha? Use "Esqueci minha senha" na tela de entrada, com esse mesmo e-mail.</p>
    </td></tr>
  </table>
</body></html>`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const apiKey = Deno.env.get("PAGARME_API_KEY") ?? "";

    if (!apiKey) {
      logStep("Missing PAGARME_API_KEY secret");
      return jsonResponse({ error: "Pagamento indisponível no momento. Tente de novo em instantes." }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Authorization header missing" }, 401);
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !authData?.user) return jsonResponse({ error: "User not authenticated" }, 401);
    const user = authData.user;

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON body" }, 400); }
    const action = String(body.action ?? "create");

    // -------------------------------------------------------------- CREATE
    if (action === "create") {
      const offer = String(body.offer ?? "lifetime");
      const amount = PRECOS_CENTAVOS[offer];
      if (!amount) return jsonResponse({ error: "Oferta não configurada. Avise o suporte." }, 503);

      // CPF é OBRIGATÓRIO na Pagar.me PSP (testado 21/07: charge nasce failed
      // sem document). Sem CPF de 11 dígitos → o client reabre o form.
      const customer = (body.customer ?? {}) as Record<string, string | undefined>;
      const docNumber = onlyDigits(customer.docNumber);
      if (docNumber.length !== 11) return jsonResponse({ error: "cpf_required" });
      const name = (customer.name ?? "").trim() || user.email?.split("@")[0] || "Cliente CORE";
      // CPF vai pro profile — próxima compra não pede de novo (paridade cakto)
      await supabaseAdmin.from("profiles").update({ tax_id: docNumber }).eq("id", user.id);

      const res = await fetch(`${PAGARME_API}/orders`, {
        method: "POST",
        headers: { Authorization: basicAuth(apiKey), "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{
            amount,
            description: offer === "downsell" ? "CORE vitalicio (oferta)" : "CORE vitalicio",
            quantity: 1,
          }],
          customer: {
            name,
            email: user.email ?? "cliente@coreaplicativo.com.br",
            type: "individual",
            document: docNumber,
            phones: { mobile_phone: DUMMY_PHONE },
          },
          payments: [{ payment_method: "pix", pix: { expires_in: 1800 } }],
          metadata: { externalId: `${user.id}:${offer}` },
        }),
      });
      const out = await res.json().catch(() => ({}));
      const charge = out?.charges?.[0];
      const tran = charge?.last_transaction;
      // Pagar.me devolve HTTP 200 mesmo com charge "failed" (testado) — o
      // sinal de sucesso é o qr_code existir e a transação estar aguardando.
      if (!res.ok || !tran?.qr_code || tran?.status === "failed") {
        const gwErrors = tran?.gateway_response?.errors ?? out?.errors ?? null;
        logStep("Pagarme create error", { status: res.status, body: JSON.stringify(gwErrors ?? out).slice(0, 600) });
        return jsonResponse({
          error: "Não consegui gerar o Pix agora. Tenta de novo em alguns segundos.",
          ...(body.debug === true ? { gw: { status: res.status, body: JSON.stringify(gwErrors ?? out).slice(0, 400) } } : {}),
        }, 502);
      }
      logStep("Pix created", { id: out.id, charge: charge.id, amount });
      // FONTE DA VERDADE oferta↔cobrança (mesma disciplina da abacate-pix):
      // gravado pelo SERVIDOR, com a marca do gateway pro A/B.
      await supabaseAdmin.from("analytics_events").insert({
        event_name: "pix_order_created",
        user_id: user.id,
        event_data: { order_id: out.id, offer, amount_cents: amount, gateway: "pagarme" },
      });
      return jsonResponse({
        orderId: out.id, // or_... (o check consulta o pedido)
        amount: (amount / 100).toFixed(2),
        qrCode: tran.qr_code,
        // a URL de PNG deles pode não ser pública — o client renderiza
        // QRCodeSVG a partir do copia-e-cola quando base64 é null
        qrCodeBase64: null,
        expiresAt: tran.expires_at ?? null,
      });
    }

    // --------------------------------------------------------------- CHECK
    if (action === "check") {
      const id = String(body.id ?? "");
      if (!id) return jsonResponse({ error: "id_required" }, 400);
      const res = await fetch(`${PAGARME_API}/orders/${encodeURIComponent(id)}`, {
        headers: { Authorization: basicAuth(apiKey) },
      });
      const out = await res.json().catch(() => ({}));
      if (body.probeOnly === true) {
        return jsonResponse({ probe: true, status: res.status, gw: JSON.stringify(out).slice(0, 800) });
      }
      const status = String(out?.status ?? "unknown").toUpperCase();
      if (!res.ok) {
        logStep("Pagarme check error", { status: res.status, body: JSON.stringify(out).slice(0, 300) });
        return jsonResponse({ paid: false, status: "ERROR" });
      }
      if (status !== "PAID") return jsonResponse({ paid: false, status });

      // PAGO → libera na hora (idempotente). metadata do pedido ecoa o
      // externalId que gravamos no create (verificado ao vivo em 21/07).
      const ext = out?.metadata?.externalId as string | undefined;
      if (ext && !ext.startsWith(user.id)) {
        logStep("Charge/user mismatch", { id, ext: ext.slice(0, 12) });
        return jsonResponse({ paid: false, status: "MISMATCH" });
      }
      let offer = ext?.split(":")[1] === "downsell" ? "downsell" : ext ? "lifetime" : "";
      if (!offer) {
        const { data: reg } = await supabaseAdmin.from("analytics_events")
          .select("event_data").eq("event_name", "pix_order_created")
          .contains("event_data", { order_id: id }).limit(1);
        const regOffer = reg?.[0]?.event_data?.offer as string | undefined;
        if (regOffer === "downsell" || regOffer === "lifetime") offer = regOffer;
      }
      if (!offer) {
        const declarado = String(body.offer ?? "");
        offer = declarado in PRECOS_CENTAVOS ? declarado : "lifetime";
        logStep("Offer via client fallback", { id, declarado });
      }

      const now = new Date();
      const concessao = CONCESSAO[offer] ?? CONCESSAO.lifetime;
      const vitalicio = concessao.dias === null;
      const fim = new Date(now);
      if (vitalicio) fim.setFullYear(fim.getFullYear() + 100);
      else fim.setDate(fim.getDate() + (concessao.dias ?? 30)); // 04/09: w25 = 30 dias
      const payload = {
        user_id: user.id, status: "active",
        plan: vitalicio ? "lifetime" : concessao.plano,
        billing_period: vitalicio ? "lifetime" : concessao.periodo,
        payment_method: "pix", abacatepay_billing_id: id, customer_email: user.email ?? null,
        current_period_start: now.toISOString(), current_period_end: fim.toISOString(),
        amount_cents: PRECOS_CENTAVOS[offer],
      };
      const { data: existing } = await supabaseAdmin.from("subscriptions")
        .select("id, status, plan")
        .eq("user_id", user.id)
        .maybeSingle();
      const jaLiberado = existing?.status === "active" && existing?.plan === "lifetime";
      if (existing?.id) {
        await supabaseAdmin.from("subscriptions").update(payload).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("subscriptions").insert(payload);
      }
      logStep("Access granted", { userId: user.id, offer, id, jaLiberado });

      if (!jaLiberado) {
        const { data: p } = await supabaseAdmin.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
        const displayName = (p?.display_name as string | undefined) ?? null;
        await sendToUtmify(supabaseAdmin, {
          userId: user.id, email: user.email ?? null, orderId: id, offer,
          amountCents: PRECOS_CENTAVOS[offer], name: displayName,
        });
        await sendMetaCapi(supabaseAdmin, {
          userId: user.id, email: user.email ?? null, orderId: id, offer,
          amountCents: PRECOS_CENTAVOS[offer], req,
          fbp: (body.fbp as string | undefined) ?? null,
          fbc: (body.fbc as string | undefined) ?? null,
          sourceUrl: (body.sourceUrl as string | undefined) ?? null,
        });
        try {
          const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
          const from = Deno.env.get("WELCOME_EMAIL_FROM") || Deno.env.get("RECOVERY_EMAIL_FROM") || "onboarding@resend.dev";
          if (resendKey && user.email) {
            const firstName = displayName ? displayName.split(" ")[0] : null;
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from, to: [user.email],
                subject: vitalicio ? "Seu acesso vitalício ao CORE tá ativo ✅" : "Seu mês de CORE tá ativo ✅",
                html: welcomeHtml(firstName, user.email),
              }),
            });
          }
        } catch (e) {
          logStep("Welcome email failed (non-blocking)", { message: String(e).slice(0, 150) });
        }
      }
      return jsonResponse({ paid: true, status: "PAID" });
    }

    return jsonResponse({ error: "unknown_action" }, 400);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { msg });
    return jsonResponse({ error: msg }, 500);
  }
});
