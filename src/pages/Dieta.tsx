import { useState, useEffect, useRef } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, X, Trash2, Check, Utensils, Clock,
  TrendingUp, Target, Zap, Activity, Flame, Apple, ShoppingCart,
  ChefHat, Calendar, Star, BookOpen, Heart, Settings, Edit3,
  ArrowUp, ArrowDown, Copy, Search
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ModuleTip } from "@/components/ModuleTip";


const FOOD_DATABASE: { name: string; cal: number; prot: number; carb: number; fat: number; portion: string }[] = [
  { name: "Arroz branco", cal: 130, prot: 2.7, carb: 28, fat: 0.3, portion: "100g" },
  { name: "Feijão carioca", cal: 76, prot: 4.8, carb: 13.6, fat: 0.5, portion: "100g" },
  { name: "Frango grelhado", cal: 165, prot: 31, carb: 0, fat: 3.6, portion: "100g" },
  { name: "Ovo cozido", cal: 155, prot: 13, carb: 1.1, fat: 11, portion: "100g (2 un)" },
  { name: "Banana", cal: 89, prot: 1.1, carb: 23, fat: 0.3, portion: "1 un (100g)" },
  { name: "Pão francês", cal: 150, prot: 4, carb: 30, fat: 1.5, portion: "1 un (50g)" },
  { name: "Batata doce", cal: 86, prot: 1.6, carb: 20, fat: 0.1, portion: "100g" },
  { name: "Carne bovina (patinho)", cal: 219, prot: 35, carb: 0, fat: 7.3, portion: "100g" },
  { name: "Leite integral", cal: 60, prot: 3.2, carb: 4.7, fat: 3.3, portion: "200ml" },
  { name: "Queijo minas", cal: 264, prot: 17, carb: 3, fat: 20, portion: "100g" },
  { name: "Iogurte natural", cal: 61, prot: 3.5, carb: 4.7, fat: 3.3, portion: "170g" },
  { name: "Aveia em flocos", cal: 389, prot: 17, carb: 66, fat: 7, portion: "100g" },
  { name: "Maçã", cal: 52, prot: 0.3, carb: 14, fat: 0.2, portion: "1 un (130g)" },
  { name: "Whey Protein", cal: 120, prot: 24, carb: 3, fat: 1.5, portion: "1 scoop (30g)" },
  { name: "Amendoim torrado", cal: 567, prot: 26, carb: 16, fat: 49, portion: "100g" },
  { name: "Pasta de amendoim", cal: 588, prot: 25, carb: 20, fat: 50, portion: "100g" },
  { name: "Azeite de oliva", cal: 108, prot: 0, carb: 0, fat: 12, portion: "1 col sopa" },
  { name: "Brócolis cozido", cal: 35, prot: 2.4, carb: 7, fat: 0.4, portion: "100g" },
  { name: "Tomate", cal: 18, prot: 0.9, carb: 3.9, fat: 0.2, portion: "1 un (100g)" },
  { name: "Alface", cal: 15, prot: 1.4, carb: 2.9, fat: 0.2, portion: "100g" },
  { name: "Mandioca cozida", cal: 125, prot: 0.6, carb: 30, fat: 0.2, portion: "100g" },
  { name: "Macarrão cozido", cal: 131, prot: 5, carb: 25, fat: 1.1, portion: "100g" },
  { name: "Salmão grelhado", cal: 208, prot: 20, carb: 0, fat: 13, portion: "100g" },
  { name: "Atum em lata", cal: 116, prot: 26, carb: 0, fat: 0.8, portion: "100g" },
  { name: "Abacate", cal: 160, prot: 2, carb: 9, fat: 15, portion: "100g" },
  { name: "Granola", cal: 471, prot: 10, carb: 64, fat: 20, portion: "100g" },
  { name: "Tapioca", cal: 68, prot: 0, carb: 17, fat: 0, portion: "1 un (20g)" },
  { name: "Cuscuz", cal: 112, prot: 3, carb: 23, fat: 0.6, portion: "100g" },
  { name: "Mamão", cal: 40, prot: 0.5, carb: 10, fat: 0.1, portion: "100g" },
  { name: "Laranja", cal: 47, prot: 0.9, carb: 12, fat: 0.1, portion: "1 un (130g)" },
  { name: "Café com leite", cal: 45, prot: 2, carb: 5, fat: 1.5, portion: "200ml" },
  { name: "Pão integral", cal: 247, prot: 13, carb: 41, fat: 3.4, portion: "2 fatias" },
  { name: "Peito de peru", cal: 110, prot: 18, carb: 3, fat: 2.5, portion: "100g" },
  { name: "Requeijão", cal: 257, prot: 7, carb: 3, fat: 24, portion: "100g" },
  { name: "Pipoca (sem óleo)", cal: 31, prot: 1, carb: 6, fat: 0.4, portion: "1 xícara" },
  { name: "Melancia", cal: 30, prot: 0.6, carb: 8, fat: 0.2, portion: "100g" },
  { name: "Morango", cal: 32, prot: 0.7, carb: 8, fat: 0.3, portion: "100g" },
  { name: "Açaí (puro)", cal: 58, prot: 0.8, carb: 6, fat: 3.9, portion: "100g" },
  { name: "Castanha do Pará", cal: 656, prot: 14, carb: 12, fat: 66, portion: "100g" },
  { name: "Frango desfiado", cal: 165, prot: 31, carb: 0, fat: 3.6, portion: "100g" },
  { name: "Carne moída", cal: 250, prot: 26, carb: 0, fat: 15, portion: "100g" },
  { name: "Salada verde mista", cal: 20, prot: 1.5, carb: 3, fat: 0.3, portion: "100g" },
  { name: "Sopa de legumes", cal: 45, prot: 2, carb: 8, fat: 0.5, portion: "250ml" },
  { name: "Wrap integral", cal: 130, prot: 4, carb: 22, fat: 3, portion: "1 un" },
  { name: "Cottage", cal: 98, prot: 11, carb: 3.4, fat: 4.3, portion: "100g" },
];

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
  const [copyFromDay, setCopyFromDay] = useState<string | null>(null);
  const [copyTargetDays, setCopyTargetDays] = useState<string[]>([]);

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
  const [protGoal, setProtGoal] = usePersistedState("saude-prot-goal", 0);
  const [carbGoal, setCarbGoal] = usePersistedState("saude-carb-goal", 0);
  const [fatGoal, setFatGoal] = usePersistedState("saude-fat-goal", 0);
  const [dailyMeals, setDailyMeals] = usePersistedState<Record<string, {name: string; cal: number; prot: number; carb: number; fat: number}[]>>("saude-daily-meals", {});
  const todayMeals = dailyMeals[today] || [];
  const [newMealName, setNewMealName] = useState("");
  const [newMealCal, setNewMealCal] = useState("");
  const [newMealProt, setNewMealProt] = useState("");
  const [newMealCarb, setNewMealCarb] = useState("");
  const [newMealFat, setNewMealFat] = useState("");
  const [foodSearch, setFoodSearch] = useState("");
  const [showFoodSearch, setShowFoodSearch] = useState(false);

  // Auto-calc macro goals from calorie goal (30% prot, 40% carb, 30% fat)
  const autoCalcMacros = (kcal: number) => {
    setProtGoal(Math.round((kcal * 0.3) / 4));
    setCarbGoal(Math.round((kcal * 0.4) / 4));
    setFatGoal(Math.round((kcal * 0.3) / 9));
  };

  // WATER - removed (available in Saúde module)
  // FASTING
  const [fastingGoal, setFastingGoal] = usePersistedState("saude-fast-goal", 16);
  const [fastingStart, setFastingStart] = usePersistedState<string | null>("saude-fast-start", null);
  const [fastingElapsed, setFastingElapsed] = useState(0);

  // RECIPES
  const [recipes, setRecipes] = usePersistedState<{id: string; name: string; ingredients: string; instructions: string; category: string; favorite: boolean; prepTime: string; servings: string}[]>("dieta-recipes-v2", []);
  const [newRecipeName, setNewRecipeName] = useState("");
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [recipeForm, setRecipeForm] = useState({ name: "", ingredients: "", instructions: "", category: "Almoço", prepTime: "", servings: "", favorite: false });
  const [recipeFilter, setRecipeFilter] = useState("Todas");
  const [checkedIngredients, setCheckedIngredients] = usePersistedState<Record<string, string[]>>("dieta-recipe-checked", {});
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);

  // GROCERY LIST
  const [groceryItems, setGroceryItems] = usePersistedState<{id: string; name: string; category: string; checked: boolean}[]>("dieta-grocery", []);
  const [newGroceryItem, setNewGroceryItem] = useState("");
  const [groceryCategory, setGroceryCategory] = useState("Proteínas");

  // MEAL FAVORITES
  const [favoriteMeals, setFavoriteMeals] = usePersistedState<{id: string; name: string; cal: number; prot: number; carb: number; fat: number}[]>("dieta-favorites", []);

  // BMI removed — now in Saúde module

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
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2"><h1 className="text-lg font-bold tracking-tight flex items-center gap-2"><Apple className="w-5 h-5 text-green-600" /> DIETA</h1></h1>
            <p className="text-xs text-muted-foreground">Cardápio, calorias, jejum e receitas</p>
          </div>
          <div className="flex items-center gap-2">
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
            "Na aba 🔥 CALORIAS, registre o que comeu e acompanhe macros"
          ]}
        />
        <Tabs defaultValue="cardapio" className="w-full">
          <TabsList className="w-full flex overflow-x-auto gap-1 bg-muted/50 p-1 mb-4 h-auto flex-wrap">
            <TabsTrigger value="cardapio" className="text-xs px-3 py-1.5">🍽️ CARDÁPIO</TabsTrigger>
            <TabsTrigger value="calorias" className="text-xs px-3 py-1.5">🔥 CALORIAS</TabsTrigger>
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
              <div className="bg-muted/30 rounded-xl border border-border p-3 space-y-3">
                <p className="text-[10px] font-bold text-muted-foreground">CONFIGURAR REFEIÇÕES (arraste a ordem)</p>
                <div className="space-y-1.5">
                  {meals.map((meal, i) => (
                    <div key={meal} className="flex items-center gap-1.5 bg-card rounded-lg border border-border px-2 py-1.5">
                      <div className="flex flex-col gap-0.5">
                        <button
                          disabled={i === 0}
                          onClick={() => setMeals(prev => { const n = [...prev]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          disabled={i === meals.length - 1}
                          onClick={() => setMeals(prev => { const n = [...prev]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; return n; })}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-xs flex-1">{mealEmojis[meal] || "🍽️"} {meal}</span>
                      {meals.length > 2 && (
                        <button onClick={() => setMeals(prev => prev.filter(m => m !== meal))} className="text-muted-foreground hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {/* Quick add from presets */}
                <div className="flex gap-1.5">
                  <Select value="" onValueChange={v => {
                    if (v && !meals.includes(v)) { setMeals(prev => [...prev, v]); }
                  }}>
                    <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Sugestões rápidas..." /></SelectTrigger>
                    <SelectContent>
                      {availableMeals.filter(m => !meals.includes(m)).map(m => (
                        <SelectItem key={m} value={m}>{defaultMealEmojis[m]} {m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Custom name */}
                <div className="flex gap-1.5">
                  <Input
                    value={newMealNameConfig}
                    onChange={e => setNewMealNameConfig(e.target.value)}
                    placeholder="Nome personalizado (ex: Pré-Treino Leve)"
                    className="text-xs h-7 flex-1"
                    onKeyDown={e => {
                      if (e.key === "Enter" && newMealNameConfig.trim() && !meals.includes(newMealNameConfig.trim())) {
                        setMeals(prev => [...prev, newMealNameConfig.trim()]);
                        setNewMealNameConfig("");
                      }
                    }}
                  />
                  <Button size="sm" className="h-7 px-2" onClick={() => {
                    if (newMealNameConfig.trim() && !meals.includes(newMealNameConfig.trim())) {
                      setMeals(prev => [...prev, newMealNameConfig.trim()]);
                      setNewMealNameConfig("");
                    }
                  }}><Plus className="w-3 h-3" /></Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {weekDays.map(day => (
                <div key={day} className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className={`${dayColors[day]} text-white p-3 font-bold text-sm text-center flex items-center justify-between`}>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          if (copyFromDay === day) { setCopyFromDay(null); setCopyTargetDays([]); }
                          else { setCopyFromDay(day); setCopyTargetDays([]); }
                        }}
                        className="p-1 rounded hover:bg-white/20 transition-colors flex items-center gap-0.5"
                        title="Copiar cardápio para outros dias"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-normal">Copiar</span>
                      </button>
                    </div>
                    <span className="flex-1 text-center">{day}</span>
                    <div className="flex gap-1">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="p-1 rounded hover:bg-white/20 transition-colors flex items-center gap-0.5"
                            title="Limpar cardápio deste dia"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-normal">Limpar</span>
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Limpar cardápio de {day}?</AlertDialogTitle>
                            <AlertDialogDescription>Todas as refeições deste dia serão removidas.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => {
                              setMealPlan(prev => {
                                const updated = { ...prev };
                                delete updated[day];
                                return updated;
                              });
                            }}>Limpar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {copyFromDay === day && (
                    <div className="p-2 bg-muted/50 border-b border-border space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground">Copiar para:</p>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox
                          checked={copyTargetDays.length === weekDays.length - 1}
                          onCheckedChange={(checked) => {
                            setCopyTargetDays(checked ? weekDays.filter(d => d !== day) : []);
                          }}
                        />
                        Todos
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        {weekDays.filter(d => d !== day).map(d => (
                          <label key={d} className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                            <Checkbox
                              checked={copyTargetDays.includes(d)}
                              onCheckedChange={(checked) => {
                                setCopyTargetDays(prev => checked ? [...prev, d] : prev.filter(x => x !== d));
                              }}
                            />
                            {d}
                          </label>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        className="w-full h-7 text-xs"
                        disabled={copyTargetDays.length === 0}
                        onClick={() => {
                          setMealPlan(prev => {
                            const updated = { ...prev };
                            copyTargetDays.forEach(targetDay => {
                              updated[targetDay] = { ...(prev[day] || {}) };
                            });
                            return updated;
                          });
                          setCopyFromDay(null);
                          setCopyTargetDays([]);
                        }}
                      >
                        Copiar ({copyTargetDays.length})
                      </Button>
                    </div>
                  )}

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
            {/* Macro Donut + Remaining */}
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Utensils className="w-4 h-4" /> CALORIAS E MACROS — {new Date().toLocaleDateString("pt-BR")}</h3>
              
              {/* Goals config */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-xs">Meta:</span>
                <Input type="number" value={calorieGoal} onChange={e => {
                  const v = Number(e.target.value);
                  setCalorieGoal(v);
                  if (protGoal === 0 && carbGoal === 0 && fatGoal === 0) autoCalcMacros(v);
                }} className="text-xs h-8 w-20" />
                <span className="text-xs text-muted-foreground">kcal</span>
                {protGoal === 0 && carbGoal === 0 && fatGoal === 0 && (
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => autoCalcMacros(calorieGoal)}>
                    Calcular macros
                  </Button>
                )}
              </div>

              {/* Macro goals (editable) */}
              {(protGoal > 0 || carbGoal > 0 || fatGoal > 0) && (
                <div className="flex gap-2 mb-4 text-[10px]">
                  <div className="flex items-center gap-1">
                    <span className="text-destructive font-bold">P:</span>
                    <Input type="number" value={protGoal} onChange={e => setProtGoal(Number(e.target.value))} className="h-6 w-14 text-[10px] px-1" />
                    <span className="text-muted-foreground">g</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-primary font-bold">C:</span>
                    <Input type="number" value={carbGoal} onChange={e => setCarbGoal(Number(e.target.value))} className="h-6 w-14 text-[10px] px-1" />
                    <span className="text-muted-foreground">g</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-600 font-bold">G:</span>
                    <Input type="number" value={fatGoal} onChange={e => setFatGoal(Number(e.target.value))} className="h-6 w-14 text-[10px] px-1" />
                    <span className="text-muted-foreground">g</span>
                  </div>
                </div>
              )}

              {/* Visual: Donut + Remaining card */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* SVG Donut */}
                <div className="flex items-center justify-center">
                  {(() => {
                    const total = totalProt * 4 + totalCarb * 4 + totalFat * 9;
                    const protPct = total > 0 ? (totalProt * 4 / total) * 100 : 33;
                    const carbPct = total > 0 ? (totalCarb * 4 / total) * 100 : 33;
                    const fatPct = total > 0 ? (totalFat * 9 / total) * 100 : 34;
                    const r = 40; const c = 2 * Math.PI * r;
                    const protLen = (protPct / 100) * c;
                    const carbLen = (carbPct / 100) * c;
                    const fatLen = (fatPct / 100) * c;
                    return (
                      <div className="relative w-28 h-28">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                          <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--destructive))" strokeWidth="8"
                            strokeDasharray={`${protLen} ${c - protLen}`} strokeDashoffset="0" />
                          <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth="8"
                            strokeDasharray={`${carbLen} ${c - carbLen}`} strokeDashoffset={`${-protLen}`} />
                          <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(45 93% 47%)" strokeWidth="8"
                            strokeDasharray={`${fatLen} ${c - fatLen}`} strokeDashoffset={`${-(protLen + carbLen)}`} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-lg font-bold">{totalCal}</span>
                          <span className="text-[9px] text-muted-foreground">kcal</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Remaining card */}
                <div className="space-y-2">
                  {(() => {
                    const calRemain = calorieGoal - totalCal;
                    const calColor = calRemain > 0 ? "text-green-600" : "text-destructive";
                    return (
                      <div className={`rounded-lg p-3 border ${calRemain > 0 ? "bg-green-50 dark:bg-green-500/10 border-green-200" : "bg-red-50 dark:bg-red-500/10 border-red-200"}`}>
                        <p className="text-[10px] text-muted-foreground font-bold">RESTANTE</p>
                        <p className={`text-xl font-bold ${calColor}`}>{calRemain > 0 ? calRemain : 0} kcal</p>
                        {calRemain < 0 && <p className="text-[10px] text-destructive font-bold">+{Math.abs(calRemain)} acima!</p>}
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-3 gap-1 text-[9px]">
                    <div className="text-center"><span className="text-destructive font-bold">{totalProt}g</span><br/>Prot</div>
                    <div className="text-center"><span className="text-primary font-bold">{totalCarb}g</span><br/>Carb</div>
                    <div className="text-center"><span className="text-yellow-600 font-bold">{totalFat}g</span><br/>Gord</div>
                  </div>
                </div>
              </div>

              {/* Macro progress bars */}
              {(protGoal > 0 || carbGoal > 0 || fatGoal > 0) && (
                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="w-8 text-destructive font-bold">Prot</span>
                    <Progress value={protGoal > 0 ? Math.min((totalProt / protGoal) * 100, 100) : 0} className="h-2 flex-1" />
                    <span className="text-muted-foreground w-16 text-right">{totalProt}/{protGoal}g</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="w-8 text-primary font-bold">Carb</span>
                    <Progress value={carbGoal > 0 ? Math.min((totalCarb / carbGoal) * 100, 100) : 0} className="h-2 flex-1" />
                    <span className="text-muted-foreground w-16 text-right">{totalCarb}/{carbGoal}g</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="w-8 text-yellow-600 font-bold">Gord</span>
                    <Progress value={fatGoal > 0 ? Math.min((totalFat / fatGoal) * 100, 100) : 0} className="h-2 flex-1" />
                    <span className="text-muted-foreground w-16 text-right">{totalFat}/{fatGoal}g</span>
                  </div>
                </div>
              )}

              {/* Import from menu */}
              {(() => {
                const todayDayName = weekDays[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
                const todayMenu = mealPlan[todayDayName];
                const hasMenu = todayMenu && Object.values(todayMenu).some(v => v && v.trim());
                if (!hasMenu) return null;
                return (
                  <Button size="sm" variant="outline" className="w-full mb-3 text-xs h-8" onClick={() => {
                    const items = Object.entries(todayMenu)
                      .filter(([, v]) => v && v.trim())
                      .map(([meal, desc]) => ({
                        name: `${meal}: ${desc}`,
                        cal: 0, prot: 0, carb: 0, fat: 0
                      }));
                    setDailyMeals({ ...dailyMeals, [today]: [...todayMeals, ...items] });
                  }}>
                    <Calendar className="w-3 h-3 mr-1" /> Importar do Cardápio de Hoje ({todayDayName})
                  </Button>
                );
              })()}

              {/* Food search / autocomplete */}
              <div className="mb-3">
                <div className="relative">
                  <Search className="absolute left-2 top-2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={foodSearch}
                    onChange={e => { setFoodSearch(e.target.value); setShowFoodSearch(true); }}
                    onFocus={() => setShowFoodSearch(true)}
                    placeholder="Buscar alimento (ex: frango, arroz, ovo...)"
                    className="text-xs h-8 pl-8"
                  />
                </div>
                {showFoodSearch && foodSearch.trim().length > 0 && (
                  <div className="bg-card border border-border rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                    {FOOD_DATABASE.filter(f => f.name.toLowerCase().includes(foodSearch.toLowerCase())).map((food, i) => (
                      <button
                        key={i}
                        className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b border-border last:border-0 transition-colors"
                        onClick={() => {
                          setDailyMeals({ ...dailyMeals, [today]: [...todayMeals, { name: `${food.name} (${food.portion})`, cal: food.cal, prot: food.prot, carb: food.carb, fat: food.fat }] });
                          setFoodSearch("");
                          setShowFoodSearch(false);
                        }}
                      >
                        <span className="text-xs font-medium">{food.name}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">({food.portion})</span>
                        <div className="text-[9px] text-muted-foreground">
                          {food.cal}kcal · {food.prot}P · {food.carb}C · {food.fat}G
                        </div>
                      </button>
                    ))}
                    {FOOD_DATABASE.filter(f => f.name.toLowerCase().includes(foodSearch.toLowerCase())).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">Nenhum alimento encontrado</p>
                    )}
                  </div>
                )}
              </div>

              {/* Quick add from favorites */}
              {favoriteMeals.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-muted-foreground mb-1">⭐ FAVORITOS — clique para adicionar:</p>
                  <div className="flex gap-1 flex-wrap">
                    {favoriteMeals.map(f => (
                      <button key={f.id} onClick={() => setDailyMeals({ ...dailyMeals, [today]: [...todayMeals, f] })}
                        className="px-2 py-1 rounded-lg bg-muted/50 border border-border text-[10px] hover:bg-muted transition-colors">
                        {f.name} ({f.cal}kcal)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual add */}
              <p className="text-[10px] font-bold text-muted-foreground mb-1">ADICIONAR MANUAL:</p>
              <div className="flex gap-1 mb-2 flex-wrap">
                <Input value={newMealName} onChange={e => setNewMealName(e.target.value)} placeholder="Refeição" className="text-xs h-8 flex-1 min-w-[100px]" />
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

              {/* Today's meals list */}
              {todayMeals.length > 0 && <p className="text-[10px] font-bold text-muted-foreground mt-3 mb-1">REFEIÇÕES DE HOJE:</p>}
              {todayMeals.map((m, i) => (
                <div key={i} className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-1.5 text-xs mb-1 border border-border">
                  <span className="font-medium flex-1 truncate">{m.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span>{m.cal}kcal</span>
                    <span className="text-destructive">{m.prot}P</span>
                    <span className="text-primary">{m.carb}C</span>
                    <span className="text-yellow-600">{m.fat}G</span>
                    <button onClick={() => {
                      if (!favoriteMeals.find(f => f.name === m.name)) setFavoriteMeals([...favoriteMeals, { id: Date.now().toString(), ...m }]);
                    }}><Star className="w-3 h-3 text-amber-400" /></button>
                    <button onClick={() => setDailyMeals({ ...dailyMeals, [today]: todayMeals.filter((_, j) => j !== i) })}><X className="w-3 h-3 text-muted-foreground" /></button>
                  </div>
                </div>
              ))}
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
                        <div className={`w-full rounded-t transition-all ${overGoal ? "bg-destructive" : cal > 0 ? "bg-green-400" : "bg-muted/30"}`}
                          style={{ height: `${Math.max(pct * 0.6, 4)}%` }} />
                        <span className="text-[7px] text-muted-foreground">{d.getDate()}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-green-400" /> Dentro da meta</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-destructive" /> Acima da meta</span>
                </div>
              </div>
            )}
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
