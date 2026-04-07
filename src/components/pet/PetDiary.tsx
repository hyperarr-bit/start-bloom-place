import { useState } from "react";
import { Plus, Trash2, Camera } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

interface DiaryEntry {
  id: string;
  petName: string;
  date: string;
  text: string;
  mood: string;
  photoUrl?: string;
}

const moods = ["😍", "😊", "😴", "🤒", "😈", "🥺"];

export const PetDiary = () => {
  const { get, set } = useUserData();
  const entries = get<DiaryEntry[]>("pet-diary", []);
  const pets = get<any[]>("pet-list", []);
  const [showForm, setShowForm] = useState(false);
  const [petName, setPetName] = useState("");
  const [text, setText] = useState("");
  const [mood, setMood] = useState("😊");
  const [photoUrl, setPhotoUrl] = useState("");

  const addEntry = () => {
    if (!text.trim()) return;
    const updated = [
      { id: Date.now().toString(), petName: petName.trim(), date: new Date().toISOString(), text: text.trim(), mood, photoUrl: photoUrl.trim() || undefined },
      ...entries,
    ];
    set("pet-diary", updated);
    setText("");
    setPetName("");
    setMood("😊");
    setPhotoUrl("");
    setShowForm(false);
  };

  const removeEntry = (id: string) => {
    set("pet-diary", entries.filter((e) => e.id !== id));
  };

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{entries.length} momento{entries.length !== 1 ? "s" : ""}</p>
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
            className="bg-card rounded-xl border border-border p-3 space-y-2 overflow-hidden"
          >
            <Input placeholder="Nome do pet" value={petName} onChange={(e) => setPetName(e.target.value)} className="h-8 text-sm" list="diary-pet-list" />
            <datalist id="diary-pet-list">
              {pets.map((p: any) => <option key={p.id} value={p.name} />)}
            </datalist>
            <Textarea placeholder="O que aconteceu hoje?" value={text} onChange={(e) => setText(e.target.value)} className="text-sm min-h-[60px]" />
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input placeholder="URL da foto (opcional)" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="flex gap-1.5">
              {moods.map((m) => (
                <motion.button
                  key={m}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setMood(m)}
                  className={`text-lg p-1 rounded-lg transition-colors ${mood === m ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-muted"}`}
                >
                  {m}
                </motion.button>
              ))}
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={addEntry} className="w-full bg-primary text-primary-foreground rounded-lg py-1.5 text-xs font-bold">
              Salvar
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {entries.length === 0 && !showForm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 text-muted-foreground text-sm">
          <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-3xl mb-2">📸</motion.div>
          Registre momentos fofos do seu pet
        </motion.div>
      )}

      <div className="relative">
        {entries.length > 0 && <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border" />}
        <AnimatePresence mode="popLayout">
          {entries.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: i * 0.05 }}
              layout
              className="relative pl-10 pb-4"
            >
              <div className="absolute left-2.5 top-1 w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] z-10">
                {entry.mood}
              </div>
              <div className="bg-card rounded-xl border border-border p-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{entry.petName || "Meu pet"}</span>
                      <span className="text-lg">{entry.mood}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(entry.date), "dd/MM/yyyy 'às' HH:mm")}</p>
                  </div>
                  <motion.button whileTap={{ scale: 0.8 }} onClick={() => removeEntry(entry.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                    <Trash2 className="w-3 h-3" />
                  </motion.button>
                </div>
                <p className="text-xs mt-2 leading-relaxed">{entry.text}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
