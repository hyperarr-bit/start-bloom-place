import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[DISPATCH-TRIAL-EMAILS] ${step}${d}`);
};

/**
 * Pick a variant for each email_key based on the user's activation profile.
 * Returns { variantKey, templateData } — templateData is forwarded as React props.
 */
function pickVariant(
  emailKey: string,
  ctx: {
    activations: Set<string>;
    moduleSessions: number;
    distinctModules: number;
  },
): { variantKey: string; extraData: Record<string, unknown> } {
  const has = (k: string) => ctx.activations.has(k);
  const engaged = ctx.distinctModules >= 3 || ctx.moduleSessions >= 8;

  switch (emailKey) {
    case "trial-welcome":
      return { variantKey: "default", extraData: {} };

    case "trial-d1-first-action":
      if (has("first_task")) return { variantKey: "has_task", extraData: { suggest: "transaction" } };
      if (has("first_transaction")) return { variantKey: "has_transaction", extraData: { suggest: "habit" } };
      return { variantKey: "default", extraData: { suggest: "rotina" } };

    case "trial-d2-finance":
      if (has("first_transaction")) return { variantKey: "has_transaction", extraData: { suggest: "summary" } };
      return { variantKey: "default", extraData: { suggest: "first_transaction" } };

    case "trial-d3-habit":
      if (has("first_habit")) return { variantKey: "has_habit", extraData: { suggest: "streak" } };
      if (has("first_workout") || has("first_water_log")) return { variantKey: "active_health", extraData: { suggest: "habit" } };
      return { variantKey: "default", extraData: { suggest: "first_habit" } };

    case "trial-d4-progress":
      return {
        variantKey: ctx.distinctModules >= 3 ? "rich_recap" : "light_recap",
        extraData: { distinctModules: ctx.distinctModules, sessions: ctx.moduleSessions },
      };

    case "trial-d5-value":
      return engaged
        ? { variantKey: "engaged", extraData: { distinctModules: ctx.distinctModules } }
        : { variantKey: "low_engagement", extraData: { distinctModules: ctx.distinctModules } };

    case "trial-d6-convert":
      return engaged
        ? { variantKey: "engaged_convert", extraData: { distinctModules: ctx.distinctModules } }
        : { variantKey: "value_pitch", extraData: {} };

    case "trial-d7-last-call":
      return engaged
        ? { variantKey: "engaged_last_call", extraData: { distinctModules: ctx.distinctModules } }
        : { variantKey: "soft_last_call", extraData: {} };

    default:
      return { variantKey: "default", extraData: {} };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    log("Started");

    // Feature flag: pause email sending without removing infra.
    const { data: cfg } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "trial_emails_enabled")
      .maybeSingle();
    const enabled = cfg?.value === true || cfg?.value === "true";
    if (!enabled) {
      log("Trial emails disabled via app_config flag");
      return new Response(JSON.stringify({ paused: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { data: due, error: dueErr } = await supabase
      .from("trial_email_schedule")
      .select("id, user_id, email_key, send_at")
      .eq("status", "pending")
      .lte("send_at", new Date().toISOString())
      .limit(100);

    if (dueErr) throw dueErr;
    if (!due || due.length === 0) {
      log("No emails due");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    log("Due emails", { count: due.length });
    let sent = 0, skipped = 0, failed = 0;

    for (const row of due) {
      try {
        // Skip if already subscribed
        const { data: subs } = await supabase
          .from("subscriptions")
          .select("status")
          .eq("user_id", row.user_id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (subs) {
          await supabase.from("trial_email_schedule")
            .update({ status: "skipped", sent_at: new Date().toISOString() })
            .eq("id", row.id);
          skipped++;
          continue;
        }

        const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(row.user_id);
        if (userErr || !userData?.user?.email) {
          await supabase.from("trial_email_schedule").update({ status: "failed" }).eq("id", row.id);
          failed++;
          continue;
        }

        const email = userData.user.email;
        const userMeta = userData.user.user_metadata ?? {};
        const displayName = (userMeta.display_name as string) || email.split("@")[0];

        // Build activation context
        const { data: actsRows } = await supabase
          .from("user_activations")
          .select("action_key")
          .eq("user_id", row.user_id);
        const activations = new Set<string>((actsRows ?? []).map((r: any) => r.action_key));

        const { data: modRows } = await supabase
          .from("module_analytics")
          .select("module_id")
          .eq("user_id", row.user_id);
        const moduleSessions = (modRows ?? []).length;
        const distinctModules = new Set((modRows ?? []).map((r: any) => r.module_id)).size;

        const { variantKey, extraData } = pickVariant(row.email_key, {
          activations, moduleSessions, distinctModules,
        });

        const templateData = {
          name: displayName,
          variant: variantKey,
          activations: Array.from(activations),
          ...extraData,
        };

        const { error: invokeErr } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: row.email_key,
            recipientEmail: email,
            idempotencyKey: `trial-${row.user_id}-${row.email_key}`,
            templateData,
          },
        });

        const nowIso = new Date().toISOString();

        if (invokeErr) {
          log("Invoke failed (likely email infra not ready)", { id: row.id, err: invokeErr.message });
          await supabase.from("trial_email_schedule")
            .update({ status: "failed", variant_key: variantKey })
            .eq("id", row.id);
          failed++;
        } else {
          await supabase.from("trial_email_schedule")
            .update({ status: "sent", sent_at: nowIso, variant_key: variantKey })
            .eq("id", row.id);
          // Analytics event
          await supabase.from("analytics_events").insert({
            user_id: row.user_id,
            event_name: "trial_email_sent",
            event_data: { email_key: row.email_key, variant_key: variantKey, ...extraData },
          });
          sent++;
        }
      } catch (e) {
        log("Row error", { id: row.id, err: (e as Error).message });
        failed++;
      }
    }

    log("Done", { sent, skipped, failed });
    return new Response(JSON.stringify({ processed: due.length, sent, skipped, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
