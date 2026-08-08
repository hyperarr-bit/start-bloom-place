import { useState } from "react";
import { localDayKey } from "@/lib/utils";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { BillSplitData, BillEntry, calculateSettlement, genId, formatCurrency } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampoData } from "@/components/ui/campo-data";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users, ArrowRight, Receipt, Pencil, Check, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

/** Campos de uma despesa — os MESMOS no adicionar e no editar. No topo do
 *  módulo pra não remontar a cada tecla e roubar o foco do input. */
const CamposDespesa = ({
  valor,
  pessoas,
  aoMudar,
  aoAlternarDivisao,
}: {
  valor: Partial<BillEntry>;
  pessoas: string[];
  aoMudar: (patch: Partial<BillEntry>) => void;
  aoAlternarDivisao: (pessoa: string) => void;
}) => (
  <>
    <Input placeholder="Descrição (ex: Jantar)" value={valor.description || ""} onChange={e => aoMudar({ description: e.target.value })} className="h-9 rounded-xl text-xs" />
    <div className="grid grid-cols-2 gap-2">
      <Input type="number" inputMode="decimal" placeholder="Valor R$" value={valor.amount || ""} onChange={e => aoMudar({ amount: Number(e.target.value) })} className="h-9 rounded-xl text-xs" />
      <CampoData rotulo="Data" value={valor.date || ""} onChange={e => aoMudar({ date: e.target.value })} className="h-9 rounded-xl text-xs" />
    </div>
    <div>
      <p className="text-[10px] text-muted-foreground mb-1.5">Quem pagou?</p>
      <div className="flex flex-wrap gap-1.5">
        {pessoas.map(p => (
          <button key={p} onClick={() => aoMudar({ paidBy: p })}
            aria-pressed={valor.paidBy === p}
            className={`h-9 rounded-lg px-3 text-xs border transition-all ${valor.paidBy === p ? "border-foreground bg-foreground text-background font-medium" : "border-border hover:border-foreground/30"}`}>
            {p}
          </button>
        ))}
      </div>
    </div>
    <div>
      <p className="text-[10px] text-muted-foreground mb-1.5">Dividir entre:</p>
      <div className="flex flex-wrap gap-1.5">
        {pessoas.map(p => (
          <label key={p} className="h-9 flex items-center gap-1.5 rounded-lg px-3 border border-border text-xs cursor-pointer hover:border-foreground/30">
            <Checkbox checked={valor.splitBetween?.includes(p)} onCheckedChange={() => aoAlternarDivisao(p)} className="h-3.5 w-3.5" />
            {p}
          </label>
        ))}
      </div>
    </div>
  </>
);

/** Marca/desmarca uma pessoa na divisão — mesma regra pro form de adicionar e
 *  pro rascunho de edição. */
const alternarNaDivisao = (prev: Partial<BillEntry>, pessoa: string): Partial<BillEntry> => ({
  ...prev,
  splitBetween: prev.splitBetween?.includes(pessoa)
    ? prev.splitBetween.filter(p => p !== pessoa)
    : [...(prev.splitBetween || []), pessoa],
});

