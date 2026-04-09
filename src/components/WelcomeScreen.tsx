import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign, Dumbbell, Heart, Home, Utensils, Brain,
  Sun, CheckCircle2, TrendingUp, Droplets, BookOpen, Star,
} from "lucide-react";

interface WelcomeScreenProps {
  onComplete: () => void;
  onLogin: () => void;
}

/* ---------- mock screens that mimic the real CORE app ---------- */

const HomeScreen = () => (
  <div className="flex flex-col h-full p-3 gap-2.5">
    {/* Greeting */}
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
        <Sun className="w-3.5 h-3.5 text-primary" />
      </div>
      <div>
        <p className="text-[9px] font-semibold text-foreground">Bom dia, João</p>
        <p className="text-[7px] text-muted-foreground">Vamos conquistar o dia! 🚀</p>
      </div>
    </div>
    {/* Score ring placeholder */}
    <div className="flex items-center justify-center py-2">
      <div className="w-16 h-16 rounded-full border-[3px] border-primary/30 flex items-center justify-center relative">
        <svg className="absolute inset-0 w-full h-full -rotate-90">
          <circle cx="32" cy="32" r="29" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeDasharray="182" strokeDashoffset="55" strokeLinecap="round" />
        </svg>
        <span className="text-[11px] font-bold text-foreground">72%</span>
      </div>
    </div>
    {/* Widget cards */}
    {[
      { icon: DollarSign, label: "Finanças", value: "R$ 1.240", color: "hsl(var(--chart-1))" },
      { icon: Dumbbell, label: "Treino", value: "Peito & Tríceps", color: "hsl(var(--chart-2))" },
      { icon: Droplets, label: "Hidratação", value: "1.8L / 3L", color: "hsl(var(--chart-3))" },
    ].map((w, i) => (
      <motion.div
        key={w.label}
        className="rounded-xl border border-border/50 bg-card p-2.5 flex items-center gap-2"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15 + i * 0.12 }}
      >
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: w.color + "20" }}>
          <w.icon className="w-3 h-3" style={{ color: w.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[8px] text-muted-foreground">{w.label}</p>
          <p className="text-[9px] font-semibold text-foreground truncate">{w.value}</p>
        </div>
      </motion.div>
    ))}
  </div>
);

const FinanceScreen = () => (
  <div className="flex flex-col h-full p-3 gap-2">
    <div className="flex items-center gap-2 mb-1">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "hsl(var(--chart-1) / .15)" }}>
        <DollarSign className="w-3.5 h-3.5" style={{ color: "hsl(var(--chart-1))" }} />
      </div>
      <span className="text-[10px] font-semibold text-foreground">Finanças</span>
    </div>
    {/* Summary cards */}
    <div className="grid grid-cols-2 gap-1.5">
      {[
        { label: "Receitas", value: "R$ 5.200", positive: true },
        { label: "Despesas", value: "R$ 3.960", positive: false },
        { label: "Saldo", value: "R$ 1.240", positive: true },
        { label: "Investido", value: "R$ 800", positive: true },
      ].map((c) => (
        <div key={c.label} className="rounded-lg border border-border/40 bg-card p-2">
          <p className="text-[7px] text-muted-foreground">{c.label}</p>
          <p className={`text-[9px] font-bold ${c.positive ? "text-emerald-500" : "text-red-400"}`}>{c.value}</p>
        </div>
      ))}
    </div>
    {/* Mini bar chart */}
    <div className="flex-1 flex items-end gap-1 pt-2 px-1">
      {[60, 45, 80, 35, 70, 55, 90].map((h, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-t-sm"
          style={{ backgroundColor: "hsl(var(--chart-1))", opacity: 0.6 + (i % 2) * 0.3 }}
          initial={{ height: 0 }}
          animate={{ height: `${h}%` }}
          transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }}
        />
      ))}
    </div>
    <div className="flex justify-between px-1">
      {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
        <span key={i} className="text-[6px] text-muted-foreground flex-1 text-center">{d}</span>
      ))}
    </div>
  </div>
);

const HealthScreen = () => (
  <div className="flex flex-col h-full p-3 gap-2">
    <div className="flex items-center gap-2 mb-1">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "hsl(var(--chart-3) / .15)" }}>
        <Heart className="w-3.5 h-3.5" style={{ color: "hsl(var(--chart-3))" }} />
      </div>
      <span className="text-[10px] font-semibold text-foreground">Saúde</span>
    </div>
    {/* Health items */}
    {[
      { label: "Hidratação", value: "1.8L / 3L", pct: 60 },
      { label: "Sono", value: "7h 20min", pct: 85 },
      { label: "Medicamentos", value: "2 de 3 tomados", pct: 66 },
      { label: "Check-up", value: "Em dia ✓", pct: 100 },
    ].map((item, i) => (
      <motion.div
        key={item.label}
        className="rounded-lg border border-border/40 bg-card p-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 + i * 0.1 }}
      >
        <div className="flex justify-between items-center mb-1">
          <span className="text-[8px] text-foreground/80">{item.label}</span>
          <span className="text-[7px] text-muted-foreground">{item.value}</span>
        </div>
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: "hsl(var(--chart-3))" }}
            initial={{ width: "0%" }}
            animate={{ width: `${item.pct}%` }}
            transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
          />
        </div>
      </motion.div>
    ))}
  </div>
);

