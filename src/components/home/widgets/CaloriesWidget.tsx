import { useNavigate } from "react-router-dom";
import { Apple, Plus } from "lucide-react";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { useUserData } from "@/hooks/use-user-data";
import { ProgressBar } from "@/components/home/ProgressBar";
import { WidgetSize } from "@/hooks/use-home-widgets";
import { useState } from "react";

export const CaloriesWidget = ({ size = "small" }: { size?: WidgetSize }) => {
  const navigate = useNavigate();
  const data = useLifeHubData();
  const { get, set } = useUserData();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [mealName, setMealName] = useState("");
  const [mealCals, setMealCals] = useState("");

  const todayStr = new Date().toISOString().slice(0, 10);

  const handleQuickMeal = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!mealName || !mealCals) return;
    const log = get<any>("core-dieta-log", {});
    const todayMeals = log[todayStr] || {};
    const id = `quick-${Date.now()}`;
    todayMeals[id] = { name: mealName, calories: parseFloat(mealCals) };
    set("core-dieta-log", { ...log, [todayStr]: todayMeals });
    setMealName("");
    setMealCals("");
    setShowQuickAdd(false);
  };

  // Macro data from life hub
  const pct = data.caloriesGoal > 0 ? Math.round((data.caloriesConsumed / data.caloriesGoal) * 100) : 0;

  if (size === "small") {
    return (
      <button onClick={() => navigate("/dieta")} className="w-full text-left bg-card rounded-2xl p-4 shadow-sm hover:shadow-md border border-border/50 transition-all">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-400/20">
            <Apple className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Calorias</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold">{data.caloriesConsumed}</span>
              <span className="text-[10px] text-muted-foreground">/ {data.caloriesGoal} kcal</span>
            </div>
            <ProgressBar value={data.caloriesConsumed} max={data.caloriesGoal} colorClass="bg-emerald-500" />
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="w-full text-left bg-card rounded-2xl p-4 shadow-sm border border-border/50">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => navigate("/dieta")} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-400/20">
            <Apple className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Calorias</h3>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setShowQuickAdd(!showQuickAdd); }}
          className="w-7 h-7 rounded-full bg-emerald-400/20 text-emerald-600 flex items-center justify-center hover:bg-emerald-400/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-xl font-bold">{data.caloriesConsumed}</span>
        <span className="text-xs text-muted-foreground">/ {data.caloriesGoal} kcal</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{pct}%</span>
      </div>
      <ProgressBar value={data.caloriesConsumed} max={data.caloriesGoal} colorClass="bg-emerald-500" />

      <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
        <span>🥩 P: {data.mealsLogged}</span>
        <span>🍞 C: —</span>
        <span>🥑 G: —</span>
      </div>

      {showQuickAdd && (
        <form onSubmit={handleQuickMeal} className="mt-3 space-y-2 border-t border-border/50 pt-3" onClick={e => e.stopPropagation()}>
          <input
            value={mealName}
            onChange={e => setMealName(e.target.value)}
            placeholder="Refeição"
            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-input bg-background"
          />
          <div className="flex gap-2">
            <input
              value={mealCals}
              onChange={e => setMealCals(e.target.value)}
              placeholder="Calorias"
              type="number"
              className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-input bg-background"
            />
            <button type="submit" className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
              Salvar
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
