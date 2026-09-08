import { useEffect, useState } from "react";
import { localDayKey } from "@/lib/utils";
import { Plus, Trash2, CreditCard, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampoData } from "@/components/ui/campo-data";
import { Checkbox } from "@/components/ui/checkbox";
import { CardSelect } from "@/components/finance/CardSelect";
import { CategorySelect } from "@/components/finance/CategorySelect";
import { CartaoConfig } from "@/components/finance/CartaoConfig";
import { useFinanceCards } from "@/lib/finance-cards";
import { useFinanceCategories } from "@/lib/finance-categories";
import {
  type Parcela, carimbar, carimbarLista, marcarParcelaDoMes, parcelaDoMes, parcelaPagaNoMes, parcelaQuitada,
  valorDaParcelaNoMes, somaParcelasDoMes, nomeDoMes, somarMeses,
} from "@/lib/finance-parcelas";
import { mesDoGasto, rotuloVencimento } from "@/lib/finance-fatura";
import { mesCorrenteId } from "@/lib/virada-contas";

/** Formato gravado em `finance-installments` — exportado porque o ExpenseTable
 *  cria parcelamento no MESMO formato (uma porta de entrada, um só formato).
 *  Os campos de mês (`startMonth`, `parcelaDoMes`) estão em lib/finance-parcelas. */
export type Installment = Parcela;

interface InstallmentTrackerProps {
  installments: Installment[];
  setInstallments: (installments: Installment[]) => void;
  variableExpenses?: any[];
  /** Gastos variáveis da chave do mês ANTERIOR: compra no crédito depois do
   *  fechamento de lá cai na fatura deste mês (lib/finance-fatura). */
  variableExpensesAnterior?: any[];
  /** "YYYY-MM" da chave que este card edita. Ausente = mês corrente. É o
   *  carimbo que toda gravação recebe (ver lib/finance-parcelas). */
  mes?: string;
  /** Parcelas de OUTROS meses que vencem neste — só leitura, marcadas
   *  "previsto". Quem edita é a planilha do mês onde elas moram. */
  projetadas?: Installment[];
}

/**
 * PONTE DO PARCELAMENTO (08/08). O ExpenseTable manda a parcela pra CÁ em vez
 * de escrever em `finance-installments` por conta própria, por dois motivos
 * concretos:
 *  1. quem manda na lista é o pai (Index/MonthlySheet, via usePersistedState),
 *     e esse hook hidrata UMA vez — escrita de fora ficaria invisível na tela
 *     até recarregar (e a próxima gravação do pai apagaria a parcela nova);
 *  2. dentro da planilha de um mês antigo a chave é outra
 *     (`finance-2026-junho-installments`) — escrever "na mão" gravaria no mês
 *     errado. Quem está montado na tela é sempre o dono da chave certa.
 * `handled` avisa a origem que alguém recebeu (dispatchEvent é síncrono).
 */
export const NOVO_PARCELAMENTO_EVENT = "core:novo-parcelamento";
export type NovoParcelamentoDetalhe = { installment: Installment; handled: boolean };

/**
 * Este card tinha lista PRÓPRIA de categorias (roupa/beleza/eletrônicos…), que
 * ignorava as personalizadas do resto do financeiro — parcelar era um app à
 * parte. Agora usa o CategorySelect compartilhado. Das antigas, só "roupa" não
 * existe na lista comum: vira "vestuario" SÓ NA EXIBIÇÃO. O dado gravado
 * continua "roupa" — não se reescreve histórico de assinante.
 */
const CAT_LEGADA: Record<string, string> = { roupa: "vestuario" };
const catValue = (v?: string) => (v ? CAT_LEGADA[v] ?? v : "outros");

