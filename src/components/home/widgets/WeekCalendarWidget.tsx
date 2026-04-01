import { motion } from "framer-motion";
import { useUserData } from "@/hooks/use-user-data";

export const WeekCalendarWidget = ({ size = "large" }: { size?: "small" | "large" }) => {
  const { get } = useUserData();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const dayNames = ["D", "S", "T", "Q", "Q", "S", "S"];
  const dayNamesFull = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const weekDays: { date: string; label: string; labelFull: string; dayNum: number; isToday: boolean }[] = [];
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    weekDays.push({ date: dateStr, label: dayNames[d.getDay()], labelFull: dayNamesFull[d.getDay()], dayNum: d.getDate(), isToday: dateStr === todayStr });
  }

  const workoutLog = get<any>("core-treino-log", {});
  const habitLog = get<any>("core-rotina-habit-log", {});
  const habits = get<any[]>("core-rotina-habits", []);

  const getDayStatus = (date: string): "done" | "partial" | "empty" | "future" => {
    if (date > todayStr) return "future";
    const hasWorkout = !!workoutLog[date];
    const dayHabits = habitLog[date] || {};
    const habitsDone = Object.keys(dayHabits).length;
    const total = habits.length;
    if (hasWorkout && habitsDone >= total * 0.8) return "done";
    if (hasWorkout || habitsDone > 0) return "partial";
    return "empty";
  };

  const statusColors = {
    done: "bg-emerald-500 text-white",
    partial: "bg-amber-400/30 text-foreground",
    empty: "bg-muted text-muted-foreground",
    future: "bg-transparent text-muted-foreground/40 border border-border/30",
  };

  const isSmall = size === "small";

  return (
    <div className="bg-card rounded-2xl p-3 border border-border/50 shadow-sm overflow-hidden w-full min-w-0">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 truncate">
        📅 {isSmall ? "Semana" : "Visão da Semana"}
      </h4>
      <div className="flex gap-1 w-full min-w-0">
        {weekDays.map((day, i) => (
          <motion.div
            key={day.date}
            className="flex-1 flex flex-col items-center gap-0.5 min-w-0"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <span className="text-[7px] font-medium text-muted-foreground">
              {isSmall ? day.label : day.labelFull}
            </span>
            <div
              className={`${isSmall ? "w-5 h-5 text-[8px]" : "w-7 h-7 text-[10px]"} rounded-md flex items-center justify-center font-bold ${
                day.isToday ? "ring-1.5 ring-primary ring-offset-1 ring-offset-background " : ""
              }${statusColors[getDayStatus(day.date)]}`}
            >
              {day.dayNum}
            </div>
          </motion.div>
        ))}
      </div>
      {!isSmall && (
        <div className="flex items-center gap-3 mt-2 justify-center">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[8px] text-muted-foreground">Completo</span></div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400/50" /><span className="text-[8px] text-muted-foreground">Parcial</span></div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-muted" /><span className="text-[8px] text-muted-foreground">Vazio</span></div>
        </div>
      )}
    </div>
  );
};
