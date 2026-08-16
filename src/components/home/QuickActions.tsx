import { useState, useRef, useEffect } from "react";
import { localDayKey } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Droplets, DollarSign, Scale, Lightbulb, ListTodo, Heart, SmilePlus, X, Check, Dumbbell, Moon, Utensils, Shield } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const todayStr = () => localDayKey(); // dia LOCAL — toISOString virava amanhã depois das 21h (fix 16/07)

type ActionId = "water" | "expense" | "weight" | "idea" | "task" | "gratitude" | "mood" | "workout" | "sleep" | "meal" | "detox";

interface QuickAction {
  id: ActionId;
  icon: typeof Droplets;
  label: string;
  color: string;
  iconColor: string;
}

const actions: QuickAction[] = [
  { id: "water", icon: Droplets, label: "+ 200ml Água", color: "bg-cyan-400/20", iconColor: "text-cyan-600" },
  { id: "mood", icon: SmilePlus, label: "Check de Humor", color: "bg-pink-400/20", iconColor: "text-pink-600" },
  { id: "expense", icon: DollarSign, label: "Registrar Gasto", color: "bg-amber-400/20", iconColor: "text-amber-600" },
  { id: "weight", icon: Scale, label: "Pesar Agora", color: "bg-purple-400/20", iconColor: "text-purple-600" },
  { id: "workout", icon: Dumbbell, label: "Marcar Treino", color: "bg-orange-400/20", iconColor: "text-orange-600" },
  { id: "sleep", icon: Moon, label: "Registrar Sono", color: "bg-indigo-400/20", iconColor: "text-indigo-600" },
  { id: "meal", icon: Utensils, label: "Registrar Refeição", color: "bg-lime-400/20", iconColor: "text-lime-600" },
  { id: "idea", icon: Lightbulb, label: "Capturar Ideia", color: "bg-yellow-400/20", iconColor: "text-yellow-600" },
  { id: "task", icon: ListTodo, label: "Nova Tarefa", color: "bg-emerald-400/20", iconColor: "text-emerald-600" },
  { id: "gratitude", icon: Heart, label: "Gratidão do Dia", color: "bg-rose-400/20", iconColor: "text-rose-600" },
  { id: "detox", icon: Shield, label: "Check-in Detox", color: "bg-teal-400/20", iconColor: "text-teal-600" },
];

const moods = [
  { emoji: "😡", label: "Péssimo", value: 1 },
  { emoji: "😔", label: "Ruim", value: 2 },
  { emoji: "😐", label: "Neutro", value: 3 },
  { emoji: "🙂", label: "Bom", value: 4 },
  { emoji: "🤩", label: "Ótimo", value: 5 },
];

const expenseCategories = [
  "Alimentação", "Transporte", "Lazer", "Saúde", "Educação", "Compras", "Outros"
];

const vibrate = () => {
  if (navigator.vibrate) navigator.vibrate(30);
};

