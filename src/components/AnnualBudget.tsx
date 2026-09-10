import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { getMonthTotals, getCurrentMonthName, getCurrentYear } from "@/components/finance/storage-keys";
import { useAuth } from "@/hooks/use-auth";
import { perfilAtivoLocal } from "@/lib/finance-perfil";
import { DiffBadge } from "@/components/finance/MonthComparison";

const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/**
 * ANO ESCOLHIDO + PERFIL (09/09) — cliente pagante: "conseguir ver 2025 no
 * balanço anual; balanço anual e comparação entre os anos como no mensal".
 *
 * Duas coisas estavam presas aqui:
 *
 *  1. O ano era `getCurrentYear()` cravado (o TODO de 01/09 dizia isso). As
 *     chaves de 2025 existiam (`finance-2025-{mes}-*`, as mesmas que o
 *     Orçamento Mensal ao lado abre) — só esta tabela não perguntava o ano.
 *     As setas seguem o padrão do Orçamento (2015…ano corrente, mesmos
 *     limites, mesma cara), e não "só anos com dado": os dois cartões dividem
 *     a mesma linha da tela, e setas iguais com comportamento diferente — uma
 *     pulando anos vazios, a outra não — confundiriam; além disso a lista de
 *     anos com dado mudaria ao trocar o chip PF/PJ. Ano vazio se explica
 *     sozinho pela linha "Nenhum lançamento em {ano}". Chave própria
 *     (`finance-balanco-ano`), não a do Orçamento: cada cartão tem as suas
 *     setas. Persistido pelo mesmo motivo de lá (02/09): abrir um mês desmonta
 *     este cartão, e o ano escolhido não pode voltar pra 2026 a cada volta.
 *
 *  2. O `useMemo` dependia de [mês, ano, usuário] e NÃO do perfil: trocar o
 *     chip PF/PJ não recalculava, e a tabela ficava com os números do perfil
 *     anterior até algo remontar o cartão. O perfil agora chega por prop
 *     (Index.tsx) e vai explícito ao `getMonthTotals`.
 *
 * "vs ano anterior": UMA linha discreta sob o TOTAL, e nada mais — decisão do
 * dono, que acha que uma aba de comparação anual polui. Quando o ano
 * escolhido é o corrente, a comparação usa o MESMO período do ano passado
 * (janeiro até o mês de agora): em setembro, comparar nove meses com doze
 * inteiros daria "-30%" só porque o ano não acabou.
 */
const ANO_MINIMO = 2015;

type Totais = ReturnType<typeof getMonthTotals>;
type Linha = Totais & { month: string; hasData: boolean };

const totaisDoAno = (userId: string | null, perfil: string, ano: number): Linha[] =>
  months.map((month) => {
    const t = getMonthTotals(month, userId, ano, perfil);
    return { month, ...t, hasData: t.receitas + t.custosFixos + t.custosVariaveis + t.dividas > 0 };
  });

const balancoDe = (linhas: Linha[]) =>
  linhas.reduce((s, r) => s + r.receitas - r.custosFixos - r.custosVariaveis - r.dividas, 0);

const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

interface Props {
  /** Perfil ativo (PF/PJ), vindo de Index. Sem a prop, lê o gravado. */
  perfil?: string;
}

