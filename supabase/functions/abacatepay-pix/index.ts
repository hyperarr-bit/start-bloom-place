import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLANS = {
  monthly: { name: "CORE PRO MENSAL", price: 1990 },
  annual: { name: "CORE PRO ANUAL", price: 17880 },
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

    const { billing, name, email, cpf } = await req.json();
    const plan = billing === "monthly" ? PLANS.monthly : PLANS.annual;

    // Save profile data
    if (name || cpf) {
      const profileUpdate: Record<string, string> = {};
      if (name) profileUpdate.display_name = name;
      if (cpf) profileUpdate.tax_id = cpf;
      await supabaseAdmin.from("profiles").update(profileUpdate).eq("id", user.id);
      logStep("Profile updated", { userId: user.id, hasName: !!name, hasCpf: !!cpf });
    }

    // Create PIX QR Code via AbacatePay
    logStep("Creating PIX QR Code", { plan: plan.name, price: plan.price });
    const pixResponse = await fetch("https://api.abacatepay.com/v1/pixQrCode/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        amount: plan.price,
        externalId: user.id,
        description: plan.name,
      }),
    });

    const pixResult = await pixResponse.json();
    logStep("PIX response", { status: pixResponse.status, data: pixResult });

    if (!pixResponse.ok) {
      throw new Error(pixResult?.error || pixResult?.message || "Failed to create PIX QR Code");
    }

    const pixData = pixResult?.data;
    if (!pixData) throw new Error("No PIX data returned");

    // Store PIX metadata for webhook reconciliation
    await supabaseAdmin.from("user_data").upsert({
      user_id: user.id,
      key: "pending_pix",
      value: {
        pix_id: pixData.id,
        billing_period: billing,
        plan_name: plan.name,
        price: plan.price,
        customer_name: name,
        customer_email: email,
        customer_cpf: cpf,
        created_at: new Date().toISOString(),
      },
    }, { onConflict: "user_id,key" });

    return new Response(JSON.stringify({
      brCode: pixData.brCode,
      brCodeBase64: pixData.brCodeBase64,
      pixId: pixData.id,
      status: pixData.status,
      expiresAt: pixData.expiresAt,
      amount: plan.price,
      planName: plan.name,
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
