import { useState } from "react";
import { Plus, Trash2, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

interface Dream {
  id: string;
  date: string;
  description: string;
  tags: string[];
  interpretation: string;
}

const emotionTags = [
  { label: "Lúcido", emoji: "✨" },
  { label: "Medo", emoji: "😨" },
  { label: "Alegria", emoji: "😊" },
  { label: "Confuso", emoji: "🌀" },
  { label: "Pesadelo", emoji: "👻" },
  { label: "Paz", emoji: "🕊️" },
];

export const DreamJournal = () => {
  const { get, set } = useUserData();
  const dreams = get<Dream[]>("mente-dreams", []);
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [interpretation, setInterpretation] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState<string | null>(null);

  const addDream = () => {
    if (!description.trim()) return;
    const updated = [
      { id: Date.now().toString(), date: new Date().toISOString(), description: description.trim(), tags: selectedTags, interpretation: interpretation.trim() },
      ...dreams,
    ];
    set("mente-dreams", updated);
    setDescription("");
    setInterpretation("");
    setSelectedTags([]);
    setShowForm(false);
  };

  const removeDream = (id: string) => set("mente-dreams", dreams.filter((d) => d.id !== id));

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const filtered = filterTag ? dreams.filter((d) => d.tags.includes(filterTag)) : dreams;

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{dreams.length} sonho{dreams.length !== 1 ? "s" : ""}</p>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs text-primary font-bold">
          <Plus className="w-3.5 h-3.5" /> Registrar
        </motion.button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="bg-card rounded-xl border border-border p-3 space-y-2 overflow-hidden">
            <Textarea placeholder="Descreva o sonho..." value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm min-h-[60px]" />
            <div className="flex flex-wrap gap-1.5">
              {emotionTags.map((t) => (
                <motion.button
                  key={t.label}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => toggleTag(t.label)}
                  className={`text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1 transition-colors ${selectedTags.includes(t.label) ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "bg-muted text-muted-foreground"}`}
                >
                  {t.emoji} {t.label}
                </motion.button>
              ))}
            </div>
            <Input placeholder="Interpretação (opcional)" value={interpretation} onChange={(e) => setInterpretation(e.target.value)} className="h-8 text-sm" />
            <motion.button whileTap={{ scale: 0.95 }} onClick={addDream} className="w-full bg-primary text-primary-foreground rounded-lg py-1.5 text-xs font-bold">Salvar</motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter tags */}
      {dreams.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setFilterTag(null)}
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${!filterTag ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
          >
            Todos
          </motion.button>
          {emotionTags.map((t) => (
            <motion.button
              key={t.label}
              whileTap={{ scale: 0.9 }}
              onClick={() => setFilterTag(filterTag === t.label ? null : t.label)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${filterTag === t.label ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
            >
              {t.emoji}
            </motion.button>
          ))}
        </div>
      )}

      {filtered.length === 0 && !showForm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 text-muted-foreground text-sm">
          <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="text-3xl mb-2">🌙</motion.div>
          Registre seus sonhos logo ao acordar
        </motion.div>
      )}

      <div className="relative">
        {filtered.length > 0 && <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border" />}
        <AnimatePresence mode="popLayout">
          {filtered.map((dream, i) => (
            <motion.div
              key={dream.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: i * 0.05 }}
              layout
              className="relative pl-10 pb-4"
            >
              <div className="absolute left-2.5 top-1 w-4 h-4 rounded-full bg-violet-500/20 flex items-center justify-center z-10">
                <Moon className="w-2.5 h-2.5 text-violet-400" />
              </div>
              <div className="bg-card rounded-xl border border-border p-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <p className="text-[10px] text-muted-foreground">{format(new Date(dream.date), "dd/MM/yyyy 'às' HH:mm")}</p>
                  <motion.button whileTap={{ scale: 0.8 }} onClick={() => removeDream(dream.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                    <Trash2 className="w-3 h-3" />
                  </motion.button>
                </div>
                <p className="text-xs mt-1.5 leading-relaxed">{dream.description}</p>
                {dream.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {dream.tags.map((tag) => {
                      const et = emotionTags.find((e) => e.label === tag);
                      return (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {et?.emoji} {tag}
                        </span>
                      );
                    })}
                  </div>
                )}
                {dream.interpretation && (
                  <p className="text-[10px] text-muted-foreground mt-2 italic border-l-2 border-violet-500/30 pl-2">{dream.interpretation}</p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
