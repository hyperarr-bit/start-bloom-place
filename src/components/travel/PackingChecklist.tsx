import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { PackingList, PackingItem, PackingTemplate, PACKING_TEMPLATES, genId } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X, Package, Link2, Pencil, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const CATEGORY_COLORS: Record<string, { header: string; body: string }> = {
  "Roupas": { header: "bg-pink-200 dark:bg-pink-800/50", body: "bg-pink-50 dark:bg-pink-950/20" },
  "Acessórios": { header: "bg-purple-200 dark:bg-purple-800/50", body: "bg-purple-50 dark:bg-purple-950/20" },
  "Higiene": { header: "bg-cyan-200 dark:bg-cyan-800/50", body: "bg-cyan-50 dark:bg-cyan-950/20" },
  "Calçados": { header: "bg-orange-200 dark:bg-orange-800/50", body: "bg-orange-50 dark:bg-orange-950/20" },
  "Eletrônicos": { header: "bg-blue-200 dark:bg-blue-800/50", body: "bg-blue-50 dark:bg-blue-950/20" },
  "Equipamento": { header: "bg-green-200 dark:bg-green-800/50", body: "bg-green-50 dark:bg-green-950/20" },
  "Trabalho": { header: "bg-yellow-200 dark:bg-yellow-800/50", body: "bg-yellow-50 dark:bg-yellow-950/20" },
  "Saúde": { header: "bg-red-200 dark:bg-red-800/50", body: "bg-red-50 dark:bg-red-950/20" },
  "Extras": { header: "bg-gray-200 dark:bg-gray-800/50", body: "bg-gray-50 dark:bg-gray-950/20" },
};

const defaultCatColor = { header: "bg-teal-200 dark:bg-teal-800/50", body: "bg-teal-50 dark:bg-teal-950/20" };

/** Categorias oferecidas na edição — as mesmas que os templates usam, senão o
 *  item cai numa seção sem cor e some do meio da lista. */
const CATEGORIAS_ITEM = Object.keys(CATEGORY_COLORS);

