import { useUserData } from "@/hooks/use-user-data";
import { Check } from "lucide-react";

const tasks = [
  { id: "food", label: "🍖 Comida", emoji: "🍖" },
  { id: "water", label: "💧 Água fresca", emoji: "💧" },
  { id: "walk", label: "🦮 Passeio", emoji: "🦮" },
  { id: "bath", label: "🛁 Banho", emoji: "🛁" },
  { id: "play", label: "🎾 Brincar", emoji: "🎾" },
  { id: "brush", label: "🪮 Escovar", emoji: "🪮" },
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
      <div className="text-center py-8 text-muted-foreground text-sm mt-3">
        Cadastre um pet primeiro na aba "Meus Pets" 🐾
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-3">
      {pets.map((pet: any) => {
        const petTasks = routine[pet.id] || {};
        const done = tasks.filter(t => petTasks[t.id]).length;
        const pct = Math.round((done / tasks.length) * 100);

        return (
          <div key={pet.id} className="bg-card rounded-xl border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold">{pet.name}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                pct === 100 ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
              }`}>
                {done}/{tasks.length}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {tasks.map(t => {
                const checked = !!petTasks[t.id];
                return (
                  <button
                    key={t.id}
                    onClick={() => toggle(pet.id, t.id)}
                    className={`flex items-center gap-1.5 p-2 rounded-lg text-[11px] transition-colors ${
                      checked ? "bg-green-500/10 text-green-400" : "bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    {checked ? <Check className="w-3 h-3" /> : <span className="w-3 h-3" />}
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
