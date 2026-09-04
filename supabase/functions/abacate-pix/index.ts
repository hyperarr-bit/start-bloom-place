import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * Pix in-app via ABACATEPAY (16/07): a API da Cakto caiu (docs da conta em
 * análise) e o funil v2 volta pro Pix transparente por aqui. Mesmo contrato
 * de resposta do cakto-pix — o PixCheckout só troca o nome da função.
 *
 * Duas ações num endpoint só:
 *  - create: gera a cobrança (POST /v1/pixQrCode/create) e devolve QR+copia-cola
 *  - check:  consulta o status; quando PAID, LIBERA o acesso na hora (upsert em
 *    subscriptions — mesmo shape do cakto-webhook) + e-mail de boas-vindas.
 *    O grant mora no check porque não dependemos de webhook configurado no
 *    painel — o polling do app confirma e libera em até ~3s.
 *
 * Preços em CENTAVOS aqui (contrato da AbacatePay): vitalício 2790 / downsell 1490.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// API V2 (chaves abc_prod_* são da geração v2 — a v1 responde
// "API key version mismatch"). Pix in-app = "transparent checkout".
const ABACATE_API = "https://api.abacatepay.com/v2";
const PRECOS_CENTAVOS: Record<string, number> = { lifetime: 9790, downsell: 1490, w97: 9790, w25: 2490 };
const CONCESSAO: Record<string, { plano: string; periodo: string; dias: number | null }> = {
  lifetime: { plano: "lifetime", periodo: "lifetime", dias: null },
  downsell: { plano: "lifetime", periodo: "lifetime", dias: null },
  w97: { plano: "lifetime", periodo: "lifetime", dias: null },
  w25: { plano: "web", periodo: "monthly_prepaid", dias: 30 },
};

