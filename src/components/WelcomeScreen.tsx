import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DollarSign, Dumbbell, Heart, BookOpen, Home, Utensils, Brain, Sparkles } from "lucide-react";

interface WelcomeScreenProps {
  onComplete: () => void;
}

const MOCK_SCREENS = [
  {
    title: "Finanças",
    icon: DollarSign,
    color: "hsl(var(--chart-1))",
    items: ["Orçamento mensal", "Despesas fixas", "Metas financeiras"],
  },
  {
    title: "Treino",
    icon: Dumbbell,
    color: "hsl(var(--chart-2))",
    items: ["Treino de hoje", "Histórico", "Evolução"],
  },
  {
    title: "Saúde",
    icon: Heart,
    color: "hsl(var(--chart-3))",
    items: ["Hidratação", "Medicamentos", "Check-up"],
  },
  {
    title: "Rotina",
    icon: Home,
    color: "hsl(var(--chart-4))",
    items: ["Tarefas do dia", "Hábitos", "Lembretes"],
  },
  {
    title: "Estudos",
    icon: BookOpen,
    color: "hsl(var(--chart-5))",
    items: ["Metas de leitura", "Anotações", "Progresso"],
  },
  {
    title: "Dieta",
    icon: Utensils,
    color: "hsl(var(--chart-1))",
    items: ["Calorias do dia", "Refeições", "Macros"],
  },
];

export const WelcomeScreen = ({ onComplete }: WelcomeScreenProps) => {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentScreen((prev) => (prev + 1) % MOCK_SCREENS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowButton(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/10 pointer-events-none" />

      {/* Title */}
      <motion.div
        className="relative z-10 text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Brain className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">CORE</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Organize toda a sua vida em um só lugar
        </p>
      </motion.div>

      {/* iPhone mockup */}
      <motion.div
        className="relative z-10"
        initial={{ opacity: 0, y: 80, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.5 }}
      >
        {/* Phone frame */}
        <div className="relative w-[220px] h-[440px] rounded-[36px] border-[3px] border-foreground/20 bg-card shadow-2xl overflow-hidden">
          {/* Notch / Dynamic Island */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-5 bg-foreground/10 rounded-full z-20" />

          {/* Screen content */}
          <div className="absolute inset-[3px] top-9 bottom-3 rounded-[28px] overflow-hidden bg-background">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentScreen}
                className="absolute inset-0 p-4 flex flex-col"
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -60, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              >
                {/* Mini header */}
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: MOCK_SCREENS[currentScreen].color + "20" }}
                  >
                    {(() => {
                      const Icon = MOCK_SCREENS[currentScreen].icon;
                      return <Icon className="w-4 h-4" style={{ color: MOCK_SCREENS[currentScreen].color }} />;
                    })()}
                  </div>
                  <span className="text-xs font-semibold text-foreground">
                    {MOCK_SCREENS[currentScreen].title}
                  </span>
                </div>

                {/* Mock cards */}
                <div className="space-y-2.5 flex-1">
                  {MOCK_SCREENS[currentScreen].items.map((item, i) => (
                    <motion.div
                      key={item}
                      className="rounded-xl border border-border/50 bg-card p-3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.1 }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: MOCK_SCREENS[currentScreen].color }}
                        />
                        <span className="text-[10px] text-foreground/80">{item}</span>
                      </div>
                      {/* Progress bar mock */}
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: MOCK_SCREENS[currentScreen].color }}
                          initial={{ width: "0%" }}
                          animate={{ width: `${40 + i * 20}%` }}
                          transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Bottom bar mock */}
                <div className="flex justify-around pt-3 border-t border-border/30 mt-auto">
                  {[Home, DollarSign, Heart, Sparkles].map((Icon, i) => (
                    <div key={i} className="w-6 h-6 rounded-lg bg-muted/50 flex items-center justify-center">
                      <Icon className="w-3 h-3 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Home indicator */}
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 bg-foreground/15 rounded-full" />
        </div>
      </motion.div>

      {/* CTA Button */}
      <AnimatePresence>
        {showButton && (
          <motion.button
            onClick={onComplete}
            className="relative z-10 mt-8 px-8 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            whileTap={{ scale: 0.96 }}
          >
            Começar
          </motion.button>
        )}
      </AnimatePresence>

      {/* Dots indicator */}
      <div className="relative z-10 flex gap-1.5 mt-6">
        {MOCK_SCREENS.map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
              i === currentScreen ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    </motion.div>
  );
};
