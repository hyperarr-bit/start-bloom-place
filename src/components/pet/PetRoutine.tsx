import { useState } from "react";
import { localDayKey } from "@/lib/utils";
import { motion } from "framer-motion";
import { useUserData } from "@/hooks/use-user-data";
import { Check, Plus, X, Pencil, Trash2 } from "lucide-react";
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
  { id: "brush", label: "Escovar", emoji: "✂️" },
];

const emojiOptions = ["🍖", "💧", "🦮", "🛁", "🎾", "✂️", "💊", "💉", "🧴", "🦷", "🐾", "🎀", "🧹", "🛏️", "🥩", "🥕"];

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
  const today = localDayKey();
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
    setEditandoTarefa(null);
  };

  /* Renomear / trocar o emoji do hábito, sem apagar e recriar.
     Vale pros hábitos padrão também: `removeTask` já os apaga há tempos, então
     travar só o renomear seria incoerente — e o id é PRESERVADO, então os
     checks de hoje (guardados por id em pet-routine-<dia>) continuam de pé.
     Editar um padrão grava a lista inteira em pet-routine-tasks-<pet>, que é
     exatamente o que getTasksForPet lê quando existe. */
  const [editandoTarefa, setEditandoTarefa] = useState<{ petId: string; taskId: string } | null>(null);
  const [rascunho, setRascunho] = useState({ label: "", emoji: "🐾" });
  const [emojiRascunhoAberto, setEmojiRascunhoAberto] = useState(false);

  const comecarEdicao = (petId: string, t: TaskItem) => {
    setEditandoTarefa({ petId, taskId: t.id });
    setRascunho({ label: t.label, emoji: t.emoji });
    setEmojiRascunhoAberto(false);
    setShowEmojiPicker(null);
  };

  const salvarEdicao = () => {
    if (!editandoTarefa) return;
    const label = rascunho.label.trim();
    if (!label) return;
    const tasks = getTasksForPet(editandoTarefa.petId);
    setTasksForPet(
      editandoTarefa.petId,
      tasks.map(t => t.id !== editandoTarefa.taskId ? t : { ...t, label, emoji: rascunho.emoji }),
    );
    setEditandoTarefa(null);
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

            {/* 2 colunas no celular: com o lápis dentro do bloco, 3 colunas
                deixavam ~40px pro nome e "Passeio" já virava "Pass…" */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {tasks.map((t, ti) => {
                const checked = !!petTasks[t.id];
                const emEdicao = editandoTarefa?.petId === pet.id && editandoTarefa.taskId === t.id;
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: pi * 0.08 + ti * 0.03 }}
                    className={`flex items-stretch rounded-lg overflow-hidden text-[11px] transition-all ${
                      checked ? "bg-green-500/10 text-green-400 shadow-sm" : "bg-muted/30 text-muted-foreground"
                    } ${emEdicao ? "ring-1 ring-primary" : ""}`}
                  >
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => toggle(pet.id, t.id)}
                      aria-label={`${checked ? "Desmarcar" : "Marcar"} ${t.label}`}
                      className="flex items-center gap-1.5 p-2 min-h-9 flex-1 min-w-0 hover:bg-muted/20 transition-colors"
                    >
                      {checked ? (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500 }}>
                          <Check className="w-3 h-3" />
                        </motion.div>
                      ) : (
                        <span className="w-3 h-3 text-center leading-3">{t.emoji}</span>
                      )}
                      <span className="truncate">{t.label}</span>
                    </motion.button>
                    {/* Lápis dentro do bloco e SEMPRE visível — o X de antes só
                        aparecia no hover, ou seja, nunca no celular. Apagar
                        virou botão do painel de edição: menos coisa espremida
                        no card e menos toque errado ao marcar o hábito. */}
                    <button
                      onClick={() => comecarEdicao(pet.id, t)}
                      aria-label={`Editar ${t.label}`}
                      className="w-7 shrink-0 flex items-center justify-center border-l border-border/40 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                  </motion.div>
                );
              })}
            </div>

            {/* Painel de edição do hábito */}
            {editandoTarefa?.petId === pet.id && (
              <div className="mt-3 rounded-lg border border-primary/40 bg-background/60 p-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <button
                      onClick={() => setEmojiRascunhoAberto(v => !v)}
                      aria-label="Trocar emoji do hábito"
                      className="w-9 h-9 rounded-lg bg-muted/30 hover:bg-muted/50 flex items-center justify-center text-sm transition-colors"
                    >
                      {rascunho.emoji}
                    </button>
                    {emojiRascunhoAberto && (
                      <div className="absolute bottom-11 left-0 z-10 bg-popover border border-border rounded-lg p-2 grid grid-cols-4 gap-1 shadow-lg">
                        {emojiOptions.map(e => (
                          <button
                            key={e}
                            onClick={() => { setRascunho(r => ({ ...r, emoji: e })); setEmojiRascunhoAberto(false); }}
                            className="w-8 h-8 rounded hover:bg-muted flex items-center justify-center text-sm"
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Input
                    autoFocus
                    value={rascunho.label}
                    onChange={e => setRascunho(r => ({ ...r, label: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && salvarEdicao()}
                    className="h-9 text-xs flex-1"
                    placeholder="Nome do hábito"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={salvarEdicao} className="h-9 flex-1 rounded-md bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                    <Check className="w-3.5 h-3.5" /> Salvar
                  </button>
                  <button onClick={() => setEditandoTarefa(null)} className="h-9 px-3 rounded-md border border-border text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                    <X className="w-3.5 h-3.5" /> Cancelar
                  </button>
                  <button
                    onClick={() => removeTask(pet.id, editandoTarefa.taskId)}
                    aria-label="Apagar hábito"
                    className="w-9 h-9 shrink-0 rounded-md border border-destructive/40 text-destructive flex items-center justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Add new task inline */}
            <div className="mt-3 flex items-center gap-1.5">
              <div className="relative">
                {/* 36px de alvo: no dedo, 32 já erra — e agora esta linha
                    divide espaço com o painel de edição, que é h-9 */}
                <button
                  onClick={() => setShowEmojiPicker(showEmojiPicker === pet.id ? null : pet.id)}
                  aria-label="Escolher emoji do novo hábito"
                  className="w-9 h-9 rounded-lg bg-muted/30 hover:bg-muted/50 flex items-center justify-center text-sm transition-colors"
                >
                  {newEmoji[pet.id] || "🐾"}
                </button>
                {showEmojiPicker === pet.id && (
                  <div className="absolute bottom-11 left-0 z-10 bg-popover border border-border rounded-lg p-2 grid grid-cols-4 gap-1 shadow-lg">
                    {emojiOptions.map(e => (
                      <button
                        key={e}
                        onClick={() => { setNewEmoji(p => ({ ...p, [pet.id]: e })); setShowEmojiPicker(null); }}
                        className="w-8 h-8 rounded hover:bg-muted flex items-center justify-center text-sm"
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
                className="h-9 text-xs flex-1"
              />
              <button
                onClick={() => addTask(pet.id)}
                aria-label="Adicionar hábito"
                className="w-9 h-9 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors"
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
