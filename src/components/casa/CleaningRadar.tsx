import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CleaningTask, defaultCleaningTasks, healthPercent, healthColor, healthTextColor, daysSince } from "./types";

const CleaningRadar = () => {
  const [tasks, setTasks] = usePersistedState<CleaningTask[]>("casa-cleaning-radar", defaultCleaningTasks);
  const [newName, setNewName] = useState("");
  const [newFreq, setNewFreq] = useState("7");

  const markDone = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, lastDone: new Date().toISOString().split("T")[0] } : t));
  };

  const addTask = () => {
    if (!newName.trim()) return;
    setTasks(prev => [...prev, { id: Date.now().toString(), name: newName.trim(), room: "Geral", emoji: "✨", frequencyDays: parseInt(newFreq) || 7, lastDone: "" }]);
    setNewName("");
    setNewFreq("7");
  };

  const removeTask = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));

  const sortedTasks = [...tasks].sort((a, b) => healthPercent(a.lastDone, a.frequencyDays) - healthPercent(b.lastDone, b.frequencyDays));

  const overallHealth = tasks.length ? Math.round(tasks.reduce((sum, t) => sum + healthPercent(t.lastDone, t.frequencyDays), 0) / tasks.length) : 100;

  return (
    <div className="space-y-4">
      {/* Overall score */}
      <div className="bg-card rounded-xl border border-border p-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold">SAÚDE DA CASA</h3>
        </div>
        <div className="text-4xl font-black mb-1">
          <span className={healthTextColor(overallHealth)}>{overallHealth}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${healthColor(overallHealth)}`} style={{ width: `${overallHealth}%` }} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          {overallHealth >= 70 ? "Casa em ordem! 🏠✨" : overallHealth >= 40 ? "Algumas tarefas precisam de atenção 🟡" : "Hora de faxinar! 🔴"}
        </p>
      </div>

      {/* Tasks */}
      <div className="space-y-2">
        {sortedTasks.map(task => {
          const hp = healthPercent(task.lastDone, task.frequencyDays);
          const days = daysSince(task.lastDone);
          return (
            <div key={task.id} className="bg-card rounded-xl border border-border p-3 group">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-lg">{task.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{task.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {task.lastDone ? `Há ${days} dia${days !== 1 ? "s" : ""} • A cada ${task.frequencyDays}d` : `Nunca feito • A cada ${task.frequencyDays}d`}
                  </p>
                </div>
                <Button size="sm" variant={hp < 30 ? "destructive" : "outline"} className="h-7 text-xs gap-1" onClick={() => markDone(task.id)}>
                  <Check className="w-3 h-3" /> Limpei
                </Button>
                <button onClick={() => removeTask(task.id)} className="opacity-0 group-hover:opacity-100"><X className="w-3 h-3 text-muted-foreground" /></button>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${healthColor(hp)}`} style={{ width: `${hp}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Add */}
      <div className="bg-card rounded-xl border border-border p-3">
        <p className="text-xs font-bold mb-2">Nova tarefa</p>
        <div className="flex gap-2">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Tarefa..." className="text-xs h-8 flex-1" onKeyDown={e => e.key === "Enter" && addTask()} />
          <Input type="number" value={newFreq} onChange={e => setNewFreq(e.target.value)} placeholder="Dias" className="text-xs h-8 w-16" />
          <Button size="sm" className="h-8" onClick={addTask}><Plus className="w-3 h-3" /></Button>
        </div>
      </div>
    </div>
  );
};

export default CleaningRadar;
