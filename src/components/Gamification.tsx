import { useState, useEffect, useRef } from "react";
import { Trophy, Flame, Star, Calendar, CheckCircle, Gift, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUserData } from "@/hooks/use-user-data";
import { Badge } from "./gamification/types";
import { LevelProgress } from "./gamification/LevelProgress";
import { BadgesGrid } from "./gamification/BadgesGrid";
import { UnlockModal } from "./gamification/UnlockModal";

interface GamificationProps {
  savingsRate: number;
  billsPaidRate: number;
  goalsProgress: number;
  totalInvestments: number;
  totalDebts: number;
  streakDays: number;
  setStreakDays: (days: number) => void;
  challenge52Weeks: number[];
  setChallenge52Weeks: (weeks: number[]) => void;
}

export const Gamification = ({
  savingsRate,
  billsPaidRate,
  goalsProgress,
  totalInvestments,
  totalDebts,
  streakDays,
  setStreakDays,
  challenge52Weeks,
  setChallenge52Weeks,
}: GamificationProps) => {
  const { get, set: setUserData } = useUserData();
  const [lastCheckIn, setLastCheckIn] = useState(() => get<string>("finance-lastCheckIn", ""));
  const [celebratingBadge, setCelebratingBadge] = useState<Badge | null>(null);
  const previousUnlocked = useRef<Set<string>>(new Set());

  // All badges — cross-module
  const badges: Badge[] = [
    // Finance
    { id: "first-income", name: "Primeiro Salário", description: "Cadastre sua primeira receita", icon: "💵", category: "finance", unlocked: get("finance-incomes", []).length > 0, color: "text-green-400", xp: 10 },
    { id: "saver", name: "Poupador", description: "Poupar ≥20% da renda", icon: "🐷", category: "finance", unlocked: savingsRate >= 20, color: "text-green-400", xp: 50 },
    { id: "bills", name: "Em Dia", description: "100% das contas pagas", icon: "✅", category: "finance", unlocked: billsPaidRate >= 100, color: "text-blue-400", xp: 30 },
    { id: "investor", name: "Investidor", description: "R$ 1.000+ investidos", icon: "📈", category: "finance", unlocked: totalInvestments >= 1000, color: "text-purple-400", xp: 40 },
    { id: "big-investor", name: "Investidor Pro", description: "R$ 10.000+ investidos", icon: "🚀", category: "finance", unlocked: totalInvestments >= 10000, color: "text-purple-400", xp: 100 },
    { id: "debt-free", name: "Livre de Dívidas", description: "Sem dívidas pendentes", icon: "🔓", category: "finance", unlocked: totalDebts <= 0, color: "text-emerald-400", xp: 80 },
    { id: "goals50", name: "Focado", description: "50% das metas concluídas", icon: "🎯", category: "finance", unlocked: goalsProgress >= 50, color: "text-yellow-400", xp: 60 },
    { id: "goals100", name: "Conquistador", description: "100% das metas concluídas", icon: "🏆", category: "finance", unlocked: goalsProgress >= 100, color: "text-amber-400", xp: 150 },
    { id: "week52-half", name: "Meio Caminho", description: "Metade do desafio 52 semanas", icon: "⭐", category: "finance", unlocked: challenge52Weeks.length >= 26, color: "text-yellow-400", xp: 70 },
    { id: "week52-done", name: "Maratonista", description: "Desafio 52 semanas completo!", icon: "🏅", category: "finance", unlocked: challenge52Weeks.length >= 52, color: "text-amber-400", xp: 200 },

    // Health
    { id: "hydration", name: "Hidratado", description: "Registre água por 7 dias", icon: "💧", category: "health", unlocked: get("health-hydration-streak", 0) >= 7, color: "text-cyan-400", xp: 30 },
    { id: "med-check", name: "Farmácia em Dia", description: "Cadastre seus medicamentos", icon: "💊", category: "health", unlocked: get("health-pharmacy", []).length > 0, color: "text-pink-400", xp: 15 },

    // Habits
    { id: "streak7", name: "Consistente", description: "7 dias seguidos de uso", icon: "🔥", category: "habits", unlocked: streakDays >= 7, color: "text-orange-400", xp: 40 },
    { id: "streak30", name: "Dedicado", description: "30 dias seguidos de uso", icon: "⚡", category: "habits", unlocked: streakDays >= 30, color: "text-red-400", xp: 100 },
    { id: "streak100", name: "Lendário", description: "100 dias seguidos!", icon: "👑", category: "habits", unlocked: streakDays >= 100, color: "text-yellow-400", xp: 300 },

    // General
    { id: "first-checkin", name: "Primeiro Passo", description: "Faça seu primeiro check-in", icon: "👋", category: "general", unlocked: streakDays >= 1, color: "text-blue-400", xp: 5 },
    { id: "explorer", name: "Explorador", description: "Use 3 módulos diferentes", icon: "🧭", category: "general", unlocked: countModulesUsed(get) >= 3, color: "text-teal-400", xp: 25 },
  ];

  const unlockedBadges = badges.filter((b) => b.unlocked);
  const totalXP = unlockedBadges.reduce((sum, b) => sum + b.xp, 0);

  // Detect new unlocks
  useEffect(() => {
    const currentIds = new Set(unlockedBadges.map((b) => b.id));
    const prev = previousUnlocked.current;

    if (prev.size > 0) {
      for (const id of currentIds) {
        if (!prev.has(id)) {
          const badge = badges.find((b) => b.id === id);
          if (badge) {
            setCelebratingBadge(badge);
            break;
          }
        }
      }
    }
    previousUnlocked.current = currentIds;
  }, [unlockedBadges.length]);

  // Daily check-in
  const today = new Date().toISOString().split("T")[0];
  const canCheckIn = lastCheckIn !== today;

  const handleCheckIn = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if (lastCheckIn === yesterdayStr) {
      setStreakDays(streakDays + 1);
    } else if (lastCheckIn !== today) {
      setStreakDays(1);
    }

    setLastCheckIn(today);
    setUserData("finance-lastCheckIn", today);
  };

  // 52-week challenge
  const currentWeek = Math.ceil((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
  const toggleWeek = (week: number) => {
    if (challenge52Weeks.includes(week)) {
      setChallenge52Weeks(challenge52Weeks.filter((w) => w !== week));
    } else {
      setChallenge52Weeks([...challenge52Weeks, week]);
    }
  };

  const challengeTotal = challenge52Weeks.reduce((sum, week) => sum + week, 0);
  const fullChallengeTotal = 1378;

  return (
    <div className="space-y-4">
      {/* Unlock celebration */}
      <UnlockModal badge={celebratingBadge} onClose={() => setCelebratingBadge(null)} />

      {/* Level + XP */}
      <LevelProgress xp={totalXP} />

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-lg border border-border p-4 text-center">
          <Flame className={`w-8 h-8 mx-auto mb-2 ${streakDays > 0 ? "text-orange-400" : "text-muted-foreground"}`} />
          <p className="text-2xl font-bold">{streakDays}</p>
          <p className="text-xs text-muted-foreground">Dias de streak</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 text-center">
          <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
          <p className="text-2xl font-bold">{unlockedBadges.length}/{badges.length}</p>
          <p className="text-xs text-muted-foreground">Conquistas</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 text-center">
          <Gift className="w-8 h-8 mx-auto mb-2 text-purple-400" />
          <p className="text-2xl font-bold">R$ {challengeTotal}</p>
          <p className="text-xs text-muted-foreground">Desafio 52 sem.</p>
        </div>
      </div>

      {/* Daily Check-in */}
      <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-lg border border-orange-500/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${canCheckIn ? "bg-orange-500/20" : "bg-green-500/20"}`}>
              {canCheckIn ? <Calendar className="w-6 h-6 text-orange-400" /> : <CheckCircle className="w-6 h-6 text-green-400" />}
            </div>
            <div>
              <p className="font-bold text-sm">Check-in Diário</p>
              <p className="text-xs text-muted-foreground">
                {canCheckIn ? "Marque presença para manter seu streak!" : "Você já fez check-in hoje! 🔥"}
              </p>
            </div>
          </div>
          {canCheckIn && (
            <Button onClick={handleCheckIn} className="bg-orange-500 hover:bg-orange-600 text-white">
              Check-in
            </Button>
          )}
        </div>
      </div>

      {/* Badges by Category */}
      <BadgesGrid badges={badges} />

      {/* 52 Week Challenge */}
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400" />
            DESAFIO DAS 52 SEMANAS
          </h3>
          <span className="text-xs text-muted-foreground">
            R$ {challengeTotal} de R$ {fullChallengeTotal}
          </span>
        </div>
        <Progress value={(challengeTotal / fullChallengeTotal) * 100} className="h-2 mb-3" />
        <p className="text-xs text-muted-foreground mb-3">
          Semana 1 = R$1, Semana 2 = R$2... Semana 52 = R$52. Clique para marcar:
        </p>
        <div className="grid grid-cols-13 gap-1">
          {Array.from({ length: 52 }, (_, i) => i + 1).map((week) => {
            const isCompleted = challenge52Weeks.includes(week);
            const isCurrent = week === currentWeek;
            return (
              <button
                key={week}
                onClick={() => toggleWeek(week)}
                className={`w-full aspect-square rounded text-[8px] font-medium transition-all ${
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isCurrent
                    ? "bg-yellow-500/30 border border-yellow-500 text-yellow-400"
                    : "bg-muted/50 hover:bg-muted text-muted-foreground"
                }`}
                title={`Semana ${week}: R$ ${week}`}
              >
                {week}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-500" /> Guardado</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-yellow-500/30 border border-yellow-500" /> Atual</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-muted/50" /> Pendente</span>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-lg border border-purple-500/30 p-4">
        <h4 className="text-xs font-bold mb-2">💡 COMO GANHAR MAIS XP</h4>
        <ul className="text-xs space-y-1 text-muted-foreground">
          {badges.filter(b => !b.unlocked).slice(0, 4).map(b => (
            <li key={b.id}>• {b.description} → <span className="text-yellow-400 font-bold">+{b.xp} XP</span></li>
          ))}
          {unlockedBadges.length === badges.length && <li>🎉 Parabéns! Todas as conquistas desbloqueadas!</li>}
        </ul>
      </div>
    </div>
  );
};

function countModulesUsed(get: (key: string, fallback: any) => any): number {
  let count = 0;
  if (get("finance-incomes", []).length > 0 || get("finance-expenses", []).length > 0) count++;
  if (get("health-pharmacy", []).length > 0 || get("health-hydration-streak", 0) > 0) count++;
  if (get("routine-tasks", []).length > 0) count++;
  if (get("diet-meals", []).length > 0) count++;
  if (get("workout-sessions", []).length > 0) count++;
  if (get("study-subjects", []).length > 0) count++;
  return count;
}
