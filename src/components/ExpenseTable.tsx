import { useState } from "react";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Expense {
  id: string;
  description: string;
  category: string;
  value: number;
  date: string;
  paymentMethod: string;
  cardName?: string;
}

interface ExpenseTableProps {
  expenses: Expense[];
  setExpenses: (expenses: Expense[]) => void;
}

const categories = [
  { value: "alimentacao", label: "Alimentação", color: "bg-orange-100/80 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
  { value: "restaurante", label: "Restaurante", color: "bg-amber-100/80 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  { value: "mercado", label: "Mercado", color: "bg-lime-100/80 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300" },
  { value: "transporte", label: "Transporte", color: "bg-blue-100/80 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  { value: "combustivel", label: "Combustível", color: "bg-zinc-200/80 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300" },
  { value: "lazer", label: "Lazer", color: "bg-purple-100/80 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300" },
  { value: "entretenimento", label: "Entretenimento", color: "bg-pink-100/80 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300" },
  { value: "saude", label: "Saúde", color: "bg-green-100/80 text-green-700 dark:bg-green-500/15 dark:text-green-300" },
  { value: "farmacia", label: "Farmácia", color: "bg-red-100/80 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  { value: "vestuario", label: "Vestuário", color: "bg-fuchsia-100/80 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300" },
  { value: "beleza", label: "Beleza", color: "bg-rose-100/80 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  { value: "educacao", label: "Educação", color: "bg-teal-100/80 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300" },
  { value: "eletronicos", label: "Eletrônicos", color: "bg-cyan-100/80 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300" },
  { value: "servicos", label: "Serviços", color: "bg-slate-100/80 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300" },
  { value: "delivery", label: "Delivery", color: "bg-yellow-100/80 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300" },
  { value: "presente", label: "Presente", color: "bg-violet-100/80 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  { value: "casa", label: "Casa", color: "bg-stone-100/80 text-stone-700 dark:bg-stone-500/15 dark:text-stone-300" },
  { value: "pets", label: "Pets", color: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  { value: "filhos", label: "Filhos", color: "bg-sky-100/80 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  { value: "viagem", label: "Viagem", color: "bg-indigo-100/80 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" },
  { value: "outros", label: "Outros", color: "bg-gray-100/80 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300" },
];

const paymentMethods = [
  { value: "pix", label: "Pix" },
  { value: "credito", label: "Cartão de Crédito" },
  { value: "debito", label: "Cartão de Débito" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "boleto", label: "Boleto" },
];

const cardOptions = [
  { value: "nubank", label: "Nubank", color: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
  { value: "inter", label: "Inter", color: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  { value: "itau", label: "Itaú", color: "bg-blue-600/15 text-blue-700 dark:text-blue-300" },
  { value: "bradesco", label: "Bradesco", color: "bg-red-600/15 text-red-700 dark:text-red-300" },
  { value: "santander", label: "Santander", color: "bg-red-500/15 text-red-600 dark:text-red-300" },
  { value: "c6", label: "C6 Bank", color: "bg-gray-800/15 text-gray-700 dark:text-gray-300" },
  { value: "bb", label: "Banco do Brasil", color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300" },
  { value: "caixa", label: "Caixa", color: "bg-blue-500/15 text-blue-600 dark:text-blue-300" },
  { value: "neon", label: "Neon", color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300" },
  { value: "picpay", label: "PicPay", color: "bg-green-500/15 text-green-700 dark:text-green-300" },
  { value: "outro", label: "Outro", color: "bg-gray-500/15 text-gray-700 dark:text-gray-300" },
];

const isCardPayment = (method: string) => method === "credito" || method === "debito";

export const ExpenseTable = ({ expenses, setExpenses }: ExpenseTableProps) => {
  const [newExpense, setNewExpense] = useState({
    description: "", category: "", value: "", date: "", paymentMethod: "", cardName: "",
  });
  const [showMore, setShowMore] = useState(expenses.length === 0);

  const addExpense = () => {
    if (newExpense.description && newExpense.value) {
      setExpenses([
        ...expenses,
        {
          id: Date.now().toString(),
          description: newExpense.description,
          category: newExpense.category || "outros",
          value: parseFloat(newExpense.value),
          date: newExpense.date || new Date().toISOString().split("T")[0],
          paymentMethod: newExpense.paymentMethod || "pix",
          cardName: isCardPayment(newExpense.paymentMethod) ? (newExpense.cardName || "outro") : undefined,
        },
      ]);
      setNewExpense({ description: "", category: "", value: "", date: "", paymentMethod: "", cardName: "" });
      
    }
  };

  const deleteExpense = (id: string) => {
    setExpenses(expenses.filter((e) => e.id !== id));
  };

  const getCategoryStyle = (v: string) => categories.find((c) => c.value === v)?.color || "bg-gray-100/80 text-gray-700";
  const getCategoryLabel = (v: string) => categories.find((c) => c.value === v)?.label || v;
  const getCardStyle = (v: string) => cardOptions.find((c) => c.value === v)?.color || "bg-gray-500/15 text-gray-700";
  const getCardLabel = (v: string) => cardOptions.find((c) => c.value === v)?.label || v;
  const getPaymentLabel = (v: string) => paymentMethods.find((p) => p.value === v)?.label || v;

  const total = expenses.reduce((sum, e) => sum + e.value, 0);

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border animate-fade-in">
      <div className="bg-income py-2 px-4">
        <span className="font-bold text-sm text-income-foreground tracking-wide">CUSTOS VARIÁVEIS</span>
      </div>

      {/* Form sempre visível */}
      <div className="p-3 border-b border-border bg-muted/20 space-y-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="+ Novo gasto"
            value={newExpense.description}
            onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
            className="h-9 text-xs flex-1"
          />
          <Input
            type="number"
            inputMode="decimal"
            placeholder="Valor"
            value={newExpense.value}
            onChange={(e) => setNewExpense({ ...newExpense, value: e.target.value })}
            className="h-9 text-xs w-20 text-right"
          />
          <button
            onClick={addExpense}
            data-spotlight="add-expense"
            aria-label="Adicionar gasto"
            className="h-9 w-9 flex-shrink-0 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => setShowMore((s) => !s)}
          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${showMore ? "rotate-180" : ""}`} />
          {showMore ? "Menos opções" : "Mais opções (categoria, data, pagamento)"}
        </button>

        {showMore && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="min-w-0">
              <Select value={newExpense.category} onValueChange={(v) => setNewExpense({ ...newExpense, category: v })}>
                <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <label className="min-w-0 h-8 px-2 text-xs flex items-center gap-1 rounded-md border border-input bg-background">
              <span className="text-muted-foreground flex-shrink-0">Data:</span>
              <input
                type="date"
                value={newExpense.date}
                onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                className="flex-1 min-w-0 w-full bg-transparent outline-none text-xs"
              />
            </label>
            <div className="min-w-0">
              <Select value={newExpense.paymentMethod} onValueChange={(v) => setNewExpense({ ...newExpense, paymentMethod: v, cardName: isCardPayment(v) ? newExpense.cardName : "" })}>
                <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Pagamento" /></SelectTrigger>
                <SelectContent>{paymentMethods.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {isCardPayment(newExpense.paymentMethod) ? (
              <div className="min-w-0">
                <Select value={newExpense.cardName} onValueChange={(v) => setNewExpense({ ...newExpense, cardName: v })}>
                  <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Cartão" /></SelectTrigger>
                  <SelectContent>{cardOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div />
            )}
          </div>
        )}
      </div>

      {/* Lista */}
      <div>
        {expenses.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-muted-foreground">Nenhum gasto variável cadastrado</p>
            <p className="text-[10px] text-muted-foreground mt-1">Adicione compras, restaurantes, lazer, presentes...</p>
          </div>
        ) : (
          expenses.map((expense) => (
            <div key={expense.id} className="px-3 py-2 border-b border-border/50 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm truncate">{expense.description}</span>
                    <span className={`category-badge ${getCategoryStyle(expense.category)}`}>
                      {getCategoryLabel(expense.category)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                    <span>{new Date(expense.date + "T00:00:00").toLocaleDateString("pt-BR", { month: "short", day: "numeric" })}</span>
                    <span>·</span>
                    <span>{getPaymentLabel(expense.paymentMethod)}</span>
                    {expense.cardName && (
                      <>
                        <span>·</span>
                        <span className={`category-badge ${getCardStyle(expense.cardName)}`}>{getCardLabel(expense.cardName)}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-sm tabular-nums font-medium whitespace-nowrap">
                  R$ {expense.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                <button onClick={() => deleteExpense(expense.id)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Total */}
      <div className="px-3 py-2 border-t border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground">TOTAL</span>
        <span className="text-sm font-bold tabular-nums">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
      </div>
    </div>
  );
};
