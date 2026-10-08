import { useEffect, useRef, useState } from "react";
import { numeroBR } from "@/lib/data-normalizers";
import { localDayKey } from "@/lib/utils";
import { avisarApagado } from "@/lib/desfazer";
import { Plus, Trash2, ChevronDown, Check, X, CreditCard, Repeat } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategorySelect } from "@/components/finance/CategorySelect";
import { CardSelect } from "@/components/finance/CardSelect";
import { useFinanceCategories } from "@/lib/finance-categories";
import { useFinanceCards } from "@/lib/finance-cards";
import { NOVO_PARCELAMENTO_EVENT, type Installment, type NovoParcelamentoDetalhe } from "@/components/InstallmentTracker";
import { NOVO_CUSTO_FIXO_EVENT, type FixedExpense, type NovoCustoFixoDetalhe } from "@/components/FixedExpensesTable";
import { mesDoGasto } from "@/lib/finance-fatura";
import { mesesEntre, nomeDoMes } from "@/lib/finance-parcelas";
import { mesCorrenteId } from "@/lib/virada-contas";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { CHAVE_ORDEM_GASTOS, ORDENS_DOS_GASTOS, OrdenarChips, ordenarGastos, type OrdemDosGastos } from "@/components/finance/ordenar";

interface Expense {
  id: string;
  description: string;
  category: string;
  value: number;
  date: string;
  paymentMethod: string;
  cardName?: string;
  /** Conta/banco de onde saiu (Pix, dinheiro, boleto) — 22/09, chamado: "que
   *  a aba de financeiro possa ser separada por contas, tipo C6, Nubank".
   *  Cartão (crédito/débito) continua em `cardName`, como sempre. Opcional. */
  conta?: string;
}

/** Em que "conta" o gasto vive, pra filtrar e somar: cartão ou banco. */
const contaDoGasto = (e: Expense) => (isCardPayment(e.paymentMethod) ? e.cardName : e.conta) || "";

/** O gasto recém-salvo, no vocabulário de quem vai comemorar (ConviteAvaliacao). */
export interface GastoLancado {
  id: string;
  descricao: string;
  valor: number;
  categoria: string;
}

