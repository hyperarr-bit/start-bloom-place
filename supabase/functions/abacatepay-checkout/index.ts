import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_BASE = "https://api.abacatepay.com/v2";
const DEFAULT_APP_URL = "https://coreaplicativo.lovable.app";

type BillingPeriod = "monthly" | "annual";

const PRODUCTS: Record<BillingPeriod, { name: string; price: number; externalId: string }> = {
  monthly: { name: "CORE Pro Mensal", price: 1990, externalId: "core-pro-monthly" },
  annual: { name: "CORE Pro Anual", price: 17880, externalId: "core-pro-annual" },
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
  const data = await res.json();
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

    const { billing } = await req.json();
    const billingPeriod: BillingPeriod = billing === "annual" ? "annual" : "monthly";
    const product = PRODUCTS[billingPeriod];

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, phone, tax_id")
      .eq("id", userId)
      .maybeSingle();

    const customerName = profile?.display_name || userEmail.split("@")[0];
    const baseUrl = getBaseUrl(req);

    const billingBody = {
      frequency: "ONE_TIME",
      methods: ["PIX", "CARD"],
      items: [
        {
          id: `${product.externalId}-${userId}-${Date.now()}`,
          name: product.name,
          quantity: 1,
          price: product.price,
        },
      ],
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

    logStep("Creating billing", { billingPeriod, product: product.name });
    const result = await abacateRequest("/checkouts/create", apiKey, billingBody);

    const checkoutUrl = result.data?.url || result.url;
    if (!checkoutUrl) {
      throw new Error("No checkout URL returned from AbacatePay");
    }

    logStep("Billing created", { url: checkoutUrl });
    return jsonResponse({ url: checkoutUrl });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return jsonResponse({ error: msg }, 500);
  }
});