const DUMMY_PHONE = "11999999999"; // mesmo padrão do cakto-pix: não pedimos telefone

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ABACATE-PIX] ${step}${d}`);
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const onlyDigits = (v?: string | null) => (v ?? "").replace(/\D/g, "");
const utcStamp = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

/**
 * Canal server-side de conversão (16/07): manda a venda pra UTMify → Meta CAPI
 * + Google. Espelha o sendToUtmify do cakto-webhook — o Pix in-app não passa
 * por webhook de gateway, então é AQUI (no confirm) que o servidor avisa o
 * Meta, cobrindo os ~30-50% que o Pixel do navegador perde (iOS/adblock).
 * Não-bloqueante: falha só loga. A UTM vem dos eventos do funil (o clique no
 * anúncio é anônimo, antes do cadastro — varre sessões do user).
 */
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
    // UTM: eventos do user > eventos anônimos das sessões dele (clique no
    // anúncio acontece antes do cadastro — mesma lógica do cakto-webhook).
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
      platform: "AbacatePay",
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

/**
 * CAPI direta do Meta (19/07): manda o Purchase server-side com VALOR REAL e
 * event_id = orderId — o pixel do navegador já usa o mesmo ID, o Meta
 * deduplica sozinho. Cobre os ~2/3 de compradores que pagam no app do banco
 * e nunca voltam pra tela de confirmação (pixel nunca dispara).
 * Match: e-mail (sha256) + external_id + IP/UA do próprio polling do
 * comprador + fbc/fbp (cookie via client; fbclid dos eventos como fallback).
 * DORMENTE até META_PIXEL_ID + META_CAPI_TOKEN existirem nos secrets.
 * ATENÇÃO: ao ativar, desligar o pixel Meta dentro da UTMify (senão duplica —
 * a CAPI deles não usa nosso event_id).
 */
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
      // fallback: fbclid guardado nos eventos do comprador → formato fb.1.<ts>.<fbclid>
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
        event_id: args.orderId, // MESMO id do pixel do navegador → dedup
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

/** E-mail de boas-vindas (versão enxuta do template do cakto-webhook). */
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
    const apiKey = Deno.env.get("ABACATE_API_KEY") ?? "";

    if (!apiKey) {
      logStep("Missing ABACATE_API_KEY secret");
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

      // CPF é OPCIONAL na AbacatePay (16/07, decisão do dono: conta criada →
      // QR direto, zero digitação). O objeto customer é tudo-ou-nada no
      // contrato deles: só vai se tivermos CPF válido; sem ele, a cobrança
      // sai mesmo assim e o vínculo fica no metadata.externalId (user_id).
      const customer = (body.customer ?? {}) as Record<string, string | undefined>;
      const docNumber = onlyDigits(customer.docNumber);
      const name = (customer.name ?? "").trim() || user.email?.split("@")[0] || "Cliente CORE";
      let customerPayload: Record<string, string> | null = null;
      if (docNumber.length === 11 && user.email) {
        customerPayload = { name, cellphone: DUMMY_PHONE, email: user.email, taxId: docNumber };
        // CPF vai pro profile — próxima compra não pede de novo (paridade cakto-pix)
        await supabaseAdmin.from("profiles").update({ tax_id: docNumber }).eq("id", user.id);
      }

      const res = await fetch(`${ABACATE_API}/transparents/create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "PIX",
          data: {
            amount,
            expiresIn: 1800,
            description: offer === "downsell" ? "CORE vitalicio (oferta)" : "CORE vitalicio",
            ...(customerPayload ? { customer: customerPayload } : {}),
            metadata: { externalId: `${user.id}:${offer}` },
          },
        }),
      });
      const out = await res.json().catch(() => ({}));
      const d = out?.data;
      if (!res.ok || out?.success === false || !d?.brCode) {
        logStep("Abacate create error", { status: res.status, body: JSON.stringify(out).slice(0, 600) });
        return jsonResponse({
          error: "Não consegui gerar o Pix agora. Tenta de novo em alguns segundos.",
          // diagnóstico opt-in (QA): o corpo cru do gateway, sem nada sensível
          ...(body.debug === true ? { gw: { status: res.status, body: JSON.stringify(out).slice(0, 400) } } : {}),
        }, 502);
      }
      logStep("Pix created", { id: d.id, amount: d.amount, devMode: d.devMode });
      // FONTE DA VERDADE oferta↔cobrança (19/07): o check da AbacatePay NÃO
      // devolve metadata nem valor (sondado em produção) — sem este registro,
      // todo grant caía no default lifetime e downsell de 14,90 entrava como
      // 27,90 (20 vendas em 48h!). Gravado pelo SERVIDOR: à prova de spoof.
      await supabaseAdmin.from("analytics_events").insert({
        event_name: "pix_order_created",
        user_id: user.id,
        event_data: { order_id: d.id, offer, amount_cents: amount },
      });
      const b64 = typeof d.brCodeBase64 === "string" && d.brCodeBase64.length
        ? (d.brCodeBase64.startsWith("data:") ? d.brCodeBase64 : `data:image/png;base64,${d.brCodeBase64}`)
        : null;
      return jsonResponse({
        orderId: d.id,
        amount: (Number(d.amount ?? amount) / 100).toFixed(2), // "27.90" — fmtBRL do app resolve a vírgula
        qrCode: d.brCode,
        qrCodeBase64: b64,
        expiresAt: d.expiresAt ?? null,
      });
    }

    // --------------------------------------------------------------- CHECK
    if (action === "check") {
      const id = String(body.id ?? "");
      if (!id) return jsonResponse({ error: "id_required" }, 400);
      const res = await fetch(`${ABACATE_API}/transparents/check?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const out = await res.json().catch(() => ({}));
      // sonda read-only (QA 19/07): devolve o corpo cru SEM tocar no grant —
      // pra descobrir se o check traz amount/metadata (bug do downsell 27,90)
      if (body.probeOnly === true) {
        return jsonResponse({ probe: true, status: res.status, gw: JSON.stringify(out).slice(0, 800) });
      }
      const status = out?.data?.status ?? "UNKNOWN";
      if (!res.ok || out?.success === false) {
        logStep("Abacate check error", { status: res.status, body: JSON.stringify(out).slice(0, 300) });
        return jsonResponse({ paid: false, status: "ERROR" });
      }
      if (status !== "PAID") return jsonResponse({ paid: false, status });

      // PAGO → libera na hora (idempotente). Se a metadata veio na resposta,
      // ela precisa bater com o usuário logado; sem metadata, seguimos — o id
      // é opaco e só o dono da sessão que criou a cobrança o conhece.
      const ext = out?.data?.metadata?.externalId as string | undefined;
      if (ext && !ext.startsWith(user.id)) {
        logStep("Charge/user mismatch", { id, ext: ext.slice(0, 12) });
        return jsonResponse({ paid: false, status: "MISMATCH" });
      }
      // Oferta REAL da cobrança (19/07): 1º metadata (se um dia voltar),
      // 2º registro server-side do create (pix_order_created), 3º o que o
      // cliente declarou, 4º lifetime. Antes era só metadata→default e TODA
      // venda entrava como 27,90 — inclusive downsell de 14,90.
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
      const periodEnd = new Date(now);
      if (vitalicio) periodEnd.setFullYear(periodEnd.getFullYear() + 100); // convenção vitalício da base
      else periodEnd.setDate(periodEnd.getDate() + (concessao.dias ?? 30));  // 04/09: w25 = 30 dias
      const payload = {
        user_id: user.id,
        status: "active",
        plan: vitalicio ? "lifetime" : concessao.plano,
        billing_period: vitalicio ? "lifetime" : concessao.periodo,
        payment_method: "pix",
        abacatepay_billing_id: id,
        customer_email: user.email,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        amount_cents: PRECOS_CENTAVOS[offer],
      };

      // já era vitalício ativo com essa cobrança? então é re-poll — não repete e-mail
      const { data: existing } = await supabaseAdmin
        .from("subscriptions")
        .select("id, status, plan, abacatepay_billing_id")
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
        const displayName = (p?.display_name ?? "").trim() || null;

        // Canal server-side pro Meta/Google (UTMify → CAPI) — a venda in-app
        // não passa por webhook de gateway, então é aqui que o servidor avisa.
        await sendToUtmify(supabaseAdmin, {
          userId: user.id, email: user.email ?? null, orderId: id,
          offer, amountCents: PRECOS_CENTAVOS[offer], name: displayName,
        });

        // CAPI direta (dormente sem secrets): 100% das vendas no gerenciador
        // com valor real, mesmo quem paga no app do banco e nunca volta.
        await sendMetaCapi(supabaseAdmin, {
          userId: user.id, email: user.email ?? null, orderId: id,
          offer, amountCents: PRECOS_CENTAVOS[offer], req,
          fbp: typeof body.fbp === "string" ? body.fbp : null,
          fbc: typeof body.fbc === "string" ? body.fbc : null,
          sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : null,
        });

        // boas-vindas anti-reembolso (mesma missão do cakto-webhook)
        try {
          const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
          const from = Deno.env.get("WELCOME_EMAIL_FROM") || Deno.env.get("RECOVERY_EMAIL_FROM") || "onboarding@resend.dev";
          if (resendKey && user.email) {
            const firstName = (displayName ?? "").split(" ")[0] || null;
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from,
                to: [user.email],
                subject: vitalicio ? "Seu acesso vitalício ao CORE tá ativo ✅" : "Seu mês de CORE tá ativo ✅",
                html: welcomeHtml(firstName, user.email),
              }),
            });
            logStep("Welcome email sent", { to: user.email.slice(0, 3) + "***" });
          }
        } catch (e) {
          logStep("Welcome email failed (non-blocking)", { message: String(e).slice(0, 120) });
        }
      }
      return jsonResponse({ paid: true, status: "PAID" });
    }

    return jsonResponse({ error: "unknown_action" }, 400);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return jsonResponse({ error: msg }, 500);
  }
});
