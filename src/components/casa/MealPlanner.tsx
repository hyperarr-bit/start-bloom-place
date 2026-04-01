import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, Shuffle, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Recipe, MealPlan } from "./types";

const weekDays = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const dayColors: Record<string, string> = {
  Segunda: "border-l-blue-500", Terça: "border-l-indigo-500", Quarta: "border-l-green-500",
  Quinta: "border-l-yellow-500", Sexta: "border-l-pink-500", Sábado: "border-l-purple-500", Domingo: "border-l-violet-500"
};

const defaultRecipes: Recipe[] = [
  { id: "1", name: "Arroz e Feijão", emoji: "🍚", ingredients: ["Arroz", "Feijão", "Alho", "Cebola"] },
  { id: "2", name: "Macarrão", emoji: "🍝", ingredients: ["Macarrão", "Molho de tomate"] },
  { id: "3", name: "Frango Grelhado", emoji: "🍗", ingredients: ["Peito de frango", "Temperos"] },
  { id: "4", name: "Salada", emoji: "🥗", ingredients: ["Alface", "Tomate", "Pepino"] },
];

const MealPlanner = () => {
  const [recipes, setRecipes] = usePersistedState<Recipe[]>("casa-recipes", defaultRecipes);
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

  const getRecipeName = (id: string) => {
    const r = recipes.find(r => r.id === id);
    return r ? `${r.emoji} ${r.name}` : "—";
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="text-xs gap-1 flex-1" onClick={() => setShowRecipes(!showRecipes)}>
          <ChefHat className="w-3 h-3" /> Receitas ({recipes.length})
        </Button>
        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={randomize}>
          <Shuffle className="w-3 h-3" /> Sugerir Cardápio
        </Button>
      </div>

      {showRecipes && (
        <div className="bg-card rounded-xl border border-border p-3 space-y-2">
          <h4 className="text-xs font-bold mb-2">📖 Banco de Receitas</h4>
          <div className="flex flex-wrap gap-1">
            {recipes.map(r => (
              <div key={r.id} className="flex items-center gap-1 bg-muted/50 rounded-full px-2 py-1 text-xs group">
                <span>{r.emoji}</span> {r.name}
                <button onClick={() => setRecipes(prev => prev.filter(x => x.id !== r.id))} className="opacity-0 group-hover:opacity-100">
                  <X className="w-2.5 h-2.5 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} className="text-xs h-7 w-12 text-center" maxLength={2} />
            <Input value={newRecipe} onChange={e => setNewRecipe(e.target.value)} placeholder="Nome da receita" className="text-xs h-7 flex-1"
              onKeyDown={e => e.key === "Enter" && addRecipe()} />
            <Button size="sm" className="h-7 px-2" onClick={addRecipe}><Plus className="w-3 h-3" /></Button>
          </div>
        </div>
      )}

      {/* Weekly grid */}
      <div className="space-y-2">
        {weekDays.map(day => (
          <div key={day} className={`bg-card rounded-xl border border-border border-l-4 ${dayColors[day]} p-3`}>
            <h4 className="text-xs font-bold mb-2">{day.toUpperCase()}</h4>
            <div className="grid grid-cols-2 gap-2">
              {(["almoco", "janta"] as const).map(slot => (
                <div key={slot}>
                  <p className="text-[10px] text-muted-foreground mb-1">{slot === "almoco" ? "🌞 Almoço" : "🌙 Janta"}</p>
                  <select value={mealPlan[day]?.[slot] || ""} onChange={e => setMeal(day, slot, e.target.value)}
                    className="w-full text-xs bg-background border border-border rounded px-2 py-1.5">
                    <option value="">—</option>
                    {recipes.map(r => <option key={r.id} value={r.id}>{r.emoji} {r.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MealPlanner;
