import { useState, useMemo } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { TravelTrip, TravelCostItem, TravelPlace, genId, formatCurrency, PLACE_CATEGORIES, PLACE_STATUS } from "./types";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ExternalLink, ImagePlus } from "lucide-react";

const CATEGORIES = [
  { key: "passagens", emoji: "✈️", label: "PASSAGENS AÉREAS", headerColor: "bg-violet-300 dark:bg-violet-700", bodyColor: "bg-violet-50 dark:bg-violet-950/20" },
  { key: "hotel", emoji: "🏨", label: "HOTEL", headerColor: "bg-teal-300 dark:bg-teal-700", bodyColor: "bg-teal-50 dark:bg-teal-950/20" },
  { key: "passeios", emoji: "🎡", label: "PASSEIOS / TURISMO", headerColor: "bg-sky-200 dark:bg-sky-700", bodyColor: "bg-sky-50 dark:bg-sky-950/20" },
  { key: "alimentacao", emoji: "🍲", label: "ALIMENTAÇÃO", headerColor: "bg-pink-300 dark:bg-pink-700", bodyColor: "bg-pink-50 dark:bg-pink-950/20" },
  { key: "transporte", emoji: "🚕", label: "TRANSPORTE", headerColor: "bg-amber-200 dark:bg-amber-700", bodyColor: "bg-amber-50 dark:bg-amber-950/20" },
  { key: "compras", emoji: "🛍️", label: "COMPRAS", headerColor: "bg-rose-300 dark:bg-rose-700", bodyColor: "bg-rose-50 dark:bg-rose-950/20" },
];

const PLACE_CAT_OPTIONS = Object.entries(PLACE_CATEGORIES) as [keyof typeof PLACE_CATEGORIES, { label: string; emoji: string }][];
const PLACE_STATUS_OPTIONS = Object.entries(PLACE_STATUS) as [keyof typeof PLACE_STATUS, { label: string; emoji: string }][];

const defaultTrip = (): TravelTrip => ({
  id: genId(),
  destination: "",
  startDate: "",
  endDate: "",
  photoUrl: "",
  places: [],
  categories: Object.fromEntries(CATEGORIES.map(c => [c.key, []])),
});

