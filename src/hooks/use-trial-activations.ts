import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface UserActivations {
  loaded: boolean;
  has: (key: string) => boolean;
  keys: string[];
}

/**
 * Returns the set of action_keys the current user has already completed.
 */
export const useTrialActivations = (): UserActivations => {
  const { user } = useAuth();
  const [keys, setKeys] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setKeys([]);
      setLoaded(true);
      return;
    }
    (supabase as any)
      .from("user_activations")
      .select("action_key")
      .eq("user_id", user.id)
      .then(({ data }: { data: Array<{ action_key: string }> | null }) => {
        setKeys((data ?? []).map((r) => r.action_key));
        setLoaded(true);
      });
  }, [user]);

  return {
    loaded,
    keys,
    has: (k: string) => keys.includes(k),
  };
};
