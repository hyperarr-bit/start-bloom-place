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

  const webhookSecret = Deno.env.get("ABACATEPAY_WEBHOOK_SECRET");
  const receivedSecret =
    req.headers.get("x-webhook-secret") ||
    new URL(req.url).searchParams.get("secret");

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
    const metadata = body.data?.metadata || {};
    let userId = metadata.user_id || null;
    const billingPeriod = metadata.billing_period || "monthly";
    const customerEmail = body.data?.customer?.email || null;
    const billingId = body.data?.id || null;
    const subscriptionId = body.data?.subscriptionId || body.data?.subscription_id || billingId;

    const now = new Date();

    // Helper to find user by email if no user_id in metadata
    async function resolveUserId() {
      if (userId) return userId;
      if (!customerEmail) return null;

      logStep("Looking up user by email", { email: customerEmail });
      const { data: usersData, error: listError } = await supabaseClient.auth.admin.listUsers();
      if (listError) {
        logStep("Error listing users", { message: listError.message });
        return null;
      }
      const matched = usersData.users.find(
        (u: { email?: string }) => u.email?.toLowerCase() === customerEmail.toLowerCase()
      );
      if (matched) {
        logStep("Found user by email", { userId: matched.id });
        return matched.id;
      }
      logStep("No user found for email", { email: customerEmail });
      return null;
    }

    // Handle billing.paid (legacy one-time) and subscription.paid (recurring)
    if (event === "billing.paid" || event === "subscription.paid") {
      userId = await resolveUserId();
      logStep("Payment received", { event, userId, billingId, email: customerEmail });

      if (!userId) {
        logStep("Cannot associate payment - no user found");
        return new Response(JSON.stringify({ received: true, warning: "no_user_found" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const periodEnd = new Date(now);
      if (billingPeriod === "annual") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const { error } = await supabaseClient
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            status: "active",
            plan: "core-pro",
            billing_period: billingPeriod,
            abacatepay_billing_id: billingId,
            abacatepay_subscription_id: subscriptionId,
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
            abacatepay_subscription_id: subscriptionId,
            customer_email: customerEmail,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
          });
        if (insertError) logStep("Insert error", { message: insertError.message });
      }
      logStep("Subscription activated", { userId, event });

    } else if (event === "subscription.cancelled") {
      userId = await resolveUserId();
      logStep("Subscription cancelled", { userId, subscriptionId });

      if (userId) {
        await supabaseClient
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("user_id", userId);
        logStep("Marked as canceled", { userId });
      }

    } else if (event === "subscription.overdue") {
      userId = await resolveUserId();
      logStep("Subscription overdue", { userId, subscriptionId });

      if (userId) {
        await supabaseClient
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("user_id", userId);
        logStep("Marked as past_due", { userId });
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
