import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Camera, ArrowLeftRight } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface Measurement {
  date: string;
  peso: string;
  bf: string;
  cintura: string;
  bracoD: string;
  bracoE: string;
  pernaD: string;
  pernaE: string;
  peito: string;
}

interface BodyPhoto {
  date: string;
  url: string;
}

interface SentimentEntry {
  sentiment: string;
  note: string;
  items?: string[];
}

const sentiments = [
  { id: "descontente", emoji: "😐", label: "Descontente", headerBg: "bg-purple-200 dark:bg-purple-900/40", bodyBg: "bg-card" },
  { id: "contente", emoji: "🤗", label: "Contente", headerBg: "bg-pink-400 dark:bg-pink-800/60", bodyBg: "bg-card", headerText: "text-white dark:text-pink-100" },
  { id: "desafio", emoji: "🎯", label: "Desafio", headerBg: "bg-stone-200 dark:bg-stone-800/40", bodyBg: "bg-card" },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

export const BodyEvolution = () => {
  const { user } = useAuth();
  const today = todayStr();
  const [measurements, setMeasurements] = usePersistedState<Measurement[]>("core-saude-measures", []);
  const [photos, setPhotos] = usePersistedState<BodyPhoto[]>("core-saude-body-photos", []);
  const [sentimentLog, setSentimentLog] = usePersistedState<Record<string, SentimentEntry>>("core-saude-sentiment", {});
  const [showForm, setShowForm] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIdx, setCompareIdx] = useState<[number, number]>([0, 1]);
  const [newM, setNewM] = useState<Measurement>({ date: today, peso: "", bf: "", cintura: "", bracoD: "", bracoE: "", pernaD: "", pernaE: "", peito: "" });
  const [sentimentNote, setSentimentNote] = useState(sentimentLog[today]?.note || "");
  const [sentimentItems, setSentimentItems] = useState<string[]>(sentimentLog[today]?.items || []);
  const [newSentimentItem, setNewSentimentItem] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const saveMeasurement = () => {
    if (!newM.peso && !newM.cintura) return;
    setMeasurements(prev => [...prev, { ...newM }]);
    setNewM({ date: today, peso: "", bf: "", cintura: "", bracoD: "", bracoE: "", pernaD: "", pernaE: "", peito: "" });
    setShowForm(false);
  };

  const uploadPhoto = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/body/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("skin-photos").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("skin-photos").getPublicUrl(path);
      setPhotos(prev => [...prev, { date: today, url: urlData.publicUrl }]);
    } catch (e) {
      console.error("Upload failed", e);
    }
    setUploading(false);
  };

  const sorted = [...measurements].sort((a, b) => b.date.localeCompare(a.date));
  const todaySentiment = sentimentLog[today];

  const fields: { key: keyof Measurement; label: string; unit: string }[] = [
    { key: "peso", label: "PESO", unit: "kg" },
    { key: "bf", label: "BF%", unit: "%" },
    { key: "cintura", label: "CINTURA", unit: "cm" },
    { key: "bracoD", label: "BRAÇO D", unit: "cm" },
    { key: "bracoE", label: "BRAÇO E", unit: "cm" },
    { key: "pernaD", label: "PERNA D", unit: "cm" },
    { key: "pernaE", label: "PERNA E", unit: "cm" },
    { key: "peito", label: "PEITO", unit: "cm" },
  ];

  const addSentimentItem = () => {
    if (!newSentimentItem.trim()) return;
    const updated = [...sentimentItems, newSentimentItem.trim()];
    setSentimentItems(updated);
    setSentimentLog(prev => ({ ...prev, [today]: { ...prev[today], items: updated } }));
    setNewSentimentItem("");
  };

  return (
    <div className="space-y-5">
      {/* ── BEFORE & AFTER ── */}
      {photos.length >= 2 && (
        <div className="rounded-2xl border border-border overflow-hidden bg-card">
          <div className="bg-blue-200 dark:bg-blue-900/40 px-5 py-4 flex items-center justify-between">
            <h3 className="text-base font-black uppercase tracking-wide text-foreground">Antes & Depois</h3>
            <span className="text-3xl">📸</span>
          </div>
          <div className="p-4">
            <button
              onClick={() => setCompareMode(!compareMode)}
              className="w-full py-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" /> {compareMode ? "Fechar" : "Comparar Fotos"}
            </button>
            {compareMode && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                {[0, 1].map(slot => (
                  <div key={slot}>
                    <select className="w-full text-xs mb-2 bg-muted rounded-lg px-2 py-2 border border-input text-foreground"
                      value={compareIdx[slot]}
                      onChange={e => { const i = [...compareIdx] as [number, number]; i[slot] = Number(e.target.value); setCompareIdx(i); }}>
                      {photos.map((p, i) => (
                        <option key={i} value={i}>{new Date(p.date + "T12:00:00").toLocaleDateString("pt-BR")}</option>
                      ))}
                    </select>
                    <img src={photos[compareIdx[slot]]?.url} alt="Body" className="w-full aspect-[3/4] object-cover rounded-xl" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FOTOS DE PROGRESSO ── */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <div className="bg-green-200 dark:bg-green-900/40 px-5 py-4 flex items-center justify-between">
          <h3 className="text-base font-black uppercase tracking-wide text-foreground">Fotos de Progresso</h3>
          <span className="text-3xl">📷</span>
        </div>
        <div className="p-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {photos.slice(-8).map((p, i) => (
              <div key={i} className="relative flex-shrink-0 w-20 h-28 rounded-xl overflow-hidden group">
                <img src={p.url} alt="Progress" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                  <span className="text-[8px] text-white">{new Date(p.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                </div>
                <button onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex-shrink-0 w-20 h-28 rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 hover:border-primary/50 transition-colors">
              {uploading ? <span className="text-[10px] text-muted-foreground">Enviando...</span> : (
                <><Camera className="w-5 h-5 text-muted-foreground" /><span className="text-[9px] text-muted-foreground">Adicionar</span></>
              )}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadPhoto(e.target.files[0]); }} />
        </div>
      </div>

      {/* ── PROGRESSO DE MEDIDAS ── */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <div className="bg-pink-300 dark:bg-pink-900/40 px-5 py-4 flex items-center justify-between">
          <h3 className="text-base font-black uppercase tracking-wide text-foreground">Progresso de Medidas</h3>
          <span className="text-3xl">📏</span>
        </div>

        <div className="p-4">
          <button onClick={() => setShowForm(!showForm)}
            className="w-full py-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary text-xs font-bold transition-colors flex items-center justify-center gap-2 mb-3">
            <Plus className="w-3.5 h-3.5" /> {showForm ? "Cancelar" : "Registrar Medidas"}
          </button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-4 mb-3">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-muted">
                <Input type="date" value={newM.date} onChange={e => setNewM({ ...newM, date: e.target.value })} className="col-span-2 text-xs h-9" />
                {fields.map(f => (
                  <div key={f.key} className="relative">
                    <Input value={newM[f.key]} onChange={e => setNewM({ ...newM, [f.key]: e.target.value })} placeholder={f.label} className="text-xs h-9 pr-8" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{f.unit}</span>
                  </div>
                ))}
                <button onClick={saveMeasurement}
                  className="col-span-2 py-2.5 rounded-xl bg-[hsl(var(--saude-green)/0.12)] text-[hsl(var(--saude-green))] text-xs font-bold hover:bg-[hsl(var(--saude-green)/0.2)] transition-colors">
                  Salvar Medidas
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {sorted.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-pink-200/60 dark:bg-pink-900/20">
                  <th className="text-left px-3 py-2.5 font-bold text-foreground uppercase tracking-wider">.</th>
                  {sorted.slice(0, 4).map((m, i) => (
                    <th key={i} className="text-center px-2 py-2.5 font-bold text-foreground">
                      {new Date(m.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </th>
                  ))}
                  <th className="px-1 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {fields.map((f, fi) => (
                  <tr key={f.key} className={`${fi % 2 === 0 ? "bg-pink-50/50 dark:bg-pink-950/10" : ""} border-t border-border/30`}>
                    <td className="px-3 py-2.5 font-bold text-foreground uppercase">{f.label}</td>
                    {sorted.slice(0, 4).map((m, i) => (
                      <td key={i} className="text-center px-2 py-2.5 text-muted-foreground">
                        {m[f.key] ? `${m[f.key]}${f.unit === "%" ? "%" : f.unit === "kg" ? "kg" : " cm"}` : "—"}
                      </td>
                    ))}
                    <td className="px-1 py-2.5" />
                  </tr>
                ))}
              </tbody>
            </table>
            {sorted.length > 0 && (
              <div className="px-3 py-2 flex justify-end">
                {sorted.slice(0, 4).map((m, i) => (
                  <button key={i} onClick={() => setMeasurements(prev => prev.filter(x => x.date !== m.date))}
                    className="mx-1">
                    <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="px-4 pb-4 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma medida registrada</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Clique em "Registrar Medidas" para começar</p>
          </div>
        )}
      </div>

      {/* ── SENTIMENT CARDS ── */}
      <div className="space-y-4">
        {sentiments.map(s => {
          const isActive = todaySentiment?.sentiment === s.id;
          return (
            <div key={s.id} className="rounded-2xl border border-border overflow-hidden bg-card">
              {/* Colored header band with emoji */}
              <button
                onClick={() => setSentimentLog(prev => ({
                  ...prev,
                  [today]: { sentiment: s.id, note: prev[today]?.note || "", items: prev[today]?.items || [] }
                }))}
                className={`w-full px-5 py-4 flex items-center justify-between transition-all ${s.headerBg} ${isActive ? "ring-2 ring-primary/30" : ""}`}
              >
                <h3 className={`text-sm font-black uppercase tracking-wide ${s.headerText || "text-foreground"}`}>{s.label}</h3>
                <span className="text-3xl">{s.emoji}</span>
              </button>

              {/* Body - show when active */}
              {isActive && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="p-4 space-y-3"
                >
                  {s.id === "descontente" && (
                    <>
                      {sentimentItems.map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-sm text-foreground">{item}</span>
                          <button onClick={() => {
                            const updated = sentimentItems.filter((_, j) => j !== i);
                            setSentimentItems(updated);
                            setSentimentLog(prev => ({ ...prev, [today]: { ...prev[today], items: updated } }));
                          }} className="ml-auto">
                            <Trash2 className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Input value={newSentimentItem} onChange={e => setNewSentimentItem(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && addSentimentItem()}
                          placeholder="O que te incomoda?" className="text-xs h-9" />
                        <button onClick={addSentimentItem} className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                          <Plus className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                    </>
                  )}

                  {s.id === "contente" && (
                    <Textarea
                      value={sentimentNote}
                      onChange={e => {
                        setSentimentNote(e.target.value);
                        setSentimentLog(prev => ({ ...prev, [today]: { ...prev[today], note: e.target.value } }));
                      }}
                      placeholder="I feel lighter."
                      className="text-sm min-h-[80px] border-0 bg-transparent resize-none focus-visible:ring-0 p-0 text-muted-foreground placeholder:text-muted-foreground/50"
                    />
                  )}

                  {s.id === "desafio" && (
                    <Textarea
                      value={sentimentNote}
                      onChange={e => {
                        setSentimentNote(e.target.value);
                        setSentimentLog(prev => ({ ...prev, [today]: { ...prev[today], note: e.target.value } }));
                      }}
                      placeholder="Ficar até o Natal sem doce!"
                      className="text-sm min-h-[80px] border-0 bg-transparent resize-none focus-visible:ring-0 p-0 text-foreground placeholder:text-muted-foreground/50"
                    />
                  )}
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
