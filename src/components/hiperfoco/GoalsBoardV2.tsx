import { useState, useRef } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, Trash2, ChevronDown, ChevronLeft, ImagePlus, Link, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


/* ─── Types ─── */
interface TaskItem { id: string; text: string; done: boolean }
interface ActionGroup { id: string; label: string; tasks: TaskItem[] }
interface ReferenceLink { id: string; url: string; title?: string }
interface ProblemSolution { id: string; problem: string; solution: string }

interface GoalV2 {
  id: string; title: string; heroImage?: string;
  actionGroups: ActionGroup[]; referenceLinks: ReferenceLink[]; referenceImages: string[];
  vision: { meta: string; objetivo: string; tempo: string };
  problems: ProblemSolution[];
}

interface TimelineItem { id: string; text: string; done: boolean }
interface TimelinePeriod { items: TimelineItem[]; image?: string }
interface TimelineData {
  "6meses": TimelinePeriod; "1ano": TimelinePeriod; "3anos": TimelinePeriod; "5anos": TimelinePeriod;
}
interface HomeData { quote: string; dreamBoard: string[] }

const emptyGoal = (title: string): GoalV2 => ({
  id: Date.now().toString(), title, heroImage: undefined,
  actionGroups: [
    { id: Date.now().toString() + "-g1", label: "Definir as bases:", tasks: [] },
    { id: Date.now().toString() + "-g2", label: "Estruturar o plano:", tasks: [] },
  ],
  referenceLinks: [], referenceImages: [],
  vision: { meta: "", objetivo: "", tempo: "" },
  problems: [{ id: Date.now().toString() + "-p1", problem: "", solution: "" }],
});

const defaultTimeline: TimelineData = {
  "6meses": { items: [] }, "1ano": { items: [] }, "3anos": { items: [] }, "5anos": { items: [] },
};
const defaultHome: HomeData = { quote: "Eu crio a minha realidade.", dreamBoard: [] };
const defaultGoals: GoalV2[] = [emptyGoal("Minha Meta")];

const PERIODS: { key: keyof TimelineData; label: string; color: string }[] = [
  { key: "6meses", label: "6 MESES", color: "#FDE68A" },
  { key: "1ano", label: "1 ANO", color: "#C4B5FD" },
  { key: "3anos", label: "3 ANOS", color: "#86EFAC" },
  { key: "5anos", label: "5 ANOS", color: "#FDBA74" },
];

