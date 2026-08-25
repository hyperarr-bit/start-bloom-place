import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUrl } from "@/lib/utils";
import { isNativeShell } from "@/lib/native-shell";

// Purge cached user data on sign-out so nothing leaks across accounts on the
// same browser. Kept inline (no import from use-user-data) to avoid a circular
// hook dependency.
const purgeLocalUserCache = () => {
  try {
    // core-pwa é marca do APARELHO (app instalado), não da conta: deslogar do
    // PWA não pode mandar a pessoa de volta pro funil de vendas.
    // core-gw-arm é o braço do A/B de gateway: se a vassoura levar, a mesma
    // pessoa cai em gateways diferentes entre sessões e o teste vira lixo.
    // core-boas-vindas-visto: marca de dispositivo da comemoração pós-compra.
    // Tem que estar nas DUAS listas (esta e a de use-user-data) — chave nova
    // que começa com "core-" e fica fora some na primeira troca de conta.
    // core-trial-cartao-fim + core-missao (v61): o trial do cartão COMEÇA
    // anônimo (compra antes do cadastro) e a pessoa loga em seguida — a
    // vassoura levava a flag e a Missão junto, no exato segundo em que elas
    // passam a importar. Pego no emulador em 19/08, mesmo caso do core-pwa.
    // core-theme-mode/palette (20/08, reviews da Monik ★4 e Isabela ★3): o
    // tema escuro e a paleta moram nessas chaves — a vassoura levava os dois
    // no logout e a pessoa reconfigurava a cada volta. Mesmo caso core-pwa.
    const KEEP = new Set(["core-welcome-done", "theme", "vite-ui-theme", "finance-keys-migrated-v2", "core-pwa", "core-gw-arm", "core-boas-vindas-visto", "core-trial-cartao-fim", "core-missao", "core-lembrete-hora", "core-funnel-area", "core-theme-mode", "core-theme-palette", "core-save-offer-visto"]);
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
  /** "monthly" | "annual" | "lifetime" — o que a pessoa assinou */
  billingPeriod: string | null;
  /** ISO do fim do período pago (null em vitalício sem data) */
  subscriptionEnd: string | null;
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
  const [billingPeriod, setBillingPeriod] = useState<string | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Última vez que a gente pediu ao RevenueCat pra reconciliar. Sem trava, o
  // ciclo de 60s + o listener de foco martelariam a API a cada checagem.
  // Uma consulta à loja por sessão antes de declarar "não assinante".
  const lojaConsultadaRef = useRef(false);
  const ultimaReconciliacaoRef = useRef(0);
  const trialConferidoRef = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // A assinatura da loja tem que seguir a CONTA, não o aparelho: sem
        // identificar, a compra fica num id anônimo e o próximo login no
        // mesmo celular herda (ou perde) o acesso.
        identificarNoRevenueCat(session?.user?.id ?? null);

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

  // Só existe no app das lojas. No web isso nunca roda (nem entra no bundle
  // que importa: o módulo do RevenueCat é carregado por import dinâmico).
  const identificarNoRevenueCat = (userId: string | null) => {
    if (!isNativeShell()) return;
    import("@/lib/revenuecat")
      .then((m) => m.identificarRevenueCat(userId))
      .catch(() => {});
  };

  /**
   * Rede de segurança do app das lojas: se o RevenueCat diz que a assinatura
   * está ativa mas o nosso banco não sabe, grava o acesso e re-checa.
   * Cobre webhook perdido/atrasado e compra feita antes do login — sem isso
   * a pessoa paga na Play e fica trancada (bug real de 25/07).
   * Trava de 60s pra não virar martelo em cima da API do RevenueCat.
   */
  /** Devolve true se a loja tinha assinatura ativa e o banco foi atualizado. */
  const reconciliarLoja = async (): Promise<boolean> => {
    if (!isNativeShell()) return false;
    if (Date.now() - ultimaReconciliacaoRef.current < 60000) return false;
    ultimaReconciliacaoRef.current = Date.now();
    try {
      const { reconciliarSePreciso } = await import("@/lib/revenuecat");
      return await reconciliarSePreciso();
    } catch {
      return false; // app nunca quebra por causa de loja
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) {
        console.error("check-subscription error:", error);
        return;
      }
      // ORDEM (26/07). Antes era: dispara reconciliarLoja() SEM esperar e, na
      // linha seguinte, decreta "não assinante". O portão via isSubscribed
      // false, subia o paywall, e a resposta da loja chegava tarde — quem
      // acabou de comprar via o paywall por cima do acesso que já pagou.
      // Agora, no app da loja, a primeira negativa não vira veredito antes de
      // perguntar à loja. Uma vez por sessão (o ref), pra não virar martelo.
      if (!data?.subscribed && isNativeShell() && !lojaConsultadaRef.current) {
        lojaConsultadaRef.current = true;
        if (await reconciliarLoja()) {
          await checkSubscriptionStatus(); // relê já com o acesso gravado
          return;
        }
      }
      // Assinante do app da loja: confere UMA vez por sessão se a assinatura
      // é o TRIAL de 3 dias (periodType no RevenueCat) — é o que liga a
      // Missão/holofote pra quem comprou sem o app saber que era trial
      // (compra implícita do v61, app morto na folha do Google).
      if (data?.subscribed && isNativeShell() && !trialConferidoRef.current) {
        trialConferidoRef.current = true;
        import("@/lib/revenuecat").then((m) => m.conferirTrialCartao()).catch(() => { /* nunca quebra o boot */ });
      }
      setIsSubscribed(data?.subscribed ?? false);
      setTrialExpired(data?.trial_expired ?? false);
      setNoTrial(data?.no_trial ?? false);
      setInGracePeriod(data?.in_grace_period ?? false);
      setGraceDaysLeft(typeof data?.grace_days_left === "number" ? data.grace_days_left : null);
      setPaymentMethod(data?.payment_method ?? null);
      // A função já devolvia estes dois desde sempre; o app jogava fora e a
      // tela "Meu acesso" ficava sem plano nem data de renovação.
      setBillingPeriod(data?.billing_period ?? null);
      setSubscriptionEnd(data?.subscription_end ?? null);
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
    <AuthContext.Provider value={{ user, session, loading, trialExpired, noTrial, isSubscribed, subLoaded, trialDay, trialHoursLeft, inGracePeriod, graceDaysLeft, paymentMethod, billingPeriod, subscriptionEnd, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
