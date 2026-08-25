import { useState } from "react";
import { numeroBR } from "@/lib/data-normalizers";
import { localDayKey } from "@/lib/utils";
import { Plus, Trash2, ChevronDown, Check, X, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategorySelect } from "@/components/finance/CategorySelect";
import { CardSelect } from "@/components/finance/CardSelect";
import { useFinanceCategories } from "@/lib/finance-categories";
import { useFinanceCards } from "@/lib/finance-cards";
import { NOVO_PARCELAMENTO_EVENT, type Installment, type NovoParcelamentoDetalhe } from "@/components/InstallmentTracker";

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

// A lista de cartões (as 11 bandeiras + os que o usuário criar) mora em
// @/lib/finance-cards — estava copiada aqui, no FixedExpensesTable e no
// InstallmentTracker.

const isCardPayment = (method: string) => method === "credito" || method === "debito";

const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ExpenseTable = ({ expenses, setExpenses }: ExpenseTableProps) => {
  const { labelOf: getCategoryLabel, styleOf: getCategoryStyle } = useFinanceCategories();
  const { labelOf: getCardLabel, styleOf: getCardStyle } = useFinanceCards();
  const [newExpense, setNewExpense] = useState({
    description: "", category: "", value: "", date: "", paymentMethod: "", cardName: "",
  });
  const [showMore, setShowMore] = useState(expenses.length === 0);

  /**
   * PARCELAR PELO FLUXO NORMAL (08/08, feedback de assinante: "senti falta da
   * opção de compras parceladas, seria legal poder pôr o valor total e um campo
   * com número de parcelas").
   *
   * O recurso JÁ EXISTIA — no card "Cartão de Crédito — Parcelamentos", lá
   * embaixo, com vocabulário próprio. Ela simplesmente não achou: quem compra
   * parcelado pensa "vou lançar um gasto", não "vou cadastrar um parcelamento".
   * Então a porta passa a ser esta, a mesma de sempre, com um botão do lado do
   * valor. O que se cria continua sendo UM registro de `finance-installments`
   * (mesmo formato do card) — nada de um segundo sistema paralelo, com números
   * que depois brigariam entre si.
   */
  const [parcelando, setParcelando] = useState(false);
  const [parcelas, setParcelas] = useState("");
  const [cardParcela, setCardParcela] = useState("");

  const nParcelas = parseInt(parcelas, 10);
  const totalDigitado = numeroBR(newExpense.value);
  const previaParcela =
    Number.isInteger(nParcelas) && nParcelas >= 2 && Number.isFinite(totalDigitado) && totalDigitado > 0
      ? `${nParcelas}x de R$ ${brl(totalDigitado / nParcelas)}`
      : null;

  const limparForm = () => setNewExpense({ description: "", category: "", value: "", date: "", paymentMethod: "", cardName: "" });

  const lancarParcelamento = (total: number) => {
    if (!Number.isFinite(total) || total <= 0) { toast.error("Informe o valor TOTAL da compra."); return; }
    if (!Number.isInteger(nParcelas) || nParcelas < 2 || nParcelas > 99) {
      toast.error("Diga em quantas vezes (de 2 a 99).");
      return;
    }
    const nova: Installment = {
      id: Date.now().toString(),
      description: newExpense.description.trim(),
      totalValue: total,
      // o card guarda o valor da PARCELA e o total; derivar aqui evita a conta
      // na cabeça (é exatamente o que ela pediu: total + nº de parcelas)
      installmentValue: total / nParcelas,
      paidInstallments: 0,
      totalInstallments: nParcelas,
      cardName: cardParcela || newExpense.cardName || "outro",
      category: newExpense.category || "outros",
      date: newExpense.date || localDayKey(),
    };
    // Quem grava é o card de parcelamentos (dono da chave do mês aberto) —
    // ver NOVO_PARCELAMENTO_EVENT. `handled` volta true de forma síncrona.
    const detalhe: NovoParcelamentoDetalhe = { installment: nova, handled: false };
    window.dispatchEvent(new CustomEvent(NOVO_PARCELAMENTO_EVENT, { detail: detalhe }));
    if (!detalhe.handled) {
      // Ninguém ouviu (card fora da tela). Escrever a chave por fora daqui
      // gravaria no mês errado ou por cima de dívida já salva — melhor avisar.
      toast.error("Não consegui criar o parcelamento agora.", { description: "Use o card “Cartão de Crédito — Parcelamentos”." });
      return;
    }
    toast.success(`Parcelado em ${nParcelas}x de R$ ${brl(total / nParcelas)}`, {
      description: "Está no card CARTÃO DE CRÉDITO — PARCELAMENTOS, logo abaixo.",
    });
    limparForm();
    setParcelas("");
    setParcelando(false); // volta pro modo gasto normal: o próximo lançamento é o comum
  };

  const addExpense = () => {
    if (newExpense.description && newExpense.value) {
      // mesma tecla, dois destinos: parcelado vira dívida, à vista vira gasto
      if (parcelando) { lancarParcelamento(numeroBR(newExpense.value)); return; }
      setExpenses([
        ...expenses,
        {
          id: Date.now().toString(),
          description: newExpense.description,
          category: newExpense.category || "outros",
          value: numeroBR(newExpense.value),
          date: newExpense.date || localDayKey(),
          paymentMethod: newExpense.paymentMethod || "pix",
          cardName: isCardPayment(newExpense.paymentMethod) ? (newExpense.cardName || "outro") : undefined,
        },
      ]);
      limparForm();

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
    const valor = numeroBR(rascunho.value);
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
            placeholder={parcelando ? "Total" : "Valor"}
            title={parcelando ? "Valor TOTAL da compra — o app divide pelas parcelas" : undefined}
            value={newExpense.value}
            onChange={(e) => setNewExpense({ ...newExpense, value: e.target.value })}
            className="h-9 text-xs w-20 text-right"
          />
          <button
            onClick={addExpense}
            data-spotlight="add-expense"
            aria-label={parcelando ? "Adicionar compra parcelada" : "Adicionar gasto"}
            className="h-9 w-9 flex-shrink-0 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* "Parcelar" fica AQUI, visível sem abrir nada: escondê-lo dentro de
            "Mais opções" repetiria o problema original (o recurso existia e
            ninguém achava). */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setShowMore((s) => !s)}
            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${showMore ? "rotate-180" : ""}`} />
            {showMore ? "Menos opções" : "Mais opções (categoria, data, pagamento)"}
          </button>
          <button
            onClick={() => setParcelando((p) => !p)}
            aria-pressed={parcelando}
            className={`h-9 px-3 flex-shrink-0 rounded-full text-[11px] font-semibold flex items-center gap-1.5 border transition-colors ${
              parcelando
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            {parcelando ? "Parcelado" : "Parcelar"}
          </button>
        </div>

        {parcelando && (
          <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-2.5 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] text-muted-foreground">
                Em quantas vezes
                <Input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={99}
                  placeholder="Ex: 10"
                  value={parcelas}
                  onChange={(e) => setParcelas(e.target.value)}
                  className="h-9 text-xs mt-0.5"
                />
              </label>
              {/* legenda em <span> e não <label>: envolver o gatilho do Select
                  num label faz o clique ser reenviado ao botão e o menu abre e
                  fecha na mesma batida */}
              <div className="min-w-0">
                <span className="text-[10px] text-muted-foreground">Cartão</span>
                <div className="mt-0.5">
                  <CardSelect value={cardParcela} onValueChange={setCardParcela} className="h-9 text-xs w-full" />
                </div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {previaParcela ? (
                <>Vai virar <strong className="text-foreground">{previaParcela}</strong> no card de parcelamentos (o valor acima é o <strong>total</strong> da compra).</>
              ) : (
                <>Digite o <strong>total</strong> da compra ali em cima e em quantas vezes — o app divide as parcelas.</>
              )}
            </p>
          </div>
        )}

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
                <CardSelect value={newExpense.cardName} onValueChange={(v) => setNewExpense({ ...newExpense, cardName: v })} />
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
                    <CardSelect value={rascunho.cardName} onValueChange={(v) => setRascunho({ ...rascunho, cardName: v })} />
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