export const PackingChecklist = () => {
  const [lists, setLists] = usePersistedState<PackingList[]>("travel-packing-v2", []);
  const [showCreate, setShowCreate] = useState(false);
  const [tripName, setTripName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<PackingTemplate | null>(null);
  const [activeList, setActiveList] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");

  const createList = () => {
    if (!tripName) return;
    const template = selectedTemplate && selectedTemplate !== "custom" ? PACKING_TEMPLATES[selectedTemplate] : null;
    const items: PackingItem[] = template
      ? template.items.map(i => ({ id: genId(), name: i.name, packed: false, category: i.category, linkedToSkincare: i.skincare }))
      : [];
    const list: PackingList = { id: genId(), tripName, template: selectedTemplate || "custom", items };
    setLists(prev => [...prev, list]);
    setActiveList(list.id);
    setTripName("");
    setSelectedTemplate(null);
    setShowCreate(false);
  };

  const toggleItem = (listId: string, itemId: string) => {
    setLists(prev => prev.map(l => l.id === listId ? { ...l, items: l.items.map(i => i.id === itemId ? { ...i, packed: !i.packed } : i) } : l));
  };

  const addItem = (listId: string) => {
    if (!newItem.trim()) return;
    setLists(prev => prev.map(l => l.id === listId ? { ...l, items: [...l.items, { id: genId(), name: newItem.trim(), packed: false, category: "Extras" }] } : l));
    setNewItem("");
  };

  const removeItem = (listId: string, itemId: string) => {
    setLists(prev => prev.map(l => l.id === listId ? { ...l, items: l.items.filter(i => i.id !== itemId) } : l));
    setEditandoItem(prev => (prev === itemId ? null : prev));
  };

  const deleteList = (id: string) => {
    setLists(prev => prev.filter(l => l.id !== id));
    if (activeList === id) setActiveList(null);
  };

  /** === EDIÇÃO (padrão da IncomeTable) ===
   *  Item da mala escrito errado (ou salvo na categoria errada pelo "+
   *  Adicionar item", que joga TUDO em "Extras") só se resolvia apagando e
   *  redigitando. Mudar a categoria aqui é o que tira o item de "Extras" e
   *  põe na seção certa — a lista é agrupada por ela. */
  const [editandoItem, setEditandoItem] = useState<string | null>(null);
  const [rascunhoItem, setRascunhoItem] = useState({ name: "", category: "Extras" });

  const comecarEdicaoItem = (item: PackingItem) => {
    setEditandoItem(item.id);
    setRascunhoItem({ name: item.name, category: item.category || "Extras" });
  };

  const salvarEdicaoItem = (listId: string) => {
    if (!rascunhoItem.name.trim()) return;
    setLists(prev => prev.map(l => l.id !== listId ? l : {
      ...l,
      items: l.items.map(i => i.id !== editandoItem ? i : { ...i, name: rascunhoItem.name.trim(), category: rascunhoItem.category }),
    }));
    setEditandoItem(null);
  };

  /** Renomear a LISTA: o nome da viagem é o único rótulo dela; errar o nome
   *  obrigava a recriar a lista inteira (e perder tudo que já foi marcado). */
  const [editandoLista, setEditandoLista] = useState(false);
  const [nomeLista, setNomeLista] = useState("");

  const salvarNomeLista = (listId: string) => {
    if (!nomeLista.trim()) return;
    setLists(prev => prev.map(l => l.id === listId ? { ...l, tripName: nomeLista.trim() } : l));
    setEditandoLista(false);
  };

  const current = lists.find(l => l.id === activeList);
  const grouped = current ? Object.entries(
    current.items.reduce<Record<string, PackingItem[]>>((acc, item) => {
      (acc[item.category] = acc[item.category] || []).push(item);
      return acc;
    }, {})
  ) : [];

  return (
    <div className="space-y-4">
      {/* Lists overview */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {lists.map(l => {
          const packed = l.items.filter(i => i.packed).length;
          const total = l.items.length;
          return (
            <button
              key={l.id}
              onClick={() => setActiveList(l.id)}
              className={`shrink-0 rounded-xl px-4 py-3 border transition-all text-left min-w-[140px] ${
                activeList === l.id
                  ? "border-foreground bg-foreground text-background shadow-md"
                  : "border-border bg-card hover:border-foreground/30"
              }`}
            >
              <p className="text-xs font-semibold truncate">{l.tripName}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${total > 0 ? (packed / total) * 100 : 0}%` }} />
                </div>
                <span className="text-[9px] opacity-70">{packed}/{total}</span>
              </div>
            </button>
          );
        })}
        <button
          onClick={() => setShowCreate(true)}
          className="shrink-0 rounded-xl px-4 py-3 border border-dashed border-border hover:border-foreground/50 min-w-[120px] flex items-center justify-center gap-1 text-muted-foreground text-xs transition-colors"
        >
          <Plus className="w-3 h-3" /> Nova Lista
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <Input placeholder="Nome da viagem..." value={tripName} onChange={e => setTripName(e.target.value)} className="h-10 rounded-xl border-border" />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Escolha um template:</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(PACKING_TEMPLATES) as [Exclude<PackingTemplate, "custom">, typeof PACKING_TEMPLATES["praia"]][]).map(([key, tmpl]) => (
                <button
                  key={key}
                  onClick={() => setSelectedTemplate(key)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    selectedTemplate === key ? "border-foreground bg-muted shadow-sm" : "border-border hover:border-foreground/30"
                  }`}
                >
                  <span className="text-2xl">{tmpl.emoji}</span>
                  <p className="text-xs font-medium mt-1">{tmpl.label}</p>
                  <p className="text-[9px] text-muted-foreground">{tmpl.items.length} itens</p>
                </button>
              ))}
              <button
                onClick={() => setSelectedTemplate("custom")}
                className={`rounded-xl border p-3 text-left transition-all ${
                  selectedTemplate === "custom" ? "border-foreground bg-muted shadow-sm" : "border-border hover:border-foreground/30"
                }`}
              >
                <span className="text-2xl">✨</span>
                <p className="text-xs font-medium mt-1">Personalizado</p>
                <p className="text-[9px] text-muted-foreground">Lista vazia</p>
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={createList} className="flex-1 rounded-xl h-9 text-xs">Criar Lista</Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)} className="rounded-xl h-9 text-xs">Cancelar</Button>
          </div>
        </div>
      )}

      {/* Active list detail */}
      {current && (
        <div className="space-y-3">
          {/* List header - Notion-style */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-teal-200 dark:bg-teal-800/50 px-3 py-2 flex items-center gap-1">
              {editandoLista ? (
                <>
                  <Input
                    autoFocus
                    value={nomeLista}
                    onChange={e => setNomeLista(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") salvarNomeLista(current.id); if (e.key === "Escape") setEditandoLista(false); }}
                    className="h-9 text-xs flex-1 bg-background/70"
                  />
                  <button onClick={() => salvarNomeLista(current.id)} aria-label="Salvar nome da lista" className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditandoLista(false)} aria-label="Cancelar" className="h-9 w-9 flex items-center justify-center rounded-lg border border-border">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-xs font-bold uppercase tracking-wider flex-1 min-w-0 truncate">🧳 {current.tripName}</span>
                  <button onClick={() => { setEditandoLista(true); setNomeLista(current.tripName); }} aria-label={`Renomear lista ${current.tripName}`} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg hover:bg-background/40 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <Button variant="ghost" size="sm" className="text-destructive text-[10px] h-9 px-2" onClick={() => deleteList(current.id)}>
                    Excluir
                  </Button>
                </>
              )}
            </div>
            <div className="bg-teal-50 dark:bg-teal-950/20 px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-muted-foreground">
                  {current.items.filter(i => i.packed).length} de {current.items.length} empacotados
                </p>
                <p className="text-[10px] font-bold">
                  {current.items.length > 0 ? Math.round((current.items.filter(i => i.packed).length / current.items.length) * 100) : 0}%
                </p>
              </div>
              <Progress
                value={current.items.length > 0 ? (current.items.filter(i => i.packed).length / current.items.length) * 100 : 0}
                className="h-1.5 rounded-full"
              />
            </div>
          </div>

          {grouped.map(([category, items]) => {
            const colors = CATEGORY_COLORS[category] || defaultCatColor;
            const doneCount = items.filter(i => i.packed).length;
            return (
              <div key={category} className="rounded-xl border border-border overflow-hidden">
                <div className={`${colors.header} px-3 py-1.5 flex items-center justify-between`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider">{category}</span>
                  <Badge variant="secondary" className="text-[9px] px-1.5 h-4 bg-background/50">{doneCount}/{items.length}</Badge>
                </div>
                <div className={`${colors.body} p-2 space-y-0.5`}>
                  {items.map(item => editandoItem === item.id ? (
                    <div key={item.id} className="px-2 py-2 rounded-lg bg-background/60 space-y-2">
                      <Input
                        autoFocus
                        value={rascunhoItem.name}
                        onChange={e => setRascunhoItem(p => ({ ...p, name: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter") salvarEdicaoItem(current.id); if (e.key === "Escape") setEditandoItem(null); }}
                        className="h-9 text-xs"
                        placeholder="Nome do item"
                      />
                      <div className="flex gap-2">
                        <select
                          value={rascunhoItem.category}
                          onChange={e => setRascunhoItem(p => ({ ...p, category: e.target.value }))}
                          aria-label="Categoria do item"
                          className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-[11px]"
                        >
                          {CATEGORIAS_ITEM.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button onClick={() => salvarEdicaoItem(current.id)} aria-label="Salvar item" className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" /> Salvar
                        </button>
                        <button onClick={() => setEditandoItem(null)} aria-label="Cancelar" className="h-9 w-9 rounded-md border border-border text-muted-foreground flex items-center justify-center">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={item.id} className="flex items-center gap-2 px-2 rounded-lg hover:bg-background/50 transition-colors">
                      <Checkbox
                        checked={item.packed}
                        onCheckedChange={() => toggleItem(current.id, item.id)}
                      />
                      <span className={`text-xs flex-1 py-1.5 ${item.packed ? "line-through text-muted-foreground" : ""}`}>
                        {item.name}
                      </span>
                      {item.linkedToSkincare && (
                        <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                          <Link2 className="w-3 h-3" /> Skincare
                        </span>
                      )}
                      {/* Ações sempre visíveis: hover não existe no celular. */}
                      <button onClick={() => comecarEdicaoItem(item)} aria-label={`Editar ${item.name}`} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg hover:bg-background/60 transition-colors">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                      </button>
                      <button onClick={() => removeItem(current.id, item.id)} aria-label={`Apagar ${item.name}`} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg hover:bg-background/60 transition-colors">
                        <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Add custom item */}
          <div className="flex gap-2">
            <Input
              placeholder="Adicionar item..."
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              className="h-9 rounded-xl text-xs"
              onKeyDown={e => { if (e.key === "Enter") addItem(current.id); }}
            />
            <Button size="sm" onClick={() => addItem(current.id)} className="rounded-xl h-9">
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {!current && lists.length === 0 && !showCreate && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-teal-200 dark:bg-teal-800/50 px-4 py-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider">🧳 LISTAS DE MALA</span>
            <button onClick={() => setShowCreate(true)}
              className="rounded-lg bg-background/50 px-2 py-0.5 text-[10px] font-medium hover:bg-background/80 transition-colors">
              <Plus className="w-3 h-3 inline mr-0.5" />Criar
            </button>
          </div>
          <div className="bg-teal-50 dark:bg-teal-950/20 px-3 py-6 text-center">
            <p className="text-xs text-muted-foreground">Nenhuma lista criada ainda</p>
          </div>
        </div>
      )}
    </div>
  );
};
