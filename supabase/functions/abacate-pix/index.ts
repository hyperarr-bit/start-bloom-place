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
const PRECOS_CENTAVOS: Record<string, number> = { lifetime: 2790, downsell: 1490 };
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
      const offer = ext?.split(":")[1] === "downsell" ? "downsell" : "lifetime";

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setFullYear(periodEnd.getFullYear() + 100); // convenção vitalício da base
      const payload = {
        user_id: user.id,
        status: "active",
        plan: "lifetime",
        billing_period: "lifetime",
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
        // boas-vindas anti-reembolso (mesma missão do cakto-webhook)
        try {
          const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
          const from = Deno.env.get("WELCOME_EMAIL_FROM") || Deno.env.get("RECOVERY_EMAIL_FROM") || "onboarding@resend.dev";
          if (resendKey && user.email) {
            const { data: p } = await supabaseAdmin.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
            const firstName = (p?.display_name ?? "").trim().split(" ")[0] || null;
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from,
                to: [user.email],
                subject: "Seu acesso vitalício ao CORE tá ativo ✅",
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