export const TravelBudget = () => {
  const [trip, setTrip] = usePersistedState<TravelTrip>("travel-budget-v2", defaultTrip());

  const nightsCount = useMemo(() => {
    if (!trip.startDate || !trip.endDate) return 0;
    const diff = new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [trip.startDate, trip.endDate]);

  const updateTrip = (patch: Partial<TravelTrip>) => setTrip(prev => ({ ...prev, ...patch }));

  // === Cost items ===
  const updateItem = (catKey: string, itemId: string, patch: Partial<TravelCostItem>) => {
    setTrip(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [catKey]: (prev.categories[catKey] || []).map(item =>
          item.id === itemId ? { ...item, ...patch } : item
        ),
      },
    }));
  };

  const addItem = (catKey: string) => {
    setTrip(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [catKey]: [...(prev.categories[catKey] || []), { id: genId(), description: "", estimated: 0, actual: 0 }],
      },
    }));
  };

  const removeItem = (catKey: string, itemId: string) => {
    setTrip(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [catKey]: (prev.categories[catKey] || []).filter(item => item.id !== itemId),
      },
    }));
  };

  // === Places ===
  const places = trip.places || [];

  const addPlace = () => {
    setTrip(prev => ({
      ...prev,
      places: [...(prev.places || []), { id: genId(), name: "", category: "comida", notes: "", mapsLink: "", status: "quero_ir" }],
    }));
  };

  const updatePlace = (placeId: string, patch: Partial<TravelPlace>) => {
    setTrip(prev => ({
      ...prev,
      places: (prev.places || []).map(p => p.id === placeId ? { ...p, ...patch } : p),
    }));
  };

  const removePlace = (placeId: string) => {
    setTrip(prev => ({
      ...prev,
      places: (prev.places || []).filter(p => p.id !== placeId),
    }));
  };

  const cycleStatus = (placeId: string) => {
    const order: TravelPlace["status"][] = ["quero_ir", "ja_fui", "favorito"];
    setTrip(prev => ({
      ...prev,
      places: (prev.places || []).map(p => {
        if (p.id !== placeId) return p;
        const idx = order.indexOf(p.status);
        return { ...p, status: order[(idx + 1) % order.length] };
      }),
    }));
  };

  // === Totals ===
  const catTotals = useMemo(() => {
    return CATEGORIES.map(cat => {
      const items = trip.categories[cat.key] || [];
      return {
        key: cat.key,
        label: cat.label,
        emoji: cat.emoji,
        estimated: items.reduce((s, i) => s + (i.estimated || 0), 0),
        actual: items.reduce((s, i) => s + (i.actual || 0), 0),
      };
    });
  }, [trip.categories]);

  const grandEstimated = catTotals.reduce((s, c) => s + c.estimated, 0);
  const grandActual = catTotals.reduce((s, c) => s + c.actual, 0);

  return (
    <div className="space-y-3">
      {/* Destination card */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-blue-200 dark:bg-blue-800/60 px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-wider">📍 DESTINO</span>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 space-y-2">
          {trip.photoUrl && (
            <div className="rounded-lg overflow-hidden aspect-video relative group/photo">
              <img src={trip.photoUrl} alt={trip.destination || "Destino"} className="w-full h-full object-cover" />
              <button
                onClick={() => updateTrip({ photoUrl: "" })}
                className="absolute top-1.5 right-1.5 rounded-full w-6 h-6 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
          <Input
            placeholder="Nome do destino (ex: Nova York)"
            value={trip.destination}
            onChange={e => updateTrip({ destination: e.target.value })}
            className="h-8 rounded-lg text-xs bg-background/60"
          />
          {!trip.photoUrl && (
            <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-border/60 bg-background/40 hover:bg-background/60 transition-colors px-3 py-2">
              <ImagePlus className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">Adicionar foto do destino</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => updateTrip({ photoUrl: reader.result as string });
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-muted-foreground font-medium uppercase">Data de Ida</label>
              <Input
                type="date"
                value={trip.startDate}
                onChange={e => updateTrip({ startDate: e.target.value })}
                className="h-8 rounded-lg text-xs bg-background/60"
              />
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground font-medium uppercase">Data de Volta</label>
              <Input
                type="date"
                value={trip.endDate}
                onChange={e => updateTrip({ endDate: e.target.value })}
                className="h-8 rounded-lg text-xs bg-background/60"
              />
            </div>
          </div>
          {nightsCount > 0 && (
            <p className="text-xs text-muted-foreground text-center font-medium">
              🌙 {nightsCount} {nightsCount === 1 ? "noite" : "noites"}
            </p>
          )}
        </div>
      </div>

      {/* Category cards */}
      {CATEGORIES.map(cat => {
        const items = trip.categories[cat.key] || [];
        const totalEst = items.reduce((s, i) => s + (i.estimated || 0), 0);
        const totalAct = items.reduce((s, i) => s + (i.actual || 0), 0);

        return (
          <div key={cat.key} className="rounded-xl border border-border overflow-hidden">
            <div className={`${cat.headerColor} px-3 py-2 flex items-center justify-between`}>
              <span className="text-xs font-bold uppercase tracking-wider">
                {cat.emoji} {cat.label}
              </span>
              <button
                onClick={() => addItem(cat.key)}
                className="rounded-full w-5 h-5 flex items-center justify-center bg-background/40 hover:bg-background/70 transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div className={`${cat.bodyColor}`}>
              {items.length > 0 && (
                <div className="px-3 pt-2">
                  <div className="grid grid-cols-[1fr_80px_80px_24px] gap-1 mb-1">
                    <span className="text-[8px] font-bold text-muted-foreground uppercase">Descrição</span>
                    <span className="text-[8px] font-bold text-muted-foreground uppercase text-right">Estimado</span>
                    <span className="text-[8px] font-bold text-muted-foreground uppercase text-right">Real</span>
                    <span />
                  </div>
                  {items.map(item => (
                    <div key={item.id} className="grid grid-cols-[1fr_80px_80px_24px] gap-1 items-center mb-1 group">
                      <Input
                        value={item.description}
                        onChange={e => updateItem(cat.key, item.id, { description: e.target.value })}
                        placeholder="Descrição"
                        className="h-7 rounded-md text-[11px] bg-background/50 border-0 px-2"
                      />
                      <Input
                        type="number"
                        value={item.estimated || ""}
                        onChange={e => updateItem(cat.key, item.id, { estimated: Number(e.target.value) })}
                        placeholder="0"
                        className="h-7 rounded-md text-[11px] bg-background/50 border-0 px-2 text-right tabular-nums"
                      />
                      <Input
                        type="number"
                        value={item.actual || ""}
                        onChange={e => updateItem(cat.key, item.id, { actual: Number(e.target.value) })}
                        placeholder="0"
                        className="h-7 rounded-md text-[11px] bg-background/50 border-0 px-2 text-right tabular-nums"
                      />
                      <button
                        onClick={() => removeItem(cat.key, item.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {items.length === 0 && (
                <button
                  onClick={() => addItem(cat.key)}
                  className="w-full py-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  + Adicionar item
                </button>
              )}

              {items.length > 0 && (
                <div className="px-3 py-2 border-t border-border/30 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Valor Total</span>
                  <div className="flex gap-4">
                    <span className="text-xs font-bold tabular-nums">{formatCurrency(totalEst)}</span>
                    <span className="text-xs font-bold tabular-nums">{formatCurrency(totalAct)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Places card */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-emerald-300 dark:bg-emerald-700 px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider">📍 LOCAIS PARA CONHECER</span>
          <button
            onClick={addPlace}
            className="rounded-full w-5 h-5 flex items-center justify-center bg-background/40 hover:bg-background/70 transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/20">
          {places.length === 0 && (
            <button
              onClick={addPlace}
              className="w-full py-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              + Adicionar local
            </button>
          )}
          {places.map(place => (
            <div key={place.id} className="px-3 py-2.5 border-b border-border/20 last:border-b-0 group">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-1.5">
                  <Input
                    value={place.name}
                    onChange={e => updatePlace(place.id, { name: e.target.value })}
                    placeholder="Nome do local"
                    className="h-7 rounded-md text-[11px] bg-background/50 border-0 px-2 font-medium"
                  />
                  <div className="flex gap-1.5 items-center flex-wrap">
                    <select
                      value={place.category}
                      onChange={e => updatePlace(place.id, { category: e.target.value as TravelPlace["category"] })}
                      className="h-6 rounded-md text-[10px] bg-background/50 border-0 px-1.5 appearance-none cursor-pointer"
                    >
                      {PLACE_CAT_OPTIONS.map(([key, val]) => (
                        <option key={key} value={key}>{val.emoji} {val.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => cycleStatus(place.id)}
                      className="h-6 rounded-md text-[10px] bg-background/50 px-2 hover:bg-background/80 transition-colors whitespace-nowrap"
                    >
                      {PLACE_STATUS[place.status].emoji} {PLACE_STATUS[place.status].label}
                    </button>
                  </div>
                  <Input
                    value={place.notes}
                    onChange={e => updatePlace(place.id, { notes: e.target.value })}
                    placeholder="Notas..."
                    className="h-6 rounded-md text-[10px] bg-background/50 border-0 px-2 text-muted-foreground"
                  />
                  <div className="flex items-center gap-1">
                    <Input
                      value={place.mapsLink}
                      onChange={e => updatePlace(place.id, { mapsLink: e.target.value })}
                      placeholder="Link Google Maps"
                      className="h-6 rounded-md text-[10px] bg-background/50 border-0 px-2 flex-1"
                    />
                    {place.mapsLink && (
                      <a href={place.mapsLink} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removePlace(place.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                >
                  <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grand total card */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-stone-400 dark:bg-stone-700 px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-wider">💰 ORÇAMENTO TOTAL</span>
        </div>
        <div className="bg-stone-50 dark:bg-stone-950/20">
          <div className="grid grid-cols-[1fr_90px_90px] gap-1 px-3 pt-2 mb-1">
            <span className="text-[8px] font-bold text-muted-foreground uppercase">Categoria</span>
            <span className="text-[8px] font-bold text-muted-foreground uppercase text-right">Estimado</span>
            <span className="text-[8px] font-bold text-muted-foreground uppercase text-right">Real</span>
          </div>
          {catTotals.map(ct => (
            <div key={ct.key} className="grid grid-cols-[1fr_90px_90px] gap-1 px-3 py-1 items-center">
              <span className="text-[11px] font-medium">{ct.emoji} {ct.label}</span>
              <span className="text-[11px] tabular-nums text-right">{formatCurrency(ct.estimated)}</span>
              <span className="text-[11px] tabular-nums text-right">{formatCurrency(ct.actual)}</span>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_90px_90px] gap-1 px-3 py-2 border-t border-border/40 items-center">
            <span className="text-xs font-black uppercase">TOTAL</span>
            <span className="text-xs font-black tabular-nums text-right">{formatCurrency(grandEstimated)}</span>
            <span className="text-xs font-black tabular-nums text-right">{formatCurrency(grandActual)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
