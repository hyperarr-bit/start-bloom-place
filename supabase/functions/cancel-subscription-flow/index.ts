import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CANCEL-FLOW] ${step}${d}`);
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const ReasonEnum = z.enum([
  "too_expensive",
  "not_using",
  "missing_feature",
  "technical_issue",
  "other",
]);

const BodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("open"),
  }),
  z.object({
    action: z.literal("log_reason"),
    attemptId: z.string().uuid(),
    reason: ReasonEnum,
    reasonDetail: z.string().max(2000).optional(),
  }),
  z.object({
    action: z.literal("apply_discount"),
    attemptId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("pause_subscription"),
    attemptId: z.string().uuid(),
    months: z.number().int().min(1).max(3),
  }),
  z.object({
    action: z.literal("save_feedback"),
    attemptId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("confirm_cancel"),
    attemptId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("eligibility"),
  }),
  z.object({
    action: z.literal("log_offers_shown"),
    attemptId: z.string().uuid(),
    offers: z.array(z.string()).max(10),
  }),
  z.object({
    action: z.literal("extend_trial"),
    attemptId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("submit_support_ticket"),
    attemptId: z.string().uuid(),
    message: z.string().min(3).max(4000),
  }),
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "missing auth" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return jsonResponse({ error: "unauthorized" }, 401);
    const user = userData.user;

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return jsonResponse({ error: "invalid_body", details: parsed.error.flatten() }, 400);
    }
    const body = parsed.data;

    // ===== eligibility check =====
    const { data: offersUsed } = await admin
      .from("retention_offers_used")
      .select("offer_type, used_at")
      .eq("user_id", user.id)
      .gte("used_at", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());

    const usedTypes = new Set((offersUsed ?? []).map((o) => o.offer_type));
    const canUseDiscount = !usedTypes.has("discount");
    const canUsePause = !usedTypes.has("pause");
    const canUseExtension = !usedTypes.has("extend_7d");

    const { data: sub } = await admin
      .from("subscriptions")
      .select("id, status, plan, current_period_end, abacatepay_subscription_id")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (body.action === "eligibility") {
      return jsonResponse({
        canUseDiscount,
        canUsePause,
        canUseExtension,
        subscription: sub ?? null,
      });
    }

    // ===== open: create attempt row =====
    if (body.action === "open") {
      const { data: attempt, error } = await admin
        .from("cancel_attempts")
        .insert({
          user_id: user.id,
          subscription_id: sub?.id ?? null,
          outcome: "opened",
        })
        .select("id")
        .single();
      if (error) throw error;
      logStep("attempt_opened", { attemptId: attempt.id });
      return jsonResponse({
        attemptId: attempt.id,
        canUseDiscount,
        canUsePause,
        canUseExtension,
        subscription: sub ?? null,
      });
    }

    // For all other actions, verify the attempt belongs to this user
    const { data: attempt, error: attemptErr } = await admin
      .from("cancel_attempts")
      .select("id, user_id, outcome")
      .eq("id", body.attemptId)
      .single();
    if (attemptErr || !attempt || attempt.user_id !== user.id) {
      return jsonResponse({ error: "attempt_not_found" }, 404);
    }

    if (body.action === "log_reason") {
      await admin
        .from("cancel_attempts")
        .update({
          reason: body.reason,
          reason_detail: body.reasonDetail ?? null,
          outcome: "reason_given",
          updated_at: new Date().toISOString(),
        })
        .eq("id", attempt.id);

      await admin.from("analytics_events").insert({
        user_id: user.id,
        event_name: "cancel_reason_selected",
        event_data: { reason: body.reason, attempt_id: attempt.id },
      });

      return jsonResponse({ ok: true });
    }

    if (body.action === "save_feedback") {
      await admin
        .from("cancel_attempts")
        .update({ outcome: "saved_feedback", updated_at: new Date().toISOString() })
        .eq("id", attempt.id);
      await admin.from("analytics_events").insert({
        user_id: user.id,
        event_name: "retention_offer_accepted",
        event_data: { type: "feedback", attempt_id: attempt.id },
      });
      return jsonResponse({ ok: true });
    }

    if (body.action === "apply_discount") {
      if (!canUseDiscount) {
        return jsonResponse({ error: "discount_already_used_this_year" }, 409);
      }
      if (!sub) return jsonResponse({ error: "no_active_subscription" }, 404);

      // Record the offer; the actual gateway-side discount is applied
      // on the next billing cycle by support / next-billing webhook hook.
      // We persist the intent so it can be honored.
      await admin.from("retention_offers_used").insert({
        user_id: user.id,
        offer_type: "discount",
        metadata: { percent_off: 50, cycles: 3, subscription_id: sub.id },
      });

      await admin
        .from("cancel_attempts")
        .update({ outcome: "saved_discount", updated_at: new Date().toISOString() })
        .eq("id", attempt.id);

      await admin.from("analytics_events").insert({
        user_id: user.id,
        event_name: "retention_offer_accepted",
        event_data: { type: "discount", percent_off: 50, cycles: 3, attempt_id: attempt.id },
      });

      logStep("discount_applied", { userId: user.id });
      return jsonResponse({ ok: true, type: "discount", percentOff: 50, cycles: 3 });
    }

    if (body.action === "pause_subscription") {
      if (!canUsePause) {
        return jsonResponse({ error: "pause_already_used_this_year" }, 409);
      }
      if (!sub) return jsonResponse({ error: "no_active_subscription" }, 404);

      // Extend current_period_end by N months (no charge during pause).
      const baseDate = sub.current_period_end
        ? new Date(sub.current_period_end as string)
        : new Date();
      const newEnd = new Date(baseDate);
      newEnd.setMonth(newEnd.getMonth() + body.months);

      await admin
        .from("subscriptions")
        .update({ current_period_end: newEnd.toISOString() })
        .eq("id", sub.id);

      await admin.from("retention_offers_used").insert({
        user_id: user.id,
        offer_type: "pause",
        metadata: { months: body.months, subscription_id: sub.id, new_end: newEnd.toISOString() },
      });

      await admin
        .from("cancel_attempts")
        .update({ outcome: "saved_pause", updated_at: new Date().toISOString() })
        .eq("id", attempt.id);

      await admin.from("analytics_events").insert({
        user_id: user.id,
        event_name: "retention_offer_accepted",
        event_data: { type: "pause", months: body.months, attempt_id: attempt.id },
      });

      logStep("paused", { userId: user.id, months: body.months });
      return jsonResponse({ ok: true, type: "pause", months: body.months, newEnd: newEnd.toISOString() });
    }

    if (body.action === "confirm_cancel") {
      if (sub) {
        // Mark canceled; access remains until current_period_end
        await admin
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("id", sub.id);

        // Best-effort cancel at AbacatePay (if API key + subscription id present)
        const apiKey = Deno.env.get("ABACATEPAY_API_KEY");
        if (apiKey && sub.abacatepay_subscription_id) {
          try {
            await fetch(
              `https://api.abacatepay.com/v2/subscriptions/${sub.abacatepay_subscription_id}/cancel`,
              {
                method: "POST",
                headers: { Authorization: `Bearer ${apiKey}` },
              },
            );
            logStep("abacatepay_cancel_called", { subscriptionId: sub.abacatepay_subscription_id });
          } catch (e) {
            logStep("abacatepay_cancel_failed", { error: String(e) });
            // Non-fatal: webhook will reconcile
          }
        }
      }

      await admin
        .from("cancel_attempts")
        .update({ outcome: "churned", updated_at: new Date().toISOString() })
        .eq("id", attempt.id);

      // Compute trial day for analytics
      let trialDay: number | null = null;
      try {
        const { data: u } = await admin.auth.admin.getUserById(user.id);
        if (u?.user?.created_at) {
          const ms = Date.now() - new Date(u.user.created_at).getTime();
          trialDay = Math.min(8, Math.max(1, Math.ceil(ms / 86400000)));
        }
      } catch (_) { /* non-fatal */ }

      // Re-fetch reason from attempt (set in earlier log_reason step)
      const { data: fullAttempt } = await admin
        .from("cancel_attempts")
        .select("reason")
        .eq("id", attempt.id)
        .maybeSingle();

      await admin.from("analytics_events").insert([
        {
          user_id: user.id,
          event_name: "cancel_confirmed",
          event_data: { attempt_id: attempt.id, subscription_id: sub?.id ?? null },
          trial_day: trialDay,
        },
        {
          user_id: user.id,
          event_name: "trial_canceled_reason",
          event_data: {
            attempt_id: attempt.id,
            reason: fullAttempt?.reason ?? null,
            was_paying: sub?.status === "active",
          },
          trial_day: trialDay,
        },
      ]);

      return jsonResponse({
        ok: true,
        accessUntil: sub?.current_period_end ?? null,
      });
    }

    return jsonResponse({ error: "unknown_action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logStep("ERROR", { msg });
    return jsonResponse({ error: msg }, 500);
  }
});
