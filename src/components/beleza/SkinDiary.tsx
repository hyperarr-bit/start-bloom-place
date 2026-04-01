import { useState, useRef } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Camera, ImagePlus, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";

const genId = () => crypto.randomUUID();
const getDateKey = () => new Date().toISOString().slice(0, 10);

interface DiaryEntry {
  id: string;
  date: string;
  photoUrl: string;
  notes: string;
  skinStatus: string;
  mood: string;
}

const moods = ["😊", "😐", "😔", "🤩", "😴"];
const skinStatuses = [
  { id: "boa", emoji: "✨", label: "Boa" },
  { id: "oleosa", emoji: "🛢️", label: "Oleosa" },
  { id: "seca", emoji: "🌵", label: "Seca" },
  { id: "acne", emoji: "🔴", label: "Acne" },
  { id: "sensivel", emoji: "🍅", label: "Sensível" },
];

export const SkinDiary = () => {
  const { user } = useAuth();
  const [entries, setEntries] = usePersistedState<DiaryEntry[]>("skincare-diary", []);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ notes: "", skinStatus: "boa", mood: "😊", photoUrl: "" });
  const [compareMode, setCompareMode] = useState(false);
  const [compareEntries, setCompareEntries] = useState<[DiaryEntry | null, DiaryEntry | null]>([null, null]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const today = getDateKey();
  const todayEntry = entries.find(e => e.date === today);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${genId()}.${ext}`;
      const { error } = await supabase.storage.from("skin-photos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("skin-photos").getPublicUrl(path);
      setForm(prev => ({ ...prev, photoUrl: urlData.publicUrl }));
      toast.success("Foto carregada!");
    } catch (err: any) {
      toast.error("Erro ao carregar foto: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    if (!form.photoUrl && !form.notes) { toast.error("Adicione uma foto ou observação"); return; }
    setEntries(prev => [{ id: genId(), date: today, ...form }, ...prev]);
    setForm({ notes: "", skinStatus: "boa", mood: "😊", photoUrl: "" });
    setShowForm(false);
  };

  const deleteEntry = (id: string) => setEntries(prev => prev.filter(x => x.id !== id));

  const toggleCompare = (entry: DiaryEntry) => {
    if (compareEntries[0]?.id === entry.id) setCompareEntries([null, compareEntries[1]]);
    else if (compareEntries[1]?.id === entry.id) setCompareEntries([compareEntries[0], null]);
    else if (!compareEntries[0]) setCompareEntries([entry, compareEntries[1]]);
    else if (!compareEntries[1]) setCompareEntries([compareEntries[0], entry]);
  };

  const photosEntries = entries.filter(e => e.photoUrl);

  return (
    <div className="space-y-4 mt-4">
      {/* Header — Notion-style */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-amber-200 dark:bg-amber-800/50 px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider">📸 DIÁRIO DE PELE</span>
          <div className="flex gap-2">
            {photosEntries.length >= 2 && (
              <button onClick={() => setCompareMode(!compareMode)}
                className={`text-[10px] font-medium flex items-center gap-1 ${compareMode ? "text-foreground" : "text-foreground/60"}`}>
                <ArrowLeftRight className="w-3 h-3" /> Comparar
              </button>
            )}
          </div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/20 px-4 py-2 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">{entries.length} registros • {photosEntries.length} fotos</p>
          {todayEntry && (
            <Badge variant="secondary" className="text-[9px]">
              ✅ Registro de hoje feito
            </Badge>
          )}
        </div>
      </div>

      {!todayEntry && (
        <Button variant="outline" className="w-full rounded-xl h-9 text-xs border-dashed" onClick={() => setShowForm(true)}>
          <Plus className="w-3 h-3 mr-1" /> Registrar Hoje
        </Button>
      )}

      {/* Compare mode */}
      {compareMode && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-amber-100 dark:bg-amber-900/20 px-3 py-1.5">
            <span className="text-[10px] font-bold text-muted-foreground">📸 Selecione 2 fotos para comparar</span>
          </div>
          <div className="bg-card p-3 grid grid-cols-2 gap-3">
            {[0, 1].map(i => (
              <div key={i} className="aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                {compareEntries[i] ? (
                  <div className="relative w-full h-full">
                    <img src={compareEntries[i]!.photoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                    <div className="absolute bottom-1 left-1 right-1">
                      <span className="text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                        {new Date(compareEntries[i]!.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground">Foto {i + 1}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          {form.photoUrl ? (
            <div className="relative">
              <img src={form.photoUrl} alt="" className="w-full h-48 object-cover rounded-xl" />
              <button onClick={() => setForm(p => ({ ...p, photoUrl: "" }))} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="w-full h-32 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-emerald-300 hover:text-emerald-600 transition-colors">
              {uploading ? <p className="text-xs">Carregando...</p> : (
                <><ImagePlus className="w-6 h-6" /><p className="text-xs font-medium">Tirar foto ou escolher da galeria</p></>
              )}
            </button>
          )}
          <div>
            <p className="text-xs font-medium mb-1.5">Pele hoje</p>
            <div className="flex gap-1.5 flex-wrap">
              {skinStatuses.map(s => (
                <button key={s.id} onClick={() => setForm(p => ({ ...p, skinStatus: s.id }))}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${
                    form.skinStatus === s.id ? "bg-emerald-100 dark:bg-emerald-800/30 border-emerald-300 text-emerald-700 dark:text-emerald-300" : "border-border text-muted-foreground"
                  }`}>
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-1.5">Humor</p>
            <div className="flex gap-2">
              {moods.map(m => (
                <button key={m} onClick={() => setForm(p => ({ ...p, mood: m }))}
                  className={`text-xl p-1.5 rounded-xl border transition-all ${
                    form.mood === m ? "border-foreground bg-muted scale-110" : "border-transparent"
                  }`}>{m}</button>
              ))}
            </div>
          </div>
          <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Observações (irritações, melhorias, produtos usados...)" className="text-xs min-h-[60px]" />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={save}>Salvar Registro</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Timeline — Notion-style rows */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-amber-100 dark:bg-amber-900/20 px-3 py-1.5 grid grid-cols-12 gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
          <span className="col-span-2">Foto</span>
          <span className="col-span-3">Data</span>
          <span className="col-span-3">Pele</span>
          <span className="col-span-3">Notas</span>
          <span className="col-span-1"></span>
        </div>
        <div className="divide-y divide-border bg-card">
          {entries.slice(0, 30).map(e => {
            const isSelected = compareEntries[0]?.id === e.id || compareEntries[1]?.id === e.id;
            return (
              <div key={e.id}
                className={`px-3 py-2 grid grid-cols-12 gap-1 items-center transition-all group ${
                  compareMode && e.photoUrl ? "cursor-pointer hover:bg-muted/30" : ""
                } ${isSelected ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}
                onClick={() => compareMode && e.photoUrl && toggleCompare(e)}>
                <div className="col-span-2">
                  {e.photoUrl ? (
                    <img src={e.photoUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <span className="text-xl">{skinStatuses.find(s => s.id === e.skinStatus)?.emoji || "✨"}</span>
                  )}
                </div>
                <div className="col-span-3">
                  <span className="text-xs font-medium">
                    {new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                  <span className="text-sm ml-1">{e.mood}</span>
                </div>
                <div className="col-span-3">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {skinStatuses.find(s => s.id === e.skinStatus)?.emoji} {e.skinStatus}
                  </span>
                </div>
                <div className="col-span-3">
                  {e.notes && <p className="text-[10px] text-muted-foreground line-clamp-1">{e.notes}</p>}
                </div>
                <div className="col-span-1 flex justify-end">
                  {!compareMode && (
                    <button onClick={() => deleteEntry(e.id)} className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {entries.length === 0 && !showForm && (
        <div className="text-center py-10">
          <Camera className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Registre sua primeira foto!</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">Tire uma selfie por semana para acompanhar a evolução da sua pele</p>
        </div>
      )}
    </div>
  );
};
