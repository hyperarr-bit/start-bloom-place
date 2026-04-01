import { useState } from "react";
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
    setItems(prev => prev.map(i => i.id === id ? { ...i, lastCare: new Date().toISOString().split("T")[0] } : i));
  };

  const plants = items.filter(i => i.type === "plant");
  const pets = items.filter(i => i.type === "pet");

  const renderItem = (item: PlantOrPet) => {
    const days = daysSince(item.lastCare);
    const hp = healthPercent(item.lastCare, item.careInterval);
    const needsCare = hp < 30;

    return (
      <div key={item.id} className={`bg-card rounded-xl border p-3 group relative overflow-hidden ${needsCare ? "border-red-500/50 animate-pulse" : "border-border"}`}>
        <div className="flex items-center gap-3">
          <div className="text-2xl relative">
            {item.emoji}
            {needsCare && <Droplets className="w-3 h-3 text-blue-400 absolute -top-1 -right-1 animate-bounce" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">{item.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {item.lastCare ? `${item.careAction} há ${days}d • A cada ${item.careInterval}d` : `Nunca • A cada ${item.careInterval}d`}
            </p>
            <div className="w-full bg-muted rounded-full h-1.5 mt-1 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${healthColor(hp)}`} style={{ width: `${hp}%` }} />
            </div>
          </div>
          <Button size="sm" variant={needsCare ? "default" : "outline"} className="h-7 text-xs gap-1" onClick={() => markCare(item.id)}>
            {item.type === "plant" ? "💧" : "✅"} {item.careAction}
          </Button>
          <button onClick={() => setItems(prev => prev.filter(x => x.id !== item.id))} className="opacity-0 group-hover:opacity-100">
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {plants.length > 0 && (
        <div>
          <h3 className="text-xs font-bold mb-2">🌿 Plantas</h3>
          <div className="space-y-2">{plants.map(renderItem)}</div>
        </div>
      )}
      {pets.length > 0 && (
        <div>
          <h3 className="text-xs font-bold mb-2">🐾 Pets</h3>
          <div className="space-y-2">{pets.map(renderItem)}</div>
        </div>
      )}

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-8">Cadastre suas plantas e pets para nunca esquecer dos cuidados 🌱🐾</p>
      )}

      <div className="bg-card rounded-xl border border-border p-3 space-y-2">
        <p className="text-xs font-bold">Adicionar</p>
        <div className="flex gap-2 flex-wrap">
          <select value={newType} onChange={e => { setNewType(e.target.value as "plant" | "pet"); setNewEmoji(e.target.value === "plant" ? "🌱" : "🐕"); setNewAction(e.target.value === "plant" ? "Regar" : "Cuidar"); }}
            className="text-xs bg-background border border-border rounded px-2 h-8">
            <option value="plant">🌱 Planta</option>
            <option value="pet">🐾 Pet</option>
          </select>
          <Input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} className="text-xs h-8 w-12 text-center" maxLength={2} />
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome" className="text-xs h-8 flex-1" />
        </div>
        <div className="flex gap-2">
          <Input value={newAction} onChange={e => setNewAction(e.target.value)} placeholder="Ação" className="text-xs h-8 flex-1" />
          <Input type="number" value={newInterval} onChange={e => setNewInterval(e.target.value)} placeholder="Dias" className="text-xs h-8 w-16" />
          <Button size="sm" className="h-8" onClick={addItem}><Plus className="w-3 h-3" /></Button>
        </div>
      </div>
    </div>
  );
};

export default PlantsAndPets;
