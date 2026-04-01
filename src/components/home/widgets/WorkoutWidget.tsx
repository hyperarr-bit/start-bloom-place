import { useNavigate } from "react-router-dom";
import { Dumbbell, Check } from "lucide-react";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { useUserData } from "@/hooks/use-user-data";
import { WidgetSize } from "@/hooks/use-home-widgets";

export const WorkoutWidget = ({ size = "small" }: { size?: WidgetSize }) => {
  const navigate = useNavigate();
  const data = useLifeHubData();
  const { get, set } = useUserData();

  const todayStr = new Date().toISOString().slice(0, 10);

  const toggleWorkoutDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    const log = get<string[]>("saude-workout-log", []);
    if (log.includes(todayStr)) {
      set("saude-workout-log", log.filter(d => d !== todayStr));
    } else {
      set("saude-workout-log", [...log, todayStr]);
    }
  };

  if (size === "small") {
    return (
      <button onClick={() => navigate("/treino")} className="w-full text-left bg-card rounded-2xl p-4 shadow-sm hover:shadow-md border border-border/50 transition-all">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-400/20">
            <Dumbbell className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Treino</h3>
            {data.todayWorkoutGroup ? (
              <>
                <p className="text-sm font-bold truncate">{data.todayWorkoutGroup}</p>
                <p className={`text-[10px] ${data.workoutDone ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {data.workoutDone ? "✓ Concluído" : "Pendente"}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Dia de descanso 😴</p>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="w-full text-left bg-card rounded-2xl p-4 shadow-sm border border-border/50">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => navigate("/treino")} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-400/20">
            <Dumbbell className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Treino</h3>
        </button>
        {data.todayWorkoutGroup && (
          <button
            onClick={toggleWorkoutDone}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              data.workoutDone
                ? "bg-emerald-500 text-white"
                : "border-2 border-muted-foreground/30 text-muted-foreground hover:border-emerald-500"
            }`}
          >
            <Check className="w-4 h-4" />
          </button>
        )}
      </div>
      {data.todayWorkoutGroup ? (
        <>
          <p className="text-xl font-bold">{data.todayWorkoutGroup}</p>
          <p className={`text-xs mt-1 ${data.workoutDone ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
            {data.workoutDone ? "✓ Treino concluído!" : "⏳ Toque no ✓ para concluir"}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Dia de descanso 😴</p>
      )}
    </div>
  );
};
