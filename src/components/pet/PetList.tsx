import { useState } from "react";
import { Trash2, PawPrint, Plus, X, Pencil, Check } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { CampoData } from "@/components/ui/campo-data";
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

  /* Edição na própria linha (mesmo padrão de IncomeTable). Até aqui a única
     forma de corrigir um peso ou trocar a foto era APAGAR o pet — e apagar o
     pet leva junto o vínculo dos registros de saúde/gastos/rotina, que apontam
     pro id dele. Editar mantém o id e preserva tudo. */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState({ name: "", species: "", breed: "", weight: "", birthday: "", photoUrl: "" });

  const comecarEdicao = (p: PetItem) => {
    // Fecha o form de cadastro: dois formulários abertos no celular viram uma
    // rolagem confusa e a pessoa não sabe qual botão salva o quê.
    setShowForm(false);
    setEditandoId(p.id);
    setRascunho({
      name: p.name,
      species: p.species || "",
      breed: p.breed || "",
      weight: p.weight || "",
      birthday: p.birthday || "",
      photoUrl: p.photoUrl || "",
    });
  };

  const salvarEdicao = () => {
    const nome = rascunho.name.trim();
    if (!nome) return;
    const anterior = pets.find(p => p.id === editandoId);
    set("pet-list", pets.map(p => p.id !== editandoId ? p : {
      ...p, // preserva o id (e qualquer campo novo que apareça no futuro)
      name: nome,
      species: rascunho.species.trim(),
      breed: rascunho.breed.trim(),
      weight: rascunho.weight.trim(),
      birthday: rascunho.birthday,
      photoUrl: rascunho.photoUrl.trim() || undefined,
    }));

    /* O diário guarda o NOME do pet, não o id (é a única aba assim). Sem esta
       migração, renomear o pet fazia os momentos antigos parecerem de outro
       bicho — o mesmo sintoma de "sumiu" que a gente já pagou caro em julho. */
    if (anterior && anterior.name !== nome) {
      const diary = get<any[]>("pet-diary", []);
      if (diary.some(e => e.petName === anterior.name)) {
        set("pet-diary", diary.map(e => e.petName === anterior.name ? { ...e, petName: nome } : e));
      }
    }
    setEditandoId(null);
  };

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

            if (editandoId === p.id) {
              return (
                <div key={p.id} className="border border-primary/40 bg-background/70 rounded-lg p-3 space-y-2">
                  <Input autoFocus placeholder="Nome do pet" value={rascunho.name} onChange={e => setRascunho({ ...rascunho, name: e.target.value })} className="h-9 text-xs" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Espécie (ex: Gato)" value={rascunho.species} onChange={e => setRascunho({ ...rascunho, species: e.target.value })} className="h-9 text-xs" />
                    <Input placeholder="Raça" value={rascunho.breed} onChange={e => setRascunho({ ...rascunho, breed: e.target.value })} className="h-9 text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Peso (kg)" value={rascunho.weight} onChange={e => setRascunho({ ...rascunho, weight: e.target.value })} className="h-9 text-xs" />
                    <CampoData rotulo="Aniversário" value={rascunho.birthday} onChange={e => setRascunho({ ...rascunho, birthday: e.target.value })} className="h-9 text-xs" />
                  </div>
                  <PhotoPicker value={rascunho.photoUrl || undefined} onChange={url => setRascunho(r => ({ ...r, photoUrl: url }))} onClear={() => setRascunho(r => ({ ...r, photoUrl: "" }))} label="Trocar foto" />
                  <div className="flex items-center gap-2">
                    <button onClick={salvarEdicao} className="h-9 flex-1 rounded-md bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                      <Check className="w-3.5 h-3.5" /> Salvar
                    </button>
                    <button onClick={() => setEditandoId(null)} className="h-9 px-4 rounded-md border border-border text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                      <X className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={p.id} className="flex items-center gap-2 bg-background/60 rounded-lg px-2 py-2">
                {/* Linha inteira é o gatilho de edição — no celular ninguém acha
                    um ícone que só aparece no hover, então nada de opacity-0. */}
                <button onClick={() => comecarEdicao(p)} aria-label={`Editar ${p.name}`} className="flex items-center gap-3 flex-1 min-w-0 text-left">
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
                </button>
                <button
                  onClick={() => comecarEdicao(p)}
                  aria-label={`Editar ${p.name}`}
                  className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => removePet(p.id)}
                  aria-label={`Apagar ${p.name}`}
                  className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive transition-colors"
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
