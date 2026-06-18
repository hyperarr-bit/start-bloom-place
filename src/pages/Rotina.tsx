import { useState, useEffect, useRef, useCallback } from "react";
import { useSetTrackedTab } from "@/hooks/use-module-tracker";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAppNavigate } from "@/hooks/use-demo-mode";
import { ModuleTip } from "@/components/ModuleTip";
import { 
  ArrowLeft, Plus, X, Trash2, AlertTriangle, Play, Pause, RotateCcw, 
  Droplets, Moon, Sun, Brain, Target, Clock, Calendar, Star, Flame,
  ChevronLeft, ChevronRight, Edit3, Check, Heart, Zap, Coffee, BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";
import { useModuleCompletionFlow } from "@/hooks/use-module-completion-flow";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/ThemeToggle";

const days = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
const defaultHabits: string[] = [];

const hours = [
  "6:00", "7:00", "8:00", "9:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00",
  "20:00", "21:00", "22:00", "23:00", "0:00"
];

const defaultSchedule: Record<string, Record<string, string>> = Object.fromEntries(
  ["6:00", "7:00", "8:00", "9:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "0:00"].map(h => [
    h, { Segunda: "", Terça: "", Quarta: "", Quinta: "", Sexta: "", Sábado: "", Domingo: "" }
  ])
);

const motivationalQuotes = [
  "CUMPRA O QUE VOCÊ SE PROMETEU",
  "DISCIPLINA É LIBERDADE",
  "O SEGREDO É NÃO PARAR",
  "PEQUENOS PASSOS, GRANDES MUDANÇAS",
  "FOCO NO PROCESSO, NÃO NO RESULTADO",
  "HOJE É O DIA MAIS IMPORTANTE",
  "CONSISTÊNCIA VENCE INTENSIDADE",
  "SEJA MELHOR QUE ONTEM",
];

const moodEmojis = [
  { emoji: "😄", label: "Ótimo", color: "bg-green-400", value: 5 },
  { emoji: "🙂", label: "Bem", color: "bg-green-300", value: 4 },
  { emoji: "😐", label: "Neutro", color: "bg-yellow-300", value: 3 },
  { emoji: "😕", label: "Meh", color: "bg-orange-300", value: 2 },
  { emoji: "😞", label: "Ruim", color: "bg-red-300", value: 1 },
];

const getHabitName = (habit: unknown) => {
  if (typeof habit === "string") return habit;
  if (habit && typeof habit === "object" && "name" in habit) {
    const name = (habit as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) return name;
  }
  return "Hábito";
};

const defaultMorningRitual: { id: string; text: string; icon: string }[] = [];

const defaultNightRitual: { id: string; text: string; icon: string }[] = [];


