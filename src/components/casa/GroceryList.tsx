import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface GroceryItem {
  id: string;
  text: string;
  done: boolean;
}

interface GroceryCategory {
  id: string;
  name: string;
  emoji: string;
  color: string;
  items: GroceryItem[];
}

const DEFAULT_CATEGORIES: GroceryCategory[] = [
  { id: "1", name: "HortiFrutti", emoji: "🥬", color: "bg-green-500", items: [] },
  { id: "2", name: "Açougue e Peixaria", emoji: "🥩", color: "bg-red-500", items: [] },
  { id: "3", name: "Laticínios e Frios", emoji: "🧀", color: "bg-blue-600", items: [] },
  { id: "4", name: "Mercearia", emoji: "🏪", color: "bg-purple-500", items: [] },
  { id: "5", name: "Padaria", emoji: "🥖", color: "bg-orange-500", items: [] },
  { id: "6", name: "Congelados", emoji: "🍦", color: "bg-yellow-600", items: [] },
  { id: "7", name: "Limpeza", emoji: "🧹", color: "bg-cyan-500", items: [] },
  { id: "8", name: "Higiene Pessoal", emoji: "🛁", color: "bg-pink-500", items: [] },
  { id: "9", name: "Bebidas", emoji: "🥤", color: "bg-indigo-600", items: [] },
];

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

const GroceryList = () => {
  const [categories, setCategories] = usePersistedState<GroceryCategory[]>("casa-grocery-categories", DEFAULT_CATEGORIES);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("🛒");
  const [newCatColor, setNewCatColor] = useState("bg-green-500");

  const addItem = (catId: string) => {
    const text = inputs[catId]?.trim();
    if (!text) return;
    setCategories(prev => prev.map(c =>
      c.id === catId ? { ...c, items: [...c.items, { id: Date.now().toString(), text, done: false }] } : c
    ));
    setInputs(prev => ({ ...prev, [catId]: "" }));
  };

  const toggleItem = (catId: string, itemId: string) => {
    setCategories(prev => prev.map(c =>
      c.id === catId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i) } : c
    ));
  };

  const removeItem = (catId: string, itemId: string) => {
    setCategories(prev => prev.map(c =>
      c.id === catId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c
    ));
  };

  const addCategory = () => {
    if (!newCatName.trim()) return;
    setCategories(prev => [...prev, {
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

  const removeCategory = (catId: string) => {
    setCategories(prev => prev.filter(c => c.id !== catId));
  };

  const clearChecked = () => {
    setCategories(prev => prev.map(c => ({ ...c, items: c.items.filter(i => !i.done) })));
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
        return (
          <div key={cat.id} className="rounded-2xl border border-border overflow-hidden bg-card">
            {/* Colored Header */}
            <div className={`${cat.color} px-4 py-3 flex items-center gap-3`}>
              <span className="text-xl">{cat.emoji}</span>
              <span className="text-sm font-black text-white flex-1">{cat.name}</span>
              <span className="text-xs font-bold text-white/80">{done}/{total}</span>
              <button
                onClick={() => removeCategory(cat.id)}
                className="opacity-60 hover:opacity-100 transition-opacity ml-1"
                title="Remover categoria"
              >
                <Trash2 className="w-3.5 h-3.5 text-white" />
              </button>
            </div>

            {/* Items */}
            <div className="p-4 space-y-1">
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
                  className="text-sm h-9 flex-1 rounded-lg"
                  onKeyDown={e => e.key === "Enter" && addItem(cat.id)}
                />
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-9 w-9 shrink-0"
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