/* ─── Shared components ─── */
const CircleCheck = ({ checked, onToggle }: { checked: boolean; onToggle: () => void }) => (
  <button onClick={onToggle}
    className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-all ${
      checked ? "bg-[hsl(217,91%,60%)] border-[hsl(217,91%,60%)]" : "border-muted-foreground/30 hover:border-[hsl(217,91%,60%)]"
    }`}>
    {checked && <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>}
  </button>
);

/* ─── MAIN ─── */
export const GoalsBoardV2 = () => {
  const [goals, setGoals] = usePersistedState<GoalV2[]>("goals-board-v2", defaultGoals);
  const [timeline, setTimeline] = usePersistedState<TimelineData>("goals-timeline", defaultTimeline);
  const [homeData, setHomeData] = usePersistedState<HomeData>("goals-home", defaultHome);
  const [view, setView] = useState<"home" | "detail">("home");
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const dreamRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const goal = goals.find(g => g.id === selectedGoalId) || goals[0];

  const updateGoal = (updated: GoalV2) => setGoals(prev => prev.map(g => g.id === updated.id ? updated : g));

  const openGoal = (id: string) => { setSelectedGoalId(id); setView("detail"); };

  /* ─── HOME VIEW ─── */
  if (view === "home") {
    const addTimelineItem = (period: keyof TimelineData, text: string) => {
      if (!text.trim()) return;
      setTimeline(prev => ({
        ...prev,
        [period]: { ...prev[period], items: [...prev[period].items, { id: Date.now().toString(), text: text.trim(), done: false }] },
      }));
    };
    const toggleTimelineItem = (period: keyof TimelineData, itemId: string) => {
      setTimeline(prev => ({
        ...prev,
        [period]: { ...prev[period], items: prev[period].items.map(i => i.id === itemId ? { ...i, done: !i.done } : i) },
      }));
    };
    const removeTimelineItem = (period: keyof TimelineData, itemId: string) => {
      setTimeline(prev => ({
        ...prev,
        [period]: { ...prev[period], items: prev[period].items.filter(i => i.id !== itemId) },
      }));
    };
    const handleTimelineImage = (period: keyof TimelineData, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setTimeline(prev => ({ ...prev, [period]: { ...prev[period], image: reader.result as string } }));
      reader.readAsDataURL(file); e.target.value = "";
    };
    const handleDreamImage = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setHomeData(prev => ({ ...prev, dreamBoard: [...prev.dreamBoard, reader.result as string] }));
      reader.readAsDataURL(file); e.target.value = "";
    };
    const addGoal = () => {
      if (!newGoalTitle.trim()) return;
      const ng = emptyGoal(newGoalTitle.trim());
      setGoals(prev => [...prev, ng]);
      setNewGoalTitle(""); setShowNewGoal(false);
      openGoal(ng.id);
    };

    return (
      <div className="space-y-4">
        {/* Title */}
        <button onClick={() => setShowDropdown(!showDropdown)} className="flex items-center gap-2">
          <span className="text-xl font-black tracking-tight">MINHAS METAS</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* PLANO DE AÇÃO PARA CADA META */}
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <div className="relative px-5 py-6 flex items-end justify-between overflow-hidden" style={{ minHeight: 72, background: "hsl(30 20% 78% / 0.35)" }}>
            <span className="text-4xl absolute right-4 bottom-2 opacity-80">🎯</span>
          </div>
          <div className="px-5 py-4">
            <h3 className="text-lg font-black tracking-tight mb-4">PLANO DE AÇÃO PARA CADA META</h3>
            <div className="space-y-2">
              {goals.map(g => (
                <button key={g.id} onClick={() => openGoal(g.id)}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{g.title}</span>
                  </div>
                  <span className="text-muted-foreground text-sm">→</span>
                </button>
              ))}
              {showNewGoal ? (
                <div className="flex gap-2 pt-1">
                  <Input value={newGoalTitle} onChange={e => setNewGoalTitle(e.target.value)}
                    placeholder="Nome da meta..." className="text-sm h-9" autoFocus
                    onKeyDown={e => e.key === "Enter" && addGoal()} />
                  <Button size="sm" className="h-9" onClick={addGoal}>Criar</Button>
                  <Button size="sm" variant="ghost" className="h-9" onClick={() => setShowNewGoal(false)}><X className="w-4 h-4" /></Button>
                </div>
              ) : (
                <button onClick={() => setShowNewGoal(true)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground">
                  <Plus className="w-4 h-4" />
                  <span className="text-sm">Nova meta</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* FRASE MOTIVACIONAL */}
        <div className="rounded-xl overflow-hidden" style={{ background: "hsl(30 10% 35%)" }}>
          <div className="px-6 py-8 text-center">
            <input value={homeData.quote}
              onChange={e => setHomeData(prev => ({ ...prev, quote: e.target.value }))}
              className="bg-transparent text-center text-white text-lg italic w-full outline-none placeholder:text-white/40"
              placeholder="Sua frase motivacional..." />
          </div>
        </div>

        {/* TIMELINE CARDS */}
        {PERIODS.map(({ key, label, color }) => (
          <TimelineCard key={key} periodKey={key} label={label} color={color}
            period={timeline[key]}
            onToggle={(id) => toggleTimelineItem(key, id)}
            onRemove={(id) => removeTimelineItem(key, id)}
            onAdd={(text) => addTimelineItem(key, text)}
            onImageChange={(e) => handleTimelineImage(key, e)}
            onImageRemove={() => setTimeline(prev => ({ ...prev, [key]: { ...prev[key], image: undefined } }))}
          />
        ))}

        {/* MURAL DOS SONHOS */}
        <div className="rounded-xl border border-border overflow-hidden bg-card">
           <div className="relative px-5 py-6 flex items-end justify-between overflow-hidden" style={{ minHeight: 72, background: "hsl(270 40% 75% / 0.35)" }}>
            <span className="text-4xl absolute right-4 bottom-2 opacity-80">✨</span>
          </div>
          <div className="px-5 py-4 space-y-3">
            <h3 className="text-lg font-black tracking-tight">MURAL DOS SONHOS</h3>
            {homeData.dreamBoard.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {homeData.dreamBoard.map((img, i) => (
                  <div key={i} className="relative group/img rounded-lg overflow-hidden">
                    <img src={img} alt="" className="w-full h-24 object-cover" />
                    <button onClick={() => setHomeData(prev => ({ ...prev, dreamBoard: prev.dreamBoard.filter((_, idx) => idx !== i) }))}
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => dreamRef.current?.click()}
              className="w-full h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center gap-2 text-muted-foreground/50 hover:border-muted-foreground/40 transition-colors">
              <ImagePlus className="w-4 h-4" /> <span className="text-xs">Adicionar imagem</span>
            </button>
            <input ref={dreamRef} type="file" accept="image/*" className="hidden" onChange={handleDreamImage} />
          </div>
        </div>
      </div>
    );
  }

  /* ─── DETAIL VIEW (existing goal editor) ─── */
  if (!goal) return null;


  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "hero" | "gallery") => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (type === "hero") updateGoal({ ...goal, heroImage: base64 });
      else updateGoal({ ...goal, referenceImages: [...goal.referenceImages, base64] });
    };
    reader.readAsDataURL(file); e.target.value = "";
  };
  const toggleTask = (groupId: string, taskId: string) => {
    updateGoal({ ...goal, actionGroups: goal.actionGroups.map(g => g.id === groupId ? { ...g, tasks: g.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) } : g) });
  };
  const addTask = (groupId: string, text: string) => {
    if (!text.trim()) return;
    updateGoal({ ...goal, actionGroups: goal.actionGroups.map(g => g.id === groupId ? { ...g, tasks: [...g.tasks, { id: Date.now().toString(), text: text.trim(), done: false }] } : g) });
  };
  const removeTask = (groupId: string, taskId: string) => {
    updateGoal({ ...goal, actionGroups: goal.actionGroups.map(g => g.id === groupId ? { ...g, tasks: g.tasks.filter(t => t.id !== taskId) } : g) });
  };
  const addGroup = () => {
    if (!newGroupLabel.trim()) return;
    updateGoal({ ...goal, actionGroups: [...goal.actionGroups, { id: Date.now().toString(), label: newGroupLabel.trim(), tasks: [] }] });
    setNewGroupLabel("");
  };
  const removeGroup = (groupId: string) => updateGoal({ ...goal, actionGroups: goal.actionGroups.filter(g => g.id !== groupId) });
  const addLink = () => {
    if (!newLinkUrl.trim()) return;
    updateGoal({ ...goal, referenceLinks: [...goal.referenceLinks, { id: Date.now().toString(), url: newLinkUrl.trim() }] });
    setNewLinkUrl("");
  };
  const addProblem = () => updateGoal({ ...goal, problems: [...goal.problems, { id: Date.now().toString(), problem: "", solution: "" }] });
  const deleteGoal = () => {
    if (goals.length <= 1) return;
    const filtered = goals.filter(g => g.id !== goal.id);
    setGoals(filtered); setView("home");
  };

  const SectionHeader = ({ emoji, title, color }: { emoji: string; title: string; color: string }) => (
    <>
      <div className="relative overflow-hidden rounded-t-xl" style={{ minHeight: 72, background: color }}>
        <span className="text-4xl opacity-80 absolute right-4 bottom-2">{emoji}</span>
      </div>
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-lg font-black tracking-tight text-foreground">{title}</h3>
      </div>
    </>
  );

  const DetailTaskInput = ({ groupId }: { groupId: string }) => {
    const [text, setText] = useState("");
    return (
      <div className="flex items-center gap-2 pl-7 py-1.5">
        <div className="w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground/20 shrink-0" />
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { addTask(groupId, text); setText(""); } }}
          placeholder="Adicionar uma tarefa..."
          className="bg-transparent text-sm text-muted-foreground outline-none flex-1 placeholder:text-muted-foreground/40" />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Back */}
      <button onClick={() => setView("home")} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-xs">
        <ChevronLeft className="w-4 h-4" /> voltar
      </button>

      {/* Title with dropdown */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {editingTitle ? (
            <input value={goal.title} onChange={e => updateGoal({ ...goal, title: e.target.value })}
              onBlur={() => setEditingTitle(false)} onKeyDown={e => e.key === "Enter" && setEditingTitle(false)}
              autoFocus className="w-full bg-transparent text-xl font-black tracking-tight outline-none border-b-2 border-primary pb-1" />
          ) : (
            <button onClick={() => setShowDropdown(!showDropdown)} className="flex items-center gap-2 text-xl font-black tracking-tight truncate">
              {goal.title} <span className="text-muted-foreground">→</span> <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          )}
        </div>
        {goals.length > 1 && (
          <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8 text-muted-foreground" onClick={deleteGoal}>
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
      {/* Goal switcher dropdown */}
      {showDropdown && (
        <div className="rounded-xl border border-border bg-card p-2 space-y-1">
          {goals.map(g => (
            <button key={g.id} onClick={() => { setSelectedGoalId(g.id); setShowDropdown(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${g.id === goal.id ? "bg-muted font-bold" : "hover:bg-muted/50"}`}>
              {g.title}
            </button>
          ))}
        </div>
      )}

      {/* HERO IMAGE */}
      <div className="relative w-full rounded-xl overflow-hidden bg-muted/30 border border-border cursor-pointer group"
        style={{ minHeight: goal.heroImage ? "auto" : "140px" }} onClick={() => heroRef.current?.click()}>
        {goal.heroImage ? (
          <>
            <img src={goal.heroImage} alt={goal.title} className="w-full h-48 object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ImagePlus className="w-6 h-6 text-white" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-36 gap-2 text-muted-foreground">
            <ImagePlus className="w-8 h-8" /><p className="text-xs">Adicionar imagem de capa</p>
          </div>
        )}
        <input ref={heroRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, "hero")} />
      </div>

      {/* PLANO DE AÇÃO */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <SectionHeader emoji="🚀" title="PLANO DE AÇÃO" color="hsl(213 80% 80% / 0.45)" />
        <div className="p-4 space-y-4">
          {goal.actionGroups.map(group => {
            const doneCount = group.tasks.filter(t => t.done).length;
            const total = group.tasks.length;
            return (
              <div key={group.id} className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="border-l-4 border-pink-400 bg-pink-50 dark:bg-pink-500/10 rounded-r-md px-4 py-2.5 flex-1">
                    <span className="text-sm font-bold text-pink-700 dark:text-pink-300">{group.label}</span>
                    {total > 0 && <span className="text-xs text-pink-500 dark:text-pink-400 ml-2">{doneCount}/{total}</span>}
                  </div>
                  <button onClick={() => removeGroup(group.id)} className="text-muted-foreground/40 hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                </div>
                {group.tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2 pl-7 py-1.5 group/task">
                    <CircleCheck checked={task.done} onToggle={() => toggleTask(group.id, task.id)} />
                    <span className={`text-sm flex-1 ${task.done ? "line-through text-muted-foreground" : ""}`}>{task.text}</span>
                    <button onClick={() => removeTask(group.id, task.id)} className="opacity-0 group-hover/task:opacity-100 text-muted-foreground/40 hover:text-destructive"><X className="w-3 h-3" /></button>
                  </div>
                ))}
                <DetailTaskInput groupId={group.id} />
              </div>
            );
          })}
          <div className="flex gap-2 pt-2 border-t border-border/50">
            <Input value={newGroupLabel} onChange={e => setNewGroupLabel(e.target.value)}
              placeholder="Nova etapa (ex: Definir as bases)" className="text-xs h-8"
              onKeyDown={e => e.key === "Enter" && addGroup()} />
            <Button size="sm" className="h-8 px-3" onClick={addGroup}><Plus className="w-3 h-3" /></Button>
          </div>
        </div>
      </div>

      {/* LINKS DE REFERÊNCIA */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <SectionHeader emoji="🔗" title="LINKS DE REFERÊNCIA" color="hsl(152 60% 75% / 0.4)" />
        <div className="p-4 space-y-3">
          {goal.referenceImages.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {goal.referenceImages.map((img, i) => (
                <div key={i} className="relative group/img rounded-lg overflow-hidden">
                  <img src={img} alt="" className="w-full h-24 object-cover" />
                  <button onClick={() => updateGoal({ ...goal, referenceImages: goal.referenceImages.filter((_, idx) => idx !== i) })}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
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
            <Input value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)}
              placeholder="Colar URL..." className="text-xs h-8 flex-1" onKeyDown={e => e.key === "Enter" && addLink()} />
            <Button size="sm" className="h-8 px-3" onClick={addLink}><Link className="w-3 h-3" /></Button>
          </div>
          {goal.referenceLinks.length > 0 && (
            <div className="space-y-1">
              {goal.referenceLinks.map(link => (
                <div key={link.id} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2 border border-border">
                  <Link className="w-3 h-3 text-[hsl(217,91%,60%)] shrink-0" />
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[hsl(217,91%,60%)] hover:underline truncate flex-1">{link.url}</a>
                  <button onClick={() => updateGoal({ ...goal, referenceLinks: goal.referenceLinks.filter(l => l.id !== link.id) })}><X className="w-3 h-3 text-muted-foreground" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* VISÃO */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <SectionHeader emoji="🎯" title="VISÃO" color="hsl(45 90% 78% / 0.45)" />
        <div className="p-4 space-y-0">
          {[
            { label: "Meta:", field: "meta" as const, ph: "O que quero alcançar?" },
            { label: "Objetivo:", field: "objetivo" as const, ph: "Por que isso é importante?" },
            { label: "Tempo para bater a meta:", field: "tempo" as const, ph: "Ex: 1 ano, 6 meses..." },
          ].map(({ label, field, ph }, i) => (
            <div key={field} className="py-3 border-b border-border/50">
              <div className="flex items-start gap-2">
                <span className="text-sm font-bold text-foreground whitespace-nowrap mt-0.5">{label}</span>
                <input value={goal.vision[field]} onChange={e => updateGoal({ ...goal, vision: { ...goal.vision, [field]: e.target.value } })}
                  placeholder={ph} className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground/40" />
              </div>
            </div>
          ))}
          <div className="py-4" />
        </div>
      </div>

      {/* PROBLEMAS E SOLUÇÕES */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <SectionHeader emoji="😅" title="PROBLEMAS E SOLUÇÕES" color="hsl(0 75% 82% / 0.4)" />
        <div className="p-4 space-y-3">
          {goal.problems.map((ps, i) => (
            <div key={ps.id} className="space-y-1 pb-3 border-b border-border/50 last:border-0">
              <div className="flex items-start gap-2">
                <div className="border-l-4 border-pink-400 bg-pink-50 dark:bg-pink-500/10 rounded-r-md px-4 py-2.5 flex-1">
                  <input value={ps.problem} onChange={e => {
                    const updated = [...goal.problems]; updated[i] = { ...ps, problem: e.target.value };
                    updateGoal({ ...goal, problems: updated });
                  }} placeholder="Descreva o problema..."
                    className="bg-transparent text-sm font-bold text-pink-700 dark:text-pink-300 outline-none w-full placeholder:text-pink-300" />
                </div>
                <button onClick={() => updateGoal({ ...goal, problems: goal.problems.filter(p => p.id !== ps.id) })}><Trash2 className="w-3 h-3 text-muted-foreground/40" /></button>
              </div>
              <input value={ps.solution} onChange={e => {
                const updated = [...goal.problems]; updated[i] = { ...ps, solution: e.target.value };
                updateGoal({ ...goal, problems: updated });
              }} placeholder="Como resolver?"
                className="bg-transparent text-sm outline-none w-full pl-4 py-1 placeholder:text-muted-foreground/40" />
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

/* Helper component for timeline input */
const TimelineInput = ({ onAdd }: { onAdd: (text: string) => void }) => {
  const [text, setText] = useState("");
  return (
    <div className="flex items-center gap-3">
      <div className="w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground/20 shrink-0" />
      <input value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { onAdd(text); setText(""); } }}
        placeholder="Adicionar..."
        className="bg-transparent text-sm text-muted-foreground outline-none flex-1 placeholder:text-muted-foreground/40" />
    </div>
  );
};

/* Timeline card — extracted to avoid hooks in loops */
const TimelineCard = ({ periodKey, label, color, period, onToggle, onRemove, onAdd, onImageChange, onImageRemove }: {
  periodKey: string; label: string; color: string; period: { items: { id: string; text: string; done: boolean }[]; image?: string };
  onToggle: (id: string) => void; onRemove: (id: string) => void; onAdd: (text: string) => void;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onImageRemove: () => void;
}) => {
  const imgRef = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <div className="flex items-center justify-center" style={{ background: color, minHeight: 72 }}>
        <span className="text-4xl">⏱</span>
      </div>
      <div className="px-5 py-4 space-y-3">
        <h3 className="text-lg font-black tracking-tight text-center">{label}</h3>
        {period.items.map(item => (
          <div key={item.id} className="flex items-center gap-3 group/item">
            <CircleCheck checked={item.done} onToggle={() => onToggle(item.id)} />
            <span className={`text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</span>
            <button onClick={() => onRemove(item.id)} className="opacity-0 group-hover/item:opacity-100 text-muted-foreground/40 hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <TimelineInput onAdd={onAdd} />
        {period.image ? (
          <div className="relative group/img rounded-lg overflow-hidden">
            <img src={period.image} alt="" className="w-full h-40 object-cover rounded-lg" />
            <button onClick={onImageRemove}
              className="absolute top-2 right-2 bg-black/60 rounded-full p-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ) : (
          <button onClick={() => imgRef.current?.click()}
            className="w-full h-28 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground/50 hover:border-muted-foreground/40 transition-colors">
            <ImagePlus className="w-5 h-5" />
            <span className="text-[10px]">Adicionar imagem</span>
          </button>
        )}
        <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={onImageChange} />
      </div>
    </div>
  );
};
