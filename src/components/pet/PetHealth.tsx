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
  const [showForm, setShowForm] = useState(false);
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
    setShowForm(false);
  };

  const removeRecord = (id: string) => set("pet-health", records.filter(r => r.id !== id));

  const alerts = records.filter(r => {
    if (!r.nextDate) return false;
    const days = differenceInDays(new Date(r.nextDate), new Date());
    return days <= 14 && days >= 0;
  });

  return (
    <div className="space-y-3 mt-3">
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

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{records.length} registro{records.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs text-primary font-bold">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-3 space-y-2">
          <select value={petId} onChange={e => setPetId(e.target.value)} className="w-full h-8 text-sm bg-background border border-input rounded-md px-2">
            <option value="">Selecionar pet</option>
            {pets.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={type} onChange={e => setType(e.target.value as any)} className="w-full h-8 text-sm bg-background border border-input rounded-md px-2">
            <option value="vaccine">Vacina</option>
            <option value="deworming">Vermífugo</option>
            <option value="visit">Consulta</option>
          </select>
          <Input placeholder="Nome (ex: V8, Antirrábica)" value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" />
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-sm" />
          <Input type="date" placeholder="Próxima dose" value={nextDate} onChange={e => setNextDate(e.target.value)} className="h-8 text-sm" />
          <button onClick={addRecord} className="w-full bg-primary text-primary-foreground rounded-lg py-1.5 text-xs font-bold">Salvar</button>
        </div>
      )}

      {pets.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Cadastre um pet primeiro na aba "Meus Pets" 🐾
        </div>
      )}

      {pets.map((pet: any) => {
        const petRecords = records.filter(r => r.petId === pet.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (petRecords.length === 0) return null;
        return (
          <div key={pet.id}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{pet.name}</p>
            <div className="space-y-1.5">
              {petRecords.map(r => (
                <div key={r.id} className="bg-card rounded-lg border border-border p-2.5 flex items-center gap-2">
                  <Syringe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground">{typeLabels[r.type]} · {format(new Date(r.date), "dd/MM/yyyy")}</p>
                  </div>
                  {r.nextDate && (
                    <span className="text-[9px] text-muted-foreground">Próx: {format(new Date(r.nextDate), "dd/MM")}</span>
                  )}
                  <button onClick={() => removeRecord(r.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
