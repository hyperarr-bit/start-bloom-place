import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, X, ShoppingCart, Package, AlertTriangle, DollarSign } from "lucide-react";
import { type Product, calculateCostPerDose, getExpiryProgress } from "./utils";

const genId = () => crypto.randomUUID();

const categories = ["Skincare", "Cabelo", "Maquiagem", "Corpo", "Unhas", "Outro"];
const catEmoji: Record<string, string> = { Skincare: "🧴", Cabelo: "💇", Maquiagem: "💄", Corpo: "🧼", Unhas: "💅", Outro: "✨" };
const paoOptions = [3, 6, 9, 12, 18, 24];
const frequencyOptions = ["Diário", "2x por semana", "3x por semana", "Semanal", "Eventual"];

const emptyProduct: Partial<Product> = { category: "Skincare", opened: false, rating: 0, repurchase: false, price: 0, sizeMl: 0, paoMonths: 12, frequency: "Diário", finished: false, photoUrl: "", openedDate: "" };

export const ProductInventory = () => {
  const [products, setProducts] = usePersistedState<Product[]>("beauty-products", []);
  const [shoppingList, setShoppingList] = usePersistedState<Product[]>("beauty-shopping-list", []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Product>>({ ...emptyProduct });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showShopping, setShowShopping] = useState(false);

  const activeProducts = products.filter(p => !p.finished);
  const expiringSoon = activeProducts.filter(p => {
    if (!p.openedDate || !p.paoMonths) return false;
    const { daysLeft } = getExpiryProgress(p.openedDate, p.paoMonths);
    return daysLeft > 0 && daysLeft < 30;
  });

  const save = () => {
    if (!form.name) return;
    const product: Product = {
      id: genId(), name: form.name || "", category: form.category || "Outro", brand: form.brand || "",
      opened: !!form.openedDate, openedDate: form.openedDate || "", paoMonths: form.paoMonths || 12,
      expiry: form.expiry || "", notes: form.notes || "", rating: form.rating || 0,
      repurchase: form.repurchase || false, price: form.price || 0, sizeMl: form.sizeMl || 0,
      photoUrl: form.photoUrl || "", frequency: form.frequency || "Diário", finished: false,
    };
    setProducts(prev => [...prev, product]);
    setForm({ ...emptyProduct });
    setShowForm(false);
  };

  const markFinished = (p: Product) => {
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, finished: true } : x));
    setShoppingList(prev => [...prev, { ...p, id: genId(), finished: false }]);
  };

  const removeFromShopping = (id: string) => setShoppingList(prev => prev.filter(x => x.id !== id));

  const costPerDose = (p: Product) => p.price && p.sizeMl ? calculateCostPerDose(p.price, p.sizeMl, p.category) : null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-sm">Inventário de Produtos</h3>
          <p className="text-[10px] text-muted-foreground">{activeProducts.length} ativos</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowShopping(true)} className="relative">
            <ShoppingCart className="w-4 h-4" />
            {shoppingList.length > 0 && <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{shoppingList.length}</span>}
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1" /> Novo</Button>
        </div>
      </div>

      {/* Expiring soon */}
      {expiringSoon.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-500/10">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <p className="text-xs font-bold text-amber-700">Vencendo em breve</p>
            </div>
            {expiringSoon.map(p => {
              const { daysLeft } = getExpiryProgress(p.openedDate, p.paoMonths);
              return <p key={p.id} className="text-[10px] text-amber-600 pl-5">⏰ {p.name} — {daysLeft} dias restantes. Use agora!</p>;
            })}
          </CardContent>
        </Card>
      )}

      {/* Category summary */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(c => {
          const count = activeProducts.filter(p => p.category === c).length;
          if (!count) return null;
          return <Badge key={c} variant="secondary" className="text-[10px]">{catEmoji[c]} {c}: {count}</Badge>;
        })}
      </div>

      {/* Add form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <Input placeholder="Nome do produto" value={form.name || ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="h-9 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Marca" value={form.brand || ""} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} className="h-9 text-sm" />
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{catEmoji[c]} {c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Preço (R$)</label>
                <Input type="number" placeholder="0.00" value={form.price || ""} onChange={e => setForm(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Tamanho (ml/g)</label>
                <Input type="number" placeholder="0" value={form.sizeMl || ""} onChange={e => setForm(p => ({ ...p, sizeMl: parseFloat(e.target.value) || 0 }))} className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Data de Abertura</label>
                <Input type="date" value={form.openedDate || ""} onChange={e => setForm(p => ({ ...p, openedDate: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">PAO (meses)</label>
                <Select value={String(form.paoMonths || 12)} onValueChange={v => setForm(p => ({ ...p, paoMonths: parseInt(v) }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{paoOptions.map(m => <SelectItem key={m} value={String(m)}>{m}M</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Frequência de uso</label>
              <Select value={form.frequency || "Diário"} onValueChange={v => setForm(p => ({ ...p, frequency: v }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{frequencyOptions.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input placeholder="URL da foto do produto (opcional)" value={form.photoUrl || ""} onChange={e => setForm(p => ({ ...p, photoUrl: e.target.value }))} className="h-9 text-sm" />
            <Textarea placeholder="Notas (como usar, resultados...)" value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="text-sm min-h-[50px]" />
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox checked={form.repurchase} onCheckedChange={v => setForm(p => ({ ...p, repurchase: !!v }))} /> Recomprar quando acabar
            </label>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={save}>Salvar</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product list */}
      <div className="space-y-2">
        {activeProducts.map(p => {
          const cpd = costPerDose(p);
          const expiry = p.openedDate && p.paoMonths ? getExpiryProgress(p.openedDate, p.paoMonths) : null;
          return (
            <Card key={p.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setSelectedProduct(p)}>
              <CardContent className="p-3 flex items-center gap-3">
                {p.photoUrl ? (
                  <img src={p.photoUrl} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <span className="text-xl w-10 text-center">{catEmoji[p.category] || "✨"}</span>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm">{p.name}</h4>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {p.brand && <span className="text-[10px] text-muted-foreground">{p.brand}</span>}
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{p.category}</Badge>
                    {cpd !== null && <Badge variant="secondary" className="text-[9px] px-1 py-0">R$ {cpd.toFixed(2)}/dose</Badge>}
                    {p.repurchase && <Badge className="text-[8px] px-1 py-0 bg-green-500/20 text-green-700 border-green-300">🔄</Badge>}
                  </div>
                  {expiry && (
                    <div className="mt-1">
                      <div className="h-1 bg-muted rounded-full overflow-hidden w-full max-w-[120px]">
                        <div className={`h-full rounded-full transition-all ${expiry.daysLeft < 15 ? "bg-destructive" : expiry.daysLeft < 30 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${Math.min(100, expiry.percent)}%` }} />
                      </div>
                      <span className="text-[9px] text-muted-foreground">{expiry.expired ? "Vencido!" : `${expiry.daysLeft}d restantes`}</span>
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={e => { e.stopPropagation(); markFinished(p); }}>
                  <Package className="w-3 h-3 text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {activeProducts.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Nenhum produto cadastrado. 🧴</p>}

      {/* Product detail modal */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-sm">
          {selectedProduct && (() => {
            const p = selectedProduct;
            const cpd = costPerDose(p);
            const expiry = p.openedDate && p.paoMonths ? getExpiryProgress(p.openedDate, p.paoMonths) : null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span>{catEmoji[p.category]}</span> {p.name}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  {p.photoUrl && <img src={p.photoUrl} alt={p.name} className="w-full h-40 rounded-xl object-cover" />}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground text-xs">Marca</span><p className="font-medium">{p.brand || "—"}</p></div>
                    <div><span className="text-muted-foreground text-xs">Categoria</span><p className="font-medium">{p.category}</p></div>
                    <div><span className="text-muted-foreground text-xs">Preço</span><p className="font-medium">{p.price ? `R$ ${p.price.toFixed(2)}` : "—"}</p></div>
                    <div><span className="text-muted-foreground text-xs">Tamanho</span><p className="font-medium">{p.sizeMl ? `${p.sizeMl} ml` : "—"}</p></div>
                    <div><span className="text-muted-foreground text-xs">Frequência</span><p className="font-medium">{p.frequency}</p></div>
                    {cpd !== null && <div><span className="text-muted-foreground text-xs">Custo/dose</span><p className="font-medium text-primary">R$ {cpd.toFixed(2)}</p></div>}
                  </div>
                  {expiry && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Validade (PAO {p.paoMonths}M)</p>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${expiry.daysLeft < 15 ? "bg-destructive" : expiry.daysLeft < 30 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${Math.min(100, expiry.percent)}%` }} />
                      </div>
                      <p className="text-[10px] mt-0.5 text-muted-foreground">{expiry.expired ? "⚠️ Produto vencido!" : `${expiry.daysLeft} dias restantes`} • Aberto em {p.openedDate}</p>
                    </div>
                  )}
                  {p.notes && <div><span className="text-muted-foreground text-xs">Notas</span><p className="text-sm">{p.notes}</p></div>}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { markFinished(p); setSelectedProduct(null); }}>
                      <Package className="w-3.5 h-3.5 mr-1" /> Acabou
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { setProducts(prev => prev.filter(x => x.id !== p.id)); setSelectedProduct(null); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Shopping list modal */}
      <Dialog open={showShopping} onOpenChange={setShowShopping}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>🛒 Compras Futuras</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {shoppingList.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto na lista</p>}
            {shoppingList.map(p => (
              <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                <span>{catEmoji[p.category]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.brand} • {p.price ? `R$ ${p.price.toFixed(2)}` : ""}</p>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFromShopping(p.id)}><X className="w-3 h-3" /></Button>
              </div>
            ))}
            {shoppingList.length > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">Total estimado: <span className="font-bold text-foreground">R$ {shoppingList.reduce((s, p) => s + (p.price || 0), 0).toFixed(2)}</span></p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
