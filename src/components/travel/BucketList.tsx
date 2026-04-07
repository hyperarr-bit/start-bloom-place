import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Destination, genId } from "./types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Star } from "lucide-react";

const continents = ["América do Sul", "América do Norte", "Europa", "Ásia", "África", "Oceania"];
const continentEmoji: Record<string, string> = { "América do Sul": "🌎", "América do Norte": "🌎", "Europa": "🌍", "Ásia": "🌏", "África": "🌍", "Oceania": "🌏" };

const PRIORITY_SECTIONS = [
  { key: "sonho" as const, emoji: "💭", label: "SONHO", header: "bg-purple-200 dark:bg-purple-800/50", body: "bg-purple-50 dark:bg-purple-950/20", sub: "bg-purple-100 dark:bg-purple-900/20" },
  { key: "planejando" as const, emoji: "📋", label: "PLANEJANDO", header: "bg-yellow-200 dark:bg-yellow-800/50", body: "bg-yellow-50 dark:bg-yellow-950/20", sub: "bg-yellow-100 dark:bg-yellow-900/20" },
  { key: "próximo" as const, emoji: "🔜", label: "PRÓXIMO", header: "bg-green-200 dark:bg-green-800/50", body: "bg-green-50 dark:bg-green-950/20", sub: "bg-green-100 dark:bg-green-900/20" },
];

export const BucketList = () => {
  const [destinations, setDestinations] = usePersistedState<Destination[]>("travel-bucket", []);
  const [inlineInputs, setInlineInputs] = useState<Record<string, { name: string; country: string; continent: string }>>({
    sonho: { name: "", country: "", continent: "Europa" },
    planejando: { name: "", country: "", continent: "Europa" },
    "próximo": { name: "", country: "", continent: "Europa" },
  });

  const addInline = (priority: string) => {
    const inp = inlineInputs[priority];
    if (!inp?.name) return;
    setDestinations(prev => [...prev, {
      id: genId(), name: inp.name, country: inp.country, continent: inp.continent,
      notes: "", visited: false, rating: 0, photoUrl: "", priority: priority as Destination["priority"],
    }]);
    setInlineInputs(prev => ({ ...prev, [priority]: { name: "", country: "", continent: "Europa" } }));
  };

  const toggleVisited = (id: string) => setDestinations(prev => prev.map(d => d.id === id ? { ...d, visited: !d.visited } : d));
  const setRating = (id: string, rating: number) => setDestinations(prev => prev.map(d => d.id === id ? { ...d, rating } : d));
  const remove = (id: string) => setDestinations(prev => prev.filter(d => d.id !== id));

  const stats = { total: destinations.length, visited: destinations.filter(d => d.visited).length, countries: new Set(destinations.map(d => d.country).filter(Boolean)).size };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "DESTINOS", value: stats.total, emoji: "📍", color: "bg-teal-200 dark:bg-teal-800/50", body: "bg-teal-50 dark:bg-teal-950/20" },
          { label: "VISITADOS", value: stats.visited, emoji: "✅", color: "bg-emerald-200 dark:bg-emerald-800/50", body: "bg-emerald-50 dark:bg-emerald-950/20" },
          { label: "PAÍSES", value: stats.countries, emoji: "🌍", color: "bg-sky-200 dark:bg-sky-800/50", body: "bg-sky-50 dark:bg-sky-950/20" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border overflow-hidden">
            <div className={`${s.color} px-2 py-1 text-center`}>
              <span className="text-[9px] font-bold uppercase tracking-wider">{s.emoji} {s.label}</span>
            </div>
            <div className={`${s.body} p-2.5 text-center`}>
              <p className="text-xl font-black">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Priority sections */}
      {PRIORITY_SECTIONS.map(section => {
        const items = destinations.filter(d => d.priority === section.key);
        const inp = inlineInputs[section.key];
        return (
          <div key={section.key} className="rounded-xl border border-border overflow-hidden">
            <div className={`${section.header} px-4 py-2 flex items-center justify-between`}>
              <span className="text-[10px] font-bold uppercase tracking-wider">{section.emoji} {section.label}</span>
              <span className="text-[10px] font-bold bg-background/40 rounded-full px-2 py-0.5">{items.length}</span>
            </div>
            {/* Sub-header */}
            <div className={`${section.sub} px-3 py-1.5 grid grid-cols-12 gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider`}>
              <span className="col-span-1">✓</span>
              <span className="col-span-4">Destino</span>
              <span className="col-span-3">País</span>
              <span className="col-span-2">Continente</span>
              <span className="col-span-2 text-right">Nota</span>
            </div>
            <div className={`${section.body} divide-y divide-border`}>
              {items.length === 0 && (
                <div className="px-3 py-4 text-center">
                  <p className="text-[10px] text-muted-foreground">Nenhum destino ainda</p>
                </div>
              )}
              {items.map(d => (
                <div key={d.id} className={`px-3 py-2 grid grid-cols-12 gap-1 items-center hover:bg-background/30 transition-colors group ${d.visited ? "opacity-60" : ""}`}>
                  <div className="col-span-1">
                    <Checkbox checked={d.visited} onCheckedChange={() => toggleVisited(d.id)} />
                  </div>
                  <div className="col-span-4 min-w-0">
                    <p className={`text-xs font-medium truncate ${d.visited ? "line-through text-muted-foreground" : ""}`}>{d.name}</p>
                  </div>
                  <span className="col-span-3 text-[10px] text-muted-foreground">{d.country}</span>
                  <span className="col-span-2 text-[10px] text-muted-foreground">{continentEmoji[d.continent]} {d.continent?.split(" ")[0]}</span>
                  <div className="col-span-2 flex justify-end items-center gap-1">
                    {d.visited && (
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <button key={s} onClick={() => setRating(d.id, s)}>
                            <Star className={`w-2.5 h-2.5 ${s <= d.rating ? "fill-warning text-warning" : "text-muted-foreground/30"}`} />
                          </button>
                        ))}
                      </div>
                    )}
                    <button onClick={() => remove(d.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
              {/* Inline add row */}
              <div className="px-3 py-2 grid grid-cols-12 gap-1 items-center border-t border-dashed border-border/50">
                <div className="col-span-1" />
                <div className="col-span-4">
                  <Input
                    placeholder="Destino..."
                    value={inp?.name || ""}
                    onChange={e => setInlineInputs(prev => ({ ...prev, [section.key]: { ...prev[section.key], name: e.target.value } }))}
                    onKeyDown={e => e.key === "Enter" && addInline(section.key)}
                    className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60"
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    placeholder="País"
                    value={inp?.country || ""}
                    onChange={e => setInlineInputs(prev => ({ ...prev, [section.key]: { ...prev[section.key], country: e.target.value } }))}
                    onKeyDown={e => e.key === "Enter" && addInline(section.key)}
                    className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60"
                  />
                </div>
                <div className="col-span-2">
                  <Select value={inp?.continent || "Europa"} onValueChange={v => setInlineInputs(prev => ({ ...prev, [section.key]: { ...prev[section.key], continent: v } }))}>
                    <SelectTrigger className="h-7 text-[9px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-0"><SelectValue /></SelectTrigger>
                    <SelectContent>{continents.map(c => <SelectItem key={c} value={c}>{continentEmoji[c]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 text-right">
                  <button onClick={() => addInline(section.key)} className="text-[9px] font-bold px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors">+ Add</button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
