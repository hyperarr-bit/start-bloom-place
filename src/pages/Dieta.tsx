import { useState, useEffect } from "react";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, X, Trash2, Check, Utensils, Clock,
  Apple, ChefHat, Calendar, Heart, Settings,
  ArrowUp, ArrowDown, Copy, Search, BookOpen,
  ShoppingCart, Send, UtensilsCrossed
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ModuleTip } from "@/components/ModuleTip";
import { Switch } from "@/components/ui/switch";

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
  const [activeTab, setActiveTab] = useState("cardapio");
  useScrollActiveTabIntoView(activeTab);
  const reportTab = useTabReporter();
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

  // FASTING
  const [fastingGoal, setFastingGoal] = usePersistedState("saude-fast-goal", 16);
  const [fastingStart, setFastingStart] = usePersistedState<string | null>("saude-fast-start", null);
  const [fastingElapsed, setFastingElapsed] = useState(0);

  // RECIPES
  const [recipes, setRecipes] = usePersistedState<{id: string; name: string; ingredients: string; instructions: string; category: string; favorite: boolean; prepTime: string; servings: string}[]>("dieta-recipes-v2", []);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [recipeForm, setRecipeForm] = useState({ name: "", ingredients: "", instructions: "", category: "Almoço", prepTime: "", servings: "", favorite: false });
  const [recipeFilter, setRecipeFilter] = useState("Todas");
  const [checkedIngredients, setCheckedIngredients] = usePersistedState<Record<string, string[]>>("dieta-recipe-checked", {});
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);

  // DIÁRIO v2
  const [diaryDate, setDiaryDate] = useState(today);
  const [diaryData, setDiaryData] = usePersistedState<Record<string, { meals: Record<string, { followed: boolean; note: string }>; extraFood: { had: boolean; description: string } }>>("dieta-diary-v2", {});

  // LISTA INTELIGENTE
  const [smartList, setSmartList] = usePersistedState<{ id: string; text: string; done: boolean }[]>("dieta-smart-list", []);
  const [newSmartItem, setNewSmartItem] = useState("");

  // Casa grocery sync
  const [casaGrocery, setCasaGrocery] = usePersistedState<any[]>("casa-grocery-categories", []);

  useEffect(() => {
    if (!fastingStart) { setFastingElapsed(0); return; }
    const interval = setInterval(() => {
      setFastingElapsed(Math.floor((Date.now() - new Date(fastingStart).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [fastingStart]);

  const startEditMeal = (day: string, meal: string) => { setEditingMeal(`${day}-${meal}`); setEditMealValue(mealPlan[day]?.[meal] || ""); };
  const saveMeal = (day: string, meal: string) => { setMealPlan({ ...mealPlan, [day]: { ...mealPlan[day], [meal]: editMealValue } }); setEditingMeal(null); };

  const formatTime = (secs: number) => { const h = Math.floor(secs / 3600); const m = Math.floor((secs % 3600) / 60); const s = secs % 60; return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`; };

  // Diary helpers
  const getDiaryDayName = (dateStr: string) => {
    const d = new Date(dateStr);
    const dayIndex = d.getDay() === 0 ? 6 : d.getDay() - 1;
    return weekDays[dayIndex];
  };

  const normalizeDiary = (d: any) => ({
    meals: (d && typeof d.meals === "object" && d.meals) ? d.meals : {},
    extraFood: {
      had: !!d?.extraFood?.had,
      description: d?.extraFood?.description ?? "",
    },
  });
  const getDayDiary = (dateStr: string) => normalizeDiary(diaryData[dateStr]);

  const updateDayDiary = (dateStr: string, updater: (prev: { meals: Record<string, { followed: boolean; note: string }>; extraFood: { had: boolean; description: string } }) => typeof prev extends never ? never : any) => {
    setDiaryData(prev => ({
      ...prev,
      [dateStr]: updater(normalizeDiary(prev[dateStr]))
    }));
  };

  const navigateDiaryDate = (offset: number) => {
    const d = new Date(diaryDate);
    d.setDate(d.getDate() + offset);
    setDiaryDate(d.toISOString().split("T")[0]);
  };

  const formatDateLabel = (dateStr: string) => {
    if (dateStr === today) return "Hoje";
    const d = new Date(dateStr);
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === yesterday.toISOString().split("T")[0]) return "Ontem";
    return d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
  };

  // Smart list: generate from meal plan
  const generateFromMealPlan = () => {
    const items: string[] = [];
    weekDays.forEach(day => {
      const dayMeals = mealPlan[day];
      if (!dayMeals) return;
      Object.values(dayMeals).forEach(desc => {
        if (desc && desc.trim()) {
          desc.split(/[,\n+]/).forEach(item => {
            const clean = item.trim().toLowerCase();
            if (clean && !items.includes(clean)) items.push(clean);
          });
        }
      });
    });
    const newItems = items.filter(item => !smartList.some(s => s.text.toLowerCase() === item));
    if (newItems.length > 0) {
      setSmartList(prev => [...prev, ...newItems.map(text => ({ id: Date.now().toString() + Math.random(), text, done: false }))]);
    }
  };

  const generateFromRecipes = () => {
    const items: string[] = [];
    recipes.filter(r => r.favorite).forEach(r => {
      if (r.ingredients) {
        r.ingredients.split("\n").forEach(line => {
          const clean = line.trim().toLowerCase();
          if (clean && !items.includes(clean)) items.push(clean);
        });
      }
    });
    const newItems = items.filter(item => !smartList.some(s => s.text.toLowerCase() === item));
    if (newItems.length > 0) {
      setSmartList(prev => [...prev, ...newItems.map(text => ({ id: Date.now().toString() + Math.random(), text, done: false }))]);
    }
  };

  const sendToCasa = () => {
    const pendingItems = smartList.filter(i => !i.done);
    if (pendingItems.length === 0) return;
    setCasaGrocery((prev: any[]) => {
      const updated = [...prev];
      // Find or create "Dieta" category
      let dietaCat = updated.find(c => c.name === "Dieta");
      if (!dietaCat) {
        dietaCat = { id: "dieta-auto", name: "Dieta", emoji: "🥗", color: "bg-green-500", items: [] };
        updated.push(dietaCat);
      }
      const existingTexts = dietaCat.items.map((i: any) => i.text.toLowerCase());
      const newItems = pendingItems.filter(i => !existingTexts.includes(i.text.toLowerCase()));
      dietaCat.items = [...dietaCat.items, ...newItems.map(i => ({ id: Date.now().toString() + Math.random(), text: i.text, done: false }))];
      return updated.map(c => c.id === dietaCat!.id ? dietaCat! : c);
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}><ArrowLeft className="w-5 h-5" /></Button>
          <Apple className="w-5 h-5 text-green-600" />
          <div>
            <h1 className="text-base font-bold tracking-tight">DIETA</h1>
            <p className="text-[11px] text-muted-foreground">Cardápio, jejum, receitas e diário</p>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          {[
            { id: "cardapio", label: "CARDÁPIO", icon: "🍽️" },
            { id: "jejum", label: "JEJUM", icon: "⏱️" },
            { id: "receitas", label: "RECEITAS", icon: "👩‍🍳" },
            { id: "lista", label: "LISTA", icon: "🛒" },
            { id: "diario", label: "DIÁRIO", icon: "📊" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); reportTab?.(tab.id); }}
              className={`notion-tab whitespace-nowrap text-[11px] flex items-center gap-1 ${activeTab === tab.id ? "notion-tab-active" : "hover:bg-muted"}`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        <ModuleTip
          moduleId="dieta"
          tips={[
            "Configure suas refeições clicando em ⚙️ no cardápio (adicione ou remova refeições)",
            "No cardápio semanal, clique em cada refeição para adicionar o que vai comer",
            "Use o 📊 DIÁRIO para registrar o que você comeu de verdade e compare com o plano"
          ]}
        />
          {activeTab === "cardapio" && <div className="space-y-4">
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
          </div>}

          {/* ========== JEJUM ========== */}
          {activeTab === "jejum" && <div className="space-y-4">
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-500/10 dark:to-amber-500/10 rounded-xl border border-orange-200 p-4 text-center dark:border-orange-500/20">
              <h3 className="text-xs font-bold mb-3 flex items-center justify-center gap-2"><Clock className="w-4 h-4 text-orange-500" /> JEJUM INTERMITENTE</h3>
              <div className="flex justify-center gap-2 mb-4">
                {[16, 18, 20, 24].map(h => (
                  <button key={h} onClick={() => setFastingGoal(h)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${fastingGoal === h ? "bg-orange-500 text-white border-orange-500" : "border-border"}`}>
                    {h}:{24 - h}
                  </button>
                ))}
              </div>
              <div className="w-44 h-44 mx-auto rounded-full border-8 border-orange-200 flex items-center justify-center mb-4 relative dark:border-orange-500/20">
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
          </div>}

          {/* ========== RECEITAS ========== */}
          {activeTab === "receitas" && <div className="space-y-4">
            {/* Category filter chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {["Todas", "Café", "Almoço", "Janta", "Lanche", "Doce Fit", "Fitness", "Salgado", "Shake", "Receita Rápida"].map(cat => (
                <button
                  key={cat}
                  onClick={() => setRecipeFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap border transition-colors ${
                    recipeFilter === cat
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold flex items-center gap-2"><ChefHat className="w-4 h-4" /> MINHAS RECEITAS</h3>
              <Button size="sm" onClick={() => setShowRecipeForm(true)}><Plus className="w-3 h-3 mr-1" /> Nova</Button>
            </div>

            {showRecipeForm && (() => {
              const catColors: Record<string, string> = {
                "Café": "border-l-amber-400", "Almoço": "border-l-green-400", "Janta": "border-l-blue-400",
                "Lanche": "border-l-orange-400", "Doce Fit": "border-l-pink-400", "Fitness": "border-l-purple-400",
                "Salgado": "border-l-red-400", "Shake": "border-l-cyan-400", "Receita Rápida": "border-l-emerald-400", "Sobremesa": "border-l-pink-400",
              };
              return (
                <div className={`bg-muted/30 rounded-lg p-3 border border-border border-l-4 ${catColors[recipeForm.category] || "border-l-primary"} mb-3 space-y-2`}>
                  <Input value={recipeForm.name} onChange={e => setRecipeForm(p => ({...p, name: e.target.value}))} placeholder="Nome da receita" className="text-xs h-8 font-bold" />
                  <div className="grid grid-cols-3 gap-2">
                    <Select value={recipeForm.category} onValueChange={v => setRecipeForm(p => ({...p, category: v}))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Café", "Almoço", "Janta", "Lanche", "Doce Fit", "Fitness", "Salgado", "Shake", "Receita Rápida"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input value={recipeForm.prepTime} onChange={e => setRecipeForm(p => ({...p, prepTime: e.target.value}))} placeholder="⏱ Tempo (20min)" className="text-xs h-8" />
                    <Input value={recipeForm.servings} onChange={e => setRecipeForm(p => ({...p, servings: e.target.value}))} placeholder="🍽 Porções" className="text-xs h-8" />
                  </div>
                  <Textarea value={recipeForm.ingredients} onChange={e => setRecipeForm(p => ({...p, ingredients: e.target.value}))} placeholder={"1 banana madura\n2 ovos\n3 col sopa de aveia\n1 scoop whey"} className="text-xs min-h-[80px]" />
                  <Textarea value={recipeForm.instructions} onChange={e => setRecipeForm(p => ({...p, instructions: e.target.value}))} placeholder={"Bata tudo no liquidificador\nDespeje na frigideira\nCozinhe 3min de cada lado"} className="text-xs min-h-[80px]" />
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => {
                      if (recipeForm.name.trim()) {
                        setRecipes(prev => [...prev, { id: Date.now().toString(), ...recipeForm }]);
                        setRecipeForm({ name: "", ingredients: "", instructions: "", category: "Almoço", prepTime: "", servings: "", favorite: false });
                        setShowRecipeForm(false);
                      }
                    }}>Salvar Receita</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowRecipeForm(false)}>Cancelar</Button>
                  </div>
                </div>
              );
            })()}

            {/* Recipe cards */}
            {(() => {
              const catColors: Record<string, { bg: string; border: string; darkBg: string; text: string }> = {
                "Café": { bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-l-amber-400", darkBg: "dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400" },
                "Almoço": { bg: "bg-green-50 dark:bg-green-500/10", border: "border-l-green-400", darkBg: "dark:bg-green-950/30", text: "text-green-700 dark:text-green-400" },
                "Janta": { bg: "bg-blue-50 dark:bg-blue-500/10", border: "border-l-blue-400", darkBg: "dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400" },
                "Lanche": { bg: "bg-orange-50 dark:bg-orange-500/10", border: "border-l-orange-400", darkBg: "dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400" },
                "Doce Fit": { bg: "bg-pink-50 dark:bg-pink-500/10", border: "border-l-pink-400", darkBg: "dark:bg-pink-950/30", text: "text-pink-700 dark:text-pink-400" },
                "Fitness": { bg: "bg-purple-50 dark:bg-purple-500/10", border: "border-l-purple-400", darkBg: "dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-400" },
                "Salgado": { bg: "bg-red-50 dark:bg-red-500/10", border: "border-l-red-400", darkBg: "dark:bg-red-950/30", text: "text-red-700 dark:text-red-400" },
                "Shake": { bg: "bg-cyan-50 dark:bg-cyan-500/10", border: "border-l-cyan-400", darkBg: "dark:bg-cyan-950/30", text: "text-cyan-700 dark:text-cyan-400" },
                "Receita Rápida": { bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-l-emerald-400", darkBg: "dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400" },
                "Sobremesa": { bg: "bg-pink-50 dark:bg-pink-500/10", border: "border-l-pink-400", darkBg: "dark:bg-pink-950/30", text: "text-pink-700 dark:text-pink-400" },
              };
              const defaultColor = { bg: "bg-muted/30", border: "border-l-primary", darkBg: "", text: "text-primary" };

              const filtered = recipes.filter(r => recipeFilter === "Todas" || r.category === recipeFilter);
              const favorites = filtered.filter(r => r.favorite);
              const others = filtered.filter(r => !r.favorite);
              const sorted = [...favorites, ...others];

              if (sorted.length === 0) return (
                <div className="text-center py-12">
                  <ChefHat className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-xs text-muted-foreground">
                    {recipeFilter !== "Todas" ? `Nenhuma receita em "${recipeFilter}"` : "Salve suas receitas favoritas aqui 🥗"}
                  </p>
                </div>
              );

              return (
                <div className="space-y-3">
                  {sorted.map(r => {
                    const colors = catColors[r.category] || defaultColor;
                    const isExpanded = expandedRecipe === r.id;
                    const ingredients = r.ingredients ? r.ingredients.split("\n").filter(l => l.trim()) : [];
                    const steps = r.instructions ? r.instructions.split("\n").filter(l => l.trim()) : [];
                    const checked = checkedIngredients[r.id] || [];

                    return (
                      <div key={r.id} className={`rounded-xl border border-border border-l-4 ${colors.border} ${colors.bg} ${colors.darkBg} overflow-hidden transition-all`}>
                        {/* Header */}
                        <div className="p-3 cursor-pointer" onClick={() => setExpandedRecipe(isExpanded ? null : r.id)}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="text-sm font-bold leading-tight">{r.name}</h4>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className={`text-[10px] font-bold ${colors.text}`}>{r.category}</span>
                                {r.prepTime && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    <Clock className="w-3 h-3" /> {r.prepTime}
                                  </span>
                                )}
                                {r.servings && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    <Utensils className="w-3 h-3" /> {r.servings} porções
                                  </span>
                                )}
                                {ingredients.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {checked.length}/{ingredients.length} ✓
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 ml-2">
                              <button onClick={e => { e.stopPropagation(); setRecipes(prev => prev.map(x => x.id === r.id ? {...x, favorite: !x.favorite} : x)); }}>
                                <Heart className={`w-4 h-4 ${r.favorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                              </button>
                              <button onClick={e => { e.stopPropagation(); setRecipes(prev => prev.filter(x => x.id !== r.id)); }}>
                                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div className="border-t border-border/50 p-3 space-y-3">
                            {/* Ingredients with checkboxes */}
                            {ingredients.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-muted-foreground mb-1.5">📝 INGREDIENTES</p>
                                <div className="space-y-1">
                                  {ingredients.map((ing, i) => {
                                    const isChecked = checked.includes(ing);
                                    return (
                                      <label key={i} className="flex items-center gap-2 cursor-pointer group">
                                        <Checkbox
                                          checked={isChecked}
                                          onCheckedChange={() => {
                                            setCheckedIngredients(prev => {
                                              const current = prev[r.id] || [];
                                              return {
                                                ...prev,
                                                [r.id]: isChecked ? current.filter(x => x !== ing) : [...current, ing]
                                              };
                                            });
                                          }}
                                        />
                                        <span className={`text-xs ${isChecked ? "line-through text-muted-foreground" : ""}`}>{ing}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Numbered steps */}
                            {steps.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-muted-foreground mb-1.5">👩‍🍳 MODO DE PREPARO</p>
                                <ol className="space-y-1.5">
                                  {steps.map((step, i) => (
                                    <li key={i} className="flex gap-2 text-xs">
                                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${colors.bg} ${colors.text} border`}>
                                        {i + 1}
                                      </span>
                                      <span className="pt-0.5">{step}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>}

          {/* ========== LISTA INTELIGENTE ========== */}
          {activeTab === "lista" && <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> LISTA INTELIGENTE</h3>
                <p className="text-[10px] text-muted-foreground">
                  {smartList.length > 0 ? `${smartList.filter(i => !i.done).length} itens pendentes` : "Gere a lista a partir do cardápio"}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="text-xs h-9 gap-1" onClick={generateFromMealPlan}>
                <Calendar className="w-3 h-3" /> Gerar do Cardápio
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-9 gap-1" onClick={generateFromRecipes}>
                <Heart className="w-3 h-3" /> Gerar das Favoritas
              </Button>
            </div>

            {/* Manual add */}
            <div className="flex gap-2">
              <Input
                value={newSmartItem}
                onChange={e => setNewSmartItem(e.target.value)}
                placeholder="Adicionar item manualmente..."
                className="text-xs h-9 flex-1"
                onKeyDown={e => {
                  if (e.key === "Enter" && newSmartItem.trim()) {
                    setSmartList(prev => [...prev, { id: Date.now().toString(), text: newSmartItem.trim(), done: false }]);
                    setNewSmartItem("");
                  }
                }}
              />
              <Button size="sm" className="h-9" onClick={() => {
                if (newSmartItem.trim()) {
                  setSmartList(prev => [...prev, { id: Date.now().toString(), text: newSmartItem.trim(), done: false }]);
                  setNewSmartItem("");
                }
              }}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Items list */}
            {smartList.length > 0 ? (
              <div className="bg-card rounded-xl border border-border p-3 space-y-1.5">
                {smartList.filter(i => !i.done).map(item => (
                  <div key={item.id} className="flex items-center gap-2 py-1 group">
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => setSmartList(prev => prev.map(i => i.id === item.id ? { ...i, done: true } : i))}
                    />
                    <span className="text-xs flex-1 capitalize">{item.text}</span>
                    <button onClick={() => setSmartList(prev => prev.filter(i => i.id !== item.id))} className="opacity-0 group-hover:opacity-100">
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
                {smartList.some(i => i.done) && (
                  <>
                    <div className="border-t border-border my-2" />
                    <p className="text-[10px] font-bold text-muted-foreground">COMPRADOS</p>
                    {smartList.filter(i => i.done).map(item => (
                      <div key={item.id} className="flex items-center gap-2 py-1 group">
                        <Checkbox
                          checked={true}
                          onCheckedChange={() => setSmartList(prev => prev.map(i => i.id === item.id ? { ...i, done: false } : i))}
                        />
                        <span className="text-xs flex-1 capitalize line-through text-muted-foreground">{item.text}</span>
                        <button onClick={() => setSmartList(prev => prev.filter(i => i.id !== item.id))} className="opacity-0 group-hover:opacity-100">
                          <X className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <ShoppingCart className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">Lista vazia</p>
                <p className="text-[10px] text-muted-foreground mt-1">Use os botões acima para gerar automaticamente</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs h-9 flex-1 gap-1" onClick={sendToCasa} disabled={smartList.filter(i => !i.done).length === 0}>
                <Send className="w-3 h-3" /> Enviar para Casa (Mercado)
              </Button>
              {smartList.length > 0 && (
                <Button variant="outline" size="sm" className="text-xs h-9 gap-1" onClick={() => setSmartList(prev => prev.filter(i => !i.done))}>
                  <Trash2 className="w-3 h-3" /> Limpar ✓
                </Button>
              )}
            </div>
          </div>}

          {/* ========== DIÁRIO v2 ========== */}
          {activeTab === "diario" && <div className="space-y-4">
            {/* Date navigation */}
            <div className="flex items-center justify-between bg-card rounded-xl border border-border p-3">
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigateDiaryDate(-1)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="text-center">
                <p className="text-sm font-bold">{formatDateLabel(diaryDate)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(diaryDate).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigateDiaryDate(1)} disabled={diaryDate >= today}>
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </Button>
            </div>

            {/* Meal checklist from plan */}
            {(() => {
              const dayName = getDiaryDayName(diaryDate);
              const dayMeals = mealPlan[dayName];
              const diary = getDayDiary(diaryDate);
              const plannedMeals = dayMeals ? Object.entries(dayMeals).filter(([, v]) => v && v.trim()) : [];
              const allFollowed = plannedMeals.length > 0 && plannedMeals.every(([meal]) => diary.meals[meal]?.followed);

              return (
                <>
                  {plannedMeals.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-muted-foreground">REFEIÇÕES PLANEJADAS ({dayName})</p>
                        {allFollowed && <Badge className="text-[10px] bg-green-500/10 text-green-600 border-green-300 dark:border-green-500/20">100% ✅</Badge>}
                      </div>
                      {plannedMeals.map(([meal, desc]) => {
                        const mealDiary = diary.meals[meal] || { followed: false, note: "" };
                        return (
                          <div key={meal} className={`bg-card rounded-xl border p-3 space-y-2 ${mealDiary.followed ? "border-green-300 dark:border-green-500/30" : "border-border"}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-xs font-bold">{mealEmojis[meal] || "🍽️"} {meal}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                              </div>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => updateDayDiary(diaryDate, prev => ({
                                    ...prev,
                                    meals: { ...prev.meals, [meal]: { ...mealDiary, followed: true, note: "" } }
                                  }))}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition-colors ${
                                    mealDiary.followed
                                      ? "bg-green-100 dark:bg-green-500/20 border-green-400 text-green-600"
                                      : "bg-muted/30 border-border text-muted-foreground hover:border-green-300 dark:border-green-500/20"
                                  }`}
                                >✅</button>
                                <button
                                  onClick={() => updateDayDiary(diaryDate, prev => ({
                                    ...prev,
                                    meals: { ...prev.meals, [meal]: { ...mealDiary, followed: false } }
                                  }))}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition-colors ${
                                    !mealDiary.followed && diary.meals[meal]
                                      ? "bg-red-100 dark:bg-red-500/20 border-red-400 text-red-600"
                                      : "bg-muted/30 border-border text-muted-foreground hover:border-red-300 dark:border-red-500/20"
                                  }`}
                                >❌</button>
                              </div>
                            </div>
                            {!mealDiary.followed && diary.meals[meal] && (
                              <Input
                                value={mealDiary.note}
                                onChange={e => updateDayDiary(diaryDate, prev => ({
                                  ...prev,
                                  meals: { ...prev.meals, [meal]: { ...mealDiary, note: e.target.value } }
                                }))}
                                placeholder="Por que não comeu?"
                                className="text-xs h-8"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-muted/30 rounded-xl border border-border p-4 text-center">
                      <UtensilsCrossed className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-xs text-muted-foreground">Nenhuma refeição planejada para {dayName}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Adicione refeições na aba Cardápio</p>
                    </div>
                  )}

                  {/* Extra food section */}
                  <div className="bg-card rounded-xl border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold">Comeu algo fora da dieta?</p>
                        <p className="text-[10px] text-muted-foreground">Registre qualquer "furo" sem culpa 😊</p>
                      </div>
                      <Switch
                        checked={diary.extraFood.had}
                        onCheckedChange={checked => updateDayDiary(diaryDate, prev => ({
                          ...prev,
                          extraFood: { ...prev.extraFood, had: checked, description: checked ? prev.extraFood.description : "" }
                        }))}
                      />
                    </div>
                    {diary.extraFood.had && (
                      <Input
                        value={diary.extraFood.description}
                        onChange={e => updateDayDiary(diaryDate, prev => ({
                          ...prev,
                          extraFood: { ...prev.extraFood, description: e.target.value }
                        }))}
                        placeholder="O que comeu? (ex: bolo na festa)"
                        className="text-xs h-8"
                      />
                    )}
                  </div>

                  {/* 7-day adherence */}
                  <div className="bg-card rounded-xl border border-border p-3">
                    <p className="text-[10px] font-bold text-muted-foreground mb-2">ADERÊNCIA — ÚLTIMOS 7 DIAS</p>
                    <div className="flex gap-1.5">
                      {Array.from({ length: 7 }, (_, i) => {
                        const d = new Date(); d.setDate(d.getDate() - (6 - i));
                        const dateStr = d.toISOString().split("T")[0];
                        const dayDiary = getDayDiary(dateStr);
                        const dayNameCheck = getDiaryDayName(dateStr);
                        const dayMealsCheck = mealPlan[dayNameCheck];
                        const planned = dayMealsCheck ? Object.entries(dayMealsCheck).filter(([, v]) => v && v.trim()) : [];
                        const allGood = planned.length > 0 && planned.every(([m]) => dayDiary.meals[m]?.followed);
                        const anyMarked = planned.some(([m]) => dayDiary.meals[m]);
                        return (
                          <div key={i} className="flex-1 text-center">
                            <div className={`w-full aspect-square rounded-lg flex items-center justify-center text-sm border ${
                              allGood ? "bg-green-100 dark:bg-green-500/20 border-green-300 text-green-600 dark:border-green-500/20" :
                              anyMarked ? "bg-red-100 dark:bg-red-500/20 border-red-300 text-red-600 dark:border-red-500/20" :
                              "bg-muted/30 border-border text-muted-foreground"
                            }`}>
                              {allGood ? "✅" : anyMarked ? "❌" : "—"}
                            </div>
                            <p className="text-[9px] text-muted-foreground mt-0.5">
                              {d.toLocaleDateString("pt-BR", { weekday: "narrow" })}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>}
        
      </main>
    </div>
  );
};

export default Dieta;
