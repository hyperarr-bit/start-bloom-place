import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  trialExpired: boolean;
  isSubscribed: boolean;
  gracePeriod: boolean;
  daysLeft: number;
  paymentMethod: "card" | "pix" | null;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
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
  const [gracePeriod, setGracePeriod] = useState(false);
  const [daysLeft, setDaysLeft] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "pix" | null>(null);
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
          setGracePeriod(false);
          setDaysLeft(0);
          setPaymentMethod(null);
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
      setGracePeriod(data?.grace_period ?? false);
      setDaysLeft(data?.days_left ?? 0);
      setPaymentMethod(data?.payment_method ?? null);
    } catch (err) {
      console.error("check-subscription failed:", err);
    }
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, trialExpired, isSubscribed, gracePeriod, daysLeft, paymentMethod, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
