import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";

const INTENT_KEY = "subscribe_intent_at";
const INTENT_WINDOW_MS = 10 * 60 * 1000; // 10 min
const COOLDOWN_DAYS = 30;

type Source = "canceled_url" | "intent_timeout" | "abandon_planos";

export function useWinbackTrigger() {
  const [open, setOpen] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [alreadyShown, setAlreadyShown] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const checkedRef = useRef(false);
  const triggeringRef = useRef(false);

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

  /**
   * Tries to open the winback flow. Respects: auth, active sub, 30d cooldown,
   * and not already shown in this session.
   * Returns true if it opened, false otherwise.
   */
  const triggerNow = useCallback(async (source: Source): Promise<boolean> => {
    // Synchronous lock — runs before any await to block reentrancy from
    // rapid back/popstate races.
    if (alreadyShown || open || triggeringRef.current) return false;
    triggeringRef.current = true;

    let opened = false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data: subs } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", user.id)
        .in("status", ["active", "trialing"])
        .limit(1);
      if (subs && subs.length > 0) return false;

      const cutoff = new Date(Date.now() - COOLDOWN_DAYS * 86400000).toISOString();
      const { data: prior } = await supabase
        .from("winback_attempts")
        .select("id")
        .eq("user_id", user.id)
        .gte("triggered_at", cutoff)
        .limit(1);
      if (prior && prior.length > 0) return false;

      const { data: created, error } = await supabase
        .from("winback_attempts")
        .insert({ user_id: user.id, triggered_at: new Date().toISOString() })
        .select("id")
        .single();

      if (error || !created) return false;

      try { sessionStorage.removeItem(INTENT_KEY); } catch { /* noop */ }

      setAttemptId(created.id);
      setOpen(true);
      setAlreadyShown(true);
      trackEvent("winback_triggered", { source });
      opened = true;
      return true;
    } finally {
      // Keep the lock engaged on success so concurrent callers can't open
      // a second roulette before React state propagates.
      if (!opened) triggeringRef.current = false;
    }
  }, [alreadyShown, open]);

  // Auto-detect on mount: ?canceled=true OR recent intent (came back from checkout)
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const canceled = searchParams.get("canceled") === "true";
    let intentTs = 0;
    try { intentTs = Number(sessionStorage.getItem(INTENT_KEY) ?? 0); } catch { /* noop */ }
    const recentIntent = intentTs > 0 && Date.now() - intentTs < INTENT_WINDOW_MS;

    if (!canceled && !recentIntent) return;

    (async () => {
      const opened = await triggerNow(canceled ? "canceled_url" : "intent_timeout");
      if (opened && canceled) {
        searchParams.delete("canceled");
        setSearchParams(searchParams, { replace: true });
      }
    })();
  }, [searchParams, setSearchParams, triggerNow]);

  return { open, attemptId, close, markIntent, triggerNow, alreadyShown };
}
