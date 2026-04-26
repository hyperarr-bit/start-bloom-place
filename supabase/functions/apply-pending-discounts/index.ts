// Aplica descontos de retenção pendentes (retention_offers_used.status='active')
// na assinatura ativa do AbacatePay.
//
// Disparada de duas formas:
//   1. Pelo abacatepay-webhook quando uma cobrança nova é gerada (passa userId/billingId)
//   2. Por cron diário sem args (sweeper de segurança)
//
// AbacatePay não publica formalmente o endpoint de desconto — tentamos dois caminhos
// comuns e logamos a resposta. Falhas incrementam apply_attempts; após 5, vira 'failed'.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ABACATE_BASE = "https://api.abacatepay.com/v2";

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[APPLY-DISCOUNTS] ${step}${d}`);
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BodySchema = z
  .object({
    userId: z.string().uuid().optional(),
    billingId: z.string().optional(),
  })
  .default({});

interface PendingOffer {
  id: string;
  user_id: string;
  metadata: {
    percent_off?: number;
    cycles?: number;
    subscription_id?: string;
  } | null;
  apply_attempts: number;
}

async function applyDiscountAtAbacate(args: {
  apiKey: string;
  subscriptionId: string;
  billingId?: string;
  percentOff: number;
  cycles: number;
}): Promise<{ ok: boolean; via: string; error?: string }> {
  const { apiKey, subscriptionId, billingId, percentOff, cycles } = args;

  const tryEndpoint = async (path: string, payload: unknown) => {
    try {
      const res = await fetch(`${ABACATE_BASE}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: { message: String(e) } };
    }
  };

  const r1 = await tryEndpoint(
    `/subscriptions/${subscriptionId}/discount`,
    { percent_off: percentOff, cycles, reason: "retention_save" },
  );
  if (r1.ok) return { ok: true, via: "subscription_discount" };
  log("subscription_discount failed", { status: r1.status, body: r1.data });

  if (billingId) {
    const r2 = await tryEndpoint(
      `/billings/${billingId}/discount`,
      { percent_off: percentOff },
    );
    if (r2.ok) return { ok: true, via: "billing_discount" };
    log("billing_discount failed", { status: r2.status, body: r2.data });
  }

  return {
    ok: false,
    via: "none",
    error: `discount endpoints failed (sub:${r1.status})`,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const apiKey = Deno.env.get("ABACATEPAY_API_KEY");
    if (!apiKey) {
      log("no_api_key");
      return json({ error: "ABACATEPAY_API_KEY missing" }, 500);
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json({ error: "invalid_body" }, 400);
    const { userId, billingId } = parsed.data;

    let q = supabase
      .from("retention_offers_used")
      .select("id, user_id, metadata, apply_attempts")
      .eq("offer_type", "discount")
      .eq("status", "active")
      .lt("apply_attempts", 5);

    if (userId) q = q.eq("user_id", userId);

    const { data: pending, error: fetchErr } = await q.limit(50);
    if (fetchErr) {
      log("fetch_error", { msg: fetchErr.message });
      return json({ error: fetchErr.message }, 500);
    }

    if (!pending || pending.length === 0) {
      return json({ ok: true, processed: 0 });
    }

    log("processing", { count: pending.length, userId, billingId });

    const results: Array<{
      offerId: string;
      userId: string;
      status: string;
      via?: string;
      error?: string;
    }> = [];

    for (const offer of pending as PendingOffer[]) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, abacatepay_subscription_id")
        .eq("user_id", offer.user_id)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub?.abacatepay_subscription_id) {
        await supabase
          .from("retention_offers_used")
          .update({
            apply_attempts: offer.apply_attempts + 1,
            last_apply_error: "no_subscription_at_abacate",
          })
          .eq("id", offer.id);
        results.push({
          offerId: offer.id,
          userId: offer.user_id,
          status: "no_subscription",
        });
        continue;
      }

      const meta = offer.metadata ?? {};
      const percentOff = Number(meta.percent_off ?? 50);
      const cycles = Number(meta.cycles ?? 2);

      const r = await applyDiscountAtAbacate({
        apiKey,
        subscriptionId: sub.abacatepay_subscription_id,
        billingId,
        percentOff,
        cycles,
      });

      if (r.ok) {
        await supabase
          .from("retention_offers_used")
          .update({
            status: "applied",
            applied_at: new Date().toISOString(),
            apply_attempts: offer.apply_attempts + 1,
            metadata: {
              ...meta,
              applied_via: r.via,
              applied_at: new Date().toISOString(),
            },
          })
          .eq("id", offer.id);

        await supabase.from("analytics_events").insert({
          user_id: offer.user_id,
          event_name: "retention_discount_applied",
          event_data: {
            offer_id: offer.id,
            via: r.via,
            percent_off: percentOff,
            cycles,
          },
        });

        results.push({
          offerId: offer.id,
          userId: offer.user_id,
          status: "applied",
          via: r.via,
        });
        log("applied", { offerId: offer.id, via: r.via });
      } else {
        const attempts = offer.apply_attempts + 1;
        await supabase
          .from("retention_offers_used")
          .update({
            apply_attempts: attempts,
            last_apply_error: r.error ?? "unknown_error",
            status: attempts >= 5 ? "failed" : "active",
          })
          .eq("id", offer.id);
        results.push({
          offerId: offer.id,
          userId: offer.user_id,
          status: "retry",
          error: r.error,
        });
      }
    }

    return json({ ok: true, processed: results.length, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return json({ error: msg }, 500);
  }
});
