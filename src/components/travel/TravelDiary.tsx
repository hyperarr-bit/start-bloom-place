import { useState } from "react";
import { localDayKey, parseLocalDay } from "@/lib/utils";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { DiaryEntry, genId } from "./types";
import { Input } from "@/components/ui/input";
import { CampoData } from "@/components/ui/campo-data";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";

const MOODS = [
  { emoji: "🤩", label: "Incrível" },
  { emoji: "😊", label: "Feliz" },
  { emoji: "😌", label: "Relaxado" },
  { emoji: "🥳", label: "Festivo" },
  { emoji: "😐", label: "Normal" },
  { emoji: "😢", label: "Triste" },
  { emoji: "😴", label: "Cansado" },
];

export const TravelDiary = () => {
  const [entries, setEntries] = usePersistedState<DiaryEntry[]>("travel-diary-v2", []);
  const [inlineForm, setInlineForm] = useState<Partial<DiaryEntry>>({ mood: "🤩", date: localDayKey() });

  const save = () => {
    if (!inlineForm.bestThing) return;
    setEntries(prev => [{
      id: genId(), tripName: inlineForm.tripName || "", date: inlineForm.date || localDayKey(),
      bestThing: inlineForm.bestThing || "", wouldNotDoAgain: inlineForm.wouldNotDoAgain || "",
      photoUrl: inlineForm.photoUrl || "", mood: inlineForm.mood || "🤩",
    }, ...prev]);
    setInlineForm({ mood: "🤩", date: localDayKey() });
  };

  const remove = (id: string) => setEntries(prev => prev.filter(e => e.id !== id));

  const trips = [...new Set(entries.map(e => e.tripName).filter(Boolean))];
  const [tripFilter, setTripFilter] = useState("all");
  const filtered = tripFilter === "all" ? entries : entries.filter(e => e.tripName === tripFilter);

  const moodCounts: Record<string, number> = {};
  entries.forEach(e => { moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1; });

  return (
    <div className="space-y-4">
      {/* Mood overview */}
      {entries.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-pink-200 dark:bg-pink-800/50 px-3 py-1.5 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider">😊 HUMOR DA VIAGEM</span>
          </div>
          <div className="bg-pink-50 dark:bg-pink-950/20 p-3 flex gap-3 justify-center">
            {MOODS.filter(m => moodCounts[m.emoji]).map(m => (
              <div key={m.emoji} className="text-center">
                <span className="text-xl">{m.emoji}</span>
                <p className="text-[9px] text-muted-foreground">{moodCounts[m.emoji]}×</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      {trips.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button onClick={() => setTripFilter("all")}
            className={`shrink-0 rounded-full px-3 py-1 text-[10px] border transition-all ${tripFilter === "all" ? "bg-foreground text-background" : "border-border"}`}>
            Todas
          </button>
          {trips.map(t => (
            <button key={t} onClick={() => setTripFilter(t)}
              className={`shrink-0 rounded-full px-3 py-1 text-[10px] border transition-all ${tripFilter === t ? "bg-foreground text-background" : "border-border"}`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Diary card with inline quick-entry */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-orange-200 dark:bg-orange-800/50 px-4 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider">📔 DIÁRIO DE VIAGEM</span>
        </div>
        <div className="bg-orange-50 dark:bg-orange-950/20">
          {/* Inline quick-entry form */}
          <div className="p-3 border-b border-dashed border-border/50 space-y-2">
            <div className="flex gap-1.5 flex-wrap">
              {MOODS.map(m => (
                <button key={m.emoji} onClick={() => setInlineForm(p => ({ ...p, mood: m.emoji }))}
                  className={`rounded-lg px-1.5 py-0.5 text-sm border transition-all ${
                    inlineForm.mood === m.emoji ? "border-foreground bg-background/60 scale-110" : "border-transparent hover:border-border"
                  }`} title={m.label}>
                  {m.emoji}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Viagem" value={inlineForm.tripName || ""} onChange={e => setInlineForm(p => ({ ...p, tripName: e.target.value }))}
                className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60" />
              <div className="relative">
                <CampoData rotulo="Data" value={inlineForm.date || ""} onChange={e => setInlineForm(p => ({ ...p, date: e.target.value }))}
 className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30" />
              </div>
            </div>
            <Input placeholder="✨ Melhor momento do dia..." value={inlineForm.bestThing || ""}
              onChange={e => setInlineForm(p => ({ ...p, bestThing: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && save()}
              className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60" />
            <div className="flex items-center gap-2">
              <Input placeholder="🚫 Não faria de novo (opcional)" value={inlineForm.wouldNotDoAgain || ""}
                onChange={e => setInlineForm(p => ({ ...p, wouldNotDoAgain: e.target.value }))}
                className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60 flex-1" />
              <button onClick={save} className="text-[9px] font-bold px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0">+ Salvar</button>
            </div>
          </div>

          {/* Entries */}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-[10px] text-muted-foreground">Nenhuma entrada ainda</p>
            </div>
          )}
          <div className="divide-y divide-border">
            {filtered.map(entry => (
              <div key={entry.id} className="p-3 hover:bg-background/30 transition-colors group">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm">{entry.mood}</span>
                      <span className="text-[10px] font-medium">{parseLocalDay(entry.date).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}</span>
                      {entry.tripName && <Badge variant="secondary" className="text-[8px] px-1.5 h-4">{entry.tripName}</Badge>}
                    </div>
                    {entry.bestThing && (
                      <div className="mb-1">
                        <p className="text-[9px] font-bold text-muted-foreground">✨ MELHOR MOMENTO</p>
                        <p className="text-xs">{entry.bestThing}</p>
                      </div>
                    )}
                    {entry.wouldNotDoAgain && (
                      <div>
                        <p className="text-[9px] font-bold text-muted-foreground">🚫 NÃO FARIA DE NOVO</p>
                        <p className="text-xs text-muted-foreground">{entry.wouldNotDoAgain}</p>
                      </div>
                    )}
                  </div>
                  <button onClick={() => remove(entry.id)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