const HabitsScreen = () => (
  <div className="flex flex-col h-full p-3 gap-2">
    <div className="flex items-center gap-2 mb-1">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "hsl(var(--chart-4) / .15)" }}>
        <Star className="w-3.5 h-3.5" style={{ color: "hsl(var(--chart-4))" }} />
      </div>
      <span className="text-[10px] font-semibold text-foreground">Rotina</span>
    </div>
    {[
      { label: "Meditar 10min", done: true },
      { label: "Ler 20 páginas", done: true },
      { label: "Treinar", done: false },
      { label: "Beber 3L água", done: false },
      { label: "Estudar 1h", done: false },
    ].map((habit, i) => (
      <motion.div
        key={habit.label}
        className="flex items-center gap-2 rounded-lg border border-border/40 bg-card p-2"
        initial={{ opacity: 0, x: -15 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15 + i * 0.08 }}
      >
        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${habit.done ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
          {habit.done && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
        </div>
        <span className={`text-[8px] flex-1 ${habit.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {habit.label}
        </span>
        {habit.done && <span className="text-[7px] text-primary">✓</span>}
      </motion.div>
    ))}
  </div>
);

const SCREENS = [
  { id: "home", component: HomeScreen },
  { id: "finance", component: FinanceScreen },
  { id: "health", component: HealthScreen },
  { id: "habits", component: HabitsScreen },
];

export const WelcomeScreen = ({ onComplete, onLogin }: WelcomeScreenProps) => {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentScreen((prev) => (prev + 1) % SCREENS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowButton(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const CurrentComponent = SCREENS[currentScreen].component;

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/10 pointer-events-none" />

      {/* Logo — text only */}
      <motion.div
        className="relative z-10 text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <h1 className="text-3xl font-bold text-foreground tracking-[0.2em]">CORE</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Organize toda a sua vida em um só lugar
        </p>
      </motion.div>

      {/* iPhone 15 frame */}
      <motion.div
        className="relative z-10"
        initial={{ opacity: 0, y: 80, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.5 }}
      >
        <div className="relative w-[240px] h-[490px] rounded-[44px] bg-[#1a1a1a] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.5)] p-[10px]">
          {/* Dynamic Island */}
          <div className="absolute top-[18px] left-1/2 -translate-x-1/2 w-[90px] h-[28px] bg-black rounded-full z-20" />

          {/* Screen */}
          <div className="w-full h-full rounded-[34px] overflow-hidden bg-background">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentScreen}
                className="absolute inset-0 pt-12"
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -40, opacity: 0 }}
                transition={{ duration: 0.45, ease: "easeInOut" }}
              >
                <CurrentComponent />
              </motion.div>
            </AnimatePresence>

            {/* Bottom nav bar */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-around py-2 px-3 border-t border-border/30 bg-background/80 backdrop-blur-sm">
              {[Home, DollarSign, Heart, BookOpen].map((Icon, i) => (
                <div
                  key={i}
                  className={`w-6 h-6 rounded-lg flex items-center justify-center ${i === currentScreen ? "bg-primary/15" : ""}`}
                >
                  <Icon className={`w-3 h-3 ${i === currentScreen ? "text-primary" : "text-muted-foreground"}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Home Indicator */}
          <div className="absolute bottom-[8px] left-1/2 -translate-x-1/2 w-[100px] h-[4px] bg-white/20 rounded-full" />
        </div>
      </motion.div>

      {/* Dots */}
      <div className="relative z-10 flex gap-1.5 mt-5">
        {SCREENS.map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${i === currentScreen ? "bg-primary" : "bg-muted-foreground/30"}`}
          />
        ))}
      </div>

      {/* CTA + Login */}
      <AnimatePresence>
        {showButton && (
          <motion.div
            className="relative z-10 mt-5 flex flex-col items-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <motion.button
              onClick={onComplete}
              className="px-8 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg"
              whileTap={{ scale: 0.96 }}
            >
              Começar
            </motion.button>
            <button
              onClick={onLogin}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Já tem uma conta? <span className="font-medium text-foreground">Entrar</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
