import { useEffect, useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ServiceContact, DeclutterItem, UtilityRecord, GuestAllergy } from "./types";

const HomeUtilities = () => {
  const [contacts, setContacts] = usePersistedState<ServiceContact[]>("casa-contacts", []);
  const [allergies, setAllergies] = usePersistedState<GuestAllergy[]>("casa-allergies", []);
  const [declutter, setDeclutter] = usePersistedState<DeclutterItem[]>("casa-declutter", []);
  const [utilities, setUtilities] = usePersistedState<UtilityRecord[]>("casa-utilities", []);

  // Limpa qualquer senha de Wi-Fi salva anteriormente
  useEffect(() => {
    try {
      localStorage.removeItem("casa-wifi-ssid");
      localStorage.removeItem("casa-wifi-pass");
    } catch {}
  }, []);

  // Forms
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cTag, setCTag] = useState("Encanador");
  const [aName, setAName] = useState("");
  const [aRestriction, setARestriction] = useState("");
  const [dName, setDName] = useState("");
  const [dPrice, setDPrice] = useState("");
  const [uMonth, setUMonth] = useState("");
  const [uType, setUType] = useState<UtilityRecord["type"]>("luz");
  const [uCost, setUCost] = useState("");
  const [uConsumption, setUConsumption] = useState("");

  return (
    <div className="space-y-4">
      {/* CONTATOS */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="bg-blue-200 dark:bg-blue-900/60 px-3 py-2 flex items-center justify-between">
          <h4 className="text-xs font-bold text-foreground">📞 CONTATOS ÚTEIS</h4>
          <span className="text-[10px] text-muted-foreground font-medium">{contacts.length}</span>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 p-2 space-y-1.5">
          {contacts.map(c => (
            <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border group">
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{c.tag}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold">{c.name}</p>
                <p className="text-[10px] text-muted-foreground">{c.phone}</p>
              </div>
              <a href={`https://wa.me/55${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="h-6 text-[10px]">WhatsApp</Button>
              </a>
              <button onClick={() => setContacts(prev => prev.filter(x => x.id !== c.id))} className="opacity-0 group-hover:opacity-100">
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          ))}
          {contacts.length === 0 && <p className="text-[11px] text-muted-foreground italic py-2 text-center">Nenhum contato ainda</p>}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <Input value={cName} onChange={e => setCName(e.target.value)} placeholder="Nome" className="text-xs h-7 col-span-2 bg-background/70" />
            <select value={cTag} onChange={e => setCTag(e.target.value)} className="text-xs bg-background/70 border border-border rounded px-1 h-7">
              {["Encanador", "Eletricista", "Portaria", "Síndico", "Veterinário", "Faxineira", "Outro"].map(t => <option key={t}>{t}</option>)}
            </select>
            <Input value={cPhone} onChange={e => setCPhone(e.target.value)} placeholder="Telefone" className="text-xs h-7 col-span-2 bg-background/70" />
            <Button size="sm" className="h-7 text-xs" onClick={() => {
              if (cName.trim()) { setContacts(prev => [...prev, { id: Date.now().toString(), name: cName.trim(), phone: cPhone, tag: cTag, lastService: "", lastValue: "" }]); setCName(""); setCPhone(""); }
            }}>Salvar</Button>
          </div>
        </div>
      </div>

      {/* ANFITRIÃO */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="bg-pink-200 dark:bg-pink-900/60 px-3 py-2">
          <h4 className="text-xs font-bold text-foreground">🍽️ ANFITRIÃO — RESTRIÇÕES DOS AMIGOS</h4>
        </div>
        <div className="bg-pink-50 dark:bg-pink-950/30 p-3">
          {allergies.map(a => (
            <div key={a.id} className="flex items-center gap-2 text-xs bg-background/50 rounded-lg p-2 mb-1 group">
              <span className="font-bold">{a.name}</span>
              <span className="text-muted-foreground">→ {a.restriction}</span>
              <button onClick={() => setAllergies(prev => prev.filter(x => x.id !== a.id))} className="ml-auto opacity-0 group-hover:opacity-100">
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          ))}
          {allergies.length === 0 && <p className="text-[11px] text-muted-foreground italic py-1 text-center">Nenhuma restrição</p>}
          <div className="flex gap-2 mt-1">
            <Input value={aName} onChange={e => setAName(e.target.value)} placeholder="Nome" className="text-xs h-7 flex-1 bg-background/70" />
            <Input value={aRestriction} onChange={e => setARestriction(e.target.value)} placeholder="Restrição" className="text-xs h-7 flex-1 bg-background/70" />
            <Button size="sm" className="h-7 px-2" onClick={() => {
              if (aName.trim()) { setAllergies(prev => [...prev, { id: Date.now().toString(), name: aName.trim(), restriction: aRestriction.trim() }]); setAName(""); setARestriction(""); }
            }}><Plus className="w-3 h-3" /></Button>
          </div>
        </div>
      </div>

      {/* DESAPEGO */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="bg-orange-200 dark:bg-orange-900/60 px-3 py-2">
          <h4 className="text-xs font-bold text-foreground">📦 DESAPEGO</h4>
        </div>
        <div className="bg-orange-50 dark:bg-orange-950/30 p-2 space-y-2">
          {(["separar", "anunciado", "vendido"] as const).map(status => {
            const label = { separar: "📥 Para Separar", anunciado: "📢 Anunciado/Doar", vendido: "✅ Vendido" }[status];
            const items = declutter.filter(d => d.status === status);
            return (
              <div key={status}>
                <p className="text-[10px] font-bold text-muted-foreground mb-1">{label} ({items.length})</p>
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-xs bg-background/50 rounded-lg p-2 mb-1 border border-border group">
                    <span className="flex-1">{item.name}</span>
                    {item.price && <span className="text-muted-foreground">R$ {item.price}</span>}
                    <select value={item.status} onChange={e => setDeclutter(prev => prev.map(d => d.id === item.id ? { ...d, status: e.target.value as DeclutterItem["status"] } : d))}
                      className="text-[10px] bg-background border border-border rounded px-1 py-0.5">
                      <option value="separar">Separar</option>
                      <option value="anunciado">Anunciado</option>
                      <option value="vendido">Vendido</option>
                    </select>
                    <button onClick={() => setDeclutter(prev => prev.filter(x => x.id !== item.id))} className="opacity-0 group-hover:opacity-100">
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
          {declutter.length === 0 && <p className="text-[11px] text-muted-foreground italic py-2 text-center">Nenhum item ainda</p>}
          <div className="flex gap-2 pt-1">
            <Input value={dName} onChange={e => setDName(e.target.value)} placeholder="Item" className="text-xs h-7 flex-1 bg-background/70" />
            <Input value={dPrice} onChange={e => setDPrice(e.target.value)} placeholder="Preço" className="text-xs h-7 w-20 bg-background/70" />
            <Button size="sm" className="h-7 px-2" onClick={() => {
              if (dName.trim()) { setDeclutter(prev => [...prev, { id: Date.now().toString(), name: dName.trim(), price: dPrice, photoUrl: "", status: "separar" }]); setDName(""); setDPrice(""); }
            }}><Plus className="w-3 h-3" /></Button>
          </div>
        </div>
      </div>

      {/* CONSUMO */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="bg-yellow-200 dark:bg-yellow-900/60 px-3 py-2">
          <h4 className="text-xs font-bold text-foreground">⚡ CONSUMO</h4>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-950/30 p-2 space-y-2">
          {(["luz", "agua", "gas", "internet"] as const).map(type => {
            const emoji = { luz: "💡", agua: "💧", gas: "🔥", internet: "🌐" }[type];
            const records = utilities.filter(u => u.type === type).sort((a, b) => b.month.localeCompare(a.month));
            const last = records[0];
            const prev = records[1];
            const trend = last && prev ? ((last.cost - prev.cost) / prev.cost * 100) : 0;
            return (
              <div key={type} className="bg-background/50 rounded-lg p-2 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{emoji}</span>
                  <h5 className="text-[10px] font-bold capitalize">{type}</h5>
                  {last && (
                    <span className={`ml-auto text-[10px] font-bold ${trend > 0 ? "text-red-500" : trend < 0 ? "text-green-500" : "text-muted-foreground"}`}>
                      {trend > 0 ? "↑" : trend < 0 ? "↓" : "="} {Math.abs(trend).toFixed(0)}%
                    </span>
                  )}
                </div>
                {records.slice(0, 3).map(r => (
                  <div key={r.id} className="flex items-center gap-2 text-xs py-0.5 group">
                    <span className="text-muted-foreground w-16">{r.month}</span>
                    <span className="font-bold">R$ {r.cost.toFixed(2)}</span>
                    <span className="text-muted-foreground">{r.consumption} {r.unit}</span>
                    <button onClick={() => setUtilities(prev => prev.filter(x => x.id !== r.id))} className="ml-auto opacity-0 group-hover:opacity-100">
                      <X className="w-2.5 h-2.5 text-muted-foreground" />
                    </button>
                  </div>
                ))}
                {records.length === 0 && <p className="text-[10px] text-muted-foreground italic">Nenhum registro</p>}
              </div>
            );
          })}
          <div className="grid grid-cols-4 gap-2 pt-1">
            <Input type="month" value={uMonth} onChange={e => setUMonth(e.target.value)} className="text-xs h-7 col-span-2 bg-background/70" />
            <select value={uType} onChange={e => setUType(e.target.value as UtilityRecord["type"])} className="text-xs bg-background/70 border border-border rounded px-1 h-7 col-span-2">
              <option value="luz">💡 Luz</option>
              <option value="agua">💧 Água</option>
              <option value="gas">🔥 Gás</option>
              <option value="internet">🌐 Internet</option>
            </select>
            <Input type="number" value={uCost} onChange={e => setUCost(e.target.value)} placeholder="R$" className="text-xs h-7 col-span-2 bg-background/70" />
            <Input type="number" value={uConsumption} onChange={e => setUConsumption(e.target.value)} placeholder="Consumo" className="text-xs h-7 col-span-2 bg-background/70" />
          </div>
          <Button size="sm" className="h-7 w-full text-xs mt-1" onClick={() => {
            if (uMonth && uCost) {
              const unit = { luz: "kWh", agua: "m³", gas: "m³", internet: "Mbps" }[uType];
              setUtilities(prev => [...prev, { id: Date.now().toString(), month: uMonth, type: uType, cost: parseFloat(uCost) || 0, consumption: parseFloat(uConsumption) || 0, unit }]);
              setUCost(""); setUConsumption("");
            }
          }}>Registrar</Button>
        </div>
      </div>
    </div>
  );
};

export default HomeUtilities;
