import { useState } from "react";
import { motion } from "framer-motion";
import { Moon, ShoppingCart, AlertTriangle, Plus, Trash2, Heart, Phone, Droplet } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Input } from "@/components/ui/input";

const todayStr = () => new Date().toISOString().slice(0, 10);

export const ToolsEmergency = () => {
  const today = todayStr();
  const [sleepLog] = usePersistedState<Record<string, number>>("core-saude-sleep", {});
  const [sleepGoal] = usePersistedState<number>("core-saude-sleep-goal", 8);
  const [supplements] = usePersistedState<{ id: string; name: string; stock: number }[]>("core-saude-supplements", []);
  const [shoppingList, setShoppingList] = usePersistedState<{ name: string; checked: boolean }[]>("core-saude-shopping", []);
  const [newItem, setNewItem] = useState("");

  const [sosInfo, setSosInfo] = usePersistedState<{ bloodType: string; allergies: string; emergencyContact: string; emergencyPhone: string }>("core-saude-sos", {
    bloodType: "", allergies: "", emergencyContact: "", emergencyPhone: "",
  });
  const [showSOS, setShowSOS] = useState(false);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });
  const totalSlept = last7.reduce((s, d) => s + (sleepLog[d] || 0), 0);
  const totalNeeded = sleepGoal * 7;
  const debtHours = Math.max(0, totalNeeded - totalSlept);
  const avgSleep = totalSlept / 7;

  const lowStock = supplements.filter(s => s.stock <= 5);

  const addShoppingItem = () => {
    if (!newItem.trim()) return;
    setShoppingList(prev => [...prev, { name: newItem.trim(), checked: false }]);
    setNewItem("");
  };

  return (
    <div className="space-y-4">
      {/* Sleep Debt */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Moon className="w-4 h-4 text-[hsl(var(--saude-blue))]" />
          <span className="text-xs font-bold uppercase tracking-wider">Dívida de Sono</span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center p-3 rounded-lg bg-muted">
            <p className="text-2xl font-black text-[hsl(var(--saude-blue))]">{avgSleep.toFixed(1)}h</p>
            <p className="text-[10px] text-muted-foreground">Média/dia</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted">
            <p className="text-2xl font-black text-foreground">{sleepGoal}h</p>
            <p className="text-[10px] text-muted-foreground">Meta</p>
          </div>
          <div className={`text-center p-3 rounded-lg ${debtHours > 0 ? "bg-[hsl(var(--saude-red)/0.1)]" : "bg-[hsl(var(--saude-green)/0.1)]"}`}>
            <p className={`text-2xl font-black ${debtHours > 0 ? "text-[hsl(var(--saude-red))]" : "text-[hsl(var(--saude-green))]"}`}>
              {debtHours > 0 ? `-${debtHours.toFixed(0)}h` : "OK ✓"}
            </p>
            <p className="text-[10px] text-muted-foreground">Dívida (7d)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sono de hoje:</span>
          <SleepInput />
        </div>
      </div>

      {/* Inventory & Shopping */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingCart className="w-4 h-4 text-[hsl(var(--saude-yellow))]" />
          <span className="text-xs font-bold uppercase tracking-wider">Inventário & Compras</span>
        </div>

        {lowStock.length > 0 && (
          <div className="mb-3 p-3 rounded-lg bg-[hsl(var(--saude-yellow)/0.08)] border border-[hsl(var(--saude-yellow)/0.2)]">
            <p className="text-[10px] font-bold text-[hsl(var(--saude-yellow))] uppercase tracking-widest mb-2">⚠️ Estoque Baixo</p>
            {lowStock.map(s => (
              <div key={s.id} className="flex items-center justify-between py-1">
                <span className="text-xs text-foreground">{s.name}</span>
                <span className="text-[10px] text-[hsl(var(--saude-yellow))] font-bold">{s.stock} doses</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-2">Lista de Compras</p>
        <div className="space-y-1.5">
          {shoppingList.map((item, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <button
                onClick={() => setShoppingList(prev => prev.map((x, j) => j === i ? { ...x, checked: !x.checked } : x))}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${item.checked ? "bg-[hsl(var(--saude-green))] border-[hsl(var(--saude-green))]" : "border-muted-foreground/30"}`}
              >
                {item.checked && <span className="text-white text-[10px]">✓</span>}
              </button>
              <span className={`text-xs flex-1 ${item.checked ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.name}</span>
              <button onClick={() => setShoppingList(prev => prev.filter((_, j) => j !== i))}>
                <Trash2 className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === "Enter" && addShoppingItem()} placeholder="Adicionar item..." className="text-xs h-8" />
          <button onClick={addShoppingItem} className="h-8 w-8 rounded-lg bg-[hsl(var(--saude-yellow)/0.15)] text-[hsl(var(--saude-yellow))] flex items-center justify-center flex-shrink-0">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SOS Card */}
      <div className="rounded-xl overflow-hidden border border-border" id="saude-sos-section">
        <button
          onClick={() => setShowSOS(!showSOS)}
          className="w-full p-4 bg-destructive/10 hover:bg-destructive/15 transition-colors flex items-center justify-center gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <span className="text-sm font-black text-destructive uppercase tracking-wider">Ficha SOS - Emergência</span>
        </button>

        {showSOS && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="bg-destructive/5 p-4 space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1 mb-1">
                  <Droplet className="w-3 h-3" /> Tipo Sanguíneo
                </label>
                <Input
                  value={sosInfo.bloodType}
                  onChange={e => setSosInfo(prev => ({ ...prev, bloodType: e.target.value }))}
                  placeholder="A+, O-, AB+..."
                  className="text-xs h-9"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1 mb-1">
                  <Phone className="w-3 h-3" /> Contato Emergência
                </label>
                <Input
                  value={sosInfo.emergencyPhone}
                  onChange={e => setSosInfo(prev => ({ ...prev, emergencyPhone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  className="text-xs h-9"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1 mb-1">
                <Heart className="w-3 h-3" /> Nome do contato
              </label>
              <Input
                value={sosInfo.emergencyContact}
                onChange={e => setSosInfo(prev => ({ ...prev, emergencyContact: e.target.value }))}
                placeholder="Mãe, Pai, Esposa..."
                className="text-xs h-9"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1 mb-1">
                <AlertTriangle className="w-3 h-3" /> Alergias a Medicamentos
              </label>
              <Input
                value={sosInfo.allergies}
                onChange={e => setSosInfo(prev => ({ ...prev, allergies: e.target.value }))}
                placeholder="Dipirona, Penicilina..."
                className="text-xs h-9"
              />
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

const SleepInput = () => {
  const today = todayStr();
  const [sleepLog, setSleepLog] = usePersistedState<Record<string, number>>("core-saude-sleep", {});
  const [val, setVal] = useState(String(sleepLog[today] || ""));

  return (
    <Input
      type="number"
      step="0.5"
      min="0"
      max="24"
      placeholder="Horas"
      value={val}
      onChange={e => {
        setVal(e.target.value);
        const n = parseFloat(e.target.value);
        if (!isNaN(n) && n >= 0 && n <= 24) {
          setSleepLog(prev => ({ ...prev, [today]: n }));
        }
      }}
      className="text-xs h-8 w-20"
    />
  );
};