interface ExpenseTableProps {
  expenses: Expense[];
  setExpenses: (expenses: Expense[]) => void;
  /**
   * Disparado quando o gasto salvo entrou numa lista que estava VAZIA — o
   * primeiro lançamento desta tabela. A tabela não sabe (nem deve saber) o
   * que acontece depois: quem decide se isso é "o primeiro gasto da vida"
   * ou só o primeiro do mês é o dono da chave (Index). A planilha de mês
   * arquivado (MonthlySheet) não passa nada e nada acontece lá.
   */
  onPrimeiroGasto?: (gasto: GastoLancado) => void;
  /** "YYYY-MM" da chave que esta tabela edita. Ausente = mês corrente. Serve
   *  pro selo "fatura de out." (lib/finance-fatura). */
  mes?: string;
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

/**
 * O que o gasto precisa pra entrar (26/09, varredura): nome de verdade e
 * valor MAIOR que zero — "Devolução −R$ 50" entrava e descontava do total do
 * mês sem ninguém perceber. Vale pro gasto à vista, pro parcelado e pro
 * recorrente. Devolve a mensagem de erro, ou null quando está tudo certo.
 */
export const erroDoGasto = (descricao: string, valorDigitado: string): string | null => {
  const nome = descricao.trim();
  if (!nome && !valorDigitado.trim()) return "Escreva o nome e o valor do gasto.";
  if (!nome) return "Dê um nome ao gasto.";
  const valor = numeroBR(valorDigitado);
  if (!Number.isFinite(valor)) return "Informe o valor do gasto.";
  if (valor <= 0) return "O valor precisa ser maior que zero.";
  return null;
};

export const ExpenseTable = ({ expenses, setExpenses, onPrimeiroGasto, mes }: ExpenseTableProps) => {
  const { labelOf: getCategoryLabel, styleOf: getCategoryStyle } = useFinanceCategories();
  const { labelOf: getCardLabel, styleOf: getCardStyle, configOf } = useFinanceCards();
  const mesDaChave = mes ?? mesCorrenteId();
  const [newExpense, setNewExpense] = useState({
    description: "", category: "", value: "", date: "", paymentMethod: "", cardName: "", conta: "",
  });
  const [showMore, setShowMore] = useState(expenses.length === 0);
  /* FILTRO POR CONTA (22/09). Chips com os bancos/cartões que aparecem na
     lista deste mês; escolher um mostra só os gastos dele e o subtotal. */
  const [filtroConta, setFiltroConta] = useState("");
  const contasPresentes = Array.from(new Set(expenses.map(contaDoGasto).filter(Boolean)));
  const filtrados = filtroConta ? expenses.filter((e) => contaDoGasto(e) === filtroConta) : expenses;
  const subtotalFiltro = filtrados.reduce((s, e) => s + (Number(e.value) || 0), 0);
  /* ORDENAR (08/10, chamado: "ordenar os gastos por data ou por nome"). Só de
     EXIBIÇÃO — a lista gravada segue na ordem de lançamento (o mesclarPerfil
     preserva a ordem completa; em "Tudo junto" gravaria a ordem nova). A
     escolha fica guardada (chave própria, só a preferência). */
  const [ordem, setOrdem] = usePersistedState<OrdemDosGastos>(CHAVE_ORDEM_GASTOS, "lancamento");
  const visiveis = ordenarGastos(filtrados, ordem);

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

  const limparForm = () => setNewExpense({ description: "", category: "", value: "", date: "", paymentMethod: "", cardName: "", conta: "" });

  /**
   * "REPETE TODO MÊS" (07/09) — avaliação 4★ da Play: "as contas recorrentes.
   * Não consegui fazer". O recurso existia (custo fixo com Dia → conta do mês
   * com ✓ de paga), mas nenhuma tela dizia "recorrente" e quem lança um gasto
   * pensa "isso repete", não "isso é fixo". O toggle fica ao lado do
   * "Parcelar", visível sem abrir nada — pelo mesmo motivo dele. O que se
   * cria é UM custo fixo comum (mesmo formato que o FixedExpensesTable grava),
   * entregue por evento pra quem é dono da chave certa.
   */
  const [repetindo, setRepetindo] = useState(false);
  const [diaRepete, setDiaRepete] = useState("");

  const lancarRecorrente = (valor: number) => {
    if (!Number.isFinite(valor) || valor <= 0) { toast.error("Informe o valor."); return; }
    // sem Dia digitado, usa o dia da data da compra (ou de hoje): é o que faz
    // a conta aparecer no MEU MÊS pra marcar como paga
    const dataRef = newExpense.date || localDayKey();
    const diaDigitado = parseInt(diaRepete, 10);
    const dia = Number.isInteger(diaDigitado) && diaDigitado >= 1 && diaDigitado <= 31
      ? diaDigitado
      : Math.min(31, Math.max(1, Number(dataRef.slice(8, 10)) || 1));
    const fixo: FixedExpense = {
      id: Date.now().toString(),
      description: newExpense.description.trim(),
      category: newExpense.category || "outros",
      value: valor,
      paymentMethod: newExpense.paymentMethod || "boleto",
      cardName: isCardPayment(newExpense.paymentMethod) ? (newExpense.cardName || "outro") : undefined,
      day: dia,
    };
    const detalhe: NovoCustoFixoDetalhe = { fixo, handled: false };
    window.dispatchEvent(new CustomEvent(NOVO_CUSTO_FIXO_EVENT, { detail: detalhe }));
    if (!detalhe.handled) {
      toast.error("Não consegui criar a conta recorrente agora.", { description: "Use o card CUSTOS FIXOS, logo acima." });
      return;
    }
    toast.success(`${fixo.description} repete todo mês, dia ${dia}`, {
      description: "Está em CUSTOS FIXOS e aparece no MEU MÊS pra marcar como paga.",
    });
    limparForm();
    setDiaRepete("");
    setRepetindo(false);
  };

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
    const erro = erroDoGasto(newExpense.description, newExpense.value);
    if (erro) { toast.error(erro); return; }
    // mesma tecla, três destinos: parcelado vira dívida, recorrente vira
    // custo fixo, à vista vira gasto
    if (parcelando) { lancarParcelamento(numeroBR(newExpense.value)); return; }
    if (repetindo) { lancarRecorrente(numeroBR(newExpense.value)); return; }
    const eraVazia = expenses.length === 0;
    const novo: Expense = {
      id: Date.now().toString(),
      description: newExpense.description.trim(),
      category: newExpense.category || "outros",
      value: numeroBR(newExpense.value),
      date: newExpense.date || localDayKey(),
      paymentMethod: newExpense.paymentMethod || "pix",
      cardName: isCardPayment(newExpense.paymentMethod) ? (newExpense.cardName || "outro") : undefined,
      ...(!isCardPayment(newExpense.paymentMethod) && newExpense.conta ? { conta: newExpense.conta } : {}),
    };
    setExpenses([...expenses, novo]);
    limparForm();
    if (eraVazia) {
      onPrimeiroGasto?.({ id: novo.id, descricao: novo.description, valor: novo.value, categoria: getCategoryLabel(novo.category) });
    }
  };

