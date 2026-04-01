import { useState, useEffect, useRef } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, X, Trash2, Check, Utensils, Clock, Droplets,
  TrendingUp, Target, Zap, Activity, Flame, Apple, ShoppingCart,
  ChefHat, Calendar, Star, BookOpen, Heart, Settings, Edit3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ModuleTip } from "@/components/ModuleTip";


const weekDays = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
const dayColors: Record<string, string> = {
  SEGUNDA: "bg-blue-500", TERÇA: "bg-indigo-500", QUARTA: "bg-green-500",
  QUINTA: "bg-yellow-500", SEXTA: "bg-pink-500", SÁBADO: "bg-purple-500", DOMINGO: "bg-violet-500"
};

const defaultMeals = ["Café da Manhã", "Almoço", "Lanche", "Janta"];
const defaultMealEmojis: Record<string, string> = { "Café da Manhã": "🌅", "Almoço": "🍽️", "Lanche": "🍎", "Janta": "🌙", "Pré-Treino": "⚡", "Pós-Treino": "💪", "Ceia": "🌙", "Café da Tarde": "☕" };
const defaultMealColors: Record<string, string> = {
  "Café da Manhã": "bg-amber-100 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30",
  "Almoço": "bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/30",
  "Lanche": "bg-blue-100 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/30",
  "Janta": "bg-purple-100 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/30",
  "Pré-Treino": "bg-orange-100 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/30",
  "Pós-Treino": "bg-red-100 dark:bg-red-500/10 border-red-300 dark:border-red-500/30",
  "Ceia": "bg-indigo-100 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/30",
  "Café da Tarde": "bg-teal-100 dark:bg-teal-500/10 border-teal-300 dark:border-teal-500/30",
};
const availableMeals = ["Café da Manhã", "Almoço", "Lanche", "Janta", "Pré-Treino", "Pós-Treino", "Ceia", "Café da Tarde"];

