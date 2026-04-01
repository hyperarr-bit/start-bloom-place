import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Droplets, DollarSign, Scale, Lightbulb, Timer, ListTodo, Heart, SmilePlus, X, Check } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const todayStr = () => new Date().toISOString().slice(0, 10);

type ActionId = "water" | "expense" | "weight" | "idea" | "focus" | "task" | "gratitude" | "mood";

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
  { id: "idea", icon: Lightbulb, label: "Capturar Ideia", color: "bg-yellow-400/20", iconColor: "text-yellow-600" },
  { id: "focus", icon: Timer, label: "Iniciar Foco", color: "bg-indigo-400/20", iconColor: "text-indigo-600" },
  { id: "task", icon: ListTodo, label: "Nova Tarefa", color: "bg-emerald-400/20", iconColor: "text-emerald-600" },
  { id: "gratitude", icon: Heart, label: "Gratidão do Dia", color: "bg-rose-400/20", iconColor: "text-rose-600" },
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
  const [activeAction, setActiveAction] = useState<ActionId | null>(null);
  const [waterSplash, setWaterSplash] = useState(false);

  // Form states
  const [expenseValue, setExpenseValue] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Outros");
  const [weightValue, setWeightValue] = useState("");
  const [ideaText, setIdeaText] = useState("");
  const [taskText, setTaskText] = useState("");
  const [gratitudeText, setGratitudeText] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeAction && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeAction]);

  const handleAction = (id: ActionId) => {
    if (id === "water") {
      addWater();
    } else if (id === "focus") {
      startFocus();
    } else {
      setActiveAction(id);
    }
  };

  const addWater = () => {
    const tStr = todayStr();
    const waterLog = get<Record<string, number>>("core-saude-water", {});
    const current = waterLog[tStr] || 0;
    set("core-saude-water", { ...waterLog, [tStr]: current + 1 });
    vibrate();
    setWaterSplash(true);
    setTimeout(() => setWaterSplash(false), 800);
    toast.success(`💧 ${(current + 1) * 200}ml — ${lifeData.waterGoal - current - 1 > 0 ? `faltam ${lifeData.waterGoal - current - 1} copos` : "meta batida! 🎉"}`);
  };

  const startFocus = () => {
    // Store focus start time so FocusTimerWidget picks it up
    set("core-focus-timer-start", Date.now());
    set("core-focus-timer-running", true);
    vibrate();
    toast.success("⏱️ Timer de foco iniciado — 25 minutos!");
  };

  const submitExpense = () => {
    const amount = parseFloat(expenseValue.replace(",", "."));
    if (!amount || amount <= 0) { toast.error("Informe um valor válido"); return; }
    const expenses = get<any[]>("core-expenses", []);
    expenses.push({
      id: crypto.randomUUID(),
      description: expenseCategory,
      amount,
      category: expenseCategory,
      date: todayStr(),
    });
    set("core-expenses", expenses);
    vibrate();
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
    toast.success(`⚖️ ${weight}kg registrado!`);
    setWeightValue("");
    setActiveAction(null);
  };

  const submitIdea = () => {
    if (!ideaText.trim()) { toast.error("Digite sua ideia"); return; }
    const ideas = get<any[]>("core-ideas", []);
    ideas.push({ id: crypto.randomUUID(), text: ideaText.trim(), date: todayStr(), time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) });
    set("core-ideas", ideas);
    vibrate();
    toast.success("💡 Ideia capturada!");
    setIdeaText("");
    setActiveAction(null);
  };

  const submitTask = () => {
    if (!taskText.trim()) { toast.error("Digite a tarefa"); return; }
    const tasks = get<any[]>("core-quick-tasks", []);
    tasks.push({ id: crypto.randomUUID(), text: taskText.trim(), done: false, date: todayStr() });
    set("core-quick-tasks", tasks);
    vibrate();
    toast.success("✅ Tarefa adicionada!");
    setTaskText("");
    setActiveAction(null);
  };

  const submitGratitude = () => {
    if (!gratitudeText.trim()) { toast.error("Pelo que você é grato?"); return; }
    const tStr = todayStr();
    const gratLog = get<Record<string, string[]>>("core-gratitude-log", {});
    const today = gratLog[tStr] || [];
    today.push(gratitudeText.trim());
    set("core-gratitude-log", { ...gratLog, [tStr]: today });
    vibrate();
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
    toast.success(`${emoji} Humor registrado!`);
    setActiveAction(null);
  };

  const close = () => setActiveAction(null);

  return (
    <div className="space-y-2">
      {/* Action buttons row */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {actions.map((a, i) => (
          <motion.button
            key={a.id}
            onClick={() => handleAction(a.id)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/50 bg-card hover:bg-muted/50 transition-colors whitespace-nowrap flex-shrink-0 relative overflow-hidden"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i }}
            whileTap={{ scale: 0.95 }}
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${a.color}`}>
              <a.icon className={`w-3.5 h-3.5 ${a.iconColor}`} />
            </div>
            <span className="text-[11px] font-medium">{a.label}</span>

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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
