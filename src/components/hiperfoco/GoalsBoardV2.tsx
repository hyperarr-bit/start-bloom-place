import { useState, useRef } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, Trash2, ChevronDown, ImagePlus, Link, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface TaskItem {
  id: string;
  text: string;
  done: boolean;
}

interface ActionGroup {
  id: string;
  label: string;
  tasks: TaskItem[];
}

interface ReferenceLink {
  id: string;
  url: string;
  title?: string;
}

interface ProblemSolution {
  id: string;
  problem: string;
  solution: string;
}

interface GoalV2 {
  id: string;
  title: string;
  heroImage?: string;
  actionGroups: ActionGroup[];
  referenceLinks: ReferenceLink[];
  referenceImages: string[];
  vision: { meta: string; objetivo: string; tempo: string };
  problems: ProblemSolution[];
}

const emptyGoal = (title: string): GoalV2 => ({
  id: Date.now().toString(),
  title,
  heroImage: undefined,
  actionGroups: [
    { id: Date.now().toString() + "-g1", label: "Definir as bases:", tasks: [] },
    { id: Date.now().toString() + "-g2", label: "Estruturar o plano:", tasks: [] },
  ],
  referenceLinks: [],
  referenceImages: [],
  vision: { meta: "", objetivo: "", tempo: "" },
  problems: [{ id: Date.now().toString() + "-p1", problem: "", solution: "" }],
});

const defaultGoals: GoalV2[] = [emptyGoal("Minha Meta")];

