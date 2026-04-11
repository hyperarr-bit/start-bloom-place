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
    const userId = metadata.user_id;
    const billingPeriod = metadata.billing_period || "monthly";
    const customerEmail = body.data?.customer?.email || null;
    const billingId = body.data?.id || null;

    const now = new Date();

    // Handle paid events: billing.paid, payment.confirmed, etc.
    const paidEvents = ["billing.paid", "billing.confirmed", "payment.paid", "payment.confirmed"];
    
    if (paidEvents.includes(event)) {
      logStep("Payment confirmed", { event, userId, billingId, email: customerEmail });

      const periodEnd = new Date(now);
      if (billingPeriod === "annual") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      let resolvedUserId = userId;

      // If no user_id in metadata, try to find by billing_id in user_data
      if (!resolvedUserId && billingId) {
        logStep("No user_id, searching by billing_id", { billingId });
        const { data: userData } = await supabaseClient
          .from("user_data")
          .select("user_id, value")
          .eq("key", "pending_pix")
          .order("updated_at", { ascending: false });

        if (userData) {
          for (const row of userData) {
            const val = row.value as any;
            if (val?.billing_id === billingId) {
              resolvedUserId = row.user_id;
              logStep("Found user by billing_id", { resolvedUserId });
              break;
            }
          }
        }
      }

      // Also try matching by customer email
      if (!resolvedUserId && customerEmail) {
        logStep("Trying to match by email", { customerEmail });
        const { data: authUsers } = await supabaseClient.auth.admin.listUsers();
        const matched = authUsers?.users?.find((u: any) => u.email === customerEmail);
        if (matched) {
          resolvedUserId = matched.id;
          logStep("Found user by email", { resolvedUserId });
        }
      }

      if (resolvedUserId) {
        const { error } = await supabaseClient
          .from("subscriptions")
          .upsert(
            {
              user_id: resolvedUserId,
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
              user_id: resolvedUserId,
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
        logStep("Subscription activated", { userId: resolvedUserId, event });

        // Clean up pending_pix
        await supabaseClient
          .from("user_data")
          .delete()
          .eq("user_id", resolvedUserId)
          .eq("key", "pending_pix");
      } else {
        logStep("No user_id resolved, storing with placeholder", { billingId, customerEmail });
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
    } else if (event === "billing.warning" || event === "subscription.warning") {
      logStep("Payment warning - subscription may expire soon", { userId, billingId });
    } else if (event === "billing.canceled" || event === "subscription.canceled") {
      logStep("Subscription canceled", { userId, billingId });
      if (userId) {
        await supabaseClient
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("user_id", userId);
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
