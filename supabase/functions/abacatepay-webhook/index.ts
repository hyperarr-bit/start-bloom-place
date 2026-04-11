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

  // Validate webhook signature (v2 uses X-Webhook-Signature)
  const webhookSecret = Deno.env.get("ABACATEPAY_WEBHOOK_SECRET");
  const receivedSignature =
    req.headers.get("x-webhook-signature") ||
    req.headers.get("x-webhook-secret") ||
    new URL(req.url).searchParams.get("secret");

  if (webhookSecret && receivedSignature !== webhookSecret) {
    logStep("Invalid webhook signature");
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
    const metadata = body.data?.metadata || body.data?.billing?.metadata || {};
    const userId = metadata.user_id;
    const billingPeriod = metadata.billing_period || "monthly";
    const customerEmail = body.data?.customer?.email || null;
    const billingId = body.data?.id || body.data?.billing?.id || null;

    const now = new Date();

    // Handle v2 checkout/billing events
    if (
      event === "checkout.completed" ||
      event === "billing.paid" ||
      event === "subscription.completed"
    ) {
      logStep("Payment completed", { userId, billingId, email: customerEmail });

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
              customer_email: customerEmail,
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
            },
            { onConflict: "user_id" }
          );

        if (error) {
          logStep("Upsert error, trying insert", { message: error.message });
          const { error: insertError } = await supabaseClient
            .from("subscriptions")
            .insert({
              user_id: userId,
              status: "active",
              plan: "core-pro",
              billing_period: billingPeriod,
              abacatepay_billing_id: billingId,
              customer_email: customerEmail,
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
            });
          if (insertError) logStep("Insert error", { message: insertError.message });
        }
        logStep("Subscription activated", { userId });
      } else {
        logStep("No user_id in metadata, storing with placeholder");
        await supabaseClient.from("subscriptions").insert({
          user_id: "00000000-0000-0000-0000-000000000000",
          status: "active",
          plan: "core-pro",
          billing_period: billingPeriod,
          abacatepay_billing_id: billingId,
          customer_email: customerEmail,
          current_period_start: now.toISOString(),
          current_period_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    } else if (event === "subscription.cancelled" || event === "billing.disputed") {
      logStep("Subscription cancelled/disputed", { userId, event });

      if (userId) {
        await supabaseClient
          .from("subscriptions")
          .update({ status: event === "subscription.cancelled" ? "cancelled" : "disputed" })
          .eq("user_id", userId);

        logStep("Subscription status updated", { userId, status: event });
      }
    } else {
      logStep("Unhandled event type", { event });
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
