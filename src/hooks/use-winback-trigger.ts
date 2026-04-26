import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";

const INTENT_KEY = "subscribe_intent_at";
const INTENT_WINDOW_MS = 10 * 60 * 1000; // 10 min
const COOLDOWN_DAYS = 30;

export function useWinbackTrigger() {
  const [open, setOpen] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const checkedRef = useRef(false);

  const markIntent = useCallback(() => {
    try {
      sessionStorage.setItem(INTENT_KEY, String(Date.now()));
    } catch { /* noop */ }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (attemptId) {
      supabase
        .from("winback_attempts")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", attemptId)
        .then(() => {});
    }
  }, [attemptId]);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Already subscribed? skip
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", user.id)
        .in("status", ["active", "trialing"])
        .limit(1);
      if (subs && subs.length > 0) return;

      // Cooldown: only one winback per user per 30d
      const cutoff = new Date(Date.now() - COOLDOWN_DAYS * 86400000).toISOString();
      const { data: prior } = await supabase
        .from("winback_attempts")
        .select("id")
        .eq("user_id", user.id)
        .gte("triggered_at", cutoff)
        .limit(1);
      if (prior && prior.length > 0) return;

      // Detect trigger
      const canceled = searchParams.get("canceled") === "true";
      let intentTs = 0;
      try { intentTs = Number(sessionStorage.getItem(INTENT_KEY) ?? 0); } catch { /* noop */ }
      const recentIntent = intentTs > 0 && Date.now() - intentTs < INTENT_WINDOW_MS;

      if (!canceled && !recentIntent) return;

      // Trigger! Insert attempt
      const { data: created, error } = await supabase
        .from("winback_attempts")
        .insert({ user_id: user.id, triggered_at: new Date().toISOString() })
        .select("id")
        .single();

      if (error || !created) return;

      try { sessionStorage.removeItem(INTENT_KEY); } catch { /* noop */ }
      if (canceled) {
        searchParams.delete("canceled");
        setSearchParams(searchParams, { replace: true });
      }

      setAttemptId(created.id);
      setOpen(true);
      const source = canceled ? "canceled_url" : "intent_timeout";
      trackEvent("winback_triggered", { source });
    })();
  }, [searchParams, setSearchParams]);

  return { open, attemptId, close, markIntent };
}
