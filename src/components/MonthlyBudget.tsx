import { useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { FileText, ChevronRight, ChevronLeft } from "lucide-react";
import { getFinanceStorageKeys, isCurrentMonth, getCurrentYear, readMonthData } from "@/components/finance/storage-keys";
import { useAuth } from "@/hooks/use-auth";
import { doPerfil, perfilAtivoLocal } from "@/lib/finance-perfil";
import { useMesCorrente } from "@/hooks/use-virada-do-mes";

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
 * O limite pra trás é 2015 por bom senso (não há o que digitar antes disso).
 * Pra frente era o ano corrente — e aí (chamado de 04/10, iPhone 1.0.9) "não
 * consigo visualizar as minhas contas de 2027": parcela em 12× lançada em
 * setembro acaba em agosto de 2027 e o mês existe, só não tinha porta. Agora
 * vai até o ANO SEGUINTE (anoAtual + 1): o mês preenchido antes da hora é
 * adotado quando chega (lib/virada-do-mes, adotarMesPreenchido), então nada
 * fica órfão. Dois anos à frente continua fechado — seria convite a lançar no
 * lugar errado.
 */
const ANO_MINIMO = 2015;
/** Até onde a seta vai pra frente (o ano que vem). */
export const anoMaximo = (anoAtual: number) => anoAtual + 1;

/* O ANO GUARDADO NÃO PRENDE MAIS NO ANO QUE PASSOU (26/09, auditoria da
 * virada). Guardado como número, "2026" escolhido em dezembro (a seta de ida
 * e volta grava o ano corrente) seguia valendo em janeiro/2027: o cartão
 * abria em 2026, sem "(atual)", dizendo "Você está em 2026". Agora grava o
 * ano junto com o ano em que foi escolhido; virou o ano, volta pro corrente.
 * O formato antigo (número puro) é aceito como escolhido em 2026: a chave
 * nasceu em 02/09/2026 e ganhou o formato novo em 26/09/2026 — número puro
 * não existe de outro ano. Em 2026 ele segue valendo (quem está lançando
 * 2025 continua em 2025); em 2027 volta pro ano corrente.
 *
 * O OBJETO QUEBRAVA FINANÇAS NO APP ANTIGO (28/09, 14 erros de 2 pessoas no
 * Android 122). O {ano, em} de 26/09 sincroniza pela nuvem, e o cartão das
 * versões antigas (Android ≤122, iPhone ≤1.0.6) põe o valor direto na tela:
 * objeto dentro do <span> = "React error #31", e Finanças inteiro cai na tela
 * de erro toda vez que abre. Bastava trocar o ano na web ou num app novo pra
 * derrubar o celular antigo da mesma conta. Agora a chave volta a guardar só o
 * NÚMERO (o que o app antigo sabe mostrar) e o ano da escolha mora ao lado, em
 * `finance-orcamento-ano-em`. O objeto que já foi pra nuvem é lido aqui e
 * desfeito na primeira abertura: vira número de novo e o aparelho antigo volta
 * a abrir. */
type AnoGuardado = number | { ano: number; em: number };
const ANO_DO_FORMATO_ANTIGO = 2026;
const anoValido = (guardado: AnoGuardado | null | undefined, escolhidoEm: number | null | undefined, anoAtual: number): number => {
  const g = typeof guardado === "number"
    ? { ano: guardado, em: typeof escolhidoEm === "number" ? escolhidoEm : ANO_DO_FORMATO_ANTIGO }
    : guardado;
  const bruto = g && typeof g === "object" && Number(g.em) === anoAtual ? Number(g.ano) : anoAtual;
  return Number.isInteger(bruto) ? Math.min(anoMaximo(anoAtual), Math.max(ANO_MINIMO, bruto)) : anoAtual;
};

const hasMonthData = (userId: string | null, month: string, year: number) => {
  const keys = getFinanceStorageKeys(month, year);
  const perfil = perfilAtivoLocal(userId);
  const incomes = doPerfil(readMonthData(userId, keys.incomes) || [], perfil);
  const expenses = doPerfil(readMonthData(userId, keys.expenses) || [], perfil);
  const fixed = doPerfil(readMonthData(userId, keys.fixed) || [], perfil);
  return incomes.length > 0 || expenses.length > 0 || fixed.length > 0;
};

export const MonthlyBudget = ({ budgets, setBudgets, onOpenMonth }: MonthlyBudgetProps) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  /* "(atual)" era uma constante de MÓDULO (26/09): calculada uma vez, na
     carga do arquivo — com o app aberto na meia-noite do dia 1º, Setembro
     seguia "(atual)" em outubro. Agora é o mês como estado (muda na volta ao
     app e num relógio de 1 min). */
  const mesCorrente = useMesCorrente();
  const anoAtual = Number(mesCorrente.slice(0, 4)) || getCurrentYear();
  const currentMonthIndex = Number(mesCorrente.slice(5, 7)) - 1;
  /* Persistido, não useState (02/09, achado no E2E): abrir um mês desmonta
     este cartão (a planilha toma o lugar da aba inteira), e ao voltar o ano
     escolhido caía pra 2026. Quem está lançando 2024 mês a mês clicava a
     seta de novo a cada volta — 24 cliques a mais numa tarefa de 12. O
     rodapé "Você está em 2024" já deixa o estado visível, então guardar não
     engana ninguém. */
  const [guardado, setGuardado] = usePersistedState<AnoGuardado>("finance-orcamento-ano", anoAtual);
  const [escolhidoEm, setEscolhidoEm] = usePersistedState<number | null>("finance-orcamento-ano-em", null);
  const ano = anoValido(guardado, escolhidoEm, anoAtual);
  const setAno = (proximo: (a: number) => number) => {
    setEscolhidoEm(anoAtual);
    setGuardado(proximo(ano));
  };
  useEffect(() => {
    if (!guardado || typeof guardado !== "object") return;
    const em = Number(guardado.em), a = Number(guardado.ano);
    setEscolhidoEm(Number.isInteger(em) ? em : null);
    setGuardado(Number.isInteger(a) ? a : anoAtual);
  }, [guardado, anoAtual, setEscolhidoEm, setGuardado]);
  const noAnoCorrente = ano === anoAtual;

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border animate-fade-in">
      {/* flex-wrap de propósito (02/09, foto do dono): no desktop este cartão
          mora numa coluna de 200px e o cabeçalho numa linha só estourava o
          overflow-hidden do card — a seta de "próximo ano" era DECEPADA e
          quem entrava em 2025 ficava sem volta. Com wrap, o seletor desce
          pra segunda linha quando falta largura; em tela cheia continua tudo
          numa linha. justify-center no seletor pra segunda linha não nascer
          colada na borda. */}
      <div className="bg-accent/20 border-b border-border px-4 py-2 flex items-center gap-2 flex-wrap">
        <span className="font-bold text-xs tracking-wide text-foreground whitespace-nowrap">ORÇAMENTO MENSAL</span>
        <span>💰</span>
        <div className="ml-auto flex items-center justify-center gap-0.5">
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
            onClick={() => setAno((a) => Math.min(anoMaximo(anoAtual), a + 1))}
            disabled={ano >= anoMaximo(anoAtual)}
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
