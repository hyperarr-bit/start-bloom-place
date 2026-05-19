import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Dumbbell, UtensilsCrossed, CalendarDays, ChevronRight, ArrowLeft } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

interface Slide {
  key: string;
  icon: typeof Wallet;
  title: string;
  subtitle: string;
  bullets: string[];
  gradient: string;
}

const SLIDES: Slide[] = [
  {
    key: "financas",
    icon: Wallet,
    title: "Finanças",
    subtitle: "Sua vida financeira em ordem",
    bullets: [
      "Controle gastos e receitas",
      "Metas, investimentos e dívidas",
      "Relatórios mensais automáticos",
    ],
    gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent",
  },
  {
    key: "treino",
    icon: Dumbbell,
    title: "Treino",
    subtitle: "Sua rotina física no controle",
    bullets: [
      "Planilhas e cargas por exercício",
      "Histórico e evolução corporal",
      "Cronômetro de descanso integrado",
    ],
    gradient: "from-orange-500/20 via-orange-500/5 to-transparent",
  },
  {
    key: "dieta",
    icon: UtensilsCrossed,
    title: "Dieta",
    subtitle: "Alimentação organizada",
    bullets: [
      "Cardápio e receitas favoritas",
      "Controle de jejum intermitente",
      "Diário alimentar com macros",
    ],
    gradient: "from-rose-500/20 via-rose-500/5 to-transparent",
  },
  {
    key: "rotina",
    icon: CalendarDays,
    title: "Rotina",
    subtitle: "Seus dias bem planejados",
    bullets: [
      "Hábitos diários com streaks",
      "Agenda integrada por hora",
      "Lembretes e check-in noturno",
    ],
    gradient: "from-violet-500/20 via-violet-500/5 to-transparent",
  },
];

interface PreSignupTutorialProps {
  onClose: () => void;
}

export const PreSignupTutorial = ({ onClose }: PreSignupTutorialProps) => {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    trackEvent("pre_signup_tutorial_started", { total_slides: SLIDES.length });
  }, []);

  useEffect(() => {
    trackEvent("pre_signup_tutorial_step", { step: idx + 1, slide: SLIDES[idx].key });
  }, [idx]);

  const next = () => {
    if (idx < SLIDES.length - 1) {
      setIdx(idx + 1);
    } else {
      trackEvent("pre_signup_tutorial_completed", {});
      navigate("/auth?signup=1");
    }
  };

  const back = () => {
    if (idx === 0) {
      onClose();
    } else {
      setIdx(idx - 1);
    }
  };

  const slide = SLIDES[idx];
  const Icon = slide.icon;
  const isLast = idx === SLIDES.length - 1;

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col bg-background"
      style={{
        minHeight: "100dvh",
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
      }}
    >
      {/* Top bar */}
      <div className="px-5 pt-2 pb-4 flex items-center justify-between">
        <button
          onClick={back}
          className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-1.5">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === idx ? "w-6 bg-foreground" : i < idx ? "w-1.5 bg-foreground/60" : "w-1.5 bg-foreground/15"
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => {
            trackEvent("pre_signup_tutorial_skipped", { at_step: idx + 1 });
            navigate("/auth?signup=1");
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
        >
          Pular
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.key}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-sm flex flex-col items-center gap-7"
          >
            <div className={`relative w-28 h-28 rounded-3xl bg-gradient-to-br ${slide.gradient} flex items-center justify-center border border-foreground/10`}>
              <Icon className="w-12 h-12 text-foreground" strokeWidth={1.5} />
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold text-foreground tracking-tight">{slide.title}</h2>
              <p className="text-sm text-muted-foreground">{slide.subtitle}</p>
            </div>

            <ul className="w-full space-y-2.5">
              {slide.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-foreground/85">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-foreground/40 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* CTA */}
      <div className="px-6 pt-4 w-full max-w-sm mx-auto">
        <button
          onClick={next}
          className="w-full py-3.5 rounded-xl bg-foreground text-background text-base font-semibold shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          {isLast ? "Criar minha conta" : "Continuar"}
          <ChevronRight className="w-4 h-4" />
        </button>
        <p className="text-center text-[11px] text-muted-foreground mt-3">
          {idx + 1} de {SLIDES.length}
        </p>
      </div>
    </div>
  );
};
