import { useState } from "react";
import { Plus, Trash2, Syringe, AlertTriangle } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { format, differenceInDays } from "date-fns";

interface HealthRecord {
  id: string;
  petId: string;
  type: "vaccine" | "deworming" | "visit";
  name: string;
  date: string;
  nextDate: string;
}

const typeLabels: Record<string, string> = { vaccine: "Vacina", deworming: "Vermífugo", visit: "Consulta" };

export const PetHealth = () => {
  const { get, set } = useUserData();
  const pets = get<any[]>("pet-list", []);
  const records = get<HealthRecord[]>("pet-health", []);
  const [petId, setPetId] = useState("");
  const [type, setType] = useState<"vaccine" | "deworming" | "visit">("vaccine");
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [nextDate, setNextDate] = useState("");

  const addRecord = () => {
    if (!name.trim()) return;
    const updated = [...records, { id: Date.now().toString(), petId, type, name: name.trim(), date, nextDate }];
    set("pet-health", updated);
    setName(""); setNextDate("");
  };

  const removeRecord = (id: string) => set("pet-health", records.filter(r => r.id !== id));

  const alerts = records.filter(r => {
    if (!r.nextDate) return false;
    const days = differenceInDays(new Date(r.nextDate), new Date());
    return days <= 14 && days >= 0;
  });

  return (
    <div className="mt-3 space-y-3">
      {alerts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
          <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Próximos vencimentos
          </p>
          {alerts.map(a => {
            const pet = pets.find((p: any) => p.id === a.petId);
            const days = differenceInDays(new Date(a.nextDate), new Date());
            return (
              <p key={a.id} className="text-[10px] text-amber-300">
                {pet?.name || "Pet"} — {a.name}: {days === 0 ? "Hoje!" : `em ${days} dias`}
              </p>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-green-200 dark:bg-green-900/60 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Syringe className="w-3.5 h-3.5 text-green-700 dark:text-green-300" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-green-800 dark:text-green-200">Saúde</span>
          </div>
          <span className="text-[10px] text-green-600 dark:text-green-300">{records.length}</span>
        </div>

        <div className="bg-green-50/50 dark:bg-green-950/20 p-2 space-y-1.5">
          <div className="grid grid-cols-12 gap-1 px-2 py-1">
            <span className="col-span-2 text-[9px] font-bold uppercase text-muted-foreground">Pet</span>
            <span className="col-span-2 text-[9px] font-bold uppercase text-muted-foreground">Tipo</span>
            <span className="col-span-3 text-[9px] font-bold uppercase text-muted-foreground">Nome</span>
            <span className="col-span-2 text-[9px] font-bold uppercase text-muted-foreground">Data</span>
            <span className="col-span-3 text-[9px] font-bold uppercase text-muted-foreground text-right">Próxima</span>
          </div>

          {records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(r => {
            const pet = pets.find((p: any) => p.id === r.petId);
            return (
              <div key={r.id} className="grid grid-cols-12 gap-1 items-center bg-background/60 rounded-lg px-2 py-1.5 group">
                <span className="col-span-2 text-[10px] truncate">{pet?.name || "—"}</span>
                <span className="col-span-2 text-[10px] text-muted-foreground">{typeLabels[r.type]}</span>
                <span className="col-span-3 text-xs font-medium truncate">{r.name}</span>
                <span className="col-span-2 text-[10px] text-muted-foreground">{format(new Date(r.date), "dd/MM")}</span>
                <div className="col-span-3 flex items-center justify-end gap-1">
                  <span className="text-[10px] text-muted-foreground">{r.nextDate ? format(new Date(r.nextDate), "dd/MM") : "—"}</span>
                  <button onClick={() => removeRecord(r.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {records.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic py-3 text-center">Nenhum registro ainda</p>
          )}

          <div className="border border-dashed border-border/60 bg-background/50 rounded-lg p-2 space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <select value={petId} onChange={e => setPetId(e.target.value)} className="h-7 text-[11px] bg-background border border-input rounded-md px-2">
                <option value="">Pet</option>
                {pets.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={type} onChange={e => setType(e.target.value as any)} className="h-7 text-[11px] bg-background border border-input rounded-md px-2">
                <option value="vaccine">Vacina</option>
                <option value="deworming">Vermífugo</option>
                <option value="visit">Consulta</option>
              </select>
            </div>
            <Input placeholder="Nome (ex: V8, Antirrábica)" value={name} onChange={e => setName(e.target.value)} className="h-7 text-[11px]" />
            <div className="grid grid-cols-2 gap-1.5">
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-7 text-[11px]" />
              <Input type="date" placeholder="Próxima" value={nextDate} onChange={e => setNextDate(e.target.value)} className="h-7 text-[11px]" />
            </div>
            <button onClick={addRecord} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md py-1 transition-colors">
              <Plus className="w-3 h-3" /> Adicionar registro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
