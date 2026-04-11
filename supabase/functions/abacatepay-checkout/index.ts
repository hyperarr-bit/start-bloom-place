import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLANS = {
  monthly: { name: "CORE Pro Mensal", price: 1990, externalId: "core-pro-monthly", cycle: "MONTHLY" },
  annual: { name: "CORE Pro Anual", price: 17880, externalId: "core-pro-annual", cycle: "ANNUALLY" },
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ABACATEPAY-CHECKOUT] ${step}${d}`);
};

async function getOrCreateProduct(
  apiKey: string,
  supabaseClient: ReturnType<typeof createClient>,
  plan: typeof PLANS.monthly,
  billing: string
): Promise<string> {
  const configKey = `abacatepay_product_${billing}`;

  // Check cache in app_config
  const { data: cached } = await supabaseClient
    .from("app_config")
    .select("value")
    .eq("key", configKey)
    .maybeSingle();

  if (cached?.value?.product_id) {
    logStep("Using cached product", { billing, productId: cached.value.product_id });
    return cached.value.product_id as string;
  }

  // Create product via AbacatePay v2
  logStep("Creating product", { name: plan.name, cycle: plan.cycle, price: plan.price });
  const response = await fetch("https://api.abacatepay.com/v2/products/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      name: plan.name,
      price: plan.price,
      externalId: plan.externalId,
      cycle: plan.cycle,
      currency: "BRL",
      description: `Assinatura ${plan.name}`,
    }),
  });

  const result = await response.json();
  logStep("Product creation response", { status: response.status, result });

  if (!response.ok) {
    throw new Error(result?.error || result?.message || "Failed to create product");
  }

  const productId = result?.data?.id;
  if (!productId) throw new Error("No product ID returned from AbacatePay");

  // Cache the product ID
  await supabaseClient
    .from("app_config")
    .upsert({ key: configKey, value: { product_id: productId }, updated_at: new Date().toISOString() }, { onConflict: "key" });

  logStep("Product cached", { configKey, productId });
  return productId;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAnonClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseServiceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const apiKey = Deno.env.get("ABACATEPAY_API_KEY");
    if (!apiKey) throw new Error("ABACATEPAY_API_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header missing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabaseAnonClient.auth.getUser(token);
    const user = data?.user;
    if (authError || !user?.email) {
      logStep("Auth failed", { message: authError?.message || "no user/email" });
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { billing, customerName, customerPhone, customerTaxId } = await req.json();
    const plan = billing === "monthly" ? PLANS.monthly : PLANS.annual;

    if (!customerName || !customerPhone || !customerTaxId) {
      throw new Error("Nome, telefone e CPF/CNPJ são obrigatórios para o checkout");
    }

    const origin = req.headers.get("origin") || "https://coreaplicativo.lovable.app";

    // Step 1: Get or create the recurring product
    const productId = await getOrCreateProduct(apiKey, supabaseServiceClient, plan, billing);

    // Step 2: Create or get customer
    logStep("Creating customer", { name: customerName, email: user.email });
    const customerResponse = await fetch("https://api.abacatepay.com/v1/customer/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: customerName,
        email: user.email,
        cellphone: customerPhone,
        taxId: customerTaxId,
      }),
    });

    const customerResult = await customerResponse.json();
    logStep("Customer response", { status: customerResponse.status, data: customerResult?.data?.id });

    if (!customerResponse.ok && !customerResult?.data?.id) {
      throw new Error(customerResult?.error || "Failed to create customer");
    }

    const customerId = customerResult?.data?.id;
    if (!customerId) throw new Error("No customer ID returned");

    // Step 3: Create subscription via v2
    logStep("Creating subscription", { productId, customerId, billing });
    const subResponse = await fetch("https://api.abacatepay.com/v2/subscriptions/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        items: [{ id: productId, quantity: 1 }],
        customerId,
        returnUrl: `${origin}/planos`,
        completionUrl: `${origin}/planos?success=true`,
        metadata: {
          user_id: user.id,
          billing_period: billing,
        },
      }),
    });

    const subResult = await subResponse.json();
    logStep("Subscription response", { status: subResponse.status, result: subResult });

    if (!subResponse.ok) {
      throw new Error(subResult?.error || subResult?.message || "AbacatePay subscription API error");
    }

    const checkoutUrl = subResult?.data?.url || subResult?.url;
    if (!checkoutUrl) throw new Error("No checkout URL returned");

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
