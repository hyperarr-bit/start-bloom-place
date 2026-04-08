import { useState } from "react";
import { Trash2, Calendar, Heart, Plus } from "lucide-react";
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
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [birthday, setBirthday] = useState("");
  const [notes, setNotes] = useState("");

  const addPerson = () => {
    if (!name.trim()) return;
    const updated = [...people, { id: Date.now().toString(), name: name.trim(), relation: relation.trim(), birthday, notes: notes.trim() }];
    set("rel-people", updated);
    setName(""); setRelation(""); setBirthday(""); setNotes("");
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
    <div className="mt-3">
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="bg-rose-200 dark:bg-rose-900/60 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-3.5 h-3.5 text-rose-700 dark:text-rose-300" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-200">Pessoas</span>
          </div>
          <span className="text-[10px] text-rose-600 dark:text-rose-300">{people.length}</span>
        </div>

        {/* Body */}
        <div className="bg-rose-50/50 dark:bg-rose-950/20 p-2 space-y-1.5">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-1 px-2 py-1">
            <span className="col-span-4 text-[9px] font-bold uppercase text-muted-foreground">Nome</span>
            <span className="col-span-3 text-[9px] font-bold uppercase text-muted-foreground">Relação</span>
            <span className="col-span-3 text-[9px] font-bold uppercase text-muted-foreground">Aniversário</span>
            <span className="col-span-2 text-[9px] font-bold uppercase text-muted-foreground text-right">Dias</span>
          </div>

          {/* Existing items */}
          {sorted.map(p => {
            const days = getDaysUntilBirthday(p.birthday);
            return (
              <div key={p.id} className="grid grid-cols-12 gap-1 items-center bg-background/60 rounded-lg px-2 py-1.5 group">
                <div className="col-span-4 min-w-0">
                  <p className="text-xs font-medium truncate">{p.name}</p>
                  {p.notes && <p className="text-[9px] text-muted-foreground truncate">{p.notes}</p>}
                </div>
                <span className="col-span-3 text-[10px] text-muted-foreground truncate">{p.relation || "—"}</span>
                <span className="col-span-3 text-[10px] text-muted-foreground">
                  {p.birthday ? format(new Date(p.birthday), "dd/MM") : "—"}
                </span>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  {days !== null && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      days === 0 ? "bg-rose-500/20 text-rose-400 animate-pulse" :
                      days <= 7 ? "bg-rose-500/20 text-rose-400" :
                      days <= 30 ? "bg-amber-500/20 text-amber-400" :
                      "text-muted-foreground"
                    }`}>
                      {days === 0 ? "Hoje!" : `${days}d`}
                    </span>
                  )}
                  <button onClick={() => removePerson(p.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {people.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic py-3 text-center">Nenhuma pessoa ainda</p>
          )}

          {/* Inline add */}
          <div className="border border-dashed border-border/60 bg-background/50 rounded-lg p-2 space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <Input placeholder="Nome" value={name} onChange={e => setName(e.target.value)} className="h-7 text-[11px]" />
              <Input placeholder="Relação" value={relation} onChange={e => setRelation(e.target.value)} className="h-7 text-[11px]" />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} className="h-7 text-[11px] appearance-none [&::-webkit-date-and-time-value]:text-left" placeholder="dd/mm/aaaa" />
              <Input placeholder="Notas" value={notes} onChange={e => setNotes(e.target.value)} className="h-7 text-[11px]" />
            </div>
            <button onClick={addPerson} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md py-1 transition-colors">
              <Plus className="w-3 h-3" /> Adicionar pessoa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
