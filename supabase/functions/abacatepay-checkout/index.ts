import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_BASE = "https://api.abacatepay.com/v2";

const PRODUCTS: Record<string, { name: string; price: number; cycle: string }> = {
  monthly: { name: "CORE Pro Mensal", price: 1990, cycle: "MONTHLY" },
  annual: { name: "CORE Pro Anual", price: 17880, cycle: "ANNUALLY" },
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ABACATEPAY-CHECKOUT] ${step}${d}`);
};

async function abacateRequest(path: string, apiKey: string, body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    logStep("API error", { status: res.status, path, data });
    throw new Error(`AbacatePay API error: ${res.status} - ${JSON.stringify(data)}`);
  }
  return data;
}

async function getOrCreateProduct(
  billing: string,
  apiKey: string,
  supabaseClient: ReturnType<typeof createClient>
): Promise<string> {
  const configKey = `abacatepay_product_${billing}`;

  // Check if product ID is cached in app_config
  const { data: cached } = await supabaseClient
    .from("app_config")
    .select("value")
    .eq("key", configKey)
    .maybeSingle();

  if (cached?.value) {
    const productId = (cached.value as { id: string }).id;
    logStep("Using cached product", { billing, productId });
    return productId;
  }

  // Create product via API (or find existing)
  const product = PRODUCTS[billing];
  logStep("Creating product", { billing, product });

  let productId: string;
  try {
    const result = await abacateRequest("/products/create", apiKey, {
      externalId: `core-pro-${billing}`,
      name: product.name,
      price: product.price,
      billingCycle: product.cycle,
      currency: "BRL",
    });
    productId = result.data?.id || result.id;
    logStep("Product created", { productId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already exists")) {
      logStep("Product already exists, listing products to find it");
      const listRes = await fetch(`${API_BASE}/products/list`, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const listData = await listRes.json();
      const found = listData.data?.find(
        (p: Record<string, unknown>) => p.externalId === `core-pro-${billing}`
      );
      if (!found?.id) throw new Error("Could not find existing product");
      productId = found.id;
      logStep("Found existing product", { productId });
    } else {
      throw err;
    }
  }

  // Cache product ID
  await supabaseClient.from("app_config").upsert(
    { key: configKey, value: { id: productId }, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );

  return productId;
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

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header missing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const user = authData.user;
    const userId = user.id;
    const userEmail = user.email ?? "";
    logStep("Authenticated user", { userId, email: userEmail });

    // Get billing period from request
    const { billing } = await req.json();
    const billingPeriod = billing === "annual" ? "annual" : "monthly";

    // Get or create product
    const productId = await getOrCreateProduct(billingPeriod, apiKey, supabaseAdmin);

    // Get user display name from profiles
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, phone, tax_id")
      .eq("id", userId)
      .maybeSingle();

    const customerName = profile?.display_name || userEmail.split("@")[0];

    // Create subscription via AbacatePay v2
    logStep("Creating subscription", { productId, billingPeriod, customerName });

    const externalId = `${userId}-${billingPeriod}-${Date.now()}`;

    const subscriptionBody: Record<string, unknown> = {
      externalId,
      productId,
      returnUrl: "https://coreaplicativo.lovable.app/planos?success=true",
      completionUrl: "https://coreaplicativo.lovable.app/planos?success=true",
      customer: {
        email: userEmail,
        name: customerName,
        ...(profile?.phone ? { phone: profile.phone } : {}),
        ...(profile?.tax_id ? { taxId: profile.tax_id } : {}),
      },
      metadata: {
        user_id: userId,
        billing_period: billingPeriod,
      },
    };

    const result = await abacateRequest("/subscriptions/create", apiKey, subscriptionBody);
    logStep("Subscription created", { result });

    const checkoutUrl = result.data?.url || result.url;
    if (!checkoutUrl) {
      throw new Error("No checkout URL returned from AbacatePay");
    }

    return new Response(JSON.stringify({ url: checkoutUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