export const AnnualBudget = ({ perfil }: Props) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const p = perfil ?? perfilAtivoLocal(userId);
  const currentMonth = getCurrentMonthName();
  const anoAtual = getCurrentYear();
  const [anoGuardado, setAno] = usePersistedState<number>("finance-balanco-ano", anoAtual);
  // Gravado noutro aparelho fora da faixa (ou lixo)? Cai num ano válido.
  const ano = Math.min(anoAtual, Math.max(ANO_MINIMO, Number(anoGuardado) || anoAtual));
  const noAnoCorrente = ano === anoAtual;
  const idxMesAtual = months.indexOf(currentMonth);
  const mesesComparados = noAnoCorrente ? idxMesAtual + 1 : 12;

  const computedData = useMemo(
    () => totaisDoAno(userId, p, ano).map((r) => ({ ...r, isCurrent: noAnoCorrente && r.month === currentMonth })),
    [userId, p, ano, noAnoCorrente, currentMonth],
  );
  const anterior = useMemo(
    () => totaisDoAno(userId, p, ano - 1).slice(0, mesesComparados),
    [userId, p, ano, mesesComparados],
  );

  const temDados = computedData.some((r) => r.hasData);
  const anteriorTemDados = anterior.some((r) => r.hasData);
  const balancoAtual = balancoDe(computedData);
  const balancoAnterior = balancoDe(anterior);

  const sumCol = (field: "receitas" | "custosFixos" | "custosVariaveis" | "dividas") =>
    computedData.reduce((s, d) => s + d[field], 0);

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border animate-fade-in">
      {/* Mesmas setas do Orçamento Mensal (MonthlyBudget), no cabeçalho escuro
          desta tabela. flex-wrap pelo mesmo motivo de lá: em coluna estreita
          o seletor desce, em vez de ser decepado pelo overflow-hidden. */}
      <div className="table-header-dark rounded-t-lg flex items-center gap-2 px-3 py-1.5 flex-wrap">
        <span className="flex-1 text-left">Orçamento e balanço anual</span>
        <div className="ml-auto flex items-center justify-center gap-0.5 normal-case tracking-normal">
          <button
            onClick={() => setAno(Math.max(ANO_MINIMO, ano - 1))}
            disabled={ano <= ANO_MINIMO}
            aria-label="Ano anterior do balanço"
            className="h-7 w-7 rounded-md flex items-center justify-center opacity-80 hover:opacity-100 hover:bg-background/15 disabled:opacity-30"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-bold tabular-nums min-w-[38px] text-center" data-testid="balanco-ano">{ano}</span>
          <button
            onClick={() => setAno(Math.min(anoAtual, ano + 1))}
            disabled={ano >= anoAtual}
            aria-label="Próximo ano do balanço"
            className="h-7 w-7 rounded-md flex items-center justify-center opacity-80 hover:opacity-100 hover:bg-background/15 disabled:opacity-30"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[550px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mês</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">RECEITAS</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">C. FIXOS</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">C. VARIÁVEIS</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">DÍVIDAS</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">BALANÇO</th>
            </tr>
          </thead>
          <tbody>
            {computedData.map((row) => {
              const balance = row.receitas - row.custosFixos - row.custosVariaveis - row.dividas;
              return (
                <tr key={row.month} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${row.isCurrent ? "bg-primary/5" : ""}`}>
                  <td className="px-3 py-1.5 font-medium">
                    {row.month}
                    {row.isCurrent && <span className="text-[8px] ml-1 text-primary">●</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {row.receitas > 0 ? num(row.receitas) : ""}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {row.custosFixos > 0 ? num(row.custosFixos) : ""}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {row.custosVariaveis > 0 ? num(row.custosVariaveis) : ""}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {row.dividas > 0 ? num(row.dividas) : ""}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-medium tabular-nums ${balance >= 0 ? "text-success" : "text-destructive"}`}>
                    {balance !== 0 ? `${balance >= 0 ? "+" : ""}${num(balance)}` : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/30">
              <td className="px-3 py-2 font-medium text-muted-foreground">TOTAL</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums">{num(sumCol("receitas"))}</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums">{num(sumCol("custosFixos"))}</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums">{num(sumCol("custosVariaveis"))}</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums">{num(sumCol("dividas"))}</td>
              <td className={`px-3 py-2 text-right font-bold tabular-nums ${balancoAtual >= 0 ? "text-success" : "text-destructive"}`}>
                {num(balancoAtual)}
              </td>
            </tr>
            {/* A única comparação entre anos: balanço deste ano contra o do
                anterior, no mesmo período. Só existe quando o ano anterior
                tem lançamento — sem dado, a linha não aparece. */}
            {anteriorTemDados && (
              <tr className="bg-muted/30">
                <td colSpan={6} className="px-3 pb-2 pt-0 text-right">
                  <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground" data-testid="vs-ano-anterior">
                    vs {ano - 1}{noAnoCorrente && mesesComparados < 12 ? ` (jan–${months[idxMesAtual].substring(0, 3).toLowerCase()})` : ""}: R$ {num(balancoAnterior)}
                    <DiffBadge a={balancoAnterior} b={balancoAtual} bomQuandoSobe />
                  </span>
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
      {!temDados && (
        <p className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border">
          Nenhum lançamento em {ano}{noAnoCorrente ? "" : " — use as setas para voltar ao ano atual"}.
        </p>
      )}
    </div>
  );
};
