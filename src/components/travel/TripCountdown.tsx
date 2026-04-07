import { usePersistedState } from "@/hooks/use-persisted-state";
import { TripCountdown as TripCountdownType, genId, daysUntil } from "./types";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { useState } from "react";

export const TripCountdown = () => {
  const [countdowns, setCountdowns] = usePersistedState<TripCountdownType[]>("travel-countdowns", []);
  const [inlineForm, setInlineForm] = useState({ tripName: "", departureDate: "", photoUrl: "" });

  const add = () => {
    if (!inlineForm.tripName || !inlineForm.departureDate) return;
    setCountdowns(prev => [...prev, { id: genId(), ...inlineForm }]);
    setInlineForm({ tripName: "", departureDate: "", photoUrl: "" });
  };

  const remove = (id: string) => setCountdowns(prev => prev.filter(c => c.id !== id));

  const upcoming = countdowns.filter(c => daysUntil(c.departureDate) > 0).sort((a, b) => daysUntil(a.departureDate) - daysUntil(b.departureDate));
  const past = countdowns.filter(c => daysUntil(c.departureDate) <= 0);

  return (
    <div className="space-y-3">
      {/* Upcoming */}
      {upcoming.map(c => {
        const days = daysUntil(c.departureDate);
        return (
          <div key={c.id} className="rounded-xl border border-border overflow-hidden group hover:shadow-md transition-all">
            {c.photoUrl && (
              <div className="h-28 bg-cover bg-center relative" style={{ backgroundImage: `url(${c.photoUrl})` }}>
                <div className="h-full w-full bg-gradient-to-t from-black/80 to-transparent" />
                <button onClick={() => remove(c.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full p-1">
                  <Trash2 className="w-3 h-3 text-white" />
                </button>
              </div>
            )}
            <div className="bg-teal-200 dark:bg-teal-800/50 px-3 py-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider">✈️ {c.tripName}</span>
              <span className="text-[10px] font-bold">
                {new Date(c.departureDate).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
              </span>
            </div>
            <div className="bg-teal-50 dark:bg-teal-950/20 p-4 flex items-center justify-between">
              <p className="text-xs font-medium">
                {days === 1 ? "Amanhã! ✈️" : `${days} dias restantes`}
              </p>
              <div className="text-right">
                <p className="text-3xl font-black">{days}</p>
                <p className="text-[9px] text-muted-foreground">dias</p>
              </div>
            </div>
          </div>
        );
      })}

      {/* Past trips */}
      {past.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-gray-200 dark:bg-gray-800/50 px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">📋 VIAGENS PASSADAS</span>
          </div>
          <div className="bg-gray-50 dark:bg-gray-950/20 divide-y divide-border">
            {past.map(c => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2 text-xs opacity-60 group">
                <span>{c.tripName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{new Date(c.departureDate).toLocaleDateString("pt-BR")}</span>
                  <button onClick={() => remove(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Countdown card with inline form */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-teal-200 dark:bg-teal-800/50 px-4 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider">⏳ CONTAGENS REGRESSIVAS</span>
        </div>
        <div className="bg-teal-100 dark:bg-teal-900/20 px-3 py-1.5 grid grid-cols-12 gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
          <span className="col-span-5">Viagem</span>
          <span className="col-span-4">Data</span>
          <span className="col-span-3 text-right">Ação</span>
        </div>
        <div className="bg-teal-50 dark:bg-teal-950/20">
          {countdowns.length === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-[10px] text-muted-foreground">Nenhuma viagem ainda</p>
            </div>
          )}
          {/* Inline add row */}
          <div className="px-3 py-2 grid grid-cols-12 gap-1 items-center border-t border-dashed border-border/50">
            <div className="col-span-5">
              <Input
                placeholder="Nome da viagem..."
                value={inlineForm.tripName}
                onChange={e => setInlineForm(p => ({ ...p, tripName: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && add()}
                className="h-7 text-[10px] border-none bg-transparent px-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
              />
            </div>
            <div className="col-span-4">
              <Input
                type="date"
                value={inlineForm.departureDate}
                onChange={e => setInlineForm(p => ({ ...p, departureDate: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && add()}
                className="h-7 text-[10px] border-none bg-transparent px-0 focus-visible:ring-0"
              />
            </div>
            <div className="col-span-3 text-right">
              <button onClick={add} className="text-[9px] font-medium text-muted-foreground hover:text-foreground transition-colors">+ Add</button>
            </div>
          </div>
          <div className="px-3 pb-2">
            <Input
              placeholder="📸 URL da foto (opcional)"
              value={inlineForm.photoUrl}
              onChange={e => setInlineForm(p => ({ ...p, photoUrl: e.target.value }))}
              className="h-7 text-[10px] border-none bg-transparent px-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