export const BillSplitter = () => {
  const [data, setData] = usePersistedState<BillSplitData>("travel-bill-split", { tripName: "", people: [], entries: [] });
  const [newPerson, setNewPerson] = useState("");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [form, setForm] = useState<Partial<BillEntry>>({ splitBetween: [] });

  const addPerson = () => {
    if (!newPerson.trim() || data.people.includes(newPerson.trim())) return;
    setData(prev => ({ ...prev, people: [...prev.people, newPerson.trim()] }));
    setNewPerson("");
  };

  const removePerson = (name: string) => {
    setData(prev => ({
      ...prev, people: prev.people.filter(p => p !== name),
      entries: prev.entries.filter(e => e.paidBy !== name).map(e => ({ ...e, splitBetween: e.splitBetween.filter(p => p !== name) })),
    }));
  };

  const addEntry = () => {
    if (!form.description || !form.amount || !form.paidBy || !form.splitBetween?.length) return;
    const entry: BillEntry = {
      id: genId(), description: form.description, amount: form.amount, paidBy: form.paidBy,
      splitBetween: form.splitBetween, date: form.date || localDayKey(),
    };
    setData(prev => ({ ...prev, entries: [...prev.entries, entry] }));
    setForm({ splitBetween: [] });
    setShowExpenseForm(false);
  };

  const removeEntry = (id: string) => {
    setData(prev => ({ ...prev, entries: prev.entries.filter(e => e.id !== id) }));
    setEditandoId(prev => (prev === id ? null : prev));
  };

  const toggleSplit = (person: string) => setForm(prev => alternarNaDivisao(prev, person));

  /** === EDIÇÃO DE DESPESA (padrão da IncomeTable) ===
   *  Aqui o erro custa dinheiro: valor digitado errado ou "quem pagou" trocado
   *  desandava o ACERTO FINAL inteiro, e a única saída era apagar a despesa e
   *  remontá-la (descrição, valor, pagante e a lista de quem divide). */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Partial<BillEntry>>({ splitBetween: [] });

  const comecarEdicao = (e: BillEntry) => {
    setEditandoId(e.id);
    setRascunho({ ...e, splitBetween: [...e.splitBetween] });
  };

  const salvarEdicao = () => {
    if (!rascunho.description?.trim() || !rascunho.amount || !rascunho.paidBy || !rascunho.splitBetween?.length) return;
    setData(prev => ({
      ...prev,
      entries: prev.entries.map(e => e.id !== editandoId ? e : {
        ...e,
        description: rascunho.description!.trim(),
        amount: rascunho.amount!,
        paidBy: rascunho.paidBy!,
        splitBetween: rascunho.splitBetween!,
        date: rascunho.date || e.date,
      }),
    }));
    setEditandoId(null);
  };

  /** === RENOMEAR PARTICIPANTE ===
   *  O nome é a CHAVE das despesas (paidBy e splitBetween guardam a string).
   *  Por isso renomear tem que propagar: trocar só na lista de pessoas
   *  deixaria as despesas apontando pra um fantasma e o acerto final sairia
   *  errado. Antes disso, um nome digitado torto só se resolvia removendo a
   *  pessoa — o que APAGA todas as despesas que ela pagou. */
  const [editandoPessoa, setEditandoPessoa] = useState<string | null>(null);
  const [nomePessoa, setNomePessoa] = useState("");

  const salvarPessoa = () => {
    const novo = nomePessoa.trim();
    if (!novo || !editandoPessoa) return;
    if (novo !== editandoPessoa && data.people.includes(novo)) return; // nome repetido embaralharia os saldos
    setData(prev => ({
      ...prev,
      people: prev.people.map(p => (p === editandoPessoa ? novo : p)),
      entries: prev.entries.map(e => ({
        ...e,
        paidBy: e.paidBy === editandoPessoa ? novo : e.paidBy,
        splitBetween: e.splitBetween.map(p => (p === editandoPessoa ? novo : p)),
      })),
    }));
    setForm(prev => ({
      ...prev,
      paidBy: prev.paidBy === editandoPessoa ? novo : prev.paidBy,
      splitBetween: prev.splitBetween?.map(p => (p === editandoPessoa ? novo : p)),
    }));
    setEditandoPessoa(null);
  };

  const settlements = calculateSettlement(data);
  const totalSpent = data.entries.reduce((s, e) => s + e.amount, 0);

  const personSpending = data.people.map(p => ({
    name: p,
    paid: data.entries.filter(e => e.paidBy === p).reduce((s, e) => s + e.amount, 0),
    owes: data.entries.reduce((s, e) => e.splitBetween.includes(p) ? s + e.amount / e.splitBetween.length : s, 0),
  }));

  return (
    <div className="space-y-4">
      {/* People - Notion-style */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-blue-200 dark:bg-blue-800/50 px-3 py-1.5 flex items-center gap-2">
          <Users className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">PARTICIPANTES</span>
          <Badge variant="secondary" className="text-[9px] px-1.5 h-4 bg-background/50 ml-auto">{data.people.length}</Badge>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {data.people.map(p => editandoPessoa === p ? (
              <div key={p} className="flex items-center gap-1">
                <Input
                  autoFocus
                  value={nomePessoa}
                  onChange={e => setNomePessoa(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") salvarPessoa(); if (e.key === "Escape") setEditandoPessoa(null); }}
                  className="h-9 w-32 rounded-xl text-xs"
                />
                <button onClick={salvarPessoa} aria-label={`Salvar nome de ${p}`} className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditandoPessoa(null)} aria-label="Cancelar" className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <Badge key={p} variant="secondary" className="text-xs pl-3 pr-1 py-0 h-9 gap-0.5 rounded-lg">
                {p}
                <button onClick={() => { setEditandoPessoa(p); setNomePessoa(p); }} aria-label={`Renomear ${p}`} className="h-9 w-8 flex items-center justify-center">
                  <Pencil className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </button>
                <button onClick={() => removePerson(p)} aria-label={`Remover ${p} (apaga as despesas que ela pagou)`} className="h-9 w-8 flex items-center justify-center">
                  <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="Nome..." value={newPerson} onChange={e => setNewPerson(e.target.value)}
              className="h-8 rounded-xl text-xs" onKeyDown={e => { if (e.key === "Enter") addPerson(); }} />
            <Button size="sm" onClick={addPerson} className="rounded-xl h-8 text-xs"><Plus className="w-3 h-3" /></Button>
          </div>
        </div>
      </div>

      {data.people.length >= 2 && (
        <>
          {showExpenseForm && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <CamposDespesa
                valor={form}
                pessoas={data.people}
                aoMudar={patch => setForm(p => ({ ...p, ...patch }))}
                aoAlternarDivisao={toggleSplit}
              />
              <div className="flex gap-2">
                <Button onClick={addEntry} className="flex-1 rounded-xl h-9 text-xs">Adicionar</Button>
                <Button variant="ghost" onClick={() => setShowExpenseForm(false)} className="rounded-xl h-9 text-xs">Cancelar</Button>
              </div>
            </div>
          )}

          {/* Entries - always visible */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-yellow-200 dark:bg-yellow-800/50 px-3 py-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider">🧾 DESPESAS</span>
              <button onClick={() => setShowExpenseForm(!showExpenseForm)}
                className="rounded-lg bg-background/50 px-2 py-0.5 text-[10px] font-medium hover:bg-background/80 transition-colors">
                <Plus className="w-3 h-3 inline mr-0.5" />Adicionar
              </button>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-950/20 divide-y divide-border">
              {data.entries.length === 0 && (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-muted-foreground">Nenhuma despesa ainda</p>
                </div>
              )}
              {data.entries.map(e => editandoId === e.id ? (
                <div key={e.id} className="p-3 bg-background/40 space-y-3">
                  <CamposDespesa
                    valor={rascunho}
                    pessoas={data.people}
                    aoMudar={patch => setRascunho(p => ({ ...p, ...patch }))}
                    aoAlternarDivisao={pessoa => setRascunho(p => alternarNaDivisao(p, pessoa))}
                  />
                  <div className="flex items-center gap-2">
                    <button onClick={salvarEdicao} className="h-9 flex-1 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> Salvar
                    </button>
                    <button onClick={() => setEditandoId(null)} className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <X className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div key={e.id} className="flex items-center gap-1 px-3 py-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{e.description}</p>
                    <p className="text-[9px] text-muted-foreground">
                      Pago por <span className="font-medium text-foreground">{e.paidBy}</span> • dividido entre {e.splitBetween.length}
                    </p>
                  </div>
                  <span className="text-xs font-bold whitespace-nowrap">{formatCurrency(e.amount)}</span>
                  {/* Ações sempre visíveis: hover não existe no celular. */}
                  <button onClick={() => comecarEdicao(e)} aria-label={`Editar ${e.description}`} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg hover:bg-background/50 transition-colors">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                  <button onClick={() => removeEntry(e.id)} aria-label={`Apagar ${e.description}`} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg hover:bg-background/50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Per-person summary - Notion-style */}
          {data.entries.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-purple-200 dark:bg-purple-800/50 px-3 py-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider">📊 RESUMO POR PESSOA</span>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/20 p-3 space-y-2">
                {personSpending.map(p => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{p.name}</span>
                    <div className="text-right">
                      <span className="text-emerald-600 dark:text-emerald-400">Pagou {formatCurrency(p.paid)}</span>
                      <span className="text-muted-foreground mx-1">•</span>
                      <span className="text-orange-600 dark:text-orange-400">Deve {formatCurrency(p.owes)}</span>
                    </div>
                  </div>
                ))}
                <div className="text-right text-xs text-muted-foreground border-t border-border pt-2">
                  Total: <span className="font-bold text-foreground">{formatCurrency(totalSpent)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Settlement - Notion-style */}
          {settlements.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-green-200 dark:bg-green-800/50 px-3 py-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider">💰 ACERTO FINAL</span>
              </div>
              <div className="bg-green-50 dark:bg-green-950/20 p-3 space-y-2">
                {settlements.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="font-medium">{s.from}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className="font-medium">{s.to}</span>
                    <span className="ml-auto font-bold">{formatCurrency(s.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {data.people.length < 2 && (
        <p className="text-center text-[10px] text-muted-foreground py-4">Adicione pelo menos 2 pessoas para dividir contas</p>
      )}
    </div>
  );
};
