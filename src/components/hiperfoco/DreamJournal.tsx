import { useState } from "react";
import { Plus, Trash2, Moon } from "lucide-react";
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
    setDescription(""); setInterpretation(""); setSelectedTags([]);
  };

  const removeDream = (id: string) => set("mente-dreams", dreams.filter(d => d.id !== id));

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const filtered = filterTag ? dreams.filter(d => d.tags.includes(filterTag)) : dreams;

  return (
    <div className="mt-3 space-y-3">
      {/* Filter tags */}
      {dreams.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterTag(null)}
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${!filterTag ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
          >
            Todos
          </button>
          {emotionTags.map(t => (
            <button
              key={t.label}
              onClick={() => setFilterTag(filterTag === t.label ? null : t.label)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${filterTag === t.label ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
            >
              {t.emoji}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-indigo-200 dark:bg-indigo-900/60 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Moon className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-300" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-200">Diário de Sonhos</span>
          </div>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-300">{dreams.length}</span>
        </div>

        <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-2 space-y-1.5">
          {filtered.map(dream => (
            <div key={dream.id} className="bg-background/60 rounded-lg px-2.5 py-2 group">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] text-muted-foreground">{format(new Date(dream.date), "dd/MM/yyyy 'às' HH:mm")}</span>
                  </div>
                  <p className="text-xs leading-relaxed">{dream.description}</p>
                  {dream.tags.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {dream.tags.map(tag => {
                        const et = emotionTags.find(e => e.label === tag);
                        return (
                          <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {et?.emoji} {tag}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {dream.interpretation && (
                    <p className="text-[10px] text-muted-foreground mt-1.5 italic border-l-2 border-violet-500/30 pl-2">{dream.interpretation}</p>
                  )}
                </div>
                <button onClick={() => removeDream(dream.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-all">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic py-3 text-center">Nenhum sonho registrado ainda</p>
          )}

          <div className="border border-dashed border-border/60 bg-background/50 rounded-lg p-2 space-y-1.5">
            <Textarea placeholder="Descreva o sonho..." value={description} onChange={e => setDescription(e.target.value)} className="text-[11px] min-h-[40px]" rows={2} />
            <div className="flex flex-wrap gap-1">
              {emotionTags.map(t => (
                <button
                  key={t.label}
                  onClick={() => toggleTag(t.label)}
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5 transition-colors ${selectedTags.includes(t.label) ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "bg-muted text-muted-foreground"}`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
            <Input placeholder="Interpretação (opcional)" value={interpretation} onChange={e => setInterpretation(e.target.value)} className="h-7 text-[11px]" />
            <button onClick={addDream} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md py-1 transition-colors">
              <Plus className="w-3 h-3" /> Registrar sonho
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
