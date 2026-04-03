import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const TIMEFRAMES = [
  { id: "curto", label: "Curto Prazo", color: "text-emerald-400", ring: "stroke-emerald-400" },
  { id: "medio", label: "Médio Prazo", color: "text-amber-400", ring: "stroke-amber-400" },
  { id: "longo", label: "Longo Prazo", color: "text-purple-400", ring: "stroke-purple-400" },
];

const GOAL_TYPES = [
  { id: "empresa", label: "Empresa", color: "bg-blue-500/20 text-blue-400" },
  { id: "pessoal", label: "Pessoal", color: "bg-emerald-500/20 text-emerald-400" },
  { id: "saude", label: "Saúde", color: "bg-red-500/20 text-red-400" },
];

const PNL_QUESTIONS = [
  { key: "q1", label: "O que deseja especificamente?" },
  { key: "q2", label: "Como saberá que conseguiu?" },
  { key: "q3", label: "Onde, quando e com quem?" },
  { key: "q4", label: "O que ainda impede?" },
  { key: "q5", label: "Quais recursos precisa?" },
  { key: "q6", label: "Qual o primeiro passo?" },
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

const ProgressRing = ({ progress, strokeColor }: { progress: number; strokeColor: string }) => {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;
  return (
    <svg width="52" height="52" className="shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
      <circle cx="26" cy="26" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
        className={strokeColor}
        strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 26 26)" style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
      <text x="26" y="26" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-[11px] font-bold">
        {Math.round(progress)}%
      </text>
    </svg>
  );
};

export const GoalsPanel = () => {
  const [goals, setGoals] = usePersistedState<Goal[]>("hiperfoco-goals", []);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("pessoal");

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
    setNewType("pessoal");
    setAdding(null);
    setExpandedGoal(goal.id);
  };

  const removeGoal = (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
    if (expandedGoal === id) setExpandedGoal(null);
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

  return (
    <div className="space-y-6">
      {TIMEFRAMES.map(tf => {
        const tfGoals = goals.filter(g => g.timeframe === tf.id);
        return (
          <div key={tf.id}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-xs font-bold uppercase tracking-wider ${tf.color}`}>{tf.label}</h3>
              <button onClick={() => setAdding(adding === tf.id ? null : tf.id)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {adding === tf.id && (
              <div className="bg-card border border-border rounded-xl p-3 mb-2 space-y-2">
                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Título da meta" className="text-sm h-8" autoFocus
                  onKeyDown={e => e.key === "Enter" && addGoal(tf.id)} />
                <div className="flex gap-1.5">
                  {GOAL_TYPES.map(t => (
                    <button key={t.id} onClick={() => setNewType(t.id)}
                      className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${newType === t.id ? t.color + " border-current" : "border-border text-muted-foreground"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setAdding(null)} className="text-[10px] px-3 py-1 rounded-lg text-muted-foreground">Cancelar</button>
                  <button onClick={() => addGoal(tf.id)} disabled={!newTitle.trim()} className="text-[10px] px-3 py-1 rounded-lg bg-primary text-primary-foreground disabled:opacity-40">Criar</button>
                </div>
              </div>
            )}

            {tfGoals.length === 0 && adding !== tf.id && (
              <p className="text-[11px] text-muted-foreground/50 text-center py-4">Nenhuma meta ainda</p>
            )}

            <div className="space-y-2">
              {tfGoals.map(goal => {
                const isOpen = expandedGoal === goal.id;
                const progress = getProgress(goal);
                const typeInfo = GOAL_TYPES.find(t => t.id === goal.type);

                return (
                  <div key={goal.id} className="bg-card border border-border rounded-xl overflow-hidden">
                    {/* Header */}
                    <button onClick={() => setExpandedGoal(isOpen ? null : goal.id)}
                      className="w-full flex items-center gap-3 p-3">
                      <ProgressRing progress={progress} strokeColor={tf.ring} />
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-semibold truncate">{goal.title}</p>
                        {typeInfo && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${typeInfo.color} inline-block mt-0.5`}>{typeInfo.label}</span>
                        )}
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                    </button>

                    {isOpen && (
                      <div className="px-3 pb-3 space-y-4">
                        {/* PNL Framework */}
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Framework PNL</p>
                          {PNL_QUESTIONS.map(q => (
                            <div key={q.key}>
                              <label className="text-[11px] text-muted-foreground mb-0.5 block">{q.label}</label>
                              <Textarea
                                value={goal.pnl[q.key] || ""}
                                onChange={e => updatePnl(goal.id, q.key, e.target.value)}
                                className="text-xs min-h-[40px] resize-none"
                                rows={1}
                              />
                            </div>
                          ))}
                        </div>

                        {/* Objectives */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Objetivos</p>
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

                        {/* Delete */}
                        <button onClick={() => removeGoal(goal.id)}
                          className="flex items-center gap-1.5 text-[10px] text-destructive hover:text-destructive/80 transition-colors">
                          <Trash2 className="w-3 h-3" /> Excluir meta
                        </button>
                      </div>
                    )}
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

const ObjectiveInput = ({ onAdd }: { onAdd: (text: string) => void }) => {
  const [text, setText] = useState("");
  return (
    <div className="flex gap-1.5">
      <Input value={text} onChange={e => setText(e.target.value)} placeholder="Novo objetivo..."
        className="text-xs h-7 flex-1" onKeyDown={e => { if (e.key === "Enter" && text.trim()) { onAdd(text); setText(""); } }} />
      <button onClick={() => { if (text.trim()) { onAdd(text); setText(""); } }}
        className="p-1 rounded-lg hover:bg-muted text-muted-foreground"><Plus className="w-3.5 h-3.5" /></button>
    </div>
  );
};
