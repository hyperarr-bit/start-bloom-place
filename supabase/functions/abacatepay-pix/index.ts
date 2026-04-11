import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLANS = {
  monthly: { externalId: "prod_QUxD3yUQYrmWzL4LXGArxm2w", name: "CORE PRO MENSAL", price: 1990 },
  annual: { externalId: "prod_aLJdEEysjhgXc3Raug1dD6N0", name: "CORE PRO ANUAL", price: 17880 },
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ABACATEPAY-PIX] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const apiKey = Deno.env.get("ABACATEPAY_API_KEY");
    if (!apiKey) throw new Error("ABACATEPAY_API_KEY is not set");

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header missing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabaseAnon.auth.getUser(token);
    const user = data?.user;
    if (authError || !user?.email) {
      logStep("Auth failed", { message: authError?.message || "no user/email" });
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { billing, name, email, cpf, method } = await req.json();
    const paymentMethod = method === "card" ? "CARD" : "PIX";
    const plan = billing === "monthly" ? PLANS.monthly : PLANS.annual;

    // Save profile data
    if (name || cpf) {
      const profileUpdate: Record<string, string> = {};
      if (name) profileUpdate.display_name = name;
      if (cpf) profileUpdate.tax_id = cpf;
      await supabaseAdmin.from("profiles").update(profileUpdate).eq("id", user.id);
      logStep("Profile updated", { userId: user.id, hasName: !!name, hasCpf: !!cpf });
    }

    // Get or create AbacatePay customer
    let customerId: string | null = null;
    const { data: cached } = await supabaseAdmin
      .from("user_data")
      .select("value")
      .eq("user_id", user.id)
      .eq("key", "abacatepay_customer_id")
      .single();

    if (cached?.value) {
      customerId = cached.value as string;
      logStep("Using cached customerId", { customerId });
    } else {
      logStep("Creating customer", { email: email || user.email });
      const customerResponse = await fetch("https://api.abacatepay.com/v1/customer/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          name: name || user.email.split("@")[0],
          email: email || user.email,
          cellphone: "11999999999",
          taxId: cpf || "00000000000",
        }),
      });

      const customerResult = await customerResponse.json();
      logStep("Customer response", { status: customerResponse.status, data: customerResult });

      if (!customerResponse.ok && !customerResult?.data?.id) {
        throw new Error(customerResult?.error || customerResult?.message || "Failed to create customer");
      }

      customerId = customerResult?.data?.id;
      if (!customerId) throw new Error("No customer ID returned");

      await supabaseAdmin.from("user_data").upsert({
        user_id: user.id,
        key: "abacatepay_customer_id",
        value: customerId,
      }, { onConflict: "user_id,key" });
      logStep("Cached customerId", { customerId });
    }

    // Create billing with the real product IDs for recurrence
    const origin = "https://coreaplicativo.lovable.app";
    logStep("Creating billing", { plan: plan.name, price: plan.price, externalId: plan.externalId, customerId });
    
    const billingResponse = await fetch("https://api.abacatepay.com/v1/billing/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        frequency: "MULTIPLE_PAYMENTS",
        methods: [paymentMethod],
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

    const billingData = billingResult?.data;
    if (!billingData) throw new Error("No billing data returned");

    const billingId = billingData.id;
    const checkoutUrl = billingData.url;

    // Store billing metadata for webhook reconciliation
    await supabaseAdmin.from("user_data").upsert({
      user_id: user.id,
      key: "pending_pix",
      value: {
        billing_id: billingId,
        billing_period: billing,
        plan_name: plan.name,
        price: plan.price,
        customer_name: name,
        customer_email: email,
        customer_cpf: cpf,
        created_at: new Date().toISOString(),
      },
    }, { onConflict: "user_id,key" });

    // Now try to get the PIX QR code from the billing
    // Fetch the billing charges to get PIX brCode
    let brCode: string | null = null;
    let brCodeBase64: string | null = null;
    let pixId: string | null = null;
    let expiresAt: string | null = null;

    // Try to list charges for this billing
    try {
      const chargesResponse = await fetch(`https://api.abacatepay.com/v1/billing/list`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      const chargesResult = await chargesResponse.json();
      logStep("Charges list response", { status: chargesResponse.status });
      
      // Find our billing and its PIX data
      const ourBilling = chargesResult?.data?.find((b: any) => b.id === billingId);
      if (ourBilling?.pix) {
        brCode = ourBilling.pix.brCode;
        brCodeBase64 = ourBilling.pix.brCodeBase64;
        pixId = ourBilling.pix.id;
        expiresAt = ourBilling.pix.expiresAt;
        logStep("Found PIX data from billing", { pixId });
      }
    } catch (e) {
      logStep("Could not fetch PIX from billing charges", { error: String(e) });
    }

    // If we couldn't get PIX data directly, fall back to returning the checkout URL
    if (!brCode) {
      logStep("No inline PIX data, returning checkout URL", { checkoutUrl });
      return new Response(JSON.stringify({
        checkoutUrl,
        billingId,
        amount: plan.price,
        planName: plan.name,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({
      brCode,
      brCodeBase64,
      pixId,
      status: "PENDING",
      expiresAt,
      amount: plan.price,
      planName: plan.name,
      billingId,
    }), {
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
