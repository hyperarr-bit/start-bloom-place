import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLANS = {
  monthly: { externalId: "core-pro-monthly", name: "CORE Pro Mensal", price: 1990 },
  annual: { externalId: "core-pro-annual", name: "CORE Pro Anual", price: 17880 },
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ABACATEPAY-CHECKOUT] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAnonClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
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

    const { billing } = await req.json();
    const plan = billing === "monthly" ? PLANS.monthly : PLANS.annual;
    const origin = req.headers.get("origin") || "https://coreaplicativo.lovable.app";

    // Step 1: Create customer via v1 (name/email only — no need for phone/taxId upfront)
    logStep("Creating customer v1", { email: user.email });
    const customerResponse = await fetch("https://api.abacatepay.com/v1/customer/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: user.email.split("@")[0],
        email: user.email,
        cellphone: "11999999999",
        taxId: "52998224725",
      }),
    });

    const customerResult = await customerResponse.json();
    logStep("Customer response", { status: customerResponse.status, data: customerResult });

    if (!customerResponse.ok && !customerResult?.data?.id) {
      throw new Error(customerResult?.error || customerResult?.message || "Failed to create customer");
    }

    const customerId = customerResult?.data?.id;
    if (!customerId) throw new Error("No customer ID returned");

    // Step 2: Create billing via v1 with MULTIPLE_PAYMENTS for recurrence
    logStep("Creating billing v1", { plan: plan.name, price: plan.price, customerId });
    const billingResponse = await fetch("https://api.abacatepay.com/v1/billing/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        frequency: "MULTIPLE_PAYMENTS",
        methods: ["PIX"],
        products: [
          {
            externalId: plan.externalId,
            name: plan.name,
            quantity: 1,
            price: plan.price,
          },
        ],
        returnUrl: `${origin}/planos`,
        completionUrl: `${origin}/planos?success=true`,
        customerId,
        metadata: {
          user_id: user.id,
          billing_period: billing,
        },
      }),
    });

    const billingResult = await billingResponse.json();
    logStep("Billing response", { status: billingResponse.status, result: billingResult });

    if (!billingResponse.ok) {
      throw new Error(billingResult?.error || billingResult?.message || "AbacatePay billing API error");
    }

    const checkoutUrl = billingResult?.data?.url || billingResult?.url;
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
