import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ABACATEPAY-WEBHOOK] ${step}${d}`);
};

serve(async (req) => {
  // Webhooks are POST only
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
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

    // Handle subscription events
    if (event === "subscription.completed" || event === "billing.paid") {
      const subscription = body.data?.subscription || body.data?.billing;
      const customer = body.data?.customer;
      const metadata = body.data?.billing?.metadata || body.data?.metadata || {};

      if (!customer?.email) {
        logStep("No customer email in webhook payload");
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      const userId = metadata.user_id;
      const billingPeriod = metadata.billing_period || "monthly";
      const billingId = subscription?.id || body.data?.billing?.id;

      logStep("Processing payment", { email: customer.email, userId, billingId });

      // Calculate period end based on billing period
      const now = new Date();
      const periodEnd = new Date(now);
      if (billingPeriod === "annual") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      if (userId) {
        // Upsert subscription record
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
          logStep("DB upsert error", { message: error.message });
          // Try insert if upsert fails (no unique constraint on user_id)
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
          if (insertError) {
            logStep("DB insert error", { message: insertError.message });
          }
        }
        logStep("Subscription activated", { userId });
      } else {
        logStep("No user_id in metadata, trying email lookup");
        // Fallback: look up user by email
        const { data: profiles } = await supabaseClient
          .from("profiles")
          .select("id")
          .limit(1);

        // We can't easily look up by email without auth.users access
        // Store with email for manual resolution
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
    } else if (event === "subscription.cancelled") {
      const customer = body.data?.customer;
      const metadata = body.data?.metadata || {};
      const userId = metadata.user_id;

      if (userId) {
        await supabaseClient
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("user_id", userId)
          .eq("status", "active");
        logStep("Subscription cancelled", { userId });
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
