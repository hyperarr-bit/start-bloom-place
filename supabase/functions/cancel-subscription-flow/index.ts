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

    const COLS = "id, status, plan, current_period_end, abacatepay_subscription_id, abacatepay_billing_id, payment_method, revenuecat_subscription_id";
    /* 14/11 (revisão): o MENSAL da Stripe vem primeiro e em qualquer estado que ainda cobra (active, past_due — a Stripe
     * segue tentando —, cancel_scheduled): a linha "active/trialing" de antes deixava o past_due de fora e o fluxo dizia
     * "cancelado" sem cancelar nada na Stripe. */
    const { data: mensalStripe } = await admin
      .from("subscriptions")
      .select(COLS)
      .eq("user_id", user.id)
      .eq("payment_method", "stripe")
      .like("abacatepay_billing_id", "sub_%")
      .in("status", ["active", "past_due", "cancel_scheduled"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: subComum } = mensalStripe ? { data: null } : await admin
      .from("subscriptions")
      .select(COLS)
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sub = mensalStripe ?? subComum;

    /* 24/09: assinatura de LOJA (App Store / Google Play) NÃO se cancela
     * aqui — só a loja cobra e só a loja cancela. Este fluxo gravava pausa,
     * +7 dias e cancel_scheduled no NOSSO banco e a Apple seguia cobrando
     * (caso 3d79e6b4, teste do anual do iPhone: "cancelou" pelo site, abriu
     * chamado "estão me cobrando algo que não estou devendo", e o cron da
     * Meta leu o período esticado como compra paga de R$ 159,90). */
    const loja = sub?.payment_method === "play_store"
      ? (/Aap/.test(String(sub.revenuecat_subscription_id ?? "")) ? "app_store" : "google_play")
      : null;

    /* 14/11 (mensal do /funil-app): assinatura recorrente na STRIPE. Pausa/desconto/+7 dias só mexeriam no NOSSO banco
     * (a Stripe seguiria cobrando) — ficam fora; o cancelamento é de verdade, na Stripe, no fim do período (o webhook
     * customer.subscription.updated grava cancel_scheduled; aqui grava junto pra tela já mostrar). */
    const stripeMensal = sub?.payment_method === "stripe" && /^sub_/.test(String((sub as Record<string, unknown>).abacatepay_billing_id ?? ""));

    if (body.action === "eligibility") {
      return jsonResponse({
        canUseDiscount: canUseDiscount && !stripeMensal,
        canUsePause: canUsePause && !stripeMensal,
        canUseExtension: canUseExtension && !stripeMensal,
        subscription: sub ?? null,
        loja,
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
      logStep("attempt_opened", { attemptId: attempt.id, loja });
      return jsonResponse({
        attemptId: attempt.id,
        canUseDiscount: canUseDiscount && !stripeMensal,
        canUsePause: canUsePause && !stripeMensal,
        canUseExtension: canUseExtension && !stripeMensal,
        subscription: sub ?? null,
        loja,
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

    // Nada de pausa/desconto/+7 dias/cancelamento de mentira em assinatura de
    // loja: o cliente é mandado pra tela de assinaturas da Apple/Google.
    if (loja && ["extend_trial", "apply_discount", "pause_subscription", "confirm_cancel"].includes(body.action)) {
      // (outcome de cancel_attempts tem CHECK com lista fechada — o registro
      // vai como evento, sem tocar na tentativa)
      await admin.from("analytics_events").insert({
        user_id: user.id,
        event_name: "cancel_loja_bloqueado",
        event_data: { action: body.action, loja, attempt_id: attempt.id },
      });
      logStep("loja_bloqueada", { userId: user.id, action: body.action, loja });
      return jsonResponse({ error: "assinatura_da_loja", loja }, 409);
    }
    if (stripeMensal && ["extend_trial", "apply_discount", "pause_subscription"].includes(body.action)) {
      return jsonResponse({ error: "so_cancelar" }, 409);
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

    if (body.action === "log_offers_shown") {
      await admin
        .from("cancel_attempts")
        .update({ offers_shown: body.offers, updated_at: new Date().toISOString() })
        .eq("id", attempt.id);
      await admin.from("analytics_events").insert({
        user_id: user.id,
        event_name: "retention_offers_shown",
        event_data: { offers: body.offers, attempt_id: attempt.id },
      });
      return jsonResponse({ ok: true });
    }

    if (body.action === "submit_support_ticket") {
      const { error: tErr } = await admin.from("support_tickets").insert({
        user_id: user.id,
        source: "cancel_flow",
        message: body.message,
        cancel_attempt_id: attempt.id,
      });
      if (tErr) throw tErr;
      await admin
        .from("cancel_attempts")
        .update({ outcome: "saved_feedback", updated_at: new Date().toISOString() })
        .eq("id", attempt.id);
      await admin.from("analytics_events").insert({
        user_id: user.id,
        event_name: "support_ticket_created",
        event_data: { source: "cancel_flow", attempt_id: attempt.id },
      });
      return jsonResponse({ ok: true });
    }

    if (body.action === "extend_trial") {
      if (!canUseExtension) {
        return jsonResponse({ error: "extension_already_used_this_year" }, 409);
      }
      if (!sub) return jsonResponse({ error: "no_active_subscription" }, 404);

      const baseDate = sub.current_period_end
        ? new Date(sub.current_period_end as string)
        : new Date();
      const newEnd = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);

      await admin
        .from("subscriptions")
        .update({ current_period_end: newEnd.toISOString() })
        .eq("id", sub.id);

      await admin.from("retention_offers_used").insert({
        user_id: user.id,
        offer_type: "extend_7d",
        metadata: { days: 7, subscription_id: sub.id, new_end: newEnd.toISOString() },
      });

      await admin
        .from("cancel_attempts")
        .update({ outcome: "saved_extension", updated_at: new Date().toISOString() })
        .eq("id", attempt.id);

      await admin.from("analytics_events").insert({
        user_id: user.id,
        event_name: "retention_offer_accepted",
        event_data: { type: "extend_7d", days: 7, attempt_id: attempt.id },
      });

      logStep("extended", { userId: user.id, days: 7 });
      return jsonResponse({ ok: true, type: "extend_7d", days: 7, newEnd: newEnd.toISOString() });
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
        // Cancela a RENOVAÇÃO; o acesso continua até current_period_end
        // (check-subscription honra "cancel_scheduled" até lá; o cron
        // grace-cleanup vira pra "canceled" quando o período acabar).
        /* 14/11 (revisão 2): mensal da Stripe EM DIA → cancela a renovação no fim do período (cancel_scheduled, o mês pago
         * segue). Mensal em ATRASO (past_due) → cancela JÁ (DELETE) e grava canceled: com cancel_at_period_end a Stripe seguia
         * tentando cobrar a fatura aberta e a pessoa ficava com o mês que não pagou. Sem a Stripe confirmar → 502. */
        const atrasado = stripeMensal && sub.status === "past_due";
        if (stripeMensal) {
          const sk = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
          const subStripe = String((sub as Record<string, unknown>).abacatepay_billing_id);
          const h = { Authorization: `Bearer ${sk}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": "2024-06-20" };
          const r = !sk ? null : atrasado
            ? await fetch(`https://api.stripe.com/v1/subscriptions/${subStripe}`, { method: "DELETE", headers: h }).catch(() => null)
            : await fetch(`https://api.stripe.com/v1/subscriptions/${subStripe}`, { method: "POST", headers: h, body: "cancel_at_period_end=true" }).catch(() => null);
          if (!r?.ok) {
            logStep("stripe_cancel_falhou", { status: r?.status ?? null, atrasado });
            return jsonResponse({ error: "cancelamento_falhou" }, 502);
          }
          logStep(atrasado ? "stripe_cancelado_ja (atrasado)" : "stripe_cancel_agendado", { userId: user.id });
        }
        await admin
          .from("subscriptions")
          .update({ status: atrasado ? "canceled" : "cancel_scheduled" })
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
        // revisão 3: o mensal atrasado foi cancelado JÁ — não há "ativa até" (a data do período já passou)
        accessUntil: sub && stripeMensal && sub.status === "past_due" ? null : sub?.current_period_end ?? null,
      });
    }

    return jsonResponse({ error: "unknown_action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logStep("ERROR", { msg });
    return jsonResponse({ error: msg }, 500);
  }
});
