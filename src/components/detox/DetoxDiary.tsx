import { useState } from "react";
import { localDayKey } from "@/lib/utils";
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

const difficultyEmoji = (d: number) => ["😌", "🙂", "😐", "😣", "😰"][d - 1] || "😐";
const difficultyLabel = (d: number) => ["Tranquilo", "Leve", "Médio", "Difícil", "Intenso"][d - 1] || "Médio";

export const DetoxDiary = () => {
  const { get, set } = useUserData();
  const entries = get<DiaryEntry[]>("detox-diary", []);
  const [trigger, setTrigger] = useState("");
  const [difficulty, setDifficulty] = useState(3);
  const [note, setNote] = useState("");

  const addEntry = () => {
    if (!trigger.trim() && !note.trim()) return;
    const today = localDayKey();
    const updated = [{ id: Date.now().toString(), date: today, trigger: trigger.trim(), difficulty, note: note.trim() }, ...entries];
    set("detox-diary", updated);
    setTrigger(""); setNote(""); setDifficulty(3);
  };

  const removeEntry = (id: string) => set("detox-diary", entries.filter(e => e.id !== id));

  return (
    <div className="mt-3">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-amber-200 dark:bg-amber-900/60 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">Registro do Dia</span>
          </div>
          <span className="text-[10px] text-amber-600 dark:text-amber-300">{entries.length}</span>
        </div>

        <div className="bg-amber-50/50 dark:bg-amber-950/20 p-2 space-y-1.5">
          {entries.map(e => (
            <div key={e.id} className="bg-background/60 rounded-lg px-2.5 py-2 group">
              <div className="flex items-start justify-between">
                <div className="flex gap-2 flex-1 min-w-0">
                  <span className="text-lg mt-0.5">{difficultyEmoji(e.difficulty)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] text-muted-foreground">{format(new Date(e.date), "dd/MM/yyyy")}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        e.difficulty <= 2 ? "bg-green-500/20 text-green-400" :
                        e.difficulty === 3 ? "bg-amber-500/20 text-amber-400" :
                        "bg-destructive/20 text-destructive"
                      }`}>
                        {difficultyLabel(e.difficulty)}
                      </span>
                    </div>
                    {e.trigger && <p className="text-xs"><span className="text-muted-foreground">Gatilho:</span> {e.trigger}</p>}
                    {e.note && <p className="text-xs text-muted-foreground mt-0.5">{e.note}</p>}
                  </div>
                </div>
                <button onClick={() => removeEntry(e.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-all">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}

          {entries.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic py-3 text-center">Nenhum registro ainda</p>
          )}

          <div className="border border-dashed border-border/60 bg-background/50 rounded-lg p-2 space-y-1.5">
            <Input placeholder="O que te tentou? (gatilho)" value={trigger} onChange={e => setTrigger(e.target.value)} className="h-7 text-[11px]" />
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Dificuldade</p>
              <div className="flex gap-1 justify-center">
                {[1, 2, 3, 4, 5].map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex flex-col items-center gap-0.5 p-1 rounded-lg transition-all min-w-[42px] ${
                      difficulty === d ? "bg-primary/10 ring-1 ring-primary scale-105" : "opacity-50 hover:opacity-80"
                    }`}
                  >
                    <span className="text-lg">{difficultyEmoji(d)}</span>
                    <span className="text-[7px] text-muted-foreground">{difficultyLabel(d)}</span>
                  </button>
                ))}
              </div>
            </div>
            <Input placeholder="Como se sentiu?" value={note} onChange={e => setNote(e.target.value)} className="h-7 text-[11px]" />
            <button onClick={addEntry} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md py-1 transition-colors">
              <Plus className="w-3 h-3" /> Registrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
