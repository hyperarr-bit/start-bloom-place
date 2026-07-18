import { useState } from "react";
import { localDayKey } from "@/lib/utils";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HouseMember, ChoreTask } from "./types";

const ChoreRotation = () => {
  const [members, setMembers] = usePersistedState<HouseMember[]>("casa-members", []);
  const [chores, setChores] = usePersistedState<ChoreTask[]>("casa-chores", []);
  const [newMember, setNewMember] = useState("");
  const [newMemberEmoji, setNewMemberEmoji] = useState("👤");
  const [newChore, setNewChore] = useState("");

  const addMember = () => {
    if (!newMember.trim()) return;
    setMembers(prev => [...prev, { id: Date.now().toString(), name: newMember.trim(), emoji: newMemberEmoji }]);
    setNewMember(""); setNewMemberEmoji("👤");
  };

  const addChore = () => {
    if (!newChore.trim() || members.length === 0) return;
    setChores(prev => [...prev, { id: Date.now().toString(), name: newChore.trim(), currentTurnIndex: 0, lastRotation: "", done: false }]);
    setNewChore("");
  };

  const markDone = (id: string) => {
    setChores(prev => prev.map(c => {
      if (c.id !== id) return c;
      const nextIndex = (c.currentTurnIndex + 1) % members.length;
      return { ...c, currentTurnIndex: nextIndex, lastRotation: localDayKey(), done: false };
    }));
  };

  return (
    <div className="space-y-4">
      {/* MORADORES */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="bg-purple-200 dark:bg-purple-900/60 px-3 py-2 flex items-center justify-between">
          <h4 className="text-xs font-bold text-foreground">👥 MORADORES</h4>
          <span className="text-[10px] text-muted-foreground font-medium">{members.length}</span>
        </div>
        <div className="bg-purple-50 dark:bg-purple-950/30 p-2 space-y-1.5">
          <div className="flex flex-wrap gap-1">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-1 bg-background/60 rounded-full px-2 py-1 text-xs group">
                {m.emoji} {m.name}
                <button onClick={() => setMembers(prev => prev.filter(x => x.id !== m.id))} className="opacity-0 group-hover:opacity-100">
                  <X className="w-2.5 h-2.5 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
          {members.length === 0 && <p className="text-[11px] text-muted-foreground italic py-2 text-center">Nenhum morador ainda</p>}
          <div className="flex gap-2 pt-1">
            <Input value={newMemberEmoji} onChange={e => setNewMemberEmoji(e.target.value)} className="text-xs h-7 w-12 text-center bg-background/70" maxLength={2} />
            <Input value={newMember} onChange={e => setNewMember(e.target.value)} placeholder="Nome" className="text-xs h-7 flex-1 bg-background/70" onKeyDown={e => e.key === "Enter" && addMember()} />
            <Button size="sm" className="h-7 px-2" onClick={addMember}><Plus className="w-3 h-3" /></Button>
          </div>
        </div>
      </div>

      {/* TAREFAS */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="bg-blue-200 dark:bg-blue-900/60 px-3 py-2 flex items-center justify-between">
          <h4 className="text-xs font-bold text-foreground">📋 TAREFAS</h4>
          <span className="text-[10px] text-muted-foreground font-medium">{chores.length}</span>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 p-2 space-y-1.5">
          {chores.map(c => {
            const current = members[c.currentTurnIndex % members.length];
            return (
              <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-background/50 border border-border group">
                <div className="text-center min-w-[36px]">
                  <span className="text-lg">{current?.emoji}</span>
                  <p className="text-[9px] text-muted-foreground">{current?.name}</p>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Vez de {current?.name} • Próximo: {members[(c.currentTurnIndex + 1) % members.length]?.name}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => markDone(c.id)}>
                  <RotateCcw className="w-3 h-3" /> Feito
                </Button>
                <button onClick={() => setChores(prev => prev.filter(x => x.id !== c.id))} className="opacity-0 group-hover:opacity-100">
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            );
          })}
          {members.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic py-2 text-center">Adicione moradores para criar o revezamento!</p>
          ) : (
            <>
              {chores.length === 0 && <p className="text-[11px] text-muted-foreground italic py-2 text-center">Nenhuma tarefa ainda</p>}
              <div className="flex gap-2 pt-1">
                <Input value={newChore} onChange={e => setNewChore(e.target.value)} placeholder="Nova tarefa..." className="text-xs h-7 flex-1 bg-background/70" onKeyDown={e => e.key === "Enter" && addChore()} />
                <Button size="sm" className="h-7 px-2" onClick={addChore}><Plus className="w-3 h-3" /></Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChoreRotation;
