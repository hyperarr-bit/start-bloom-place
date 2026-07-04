import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Check, Sparkles, ShieldCheck,
  Lock, MailCheck, Loader2, ChevronLeft, ChevronRight, Circle, CheckCircle2,
} from "lucide-react";
import { PaywallFlow } from "@/components/paywall/PaywallFlow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUrl } from "@/lib/utils";

// Marca que o OAuth partiu do funil: o /auth/callback lê isso pra devolver o
// usuário NOVO pro paywall do funil (em vez de pular direto pro app).
export const FUNNEL_OAUTH_KEY = "funnel-oauth-pending";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.5-4.6 2.4-7.6 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5c-.5.4 6.9-5 6.9-15.1 0-1.3-.1-2.3-.4-3.5z"/>
  </svg>
);

/**
 * Funil "sem LP" (mobile-first, tráfego frio) — modelo PAGO com paywall:
 *   início → quiz → DEMO no app real (/preview/financas, dados de exemplo)
 *   → cadastro → PAYWALL (assinar) → checkout Cakto → app ativo.
 * Se o lead tenta sair do paywall: roleta → downsell (ofertas limitadas).
 * A demo é o app de verdade: o slide final manda pra /preview/financas?funnel=1,
 * que tem um CTA "Quase lá" voltando pra cá em ?step=signup.
 */

type Step = "start" | "quiz" | "progress" | "result" | "signup" | "offer" | "confirm";

const DEMO_URL = "/preview/financas?funnel=1";

// Funil sempre em tema claro (fundo branco), mesmo se o visitante estiver no dark.
const LIGHT_VARS = {
  "--background": "0 0% 100%",
  "--foreground": "0 0% 15%",
  "--card": "0 0% 100%",
  "--card-foreground": "0 0% 15%",
  "--primary": "0 0% 20%",
  "--primary-foreground": "0 0% 100%",
  "--secondary": "40 20% 96%",
  "--secondary-foreground": "0 0% 15%",
  "--muted": "40 15% 95%",
  "--muted-foreground": "0 0% 45%",
  "--accent": "330 65% 50%",
  "--accent-foreground": "0 0% 100%",
  "--border": "0 0% 90%",
  "--input": "0 0% 90%",
  "--ring": "0 0% 20%",
} as CSSProperties;

const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
};

const slide = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -28 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

const PREP_STEPS = [
  "Identificando seu perfil financeiro",
  "Montando seu painel inicial",
  "Separando os recursos mais importantes",
  "Finalizando seu plano personalizado",
];

const RESULT_ITEMS = [
  "Ver para onde seu dinheiro está indo",
  "Organizar contas e vencimentos",
  "Acompanhar saldo disponível",
  "Criar metas e desejos",
  "Testar um painel financeiro simples no dia a dia",
];

const TrustRow = () => (
  <div className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap text-[11px] text-muted-foreground">
    <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Dados criptografados</span>
    <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Sem cartão agora</span>
    <span className="inline-flex items-center gap-1"><Check className="w-3 h-3" /> Cancele quando quiser</span>
  </div>
);

/* ------------------------------------------------------------------- quiz */

type Opt = { emoji: string; label: string };
type Q = { key: string; q: string; opts: Opt[] };
const QUIZ: Q[] = [
  {
    key: "atrapalha",
    q: "O que mais te atrapalha hoje?",
    opts: [
      { emoji: "💸", label: "Gasto sem perceber" },
      { emoji: "📅", label: "Esqueço contas" },
      { emoji: "🏦", label: "Não consigo guardar dinheiro" },
      { emoji: "🤷", label: "Não sei pra onde meu dinheiro vai" },
      { emoji: "🧹", label: "Quero organizar tudo" },
    ],
  },
  {
    key: "controle",
    q: "Como você controla seu dinheiro hoje?",
    opts: [
      { emoji: "🙈", label: "Não controlo" },
      { emoji: "📝", label: "Bloco de notas" },
      { emoji: "📊", label: "Planilha" },
      { emoji: "🏛️", label: "App de banco" },
      { emoji: "📱", label: "Outro app" },
    ],
  },
  {
    key: "vitoria",
    q: "Qual seria uma vitória nos próximos 7 dias?",
    opts: [
      { emoji: "🔍", label: "Entender meus gastos" },
      { emoji: "✅", label: "Parar de esquecer contas" },
      { emoji: "🎯", label: "Criar minha primeira meta" },
      { emoji: "💰", label: "Saber quanto posso gastar" },
      { emoji: "📋", label: "Organizar tudo em um painel" },
    ],
  },
];

