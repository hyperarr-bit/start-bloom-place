import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Wallet, CheckCircle2, Apple, Target, ArrowRight, Loader2, Check,
  Dumbbell, Heart, Brain, GraduationCap, Briefcase, BookOpen, Home as HomeIcon,
  Sparkles, Plane, Users, PawPrint, Smartphone,
} from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent, captureLandingMeta } from "@/lib/analytics";
import coreLogo from "@/assets/core-logo.png";
import coreLogoBlack from "@/assets/core-logo-black.png";
import { TutorialDonePopup } from "@/components/onboarding/TutorialDonePopup";



export type ModuleKey =
  | "financas" | "rotina" | "dieta" | "treino" | "saude" | "metas"
  | "hiperfoco" | "estudos" | "carreira" | "biblioteca" | "casa"
  | "beleza" | "viagens" | "relacionamentos" | "pet" | "detox";

interface QuickStartOnboardingProps {
  onComplete: () => void;
  /** Modules still pending. If undefined, all are considered pending (first-time flow). */
  pendingModules?: ModuleKey[];
  /** Skip the welcome step and go straight to module choice / celebration. */
  skipWelcome?: boolean;
  /** Newly signed-up (already authenticated) user — skip welcome and show tutorial-done popup instead of QuickSignup. */
  forNewUser?: boolean;
}

const OPTIONS: Array<{
  key: ModuleKey;
  route: string;
  label: string;
  benefit: string;
  Icon: typeof Wallet;
  tone: string;
}> = [
  { key: "financas",        route: "/financas",        label: "Finanças",        benefit: "Saiba pra onde seu dinheiro vai",   Icon: Wallet,        tone: "bg-[hsl(var(--chart-1)/0.15)] text-[hsl(var(--chart-1))]" },
  { key: "rotina",          route: "/rotina",          label: "Hábitos",         benefit: "Construa rotina sem culpa",          Icon: CheckCircle2,  tone: "bg-[hsl(var(--chart-2)/0.15)] text-[hsl(var(--chart-2))]" },
  { key: "dieta",           route: "/dieta",           label: "Dieta",           benefit: "Coma sem se perder",                 Icon: Apple,         tone: "bg-[hsl(var(--chart-3)/0.15)] text-[hsl(var(--chart-3))]" },
  { key: "treino",          route: "/treino",          label: "Treino",          benefit: "Treine com plano e progresso",       Icon: Dumbbell,      tone: "bg-[hsl(var(--chart-5)/0.15)] text-[hsl(var(--chart-5))]" },
  { key: "saude",           route: "/saude",           label: "Saúde",           benefit: "Cuide do corpo no dia a dia",        Icon: Heart,         tone: "bg-[hsl(var(--chart-1)/0.15)] text-[hsl(var(--chart-1))]" },
  { key: "metas",           route: "/desenvolvimento", label: "Metas",           benefit: "Defina onde quer chegar",            Icon: Target,        tone: "bg-[hsl(var(--chart-4)/0.15)] text-[hsl(var(--chart-4))]" },
  { key: "hiperfoco",       route: "/hiperfoco",       label: "Hiperfoco",       benefit: "Bloco profundo de produtividade",    Icon: Brain,         tone: "bg-[hsl(var(--chart-2)/0.15)] text-[hsl(var(--chart-2))]" },
  { key: "estudos",         route: "/estudos",         label: "Estudos",         benefit: "Organize matérias e revisões",       Icon: GraduationCap, tone: "bg-[hsl(var(--chart-3)/0.15)] text-[hsl(var(--chart-3))]" },
  { key: "carreira",        route: "/carreira",        label: "Carreira",        benefit: "Evolua na sua trajetória",           Icon: Briefcase,     tone: "bg-[hsl(var(--chart-4)/0.15)] text-[hsl(var(--chart-4))]" },
  { key: "biblioteca",      route: "/biblioteca",      label: "Biblioteca",      benefit: "Leia e guarde o que aprende",        Icon: BookOpen,      tone: "bg-[hsl(var(--chart-5)/0.15)] text-[hsl(var(--chart-5))]" },
  { key: "casa",            route: "/casa",            label: "Casa",            benefit: "Tarefas e contas da casa em ordem",  Icon: HomeIcon,      tone: "bg-[hsl(var(--chart-1)/0.15)] text-[hsl(var(--chart-1))]" },
  { key: "beleza",          route: "/beleza",          label: "Beleza",          benefit: "Cuidado pessoal sem esquecer nada",  Icon: Sparkles,      tone: "bg-[hsl(var(--chart-2)/0.15)] text-[hsl(var(--chart-2))]" },
  { key: "viagens",         route: "/viagens",         label: "Viagens",         benefit: "Planeje cada viagem com calma",      Icon: Plane,         tone: "bg-[hsl(var(--chart-3)/0.15)] text-[hsl(var(--chart-3))]" },
  { key: "relacionamentos", route: "/relacionamentos", label: "Relacionamentos", benefit: "Cuide das pessoas que importam",     Icon: Users,         tone: "bg-[hsl(var(--chart-4)/0.15)] text-[hsl(var(--chart-4))]" },
  { key: "pet",             route: "/pet",             label: "Pet",             benefit: "Rotina e saúde do seu bichinho",     Icon: PawPrint,      tone: "bg-[hsl(var(--chart-5)/0.15)] text-[hsl(var(--chart-5))]" },
  { key: "detox",           route: "/detox",           label: "Detox",           benefit: "Menos tela, mais presença",          Icon: Smartphone,    tone: "bg-[hsl(var(--chart-1)/0.15)] text-[hsl(var(--chart-1))]" },
];

