import { useNavigate } from "react-router-dom";
import { CheckSquare } from "lucide-react";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { useUserData } from "@/hooks/use-user-data";
import { ProgressBar } from "@/components/home/ProgressBar";
import { WidgetSize } from "@/hooks/use-home-widgets";

export const HabitsWidget = ({ size = "small" }: { size?: WidgetSize }) => {
  const navigate = useNavigate();
  const data = useLifeHubData();
  const { get, set } = useUserData();

  const todayStr = new Date().toISOString().slice(0, 10);

  const toggleHabit = (habitKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const log = get<any>("core-rotina-habit-log", {});
    const todayLog = log[todayStr] || {};
    if (todayLog[habitKey]) {
      const { [habitKey]: _, ...rest } = todayLog;
      set("core-rotina-habit-log", { ...log, [todayStr]: rest });
    } else {
      set("core-rotina-habit-log", { ...log, [todayStr]: { ...todayLog, [habitKey]: true } });
    }
  };

  const habits = get<any[]>("core-rotina-habits", []);
  const habitLog = get<any>("core-rotina-habit-log", {});
  const todayHabits = habitLog[todayStr] || {};
  const topHabits = habits.slice(0, 3).map((h: any) => {
    const key = h.id || h.name || h;
    return {
      key,
      name: typeof h === "string" ? h : h.name || "Hábito",
      done: !!todayHabits[key],
    };
  });

  if (size === "small") {
    return (
      <button onClick={() => navigate("/rotina")} className="w-full text-left bg-card rounded-2xl p-4 shadow-sm hover:shadow-md border border-border/50 transition-all">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-400/20">
            <CheckSquare className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Hábitos</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold">{data.tasksCompleted}</span>
              <span className="text-[10px] text-muted-foreground">/ {data.tasksTotal} feitos</span>
            </div>
            <ProgressBar value={data.tasksCompleted} max={data.tasksTotal} colorClass="bg-emerald-500" />
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="w-full text-left bg-card rounded-2xl p-4 shadow-sm border border-border/50">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => navigate("/rotina")} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-400/20">
            <CheckSquare className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Hábitos</h3>
        </button>
        <span className="text-xs text-muted-foreground font-medium">{data.tasksCompleted}/{data.tasksTotal}</span>
      </div>

      <ProgressBar value={data.tasksCompleted} max={data.tasksTotal} colorClass="bg-emerald-500" />

      {topHabits.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {topHabits.map(h => (
            <button
              key={h.key}
              onClick={(e) => toggleHabit(h.key, e)}
              className="w-full flex items-center gap-2.5 text-left group"
            >
              <div className={`w-4.5 h-4.5 rounded-md border-2 flex items-center justify-center transition-all ${
                h.done
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "border-muted-foreground/30 group-hover:border-emerald-500"
              }`}>
                {h.done && <CheckSquare className="w-3 h-3" />}
              </div>
              <span className={`text-xs ${h.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {h.name}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground mt-2">Nenhum hábito cadastrado</p>
      )}
    </div>
  );
};
