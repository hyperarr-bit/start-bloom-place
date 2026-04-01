import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FixedExpense {
  id: string;
  description: string;
  category: string;
  value: number;
  paymentMethod: string;
  cardName?: string;
}

interface FixedExpensesTableProps {
  expenses: FixedExpense[];
  setExpenses: (expenses: FixedExpense[]) => void;
}

const categories = [
  { value: "contas_gerais", label: "Contas gerais", color: "bg-blue-600/15 text-blue-700 dark:text-blue-300" },
  { value: "contas_pessoais", label: "Contas pessoais", color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300" },
  { value: "fatura_cartao", label: "Fatura cartão", color: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  { value: "moradia", label: "Moradia", color: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  { value: "essencial", label: "Essencial", color: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  { value: "restaurante", label: "Restaurante", color: "bg-stone-800/15 text-stone-700 dark:text-stone-300" },
  { value: "beleza", label: "Beleza", color: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
  { value: "saude", label: "Saúde", color: "bg-green-500/15 text-green-700 dark:text-green-300" },
  { value: "mercado", label: "Mercado", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { value: "educacao", label: "Educação", color: "bg-teal-500/15 text-teal-700 dark:text-teal-300" },
  { value: "assinaturas", label: "Assinaturas", color: "bg-red-800/15 text-red-700 dark:text-red-300" },
  { value: "estilo_vida", label: "Estilo de vida", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { value: "pets", label: "Pets", color: "bg-slate-800/15 text-slate-700 dark:text-slate-300" },
  { value: "filhos", label: "Filhos", color: "bg-blue-400/15 text-blue-600 dark:text-blue-300" },
  { value: "outros", label: "Outros", color: "bg-gray-500/15 text-gray-700 dark:text-gray-300" },
];

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
  const [newExpense, setNewExpense] = useState({
    description: "", category: "", value: "", paymentMethod: "", cardName: "",
  });

  const addExpense = () => {
    if (newExpense.description && newExpense.value) {
      setExpenses([
        ...expenses,
        {
          id: Date.now().toString(),
          description: newExpense.description,
          category: newExpense.category || "outros",
          value: parseFloat(newExpense.value),
          paymentMethod: newExpense.paymentMethod || "boleto",
          cardName: isCardPayment(newExpense.paymentMethod) ? (newExpense.cardName || "outro") : undefined,
        },
      ]);
      setNewExpense({ description: "", category: "", value: "", paymentMethod: "", cardName: "" });
    }
  };

  const deleteExpense = (id: string) => {
    setExpenses(expenses.filter((e) => e.id !== id));
  };

  const getCategoryStyle = (v: string) => categories.find((c) => c.value === v)?.color || "bg-gray-500/15 text-gray-700";
  const getCategoryLabel = (v: string) => categories.find((c) => c.value === v)?.label || v;
  const getCardStyle = (v: string) => cardOptions.find((c) => c.value === v)?.color || "bg-gray-500/15 text-gray-700";
  const getCardLabel = (v: string) => cardOptions.find((c) => c.value === v)?.label || v;
  const getPaymentLabel = (v: string) => paymentMethods.find((p) => p.value === v)?.label || v;

  const total = expenses.reduce((sum, e) => sum + e.value, 0);

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border animate-fade-in">
      <div className="bg-income py-2 px-4">
        <span className="font-bold text-sm text-income-foreground tracking-wide">CUSTOS FIXOS</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Descrição</th>
              <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Categoria</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs">Valor</th>
              <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Pagamento</th>
              <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Cartão</th>
              <th className="px-3 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center">
                  <p className="text-xs text-muted-foreground">Nenhum custo fixo cadastrado</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Adicione aluguel, contas, assinaturas, academia...</p>
                </td>
              </tr>
            )}
            {expenses.map((expense) => (
              <tr key={expense.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-3 py-2">{expense.description}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`category-badge ${getCategoryStyle(expense.category)}`}>
                    {getCategoryLabel(expense.category)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">R$ {expense.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                <td className="px-3 py-2 text-center">
                  <span className="text-xs text-muted-foreground">{getPaymentLabel(expense.paymentMethod)}</span>
                </td>
                <td className="px-3 py-2 text-center">
                  {expense.cardName ? (
                    <span className={`category-badge ${getCardStyle(expense.cardName)}`}>
                      {getCardLabel(expense.cardName)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => deleteExpense(expense.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bg-muted/20">
              <td className="px-3 py-2">
                <Input placeholder="+ Novo custo fixo" value={newExpense.description} onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })} className="h-7 text-xs border-0 bg-transparent shadow-none px-0 focus-visible:ring-0" />
              </td>
              <td className="px-3 py-2">
                <Select value={newExpense.category} onValueChange={(v) => setNewExpense({ ...newExpense, category: v })}>
                  <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none"><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </td>
              <td className="px-3 py-2">
                <Input type="number" placeholder="0" value={newExpense.value} onChange={(e) => setNewExpense({ ...newExpense, value: e.target.value })} className="h-7 text-xs border-0 bg-transparent shadow-none px-0 text-right focus-visible:ring-0" />
              </td>
              <td className="px-3 py-2">
                <Select value={newExpense.paymentMethod} onValueChange={(v) => setNewExpense({ ...newExpense, paymentMethod: v, cardName: isCardPayment(v) ? newExpense.cardName : "" })}>
                  <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none"><SelectValue placeholder="Forma" /></SelectTrigger>
                  <SelectContent>{paymentMethods.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </td>
              <td className="px-3 py-2">
                {isCardPayment(newExpense.paymentMethod) ? (
                  <Select value={newExpense.cardName} onValueChange={(v) => setNewExpense({ ...newExpense, cardName: v })}>
                    <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none"><SelectValue placeholder="Cartão" /></SelectTrigger>
                    <SelectContent>{cardOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-3 py-2">
                <button onClick={addExpense} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <td className="px-3 py-2 text-xs text-muted-foreground" colSpan={2}>TOTAL</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums" colSpan={4}>
                R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
