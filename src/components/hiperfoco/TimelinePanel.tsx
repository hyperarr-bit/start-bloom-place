import { useMemo } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { format, subDays } from "date-fns";
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

export const TimelinePanel = () => {
  const [allDays] = usePersistedState<Record<string, DayData>>("hiperfoco-thoughts", {});

  const last30Days = useMemo(() => {
    const days: { date: string; label: string; thoughts: Thought[] }[] = [];
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const d = subDays(today, i);
      const key = format(d, "yyyy-MM-dd");
      const dayData = allDays[key] || {};
      const allThoughts = Object.values(dayData).flat() as Thought[];
      if (allThoughts.length > 0) {
        days.push({
          date: key,
          label: format(d, "EEEE, dd 'de' MMMM", { locale: ptBR }),
          thoughts: allThoughts,
        });
      }
    }

    return days;
  }, [allDays]);

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Últimos 30 dias</h3>

      {last30Days.length === 0 && (
        <p className="text-xs text-muted-foreground/50 text-center py-8">Nenhum registro nos últimos 30 dias</p>
      )}

      <div className="relative space-y-0">
        {last30Days.map((day, idx) => (
          <div key={day.date} className="flex gap-3">
            {/* Timeline connector */}
            <div className="flex flex-col items-center w-3 shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5" />
              {idx < last30Days.length - 1 && <div className="w-0.5 flex-1 bg-primary/20" />}
            </div>

            {/* Day content */}
            <div className="flex-1 pb-4">
              <p className="text-xs font-semibold capitalize mb-1.5">{day.label}</p>
              <div className="space-y-1.5">
                {day.thoughts.map(t => (
                  <div key={t.id} className="bg-card border border-border rounded-lg p-2.5">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-mono text-muted-foreground">{String(t.hour).padStart(2, "0")}:00</span>
                    </div>
                    <p className="text-xs">{t.text}</p>
                    {t.tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {t.tags.map(tagId => {
                          const tag = TAGS.find(tg => tg.id === tagId);
                          return tag ? (
                            <span key={tagId} className={`text-[8px] px-1.5 py-0.5 rounded-full border ${tag.color}`}>
                              {tag.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{day.thoughts.length} pensamento{day.thoughts.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
