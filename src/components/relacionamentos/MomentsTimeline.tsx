import { useState } from "react";
import { Trash2, Heart, Plus } from "lucide-react";
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
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [person, setPerson] = useState("");
  const [description, setDescription] = useState("");

  const addMoment = () => {
    if (!description.trim()) return;
    const updated = [{ id: Date.now().toString(), date, person: person.trim(), description: description.trim() }, ...moments];
    set("rel-moments", updated);
    setDescription(""); setPerson("");
  };

  const removeMoment = (id: string) => {
    set("rel-moments", moments.filter(m => m.id !== id));
  };

  const sorted = [...moments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="mt-3">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-pink-200 dark:bg-pink-900/60 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-3.5 h-3.5 text-pink-700 dark:text-pink-300" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-pink-800 dark:text-pink-200">Momentos</span>
          </div>
          <span className="text-[10px] text-pink-600 dark:text-pink-300">{moments.length}</span>
        </div>

        <div className="bg-pink-50/50 dark:bg-pink-950/20 p-2 space-y-1.5">
          {sorted.map(m => (
            <div key={m.id} className="bg-background/60 rounded-lg px-2.5 py-2 group">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] text-muted-foreground">{format(new Date(m.date), "dd/MM/yyyy")}</span>
                    {m.person && <span className="text-[10px] font-bold text-rose-400">com {m.person}</span>}
                  </div>
                  <p className="text-xs">{m.description}</p>
                </div>
                <button onClick={() => removeMoment(m.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-all">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}

          {moments.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic py-3 text-center">Nenhum momento ainda</p>
          )}

          <div className="border border-dashed border-border/60 bg-background/50 rounded-lg p-2 space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <div className="relative">
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-7 text-[11px] appearance-none [&::-webkit-date-and-time-value]:text-left" />
              </div>
              <Input placeholder="Com quem?" value={person} onChange={e => setPerson(e.target.value)} className="h-7 text-[11px]" list="moments-people" />
            </div>
            <datalist id="moments-people">
              {people.map((p: any) => <option key={p.id} value={p.name} />)}
            </datalist>
            <Input placeholder="O que aconteceu?" value={description} onChange={e => setDescription(e.target.value)} className="h-7 text-[11px]" onKeyDown={e => e.key === "Enter" && addMoment()} />
            <button onClick={addMoment} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md py-1 transition-colors">
              <Plus className="w-3 h-3" /> Registrar momento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
