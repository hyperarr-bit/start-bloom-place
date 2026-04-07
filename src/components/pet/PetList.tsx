import { useState } from "react";
import { Trash2, PawPrint, Plus, X } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { PhotoPicker } from "@/components/ui/PhotoPicker";
import { differenceInYears, differenceInMonths } from "date-fns";

interface PetItem {
  id: string;
  name: string;
  species: string;
  breed: string;
  weight: string;
  birthday: string;
  photoUrl?: string;
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
  const [photoUrl, setPhotoUrl] = useState("");

  const addPet = () => {
    if (!name.trim()) return;
    const updated = [...pets, { id: Date.now().toString(), name: name.trim(), species: species.trim(), breed: breed.trim(), weight: weight.trim(), birthday, photoUrl: photoUrl.trim() || undefined }];
    set("pet-list", updated);
    setName(""); setSpecies(""); setBreed(""); setWeight(""); setBirthday(""); setPhotoUrl("");
    setShowForm(false);
  };

  const removePet = (id: string) => set("pet-list", pets.filter(p => p.id !== id));

  const getAge = (bday: string) => {
    if (!bday) return "";
    const years = differenceInYears(new Date(), new Date(bday));
    if (years > 0) return `${years}a`;
    const months = differenceInMonths(new Date(), new Date(bday));
    return `${months}m`;
  };

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

  return (
    <div className="mt-3">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-amber-200 dark:bg-amber-900/60 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PawPrint className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">Meus Pets</span>
            <span className="text-[10px] text-amber-600 dark:text-amber-300">{pets.length}</span>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-200 hover:bg-amber-300/50 dark:hover:bg-amber-800/50 rounded-md px-2 py-1 transition-colors"
          >
            {showForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showForm ? "Fechar" : "Adicionar"}
          </button>
        </div>

        <div className="bg-amber-50/50 dark:bg-amber-950/20 p-2 space-y-2">
          {showForm && (
            <div className="border border-dashed border-amber-300/60 dark:border-amber-700/40 bg-background/50 rounded-lg p-3 space-y-2">
              <Input placeholder="Nome do pet" value={name} onChange={e => setName(e.target.value)} className="h-8 text-xs" />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Espécie (ex: Gato)" value={species} onChange={e => setSpecies(e.target.value)} className="h-8 text-xs" />
                <Input placeholder="Raça" value={breed} onChange={e => setBreed(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Peso (kg)" value={weight} onChange={e => setWeight(e.target.value)} className="h-8 text-xs" />
                <Input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} className="h-8 text-xs" />
              </div>
              <PhotoPicker value={photoUrl || undefined} onChange={setPhotoUrl} onClear={() => setPhotoUrl("")} />
              <button
                onClick={addPet}
                className="w-full flex items-center justify-center gap-1 text-[11px] font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-md py-2 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Salvar pet
              </button>
            </div>
          )}

          {pets.map(p => {
            const age = getAge(p.birthday);
            const info = [p.species, p.breed, age].filter(Boolean).join(" · ");
            return (
              <div key={p.id} className="flex items-center gap-3 bg-background/60 rounded-lg px-3 py-2.5 group">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center overflow-hidden shrink-0">
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span className="text-lg">{getEmoji(p.species)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{p.name}</p>
                  {info && <p className="text-[10px] text-muted-foreground truncate">{info}</p>}
                  {p.weight && <p className="text-[10px] text-muted-foreground">{p.weight} kg</p>}
                </div>
                <button
                  onClick={() => removePet(p.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          {pets.length === 0 && !showForm && (
            <p className="text-[11px] text-muted-foreground italic py-4 text-center">Nenhum pet cadastrado</p>
          )}
        </div>
      </div>
    </div>
  );
};
