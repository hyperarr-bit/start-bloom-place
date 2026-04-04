import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const useModuleTracker = (moduleId: string) => {
  const { user } = useAuth();
  const enteredAt = useRef<Date>(new Date());

  useEffect(() => {
    if (!user) return;
    enteredAt.current = new Date();

    const flush = async () => {
      const seconds = Math.round((Date.now() - enteredAt.current.getTime()) / 1000);
      if (seconds < 2) return;

      await (supabase as any)
        .from("module_analytics")
        .insert({
          user_id: user.id,
          module_id: moduleId,
          entered_at: enteredAt.current.toISOString(),
          duration_seconds: seconds,
        });
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
