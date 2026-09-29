/**
 * DIÁRIO DO PET (visual novo em 29/09; dados como sempre).
 *
 * `pet-diary` intocado: [{ id, petName, date (ISO completo), text, mood,
 * photoUrl? }] — o diário guarda o NOME do pet (renomear na ficha leva os
 * momentos junto). As insígnias "Registros do pet no mês" e "Diário do Pet"
 * leem esta chave. O que mudou: os momentos viram páginas com a foto grande
 * e a data em caixa alta; escrever e editar abrem uma folha (campos de 44 px).
 */
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { Textarea } from "@/components/ui/textarea";
import { PhotoPicker } from "@/components/ui/PhotoPicker";
import { ptBR } from "date-fns/locale";
import { dataSegura } from "@/lib/utils";
import { avisarApagado } from "@/lib/desfazer";
import { petsValidos } from "@/lib/pet";
import { BotaoPet, CartaoPet, Chip, FolhaPet, RotuloCampo } from "./kit";

interface DiaryEntry {
  id: string;
  petName: string;
  date: string;
  text: string;
  mood: string;
  photoUrl?: string;
}

const HUMORES: { emoji: string; rotulo: string }[] = [
  { emoji: "😍", rotulo: "apaixonante" },
  { emoji: "😊", rotulo: "feliz" },
  { emoji: "😴", rotulo: "sonolento" },
  { emoji: "🤒", rotulo: "doentinho" },
  { emoji: "😈", rotulo: "arteiro" },
  { emoji: "🥺", rotulo: "carente" },
];

