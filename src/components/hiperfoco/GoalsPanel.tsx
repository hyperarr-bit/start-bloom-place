import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const TIMEFRAMES = [
  { id: "curto", label: "CURTO PRAZO" },
  { id: "medio", label: "MÉDIO PRAZO" },
  { id: "longo", label: "LONGO PRAZO" },
];

const GOAL_TYPES = [
  { id: "faturamento", label: "Faturamento", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { id: "empresa", label: "Empresa", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: "pessoal", label: "Pessoal", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { id: "saude", label: "Saúde", color: "bg-red-500/20 text-red-400 border-red-500/30" },
];

const PNL_QUESTIONS = [
  { key: "q1", label: "O QUE DESEJA ESPECIFICAMENTE?", placeholder: "Descreva com clareza absoluta o resultado que quer alcançar..." },
  { key: "q2", label: "COMO SABERÁ QUE CONSEGUIU?", placeholder: "Quais evidências concretas você terá? O que vai ver, ouvir, sentir?" },
  { key: "q3", label: "ONDE, QUANDO E COM QUEM?", placeholder: "Em qual contexto esse resultado deve acontecer?" },
  { key: "q4", label: "O QUE AINDA IMPEDE?", placeholder: "Quais obstáculos precisam ser eliminados?" },
  { key: "q5", label: "QUAIS RECURSOS PRECISA?", placeholder: "Pessoas, dinheiro, conhecimento, tempo, ferramentas..." },
  { key: "q6", label: "QUAL O PRIMEIRO PASSO?", placeholder: "Uma ação concreta que pode executar agora..." },
];

interface Objective {
  id: string;
  text: string;
  done: boolean;
}

interface Goal {
  id: string;
  title: string;
  type: string;
  timeframe: string;
  pnl: Record<string, string>;
  objectives: Objective[];
}

const ProgressRing = ({ progress }: { progress: number }) => {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;
  return (
    <svg width="36" height="36" className="shrink-0">
      <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
      <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3" strokeLinecap="round"
        className="stroke-primary"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 18 18)" style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
      <text x="18" y="18" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-[8px] font-bold">
        {Math.round(progress)}%
      </text>
    </svg>
  );
};

export const GoalsPanel = () => {
  const [goals, setGoals] = usePersistedState<Goal[]>("hiperfoco-goals", []);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [expandedPnl, setExpandedPnl] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("faturamento");
  const [activeFilter, setActiveFilter] = useState<string>("todas");

  const addGoal = (timeframe: string) => {
    if (!newTitle.trim()) return;
    const goal: Goal = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      type: newType,
      timeframe,
      pnl: {},
      objectives: [],
    };
    setGoals(prev => [...prev, goal]);
    setNewTitle("");
    setNewType("faturamento");
    setAdding(null);
    setExpandedGoal(goal.id);
  };

  const removeGoal = (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
    if (expandedGoal === id) setExpandedGoal(null);
  };

  const updateGoalType = (goalId: string, type: string) => {
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, type } : g));
  };

  const updateGoalTitle = (goalId: string, title: string) => {
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, title } : g));
  };

  const updatePnl = (goalId: string, key: string, value: string) => {
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, pnl: { ...g.pnl, [key]: value } } : g));
  };

  const addObjective = (goalId: string, text: string) => {
    if (!text.trim()) return;
    setGoals(prev => prev.map(g => g.id === goalId ? {
      ...g, objectives: [...g.objectives, { id: crypto.randomUUID(), text: text.trim(), done: false }]
    } : g));
  };

  const toggleObjective = (goalId: string, objId: string) => {
    setGoals(prev => prev.map(g => g.id === goalId ? {
      ...g, objectives: g.objectives.map(o => o.id === objId ? { ...o, done: !o.done } : o)
    } : g));
  };

  const removeObjective = (goalId: string, objId: string) => {
    setGoals(prev => prev.map(g => g.id === goalId ? {
      ...g, objectives: g.objectives.filter(o => o.id !== objId)
    } : g));
  };

  const getProgress = (g: Goal) => {
    if (g.objectives.length === 0) return 0;
    return (g.objectives.filter(o => o.done).length / g.objectives.length) * 100;
  };

  const filteredGoals = activeFilter === "todas" ? goals : goals.filter(g => g.type === activeFilter);

  return (
    <div className="space-y-4">
      {/* Category filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setActiveFilter("todas")}
          className={`text-[10px] px-3 py-1.5 rounded font-bold uppercase tracking-wider transition-colors ${
            activeFilter === "todas"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          TODAS
        </button>
        {GOAL_TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveFilter(activeFilter === t.id ? "todas" : t.id)}
            className={`text-[10px] px-3 py-1.5 rounded font-bold uppercase tracking-wider transition-colors ${
              activeFilter === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Timeframe columns */}
      {TIMEFRAMES.map(tf => {
        const tfGoals = filteredGoals.filter(g => g.timeframe === tf.id);
        const totalTfGoals = goals.filter(g => g.timeframe === tf.id).length;

        return (
          <div key={tf.id} className="border border-border rounded-xl overflow-hidden">
            {/* Column header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
              <h3 className="text-xs font-bold uppercase tracking-wider">{tf.label}</h3>
              <span className="text-[10px] text-muted-foreground">{totalTfGoals} metas</span>
            </div>

            {/* + NOVA META button */}
            <button
              onClick={() => setAdding(adding === tf.id ? null : tf.id)}
              className="w-full px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-b border-border font-medium"
            >
              + NOVA META
            </button>

            {/* Add form */}
            {adding === tf.id && (
              <div className="px-4 py-3 space-y-2 border-b border-border bg-card">
                <div className="flex gap-1.5 flex-wrap">
                  {GOAL_TYPES.map(t => (
                    <button key={t.id} onClick={() => setNewType(t.id)}
                      className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${newType === t.id ? t.color + " border-current" : "border-border text-muted-foreground"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Título da meta..." className="text-sm h-8" autoFocus
                  onKeyDown={e => e.key === "Enter" && addGoal(tf.id)} />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setAdding(null)} className="text-[10px] px-3 py-1 rounded-lg text-muted-foreground">Cancelar</button>
                  <button onClick={() => addGoal(tf.id)} disabled={!newTitle.trim()} className="text-[10px] px-3 py-1 rounded-lg bg-primary text-primary-foreground disabled:opacity-40">Criar</button>
                </div>
              </div>
            )}

            {/* Goal cards */}
            <div className="divide-y divide-border">
              {tfGoals.length === 0 && adding !== tf.id && (
                <p className="text-[11px] text-muted-foreground/50 text-center py-6">Nenhuma meta</p>
              )}
              {tfGoals.map(goal => {
                const isOpen = expandedGoal === goal.id;
                const isPnlOpen = expandedPnl === goal.id;
                const progress = getProgress(goal);
                const typeInfo = GOAL_TYPES.find(t => t.id === goal.type);

                return (
                  <div key={goal.id} className="px-4 py-3 space-y-2">
                    {/* Type dropdown + close */}
                    <div className="flex items-center justify-between">
                      <GoalTypeDropdown current={goal.type} onChange={(t) => updateGoalType(goal.id, t)} />
                      <button onClick={() => removeGoal(goal.id)} className="p-1 rounded hover:bg-destructive/20">
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>

                    {/* Title */}
                    <Input
                      value={goal.title}
                      onChange={e => updateGoalTitle(goal.id, e.target.value)}
                      placeholder="Título da meta..."
                      className="text-sm h-8 bg-transparent border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 font-medium"
                    />

                    {/* Progress bar */}
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    {/* Objectives count + progress */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        {goal.objectives.filter(o => o.done).length}/{goal.objectives.length} objetivos
                      </span>
                      <span className="text-[11px] font-bold">{Math.round(progress)}%</span>
                    </div>

                    {/* Framework PNL collapsible */}
                    <button
                      onClick={() => setExpandedPnl(isPnlOpen ? null : goal.id)}
                      className="w-full flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground py-1.5 border-t border-border"
                    >
                      {isPnlOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      FRAMEWORK PNL (RESULTADO BEM-FORMULADO)
                    </button>

                    {isPnlOpen && (
                      <div className="space-y-3 pt-1">
                        {PNL_QUESTIONS.map(q => (
                          <div key={q.key}>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1 block">{q.label}</label>
                            <Textarea
                              value={goal.pnl[q.key] || ""}
                              onChange={e => updatePnl(goal.id, q.key, e.target.value)}
                              placeholder={q.placeholder}
                              className="text-xs min-h-[40px] resize-none bg-muted/30 border-border"
                              rows={2}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Objectives */}
                    <div className="space-y-1.5 pt-1 border-t border-border">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pt-1">OBJETIVOS</p>
                      {goal.objectives.map(obj => (
                        <div key={obj.id} className="flex items-center gap-2 group">
                          <Checkbox checked={obj.done} onCheckedChange={() => toggleObjective(goal.id, obj.id)} />
                          <span className={`text-xs flex-1 ${obj.done ? "line-through text-muted-foreground" : ""}`}>{obj.text}</span>
                          <button onClick={() => removeObjective(goal.id, obj.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20">
                            <X className="w-3 h-3 text-destructive" />
                          </button>
                        </div>
                      ))}
                      <ObjectiveInput onAdd={(text) => addObjective(goal.id, text)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const GoalTypeDropdown = ({ current, onChange }: { current: string; onChange: (type: string) => void }) => {
  const [open, setOpen] = useState(false);
  const currentType = GOAL_TYPES.find(t => t.id === current);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs font-medium bg-muted/50 border border-border rounded px-2 py-1"
      >
        {currentType?.label || current}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-20 py-1 min-w-[120px]">
          {GOAL_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => { onChange(t.id); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors flex items-center gap-2 ${current === t.id ? "font-semibold" : ""}`}
            >
              {current === t.id && <span className="text-primary">✓</span>}
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ObjectiveInput = ({ onAdd }: { onAdd: (text: string) => void }) => {
  const [text, setText] = useState("");
  return (
    <button
      onClick={() => {
        const t = prompt("Novo objetivo:");
        if (t?.trim()) onAdd(t);
      }}
      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
    >
      + Adicionar objetivo
    </button>
  );
};
