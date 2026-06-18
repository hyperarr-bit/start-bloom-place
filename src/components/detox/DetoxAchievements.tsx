import { motion } from "framer-motion";
import { useUserData } from "@/hooks/use-user-data";
import { Trophy, Lock } from "lucide-react";
import { differenceInDays } from "date-fns";
import { normalizeDetoxHabits, type DetoxHabit } from "./utils";

const milestones = [
  { days: 1, title: "Primeiro Dia", msg: "Toda jornada começa com um passo.", icon: "🌱" },
  { days: 3, title: "3 Dias Limpos", msg: "O mais difícil já passou!", icon: "🌿" },
  { days: 7, title: "1 Semana", msg: "Uma semana inteira. Você é forte.", icon: "💪" },
  { days: 14, title: "2 Semanas", msg: "Seu corpo já sente a diferença.", icon: "⭐" },
  { days: 30, title: "1 Mês", msg: "Um mês! Novo hábito em formação.", icon: "🏅" },
  { days: 60, title: "2 Meses", msg: "Consistência é superpoder.", icon: "🔥" },
  { days: 90, title: "3 Meses", msg: "Você transformou sua vida.", icon: "💎" },
  { days: 180, title: "6 Meses", msg: "Meio ano de liberdade!", icon: "🛡️" },
  { days: 365, title: "1 Ano", msg: "Lendário. Você venceu.", icon: "👑" },
];

export const DetoxAchievements = () => {
  const { get } = useUserData();
  const habits = normalizeDetoxHabits(get<DetoxHabit[]>("detox-habits", []));

  const getStreak = (h: DetoxHabit) => {
    const lastRelapse = h.relapses.length > 0 ? h.relapses[h.relapses.length - 1] : null;
    const from = lastRelapse || h.startDate;
    return differenceInDays(new Date(), new Date(from));
  };

  if (habits.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 text-muted-foreground text-sm mt-3">
        <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-3xl mb-2">🏆</motion.div>
        Adicione hábitos no Rastreador para desbloquear conquistas
      </motion.div>
    );
  }

  return (
    <div className="space-y-4 mt-3">
      {habits.map((h, hi) => {
        const streak = getStreak(h);
        const best = Math.max(h.record, streak);
        const unlockedCount = milestones.filter(m => best >= m.days).length;

        return (
          <motion.div
            key={h.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: hi * 0.1 }}
            className="bg-card rounded-xl border border-border p-3"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold flex items-center gap-2">
                <span>{h.icon}</span> {h.name}
              </p>
              <span className="text-[10px] font-bold text-muted-foreground">
                {unlockedCount}/{milestones.length}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1 rounded-full bg-muted mb-3 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-yellow-400"
                initial={{ width: 0 }}
                animate={{ width: `${(unlockedCount / milestones.length) * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>

            <div className="space-y-1.5">
              {milestones.map((m, mi) => {
                const unlocked = best >= m.days;
                return (
                  <motion.div
                    key={m.days}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: hi * 0.1 + mi * 0.04 }}
                    className={`flex items-center gap-2.5 p-2 rounded-lg transition-all ${
                      unlocked ? "bg-green-500/10" : "bg-muted/20 opacity-40"
                    }`}
                  >
                    <motion.span
                      className="text-base"
                      animate={unlocked ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ repeat: unlocked ? 0 : 0, duration: 0.3 }}
                    >
                      {unlocked ? m.icon : "🔒"}
                    </motion.span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${unlocked ? "" : "text-muted-foreground"}`}>{m.title}</p>
                      <p className="text-[10px] text-muted-foreground">{m.msg}</p>
                    </div>
                    {unlocked && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-[10px] text-green-400 font-bold"
                      >
                        ✓
                      </motion.span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