  /* Apagar com "Desfazer" (26/09, varredura): um toque na lixeira levava o
     gasto embora sem volta. O desfazer usa a lista MAIS RECENTE e devolve o
     gasto inteiro, mesmo id. */
  const ultimo = useRef({ lista: expenses, gravar: setExpenses });
  useEffect(() => { ultimo.current = { lista: expenses, gravar: setExpenses }; });

  const deleteExpense = (id: string) => {
    const pos = expenses.findIndex((e) => e.id === id);
    if (pos < 0) return;
    const apagado = expenses[pos];
    setExpenses(expenses.filter((e) => e.id !== id));
    avisarApagado(`Gasto apagado: ${apagado.description}`, () => {
      const { lista, gravar } = ultimo.current;
      if (lista.some((e) => e.id === id)) return;
      gravar([...lista.slice(0, pos), apagado, ...lista.slice(pos)]);
    });
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
    description: "", category: "", value: "", date: "", paymentMethod: "", cardName: "", conta: "",
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
      conta: e.conta ?? "",
    });
  };

  const salvarEdicao = () => {
    const valor = numeroBR(rascunho.value);
    // valor inválido não salva — e agora diz por quê (26/09: negativo passava)
    const erro = erroDoGasto(rascunho.description, rascunho.value);
    if (erro) { toast.error(erro); return; }
    setExpenses(expenses.map((e) => e.id !== editandoId ? e : {
      ...e,
      description: rascunho.description.trim(),
      category: rascunho.category || "outros",
      value: valor,
      date: rascunho.date || e.date,
      paymentMethod: rascunho.paymentMethod || "pix",
      cardName: isCardPayment(rascunho.paymentMethod) ? (rascunho.cardName || "outro") : undefined,
      conta: !isCardPayment(rascunho.paymentMethod) && rascunho.conta ? rascunho.conta : undefined,
    }));
    setEditandoId(null);
  };

  const getPaymentLabel = (v: string) => paymentMethods.find((p) => p.value === v)?.label || v;

  const total = expenses.reduce((sum, e) => sum + e.value, 0);

  /* Compra no crédito depois do fechamento do cartão pertence à fatura do
     mês seguinte (lib/finance-fatura): continua listada aqui, com selo, mas
     sai do "despesas do mês" e entra no próximo. */
  const mesDaFaturaDe = (e: Expense) => mesDoGasto(e, configOf, mesDaChave);
  const adiado = (e: Expense) => mesesEntre(mesDaChave, mesDaFaturaDe(e)) > 0;
  const totalAdiado = expenses.reduce((s, e) => s + (adiado(e) ? e.value : 0), 0);

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
          <div className="flex items-center gap-1.5">
            {/* Os dois modos são excludentes: ligar um desliga o outro. */}
            <button
              onClick={() => { setRepetindo((r) => !r); setParcelando(false); }}
              aria-pressed={repetindo}
              aria-label="Repete todo mês (conta recorrente)"
              className={`h-9 px-3 flex-shrink-0 rounded-full text-[11px] font-semibold flex items-center gap-1.5 border transition-colors ${
                repetindo
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              {repetindo ? "Repete todo mês" : "Repetir"}
            </button>
            <button
              onClick={() => { setParcelando((p) => !p); setRepetindo(false); }}
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
        </div>

        {repetindo && (
          <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                Vence dia
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  placeholder="Ex: 10"
                  aria-label="Dia em que a conta recorrente vence"
                  value={diaRepete}
                  onChange={(e) => setDiaRepete(e.target.value)}
                  className="h-9 w-20 text-xs"
                />
              </label>
              <p className="text-[10px] text-muted-foreground flex-1">
                Conta recorrente: vai pra <strong className="text-foreground">CUSTOS FIXOS</strong>, repete todo mês e aparece no <strong className="text-foreground">MEU MÊS</strong> pra marcar como paga.
              </p>
            </div>
          </div>
        )}

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
            ) : newExpense.paymentMethod ? (
              <div className="min-w-0">
                <CardSelect value={newExpense.conta} onValueChange={(v) => setNewExpense({ ...newExpense, conta: v })} placeholder="Conta/banco (opcional)" />
              </div>
            ) : (
              <div />
            )}
          </div>
        )}
      </div>

      {/* Filtro por conta (22/09) — só aparece quando há mais de uma conta na lista */}
      {contasPresentes.length > 1 && (
        <div className="px-3 py-2 border-b border-border/50 flex items-center gap-1.5 flex-wrap" data-testid="filtro-conta">
          <button
            type="button"
            onClick={() => setFiltroConta("")}
            className={`h-6 px-2 rounded-full text-[10px] font-semibold border ${!filtroConta ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground border-border"}`}
          >
            Todas
          </button>
          {contasPresentes.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFiltroConta(filtroConta === c ? "" : c)}
              aria-pressed={filtroConta === c}
              className={`h-6 px-2 rounded-full text-[10px] font-semibold border ${filtroConta === c ? "bg-foreground text-background border-foreground" : `${getCardStyle(c)} border-transparent`}`}
            >
              {getCardLabel(c)}
            </button>
          ))}
          {filtroConta && (
            <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
              {visiveis.length} gasto{visiveis.length !== 1 ? "s" : ""} · R$ {brl(subtotalFiltro)}
            </span>
          )}
        </div>
      )}

      {/* Ordenar (08/10) — só aparece com 2+ gastos */}
      {expenses.length > 1 && <OrdenarChips<OrdemDosGastos> valor={ordem} opcoes={ORDENS_DOS_GASTOS} onChange={(v) => setOrdem(v)} testid="ordenar-gastos" />}

      {/* Lista */}
      <div>
        {expenses.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-muted-foreground">Nenhum gasto variável cadastrado</p>
            <p className="text-[10px] text-muted-foreground mt-1">Adicione compras, restaurantes, lazer, presentes...</p>
          </div>
        ) : (
          visiveis.map((expense) => editandoId === expense.id ? (
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
                ) : (
                  <div className="min-w-0">
                    <CardSelect value={rascunho.conta} onValueChange={(v) => setRascunho({ ...rascunho, conta: v })} placeholder="Conta/banco (opcional)" />
                  </div>
                )}
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
                    {/* 11/09: com flex-wrap a tag caía SOZINHA na linha de baixo quando o
                        nome era longo ("Mercado da semana" + Alimentação) e parecia erro de
                        layout — o dono apontou duas vezes em print. Agora o nome trunca
                        com reticências e a tag fica sempre ao lado. */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm truncate min-w-0">{expense.description}</span>
                      <span className={`category-badge shrink-0 ${getCategoryStyle(expense.category)}`}>
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
                      {!expense.cardName && expense.conta && (
                        <>
                          <span>·</span>
                          <span className={`category-badge ${getCardStyle(expense.conta)}`} data-testid="badge-conta">{getCardLabel(expense.conta)}</span>
                        </>
                      )}
                      {adiado(expense) && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold" title="Compra depois do fechamento: conta nas despesas do mês da fatura">
                          fatura de {nomeDoMes(mesDaFaturaDe(expense), true)}.
                        </span>
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
      {totalAdiado > 0 && (
        <div className="px-3 pb-2 -mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>desses, na fatura do mês que vem</span>
          <span className="tabular-nums">R$ {brl(totalAdiado)}</span>
        </div>
      )}
    </div>
  );
};
