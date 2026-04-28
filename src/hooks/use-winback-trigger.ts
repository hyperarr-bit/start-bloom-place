import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";

const INTENT_KEY = "subscribe_intent_at";
const INTENT_WINDOW_MS = 10 * 60 * 1000; // 10 min
const COOLDOWN_DAYS = 30;

type Source = "canceled_url" | "intent_timeout" | "abandon_planos";

export function useWinbackTrigger() {
  const [open, setOpen] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const triggeringRef = useRef(false);
  const { trialExpired } = useAuth();

  const markIntent = useCallback(() => {
    try {
      sessionStorage.setItem(INTENT_KEY, String(Date.now()));
    } catch { /* noop */ }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    triggeringRef.current = false;
    if (attemptId) {
      supabase
        .from("winback_attempts")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", attemptId)
        .then(() => {});
    }
  }, [attemptId]);

  const triggerNow = useCallback(async (
    source: Source,
    opts?: { bypassCooldown?: boolean },
  ): Promise<boolean> => {
    if (!trialExpired) return false; // só dispara após trial expirar
    if (open || triggeringRef.current) return false;
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

      if (!opts?.bypassCooldown) {
        const cutoff = new Date(Date.now() - COOLDOWN_DAYS * 86400000).toISOString();
        const { data: prior } = await supabase
          .from("winback_attempts")
          .select("id")
          .eq("user_id", user.id)
          .gte("triggered_at", cutoff)
          .limit(1);
        if (prior && prior.length > 0) return false;
      }

      const { data: created, error } = await supabase
        .from("winback_attempts")
        .insert({ user_id: user.id, triggered_at: new Date().toISOString() })
        .select("id")
        .single();

      if (error || !created) return false;

      try { sessionStorage.removeItem(INTENT_KEY); } catch { /* noop */ }

      setAttemptId(created.id);
      setOpen(true);
      trackEvent("winback_triggered", { source });
      opened = true;
      return true;
    } finally {
      if (!opened) triggeringRef.current = false;
    }
  }, [open, trialExpired]);

  // Re-check on every route change (and on first mount).
  // Só roda quando o trial já expirou — antes disso a roleta nunca aparece.
  useEffect(() => {
    if (!trialExpired) return;
    if (location.pathname === "/planos") return; // never auto-open while on planos
    if (open || triggeringRef.current) return;

    const canceled = searchParams.get("canceled") === "true";
    let intentTs = 0;
    try { intentTs = Number(sessionStorage.getItem(INTENT_KEY) ?? 0); } catch { /* noop */ }
    const recentIntent = intentTs > 0 && Date.now() - intentTs < INTENT_WINDOW_MS;

    if (!canceled && !recentIntent) return;

    (async () => {
      const opened = await triggerNow(
        canceled ? "canceled_url" : "intent_timeout",
        { bypassCooldown: true },
      );
      if (opened && canceled) {
        searchParams.delete("canceled");
        setSearchParams(searchParams, { replace: true });
      }
    })();
  }, [location.pathname, searchParams, setSearchParams, triggerNow, open]);

  return { open, attemptId, close, markIntent, triggerNow };
}
