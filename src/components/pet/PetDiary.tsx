import { useState, useEffect } from "react";
import { Plus, Trash2, BookOpen } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhotoPicker } from "@/components/ui/PhotoPicker";
import { format } from "date-fns";

interface DiaryEntry {
  id: string;
  petName: string;
  date: string;
  text: string;
  mood: string;
  photoUrl?: string;
}

const moods = ["😍", "😊", "😴", "🤒", "😈", "🥺"];

export const PetDiary = () => {
  const { get, set } = useUserData();
  const entries = get<DiaryEntry[]>("pet-diary", []);
  const pets = get<any[]>("pet-list", []);
  const [petName, setPetName] = useState("");
  const [text, setText] = useState("");
  const [mood, setMood] = useState("😊");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);

  // Auto-select if only one pet
  useEffect(() => {
    if (pets.length === 1 && !petName) {
      setPetName(pets[0].name);
    }
  }, [pets, petName]);

  const addEntry = () => {
    if (!text.trim()) return;
    const updated = [
      { id: Date.now().toString(), petName: petName.trim(), date: new Date().toISOString(), text: text.trim(), mood, photoUrl: photoUrl.trim() || undefined },
      ...entries,
    ];
    set("pet-diary", updated);
    setText(""); setPetName(""); setMood("😊"); setPhotoUrl(undefined);
  };

  const removeEntry = (id: string) => {
    set("pet-diary", entries.filter(e => e.id !== id));
  };

  return (
    <div className="mt-3">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-violet-200 dark:bg-violet-900/60 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-violet-700 dark:text-violet-300" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-800 dark:text-violet-200">Diário</span>
          </div>
          <span className="text-[10px] text-violet-600 dark:text-violet-300">{entries.length}</span>
        </div>

        <div className="bg-violet-50/50 dark:bg-violet-950/20 p-2 space-y-1.5">
          {entries.map(entry => (
            <div key={entry.id} className="bg-background/60 rounded-lg px-2.5 py-2 group">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm">{entry.mood}</span>
                    <span className="text-xs font-bold">{entry.petName || "Meu pet"}</span>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(entry.date), "dd/MM 'às' HH:mm")}</span>
                  </div>
                  <p className="text-xs leading-relaxed">{entry.text}</p>
                  {entry.photoUrl && (
                    <img src={entry.photoUrl} alt={`Foto de ${entry.petName || "pet"}`} className="mt-1.5 rounded-lg w-full max-h-32 object-cover" />
                  )}
                </div>
                <button onClick={() => removeEntry(entry.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-all">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}

          {entries.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic py-3 text-center">Nenhum momento registrado ainda</p>
          )}

          <div className="border border-dashed border-border/60 bg-background/50 rounded-lg p-2 space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <Select value={petName} onValueChange={setPetName}>
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue placeholder={pets.length === 0 ? "Cadastre um pet primeiro" : "Selecionar pet"} />
                </SelectTrigger>
                <SelectContent>
                  {pets.map((p: any) => (
                    <SelectItem key={p.id} value={p.name} className="text-[11px]">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-1 items-center">
                {moods.map(m => (
                  <button key={m} onClick={() => setMood(m)} className={`text-sm p-0.5 rounded transition-all ${mood === m ? "bg-primary/20 ring-1 ring-primary scale-110" : "opacity-50 hover:opacity-80"}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <Textarea placeholder="O que aconteceu hoje?" value={text} onChange={e => setText(e.target.value)} className="text-[11px] min-h-[40px]" rows={2} />
            <PhotoPicker value={photoUrl} onChange={setPhotoUrl} onClear={() => setPhotoUrl(undefined)} />
            <button onClick={addEntry} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md py-1 transition-colors">
              <Plus className="w-3 h-3" /> Registrar momento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
