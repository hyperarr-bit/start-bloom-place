import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ABACATEPAY-WEBHOOK] ${step}${d}`);
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("ABACATEPAY_WEBHOOK_SECRET");
  if (!webhookSecret) {
    logStep("ABACATEPAY_WEBHOOK_SECRET not configured — rejecting request");
    return new Response("Server misconfiguration", { status: 500 });
  }

  // SECURITY: secret aceito APENAS via header (query string vaza em logs/proxies)
  const receivedSecret = req.headers.get("x-webhook-secret");
  if (!receivedSecret || receivedSecret !== webhookSecret) {
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

    // SECURITY: idempotência — descarta replay do mesmo evento
    if (body.id) {
      const { error: dupErr } = await supabaseClient
        .from("webhook_events")
        .insert({ id: String(body.id), source: "abacatepay", event: body.event ?? null });
      if (dupErr) {
        // Conflito de PK = evento já processado
        if ((dupErr as { code?: string }).code === "23505") {
          logStep("Duplicate event ignored", { id: body.id });
          return new Response(JSON.stringify({ received: true, duplicate: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        logStep("Idempotency insert failed (continuing)", { message: dupErr.message });
      }
    }

    const event = body.event;
    const metadata = body.data?.metadata || {};
    let userId = metadata.user_id || null;
    const billingPeriod = metadata.billing_period || "monthly";
    const customerEmail = body.data?.customer?.email || null;
    const billingId = body.data?.id || null;
    const subscriptionId = body.data?.subscriptionId || body.data?.subscription_id || billingId;

    const now = new Date();

    async function updateStatus(filters: { userId?: string | null; subscriptionId?: string | null; billingId?: string | null }, status: string) {
      let query = supabaseClient.from("subscriptions").update({ status });

      if (filters.userId) {
        query = query.eq("user_id", filters.userId);
      } else {
        const clauses = [
          filters.subscriptionId ? `abacatepay_subscription_id.eq.${filters.subscriptionId}` : null,
          filters.billingId ? `abacatepay_billing_id.eq.${filters.billingId}` : null,
        ].filter(Boolean);

        if (!clauses.length) return;
        query = query.or(clauses.join(","));
      }

      const { error } = await query;
      if (error) {
        logStep("Status update error", { status, message: error.message, filters });
      }
    }

    async function saveActiveSubscription(resolvedUserId: string) {
      const periodEnd = new Date(now);
      if (billingPeriod === "annual") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      // Detect payment method from payload (PIX or CARD)
      const rawMethod =
        body.data?.paymentMethod ||
        body.data?.payment_method ||
        body.data?.method ||
        body.data?.billing?.paymentMethod ||
        null;
      const paymentMethod =
        typeof rawMethod === "string" && rawMethod.toUpperCase().includes("PIX")
          ? "pix"
          : "card";

      const payload = {
        user_id: resolvedUserId,
        status: "active",
        plan: "core-pro",
        billing_period: billingPeriod,
        payment_method: paymentMethod,
        abacatepay_billing_id: billingId,
        abacatepay_subscription_id: subscriptionId,
        customer_email: customerEmail,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      };

      const { data: updated, error: updateError } = await supabaseClient
        .from("subscriptions")
        .update(payload)
        .eq("user_id", resolvedUserId)
        .select("id");

      if (updateError) {
        logStep("Update error", { message: updateError.message, userId: resolvedUserId });
      }

      if (updated && updated.length > 0) {
        return;
      }

      const { error: insertError } = await supabaseClient.from("subscriptions").insert(payload);
      if (insertError) {
        logStep("Insert error", { message: insertError.message, userId: resolvedUserId });
      }
    }

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

    const paidEvents = new Set([
      "billing.paid",
      "subscription.paid",
      "subscription.charged",
      "subscription.created",
      "subscription.renewed",
    ]);
    const cancelEvents = new Set([
      "subscription.cancelled",
      "subscription.canceled",
      "subscription.ended",
    ]);
    const overdueEvents = new Set([
      "subscription.overdue",
      "subscription.payment_failed",
      "subscription.past_due",
    ]);

    if (paidEvents.has(event)) {
      userId = await resolveUserId();
      logStep("Payment received", { event, userId, billingId, email: customerEmail });

      if (!userId) {
        logStep("Cannot associate payment - no user found");
        return jsonResponse({ received: true, warning: "no_user_found" });
      }

      await saveActiveSubscription(userId);
      logStep("Subscription activated", { userId, event });

    } else if (cancelEvents.has(event)) {
      userId = await resolveUserId();
      logStep("Subscription cancelled", { userId, subscriptionId });

      await updateStatus({ userId, subscriptionId, billingId }, "canceled");
      logStep("Marked as canceled", { userId, subscriptionId, billingId });

    } else if (overdueEvents.has(event)) {
      userId = await resolveUserId();
      logStep("Subscription overdue", { userId, subscriptionId });

      await updateStatus({ userId, subscriptionId, billingId }, "past_due");
      logStep("Marked as past_due", { userId, subscriptionId, billingId });

    } else {
      logStep("Unhandled event type", { event });
    }

    return jsonResponse({ received: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return jsonResponse({ error: msg }, 500);
  }
});