/* ---------------------------------------------------------------- screens */

function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true; // garante autoplay (a property muted do React não é confiável)
    const p = v.play();
    if (p) p.catch(() => {});
  }, []);
  return (
    <video
      ref={ref}
      src="/videos/financas.mp4"
      poster="/videos/financas-poster.jpg"
      muted
      loop
      playsInline
      autoPlay
      preload="auto"
      className="max-w-[250px] max-h-[48vh] w-auto h-auto object-contain block"
    />
  );
}

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto text-center [@media(max-height:520px)]:justify-center">
      {/* Vídeo do app (já vem com a moldura do iPhone). Estilo Cal AI: visual primeiro.
          Em telas baixas (paisagem) o vídeo some pra o CTA caber. */}
      <div className="flex-1 flex items-end justify-center pt-4 pb-5 overflow-hidden [@media(max-height:520px)]:hidden">
        <HeroVideo />
      </div>

      {/* Headline + CTA (fixos embaixo) */}
      <div className="pb-2">
        <h1 className="text-[clamp(32px,9vw,46px)] font-bold leading-[1.04] tracking-tight mb-5">
          Organize sua<br />vida financeira
        </h1>
        <Button onClick={onStart} className="w-full h-14 rounded-full text-base font-semibold">
          Começar
        </Button>
        <p className="text-sm text-muted-foreground mt-4">
          Já tem uma conta? <Link to="/auth" className="font-semibold text-foreground">Entrar</Link>
        </p>
      </div>
    </div>
  );
}

