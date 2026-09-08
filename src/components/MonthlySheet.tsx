import { useMemo } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useUserData } from "@/hooks/use-user-data";
import { usarListaDoPerfil, usarDueDaysDoPerfil, doPerfil, PERFIL_PESSOAL } from "@/lib/finance-perfil";
import { IncomeTable } from "@/components/IncomeTable";
import { ExpenseTable } from "@/components/ExpenseTable";
import { FixedExpensesTable } from "@/components/FixedExpensesTable";
import { BillsDueCards } from "@/components/BillsDueCards";
import { InstallmentTracker } from "@/components/InstallmentTracker";
import { Notes } from "@/components/Notes";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFinanceStorageKeys, isCurrentMonth, getCurrentYear } from "@/components/finance/storage-keys";
import { computeMonthlyOutflow } from "@/lib/finance-totals";
import {
  type Parcela, mesIdDe, mesesAnteriores, somarMeses, chaveArquivadaDeParcelas, projetarParcelas, somaParcelasDoMes,
} from "@/lib/finance-parcelas";
import { variaveisDoMes } from "@/lib/finance-fatura";
import { useFinanceCards } from "@/lib/finance-cards";
import { chaveArquivada } from "@/lib/virada-do-mes";
import { mesCorrenteId } from "@/lib/virada-contas";

interface MonthlySheetProps {
  month: string;
  /** Ano da planilha. Ausente = ano corrente, que é como esta tela sempre
   *  funcionou — pedido de cliente (01/09) para trazer 2024 e 2025 de um app
   *  antigo: "ele organizou 2024 2025". As chaves já sabiam o ano
   *  (`getFinanceStorageKeys(mes, ano)`); só a tela é que não perguntava. */
  year?: number;
  onClose: () => void;
}

const VAZIA: any[] = [];

