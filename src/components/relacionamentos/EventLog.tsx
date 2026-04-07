import { useState } from "react";
import { Plus, Trash2, MapPin, CheckCircle2, HelpCircle, XCircle, CalendarDays } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

interface EventItem {
  id: string;
  name: string;
  date: string;
  location: string;
  rsvp: "confirmed" | "maybe" | "declined";
  tasks: { id: string; text: string; done: boolean }[];
}

const rsvpConfig = {
  confirmed: { label: "Confirmado", icon: CheckCircle2, color: "bg-green-500/20 text-green-400" },
  maybe: { label: "Talvez", icon: HelpCircle, color: "bg-amber-500/20 text-amber-400" },
  declined: { label: "Recusado", icon: XCircle, color: "bg-red-500/20 text-red-400" },
};

export const EventLog = () => {
  const { get, set } = useUserData();
  const events = get<EventItem[]>("rel-events", []);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [newTask, setNewTask] = useState<Record<string, string>>({});

  const addEvent = () => {
    if (!name.trim() || !date) return;
    const updated = [...events, { id: Date.now().toString(), name: name.trim(), date, location: location.trim(), rsvp: "maybe" as const, tasks: [] }];
    set("rel-events", updated);
    setName(""); setDate(""); setLocation("");
  };

  const removeEvent = (id: string) => set("rel-events", events.filter(e => e.id !== id));

  const cycleRsvp = (id: string) => {
    const order: EventItem["rsvp"][] = ["confirmed", "maybe", "declined"];
    set("rel-events", events.map(e => {
      if (e.id !== id) return e;
      return { ...e, rsvp: order[(order.indexOf(e.rsvp) + 1) % order.length] };
    }));
  };

  const addTask = (eventId: string) => {
    const text = newTask[eventId]?.trim();
    if (!text) return;
    set("rel-events", events.map(e => e.id === eventId ? { ...e, tasks: [...e.tasks, { id: Date.now().toString(), text, done: false }] } : e));
    setNewTask(prev => ({ ...prev, [eventId]: "" }));
  };

  const toggleTask = (eventId: string, taskId: string) => {
    set("rel-events", events.map(e => e.id === eventId ? { ...e, tasks: e.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) } : e));
  };

  const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="mt-3">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-indigo-200 dark:bg-indigo-900/60 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-300" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-200">Eventos</span>
          </div>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-300">{events.length}</span>
        </div>

        <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-2 space-y-1.5">
          {sorted.map(ev => {
            const cfg = rsvpConfig[ev.rsvp];
            const RsvpIcon = cfg.icon;
            const doneCount = ev.tasks.filter(t => t.done).length;
            return (
              <div key={ev.id} className="bg-background/60 rounded-lg px-2.5 py-2 space-y-1.5 group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold">{ev.name}</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(ev.date), "dd/MM/yyyy")}</p>
                    {ev.location && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" /> {ev.location}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => cycleRsvp(ev.id)} className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${cfg.color}`}>
                      <RsvpIcon className="w-2.5 h-2.5" /> {cfg.label}
                    </button>
                    <button onClick={() => removeEvent(ev.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {ev.tasks.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-bold">{doneCount}/{ev.tasks.length} tarefas</p>
                    {ev.tasks.map(t => (
                      <div key={t.id} className="flex items-center gap-2">
                        <button onClick={() => toggleTask(ev.id, t.id)} className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${t.done ? "bg-primary border-primary" : "border-border"}`}>
                          {t.done && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                        </button>
                        <span className={`text-xs ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.text}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5">
                  <Input
                    placeholder="Nova tarefa..."
                    value={newTask[ev.id] || ""}
                    onChange={e => setNewTask(p => ({ ...p, [ev.id]: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && addTask(ev.id)}
                    className="h-7 text-[11px] flex-1"
                  />
                  <button onClick={() => addTask(ev.id)} className="text-primary">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {events.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic py-3 text-center">Nenhum evento ainda</p>
          )}

          <div className="border border-dashed border-border/60 bg-background/50 rounded-lg p-2 space-y-1.5">
            <div className="grid grid-cols-3 gap-1.5">
              <Input placeholder="Nome do evento" value={name} onChange={e => setName(e.target.value)} className="h-7 text-[11px]" />
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-7 text-[11px]" />
              <Input placeholder="Local" value={location} onChange={e => setLocation(e.target.value)} className="h-7 text-[11px]" />
            </div>
            <button onClick={addEvent} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md py-1 transition-colors">
              <Plus className="w-3 h-3" /> Adicionar evento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