function QuizScreen({ onDone, onBack }: { onDone: (a: Record<string, string>) => void; onBack: () => void }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const q = QUIZ[idx];
  useEffect(() => { trackEvent("funnel_view", { step: `quiz_${idx + 1}` }); }, [idx]);
  const back = () => { if (idx === 0) onBack(); else setIdx((i) => i - 1); };
  const pick = (label: string) => {
    const next = { ...answers, [q.key]: label };
    setAnswers(next);
    trackEvent("funnel_quiz_answer", { q: q.key, answer: label });
    if (idx < QUIZ.length - 1) setIdx((i) => i + 1);
    else onDone(next);
  };
  return (
    <div className="w-full max-w-md mx-auto">
      {/* topo: voltar + progresso */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={back} aria-label="Voltar" className="-ml-1 p-1 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div className="h-full bg-accent rounded-full" initial={false}
            animate={{ width: `${((idx + 1) / QUIZ.length) * 100}%` }} transition={{ duration: 0.35, ease: "easeOut" }} />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}/{QUIZ.length}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={q.key} {...slide}>
          <h2 className="text-[27px] font-bold tracking-tight leading-[1.15] mb-7">{q.q}</h2>
          <div className="space-y-3">
            {q.opts.map((o) => (
              <button
                key={o.label}
                onClick={() => pick(o.label)}
                className="group w-full flex items-center gap-3.5 rounded-2xl border-2 border-border bg-card p-3.5 text-left hover:border-accent hover:bg-accent/[0.04] active:scale-[0.99] transition-all"
              >
                <span className="grid place-items-center w-11 h-11 rounded-xl bg-secondary text-2xl shrink-0">{o.emoji}</span>
                <span className="font-semibold text-[15px] flex-1 leading-snug">{o.label}</span>
                <span className="grid place-items-center w-6 h-6 rounded-full border-2 border-border group-hover:border-accent transition-colors shrink-0">
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ProgressScreen({ onDone }: { onDone: () => void }) {
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (done >= PREP_STEPS.length) {
      const t = setTimeout(onDone, 650);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDone((d) => d + 1), done === 0 ? 500 : 850);
    return () => clearTimeout(t);
  }, [done, onDone]);
  const pct = Math.round((done / PREP_STEPS.length) * 100);
  const C = 2 * Math.PI * 44;
  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <div className="relative w-28 h-28 mx-auto mb-7">
        <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
          <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          <motion.circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--accent))" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={C} initial={false} animate={{ strokeDashoffset: C * (1 - pct / 100) }} transition={{ duration: 0.5, ease: "easeOut" }} />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-2xl font-bold tabular-nums">{pct}%</div>
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-1">Preparando seu plano…</h2>
      <p className="text-muted-foreground text-sm mb-8">Isso leva só alguns segundos.</p>
      <div className="space-y-3 text-left max-w-xs mx-auto">
        {PREP_STEPS.map((s, i) => {
          const state = i < done ? "done" : i === done ? "active" : "pending";
          return (
            <div key={s} className="flex items-center gap-3">
              {state === "done" ? <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                : state === "active" ? <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0" />
                : <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0" />}
              <span className={`text-sm ${state === "pending" ? "text-muted-foreground/60" : "text-foreground"}`}>{s}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResultScreen({ answers, onDone }: { answers: Record<string, string>; onDone: () => void }) {
  // Coloca a "vitória" escolhida em primeiro, pra parecer feito pra ela.
  const items = answers.vitoria
    ? [answers.vitoria, ...RESULT_ITEMS.filter((r) => r !== answers.vitoria)].slice(0, 5)
    : RESULT_ITEMS;
  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="w-16 h-16 rounded-2xl bg-accent/10 text-accent grid place-items-center mx-auto mb-4">
        <Sparkles className="w-8 h-8" />
      </motion.div>
      <div className="text-[11px] font-bold uppercase tracking-widest text-accent mb-2">Análise concluída</div>
      <h2 className="text-[28px] font-bold tracking-tight leading-tight mb-2">Seu plano personalizado<br />está pronto</h2>
      <p className="text-muted-foreground leading-relaxed mb-6">Com o CORE, você vai:</p>
      <Card className="p-4 text-left space-y-3 mb-7">
        {items.map((r, i) => (
          <motion.div key={r} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.08 }}
            className="flex items-start gap-2.5 text-[14px]">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-accent/15 text-accent grid place-items-center shrink-0">
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
            {r}
          </motion.div>
        ))}
      </Card>
      <Button size="lg" className="w-full h-12 text-base" onClick={() => { trackEvent("funnel_click", { cta: "result" }); onDone(); }}>
        Ver meu painel <ArrowRight className="w-4 h-4" />
      </Button>
      <p className="text-xs text-muted-foreground mt-3">Abre o app de verdade, com dados de exemplo</p>
    </div>
  );
}

function SignupScreen({ onSession, onConfirm }: { onSession: () => void; onConfirm: (email: string) => void }) {
  const { signUp } = useAuth();
  const { set: setUserData } = useUserData();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const valid = name.trim() && /\S+@\S+\.\S+/.test(email) && password.length >= 6;

  const handleGoogle = async () => {
    if (loading || googleLoading) return;
    setErr(null);
    setGoogleLoading(true);
    trackEvent("funnel_click", { cta: "signup_google" });
    try { localStorage.setItem(FUNNEL_OAUTH_KEY, "true"); } catch { /* noop */ }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getAuthRedirectUrl("/auth/callback") },
    });
    if (error) {
      try { localStorage.removeItem(FUNNEL_OAUTH_KEY); } catch { /* noop */ }
      setErr(error.message || "Não consegui abrir o Google. Tente de novo.");
      setGoogleLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || loading) return;
    setErr(null);
    setLoading(true);
    trackEvent("funnel_click", { cta: "signup_submit" });
    const { error, session } = await signUp(email.trim().toLowerCase(), password, name.trim());
    if (error) {
      setErr(error.message || "Não consegui criar a conta. Tente outro e-mail.");
      setLoading(false);
      return;
    }
    try { setUserData("user-name", name.trim()); } catch { /* noop */ }
    try { setUserData("force-new-user-tutorial", "true"); localStorage.setItem("force-new-user-tutorial", "true"); } catch { /* noop */ }
    trackEvent("funnel_click", { cta: "signup_success", instant: !!session });
    setLoading(false);
    if (session) onSession();
    else onConfirm(email.trim().toLowerCase());
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="text-center mb-7">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" /> Último passo
        </div>
        <h2 className="text-[26px] font-bold tracking-tight leading-tight">
          Só falta 1 passo pra você<br />começar a usar o CORE.
        </h2>
        <p className="text-muted-foreground text-sm mt-2">Crie sua conta pra destravar seu plano personalizado.</p>
      </div>

      <Button type="button" variant="outline" onClick={handleGoogle} disabled={loading || googleLoading} className="w-full h-12 gap-2 text-[15px] font-semibold">
        {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><GoogleIcon /> Continuar com Google</>}
      </Button>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">ou com e-mail</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        <Input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-12" />
        <Input type="email" placeholder="Seu melhor e-mail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="h-12" />
        <Input type="password" placeholder="Crie uma senha (mín. 6)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="h-12" />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" size="lg" className="w-full h-12 text-base" disabled={!valid || loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Criar conta e continuar <ArrowRight className="w-4 h-4" /></>}
        </Button>
      </form>
      <div className="mt-5"><TrustRow /></div>
    </div>
  );
}

function ConfirmScreen({ email }: { email: string }) {
  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <div className="w-20 h-20 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto mb-5">
        <MailCheck className="w-10 h-10" />
      </div>
      <h2 className="text-[26px] font-bold tracking-tight leading-tight mb-2">Falta 1 clique: confirme<br />seu e-mail.</h2>
      <p className="text-muted-foreground leading-relaxed mb-6">
        Mandamos um link pra <strong className="text-foreground">{email}</strong>. Confirme e <strong>seu plano te espera</strong> do outro lado.
      </p>
      <Button asChild size="lg" className="w-full h-12 text-base">
        <Link to="/auth">Já confirmei — entrar</Link>
      </Button>
      <p className="text-xs text-muted-foreground mt-3">Não chegou? Veja o spam ou aguarde 1 minuto.</p>
    </div>
  );
}

