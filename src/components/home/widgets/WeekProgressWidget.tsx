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

    /* CHAVES REAIS (13/09). Este widget lia core-rotina-habits, core-rotina-
       habit-log e core-mood-log — chaves que módulo nenhum grava — e sono só
       da Saúde. Resultado: hábitos e humor sempre zero, a semana inteira
       parecia fraca. Agora lê o que a Rotina escreve (rotina-habits +
       rotina-habit-log {dia: [nomes feitos]}, mood-log) e sono das duas
       fontes, igual ao Score do Dia. */
    const habitsBrutos = get<any[]>("rotina-habits", get<any[]>("core-rotina-habits", []));
    const habits = Array.isArray(habitsBrutos) ? habitsBrutos : [];
    const habitLog = get<Record<string, unknown>>("rotina-habit-log", {});
    const habitLogLegado = get<Record<string, unknown>>("core-rotina-habit-log", {});
    const waterLog = get<Record<string, number>>("core-saude-water", {});
    const waterGoal = Math.max(1, Number(get<number>("core-saude-water-goal", 8)) || 8);
    const workoutLog = get<string[]>("saude-workout-log", []);
    const sleepLog = get<Record<string, number>>("sleep-log", {});
    const sleepLogSaude = get<Record<string, number>>("core-saude-sleep", {});
    const moodLog = get<Record<string, any>>("mood-log", {});
    const moodLogLegado = get<Record<string, any>>("core-mood-log", {});
    const feitosNoDia = (dateStr: string): number => {
      const v = habitLog[dateStr] ?? habitLogLegado[dateStr];
      if (Array.isArray(v)) return v.length;
      if (v && typeof v === "object") return Object.values(v as Record<string, unknown>).filter(Boolean).length;
      return 0;
    };

    const todayStr = localDayKey(today);

    return DAYS.map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = localDayKey(d);

      if (dateStr > todayStr) return 0;

      let score = 0;

      // Habits (40pts)
      if (habits.length > 0) {
        score += Math.round((Math.min(feitosNoDia(dateStr), habits.length) / habits.length) * 40);
      }

      // Water (20pts)
      const water = waterLog[dateStr] || 0;
      score += Math.min(20, Math.round((water / waterGoal) * 20));

      // Workout (20pts)
      if (workoutLog.includes(dateStr)) score += 20;

      // Sleep (10pts)
      if (sleepLog[dateStr] || sleepLogSaude[dateStr]) score += 10;

      // Mood (10pts)
      if (moodLog[dateStr] || moodLogLegado[dateStr]) score += 10;

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
