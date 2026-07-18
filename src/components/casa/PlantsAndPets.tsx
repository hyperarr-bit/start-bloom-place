import { useState } from "react";
import { localDayKey } from "@/lib/utils";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlantOrPet, daysSince, healthPercent, healthColor } from "./types";

const PlantsAndPets = () => {
  const [items, setItems] = usePersistedState<PlantOrPet[]>("casa-plants-pets", []);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"plant" | "pet">("plant");
  const [newInterval, setNewInterval] = useState("7");
  const [newAction, setNewAction] = useState("Regar");
  const [newEmoji, setNewEmoji] = useState("🌱");

  const addItem = () => {
    if (!newName.trim()) return;
    setItems(prev => [...prev, {
      id: Date.now().toString(), name: newName.trim(), type: newType, emoji: newEmoji,
      careInterval: parseInt(newInterval) || 7, lastCare: "", careAction: newAction, photoUrl: ""
    }]);
    setNewName(""); setNewInterval("7");
  };

  const markCare = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, lastCare: localDayKey() } : i));
  };

  const plants = items.filter(i => i.type === "plant");
  const pets = items.filter(i => i.type === "pet");

  const renderItem = (item: PlantOrPet) => {
    const days = daysSince(item.lastCare);
    const hp = healthPercent(item.lastCare, item.careInterval);
    const needsCare = hp < 30;

    return (
      <div key={item.id} className={`flex items-center gap-3 p-2 rounded-lg group ${needsCare ? "bg-red-500/10 border border-red-500/30 animate-pulse" : "bg-background/50 border border-border"}`}>
        <div className="text-xl relative">
          {item.emoji}
          {needsCare && <Droplets className="w-3 h-3 text-blue-400 absolute -top-1 -right-1 animate-bounce" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold">{item.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {item.lastCare ? `${item.careAction} há ${days}d • A cada ${item.careInterval}d` : `Nunca • A cada ${item.careInterval}d`}
          </p>
          <div className="w-full bg-muted rounded-full h-1.5 mt-1 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${healthColor(hp)}`} style={{ width: `${hp}%` }} />
          </div>
        </div>
        <Button size="sm" variant={needsCare ? "default" : "outline"} className="h-6 text-[10px] gap-1" onClick={() => markCare(item.id)}>
          {item.type === "plant" ? "💧" : "✅"} {item.careAction}
        </Button>
        <button onClick={() => setItems(prev => prev.filter(x => x.id !== item.id))} className="opacity-0 group-hover:opacity-100">
          <X className="w-3 h-3 text-muted-foreground" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* PLANTAS */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="bg-green-200 dark:bg-green-900/60 px-3 py-2 flex items-center justify-between">
          <h4 className="text-xs font-bold text-foreground">🌿 PLANTAS</h4>
          <span className="text-[10px] text-muted-foreground font-medium">{plants.length}</span>
        </div>
        <div className="bg-green-50 dark:bg-green-950/30 p-2 space-y-1.5">
          {plants.map(renderItem)}
          {plants.length === 0 && <p className="text-[11px] text-muted-foreground italic py-3 text-center">Nenhuma planta ainda</p>}
        </div>
      </div>

      {/* PETS */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="bg-amber-200 dark:bg-amber-900/60 px-3 py-2 flex items-center justify-between">
          <h4 className="text-xs font-bold text-foreground">🐾 PETS</h4>
          <span className="text-[10px] text-muted-foreground font-medium">{pets.length}</span>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/30 p-2 space-y-1.5">
          {pets.map(renderItem)}
          {pets.length === 0 && <p className="text-[11px] text-muted-foreground italic py-3 text-center">Nenhum pet ainda</p>}
        </div>
      </div>

      {/* ADD FORM */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="bg-violet-200 dark:bg-violet-900/60 px-3 py-2">
          <h4 className="text-xs font-bold text-foreground">➕ ADICIONAR</h4>
        </div>
        <div className="bg-violet-50 dark:bg-violet-950/30 p-3 space-y-2">
          <div className="flex gap-2 flex-wrap">
            <select value={newType} onChange={e => { setNewType(e.target.value as "plant" | "pet"); setNewEmoji(e.target.value === "plant" ? "🌱" : "🐕"); setNewAction(e.target.value === "plant" ? "Regar" : "Cuidar"); }}
              className="text-xs bg-background/70 border border-border rounded px-2 h-8">
              <option value="plant">🌱 Planta</option>
              <option value="pet">🐾 Pet</option>
            </select>
            <Input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} className="text-xs h-8 w-12 text-center bg-background/70" maxLength={2} />
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome" className="text-xs h-8 flex-1 bg-background/70" />
          </div>
          <div className="flex gap-2">
            <Input value={newAction} onChange={e => setNewAction(e.target.value)} placeholder="Ação" className="text-xs h-8 flex-1 bg-background/70" />
            <Input type="number" value={newInterval} onChange={e => setNewInterval(e.target.value)} placeholder="Dias" className="text-xs h-8 w-16 bg-background/70" />
            <Button size="sm" className="h-8" onClick={addItem}><Plus className="w-3 h-3" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlantsAndPets;
