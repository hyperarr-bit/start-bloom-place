import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUrl } from "@/lib/utils";

// Purge cached user data on sign-out so nothing leaks across accounts on the
// same browser. Kept inline (no import from use-user-data) to avoid a circular
// hook dependency.
const purgeLocalUserCache = () => {
  try {
    const KEEP = new Set(["core-welcome-done", "theme", "vite-ui-theme", "finance-keys-migrated-v2"]);
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || KEEP.has(k)) continue;
      if (
        k.startsWith("u:") ||
        k.startsWith("finance-") ||
        k.startsWith("home-") ||
        k.startsWith("core-") ||
        k.startsWith("life-") ||
        k.startsWith("module-") ||
        k.startsWith("daily-") ||
        k.startsWith("offline-") ||
        k.startsWith("nudge-")
      ) {
        toRemove.push(k);
      }
    }
    toRemove.forEach(k => { try { localStorage.removeItem(k); } catch {} });
  } catch {}
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  trialExpired: boolean;
  isSubscribed: boolean;
  /** True once check-subscription has returned at least once for the current user. */
  subscriptionChecked: boolean;
  trialDay: number;
  trialHoursLeft: number;
  inGracePeriod: boolean;
  graceDaysLeft: number | null;
  paymentMethod: string | null;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: any; session: Session | null }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [trialExpired, setTrialExpired] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [trialDay, setTrialDay] = useState(1);
  const [trialHoursLeft, setTrialHoursLeft] = useState(7 * 24);
  const [inGracePeriod, setInGracePeriod] = useState(false);
  const [graceDaysLeft, setGraceDaysLeft] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => checkSubscriptionStatus(), 0);
        } else {
          setTrialExpired(false);
          setIsSubscribed(false);
          setSubscriptionChecked(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkSubscriptionStatus();
      }
      setLoading(false);
    });

    // Auto-refresh every 60s
    intervalRef.current = setInterval(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) checkSubscriptionStatus();
      });
    }, 60000);

    return () => {
      subscription.unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) {
        console.error("check-subscription error:", error);
        return;
      }
      setIsSubscribed(data?.subscribed ?? false);
      setTrialExpired(data?.trial_expired ?? false);
      setInGracePeriod(data?.in_grace_period ?? false);
      setGraceDaysLeft(typeof data?.grace_days_left === "number" ? data.grace_days_left : null);
      setPaymentMethod(data?.payment_method ?? null);
      if (typeof data?.trial_day === "number") setTrialDay(data.trial_day);
      if (typeof data?.trial_hours_left === "number") setTrialHoursLeft(data.trial_hours_left);
      // Mark as checked only on a successful response — on error we fail open
      // (never block paying users because of a backend hiccup).
      setSubscriptionChecked(true);
    } catch (err) {
      console.error("check-subscription failed:", err);
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl("/auth/callback"),
        data: name ? { full_name: name } : undefined,
      },
    });
    // Persist captured lead source to the new user's profile (best-effort)
    try {
      const newUserId = data?.user?.id;
      if (newUserId && !error) {
        const { getLeadSource } = await import("@/lib/lead-source");
        const src = getLeadSource();
        if (src) {
          await supabase.from("profiles").update({
            utm_source: src.utm_source,
            utm_medium: src.utm_medium,
            utm_campaign: src.utm_campaign,
            utm_content: src.utm_content,
            utm_term: src.utm_term,
            referrer: src.referrer,
            landing_path: src.landing_path,
            source_captured_at: src.source_captured_at,
          }).eq("id", newUserId);
        }
      }
    } catch (e) {
      console.warn("lead-source persist failed", e);
    }
    return { error, session: data?.session ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    // Wipe per-user cached data BEFORE the auth state changes so the next
    // account that signs in on this browser starts from a clean slate.
    purgeLocalUserCache();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, trialExpired, isSubscribed, subscriptionChecked, trialDay, trialHoursLeft, inGracePeriod, graceDaysLeft, paymentMethod, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
