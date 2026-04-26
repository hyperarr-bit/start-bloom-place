import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const SS_INTENT_KEY = "winback_intent_at";
const COOLDOWN_DAYS = 30;
const INTENT_WINDOW_MS = 10 * 60 * 1000; // 10min

export function useWinbackTrigger() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isSubscribed, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);

  // chamada quando o usuário clica em "Assinar"
  const markIntent = () => {
    try {
      sessionStorage.setItem(SS_INTENT_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    if (loading || !user || isSubscribed) return;

    const canceled = searchParams.get("canceled") === "true";
    const intentRaw = (() => {
      try {
        return sessionStorage.getItem(SS_INTENT_KEY);
      } catch {
        return null;
      }
    })();
    const hadRecentIntent =
      intentRaw && Date.now() - Number(intentRaw) < INTENT_WINDOW_MS;

    // dispara se voltou de checkout cancelado OU teve intent recente
    if (!canceled && !hadRecentIntent) return;

    let cancelled = false;

    (async () => {
      // verifica cooldown
      const since = new Date(
        Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data: recent } = await supabase
        .from("winback_attempts")
        .select("id, accepted_at")
        .eq("user_id", user.id)
        .gte("triggered_at", since)
        .order("triggered_at", { ascending: false })
        .limit(1);

      if (cancelled) return;

      // se já viu nos últimos 30 dias OU já aceitou alguma vez, não mostra
      if (recent && recent.length > 0) {
        try {
          sessionStorage.removeItem(SS_INTENT_KEY);
        } catch {/* noop */}
        if (canceled) {
          searchParams.delete("canceled");
          setSearchParams(searchParams, { replace: true });
        }
        return;
      }

      // cria attempt
      const { data: created, error } = await supabase
        .from("winback_attempts")
        .insert({ user_id: user.id })
        .select("id")
        .single();

      if (cancelled) return;
      if (error || !created) return;

      setAttemptId(created.id);
      setOpen(true);

      try {
        sessionStorage.removeItem(SS_INTENT_KEY);
      } catch {/* noop */}

      if (canceled) {
        searchParams.delete("canceled");
        setSearchParams(searchParams, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isSubscribed, loading, searchParams, setSearchParams]);

  const close = () => setOpen(false);

  return { open, attemptId, close, markIntent };
}
