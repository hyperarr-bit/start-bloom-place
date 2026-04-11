import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLANS = {
  monthly: { name: "CORE Pro Mensal", price: 1990, externalId: "core-pro-monthly" },
  annual: { name: "CORE Pro Anual", price: 17880, externalId: "core-pro-annual" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const apiKey = Deno.env.get("ABACATEPAY_API_KEY");
    if (!apiKey) throw new Error("ABACATEPAY_API_KEY is not set");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { billing } = await req.json();
    const plan = billing === "monthly" ? PLANS.monthly : PLANS.annual;

    const origin = req.headers.get("origin") || "https://coreaplicativo.lovable.app";

    // Use v1/billing/create with inline products (no pre-created products needed)
    const response = await fetch("https://api.abacatepay.com/v1/billing/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        frequency: billing === "monthly" ? "MONTHLY" : "YEARLY",
        methods: ["PIX"],
        products: [
          {
            externalId: plan.externalId,
            name: plan.name,
            quantity: 1,
            price: plan.price,
            description: `Assinatura ${plan.name}`,
          },
        ],
        returnUrl: `${origin}/planos`,
        completionUrl: `${origin}/planos?success=true`,
        customer: {
          email: user.email,
        },
        metadata: {
          user_id: user.id,
          billing_period: billing,
        },
      }),
    });

    const result = await response.json();
    console.log("[ABACATEPAY-CHECKOUT] Response:", JSON.stringify(result));

    if (!response.ok) {
      throw new Error(result?.error || result?.message || "AbacatePay API error");
    }

    const checkoutUrl = result?.data?.url || result?.url;
    if (!checkoutUrl) throw new Error("No checkout URL returned");

    return new Response(JSON.stringify({ url: checkoutUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[ABACATEPAY-CHECKOUT] ERROR:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
