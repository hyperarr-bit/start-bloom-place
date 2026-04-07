import { useState } from "react";
import { motion } from "framer-motion";
import { useUserData } from "@/hooks/use-user-data";
import { Check, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface TaskItem {
  id: string;
  label: string;
  emoji: string;
}

const defaultTasks: TaskItem[] = [
  { id: "food", label: "Comida", emoji: "🍖" },
  { id: "water", label: "Água", emoji: "💧" },
  { id: "walk", label: "Passeio", emoji: "🦮" },
  { id: "bath", label: "Banho", emoji: "🛁" },
  { id: "play", label: "Brincar", emoji: "🎾" },
  { id: "brush", label: "Escovar", emoji: "🪮" },
];

const emojiOptions = ["🍖", "💧", "🦮", "🛁", "🎾", "🪮", "💊", "🩺", "🧴", "🦷", "🐾", "🎀", "🧹", "🛏️", "🥩", "🥕"];

const getEmoji = (species: string) => {
  const s = species.toLowerCase();
  if (s.includes("gato") || s.includes("cat")) return "🐱";
  if (s.includes("cachorro") || s.includes("dog") || s.includes("cão")) return "🐶";
  if (s.includes("pássaro") || s.includes("bird") || s.includes("ave")) return "🐦";
  if (s.includes("peixe") || s.includes("fish")) return "🐟";
  if (s.includes("hamster")) return "🐹";
  if (s.includes("coelho") || s.includes("rabbit")) return "🐰";
  return "🐾";
};

export const PetRoutine = () => {
  const { get, set } = useUserData();
  const pets = get<any[]>("pet-list", []);
  const today = new Date().toISOString().split("T")[0];
  const routine = get<Record<string, Record<string, boolean>>>(`pet-routine-${today}`, {});

  const [newLabel, setNewLabel] = useState<Record<string, string>>({});
  const [newEmoji, setNewEmoji] = useState<Record<string, string>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);

  const getTasksForPet = (petId: string): TaskItem[] => {
    const custom = get<TaskItem[] | null>(`pet-routine-tasks-${petId}`, null);
    return custom ?? defaultTasks;
  };

  const setTasksForPet = (petId: string, tasks: TaskItem[]) => {
    set(`pet-routine-tasks-${petId}`, tasks);
  };

  const toggle = (petId: string, taskId: string) => {
    const petTasks = routine[petId] || {};
    const updated = { ...routine, [petId]: { ...petTasks, [taskId]: !petTasks[taskId] } };
    set(`pet-routine-${today}`, updated);
  };

  const addTask = (petId: string) => {
    const label = (newLabel[petId] || "").trim();
    if (!label) return;
    const emoji = newEmoji[petId] || "🐾";
    const tasks = getTasksForPet(petId);
    const id = `custom-${Date.now()}`;
    setTasksForPet(petId, [...tasks, { id, label, emoji }]);
    setNewLabel(p => ({ ...p, [petId]: "" }));
    setNewEmoji(p => ({ ...p, [petId]: "" }));
    setShowEmojiPicker(null);
  };

  const removeTask = (petId: string, taskId: string) => {
    const tasks = getTasksForPet(petId);
    setTasksForPet(petId, tasks.filter(t => t.id !== taskId));
  };

  if (pets.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 text-muted-foreground text-sm mt-3">
        <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="text-3xl mb-2">🐾</motion.div>
        Cadastre um pet primeiro na aba "Meus Pets"
      </motion.div>
    );
  }

  return (
    <div className="space-y-4 mt-3">
      {pets.map((pet: any, pi: number) => {
        const tasks = getTasksForPet(pet.id);
        const petTasks = routine[pet.id] || {};
        const done = tasks.filter(t => petTasks[t.id]).length;
        const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

        return (
          <motion.div
            key={pet.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: pi * 0.08 }}
            className="bg-card rounded-xl border border-border p-3"
          >
            {/* Header with avatar */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center overflow-hidden shrink-0">
                {pet.photoUrl ? (
                  <img src={pet.photoUrl} alt={pet.name} className="w-full h-full object-cover rounded-full" />
                ) : (
                  <span className="text-lg">{getEmoji(pet.species || "")}</span>
                )}
              </div>
              <p className="text-sm font-bold flex-1">{pet.name}</p>
              <motion.span
                key={done}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  pct === 100 ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
                }`}
              >
                {pct === 100 ? "✨ " : ""}{done}/{tasks.length}
              </motion.span>
            </div>

            {/* Progress bar */}
            <div className="h-1 rounded-full bg-muted mb-3 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-green-400"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>

            {/* Tasks grid */}
            <div className="grid grid-cols-3 gap-1.5">
              {tasks.map((t, ti) => {
                const checked = !!petTasks[t.id];
                return (
                  <motion.button
                    key={t.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: pi * 0.08 + ti * 0.03 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => toggle(pet.id, t.id)}
                    className={`relative group/task flex items-center gap-1.5 p-2 rounded-lg text-[11px] transition-all ${
                      checked ? "bg-green-500/10 text-green-400 shadow-sm" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {checked ? (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500 }}>
                        <Check className="w-3 h-3" />
                      </motion.div>
                    ) : (
                      <span className="w-3 h-3 text-center leading-3">{t.emoji}</span>
                    )}
                    <span className="truncate">{t.label}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeTask(pet.id, t.id); }}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover/task:opacity-100 transition-opacity"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </motion.button>
                );
              })}
            </div>

            {/* Add new task inline */}
            <div className="mt-3 flex items-center gap-1.5">
              <div className="relative">
                <button
                  onClick={() => setShowEmojiPicker(showEmojiPicker === pet.id ? null : pet.id)}
                  className="w-8 h-8 rounded-lg bg-muted/30 hover:bg-muted/50 flex items-center justify-center text-sm transition-colors"
                >
                  {newEmoji[pet.id] || "🐾"}
                </button>
                {showEmojiPicker === pet.id && (
                  <div className="absolute bottom-10 left-0 z-10 bg-popover border border-border rounded-lg p-2 grid grid-cols-4 gap-1 shadow-lg">
                    {emojiOptions.map(e => (
                      <button
                        key={e}
                        onClick={() => { setNewEmoji(p => ({ ...p, [pet.id]: e })); setShowEmojiPicker(null); }}
                        className="w-7 h-7 rounded hover:bg-muted flex items-center justify-center text-sm"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Input
                placeholder="Novo hábito..."
                value={newLabel[pet.id] || ""}
                onChange={e => setNewLabel(p => ({ ...p, [pet.id]: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addTask(pet.id)}
                className="h-8 text-xs flex-1"
              />
              <button
                onClick={() => addTask(pet.id)}
                className="w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
