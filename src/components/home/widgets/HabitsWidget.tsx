import { useNavigate } from "react-router-dom";
import { CheckSquare } from "lucide-react";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { useUserData } from "@/hooks/use-user-data";
import { alternarHabitoDeHoje, checksDeHoje, nomesDosHabitos, type LogDoHeatmap } from "@/lib/rotina-habitos";
import { ProgressBar } from "@/components/home/ProgressBar";
import { WidgetSize } from "@/hooks/use-home-widgets";

export const HabitsWidget = ({ size = "small" }: { size?: WidgetSize }) => {
  const navigate = useNavigate();
  const data = useLifeHubData();
  const { get, set } = useUserData();

  // Mesma fonte e mesma regra da Rotina (26/09, varredura): o widget lia
  // `core-rotina-habits`, que ninguém grava — pra cliente real a lista saía
  // vazia, e o toque ia pra um log que a Rotina não lê.
  const nomes = nomesDosHabitos(get<unknown[]>("rotina-habits", get<unknown[]>("core-rotina-habits", [])));
  const checked = get<Record<string, boolean[]>>("rotina-habits-checked", {});
  const semana = get<string>("rotina-habits-week", "");
  const hoje = checksDeHoje(checked, semana);

  const toggleHabit = (indice: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const novo = alternarHabitoDeHoje({
      nomes, checked, semana, indice,
      habitLog: get<Record<string, string[]>>("rotina-habit-log", {}),
      heatmap: get<LogDoHeatmap>("heatmap-log", {}),
    });
    set("rotina-habits-checked", novo.checked);
    set("rotina-habits-week", novo.semana);
    set("rotina-habit-log", novo.habitLog);
    set("heatmap-log", novo.heatmap);
  };

  const topHabits = nomes.slice(0, 3).map((name, i) => ({ key: `${i}-${name}`, indice: i, name, done: !!hoje[i] }));

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
              onClick={(e) => toggleHabit(h.indice, e)}
              className="w-full flex items-center gap-2.5 text-left group"
            >
              {/* w-5 h-5 (26/09, varredura): `w-4.5`/`h-4.5` não existem no
                  Tailwind — o quadradinho saía com 4 px, só a borda. */}
              <div className={`w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-all ${
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
