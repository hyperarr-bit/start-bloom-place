import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_BASE = "https://api.abacatepay.com/v2";
const DEFAULT_APP_URL = "https://coreaplicativo.lovable.app";

type BillingPeriod = "monthly" | "annual";

const PRODUCT_CONFIG: Record<BillingPeriod, { configKey: string; frequency: "MONTHLY" | "ANNUAL"; basePriceCents: number }> = {
  monthly: { configKey: "abacatepay_product_monthly_id", frequency: "MONTHLY", basePriceCents: 1990 },
  annual: { configKey: "abacatepay_product_annual_id", frequency: "ANNUAL", basePriceCents: 17880 },
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ABACATEPAY-CHECKOUT] ${step}${d}`);
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

const getBaseUrl = (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  const referer = req.headers.get("referer");
  if (referer) {
    try { return new URL(referer).origin; } catch { /* noop */ }
  }
  return DEFAULT_APP_URL;
};

async function abacateRequest(path: string, apiKey: string, body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    logStep("API error", { status: res.status, path, data });
    throw new Error(`AbacatePay API error: ${res.status} - ${JSON.stringify(data)}`);
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ABACATEPAY_API_KEY");
    if (!apiKey) throw new Error("ABACATEPAY_API_KEY not configured");

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
    const cfg = PRODUCT_CONFIG[billingPeriod];

    // Validate coupon: WINBACK80 is annual-only and one-time per user
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

    // Load product id from app_config
    const { data: configRow, error: configErr } = await supabaseAdmin
      .from("app_config")
      .select("value")
      .eq("key", cfg.configKey)
      .maybeSingle();
    if (configErr) throw new Error(`Failed to load app_config: ${configErr.message}`);

    const productId = (configRow?.value as { id?: string } | null)?.id;
    if (!productId) {
      return jsonResponse({
        error: `Product '${cfg.configKey}' not configured. Run the 'abacatepay-setup-products' edge function once to create products.`,
      }, 500);
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, phone, tax_id")
      .eq("id", userId)
      .maybeSingle();

    const customerName = profile?.display_name || userEmail.split("@")[0];
    const baseUrl = getBaseUrl(req);

    // Compute discounted unit price for the WINBACK80 coupon (80% off)
    const discountedUnitPrice = couponValid
      ? Math.round(cfg.basePriceCents * 0.20)
      : null;

    // When the coupon applies, send the item as an ad-hoc product (no `id`) so
    // AbacatePay uses our promo price instead of the saved product price.
    // Without coupon, reference the saved product by id (regular full price).
    const lineItem: Record<string, unknown> = discountedUnitPrice !== null
      ? {
          name: billingPeriod === "annual" ? "CORE Pro Anual (Oferta 80% OFF)" : "CORE Pro Mensal (Oferta 80% OFF)",
          description: "Oferta exclusiva WINBACK80 - 80% de desconto aplicado",
          quantity: 1,
          price: discountedUnitPrice,
        }
      : { id: productId, quantity: 1 };

    const checkoutBody: Record<string, unknown> = {
      frequency: "SUBSCRIPTION",
      methods: ["PIX", "CARD"],
      items: [lineItem],
      returnUrl: `${baseUrl}/planos?canceled=true`,
      completionUrl: `${baseUrl}/planos?success=true`,
      customer: {
        name: customerName,
        email: userEmail,
        ...(profile?.phone ? { cellphone: sanitizeDigits(profile.phone) } : {}),
        ...(profile?.tax_id ? { taxId: sanitizeDigits(profile.tax_id) } : {}),
      },
      metadata: {
        user_id: userId,
        billing_period: billingPeriod,
        ...(couponValid ? { coupon: couponRaw, discount_pct: 80, original_price_cents: cfg.basePriceCents } : {}),
      },
    };

    // Note: we intentionally do NOT send `coupons` to AbacatePay because the coupon
    // code is not registered in their dashboard. The discount is fully applied via
    // the `price` override on the line item above.

    logStep("Creating checkout", { billingPeriod, productId, coupon: couponValid ? couponRaw : null, discountedUnitPrice });
    const result = await abacateRequest("/checkouts/create", apiKey, checkoutBody);

    const checkoutUrl = result.data?.url || result.url;
    if (!checkoutUrl) {
      throw new Error("No checkout URL returned from AbacatePay");
    }

    // Registra o uso do cupom para o apply-pending-discounts garantir aplicação nas renovações
    if (couponValid) {
      const { error: insertErr } = await supabaseAdmin
        .from("retention_offers_used")
        .insert({
          user_id: userId,
          offer_type: "winback80",
          status: "active",
          metadata: { discount_pct: 80, billing: billingPeriod, coupon: couponRaw },
        });
      if (insertErr) {
        logStep("Failed to register winback80 in retention_offers_used", { err: insertErr.message });
      }

      // Marca o winback_attempts mais recente como aceito
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

    logStep("Subscription created", { url: checkoutUrl });
    return jsonResponse({ url: checkoutUrl });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return jsonResponse({ error: msg }, 500);
  }
});
