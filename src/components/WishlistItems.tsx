import { useState } from "react";
import { Plus, Trash2, ShoppingCart, TrendingUp, Calendar, Heart, AlertTriangle, ExternalLink, ImagePlus, Link2, Loader2, Link, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

interface WishlistItem {
  id: string;
  name: string;
  price: number;
  savedAmount: number;
  priority: "alta" | "media" | "baixa";
  category: string;
  link?: string;
  imageUrl?: string;
  targetDate?: string;
}

interface WishlistItemsProps {
  items: WishlistItem[];
  setItems: (items: WishlistItem[]) => void;
  monthlyBudget: number;
  totalExpenses: number;
  totalDebts: number;
  monthlyInstallments: number;
  fixedExpenses?: any[];
  dueDays?: any[];
}

const priorityConfig = {
  alta: { label: "Alta", color: "bg-red-500", dot: "bg-red-400" },
  media: { label: "Média", color: "bg-amber-500", dot: "bg-amber-400" },
  baixa: { label: "Baixa", color: "bg-emerald-500", dot: "bg-emerald-400" },
};

const categories = ["Eletrônicos", "Vestuário", "Casa", "Lazer", "Viagem", "Educação", "Saúde", "Outros"];

// ── URL Import (same pattern as Biblioteca) ──
const ImportFromUrl = ({ onImport }: { onImport: (data: { title: string; image: string; price: number; url: string }) => void }) => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchMetadata = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('fetch-product-metadata', { body: { url: url.trim() } });
      if (data?.success && data.data) {
        onImport({
          title: data.data.title || "",
          image: data.data.image || "",
          price: data.data.price || 0,
          url: url.trim(),
        });
        setUrl("");
      }
    } catch (err) {
      console.error('Failed to fetch product metadata:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border-2 border-dashed border-pink-300 dark:border-pink-700 bg-pink-50/50 dark:bg-pink-950/20 p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-pink-700 dark:text-pink-400 mb-2 flex items-center gap-1">
        <Link className="w-3 h-3" /> IMPORTAR DE URL (AMAZON, MERCADO LIVRE...)
      </p>
      <div className="flex gap-1.5">
        <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="Cole o link do produto aqui..."
          className="h-8 text-xs flex-1" onKeyDown={e => e.key === "Enter" && fetchMetadata()} />
        <Button size="sm" className="h-8 px-3 bg-pink-500 hover:bg-pink-600 text-white" onClick={fetchMetadata} disabled={loading || !url.trim()}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link className="w-3 h-3" />}
        </Button>
      </div>
    </div>
  );
};

