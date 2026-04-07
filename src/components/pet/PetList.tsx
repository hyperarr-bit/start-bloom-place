import { useState } from "react";
import { Trash2, PawPrint, Plus } from "lucide-react";
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

export const PetList = () => {
  const { get, set } = useUserData();
  const pets = get<PetItem[]>("pet-list", []);
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
  };

  const removePet = (id: string) => set("pet-list", pets.filter(p => p.id !== id));

  const getAge = (bday: string) => {
    if (!bday) return "—";
    const years = differenceInYears(new Date(), new Date(bday));
    if (years > 0) return `${years}a`;
    const months = differenceInMonths(new Date(), new Date(bday));
    return `${months}m`;
  };

  return (
    <div className="mt-3">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-amber-200 dark:bg-amber-900/60 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PawPrint className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">Meus Pets</span>
          </div>
          <span className="text-[10px] text-amber-600 dark:text-amber-300">{pets.length}</span>
        </div>

        <div className="bg-amber-50/50 dark:bg-amber-950/20 p-2 space-y-1.5">
          <div className="grid grid-cols-12 gap-1 px-2 py-1">
            <span className="col-span-3 text-[9px] font-bold uppercase text-muted-foreground">Nome</span>
            <span className="col-span-3 text-[9px] font-bold uppercase text-muted-foreground">Espécie</span>
            <span className="col-span-3 text-[9px] font-bold uppercase text-muted-foreground">Raça</span>
            <span className="col-span-1 text-[9px] font-bold uppercase text-muted-foreground">Peso</span>
            <span className="col-span-2 text-[9px] font-bold uppercase text-muted-foreground text-right">Idade</span>
          </div>

          {pets.map(p => (
            <div key={p.id} className="grid grid-cols-12 gap-1 items-center bg-background/60 rounded-lg px-2 py-1.5 group">
              <span className="col-span-3 text-xs font-medium truncate">{p.name}</span>
              <span className="col-span-3 text-[10px] text-muted-foreground truncate">{p.species || "—"}</span>
              <span className="col-span-3 text-[10px] text-muted-foreground truncate">{p.breed || "—"}</span>
              <span className="col-span-1 text-[10px] text-muted-foreground">{p.weight ? `${p.weight}kg` : "—"}</span>
              <div className="col-span-2 flex items-center justify-end gap-1">
                <span className="text-[10px] text-muted-foreground">{getAge(p.birthday)}</span>
                <button onClick={() => removePet(p.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}

          {pets.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic py-3 text-center">Nenhum pet ainda</p>
          )}

          <div className="border border-dashed border-border/60 bg-background/50 rounded-lg p-2 space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <Input placeholder="Nome" value={name} onChange={e => setName(e.target.value)} className="h-7 text-[11px]" />
              <Input placeholder="Espécie" value={species} onChange={e => setSpecies(e.target.value)} className="h-7 text-[11px]" />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Input placeholder="Raça" value={breed} onChange={e => setBreed(e.target.value)} className="h-7 text-[11px]" />
              <Input placeholder="Peso (kg)" value={weight} onChange={e => setWeight(e.target.value)} className="h-7 text-[11px]" />
              <Input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} className="h-7 text-[11px]" />
            </div>
            <button onClick={addPet} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md py-1 transition-colors">
              <Plus className="w-3 h-3" /> Adicionar pet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
