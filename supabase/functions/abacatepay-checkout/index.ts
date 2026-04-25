import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_BASE = "https://api.abacatepay.com/v2";
const DEFAULT_APP_URL = "https://coreaplicativo.lovable.app";

type BillingPeriod = "monthly" | "annual";

const PRODUCT_VERSION = "v4";

const PRODUCTS: Record<BillingPeriod, { name: string; price: number; cycle: string }> = {
  monthly: { name: "CORE Pro Mensal", price: 1990, cycle: "MONTHLY" },
  annual: { name: "CORE Pro Anual", price: 17880, cycle: "YEARLY" },
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

const extractId = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") {
    return value.id;
  }
  return null;
};

const sanitizeDigits = (value?: string | null) => {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits || undefined;
};

const getBaseUrl = (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin) return origin;

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      logStep("Invalid referer header", { referer });
    }
  }

  return DEFAULT_APP_URL;
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
  billing: BillingPeriod,
  apiKey: string,
  supabaseClient: ReturnType<typeof createClient>
): Promise<string> {
  const configKey = `abacatepay_product_${billing}_${PRODUCT_VERSION}`;

  // Check if product ID is cached in app_config
  const { data: cached } = await supabaseClient
    .from("app_config")
    .select("value")
    .eq("key", configKey)
    .maybeSingle();

  if (cached?.value) {
    const cachedValue = cached.value as { id: string; version?: string };
    if (cachedValue.version === PRODUCT_VERSION && cachedValue.id) {
      logStep("Using cached product", { billing, productId: cachedValue.id });
      return cachedValue.id;
    }
    logStep("Cached product outdated, recreating", { billing });
  }

  // Create product via API with correct cycle field
  const product = PRODUCTS[billing];
  const externalId = `core-pro-${billing}-${PRODUCT_VERSION}`;
  logStep("Creating product", { billing, product, externalId });

  let productId: string;
  try {
    const result = await abacateRequest("/products/create", apiKey, {
      externalId,
      name: product.name,
      price: product.price,
      cycle: product.cycle,
      currency: "BRL",
    });
    productId = result.data?.id || result.id;
    logStep("Product created", { productId, cycle: product.cycle });
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
        (p: Record<string, unknown>) => p.externalId === externalId
      );
      if (!found?.id) throw new Error("Could not find existing product");
      productId = found.id;
      logStep("Found existing product", { productId });
    } else {
      throw err;
    }
  }

  // Cache product ID with version
  await supabaseClient.from("app_config").upsert(
    { key: configKey, value: { id: productId, version: PRODUCT_VERSION }, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );

  return productId;
}

async function getOrCreateCustomer(
  userId: string,
  userEmail: string,
  customerName: string,
  profile: { phone: string | null; tax_id: string | null } | null,
  apiKey: string,
  supabaseClient: ReturnType<typeof createClient>
) {
  const { data: existingRecord } = await supabaseClient
    .from("user_data")
    .select("id, value")
    .eq("user_id", userId)
    .eq("key", "abacatepay_customer_id")
    .maybeSingle();

  const cachedCustomerId = extractId(existingRecord?.value);
  if (cachedCustomerId) {
    logStep("Using cached customer", { userId, customerId: cachedCustomerId });
    return cachedCustomerId;
  }

  const customerBody = {
    email: userEmail,
    name: customerName,
    ...(profile?.phone ? { cellphone: sanitizeDigits(profile.phone) } : {}),
    ...(profile?.tax_id ? { taxId: sanitizeDigits(profile.tax_id) } : {}),
  };

  logStep("Creating customer", { userId, email: userEmail });
  const result = await abacateRequest("/customers/create", apiKey, customerBody);
  const customerData = result.data as { customer?: unknown } | string | null | undefined;
  const customerId =
    extractId(customerData) ??
    extractId(customerData && typeof customerData === "object" ? customerData.customer : null) ??
    extractId(result.id);

  if (!customerId) {
    throw new Error("No customer ID returned from AbacatePay");
  }

  if (existingRecord?.id) {
    await supabaseClient
      .from("user_data")
      .update({ value: customerId, updated_at: new Date().toISOString() })
      .eq("id", existingRecord.id);
  } else {
    await supabaseClient.from("user_data").insert({
      user_id: userId,
      key: "abacatepay_customer_id",
      value: customerId,
    });
  }

  return customerId;
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
      return jsonResponse({ error: "Authorization header missing" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !authData?.user) {
      return jsonResponse({ error: "User not authenticated" }, 401);
    }

    const user = authData.user;
    const userId = user.id;
    const userEmail = user.email ?? "";
    logStep("Authenticated user", { userId, email: userEmail });

    // Get billing period from request
    const { billing } = await req.json();
    const billingPeriod: BillingPeriod = billing === "annual" ? "annual" : "monthly";

    // Get or create product
    const productId = await getOrCreateProduct(billingPeriod, apiKey, supabaseAdmin);

    // Get user display name from profiles
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, phone, tax_id")
      .eq("id", userId)
      .maybeSingle();

    const customerName = profile?.display_name || userEmail.split("@")[0];
    const customerId = await getOrCreateCustomer(
      userId,
      userEmail,
      customerName,
      profile,
      apiKey,
      supabaseAdmin
    );
    const baseUrl = getBaseUrl(req);

    // Create subscription via AbacatePay v2
    logStep("Creating subscription", { productId, billingPeriod, customerId, baseUrl });

    const externalId = `${userId}-${billingPeriod}-${Date.now()}`;

    const subscriptionBody: Record<string, unknown> = {
      externalId,
      items: [{ id: productId, quantity: 1 }],
      methods: ["CARD"],
      customerId,
      returnUrl: `${baseUrl}/planos?canceled=true`,
      completionUrl: `${baseUrl}/planos?success=true`,
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

    return jsonResponse({ url: checkoutUrl });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return jsonResponse({ error: msg }, 500);
  }
});
