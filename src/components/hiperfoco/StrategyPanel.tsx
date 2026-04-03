import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, Trash2 } from "lucide-react";
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
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

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
    setAdding(false);
  };

  const updateStrategy = (id: string, updates: Partial<Strategy>) => {
    setStrategies(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeStrategy = (id: string) => {
    setStrategies(prev => prev.filter(s => s.id !== id));
  };

  const addAction = (id: string) => {
    const text = prompt("Nova ação:");
    if (!text?.trim()) return;
    setStrategies(prev => prev.map(s => s.id === id ? { ...s, actions: [...s.actions, text.trim()] } : s));
  };

  const removeAction = (id: string, idx: number) => {
    setStrategies(prev => prev.map(s => s.id === id ? { ...s, actions: s.actions.filter((_, i) => i !== idx) } : s));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estratégias</h3>
        <button onClick={() => setAdding(!adding)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {adding && (
        <div className="bg-card border border-border rounded-xl p-3 space-y-2">
          <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Título da estratégia..." className="text-sm h-8" autoFocus
            onKeyDown={e => e.key === "Enter" && addStrategy()} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="text-[10px] px-3 py-1 rounded-lg text-muted-foreground">Cancelar</button>
            <button onClick={addStrategy} disabled={!newTitle.trim()} className="text-[10px] px-3 py-1 rounded-lg bg-primary text-primary-foreground disabled:opacity-40">Criar</button>
          </div>
        </div>
      )}

      {strategies.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground/50 text-center py-8">Nenhuma estratégia criada</p>
      )}

      <div className="space-y-3">
        {strategies.map(s => {
          const status = STATUS_LABELS[s.status];
          return (
            <div key={s.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
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

              {/* Status */}
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

              {/* Description */}
              <Textarea
                value={s.description}
                onChange={e => updateStrategy(s.id, { description: e.target.value })}
                placeholder="Descreva a estratégia..."
                className="text-xs min-h-[50px] resize-none bg-muted/30"
                rows={2}
              />

              {/* Actions */}
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
                <button onClick={() => addAction(s.id)} className="text-[11px] text-muted-foreground hover:text-foreground">
                  + Adicionar ação
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
