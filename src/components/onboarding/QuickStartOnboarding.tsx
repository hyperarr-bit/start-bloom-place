import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Wallet, CheckCircle2, Apple, Dumbbell, ArrowRight, Sparkles, Loader2, User, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import coreLogo from "@/assets/core-logo.png";
import coreLogoBlack from "@/assets/core-logo-black.png";

export type ModuleKey = "financas" | "rotina" | "dieta" | "treino";

interface QuickStartOnboardingProps {
  onComplete: () => void;
  /** Modules still pending. If undefined, all 4 are considered pending (first-time flow). */
  pendingModules?: ModuleKey[];
  /** Skip the welcome step and go straight to module choice / celebration. */
  skipWelcome?: boolean;
}

const OPTIONS: Array<{
  key: ModuleKey;
  route: string;
  label: string;
  benefit: string;
  Icon: typeof Wallet;
  tone: string;
}> = [
  { key: "financas", route: "/financas", label: "Finanças", benefit: "Saiba pra onde seu dinheiro vai", Icon: Wallet, tone: "bg-[hsl(var(--chart-1)/0.15)] text-[hsl(var(--chart-1))]" },
  { key: "rotina", route: "/rotina", label: "Hábitos", benefit: "Construa rotina sem culpa", Icon: CheckCircle2, tone: "bg-[hsl(var(--chart-2)/0.15)] text-[hsl(var(--chart-2))]" },
  { key: "dieta", route: "/dieta", label: "Dieta", benefit: "Coma sem se perder", Icon: Apple, tone: "bg-[hsl(var(--chart-3)/0.15)] text-[hsl(var(--chart-3))]" },
  { key: "treino", route: "/treino", label: "Treino", benefit: "Não falte mais", Icon: Dumbbell, tone: "bg-[hsl(var(--chart-4)/0.15)] text-[hsl(var(--chart-4))]" },
];

