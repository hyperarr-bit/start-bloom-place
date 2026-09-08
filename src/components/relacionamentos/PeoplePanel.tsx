import { useState } from "react";
import { Trash2, Heart, Plus, Pencil, Check, X } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { CampoData } from "@/components/ui/campo-data";
import { differenceInDays, format, setYear } from "date-fns";
import { parseLocalDay } from "@/lib/utils";

interface Person {
  id: string;
  name: string;
  relation: string;
  birthday: string;
  /** Livre: saúde, alergias, o que gosta, último encontro. Pessoa cadastrada
   *  antes de 07/09 pode não ter o campo — por isso opcional. */
  notes?: string;
}

/**
 * Aniversário como DATA LOCAL (07/09, avaliação da Play: "a data de
 * nascimento é difícil de colocar e está colocando sempre um dia anterior").
 *
 * O campo grava "YYYY-MM-DD" e a tela fazia `new Date("1990-05-10")`, que o
 * JS lê como MEIA-NOITE UTC — no Brasil (UTC-3) isso é 21h do dia 9. Todo
 * aniversário nascia um dia antes, e a contagem de dias junto. É a mesma
 * família do bug do diário da Dieta (18/07); a cura é a mesma: parseLocalDay.
 */
const dataDoAniversario = (bday: string) => parseLocalDay(bday);

