import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Destination, genId } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, MapPin, Star } from "lucide-react";

const continents = ["América do Sul", "América do Norte", "Europa", "Ásia", "África", "Oceania"];
const continentEmoji: Record<string, string> = { "América do Sul": "🌎", "América do Norte": "🌎", "Europa": "🌍", "Ásia": "🌏", "África": "🌍", "Oceania": "🌏" };
const priorityConfig: Record<string, { emoji: string; label: string; color: string; bodyColor: string }> = {
  sonho: { emoji: "💭", label: "Sonho", color: "bg-purple-200 dark:bg-purple-800/50", bodyColor: "bg-purple-50 dark:bg-purple-950/20" },
  planejando: { emoji: "📋", label: "Planejando", color: "bg-yellow-200 dark:bg-yellow-800/50", bodyColor: "bg-yellow-50 dark:bg-yellow-950/20" },
  "próximo": { emoji: "🔜", label: "Próximo", color: "bg-green-200 dark:bg-green-800/50", bodyColor: "bg-green-50 dark:bg-green-950/20" },
};

const DEFAULT_DESTINATIONS: Destination[] = [
  { id: "ex-1", name: "Tokyo", country: "Japão", continent: "Ásia", notes: "Shibuya, Akihabara, templos", visited: false, rating: 0, photoUrl: "", priority: "sonho" },
  { id: "ex-2", name: "Lisboa", country: "Portugal", continent: "Europa", notes: "Pastéis de Belém, Alfama", visited: false, rating: 0, photoUrl: "", priority: "planejando" },
  { id: "ex-3", name: "Buenos Aires", country: "Argentina", continent: "América do Sul", notes: "Caminito, La Boca, asado", visited: true, rating: 4, photoUrl: "", priority: "sonho" },
];

export const BucketList = () => {
  const [destinations, setDestinations] = usePersistedState<Destination[]>("travel-bucket", DEFAULT_DESTINATIONS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Destination>>({ visited: false, priority: "sonho", rating: 0 });
  const [filter, setFilter] = useState<string>("all");

  const save = () => {
    if (!form.name) return;
    setDestinations(prev => [...prev, {
      id: genId(), name: form.name || "", country: form.country || "", continent: form.continent || "Europa",
      notes: form.notes || "", visited: form.visited || false, rating: form.rating || 0, photoUrl: form.photoUrl || "", priority: form.priority || "sonho",
    }]);
    setForm({ visited: false, priority: "sonho", rating: 0 });
    setShowForm(false);
  };

  const toggleVisited = (id: string) => setDestinations(prev => prev.map(d => d.id === id ? { ...d, visited: !d.visited } : d));
  const setRating = (id: string, rating: number) => setDestinations(prev => prev.map(d => d.id === id ? { ...d, rating } : d));
  const remove = (id: string) => setDestinations(prev => prev.filter(d => d.id !== id));

  const stats = { total: destinations.length, visited: destinations.filter(d => d.visited).length, countries: new Set(destinations.map(d => d.country).filter(Boolean)).size };
  const filtered = filter === "all" ? destinations : destinations.filter(d => d.priority === filter);

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

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        <button onClick={() => setFilter("all")} className={`shrink-0 rounded-full px-3 py-1 text-[10px] border transition-all ${filter === "all" ? "bg-foreground text-background" : "border-border"}`}>Todos</button>
        {Object.entries(priorityConfig).map(([key, cfg]) => (
          <button key={key} onClick={() => setFilter(key)} className={`shrink-0 rounded-full px-3 py-1 text-[10px] border transition-all ${filter === key ? "bg-foreground text-background" : "border-border"}`}>
            {cfg.emoji} {cfg.label}
          </button>
        ))}
      </div>

      <Button variant="outline" className="w-full rounded-xl h-9 text-xs border-dashed" onClick={() => setShowForm(!showForm)}>
        <Plus className="w-3 h-3 mr-1" /> Novo Destino
      </Button>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <Input placeholder="Nome do destino" value={form.name || ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="h-9 rounded-xl text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="País" value={form.country || ""} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} className="h-9 rounded-xl text-sm" />
            <Select value={form.continent || "Europa"} onValueChange={v => setForm(p => ({ ...p, continent: v }))}>
              <SelectTrigger className="h-9 rounded-xl text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{continents.map(c => <SelectItem key={c} value={c}>{continentEmoji[c]} {c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Select value={form.priority || "sonho"} onValueChange={v => setForm(p => ({ ...p, priority: v as Destination["priority"] }))}>
            <SelectTrigger className="h-9 rounded-xl text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(priorityConfig).map(([k, c]) => (<SelectItem key={k} value={k}>{c.emoji} {c.label}</SelectItem>))}</SelectContent>
          </Select>
          <Textarea placeholder="Notas..." value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="text-sm min-h-[50px] rounded-xl" />
          <div className="flex gap-2">
            <Button onClick={save} className="flex-1 rounded-xl h-9 text-xs">Salvar</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)} className="rounded-xl h-9 text-xs">Cancelar</Button>
          </div>
        </div>
      )}

      {/* Destinations table — Notion-style */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-teal-200 dark:bg-teal-800/50 px-4 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider">🗺️ BUCKET LIST</span>
        </div>
        <div className="bg-teal-100 dark:bg-teal-900/20 px-3 py-1.5 grid grid-cols-12 gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
          <span className="col-span-1">✓</span>
          <span className="col-span-3">Destino</span>
          <span className="col-span-2">País</span>
          <span className="col-span-2">Continente</span>
          <span className="col-span-2">Prioridade</span>
          <span className="col-span-2 text-right">Nota</span>
        </div>
        <div className="divide-y divide-border bg-card">
          {filtered.map(d => {
            const pCfg = priorityConfig[d.priority];
            return (
              <div key={d.id} className={`px-3 py-2 grid grid-cols-12 gap-1 items-center hover:bg-muted/30 transition-colors group ${d.visited ? "opacity-60" : ""}`}>
                <div className="col-span-1">
                  <Checkbox checked={d.visited} onCheckedChange={() => toggleVisited(d.id)} />
                </div>
                <div className="col-span-3 min-w-0">
                  <p className={`text-xs font-medium truncate ${d.visited ? "line-through text-muted-foreground" : ""}`}>{d.name}</p>
                  {d.notes && <p className="text-[8px] text-muted-foreground truncate">{d.notes}</p>}
                </div>
                <span className="col-span-2 text-[10px] text-muted-foreground">{d.country}</span>
                <span className="col-span-2 text-[10px] text-muted-foreground">{continentEmoji[d.continent]} {d.continent?.split(" ")[0]}</span>
                <div className="col-span-2">
                  <Badge variant="secondary" className="text-[8px] px-1 py-0">{pCfg?.emoji} {pCfg?.label}</Badge>
                </div>
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
            );
          })}
        </div>
      </div>
    </div>
  );
};
