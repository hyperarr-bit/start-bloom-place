import { useState } from "react";
import { Plus, Trash2, Heart } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

interface Moment {
  id: string;
  date: string;
  person: string;
  description: string;
}

export const MomentsTimeline = () => {
  const { get, set } = useUserData();
  const moments = get<Moment[]>("rel-moments", []);
  const people = get<any[]>("rel-people", []);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [person, setPerson] = useState("");
  const [description, setDescription] = useState("");

  const addMoment = () => {
    if (!description.trim()) return;
    const updated = [{ id: Date.now().toString(), date, person: person.trim(), description: description.trim() }, ...moments];
    set("rel-moments", updated);
    setDescription(""); setPerson("");
    setShowForm(false);
  };

  const removeMoment = (id: string) => {
    set("rel-moments", moments.filter(m => m.id !== id));
  };

  const sorted = [...moments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{moments.length} momento{moments.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs text-primary font-bold">
          <Plus className="w-3.5 h-3.5" /> Registrar
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-3 space-y-2">
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-sm" />
          <Input placeholder="Com quem?" value={person} onChange={e => setPerson(e.target.value)} className="h-8 text-sm" list="people-list" />
          <datalist id="people-list">
            {people.map((p: any) => <option key={p.id} value={p.name} />)}
          </datalist>
          <Input placeholder="O que aconteceu?" value={description} onChange={e => setDescription(e.target.value)} className="h-8 text-sm" />
          <button onClick={addMoment} className="w-full bg-primary text-primary-foreground rounded-lg py-1.5 text-xs font-bold">Salvar</button>
        </div>
      )}

      {sorted.length === 0 && !showForm && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Registre momentos especiais com quem você ama 💕
        </div>
      )}

      <div className="relative">
        {sorted.length > 0 && <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />}
        {sorted.map(m => (
          <div key={m.id} className="relative pl-8 pb-4">
            <div className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-rose-400 border-2 border-background" />
            <div className="bg-card rounded-xl border border-border p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-muted-foreground">{format(new Date(m.date), "dd/MM/yyyy")}</span>
                    {m.person && <span className="text-[10px] font-bold text-rose-400">com {m.person}</span>}
                  </div>
                  <p className="text-xs">{m.description}</p>
                </div>
                <button onClick={() => removeMoment(m.id)} className="text-muted-foreground hover:text-destructive p-1">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
