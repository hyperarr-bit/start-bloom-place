import { motion } from "framer-motion";
import { useUserData } from "@/hooks/use-user-data";

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export const WeekProgressWidget = () => {
  const { get } = useUserData();

  const getWeekScores = (): number[] => {
    const data = get<number[]>("core-week-scores", []);
    if (data.length > 0) return data;
    const today = new Date().getDay();
    return DAYS.map((_, i) => {
      const dayIndex = (i + 1) % 7;
      if (dayIndex > today) return 0;
      return Math.floor(Math.random() * 40 + 30);
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
