import { useState, useMemo } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { format, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, X, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6h–23h

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

export const ThoughtCapture = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateKey = format(selectedDate, "yyyy-MM-dd");
  const [allDays, setAllDays] = usePersistedState<Record<string, DayData>>("hiperfoco-thoughts", {});
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [expandedHour, setExpandedHour] = useState<number | null>(null);
  const [newText, setNewText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const dayData = allDays[dateKey] || {};

  const setDayData = (data: DayData) => {
    setAllDays(prev => ({ ...prev, [dateKey]: data }));
  };

  const addThought = (hour: number) => {
    if (!newText.trim()) return;
    const thought: Thought = {
      id: crypto.randomUUID(),
      text: newText.trim(),
      tags: selectedTags,
      hour,
    };
    const hourThoughts = dayData[hour] || [];
    setDayData({ ...dayData, [hour]: [...hourThoughts, thought] });
    setNewText("");
    setSelectedTags([]);
    setExpandedHour(null);
  };

  const removeThought = (hour: number, id: string) => {
    const hourThoughts = (dayData[hour] || []).filter(t => t.id !== id);
    setDayData({ ...dayData, [hour]: hourThoughts });
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]);
  };

  const filteredHours = useMemo(() => {
    if (!activeFilter) return HOURS;
    return HOURS.filter(h => (dayData[h] || []).some(t => t.tags.includes(activeFilter)));
  }, [activeFilter, dayData]);

  const totalThoughts = Object.values(dayData).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between bg-card border border-border rounded-xl p-3">
        <button onClick={() => setSelectedDate(d => subDays(d, 1))} className="p-2 rounded-lg hover:bg-muted">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold">{format(selectedDate, "EEEE", { locale: ptBR })}</p>
          <p className="text-xs text-muted-foreground">{format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</p>
        </div>
        <button onClick={() => setSelectedDate(d => addDays(d, 1))} className="p-2 rounded-lg hover:bg-muted">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Stats + Filter */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{totalThoughts} pensamento{totalThoughts !== 1 ? "s" : ""} registrado{totalThoughts !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setActiveFilter(activeFilter ? null : "pergunta")}
          className={`p-1.5 rounded-lg transition-colors ${activeFilter ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Filter className="w-3.5 h-3.5" />
        </button>
      </div>

      {activeFilter && (
        <div className="flex gap-1.5 flex-wrap">
          {TAGS.map(tag => (
            <button
              key={tag.id}
              onClick={() => setActiveFilter(activeFilter === tag.id ? null : tag.id)}
              className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                activeFilter === tag.id ? tag.color + " border-current" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="relative space-y-0">
        {filteredHours.map((hour, idx) => {
          const thoughts = dayData[hour] || [];
          const isExpanded = expandedHour === hour;
          const hasThoughts = thoughts.length > 0;

          return (
            <div key={hour} className="flex gap-3">
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center w-8 shrink-0">
                <div className={`w-2.5 h-2.5 rounded-full border-2 mt-1 ${
                  hasThoughts ? "bg-primary border-primary" : "bg-background border-muted-foreground/30"
                }`} />
                {idx < filteredHours.length - 1 && (
                  <div className={`w-0.5 flex-1 min-h-[20px] ${hasThoughts ? "bg-primary/30" : "bg-border"}`} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-3 min-w-0">
                <button
                  onClick={() => setExpandedHour(isExpanded ? null : hour)}
                  className="flex items-center gap-2 mb-1"
                >
                  <span className="text-xs font-mono font-semibold text-muted-foreground">{String(hour).padStart(2, "0")}:00</span>
                  {!hasThoughts && !isExpanded && (
                    <Plus className="w-3 h-3 text-muted-foreground/50" />
                  )}
                </button>

                {/* Existing thoughts */}
                {thoughts.map(t => (
                  <div key={t.id} className="group bg-card border border-border rounded-lg p-2.5 mb-1.5 relative">
                    <button
                      onClick={() => removeThought(hour, t.id)}
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/20"
                    >
                      <X className="w-3 h-3 text-destructive" />
                    </button>
                    <p className="text-sm pr-5">{t.text}</p>
                    {t.tags.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {t.tags.map(tagId => {
                          const tag = TAGS.find(tg => tg.id === tagId);
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

                {/* Input area */}
                {isExpanded && (
                  <div className="bg-card border border-border rounded-lg p-2.5 space-y-2">
                    <Input
                      value={newText}
                      onChange={e => setNewText(e.target.value)}
                      placeholder="O que está pensando?"
                      className="text-sm h-8"
                      onKeyDown={e => e.key === "Enter" && addThought(hour)}
                      autoFocus
                    />
                    <div className="flex gap-1 flex-wrap">
                      {TAGS.map(tag => (
                        <button
                          key={tag.id}
                          onClick={() => toggleTag(tag.id)}
                          className={`text-[9px] px-1.5 py-0.5 rounded-full border transition-colors ${
                            selectedTags.includes(tag.id) ? tag.color : "border-border text-muted-foreground"
                          }`}
                        >
                          {tag.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => addThought(hour)}
                        disabled={!newText.trim()}
                        className="text-[10px] px-3 py-1 rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
                      >
                        Registrar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
