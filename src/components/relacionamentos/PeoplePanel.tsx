import { useState } from "react";
import { Plus, Trash2, Gift, Calendar } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { differenceInDays, format, setYear } from "date-fns";

interface Person {
  id: string;
  name: string;
  relation: string;
  birthday: string;
  notes: string;
}

export const PeoplePanel = () => {
  const { get, set } = useUserData();
  const people = get<Person[]>("rel-people", []);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [birthday, setBirthday] = useState("");
  const [notes, setNotes] = useState("");

  const addPerson = () => {
    if (!name.trim()) return;
    const updated = [...people, { id: Date.now().toString(), name: name.trim(), relation: relation.trim(), birthday, notes: notes.trim() }];
    set("rel-people", updated);
    setName(""); setRelation(""); setBirthday(""); setNotes("");
    setShowForm(false);
  };

  const removePerson = (id: string) => {
    set("rel-people", people.filter(p => p.id !== id));
  };

  const getDaysUntilBirthday = (bday: string) => {
    if (!bday) return null;
    const today = new Date();
    const bd = new Date(bday);
    let next = setYear(bd, today.getFullYear());
    if (next < today) next = setYear(bd, today.getFullYear() + 1);
    return differenceInDays(next, today);
  };

  const sorted = [...people].sort((a, b) => {
    const da = getDaysUntilBirthday(a.birthday);
    const db = getDaysUntilBirthday(b.birthday);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{people.length} pessoa{people.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs text-primary font-bold">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-3 space-y-2">
          <Input placeholder="Nome" value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" />
          <Input placeholder="Relação (amigo, mãe, etc)" value={relation} onChange={e => setRelation(e.target.value)} className="h-8 text-sm" />
          <Input type="date" placeholder="Aniversário" value={birthday} onChange={e => setBirthday(e.target.value)} className="h-8 text-sm" />
          <Input placeholder="Notas" value={notes} onChange={e => setNotes(e.target.value)} className="h-8 text-sm" />
          <button onClick={addPerson} className="w-full bg-primary text-primary-foreground rounded-lg py-1.5 text-xs font-bold">Salvar</button>
        </div>
      )}

      {sorted.length === 0 && !showForm && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Adicione pessoas importantes da sua vida 💜
        </div>
      )}

      {sorted.map(p => {
        const days = getDaysUntilBirthday(p.birthday);
        return (
          <div key={p.id} className="bg-card rounded-xl border border-border p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{p.name}</p>
                {p.relation && <p className="text-[10px] text-muted-foreground">{p.relation}</p>}
              </div>
              <button onClick={() => removePerson(p.id)} className="text-muted-foreground hover:text-destructive p-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {p.birthday && (
              <div className="flex items-center gap-1.5 mt-2 text-[10px]">
                <Calendar className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">{format(new Date(p.birthday), "dd/MM")}</span>
                {days !== null && (
                  <span className={`ml-auto font-bold px-1.5 py-0.5 rounded-full ${
                    days <= 7 ? "bg-rose-500/20 text-rose-400" : days <= 30 ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground"
                  }`}>
                    {days === 0 ? "🎂 Hoje!" : `${days} dias`}
                  </span>
                )}
              </div>
            )}
            {p.notes && <p className="text-[10px] text-muted-foreground mt-1.5">{p.notes}</p>}
          </div>
        );
      })}
    </div>
  );
};