const Dieta = () => {
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];

  // Configurable meals
  const [meals, setMeals] = usePersistedState<string[]>("dieta-meals-config", defaultMeals);
  const [showMealConfig, setShowMealConfig] = useState(false);
  const [newMealNameConfig, setNewMealNameConfig] = useState("");

  const mealEmojis = defaultMealEmojis;
  const mealColors = defaultMealColors;

  const presetMealPlan: Record<string, Record<string, string>> = Object.fromEntries(
    weekDays.map(day => [day, Object.fromEntries(meals.map(m => [m, ""]))])
  );

  // DIETA
  const [mealPlan, setMealPlan] = usePersistedState("saude-meals", presetMealPlan);
  const [editingMeal, setEditingMeal] = useState<string | null>(null);
  const [editMealValue, setEditMealValue] = useState("");

  // CALORIAS & MACROS
  const [calorieGoal, setCalorieGoal] = usePersistedState("saude-cal-goal", 2000);
  const [dailyMeals, setDailyMeals] = usePersistedState<Record<string, {name: string; cal: number; prot: number; carb: number; fat: number}[]>>("saude-daily-meals", {});
  const todayMeals = dailyMeals[today] || [];
  const [newMealName, setNewMealName] = useState("");
  const [newMealCal, setNewMealCal] = useState("");
  const [newMealProt, setNewMealProt] = useState("");
  const [newMealCarb, setNewMealCarb] = useState("");
  const [newMealFat, setNewMealFat] = useState("");

  // WATER
  const [waterGoal] = usePersistedState("saude-water-goal", 8);
  const [waterToday, setWaterToday] = usePersistedState("saude-water-today", 0);
  const [waterDate, setWaterDate] = usePersistedState("saude-water-date", "");

  // FASTING
  const [fastingGoal, setFastingGoal] = usePersistedState("saude-fast-goal", 16);
  const [fastingStart, setFastingStart] = usePersistedState<string | null>("saude-fast-start", null);
  const [fastingElapsed, setFastingElapsed] = useState(0);

  // RECIPES
  const [recipes, setRecipes] = usePersistedState<{id: string; name: string; ingredients: string; instructions: string; category: string; favorite: boolean; prepTime: string; servings: string}[]>("dieta-recipes-v2", []);
  const [newRecipeName, setNewRecipeName] = useState("");
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [recipeForm, setRecipeForm] = useState({ name: "", ingredients: "", instructions: "", category: "Almoço", prepTime: "", servings: "", favorite: false });

  // GROCERY LIST
  const [groceryItems, setGroceryItems] = usePersistedState<{id: string; name: string; category: string; checked: boolean}[]>("dieta-grocery", []);
  const [newGroceryItem, setNewGroceryItem] = useState("");
  const [groceryCategory, setGroceryCategory] = useState("Proteínas");

  // MEAL FAVORITES
  const [favoriteMeals, setFavoriteMeals] = usePersistedState<{id: string; name: string; cal: number; prot: number; carb: number; fat: number}[]>("dieta-favorites", []);

  // BMI
  const [bmiHeight, setBmiHeight] = usePersistedState("saude-bmi-height", "");
  const [bmiWeight, setBmiWeight] = usePersistedState("saude-bmi-weight", "");
  const bmi = bmiHeight && bmiWeight ? (Number(bmiWeight) / Math.pow(Number(bmiHeight) / 100, 2)).toFixed(1) : null;
  const bmiCategory = bmi ? (Number(bmi) < 18.5 ? "Abaixo" : Number(bmi) < 25 ? "Normal ✅" : Number(bmi) < 30 ? "Sobrepeso" : "Obesidade") : "";
  const bmiColor = bmi ? (Number(bmi) < 18.5 ? "text-blue-500" : Number(bmi) < 25 ? "text-green-500" : Number(bmi) < 30 ? "text-yellow-500" : "text-red-500") : "";

  // Calorie history
  const [calorieLog, setCalorieLog] = usePersistedState<Record<string, number>>("dieta-cal-log", {});

  // Streak
  const dietStreak = (() => {
    let count = 0;
    const d = new Date();
    for (let i = 0; i < 60; i++) {
      const dateStr = d.toISOString().split("T")[0];
      const meals = dailyMeals[dateStr];
      if (meals && meals.length > 0) { count++; d.setDate(d.getDate() - 1); }
      else if (i === 0) { d.setDate(d.getDate() - 1); continue; }
      else break;
    }
    return count;
  })();

  useEffect(() => { if (waterDate !== today) { setWaterToday(0); setWaterDate(today); } }, [today]);

  useEffect(() => {
    if (!fastingStart) { setFastingElapsed(0); return; }
    const interval = setInterval(() => {
      setFastingElapsed(Math.floor((Date.now() - new Date(fastingStart).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [fastingStart]);

  // Log calories for history
  useEffect(() => {
    const totalCal = todayMeals.reduce((s, m) => s + m.cal, 0);
    if (totalCal > 0) setCalorieLog(prev => ({ ...prev, [today]: totalCal }));
  }, [todayMeals]);

  const startEditMeal = (day: string, meal: string) => { setEditingMeal(`${day}-${meal}`); setEditMealValue(mealPlan[day]?.[meal] || ""); };
  const saveMeal = (day: string, meal: string) => { setMealPlan({ ...mealPlan, [day]: { ...mealPlan[day], [meal]: editMealValue } }); setEditingMeal(null); };

  const formatTime = (secs: number) => { const h = Math.floor(secs / 3600); const m = Math.floor((secs % 3600) / 60); const s = secs % 60; return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`; };

  const totalCal = todayMeals.reduce((s, m) => s + m.cal, 0);
  const totalProt = todayMeals.reduce((s, m) => s + m.prot, 0);
  const totalCarb = todayMeals.reduce((s, m) => s + m.carb, 0);
  const totalFat = todayMeals.reduce((s, m) => s + m.fat, 0);

  const groceryCategories = ["Proteínas", "Frutas", "Verduras", "Grãos", "Laticínios", "Temperos", "Outros"];
  const groceryEmoji: Record<string, string> = { "Proteínas": "🥩", "Frutas": "🍎", "Verduras": "🥬", "Grãos": "🌾", "Laticínios": "🥛", "Temperos": "🧂", "Outros": "🛒" };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}><ArrowLeft className="w-5 h-5" /></Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2"><Apple className="w-5 h-5 text-green-600" /> MINHA DIETA</h1>
            <p className="text-xs text-muted-foreground">Cardápio, calorias, jejum e receitas</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-blue-100 dark:bg-blue-500/20 px-2 py-1 rounded-full border border-blue-300">
              <Droplets className="w-3 h-3 text-blue-500" />
              <span className="text-[10px] font-bold text-blue-700">{waterToday}/{waterGoal}</span>
            </div>
            {dietStreak > 0 && (
              <div className="flex items-center gap-1 bg-green-100 dark:bg-green-500/20 px-2 py-1 rounded-full border border-green-300">
                <Flame className="w-3 h-3 text-green-600" />
                <span className="text-[10px] font-bold text-green-700">{dietStreak}d</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        <ModuleTip
          moduleId="dieta"
          tips={[
            "Configure suas refeições clicando em ⚙️ no cardápio (adicione ou remova refeições)",
            "No cardápio semanal, clique em cada refeição para adicionar o que vai comer",
            "Na aba 🔥 CALORIAS, registre o que comeu e acompanhe macros",
            "Use a aba 💧 ÁGUA para contar seus copos diários"
          ]}
        />
        <Tabs defaultValue="cardapio" className="w-full">
          <TabsList className="w-full flex overflow-x-auto gap-1 bg-muted/50 p-1 mb-4 h-auto flex-wrap">
            <TabsTrigger value="cardapio" className="text-xs px-3 py-1.5">🍽️ CARDÁPIO</TabsTrigger>
            <TabsTrigger value="calorias" className="text-xs px-3 py-1.5">🔥 CALORIAS</TabsTrigger>
            <TabsTrigger value="agua" className="text-xs px-3 py-1.5">💧 ÁGUA</TabsTrigger>
            <TabsTrigger value="jejum" className="text-xs px-3 py-1.5">⏱️ JEJUM</TabsTrigger>
            <TabsTrigger value="receitas" className="text-xs px-3 py-1.5">👩‍🍳 RECEITAS</TabsTrigger>
            <TabsTrigger value="mercado" className="text-xs px-3 py-1.5">🛒 MERCADO</TabsTrigger>
          </TabsList>

          <TabsContent value="cardapio" className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Cardápio semanal — clique para editar:</p>
              <Button size="sm" variant={showMealConfig ? "default" : "outline"} className="text-xs h-7" onClick={() => setShowMealConfig(!showMealConfig)}>
                <Settings className="w-3 h-3 mr-1" /> Refeições ({meals.length})
              </Button>
            </div>

            {showMealConfig && (
              <div className="bg-muted/30 rounded-xl border border-border p-3 space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground">CONFIGURAR REFEIÇÕES</p>
                <div className="flex flex-wrap gap-1.5">
                  {meals.map((meal, i) => (
                    <div key={meal} className="flex items-center gap-1 bg-card rounded-lg border border-border px-2 py-1">
                      <span className="text-xs">{mealEmojis[meal] || "🍽️"} {meal}</span>
                      {meals.length > 2 && (
                        <button onClick={() => setMeals(prev => prev.filter(m => m !== meal))} className="text-muted-foreground hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <Select value={newMealNameConfig} onValueChange={v => {
                    if (!meals.includes(v)) { setMeals(prev => [...prev, v]); }
                    setNewMealNameConfig("");
                  }}>
                    <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="+ Adicionar refeição" /></SelectTrigger>
                    <SelectContent>
                      {availableMeals.filter(m => !meals.includes(m)).map(m => (
                        <SelectItem key={m} value={m}>{defaultMealEmojis[m]} {m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {weekDays.map(day => (
                <div key={day} className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className={`${dayColors[day]} text-white p-3 font-bold text-sm text-center`}>{day}</div>
                  <div className="p-3 space-y-3">
                    {meals.map(meal => {
                      const key = `${day}-${meal}`; const isEditing = editingMeal === key;
                      return (
                        <div key={meal} className={`rounded-lg p-2 border ${mealColors[meal] || "bg-muted/50 border-border"}`}>
                          <p className="text-xs font-bold mb-1">{meal} {mealEmojis[meal] || "🍽️"}</p>
                          {isEditing ? (
                            <div className="flex gap-1">
                              <Textarea value={editMealValue} onChange={e => setEditMealValue(e.target.value)} className="text-[10px] min-h-[50px] flex-1 bg-white/50 dark:bg-background/50" />
                              <Button size="sm" className="h-7 self-end" onClick={() => saveMeal(day, meal)}><Check className="w-3 h-3" /></Button>
                            </div>
                          ) : (
                            <p className="text-[11px] leading-relaxed cursor-pointer hover:opacity-70" onClick={() => startEditMeal(day, meal)}>
                              {mealPlan[day]?.[meal] || <span className="italic text-muted-foreground">Clique para adicionar...</span>}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ========== CALORIAS ========== */}
          <TabsContent value="calorias" className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Utensils className="w-4 h-4" /> CALORIAS E MACROS — {new Date().toLocaleDateString("pt-BR")}</h3>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs">Meta diária:</span>
                <Input type="number" value={calorieGoal} onChange={e => setCalorieGoal(Number(e.target.value))} className="text-xs h-8 w-24" />
                <span className="text-xs text-muted-foreground">kcal</span>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="bg-orange-50 dark:bg-orange-500/10 rounded-lg p-2 text-center border border-orange-200">
                  <p className="text-lg font-bold">{totalCal}</p><p className="text-[10px] text-muted-foreground">kcal</p>
                  <Progress value={Math.min((totalCal / calorieGoal) * 100, 100)} className="h-1 mt-1" />
                </div>
                <div className="bg-red-50 dark:bg-red-500/10 rounded-lg p-2 text-center border border-red-200">
                  <p className="text-lg font-bold">{totalProt}g</p><p className="text-[10px] text-muted-foreground">Proteína</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-2 text-center border border-blue-200">
                  <p className="text-lg font-bold">{totalCarb}g</p><p className="text-[10px] text-muted-foreground">Carbo</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-500/10 rounded-lg p-2 text-center border border-yellow-200">
                  <p className="text-lg font-bold">{totalFat}g</p><p className="text-[10px] text-muted-foreground">Gordura</p>
                </div>
              </div>

              {/* Quick add from favorites */}
              {favoriteMeals.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-muted-foreground mb-1">⭐ FAVORITOS — clique para adicionar:</p>
                  <div className="flex gap-1 flex-wrap">
                    {favoriteMeals.map(f => (
                      <button key={f.id} onClick={() => setDailyMeals({ ...dailyMeals, [today]: [...todayMeals, f] })}
                        className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[10px] hover:bg-amber-100 transition-colors">
                        {f.name} ({f.cal}kcal)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-1 mb-2">
                <Input value={newMealName} onChange={e => setNewMealName(e.target.value)} placeholder="Refeição" className="text-xs h-8 flex-1" />
                <Input type="number" value={newMealCal} onChange={e => setNewMealCal(e.target.value)} placeholder="kcal" className="text-xs h-8 w-16" />
                <Input type="number" value={newMealProt} onChange={e => setNewMealProt(e.target.value)} placeholder="P" className="text-xs h-8 w-12" />
                <Input type="number" value={newMealCarb} onChange={e => setNewMealCarb(e.target.value)} placeholder="C" className="text-xs h-8 w-12" />
                <Input type="number" value={newMealFat} onChange={e => setNewMealFat(e.target.value)} placeholder="G" className="text-xs h-8 w-12" />
                <Button size="sm" className="h-8" onClick={() => {
                  if (newMealName.trim()) {
                    const meal = { name: newMealName.trim(), cal: Number(newMealCal) || 0, prot: Number(newMealProt) || 0, carb: Number(newMealCarb) || 0, fat: Number(newMealFat) || 0 };
                    setDailyMeals({ ...dailyMeals, [today]: [...todayMeals, meal] });
                    setNewMealName(""); setNewMealCal(""); setNewMealProt(""); setNewMealCarb(""); setNewMealFat("");
                  }
                }}><Plus className="w-3 h-3" /></Button>
              </div>
              {todayMeals.map((m, i) => (
                <div key={i} className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-1.5 text-xs mb-1 border border-border">
                  <span className="font-medium">{m.name}</span>
                  <div className="flex items-center gap-2">
                    <span>{m.cal}kcal</span><span className="text-red-500">{m.prot}P</span><span className="text-blue-500">{m.carb}C</span><span className="text-yellow-600">{m.fat}G</span>
                    <button onClick={() => {
                      if (!favoriteMeals.find(f => f.name === m.name)) setFavoriteMeals([...favoriteMeals, { id: Date.now().toString(), ...m }]);
                    }}><Star className="w-3 h-3 text-amber-400" /></button>
                    <button onClick={() => setDailyMeals({ ...dailyMeals, [today]: todayMeals.filter((_, j) => j !== i) })}><X className="w-3 h-3 text-muted-foreground" /></button>
                  </div>
                </div>
              ))}
            </div>

            {/* BMI */}
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-500/10 dark:to-cyan-500/10 rounded-xl border border-teal-200 p-4">
              <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-teal-500" /> CALCULADORA IMC</h3>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-1"><Input type="number" value={bmiHeight} onChange={e => setBmiHeight(e.target.value)} placeholder="Altura" className="text-xs h-8 w-20" /><span className="text-xs text-muted-foreground">cm</span></div>
                <div className="flex items-center gap-1"><Input type="number" value={bmiWeight} onChange={e => setBmiWeight(e.target.value)} placeholder="Peso" className="text-xs h-8 w-20" /><span className="text-xs text-muted-foreground">kg</span></div>
              </div>
              {bmi && <div className="flex items-center gap-3 mt-2"><span className="text-2xl font-bold">{bmi}</span><span className={`text-sm font-bold ${bmiColor}`}>{bmiCategory}</span></div>}
            </div>

            {/* Calorie History */}
            {Object.keys(calorieLog).length > 1 && (
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-500" /> HISTÓRICO DE CALORIAS</h3>
                <div className="flex items-end gap-1 h-24">
                  {Array.from({ length: 14 }, (_, i) => {
                    const d = new Date(); d.setDate(d.getDate() - (13 - i));
                    const dateStr = d.toISOString().split("T")[0];
                    const cal = calorieLog[dateStr] || 0;
                    const pct = cal > 0 ? Math.min((cal / calorieGoal) * 100, 150) : 0;
                    const overGoal = cal > calorieGoal;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        {cal > 0 && <span className="text-[7px] font-bold">{cal}</span>}
                        <div className={`w-full rounded-t transition-all ${overGoal ? "bg-red-400" : cal > 0 ? "bg-green-400" : "bg-muted/30"}`}
                          style={{ height: `${Math.max(pct * 0.6, 4)}%` }} />
                        <span className="text-[7px] text-muted-foreground">{d.getDate()}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-green-400" /> Dentro da meta</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-red-400" /> Acima da meta</span>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ========== ÁGUA ========== */}
          <TabsContent value="agua" className="space-y-4">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/10 rounded-xl border border-blue-200 p-6 text-center">
              <Droplets className="w-12 h-12 mx-auto text-blue-500 mb-3" />
              <h3 className="text-sm font-bold mb-4">Hidratação de Hoje</h3>
              <div className="flex justify-center gap-2 flex-wrap mb-4">
                {Array.from({ length: waterGoal }, (_, i) => (
                  <button key={i} onClick={() => setWaterToday(i < waterToday ? i : i + 1)}
                    className={`w-10 h-12 rounded-lg border-2 transition-all ${i < waterToday ? "bg-blue-400 border-blue-500 text-white scale-105" : "border-blue-200 text-blue-300 hover:border-blue-400"}`}>
                    <Droplets className="w-5 h-5 mx-auto" />
                  </button>
                ))}
              </div>
              <p className="text-3xl font-bold text-blue-600 mb-1">{waterToday}/{waterGoal}</p>
              <Progress value={(waterToday / waterGoal) * 100} className="h-3 max-w-xs mx-auto" />
              <p className="text-xs text-muted-foreground mt-2">{waterToday >= waterGoal ? "🎉 Meta atingida!" : `Faltam ${waterGoal - waterToday} copos`}</p>
            </div>
          </TabsContent>

          {/* ========== JEJUM ========== */}
          <TabsContent value="jejum" className="space-y-4">
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-500/10 dark:to-amber-500/10 rounded-xl border border-orange-200 p-4 text-center">
              <h3 className="text-xs font-bold mb-3 flex items-center justify-center gap-2"><Clock className="w-4 h-4 text-orange-500" /> JEJUM INTERMITENTE</h3>
              <div className="flex justify-center gap-2 mb-4">
                {[16, 18, 20, 24].map(h => (
                  <button key={h} onClick={() => setFastingGoal(h)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${fastingGoal === h ? "bg-orange-500 text-white border-orange-500" : "border-border"}`}>
                    {h}:{24 - h}
                  </button>
                ))}
              </div>
              <div className="w-44 h-44 mx-auto rounded-full border-8 border-orange-200 flex items-center justify-center mb-4 relative">
                {fastingStart && (
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 176 176">
                    <circle cx="88" cy="88" r="80" fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeDasharray={`${Math.min((fastingElapsed / (fastingGoal * 3600)) * 502, 502)} 502`} strokeLinecap="round" />
                  </svg>
                )}
                <div className="text-center z-10">
                  <p className="text-2xl font-bold font-mono">{formatTime(fastingStart ? fastingElapsed : 0)}</p>
                  <p className="text-xs text-muted-foreground">de {fastingGoal}h</p>
                  {fastingStart && fastingElapsed >= fastingGoal * 3600 && <p className="text-xs font-bold text-green-600 mt-1">✅ Completo!</p>}
                </div>
              </div>
              {!fastingStart ? (
                <Button onClick={() => setFastingStart(new Date().toISOString())} className="bg-orange-500 hover:bg-orange-600 text-white">Iniciar jejum 🍽️</Button>
              ) : (
                <div className="flex justify-center gap-2">
                  <Button variant="outline" onClick={() => setFastingStart(null)}>Cancelar</Button>
                  {fastingElapsed >= fastingGoal * 3600 && <Button className="bg-green-500 hover:bg-green-600 text-white" onClick={() => setFastingStart(null)}>Jejum completo! ✅</Button>}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ========== RECEITAS ========== */}
          <TabsContent value="receitas" className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold flex items-center gap-2"><ChefHat className="w-4 h-4" /> MINHAS RECEITAS SAUDÁVEIS</h3>
                <Button size="sm" onClick={() => setShowRecipeForm(true)}><Plus className="w-3 h-3 mr-1" /> Nova</Button>
              </div>

              {showRecipeForm && (
                <div className="bg-muted/30 rounded-lg p-3 border border-border mb-3 space-y-2">
                  <Input value={recipeForm.name} onChange={e => setRecipeForm(p => ({...p, name: e.target.value}))} placeholder="Nome da receita" className="text-xs h-8" />
                  <div className="grid grid-cols-3 gap-2">
                    <Select value={recipeForm.category} onValueChange={v => setRecipeForm(p => ({...p, category: v}))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Café", "Almoço", "Lanche", "Janta", "Sobremesa", "Shake"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input value={recipeForm.prepTime} onChange={e => setRecipeForm(p => ({...p, prepTime: e.target.value}))} placeholder="Tempo (ex: 20min)" className="text-xs h-8" />
                    <Input value={recipeForm.servings} onChange={e => setRecipeForm(p => ({...p, servings: e.target.value}))} placeholder="Porções" className="text-xs h-8" />
                  </div>
                  <Textarea value={recipeForm.ingredients} onChange={e => setRecipeForm(p => ({...p, ingredients: e.target.value}))} placeholder="Ingredientes (um por linha)..." className="text-xs min-h-[60px]" />
                  <Textarea value={recipeForm.instructions} onChange={e => setRecipeForm(p => ({...p, instructions: e.target.value}))} placeholder="Modo de preparo..." className="text-xs min-h-[60px]" />
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => {
                      if (recipeForm.name.trim()) {
                        setRecipes(prev => [...prev, { id: Date.now().toString(), ...recipeForm }]);
                        setRecipeForm({ name: "", ingredients: "", instructions: "", category: "Almoço", prepTime: "", servings: "", favorite: false });
                        setShowRecipeForm(false);
                      }
                    }}>Salvar</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowRecipeForm(false)}>Cancelar</Button>
                  </div>
                </div>
              )}

              {recipes.map(r => (
                <div key={r.id} className="bg-muted/30 rounded-lg p-3 border border-border mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{r.name}</span>
                      <Badge variant="outline" className="text-[9px]">{r.category}</Badge>
                      {r.prepTime && <span className="text-[10px] text-muted-foreground">⏱ {r.prepTime}</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setRecipes(prev => prev.map(x => x.id === r.id ? {...x, favorite: !x.favorite} : x))}>
                        <Heart className={`w-3.5 h-3.5 ${r.favorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                      </button>
                      <button onClick={() => setRecipes(prev => prev.filter(x => x.id !== r.id))}><Trash2 className="w-3 h-3 text-muted-foreground" /></button>
                    </div>
                  </div>
                  {r.ingredients && <p className="text-[10px] text-muted-foreground whitespace-pre-line mb-1">{r.ingredients}</p>}
                  {r.instructions && <p className="text-[10px] whitespace-pre-line">{r.instructions}</p>}
                </div>
              ))}
              {recipes.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Salve suas receitas favoritas aqui 🥗</p>}
            </div>
          </TabsContent>

          {/* ========== LISTA DE MERCADO ========== */}
          <TabsContent value="mercado" className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> LISTA DE MERCADO</h3>
                <Badge variant="secondary" className="text-[10px]">{groceryItems.filter(i => i.checked).length}/{groceryItems.length} ✓</Badge>
              </div>
              {groceryItems.length > 0 && (
                <Progress value={(groceryItems.filter(i => i.checked).length / groceryItems.length) * 100} className="h-1.5 mb-3" />
              )}
              <div className="flex gap-2 mb-3">
                <Input value={newGroceryItem} onChange={e => setNewGroceryItem(e.target.value)} placeholder="Adicionar item..."
                  className="text-xs h-8 flex-1" onKeyDown={e => {
                    if (e.key === "Enter" && newGroceryItem.trim()) {
                      setGroceryItems(prev => [...prev, { id: Date.now().toString(), name: newGroceryItem.trim(), category: groceryCategory, checked: false }]);
                      setNewGroceryItem("");
                    }
                  }} />
                <Select value={groceryCategory} onValueChange={setGroceryCategory}>
                  <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{groceryCategories.map(c => <SelectItem key={c} value={c}>{groceryEmoji[c]} {c}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" className="h-8" onClick={() => {
                  if (newGroceryItem.trim()) {
                    setGroceryItems(prev => [...prev, { id: Date.now().toString(), name: newGroceryItem.trim(), category: groceryCategory, checked: false }]);
                    setNewGroceryItem("");
                  }
                }}><Plus className="w-3 h-3" /></Button>
              </div>

              {groceryCategories.map(cat => {
                const items = groceryItems.filter(i => i.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat} className="mb-3">
                    <p className="text-[10px] font-bold text-muted-foreground mb-1">{groceryEmoji[cat]} {cat}</p>
                    {items.map(item => (
                      <div key={item.id} className="flex items-center gap-2 py-1 group">
                        <Checkbox checked={item.checked} onCheckedChange={() => setGroceryItems(prev => prev.map(i => i.id === item.id ? {...i, checked: !i.checked} : i))} />
                        <span className={`text-xs flex-1 ${item.checked ? "line-through text-muted-foreground" : ""}`}>{item.name}</span>
                        <button className="opacity-0 group-hover:opacity-100" onClick={() => setGroceryItems(prev => prev.filter(i => i.id !== item.id))}>
                          <Trash2 className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}

              {groceryItems.length > 0 && (
                <Button size="sm" variant="outline" className="w-full mt-2 text-xs" onClick={() => setGroceryItems(prev => prev.filter(i => !i.checked))}>
                  Limpar comprados ✓
                </Button>
              )}
              {groceryItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Lista vazia. Adicione seus itens! 🛒</p>}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dieta;