export const PeoplePanel = () => {
  const { get, set } = useUserData();
  const people = get<Person[]>("rel-people", []);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [birthday, setBirthday] = useState("");
  const [notes, setNotes] = useState("");

  const addPerson = () => {
    if (!name.trim()) return;
    const updated = [...people, { id: Date.now().toString(), name: name.trim(), relation: relation.trim(), birthday, notes: notes.trim() }];
    set("rel-people", updated);
    setName(""); setRelation(""); setBirthday(""); setNotes("");
  };

  const removePerson = (id: string) => {
    set("rel-people", people.filter(p => p.id !== id));
  };

  /* Edição na própria linha, mesmo padrão do PetList (07/09, avaliação da
     Play: "na aba social não temos como editar informações das pessoas").
     Até aqui o único jeito de corrigir uma data errada era apagar a pessoa
     e cadastrar de novo — e a lixeira nem aparecia no celular (só no hover).
     Editar preserva o id, que é o que o resto do módulo aponta. */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState({ name: "", relation: "", birthday: "", notes: "" });

  const comecarEdicao = (p: Person) => {
    setEditandoId(p.id);
    setRascunho({ name: p.name, relation: p.relation || "", birthday: p.birthday || "", notes: p.notes || "" });
  };

  const salvarEdicao = () => {
    const nome = rascunho.name.trim();
    if (!nome) return;
    set("rel-people", people.map(p => p.id !== editandoId ? p : {
      ...p, // preserva o id e qualquer campo que apareça no futuro
      name: nome,
      relation: rascunho.relation.trim(),
      birthday: rascunho.birthday,
      notes: rascunho.notes.trim(),
    }));
    setEditandoId(null);
  };

  const getDaysUntilBirthday = (bday: string) => {
    if (!bday) return null;
    // Meia-noite de hoje: comparar com a hora atual fazia o aniversário DE
    // HOJE cair em "já passou" e pular pro ano que vem — o "Hoje!" nunca acendia.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bd = dataDoAniversario(bday);
    let next = setYear(bd, today.getFullYear());
    if (next < today) next = setYear(bd, today.getFullYear() + 1);
    return differenceInDays(next, today);
  };

  const sorted = [...people].sort((a, b) => {
    const da = getDaysUntilBirthday(a.birthday);
    const db = getDaysUntilBirthday(b.birthday);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });

  return (
    <div className="mt-3">
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="bg-rose-200 dark:bg-rose-900/60 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-3.5 h-3.5 text-rose-700 dark:text-rose-300" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-200">Pessoas</span>
          </div>
          <span className="text-[10px] text-rose-600 dark:text-rose-300">{people.length}</span>
        </div>

        {/* Body */}
        <div className="bg-rose-50/50 dark:bg-rose-950/20 p-2 space-y-1.5">
          {/* Cabeçalho só onde a linha é mesmo uma tabela (≥640px) — no
              celular a linha vira duas e um cabeçalho de 4 colunas não
              alinha com nada. Mesma decisão do Treino (30/07). */}
          <div className="hidden sm:grid grid-cols-12 gap-1 px-2 py-1">
            <span className="col-span-4 text-[9px] font-bold uppercase text-muted-foreground">Nome</span>
            <span className="col-span-3 text-[9px] font-bold uppercase text-muted-foreground">Relação</span>
            <span className="col-span-3 text-[9px] font-bold uppercase text-muted-foreground">Aniversário</span>
            <span className="col-span-2 text-[9px] font-bold uppercase text-muted-foreground text-right">Dias</span>
          </div>

          {/* Existing items */}
          {sorted.map(p => {
            const days = getDaysUntilBirthday(p.birthday);

            if (editandoId === p.id) {
              return (
                <div key={p.id} className="border border-primary/40 bg-background/70 rounded-lg p-2 space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <Input aria-label="Nome" placeholder="Nome" value={rascunho.name} onChange={e => setRascunho(r => ({ ...r, name: e.target.value }))} className="h-7 text-[11px]" />
                    <Input aria-label="Relação" placeholder="Relação" value={rascunho.relation} onChange={e => setRascunho(r => ({ ...r, relation: e.target.value }))} className="h-7 text-[11px]" />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <CampoData aria-label="Aniversário" rotulo="Aniversário" value={rascunho.birthday} onChange={e => setRascunho(r => ({ ...r, birthday: e.target.value }))} className="h-7 text-[11px]" />
                    <Input aria-label="Notas" placeholder="Notas (saúde, alergias, o que gosta…)" value={rascunho.notes} onChange={e => setRascunho(r => ({ ...r, notes: e.target.value }))} className="h-7 text-[11px]" />
                  </div>
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setEditandoId(null)} aria-label="Cancelar edição" className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:bg-muted rounded-md px-2 py-1 transition-colors">
                      <X className="w-3 h-3" /> Cancelar
                    </button>
                    <button onClick={salvarEdicao} aria-label="Salvar pessoa" className="flex items-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md px-2 py-1 transition-colors">
                      <Check className="w-3 h-3" /> Salvar
                    </button>
                  </div>
                </div>
              );
            }

            /*
             * DUAS LINHAS no celular (30/07), mesma correção do Treino.
             *
             * Numa grade de 12 colunas a 360px cada coluna tem ~24px, então o
             * nome (col-span-4) ficava com 95px: "Pedro (melhor amig…". Nome
             * de pessoa cortado é o pior corte possível numa tela cujo
             * assunto É a pessoa.
             *
             *   celular  linha 1 = nome + notas ......... dias + lápis + lixeira
             *            linha 2 = relação · aniversário
             *   ≥640px   a tabela de 12 colunas de sempre.
             *
             * `sm:contents` no invólucro da linha 2: no desktop ele some do
             * layout e os filhos viram itens diretos da grade, ocupando as
             * colunas próprias. Um markup só, dois layouts.
             *
             * Lápis e lixeira SEMPRE visíveis (07/09): o Tailwind daqui usa
             * hoverOnlyWhenSupported, então `group-hover:opacity-100` nunca
             * dispara no toque — no celular a lixeira era invisível.
             */
            return (
              <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 items-center bg-background/60 rounded-lg px-2 py-1.5 group sm:grid-cols-12 sm:gap-1">
                <div className="col-start-1 row-start-1 min-w-0 sm:col-start-1 sm:col-span-4">
                  <p className="text-xs font-medium truncate">{p.name}</p>
                  {p.notes && <p className="text-[9px] text-muted-foreground truncate">{p.notes}</p>}
                </div>
                <div className="col-start-1 row-start-2 flex items-center gap-1 min-w-0 sm:contents">
                  <span className="text-[10px] text-muted-foreground truncate sm:col-start-5 sm:col-span-3">{p.relation || "—"}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0 sm:hidden">·</span>
                  <span className="text-[10px] text-muted-foreground shrink-0 sm:col-start-8 sm:col-span-3">
                    {p.birthday ? format(dataDoAniversario(p.birthday), "dd/MM") : "—"}
                  </span>
                </div>
                <div className="col-start-2 row-start-1 flex items-center justify-end gap-1.5 sm:col-start-11 sm:col-span-2">
                  {days !== null && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      days === 0 ? "bg-rose-500/20 text-rose-400 animate-pulse" :
                      days <= 7 ? "bg-rose-500/20 text-rose-400" :
                      days <= 30 ? "bg-amber-500/20 text-amber-400" :
                      "text-muted-foreground"
                    }`}>
                      {days === 0 ? "Hoje!" : `${days}d`}
                    </span>
                  )}
                  <button onClick={() => comecarEdicao(p)} aria-label={`Editar ${p.name}`} className="p-1 -m-1 text-muted-foreground hover:text-primary transition-colors">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => removePerson(p.id)} aria-label={`Apagar ${p.name}`} className="p-1 -m-1 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {people.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic py-3 text-center">Nenhuma pessoa ainda</p>
          )}

          {/* Inline add */}
          <div className="border border-dashed border-border/60 bg-background/50 rounded-lg p-2 space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <Input placeholder="Nome" value={name} onChange={e => setName(e.target.value)} className="h-7 text-[11px]" />
              <Input placeholder="Relação" value={relation} onChange={e => setRelation(e.target.value)} className="h-7 text-[11px]" />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="relative">
                <CampoData rotulo="Aniversário" value={birthday} onChange={e => setBirthday(e.target.value)} className="h-7 text-[11px]" />
              </div>
              <Input placeholder="Notas (saúde, alergias, o que gosta…)" value={notes} onChange={e => setNotes(e.target.value)} className="h-7 text-[11px]" />
            </div>
            <button onClick={addPerson} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md py-1 transition-colors">
              <Plus className="w-3 h-3" /> Adicionar pessoa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
