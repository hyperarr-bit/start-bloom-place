import { useNavigate } from "react-router-dom";
import { Heart, Droplets, Plus, Minus } from "lucide-react";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { useUserData } from "@/hooks/use-user-data";
import { ProgressBar } from "@/components/home/ProgressBar";
import { WidgetSize } from "@/hooks/use-home-widgets";

export const HealthWidget = ({ size = "small" }: { size?: WidgetSize }) => {
  const navigate = useNavigate();
  const data = useLifeHubData();
  const { get, set } = useUserData();

  const todayStr = new Date().toISOString().slice(0, 10);

  const adjustWater = (delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const log = get<any>("core-saude-water", {});
    const current = log[todayStr] || 0;
    const next = Math.max(0, current + delta);
    set("core-saude-water", { ...log, [todayStr]: next });
  };

  if (size === "small") {
    return (
      <button onClick={() => navigate("/saude")} className="w-full text-left bg-card rounded-2xl p-4 shadow-sm hover:shadow-md border border-border/50 transition-all">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-400/20">
            <Heart className="w-4 h-4 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Saúde</h3>
            <div className="flex items-center gap-2">
              <Droplets className="w-3 h-3 text-cyan-500" />
              <span className="text-xs font-medium">{data.waterGlasses}/{data.waterGoal}</span>
            </div>
            <ProgressBar value={data.waterGlasses} max={data.waterGoal} colorClass="bg-cyan-500" />
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="w-full text-left bg-card rounded-2xl p-4 shadow-sm border border-border/50">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => navigate("/saude")} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-400/20">
            <Heart className="w-4 h-4 text-red-600" />
          </div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Saúde</h3>
        </button>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <Droplets className="w-4 h-4 text-cyan-500" />
        <span className="text-sm font-bold">{data.waterGlasses}/{data.waterGoal} copos</span>
      </div>
      <ProgressBar value={data.waterGlasses} max={data.waterGoal} colorClass="bg-cyan-500" />

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={(e) => adjustWater(-1, e)}
          className="w-8 h-8 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 flex justify-center gap-1">
          {Array.from({ length: data.waterGoal }).map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-5 rounded-sm transition-colors ${
                i < data.waterGlasses ? "bg-cyan-500" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <button
          onClick={(e) => adjustWater(1, e)}
          className="w-8 h-8 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
