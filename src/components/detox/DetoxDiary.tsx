import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  const difficultyLabel = (d: number) => ["Tranquilo", "Leve", "Médio", "Difícil", "Intenso"][d - 1] || "Médio";

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{entries.length} entrada{entries.length !== 1 ? "s" : ""}</p>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs text-primary font-bold">
          <Plus className="w-3.5 h-3.5" /> Registrar
        </motion.button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card rounded-xl border border-border p-3 space-y-3 overflow-hidden"
          >
            <Input placeholder="O que te tentou? (gatilho)" value={trigger} onChange={e => setTrigger(e.target.value)} className="h-8 text-sm" />
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">Dificuldade do dia</p>
              <div className="flex gap-1 justify-center">
                {[1, 2, 3, 4, 5].map(d => (
                  <motion.button
                    key={d}
                    whileTap={{ scale: 0.85 }}
                    onClick={() => setDifficulty(d)}
                    className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all min-w-[50px] ${
                      difficulty === d ? "bg-primary/10 ring-1 ring-primary scale-105" : "opacity-50 hover:opacity-80"
                    }`}
                  >
                    <span className="text-xl">{difficultyEmoji(d)}</span>
                    <span className="text-[8px] text-muted-foreground">{difficultyLabel(d)}</span>
                  </motion.button>
                ))}
              </div>
            </div>
            <Input placeholder="Como se sentiu? (nota livre)" value={note} onChange={e => setNote(e.target.value)} className="h-8 text-sm" />
            <motion.button whileTap={{ scale: 0.95 }} onClick={addEntry} className="w-full bg-primary text-primary-foreground rounded-lg py-1.5 text-xs font-bold">Salvar</motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {entries.length === 0 && !showForm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 text-muted-foreground text-sm">
          <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-3xl mb-2">📓</motion.div>
          Registre seus gatilhos e sentimentos
        </motion.div>
      )}

      <AnimatePresence mode="popLayout">
        {entries.map((e, i) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: i * 0.04 }}
            layout
            className="bg-card rounded-xl border border-border p-3 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-2.5 flex-1 min-w-0">
                <motion.span
                  className="text-xl mt-0.5"
                  whileHover={{ scale: 1.3 }}
                >
                  {difficultyEmoji(e.difficulty)}
                </motion.span>
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
                  {e.trigger && (
                    <p className="text-xs">
                      <span className="text-muted-foreground">Gatilho:</span> {e.trigger}
                    </p>
                  )}
                  {e.note && <p className="text-xs text-muted-foreground mt-0.5">{e.note}</p>}
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.8 }} onClick={() => removeEntry(e.id)} className="text-muted-foreground hover:text-destructive p-1 transition-colors">
                <Trash2 className="w-3 h-3" />
              </motion.button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
