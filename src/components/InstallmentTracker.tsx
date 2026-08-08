import { useEffect, useState } from "react";
import { localDayKey } from "@/lib/utils";
import { Plus, Trash2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampoData } from "@/components/ui/campo-data";
import { Checkbox } from "@/components/ui/checkbox";
import { CardSelect } from "@/components/finance/CardSelect";
import { CategorySelect } from "@/components/finance/CategorySelect";
import { useFinanceCards } from "@/lib/finance-cards";
import { useFinanceCategories } from "@/lib/finance-categories";

/** Formato gravado em `finance-installments` — exportado porque o ExpenseTable
 *  cria parcelamento no MESMO formato (uma porta de entrada, um só formato). */
export interface Installment {
  id: string;
  description: string;
  totalValue: number;
  installmentValue: number;
  paidInstallments: number;
  totalInstallments: number;
  cardName: string;
  category: string;
  date: string;
}

interface InstallmentTrackerProps {
  installments: Installment[];
  setInstallments: (installments: Installment[]) => void;
  variableExpenses?: any[];
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

export const InstallmentTracker = ({ installments, setInstallments, variableExpenses = [] }: InstallmentTrackerProps) => {
  const { labelOf: getCardLabel, styleOf: getCardStyle } = useFinanceCards();
  const { labelOf: getCatLabel, styleOf: getCatStyle } = useFinanceCategories();
  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState({
    description: "", totalValue: "", totalInstallments: "", paidInstallments: "", cardName: "", category: "", date: "",
  });

  // Recebe o parcelamento criado lá no "+ Novo gasto" (ver NOVO_PARCELAMENTO_EVENT).
  // A lista entra pelo setInstallments do pai, então total mensal, dívidas,
  // calendário e conquistas recalculam na hora, sem recarregar.
  useEffect(() => {
    const onNovo = (e: Event) => {
      const detalhe = (e as CustomEvent<NovoParcelamentoDetalhe>).detail;
      if (!detalhe?.installment) return;
      detalhe.handled = true;
      setInstallments([...installments, detalhe.installment]);
    };
    window.addEventListener(NOVO_PARCELAMENTO_EVENT, onNovo);
    return () => window.removeEventListener(NOVO_PARCELAMENTO_EVENT, onNovo);
  }, [installments, setInstallments]);

  const addInstallment = () => {
    if (newItem.description && newItem.totalValue && newItem.totalInstallments) {
      const totalValue = parseFloat(newItem.totalValue);
      const totalInstallments = parseInt(newItem.totalInstallments);
      setInstallments([
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
    setInstallments(installments.filter((i) => i.id !== id));
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
    setInstallments(installments.map((i) => i.id !== editandoId ? i : {
      ...i,
      description: rascunho.description.trim(),
      installmentValue: valor,
      totalInstallments: total,
      paidInstallments: pagasOk,
      totalValue: valor * total,
      date: rascunho.date || i.date,
      cardName: rascunho.cardName || i.cardName || "outro",
      category: rascunho.category || i.category || "outros",
    }));
    setEditandoId(null);
  };

  const payInstallment = (id: string) => {
    setInstallments(
      installments.map((i) =>
        i.id === id && i.paidInstallments < i.totalInstallments
          ? { ...i, paidInstallments: i.paidInstallments + 1 }
          : i
      )
    );
  };

  const totalMonthly = installments.reduce(
    (sum, i) => i.paidInstallments < i.totalInstallments ? sum + i.installmentValue : sum, 0
  );

  // Group by card for the summary — merge installments + variable expenses
  const cardTotals = installments.reduce((acc, i) => {
    if (i.paidInstallments < i.totalInstallments) {
      acc[i.cardName] = (acc[i.cardName] || 0) + i.installmentValue;
    }
    return acc;
  }, {} as Record<string, number>);

  // Add variable expense card spending
  const variableCardSpending = variableExpenses
    .filter((e: any) => e.cardName)
    .reduce((acc: Record<string, number>, e: any) => {
      acc[e.cardName] = (acc[e.cardName] || 0) + (e.value || 0);
      return acc;
    }, {} as Record<string, number>);

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

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[650px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Nome</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Parcelas</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Data</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Cartão</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Categoria</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs">Valor/Parcela</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {installments.map((inst) => {
                const isDone = inst.paidInstallments >= inst.totalInstallments;
                if (editandoId === inst.id) return (
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
 <tr key={inst.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${isDone ? "opacity-50" : ""}`}>
 <td className="px-3 py-2 font-medium">
 <button onClick={() => comecarEdicao(inst)} aria-label={`Editar ${inst.description}`} className="text-left hover:underline">
 {inst.description}
 </button>
 </td>
 <td className="px-3 py-2 text-center">
 <span className={`text-xs font-mono ${isDone ? "text-green-500" : ""}`}>
 {inst.paidInstallments}/{inst.totalInstallments}
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
 R$ {inst.installmentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
 </td>
 <td className="px-3 py-2 flex items-center gap-1">
 {!isDone && (
 <Checkbox
 checked={false}
 onCheckedChange={() => payInstallment(inst.id)}
 className="h-4 w-4"
 />
 )}
 <button onClick={() => deleteInstallment(inst.id)} className="text-muted-foreground hover:text-destructive transition-colors">
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 </td>
 </tr>
 );
 })}
 </tbody>
 <tfoot>
 <tr className="border-t border-border">
 <td className="px-3 py-2 text-xs text-muted-foreground" colSpan={5}>TOTAL MENSAL</td>
 <td className="px-3 py-2 text-right font-bold tabular-nums" colSpan={2}>
 R$ {totalMonthly.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

      {/* Card spending summary - parcelamentos + gastos variáveis */}
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
                  .map(([card, total]) => (
                    <tr key={card} className="border-b border-border/50">
                      <td className="px-3 py-2">
                        <span className={`category-badge ${getCardStyle(card)}`}>
                          {getCardLabel(card)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                        {(cardTotals[card] || 0) > 0 ? `R$ ${(cardTotals[card] || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                        {(variableCardSpending[card] || 0) > 0 ? `R$ ${(variableCardSpending[card] || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold">
                        R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 text-xs font-bold">TOTAL CARTÕES</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-medium">
                    R$ {Object.values(cardTotals).reduce((a, b) => a + b, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-medium">
                    R$ {(Object.values(variableCardSpending) as number[]).reduce((a, b) => a + b, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    R$ {Object.values(allCardTotals).reduce((a, b) => a + b, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
