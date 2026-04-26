// Cron diário: emite trial_day_X_active para cada usuário em trial (1-7d)
// que teve atividade nas últimas 24h. Idempotente — não duplica eventos por dia.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[TICK-TRIAL-DAYS] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Get auth users created 1-7 days ago
    const { data: usersResp, error: usersErr } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });
    if (usersErr) throw usersErr;

    const now = Date.now();
    const oneDay = 86_400_000;
    const trialUsers = usersResp.users.filter((u) => {
      const created = new Date(u.created_at).getTime();
      const ageDays = (now - created) / oneDay;
      return ageDays >= 1 && ageDays <= 7;
    });

    log("trial_users_in_window", { count: trialUsers.length });

    let emitted = 0;
    let skipped = 0;
    const since = new Date(now - oneDay).toISOString();
    const todayKey = new Date().toISOString().slice(0, 10);

    for (const u of trialUsers) {
      const ageDays = Math.ceil((now - new Date(u.created_at).getTime()) / oneDay);
      const trialDay = Math.min(7, Math.max(1, ageDays));

      // Was active in last 24h?
      const { data: actv } = await supabase
        .from("module_analytics")
        .select("id")
        .eq("user_id", u.id)
        .gte("entered_at", since)
        .limit(1);

      if (!actv || actv.length === 0) {
        skipped++;
        continue;
      }

      // Idempotency — already emitted today for this user?
      const { data: existing } = await supabase
        .from("analytics_events")
        .select("id")
        .eq("user_id", u.id)
        .eq("event_name", `trial_day_${trialDay}_active`)
        .gte("created_at", `${todayKey}T00:00:00Z`)
        .limit(1);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      await supabase.from("analytics_events").insert({
        user_id: u.id,
        event_name: `trial_day_${trialDay}_active`,
        event_data: { trial_day: trialDay },
        trial_day: trialDay,
      });
      emitted++;
    }

    log("done", { emitted, skipped });
    return new Response(
      JSON.stringify({ ok: true, emitted, skipped, scanned: trialUsers.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
