import { usePersistedState } from "@/hooks/use-persisted-state";
import { TripCountdown as TripCountdownType, genId, daysUntil } from "./types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Plane } from "lucide-react";
import { useState } from "react";

export const TripCountdown = () => {
  const [countdowns, setCountdowns] = usePersistedState<TripCountdownType[]>("travel-countdowns", []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tripName: "", departureDate: "", photoUrl: "" });

  const add = () => {
    if (!form.tripName || !form.departureDate) return;
    setCountdowns(prev => [...prev, { id: genId(), ...form }]);
    setForm({ tripName: "", departureDate: "", photoUrl: "" });
    setShowForm(false);
  };

  const remove = (id: string) => setCountdowns(prev => prev.filter(c => c.id !== id));

  const upcoming = countdowns.filter(c => daysUntil(c.departureDate) > 0).sort((a, b) => daysUntil(a.departureDate) - daysUntil(b.departureDate));
  const past = countdowns.filter(c => daysUntil(c.departureDate) <= 0);

  return (
    <div className="space-y-3">
      {/* Upcoming - Notion-style */}
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

      {/* Past trips - Notion-style */}
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

      <Button variant="outline" className="w-full rounded-xl h-9 text-xs border-dashed" onClick={() => setShowForm(!showForm)}>
        <Plus className="w-3 h-3 mr-1" /> Novo Countdown
      </Button>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <Input placeholder="Nome da viagem" value={form.tripName} onChange={e => setForm(p => ({ ...p, tripName: e.target.value }))} className="h-8 rounded-lg text-xs" />
          <Input type="date" value={form.departureDate} onChange={e => setForm(p => ({ ...p, departureDate: e.target.value }))} className="h-8 rounded-lg text-xs" />
          <Input placeholder="URL da foto (opcional)" value={form.photoUrl} onChange={e => setForm(p => ({ ...p, photoUrl: e.target.value }))} className="h-8 rounded-lg text-xs" />
          <Button onClick={add} className="w-full rounded-lg h-7 text-xs">Criar</Button>
        </div>
      )}

      {countdowns.length === 0 && !showForm && (
        <div className="text-center py-8">
          <Plane className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">Contagem regressiva para suas viagens</p>
        </div>
      )}
    </div>
  );
};
