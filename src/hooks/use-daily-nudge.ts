import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTrialActivations } from "@/hooks/use-trial-activations";
import { pickDailyNudge, DailyNudge } from "@/lib/dailyNudge";
import { trackEvent } from "@/lib/analytics";

const DISMISS_PREFIX = "core_nudge_dismissed_";

/**
 * Decides whether to show the daily nudge for this user/day,
 * remembers dismissals locally, and exposes handlers.
 */
export function useDailyNudge() {
  const { user, isSubscribed, trialExpired, trialDay } = useAuth();
  const { keys, loaded } = useTrialActivations();
  const [open, setOpen] = useState(false);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  const activations = useMemo(() => new Set(keys), [keys]);
  const nudge: DailyNudge | null = useMemo(() => {
    if (!user || isSubscribed) return null;
    return pickDailyNudge(trialDay, activations, trialExpired);
  }, [user, isSubscribed, trialDay, activations, trialExpired]);

  const dismissKey = nudge && user
    ? `${DISMISS_PREFIX}${user.id}_${nudge.key}`
    : null;

  // Decide whether to open after data loads
  useEffect(() => {
    if (!loaded || !nudge || !dismissKey || dismissedThisSession) return;
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(dismissKey);
    if (dismissed) return;

    const timer = window.setTimeout(() => {
      setOpen(true);
      trackEvent(
        "daily_nudge_shown",
        {
          nudge_key: nudge.key,
          has_activation: nudge.actionKey ? activations.has(nudge.actionKey) : false,
        },
        { trialDay },
      );
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [loaded, nudge, dismissKey, trialDay, activations, dismissedThisSession]);

  const persistDismiss = () => {
    if (dismissKey && typeof window !== "undefined") {
      window.localStorage.setItem(dismissKey, new Date().toISOString());
    }
    setDismissedThisSession(true);
    setOpen(false);
  };

  const dismiss = (method: "x" | "later" = "x") => {
    if (nudge) {
      trackEvent(
        "daily_nudge_dismissed",
        { nudge_key: nudge.key, method },
        { trialDay },
      );
    }
    persistDismiss();
  };

  const click = () => {
    if (nudge) {
      trackEvent(
        "daily_nudge_clicked",
        { nudge_key: nudge.key, cta_route: nudge.ctaRoute },
        { trialDay },
      );
    }
    persistDismiss();
  };

  return { nudge, open, dismiss, click };
}
