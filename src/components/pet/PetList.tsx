import { useState } from "react";
import { Plus, Trash2, PawPrint } from "lucide-react";
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

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{pets.length} pet{pets.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs text-primary font-bold">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-3 space-y-2">
          <Input placeholder="Nome do pet" value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" />
          <Input placeholder="Espécie (cachorro, gato...)" value={species} onChange={e => setSpecies(e.target.value)} className="h-8 text-sm" />
          <Input placeholder="Raça" value={breed} onChange={e => setBreed(e.target.value)} className="h-8 text-sm" />
          <Input placeholder="Peso (kg)" value={weight} onChange={e => setWeight(e.target.value)} className="h-8 text-sm" />
          <Input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} className="h-8 text-sm" />
          <button onClick={addPet} className="w-full bg-primary text-primary-foreground rounded-lg py-1.5 text-xs font-bold">Salvar</button>
        </div>
      )}

      {pets.length === 0 && !showForm && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Cadastre seus pets aqui 🐾
        </div>
      )}

      {pets.map(p => (
        <div key={p.id} className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-amber-400/20 flex items-center justify-center">
                <PawPrint className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {[p.species, p.breed].filter(Boolean).join(" · ")}
                  {p.birthday && ` · ${getAge(p.birthday)}`}
                </p>
              </div>
            </div>
            <button onClick={() => removePet(p.id)} className="text-muted-foreground hover:text-destructive p-1">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          {p.weight && <p className="text-[10px] text-muted-foreground mt-1.5 ml-12">{p.weight} kg</p>}
        </div>
      ))}
    </div>
  );
};
