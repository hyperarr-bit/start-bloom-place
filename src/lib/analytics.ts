import { supabase } from "@/integrations/supabase/client";

// Persistent session id for the tab
const SESSION_KEY = "core_session_id";
const UTM_KEY = "core_utm";

const getSessionId = (): string => {
  if (typeof window === "undefined") return "ssr";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
};

/** Captura UTM params da URL atual e persiste pra ficarem disponíveis durante toda a sessão (mesmo após o cadastro). */
export const captureLandingMeta = () => {
  if (typeof window === "undefined") return {};
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = {
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || "",
      // ID do clique do Meta Ads — repassado até o checkout da Cakto pra
      // fechar a atribuição da compra com o anúncio exato.
      fbclid: params.get("fbclid") || "",
      referrer: document.referrer || "",
      path: window.location.pathname,
    };
    // Só persiste se vier algo de novo (não sobrescreve UTM original com vazio)
    const existing = localStorage.getItem(UTM_KEY);
    if (!existing || utm.utm_source || utm.fbclid) {
      localStorage.setItem(UTM_KEY, JSON.stringify(utm));
    }
    return utm;
  } catch {
    return {};
  }
};

/** Parâmetros de atribuição (fbclid + utm) pra repassar ao link de checkout. */
export const getAttributionParams = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  try {
    const m = JSON.parse(localStorage.getItem(UTM_KEY) || "{}");
    const out: Record<string, string> = {};
    for (const k of ["fbclid", "utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
      if (m[k]) out[k] = m[k];
    }
    return out;
  } catch {
    return {};
  }
};

const getStoredMeta = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(UTM_KEY) || "{}");
  } catch {
    return {};
  }
};

interface TrackOptions {
  trialDay?: number;
}

/**
 * Fire-and-forget event tracking. Never blocks UI.
 * Funciona pra usuários logados E anônimos (visitantes pré-cadastro).
 */
export const trackEvent = (
  eventName: string,
  data: Record<string, unknown> = {},
  opts: TrackOptions = {},
) => {
  try {
    const meta = getStoredMeta();
    const payload = { ...meta, ...data };

    supabase.auth.getUser().then(({ data: u }) => {
      const userId = u?.user?.id ?? null;
      (supabase as any)
        .from("analytics_events")
        .insert({
          user_id: userId,
          event_name: eventName,
          event_data: payload,
          trial_day: opts.trialDay ?? null,
          session_id: getSessionId(),
        })
        .then(() => {});
    });
  } catch {
    // swallow
  }
};

/**
 * Marks a one-time activation action for the current user.
 * Idempotent — calling twice does nothing extra.
 * Also emits a `key_action_completed` analytics event the FIRST time.
 */
export const markActivation = async (
  actionKey: string,
  metadata: Record<string, unknown> = {},
) => {
  try {
    const { data: u } = await supabase.auth.getUser();
    const userId = u?.user?.id;
    if (!userId) return;

    const { data: existing } = await (supabase as any)
      .from("user_activations")
      .select("id")
      .eq("user_id", userId)
      .eq("action_key", actionKey)
      .maybeSingle();

    if (existing) return; // already activated

    const { error } = await (supabase as any)
      .from("user_activations")
      .insert({ user_id: userId, action_key: actionKey, metadata });

    if (!error) {
      trackEvent("key_action_completed", { action_key: actionKey, ...metadata });
    }
  } catch {
    // swallow — analytics must never break UX
  }
};
