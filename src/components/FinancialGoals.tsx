import { useState, useRef } from "react";
import { Plus, Trash2, Target, X, ImagePlus, Calendar, TrendingUp, Flame, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";

interface ActionItem {
  id: string;
  text: string;
  done: boolean;
}

interface Goal {
  id: string;
  name: string;
  targetValue: number;
  currentValue: number;
  deadline?: string;
  image?: string;
}

interface TimeframeBlock {
  id: string;
  label: string;
  items: ActionItem[];
}

interface FinancialGoalsProps {
  goals: Goal[];
  setGoals: (goals: Goal[]) => void;
  actionBlocks?: TimeframeBlock[];
  setActionBlocks?: (blocks: TimeframeBlock[]) => void;
}

const defaultTimeframes: TimeframeBlock[] = [
  { id: "1d", label: "1 DIA", items: [] },
  { id: "1w", label: "1 SEMANA", items: [] },
  { id: "1m", label: "1 MÊS", items: [] },
  { id: "3m", label: "3 MESES", items: [] },
  { id: "1y", label: "1 ANO", items: [] },
];

const timeframeStyles: Record<string, { bg: string; border: string; label: string }> = {
  "1d": { bg: "bg-amber-50/80 dark:bg-amber-950/30", border: "border-amber-200/60 dark:border-amber-800/40", label: "text-amber-800 dark:text-amber-300" },
  "1w": { bg: "bg-pink-50/80 dark:bg-pink-950/30", border: "border-pink-200/60 dark:border-pink-800/40", label: "text-pink-800 dark:text-pink-300" },
  "1m": { bg: "bg-sky-50/80 dark:bg-sky-950/30", border: "border-sky-200/60 dark:border-sky-800/40", label: "text-sky-800 dark:text-sky-300" },
  "3m": { bg: "bg-emerald-50/80 dark:bg-emerald-950/30", border: "border-emerald-200/60 dark:border-emerald-800/40", label: "text-emerald-800 dark:text-emerald-300" },
  "1y": { bg: "bg-orange-50/80 dark:bg-orange-950/30", border: "border-orange-200/60 dark:border-orange-800/40", label: "text-orange-800 dark:text-orange-300" },
};

export const FinancialGoals = ({ goals, setGoals, actionBlocks, setActionBlocks }: FinancialGoalsProps) => {
  const [newGoal, setNewGoal] = useState({ name: "", targetValue: "", currentValue: "", deadline: "", image: "" });
  const [showForm, setShowForm] = useState(false);
  const [newItems, setNewItems] = useState<Record<string, string>>({});
  const [addingValue, setAddingValue] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const newFileRef = useRef<HTMLInputElement | null>(null);

  const blocks = actionBlocks || defaultTimeframes;
  const setBlocks = setActionBlocks || (() => {});

  const handleImageUpload = (file: File, callback: (dataUrl: string) => void) => {
    const reader = new FileReader();
    reader.onloadend = () => callback(reader.result as string);
    reader.readAsDataURL(file);
  };

  const addGoal = () => {
    if (newGoal.name && newGoal.targetValue) {
      setGoals([
        ...goals,
        {
          id: Date.now().toString(),
          name: newGoal.name,
          targetValue: parseFloat(newGoal.targetValue),
          currentValue: parseFloat(newGoal.currentValue) || 0,
          deadline: newGoal.deadline || undefined,
          image: newGoal.image || undefined,
        },
      ]);
      setNewGoal({ name: "", targetValue: "", currentValue: "", deadline: "", image: "" });
      setShowForm(false);
    }
  };

  const updateGoalImage = (id: string, image: string) => {
    setGoals(goals.map((g) => g.id === id ? { ...g, image } : g));
  };

  const addCustomValue = (id: string) => {
    const val = parseFloat(addingValue[id]);
    if (isNaN(val) || val <= 0) return;
    setGoals(goals.map((g) => g.id === id ? { ...g, currentValue: Math.min(g.currentValue + val, g.targetValue) } : g));
    setAddingValue({ ...addingValue, [id]: "" });
  };

  const deleteGoal = (id: string) => {
    setGoals(goals.filter((g) => g.id !== id));
  };

  const addActionItem = (blockId: string) => {
    const text = newItems[blockId];
    if (!text?.trim()) return;
    setBlocks(blocks.map(b => b.id === blockId ? { ...b, items: [...b.items, { id: Date.now().toString(), text, done: false }] } : b));
    setNewItems({ ...newItems, [blockId]: "" });
  };

  const toggleActionItem = (blockId: string, itemId: string) => {
    setBlocks(blocks.map(b => b.id === blockId ? { ...b, items: b.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i) } : b));
  };

  const removeActionItem = (blockId: string, itemId: string) => {
    setBlocks(blocks.map(b => b.id === blockId ? { ...b, items: b.items.filter(i => i.id !== itemId) } : b));
  };

  // Stats
  const totalTarget = goals.reduce((s, g) => s + g.targetValue, 0);
  const totalCurrent = goals.reduce((s, g) => s + g.currentValue, 0);
  const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;
  const completedGoals = goals.filter(g => g.currentValue >= g.targetValue).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Overview Stats */}
      {goals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-3"
        >
          <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 border border-amber-200/50 dark:border-amber-800/50 p-3 text-center">
            <Target className="w-5 h-5 mx-auto mb-1 text-amber-600 dark:text-amber-400" />
            <p className="text-lg font-black">{goals.length}</p>
            <p className="text-[10px] text-muted-foreground font-medium">METAS</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 border border-emerald-200/50 dark:border-emerald-800/50 p-3 text-center">
            <Trophy className="w-5 h-5 mx-auto mb-1 text-emerald-600 dark:text-emerald-400" />
            <p className="text-lg font-black">{completedGoals}</p>
            <p className="text-[10px] text-muted-foreground font-medium">ALCANÇADAS</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-sky-500/10 to-blue-500/10 dark:from-sky-500/20 dark:to-blue-500/20 border border-sky-200/50 dark:border-sky-800/50 p-3 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-sky-600 dark:text-sky-400" />
            <p className="text-lg font-black">{overallProgress.toFixed(0)}%</p>
            <p className="text-[10px] text-muted-foreground font-medium">PROGRESSO</p>
          </div>
        </motion.div>
      )}

      {/* Goal Cards */}
      <AnimatePresence>
        {goals.map((goal) => {
          const progress = goal.targetValue > 0 ? (goal.currentValue / goal.targetValue) * 100 : 0;
          const isComplete = progress >= 100;

          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="rounded-2xl overflow-hidden border border-border bg-card shadow-lg"
            >
              {/* Image area */}
              {goal.image ? (
                <div className="relative h-44 overflow-hidden group">
                  <img
                    src={goal.image}
                    alt={goal.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-white font-black text-xl tracking-wide uppercase drop-shadow-lg">
                      {goal.name}
                    </h3>
                  </div>
                  {/* Change image button */}
                  <button
                    onClick={() => fileInputRefs.current[goal.id]?.click()}
                    className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <ImagePlus className="w-4 h-4" />
                  </button>
                  <input
                    ref={(el) => { fileInputRefs.current[goal.id] = el; }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, (url) => updateGoalImage(goal.id, url));
                    }}
                  />
                  {isComplete && (
                    <div className="absolute top-3 left-3 bg-emerald-500 text-white rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1">
                      <Trophy className="w-3 h-3" /> META ALCANÇADA!
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => fileInputRefs.current[goal.id]?.click()}
                    className="w-full h-32 bg-gradient-to-br from-muted/50 to-muted flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ImagePlus className="w-8 h-8" />
                    <span className="text-xs font-medium">Adicionar imagem de inspiração</span>
                  </button>
                  <input
                    ref={(el) => { fileInputRefs.current[goal.id] = el; }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, (url) => updateGoalImage(goal.id, url));
                    }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card to-transparent h-12" />
                  <div className="px-4 pb-2 pt-1">
                    <h3 className="font-black text-lg tracking-wide uppercase">{goal.name}</h3>
                  </div>
                  {isComplete && (
                    <div className="absolute top-3 left-3 bg-emerald-500 text-white rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1">
                      <Trophy className="w-3 h-3" /> META ALCANÇADA!
                    </div>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Progress */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span className="text-muted-foreground">
                      R$ {goal.currentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <span className={isComplete ? "text-emerald-500" : "text-foreground"}>
                      {progress.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        isComplete
                          ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                          : "bg-gradient-to-r from-amber-400 to-orange-500"
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(progress, 100)}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-1.5">
                  <p className="text-sm">
                    <span className="font-bold text-muted-foreground">META:</span>{" "}
                    <span className="font-black">R$ {goal.targetValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </p>
                  {goal.deadline && (
                    <p className="text-sm flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-bold text-muted-foreground">Prazo:</span>{" "}
                      <span className="font-semibold">{goal.deadline}</span>
                    </p>
                  )}
                  <p className="text-sm">
                    <span className="font-bold text-muted-foreground">FALTAM:</span>{" "}
                    <span className="font-black text-orange-500 dark:text-orange-400">
                      R$ {Math.max(0, goal.targetValue - goal.currentValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </p>
                </div>

                {/* Custom value input */}
                {!isComplete && (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Valor para adicionar (R$)"
                      value={addingValue[goal.id] || ""}
                      onChange={(e) => setAddingValue({ ...addingValue, [goal.id]: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && addCustomValue(goal.id)}
                      className="text-sm h-9"
                    />
                    <Button
                      size="sm"
                      onClick={() => addCustomValue(goal.id)}
                      className="h-9 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Delete */}
                <div className="flex justify-end pt-1 border-t border-border/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteGoal(goal.id)}
                    className="text-xs text-muted-foreground hover:text-destructive h-7 px-2"
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Remover meta
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Add Goal */}
      {showForm ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl bg-card border border-border shadow-lg overflow-hidden"
        >
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-white font-bold text-sm tracking-wider text-center">
            ✨ NOVA META
          </div>
          <div className="p-4 space-y-3">
            {/* Image upload area */}
            <button
              onClick={() => newFileRef.current?.click()}
              className="w-full h-28 rounded-xl border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
            >
              {newGoal.image ? (
                <img src={newGoal.image} className="w-full h-full object-cover rounded-lg" alt="Preview" />
              ) : (
                <>
                  <ImagePlus className="w-6 h-6" />
                  <span className="text-xs font-medium">Adicionar imagem (opcional)</span>
                </>
              )}
            </button>
            <input
              ref={newFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file, (url) => setNewGoal({ ...newGoal, image: url }));
              }}
            />
            <Input
              placeholder="Nome da meta (ex: Carro dos Sonhos)"
              value={newGoal.name}
              onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
              className="font-semibold"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Valor alvo (R$)"
                value={newGoal.targetValue}
                onChange={(e) => setNewGoal({ ...newGoal, targetValue: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Valor atual (R$)"
                value={newGoal.currentValue}
                onChange={(e) => setNewGoal({ ...newGoal, currentValue: e.target.value })}
              />
            </div>
            <Input
              placeholder="Prazo (ex: Dezembro de 2026)"
              value={newGoal.deadline}
              onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
            />
            <div className="flex gap-2">
              <Button
                onClick={addGoal}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 font-bold"
              >
                Salvar Meta
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setNewGoal({ name: "", targetValue: "", currentValue: "", deadline: "", image: "" }); }}>
                Cancelar
              </Button>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div whileTap={{ scale: 0.98 }}>
          <Button
            onClick={() => setShowForm(true)}
            className="w-full py-7 text-base font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 rounded-2xl shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Meta
          </Button>
        </motion.div>
      )}

      {/* Action Plan */}
      <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-lg">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 dark:from-slate-700 dark:to-slate-600 px-4 py-4 text-center">
          <Flame className="w-5 h-5 mx-auto mb-1 text-orange-400" />
          <p className="text-white font-black text-sm tracking-wider leading-tight">
            O QUE EU PRECISO FAZER PARA<br />ATINGIR ESSAS METAS EM...
          </p>
        </div>

        <div className="p-4 space-y-3">
          {blocks.map((block) => {
            const style = timeframeStyles[block.id] || { bg: "bg-muted/30", border: "border-border", label: "text-foreground" };
            const doneCount = block.items.filter(i => i.done).length;
            return (
              <motion.div
                key={block.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl border ${style.bg} ${style.border} overflow-hidden`}
              >
                <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                  <h4 className={`font-black text-sm tracking-wider ${style.label}`}>{block.label}</h4>
                  {block.items.length > 0 && (
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      {doneCount}/{block.items.length}
                    </span>
                  )}
                </div>
                <div className="px-4 pb-3 space-y-1.5">
                  {block.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 group">
                      <Checkbox
                        checked={item.done}
                        onCheckedChange={() => toggleActionItem(block.id, item.id)}
                        className="h-4 w-4 rounded-full"
                      />
                      <span className={`flex-1 text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>
                        {item.text}
                      </span>
                      <button
                        onClick={() => removeActionItem(block.id, item.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-0.5">
                    <Checkbox disabled className="h-4 w-4 rounded-full opacity-30" />
                    <Input
                      placeholder="Adicionar uma tarefa..."
                      value={newItems[block.id] || ""}
                      onChange={(e) => setNewItems({ ...newItems, [block.id]: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && addActionItem(block.id)}
                      className="h-7 text-sm border-0 bg-transparent shadow-none px-0 focus-visible:ring-0 text-muted-foreground"
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