export const PetDiary = () => {
  const { get, set } = useUserData();
  const pets = petsValidos(get<unknown>("pet-list", []));
  const brutos = get<unknown>("pet-diary", []);
  const entries = useMemo(
    () => (Array.isArray(brutos) ? brutos : [])
      .filter((e): e is DiaryEntry => !!e && typeof e === "object" && typeof (e as DiaryEntry).id === "string" && typeof (e as DiaryEntry).text === "string")
      .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [brutos],
  );
  const [form, setForm] = useState<null | { id?: string; petName: string; text: string; mood: string; photoUrl?: string }>(null);

  const abrirNovo = () => setForm({ petName: pets.length === 1 ? pets[0].name : "", text: "", mood: "😊" });
  const abrirEdicao = (e: DiaryEntry) => setForm({ id: e.id, petName: e.petName || "", text: e.text, mood: e.mood || "😊", photoUrl: e.photoUrl });

  const salvar = () => {
    if (!form || !form.text.trim()) return;
    const atual = Array.isArray(get<unknown>("pet-diary", [])) ? (get<unknown>("pet-diary", []) as DiaryEntry[]) : [];
    if (form.id) {
      // id e `date` intocados: a data é o registro do momento, não da edição
      set("pet-diary", atual.map((e) => (e?.id !== form.id ? e : { ...e, petName: form.petName.trim(), text: form.text.trim(), mood: form.mood, photoUrl: form.photoUrl?.trim() || undefined })));
    } else {
      set("pet-diary", [
        { id: Date.now().toString(), petName: form.petName.trim(), date: new Date().toISOString(), text: form.text.trim(), mood: form.mood, photoUrl: form.photoUrl?.trim() || undefined },
        ...atual,
      ]);
    }
    setForm(null);
  };

  const apagar = (e: DiaryEntry) => {
    const atual = get<unknown>("pet-diary", []) as DiaryEntry[];
    set("pet-diary", atual.filter((x) => x?.id !== e.id));
    avisarApagado("Momento apagado", () => set("pet-diary", [e, ...(get<unknown>("pet-diary", []) as DiaryEntry[])]));
  };

  // nomes pra escolher: os pets de hoje + o nome já gravado (pet apagado ou renomeado em outro aparelho)
  const nomes = Array.from(new Set([...pets.map((p) => p.name), ...(form?.petName ? [form.petName] : [])]));

  return (
    <div className="space-y-3">
      <CartaoPet titulo="Diário" direita={<span className="tabular-nums">{entries.length || ""}</span>} dataCard="DIARIO">
        <div className="p-2">
          <BotaoPet onClick={abrirNovo} className="w-full" data-testid="momento-novo"><Plus className="w-4 h-4" aria-hidden="true" /> Registrar um momento</BotaoPet>
        </div>
        {entries.length === 0 && (
          <p className="px-3.5 pb-3.5 text-[13px] text-muted-foreground">A primeira vez que subiu no sofá, o passeio no parque, o dia que ficou doentinho. Com foto, fica pra sempre.</p>
        )}
      </CartaoPet>

      {entries.map((e) => (
        <article key={e.id} className="rounded-xl border border-border bg-card overflow-hidden" data-testid="momento">
          {e.photoUrl && <img src={e.photoUrl} alt={`Foto de ${e.petName || "pet"}`} className="w-full max-h-[260px] object-cover" />}
          <div className="px-3.5 pt-3 pb-1">
            <div className="flex items-center gap-2">
              <span className="text-[20px] leading-none" aria-hidden="true">{e.mood}</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{dataSegura(e.date, "EEE dd/MM · HH:mm", { locale: ptBR }).replace(".", "")}</span>
              {e.petName && <span className="ml-auto text-[12px] font-bold text-foreground truncate max-w-[40%]">{e.petName}</span>}
            </div>
            <p className="mt-2 text-[14.5px] leading-relaxed text-foreground whitespace-pre-wrap">{e.text}</p>
          </div>
          <div className="flex justify-end px-1 pb-1">
            <button type="button" onClick={() => abrirEdicao(e)} aria-label={`Editar momento de ${e.petName || "meu pet"}`} className="w-11 h-11 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" aria-hidden="true" /></button>
            <button type="button" onClick={() => apagar(e)} aria-label={`Apagar momento de ${e.petName || "meu pet"}`} className="w-11 h-11 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
          </div>
        </article>
      ))}

      <FolhaPet aberta={!!form} onFechar={() => setForm(null)} titulo={form?.id ? "Editar momento" : "Novo momento"} testId="folha-momento">
        {form && (
          <div className="space-y-3">
            {nomes.length > 0 && (
              <div>
                <RotuloCampo>De quem</RotuloCampo>
                <div className="flex flex-wrap gap-1.5">
                  {nomes.map((n) => <Chip key={n} ativo={form.petName === n} onClick={() => setForm({ ...form, petName: form.petName === n ? "" : n })}>{n}</Chip>)}
                </div>
              </div>
            )}
            <div>
              <RotuloCampo>Como estava</RotuloCampo>
              <div className="flex gap-1.5">
                {HUMORES.map((h) => (
                  <button
                    key={h.emoji}
                    type="button"
                    aria-pressed={form.mood === h.emoji}
                    aria-label={h.rotulo}
                    onClick={() => setForm({ ...form, mood: h.emoji })}
                    className={`flex-1 h-11 rounded-lg border text-[20px] ${form.mood === h.emoji ? "border-foreground bg-muted" : "border-border bg-card"}`}
                  >
                    {h.emoji}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <RotuloCampo htmlFor="momento-texto">O que aconteceu</RotuloCampo>
              <Textarea id="momento-texto" value={form.text} onChange={(ev) => setForm({ ...form, text: ev.target.value })} rows={3} placeholder="O que aconteceu hoje?" className="text-[14px] min-h-[88px]" data-testid="momento-texto" />
            </div>
            <PhotoPicker value={form.photoUrl} onChange={(url) => setForm({ ...form, photoUrl: url })} onClear={() => setForm({ ...form, photoUrl: undefined })} label={form.photoUrl ? "Trocar a foto" : "Pôr uma foto"} previewSize="md" className="min-h-[44px] text-[13px]" />
            <BotaoPet className="w-full" onClick={salvar} disabled={!form.text.trim()} data-testid="momento-salvar">{form.id ? "Salvar" : "Guardar o momento"}</BotaoPet>
          </div>
        )}
      </FolhaPet>
    </div>
  );
};
