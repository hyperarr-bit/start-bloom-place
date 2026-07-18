import { motion } from "framer-motion";
import { localDayKey } from "@/lib/utils";
import { useUserData } from "@/hooks/use-user-data";

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export const WeekProgressWidget = () => {
  const { get } = useUserData();

  const getWeekScores = (): number[] => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

    const habits = get<any[]>("core-rotina-habits", []);
    const habitLog = get<any>("core-rotina-habit-log", {});
    const waterLog = get<Record<string, number>>("core-saude-water", {});
    const waterGoal = get<number>("core-saude-water-goal", 8);
    const workoutLog = get<string[]>("saude-workout-log", []);
    const sleepLog = get<Record<string, number>>("core-saude-sleep", {});
    const moodLog = get<Record<string, any>>("core-mood-log", {});

    const todayStr = localDayKey(today);

    return DAYS.map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = localDayKey(d);

      if (dateStr > todayStr) return 0;

      let score = 0;

      // Habits (40pts)
      if (habits.length > 0) {
        const dayHabits = habitLog[dateStr] || {};
        const done = Object.keys(dayHabits).length;
        score += Math.round((done / habits.length) * 40);
      }

      // Water (20pts)
      const water = waterLog[dateStr] || 0;
      score += Math.min(20, Math.round((water / waterGoal) * 20));

      // Workout (20pts)
      if (workoutLog.includes(dateStr)) score += 20;

      // Sleep (10pts)
      if (sleepLog[dateStr]) score += 10;

      // Mood (10pts)
      if (moodLog[dateStr]) score += 10;

      return Math.min(100, score);
    });
  };

  const scores = getWeekScores();

  return (
    <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">📊 Progresso Semanal</h4>
      <div className="flex items-end gap-1.5 h-16">
        {scores.map((score, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <motion.div
              className="w-full rounded-t-md bg-primary/20 relative overflow-hidden"
              style={{ height: `${Math.max((score / 100) * 100, 4)}%` }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
            >
              <div
                className="absolute inset-0 bg-primary rounded-t-md"
                style={{ opacity: score > 0 ? 0.6 + (score / 100) * 0.4 : 0.15 }}
              />
            </motion.div>
            <span className="text-[8px] text-muted-foreground font-medium">{DAYS[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