export const QuickActions = () => {
  const { get, set } = useUserData();
  const lifeData = useLifeHubData();
  const navigate = useNavigate();
  const [activeAction, setActiveAction] = useState<ActionId | null>(null);
  const [waterSplash, setWaterSplash] = useState(false);
  const [successId, setSuccessId] = useState<ActionId | null>(null);

  // Form states
  const [expenseValue, setExpenseValue] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Outros");
  const [weightValue, setWeightValue] = useState("");
  const [ideaText, setIdeaText] = useState("");
  const [taskText, setTaskText] = useState("");
  const [gratitudeText, setGratitudeText] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeAction && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeAction]);

  const handleAction = (id: ActionId) => {
    if (id === "water") {
      addWater();
    } else if (id === "workout") {
      markWorkout();
    } else if (id === "detox") {
      setActiveAction("detox");
    } else {
      setActiveAction(id);
    }
  };

  const showSuccess = (id: ActionId) => {
    setSuccessId(id);
    setTimeout(() => setSuccessId(null), 1500);
  };

  const addWater = () => {
    const tStr = todayStr();
    const waterLog = get<Record<string, number>>("core-saude-water", {});
    const waterLogModulo = get<Record<string, number>>("water-log", {});
    /*
     * 16/08 — dois defeitos que apareciam juntos aqui:
     *  1. cada chave era incrementada a partir do PRÓPRIO valor. Como quem
     *     lê usa o MAIOR das duas, elas desincronizavam e o contador pulava.
     *     Agora as duas partem do mesmo `current` e terminam no mesmo valor.
     *  2. o toast dizia 200ml CRAVADO, ignorando o tamanho de copo que a
     *     pessoa configurou no Saúde ("configurei 500ml e aqui diz 200").
     */
    const current = Math.max(waterLog[tStr] || 0, Number(waterLogModulo[tStr]) || 0);
    const proximo = Math.min(20, current + 1);
    set("core-saude-water", { ...waterLog, [tStr]: proximo });
    set("water-log", { ...waterLogModulo, [tStr]: proximo });
    const copoMl = Math.min(2000, Math.max(50, Math.round(Number(get<number>("core-saude-copo-ml", 250)) || 250)));
    vibrate();
    showSuccess("water");
    setWaterSplash(true);
    setTimeout(() => setWaterSplash(false), 800);
    const faltam = lifeData.waterGoal - proximo;
    toast.success(`💧 ${proximo * copoMl}ml — ${faltam > 0 ? `faltam ${faltam} copos` : "meta batida! 🎉"}`);
  };

  const markWorkout = () => {
    const tStr = todayStr();
    const log = get<string[]>("saude-workout-log", []);
    if (!log.includes(tStr)) {
      set("saude-workout-log", [...log, tStr]);
    }
    vibrate();
    showSuccess("workout");
    toast.success("💪 Treino do dia registrado!", { action: { label: "Ver Treino", onClick: () => navigate("/treino") } });
  };

  const submitExpense = () => {
    const amount = parseFloat(expenseValue.replace(",", "."));
    if (!amount || amount <= 0) { toast.error("Informe um valor válido"); return; }
    const expenses = get<any[]>("finance-expenses", []);
    const catMap: Record<string, string> = { "Alimentação": "alimentacao", "Transporte": "transporte", "Lazer": "lazer", "Saúde": "saude", "Educação": "educacao", "Compras": "outros", "Outros": "outros" };
    expenses.push({
      id: crypto.randomUUID(),
      description: expenseCategory,
      value: amount,
      category: catMap[expenseCategory] || "outros",
      date: todayStr(),
      paymentMethod: "pix",
    });
    set("finance-expenses", expenses);
    vibrate();
    showSuccess("expense");
    toast.success(`💸 R$ ${amount.toFixed(2)} em ${expenseCategory}`);
    setExpenseValue("");
    setExpenseCategory("Outros");
    setActiveAction(null);
  };

  const submitWeight = () => {
    const weight = parseFloat(weightValue.replace(",", "."));
    if (!weight || weight <= 0) { toast.error("Informe um peso válido"); return; }
    const tStr = todayStr();
    const measures = get<any[]>("core-saude-measures", []);
    measures.push({ date: tStr, weight, id: crypto.randomUUID() });
    set("core-saude-measures", measures);
    vibrate();
    showSuccess("weight");
    toast.success(`⚖️ ${weight}kg registrado!`);
    setWeightValue("");
    setActiveAction(null);
  };

  const submitIdea = () => {
    if (!ideaText.trim()) { toast.error("Digite sua ideia"); return; }
    const dateKey = todayStr();
    const allDays = get<Record<string, any>>("hiperfoco-thoughts", {});
    const dayData = allDays[dateKey] || {};
    const hour = new Date().getHours();
    const thoughts = dayData[hour] || [];
    thoughts.push({ id: crypto.randomUUID(), text: ideaText.trim(), tags: ["ideia"], hour });
    dayData[hour] = thoughts;
    set("hiperfoco-thoughts", { ...allDays, [dateKey]: dayData });
    vibrate();
    showSuccess("idea");
    toast.success("💡 Ideia capturada!", { action: { label: "Ver em Mente", onClick: () => navigate("/hiperfoco") } });
    setIdeaText("");
    setActiveAction(null);
  };

  const submitTask = () => {
    if (!taskText.trim()) { toast.error("Digite a tarefa"); return; }
    const taskId = crypto.randomUUID();
    const trimmed = taskText.trim();
    // Add to urgencies
    const urgencies = get<any[]>("rotina-urgencies", []);
    urgencies.push({ id: taskId, text: trimmed, done: false });
    set("rotina-urgencies", urgencies);
    // Also add to focus todo-list
    const todos = get<any[]>("todo-list", []);
    todos.push({ id: taskId, text: trimmed, priority: "alta", done: false });
    set("todo-list", todos);
    vibrate();
    showSuccess("task");
    toast.success("✅ Tarefa adicionada!", { action: { label: "Ver em Rotina", onClick: () => navigate("/rotina") } });
    setTaskText("");
    setActiveAction(null);
  };

  const submitGratitude = () => {
    if (!gratitudeText.trim()) { toast.error("Pelo que você é grato?"); return; }
    const tStr = todayStr();
    const gratLog = get<Record<string, string[]>>("core-gratitude-log", {});
    const todayEntries = gratLog[tStr] || [];
    todayEntries.push(gratitudeText.trim());
    set("core-gratitude-log", { ...gratLog, [tStr]: todayEntries });
    vibrate();
    showSuccess("gratitude");
    toast.success("🙏 Gratidão registrada!");
    setGratitudeText("");
    setActiveAction(null);
  };

  const submitMood = (value: number, emoji: string) => {
    const tStr = todayStr();
    const moodLog = get<Record<string, { value: number; emoji: string; time: string }>>("core-mood-log", {});
    moodLog[tStr] = { value, emoji, time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) };
    set("core-mood-log", moodLog);
    vibrate();
    showSuccess("mood");
    toast.success(`${emoji} Humor registrado!`);
    setActiveAction(null);
  };

  const submitSleep = () => {
    const hours = parseFloat(sleepHours.replace(",", "."));
    if (!hours || hours <= 0 || hours > 24) { toast.error("Informe horas válidas (1-24)"); return; }
    const tStr = todayStr();
    const sleepLog = get<Record<string, number>>("core-saude-sleep", {});
    set("core-saude-sleep", { ...sleepLog, [tStr]: hours });
    vibrate();
    showSuccess("sleep");
    toast.success(`🌙 ${hours}h de sono registradas!`, { action: { label: "Ver Saúde", onClick: () => navigate("/saude") } });
    setSleepHours("");
    setActiveAction(null);
  };

  const submitMealSelection = (mealType: string, food: string) => {
    const tStr = todayStr();
    const dietLog = get<Record<string, any>>("core-dieta-log", {});
    const dayMeals = dietLog[tStr] || {};
    const mealId = crypto.randomUUID();
    dayMeals[mealId] = { name: `${mealType}: ${food}`, calories: 0 };
    set("core-dieta-log", { ...dietLog, [tStr]: dayMeals });
    vibrate();
    showSuccess("meal");
    toast.success(`🍽️ ${mealType} registrado!`, { action: { label: "Ver Dieta", onClick: () => navigate("/dieta") } });
    setActiveAction(null);
  };

  const submitDetoxCheckin = (habitName: string) => {
    const tStr = todayStr();
    const habits = get<any[]>("detox-habits", []);
    const updated = habits.map((h: any) => {
      if (h.name === habitName) {
        const checkins = h.checkins || {};
        checkins[tStr] = (checkins[tStr] || 0) + 1;
        return { ...h, checkins };
      }
      return h;
    });
    set("detox-habits", updated);
    vibrate();
    showSuccess("detox");
    toast.success(`🛡️ Check-in: ${habitName}`, { action: { label: "Ver Detox", onClick: () => navigate("/detox") } });
    setActiveAction(null);
  };

  const close = () => setActiveAction(null);

  const detoxHabits = get<any[]>("detox-habits", []);

  return (
    <div className="space-y-2">
      {/* Action buttons row */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {actions.map((a, i) => (
          <motion.button
            key={a.id}
            onClick={() => handleAction(a.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors whitespace-nowrap flex-shrink-0 relative overflow-hidden ${
              successId === a.id 
                ? "border-green-400 bg-green-50 dark:bg-green-500/10" 
                : "border-border/50 bg-card hover:bg-muted/50"
            }`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i }}
            whileTap={{ scale: 0.95 }}
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${successId === a.id ? "bg-green-400/20" : a.color}`}>
              {successId === a.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <a.icon className={`w-3.5 h-3.5 ${a.iconColor}`} />}
            </div>
            <span className="text-[11px] font-medium">{successId === a.id ? "Feito!" : a.label}</span>

            {/* Water splash effect */}
            {a.id === "water" && waterSplash && (
              <motion.div
                className="absolute inset-0 bg-cyan-400/20 rounded-xl"
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.6 }}
              />
            )}
          </motion.button>
        ))}
      </div>

      {/* Inline forms */}
      <AnimatePresence>
        {activeAction && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-card rounded-2xl border border-border/50 p-3 shadow-sm">
              {/* Close button */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {actions.find(a => a.id === activeAction)?.label}
                </span>
                <button onClick={close} className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>

              {/* Expense form */}
              {activeAction === "expense" && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      type="text"
                      inputMode="decimal"
                      placeholder="R$ 0,00"
                      value={expenseValue}
                      onChange={e => setExpenseValue(e.target.value)}
                      className="h-9 text-sm flex-1"
                      onKeyDown={e => e.key === "Enter" && submitExpense()}
                    />
                    <button onClick={submitExpense} className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {expenseCategories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setExpenseCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                          expenseCategory === cat
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Weight form */}
              {activeAction === "weight" && (
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 75.5"
                    value={weightValue}
                    onChange={e => setWeightValue(e.target.value)}
                    className="h-9 text-sm flex-1"
                    onKeyDown={e => e.key === "Enter" && submitWeight()}
                  />
                  <span className="flex items-center text-xs text-muted-foreground font-medium">kg</span>
                  <button onClick={submitWeight} className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Idea form */}
              {activeAction === "idea" && (
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    placeholder="Sua ideia brilhante..."
                    value={ideaText}
                    onChange={e => setIdeaText(e.target.value)}
                    className="h-9 text-sm flex-1"
                    onKeyDown={e => e.key === "Enter" && submitIdea()}
                  />
                  <button onClick={submitIdea} className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Task form */}
              {activeAction === "task" && (
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    placeholder="O que precisa fazer?"
                    value={taskText}
                    onChange={e => setTaskText(e.target.value)}
                    className="h-9 text-sm flex-1"
                    onKeyDown={e => e.key === "Enter" && submitTask()}
                  />
                  <button onClick={submitTask} className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Gratitude form */}
              {activeAction === "gratitude" && (
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    placeholder="Pelo que você é grato agora?"
                    value={gratitudeText}
                    onChange={e => setGratitudeText(e.target.value)}
                    className="h-9 text-sm flex-1"
                    onKeyDown={e => e.key === "Enter" && submitGratitude()}
                  />
                  <button onClick={submitGratitude} className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Mood selector */}
              {activeAction === "mood" && (
                <div className="flex justify-between px-2">
                  {moods.map(m => (
                    <motion.button
                      key={m.value}
                      onClick={() => submitMood(m.value, m.emoji)}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-muted/50 transition-colors"
                      whileTap={{ scale: 1.3 }}
                    >
                      <span className="text-2xl">{m.emoji}</span>
                      <span className="text-[9px] text-muted-foreground font-medium">{m.label}</span>
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Sleep form */}
              {activeAction === "sleep" && (
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    type="text"
                    inputMode="decimal"
                    placeholder="Quantas horas dormiu?"
                    value={sleepHours}
                    onChange={e => setSleepHours(e.target.value)}
                    className="h-9 text-sm flex-1"
                    onKeyDown={e => e.key === "Enter" && submitSleep()}
                  />
                  <span className="flex items-center text-xs text-muted-foreground font-medium">h</span>
                  <button onClick={submitSleep} className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Meal selector from diet plan */}
              {activeAction === "meal" && (() => {
                const weekDayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
                const todayDay = weekDayNames[new Date().getDay()];
                const mealPlan = get<Record<string, Record<string, string>>>("saude-meals", {});
                const todayPlan = mealPlan[todayDay.toUpperCase()] || mealPlan[todayDay] || {};
                const mealEmojis: Record<string, string> = { "Café da Manhã": "🌅", "Almoço": "🍽️", "Lanche": "🍎", "Janta": "🌙", "Pré-Treino": "⚡", "Pós-Treino": "💪", "Ceia": "🌙", "Café da Tarde": "☕" };
                const entries = Object.entries(todayPlan).filter(([_, food]) => food && food.trim());
                
                if (entries.length === 0) {
                  return (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Nenhuma refeição planejada para hoje.{" "}
                      <button onClick={() => navigate("/dieta")} className="text-primary font-medium underline">Planejar em Dieta</button>
                    </p>
                  );
                }
                
                return (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground">Qual refeição você fez?</p>
                    {entries.map(([mealType, food]) => (
                      <motion.button
                        key={mealType}
                        onClick={() => submitMealSelection(mealType, food)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
                        whileTap={{ scale: 0.97 }}
                      >
                        <span className="text-base">{mealEmojis[mealType] || "🍴"}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium block">{mealType}</span>
                          <span className="text-[10px] text-muted-foreground truncate block">{food}</span>
                        </div>
                        <Check className="w-3.5 h-3.5 text-muted-foreground/50" />
                      </motion.button>
                    ))}
                  </div>
                );
              })()}

              {/* Detox check-in */}
              {activeAction === "detox" && (
                <div className="space-y-1.5">
                  {detoxHabits.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Nenhum hábito detox cadastrado.{" "}
                      <button onClick={() => navigate("/detox")} className="text-primary font-medium underline">Criar em Detox</button>
                    </p>
                  ) : (
                    detoxHabits.map((h: any) => (
                      <motion.button
                        key={h.name}
                        onClick={() => submitDetoxCheckin(h.name)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
                        whileTap={{ scale: 0.97 }}
                      >
                        <Shield className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                        <span className="text-xs font-medium truncate">{h.name}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {h.checkins?.[todayStr()] || 0}x hoje
                        </span>
                      </motion.button>
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
