import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const useModuleTracker = (moduleId: string) => {
  const { user } = useAuth();
  const enteredAt = useRef<Date>(new Date());

  useEffect(() => {
    if (!user) return;
    enteredAt.current = new Date();

    const flush = () => {
      const seconds = Math.round((Date.now() - enteredAt.current.getTime()) / 1000);
      if (seconds < 2) return; // ignore accidental visits
      
      // Use sendBeacon for reliability on page close
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/module_analytics`;
      const body = JSON.stringify({
        user_id: user.id,
        module_id: moduleId,
        entered_at: enteredAt.current.toISOString(),
        duration_seconds: seconds,
      });
      
      const headers = {
        "Content-Type": "application/json",
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Authorization": `Bearer ${(supabase as any).auth.session?.()?.access_token || ""}`,
        "Prefer": "return=minimal",
      };

      // Try sendBeacon first, fallback to fetch
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon) {
        // sendBeacon can't set auth headers, so use fetch
      }
      
      fetch(url, { method: "POST", headers, body, keepalive: true }).catch(() => {});
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      flush();
    };
  }, [user, moduleId]);
};
