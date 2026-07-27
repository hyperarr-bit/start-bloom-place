import { useState } from "react";
import { localDayKey } from "@/lib/utils";
import { Plus, Trash2, ChevronDown, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategorySelect } from "@/components/finance/CategorySelect";
import { useFinanceCategories } from "@/lib/finance-categories";

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
  const { labelOf: getCategoryLabel, styleOf: getCategoryStyle } = useFinanceCategories();
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
          date: newExpense.date || localDayKey(),
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

  /**
   * EDIÇÃO (27/07, pedido de cliente: "só dá pra apagar, seria bom poder
   * editar"). Antes, corrigir um valor digitado errado obrigava a apagar e
   * lançar de novo — e junto ia embora a data, a categoria, a forma de
   * pagamento e o cartão. Num app de dinheiro, errar o valor é o erro mais
   * comum que existe.
   *
   * A edição acontece NA PRÓPRIA LINHA e não no formulário do topo: o
   * formulário fica acima de uma lista que pode ter dezenas de itens, então
   * tocar numa linha lá embaixo e ver a tela "não fazer nada" (porque a
   * mudança aconteceu fora do campo de visão) seria pior do que não ter.
   */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState({
    description: "", category: "", value: "", date: "", paymentMethod: "", cardName: "",
  });

  const comecarEdicao = (e: Expense) => {
    setEditandoId(e.id);
    setRascunho({
      description: e.description,
      category: e.category,
      value: String(e.value),
      date: e.date,
      paymentMethod: e.paymentMethod,
      cardName: e.cardName ?? "",
    });
  };

  const salvarEdicao = () => {
    const valor = parseFloat(rascunho.value);
    // valor inválido não salva: melhor o botão não responder do que gravar NaN
    if (!rascunho.description.trim() || !Number.isFinite(valor)) return;
    setExpenses(expenses.map((e) => e.id !== editandoId ? e : {
      ...e,
      description: rascunho.description.trim(),
      category: rascunho.category || "outros",
      value: valor,
      date: rascunho.date || e.date,
      paymentMethod: rascunho.paymentMethod || "pix",
      cardName: isCardPayment(rascunho.paymentMethod) ? (rascunho.cardName || "outro") : undefined,
    }));
    setEditandoId(null);
  };

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
              <CategorySelect kind="variable" value={newExpense.category} onValueChange={(v) => setNewExpense({ ...newExpense, category: v })} />
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
          expenses.map((expense) => editandoId === expense.id ? (
            <div key={expense.id} className="px-3 py-3 border-b border-border/50 bg-primary/[0.04] space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={rascunho.description}
                  onChange={(e) => setRascunho({ ...rascunho, description: e.target.value })}
                  className="h-9 text-xs flex-1"
                  placeholder="Descrição"
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  value={rascunho.value}
                  onChange={(e) => setRascunho({ ...rascunho, value: e.target.value })}
                  className="h-9 text-xs w-20 text-right"
                  placeholder="Valor"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0">
                  <CategorySelect kind="variable" value={rascunho.category} onValueChange={(v) => setRascunho({ ...rascunho, category: v })} />
                </div>
                <label className="min-w-0 h-8 px-2 text-xs flex items-center gap-1 rounded-md border border-input bg-background">
                  <span className="text-muted-foreground flex-shrink-0">Data:</span>
                  <input
                    type="date"
                    value={rascunho.date}
                    onChange={(e) => setRascunho({ ...rascunho, date: e.target.value })}
                    className="flex-1 min-w-0 w-full bg-transparent outline-none text-xs"
                  />
                </label>
                <div className="min-w-0">
                  <Select value={rascunho.paymentMethod} onValueChange={(v) => setRascunho({ ...rascunho, paymentMethod: v, cardName: isCardPayment(v) ? rascunho.cardName : "" })}>
                    <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Pagamento" /></SelectTrigger>
                    <SelectContent>{paymentMethods.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {isCardPayment(rascunho.paymentMethod) ? (
                  <div className="min-w-0">
                    <Select value={rascunho.cardName} onValueChange={(v) => setRascunho({ ...rascunho, cardName: v })}>
                      <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Cartão" /></SelectTrigger>
                      <SelectContent>{cardOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ) : <div />}
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  onClick={salvarEdicao}
                  className="h-9 flex-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                >
                  <Check className="w-3.5 h-3.5" /> Salvar
                </button>
                <button
                  onClick={() => setEditandoId(null)}
                  className="h-9 px-4 rounded-md border border-border text-xs font-semibold text-muted-foreground flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" /> Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div key={expense.id} className="px-3 py-2 border-b border-border/50 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-2">
                {/* A linha inteira abre a edição. Só a lixeira escapa do toque —
                    apagar por engano ao tentar corrigir seria trocar um
                    problema por outro pior. */}
                <button
                  onClick={() => comecarEdicao(expense)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  aria-label={`Editar ${expense.description}`}
                >
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
                    R$ {expense.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </button>
                <button onClick={() => deleteExpense(expense.id)} aria-label={`Apagar ${expense.description}`} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
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
