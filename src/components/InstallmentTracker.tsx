import { useState } from "react";
import { Plus, Trash2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface Installment {
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

const installmentCategories = [
  { value: "roupa", label: "Roupa", color: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  { value: "beleza", label: "Beleza", color: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
  { value: "eletronicos", label: "Eletrônicos", color: "bg-red-500/15 text-red-600 dark:text-red-300" },
  { value: "saude", label: "Saúde", color: "bg-green-500/15 text-green-700 dark:text-green-300" },
  { value: "pets", label: "Pets", color: "bg-slate-800/15 text-slate-700 dark:text-slate-300" },
  { value: "casa", label: "Casa", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { value: "educacao", label: "Educação", color: "bg-teal-500/15 text-teal-700 dark:text-teal-300" },
  { value: "lazer", label: "Lazer", color: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  { value: "outros", label: "Outros", color: "bg-gray-500/15 text-gray-700 dark:text-gray-300" },
];

const getCardStyle = (v: string) => cardOptions.find((c) => c.value === v)?.color || "bg-gray-500/15 text-gray-700";
const getCardLabel = (v: string) => cardOptions.find((c) => c.value === v)?.label || v;
const getCatStyle = (v: string) => installmentCategories.find((c) => c.value === v)?.color || "bg-gray-500/15 text-gray-700";
const getCatLabel = (v: string) => installmentCategories.find((c) => c.value === v)?.label || v;

export const InstallmentTracker = ({ installments, setInstallments, variableExpenses = [] }: InstallmentTrackerProps) => {
  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState({
    description: "", totalValue: "", totalInstallments: "", paidInstallments: "", cardName: "", category: "", date: "",
  });

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
          date: newItem.date || new Date().toISOString().split("T")[0],
        },
      ]);
      setNewItem({ description: "", totalValue: "", totalInstallments: "", paidInstallments: "", cardName: "", category: "", date: "" });
      setShowForm(false);
    }
  };

  const deleteInstallment = (id: string) => {
    setInstallments(installments.filter((i) => i.id !== id));
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
                return (
                  <tr key={inst.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${isDone ? "opacity-50" : ""}`}>
                    <td className="px-3 py-2 font-medium">{inst.description}</td>
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
                      <span className={`category-badge ${getCatStyle(inst.category || "outros")}`}>
                        {getCatLabel(inst.category || "outros")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      R$ {inst.installmentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
                  R$ {totalMonthly.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
                <Input type="date" value={newItem.date} onChange={(e) => setNewItem({ ...newItem, date: e.target.value })} className="text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={newItem.cardName} onValueChange={(v) => setNewItem({ ...newItem, cardName: v })}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Cartão" /></SelectTrigger>
                  <SelectContent>{cardOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={newItem.category} onValueChange={(v) => setNewItem({ ...newItem, category: v })}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>{installmentCategories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
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
                        {(cardTotals[card] || 0) > 0 ? `R$ ${(cardTotals[card] || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                        {(variableCardSpending[card] || 0) > 0 ? `R$ ${(variableCardSpending[card] || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold">
                        R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 text-xs font-bold">TOTAL CARTÕES</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-medium">
                    R$ {Object.values(cardTotals).reduce((a, b) => a + b, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-medium">
                    R$ {(Object.values(variableCardSpending) as number[]).reduce((a, b) => a + b, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    R$ {Object.values(allCardTotals).reduce((a, b) => a + b, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
