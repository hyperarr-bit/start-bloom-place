import { useState } from "react";
import { Plus, Trash2, CalendarHeart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [person, setPerson] = useState("");
  const [date, setDate] = useState("");

  // Merge birthdays from people + custom dates
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
    setTitle("");
    setPerson("");
    setDate("");
    setShowForm(false);
  };

  const removeDate = (id: string) => {
    set("rel-dates", customDates.filter((d) => d.id !== id));
  };

  const getColorClasses = (days: number) => {
    if (days === 0) return "bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/30 animate-pulse";
    if (days <= 7) return "bg-rose-500/15 text-rose-400";
    if (days <= 30) return "bg-amber-500/15 text-amber-400";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{allDates.length} data{allDates.length !== 1 ? "s" : ""}</p>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs text-primary font-bold">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </motion.button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="bg-card rounded-xl border border-border p-3 space-y-2 overflow-hidden">
            <Input placeholder="Título (ex: Natal, Casamento)" value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-sm" />
            <Input placeholder="Pessoa (opcional)" value={person} onChange={(e) => setPerson(e.target.value)} className="h-8 text-sm" list="date-people-list" />
            <datalist id="date-people-list">
              {people.map((p: any) => <option key={p.id} value={p.name} />)}
            </datalist>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-sm" />
            <motion.button whileTap={{ scale: 0.95 }} onClick={addDate} className="w-full bg-primary text-primary-foreground rounded-lg py-1.5 text-xs font-bold">Salvar</motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {sorted.length === 0 && !showForm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 text-muted-foreground text-sm">
          <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-3xl mb-2">📅</motion.div>
          Adicione datas especiais para não esquecer
        </motion.div>
      )}

      <AnimatePresence mode="popLayout">
        {sorted.map((item, i) => {
          const days = getDaysUntil(item.date);
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.05 }}
              layout
              className="bg-card rounded-xl border border-border p-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-lg shrink-0">
                  {item.person ? item.person.charAt(0).toUpperCase() : <CalendarHeart className="w-4 h-4 text-rose-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(item.date), "dd/MM")} {item.person && `· ${item.person}`}</p>
                </div>
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${getColorClasses(days)}`}
                >
                  {days === 0 ? "🎉 Hoje!" : `${days}d`}
                </motion.span>
                {item.type === "custom" && (
                  <motion.button whileTap={{ scale: 0.8 }} onClick={() => removeDate(item.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                    <Trash2 className="w-3 h-3" />
                  </motion.button>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
