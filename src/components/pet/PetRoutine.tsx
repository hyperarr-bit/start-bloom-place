import { motion } from "framer-motion";
import { useUserData } from "@/hooks/use-user-data";
import { Check } from "lucide-react";

const tasks = [
  { id: "food", label: "Comida", emoji: "🍖" },
  { id: "water", label: "Água", emoji: "💧" },
  { id: "walk", label: "Passeio", emoji: "🦮" },
  { id: "bath", label: "Banho", emoji: "🛁" },
  { id: "play", label: "Brincar", emoji: "🎾" },
  { id: "brush", label: "Escovar", emoji: "🪮" },
];

export const PetRoutine = () => {
  const { get, set } = useUserData();
  const pets = get<any[]>("pet-list", []);
  const today = new Date().toISOString().split("T")[0];
  const routine = get<Record<string, Record<string, boolean>>>(`pet-routine-${today}`, {});

  const toggle = (petId: string, taskId: string) => {
    const petTasks = routine[petId] || {};
    const updated = { ...routine, [petId]: { ...petTasks, [taskId]: !petTasks[taskId] } };
    set(`pet-routine-${today}`, updated);
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
        const petTasks = routine[pet.id] || {};
        const done = tasks.filter(t => petTasks[t.id]).length;
        const pct = Math.round((done / tasks.length) * 100);

        return (
          <motion.div
            key={pet.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: pi * 0.08 }}
            className="bg-card rounded-xl border border-border p-3"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold">{pet.name}</p>
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
                    className={`flex items-center gap-1.5 p-2 rounded-lg text-[11px] transition-all ${
                      checked ? "bg-green-500/10 text-green-400 shadow-sm" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {checked ? (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500 }}>
                        <Check className="w-3 h-3" />
                      </motion.div>
                    ) : (
                      <span className="w-3 h-3">{t.emoji}</span>
                    )}
                    {t.label}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
