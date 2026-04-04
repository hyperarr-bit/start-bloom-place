import { useState } from "react";
import { Plus, Trash2, PawPrint } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { differenceInYears, differenceInMonths } from "date-fns";

interface PetItem {
  id: string;
  name: string;
  species: string;
  breed: string;
  weight: string;
  birthday: string;
}

const speciesEmoji: Record<string, string> = {
  cachorro: "🐕", gato: "🐈", pássaro: "🐦", peixe: "🐟", hamster: "🐹", coelho: "🐇",
};

export const PetList = () => {
  const { get, set } = useUserData();
  const pets = get<PetItem[]>("pet-list", []);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [weight, setWeight] = useState("");
  const [birthday, setBirthday] = useState("");

  const addPet = () => {
    if (!name.trim()) return;
    const updated = [...pets, { id: Date.now().toString(), name: name.trim(), species: species.trim(), breed: breed.trim(), weight: weight.trim(), birthday }];
    set("pet-list", updated);
    setName(""); setSpecies(""); setBreed(""); setWeight(""); setBirthday("");
    setShowForm(false);
  };

  const removePet = (id: string) => set("pet-list", pets.filter(p => p.id !== id));

  const getAge = (bday: string) => {
    if (!bday) return "";
    const years = differenceInYears(new Date(), new Date(bday));
    if (years > 0) return `${years} ano${years > 1 ? "s" : ""}`;
    const months = differenceInMonths(new Date(), new Date(bday));
    return `${months} mes${months !== 1 ? "es" : ""}`;
  };

  const getEmoji = (species: string) => {
    const lower = species.toLowerCase();
    return speciesEmoji[lower] || "🐾";
  };

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{pets.length} pet{pets.length !== 1 ? "s" : ""}</p>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs text-primary font-bold">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </motion.button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card rounded-xl border border-border p-3 space-y-2 overflow-hidden"
          >
            <Input placeholder="Nome do pet" value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" />
            <Input placeholder="Espécie (cachorro, gato...)" value={species} onChange={e => setSpecies(e.target.value)} className="h-8 text-sm" />
            <Input placeholder="Raça" value={breed} onChange={e => setBreed(e.target.value)} className="h-8 text-sm" />
            <Input placeholder="Peso (kg)" value={weight} onChange={e => setWeight(e.target.value)} className="h-8 text-sm" />
            <Input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} className="h-8 text-sm" />
            <motion.button whileTap={{ scale: 0.95 }} onClick={addPet} className="w-full bg-primary text-primary-foreground rounded-lg py-1.5 text-xs font-bold">Salvar</motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {pets.length === 0 && !showForm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 text-muted-foreground text-sm">
          <motion.div
            animate={{ y: [0, -5, 0], rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 2.5 }}
            className="text-4xl mb-2"
          >
            🐾
          </motion.div>
          Cadastre seus pets aqui
        </motion.div>
      )}

      <AnimatePresence mode="popLayout">
        {pets.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: i * 0.06 }}
            layout
            className="bg-card rounded-xl border border-border p-3 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <motion.div
                  className="w-11 h-11 rounded-full bg-amber-400/15 flex items-center justify-center text-xl"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {getEmoji(p.species)}
                </motion.div>
                <div>
                  <p className="text-sm font-bold">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {[p.species, p.breed].filter(Boolean).join(" · ")}
                    {p.birthday && ` · ${getAge(p.birthday)}`}
                  </p>
                  {p.weight && <p className="text-[10px] text-muted-foreground">{p.weight} kg</p>}
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.8 }} onClick={() => removePet(p.id)} className="text-muted-foreground hover:text-destructive p-1 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </motion.button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
