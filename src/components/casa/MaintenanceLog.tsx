import { useState } from "react";
import { localDayKey } from "@/lib/utils";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampoData } from "@/components/ui/campo-data";
import { MaintenanceTask, Warranty, RoomMeasure, monthsSince } from "./types";

const MaintenanceLog = () => {
  const [tasks, setTasks] = usePersistedState<MaintenanceTask[]>("casa-maint-tasks", []);
  const [warranties, setWarranties] = usePersistedState<Warranty[]>("casa-warranties", []);
  const [measures, setMeasures] = usePersistedState<RoomMeasure[]>("casa-measures", []);
  const [newTask, setNewTask] = useState("");
  const [newFreq, setNewFreq] = useState("6");
  const [wProduct, setWProduct] = useState("");
  const [wDate, setWDate] = useState("");
  const [wMonths, setWMonths] = useState("12");
  const [mRoom, setMRoom] = useState("");
  const [mLabel, setMLabel] = useState("");
  const [mValue, setMValue] = useState("");

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks(prev => [...prev, { id: Date.now().toString(), task: newTask.trim(), frequencyMonths: parseInt(newFreq) || 6, lastDone: "", icon: "🔧" }]);
    setNewTask("");
  };

  const markTaskDone = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, lastDone: localDayKey() } : t));
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
      {/* MANUTENÇÃO */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="bg-amber-200 dark:bg-amber-900/60 px-3 py-2">
          <h4 className="text-xs font-bold text-foreground">🔧 MANUTENÇÃO</h4>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/30 p-2 space-y-1.5">
          {tasks.map(t => {
            const months = monthsSince(t.lastDone);
            const overdue = months >= t.frequencyMonths;
            return (
              <div key={t.id} className={`flex items-center gap-2 p-2 rounded-lg group ${overdue ? "bg-red-500/10 border border-red-500/30" : "bg-background/50 border border-border"}`}>
                <span className="text-sm">{t.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold">{t.task}</p>
                  <p className="text-[10px] text-muted-foreground">
                    A cada {t.frequencyMonths}m • {t.lastDone ? `Último: ${new Date(t.lastDone).toLocaleDateString("pt-BR")}` : "Nunca feito"}
                  </p>
                </div>
                {overdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => markTaskDone(t.id)}>✅ Feito</Button>
                <button onClick={() => setTasks(prev => prev.filter(x => x.id !== t.id))} className="opacity-0 group-hover:opacity-100">
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            );
          })}
          {tasks.length === 0 && <p className="text-[11px] text-muted-foreground italic py-2 text-center">Nenhuma manutenção ainda</p>}
          <div className="flex gap-2 pt-1">
            <Input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="Nova manutenção..." className="text-xs h-7 flex-1 bg-background/70" onKeyDown={e => e.key === "Enter" && addTask()} />
            <Input type="number" value={newFreq} onChange={e => setNewFreq(e.target.value)} className="text-xs h-7 w-14 bg-background/70" placeholder="Meses" />
            <Button size="sm" className="h-7 px-2" onClick={addTask}><Plus className="w-3 h-3" /></Button>
          </div>
        </div>
      </div>

      {/* GARANTIAS */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="bg-teal-200 dark:bg-teal-900/60 px-3 py-2">
          <h4 className="text-xs font-bold text-foreground">🛡️ GARANTIAS</h4>
        </div>
        <div className="bg-teal-50 dark:bg-teal-950/30 p-2 space-y-1.5">
          {warranties.map(w => {
            const daysLeft = warrantyDaysLeft(w);
            return (
              <div key={w.id} className={`flex items-center gap-2 p-2 rounded-lg group border ${daysLeft <= 30 ? "border-red-500/30 bg-red-500/5" : daysLeft <= 60 ? "border-yellow-500/30 bg-yellow-500/5" : "border-border bg-background/50"}`}>
                <div className="flex-1">
                  <p className="text-xs font-bold">{w.product}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {daysLeft > 0 ? `${daysLeft} dias restantes` : "Expirada"} • {w.warrantyMonths} meses
                  </p>
                </div>
                <button onClick={() => setWarranties(prev => prev.filter(x => x.id !== w.id))} className="opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            );
          })}
          {warranties.length === 0 && <p className="text-[11px] text-muted-foreground italic py-2 text-center">Nenhuma garantia ainda</p>}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <Input value={wProduct} onChange={e => setWProduct(e.target.value)} placeholder="Produto" className="text-xs h-7 col-span-3 bg-background/70" />
            <div className="relative col-span-2">
              <CampoData rotulo="Data compra" value={wDate} onChange={e => setWDate(e.target.value)} className="text-xs h-7 bg-background/70" />
            </div>
            <Input type="number" value={wMonths} onChange={e => setWMonths(e.target.value)} placeholder="Meses" className="text-xs h-7 bg-background/70" />
          </div>
          <Button size="sm" className="h-7 w-full text-xs mt-1" onClick={addWarranty}>Salvar garantia</Button>
        </div>
      </div>

      {/* MEDIDAS */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="bg-slate-200 dark:bg-slate-800/60 px-3 py-2">
          <h4 className="text-xs font-bold text-foreground">📐 MEDIDAS</h4>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950/30 p-2 space-y-1.5">
          {Object.entries(measures.reduce((acc, m) => { (acc[m.room] = acc[m.room] || []).push(m); return acc; }, {} as Record<string, RoomMeasure[]>)).map(([room, items]) => (
            <div key={room} className="bg-background/50 rounded-lg p-2 border border-border">
              <h5 className="text-[10px] font-bold mb-1">📐 {room}</h5>
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
          {measures.length === 0 && <p className="text-[11px] text-muted-foreground italic py-2 text-center">Nenhuma medida ainda</p>}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <Input value={mRoom} onChange={e => setMRoom(e.target.value)} placeholder="Cômodo" className="text-xs h-7 bg-background/70" />
            <Input value={mLabel} onChange={e => setMLabel(e.target.value)} placeholder="O quê" className="text-xs h-7 bg-background/70" />
            <Input value={mValue} onChange={e => setMValue(e.target.value)} placeholder="Ex: 2.5m" className="text-xs h-7 bg-background/70" />
          </div>
          <Button size="sm" className="h-7 w-full text-xs mt-1" onClick={addMeasure}>Salvar medida</Button>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceLog;
