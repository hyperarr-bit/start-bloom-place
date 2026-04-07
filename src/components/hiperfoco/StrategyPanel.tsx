import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, Trash2, Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Strategy {
  id: string;
  title: string;
  description: string;
  actions: string[];
  status: "planejando" | "executando" | "concluido";
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planejando: { label: "Planejando", color: "bg-amber-500/20 text-amber-400" },
  executando: { label: "Executando", color: "bg-blue-500/20 text-blue-400" },
  concluido: { label: "Concluído", color: "bg-emerald-500/20 text-emerald-400" },
};

export const StrategyPanel = () => {
  const [strategies, setStrategies] = usePersistedState<Strategy[]>("hiperfoco-strategies", []);
  const [newTitle, setNewTitle] = useState("");
  const [newAction, setNewAction] = useState<Record<string, string>>({});

  const addStrategy = () => {
    if (!newTitle.trim()) return;
    setStrategies(prev => [...prev, {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      description: "",
      actions: [],
      status: "planejando",
    }]);
    setNewTitle("");
  };

  const updateStrategy = (id: string, updates: Partial<Strategy>) => {
    setStrategies(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeStrategy = (id: string) => {
    setStrategies(prev => prev.filter(s => s.id !== id));
  };

  const addAction = (id: string) => {
    const text = newAction[id]?.trim();
    if (!text) return;
    setStrategies(prev => prev.map(s => s.id === id ? { ...s, actions: [...s.actions, text] } : s));
    setNewAction(prev => ({ ...prev, [id]: "" }));
  };

  const removeAction = (id: string, idx: number) => {
    setStrategies(prev => prev.map(s => s.id === id ? { ...s, actions: s.actions.filter((_, i) => i !== idx) } : s));
  };

  return (
    <div className="mt-3">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-blue-200 dark:bg-blue-900/60 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-200">Estratégias</span>
          </div>
          <span className="text-[10px] text-blue-600 dark:text-blue-300">{strategies.length}</span>
        </div>

        <div className="bg-blue-50/50 dark:bg-blue-950/20 p-2 space-y-2">
          {strategies.map(s => {
            const status = STATUS_LABELS[s.status];
            return (
              <div key={s.id} className="bg-background/60 rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Input
                    value={s.title}
                    onChange={e => updateStrategy(s.id, { title: e.target.value })}
                    className="text-sm font-semibold h-7 bg-transparent border-0 px-0 focus-visible:ring-0"
                  />
                  <button onClick={() => removeStrategy(s.id)} className="p-1 rounded hover:bg-destructive/20 shrink-0">
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>

                <div className="flex gap-1.5">
                  {Object.entries(STATUS_LABELS).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => updateStrategy(s.id, { status: key as Strategy["status"] })}
                      className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                        s.status === key ? val.color + " border-current" : "border-border text-muted-foreground"
                      }`}
                    >
                      {val.label}
                    </button>
                  ))}
                </div>

                <Textarea
                  value={s.description}
                  onChange={e => updateStrategy(s.id, { description: e.target.value })}
                  placeholder="Descreva a estratégia..."
                  className="text-xs min-h-[50px] resize-none bg-muted/30"
                  rows={2}
                />

                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ações</p>
                  {s.actions.map((action, idx) => (
                    <div key={idx} className="flex items-center gap-2 group text-xs">
                      <span className="text-muted-foreground">•</span>
                      <span className="flex-1">{action}</span>
                      <button onClick={() => removeAction(s.id, idx)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20">
                        <X className="w-3 h-3 text-destructive" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="Nova ação..."
                      value={newAction[s.id] || ""}
                      onChange={e => setNewAction(prev => ({ ...prev, [s.id]: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && addAction(s.id)}
                      className="h-7 text-[11px] flex-1"
                    />
                    <button onClick={() => addAction(s.id)} className="text-primary">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {strategies.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic py-3 text-center">Nenhuma estratégia ainda</p>
          )}

          <div className="border border-dashed border-border/60 bg-background/50 rounded-lg p-2 space-y-1.5">
            <Input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Título da nova estratégia..."
              className="h-7 text-[11px]"
              onKeyDown={e => e.key === "Enter" && addStrategy()}
            />
            <button onClick={addStrategy} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md py-1 transition-colors">
              <Plus className="w-3 h-3" /> Criar estratégia
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
