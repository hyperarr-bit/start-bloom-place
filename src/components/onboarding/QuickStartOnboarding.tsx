import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Wallet, CheckCircle2, Apple, Dumbbell, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent, captureLandingMeta } from "@/lib/analytics";
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
  const [transitioning, setTransitioning] = useState(false);
  const { set, get, isGuest } = useUserData();
  const navigate = useNavigate();
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const autoCelebratedRef = useRef(false);

  // Funil: dispara para todos (logado ou não) — admin filtra por flag se quiser.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    captureLandingMeta();
    trackEvent("landing_view", { source: "quickstart", is_guest: isGuest });
    trackEvent("pre_signup_tutorial_started", { total_modules: OPTIONS.length, is_guest: isGuest });
  }, [isGuest]);

  const handleStartClick = () => {
    trackEvent("start_clicked", { destination: "module_choice", is_guest: isGuest });
    setStep(1);
  };

  const handlePick = (opt: (typeof OPTIONS)[number]) => {
    set("quickstart-target-module", opt.key);
    trackEvent("quickstart_module_chosen", { module: opt.key, is_guest: isGuest });
    if (!completedRef.current) {
      completedRef.current = true;
      trackEvent("pre_signup_tutorial_completed", { module: opt.key, is_guest: isGuest });
    }
    set("core-onboarding-done", "true");
    setTransitioning(true);
    navigate(opt.route);
  };

  useEffect(() => {
    if (!allDone || autoCelebratedRef.current) return;
    autoCelebratedRef.current = true;
    setTransitioning(true);
    handleCelebrationDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);


  const handleCelebrationDone = () => {
    set("core-all-modules-celebrated", "true");
    if (isGuest) {
      // Trigger global QuickSignupModal — usuário cai no app, modal aparece por cima.
      trackEvent("quicksignup_step_shown", {});
      set("quicksignup-pending", "true");
      const targetKey = get<string>("quickstart-target-module", "");
      const target = OPTIONS.find(o => o.key === targetKey);
      const route = target?.route ?? "/";
      onComplete();
      setTimeout(() => navigate(route), 50);
    } else {
      onComplete();
    }
  };



  return (
    <div
      className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-5 overflow-y-auto"
      style={{
        minHeight: "100dvh",
        paddingTop: "max(1.25rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1.25rem, env(safe-area-inset-left))",
        paddingRight: "max(1.25rem, env(safe-area-inset-right))",
      }}
    >
      {transitioning ? (
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      ) : (
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
                onClick={handleStartClick}
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
          ) : allDone ? null : (
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
                  Por onde você quer começar?
                </h2>
                <p className="text-xs text-muted-foreground">
                  Escolhe 1. Os outros ficam aqui esperando.
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
      )}
    </div>
  );
};
