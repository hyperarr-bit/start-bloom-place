import { useState } from "react";
import { Plus, Trash2, MapPin, CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [newTask, setNewTask] = useState<Record<string, string>>({});

  const addEvent = () => {
    if (!name.trim() || !date) return;
    const updated = [...events, { id: Date.now().toString(), name: name.trim(), date, location: location.trim(), rsvp: "maybe" as const, tasks: [] }];
    set("rel-events", updated);
    setName("");
    setDate("");
    setLocation("");
    setShowForm(false);
  };

  const removeEvent = (id: string) => set("rel-events", events.filter((e) => e.id !== id));

  const cycleRsvp = (id: string) => {
    const order: EventItem["rsvp"][] = ["confirmed", "maybe", "declined"];
    set("rel-events", events.map((e) => {
      if (e.id !== id) return e;
      return { ...e, rsvp: order[(order.indexOf(e.rsvp) + 1) % order.length] };
    }));
  };

  const addTask = (eventId: string) => {
    const text = newTask[eventId]?.trim();
    if (!text) return;
    set("rel-events", events.map((e) => e.id === eventId ? { ...e, tasks: [...e.tasks, { id: Date.now().toString(), text, done: false }] } : e));
    setNewTask((prev) => ({ ...prev, [eventId]: "" }));
  };

  const toggleTask = (eventId: string, taskId: string) => {
    set("rel-events", events.map((e) => e.id === eventId ? { ...e, tasks: e.tasks.map((t) => t.id === taskId ? { ...t, done: !t.done } : t) } : e));
  };

  const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{events.length} evento{events.length !== 1 ? "s" : ""}</p>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs text-primary font-bold">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </motion.button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="bg-card rounded-xl border border-border p-3 space-y-2 overflow-hidden">
            <Input placeholder="Nome do evento" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-sm" />
            <Input placeholder="Local / endereço" value={location} onChange={(e) => setLocation(e.target.value)} className="h-8 text-sm" />
            <motion.button whileTap={{ scale: 0.95 }} onClick={addEvent} className="w-full bg-primary text-primary-foreground rounded-lg py-1.5 text-xs font-bold">Salvar</motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {sorted.length === 0 && !showForm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 text-muted-foreground text-sm">
          <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-3xl mb-2">📋</motion.div>
          Registre convites e eventos que está organizando
        </motion.div>
      )}

      <AnimatePresence mode="popLayout">
        {sorted.map((ev, i) => {
          const cfg = rsvpConfig[ev.rsvp];
          const RsvpIcon = cfg.icon;
          const doneCount = ev.tasks.filter((t) => t.done).length;
          return (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.05 }}
              layout
              className="bg-card rounded-xl border border-border p-3 space-y-2 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold">{ev.name}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(ev.date), "dd/MM/yyyy")}</p>
                  {ev.location && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-2.5 h-2.5" /> {ev.location}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => cycleRsvp(ev.id)}
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${cfg.color}`}
                  >
                    <RsvpIcon className="w-2.5 h-2.5" /> {cfg.label}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.8 }} onClick={() => removeEvent(ev.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                    <Trash2 className="w-3 h-3" />
                  </motion.button>
                </div>
              </div>

              {/* Tasks */}
              {ev.tasks.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-bold">{doneCount}/{ev.tasks.length} tarefas</p>
                  {ev.tasks.map((t) => (
                    <motion.div key={t.id} layout className="flex items-center gap-2">
                      <motion.button whileTap={{ scale: 0.85 }} onClick={() => toggleTask(ev.id, t.id)} className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${t.done ? "bg-primary border-primary" : "border-border"}`}>
                        {t.done && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                      </motion.button>
                      <span className={`text-xs ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.text}</span>
                    </motion.div>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5">
                <Input
                  placeholder="Nova tarefa..."
                  value={newTask[ev.id] || ""}
                  onChange={(e) => setNewTask((p) => ({ ...p, [ev.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && addTask(ev.id)}
                  className="h-7 text-[11px] flex-1"
                />
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => addTask(ev.id)} className="text-primary">
                  <Plus className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
