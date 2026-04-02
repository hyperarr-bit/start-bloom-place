import { useState } from "react";
import { CreditCard, Plus, Trash2, Pencil, Check, X, Calendar, ShoppingBag } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";

interface Card {
  id: string;
  name: string;
  brand: string;
  limit: number;
  closingDay: number;
  bestPurchaseDay: number;
}

interface CreditCardsProps {
  expenses: { paymentMethod: string; cardName?: string; value: number; date?: string }[];
}

const brands = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "elo", label: "Elo" },
  { value: "amex", label: "American Express" },
  { value: "hipercard", label: "Hipercard" },
];

const cardColors: Record<string, string> = {
  nubank: "from-purple-600 to-purple-800",
  inter: "from-orange-500 to-orange-700",
  itau: "from-blue-600 to-blue-800",
  bradesco: "from-red-600 to-red-800",
  santander: "from-red-500 to-red-700",
  c6: "from-gray-700 to-gray-900",
  bb: "from-yellow-500 to-yellow-700",
  caixa: "from-blue-500 to-blue-700",
  neon: "from-cyan-500 to-cyan-700",
  picpay: "from-green-500 to-green-700",
};

export const CreditCards = ({ expenses }: CreditCardsProps) => {
  const [cards, setCards] = usePersistedState<Card[]>("finance-credit-cards", []);
  const [adding, setAdding] = useState(false);
  const [newCard, setNewCard] = useState({ name: "", brand: "", limit: "", closingDay: "", bestPurchaseDay: "" });

  const addCard = () => {
    if (newCard.name && newCard.limit) {
      setCards([...cards, {
        id: Date.now().toString(),
        name: newCard.name,
        brand: newCard.brand || "visa",
        limit: parseFloat(newCard.limit),
        closingDay: parseInt(newCard.closingDay) || 10,
        bestPurchaseDay: parseInt(newCard.bestPurchaseDay) || 1,
      }]);
      setNewCard({ name: "", brand: "", limit: "", closingDay: "", bestPurchaseDay: "" });
      setAdding(false);
    }
  };

  const deleteCard = (id: string) => setCards(cards.filter(c => c.id !== id));

  const getCardInvoice = (cardName: string) => {
    const key = cardName.toLowerCase().replace(/\s/g, "");
    return expenses
      .filter(e => e.paymentMethod === "credito" && e.cardName === key)
      .reduce((sum, e) => sum + e.value, 0);
  };

  const getUsageColor = (pct: number) => {
    if (pct >= 80) return "bg-red-500";
    if (pct >= 50) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getGradient = (name: string) => {
    const key = name.toLowerCase().replace(/\s/g, "");
    return cardColors[key] || "from-gray-600 to-gray-800";
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="bg-muted/40 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-bold tracking-wide uppercase">Meus Cartões</span>
          </div>
          {!adding && (
            <button onClick={() => setAdding(true)} className="text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {cards.length === 0 && !adding ? (
          <EmptyState
            icon={CreditCard}
            title="Nenhum cartão cadastrado"
            description="Adicione seus cartões de crédito para acompanhar faturas e limites"
          />
        ) : (
          <div className="p-3 space-y-3">
            {cards.map(card => {
              const invoice = getCardInvoice(card.name);
              const pct = card.limit > 0 ? (invoice / card.limit) * 100 : 0;
              const remaining = card.limit - invoice;

              return (
                <div key={card.id} className={`rounded-xl p-4 bg-gradient-to-br ${getGradient(card.name)} text-white relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/5 -translate-y-8 translate-x-8" />
                  <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full bg-white/5 translate-y-6 -translate-x-6" />
                  
                  <div className="flex items-start justify-between mb-3 relative z-10">
                    <div>
                      <p className="text-sm font-bold">{card.name}</p>
                      <p className="text-[10px] opacity-70">{brands.find(b => b.value === card.brand)?.label || card.brand}</p>
                    </div>
                    <button onClick={() => deleteCard(card.id)} className="text-white/60 hover:text-white transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 relative z-10">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="opacity-70">Fatura Atual</span>
                      <span className="font-bold">R$ {invoice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                    
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/20">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getUsageColor(pct)}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] opacity-70">
                      <span>Limite: R$ {card.limit.toLocaleString("pt-BR")}</span>
                      <span>Disponível: R$ {Math.max(0, remaining).toLocaleString("pt-BR")}</span>
                    </div>

                    <div className="flex items-center gap-4 text-[10px] opacity-70 pt-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Fecha dia {card.closingDay}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3" />
                        <span>Melhor compra dia {card.bestPurchaseDay}</span>
                      </div>
                    </div>

                    {pct >= 80 && (
                      <p className="text-[10px] font-medium text-yellow-200 mt-1">
                        ⚠ Uso acima de 80% do limite
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add card form */}
        {adding && (
          <div className="border-t border-border p-3 space-y-2">
            <p className="text-[10px] text-muted-foreground font-medium">Novo Cartão</p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Nome (ex: Nubank)"
                value={newCard.name}
                onChange={e => setNewCard({ ...newCard, name: e.target.value })}
                className="h-7 text-xs"
              />
              <Select value={newCard.brand} onValueChange={v => setNewCard({ ...newCard, brand: v })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Bandeira" /></SelectTrigger>
                <SelectContent>{brands.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Limite"
                value={newCard.limit}
                onChange={e => setNewCard({ ...newCard, limit: e.target.value })}
                className="h-7 text-xs"
              />
              <Input
                type="number"
                placeholder="Dia fechamento"
                value={newCard.closingDay}
                onChange={e => setNewCard({ ...newCard, closingDay: e.target.value })}
                className="h-7 text-xs"
                min={1}
                max={31}
              />
              <Input
                type="number"
                placeholder="Melhor dia de compra"
                value={newCard.bestPurchaseDay}
                onChange={e => setNewCard({ ...newCard, bestPurchaseDay: e.target.value })}
                className="h-7 text-xs"
                min={1}
                max={31}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={addCard} className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-md hover:opacity-90 transition-opacity">
                Adicionar
              </button>
              <button onClick={() => setAdding(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
