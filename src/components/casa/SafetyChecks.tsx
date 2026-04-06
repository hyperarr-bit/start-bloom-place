import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, Check, Shield, AlertTriangle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmergencyItem, daysSince } from "./types";

const SafetyChecks = () => {
  const [travelChecklist, setTravelChecklist] = usePersistedState<{ id: string; text: string; checked: boolean }[]>("casa-travel-checklist", []);
  const [emergencyStock, setEmergencyStock] = usePersistedState<EmergencyItem[]>("casa-emergency-stock", []);
  const [newTravelItem, setNewTravelItem] = useState("");
  const [newEmergItem, setNewEmergItem] = useState("");

  const toggleTravel = (id: string) => {
    setTravelChecklist(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  };

  const resetTravel = () => setTravelChecklist(prev => prev.map(i => ({ ...i, checked: false })));
  const allChecked = travelChecklist.length > 0 && travelChecklist.every(i => i.checked);

  const toggleEmergency = (id: string) => {
    setEmergencyStock(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked, lastChecked: new Date().toISOString().split("T")[0] } : i));
  };

  const addTravelItem = () => {
    if (!newTravelItem.trim()) return;
    setTravelChecklist(prev => [...prev, { id: Date.now().toString(), text: newTravelItem.trim(), checked: false }]);
    setNewTravelItem("");
  };

  const addEmergItem = () => {
    if (!newEmergItem.trim()) return;
    setEmergencyStock(prev => [...prev, { id: Date.now().toString(), name: newEmergItem.trim(), checked: false, lastChecked: "" }]);
    setNewEmergItem("");
  };

  return (
    <div className="space-y-4">
      {allChecked && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
          <Shield className="w-8 h-8 text-green-500 mx-auto mb-1" />
          <p className="text-sm font-bold text-green-600">Casa segura! ✅</p>
          <p className="text-[10px] text-muted-foreground">Pode viajar tranquilo(a)</p>
        </div>
      )}

      {/* CHECKLIST */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="bg-green-200 dark:bg-green-900/60 px-3 py-2 flex items-center justify-between">
          <h4 className="text-xs font-bold text-foreground">🔒 CHECKLIST DE SEGURANÇA</h4>
          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={resetTravel}>Resetar</Button>
        </div>
        <div className="bg-green-50 dark:bg-green-950/30 p-2 space-y-1.5">
          {travelChecklist.map(item => (
            <div key={item.id} className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${item.checked ? "bg-green-500/10 border-green-500/20" : "bg-background/50 border-border"}`}>
              <button onClick={() => toggleTravel(item.id)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${item.checked ? "bg-green-500 border-green-500" : "border-muted-foreground/30"}`}>
                {item.checked && <Check className="w-3 h-3 text-white" />}
              </button>
              <span className={`text-xs flex-1 ${item.checked ? "line-through text-muted-foreground" : ""}`}>{item.text}</span>
              <button onClick={() => setTravelChecklist(prev => prev.filter(x => x.id !== item.id))}>
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          ))}
          {travelChecklist.length === 0 && <p className="text-[11px] text-muted-foreground italic py-2 text-center">Nenhum item ainda</p>}
          <div className="flex gap-2 pt-1">
            <Input value={newTravelItem} onChange={e => setNewTravelItem(e.target.value)} placeholder="Adicionar item..." className="text-xs h-7 flex-1 bg-background/70"
              onKeyDown={e => e.key === "Enter" && addTravelItem()} />
            <Button size="sm" className="h-7 px-2" onClick={addTravelItem}><Plus className="w-3 h-3" /></Button>
          </div>
        </div>
      </div>

      {/* ESTOQUE EMERGÊNCIA */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="bg-red-200 dark:bg-red-900/60 px-3 py-2 flex items-center justify-between">
          <h4 className="text-xs font-bold text-foreground">🆘 ESTOQUE DE EMERGÊNCIA</h4>
          <span className="text-[10px] text-muted-foreground font-medium">{emergencyStock.length}</span>
        </div>
        <div className="bg-red-50 dark:bg-red-950/30 p-2 space-y-1.5">
          {emergencyStock.map(item => (
            <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border group">
              <button onClick={() => toggleEmergency(item.id)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${item.checked ? "bg-green-500 border-green-500" : "border-muted-foreground/30"}`}>
                {item.checked && <Check className="w-3 h-3 text-white" />}
              </button>
              <span className="text-xs flex-1">{item.name}</span>
              <span className="text-[9px] text-muted-foreground">
                {item.lastChecked ? `Checado: ${new Date(item.lastChecked).toLocaleDateString("pt-BR")}` : "Nunca"}
              </span>
              <button onClick={() => setEmergencyStock(prev => prev.filter(x => x.id !== item.id))} className="opacity-0 group-hover:opacity-100">
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          ))}
          {emergencyStock.length === 0 && <p className="text-[11px] text-muted-foreground italic py-2 text-center">Nenhum item ainda</p>}
          <div className="flex gap-2 pt-1">
            <Input value={newEmergItem} onChange={e => setNewEmergItem(e.target.value)} placeholder="Adicionar item..." className="text-xs h-7 flex-1 bg-background/70"
              onKeyDown={e => e.key === "Enter" && addEmergItem()} />
            <Button size="sm" className="h-7 px-2" onClick={addEmergItem}><Plus className="w-3 h-3" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SafetyChecks;
