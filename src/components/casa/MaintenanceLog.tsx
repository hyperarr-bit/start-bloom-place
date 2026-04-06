import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, Trash2, AlertTriangle, Ruler, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaintenanceTask, Warranty, RoomMeasure, monthsSince, daysSince } from "./types";

const defaultMaintenance: MaintenanceTask[] = [
  { id: "1", task: "Trocar filtro de água", frequencyMonths: 6, lastDone: "", icon: "💧" },
  { id: "2", task: "Limpar filtro do ar-condicionado", frequencyMonths: 3, lastDone: "", icon: "❄️" },
  { id: "3", task: "Virar o colchão", frequencyMonths: 6, lastDone: "", icon: "🛏️" },
  { id: "4", task: "Limpar máquina de lavar", frequencyMonths: 3, lastDone: "", icon: "🫧" },
];

const MaintenanceLog = () => {
  const [tasks, setTasks] = usePersistedState<MaintenanceTask[]>("casa-maint-tasks", defaultMaintenance);
  const [warranties, setWarranties] = usePersistedState<Warranty[]>("casa-warranties", []);
  const [measures, setMeasures] = usePersistedState<RoomMeasure[]>("casa-measures", []);
  const [newTask, setNewTask] = useState("");
  const [newFreq, setNewFreq] = useState("6");
  const [section, setSection] = useState<"maint" | "warranty" | "measures">("maint");

  // Warranty form
  const [wProduct, setWProduct] = useState("");
  const [wDate, setWDate] = useState("");
  const [wMonths, setWMonths] = useState("12");

  // Measure form
  const [mRoom, setMRoom] = useState("");
  const [mLabel, setMLabel] = useState("");
  const [mValue, setMValue] = useState("");

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks(prev => [...prev, { id: Date.now().toString(), task: newTask.trim(), frequencyMonths: parseInt(newFreq) || 6, lastDone: "", icon: "🔧" }]);
    setNewTask("");
  };

  const markTaskDone = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, lastDone: new Date().toISOString().split("T")[0] } : t));
  };

  const warrantyDaysLeft = (w: Warranty) => {
    if (!w.purchaseDate) return 0;
    const end = new Date(w.purchaseDate);
    end.setMonth(end.getMonth() + w.warrantyMonths);
    return Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  };

  const addWarranty = () => {
    if (!wProduct.trim()) return;
    setWarranties(prev => [...prev, { id: Date.now().toString(), product: wProduct.trim(), purchaseDate: wDate, warrantyMonths: parseInt(wMonths) || 12, photoUrl: "", notes: "" }]);
    setWProduct(""); setWDate(""); setWMonths("12");
  };

  const addMeasure = () => {
    if (!mRoom.trim() || !mLabel.trim()) return;
    setMeasures(prev => [...prev, { id: Date.now().toString(), room: mRoom.trim(), label: mLabel.trim(), value: mValue.trim() }]);
    setMRoom(""); setMLabel(""); setMValue("");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {[
          { k: "maint" as const, l: "🔧 Manutenção" },
          { k: "warranty" as const, l: "🛡️ Garantias" },
          { k: "measures" as const, l: "📐 Medidas" },
        ].map(s => (
          <Button key={s.k} variant={section === s.k ? "default" : "outline"} size="sm" className="text-xs flex-1 h-8" onClick={() => setSection(s.k)}>{s.l}</Button>
        ))}
      </div>

      {section === "maint" && (
        <div className="space-y-2">
          {tasks.map(t => {
            const months = monthsSince(t.lastDone);
            const overdue = months >= t.frequencyMonths;
            return (
              <div key={t.id} className={`bg-card rounded-xl border p-3 group ${overdue ? "border-red-500/50 bg-red-500/5" : "border-border"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{t.task}</p>
                    <p className="text-[10px] text-muted-foreground">
                      A cada {t.frequencyMonths} meses • {t.lastDone ? `Último: ${new Date(t.lastDone).toLocaleDateString("pt-BR")}` : "Nunca feito"}
                    </p>
                  </div>
                  {overdue && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markTaskDone(t.id)}>✅ Feito</Button>
                  <button onClick={() => setTasks(prev => prev.filter(x => x.id !== t.id))} className="opacity-0 group-hover:opacity-100">
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              </div>
            );
          })}
          <div className="flex gap-2">
            <Input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="Nova manutenção..." className="text-xs h-8 flex-1" onKeyDown={e => e.key === "Enter" && addTask()} />
            <Input type="number" value={newFreq} onChange={e => setNewFreq(e.target.value)} className="text-xs h-8 w-14" placeholder="Meses" />
            <Button size="sm" className="h-8" onClick={addTask}><Plus className="w-3 h-3" /></Button>
          </div>
        </div>
      )}

      {section === "warranty" && (
        <div className="space-y-2">
          {warranties.filter(w => warrantyDaysLeft(w) <= 60 && warrantyDaysLeft(w) > 0).length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 text-xs text-center">
              ⚠️ Garantias expirando em breve!
            </div>
          )}
          {warranties.map(w => {
            const daysLeft = warrantyDaysLeft(w);
            return (
              <div key={w.id} className={`bg-card rounded-xl border p-3 group ${daysLeft <= 30 ? "border-red-500/50" : daysLeft <= 60 ? "border-yellow-500/50" : "border-border"}`}>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-bold">{w.product}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {daysLeft > 0 ? `${daysLeft} dias restantes` : "Garantia expirada"} • {w.warrantyMonths} meses
                    </p>
                  </div>
                  <button onClick={() => setWarranties(prev => prev.filter(x => x.id !== w.id))} className="opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              </div>
            );
          })}
          <div className="bg-card rounded-xl border border-border p-3 space-y-2">
            <p className="text-xs font-bold">Adicionar garantia</p>
            <div className="grid grid-cols-3 gap-2">
              <Input value={wProduct} onChange={e => setWProduct(e.target.value)} placeholder="Produto" className="text-xs h-7 col-span-3" />
              <Input type="date" value={wDate} onChange={e => setWDate(e.target.value)} className="text-xs h-7 col-span-2" />
              <Input type="number" value={wMonths} onChange={e => setWMonths(e.target.value)} placeholder="Meses" className="text-xs h-7" />
            </div>
            <Button size="sm" className="h-7 w-full text-xs" onClick={addWarranty}>Salvar</Button>
          </div>
        </div>
      )}

      {section === "measures" && (
        <div className="space-y-2">
          {measures.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-3">
              {Object.entries(measures.reduce((acc, m) => { (acc[m.room] = acc[m.room] || []).push(m); return acc; }, {} as Record<string, RoomMeasure[]>)).map(([room, items]) => (
                <div key={room} className="mb-3 last:mb-0">
                  <h4 className="text-xs font-bold mb-1">📐 {room}</h4>
                  {items.map(m => (
                    <div key={m.id} className="flex items-center gap-2 text-xs py-0.5 group">
                      <span className="text-muted-foreground">{m.label}:</span>
                      <span className="font-mono font-bold">{m.value}</span>
                      <button onClick={() => setMeasures(prev => prev.filter(x => x.id !== m.id))} className="opacity-0 group-hover:opacity-100 ml-auto">
                        <X className="w-2.5 h-2.5 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className="bg-card rounded-xl border border-border p-3 space-y-2">
            <p className="text-xs font-bold">Nova medida</p>
            <div className="grid grid-cols-3 gap-2">
              <Input value={mRoom} onChange={e => setMRoom(e.target.value)} placeholder="Cômodo" className="text-xs h-7" />
              <Input value={mLabel} onChange={e => setMLabel(e.target.value)} placeholder="O quê" className="text-xs h-7" />
              <Input value={mValue} onChange={e => setMValue(e.target.value)} placeholder="Ex: 2.5m" className="text-xs h-7" />
            </div>
            <Button size="sm" className="h-7 w-full text-xs" onClick={addMeasure}>Salvar</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceLog;