const ALL_KEYS: ModuleKey[] = OPTIONS.map(o => o.key);

export const QuickStartOnboarding = ({ onComplete, pendingModules, skipWelcome, forNewUser }: QuickStartOnboardingProps) => {
  const pending = pendingModules ?? ALL_KEYS;
  const { set, get, isGuest } = useUserData();
  const navigate = useNavigate();

  // Selected modules (persisted). If user já escolheu antes, recupera; senão default = todos.
  const storedSelection = get<ModuleKey[]>("tutorial-selected-modules", []);
  const hasStoredSelection = Array.isArray(storedSelection) && storedSelection.length > 0;
  const [selectedModules, setSelectedModules] = useState<ModuleKey[]>(
    hasStoredSelection ? storedSelection.filter(k => ALL_KEYS.includes(k)) : ALL_KEYS
  );

  const effectiveSelected = hasStoredSelection ? selectedModules : ALL_KEYS;
  const visibleOptions = OPTIONS.filter(o => pending.includes(o.key) && effectiveSelected.includes(o.key));
  const allDone = visibleOptions.length === 0;

  // step: 0 = welcome, 1 = seleção, 2 = picker
  const initialStep: 0 | 1 | 2 = (() => {
    if (allDone) return 2;
    if (hasStoredSelection) return 2; // já escolheu, pula direto pro picker
    if (skipWelcome || forNewUser) return 1;
    return 0;
  })();
  const [step, setStep] = useState<0 | 1 | 2>(initialStep);
  const [transitioning, setTransitioning] = useState(false);
  const [showDonePopup, setShowDonePopup] = useState(false);
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const autoCelebratedRef = useRef(false);
  const pickerViewRef = useRef(false);

  // Funil: dispara para todos (logado ou não) — admin filtra por flag se quiser.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    captureLandingMeta();
    trackEvent("landing_view", { source: "quickstart", is_guest: isGuest });
    trackEvent("pre_signup_tutorial_started", { total_modules: OPTIONS.length, is_guest: isGuest });
  }, [isGuest]);

  // Etapa 3 / 8: dispara quando a página "Por onde você quer começar?" aparece.
  useEffect(() => {
    if (step !== 2 || allDone || pickerViewRef.current) return;
    pickerViewRef.current = true;
    trackEvent("module_picker_view", { pending: visibleOptions.length, is_guest: isGuest });
    if (visibleOptions.length < effectiveSelected.length) {
      trackEvent("quickstart_module_returned", { pending: visibleOptions.length, is_guest: isGuest });
    }
  }, [step, allDone, visibleOptions.length, effectiveSelected.length, isGuest]);

  const handleStartClick = () => {
    trackEvent("start_clicked", { destination: "module_selection", is_guest: isGuest });
    setStep(1);
  };

  const toggleModule = (key: ModuleKey) => {
    setSelectedModules(prev => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // mínimo 1
        return prev.filter(k => k !== key);
      }
      return [...prev, key];
    });
  };

  const handleConfirmSelection = () => {
    if (selectedModules.length === 0) return;
    set("tutorial-selected-modules", selectedModules);
    trackEvent("tutorial_modules_selected", { count: selectedModules.length, modules: selectedModules, is_guest: isGuest });
    setStep(2);
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
    if (step !== 2) return;
    autoCelebratedRef.current = true;
    setTransitioning(true);
    handleCelebrationDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone, step]);


  const handleCelebrationDone = () => {
    set("core-all-modules-celebrated", "true");
    // Marca os módulos NÃO selecionados como "vistos" pra Home não re-abrir o tutorial.
    ALL_KEYS.forEach(k => {
      if (!effectiveSelected.includes(k)) {
        set(`spotlight-done-${k}`, "true");
      }
    });
    if (forNewUser) {
      // Usuário já tem conta — não dispara QuickSignup. Mostra popup de parabéns.
      setTransitioning(false);
      setShowDonePopup(true);
      return;
    }
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

  const handleDonePopupClose = () => {
    setShowDonePopup(false);
    onComplete();
  };



  if (showDonePopup) {
    return <TutorialDonePopup onClose={handleDonePopupClose} />;
  }

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
          {step === 0 ? (
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
          ) : step === 1 ? (
            <motion.div
              key="selection"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4 py-6"
            >
              <div className="space-y-1.5 text-center mb-2">
                <h2 className="text-xl font-bold text-foreground">
                  Vamos começar seu tutorial
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  Escolha os módulos que você quer aprender a usar com calma. A gente te guia passo a passo em cada um.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                {OPTIONS.map((opt, i) => {
                  const checked = selectedModules.includes(opt.key);
                  return (
                    <motion.button
                      key={opt.key}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      onClick={() => toggleModule(opt.key)}
                      className={`group flex items-center gap-3.5 p-3.5 rounded-xl bg-card border transition-all text-left active:scale-[0.99] ${
                        checked ? "border-foreground/60" : "border-border"
                      }`}
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
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                          checked ? "bg-foreground border-foreground" : "border-border"
                        }`}
                      >
                        {checked && <Check className="w-3 h-3 text-background" strokeWidth={3} />}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                {selectedModules.length} de {OPTIONS.length} selecionados
              </p>

              <button
                onClick={handleConfirmSelection}
                disabled={selectedModules.length === 0}
                className="w-full py-3.5 rounded-xl bg-foreground text-background font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:active:scale-100"
              >
                Continuar <ArrowRight className="w-4 h-4" />
              </button>
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
