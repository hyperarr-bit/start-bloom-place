import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Check, Eye, Sparkles, PartyPopper, ShieldCheck,
  Lock, MailCheck, Loader2, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";

/**
 * Funil "sem LP" (mobile-first, tráfego frio):
 *   início → 2 slides (dor → solução) → DEMO no app real (/preview/financas)
 *   → "só falta 1 passo" (cadastro real) → "ganhou 7 dias" → app.
 * A demo é o app de verdade: o slide final manda pra /preview/financas?funnel=1,
 * que tem um CTA "Quase lá" voltando pra cá em ?step=signup.
 */

type Step = "start" | "quiz" | "insight" | "signup" | "trial" | "confirm";

const DEMO_URL = "/preview/financas?funnel=1";

const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
};

const TrustRow = () => (
  <div className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap text-[11px] text-muted-foreground">
    <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Dados criptografados</span>
    <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Sem cartão agora</span>
    <span className="inline-flex items-center gap-1"><Check className="w-3 h-3" /> Cancele quando quiser</span>
  </div>
);

/* ------------------------------------------------------------------- quiz */

type Q = { key: string; q: string; opts: string[] };
const QUIZ: Q[] = [
  { key: "renda", q: "Quanto entra por mês, mais ou menos?", opts: ["Até R$ 2 mil", "R$ 2 a 5 mil", "R$ 5 a 10 mil", "Mais de R$ 10 mil"] },
  { key: "vaza", q: "Pra onde some a maior parte?", opts: ["Comida e delivery", "Contas e boletos", "Compras por impulso", "Sinceramente, não sei"] },
  { key: "dor", q: "Qual o seu maior perrengue hoje?", opts: ["Nunca sobra nada", "Vivo no limite do cartão", "Não consigo poupar", "Esqueço de pagar contas"] },
];

/* ---------------------------------------------------------------- screens */

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center text-center max-w-md mx-auto">
      <div className="font-bold text-xl tracking-tight mb-8">CORE<span className="text-accent">.</span></div>
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-5">
        <Sparkles className="w-3.5 h-3.5" /> Controle do seu dinheiro
      </div>
      <h1 className="text-[clamp(30px,8.5vw,46px)] font-bold leading-[1.06] tracking-tight mb-4 max-w-[15ch]">
        Saiba pra onde vai cada real — e <span className="text-accent">finalmente sobre.</span>
      </h1>
      <p className="text-muted-foreground leading-relaxed mb-9 max-w-xs">
        Em 1 minuto você vê tudo numa tela só. Sem planilha, sem app de banco confuso.
      </p>
      <Button size="lg" className="w-full max-w-xs h-12 text-base" onClick={onStart}>
        Começar agora <ArrowRight className="w-4 h-4" />
      </Button>
      <p className="text-xs text-muted-foreground mt-3 mb-6">7 dias grátis · sem cartão · leva 1 minuto</p>
      <TrustRow />
    </div>
  );
}

