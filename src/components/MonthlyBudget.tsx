import { useState } from "react";
import { FileText, ChevronRight, ChevronLeft } from "lucide-react";
import { getFinanceStorageKeys, isCurrentMonth, getCurrentYear, readMonthData } from "@/components/finance/storage-keys";
import { useAuth } from "@/hooks/use-auth";

interface MonthBudget {
  month: string;
  value: number;
  hasNote: boolean;
}

interface MonthlyBudgetProps {
  budgets: MonthBudget[];
  setBudgets: (budgets: MonthBudget[]) => void;
  onOpenMonth?: (month: string, year: number) => void;
}

const currentMonthIndex = new Date().getMonth();

/**
 * ANO ANTERIOR (01/09) — pedido de cliente por WhatsApp: "quer voltar a ano de
 * finanças tipo botar 2024 2025, trazer do app antigo dele pra cá, pq ele
 * organizou 2024 2025".
 *
 * O armazenamento já estava pronto: as chaves de mês arquivado nascem
 * `finance-{ano}-{mes}-{sufixo}` e `getFinanceStorageKeys` aceita ano desde a
 * migração v2. O que faltava era a tela PERGUNTAR o ano — esta lista mostrava
 * os 12 meses do ano corrente e mais nada, então um mês de 2024 existia no
 * banco sem porta de entrada.
 *
 * O limite pra trás é 2015 por bom senso (não há o que digitar antes disso) e
 * pra frente é o ano corrente: planilha de mês que ainda não existe seria
 * convite a lançar despesa no lugar errado e não achar depois.
 */
const ANO_MINIMO = 2015;

const hasMonthData = (userId: string | null, month: string, year: number) => {
  const keys = getFinanceStorageKeys(month, year);
  const incomes = readMonthData(userId, keys.incomes) || [];
  const expenses = readMonthData(userId, keys.expenses) || [];
  const fixed = readMonthData(userId, keys.fixed) || [];
  return incomes.length > 0 || expenses.length > 0 || fixed.length > 0;
};

export const MonthlyBudget = ({ budgets, setBudgets, onOpenMonth }: MonthlyBudgetProps) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const anoAtual = getCurrentYear();
  const [ano, setAno] = useState(anoAtual);
  const noAnoCorrente = ano === anoAtual;

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border animate-fade-in">
      <div className="bg-accent/20 border-b border-border px-4 py-2 flex items-center gap-2">
        <span className="font-bold text-xs tracking-wide text-foreground">ORÇAMENTO MENSAL</span>
        <span>💰</span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => setAno((a) => Math.max(ANO_MINIMO, a - 1))}
            disabled={ano <= ANO_MINIMO}
            aria-label="Ano anterior"
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-background/60 disabled:opacity-30"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-bold tabular-nums min-w-[38px] text-center">{ano}</span>
          <button
            onClick={() => setAno((a) => Math.min(anoAtual, a + 1))}
            disabled={ano >= anoAtual}
            aria-label="Próximo ano"
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-background/60 disabled:opacity-30"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="divide-y divide-border/50">
        {budgets.map((b, i) => {
          const hasData = hasMonthData(userId, b.month, ano);
          // "Atual" só existe no ano corrente — em 2024, Setembro não é o mês
          // de agora, é só mais um mês da planilha.
          const isCurrent = noAnoCorrente && i === currentMonthIndex;
          return (
            <button
              key={b.month}
              onClick={() => onOpenMonth?.(b.month, ano)}
              className={`w-full flex items-center px-3 py-2 hover:bg-muted/30 transition-colors text-left gap-2 ${
                isCurrent ? "bg-primary/5" : ""
              }`}
            >
              <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${
                isCurrent ? "text-primary" : "text-muted-foreground"
              }`} />
              <span className={`text-xs flex-1 ${
                isCurrent ? "font-bold text-primary" : ""
              }`}>
                {b.month}
                {isCurrent && <span className="text-[9px] ml-1 opacity-70">(atual)</span>}
              </span>
              {hasData && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-success/15 text-success font-medium">
                  ativo
                </span>
              )}
              <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            </button>
          );
        })}
      </div>
      {!noAnoCorrente && (
        <p className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border">
          Você está em {ano}. Abra um mês para lançar ou consultar o que aconteceu nele.
        </p>
      )}
    </div>
  );
};
