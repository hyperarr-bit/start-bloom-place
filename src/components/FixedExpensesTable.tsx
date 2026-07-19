import { useState } from "react";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategorySelect } from "@/components/finance/CategorySelect";
import { useFinanceCategories } from "@/lib/finance-categories";

interface FixedExpense {
  id: string;
  description: string;
  category: string;
  value: number;
  paymentMethod: string;
  cardName?: string;
  /** Dia do mês em que vence (1-31, opcional) — faz o fixo aparecer no
   *  calendário MEU MÊS. Pedido do dono em 12/07 ("custos fixos não
   *  aparecem, provavelmente pq não botamos data"). */
  day?: number;
}

interface FixedExpensesTableProps {
  expenses: FixedExpense[];
  setExpenses: (expenses: FixedExpense[]) => void;
}

const paymentMethods = [
  { value: "pix", label: "Pix" },
  { value: "credito", label: "Cartão de Crédito" },
  { value: "debito", label: "Cartão de Débito" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "boleto", label: "Boleto" },
  { value: "debito_auto", label: "Débito Automático" },
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

export const FixedExpensesTable = ({ expenses, setExpenses }: FixedExpensesTableProps) => {
  const { labelOf: getCategoryLabel, styleOf: getCategoryStyle } = useFinanceCategories();
  const [newExpense, setNewExpense] = useState({
    description: "", category: "", value: "", paymentMethod: "", cardName: "", day: "",
  });
  const [showMore, setShowMore] = useState(expenses.length === 0);

  const addExpense = () => {
    if (!newExpense.description && !newExpense.value) {
      toast.error("Adicione o nome e o valor");
      return;
    }
    if (!newExpense.description) {
      toast.error("Adicione o nome");
      return;
    }
    if (!newExpense.value) {
      toast.error("Informe o valor");
      return;
    }
    const dayNum = Math.min(31, Math.max(1, parseInt(newExpense.day, 10) || 0));
    setExpenses([
      ...expenses,
      {
        id: Date.now().toString(),
        description: newExpense.description,
        category: newExpense.category || "outros",
        value: parseFloat(newExpense.value),
        paymentMethod: newExpense.paymentMethod || "boleto",
        cardName: isCardPayment(newExpense.paymentMethod) ? (newExpense.cardName || "outro") : undefined,
        day: dayNum >= 1 ? dayNum : undefined,
      },
    ]);
    setNewExpense({ description: "", category: "", value: "", paymentMethod: "", cardName: "", day: "" });
  };

  const deleteExpense = (id: string) => {
    setExpenses(expenses.filter((e) => e.id !== id));
  };

  const getCardStyle = (v: string) => cardOptions.find((c) => c.value === v)?.color || "bg-gray-500/15 text-gray-700";
  const getCardLabel = (v: string) => cardOptions.find((c) => c.value === v)?.label || v;
  const getPaymentLabel = (v: string) => paymentMethods.find((p) => p.value === v)?.label || v;

  const total = expenses.reduce((sum, e) => sum + e.value, 0);

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border animate-fade-in">
      <div className="bg-income py-2 px-4">
        <span className="font-bold text-sm text-income-foreground tracking-wide">CUSTOS FIXOS</span>
      </div>

      {/* Form sempre visível */}
      <div className="p-3 border-b border-border bg-muted/20 space-y-2">
        {expenses.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-muted-foreground self-center mr-0.5">Sugestões:</span>
            {[
              { description: "Aluguel", category: "moradia" },
              { description: "Internet", category: "internet_telefone" },
              { description: "Academia", category: "academia" },
            ].map((s) => (
              <button
                key={s.description}
                onClick={() => setNewExpense({ ...newExpense, description: s.description, category: s.category })}
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium hover:opacity-80 transition-opacity ${getCategoryStyle(s.category)}`}
              >
                + {s.description}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input
            placeholder="+ Novo custo fixo"
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
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            placeholder="Dia"
            title="Dia do vencimento (opcional) — aparece no calendário Meu Mês"
            value={newExpense.day}
            onChange={(e) => setNewExpense({ ...newExpense, day: e.target.value })}
            className="h-9 text-xs w-14 text-right"
          />
          <button
            onClick={addExpense}
            data-spotlight="add-fixed"
            aria-label="Adicionar custo fixo"
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
          {showMore ? "Menos opções" : "Mais opções (categoria, pagamento)"}
        </button>

        {showMore && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <CategorySelect kind="fixed" value={newExpense.category} onValueChange={(v) => setNewExpense({ ...newExpense, category: v })} />
            {/* seletor de categoria (variável/fixo) agora vem do CategorySelect */}
            <Select value={newExpense.paymentMethod} onValueChange={(v) => setNewExpense({ ...newExpense, paymentMethod: v, cardName: isCardPayment(v) ? newExpense.cardName : "" })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pagamento" /></SelectTrigger>
              <SelectContent>{paymentMethods.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
            {isCardPayment(newExpense.paymentMethod) && (
              <Select value={newExpense.cardName} onValueChange={(v) => setNewExpense({ ...newExpense, cardName: v })}>
                <SelectTrigger className="h-8 text-xs col-span-2"><SelectValue placeholder="Cartão" /></SelectTrigger>
                <SelectContent>{cardOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      {/* Lista */}
      <div>
        {expenses.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-muted-foreground">Nenhum custo fixo cadastrado</p>
            <p className="text-[10px] text-muted-foreground mt-1">Adicione aluguel, contas, assinaturas, academia...</p>
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
                    {expense.day ? (
                      <>
                        <span>vence dia {expense.day}</span>
                        <span>·</span>
                      </>
                    ) : null}
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
                  R$ {expense.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        <span className="text-sm font-bold tabular-nums">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
    </div>
  );
};
