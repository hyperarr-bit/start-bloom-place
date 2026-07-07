import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type BillingPeriod = "monthly" | "annual";

// Links de checkout da Cakto (públicos — o preço mora na oferta, lá no painel da Cakto).
// MANTER EM SINCRONIA com CAKTO_OFFERS em supabase/functions/cakto-webhook/index.ts.
const CHECKOUT_LINKS: Record<BillingPeriod, { regular: string; limited: string }> = {
  monthly: {
    regular: "https://pay.cakto.com.br/6g8iiak",
    limited: "https://pay.cakto.com.br/37pjpm8",
  },
  annual: {
    regular: "https://pay.cakto.com.br/xs9s7ws_914041",
    limited: "https://pay.cakto.com.br/6a3owem",
  },
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CAKTO-CHECKOUT] ${step}${d}`);
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const sanitizeDigits = (value?: string | null) => {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits || undefined;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Authorization header missing" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !authData?.user) {
      return jsonResponse({ error: "User not authenticated" }, 401);
    }

    const user = authData.user;
    const userId = user.id;
    const userEmail = user.email ?? "";
    logStep("Authenticated user", { userId, email: userEmail });

    const RequestSchema = z.object({
      billing: z.enum(["monthly", "annual"]).default("monthly"),
      coupon: z.string().optional(),
      // "limited" força a oferta promocional (usado pelo funil / ofertas relâmpago)
      offer: z.enum(["regular", "limited"]).optional(),
      // Atribuição: repassados na URL do checkout — os pixels da Cakto leem o
      // fbclid/gclid e fecham o match compra↔anúncio; os UTMs aparecem no
      // relatório de vendas da Cakto.
      attribution: z
        .object({
          fbclid: z.string().max(500).optional(),
          gclid: z.string().max(500).optional(),
          gbraid: z.string().max(500).optional(),
          wbraid: z.string().max(500).optional(),
          utm_source: z.string().max(200).optional(),
          utm_medium: z.string().max(200).optional(),
          utm_campaign: z.string().max(200).optional(),
          utm_content: z.string().max(200).optional(),
        })
        .optional(),
    });
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }
    const parsed = RequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonResponse({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const billingPeriod: BillingPeriod = parsed.data.billing;
    const couponRaw = parsed.data.coupon?.trim().toUpperCase();

    // Validação do WINBACK80: só anual e uma vez por usuário.
    // Diferente da AbacatePay, aqui NÃO registramos retention_offers_used no clique —
    // o link da Cakto não garante compra. O registro acontece no cakto-webhook
    // quando a compra da oferta winback é aprovada.
    let couponValid = false;
    if (couponRaw === "WINBACK80") {
      if (billingPeriod !== "annual") {
        logStep("Coupon WINBACK80 rejected: not annual");
      } else {
        const { data: existing } = await supabaseAdmin
          .from("retention_offers_used")
          .select("id")
          .eq("user_id", userId)
          .eq("offer_type", "winback80")
          .maybeSingle();
        if (existing) {
          logStep("Coupon WINBACK80 rejected: already used");
        } else {
          couponValid = true;
        }
      }
    }

    if (couponValid) {
      // Marca a tentativa de winback como aceita (intenção de compra)
      const { error: updErr } = await supabaseAdmin
        .from("winback_attempts")
        .update({ accepted_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("accepted_at", null)
        .gte("triggered_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      if (updErr) {
        logStep("Failed to update winback_attempts.accepted_at", { err: updErr.message });
      }
    }

    const variant: "regular" | "limited" =
      couponValid || parsed.data.offer === "limited" ? "limited" : "regular";
    const baseLink = CHECKOUT_LINKS[billingPeriod][variant];

    // Prefill do checkout da Cakto via query string — o e-mail pré-preenchido é o que
    // volta no webhook (data.customer.email) e é como associamos a compra ao usuário.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, phone, tax_id")
      .eq("id", userId)
      .maybeSingle();

    const url = new URL(baseLink);
    if (userEmail) {
      url.searchParams.set("email", userEmail);
      url.searchParams.set("confirmEmail", userEmail);
    }
    const customerName = profile?.display_name || userEmail.split("@")[0];
    if (customerName) url.searchParams.set("name", customerName);
    const phone = sanitizeDigits(profile?.phone);
    if (phone) url.searchParams.set("phone", phone.startsWith("55") ? phone : `55${phone}`);
    const cpf = sanitizeDigits(profile?.tax_id);
    if (cpf) url.searchParams.set("cpf", cpf);

    const attribution = parsed.data.attribution ?? {};
    for (const [key, value] of Object.entries(attribution)) {
      if (value) url.searchParams.set(key, value);
    }

    logStep("Checkout link ready", {
      billingPeriod, variant,
      coupon: couponValid ? couponRaw : null,
      fbclid: attribution.fbclid ? "yes" : "no",
    });
    return jsonResponse({ url: url.toString() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return jsonResponse({ error: msg }, 500);
  }
});
