import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_BASE = "https://api.abacatepay.com/v2";
const DEFAULT_APP_URL = "https://coreaplicativo.lovable.app";

type BillingPeriod = "monthly" | "annual";

const PRODUCT_CONFIG: Record<BillingPeriod, { configKey: string; frequency: "MONTHLY" | "ANNUAL" }> = {
  monthly: { configKey: "abacatepay_product_monthly_id", frequency: "MONTHLY" },
  annual: { configKey: "abacatepay_product_annual_id", frequency: "ANNUAL" },
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
    const cfg = PRODUCT_CONFIG[billingPeriod];

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

    const subscriptionBody = {
      frequency: cfg.frequency,
      methods: ["PIX", "CARD"],
      products: [{ productId, quantity: 1 }],
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
      },
    };

    logStep("Creating subscription", { billingPeriod, productId });
    const result = await abacateRequest("/subscriptions/create", apiKey, subscriptionBody);

    const checkoutUrl = result.data?.url || result.url;
    if (!checkoutUrl) {
      throw new Error("No checkout URL returned from AbacatePay");
    }

    logStep("Subscription created", { url: checkoutUrl });
    return jsonResponse({ url: checkoutUrl });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return jsonResponse({ error: msg }, 500);
  }
});
