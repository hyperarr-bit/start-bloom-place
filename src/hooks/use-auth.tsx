import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUrl } from "@/lib/utils";
import { isNativeShell } from "@/lib/native-shell";
import { vincularOrigem } from "@/lib/analytics";
import { vincularCompraAnonima } from "@/lib/sessao-anonima";
import { assinaturaDoMock, diasDoTesteDoMock } from "@/lib/rc-mock";
import { vassouraLeva } from "@/lib/chaves-do-aparelho";

// Purge cached user data on sign-out so nothing leaks across accounts on the
// same browser. No import from use-user-data (circular hook dependency): the
// device-key list comes from src/lib/chaves-do-aparelho.ts, which imports nothing.
// 10/10: exportada pro porta-handoff (troca de conta sem assinatura por um link da Porta).
export const purgeLocalUserCache = () => {
  try {
    // As chaves do APARELHO (core-pwa, braços de A/B, tema, "já vi" do tour e dos cartões,
    // travas da avaliação…) ficam: a lista única mora em src/lib/chaves-do-aparelho.ts e vale
    // pras DUAS vassouras (esta e a de use-user-data). Chave nova que começa com "core-" e
    // fica fora some no primeiro logout — o teste chaves-do-aparelho-guarda cobra.
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && vassouraLeva(k)) toRemove.push(k);
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

/** 1.0.17: pede ao AuthProvider pra reler a assinatura agora (o LiberandoIOS dispara depois de gravar o acesso). */
export const EVENTO_RELER_ASSINATURA = "core:reler-assinatura";

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
          // 31/08: o funil W vende ANTES do cadastro, então a origem da
          // instalação (install_referrer) ficou numa sessão anônima lá atrás.
          // Este é o primeiro instante em que temos as duas pontas — carimba
          // a origem no usuário pra o relatório ligar venda→anúncio sem
          // depender de casar sessão ou GAID.
          void vincularOrigem(session.user.id);
          // 17/09: se a pessoa pagou numa sessão anônima e acabou de entrar em
          // OUTRA conta (Google, senha, link, código), a compra vem junto —
          // antes da primeira leitura, pra não abrir o paywall em cima de
          // quem pagou.
          setTimeout(async () => {
            const uid = session.user.id;
            await vincularCompraAnonima(uid, true).catch(() => false);
            checkSubscriptionStatus();
          }, 0);
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
    // 1.0.17: o pós-compra do iPhone gravou o acesso e pede a releitura na hora (antes recarregava o app inteiro).
    window.addEventListener(EVENTO_RELER_ASSINATURA, onFocus);

    return () => {
      window.removeEventListener(EVENTO_RELER_ASSINATURA, onFocus);
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
    /* 10/10 — BUILD DE TESTE (RC_MOCK=1) só: a compra do mock da loja vale como assinatura
     * (o servidor nunca recebe webhook do RevenueCat no Simulador — sem isto a pessoa pagava
     * no mock e caía no gate). Fora do build de mock, assinaturaDoMock() é sempre null. */
    const mock = assinaturaDoMock();
    if (mock) {
      const { trialDay: diaDoTeste, trialHoursLeft: horasDoTeste } = diasDoTesteDoMock(mock);
      setIsSubscribed(true);
      setTrialExpired(false);
      setNoTrial(false);
      setInGracePeriod(false);
      setGraceDaysLeft(null);
      setPaymentMethod(isNativeShell() ? "app_store" : "mock");
      setBillingPeriod(mock.billingPeriod);
      setSubscriptionEnd(new Date(mock.fimMs).toISOString());
      if (mock.emTeste) { setTrialDay(diaDoTeste); setTrialHoursLeft(horasDoTeste); }
      setSubLoaded(true);
      return;
    }
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
      // Web (17/09): sem assinatura mas com sessão anônima guardada — quem
      // gerou o QR, trocou de conta e pagou DEPOIS cai aqui; a checagem
      // periódica traz a compra assim que ela existir (1 tentativa / 20 s).
      if (!data?.subscribed && !isNativeShell()) {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (s?.user?.id && await vincularCompraAnonima(s.user.id)) {
          await checkSubscriptionStatus();
          return;
        }
      }
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

/** O contexto sem exigir o provider (undefined fora dele) — pra peças que também montam soltas. */
export const useAuthOpcional = () => useContext(AuthContext);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
