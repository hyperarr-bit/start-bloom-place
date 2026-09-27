import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, ShoppingCart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { adicionarDaDespensa, devolverADespensa, retirarDaDespensa, type CategoriaMercado } from "@/lib/mercado";
import { PantryItem, ShoppingItem, pantryCategoryEmoji, pantryCategoryLabel, statusEmoji } from "./types";

const categories = ["geladeira", "armario", "limpeza", "banheiro"] as const;

const categoryColors: Record<string, { header: string; body: string }> = {
  geladeira: { header: "bg-blue-200 dark:bg-blue-900/60", body: "bg-blue-50 dark:bg-blue-950/30" },
  armario: { header: "bg-amber-200 dark:bg-amber-900/60", body: "bg-amber-50 dark:bg-amber-950/30" },
  limpeza: { header: "bg-green-200 dark:bg-green-900/60", body: "bg-green-50 dark:bg-green-950/30" },
  banheiro: { header: "bg-pink-200 dark:bg-pink-900/60", body: "bg-pink-50 dark:bg-pink-950/30" },
};

const SmartPantry = ({ onAbrirMercado }: { onAbrirMercado?: () => void } = {}) => {
  const [pantry, setPantry] = usePersistedState<PantryItem[]>("casa-pantry", []);
  const [shopping, setShopping] = usePersistedState<ShoppingItem[]>("casa-shopping-list", []);
  // "Acabou" vai pra lista do Mercado (a mesma da aba MERCADO e da Dieta)
  const [mercado, setMercado] = usePersistedState<CategoriaMercado[]>("casa-grocery-categories", []);
  const [newItems, setNewItems] = useState<Record<string, string>>({});
  const [newShopItem, setNewShopItem] = useState("");
  const [view, setView] = useState<"pantry" | "shopping">("pantry");

  const addPantryItem = (cat: typeof categories[number]) => {
    const val = newItems[cat]?.trim();
    if (!val) return;
    setPantry(prev => [...prev, { id: Date.now().toString(), name: val, category: cat, status: "cheio" }]);
    setNewItems(prev => ({ ...prev, [cat]: "" }));
  };

  const changeStatus = (id: string, status: PantryItem["status"]) => {
    if (status === "acabou") {
      const item = pantry.find(p => p.id === id);
      setPantry(prev => prev.filter(p => p.id !== id));
      if (!item) return;
      /* Vai pro MERCADO (26/09, varredura): antes caía na lista "Compras" aqui
         da Despensa e a dica do módulo prometia a Lista de Compras. O item leva
         o canto de origem e volta pra ele quando for marcado como comprado. */
      const r = adicionarDaDespensa(mercado, item.name, item.category);
      setMercado(r.lista);
      const ver = onAbrirMercado ? { action: { label: "Ver", onClick: onAbrirMercado } } : {};
      if (r.entrou) toast.success(`${item.name} foi pra lista do Mercado (${r.categoria})`, ver);
      else toast(`${item.name} já está na lista do Mercado`, ver);
    } else {
      setPantry(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    }
  };

  const checkShoppingItem = (id: string) => {
    const item = shopping.find(s => s.id === id);
    if (!item) return;
    const marcando = !item.checked;
    let devolvidoId = item.devolvidoId;
    if (item.fromPantry) {
      /* Volta pra categoria de ONDE SAIU (07/09, avaliação: "os itens voltam
         todos para o armário"). "armario" só como fallback pra item que entrou
         na lista antes de existir a origem. Desmarcar tira de novo (26/09,
         varredura: marcar/desmarcar/marcar punha "Leite" 2x na despensa). */
      const category: PantryItem["category"] = item.origemCategory ?? "armario";
      if (marcando) {
        const r = devolverADespensa(pantry, item.name, category);
        setPantry(r.despensa);
        devolvidoId = r.id;
      } else {
        setPantry(retirarDaDespensa(pantry, item.devolvidoId));
        devolvidoId = undefined;
      }
    }
    setShopping(prev => prev.map(s => {
      if (s.id !== id) return s;
      const novo: ShoppingItem = { ...s, checked: marcando };
      if (devolvidoId) novo.devolvidoId = devolvidoId; else delete novo.devolvidoId;
      return novo;
    }));
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
        <div className="space-y-3">
          {categories.map(cat => {
            const items = pantry.filter(p => p.category === cat);
            const colors = categoryColors[cat];
            return (
              <div key={cat} className="rounded-xl overflow-hidden border border-border">
                <div className={`${colors.header} px-3 py-2 flex items-center justify-between`}>
                  <h4 className="text-xs font-bold text-foreground">{pantryCategoryEmoji[cat]} {pantryCategoryLabel[cat].toUpperCase()}</h4>
                  <span className="text-[10px] text-muted-foreground font-medium">{items.length} itens</span>
                </div>
                <div className={`${colors.body} p-2 space-y-1`}>
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-background/50 group">
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
                  {items.length === 0 && (
                    <p className="text-[11px] text-muted-foreground italic py-2 text-center">Nenhum produto ainda</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Input
                      value={newItems[cat] || ""}
                      onChange={e => setNewItems(prev => ({ ...prev, [cat]: e.target.value }))}
                      placeholder="Adicionar produto..."
                      className="text-xs h-7 flex-1 bg-background/70"
                      onKeyDown={e => e.key === "Enter" && addPantryItem(cat)}
                    />
                    <Button size="sm" className="h-7 px-2" onClick={() => addPantryItem(cat)}><Plus className="w-3 h-3" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border">
          <div className="bg-emerald-200 dark:bg-emerald-900/60 px-3 py-2 flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground">🛒 LISTA DE COMPRAS</h4>
            {shopping.some(s => s.checked) && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={clearChecked}>Limpar comprados</Button>
            )}
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/30 p-2 space-y-1.5">
            <p className="text-[10px] text-muted-foreground px-1">
              O que acaba na despensa vai pra lista do Mercado.
              {onAbrirMercado && <button type="button" onClick={onAbrirMercado} className="ml-1 font-bold text-primary underline underline-offset-2">Ver Mercado</button>}
            </p>
            {shopping.map(item => (
              <div key={item.id} className={`flex items-center gap-2 p-2 rounded-lg border ${item.checked ? "bg-green-500/10 border-green-500/20" : "bg-background/50 border-border"}`}>
                <button onClick={() => checkShoppingItem(item.id)} aria-label={`${item.checked ? "Desmarcar" : "Comprei"} ${item.name}`}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${item.checked ? "bg-green-500 border-green-500" : "border-muted-foreground/30"}`}>
                  {item.checked && <Check className="w-3 h-3 text-white" />}
                </button>
                <span className={`text-xs flex-1 ${item.checked ? "line-through text-muted-foreground" : ""}`}>{item.name}</span>
                {item.fromPantry && <span className="text-[9px] bg-primary/10 text-primary px-1 rounded">Despensa</span>}
                <button onClick={() => setShopping(prev => prev.filter(s => s.id !== item.id))}><X className="w-3 h-3 text-muted-foreground" /></button>
              </div>
            ))}
            {shopping.length === 0 && <p className="text-[11px] text-muted-foreground italic py-4 text-center">Lista vazia! 🎉</p>}
            <div className="flex gap-2 pt-1">
              <Input value={newShopItem} onChange={e => setNewShopItem(e.target.value)} placeholder="Adicionar item..." className="text-xs h-7 flex-1 bg-background/70"
                onKeyDown={e => e.key === "Enter" && addShoppingItem()} />
              <Button size="sm" className="h-7 px-2" onClick={addShoppingItem}><Plus className="w-3 h-3" /></Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartPantry;
