import { useState, useMemo } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Lightbulb, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Thought {
  id: string;
  text: string;
  tags: string[];
  hour: number;
}

interface DayData {
  [hour: number]: Thought[];
}

export const IdeasPanel = () => {
  const [allDays] = usePersistedState<Record<string, DayData>>("hiperfoco-thoughts", {});
  const [newIdea, setNewIdea] = useState("");
  const [, setAllDaysWrite] = usePersistedState<Record<string, DayData>>("hiperfoco-thoughts", {});

  // Flatten all ideas across all days, sorted by date desc
  const ideas = useMemo(() => {
    const result: { id: string; text: string; date: string; hour: number }[] = [];
    Object.entries(allDays).forEach(([dateKey, dayData]) => {
      Object.entries(dayData).forEach(([hour, thoughts]) => {
        (thoughts as Thought[]).forEach(t => {
          if (t.tags.includes("ideia")) {
            result.push({ id: t.id, text: t.text, date: dateKey, hour: Number(hour) });
          }
        });
      });
    });
    return result.sort((a, b) => b.date.localeCompare(a.date) || b.hour - a.hour);
  }, [allDays]);

  const addIdea = () => {
    if (!newIdea.trim()) return;
    const now = new Date();
    const dateKey = format(now, "yyyy-MM-dd");
    const hour = now.getHours();
    const thought: Thought = {
      id: crypto.randomUUID(),
      text: newIdea.trim(),
      tags: ["ideia"],
      hour,
    };
    setAllDaysWrite(prev => {
      const dayData = prev[dateKey] || {};
      const hourThoughts = dayData[hour] || [];
      return { ...prev, [dateKey]: { ...dayData, [hour]: [...hourThoughts, thought] } };
    });
    setNewIdea("");
  };

  const removeIdea = (id: string, date: string, hour: number) => {
    setAllDaysWrite(prev => {
      const dayData = { ...prev[date] };
      dayData[hour] = (dayData[hour] || []).filter(t => t.id !== id);
      return { ...prev, [date]: dayData };
    });
  };

  return (
    <div className="space-y-3">
      {/* Header card with inline input */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-cyan-500" />
          <h3 className="text-sm font-bold">Ideias</h3>
          <span className="ml-auto text-[10px] text-muted-foreground">{ideas.length}</span>
        </div>
        <div className="p-3 bg-card">
          <div className="flex gap-2">
            <Input
              value={newIdea}
              onChange={e => setNewIdea(e.target.value)}
              placeholder="Capturar nova ideia..."
              className="text-sm h-8 flex-1"
              onKeyDown={e => e.key === "Enter" && addIdea()}
            />
            <button
              onClick={addIdea}
              disabled={!newIdea.trim()}
              className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Ideas list */}
      {ideas.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          Nenhuma ideia ainda. Capture pela aba Dia ou pelas Ações Rápidas da Home.
        </p>
      ) : (
        <div className="space-y-2">
          {ideas.map(idea => (
            <div key={idea.id} className="group bg-card border border-border rounded-lg p-3 relative">
              <button
                onClick={() => removeIdea(idea.id, idea.date, idea.hour)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/20"
              >
                <X className="w-3 h-3 text-destructive" />
              </button>
              <p className="text-sm pr-5">{idea.text}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {format(new Date(idea.date), "dd MMM", { locale: ptBR })} · {String(idea.hour).padStart(2, "0")}h
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
