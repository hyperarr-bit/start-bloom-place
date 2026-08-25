import { useState } from "react";
import { numeroBR } from "@/lib/data-normalizers";
import { Plus, Trash2, ChevronDown, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategorySelect } from "@/components/finance/CategorySelect";
import { CardSelect } from "@/components/finance/CardSelect";
import { useFinanceCategories } from "@/lib/finance-categories";
import { useFinanceCards } from "@/lib/finance-cards";

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

// Lista de cartões: agora em @/lib/finance-cards (as 11 bandeiras + os que o
// usuário criar, tipo Renner/Will). Estava copiada aqui, no ExpenseTable e no
// InstallmentTracker — mudar num lugar não mudava nos outros.

const isCardPayment = (method: string) => method === "credito" || method === "debito";

export const FixedExpensesTable = ({ expenses, setExpenses }: FixedExpensesTableProps) => {
  const { labelOf: getCategoryLabel, styleOf: getCategoryStyle } = useFinanceCategories();
  const { labelOf: getCardLabel, styleOf: getCardStyle } = useFinanceCards();
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
        value: numeroBR(newExpense.value),
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

  /** Edição na própria linha — o mesmo motivo descrito em ExpenseTable. */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState({
    description: "", category: "", value: "", paymentMethod: "", cardName: "", day: "",
  });

  const comecarEdicao = (e: FixedExpense) => {
    setEditandoId(e.id);
    setRascunho({
      description: e.description,
      category: e.category,
      value: String(e.value),
      paymentMethod: e.paymentMethod,
      cardName: e.cardName ?? "",
      day: e.day ? String(e.day) : "",
    });
  };

  const salvarEdicao = () => {
    const valor = numeroBR(rascunho.value);
    if (!rascunho.description.trim() || !Number.isFinite(valor)) return;
    const dia = parseInt(rascunho.day, 10);
    setExpenses(expenses.map((e) => e.id !== editandoId ? e : {
      ...e,
      description: rascunho.description.trim(),
      category: rascunho.category || "outros",
      value: valor,
      paymentMethod: rascunho.paymentMethod || "pix",
      cardName: isCardPayment(rascunho.paymentMethod) ? (rascunho.cardName || "outro") : undefined,
      // dia fora de 1–31 vira "sem dia" em vez de sujar o calendário
      day: Number.isInteger(dia) && dia >= 1 && dia <= 31 ? dia : undefined,
    }));
    setEditandoId(null);
  };

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
        {/* Mesma regra da receita: o alvo do tutorial é a linha toda, porque a
            tarefa é preencher e depois salvar (27/07). */}
        <div className="flex items-center gap-2" data-spotlight="add-fixed">
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
              <div className="col-span-2 min-w-0">
                <CardSelect value={newExpense.cardName} onValueChange={(v) => setNewExpense({ ...newExpense, cardName: v })} />
              </div>
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
                  <CategorySelect kind="fixed" value={rascunho.category} onValueChange={(v) => setRascunho({ ...rascunho, category: v })} />
                </div>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={rascunho.day}
                  onChange={(e) => setRascunho({ ...rascunho, day: e.target.value })}
                  className="h-8 text-xs"
                  placeholder="Vence dia"
                />
                <div className="min-w-0">
                  <Select value={rascunho.paymentMethod} onValueChange={(v) => setRascunho({ ...rascunho, paymentMethod: v, cardName: isCardPayment(v) ? rascunho.cardName : "" })}>
                    <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Pagamento" /></SelectTrigger>
                    <SelectContent>{paymentMethods.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {isCardPayment(rascunho.paymentMethod) ? (
                  <div className="min-w-0">
                    <CardSelect value={rascunho.cardName} onValueChange={(v) => setRascunho({ ...rascunho, cardName: v })} />
                  </div>
                ) : <div />}
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <button onClick={salvarEdicao} className="h-9 flex-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                  <Check className="w-3.5 h-3.5" /> Salvar
                </button>
                <button onClick={() => setEditandoId(null)} className="h-9 px-4 rounded-md border border-border text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <X className="w-3.5 h-3.5" /> Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div key={expense.id} className="px-3 py-2 border-b border-border/50 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-2">
                <button onClick={() => comecarEdicao(expense)} className="flex items-center gap-2 flex-1 min-w-0 text-left" aria-label={`Editar ${expense.description}`}>
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