const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const InstallmentTracker = ({
  installments, setInstallments, variableExpenses = [], variableExpensesAnterior = [], mes, projetadas = [],
}: InstallmentTrackerProps) => {
  const { labelOf: getCardLabel, styleOf: getCardStyle, configOf } = useFinanceCards();
  const { labelOf: getCatLabel, styleOf: getCatStyle } = useFinanceCategories();
  const mesDaChave = mes ?? mesCorrenteId();
  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState({
    description: "", totalValue: "", totalInstallments: "", paidInstallments: "", cardName: "", category: "", date: "",
  });

  /* TODA gravação sai carimbada com o mês da chave (07/09): é o que faz a
     parcela atravessar os meses sozinha (virada em use-virada-do-mes). O
     legado que já estava na lista ganha o carimbo de carona — "assuma
     startMonth = o mês da chave em que está", sem escrita de boot. */
  const gravar = (lista: Installment[]) => setInstallments(carimbarLista(lista, mesDaChave));

  // Recebe o parcelamento criado lá no "+ Novo gasto" (ver NOVO_PARCELAMENTO_EVENT).
  // A lista entra pelo setInstallments do pai, então total mensal, dívidas,
  // calendário e conquistas recalculam na hora, sem recarregar.
  useEffect(() => {
    const onNovo = (e: Event) => {
      const detalhe = (e as CustomEvent<NovoParcelamentoDetalhe>).detail;
      if (!detalhe?.installment) return;
      detalhe.handled = true;
      gravar([...installments, carimbar(detalhe.installment, mesDaChave)]);
    };
    window.addEventListener(NOVO_PARCELAMENTO_EVENT, onNovo);
    return () => window.removeEventListener(NOVO_PARCELAMENTO_EVENT, onNovo);
  }, [installments, setInstallments, mesDaChave]);

  const addInstallment = () => {
    if (newItem.description && newItem.totalValue && newItem.totalInstallments) {
      const totalValue = parseFloat(newItem.totalValue);
      const totalInstallments = parseInt(newItem.totalInstallments);
      gravar([
        ...installments,
        {
          id: Date.now().toString(),
          description: newItem.description,
          totalValue,
          installmentValue: totalValue / totalInstallments,
          paidInstallments: parseInt(newItem.paidInstallments) || 0,
          totalInstallments,
          cardName: newItem.cardName || "outro",
          category: newItem.category || "outros",
          date: newItem.date || localDayKey(),
        },
      ]);
      setNewItem({ description: "", totalValue: "", totalInstallments: "", paidInstallments: "", cardName: "", category: "", date: "" });
      setShowForm(false);
    }
  };

  const deleteInstallment = (id: string) => {
    gravar(installments.filter((i) => i.id !== id));
  };

  /**
   * Editar o parcelamento (27/07).
   *
   * O único ajuste possível era o checkbox de "paguei mais uma" — que só
   * AVANÇA. Quem marcou pago por engano não voltava, e quem errou o número de
   * parcelas ou o valor tinha que apagar a dívida inteira e recadastrar.
   *
   * 08/08: entram CARTÃO e CATEGORIA no rascunho. Faltavam justamente os dois
   * campos que a pessoa erra ao cadastrar rápido — e errar o cartão estraga o
   * "TOTAL POR CARTÃO NO MÊS", que é o número conferido contra a fatura.
   * Apagar e refazer a dívida só por causa disso não fazia sentido.
   *
   * 07/09: a edição ganha um LÁPIS visível. Abria só no toque do nome, sem
   * nenhum sinal de que o nome era tocável — avaliação 3★: "muitas áreas não
   * clicáveis... nem alterar parcelas no cartão".
   */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState({
    description: "", installmentValue: "", paidInstallments: "", totalInstallments: "", date: "", cardName: "", category: "",
  });

  const comecarEdicao = (i: Installment) => {
    setEditandoId(i.id);
    setRascunho({
      description: i.description,
      installmentValue: String(i.installmentValue),
      paidInstallments: String(i.paidInstallments),
      totalInstallments: String(i.totalInstallments),
      date: i.date ?? "",
      cardName: i.cardName || "outro",
      // categoria legada ("roupa") entra no seletor já como o value comum, pra
      // não abrir a edição mostrando um campo vazio
      category: catValue(i.category),
    });
  };

  const salvarEdicao = () => {
    const valor = parseFloat(rascunho.installmentValue);
    const total = parseInt(rascunho.totalInstallments, 10);
    const pagas = parseInt(rascunho.paidInstallments, 10);
    if (!rascunho.description.trim() || !Number.isFinite(valor) || !Number.isInteger(total) || total < 1) return;
    // pagas nunca passa do total nem fica negativo: é isso que decide se a
    // dívida conta como quitada nos totais e nas conquistas
    const pagasOk = Math.max(0, Math.min(Number.isInteger(pagas) ? pagas : 0, total));
    gravar(installments.map((i) => {
      if (i.id !== editandoId) return i;
      // "Já paguei" mudou → a parcela do mês acompanha, preservando se ela
      // estava marcada como paga ou não (senão o checkbox mentiria)
      const estavaPaga = parcelaPagaNoMes(i);
      const parcela = Math.min(estavaPaga ? pagasOk : pagasOk + 1, total + 1);
      return {
        ...i,
        description: rascunho.description.trim(),
        installmentValue: valor,
        totalInstallments: total,
        paidInstallments: pagasOk,
        parcelaDoMes: Math.max(1, parcela),
        totalValue: valor * total,
        date: rascunho.date || i.date,
        cardName: rascunho.cardName || i.cardName || "outro",
        category: rascunho.category || i.category || "outros",
      };
    }));
    setEditandoId(null);
  };

  /* O checkbox agora É o estado (07/09). Antes era `checked={false}` fixo com
     "paguei mais uma" no toque — nunca refletia nada e não desfazia. Agora
     marca/desmarca a parcela DESTE mês. */
  const marcarPaga = (id: string, paga: boolean) => {
    gravar(installments.map((i) => (i.id === id ? marcarParcelaDoMes(i, paga, mesDaChave) : i)));
  };

  // Lista que aparece: as do mês (editáveis) + as previstas de outros meses
  const previstas = new Set(projetadas.map((p) => p.id));
  const todas: Installment[] = [...installments, ...projetadas];
  const totalMonthly = somaParcelasDoMes(todas);

  // Group by card for the summary — merge installments + variable expenses
  const cardTotals = todas.reduce((acc, i) => {
    const v = valorDaParcelaNoMes(i);
    if (v > 0) acc[i.cardName] = (acc[i.cardName] || 0) + v;
    return acc;
  }, {} as Record<string, number>);

  /* Gastos do cartão que caem na FATURA deste mês: os deste mês antes do
     fechamento + os do mês anterior depois do fechamento de lá (cartão sem
     fechamento cadastrado: tudo do mês, como sempre). */
  const mesAnterior = somarMeses(mesDaChave, -1);
  const variableCardSpending: Record<string, number> = {};
  for (const e of variableExpenses) {
    if (e?.cardName && mesDoGasto(e, configOf, mesDaChave) === mesDaChave) variableCardSpending[e.cardName] = (variableCardSpending[e.cardName] || 0) + (e.value || 0);
  }
  for (const e of variableExpensesAnterior) {
    if (e?.cardName && mesDoGasto(e, configOf, mesAnterior) === mesDaChave) variableCardSpending[e.cardName] = (variableCardSpending[e.cardName] || 0) + (e.value || 0);
  }

  // Merge into unified card totals
  const allCardTotals = { ...cardTotals };
  Object.entries(variableCardSpending).forEach(([card, amount]) => {
    allCardTotals[card] = (allCardTotals[card] || 0) + (amount as number);
  });

  return (
    <div className="space-y-4">
      {/* Main installments table */}
      <div className="bg-card rounded-lg overflow-hidden border border-border animate-fade-in">
        <div className="bg-muted/50 py-2 px-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          <span className="font-bold text-sm tracking-wide">CARTÃO DE CRÉDITO — PARCELAMENTOS</span>
        </div>
        <p className="px-4 py-1.5 text-[10px] text-muted-foreground border-b border-border/60">
          Cada parcela aparece sozinha nos meses seguintes até quitar. O ✓ marca a parcela deste mês como paga.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[650px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Nome</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Parcela</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Data</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Cartão</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Categoria</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs">Valor/Parcela</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Paga</th>
              </tr>
            </thead>
            <tbody>
              {todas.map((inst) => {
                const isDone = parcelaQuitada(inst);
                const prevista = previstas.has(inst.id);
                const k = parcelaDoMes(inst);
                const paga = parcelaPagaNoMes(inst);
                if (editandoId === inst.id && !prevista) return (
                  <tr key={inst.id} className="border-b border-border/50 bg-primary/[0.04]">
                    <td colSpan={7} className="px-3 py-3">
                      <div className="space-y-2 max-w-xl">
                        <Input
                          autoFocus
                          value={rascunho.description}
                          onChange={(e) => setRascunho({ ...rascunho, description: e.target.value })}
                          placeholder="Descrição"
                          className="h-9 text-xs"
                        />
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <label className="text-[10px] text-muted-foreground">
                            Valor da parcela
                            <Input type="number" inputMode="decimal" value={rascunho.installmentValue}
                              onChange={(e) => setRascunho({ ...rascunho, installmentValue: e.target.value })}
                              className="h-9 text-xs mt-0.5" />
                          </label>
                          <label className="text-[10px] text-muted-foreground">
                            Já paguei
                            <Input type="number" inputMode="numeric" value={rascunho.paidInstallments}
                              onChange={(e) => setRascunho({ ...rascunho, paidInstallments: e.target.value })}
                              className="h-9 text-xs mt-0.5" />
                          </label>
                          <label className="text-[10px] text-muted-foreground">
                            Total de parcelas
                            <Input type="number" inputMode="numeric" value={rascunho.totalInstallments}
                              onChange={(e) => setRascunho({ ...rascunho, totalInstallments: e.target.value })}
                              className="h-9 text-xs mt-0.5" />
                          </label>
                          <label className="text-[10px] text-muted-foreground">
                            1ª parcela
                            <CampoData rotulo="Data" value={rascunho.date}
                              onChange={(e) => setRascunho({ ...rascunho, date: e.target.value })}
                              className="h-9 text-xs mt-0.5" />
                          </label>
                        </div>
                        {/* Cartão e categoria também se corrigem aqui (08/08).
                            Legenda em <span>: um <label> em volta do gatilho do
                            Select reenvia o clique e o menu abre e fecha junto. */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] text-muted-foreground">Cartão</span>
                            <div className="mt-0.5">
                              <CardSelect value={rascunho.cardName} onValueChange={(v) => setRascunho({ ...rascunho, cardName: v })} className="h-9 text-xs w-full" />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] text-muted-foreground">Categoria</span>
                            <div className="mt-0.5">
                              <CategorySelect kind="variable" value={rascunho.category} onValueChange={(v) => setRascunho({ ...rascunho, category: v })} className="h-9 text-xs w-full" />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={salvarEdicao} className="h-9 flex-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold">Salvar</button>
                          <button onClick={() => setEditandoId(null)} className="h-9 px-4 rounded-md border border-border text-xs font-semibold text-muted-foreground">Cancelar</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
                return (
                  <tr key={inst.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${isDone ? "opacity-50" : ""} ${prevista ? "text-muted-foreground" : ""}`}>
                    <td className="px-3 py-2 font-medium">
                      {prevista ? (
                        <span className="flex items-center gap-1.5 flex-wrap">
                          {inst.description}
                          <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground" title="Vem de outro mês — edite lá">previsto</span>
                        </span>
                      ) : (
                        <button onClick={() => comecarEdicao(inst)} aria-label={`Editar ${inst.description}`} className="flex items-center gap-1.5 text-left hover:underline min-h-[44px] -my-2">
                          {inst.description}
                          <Pencil className="w-3 h-3 text-muted-foreground shrink-0" aria-hidden="true" />
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs font-mono whitespace-nowrap ${isDone ? "text-green-500" : ""}`} title={`${inst.paidInstallments} de ${inst.totalInstallments} pagas`}>
                        {isDone ? "quitado" : `${k} de ${inst.totalInstallments}`}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-muted-foreground text-xs">
                      {inst.date ? new Date(inst.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`category-badge ${getCardStyle(inst.cardName)}`}>
                        {getCardLabel(inst.cardName)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`category-badge ${getCatStyle(catValue(inst.category))}`}>
                        {getCatLabel(catValue(inst.category))}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      R$ {brl(inst.installmentValue)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-2">
                        {!isDone && !prevista && (
                          // Alvo de 44px: o checkbox de 16px era outra "área não
                          // clicável" da avaliação — o dedo não acertava.
                          <label className="min-h-[44px] min-w-[44px] -my-2 flex items-center justify-center cursor-pointer" title={paga ? "Parcela deste mês paga" : "Marcar parcela deste mês como paga"}>
                            <Checkbox
                              checked={paga}
                              onCheckedChange={(v) => marcarPaga(inst.id, v === true)}
                              aria-label={`${paga ? "Desmarcar" : "Marcar"} parcela ${k} de ${inst.description} como paga`}
                              className="h-4 w-4"
                            />
                          </label>
                        )}
                        {!prevista && (
                          <button onClick={() => deleteInstallment(inst.id)} aria-label={`Apagar ${inst.description}`} className="min-h-[44px] min-w-[32px] -my-2 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border">
                <td className="px-3 py-2 text-xs text-muted-foreground" colSpan={5}>TOTAL MENSAL</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums" colSpan={2}>
                  R$ {brl(totalMonthly)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="p-3 border-t border-border">
          {showForm ? (
            <div className="space-y-2 p-3 rounded-lg bg-muted/30">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Nome do item" value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} className="text-xs" />
                <Input type="number" placeholder="Valor total" value={newItem.totalValue} onChange={(e) => setNewItem({ ...newItem, totalValue: e.target.value })} className="text-xs" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input type="number" placeholder="Total parcelas" value={newItem.totalInstallments} onChange={(e) => setNewItem({ ...newItem, totalInstallments: e.target.value })} className="text-xs" />
                <Input type="number" placeholder="Pagas" value={newItem.paidInstallments} onChange={(e) => setNewItem({ ...newItem, paidInstallments: e.target.value })} className="text-xs" />
                <div className="relative">
                  <Input type="date" value={newItem.date} onChange={(e) => setNewItem({ ...newItem, date: e.target.value })} className="text-xs" />
                </div>
              </div>
              {/* Mesmos seletores do resto do financeiro: o cartão aceita os
                  personalizados (Renner, Will…) e a categoria é a lista comum,
                  com as que o usuário criou. */}
              <div className="grid grid-cols-2 gap-2">
                <CardSelect value={newItem.cardName} onValueChange={(v) => setNewItem({ ...newItem, cardName: v })} className="h-9 text-xs w-full" />
                <CategorySelect kind="variable" value={newItem.category} onValueChange={(v) => setNewItem({ ...newItem, category: v })} className="h-9 text-xs w-full" />
              </div>
              <div className="flex gap-2">
                <Button onClick={addInstallment} size="sm" className="flex-1 text-xs">Salvar</Button>
                <Button variant="outline" size="sm" onClick={() => setShowForm(false)} className="text-xs">Cancelar</Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setShowForm(true)} variant="outline" size="sm" className="w-full border-dashed text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> Novo Parcelamento
            </Button>
          )}
        </div>
      </div>

      {/* Card spending summary - parcelamentos + gastos variáveis. Com
          fechamento cadastrado a linha vira a FATURA do mês (07/09). */}
      {Object.keys(allCardTotals).length > 0 && (
        <div className="bg-card rounded-lg overflow-hidden border border-border animate-fade-in">
          <div className="bg-muted/50 py-2 px-4">
            <span className="font-bold text-sm tracking-wide">💳 TOTAL POR CARTÃO NO MÊS</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Cartão</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs">Parcelas</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs">Gastos</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(allCardTotals)
                  .sort(([, a], [, b]) => b - a)
                  .map(([card, total]) => {
                    const cfg = configOf(card);
                    const vencimento = rotuloVencimento(cfg);
                    return (
                      <tr key={card} className="border-b border-border/50">
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`category-badge ${getCardStyle(card)}`}>
                              {getCardLabel(card)}
                            </span>
                            {cfg?.closingDay && (
                              <span className="text-[10px] text-muted-foreground">
                                Fatura de {nomeDoMes(mesDaChave)}{vencimento ? ` · ${vencimento}` : ""}
                              </span>
                            )}
                            <CartaoConfig card={card} label={getCardLabel(card)} />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground align-top">
                          {(cardTotals[card] || 0) > 0 ? `R$ ${brl(cardTotals[card] || 0)}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground align-top">
                          {(variableCardSpending[card] || 0) > 0 ? `R$ ${brl(variableCardSpending[card] || 0)}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold align-top">
                          R$ {brl(total)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 text-xs font-bold">TOTAL CARTÕES</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-medium">
                    R$ {brl(Object.values(cardTotals).reduce((a, b) => a + b, 0))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-medium">
                    R$ {brl((Object.values(variableCardSpending) as number[]).reduce((a, b) => a + b, 0))}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    R$ {brl(Object.values(allCardTotals).reduce((a, b) => a + b, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
