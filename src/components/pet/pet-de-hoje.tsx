/**
 * PET DE HOJE (29/09) — a lista do dia do bicho: a rotina (comida, passeio,
 * água, areia…) e as doses dos remédios com horário. Quadradinho marca em
 * `pet-routine-<dia>` (a chave de sempre — o app antigo e as insígnias de
 * passeio continuam lendo igual). É a mesma peça do widget da Home.
 */
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { parseLocalDay } from "@/lib/utils";
import { rotaDeHoje } from "@/lib/pet-hoje";
import { novoId, type Pet, type TarefaDaRotina } from "@/lib/pet";
import { BotaoPet, CartaoPet, FolhaPet, Quadradinho, campoClasse } from "./kit";
import type { UsePet } from "./use-pet";

const DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
export const tituloDoDia = (hoje: string) => {
  const d = parseLocalDay(hoje);
  return `Hoje · ${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const EMOJIS = ["🥣", "💧", "🦮", "🎾", "🧶", "🧹", "🪮", "🦷", "🛁", "💊", "🐾", "🏃", "🧸", "🌿"];

export const PetDeHoje = ({ pet, dados, onRemedio }: { pet: Pet; dados: UsePet; onRemedio: () => void }) => {
  const { hoje, rotinaHoje, cuidadosBrutos, get, marcar } = dados;
  const itens = useMemo(
    () => rotaDeHoje(pet, get<unknown>(`pet-routine-tasks-${pet.id}`, null), cuidadosBrutos, rotinaHoje, hoje),
    [pet, get, cuidadosBrutos, rotinaHoje, hoje],
  );
  const feitos = itens.filter((i) => i.feito).length;
  const [editando, setEditando] = useState(false);
  const tudo = itens.length > 0 && feitos === itens.length;

  return (
    <>
      <CartaoPet titulo={tituloDoDia(hoje)} direita={<span className="tabular-nums" data-testid="pet-hoje-contagem">{feitos} de {itens.length}</span>} dataCard="PET DE HOJE">
        <ul>
          {itens.map((i, idx) => (
            <li key={i.id} className={`flex items-center gap-1 pl-1.5 pr-3.5 min-h-[52px] ${idx ? "border-t border-border" : ""}`}>
              <Quadradinho marcado={i.feito} onClick={() => marcar(pet.id, i.id, !i.feito)} rotulo={`${i.feito ? "Desmarcar" : "Marcar"} ${i.label}`} />
              <span className="text-[17px] w-6 text-center shrink-0" aria-hidden="true">{i.emoji}</span>
              <span className={`flex-1 min-w-0 text-[14px] leading-snug ${i.feito ? "text-muted-foreground line-through decoration-muted-foreground/60" : "text-foreground"}`}>{i.label}</span>
              {i.hora && <span className="text-[12px] tabular-nums text-muted-foreground shrink-0">{i.hora}</span>}
            </li>
          ))}
        </ul>
        {tudo && (
          <p className="px-3.5 py-2.5 border-t border-border text-[12.5px] font-semibold text-[hsl(var(--pet-ok))]" data-testid="pet-hoje-completo">
            Tudo feito hoje. {pet.name} agradece 🐾
          </p>
        )}
        <div className="flex border-t border-border">
          <button type="button" onClick={() => setEditando(true)} className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50">
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Editar rotina
          </button>
          <span className="w-px bg-border" aria-hidden="true" />
          <button type="button" onClick={onRemedio} className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50">
            <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Remédio com horário
          </button>
        </div>
      </CartaoPet>
      <EditarRotina aberta={editando} onFechar={() => setEditando(false)} pet={pet} dados={dados} />
    </>
  );
};

/** Folha pra montar a rotina: renomear, trocar o emoji, pôr hora, tirar e acrescentar. */
const EditarRotina = ({ aberta, onFechar, pet, dados }: { aberta: boolean; onFechar: () => void; pet: Pet; dados: UsePet }) => {
  const { get, salvarTarefas } = dados;
  const atuais = useMemo(() => rotaDeHoje(pet, get<unknown>(`pet-routine-tasks-${pet.id}`, null), [], {}, "").map((i) => ({ id: i.id, label: i.label, emoji: i.emoji, hora: i.hora })), [pet, get]);
  const [lista, setLista] = useState<TarefaDaRotina[]>(atuais);
  const [novo, setNovo] = useState("");
  const [emojiNovo, setEmojiNovo] = useState("🐾");
  // abriu a folha: começa do que está gravado (fechar sem salvar descarta o rascunho)
  useEffect(() => { if (aberta) { setLista(atuais); setNovo(""); } }, [aberta]); // eslint-disable-line react-hooks/exhaustive-deps

  const trocar = (id: string, mudanca: Partial<TarefaDaRotina>) => setLista((l) => l.map((t) => (t.id === id ? { ...t, ...mudanca } : t)));
  const salvar = () => {
    const limpa = lista.map((t) => ({ ...t, label: t.label.trim() })).filter((t) => t.label);
    salvarTarefas(pet.id, limpa.map((t) => (t.hora ? t : { id: t.id, label: t.label, emoji: t.emoji })));
    onFechar();
  };
  const acrescentar = () => {
    const label = novo.trim();
    if (!label) return;
    setLista((l) => [...l, { id: novoId("t"), label, emoji: emojiNovo }]);
    setNovo("");
  };

  return (
    <FolhaPet aberta={aberta} onFechar={onFechar} titulo={`Rotina de ${pet.name}`} sub="O que se repete todo dia. Banho e vacina ficam na carteirinha, com data." testId="folha-rotina">
      <ul className="rounded-xl border border-border bg-card overflow-hidden">
        {lista.map((t, idx) => (
          <li key={t.id} className={`flex items-center gap-2 px-2 py-2 ${idx ? "border-t border-border" : ""}`}>
            <select
              aria-label={`Emoji de ${t.label}`}
              value={t.emoji}
              onChange={(e) => trocar(t.id, { emoji: e.target.value })}
              className="h-11 w-12 shrink-0 rounded-lg border border-input bg-card text-center text-[17px] appearance-none"
            >
              {[...new Set([t.emoji, ...EMOJIS])].map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <input aria-label="Nome da tarefa" value={t.label} onChange={(e) => trocar(t.id, { label: e.target.value })} className={`${campoClasse} flex-1 min-w-0`} />
            <input aria-label={`Horário de ${t.label}`} type="time" value={t.hora ?? ""} onChange={(e) => trocar(t.id, { hora: e.target.value || undefined })} className={`${campoClasse} w-[92px] shrink-0 px-2 tabular-nums`} />
            <button type="button" onClick={() => setLista((l) => l.filter((x) => x.id !== t.id))} aria-label={`Tirar ${t.label}`} className="w-11 h-11 shrink-0 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive">
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <select aria-label="Emoji da nova tarefa" value={emojiNovo} onChange={(e) => setEmojiNovo(e.target.value)} className="h-11 w-12 shrink-0 rounded-lg border border-input bg-card text-center text-[17px] appearance-none">
          {EMOJIS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <input placeholder="Nova tarefa (ex.: escovar os dentes)" value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && acrescentar()} className={`${campoClasse} flex-1 min-w-0`} />
        <BotaoPet variante="secundario" onClick={acrescentar} aria-label="Acrescentar tarefa" className="w-11 px-0 shrink-0"><Plus className="w-4 h-4" aria-hidden="true" /></BotaoPet>
      </div>
      <div className="mt-4 flex gap-2">
        <BotaoPet onClick={salvar} className="flex-1">Salvar rotina</BotaoPet>
        <BotaoPet variante="secundario" onClick={onFechar} aria-label="Cancelar"><X className="w-4 h-4" aria-hidden="true" /></BotaoPet>
      </div>
    </FolhaPet>
  );
};
