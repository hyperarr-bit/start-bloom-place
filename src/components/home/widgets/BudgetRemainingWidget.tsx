import { motion } from "framer-motion";
import { useUserData } from "@/hooks/use-user-data";
import { doPerfil, doPerfilDueDays, PERFIL_PESSOAL } from "@/lib/finance-perfil";
import { somaParcelasDoMes, type Parcela } from "@/lib/finance-parcelas";
import { computeDailyBudget, computeMonthlyOutflow } from "@/lib/finance-totals";

const lista = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const valor = (i: any) => Number(i?.value) || Number(i?.amount) || 0;

/* MESMA CONTA DO FINANÇAS (29/09, varredura). O widget tinha fórmula própria:
   sem as PARCELAS do mês e dividindo pelos dias que faltam SEM contar hoje — em
   29/09 dizia "≈ R$ 3.677,60/dia por 1 dias" (sobram 2 dias: 29 e 30) e, com um
   parcelamento de R$ 150, mostrava R$ 150 a mais que o módulo. Agora é o
   computeDailyBudget de lib/finance-totals, o mesmo do Dashboard e dos Desejos. */
export const BudgetRemainingWidget = () => {
  const { get } = useUserData();
  // 03/09: só o perfil ativo (PF/PJ) — a empresa não entra no orçamento pessoal
  const perfil = get<string>("finance-perfil-ativo", PERFIL_PESSOAL) || PERFIL_PESSOAL;
  const incomes = doPerfil(lista(get<unknown>("finance-incomes", [])), perfil);
  const variableExpenses = doPerfil(lista(get<unknown>("finance-expenses", [])), perfil);
  const fixedExpenses = doPerfil(lista(get<unknown>("finance-fixed-expenses", [])), perfil);
  const parcelas = doPerfil(lista(get<unknown>("finance-installments", [])), perfil) as Parcela[];
  const dueDays = doPerfilDueDays(lista(get<unknown>("finance-dueDays", [])), perfil);
  const totalIncome = incomes.reduce((s: number, i: any) => s + valor(i), 0);
  const totalExpense = computeMonthlyOutflow(
    variableExpenses.reduce((s: number, e: any) => s + valor(e), 0),
    fixedExpenses.reduce((s: number, e: any) => s + valor(e), 0),
    somaParcelasDoMes(parcelas),
  );
  const pct = totalIncome > 0 ? Math.min((totalExpense / totalIncome) * 100, 100) : 0;
  const { availableReal: remaining, perDay: dailyBudget, remainingDays: daysLeft } = computeDailyBudget(totalIncome, totalExpense, dueDays, fixedExpenses);

  return (
    <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">💰 Orçamento Restante</h4>
      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-lg font-bold ${remaining >= 0 ? "text-emerald-600" : "text-destructive"}`}>
          {remaining.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-2">
        <motion.div
          className={`h-full rounded-full ${pct > 90 ? "bg-destructive" : pct > 70 ? "bg-warning" : "bg-emerald-500"}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {remaining <= 0
          ? "O mês já está no limite — nada sobrando pra gastar"
          : daysLeft > 1
            ? `≈ ${dailyBudget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/dia por ${daysLeft} dias (contando hoje)`
            : "Último dia do mês — é o que sobra pra hoje"
        }
      </p>
    </div>
  );
};
