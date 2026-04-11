import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ABACATEPAY-WEBHOOK] ${step}${d}`);
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Validate webhook secret
  const webhookSecret = Deno.env.get("ABACATEPAY_WEBHOOK_SECRET");
  const receivedSecret = req.headers.get("x-webhook-secret") || new URL(req.url).searchParams.get("secret");
  if (webhookSecret && receivedSecret !== webhookSecret) {
    logStep("Invalid webhook secret");
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.json();
    logStep("Webhook received", { event: body.event, id: body.id });

    const event = body.event;

    if (event === "billing.paid") {
      const billing = body.data?.billing;
      const customer = body.data?.customer;
      const metadata = billing?.metadata || body.data?.metadata || {};

      if (!customer?.email) {
        logStep("No customer email in webhook payload");
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      const userId = metadata.user_id;
      const billingPeriod = metadata.billing_period || "monthly";
      const billingId = billing?.id;

      logStep("Processing payment", { email: customer.email, userId, billingId });

      const now = new Date();
      const periodEnd = new Date(now);
      if (billingPeriod === "annual") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      if (userId) {
        const { error } = await supabaseClient
          .from("subscriptions")
          .upsert(
            {
              user_id: userId,
              status: "active",
              plan: "core-pro",
              billing_period: billingPeriod,
              abacatepay_billing_id: billingId,
              customer_email: customer.email,
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
            },
            { onConflict: "user_id" }
          );

        if (error) {
          logStep("DB upsert error, trying insert", { message: error.message });
          const { error: insertError } = await supabaseClient
            .from("subscriptions")
            .insert({
              user_id: userId,
              status: "active",
              plan: "core-pro",
              billing_period: billingPeriod,
              abacatepay_billing_id: billingId,
              customer_email: customer.email,
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
            });
          if (insertError) logStep("DB insert error", { message: insertError.message });
        }
        logStep("Subscription activated", { userId });
      } else {
        logStep("No user_id in metadata, storing with placeholder");
        const { error } = await supabaseClient
          .from("subscriptions")
          .insert({
            user_id: "00000000-0000-0000-0000-000000000000",
            status: "active",
            plan: "core-pro",
            billing_period: billingPeriod,
            abacatepay_billing_id: billingId,
            customer_email: customer.email,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
          });
        if (error) logStep("Fallback insert error", { message: error.message });
      }
    } else if (event === "billing.disputed") {
      const metadata = body.data?.billing?.metadata || body.data?.metadata || {};
      const userId = metadata.user_id;

      if (userId) {
        await supabaseClient
          .from("subscriptions")
          .update({ status: "disputed" })
          .eq("user_id", userId)
          .eq("status", "active");
        logStep("Subscription disputed", { userId });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
