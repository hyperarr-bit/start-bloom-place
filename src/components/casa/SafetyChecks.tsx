import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, Check, Shield, AlertTriangle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmergencyItem, defaultEmergencyItems, defaultTravelChecklist, daysSince } from "./types";

const SafetyChecks = () => {
  const [travelChecklist, setTravelChecklist] = usePersistedState("casa-travel-checklist", defaultTravelChecklist);
  const [emergencyStock, setEmergencyStock] = usePersistedState<EmergencyItem[]>("casa-emergency-stock", defaultEmergencyItems);
  const [section, setSection] = useState<"travel" | "emergency">("travel");
  const [newTravelItem, setNewTravelItem] = useState("");
  const [newEmergItem, setNewEmergItem] = useState("");

  const toggleTravel = (id: string) => {
    setTravelChecklist(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  };

  const resetTravel = () => setTravelChecklist(prev => prev.map(i => ({ ...i, checked: false })));

  const allChecked = travelChecklist.every(i => i.checked);

  const toggleEmergency = (id: string) => {
    setEmergencyStock(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked, lastChecked: new Date().toISOString().split("T")[0] } : i));
  };

  const oldItems = emergencyStock.filter(i => daysSince(i.lastChecked) > 180);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={section === "travel" ? "default" : "outline"} size="sm" className="flex-1 h-9 text-xs gap-1" onClick={() => setSection("travel")}>
          🔒 Portas Fechadas
        </Button>
        <Button variant={section === "emergency" ? "default" : "outline"} size="sm" className="flex-1 h-9 text-xs gap-1" onClick={() => setSection("emergency")}>
          🆘 Estoque Emergência
        </Button>
      </div>

      {section === "travel" && (
        <div className="space-y-3">
          {allChecked && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
              <Shield className="w-8 h-8 text-green-500 mx-auto mb-1" />
              <p className="text-sm font-bold text-green-600">Casa segura! ✅</p>
              <p className="text-[10px] text-muted-foreground">Pode viajar tranquilo(a)</p>
            </div>
          )}
          <div className="bg-card rounded-xl border border-border p-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold">Checklist de Segurança</h4>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={resetTravel}>Resetar</Button>
            </div>
            <div className="space-y-1.5">
              {travelChecklist.map(item => (
                <div key={item.id} className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${item.checked ? "bg-green-500/10 border-green-500/20" : "bg-muted/30 border-border"}`}>
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
            </div>
            <div className="flex gap-2 mt-2">
              <Input value={newTravelItem} onChange={e => setNewTravelItem(e.target.value)} placeholder="Novo item..." className="text-xs h-7 flex-1"
                onKeyDown={e => { if (e.key === "Enter" && newTravelItem.trim()) { setTravelChecklist(prev => [...prev, { id: Date.now().toString(), text: newTravelItem.trim(), checked: false }]); setNewTravelItem(""); }}} />
              <Button size="sm" className="h-7 px-2" onClick={() => {
                if (newTravelItem.trim()) { setTravelChecklist(prev => [...prev, { id: Date.now().toString(), text: newTravelItem.trim(), checked: false }]); setNewTravelItem(""); }
              }}><Plus className="w-3 h-3" /></Button>
            </div>
          </div>
        </div>
      )}

      {section === "emergency" && (
        <div className="space-y-3">
          {oldItems.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 text-xs text-center">
              <AlertTriangle className="w-4 h-4 text-yellow-500 inline mr-1" />
              {oldItems.length} item(s) não verificados há mais de 6 meses
            </div>
          )}
          <div className="bg-card rounded-xl border border-border p-3">
            <h4 className="text-xs font-bold mb-3 flex items-center gap-1"><Package className="w-3 h-3" /> Estoque de Sobrevivência</h4>
            <div className="space-y-1.5">
              {emergencyStock.map(item => (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border group">
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
            </div>
            <div className="flex gap-2 mt-2">
              <Input value={newEmergItem} onChange={e => setNewEmergItem(e.target.value)} placeholder="Novo item..." className="text-xs h-7 flex-1"
                onKeyDown={e => { if (e.key === "Enter" && newEmergItem.trim()) { setEmergencyStock(prev => [...prev, { id: Date.now().toString(), name: newEmergItem.trim(), checked: false, lastChecked: "" }]); setNewEmergItem(""); }}} />
              <Button size="sm" className="h-7 px-2" onClick={() => {
                if (newEmergItem.trim()) { setEmergencyStock(prev => [...prev, { id: Date.now().toString(), name: newEmergItem.trim(), checked: false, lastChecked: "" }]); setNewEmergItem(""); }
              }}><Plus className="w-3 h-3" /></Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SafetyChecks;
