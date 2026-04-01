import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { DiaryEntry, genId } from "./types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, Trash2 } from "lucide-react";

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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<DiaryEntry>>({ mood: "🤩", date: new Date().toISOString().slice(0, 10) });

  const save = () => {
    if (!form.bestThing) return;
    setEntries(prev => [{
      id: genId(), tripName: form.tripName || "", date: form.date || new Date().toISOString().slice(0, 10),
      bestThing: form.bestThing || "", wouldNotDoAgain: form.wouldNotDoAgain || "",
      photoUrl: form.photoUrl || "", mood: form.mood || "🤩",
    }, ...prev]);
    setForm({ mood: "🤩", date: new Date().toISOString().slice(0, 10) });
    setShowForm(false);
  };

  const remove = (id: string) => setEntries(prev => prev.filter(e => e.id !== id));

  const trips = [...new Set(entries.map(e => e.tripName).filter(Boolean))];
  const [tripFilter, setTripFilter] = useState("all");
  const filtered = tripFilter === "all" ? entries : entries.filter(e => e.tripName === tripFilter);

  const moodCounts: Record<string, number> = {};
  entries.forEach(e => { moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1; });

  return (
    <div className="space-y-4">
      {/* Mood overview - Notion-style */}
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

      <Button variant="outline" className="w-full rounded-xl h-9 text-xs border-dashed" onClick={() => setShowForm(!showForm)}>
        <Plus className="w-3 h-3 mr-1" /> Check-in do Dia
      </Button>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Viagem" value={form.tripName || ""} onChange={e => setForm(p => ({ ...p, tripName: e.target.value }))} className="h-9 rounded-xl text-xs" />
            <Input type="date" value={form.date || ""} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="h-9 rounded-xl text-xs" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1.5">Como foi o dia?</p>
            <div className="flex gap-1.5 flex-wrap">
              {MOODS.map(m => (
                <button key={m.emoji} onClick={() => setForm(p => ({ ...p, mood: m.emoji }))}
                  className={`rounded-xl px-2 py-1 text-sm border transition-all ${
                    form.mood === m.emoji ? "border-foreground bg-muted scale-110" : "border-border hover:border-foreground/30"
                  }`} title={m.label}>
                  {m.emoji}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">✨ Qual foi a melhor coisa de hoje?</p>
            <Textarea value={form.bestThing || ""} onChange={e => setForm(p => ({ ...p, bestThing: e.target.value }))}
              className="text-xs min-h-[50px] rounded-xl" placeholder="O pôr do sol na praia foi mágico..." />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">🚫 O que não faria de novo?</p>
            <Textarea value={form.wouldNotDoAgain || ""} onChange={e => setForm(p => ({ ...p, wouldNotDoAgain: e.target.value }))}
              className="text-xs min-h-[40px] rounded-xl" placeholder="Aquele restaurante tourist trap..." />
          </div>
          <Input placeholder="📸 URL da foto do dia (opcional)" value={form.photoUrl || ""} onChange={e => setForm(p => ({ ...p, photoUrl: e.target.value }))} className="h-9 rounded-xl text-xs" />
          <div className="flex gap-2">
            <Button onClick={save} className="flex-1 rounded-xl h-8 text-xs">Salvar Momento</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)} className="rounded-xl h-8 text-xs">Cancelar</Button>
          </div>
        </div>
      )}

      {/* Diary entries - Notion-style */}
      <div className="space-y-3">
        {filtered.map(entry => (
          <div key={entry.id} className="rounded-xl border border-border overflow-hidden group hover:shadow-md transition-all">
            {entry.photoUrl && (
              <div className="h-40 overflow-hidden">
                <img src={entry.photoUrl} alt="Momento" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="bg-orange-200 dark:bg-orange-800/50 px-3 py-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {entry.mood} {new Date(entry.date).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
              </span>
              {entry.tripName && <Badge variant="secondary" className="text-[8px] px-1.5 h-4 bg-background/50">{entry.tripName}</Badge>}
            </div>
            <div className="bg-orange-50 dark:bg-orange-950/20 p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {entry.bestThing && (
                    <div className="mb-2">
                      <p className="text-[9px] font-bold text-muted-foreground mb-0.5">✨ MELHOR MOMENTO</p>
                      <p className="text-xs">{entry.bestThing}</p>
                    </div>
                  )}
                  {entry.wouldNotDoAgain && (
                    <div>
                      <p className="text-[9px] font-bold text-muted-foreground mb-0.5">🚫 NÃO FARIA DE NOVO</p>
                      <p className="text-xs text-muted-foreground">{entry.wouldNotDoAgain}</p>
                    </div>
                  )}
                </div>
                <button onClick={() => remove(entry.id)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && !showForm && (
        <div className="text-center py-12">
          <BookOpen className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Suas memórias de viagem</p>
          <p className="text-[10px] text-muted-foreground mt-1">Faça um check-in no final de cada dia</p>
        </div>
      )}
    </div>
  );
};
