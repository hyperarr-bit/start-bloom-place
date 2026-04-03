import { useState, useMemo } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TAGS = [
  { id: "pergunta", label: "Pergunta", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: "decisao", label: "Decisão", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { id: "meta", label: "Meta", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { id: "insight", label: "Insight", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { id: "problema", label: "Problema", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { id: "ideia", label: "Ideia", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
];

interface Thought {
  id: string;
  text: string;
  tags: string[];
  hour: number;
}

interface DayData {
  [hour: number]: Thought[];
}

export const ThoughtSearch = () => {
  const [allDays] = usePersistedState<Record<string, DayData>>("hiperfoco-thoughts", {});
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    const items: { date: string; hour: number; thought: Thought }[] = [];

    Object.entries(allDays).forEach(([date, dayData]) => {
      Object.entries(dayData).forEach(([hour, thoughts]) => {
        (thoughts as Thought[]).forEach(t => {
          const matchText = !q || t.text.toLowerCase().includes(q);
          const matchTag = !tagFilter || t.tags.includes(tagFilter);
          if (matchText && matchTag) {
            items.push({ date, hour: Number(hour), thought: t });
          }
        });
      });
    });

    return items.sort((a, b) => b.date.localeCompare(a.date) || b.hour - a.hour);
  }, [allDays, query, tagFilter]);

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar pensamentos..."
          className="pl-9 text-sm"
        />
      </div>

      {/* Tag filters */}
      <div className="flex gap-1.5 flex-wrap">
        {TAGS.map(tag => (
          <button
            key={tag.id}
            onClick={() => setTagFilter(tagFilter === tag.id ? null : tag.id)}
            className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
              tagFilter === tag.id ? tag.color + " border-current" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {tag.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground">{results.length} resultado{results.length !== 1 ? "s" : ""}</p>
        {results.map(({ date, hour, thought }) => (
          <div key={thought.id} className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-muted-foreground font-mono">
                {format(new Date(date), "dd/MM/yyyy", { locale: ptBR })} · {String(hour).padStart(2, "0")}:00
              </span>
            </div>
            <p className="text-sm">{thought.text}</p>
            {thought.tags.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {thought.tags.map(tagId => {
                  const tag = TAGS.find(t => t.id === tagId);
                  return tag ? (
                    <span key={tagId} className={`text-[9px] px-1.5 py-0.5 rounded-full border ${tag.color}`}>
                      {tag.label}
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>
        ))}
        {results.length === 0 && (
          <p className="text-xs text-muted-foreground/50 text-center py-8">Nenhum pensamento encontrado</p>
        )}
      </div>
    </div>
  );
};
