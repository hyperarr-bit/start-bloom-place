import { motion } from "framer-motion";
import { useUserData } from "@/hooks/use-user-data";

export const HabitStreaksWidget = () => {
  const { get } = useUserData();
  const habits = get<any[]>("core-rotina-habits", []);
  const habitLog = get<any>("core-rotina-habit-log", {});

  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const displayHabits = habits.slice(0, 5);
  const dayLabels = days.map(d => {
    const date = new Date(d + "T12:00:00");
    return ["D", "S", "T", "Q", "Q", "S", "S"][date.getDay()];
  });

  return (
    <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">🔥 Ofensiva de Hábitos</h4>
      {displayHabits.length === 0 ? (
        <p className="text-xs text-muted-foreground">Adicione hábitos no módulo Rotina</p>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <div className="w-16" />
            {dayLabels.map((label, i) => (
              <div key={i} className="flex-1 text-center text-[8px] text-muted-foreground font-medium">{label}</div>
            ))}
          </div>
          {displayHabits.map((habit, hi) => {
            const name = typeof habit === "string" ? habit : habit.name || "Hábito";
            const id = habit.id || habit.name || habit;
            return (
              <div key={hi} className="flex items-center gap-1">
                <span className="w-16 text-[9px] font-medium truncate">{name}</span>
                {days.map((day, di) => {
                  const dayLog = habitLog[day] || {};
                  const done = !!dayLog[id];
                  return (
                    <motion.div
                      key={di}
                      className={`flex-1 aspect-square rounded-sm ${done ? "bg-emerald-500" : "bg-muted"}`}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: (hi * 7 + di) * 0.01 }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
