import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Recipe, MealPlan } from "./types";

const weekDays = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const dayColors: Record<string, { header: string; body: string }> = {
  Segunda: { header: "bg-blue-200 dark:bg-blue-900/60", body: "bg-blue-50 dark:bg-blue-950/30" },
  Terça: { header: "bg-indigo-200 dark:bg-indigo-900/60", body: "bg-indigo-50 dark:bg-indigo-950/30" },
  Quarta: { header: "bg-green-200 dark:bg-green-900/60", body: "bg-green-50 dark:bg-green-950/30" },
  Quinta: { header: "bg-yellow-200 dark:bg-yellow-900/60", body: "bg-yellow-50 dark:bg-yellow-950/30" },
  Sexta: { header: "bg-pink-200 dark:bg-pink-900/60", body: "bg-pink-50 dark:bg-pink-950/30" },
  Sábado: { header: "bg-purple-200 dark:bg-purple-900/60", body: "bg-purple-50 dark:bg-purple-950/30" },
  Domingo: { header: "bg-violet-200 dark:bg-violet-900/60", body: "bg-violet-50 dark:bg-violet-950/30" },
};

const MealPlanner = () => {
  const [recipes, setRecipes] = usePersistedState<Recipe[]>("casa-recipes", []);
  const [mealPlan, setMealPlan] = usePersistedState<MealPlan>("casa-meal-plan", {});
  const [newRecipe, setNewRecipe] = useState("");
  const [newEmoji, setNewEmoji] = useState("🍽️");
  const [showRecipes, setShowRecipes] = useState(false);

  const setMeal = (day: string, slot: "almoco" | "janta", recipeId: string) => {
    setMealPlan(prev => ({ ...prev, [day]: { ...prev[day], [slot]: recipeId } }));
  };

  const addRecipe = () => {
    if (!newRecipe.trim()) return;
    setRecipes(prev => [...prev, { id: Date.now().toString(), name: newRecipe.trim(), emoji: newEmoji, ingredients: [] }]);
    setNewRecipe("");
  };

  const randomize = () => {
    if (recipes.length === 0) return;
    const plan: MealPlan = {};
    weekDays.forEach(day => {
      plan[day] = {
        almoco: recipes[Math.floor(Math.random() * recipes.length)].id,
        janta: recipes[Math.floor(Math.random() * recipes.length)].id,
      };
    });
    setMealPlan(plan);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="text-xs gap-1 flex-1" onClick={() => setShowRecipes(!showRecipes)}>
          📖 Receitas ({recipes.length})
        </Button>
        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={randomize}>
          <Shuffle className="w-3 h-3" /> Sugerir Cardápio
        </Button>
      </div>

      {showRecipes && (
        <div className="rounded-xl overflow-hidden border border-border">
          <div className="bg-orange-200 dark:bg-orange-900/60 px-3 py-2">
            <h4 className="text-xs font-bold text-foreground">📖 BANCO DE RECEITAS</h4>
          </div>
          <div className="bg-orange-50 dark:bg-orange-950/30 p-2 space-y-2">
            <div className="flex flex-wrap gap-1">
              {recipes.map(r => (
                <div key={r.id} className="flex items-center gap-1 bg-background/60 rounded-full px-2 py-1 text-xs group">
                  <span>{r.emoji}</span> {r.name}
                  <button onClick={() => setRecipes(prev => prev.filter(x => x.id !== r.id))} className="opacity-0 group-hover:opacity-100">
                    <X className="w-2.5 h-2.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
              {recipes.length === 0 && <p className="text-[11px] text-muted-foreground italic py-2 w-full text-center">Nenhuma receita ainda</p>}
            </div>
            <div className="flex gap-2">
              <Input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} className="text-xs h-7 w-12 text-center bg-background/70" maxLength={2} />
              <Input value={newRecipe} onChange={e => setNewRecipe(e.target.value)} placeholder="Nome da receita" className="text-xs h-7 flex-1 bg-background/70"
                onKeyDown={e => e.key === "Enter" && addRecipe()} />
              <Button size="sm" className="h-7 px-2" onClick={addRecipe}><Plus className="w-3 h-3" /></Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {weekDays.map(day => {
          const colors = dayColors[day];
          return (
            <div key={day} className="rounded-xl overflow-hidden border border-border">
              <div className={`${colors.header} px-3 py-2`}>
                <h4 className="text-xs font-bold text-foreground">{day.toUpperCase()}</h4>
              </div>
              <div className={`${colors.body} p-3`}>
                <div className="grid grid-cols-2 gap-2">
                  {(["almoco", "janta"] as const).map(slot => (
                    <div key={slot}>
                      <p className="text-[10px] text-muted-foreground mb-1">{slot === "almoco" ? "🌞 Almoço" : "🌙 Janta"}</p>
                      <select value={mealPlan[day]?.[slot] || ""} onChange={e => setMeal(day, slot, e.target.value)}
                        className="w-full text-xs bg-background/70 border border-border rounded px-2 py-1.5">
                        <option value="">—</option>
                        {recipes.map(r => <option key={r.id} value={r.id}>{r.emoji} {r.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MealPlanner;
