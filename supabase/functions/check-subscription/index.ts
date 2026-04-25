import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${d}`);
};

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

    // Check profile created_at for trial
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("created_at")
      .eq("id", user.id)
      .single();

    // Check local subscriptions table
    const { data: localSub } = await supabaseClient
      .from("subscriptions")
      .select("status, current_period_end, plan, billing_period")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("current_period_end", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (localSub) {
      // Check if subscription is still valid
      const endDate = localSub.current_period_end
        ? new Date(localSub.current_period_end)
        : null;
      const isActive = !endDate || endDate > new Date();

      if (isActive) {
        logStep("Active subscription found", { end: localSub.current_period_end });
        return new Response(
          JSON.stringify({
            subscribed: true,
            trial_expired: false,
            subscription_end: localSub.current_period_end,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    // No active subscription — check trial
    const trialExpired = checkTrialExpired(profile?.created_at);
    logStep("No active subscription", { trialExpired });

    return new Response(
      JSON.stringify({
        subscribed: false,
        trial_expired: trialExpired,
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

function checkTrialExpired(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const hours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  return hours > 24;
}
