import { useState } from "react";
import { Plus, Trash2, BookOpen } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

interface DiaryEntry {
  id: string;
  date: string;
  trigger: string;
  difficulty: number;
  note: string;
}

export const DetoxDiary = () => {
  const { get, set } = useUserData();
  const entries = get<DiaryEntry[]>("detox-diary", []);
  const [showForm, setShowForm] = useState(false);
  const [trigger, setTrigger] = useState("");
  const [difficulty, setDifficulty] = useState(3);
  const [note, setNote] = useState("");

  const addEntry = () => {
    if (!trigger.trim() && !note.trim()) return;
    const today = new Date().toISOString().split("T")[0];
    const updated = [{ id: Date.now().toString(), date: today, trigger: trigger.trim(), difficulty, note: note.trim() }, ...entries];
    set("detox-diary", updated);
    setTrigger(""); setNote(""); setDifficulty(3);
    setShowForm(false);
  };

  const removeEntry = (id: string) => set("detox-diary", entries.filter(e => e.id !== id));

  const difficultyEmoji = (d: number) => ["😌", "🙂", "😐", "😣", "😰"][d - 1] || "😐";

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{entries.length} entrada{entries.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs text-primary font-bold">
          <Plus className="w-3.5 h-3.5" /> Registrar
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-3 space-y-2">
          <Input placeholder="O que te tentou? (gatilho)" value={trigger} onChange={e => setTrigger(e.target.value)} className="h-8 text-sm" />
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Dificuldade do dia</p>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map(d => (
                <button key={d} onClick={() => setDifficulty(d)} className={`text-xl p-1 rounded transition-transform ${difficulty === d ? "scale-125 bg-primary/10" : "opacity-50"}`}>
                  {difficultyEmoji(d)}
                </button>
              ))}
            </div>
          </div>
          <Input placeholder="Como se sentiu? (nota livre)" value={note} onChange={e => setNote(e.target.value)} className="h-8 text-sm" />
          <button onClick={addEntry} className="w-full bg-primary text-primary-foreground rounded-lg py-1.5 text-xs font-bold">Salvar</button>
        </div>
      )}

      {entries.length === 0 && !showForm && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Registre seus gatilhos e sentimentos 📓
        </div>
      )}

      {entries.map(e => (
        <div key={e.id} className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{difficultyEmoji(e.difficulty)}</span>
                <span className="text-[10px] text-muted-foreground">{format(new Date(e.date), "dd/MM/yyyy")}</span>
              </div>
              {e.trigger && (
                <p className="text-xs">
                  <span className="text-muted-foreground">Gatilho:</span> {e.trigger}
                </p>
              )}
              {e.note && <p className="text-xs text-muted-foreground mt-0.5">{e.note}</p>}
            </div>
            <button onClick={() => removeEntry(e.id)} className="text-muted-foreground hover:text-destructive p-1">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
