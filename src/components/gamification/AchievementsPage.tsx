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
  const streakRaw = get<any>("core-hub-streak", 0);
  const streak = typeof streakRaw === "object" && streakRaw !== null ? (streakRaw.count || 0) : (Number(streakRaw) || 0);
  const habits = get<any[]>("core-rotina-habits", []);
  const allHabitsDone = habits.length > 0 && habits.every((h: any) => h.done);

  // General
  const checkInDone = get<string>("gamification-lastCheckIn", "") === new Date().toISOString().split("T")[0];
  const books = get<any[]>("lib-books", []);
  const booksRead = books.filter((b: any) => b.status === "read" || b.finished).length;

  // Relationships
  const relPeople = get<any[]>("rel-people", []);
  const relMoments = get<any[]>("rel-moments", []);

  // Pet
  const petList = get<any[]>("pet-list", []);
  const petHealth = get<any[]>("pet-health", []);

  // Detox
  const detoxHabits = get<any[]>("detox-habits", []);
  const bestDetoxStreak = detoxHabits.reduce((max: number, h: any) => {
    const lastRelapse = h.relapses?.length > 0 ? h.relapses[h.relapses.length - 1] : null;
    const from = lastRelapse || h.startDate || new Date().toISOString().split("T")[0];
    const streak = Math.floor((Date.now() - new Date(from).getTime()) / 86400000);
    return Math.max(max, Math.max(h.record || 0, streak));
  }, 0);

  // Module visits
  const moduleKeys = ["finance-incomes", "core-rotina-habits", "core-saude-water", "lib-books", "beleza-routines", "casa-rooms", "rel-people", "pet-list", "detox-habits"];
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

    // Relationships
    { id: "rel-people-5", name: "Círculo Íntimo", description: "Cadastre 5+ pessoas", icon: "👥", category: "general", unlocked: relPeople.length >= 5, color: "rose", xp: XP_PER_BADGE },
    { id: "rel-moments-10", name: "Memórias", description: "Registre 10+ momentos", icon: "💕", category: "general", unlocked: relMoments.length >= 10, color: "rose", xp: XP_PER_BADGE },

    // Pet
    { id: "pet-registered", name: "Pai/Mãe de Pet", description: "Cadastre seu primeiro pet", icon: "🐾", category: "general", unlocked: petList.length > 0, color: "amber", xp: XP_PER_BADGE },
    { id: "pet-vaccinated", name: "Pet Vacinado", description: "Registre uma vacina", icon: "💉", category: "general", unlocked: petHealth.length > 0, color: "amber", xp: XP_PER_BADGE },

    // Detox
    { id: "detox-7", name: "7 Dias Puro", description: "7 dias sem recaída", icon: "🌿", category: "general", unlocked: bestDetoxStreak >= 7, color: "lime", xp: XP_PER_BADGE },
    { id: "detox-30", name: "30 Dias Puro", description: "30 dias sem recaída", icon: "🛡️", category: "general", unlocked: bestDetoxStreak >= 30, color: "lime", xp: 100 },

    { id: "master", name: "Mestre", description: "Atinja nível Diamante", icon: "👑", category: "general", unlocked: false, color: "yellow", xp: 200 },
  ];
}

export const AchievementsPage = () => {
  const navigate = useNavigate();
  const { get } = useUserData();
  const [justUnlocked, setJustUnlocked] = useState<Badge | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const lastCheckIn = get<string>("gamification-lastCheckIn", "");
  const checkedInToday = lastCheckIn === today;

  const streakRaw = get<any>("core-hub-streak", 0);
  const streak = typeof streakRaw === "object" && streakRaw !== null ? (streakRaw.count || 0) : (Number(streakRaw) || 0);

  const badges = useMemo(() => buildBadges(get), [get]);

  const totalXP = useMemo(() => {
    return badges.filter(b => b.unlocked).reduce((sum, b) => sum + b.xp, 0);
  }, [badges]);

  const finalBadges = useMemo(() => {
    return badges.map(b => b.id === "master" ? { ...b, unlocked: totalXP >= 2000 } : b);
  }, [badges, totalXP]);

  const unlockedCount = finalBadges.filter(b => b.unlocked).length;

  // Category progress
  const categories = useMemo(() => {
    const cats = [
      { id: "finance", label: "Finanças", icon: "💰" },
      { id: "health", label: "Saúde", icon: "❤️" },
      { id: "habits", label: "Hábitos", icon: "🔥" },
      { id: "general", label: "Geral", icon: "⭐" },
    ];
    return cats.map(cat => {
      const catBadges = finalBadges.filter(b => b.category === cat.id);
      const unlocked = catBadges.filter(b => b.unlocked).length;
      return { ...cat, total: catBadges.length, unlocked };
    });
  }, [finalBadges]);

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
        <LevelProgress xp={totalXP} />

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

        {/* Auto check-in status */}
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`w-4 h-4 ${checkedInToday ? "text-green-400" : "text-muted-foreground"}`} />
            <p className="text-sm font-bold">Check-in Diário</p>
            <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
              checkedInToday
                ? "bg-green-500/20 text-green-400"
                : "bg-muted text-muted-foreground"
            }`}>
              {checkedInToday ? "✓ Feito" : "Pendente"}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 ml-6">
            {checkedInToday ? "Presença registrada automaticamente ao abrir o app ✨" : "Abra o app pela Home para registrar"}
          </p>
        </div>

        {/* Category Progress */}
        <div className="bg-card rounded-lg border border-border p-4">
          <h4 className="text-xs font-bold mb-3 flex items-center gap-2">
            <Award className="w-3.5 h-3.5 text-primary" />
            Progresso por Categoria
          </h4>
          <div className="space-y-3">
            {categories.map(cat => (
              <div key={cat.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <span>{cat.icon}</span>
                    {cat.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-bold">
                    {cat.unlocked}/{cat.total}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${cat.total > 0 ? (cat.unlocked / cat.total) * 100 : 0}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <BadgesGrid badges={finalBadges} />

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
