import { useState, useRef } from "react";
import { localDayKey } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { avisarApagado } from "@/lib/desfazer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Camera, ImagePlus, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useChaveDaBeleza, emDemonstracao } from "./estado-compartilhado";
import { inserirEm } from "./utils";
import { CartaoBeleza, Chip, FaixaBeleza } from "./kit";

const genId = () => crypto.randomUUID();
const getDateKey = () => localDayKey();

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
  const [entries, setEntries] = useChaveDaBeleza<DiaryEntry[]>("skincare-diary", []);
  /* "Pele hoje" do formulário É o "Como está sua pele hoje?" do Espelho do
     dia, que fica logo acima (26/09, varredura: os dois perguntavam a mesma
     coisa e cada um guardava a sua resposta). Escolher aqui marca lá e
     vice-versa; o registro salvo leva a mesma resposta. Mesmos ids nos dois
     (seca/oleosa/acne/boa/sensivel), nenhum formato muda. */
  const [checkins, setCheckins] = useChaveDaBeleza<Record<string, string>>("skincare-daily-checkin", {});
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ notes: "", skinStatus: "boa", mood: "😊", photoUrl: "" });
  const [compareMode, setCompareMode] = useState(false);
  const [compareEntries, setCompareEntries] = useState<[DiaryEntry | null, DiaryEntry | null]>([null, null]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const today = getDateKey();
  const todayEntry = entries.find(e => e.date === today);
  const peleHoje = typeof checkins[today] === "string" ? checkins[today] : "";
  const peleEscolhida = peleHoje || form.skinStatus;

  const escolherPele = (id: string) => {
    setForm(p => ({ ...p, skinStatus: id }));
    setCheckins(prev => ({ ...prev, [today]: id }));
  };

  // Na demonstração não há conta, então a foto não tem pra onde subir: o
  // botão abria a galeria e nada acontecia (26/09, varredura). Avisa em vez
  // de abrir; no app logado segue igual.
  const abrirGaleria = () => {
    if (emDemonstracao()) {
      toast("Na demonstração a foto não fica salva. Depois de criar sua conta, ela vai pro seu diário.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) {
      // sem conta a foto sumia calada; agora a pessoa sabe o porquê
      toast.error("Pra salvar foto, entre na sua conta.");
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${genId()}.${ext}`;
      const { error } = await supabase.storage.from("skin-photos").upload(path, file, { upsert: true });
      if (error) throw error;
      // Bucket é privado: getPublicUrl devolvia link que não abre (foto subia
      // e ficava quebrada). URL assinada de 1 ano, igual ao image-upload.ts.
      const { data: signed } = await supabase.storage
        .from("skin-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (!signed?.signedUrl) throw new Error("não foi possível gerar o link da foto");
      setForm(prev => ({ ...prev, photoUrl: signed.signedUrl }));
      toast.success("Foto carregada!");
    } catch (err: any) {
      toast.error("Erro ao carregar foto: " + err.message);
    } finally {
      setUploading(false);
      e.target.value = ""; // deixa escolher a mesma foto de novo se falhou
    }
  };

  const save = () => {
    if (!form.photoUrl && !form.notes) { toast.error("Adicione uma foto ou observação"); return; }
    setEntries(prev => [{ id: genId(), date: today, ...form, skinStatus: peleEscolhida }, ...prev]);
    // registrou sem mexer na pele (ficou o padrão): o Espelho passa a mostrar
    // a mesma resposta do registro
    if (!peleHoje) setCheckins(prev => ({ ...prev, [today]: peleEscolhida }));
    setForm({ notes: "", skinStatus: "boa", mood: "😊", photoUrl: "" });
    setShowForm(false);
  };

  // Apaga já e oferece Desfazer (26/09, varredura): o registro pode ter foto
  // e sumia num toque, sem volta.
  const deleteEntry = (id: string) => {
    const idx = entries.findIndex(x => x.id === id);
    const entrada = entries[idx];
    if (!entrada) return;
    setEntries(prev => prev.filter(x => x.id !== id));
    avisarApagado("Registro do diário apagado", () =>
      setEntries(prev => (prev.some(x => x.id === id) ? prev : inserirEm(prev, idx, entrada))));
  };

  const toggleCompare = (entry: DiaryEntry) => {
    if (compareEntries[0]?.id === entry.id) setCompareEntries([null, compareEntries[1]]);
    else if (compareEntries[1]?.id === entry.id) setCompareEntries([compareEntries[0], null]);
    else if (!compareEntries[0]) setCompareEntries([entry, compareEntries[1]]);
    else if (!compareEntries[1]) setCompareEntries([compareEntries[0], entry]);
  };

  const photosEntries = entries.filter(e => e.photoUrl);

  /* FOTOS DA PELE (28/09, dono): a aba DIÁRIO deu lugar a CUIDADOS e o diário virou
     esta seção no fim de SKINCARE — mesma tela, mesma chave (`skincare-diary`),
     nada some pra quem já tem foto. Um cartão só: faixa, contagem, comparar,
     o formulário e a lista. */
  return (
    <CartaoBeleza className="scroll-mt-28" id="fotos-da-pele" data-testid="fotos-da-pele">
      <FaixaBeleza
        icone={<Camera className="w-4 h-4 text-bz-acento" />}
        titulo="FOTOS DA PELE"
        direita={
          photosEntries.length >= 2 ? (
            <button onClick={() => setCompareMode(!compareMode)}
              className={cn("h-10 px-3.5 rounded-full text-[12px] font-bold inline-flex items-center gap-1.5", compareMode ? "bg-bz-acento text-bz-acento-tinta" : "bg-bz-cartao/70 text-bz-rose-tinta")}>
              <ArrowLeftRight className="w-3.5 h-3.5" /> Comparar
            </button>
          ) : undefined
        }
      />
      <div className="px-4 py-2 border-t border-bz-linha flex items-center justify-between gap-2">
        <p className="text-[12px] text-bz-suave">{entries.length} registros • {photosEntries.length} fotos</p>
        {todayEntry && <Chip tom="ok">✅ Registro de hoje feito</Chip>}
      </div>

      {/* Compare mode */}
      {compareMode && (
        <div className="border-t border-bz-linha">
          <div className="bg-bz-blush px-4 py-2">
            <span className="text-[11.5px] font-bold text-bz-suave">📸 Selecione 2 fotos para comparar</span>
          </div>
          <div className="p-3 grid grid-cols-2 gap-3">
            {[0, 1].map(i => (
              <div key={i} className="aspect-square rounded-2xl border-2 border-dashed border-bz-linha-forte flex items-center justify-center overflow-hidden">
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
                  <p className="text-[11px] text-bz-suave">Foto {i + 1}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="border-t border-bz-linha bg-bz-cartao p-4 space-y-3" data-testid="form-diario">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          {form.photoUrl ? (
            <div className="relative">
              <img src={form.photoUrl} alt="" className="w-full h-48 object-cover rounded-xl" />
              <button onClick={() => setForm(p => ({ ...p, photoUrl: "" }))} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button onClick={abrirGaleria} disabled={uploading}
              className="w-full h-32 rounded-2xl border-2 border-dashed border-bz-linha-forte bg-bz-papel flex flex-col items-center justify-center gap-2 text-bz-suave hover:border-bz-acento/50 hover:text-bz-acento transition-colors">
              {uploading ? <p className="text-xs">Carregando...</p> : (
                <><ImagePlus className="w-6 h-6" /><p className="text-xs font-medium">Tirar foto ou escolher da galeria</p></>
              )}
            </button>
          )}
          <div>
            <p className="text-[12.5px] font-semibold mb-1.5 text-bz-tinta">Pele hoje</p>
            <div className="flex gap-1.5 flex-wrap">
              {skinStatuses.map(s => (
                <button key={s.id} onClick={() => escolherPele(s.id)}
                  className={cn("h-9 px-3 rounded-full text-[11.5px] font-semibold border transition-all",
                    peleEscolhida === s.id ? "bg-bz-rose border-bz-acento/45 text-bz-rose-tinta" : "bg-bz-cartao border-bz-linha-forte text-bz-suave",
                  )}>
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[12.5px] font-semibold mb-1.5 text-bz-tinta">Humor</p>
            <div className="flex gap-2">
              {moods.map(m => (
                <button key={m} onClick={() => setForm(p => ({ ...p, mood: m }))}
                  className={cn("w-11 h-11 grid place-items-center text-xl rounded-full border transition-all",
                    form.mood === m ? "border-bz-acento/50 bg-bz-rose scale-105" : "border-transparent bg-bz-blush/60",
                  )}>{m}</button>
              ))}
            </div>
          </div>
          <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Observações (irritações, melhorias, produtos usados...)" className="text-[13px] min-h-[64px] rounded-xl bg-bz-cartao border-bz-linha-forte" />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-10 rounded-full font-bold" onClick={save}>Salvar Registro</Button>
            <Button size="sm" variant="ghost" className="h-10 rounded-full text-bz-suave" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Timeline — always-visible Notion-style table */}
      <div className="border-t border-bz-linha">
        <div className="bg-bz-blush px-3.5 py-2 grid grid-cols-12 gap-1 text-[10px] font-extrabold text-bz-suave uppercase tracking-[.12em]">
          <span className="col-span-2">Foto</span>
          <span className="col-span-3">Data</span>
          <span className="col-span-3">Pele</span>
          <span className="col-span-3">Notas</span>
          <span className="col-span-1"></span>
        </div>
        <div className="divide-y divide-bz-linha">
          {entries.slice(0, 30).map(e => {
            const isSelected = compareEntries[0]?.id === e.id || compareEntries[1]?.id === e.id;
            return (
              <div key={e.id}
                className={cn("px-3.5 py-2 min-h-[52px] grid grid-cols-12 gap-1 items-center transition-all group",
                  compareMode && e.photoUrl && "cursor-pointer hover:bg-bz-blush/50",
                  isSelected && "bg-bz-dica",
                )}
                onClick={() => compareMode && e.photoUrl && toggleCompare(e)}>
                <div className="col-span-2">
                  {e.photoUrl ? (
                    <img src={e.photoUrl} alt="" className="w-10 h-10 rounded-xl object-cover" />
                  ) : (
                    <span className="text-xl">{skinStatuses.find(s => s.id === e.skinStatus)?.emoji || "✨"}</span>
                  )}
                </div>
                <div className="col-span-3">
                  <span className="text-[12.5px] font-semibold text-bz-tinta">
                    {new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                  <span className="text-sm ml-1">{e.mood}</span>
                </div>
                <div className="col-span-3">
                  {/* rótulo com acento ("Sensível"); o valor gravado segue "sensivel" */}
                  <span className="inline-flex text-[10.5px] px-2 py-0.5 rounded-full bg-bz-blush text-bz-suave font-semibold">
                    {skinStatuses.find(s => s.id === e.skinStatus)?.emoji} {skinStatuses.find(s => s.id === e.skinStatus)?.label ?? e.skinStatus}
                  </span>
                </div>
                <div className="col-span-3">
                  {e.notes && <p className="text-[11.5px] text-bz-suave line-clamp-1">{e.notes}</p>}
                </div>
                <div className="col-span-1 flex justify-end">
                  {!compareMode && (
                    <button onClick={() => deleteEntry(e.id)} aria-label="Apagar registro" className="text-bz-suave hover:text-bz-alerta-tinta opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {entries.length === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-[12.5px] text-bz-suave italic">Nenhum registro ainda — registre sua primeira foto!</p>
            </div>
          )}

          {/* Inline action row */}
          {!todayEntry && !showForm && (
            <div className="px-3.5 py-3 bg-bz-papel flex items-center justify-center">
              <button
                onClick={() => setShowForm(true)}
                className="h-10 px-4 rounded-full bg-bz-acento text-bz-acento-tinta inline-flex items-center gap-1.5 text-[13px] font-bold active:scale-95 transition"
              >
                <Plus className="w-4 h-4" /> Registrar Hoje
              </button>
            </div>
          )}
        </div>
      </div>
    </CartaoBeleza>
  );
};
