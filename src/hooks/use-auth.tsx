import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUrl } from "@/lib/utils";

// Purge cached user data on sign-out so nothing leaks across accounts on the
// same browser. Kept inline (no import from use-user-data) to avoid a circular
// hook dependency.
const purgeLocalUserCache = () => {
  try {
    // core-pwa é marca do APARELHO (app instalado), não da conta: deslogar do
    // PWA não pode mandar a pessoa de volta pro funil de vendas.
    // core-gw-arm é o braço do A/B de gateway: se a vassoura levar, a mesma
    // pessoa cai em gateways diferentes entre sessões e o teste vira lixo.
    const KEEP = new Set(["core-welcome-done", "theme", "vite-ui-theme", "finance-keys-migrated-v2", "core-pwa", "core-gw-arm"]);
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
  noTrial: boolean;
  isSubscribed: boolean;
  /** true depois da 1ª resposta do check-subscription — antes disso o status é desconhecido */
  subLoaded: boolean;
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
  const [noTrial, setNoTrial] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subLoaded, setSubLoaded] = useState(false);
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
          setNoTrial(false);
          setIsSubscribed(false);
          setSubLoaded(false);
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

    // Re-checa na volta do foco: quem acabou de pagar na Cakto e voltou pro app
    // não pode esperar o próximo ciclo de 60s encarando o paywall.
    const onFocus = () => {
      if (document.visibilityState === "hidden") return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) checkSubscriptionStatus();
      });
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      subscription.unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
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
      setNoTrial(data?.no_trial ?? false);
      setInGracePeriod(data?.in_grace_period ?? false);
      setGraceDaysLeft(typeof data?.grace_days_left === "number" ? data.grace_days_left : null);
      setPaymentMethod(data?.payment_method ?? null);
      if (typeof data?.trial_day === "number") setTrialDay(data.trial_day);
      if (typeof data?.trial_hours_left === "number") setTrialHoursLeft(data.trial_hours_left);
      setSubLoaded(true);
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
    const newUserId = data?.user?.id;
    if (newUserId && !error) {
      const { persistLeadSource } = await import("@/lib/lead-source");
      await persistLeadSource(supabase, newUserId);
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
    <AuthContext.Provider value={{ user, session, loading, trialExpired, noTrial, isSubscribed, subLoaded, trialDay, trialHoursLeft, inGracePeriod, graceDaysLeft, paymentMethod, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
