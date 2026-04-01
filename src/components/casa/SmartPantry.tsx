import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, ShoppingCart, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PantryItem, ShoppingItem, pantryCategoryEmoji, pantryCategoryLabel, statusEmoji } from "./types";

const categories = ["geladeira", "armario", "limpeza", "banheiro"] as const;

const SmartPantry = () => {
  const [pantry, setPantry] = usePersistedState<PantryItem[]>("casa-pantry", []);
  const [shopping, setShopping] = usePersistedState<ShoppingItem[]>("casa-shopping-list", []);
  const [newItem, setNewItem] = useState("");
  const [newCat, setNewCat] = useState<typeof categories[number]>("geladeira");
  const [newShopItem, setNewShopItem] = useState("");
  const [view, setView] = useState<"pantry" | "shopping">("pantry");

  const addPantryItem = () => {
    if (!newItem.trim()) return;
    setPantry(prev => [...prev, { id: Date.now().toString(), name: newItem.trim(), category: newCat, status: "cheio" }]);
    setNewItem("");
  };

  const changeStatus = (id: string, status: PantryItem["status"]) => {
    if (status === "acabou") {
      const item = pantry.find(p => p.id === id);
      if (item) {
        setShopping(prev => [...prev, { id: Date.now().toString(), name: item.name, checked: false, fromPantry: true }]);
      }
      setPantry(prev => prev.filter(p => p.id !== id));
    } else {
      setPantry(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    }
  };

  const checkShoppingItem = (id: string) => {
    const item = shopping.find(s => s.id === id);
    if (item && !item.checked && item.fromPantry) {
      setPantry(prev => [...prev, { id: Date.now().toString(), name: item.name, category: "armario", status: "cheio" }]);
    }
    setShopping(prev => prev.map(s => s.id === id ? { ...s, checked: !s.checked } : s));
  };

  const addShoppingItem = () => {
    if (!newShopItem.trim()) return;
    setShopping(prev => [...prev, { id: Date.now().toString(), name: newShopItem.trim(), checked: false, fromPantry: false }]);
    setNewShopItem("");
  };

  const clearChecked = () => setShopping(prev => prev.filter(s => !s.checked));

  const acabandoCount = pantry.filter(p => p.status === "acabando").length;

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex gap-2">
        <Button variant={view === "pantry" ? "default" : "outline"} size="sm" className="flex-1 h-9 text-xs" onClick={() => setView("pantry")}>
          🗄️ Despensa ({pantry.length})
        </Button>
        <Button variant={view === "shopping" ? "default" : "outline"} size="sm" className="flex-1 h-9 text-xs gap-1" onClick={() => setView("shopping")}>
          <ShoppingCart className="w-3 h-3" /> Compras ({shopping.filter(s => !s.checked).length})
        </Button>
      </div>

      {acabandoCount > 0 && view === "pantry" && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 text-xs text-center">
          ⚠️ {acabandoCount} produto{acabandoCount > 1 ? "s" : ""} acabando!
        </div>
      )}

      {view === "pantry" ? (
        <>
          {categories.map(cat => {
            const items = pantry.filter(p => p.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-3 border-b border-border bg-muted/30">
                  <h4 className="text-xs font-bold">{pantryCategoryEmoji[cat]} {pantryCategoryLabel[cat]}</h4>
                </div>
                <div className="p-2 space-y-1">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/30 group">
                      <span className="text-xs">{statusEmoji[item.status]}</span>
                      <span className="text-xs flex-1">{item.name}</span>
                      <select value={item.status} onChange={e => changeStatus(item.id, e.target.value as PantryItem["status"])}
                        className="text-[10px] bg-background border border-border rounded px-1 py-0.5">
                        <option value="cheio">Cheio</option>
                        <option value="acabando">Acabando</option>
                        <option value="acabou">Acabou</option>
                      </select>
                      <button onClick={() => setPantry(prev => prev.filter(p => p.id !== item.id))} className="opacity-0 group-hover:opacity-100">
                        <X className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="bg-card rounded-xl border border-border p-3">
            <div className="flex gap-2">
              <select value={newCat} onChange={e => setNewCat(e.target.value as typeof categories[number])}
                className="text-xs bg-background border border-border rounded px-2 h-8">
                {categories.map(c => <option key={c} value={c}>{pantryCategoryLabel[c]}</option>)}
              </select>
              <Input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="Produto..." className="text-xs h-8 flex-1"
                onKeyDown={e => e.key === "Enter" && addPantryItem()} />
              <Button size="sm" className="h-8" onClick={addPantryItem}><Plus className="w-3 h-3" /></Button>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-card rounded-xl border border-border p-3 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold">🛒 Lista de Compras</h4>
            {shopping.some(s => s.checked) && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={clearChecked}>Limpar comprados</Button>
            )}
          </div>
          {shopping.map(item => (
            <div key={item.id} className={`flex items-center gap-2 p-2 rounded-lg border ${item.checked ? "bg-green-500/10 border-green-500/20" : "bg-muted/30 border-border"}`}>
              <button onClick={() => checkShoppingItem(item.id)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${item.checked ? "bg-green-500 border-green-500" : "border-muted-foreground/30"}`}>
                {item.checked && <Check className="w-3 h-3 text-white" />}
              </button>
              <span className={`text-xs flex-1 ${item.checked ? "line-through text-muted-foreground" : ""}`}>{item.name}</span>
              {item.fromPantry && <span className="text-[9px] bg-primary/10 text-primary px-1 rounded">Despensa</span>}
              <button onClick={() => setShopping(prev => prev.filter(s => s.id !== item.id))}><X className="w-3 h-3 text-muted-foreground" /></button>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <Input value={newShopItem} onChange={e => setNewShopItem(e.target.value)} placeholder="Adicionar item..." className="text-xs h-8 flex-1"
              onKeyDown={e => e.key === "Enter" && addShoppingItem()} />
            <Button size="sm" className="h-8" onClick={addShoppingItem}><Plus className="w-3 h-3" /></Button>
          </div>
          {shopping.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Lista vazia! 🎉</p>}
        </div>
      )}
    </div>
  );
};

export default SmartPantry;
