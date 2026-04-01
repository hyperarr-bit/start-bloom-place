import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, Check, Users, RotateCcw } from "lucide-react";
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
      return { ...c, currentTurnIndex: nextIndex, lastRotation: new Date().toISOString().split("T")[0], done: false };
    }));
  };

  return (
    <div className="space-y-4">
      {/* Members */}
      <div className="bg-card rounded-xl border border-border p-3">
        <h4 className="text-xs font-bold mb-2 flex items-center gap-1"><Users className="w-3 h-3" /> Moradores</h4>
        <div className="flex flex-wrap gap-1 mb-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-1 bg-muted/50 rounded-full px-2 py-1 text-xs group">
              {m.emoji} {m.name}
              <button onClick={() => setMembers(prev => prev.filter(x => x.id !== m.id))} className="opacity-0 group-hover:opacity-100">
                <X className="w-2.5 h-2.5 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={newMemberEmoji} onChange={e => setNewMemberEmoji(e.target.value)} className="text-xs h-7 w-12 text-center" maxLength={2} />
          <Input value={newMember} onChange={e => setNewMember(e.target.value)} placeholder="Nome" className="text-xs h-7 flex-1" onKeyDown={e => e.key === "Enter" && addMember()} />
          <Button size="sm" className="h-7 px-2" onClick={addMember}><Plus className="w-3 h-3" /></Button>
        </div>
      </div>

      {/* Chores */}
      {members.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Adicione moradores para criar o revezamento!</p>
      ) : (
        <div className="space-y-2">
          {chores.map(c => {
            const current = members[c.currentTurnIndex % members.length];
            return (
              <div key={c.id} className="bg-card rounded-xl border border-border p-3 group">
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[40px]">
                    <span className="text-xl">{current?.emoji}</span>
                    <p className="text-[9px] text-muted-foreground">{current?.name}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Vez de {current?.name} • Próximo: {members[(c.currentTurnIndex + 1) % members.length]?.name}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => markDone(c.id)}>
                    <RotateCcw className="w-3 h-3" /> Feito
                  </Button>
                  <button onClick={() => setChores(prev => prev.filter(x => x.id !== c.id))} className="opacity-0 group-hover:opacity-100">
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              </div>
            );
          })}
          <div className="flex gap-2">
            <Input value={newChore} onChange={e => setNewChore(e.target.value)} placeholder="Nova tarefa..." className="text-xs h-8 flex-1" onKeyDown={e => e.key === "Enter" && addChore()} />
            <Button size="sm" className="h-8" onClick={addChore}><Plus className="w-3 h-3" /></Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChoreRotation;
