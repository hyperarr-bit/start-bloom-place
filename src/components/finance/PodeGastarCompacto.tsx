import { useMemo } from "react";
import { ArrowRight, ChevronRight, Wallet } from "lucide-react";
import { reais } from "@/lib/dinheiro";
import { computeDailyBudget, statusDoPodeGastar } from "@/lib/finance-totals";
import { praHojeDoDia } from "@/lib/montar-financas";

/**
 * QUANTO POSSO GASTAR HOJE, VERSÃO COMPACTA, NO TOPO DO MEU FINANCEIRO (1.0.22, 28/10, aprovado pelo dono).
 *
 * MEU FINANCEIRO é a aba mais usada (38% de uso real) e é a porta de entrada de quase toda conta nova; o número que os
 * anúncios e o lembrete do dia 2 prometem morava no fim do Dashboard. Aqui ele aparece em UMA faixa — o número e a
 * linha "Sobram R$ X pra hoje" — e o toque leva ao card inteiro (topo do Dashboard), onde está "Como chegamos nesse
 * número" e o lembrete diário. Não é um segundo card: a conta, o lembrete e a explicação moram num lugar só.
 *
 * A conta é EXATAMENTE a do card do Dashboard: computeDailyBudget(renda, saída do mês, contas do mês com faturas,
 * fixos) e, pro "pra hoje", praHojeDoDia — o Index passa os mesmos valores que passa ao Dashboard.
 *
 * Sem renda anotada: estado vazio honesto — diz o que falta (quanto entra no mês) e leva até RECEITAS, logo abaixo.
 * Sem `data-spotlight`/`data-missao`: as âncoras da missão e da intro continuam só no card do Dashboard.
 */
interface Props {
  totalIncome: number;
  /** a saída do mês (monthlyOutflow) — a mesma `totalExpenses` do Dashboard */
  totalExpenses: number;
  dueDays: unknown[];
  fixedExpenses: unknown[];
  gastoDeHoje?: number;
  onVerNoPainel: () => void;
  onAnotarRenda: () => void;
  /** testes: o "agora" */
  agora?: Date;
}

export const PodeGastarCompacto = ({ totalIncome, totalExpenses, dueDays, fixedExpenses, gastoDeHoje = 0, onVerNoPainel, onAnotarRenda, agora }: Props) => {
  const conta = useMemo(() => {
    const dia = agora ?? new Date();
    const base = computeDailyBudget(totalIncome, totalExpenses, dueDays as never[], fixedExpenses as never[], dia);
    const status = statusDoPodeGastar(base, totalIncome, fixedExpenses as never[], dia);
    const praHoje = praHojeDoDia(totalIncome, totalExpenses, gastoDeHoje, dueDays, fixedExpenses, dia);
    return { ...base, status, praHoje: praHoje && praHoje.gasto > 0 ? praHoje : null };
  }, [totalIncome, totalExpenses, dueDays, fixedExpenses, gastoDeHoje, agora]);

  if (totalIncome <= 0) {
    return (
      <div className="bg-card rounded-lg border border-border px-4 py-3" data-testid="pode-gastar-compacto-vazio" data-card="PODE GASTAR TOPO">
        <p className="text-[11px] font-bold flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> QUANTO POSSO GASTAR HOJE</p>
        <p className="text-xs text-muted-foreground mt-1 leading-snug">
          Pra calcular, falta <span className="font-semibold text-foreground">quanto entra no mês</span>. Contas fixas deixam o número mais certo.
        </p>
        <button
          type="button"
          onClick={onAnotarRenda}
          className="mt-2 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1"
        >
          Anotar minha renda <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const cor = conta.status === "good" ? "text-green-400" : conta.status === "warning" ? "text-orange-400" : "text-red-400";
  const fundo = conta.status === "good" ? "bg-green-500/5 border-green-500/20" : conta.status === "warning" ? "bg-orange-500/5 border-orange-500/20" : "bg-red-500/5 border-red-500/20";
  return (
    <button
      type="button"
      onClick={onVerNoPainel}
      data-testid="pode-gastar-compacto"
      data-card="PODE GASTAR TOPO"
      aria-label="Quanto posso gastar hoje — ver a conta no Dashboard"
      className={`w-full text-left rounded-lg border px-4 py-3 flex items-center gap-3 ${fundo}`}
    >
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] font-bold">QUANTO POSSO GASTAR HOJE</span>
        <span className="flex items-baseline gap-1.5 mt-0.5">
          {conta.cantSpend
            ? <span data-testid="pode-gastar-compacto-valor" className="text-xl font-bold tabular-nums leading-tight text-red-400">R$ 0</span>
            : <>
                <span data-testid="pode-gastar-compacto-valor" className={`text-xl font-bold tabular-nums leading-tight ${cor}`}>R$ {reais(Math.round(conta.perDay))}</span>
                <span className="text-xs text-muted-foreground">por dia</span>
              </>}
        </span>
        <span className="block text-[11px] text-muted-foreground mt-0.5" data-testid="pode-gastar-compacto-linha">
          {conta.cantSpend
            ? "as contas do mês já usam todo o saldo"
            : conta.praHoje
            ? (conta.praHoje.sobra >= 0
              ? `sobram R$ ${reais(conta.praHoje.sobra)} pra hoje`
              : `hoje já passou R$ ${reais(-conta.praHoje.sobra)} do que dava`)
            : conta.remainingDays === 1 ? "último dia do mês" : `${conta.remainingDays} dias até o fim do mês`}
        </span>
      </span>
      <span className="shrink-0 flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground">
        Ver a conta <ChevronRight className="w-3.5 h-3.5" />
      </span>
    </button>
  );
};
