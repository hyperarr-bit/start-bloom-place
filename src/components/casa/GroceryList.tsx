import { useEffect, useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useUserData } from "@/hooks/use-user-data";
import { Plus, X, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { avisarApagado } from "@/lib/desfazer";
import {
  CATEGORIAS_PADRAO_MERCADO, alternarItemMercado, precisaReparar, repararCategorias,
  type CategoriaMercado, type ItemDespensa,
} from "@/lib/mercado";
import { pantryCategoryLabel } from "./types";

// Formato salvo em casa-grocery-categories: o mesmo de sempre, agora em lib/mercado.ts
// (fonte única com a Dieta, que também escreve nesta chave).
type GroceryCategory = CategoriaMercado;

const EXTRA_COLORS = [
  { label: "Verde", value: "bg-green-500" },
  { label: "Vermelho", value: "bg-red-500" },
  { label: "Azul", value: "bg-blue-600" },
  { label: "Roxo", value: "bg-purple-500" },
  { label: "Laranja", value: "bg-orange-500" },
  { label: "Amarelo", value: "bg-yellow-600" },
  { label: "Ciano", value: "bg-cyan-500" },
  { label: "Rosa", value: "bg-pink-500" },
];

/* Contraste (26/09, varredura): texto branco no verde/ciano/laranja/amarelo
 * ficava entre 2,3:1 e 2,9:1 no tema claro. Nesses fundos claros o texto é o
 * escuro do tema (5,1–6,6:1); no escuro ele vira o claro do tema sozinho. */
const FUNDO_CLARO = new Set(["bg-green-500", "bg-cyan-500", "bg-orange-500", "bg-yellow-600"]);

// valor torto na chave não derruba a aba (mesmo cuidado da Rotina)
const comoCategorias = (v: unknown): GroceryCategory[] =>
  (Array.isArray(v) ? v : []).filter((c): c is GroceryCategory => !!c && Array.isArray((c as GroceryCategory).items));

const GroceryList = () => {
  const { loaded, get } = useUserData();
  const [salvas, setCategories] = usePersistedState<GroceryCategory[]>("casa-grocery-categories", CATEGORIAS_PADRAO_MERCADO);
  const categories = comoCategorias(salvas);
  // a compra de item que veio da Despensa devolve ele pro canto de origem
  const [despensa, setDespensa] = usePersistedState<ItemDespensa[]>("casa-pantry", []);

  /* Quem mandou a lista da Dieta antes de abrir o Mercado ficou só com a
     categoria "Dieta" (as 9 do padrão sumiam). Devolve as 9 uma vez — depois
     da carga do servidor e com o estado igual ao salvo (escrita antes disso
     ganha do servidor e subiria o cache velho). */
  useEffect(() => {
    if (!loaded || JSON.stringify(get("casa-grocery-categories", CATEGORIAS_PADRAO_MERCADO)) !== JSON.stringify(salvas)) return;
    if (precisaReparar(salvas)) setCategories(repararCategorias(salvas));
  }, [loaded, get, salvas, setCategories]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("🛒");
  const [newCatColor, setNewCatColor] = useState("bg-green-500");

  const addItem = (catId: string) => {
    const text = inputs[catId]?.trim();
    if (!text) return;
    setCategories(prev => comoCategorias(prev).map(c =>
      c.id === catId ? { ...c, items: [...c.items, { id: Date.now().toString(), text, done: false }] } : c
    ));
    setInputs(prev => ({ ...prev, [catId]: "" }));
  };

  const toggleItem = (catId: string, itemId: string) => {
    const r = alternarItemMercado(categories, despensa, catId, itemId);
    setCategories(r.categorias);
    if (r.despensa !== despensa) setDespensa(r.despensa);
    if (r.voltou) toast.success(`${r.voltou.nome} voltou pra ${pantryCategoryLabel[r.voltou.canto] ?? "Despensa"}`);
  };

  const removeItem = (catId: string, itemId: string) => {
    setCategories(prev => comoCategorias(prev).map(c =>
      c.id === catId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c
    ));
  };

  const addCategory = () => {
    if (!newCatName.trim()) return;
    setCategories(prev => [...comoCategorias(prev), {
      id: Date.now().toString(),
      name: newCatName.trim(),
      emoji: newCatEmoji || "🛒",
      color: newCatColor,
      items: [],
    }]);
    setNewCatName("");
    setNewCatEmoji("🛒");
    setShowAddCat(false);
  };

  // Apagar a categoria leva os itens junto: dá pra desfazer por alguns segundos.
  const removeCategory = (catId: string) => {
    const pos = categories.findIndex(c => c.id === catId);
    const cat = categories[pos];
    if (!cat) return;
    setCategories(prev => comoCategorias(prev).filter(c => c.id !== catId));
    avisarApagado(`Categoria "${cat.name}" apagada`, () => setCategories(prev => {
      const n = comoCategorias(prev);
      if (n.some(c => c.id === cat.id)) return n;
      n.splice(Math.min(pos, n.length), 0, cat);
      return n;
    }));
  };

  const clearChecked = () => {
    setCategories(prev => comoCategorias(prev).map(c => ({ ...c, items: c.items.filter(i => !i.done) })));
  };

  const totalItems = categories.reduce((s, c) => s + c.items.length, 0);
  const doneItems = categories.reduce((s, c) => s + c.items.filter(i => i.done).length, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide">Lista do Mercado</h3>
          <p className="text-xs text-muted-foreground">
            {totalItems > 0 ? `${doneItems}/${totalItems} comprados` : "Adicione itens às categorias"}
          </p>
        </div>
        <div className="flex gap-2">
          {doneItems > 0 && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={clearChecked}>
              Limpar ✓
            </Button>
          )}
          <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setShowAddCat(!showAddCat)}>
            <Plus className="w-3 h-3" /> Categoria
          </Button>
        </div>
      </div>

      {/* Add Category Form */}
      {showAddCat && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <p className="text-xs font-bold">Nova Categoria</p>
          <div className="flex gap-2">
            <Input
              value={newCatEmoji}
              onChange={e => setNewCatEmoji(e.target.value)}
              className="text-sm h-9 w-14 text-center"
              maxLength={2}
            />
            <Input
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="Nome da categoria"
              className="text-sm h-9 flex-1"
              onKeyDown={e => e.key === "Enter" && addCategory()}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {EXTRA_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setNewCatColor(c.value)}
                className={`w-7 h-7 rounded-lg ${c.value} border-2 transition-all ${newCatColor === c.value ? "border-foreground scale-110" : "border-transparent"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-8 flex-1" onClick={addCategory}>Adicionar</Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => setShowAddCat(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Category Cards */}
      {categories.map(cat => {
        const done = cat.items.filter(i => i.done).length;
        const total = cat.items.length;
        const tinta = FUNDO_CLARO.has(cat.color) ? "text-foreground" : "text-white";
        return (
          <div
            key={cat.id}
            data-color={cat.color}
            className="grocery-card rounded-2xl border border-border overflow-hidden bg-card"
          >
            {/* Colored Header */}
            <div className={`grocery-header ${cat.color} px-4 py-3 flex items-center gap-3`}>
              <span className="text-xl">{cat.emoji}</span>
              <span className={`text-sm font-black flex-1 ${tinta}`}>{cat.name}</span>
              <span className={`text-xs font-bold ${tinta === "text-white" ? "text-white/80" : tinta}`}>{done}/{total}</span>
              <button
                onClick={() => removeCategory(cat.id)}
                className="grocery-trash opacity-60 hover:opacity-100 transition-opacity ml-1"
                title="Remover categoria"
                aria-label={`Remover categoria ${cat.name}`}
              >
                <Trash2 className={`w-3.5 h-3.5 ${tinta}`} />
              </button>
            </div>

            {/* Items */}
            <div className="grocery-body p-4 space-y-1">
              {cat.items.map(item => (
                <div key={item.id} className="flex items-center gap-3 py-1.5 group">
                  <Checkbox
                    checked={item.done}
                    onCheckedChange={() => toggleItem(cat.id, item.id)}
                    className="w-5 h-5"
                  />
                  <span className={`text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {item.text}
                  </span>
                  {item.origem && <span className="text-[9px] bg-primary/10 text-primary px-1 rounded" title="Volta pra despensa quando você marcar">Despensa</span>}
                  <button
                    onClick={() => removeItem(cat.id, item.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}

              {/* Inline add */}
              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={inputs[cat.id] || ""}
                  onChange={e => setInputs(prev => ({ ...prev, [cat.id]: e.target.value }))}
                  placeholder="Adicionar..."
                  className="grocery-input text-sm h-9 flex-1 rounded-lg"
                  onKeyDown={e => e.key === "Enter" && addItem(cat.id)}
                />
                <Button
                  size="icon"
                  variant="secondary"
                  className="grocery-add-btn h-9 w-9 shrink-0"
                  onClick={() => addItem(cat.id)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GroceryList;