const getDateKey = (d?: Date) => {
  const date = d || new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const getMonthDays = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

// ============= POMODORO COMPONENT =============
const PomodoroTimer = () => {
  const [mode, setMode] = useState<"focus" | "break" | "longBreak">("focus");
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessions, setSessions] = usePersistedState<number>("pomodoro-sessions-today", 0);
  const [totalFocusMin, setTotalFocusMin] = usePersistedState<number>("pomodoro-total-focus", 0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const durations = { focus: 25 * 60, break: 5 * 60, longBreak: 15 * 60 };

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
      if (mode === "focus") {
        setSessions(s => s + 1);
        setTotalFocusMin(t => t + 25);
        // Auto switch to break
        const nextMode = (sessions + 1) % 4 === 0 ? "longBreak" : "break";
        setMode(nextMode);
        setTimeLeft(durations[nextMode]);
      } else {
        setMode("focus");
        setTimeLeft(durations.focus);
      }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, timeLeft]);

  const switchMode = (m: "focus" | "break" | "longBreak") => {
    setIsRunning(false);
    setMode(m);
    setTimeLeft(durations[m]);
  };

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const progress = ((durations[mode] - timeLeft) / durations[mode]) * 100;

  const modeColors = { focus: "from-red-500 to-orange-500 dark:from-red-700 dark:to-orange-700", break: "from-green-400 to-emerald-500 dark:from-green-700 dark:to-emerald-700", longBreak: "from-blue-400 to-indigo-500 dark:from-blue-700 dark:to-indigo-700" };
  const modeLabels = { focus: "FOCO", break: "PAUSA", longBreak: "PAUSA LONGA" };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className={`bg-gradient-to-r ${modeColors[mode]} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-white" />
          <span className="font-bold text-sm text-white">POMODORO — {modeLabels[mode]}</span>
        </div>
        <span className="text-white text-xs font-medium">{sessions} sessões hoje • {totalFocusMin}min foco total</span>
      </div>
      <div className="p-6 flex flex-col items-center gap-4">
        <div className="flex gap-2">
          {(["focus", "break", "longBreak"] as const).map(m => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${mode === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              {modeLabels[m]}
            </button>
          ))}
        </div>

        <div className="relative w-40 h-40 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="70" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
            <circle cx="80" cy="80" r="70" fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeDasharray={440} strokeDashoffset={440 - (440 * progress) / 100} strokeLinecap="round" className="transition-all duration-1000" />
          </svg>
          <span className="text-4xl font-mono font-black">{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}</span>
        </div>

        <div className="flex gap-3">
          <Button size="sm" onClick={() => setIsRunning(!isRunning)} className="gap-2">
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isRunning ? "Pausar" : "Iniciar"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setIsRunning(false); setTimeLeft(durations[mode]); }}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex gap-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`w-3 h-3 rounded-full ${i < (sessions % 4) ? "bg-red-500" : "bg-muted"}`} />
          ))}
        </div>
      </div>
    </div>
  );
};

// ============= MOOD TRACKER =============
const MoodTracker = () => {
  const [moodLog, setMoodLog] = usePersistedState<Record<string, { mood: number; note: string }>>("mood-log", {});
  const today = getDateKey();
  const todayMood = moodLog[today];
  const [note, setNote] = useState(todayMood?.note || "");

  const logMood = (value: number) => {
    setMoodLog(prev => ({ ...prev, [today]: { mood: value, note: prev[today]?.note || "" } }));
  };

  const saveNote = () => {
    if (todayMood) {
      setMoodLog(prev => ({ ...prev, [today]: { ...prev[today], note } }));
    }
  };

  // Last 7 days
  const last7 = [...Array(7)].map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = getDateKey(d);
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return { key, dayName: dayNames[d.getDay()], mood: moodLog[key]?.mood };
  });

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="bg-gradient-to-r from-purple-400 to-pink-400 dark:from-purple-700 dark:to-pink-700 px-4 py-3 flex items-center gap-2">
        <Heart className="w-4 h-4 text-white" />
        <span className="font-bold text-sm text-white">COMO VOCÊ ESTÁ HOJE?</span>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex justify-center gap-3">
          {moodEmojis.map(m => (
            <button
              key={m.value}
              onClick={() => logMood(m.value)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${todayMood?.mood === m.value ? "bg-primary/10 ring-2 ring-primary scale-110" : "hover:bg-muted"}`}
            >
              <span className="text-2xl">{m.emoji}</span>
              <span className="text-[10px] text-muted-foreground">{m.label}</span>
            </button>
          ))}
        </div>

        {todayMood && (
          <div className="flex gap-2">
            <Input
              placeholder="O que aconteceu hoje? (opcional)"
              value={note}
              onChange={e => setNote(e.target.value)}
              onBlur={saveNote}
              onKeyDown={e => e.key === "Enter" && saveNote()}
              className="text-xs h-8"
            />
          </div>
        )}

        <div className="flex items-end justify-between gap-1 h-16">
          {last7.map(d => (
            <div key={d.key} className="flex flex-col items-center gap-1 flex-1">
              <div className={`w-full rounded-sm transition-all ${d.mood ? `h-${d.mood * 3}` : "h-1"}`} 
                style={{ height: d.mood ? `${d.mood * 10}px` : "4px", backgroundColor: d.mood ? `hsl(${(d.mood - 1) * 30}, 70%, 55%)` : "hsl(var(--muted))" }} 
              />
              <span className="text-[9px] text-muted-foreground">{d.dayName}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============= WATER & SLEEP TRACKER =============
const HealthTracker = () => {
  const today = getDateKey();
  const [waterLog, setWaterLog] = usePersistedState<Record<string, number>>("water-log", {});
  const [sleepLog, setSleepLog] = usePersistedState<Record<string, number>>("sleep-log", {});
  const [sleepInput, setSleepInput] = useState(String(sleepLog[today] || ""));
  const waterGoal = 8;
  const waterToday = waterLog[today] || 0;
  const sleepToday = sleepLog[today] || 0;

  const addWater = () => setWaterLog(prev => ({ ...prev, [today]: Math.min((prev[today] || 0) + 1, 15) }));
  const removeWater = () => setWaterLog(prev => ({ ...prev, [today]: Math.max((prev[today] || 0) - 1, 0) }));
  const saveSleep = (val: string) => {
    const n = parseFloat(val);
    if (!isNaN(n) && n >= 0 && n <= 24) {
      setSleepLog(prev => ({ ...prev, [today]: n }));
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="bg-gradient-to-r from-cyan-400 to-blue-500 dark:from-cyan-700 dark:to-blue-700 px-4 py-3 flex items-center gap-2">
        <Droplets className="w-4 h-4 text-white" />
        <span className="font-bold text-sm text-white">SAÚDE DIÁRIA</span>
      </div>
      <div className="p-4 grid grid-cols-2 gap-4">
        {/* Water */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-blue-500" />
            <span className="font-bold text-xs">ÁGUA</span>
            <span className="text-xs text-muted-foreground ml-auto">{waterToday}/{waterGoal} copos</span>
          </div>
          <Progress value={(waterToday / waterGoal) * 100} className="h-2" />
          <div className="flex flex-wrap gap-1">
            {[...Array(waterGoal)].map((_, i) => (
              <div key={i} className={`w-6 h-8 rounded-md border flex items-center justify-center text-sm transition-colors ${i < waterToday ? "bg-blue-100 dark:bg-[hsl(210,60%,16%)] border-blue-300 dark:border-[hsl(210,60%,30%)] text-blue-600 dark:text-blue-300" : "bg-muted/30 border-border text-muted-foreground/30"}`}>
                💧
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={removeWater} className="h-7 text-xs flex-1">−</Button>
            <Button size="sm" onClick={addWater} data-spotlight="add-water" className="h-7 text-xs flex-1 bg-blue-500 hover:bg-blue-600">+ Copo</Button>
          </div>
        </div>

        {/* Sleep */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-indigo-500" />
            <span className="font-bold text-xs">SONO</span>
            <span className="text-xs text-muted-foreground ml-auto">{sleepToday}h</span>
          </div>
          <Progress value={(sleepToday / 8) * 100} className="h-2" />
          <div className="text-center py-2">
            <span className="text-3xl font-bold">{sleepToday || "—"}</span>
            <span className="text-sm text-muted-foreground ml-1">horas</span>
            <div className="text-[10px] text-muted-foreground mt-1">
              {sleepToday >= 7 ? "✅ Boa noite!" : sleepToday > 0 ? "⚠️ Durma mais!" : "Registre seu sono"}
            </div>
          </div>
          <Input
            type="number"
            step="0.5"
            min="0"
            max="24"
            placeholder="Horas dormidas"
            value={sleepInput}
            onChange={e => { setSleepInput(e.target.value); saveSleep(e.target.value); }}
            data-spotlight="add-sleep"
            className="h-7 text-xs"
          />
        </div>
      </div>
    </div>
  );
};

// ============= TODO LIST WITH PRIORITIES =============
const TodoList = () => {
  const [todos, setTodos] = usePersistedState<{ id: string; text: string; priority: "alta" | "media" | "baixa"; done: boolean; dueDate?: string }[]>("todo-list", []);
  const [newTodo, setNewTodo] = useState("");
  const [newPriority, setNewPriority] = useState<"alta" | "media" | "baixa">("media");
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");

  const addTodo = () => {
    if (!newTodo.trim()) return;
    setTodos(prev => [...prev, { id: Date.now().toString(), text: newTodo.trim(), priority: newPriority, done: false }]);
    setNewTodo("");
  };

  const toggleTodo = (id: string) => setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const removeTodo = (id: string) => setTodos(prev => prev.filter(t => t.id !== id));

  const priorityColors = {
    alta: "bg-red-100 dark:bg-[hsl(0,55%,16%)] text-red-700 dark:text-red-300 border-red-200 dark:border-[hsl(0,50%,30%)]",
    media: "bg-yellow-100 dark:bg-[hsl(45,55%,14%)] text-yellow-700 dark:text-yellow-200 border-yellow-200 dark:border-[hsl(45,55%,28%)]",
    baixa: "bg-blue-100 dark:bg-[hsl(210,55%,16%)] text-blue-700 dark:text-blue-300 border-blue-200 dark:border-[hsl(210,55%,30%)]",
  };
  const priorityDot = { alta: "bg-red-500", media: "bg-yellow-500", baixa: "bg-blue-500" };

  const filtered = todos
    .filter(t => filter === "all" || (filter === "active" && !t.done) || (filter === "done" && t.done))
    .sort((a, b) => {
      const order = { alta: 0, media: 1, baixa: 2 };
      if (a.done !== b.done) return a.done ? 1 : -1;
      return order[a.priority] - order[b.priority];
    });

  const doneCount = todos.filter(t => t.done).length;

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="bg-gradient-to-r from-violet-500 to-purple-600 dark:from-violet-700 dark:to-purple-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-white" />
          <span className="font-bold text-sm text-white">TAREFAS</span>
        </div>
        <span className="text-white/80 text-xs">{doneCount}/{todos.length} feitas</span>
      </div>
      <div className="p-3 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Nova tarefa..."
            value={newTodo}
            onChange={e => setNewTodo(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTodo()}
            className="h-8 text-xs flex-1"
          />
          <select
            value={newPriority}
            onChange={e => setNewPriority(e.target.value as "alta" | "media" | "baixa")}
            className="h-8 text-xs border border-input rounded-md px-2 bg-background text-foreground"
          >
            <option value="alta">🔴 Alta</option>
            <option value="media">🟡 Média</option>
            <option value="baixa">🔵 Baixa</option>
          </select>
          <Button size="sm" onClick={addTodo} data-spotlight="add-todo" className="h-8 text-xs">+</Button>
        </div>

        <div className="flex gap-1">
          {(["all", "active", "done"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {f === "all" ? "Todas" : f === "active" ? "Pendentes" : "Feitas"}
            </button>
          ))}
        </div>

        {todos.length > 0 && (
          <Progress value={(doneCount / todos.length) * 100} className="h-1.5" />
        )}

        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {filtered.map(t => (
            <div key={t.id} className={`flex items-center gap-2 p-2 rounded-md group transition-colors ${t.done ? "bg-muted/30 dark:bg-[hsl(var(--rt-card-2))]" : "bg-background dark:bg-[hsl(var(--rt-card))]"}`}>
              <div className={`w-2 h-2 rounded-full ${priorityDot[t.priority]}`} />
              <Checkbox checked={t.done} onCheckedChange={() => toggleTodo(t.id)} className="h-3.5 w-3.5" />
              <span className={`flex-1 text-xs ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.text}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded border ${priorityColors[t.priority]}`}>{t.priority}</span>
              <button onClick={() => removeTodo(t.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tarefa {filter === "done" ? "feita" : filter === "active" ? "pendente" : ""} ✨</p>}
        </div>
      </div>
    </div>
  );
};

// ============= RITUALS (MORNING & NIGHT) =============
const Rituals = () => {
  const today = getDateKey();
  const [morningItems, setMorningItems] = usePersistedState("ritual-morning-items", defaultMorningRitual);
  const [nightItems, setNightItems] = usePersistedState("ritual-night-items", defaultNightRitual);
  const [morningChecked, setMorningChecked] = usePersistedState<Record<string, string[]>>("ritual-morning-checked", {});
  const [nightChecked, setNightChecked] = usePersistedState<Record<string, string[]>>("ritual-night-checked", {});
  const [newMorning, setNewMorning] = useState("");
  const [newNight, setNewNight] = useState("");

  const toggleRitual = (type: "morning" | "night", id: string) => {
    const [checked, setChecked] = type === "morning" ? [morningChecked, setMorningChecked] : [nightChecked, setNightChecked];
    const todayChecked = checked[today] || [];
    setChecked({
      ...checked,
      [today]: todayChecked.includes(id) ? todayChecked.filter(x => x !== id) : [...todayChecked, id]
    });
  };

  const addRitual = (type: "morning" | "night") => {
    const [text, setText, items, setItems] = type === "morning" 
      ? [newMorning, setNewMorning, morningItems, setMorningItems] 
      : [newNight, setNewNight, nightItems, setNightItems];
    if (!text.trim()) return;
    setItems([...items, { id: Date.now().toString(), text: text.trim(), icon: "⭐" }]);
    setText("");
  };

  const removeRitual = (type: "morning" | "night", id: string) => {
    if (type === "morning") setMorningItems(prev => prev.filter(i => i.id !== id));
    else setNightItems(prev => prev.filter(i => i.id !== id));
  };

  const RitualList = ({ title, icon, gradient, items, checked, type, newText, setNewText }: any) => {
    const todayChecked = checked[today] || [];
    const progress = items.length > 0 ? (todayChecked.length / items.length) * 100 : 0;
    return (
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className={`bg-gradient-to-r ${gradient} px-4 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-bold text-sm text-white">{title}</span>
          </div>
          <span className="text-white/80 text-xs">{todayChecked.length}/{items.length}</span>
        </div>
        <div className="p-3 space-y-2">
          <Progress value={progress} className="h-1.5" />
          {items.map((item: any, i: number) => (
            <div key={item.id} className={`flex items-center gap-2 p-2 rounded-md group transition-all ${todayChecked.includes(item.id) ? "bg-green-50 dark:bg-[hsl(var(--rt-accent-soft))]" : ""}`}>
              <span className="text-sm">{item.icon}</span>
              <Checkbox checked={todayChecked.includes(item.id)} onCheckedChange={() => toggleRitual(type, item.id)} className="h-3.5 w-3.5" />
              <span className={`flex-1 text-xs ${todayChecked.includes(item.id) ? "line-through text-muted-foreground" : ""}`}>{item.text}</span>
              <button onClick={() => removeRitual(type, item.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Input
              placeholder="Adicionar passo..."
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addRitual(type)}
              className="h-7 text-xs flex-1"
            />
            <Button size="sm" variant="ghost" onClick={() => addRitual(type)} className="h-7 text-xs"><Plus className="w-3 h-3" /></Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {RitualList({ title: "RITUAL MATINAL", icon: <Sun className="w-4 h-4 text-white" />, gradient: "from-amber-400 to-orange-500 dark:from-amber-700 dark:to-orange-700", items: morningItems, checked: morningChecked, type: "morning", newText: newMorning, setNewText: setNewMorning })}
      {RitualList({ title: "RITUAL NOTURNO", icon: <Moon className="w-4 h-4 text-white" />, gradient: "from-indigo-500 to-purple-600 dark:from-indigo-700 dark:to-purple-800", items: nightItems, checked: nightChecked, type: "night", newText: newNight, setNewText: setNewNight })}
    </div>
  );
};


// ============= HABIT HEATMAP (GitHub Style) =============
const HabitHeatmap = ({ habitsChecked, habits, days: dayNames }: { habitsChecked: Record<string, boolean[]>; habits: string[]; days: string[] }) => {
  const [streakLog, setStreakLog] = usePersistedState<Record<string, boolean | number>>("heatmap-log", {});
  
  // Calculate if today has any habits done
  const today = new Date();
  const todayDayName = dayNames[today.getDay() === 0 ? 6 : today.getDay() - 1];
  const todayHabitsDone = (habitsChecked[todayDayName] || []).filter(Boolean).length;
  const todayKey = getDateKey();
  
  useEffect(() => {
    if (todayHabitsDone > 0) {
      setStreakLog(prev => ({ ...prev, [todayKey]: true }));
    }
  }, [todayHabitsDone]);

  // Last 16 weeks (112 days)
  const weeks: { date: Date; key: string; level: number }[][] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 111);

  const getLevel = (raw: boolean | number | undefined): number => {
    if (raw === true) return 2;
    if (typeof raw === "number") return Math.max(0, Math.min(3, Math.round(raw)));
    return 0;
  };

  let currentWeek: typeof weeks[0] = [];
  for (let i = 0; i < 112; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const key = getDateKey(d);
    if (d.getDay() === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push({ date: d, key, level: getLevel(streakLog[key]) });
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  // Calculate streak (any non-zero level counts)
  let streak = 0;
  const checkDate = new Date();
  while (true) {
    const key = getDateKey(checkDate);
    if (getLevel(streakLog[key]) > 0) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
    else break;
  }

  const getColor = (level: number) => {
    if (level >= 3) return "bg-[hsl(var(--rt-heat-3))]";
    if (level === 2) return "bg-[hsl(var(--rt-heat-2))]";
    if (level === 1) return "bg-[hsl(var(--rt-heat-1))]";
    return "bg-[hsl(var(--rt-heat-0))]";
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-700 dark:to-emerald-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-white" />
          <span className="font-bold text-sm text-white">CONSISTÊNCIA</span>
        </div>
        <div className="flex items-center gap-1 text-white">
          <Flame className="w-3 h-3" />
          <span className="text-xs font-bold">{streak} dias seguidos</span>
        </div>
      </div>
      <div className="p-4">
        <div className="flex gap-[3px] overflow-x-auto pb-2">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map(day => (
                <div
                  key={day.key}
                  className={`w-3 h-3 rounded-sm ${getColor(day.level)} transition-colors`}
                  title={`${day.key}: ${day.level > 0 ? "✅" : "—"}`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>Menos</span>
            <div className="w-3 h-3 rounded-sm bg-[hsl(var(--rt-heat-0))]" />
            <div className="w-3 h-3 rounded-sm bg-[hsl(var(--rt-heat-1))]" />
            <div className="w-3 h-3 rounded-sm bg-[hsl(var(--rt-heat-2))]" />
            <div className="w-3 h-3 rounded-sm bg-[hsl(var(--rt-heat-3))]" />
            <span>Mais</span>
          </div>
          <div className="text-xs text-muted-foreground">Últimas 16 semanas</div>
        </div>
      </div>
    </div>
  );
};

// ============= MONTHLY PLANNING =============
const MonthlyPlanning = () => {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [monthGoals, setMonthGoals] = usePersistedState<Record<string, { id: string; text: string; done: boolean }[]>>("month-goals", {});
  const [dayNotes, setDayNotes] = usePersistedState<Record<string, string>>("day-notes", {});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [newGoal, setNewGoal] = useState("");
  const [retroText, setRetroText] = usePersistedState<Record<string, string>>("month-retro", {});

  const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  const goals = monthGoals[monthKey] || [];
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const totalDays = getMonthDays(currentYear, currentMonth);
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  const addGoal = () => {
    if (!newGoal.trim()) return;
    const updated = [...goals, { id: Date.now().toString(), text: newGoal.trim(), done: false }];
    setMonthGoals(prev => ({ ...prev, [monthKey]: updated }));
    setNewGoal("");
  };

  const toggleGoal = (id: string) => {
    setMonthGoals(prev => ({
      ...prev,
      [monthKey]: (prev[monthKey] || []).map(g => g.id === id ? { ...g, done: !g.done } : g)
    }));
  };

  const removeGoal = (id: string) => {
    setMonthGoals(prev => ({ ...prev, [monthKey]: (prev[monthKey] || []).filter(g => g.id !== id) }));
  };

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  return (
    <div className="space-y-4">
      {/* Calendar */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="bg-gradient-to-r from-teal-500 to-cyan-500 dark:from-teal-700 dark:to-cyan-700 px-4 py-3 flex items-center justify-between">
          <button onClick={prevMonth} className="text-white hover:bg-white/20 rounded p-1"><ChevronLeft className="w-4 h-4" /></button>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-white" />
            <span className="font-bold text-sm text-white">{monthNames[currentMonth].toUpperCase()} {currentYear}</span>
          </div>
          <button onClick={nextMonth} className="text-white hover:bg-white/20 rounded p-1"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="p-3">
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
              <div key={d} className="text-[10px] font-bold text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {[...Array(firstDayOfWeek)].map((_, i) => <div key={`e${i}`} />)}
            {[...Array(totalDays)].map((_, i) => {
              const dayNum = i + 1;
              const dayKey = `${monthKey}-${String(dayNum).padStart(2, "0")}`;
              const hasNote = !!dayNotes[dayKey];
              const isToday = dayNum === now.getDate() && currentMonth === now.getMonth() && currentYear === now.getFullYear();
              const isSelected = selectedDay === dayKey;
              return (
                <button
                  key={dayNum}
                  onClick={() => setSelectedDay(isSelected ? null : dayKey)}
                  className={`aspect-square rounded-md text-xs font-medium flex items-center justify-center relative transition-all
                    ${isToday ? "bg-primary text-primary-foreground font-bold" : ""}
                    ${isSelected ? "ring-2 ring-primary" : ""}
                    ${!isToday && !isSelected ? "hover:bg-muted" : ""}
                  `}
                >
                  {dayNum}
                  {hasNote && <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-teal-500" />}
                </button>
              );
            })}
          </div>

          {selectedDay && (
            <div className="mt-3 p-3 bg-muted/30 rounded-md space-y-2">
              <span className="text-xs font-bold">📝 Notas — {selectedDay}</span>
              <Textarea
                placeholder="O que tem pra esse dia?"
                value={dayNotes[selectedDay] || ""}
                onChange={e => setDayNotes(prev => ({ ...prev, [selectedDay]: e.target.value }))}
                className="text-xs min-h-[60px]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Monthly Goals */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-yellow-500 dark:from-amber-700 dark:to-yellow-700 px-4 py-3 flex items-center gap-2">
          <Star className="w-4 h-4 text-white" />
          <span className="font-bold text-sm text-white">METAS DO MÊS</span>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex gap-2" data-spotlight="add-month-goal">
            <Input placeholder="Nova meta..." value={newGoal} onChange={e => setNewGoal(e.target.value)} onKeyDown={e => e.key === "Enter" && addGoal()} className="h-8 text-xs flex-1" />
            <Button size="sm" onClick={addGoal} className="h-8 text-xs">+</Button>
          </div>
          {goals.length > 0 && <Progress value={(goals.filter(g => g.done).length / goals.length) * 100} className="h-1.5" />}
          {goals.map(g => (
            <div key={g.id} className="flex items-center gap-2 group">
              <Checkbox checked={g.done} onCheckedChange={() => toggleGoal(g.id)} className="h-3.5 w-3.5" />
              <span className={`flex-1 text-xs ${g.done ? "line-through text-muted-foreground" : ""}`}>{g.text}</span>
              <button onClick={() => removeGoal(g.id)} className="opacity-0 group-hover:opacity-100 text-red-400"><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Retrospective */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="bg-gradient-to-r from-rose-500 to-pink-500 dark:from-rose-700 dark:to-pink-700 px-4 py-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-white" />
          <span className="font-bold text-sm text-white">RETROSPECTIVA DO MÊS</span>
        </div>
        <div className="p-3 space-y-2">
          <Textarea
            placeholder="O que funcionou? O que melhorar? Reflexões..."
            value={retroText[monthKey] || ""}
            onChange={e => setRetroText(prev => ({ ...prev, [monthKey]: e.target.value }))}
            className="text-xs min-h-[80px]"
          />
        </div>
      </div>
    </div>
  );
};

// ============= DAILY JOURNAL =============
const DailyJournal = () => {
  const [dayOffset, setDayOffset] = useState(0);
  const getDateForOffset = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d;
  };
  const selectedDate = getDateForOffset(dayOffset);
  const selectedKey = getDateKey(selectedDate);
  const isToday = dayOffset === 0;
  const [entries, setEntries] = usePersistedState<Record<string, { gratitude: string[]; learned: string; tomorrow: string }>>("journal-entries", {});
  const entry = entries[selectedKey] || { gratitude: ["", "", ""], learned: "", tomorrow: "" };

  const updateGratitude = (index: number, value: string) => {
    const newGratitude = [...entry.gratitude];
    newGratitude[index] = value;
    setEntries(prev => ({ ...prev, [selectedKey]: { ...entry, gratitude: newGratitude } }));
  };

  const updateField = (field: "learned" | "tomorrow", value: string) => {
    setEntries(prev => ({ ...prev, [selectedKey]: { ...entry, [field]: value } }));
  };

  const formatDate = (d: Date) => d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="bg-gradient-to-r from-pink-400 to-rose-500 dark:from-pink-700 dark:to-rose-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-white" />
          <span className="font-bold text-sm text-white">DIÁRIO DO DIA</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setDayOffset(prev => prev - 1)} className="p-1 rounded hover:bg-white/20 text-white"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-xs text-white font-medium min-w-[90px] text-center">
            {isToday ? "Hoje" : formatDate(selectedDate)}
          </span>
          <button onClick={() => setDayOffset(prev => Math.min(prev + 1, 0))} disabled={isToday} className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <span className="text-xs font-bold text-muted-foreground">🙏 3 GRATIDÕES DE HOJE</span>
          <div className="space-y-1.5 mt-2">
            {[0, 1, 2].map(i => (
              <Input
                key={i}
                placeholder={`Gratidão ${i + 1}...`}
                value={entry.gratitude[i] || ""}
                onChange={e => updateGratitude(i, e.target.value)}
                className="h-8 text-xs"
              />
            ))}
          </div>
        </div>
        <div>
          <span className="text-xs font-bold text-muted-foreground">💡 O QUE APRENDI HOJE</span>
          <Textarea
            placeholder="Algo novo que aprendi..."
            value={entry.learned}
            onChange={e => updateField("learned", e.target.value)}
            className="text-xs min-h-[50px] mt-2"
          />
        </div>
        <div>
          <span className="text-xs font-bold text-muted-foreground">🎯 PRIORIDADE PRA AMANHÃ</span>
          <Input
            placeholder="Qual a coisa mais importante pra amanhã?"
            value={entry.tomorrow}
            onChange={e => updateField("tomorrow", e.target.value)}
            className="h-8 text-xs mt-2"
          />
        </div>
      </div>
    </div>
  );
};

// ============= ENERGY TRACKER =============
const EnergyTracker = () => {
  const today = getDateKey();
  const [energyLog, setEnergyLog] = usePersistedState<Record<string, number[]>>("energy-log", {});
  const periods = ["Manhã", "Tarde", "Noite"];
  const periodIcons = [<Sun key="s" className="w-3 h-3" />, <Zap key="z" className="w-3 h-3" />, <Moon key="m" className="w-3 h-3" />];
  const todayEnergy = energyLog[today] || [0, 0, 0];

  const setEnergy = (periodIndex: number, value: number) => {
    const newEnergy = [...todayEnergy];
    newEnergy[periodIndex] = value;
    setEnergyLog(prev => ({ ...prev, [today]: newEnergy }));
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 dark:from-yellow-700 dark:to-orange-700 px-4 py-3 flex items-center gap-2">
        <Zap className="w-4 h-4 text-white" />
        <span className="font-bold text-sm text-white">NÍVEL DE ENERGIA</span>
      </div>
      <div className="p-4 space-y-3">
        {periods.map((period, pi) => (
          <div key={period} className="flex items-center gap-3">
            <div className="flex items-center gap-1 w-16 text-xs text-muted-foreground">
              {periodIcons[pi]}
              <span>{period}</span>
            </div>
            <div className="flex gap-1 flex-1">
              {[1, 2, 3, 4, 5].map(v => (
                <button
                  key={v}
                  onClick={() => setEnergy(pi, v)}
                  className={`flex-1 h-6 rounded-md text-[10px] font-bold transition-all ${v <= todayEnergy[pi] 
                    ? v <= 2 ? "bg-red-400 dark:bg-[hsl(0,65%,45%)] text-white" : v <= 3 ? "bg-yellow-400 dark:bg-[hsl(45,80%,45%)] text-white" : "bg-green-500 dark:bg-[hsl(var(--rt-accent))] text-white"
                    : "bg-muted text-muted-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}
        {todayEnergy.some(e => e > 0) && (
          <div className="text-center text-xs text-muted-foreground pt-1">
            Média: {(todayEnergy.filter(e => e > 0).reduce((a, b) => a + b, 0) / todayEnergy.filter(e => e > 0).length).toFixed(1)} ⚡
          </div>
        )}
      </div>
    </div>
  );
};

// ============= FOCUS ZONES (Time Blocking) =============
const FocusZones = () => {
  const [blocks, setBlocks] = usePersistedState<{ id: string; label: string; start: string; end: string; color: string; category: string }[]>("focus-blocks", [
    { id: "1", label: "Deep Work", start: "09:00", end: "12:00", color: "bg-red-100 dark:bg-[hsl(0,55%,14%)] border-red-300 dark:border-[hsl(0,55%,28%)]", category: "🧠 Foco Profundo" },
    { id: "2", label: "Admin / E-mails", start: "13:00", end: "14:00", color: "bg-blue-100 dark:bg-[hsl(210,55%,14%)] border-blue-300 dark:border-[hsl(210,55%,28%)]", category: "📧 Admin" },
    { id: "3", label: "Criativo", start: "14:00", end: "16:00", color: "bg-purple-100 dark:bg-[hsl(265,45%,16%)] border-purple-300 dark:border-[hsl(265,45%,30%)]", category: "🎨 Criativo" },
    { id: "4", label: "Exercício", start: "17:00", end: "18:00", color: "bg-green-100 dark:bg-[hsl(var(--rt-accent-soft))] border-green-300 dark:border-[hsl(142,50%,28%)]", category: "💪 Saúde" },
  ]);
  const [newLabel, setNewLabel] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");

  const colors = [
    "bg-red-100 dark:bg-[hsl(0,55%,14%)] border-red-300 dark:border-[hsl(0,55%,28%)]",
    "bg-blue-100 dark:bg-[hsl(210,55%,14%)] border-blue-300 dark:border-[hsl(210,55%,28%)]",
    "bg-purple-100 dark:bg-[hsl(265,45%,16%)] border-purple-300 dark:border-[hsl(265,45%,30%)]",
    "bg-green-100 dark:bg-[hsl(var(--rt-accent-soft))] border-green-300 dark:border-[hsl(142,50%,28%)]",
    "bg-yellow-100 dark:bg-[hsl(45,55%,14%)] border-yellow-300 dark:border-[hsl(45,55%,28%)]",
    "bg-pink-100 dark:bg-[hsl(330,45%,16%)] border-pink-300 dark:border-[hsl(330,45%,30%)]",
  ];

  const addBlock = () => {
    if (!newLabel.trim() || !newStart || !newEnd) return;
    setBlocks(prev => [...prev, { id: Date.now().toString(), label: newLabel.trim(), start: newStart, end: newEnd, color: colors[prev.length % colors.length], category: "📌 Outro" }]);
    setNewLabel(""); setNewStart(""); setNewEnd("");
  };

  const removeBlock = (id: string) => setBlocks(prev => prev.filter(b => b.id !== id));

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="bg-gradient-to-r from-slate-600 to-slate-800 dark:from-slate-700 dark:to-slate-900 px-4 py-3 flex items-center gap-2">
        <Clock className="w-4 h-4 text-white" />
        <span className="font-bold text-sm text-white">BLOCOS DE FOCO</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="space-y-2">
          {blocks.sort((a, b) => a.start.localeCompare(b.start)).map(b => (
            <div key={b.id} className={`flex items-center gap-3 p-2 rounded-md border ${b.color} group`}>
              <span className="text-xs font-mono font-bold w-24">{b.start} — {b.end}</span>
              <span className="text-xs font-medium flex-1">{b.label}</span>
              <span className="text-[10px] text-muted-foreground">{b.category}</span>
              <button onClick={() => removeBlock(b.id)} className="opacity-0 group-hover:opacity-100 text-red-500"><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Atividade" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="h-7 text-xs flex-1" />
          <Input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className="h-7 text-xs w-24" />
          <Input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="h-7 text-xs w-24" />
          <Button size="sm" onClick={addBlock} className="h-7 text-xs"><Plus className="w-3 h-3" /></Button>
        </div>
      </div>
    </div>
  );
};

// ============= WEEKLY REVIEW =============
const WeeklyReview = () => {
  const [weekOffset, setWeekOffset] = useState(0);
  const getWeekKeyForOffset = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset * 7);
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    return getDateKey(start);
  };
  const getWeekRange = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset * 7);
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (dt: Date) => dt.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
    return `${fmt(start)} — ${fmt(end)}`;
  };
  const isCurrentWeek = weekOffset === 0;
  const weekKey = getWeekKeyForOffset(weekOffset);
  const [reviews, setReviews] = usePersistedState<Record<string, { wins: string; improve: string; focus: string; rating: number }>>("weekly-reviews", {});
  const review = reviews[weekKey] || { wins: "", improve: "", focus: "", rating: 0 };

  const updateReview = (field: string, value: any) => {
    setReviews(prev => ({ ...prev, [weekKey]: { ...review, [field]: value } }));
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-700 dark:to-teal-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-white" />
          <span className="font-bold text-sm text-white">REVISÃO DA SEMANA</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setWeekOffset(prev => prev - 1)} className="p-1 rounded hover:bg-white/20 text-white"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-xs text-white font-medium min-w-[120px] text-center">
            {isCurrentWeek ? "Esta semana" : getWeekRange(weekOffset)}
          </span>
          <button onClick={() => setWeekOffset(prev => Math.min(prev + 1, 0))} disabled={isCurrentWeek} className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold">Nota da semana:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} onClick={() => updateReview("rating", s)} className={`text-lg transition-transform ${s <= review.rating ? "scale-110" : "opacity-30"}`}>
                ⭐
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-xs font-bold text-muted-foreground">🏆 VITÓRIAS DA SEMANA</span>
          <Textarea placeholder="O que conquistei..." value={review.wins} onChange={e => updateReview("wins", e.target.value)} className="text-xs min-h-[50px] mt-1" />
        </div>
        <div>
          <span className="text-xs font-bold text-muted-foreground">📈 O QUE MELHORAR</span>
          <Textarea placeholder="Onde posso melhorar..." value={review.improve} onChange={e => updateReview("improve", e.target.value)} className="text-xs min-h-[50px] mt-1" />
        </div>
        <div>
          <span className="text-xs font-bold text-muted-foreground">🎯 FOCO DA PRÓXIMA SEMANA</span>
          <Input placeholder="Prioridade #1 da semana que vem" value={review.focus} onChange={e => updateReview("focus", e.target.value)} className="h-8 text-xs mt-1" />
        </div>
      </div>
    </div>
  );
};


// ============= MAIN ROTINA COMPONENT =============
const Rotina = () => {
  const navigate = useAppNavigate();
  const [activeTab, setActiveTab] = useState("semana");
  const { onModuleComplete: onRotinaComplete, CompletionDialog: RotinaCompletionDialog } = useModuleCompletionFlow("rotina");
  useScrollActiveTabIntoView(activeTab);
  useSetTrackedTab(activeTab);
  const currentMonth = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // Habits state
  const [habits, setHabits] = usePersistedState<string[]>("rotina-habits", defaultHabits);
  const habitNames = Array.isArray(habits) ? habits.map(getHabitName) : [];
  const [habitsChecked, setHabitsChecked] = usePersistedState<Record<string, boolean[]>>(
    "rotina-habits-checked",
    Object.fromEntries(days.map(d => [d, defaultHabits.map(() => false)]))
  );

  // Schedule state
  const [schedule, setSchedule] = usePersistedState<Record<string, Record<string, string>>>("rotina-schedule", defaultSchedule);

  // Urgencies
  const [urgencies, setUrgencies] = usePersistedState<{ id: string; text: string; done: boolean }[]>("rotina-urgencies", []);
  const [newUrgency, setNewUrgency] = useState("");
  const [newHabit, setNewHabit] = useState("");
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [editingCell, setEditingCell] = useState<{ hour: string; day: string } | null>(null);
  const [editCellValue, setEditCellValue] = useState("");

  const toggleHabit = (day: string, habitIndex: number) => {
    const newChecked = { ...habitsChecked };
    if (!newChecked[day]) newChecked[day] = habitNames.map(() => false);
    newChecked[day] = [...newChecked[day]];
    newChecked[day][habitIndex] = !newChecked[day][habitIndex];
    setHabitsChecked(newChecked);
  };

  const addHabit = () => {
    if (!newHabit.trim()) return;
    setHabits([...habitNames, newHabit.trim()]);
    const newChecked = { ...habitsChecked };
    days.forEach(d => {
      if (!newChecked[d]) newChecked[d] = habitNames.map(() => false);
      newChecked[d] = [...newChecked[d], false];
    });
    setHabitsChecked(newChecked);
    setNewHabit("");
    setShowAddHabit(false);
  };

  const removeHabit = (index: number) => {
    const newHabits = habitNames.filter((_, i) => i !== index);
    setHabits(newHabits);
    const newChecked = { ...habitsChecked };
    days.forEach(d => { if (newChecked[d]) newChecked[d] = newChecked[d].filter((_, i) => i !== index); });
    setHabitsChecked(newChecked);
  };

  const startEditCell = (hour: string, day: string) => {
    setEditingCell({ hour, day });
    setEditCellValue(schedule[hour]?.[day] || "");
  };

  const saveEditCell = () => {
    if (editingCell) {
      const newSchedule = { ...schedule };
      if (!newSchedule[editingCell.hour]) newSchedule[editingCell.hour] = {};
      newSchedule[editingCell.hour] = { ...newSchedule[editingCell.hour], [editingCell.day]: editCellValue };
      setSchedule(newSchedule);
      setEditingCell(null);
    }
  };

  const addUrgency = () => {
    if (!newUrgency.trim()) return;
    setUrgencies([...urgencies, { id: Date.now().toString(), text: newUrgency.trim(), done: false }]);
    setNewUrgency("");
  };

  const toggleUrgency = (id: string) => setUrgencies(urgencies.map(u => u.id === id ? { ...u, done: !u.done } : u));
  const removeUrgency = (id: string) => setUrgencies(urgencies.filter(u => u.id !== id));

  const scheduleDays = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

  const quote = motivationalQuotes[new Date().getDay() % motivationalQuotes.length];

  const tabs = [
    { id: "semana", label: "MINHA SEMANA", icon: "📅" },
    { id: "mes", label: "MEU MÊS", icon: "📆" },
    { id: "diario", label: "DIÁRIO", icon: "📝" },
    { id: "revisao", label: "REVISÃO", icon: "⭐" },
    { id: "foco", label: "FOCO", icon: "🧠" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {RotinaCompletionDialog}
      <SpotlightOverlay
        moduleKey="rotina"
        onComplete={onRotinaComplete}
        steps={[
          { selector: '[data-spotlight="add-habit"]', label: "Crie 1 hábito (ex: 'estudar').", advanceOnAction: "first_habit", checkKey: "rotina-habits" },
          { selector: '[data-spotlight="weekly-schedule"]', label: "Toque numa célula da semana e escreva algo.", advanceOnAction: "first_schedule", checkKey: "rotina-schedule" },
          { selector: '[data-spotlight="tab-mes"]', label: 'Agora abra a aba "Meu Mês".' },
          { selector: '[data-spotlight="add-month-goal"]', label: "Cadastre 1 meta do mês.", advanceOnAction: "first_month_goal", checkKey: "month-goals" },
        ]}
      />
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="hover:bg-muted rounded-md p-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Calendar className="w-5 h-5 text-emerald-600" />
          <h1 className="text-base font-bold tracking-tight">ROTINA</h1>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-muted-foreground text-xs capitalize">{currentMonth}</span>
            <ThemeToggle />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id} data-active={activeTab === tab.id}
              data-spotlight={tab.id === "mes" ? "tab-mes" : undefined}
              onClick={() => setActiveTab(tab.id)}
              className={`notion-tab whitespace-nowrap text-[11px] flex items-center gap-1 ${activeTab === tab.id ? "notion-tab-active" : "hover:bg-muted"}`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        <ModuleTip
          moduleId="rotina"
          tips={[
            "Adicione seus hábitos diários e marque conforme concluir cada um",
            "Monte sua rotina semanal hora a hora na aba 📋 Agenda",
            "Crie rituais matinais e noturnos para automatizar seu dia",
            "Acompanhe seu humor diário e veja padrões ao longo do tempo"
          ]}
        />

        {/* ============= MINHA SEMANA ============= */}
        {activeTab === "semana" && (
          <>
            {/* Hábitos Diários */}
            <div className="bg-card rounded-lg border border-border overflow-hidden dark:bg-[hsl(var(--rt-card))] dark:border-[hsl(var(--rt-border))]">
              <div className="bg-green-100 dark:bg-[hsl(var(--rt-card))] border-b border-green-200 dark:border-[hsl(var(--rt-border))] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-green-900 dark:text-[hsl(var(--rt-text))]">HÁBITOS DIÁRIOS</span>
                  <span>✅</span>
                </div>
                <Button size="sm" variant="ghost" data-spotlight="add-habit" className="h-7 text-xs text-green-700 dark:text-[hsl(var(--rt-accent))]" onClick={() => setShowAddHabit(!showAddHabit)}>
                  <Plus className="w-3 h-3 mr-1" /> Hábito
                </Button>
              </div>

              {showAddHabit && (
                <div className="p-3 bg-green-50 dark:bg-[hsl(var(--rt-card-2))] border-b border-green-200 dark:border-[hsl(var(--rt-border))] flex gap-2">
                  <Input placeholder="Nome do hábito..." value={newHabit} onChange={(e) => setNewHabit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addHabit()} className="h-8 text-xs flex-1" autoFocus />
                  <Button size="sm" onClick={addHabit} className="h-8 text-xs bg-green-600 hover:bg-green-700 dark:bg-[hsl(var(--rt-accent))] dark:hover:bg-[hsl(142,71%,40%)] text-white">Adicionar</Button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-green-50/50 dark:bg-[hsl(var(--rt-card-2))]">
                      <th className="text-left px-3 py-2 font-bold text-green-900 dark:text-[hsl(var(--rt-text-soft))] border-r border-green-100 dark:border-[hsl(var(--rt-border))] w-24">DIA</th>
                      {habitNames.map((habit, i) => (
                        <th key={i} className="px-2 py-2 font-medium text-green-800 dark:text-[hsl(var(--rt-text-soft))] border-r border-green-100 dark:border-[hsl(var(--rt-border))] min-w-[100px] group">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-center text-[11px]">{habit}</span>
                            <button onClick={() => removeHabit(i)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((day, di) => (
                      <tr key={day} className={`border-t border-green-100 dark:border-[hsl(var(--rt-border))] hover:bg-green-50/30 dark:hover:bg-[hsl(var(--rt-card-2))] ${di % 2 === 1 ? "dark:bg-[hsl(var(--rt-card-2))]/50" : ""}`}>
                        <td className="px-3 py-2 font-bold text-[11px] border-r border-green-100 dark:border-[hsl(var(--rt-border))] text-foreground dark:text-[hsl(var(--rt-text))]">{day}</td>
                        {habitNames.map((_, hi) => (
                          <td key={hi} className="text-center px-2 py-2 border-r border-green-100 dark:border-[hsl(var(--rt-border))]">
                            <Checkbox checked={habitsChecked[day]?.[hi] || false} onCheckedChange={() => toggleHabit(day, hi)} className="h-4 w-4 border-blue-400 dark:border-[hsl(var(--rt-text-soft))] data-[state=checked]:bg-[hsl(var(--rt-accent))] data-[state=checked]:border-[hsl(var(--rt-accent))] dark:data-[state=checked]:bg-[hsl(var(--rt-accent))] dark:data-[state=checked]:border-[hsl(var(--rt-accent))]" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Heatmap */}
            <HabitHeatmap habitsChecked={habitsChecked} habits={habitNames} days={days} />

            {/* Grid: Schedule + Side */}
            <div className="grid lg:grid-cols-[1fr_320px] gap-4">
              <div data-spotlight="weekly-schedule" className="bg-card rounded-lg border border-border overflow-hidden dark:bg-[hsl(var(--rt-card))] dark:border-[hsl(var(--rt-border))]">
                <div className="bg-gradient-to-r from-pink-300 to-pink-400 dark:from-[hsl(330,40%,22%)] dark:to-[hsl(330,40%,28%)] px-4 py-3 flex items-center justify-between">
                  <span className="font-bold text-sm text-white">ROTINA SEMANAL</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-pink-50 dark:bg-[hsl(var(--rt-card-2))]">
                        <th className="text-left px-2 py-2 font-bold border-r border-pink-100 dark:border-[hsl(var(--rt-border))] w-16 text-pink-900 dark:text-[hsl(var(--rt-text-soft))]">Horário</th>
                        {scheduleDays.map((day) => (
                          <th key={day} className="px-2 py-2 font-medium text-pink-800 dark:text-[hsl(var(--rt-text-soft))] border-r border-pink-100 dark:border-[hsl(var(--rt-border))] min-w-[90px]">{day}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {hours.map((hour, ri) => (
                        <tr key={hour} className={`border-t border-border/30 dark:border-[hsl(var(--rt-border))] hover:bg-muted/20 dark:hover:bg-[hsl(var(--rt-card-2))] ${ri % 2 === 1 ? "dark:bg-[hsl(var(--rt-card-2))]/40" : ""}`}>
                          <td className="px-2 py-1.5 font-mono font-bold text-muted-foreground dark:text-[hsl(var(--rt-text-soft))] border-r border-border/30 dark:border-[hsl(var(--rt-border))] bg-pink-50/30 dark:bg-transparent dark:bg-pink-500/10">{hour}</td>
                          {scheduleDays.map((day) => {
                            const isEditing = editingCell?.hour === hour && editingCell?.day === day;
                            const value = schedule[hour]?.[day] || "";
                            return (
                              <td key={day} className="px-1 py-1 border-r border-border/20 dark:border-[hsl(var(--rt-border))] cursor-pointer hover:bg-pink-50/50 dark:hover:bg-[hsl(330,30%,18%)]/40 transition-colors dark:bg-pink-500/10" onClick={() => !isEditing && startEditCell(hour, day)}>
                                {isEditing ? (
                                  <Input value={editCellValue} onChange={(e) => setEditCellValue(e.target.value)} onBlur={saveEditCell} onKeyDown={(e) => { if (e.key === "Enter") saveEditCell(); if (e.key === "Escape") setEditingCell(null); }} className="h-5 text-[10px] border-0 bg-background dark:bg-[hsl(var(--rt-surface))] shadow-sm px-1" autoFocus />
                                ) : value ? (
                                  <span className="inline-block w-full text-[10px] px-1.5 py-0.5 rounded-sm bg-pink-100 text-pink-900 dark:bg-[hsl(330,40%,22%)] dark:text-[hsl(330,55%,82%)]">{value}</span>
                                ) : (
                                  <span className="text-[10px] text-transparent">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-card rounded-lg border border-border p-6 text-center">
                  <p className="text-2xl font-black leading-tight tracking-tight">{quote.split(" ").reduce((acc: string[][], word, i) => {
                    const last = acc[acc.length - 1];
                    if (last.join(" ").length + word.length < 15) last.push(word);
                    else acc.push([word]);
                    return acc;
                  }, [[]] as string[][]).map((line, i) => <span key={i}>{line.join(" ")}<br /></span>)}</p>
                </div>

                <div className="bg-yellow-50 dark:bg-[hsl(var(--rt-warning-soft))] rounded-lg border border-yellow-200 dark:border-[hsl(48,60%,28%)] overflow-hidden">
                  <div className="bg-yellow-100 dark:bg-[hsl(35,45%,12%)] border-b border-yellow-200 dark:border-[hsl(48,60%,28%)] px-4 py-2 flex items-center justify-between">
                    <span className="font-bold text-xs text-yellow-900 dark:text-[hsl(var(--rt-warning))]">URGÊNCIAS</span>
                    <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-[hsl(var(--rt-warning))]" />
                  </div>
                  <div className="p-3 space-y-2">
                    {urgencies.map((u) => (
                      <div key={u.id} className="flex items-center gap-2 group">
                        <Checkbox checked={u.done} onCheckedChange={() => toggleUrgency(u.id)} className="h-3.5 w-3.5" />
                        <span className={`flex-1 text-xs ${u.done ? "line-through text-muted-foreground" : "text-yellow-900 dark:text-[hsl(var(--rt-warning-text))]"}`}>{u.text}</span>
                        <button onClick={() => removeUrgency(u.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-1">
                      <Checkbox disabled className="h-3.5 w-3.5 opacity-30" />
                      <Input placeholder="Nova urgência..." value={newUrgency} onChange={(e) => setNewUrgency(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addUrgency()} className="h-6 text-xs border-0 bg-transparent shadow-none px-0 focus-visible:ring-0 text-yellow-800 dark:text-[hsl(var(--rt-warning-text))] placeholder:text-yellow-400 dark:placeholder:text-[hsl(48,30%,40%)]" />
                    </div>
                  </div>
                </div>

                <MoodTracker />
              </div>
            </div>

            {/* Rituals */}
            <Rituals />
          </>
        )}

        {/* ============= FOCO ============= */}
        {activeTab === "foco" && (
          <div className="space-y-5">
            <PomodoroTimer />
            <div className="grid md:grid-cols-2 gap-4">
              <TodoList />
              <FocusZones />
            </div>
            <EnergyTracker />
          </div>
        )}


        {/* ============= MEU MÊS ============= */}
        {activeTab === "mes" && <MonthlyPlanning />}

        {/* ============= DIÁRIO ============= */}
        {activeTab === "diario" && (
          <div className="space-y-5">
            <DailyJournal />
            <MoodTracker />
          </div>
        )}

        {/* ============= REVISÃO ============= */}
        {activeTab === "revisao" && (
          <div className="space-y-5">
            <WeeklyReview />
            <HabitHeatmap habitsChecked={habitsChecked} habits={habitNames} days={days} />
          </div>
        )}
      </main>
    </div>
  );
};

export default Rotina;