export const WishlistItems = ({ items: rawItems, setItems, monthlyBudget, totalExpenses, totalDebts, monthlyInstallments, fixedExpenses = [], dueDays = [] }: WishlistItemsProps) => {
  // Defensive: normalize items so missing/invalid price/savedAmount don't crash the UI
  const items: WishlistItem[] = (Array.isArray(rawItems) ? rawItems : []).map((i: any) => ({
    ...i,
    price: Number(i?.price) || 0,
    savedAmount: Number(i?.savedAmount) || 0,
  }));
  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState<Partial<WishlistItem>>({
    priority: "media",
    category: "Outros",
    savedAmount: 0,
  });
  const [addAmounts, setAddAmounts] = useState<Record<string, string>>({});

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isNew: boolean, itemId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (isNew) {
        setNewItem({ ...newItem, imageUrl: dataUrl });
      } else if (itemId) {
        setItems(items.map(i => i.id === itemId ? { ...i, imageUrl: dataUrl } : i));
      }
    };
    reader.readAsDataURL(file);
  };

  const addItem = () => {
    if (!newItem.name || !newItem.price) return;
    const item: WishlistItem = {
      id: Date.now().toString(),
      name: newItem.name,
      price: newItem.price,
      savedAmount: newItem.savedAmount || 0,
      priority: newItem.priority || "media",
      category: newItem.category || "Outros",
      link: newItem.link,
      imageUrl: newItem.imageUrl,
      targetDate: newItem.targetDate,
    };
    setItems([...items, item]);
    setNewItem({ priority: "media", category: "Outros", savedAmount: 0 });
    setShowForm(false);
  };

  const deleteItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const addToSaved = (id: string) => {
    const amount = parseFloat(addAmounts[id] || "0");
    if (amount <= 0) return;
    setItems(items.map(i => i.id === id ? { ...i, savedAmount: Math.min(i.savedAmount + amount, i.price) } : i));
    setAddAmounts({ ...addAmounts, [id]: "" });
  };

  const totalWishlistValue = items.reduce((sum, i) => sum + i.price, 0);
  const totalSaved = items.reduce((sum, i) => sum + i.savedAmount, 0);
  const remainingToSave = totalWishlistValue - totalSaved;
  const overallProgress = totalWishlistValue > 0 ? (totalSaved / totalWishlistValue) * 100 : 0;
  
  // Forecast logic (same as Dashboard)
  const forecast = (() => {
    const now = new Date();
    const day = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remainingDays = daysInMonth - day;
    const fixedCostsRecorded = fixedExpenses.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0);
    const variableSpent = Math.max(0, totalExpenses - fixedCostsRecorded);
    const dailyVariableRate = day > 0 ? variableSpent / day : 0;
    const projectedVariableRemaining = dailyVariableRate * remainingDays;
    const unpaidBillsCount = dueDays.reduce((sum: number, d: any) => sum + (Array.isArray(d?.bills) ? d.bills.filter((b: any) => !b?.paid).length : 0), 0);
    const avgBillValue = fixedExpenses.length > 0 ? fixedCostsRecorded / fixedExpenses.length : 0;
    const unpaidBillsEstimate = unpaidBillsCount * avgBillValue;
    const projectedBalance = monthlyBudget - totalExpenses - unpaidBillsEstimate - projectedVariableRemaining;
    return { projectedBalance, remainingDays, totalExpenses, unpaidBillsEstimate, projectedVariableRemaining, fixedCostsRecorded, variableSpent, unpaidBillsCount };
  })();

  const projectedAvailable = Math.max(0, forecast.projectedBalance);
  const savingsForWishlist = projectedAvailable * 0.3;
  const monthsToComplete = savingsForWishlist > 0 ? Math.ceil(remainingToSave / savingsForWishlist) : 0;
  const canAffordWithoutDebt = forecast.projectedBalance > 0;

  const sortedItems = [...items].sort((a, b) => {
    const priorityOrder = { alta: 0, media: 1, baixa: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <div className="space-y-5">
      {/* Header Stats — 2x2 grid like reference */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-4 h-4 text-pink-400" />
            <p className="text-[10px] text-muted-foreground">Total de Desejos</p>
          </div>
          <p className="text-lg font-bold">R$ {totalWishlistValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <p className="text-[10px] text-muted-foreground">Já Guardado</p>
          </div>
          <p className="text-lg font-bold text-emerald-400">R$ {totalSaved.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="w-4 h-4 text-orange-400" />
            <p className="text-[10px] text-muted-foreground">Falta Guardar</p>
          </div>
          <p className="text-lg font-bold text-orange-400">R$ {remainingToSave.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-blue-400" />
            <p className="text-[10px] text-muted-foreground">Tempo Estimado</p>
          </div>
          <p className="text-lg font-bold text-blue-400">
            {monthsToComplete > 0 ? `${monthsToComplete} meses` : "—"}
          </p>
          {monthsToComplete > 0 && (
            <p className="text-[9px] text-muted-foreground">30% do saldo livre</p>
          )}
        </div>
      </div>

      {/* Budget compatibility alert — only when user has financial data */}
      {(monthlyBudget === 0 && totalExpenses === 0) ? null : canAffordWithoutDebt ? (
        <div className="rounded-xl p-3 border bg-emerald-500/10 border-emerald-500/30">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
            <div className="w-full">
              <p className="text-xs font-semibold">✅ Seus desejos cabem no orçamento!</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Previsão fim do mês: R$ {Math.round(forecast.projectedBalance).toLocaleString("pt-BR")} → R$ {Math.round(savingsForWishlist).toLocaleString("pt-BR")}/mês para desejos (30%)
              </p>
              <div className="mt-2 pt-2 border-t border-emerald-500/20 space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium">Como chegamos nesse valor:</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                  <span className="text-muted-foreground">Receita</span>
                  <span className="text-right text-emerald-400">+ R$ {monthlyBudget.toLocaleString("pt-BR")}</span>
                  <span className="text-muted-foreground">Gastos atuais</span>
                  <span className="text-right text-red-400">- R$ {forecast.totalExpenses.toLocaleString("pt-BR")}</span>
                  {forecast.unpaidBillsCount > 0 && (
                    <>
                      <span className="text-muted-foreground">Contas pendentes ({forecast.unpaidBillsCount})</span>
                      <span className="text-right text-orange-400">- R$ {Math.round(forecast.unpaidBillsEstimate).toLocaleString("pt-BR")}</span>
                    </>
                  )}
                  {forecast.projectedVariableRemaining > 0 && (
                    <>
                      <span className="text-muted-foreground">Projeção variável ({forecast.remainingDays}d)</span>
                      <span className="text-right text-orange-400">- R$ {Math.round(forecast.projectedVariableRemaining).toLocaleString("pt-BR")}</span>
                    </>
                  )}
                  <span className="text-muted-foreground font-semibold border-t border-border pt-0.5 mt-0.5">Saldo projetado</span>
                  <span className={`text-right font-semibold border-t border-border pt-0.5 mt-0.5 ${forecast.projectedBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    R$ {Math.round(forecast.projectedBalance).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-3 border bg-destructive/10 border-destructive/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="w-full">
              <p className="text-xs font-semibold">⚠️ Previsão aponta saldo negativo no fim do mês</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Saldo projetado: -R$ {Math.abs(Math.round(forecast.projectedBalance)).toLocaleString("pt-BR")}. Foque em reduzir gastos primeiro.
              </p>
              <div className="mt-2 pt-2 border-t border-destructive/20 space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium">Detalhamento:</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                  <span className="text-muted-foreground">Receita</span>
                  <span className="text-right text-emerald-400">+ R$ {monthlyBudget.toLocaleString("pt-BR")}</span>
                  <span className="text-muted-foreground">Gastos atuais</span>
                  <span className="text-right text-red-400">- R$ {forecast.totalExpenses.toLocaleString("pt-BR")}</span>
                  {forecast.unpaidBillsCount > 0 && (
                    <>
                      <span className="text-muted-foreground">Contas pendentes ({forecast.unpaidBillsCount})</span>
                      <span className="text-right text-orange-400">- R$ {Math.round(forecast.unpaidBillsEstimate).toLocaleString("pt-BR")}</span>
                    </>
                  )}
                  {forecast.projectedVariableRemaining > 0 && (
                    <>
                      <span className="text-muted-foreground">Projeção variável ({forecast.remainingDays}d)</span>
                      <span className="text-right text-orange-400">- R$ {Math.round(forecast.projectedVariableRemaining).toLocaleString("pt-BR")}</span>
                    </>
                  )}
                  <span className="text-muted-foreground font-semibold border-t border-border pt-0.5 mt-0.5">Saldo projetado</span>
                  <span className="text-right font-semibold border-t border-border pt-0.5 mt-0.5 text-red-400">
                    -R$ {Math.abs(Math.round(forecast.projectedBalance)).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Button */}
      <Button
        data-spotlight="add-wish"
        onClick={() => setShowForm(!showForm)}
        className="w-full h-10 bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500 text-white border-0"
      >
        <Plus className="w-4 h-4 mr-2" /> Adicionar Desejo
      </Button>

      {/* Add Form */}
      {showForm && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Novo Desejo</h3>

          {/* Import from URL */}
          <ImportFromUrl onImport={(data) => setNewItem(prev => ({
            ...prev,
            name: data.title || prev.name,
            imageUrl: data.image || prev.imageUrl,
            price: data.price || prev.price,
            link: data.url || prev.link,
          }))} />
          
          {/* Image preview / upload */}
          <div className="flex items-center gap-3">
            {newItem.imageUrl ? (
              <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border flex-shrink-0 bg-muted flex items-center justify-center">
                <img src={newItem.imageUrl} alt="" className="max-w-full max-h-full object-contain" />

                <button
                  onClick={() => setNewItem({ ...newItem, imageUrl: undefined })}
                  className="absolute top-0 right-0 bg-black/60 text-white rounded-bl p-0.5"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-pink-400 transition-colors flex-shrink-0">
                <ImagePlus className="w-5 h-5 text-muted-foreground" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, true)} />
              </label>
            )}
            <div className="flex-1 space-y-2">
              <Input placeholder="Nome do item" value={newItem.name || ""} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="h-8 text-xs" />
              <Input type="number" placeholder="Preço (R$)" value={newItem.price || ""} onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Link do produto (opcional)"
              value={newItem.link || ""}
              onChange={(e) => setNewItem({ ...newItem, link: e.target.value })}
              className="h-8 text-xs col-span-2"
            />
            <select value={newItem.priority} onChange={(e) => setNewItem({ ...newItem, priority: e.target.value as any })} className="h-8 text-xs rounded-md border border-input bg-background px-2">
              <option value="alta">🔴 Alta</option>
              <option value="media">🟡 Média</option>
              <option value="baixa">🟢 Baixa</option>
            </select>
            <select value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} className="h-8 text-xs rounded-md border border-input bg-background px-2">
              {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
            <Input
              type={newItem.targetDate ? "date" : "text"}
              placeholder="Data alvo"
              value={newItem.targetDate || ""}
              onFocus={(e) => { e.currentTarget.type = "date"; }}
              onBlur={(e) => { if (!e.currentTarget.value) e.currentTarget.type = "text"; }}
              onChange={(e) => setNewItem({ ...newItem, targetDate: e.target.value })}
              className="h-8 text-xs"
            />

            <Input type="number" placeholder="Já guardei (R$)" value={newItem.savedAmount || ""} onChange={(e) => setNewItem({ ...newItem, savedAmount: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={addItem} className="h-8 text-xs flex-1 bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500 text-white border-0">
              Salvar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="h-8 text-xs">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Items Grid */}
      {sortedItems.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-10 text-center">
          <Heart className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum desejo na lista ainda</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Adicione algo que você quer conquistar!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sortedItems.map((item) => {
            const progress = (item.savedAmount / item.price) * 100;
            const remaining = item.price - item.savedAmount;
            const isComplete = progress >= 100;
            const priorityCfg = priorityConfig[item.priority];

            return (
              <div
                key={item.id}
                className={`bg-card rounded-xl border overflow-hidden transition-all hover:shadow-md ${
                  isComplete ? "border-emerald-500/40" : "border-border"
                }`}
              >
                {/* Image */}
                {item.imageUrl ? (
                  <div className="relative h-36 w-full overflow-hidden bg-muted flex items-center justify-center">
                    <img src={item.imageUrl} alt={item.name} className="max-w-full max-h-full object-contain" />

                    {isComplete && (
                      <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                        <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">✓ CONQUISTADO</span>
                      </div>
                    )}
                    {/* Priority dot */}
                    <div className={`absolute top-2 left-2 w-2.5 h-2.5 rounded-full ${priorityCfg.dot} ring-2 ring-black/20`} />
                  </div>
                ) : (
                  <div className="relative h-24 w-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                    <label className="cursor-pointer flex flex-col items-center gap-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                      <ImagePlus className="w-6 h-6" />
                      <span className="text-[9px]">Adicionar foto</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, false, item.id)} />
                    </label>
                    {isComplete && (
                      <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                        <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">✓ CONQUISTADO</span>
                      </div>
                    )}
                    <div className={`absolute top-2 left-2 w-2.5 h-2.5 rounded-full ${priorityCfg.dot} ring-2 ring-black/20`} />
                  </div>
                )}

                {/* Content */}
                <div className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{item.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{item.category}</span>
                        {item.targetDate && (
                          <span className="text-[10px] text-muted-foreground">📅 {new Date(item.targetDate).toLocaleDateString("pt-BR")}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {item.link && (
                        <a href={item.link} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-muted transition-colors">
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                        </a>
                      )}
                      <button onClick={() => deleteItem(item.id)} className="p-1 rounded hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </div>

                  {/* Price + Progress */}
                  <div>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-base font-bold">R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      <span className="text-[10px] font-medium text-muted-foreground">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isComplete ? "bg-emerald-500" : "bg-gradient-to-r from-pink-500 to-rose-400"
                        }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-[10px]">
                      <span className="text-emerald-400">Guardado: R$ {item.savedAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      {remaining > 0 && <span className="text-orange-400">Falta: R$ {remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
                    </div>
                  </div>

                  {/* Estimated time */}
                  {!isComplete && savingsForWishlist > 0 && remaining > 0 && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      ⏱ Estimativa: <span className="font-medium text-foreground">
                        {Math.ceil(remaining / savingsForWishlist) === 1 
                          ? "1 mês" 
                          : `${Math.ceil(remaining / savingsForWishlist)} meses`}
                      </span>
                    </p>
                  )}

                  {/* Add amount */}
                  {!isComplete && (
                    <div className="flex gap-1.5">
                      <Input
                        type="number"
                        placeholder="+ Valor"
                        value={addAmounts[item.id] || ""}
                        onChange={(e) => setAddAmounts({ ...addAmounts, [item.id]: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && addToSaved(item.id)}
                        className="h-7 text-[11px] flex-1"
                      />
                      <Button size="sm" onClick={() => addToSaved(item.id)} className="h-7 text-[10px] px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                        Guardar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
