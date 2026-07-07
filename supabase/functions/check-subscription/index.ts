import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${d}`);
};

const GRACE_PERIOD_DAYS = 7;
const TRIAL_DAYS = 7;

// Paywall no funil: contas criadas a partir deste corte NÃO têm trial —
// entram bloqueadas até assinar. Contas antigas mantêm o trial de 7 dias.
const PAYWALL_CUTOFF = new Date("2026-07-04T18:00:00Z");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { email: user.email });

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("created_at")
      .eq("id", user.id)
      .single();

    // Pega a assinatura mais recente que ainda pode dar acesso
    // (active, past_due ou canceled recente para checar grace)
    const { data: localSub } = await supabaseClient
      .from("subscriptions")
      .select("status, current_period_end, plan, billing_period, payment_method")
      .eq("user_id", user.id)
      .in("status", ["active", "past_due"])
      .order("current_period_end", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (localSub) {
      const endDate = localSub.current_period_end
        ? new Date(localSub.current_period_end)
        : null;
      const now = new Date();

      // Sem data de fim ou ainda dentro do período → ativo normal
      if (!endDate || endDate > now) {
        logStep("Active subscription found", { end: localSub.current_period_end });
        return new Response(
          JSON.stringify({
            subscribed: true,
            trial_expired: false,
            in_grace_period: false,
            grace_days_left: null,
            payment_method: localSub.payment_method ?? null,
            billing_period: localSub.billing_period ?? null,
            subscription_end: localSub.current_period_end,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      // Vencido: checa se ainda está no grace period (7 dias)
      const msSinceExpiry = now.getTime() - endDate.getTime();
      const daysSinceExpiry = msSinceExpiry / (1000 * 60 * 60 * 24);

      if (daysSinceExpiry <= GRACE_PERIOD_DAYS) {
        const graceDaysLeft = Math.max(0, Math.ceil(GRACE_PERIOD_DAYS - daysSinceExpiry));
        logStep("In grace period", { daysSinceExpiry, graceDaysLeft });
        return new Response(
          JSON.stringify({
            subscribed: true,
            trial_expired: false,
            in_grace_period: true,
            grace_days_left: graceDaysLeft,
            payment_method: localSub.payment_method ?? null,
            billing_period: localSub.billing_period ?? null,
            subscription_end: localSub.current_period_end,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      // Passou do grace → considera não-assinante (cleanup cron marca como canceled)
      logStep("Grace period expired", { daysSinceExpiry });
    }

    // Sem assinatura ativa — calcula trial
    const trialState = computeTrialState(profile?.created_at);
    logStep("No active subscription", trialState);

    return new Response(
      JSON.stringify({
        subscribed: false,
        trial_expired: trialState.expired,
        no_trial: trialState.noTrial,
        trial_day: trialState.day,
        trial_hours_left: trialState.hoursLeft,
        in_grace_period: false,
        grace_days_left: null,
        payment_method: null,
        subscription_end: null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

function computeTrialState(createdAt: string | null | undefined) {
  if (!createdAt) return { expired: false, noTrial: false, day: 1, hoursLeft: TRIAL_DAYS * 24 };
  const created = new Date(createdAt);

  // Conta pós-paywall: sem trial — bloqueada até assinar
  if (created >= PAYWALL_CUTOFF) {
    return { expired: true, noTrial: true, day: 0, hoursLeft: 0 };
  }

  const ms = Date.now() - created.getTime();
  const totalHours = ms / (1000 * 60 * 60);
  const totalDays = totalHours / 24;
  const expired = totalDays > TRIAL_DAYS;
  const day = Math.min(TRIAL_DAYS, Math.max(1, Math.ceil(totalDays === 0 ? 1 : totalDays)));
  const hoursLeft = Math.max(0, TRIAL_DAYS * 24 - totalHours);
  return { expired, noTrial: false, day, hoursLeft };
}