/* ----------------------------------------------------------------- shell */

export default function Comecar() {
  const [params] = useSearchParams();
  // Volta da demo (?step=signup) cai no cadastro; volta do OAuth Google
  // (?step=offer, via /auth/callback) cai direto no paywall.
  // ("trial" é aceito por compat com links antigos.)
  const [step, setStep] = useState<Step>(() => {
    const s = params.get("step");
    return s === "signup" ? "signup" : s === "offer" || s === "trial" ? "offer" : "start";
  });
  const [confirmEmail, setConfirmEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Telemetria do funil: cada tela vista (a "quiz" emite quiz_1/2/3 por dentro
  // e o paywall emite offer/wheel/downsell por conta própria).
  useEffect(() => {
    if (step !== "quiz" && step !== "offer") trackEvent("funnel_view", { step });
  }, [step]);

  // Paywall é full-bleed (tem fundo, padding e CTA sticky próprios)
  if (step === "offer") return <PaywallFlow context="funnel" answers={answers} />;

  return (
    <div style={LIGHT_VARS} className="min-h-dvh bg-white text-foreground flex flex-col">
      <div className={`flex-1 flex flex-col ${step === "start" ? "px-5 pt-3 pb-7" : "items-center justify-center px-5 py-12"}`}>
        <AnimatePresence mode="wait">
          <motion.div key={step} {...fade} className={step === "start" ? "w-full flex-1 flex flex-col" : "w-full"}>
            {step === "start" && <StartScreen onStart={() => { trackEvent("funnel_click", { cta: "start" }); setStep("quiz"); }} />}
            {step === "quiz" && (
              <QuizScreen
                onBack={() => setStep("start")}
                onDone={(a) => {
                  setAnswers(a);
                  // Persiste pro paywall personalizar mesmo após OAuth/refresh
                  try { localStorage.setItem("funnel-quiz-answers", JSON.stringify(a)); } catch { /* noop */ }
                  setStep("progress");
                }}
              />
            )}
            {step === "progress" && <ProgressScreen onDone={() => setStep("result")} />}
            {step === "result" && <ResultScreen answers={answers} onDone={() => { window.location.href = DEMO_URL; }} />}
            {step === "signup" && (
              <SignupScreen
                onSession={() => setStep("offer")}
                onConfirm={(e) => { setConfirmEmail(e); setStep("confirm"); }}
              />
            )}
            {step === "confirm" && <ConfirmScreen email={confirmEmail} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
