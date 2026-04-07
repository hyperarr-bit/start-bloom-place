import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Place, PLACE_CATEGORIES, PLACE_STATUS, genId } from "./types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, ExternalLink, Heart } from "lucide-react";

const CAT_SECTIONS = [
  { key: "comida" as const, emoji: "🍽️", label: "RESTAURANTES & COMIDA", header: "bg-orange-200 dark:bg-orange-800/50", body: "bg-orange-50 dark:bg-orange-950/20" },
  { key: "turistico" as const, emoji: "📸", label: "PONTOS TURÍSTICOS", header: "bg-blue-200 dark:bg-blue-800/50", body: "bg-blue-50 dark:bg-blue-950/20" },
  { key: "compras" as const, emoji: "🛍️", label: "COMPRAS", header: "bg-pink-200 dark:bg-pink-800/50", body: "bg-pink-50 dark:bg-pink-950/20" },
  { key: "cafe" as const, emoji: "☕", label: "CAFÉS", header: "bg-yellow-200 dark:bg-yellow-800/50", body: "bg-yellow-50 dark:bg-yellow-950/20" },
  { key: "bar" as const, emoji: "🍸", label: "BARES & NOITE", header: "bg-purple-200 dark:bg-purple-800/50", body: "bg-purple-50 dark:bg-purple-950/20" },
];

export const PlacesBoard = () => {
  const [places, setPlaces] = usePersistedState<Place[]>("travel-places-v2", []);
  const [inlineInputs, setInlineInputs] = useState<Record<string, { name: string; city: string }>>({
    comida: { name: "", city: "" }, turistico: { name: "", city: "" }, compras: { name: "", city: "" },
    cafe: { name: "", city: "" }, bar: { name: "", city: "" },
  });

  const addInline = (category: string) => {
    const inp = inlineInputs[category];
    if (!inp?.name) return;
    setPlaces(prev => [...prev, {
      id: genId(), name: inp.name, category: category as Place["category"],
      address: "", mapsLink: "", status: "quero_ir", notes: "", city: inp.city,
    }]);
    setInlineInputs(prev => ({ ...prev, [category]: { name: "", city: "" } }));
  };

  const toggleFavorite = (id: string) => {
    setPlaces(prev => prev.map(p => p.id === id ? { ...p, status: p.status === "favorito" ? "ja_fui" : "favorito" } : p));
  };

  const updateStatus = (id: string, status: Place["status"]) => {
    setPlaces(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  const remove = (id: string) => setPlaces(prev => prev.filter(p => p.id !== id));

  return (
    <div className="space-y-4">
      {CAT_SECTIONS.map(section => {
        const items = places.filter(p => p.category === section.key);
        const inp = inlineInputs[section.key];
        return (
          <div key={section.key} className="rounded-xl border border-border overflow-hidden">
            <div className={`${section.header} px-4 py-2 flex items-center justify-between`}>
              <span className="text-[10px] font-bold uppercase tracking-wider">{section.emoji} {section.label}</span>
              <span className="text-[10px] font-bold bg-background/40 rounded-full px-2 py-0.5">{items.length}</span>
            </div>
            <div className={`${section.body}`}>
              {items.length === 0 && (
                <div className="px-3 py-4 text-center">
                  <p className="text-[10px] text-muted-foreground">Nenhum lugar ainda</p>
                </div>
              )}
              <div className="divide-y divide-border">
                {items.map(place => {
                  const status = PLACE_STATUS[place.status];
                  return (
                    <div key={place.id} className="p-3 hover:bg-background/30 transition-colors group">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-semibold">{place.name}</h4>
                            <Badge variant="secondary" className="text-[8px] px-1.5 h-4">{status.emoji} {status.label}</Badge>
                          </div>
                          {place.city && <p className="text-[9px] text-muted-foreground mt-0.5">📍 {place.city}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => toggleFavorite(place.id)}>
                            <Heart className={`w-3.5 h-3.5 ${place.status === "favorito" ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                          </button>
                          {place.mapsLink && (
                            <a href={place.mapsLink} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                            </a>
                          )}
                          <button onClick={() => remove(place.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-1 mt-2 pt-2 border-t border-border/50">
                        {(Object.entries(PLACE_STATUS) as [Place["status"], typeof PLACE_STATUS["quero_ir"]][]).map(([key, s]) => (
                          <button key={key} onClick={() => updateStatus(place.id, key)}
                            className={`rounded-md px-2 py-0.5 text-[8px] border transition-all ${
                              place.status === key ? "bg-foreground/10 border-foreground/20 font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}>
                            {s.emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Inline add */}
              <div className="px-3 py-2 flex items-center gap-2 border-t border-dashed border-border/50">
                <Input
                  placeholder="Nome do lugar..."
                  value={inp?.name || ""}
                  onChange={e => setInlineInputs(prev => ({ ...prev, [section.key]: { ...prev[section.key], name: e.target.value } }))}
                  onKeyDown={e => e.key === "Enter" && addInline(section.key)}
                  className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60 flex-1"
                />
                <Input
                  placeholder="Cidade"
                  value={inp?.city || ""}
                  onChange={e => setInlineInputs(prev => ({ ...prev, [section.key]: { ...prev[section.key], city: e.target.value } }))}
                  onKeyDown={e => e.key === "Enter" && addInline(section.key)}
                  className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60 w-24"
                />
                <button onClick={() => addInline(section.key)} className="text-[9px] font-bold px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0">+ Add</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