export const GoalsBoardV2 = () => {
  const [goals, setGoals] = usePersistedState<GoalV2[]>("goals-board-v2", defaultGoals);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(goals[0]?.id || null);
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const heroRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const goal = goals.find(g => g.id === selectedGoalId) || goals[0];

  const updateGoal = (updated: GoalV2) => {
    setGoals(prev => prev.map(g => g.id === updated.id ? updated : g));
  };

  const addGoal = () => {
    if (!newGoalTitle.trim()) return;
    const ng = emptyGoal(newGoalTitle.trim());
    setGoals(prev => [...prev, ng]);
    setSelectedGoalId(ng.id);
    setNewGoalTitle("");
    setShowNewGoal(false);
  };

  const deleteGoal = () => {
    if (!goal || goals.length <= 1) return;
    const filtered = goals.filter(g => g.id !== goal.id);
    setGoals(filtered);
    setSelectedGoalId(filtered[0]?.id || null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "hero" | "gallery") => {
    const file = e.target.files?.[0];
    if (!file || !goal) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (type === "hero") {
        updateGoal({ ...goal, heroImage: base64 });
      } else {
        updateGoal({ ...goal, referenceImages: [...goal.referenceImages, base64] });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const toggleTask = (groupId: string, taskId: string) => {
    if (!goal) return;
    updateGoal({
      ...goal,
      actionGroups: goal.actionGroups.map(g =>
        g.id === groupId
          ? { ...g, tasks: g.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) }
          : g
      ),
    });
  };

  const addTask = (groupId: string, text: string) => {
    if (!goal || !text.trim()) return;
    updateGoal({
      ...goal,
      actionGroups: goal.actionGroups.map(g =>
        g.id === groupId
          ? { ...g, tasks: [...g.tasks, { id: Date.now().toString(), text: text.trim(), done: false }] }
          : g
      ),
    });
  };

  const removeTask = (groupId: string, taskId: string) => {
    if (!goal) return;
    updateGoal({
      ...goal,
      actionGroups: goal.actionGroups.map(g =>
        g.id === groupId ? { ...g, tasks: g.tasks.filter(t => t.id !== taskId) } : g
      ),
    });
  };

  const addGroup = () => {
    if (!goal || !newGroupLabel.trim()) return;
    updateGoal({
      ...goal,
      actionGroups: [...goal.actionGroups, { id: Date.now().toString(), label: newGroupLabel.trim(), tasks: [] }],
    });
    setNewGroupLabel("");
  };

  const removeGroup = (groupId: string) => {
    if (!goal) return;
    updateGoal({ ...goal, actionGroups: goal.actionGroups.filter(g => g.id !== groupId) });
  };

  const addLink = () => {
    if (!goal || !newLinkUrl.trim()) return;
    updateGoal({
      ...goal,
      referenceLinks: [...goal.referenceLinks, { id: Date.now().toString(), url: newLinkUrl.trim() }],
    });
    setNewLinkUrl("");
  };

  const addProblem = () => {
    if (!goal) return;
    updateGoal({
      ...goal,
      problems: [...goal.problems, { id: Date.now().toString(), problem: "", solution: "" }],
    });
  };

  // Section header — 1:1 com fotos: bg marrom/bege, emoji grande no canto direito
  const SectionHeader = ({ emoji, title }: { emoji: string; title: string }) => (
    <div className="relative bg-[hsl(30,15%,75%)]/30 dark:bg-[hsl(30,10%,35%)]/30 rounded-t-xl px-5 py-6 flex items-end justify-between overflow-hidden" style={{ minHeight: 72 }}>
      <h3 className="text-lg font-black tracking-tight text-foreground">{title}</h3>
      <span className="text-4xl opacity-80 absolute right-4 bottom-2">{emoji}</span>
    </div>
  );

  // Circular checkbox — azul quando checked (como nas fotos)
  const CircleCheck = ({ checked, onToggle }: { checked: boolean; onToggle: () => void }) => (
    <button
      onClick={onToggle}
      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
        checked
          ? "bg-[hsl(217,91%,60%)] border-[hsl(217,91%,60%)]"
          : "border-muted-foreground/30 hover:border-[hsl(217,91%,60%)]"
      }`}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );

  // Inline task input
  const TaskInput = ({ groupId }: { groupId: string }) => {
    const [text, setText] = useState("");
    return (
      <div className="flex items-center gap-2 pl-7 py-1.5">
        <div className="w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground/20 shrink-0" />
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { addTask(groupId, text); setText(""); } }}
          placeholder="Adicionar uma tarefa..."
          className="bg-transparent text-sm text-muted-foreground outline-none flex-1 placeholder:text-muted-foreground/40"
        />
      </div>
    );
  };

  if (!goal) return null;

  return (
    <div className="space-y-4">
      {/* Título editável no topo + seletor */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          {editingTitle ? (
            <input
              value={goal.title}
              onChange={e => updateGoal({ ...goal, title: e.target.value })}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={e => e.key === "Enter" && setEditingTitle(false)}
              autoFocus
              className="w-full bg-transparent text-xl font-black tracking-tight outline-none border-b-2 border-primary pb-1"
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="flex items-center gap-2 w-full text-left"
            >
              <span className="text-xl font-black tracking-tight truncate">{goal.title}</span>
              {goals.length > 1 && <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
            </button>
          )}
          {/* Dropdown para trocar meta */}
          {goals.length > 1 && !editingTitle && (
            <select
              value={goal.id}
              onChange={e => setSelectedGoalId(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            >
              {goals.map(g => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          )}
        </div>
        <Button size="icon" variant="outline" className="shrink-0 h-10 w-10" onClick={() => setShowNewGoal(true)}>
          <Plus className="w-4 h-4" />
        </Button>
        {goals.length > 1 && (
          <Button size="icon" variant="ghost" className="shrink-0 h-10 w-10 text-muted-foreground" onClick={deleteGoal}>
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* New goal input */}
      {showNewGoal && (
        <div className="flex gap-2">
          <Input
            value={newGoalTitle}
            onChange={e => setNewGoalTitle(e.target.value)}
            placeholder="Nome da meta (ex: Casamento, Apartamento...)"
            className="text-sm"
            onKeyDown={e => e.key === "Enter" && addGoal()}
            autoFocus
          />
          <Button size="sm" onClick={addGoal}>Criar</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowNewGoal(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* HERO IMAGE */}
      <div
        className="relative w-full rounded-xl overflow-hidden bg-muted/30 border border-border cursor-pointer group"
        style={{ minHeight: goal.heroImage ? "auto" : "140px" }}
        onClick={() => heroRef.current?.click()}
      >
        {goal.heroImage ? (
          <>
            <img src={goal.heroImage} alt={goal.title} className="w-full h-48 object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ImagePlus className="w-6 h-6 text-white" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-36 gap-2 text-muted-foreground">
            <ImagePlus className="w-8 h-8" />
            <p className="text-xs">Adicionar imagem de capa</p>
          </div>
        )}
        <input ref={heroRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, "hero")} />
      </div>

      {/* PLANO DE AÇÃO */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <SectionHeader emoji="🚀" title="PLANO DE AÇÃO" />
        <div className="p-4 space-y-4">
          {goal.actionGroups.map(group => {
            const doneCount = group.tasks.filter(t => t.done).length;
            const total = group.tasks.length;
            return (
              <div key={group.id} className="space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="border-l-4 border-pink-400 bg-pink-50 dark:bg-pink-500/10 rounded-r-md px-3 py-2 flex-1">
                    <span className="text-xs font-bold text-pink-700 dark:text-pink-300">{group.label}</span>
                    {total > 0 && (
                      <span className="text-[10px] text-pink-500 dark:text-pink-400 ml-2">{doneCount}/{total}</span>
                    )}
                  </div>
                  <button onClick={() => removeGroup(group.id)} className="text-muted-foreground/40 hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {group.tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2 pl-7 py-1.5 group/task">
                    <CircleCheck checked={task.done} onToggle={() => toggleTask(group.id, task.id)} />
                    <span className={`text-sm flex-1 ${task.done ? "line-through text-muted-foreground" : ""}`}>
                      {task.text}
                    </span>
                    <button
                      onClick={() => removeTask(group.id, task.id)}
                      className="opacity-0 group-hover/task:opacity-100 text-muted-foreground/40 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <TaskInput groupId={group.id} />
              </div>
            );
          })}
          <div className="flex gap-2 pt-2 border-t border-border/50">
            <Input
              value={newGroupLabel}
              onChange={e => setNewGroupLabel(e.target.value)}
              placeholder="Nova etapa (ex: Definir as bases)"
              className="text-xs h-8"
              onKeyDown={e => e.key === "Enter" && addGroup()}
            />
            <Button size="sm" className="h-8 px-3" onClick={addGroup}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* LINKS DE REFERÊNCIA */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <SectionHeader emoji="🔗" title="LINKS DE REFERÊNCIA" />
        <div className="p-4 space-y-3">
          {goal.referenceImages.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {goal.referenceImages.map((img, i) => (
                <div key={i} className="relative group/img rounded-lg overflow-hidden">
                  <img src={img} alt="" className="w-full h-24 object-cover" />
                  <button
                    onClick={() => updateGoal({ ...goal, referenceImages: goal.referenceImages.filter((_, idx) => idx !== i) })}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-1 opacity-0 group-hover/img:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => galleryRef.current?.click()}>
              <ImagePlus className="w-3 h-3 mr-1" /> Imagem
            </Button>
            <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, "gallery")} />
            <Input
              value={newLinkUrl}
              onChange={e => setNewLinkUrl(e.target.value)}
              placeholder="Colar URL..."
              className="text-xs h-8 flex-1"
              onKeyDown={e => e.key === "Enter" && addLink()}
            />
            <Button size="sm" className="h-8 px-3" onClick={addLink}>
              <Link className="w-3 h-3" />
            </Button>
          </div>
          {goal.referenceLinks.length > 0 && (
            <div className="space-y-1">
              {goal.referenceLinks.map(link => (
                <div key={link.id} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2 border border-border">
                  <Link className="w-3 h-3 text-[hsl(217,91%,60%)] shrink-0" />
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[hsl(217,91%,60%)] hover:underline truncate flex-1">
                    {link.url}
                  </a>
                  <button onClick={() => updateGoal({ ...goal, referenceLinks: goal.referenceLinks.filter(l => l.id !== link.id) })}>
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* VISÃO — campos inline como nas fotos */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <SectionHeader emoji="🎯" title="VISÃO" />
        <div className="p-4 space-y-0">
          <div className="py-3 border-b border-border/50">
            <div className="flex items-start gap-2">
              <span className="text-sm font-bold text-foreground whitespace-nowrap mt-0.5">Meta:</span>
              <input
                value={goal.vision.meta}
                onChange={e => updateGoal({ ...goal, vision: { ...goal.vision, meta: e.target.value } })}
                placeholder="O que quero alcançar?"
                className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground/40"
              />
            </div>
          </div>
          <div className="py-3 border-b border-border/50">
            <div className="flex items-start gap-2">
              <span className="text-sm font-bold text-foreground whitespace-nowrap mt-0.5">Objetivo:</span>
              <input
                value={goal.vision.objetivo}
                onChange={e => updateGoal({ ...goal, vision: { ...goal.vision, objetivo: e.target.value } })}
                placeholder="Por que isso é importante?"
                className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground/40"
              />
            </div>
          </div>
          <div className="py-3">
            <div className="flex items-start gap-2">
              <span className="text-sm font-bold text-foreground whitespace-nowrap mt-0.5">Tempo:</span>
              <input
                value={goal.vision.tempo}
                onChange={e => updateGoal({ ...goal, vision: { ...goal.vision, tempo: e.target.value } })}
                placeholder="Ex: 1 ano, 6 meses..."
                className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground/40"
              />
            </div>
          </div>
        </div>
      </div>

      {/* PROBLEMAS E SOLUÇÕES */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <SectionHeader emoji="😅" title="PROBLEMAS E SOLUÇÕES" />
        <div className="p-4 space-y-3">
          {goal.problems.map((ps, i) => (
            <div key={ps.id} className="space-y-2 pb-3 border-b border-border/50 last:border-0">
              <div className="flex items-start gap-2">
                <div className="border-l-4 border-pink-400 bg-pink-50 dark:bg-pink-500/10 rounded-r-md px-3 py-2 flex-1">
                  <input
                    value={ps.problem}
                    onChange={e => {
                      const updated = [...goal.problems];
                      updated[i] = { ...ps, problem: e.target.value };
                      updateGoal({ ...goal, problems: updated });
                    }}
                    placeholder="Descreva o problema..."
                    className="bg-transparent text-xs font-bold text-pink-700 dark:text-pink-300 outline-none w-full placeholder:text-pink-300"
                  />
                </div>
                <button onClick={() => updateGoal({ ...goal, problems: goal.problems.filter(p => p.id !== ps.id) })}>
                  <Trash2 className="w-3 h-3 text-muted-foreground/40" />
                </button>
              </div>
              <Textarea
                value={ps.solution}
                onChange={e => {
                  const updated = [...goal.problems];
                  updated[i] = { ...ps, solution: e.target.value };
                  updateGoal({ ...goal, problems: updated });
                }}
                placeholder="Como resolver?"
                className="text-xs min-h-[50px] ml-4"
              />
            </div>
          ))}
          <Button size="sm" variant="outline" className="w-full text-xs" onClick={addProblem}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar problema
          </Button>
        </div>
      </div>
    </div>
  );
};
