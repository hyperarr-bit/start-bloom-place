import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Flame, Award, Zap, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useUserData } from "@/hooks/use-user-data";
import { LevelProgress } from "./LevelProgress";
import { BadgesGrid } from "./BadgesGrid";
import { UnlockModal } from "./UnlockModal";
import { Badge } from "./types";

const XP_PER_BADGE = 50;

function buildBadges(get: <T>(key: string, fallback: T) => T): Badge[] {
  // Finance data
  const incomes = get<any[]>("finance-incomes", []);
  const expenses = get<any[]>("finance-expenses", []);
  const investments = get<any[]>("finance-investments", []);
  const installments = get<any[]>("finance-installments", []);
  const dueDays = get<any[]>("finance-dueDays", []);

  const totalIncome = incomes.reduce((s: number, i: any) => s + (i.value || 0), 0);
  const totalExpenses = expenses.reduce((s: number, e: any) => s + (e.value || 0), 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  const totalInvestments = investments.reduce((s: number, i: any) => s + (i.currentValue || 0), 0);
  const allBills = dueDays.flatMap((d: any) => d.bills || []);
  const billsPaid = allBills.length > 0 ? allBills.every((b: any) => b.paid) : false;
  const hasActiveDebt = installments.some((i: any) => (i.paidInstallments || 0) < (i.totalInstallments || 0));

  // Health data
  const waterGlasses = get<number>("core-saude-water", 0);
  const supplements = get<any[]>("core-saude-supplements", []);
  const sleepLog = get<any>("core-saude-sleep", null);
  const workoutLog = get<any[]>("saude-workout-log", []);

  // Habits / streak
  const streak = get<number>("core-hub-streak", 0);
  const habits = get<any[]>("core-rotina-habits", []);
  const allHabitsDone = habits.length > 0 && habits.every((h: any) => h.done);

  // General
  const checkInDone = get<string>("gamification-lastCheckIn", "") === new Date().toISOString().split("T")[0];
  const books = get<any[]>("lib-books", []);
  const booksRead = books.filter((b: any) => b.status === "read" || b.finished).length;

  // Module visits (count keys that exist)
  const moduleKeys = ["finance-incomes", "core-rotina-habits", "core-saude-water", "lib-books", "beleza-routines", "casa-rooms"];
  const modulesUsed = moduleKeys.filter(k => {
    const v = get<any>(k, null);
    return v !== null && (Array.isArray(v) ? v.length > 0 : true);
  }).length;

  return [
    // Finance
    { id: "first-income", name: "Primeiro Salário", description: "Registre sua primeira receita", icon: "💵", category: "finance", unlocked: incomes.length > 0, color: "green", xp: XP_PER_BADGE },
    { id: "saver-20", name: "Poupador", description: "Taxa de poupança ≥ 20%", icon: "🐷", category: "finance", unlocked: savingsRate >= 20, color: "green", xp: XP_PER_BADGE },
    { id: "bills-ok", name: "Contas em Dia", description: "Todas as contas pagas no mês", icon: "✅", category: "finance", unlocked: billsPaid && allBills.length > 0, color: "green", xp: XP_PER_BADGE },
    { id: "investor-1k", name: "Investidor", description: "R$ 1.000+ em investimentos", icon: "📈", category: "finance", unlocked: totalInvestments >= 1000, color: "green", xp: XP_PER_BADGE },
    { id: "investor-10k", name: "Investidor Pro", description: "R$ 10.000+ em investimentos", icon: "🏦", category: "finance", unlocked: totalInvestments >= 10000, color: "green", xp: 100 },
    { id: "debt-free", name: "Livre de Dívidas", description: "Sem parcelas pendentes", icon: "🆓", category: "finance", unlocked: installments.length > 0 && !hasActiveDebt, color: "green", xp: XP_PER_BADGE },

    // Health
    { id: "hydrated", name: "Hidratado", description: "Beba 8+ copos de água hoje", icon: "💧", category: "health", unlocked: waterGlasses >= 8, color: "blue", xp: XP_PER_BADGE },
    { id: "pharmacy-ok", name: "Farmácia em Dia", description: "Cadastre seus suplementos", icon: "💊", category: "health", unlocked: supplements.length > 0, color: "blue", xp: XP_PER_BADGE },
    { id: "workout-done", name: "Treino Completo", description: "Complete um treino", icon: "🏋️", category: "health", unlocked: workoutLog.length > 0, color: "blue", xp: XP_PER_BADGE },
    { id: "sleep-logged", name: "Noite de Sono", description: "Registre seu sono", icon: "😴", category: "health", unlocked: sleepLog !== null, color: "blue", xp: XP_PER_BADGE },

    // Habits
    { id: "streak-7", name: "Streak 7 dias", description: "7 dias consecutivos", icon: "🔥", category: "habits", unlocked: streak >= 7, color: "orange", xp: XP_PER_BADGE },
    { id: "streak-30", name: "Streak 30 dias", description: "30 dias consecutivos", icon: "⚡", category: "habits", unlocked: streak >= 30, color: "orange", xp: 100 },
    { id: "streak-100", name: "Streak 100 dias", description: "100 dias consecutivos!", icon: "💎", category: "habits", unlocked: streak >= 100, color: "orange", xp: 200 },
    { id: "all-habits", name: "100% Hábitos", description: "Complete todos os hábitos do dia", icon: "🎯", category: "habits", unlocked: allHabitsDone, color: "orange", xp: XP_PER_BADGE },

    // General
    { id: "first-checkin", name: "Primeiro Check-in", description: "Faça seu primeiro check-in", icon: "👋", category: "general", unlocked: checkInDone || streak > 0, color: "yellow", xp: XP_PER_BADGE },
    { id: "explorer", name: "Explorador", description: "Use 3+ módulos diferentes", icon: "🧭", category: "general", unlocked: modulesUsed >= 3, color: "yellow", xp: XP_PER_BADGE },
    { id: "reader", name: "Leitor", description: "Termine 1 livro", icon: "📚", category: "general", unlocked: booksRead >= 1, color: "yellow", xp: XP_PER_BADGE },
    { id: "master", name: "Mestre", description: "Atinja nível Diamante", icon: "👑", category: "general", unlocked: false, color: "yellow", xp: 200 }, // computed after XP calc
  ];
}

export const AchievementsPage = () => {
  const navigate = useNavigate();
  const { get, set } = useUserData();
  const [justUnlocked, setJustUnlocked] = useState<Badge | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const lastCheckIn = get<string>("gamification-lastCheckIn", "");
  const checkedInToday = lastCheckIn === today;

  const streakRaw = get<any>("core-hub-streak", 0);
  const streak = typeof streakRaw === "object" && streakRaw !== null ? (streakRaw.count || 0) : (Number(streakRaw) || 0);

  const badges = useMemo(() => buildBadges(get), [get]);

  // Calculate XP
  const totalXP = useMemo(() => {
    return badges.filter(b => b.unlocked).reduce((sum, b) => sum + b.xp, 0);
  }, [badges]);

  // Fix master badge based on XP
  const finalBadges = useMemo(() => {
    return badges.map(b => b.id === "master" ? { ...b, unlocked: totalXP >= 2000 } : b);
  }, [badges, totalXP]);

  const unlockedCount = finalBadges.filter(b => b.unlocked).length;

  const handleCheckIn = () => {
    if (checkedInToday) return;

    // Check if yesterday was checked in to maintain streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const newStreak = lastCheckIn === yesterdayStr ? streak + 1 : 1;

    set("gamification-lastCheckIn", today);
    set("core-hub-streak", { count: newStreak, lastDate: today });
  };

  // Next badges to unlock
  const nextBadges = finalBadges.filter(b => !b.unlocked).slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="hover:bg-muted rounded-md p-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold tracking-tight">CONQUISTAS</h1>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Level Progress */}
        <LevelProgress xp={totalXP} />

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card rounded-lg border border-border p-3 text-center">
            <Flame className="w-4 h-4 mx-auto mb-1 text-orange-400" />
            <p className="text-lg font-bold">{streak}</p>
            <p className="text-[10px] text-muted-foreground">Dias seguidos</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-3 text-center">
            <Award className="w-4 h-4 mx-auto mb-1 text-yellow-400" />
            <p className="text-lg font-bold">{unlockedCount}/{finalBadges.length}</p>
            <p className="text-[10px] text-muted-foreground">Conquistas</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-3 text-center">
            <Zap className="w-4 h-4 mx-auto mb-1 text-purple-400" />
            <p className="text-lg font-bold">{totalXP}</p>
            <p className="text-[10px] text-muted-foreground">XP total</p>
          </div>
        </div>

        {/* Daily Check-in */}
        <motion.div
          className="bg-card rounded-lg border border-border p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 ${checkedInToday ? "text-green-400" : "text-muted-foreground"}`} />
                Check-in Diário
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {checkedInToday ? "Feito hoje! Volte amanhã ✨" : "Marque presença e mantenha seu streak"}
              </p>
            </div>
            <button
              onClick={handleCheckIn}
              disabled={checkedInToday}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                checkedInToday
                  ? "bg-green-500/20 text-green-400 cursor-default"
                  : "bg-primary text-primary-foreground hover:opacity-90 active:scale-95"
              }`}
            >
              {checkedInToday ? "✓ Feito" : "Check-in"}
            </button>
          </div>
        </motion.div>

        {/* Badges Grid */}
        <BadgesGrid badges={finalBadges} />

        {/* Next to unlock */}
        {nextBadges.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-4">
            <h4 className="text-xs font-bold mb-3 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              Próximas conquistas
            </h4>
            <div className="space-y-2">
              {nextBadges.map(badge => (
                <div key={badge.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <span className="text-lg opacity-40">{badge.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold">{badge.name}</p>
                    <p className="text-[10px] text-muted-foreground">{badge.description}</p>
                  </div>
                  <span className="text-[10px] font-bold text-yellow-400/60">+{badge.xp} XP</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {justUnlocked && (
        <UnlockModal badge={justUnlocked} onClose={() => setJustUnlocked(null)} />
      )}
    </div>
  );
};
