import { useState } from "react";
import { Trash2, CalendarHeart, Plus } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { differenceInDays, setYear, format } from "date-fns";

interface SpecialDate {
  id: string;
  title: string;
  person: string;
  date: string;
  type: "birthday" | "anniversary" | "custom";
}

export const DateCalendar = () => {
  const { get, set } = useUserData();
  const customDates = get<SpecialDate[]>("rel-dates", []);
  const people = get<any[]>("rel-people", []);
  const [title, setTitle] = useState("");
  const [person, setPerson] = useState("");
  const [date, setDate] = useState("");

  const allDates: SpecialDate[] = [
    ...people.filter((p: any) => p.birthday).map((p: any) => ({
      id: `bday-${p.id}`,
      title: `Aniversário de ${p.name}`,
      person: p.name,
      date: p.birthday,
      type: "birthday" as const,
    })),
    ...customDates,
  ];

  const getDaysUntil = (dateStr: string) => {
    const today = new Date();
    const d = new Date(dateStr);
    let next = setYear(d, today.getFullYear());
    if (next < today) next = setYear(d, today.getFullYear() + 1);
    return differenceInDays(next, today);
  };

  const sorted = [...allDates].sort((a, b) => getDaysUntil(a.date) - getDaysUntil(b.date));

  const addDate = () => {
    if (!title.trim() || !date) return;
    const updated = [...customDates, { id: Date.now().toString(), title: title.trim(), person: person.trim(), date, type: "custom" as const }];
    set("rel-dates", updated);
    setTitle(""); setPerson(""); setDate("");
  };

  const removeDate = (id: string) => {
    set("rel-dates", customDates.filter((d) => d.id !== id));
  };

  const getColorClasses = (days: number) => {
    if (days === 0) return "bg-rose-500/20 text-rose-400 animate-pulse";
    if (days <= 7) return "bg-rose-500/15 text-rose-400";
    if (days <= 30) return "bg-amber-500/15 text-amber-400";
    return "text-muted-foreground";
  };

  return (
    <div className="mt-3">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-purple-200 dark:bg-purple-900/60 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarHeart className="w-3.5 h-3.5 text-purple-700 dark:text-purple-300" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800 dark:text-purple-200">Datas Especiais</span>
          </div>
          <span className="text-[10px] text-purple-600 dark:text-purple-300">{allDates.length}</span>
        </div>

        <div className="bg-purple-50/50 dark:bg-purple-950/20 p-2 space-y-1.5">
          <div className="grid grid-cols-12 gap-1 px-2 py-1">
            <span className="col-span-5 text-[9px] font-bold uppercase text-muted-foreground">Título</span>
            <span className="col-span-3 text-[9px] font-bold uppercase text-muted-foreground">Data</span>
            <span className="col-span-2 text-[9px] font-bold uppercase text-muted-foreground">Pessoa</span>
            <span className="col-span-2 text-[9px] font-bold uppercase text-muted-foreground text-right">Falta</span>
          </div>

          {sorted.map(item => {
            const days = getDaysUntil(item.date);
            return (
              <div key={item.id} className="grid grid-cols-12 gap-1 items-center bg-background/60 rounded-lg px-2 py-1.5 group">
                <span className="col-span-5 text-xs font-medium truncate">{item.title}</span>
                <span className="col-span-3 text-[10px] text-muted-foreground">{format(new Date(item.date), "dd/MM")}</span>
                <span className="col-span-2 text-[10px] text-muted-foreground truncate">{item.person || "—"}</span>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${getColorClasses(days)}`}>
                    {days === 0 ? "Hoje!" : `${days}d`}
                  </span>
                  {item.type === "custom" && (
                    <button onClick={() => removeDate(item.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {allDates.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic py-3 text-center">Nenhuma data ainda</p>
          )}

          <div className="border border-dashed border-border/60 bg-background/50 rounded-lg p-2 space-y-1.5">
            <div className="grid grid-cols-3 gap-1.5">
              <Input placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} className="h-7 text-[11px] col-span-1" />
              <Input placeholder="Pessoa" value={person} onChange={e => setPerson(e.target.value)} className="h-7 text-[11px] col-span-1" list="date-people-list" />
              <div className="relative col-span-1">
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-7 text-[11px] appearance-none [&::-webkit-date-and-time-value]:text-left" />
                {!date && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">Data</span>}
              </div>
            </div>
            <datalist id="date-people-list">
              {people.map((p: any) => <option key={p.id} value={p.name} />)}
            </datalist>
            <button onClick={addDate} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md py-1 transition-colors">
              <Plus className="w-3 h-3" /> Adicionar data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
