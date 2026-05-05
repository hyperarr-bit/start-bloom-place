import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const log = (s: string, d?: unknown) =>
  console.log(`[GRACE-CLEANUP] ${s}${d ? " - " + JSON.stringify(d) : ""}`);

const GRACE_PERIOD_DAYS = 7;

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const cutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
    log("Cutoff", { cutoff });

    const { data: expired, error: selErr } = await supabase
      .from("subscriptions")
      .select("id, user_id, current_period_end, status")
      .in("status", ["active", "past_due"])
      .lt("current_period_end", cutoff);

    if (selErr) {
      log("Select error", { msg: selErr.message });
      return new Response(JSON.stringify({ error: selErr.message }), { status: 500 });
    }

    log("Found expired subscriptions", { count: expired?.length ?? 0 });

    let cancelled = 0;
    for (const sub of expired ?? []) {
      const { error: updErr } = await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("id", sub.id);

      if (updErr) {
        log("Update failed", { id: sub.id, msg: updErr.message });
        continue;
      }

      await supabase.from("analytics_events").insert({
        user_id: sub.user_id,
        event_name: "subscription_expired_no_payment",
        event_data: {
          previous_status: sub.status,
          period_end: sub.current_period_end,
          grace_days: GRACE_PERIOD_DAYS,
        },
      });
      cancelled += 1;
    }

    log("Done", { cancelled });
    return new Response(
      JSON.stringify({ success: true, cancelled, total_checked: expired?.length ?? 0 }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