function QuizScreen({ onDone }: { onDone: (a: Record<string, string>) => void }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const q = QUIZ[idx];
  const pick = (opt: string) => {
    const next = { ...answers, [q.key]: opt };
    setAnswers(next);
    trackEvent("funnel_quiz_answer", { q: q.key });
    if (idx < QUIZ.length - 1) setIdx(idx + 1);
    else onDone(next);
  };
  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="flex gap-1.5 mb-8 justify-center">
        {QUIZ.map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i <= idx ? "w-6 bg-accent" : "w-1.5 bg-border"}`} />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={q.key} {...fade}>
          <h2 className="text-[26px] font-bold tracking-tight leading-tight text-center mb-7">{q.q}</h2>
          <div className="space-y-2.5">
            {q.opts.map((opt) => (
              <button
                key={opt}
                onClick={() => pick(opt)}
                className="w-full text-left rounded-xl border border-border bg-card hover:border-accent hover:bg-accent/5 transition-colors px-4 py-3.5 text-[15px] font-medium flex items-center justify-between group"
              >
                {opt}
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function InsightScreen({ answers, onDone }: { answers: Record<string, string>; onDone: () => void }) {
  const naoSabe = answers.vaza === "Sinceramente, não sei";
  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-5">
        <Sparkles className="w-8 h-8" />
      </div>
      <h2 className="text-[26px] font-bold tracking-tight leading-tight mb-3">
        {naoSabe ? "Esse é exatamente o problema." : "Já entendi seu caso."}
      </h2>
      <p className="text-muted-foreground leading-relaxed mb-5">
        Quem {(answers.dor || "vive no aperto").toLowerCase()} normalmente perde de vista{" "}
        <strong className="text-foreground">R$ 300–600 por mês</strong> em gastos que parecem pequenos.
        Olha como o CORE coloca isso na sua frente:
      </p>
      <Card className="p-4 text-left space-y-2 mb-7">
        {[["Renda", answers.renda], ["Onde vaza", answers.vaza], ["Maior perrengue", answers.dor]].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-medium text-right">{v || "—"}</span>
          </div>
        ))}
      </Card>
      <Button size="lg" className="w-full h-12 text-base" onClick={() => { trackEvent("funnel_demo_open", {}); onDone(); }}>
        Ver no app, com dados reais <ArrowRight className="w-4 h-4" />
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
  const [err, setErr] = useState<string | null>(null);
  const valid = name.trim() && /\S+@\S+\.\S+/.test(email) && password.length >= 6;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || loading) return;
    setErr(null);
    setLoading(true);
    trackEvent("funnel_signup_submit", {});
    const { error, session } = await signUp(email.trim().toLowerCase(), password, name.trim());
    if (error) {
      setErr(error.message || "Não consegui criar a conta. Tente outro e-mail.");
      setLoading(false);
      return;
    }
    try { setUserData("user-name", name.trim()); } catch { /* noop */ }
    try { setUserData("force-new-user-tutorial", "true"); localStorage.setItem("force-new-user-tutorial", "true"); } catch { /* noop */ }
    trackEvent("funnel_signup_success", { instant: !!session });
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
        <p className="text-muted-foreground text-sm mt-2">Crie sua conta e libere seus 7 dias grátis.</p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <Input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-12" />
        <Input type="email" placeholder="Seu melhor e-mail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="h-12" />
        <Input type="password" placeholder="Crie uma senha (mín. 6)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="h-12" />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" size="lg" className="w-full h-12 text-base" disabled={!valid || loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Criar conta e liberar acesso <ArrowRight className="w-4 h-4" /></>}
        </Button>
      </form>
      <div className="mt-5"><TrustRow /></div>
    </div>
  );
}

function TrialScreen() {
  const navigate = useNavigate();
  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="w-20 h-20 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto mb-5"
      >
        <PartyPopper className="w-10 h-10" />
      </motion.div>
      <h2 className="text-[28px] font-bold tracking-tight leading-tight mb-2">Pronto! Seus 7 dias<br />grátis estão liberados.</h2>
      <p className="text-muted-foreground leading-relaxed mb-6">Acesso completo ao CORE. Sem cartão agora — você só decide se continua no fim.</p>
      <Card className="p-4 text-left space-y-2.5 mb-7">
        {["Tudo o que você viu, agora com os seus números", "Contas a vencer, metas e saúde financeira", "Cancele em 1 clique, sem burocracia"].map((b) => (
          <div key={b} className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 w-4 h-4 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0">
              <Check className="w-2.5 h-2.5" strokeWidth={3} />
            </span>
            {b}
          </div>
        ))}
      </Card>
      <Button
        size="lg"
        className="w-full h-12 text-base"
        onClick={() => { trackEvent("funnel_trial_accept", {}); navigate("/financas"); }}
      >
        Aceitar e começar <ArrowRight className="w-4 h-4" />
      </Button>
      <p className="text-xs text-muted-foreground mt-3 inline-flex items-center gap-1.5 justify-center">
        <ShieldCheck className="w-3.5 h-3.5" /> 7 dias grátis · sem compromisso
      </p>
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
        Mandamos um link pra <strong className="text-foreground">{email}</strong>. Confirme e seus <strong>7 dias grátis</strong> começam na hora.
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
  // Volta da demo (/preview/financas?funnel=1) cai direto no cadastro.
  const [step, setStep] = useState<Step>(params.get("step") === "signup" ? "signup" : "start");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-12">
        <AnimatePresence mode="wait">
          <motion.div key={step} {...fade} className="w-full">
            {step === "start" && <StartScreen onStart={() => { trackEvent("funnel_start", {}); setStep("quiz"); }} />}
            {step === "quiz" && <QuizScreen onDone={(a) => { setAnswers(a); setStep("insight"); }} />}
            {step === "insight" && <InsightScreen answers={answers} onDone={() => { window.location.href = DEMO_URL; }} />}
            {step === "signup" && (
              <SignupScreen
                onSession={() => setStep("trial")}
                onConfirm={(e) => { setConfirmEmail(e); setStep("confirm"); }}
              />
            )}
            {step === "trial" && <TrialScreen />}
            {step === "confirm" && <ConfirmScreen email={confirmEmail} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
