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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    log("Started");

    // 1. Pull due, pending rows
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
        // Check user is still on trial (not subscribed) and exists
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

        // Get user email
        const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(row.user_id);
        if (userErr || !userData?.user?.email) {
          await supabase.from("trial_email_schedule")
            .update({ status: "failed" }).eq("id", row.id);
          failed++;
          continue;
        }

        const email = userData.user.email;
        const userMeta = userData.user.user_metadata ?? {};
        const displayName = (userMeta.display_name as string) || email.split("@")[0];

        // Try to invoke send-transactional-email (no-op if function/domain not yet configured)
        const { error: invokeErr } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: row.email_key,
            recipientEmail: email,
            idempotencyKey: `trial-${row.user_id}-${row.email_key}`,
            templateData: { name: displayName },
          },
        });

        if (invokeErr) {
          // Mark as failed but keep going (likely email infra not yet set up)
          log("Invoke failed (likely email infra not ready)", { id: row.id, err: invokeErr.message });
          await supabase.from("trial_email_schedule")
            .update({ status: "failed" }).eq("id", row.id);
          failed++;
        } else {
          await supabase.from("trial_email_schedule")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", row.id);
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
