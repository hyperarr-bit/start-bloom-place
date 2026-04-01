import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, ArrowRight, ArrowLeft, Check, 
  DollarSign, CalendarCheck, Heart, Dumbbell, Apple, 
  Home, GraduationCap, BookOpen, Droplets, Plane, Briefcase, Rocket
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface OnboardingWizardProps {
  onComplete: () => void;
}

const steps = [
  {
    id: "welcome",
    emoji: "👋",
    title: "Bem-vindo ao CORE",
    subtitle: "Seu hub pessoal de organização de vida",
    description: "O CORE é o app onde você organiza TUDO — finanças, rotina, treino, dieta, estudos, carreira e muito mais. Cada módulo foi feito para você construir do seu jeito.",
    visual: (
      <div className="flex items-center justify-center py-6">
        <motion.div
          className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 flex items-center justify-center"
          animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <span className="text-5xl">🧠</span>
        </motion.div>
      </div>
    ),
  },
  {
    id: "modules",
    emoji: "📦",
    title: "12 Módulos para sua vida",
    subtitle: "Cada um com um propósito claro",
    description: "Não precisa usar todos de uma vez. Comece pelo que faz mais sentido pra você agora.",
    visual: (
      <div className="grid grid-cols-4 gap-2 py-4">
        {[
          { icon: DollarSign, color: "bg-amber-400/20 text-amber-600", label: "Finanças" },
          { icon: Dumbbell, color: "bg-blue-400/20 text-blue-600", label: "Treino" },
          { icon: Apple, color: "bg-green-400/20 text-green-600", label: "Dieta" },
          { icon: CalendarCheck, color: "bg-emerald-400/20 text-emerald-600", label: "Rotina" },
          { icon: Sparkles, color: "bg-purple-400/20 text-purple-600", label: "Dev. Pessoal" },
          { icon: Heart, color: "bg-red-400/20 text-red-600", label: "Saúde" },
          { icon: Home, color: "bg-cyan-400/20 text-cyan-600", label: "Casa" },
          { icon: GraduationCap, color: "bg-indigo-400/20 text-indigo-600", label: "Estudos" },
          { icon: BookOpen, color: "bg-orange-400/20 text-orange-600", label: "Biblioteca" },
          { icon: Droplets, color: "bg-pink-400/20 text-pink-600", label: "Beleza" },
          { icon: Plane, color: "bg-teal-400/20 text-teal-600", label: "Viagens" },
          { icon: Briefcase, color: "bg-slate-400/20 text-slate-600", label: "Carreira" },
        ].map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex flex-col items-center gap-1"
          >
            <div className={`w-10 h-10 rounded-xl ${m.color} flex items-center justify-center`}>
              <m.icon className="w-5 h-5" />
            </div>
            <span className="text-[9px] text-muted-foreground text-center leading-tight">{m.label}</span>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    id: "howto",
    emoji: "✨",
    title: "Tudo começa em branco",
    subtitle: "E isso é intencional",
    description: "Cada módulo vem limpo para você preencher com as suas informações. Ao entrar em qualquer módulo, você vai encontrar orientações de como começar. Apenas adicione seus dados e o app faz o resto.",
    visual: (
      <div className="flex flex-col items-center gap-3 py-4">
        {[
          { step: "1", text: "Escolha um módulo na tela inicial", icon: "👆" },
          { step: "2", text: "Leia as dicas e adicione seus dados", icon: "📝" },
          { step: "3", text: "O app organiza tudo automaticamente", icon: "✅" },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }}
            className="flex items-center gap-3 w-full bg-muted/50 rounded-xl p-3 border border-border"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
              {s.step}
            </div>
            <span className="text-xs flex-1">{s.text}</span>
            <span className="text-lg">{s.icon}</span>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    id: "ready",
    emoji: "🚀",
    title: "Pronto para começar!",
    subtitle: "Sua jornada de organização começa agora",
    description: "Recomendamos começar pelo módulo que mais precisa de atenção na sua vida agora. Pode ser finanças, treino, rotina... você decide!",
    visual: (
      <div className="flex items-center justify-center py-6">
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Rocket className="w-16 h-16 text-primary" />
        </motion.div>
      </div>
    ),
  },
];

export const OnboardingWizard = ({ onComplete }: OnboardingWizardProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  const next = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const prev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl overflow-hidden"
      >
        {/* Progress bar */}
        <div className="flex gap-1 p-3 pb-0">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= currentStep ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="p-6"
          >
            <div className="text-center mb-2">
              <span className="text-3xl">{step.emoji}</span>
            </div>
            <h2 className="text-xl font-bold text-center mb-1">{step.title}</h2>
            <p className="text-sm text-primary font-medium text-center mb-2">{step.subtitle}</p>
            <p className="text-xs text-muted-foreground text-center leading-relaxed">{step.description}</p>

            {step.visual}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="p-4 pt-0 flex items-center justify-between gap-3">
          {currentStep > 0 ? (
            <Button variant="ghost" size="sm" onClick={prev} className="text-xs">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={onComplete} className="text-xs text-muted-foreground">
              Pular
            </Button>
          )}
          
          <Button size="sm" onClick={next} className="text-xs px-6">
            {isLast ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1" /> Começar
              </>
            ) : (
              <>
                Próximo <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};
