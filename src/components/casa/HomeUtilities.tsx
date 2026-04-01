import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, Trash2, Phone, Wifi, ExternalLink, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { QRCodeSVG } from "qrcode.react";
import { ServiceContact, DeclutterItem, UtilityRecord, GuestAllergy } from "./types";

type Section = "contacts" | "host" | "desapego" | "consumo";

const HomeUtilities = () => {
  const [section, setSection] = useState<Section>("contacts");
  const [contacts, setContacts] = usePersistedState<ServiceContact[]>("casa-contacts", []);
  const [wifiSSID, setWifiSSID] = usePersistedState("casa-wifi-ssid", "");
  const [wifiPass, setWifiPass] = usePersistedState("casa-wifi-pass", "");
  const [allergies, setAllergies] = usePersistedState<GuestAllergy[]>("casa-allergies", []);
  const [declutter, setDeclutter] = usePersistedState<DeclutterItem[]>("casa-declutter", []);
  const [utilities, setUtilities] = usePersistedState<UtilityRecord[]>("casa-utilities", []);

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
      <div className="grid grid-cols-2 gap-1">
        {([
          { k: "contacts" as Section, l: "📞 Contatos" },
          { k: "host" as Section, l: "🏠 Anfitrião" },
          { k: "desapego" as Section, l: "📦 Desapego" },
          { k: "consumo" as Section, l: "⚡ Consumo" },
        ]).map(s => (
          <Button key={s.k} variant={section === s.k ? "default" : "outline"} size="sm" className="text-xs h-8" onClick={() => setSection(s.k)}>{s.l}</Button>
        ))}
      </div>

      {/* CONTATOS */}
      {section === "contacts" && (
        <div className="space-y-2">
          {contacts.map(c => (
            <div key={c.id} className="bg-card rounded-xl border border-border p-3 group">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{c.tag}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">{c.phone} {c.lastService && `• Último: ${c.lastService} (R$ ${c.lastValue})`}</p>
                </div>
                <a href={`https://wa.me/55${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="h-7 text-xs">WhatsApp</Button>
                </a>
                <button onClick={() => setContacts(prev => prev.filter(x => x.id !== c.id))} className="opacity-0 group-hover:opacity-100">
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
          <div className="bg-card rounded-xl border border-border p-3 space-y-2">
            <p className="text-xs font-bold">Novo contato</p>
            <div className="grid grid-cols-3 gap-2">
              <Input value={cName} onChange={e => setCName(e.target.value)} placeholder="Nome" className="text-xs h-7 col-span-2" />
              <select value={cTag} onChange={e => setCTag(e.target.value)} className="text-xs bg-background border border-border rounded px-1 h-7">
                {["Encanador", "Eletricista", "Portaria", "Síndico", "Veterinário", "Faxineira", "Outro"].map(t => <option key={t}>{t}</option>)}
              </select>
              <Input value={cPhone} onChange={e => setCPhone(e.target.value)} placeholder="Telefone" className="text-xs h-7 col-span-2" />
              <Button size="sm" className="h-7 text-xs" onClick={() => {
                if (cName.trim()) { setContacts(prev => [...prev, { id: Date.now().toString(), name: cName.trim(), phone: cPhone, tag: cTag, lastService: "", lastValue: "" }]); setCName(""); setCPhone(""); }
              }}>Salvar</Button>
            </div>
          </div>
        </div>
      )}

      {/* HOST KIT */}
      {section === "host" && (
        <div className="space-y-3">
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <Wifi className="w-6 h-6 mx-auto mb-2 text-primary" />
            <h4 className="text-xs font-bold mb-2">QR Code do Wi-Fi</h4>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Input value={wifiSSID} onChange={e => setWifiSSID(e.target.value)} placeholder="Nome da rede" className="text-xs h-7" />
              <Input value={wifiPass} onChange={e => setWifiPass(e.target.value)} placeholder="Senha" className="text-xs h-7" type="password" />
            </div>
            {wifiSSID && wifiPass && (
              <div className="bg-white p-4 rounded-lg inline-block">
                <QRCodeSVG value={`WIFI:T:WPA;S:${wifiSSID};P:${wifiPass};;`} size={150} />
              </div>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border p-3">
            <h4 className="text-xs font-bold mb-2">🍽️ Restrições Alimentares dos Amigos</h4>
            <div className="space-y-1">
              {allergies.map(a => (
                <div key={a.id} className="flex items-center gap-2 text-xs bg-muted/30 rounded-lg p-2 group">
                  <span className="font-bold">{a.name}</span>
                  <span className="text-muted-foreground">→ {a.restriction}</span>
                  <button onClick={() => setAllergies(prev => prev.filter(x => x.id !== a.id))} className="ml-auto opacity-0 group-hover:opacity-100">
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input value={aName} onChange={e => setAName(e.target.value)} placeholder="Nome" className="text-xs h-7 flex-1" />
              <Input value={aRestriction} onChange={e => setARestriction(e.target.value)} placeholder="Restrição" className="text-xs h-7 flex-1" />
              <Button size="sm" className="h-7 px-2" onClick={() => {
                if (aName.trim()) { setAllergies(prev => [...prev, { id: Date.now().toString(), name: aName.trim(), restriction: aRestriction.trim() }]); setAName(""); setARestriction(""); }
              }}><Plus className="w-3 h-3" /></Button>
            </div>
          </div>
        </div>
      )}

      {/* DESAPEGO */}
      {section === "desapego" && (
        <div className="space-y-3">
          {(["separar", "anunciado", "vendido"] as const).map(status => {
            const label = { separar: "📥 Para Separar", anunciado: "📢 Anunciado/Doar", vendido: "✅ Vendido/Foi embora" }[status];
            const items = declutter.filter(d => d.status === status);
            return (
              <div key={status} className="bg-card rounded-xl border border-border p-3">
                <h4 className="text-xs font-bold mb-2">{label} ({items.length})</h4>
                <div className="space-y-1">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-2 text-xs bg-muted/30 rounded-lg p-2 group">
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
              </div>
            );
          })}
          <div className="flex gap-2">
            <Input value={dName} onChange={e => setDName(e.target.value)} placeholder="Item" className="text-xs h-8 flex-1" />
            <Input value={dPrice} onChange={e => setDPrice(e.target.value)} placeholder="Preço" className="text-xs h-8 w-20" />
            <Button size="sm" className="h-8" onClick={() => {
              if (dName.trim()) { setDeclutter(prev => [...prev, { id: Date.now().toString(), name: dName.trim(), price: dPrice, photoUrl: "", status: "separar" }]); setDName(""); setDPrice(""); }
            }}><Plus className="w-3 h-3" /></Button>
          </div>
        </div>
      )}

      {/* CONSUMO */}
      {section === "consumo" && (
        <div className="space-y-3">
          {(["luz", "agua", "gas", "internet"] as const).map(type => {
            const emoji = { luz: "💡", agua: "💧", gas: "🔥", internet: "🌐" }[type];
            const unit = { luz: "kWh", agua: "m³", gas: "m³", internet: "Mbps" }[type];
            const records = utilities.filter(u => u.type === type).sort((a, b) => b.month.localeCompare(a.month));
            const last = records[0];
            const prev = records[1];
            const trend = last && prev ? ((last.cost - prev.cost) / prev.cost * 100) : 0;
            return (
              <div key={type} className="bg-card rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{emoji}</span>
                  <h4 className="text-xs font-bold capitalize">{type}</h4>
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
              </div>
            );
          })}
          <div className="bg-card rounded-xl border border-border p-3 space-y-2">
            <p className="text-xs font-bold">Registrar consumo</p>
            <div className="grid grid-cols-4 gap-2">
              <Input type="month" value={uMonth} onChange={e => setUMonth(e.target.value)} className="text-xs h-7 col-span-2" />
              <select value={uType} onChange={e => setUType(e.target.value as UtilityRecord["type"])} className="text-xs bg-background border border-border rounded px-1 h-7 col-span-2">
                <option value="luz">💡 Luz</option>
                <option value="agua">💧 Água</option>
                <option value="gas">🔥 Gás</option>
                <option value="internet">🌐 Internet</option>
              </select>
              <Input type="number" value={uCost} onChange={e => setUCost(e.target.value)} placeholder="R$" className="text-xs h-7 col-span-2" />
              <Input type="number" value={uConsumption} onChange={e => setUConsumption(e.target.value)} placeholder="Consumo" className="text-xs h-7 col-span-2" />
            </div>
            <Button size="sm" className="h-7 w-full text-xs" onClick={() => {
              if (uMonth && uCost) {
                const unit = { luz: "kWh", agua: "m³", gas: "m³", internet: "Mbps" }[uType];
                setUtilities(prev => [...prev, { id: Date.now().toString(), month: uMonth, type: uType, cost: parseFloat(uCost) || 0, consumption: parseFloat(uConsumption) || 0, unit }]);
                setUCost(""); setUConsumption("");
              }
            }}>Registrar</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeUtilities;