export const MonthlySheet = ({ month, year, onClose }: MonthlySheetProps) => {
  const ano = year ?? getCurrentYear();
  const keys = getFinanceStorageKeys(month, ano);
  const isCurrent = isCurrentMonth(month) && ano === getCurrentYear();
  const mesId = mesIdDe(month, ano);
  const agora = mesCorrenteId();
  const { get } = useUserData();
  const { configOf } = useFinanceCards();

  /* 03/09: a planilha do mês segue o perfil ativo (PF/PJ), com a volta
     mesclada — nunca grava a lista filtrada por cima da completa. */
  const [perfilAtivo] = usePersistedState<string>("finance-perfil-ativo", PERFIL_PESSOAL);
  const [incomesTodos, setIncomesTodos] = usePersistedState(keys.incomes, [] as any[]);
  const [expensesTodos, setExpensesTodos] = usePersistedState(keys.expenses, [] as any[]);
  const [fixedTodos, setFixedTodos] = usePersistedState(keys.fixed, [] as any[]);
  const [incomes, setIncomes] = usarListaDoPerfil(incomesTodos, setIncomesTodos, perfilAtivo || PERFIL_PESSOAL);
  const [expenses, setExpenses] = usarListaDoPerfil(expensesTodos, setExpensesTodos, perfilAtivo || PERFIL_PESSOAL);
  const [fixedExpenses, setFixedExpenses] = usarListaDoPerfil(fixedTodos, setFixedTodos, perfilAtivo || PERFIL_PESSOAL);
  const [dueDaysTodos, setDueDaysTodos] = usePersistedState(keys.dueDays, [
    { day: 5, color: "yellow", bills: [] as any[] },
    { day: 10, color: "slate", bills: [] as any[] },
    { day: 20, color: "indigo", bills: [] as any[] },
    { day: 30, color: "emerald", bills: [] as any[] },
  ]);
  const [dueDays, setDueDays] = usarDueDaysDoPerfil(dueDaysTodos as any[], setDueDaysTodos, perfilAtivo || PERFIL_PESSOAL);
  const [notes, setNotes] = usePersistedState(keys.notes, [] as any[]);
  const [installmentsTodos, setInstallmentsTodos] = usePersistedState(keys.installments, [] as any[]);
  const [installments, setInstallments] = usarListaDoPerfil(installmentsTodos, setInstallmentsTodos, perfilAtivo || PERFIL_PESSOAL);

  /* PARCELAS DE OUTROS MESES que vencem neste (07/09, lib/finance-parcelas):
     projeção de LEITURA a partir do balde corrente e das chaves passadas —
     nada é gravado nesta chave. Quem edita é a planilha onde a parcela mora;
     aqui elas aparecem como "previsto", com o valor entrando no total. Para
     o mês corrente a lista já é o próprio balde (a virada rodou no App). */
  const projetadas = useMemo(() => {
    if (isCurrent) return VAZIA as Parcela[];
    // do mais recente pro mais antigo; o mês de agora (se for anterior a
    // este) lê o balde corrente, os outros leem a chave arquivada
    const fontes = mesesAnteriores(mesId, 24).map((m) => ({
      mes: m,
      itens: get<Parcela[]>(m === agora ? "finance-installments" : chaveArquivadaDeParcelas(m), VAZIA) || VAZIA,
    }));
    return doPerfil(projetarParcelas(fontes, mesId, installmentsTodos as Parcela[]), perfilAtivo || PERFIL_PESSOAL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCurrent, agora, mesId, installmentsTodos, perfilAtivo, get]);

  /* Gastos do mês ANTERIOR: compra no crédito depois do fechamento do cartão
     cai na fatura deste mês (lib/finance-fatura). Lidos da chave arquivada
     (ou do balde corrente, se o anterior for o mês de agora). */
  const mesAnterior = somarMeses(mesId, -1);
  const expensesAnterior = useMemo(() => {
    const chave = mesAnterior === agora
      ? "finance-expenses"
      : chaveArquivada(Number(mesAnterior.slice(0, 4)), Number(mesAnterior.slice(5, 7)) - 1, "expenses");
    return doPerfil(get<any[]>(chave, VAZIA) || VAZIA, perfilAtivo || PERFIL_PESSOAL);
  }, [mesAnterior, agora, get, perfilAtivo]);

  /* Campo quebrado não pode SUMIR com dinheiro da conta (16/08). Um
     parcelamento gravado com valor inválido (é o que acontece quando o
     total é dividido por 0 parcelas: vira Infinity e o JSON.stringify do
     storage devolve `null`) fazia `(t - p) * null` = 0 — sem crash, mas a
     dívida inteira desaparecia deste total e o saldo do mês ficava bom
     demais. `n()` mantém o número quando ele é válido e trata o resto como
     0 explicitamente, em vez de deixar a coerção decidir calada. */
  const n = (v: unknown) => (Number.isFinite(Number(v)) && v !== null ? Number(v) : 0);
  const totalIncome = incomes.reduce((sum: number, i: any) => sum + n(i.value), 0);
  const totalExpenses = variaveisDoMes(expenses, expensesAnterior, mesId, configOf).total;
  const totalFixed = fixedExpenses.reduce((sum: number, e: any) => sum + n(e.value), 0);
  /* UM TOTAL SÓ (07/09): "DESPESAS" daqui somava só variáveis + fixos,
     enquanto o financeiro geral (Index) usa computeMonthlyOutflow, que inclui
     as parcelas do mês — a mesma pessoa via dois números pro mesmo mês. Agora
     as duas telas passam pela mesma função de lib/finance-totals. */
  const parcelasDoMes = somaParcelasDoMes([...(installments as Parcela[]), ...projetadas]);
  const despesas = computeMonthlyOutflow(totalExpenses, totalFixed, parcelasDoMes);
  const balance = totalIncome - despesas;

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
        <h2 className="text-xl font-bold tracking-tight mt-1">📅 {month.toUpperCase()}{ano !== getCurrentYear() ? ` / ${ano}` : ""}</h2>
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
            R$ {totalIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg p-3 border bg-card-despesas border-card-despesas-border">
          <span className="text-[10px] font-bold text-card-despesas-text">DESPESAS</span>
          <p className="text-sm font-bold text-card-despesas-text mt-1">
            R$ {despesas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[9px] text-card-despesas-text/70 mt-0.5">fixos + variáveis + parcelas do mês</p>
        </div>
      </div>

      <div className={`rounded-lg p-3 border text-center ${
        balance >= 0 ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30"
      }`}>
        <span className="text-[10px] font-bold text-muted-foreground">BALANÇO DO MÊS</span>
        <p className={`text-lg font-bold ${balance >= 0 ? "text-success" : "text-destructive"}`}>
          R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      <div className="min-w-0">
        <IncomeTable incomes={incomes} setIncomes={setIncomes} />
      </div>
      <div className="min-w-0">
        <FixedExpensesTable expenses={fixedExpenses} setExpenses={setFixedExpenses} />
      </div>
      <div className="min-w-0">
        <ExpenseTable expenses={expenses} setExpenses={setExpenses} mes={mesId} />
      </div>
      <BillsDueCards dueDays={dueDays} setDueDays={setDueDays} />
      <div className="min-w-0">
        <InstallmentTracker
          installments={installments}
          setInstallments={setInstallments}
          variableExpenses={expenses}
          variableExpensesAnterior={expensesAnterior}
          mes={mesId}
          projetadas={projetadas}
        />
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
