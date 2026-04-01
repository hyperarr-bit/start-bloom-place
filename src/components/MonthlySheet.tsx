import { usePersistedState } from "@/hooks/use-persisted-state";
import { IncomeTable } from "@/components/IncomeTable";
import { ExpenseTable } from "@/components/ExpenseTable";
import { FixedExpensesTable } from "@/components/FixedExpensesTable";
import { BillsDueCards } from "@/components/BillsDueCards";
import { InstallmentTracker } from "@/components/InstallmentTracker";
import { Notes } from "@/components/Notes";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFinanceStorageKeys, isCurrentMonth } from "@/components/finance/storage-keys";

interface MonthlySheetProps {
  month: string;
  onClose: () => void;
}

export const MonthlySheet = ({ month, onClose }: MonthlySheetProps) => {
  const keys = getFinanceStorageKeys(month);
  const isCurrent = isCurrentMonth(month);

  const [incomes, setIncomes] = usePersistedState(keys.incomes, [] as any[]);
  const [expenses, setExpenses] = usePersistedState(keys.expenses, [] as any[]);
  const [fixedExpenses, setFixedExpenses] = usePersistedState(keys.fixed, [] as any[]);
  const [dueDays, setDueDays] = usePersistedState(keys.dueDays, [
    { day: 5, color: "yellow", bills: [] as any[] },
    { day: 10, color: "slate", bills: [] as any[] },
    { day: 20, color: "indigo", bills: [] as any[] },
    { day: 30, color: "emerald", bills: [] as any[] },
  ]);
  const [notes, setNotes] = usePersistedState(keys.notes, [] as any[]);
  const [installments, setInstallments] = usePersistedState(keys.installments, [] as any[]);

  const totalIncome = incomes.reduce((sum: number, i: any) => sum + i.value, 0);
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + e.value, 0);
  const totalFixed = fixedExpenses.reduce((sum: number, e: any) => sum + e.value, 0);
  const totalDebts = installments.reduce(
    (sum: number, i: any) => sum + (i.totalInstallments - i.paidInstallments) * i.installmentValue, 0
  );
  const balance = totalIncome - totalExpenses - totalFixed - totalDebts;

  return (
    <div className="space-y-5">
      <Button
        onClick={onClose}
        variant="outline"
        className="w-full py-6 text-base font-bold gap-3 border-2 border-primary/30 hover:border-primary hover:bg-primary/5"
      >
        <ArrowLeft className="w-5 h-5" />
        ← VOLTAR AO FINANCEIRO GERAL
      </Button>

      <div className="bg-card rounded-lg border border-border p-4 text-center">
        <span className="text-xs text-muted-foreground font-medium">
          {isCurrent ? "MÊS ATUAL" : "PLANILHA DO MÊS"}
        </span>
        <h2 className="text-xl font-bold tracking-tight mt-1">📅 {month.toUpperCase()}</h2>
        {isCurrent && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Os dados aqui são os mesmos do financeiro geral
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg p-3 border bg-card-receitas border-card-receitas-border">
          <span className="text-[10px] font-bold text-card-receitas-text">RECEITAS</span>
          <p className="text-sm font-bold text-card-receitas-text mt-1">
            R$ {totalIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg p-3 border bg-card-despesas border-card-despesas-border">
          <span className="text-[10px] font-bold text-card-despesas-text">DESPESAS</span>
          <p className="text-sm font-bold text-card-despesas-text mt-1">
            R$ {(totalExpenses + totalFixed).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className={`rounded-lg p-3 border text-center ${
        balance >= 0 ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30"
      }`}>
        <span className="text-[10px] font-bold text-muted-foreground">BALANÇO DO MÊS</span>
        <p className={`text-lg font-bold ${balance >= 0 ? "text-success" : "text-destructive"}`}>
          R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
      </div>

      <div className="min-w-0">
        <IncomeTable incomes={incomes} setIncomes={setIncomes} />
      </div>
      <div className="min-w-0">
        <FixedExpensesTable expenses={fixedExpenses} setExpenses={setFixedExpenses} />
      </div>
      <div className="min-w-0">
        <ExpenseTable expenses={expenses} setExpenses={setExpenses} />
      </div>
      <BillsDueCards dueDays={dueDays} setDueDays={setDueDays} />
      <div className="min-w-0">
        <InstallmentTracker installments={installments} setInstallments={setInstallments} />
      </div>
      <Notes notes={notes} setNotes={setNotes} />

      <Button
        onClick={onClose}
        variant="outline"
        className="w-full py-6 text-base font-bold gap-3 border-2 border-primary/30 hover:border-primary hover:bg-primary/5"
      >
        <ArrowLeft className="w-5 h-5" />
        ← VOLTAR AO FINANCEIRO GERAL
      </Button>
    </div>
  );
};