export const QuickStartOnboarding = ({ onComplete, pendingModules, skipWelcome }: QuickStartOnboardingProps) => {
  const pending = pendingModules ?? OPTIONS.map(o => o.key);
  const allDone = pending.length === 0;
  const visibleOptions = OPTIONS.filter(o => pending.includes(o.key));

  const [step, setStep] = useState<0 | 1>(skipWelcome || allDone ? 1 : 0);
  const { set, isGuest } = useUserData();
  const { signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [showSignup, setShowSignup] = useState(false);
  const [signupStep, setSignupStep] = useState<0 | 1 | 2>(0); // 0=name, 1=email, 2=password
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handlePick = (opt: (typeof OPTIONS)[number]) => {
    set("quickstart-target-module", opt.key);
    trackEvent("quickstart_module_chosen", { module: opt.key });
    set("core-onboarding-done", "true");
    onComplete();
    setTimeout(() => navigate(opt.route), 50);
  };

  const handleCelebrationDone = () => {
    if (isGuest) {
      // IMPORTANT: do NOT mark "core-all-modules-celebrated" here — Home.tsx
      // would unmount the overlay before the signup form can render. Mark it
      // only after the signup completes (or for non-guest users).
      setShowSignup(true);
    } else {
      set("core-all-modules-celebrated", "true");
      onComplete();
    }
  };

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  const isStrongPassword = (v: string) =>
    v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v);

  const handleNextStep = () => {
    if (signupStep === 0) {
      if (!name.trim()) {
        toast({ title: "Digite seu nome", variant: "destructive" });
        return;
      }
      setSignupStep(1);
    } else if (signupStep === 1) {
      if (!isValidEmail(email)) {
        toast({ title: "E-mail inválido", description: "Confira o endereço.", variant: "destructive" });
        return;
      }
      setSignupStep(2);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupStep !== 2) {
      handleNextStep();
      return;
    }
    if (!isStrongPassword(password)) {
      toast({ title: "Senha fraca", description: "Mínimo 8 caracteres, com letras e números.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error, data } = await signUp(email.trim(), password);
    if (error) {
      toast({ title: "Erro ao criar conta", description: error.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }
    set("core-user-name", name.trim());
    set("core-all-modules-celebrated", "true");
    trackEvent("signup_completed_after_tutorial", {});
    if (data?.session) {
      onComplete();
      setTimeout(() => navigate("/"), 50);
    } else {
      onComplete();
      setTimeout(() => navigate("/auth?signup=1&fromTutorial=1"), 50);
    }
  };


  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-5"
      style={{
        paddingTop: "max(1.25rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="w-full max-w-md flex flex-col">
        <AnimatePresence mode="wait">
          {step === 0 && !allDone ? (
            <motion.div
              key="promise"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center text-center gap-6 py-12"
            >
              <img
                src={coreLogoBlack}
                alt="CORE"
                className="w-28 h-16 object-contain dark:hidden"
              />
              <img
                src={coreLogo}
                alt="CORE"
                className="w-28 h-16 object-contain hidden dark:block"
              />
              <div className="space-y-3">
                <h1 className="text-2xl font-bold leading-tight text-foreground">
                  Organize sua vida
                  <br />
                  em 1 só lugar
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  Em poucos minutos, configuramos tudo para você começar a evoluir hoje.
                </p>
              </div>
              <button
                onClick={() => setStep(1)}
                className="mt-4 w-full max-w-[240px] py-3.5 rounded-xl bg-foreground text-background font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                Quero começar <ArrowRight className="w-4 h-4" />
              </button>
              {isGuest && (
                <button
                  onClick={() => navigate("/auth")}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Já tem conta? <span className="font-medium text-foreground">Entrar</span>
                </button>
              )}
            </motion.div>
          ) : allDone && showSignup ? (
            <motion.form
              key="signup"
              onSubmit={handleSignupSubmit}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-5 py-8"
            >
              <div className="text-center space-y-2">
                <div className="text-4xl">🎉</div>
                <h1 className="text-xl font-bold leading-tight text-foreground">
                  Vamos terminar de configurar sua conta
                </h1>
                <p className="text-xs text-muted-foreground">
                  Tudo que você fez no tutorial será salvo automaticamente.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="given-name"
                    required
                    className="w-full h-11 pl-10 pr-3 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40"
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="Seu e-mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    className="w-full h-11 pl-10 pr-3 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Crie uma senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="w-full h-11 pl-10 pr-10 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground px-1">
                  Mínimo 8 caracteres, com letras e números.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-foreground text-background font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>Criar conta e começar <ArrowRight className="w-4 h-4" /></>)}
              </button>
            </motion.form>
          ) : allDone ? (
            <motion.div
              key="celebration"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center text-center gap-6 py-12"
            >
              <motion.div
                initial={{ rotate: -10, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center"
              >
                <Sparkles className="w-10 h-10 text-primary" />
              </motion.div>
              <div className="space-y-3">
                <h1 className="text-2xl font-bold leading-tight text-foreground">
                  Parabéns! 🎉
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {isGuest
                    ? "Você terminou o tutorial e liberou todos os 16 módulos."
                    : "Você concluiu o tutorial e liberou todos os 16 módulos."}
                </p>
              </div>
              <button
                onClick={handleCelebrationDone}
                className="mt-4 w-full max-w-[240px] py-3.5 rounded-xl bg-foreground text-background font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                {isGuest ? "Configurar minha conta" : "Bora usar"} <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="choice"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4 py-6"
            >
              <div className="space-y-1.5 text-center mb-2">
                <h2 className="text-xl font-bold text-foreground">
                  {visibleOptions.length === OPTIONS.length
                    ? "Por onde você quer começar?"
                    : "Falta configurar:"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {visibleOptions.length === OPTIONS.length
                    ? "Escolhe 1. Os outros ficam aqui esperando."
                    : `Escolhe o próximo. Faltam ${visibleOptions.length} de ${OPTIONS.length}.`}
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                {visibleOptions.map((opt, i) => (
                  <motion.button
                    key={opt.key}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    onClick={() => handlePick(opt)}
                    className="group flex items-center gap-3.5 p-3.5 rounded-xl bg-card border border-border hover:border-foreground/30 active:scale-[0.99] transition-all text-left"
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${opt.tone}`}>
                      <opt.Icon className="w-5 h-5" strokeWidth={2.2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                      <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                        {opt.benefit}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
