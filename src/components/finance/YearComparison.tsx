import { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getMonthTotals, getCurrentYear } from "@/components/finance/storage-keys";
import { perfilAtivoLocal } from "@/lib/finance-perfil";
import { useAuth } from "@/hooks/use-auth";
import { useFinanceCategories } from "@/lib/finance-categories";
import {
  ALL_MONTHS, COLORS, DiffBadge, SaldoDiffBadge, categoryLabels, fmt, getExpensesByCategory,
} from "@/components/finance/MonthComparison";

/* ── COMPARAÇÃO ANUAL (09/09) ──────────────────────────────────────────────
 * Cliente pagante: "balanço anual e comparação entre os anos como no mensal".
 * Ontem a resposta foi UMA linha "vs ano anterior" no Balanço Anual, porque o
 * dono não queria tela nova. Hoje ele mudou: "vou adicionar mesmo a
 * comparação anual como separado, em Dashboard, embaixo de comparação
 * mensal". A linha do Balanço fica (é o resumo); este card é o detalhamento,
 * com a MESMA linguagem da Comparação Mensal logo acima — dois seletores,
 * Receitas/Despesas/Saldo, quebra por categoria com barras lado a lado —
 * pra que quem já entendeu um card entenda o outro sem aprender nada.
 *
 * Decisões que diferem do mensal, e por quê:
 *
 *  - Lista de anos 2015…corrente, igual às setas do Orçamento e do Balanço, e
 *    NÃO "só anos com dado": a lista de anos com dado encolheria ao trocar o
 *    chip PF/PJ, e o dono já viu esse padrão nos outros dois cards. Ano vazio
 *    se explica sozinho ("Nenhum lançamento em 2024"). Do mais novo pro mais
 *    velho: 2026 e 2025 são o que se compara; 2015 é o fundo da lista.
 *
 *  - "Mesmo período": em setembro, ano inteiro de 2025 contra jan–set de
 *    2026 daria "-25%" só porque o ano não acabou. Ligado por padrão sempre
 *    que um dos dois anos é o corrente (nos outros casos não há o que cortar
 *    e o toggle nem aparece). É um toggle e não uma regra fixa porque quem
 *    quer ver "o ano passado inteiro" também tem razão.
 *
 *  - Categorias ordenadas pela MAIOR DIFERENÇA absoluta, não pelo maior
 *    gasto: num ano inteiro tudo é grande; o que interessa é o que mudou.
 *    Doze linhas e "ver todas" — um ano acumula categoria demais pra um card.
 *
 *  - Saldo = receitas − despesas, como no mensal (o Balanço Anual desconta
 *    dívidas; aqui o card de cima é a referência visual, não o de lá).
 *
 *  - Estado NÃO persistido (useState), como no mensal: os anos escolhidos são
 *    de uma olhada; o Balanço persiste o ano porque lá se lança dado. */
const ANO_MINIMO = 2015;
const MAX_LINHAS = 12;

/** Do corrente até 2015 — o que se compara fica no topo do seletor. */
export const anosDaLista = (anoAtual = getCurrentYear()): number[] => {
  const out: number[] = [];
  for (let a = anoAtual; a >= ANO_MINIMO; a--) out.push(a);
  return out;
};

/**
 * Quantos meses entram na conta. Só corta quando "mesmo período" está ligado
 * E um dos anos é o corrente — fora disso não há mês futuro pra tirar.
 */
export const mesesComparados = (anoA: number, anoB: number, mesmoPeriodo: boolean, agora = new Date()): number => {
  const atual = agora.getFullYear();
  if (!mesmoPeriodo || (anoA !== atual && anoB !== atual)) return 12;
  return agora.getMonth() + 1;
};

export interface TotaisAnuais {
  receitas: number;
  despesas: number;
  saldo: number;
  /** Receita ou despesa em algum mês contado. Sem isso, "Nenhum lançamento". */
  temLancamento: boolean;
  categorias: Record<string, number>;
}

/**
 * Soma dos primeiros `meses` meses do ano, mês a mês, pelas mesmas leituras
 * do mensal (getMonthTotals respeita o perfil; getExpensesByCategory idem).
 * Nada de cache: são no máximo 24 × 4 leituras de localStorage por render.
 */
export const totaisDoAno = (ano: number, userId: string | null, perfil: string, meses = 12): TotaisAnuais => {
  const n = Math.min(12, Math.max(0, meses));
  let receitas = 0;
  let despesas = 0;
  const categorias: Record<string, number> = {};
  for (let idx = 0; idx < n; idx++) {
    const t = getMonthTotals(ALL_MONTHS[idx], userId, ano, perfil);
    receitas += t.receitas;
    despesas += t.custosFixos + t.custosVariaveis;
    const cats = getExpensesByCategory({ ano, idx }, userId, perfil);
    for (const [c, v] of Object.entries(cats)) categorias[c] = (categorias[c] || 0) + v;
  }
  return { receitas, despesas, saldo: receitas - despesas, temLancamento: receitas + despesas > 0, categorias };
};

export interface LinhaCategoria {
  category: string;
  label: string;
  anoA: number;
  anoB: number;
}

/** Maior diferença absoluta primeiro; empate decide pelo maior volume. */
export const ordenarPorDiferenca = (
  catsA: Record<string, number>,
  catsB: Record<string, number>,
  labelOf: (v: string) => string,
): LinhaCategoria[] => {
  const todas = new Set([...Object.keys(catsA), ...Object.keys(catsB)]);
  const linhas: LinhaCategoria[] = [];
  todas.forEach((category) => {
    linhas.push({ category, label: categoryLabels[category] || labelOf(category), anoA: catsA[category] || 0, anoB: catsB[category] || 0 });
  });
  return linhas.sort((x, y) => {
    const d = Math.abs(y.anoB - y.anoA) - Math.abs(x.anoB - x.anoA);
    return d !== 0 ? d : (y.anoA + y.anoB) - (x.anoA + x.anoB);
  });
};

const abrevMes = (idx: number) => ALL_MONTHS[idx].substring(0, 3).toLowerCase();

interface Props {
  /** Perfil ativo (PF/PJ), vindo de Index. Sem a prop, lê o gravado. */
  perfil?: string;
}

export const YearComparison = ({ perfil }: Props) => {
  const { user } = useAuth();
  const { labelOf } = useFinanceCategories(); // resolve nome de categorias personalizadas
  const userId = user?.id ?? null;
  const p = perfil ?? perfilAtivoLocal(userId);

  const anoAtual = getCurrentYear();
  const idxMesAtual = new Date().getMonth();
  const [anoA, setAnoA] = useState(anoAtual - 1);
  const [anoB, setAnoB] = useState(anoAtual);
  const [mesmoPeriodo, setMesmoPeriodo] = useState(true);
  const [verTodas, setVerTodas] = useState(false);
  const anos = useMemo(() => anosDaLista(anoAtual), [anoAtual]);

  // O toggle só existe quando tem efeito: um dos anos é o corrente E o ano
  // ainda não acabou (em dezembro "mesmo período" = ano inteiro).
  const toggleAplicavel = (anoA === anoAtual || anoB === anoAtual) && idxMesAtual < 11;
  const meses = mesesComparados(anoA, anoB, mesmoPeriodo);
  const rotuloPeriodo = meses < 12 ? `jan–${abrevMes(meses - 1)}` : "";

  const totaisA = useMemo(() => totaisDoAno(anoA, userId, p, meses), [anoA, userId, p, meses]);
  const totaisB = useMemo(() => totaisDoAno(anoB, userId, p, meses), [anoB, userId, p, meses]);

  const categorias = useMemo(
    () => ordenarPorDiferenca(totaisA.categorias, totaisB.categorias, labelOf),
    [totaisA, totaisB, labelOf],
  );
  const visiveis = verTodas ? categorias : categorias.slice(0, MAX_LINHAS);
  // Escala pelas TODAS, não só pelas visíveis: "ver todas" não pode encolher
  // as barras que a pessoa já estava olhando.
  const maxCatValue = useMemo(() => Math.max(1, ...categorias.map((c) => Math.max(c.anoA, c.anoB))), [categorias]);

  const ambosComDado = totaisA.temLancamento && totaisB.temLancamento;
  const nenhumComDado = !totaisA.temLancamento && !totaisB.temLancamento;

  const seletor = (valor: number, setar: (a: number) => void, rotulo: string) => (
    <Select value={String(valor)} onValueChange={(v) => setar(Number(v))}>
      <SelectTrigger className="h-7 text-xs flex-1" aria-label={rotulo}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {anos.map((a) => (
          <SelectItem key={a} value={String(a)} className="text-xs">{a}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  /* Uma linha do resumo por ano: os três números, ou — quando o ano não tem
     lançamento — a frase no lugar deles. Zeros mentiriam ("gastou R$ 0"). */
  const linhaResumo = (ano: number, t: TotaisAnuais) => (
    <>
      <span className="text-[10px] text-muted-foreground text-left tabular-nums">{ano}</span>
      {t.temLancamento ? (
        <>
          <p className="text-[11px] font-bold text-green-400 tabular-nums" data-testid={`receitas-${ano}`}>{fmt(t.receitas)}</p>
          <p className="text-[11px] font-bold text-red-400 tabular-nums" data-testid={`despesas-${ano}`}>{fmt(t.despesas)}</p>
          <p className={`text-[11px] font-bold tabular-nums ${t.saldo >= 0 ? "text-green-400" : "text-red-400"}`} data-testid={`saldo-${ano}`}>{fmt(t.saldo)}</p>
        </>
      ) : (
        <p className="col-span-3 text-[11px] text-muted-foreground" data-testid={`sem-lancamento-${ano}`}>
          Nenhum lançamento em {ano}
        </p>
      )}
    </>
  );

  return (
    <div className="bg-card rounded-lg border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-xs font-bold">📊 COMPARAÇÃO ANUAL</h3>
        {toggleAplicavel && (
          <button
            type="button"
            role="switch"
            aria-checked={mesmoPeriodo}
            aria-label="Mesmo período"
            onClick={() => setMesmoPeriodo((v) => !v)}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
          >
            <span className={`relative inline-block w-6 h-3 rounded-full transition-colors ${mesmoPeriodo ? "bg-primary" : "bg-muted-foreground/30"}`}>
              <span className={`absolute top-0.5 w-2 h-2 rounded-full bg-background transition-all ${mesmoPeriodo ? "left-3.5" : "left-0.5"}`} />
            </span>
            mesmo período{rotuloPeriodo && <span className="tabular-nums" data-testid="rotulo-periodo">({rotuloPeriodo})</span>}
          </button>
        )}
      </div>

      {/* Year selectors */}
      <div className="flex items-center gap-2 mb-3">
        {seletor(anoA, setAnoA, "Primeiro ano")}
        <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        {seletor(anoB, setAnoB, "Segundo ano")}
      </div>

      {nenhumComDado ? (
        <p className="text-xs text-muted-foreground text-center py-8" data-testid="sem-lancamento-ambos">
          {anoA === anoB ? `Nenhum lançamento em ${anoA}.` : `Nenhum lançamento em ${anoA} nem em ${anoB}.`}
        </p>
      ) : (
        <div className="space-y-3">
          {/* Summary grid: mesmas três colunas do mensal, com o ano na frente
              de cada linha — aqui as duas linhas são anos, não meses, e o ano
              precisa estar colado no número pra não confundir. */}
          <div className="grid grid-cols-[2.25rem_1fr_1fr_1fr] gap-x-2 gap-y-0.5 text-center items-center" data-testid="resumo-anos">
            <span />
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Receitas</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Despesas</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Saldo</p>
            {linhaResumo(anoA, totaisA)}
            {linhaResumo(anoB, totaisB)}
            {ambosComDado && (
              <>
                <span />
                <div className="flex justify-center"><DiffBadge a={totaisA.receitas} b={totaisB.receitas} bomQuandoSobe /></div>
                <div className="flex justify-center"><DiffBadge a={totaisA.despesas} b={totaisB.despesas} /></div>
                <div className="flex justify-center"><SaldoDiffBadge a={totaisA.saldo} b={totaisB.saldo} /></div>
              </>
            )}
          </div>

          {/* Category breakdown */}
          {categorias.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Por Categoria</p>
              {visiveis.map((cat, i) => (
                <div key={cat.category} className="space-y-1" data-testid="categoria-linha">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${COLORS[i % COLORS.length]}`} />
                      <span className="text-xs">{cat.label}</span>
                    </div>
                    <DiffBadge a={cat.anoA} b={cat.anoB} />
                  </div>
                  {/* Side by side bars */}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-9 flex-shrink-0 tabular-nums">{anoA}</span>
                      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-muted-foreground/40 rounded-full transition-all"
                          style={{ width: `${(cat.anoA / maxCatValue) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground w-16 text-right">{totaisA.temLancamento ? fmt(cat.anoA) : "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-9 flex-shrink-0 tabular-nums">{anoB}</span>
                      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${COLORS[i % COLORS.length]}`}
                          style={{ width: `${(cat.anoB / maxCatValue) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground w-16 text-right">{totaisB.temLancamento ? fmt(cat.anoB) : "—"}</span>
                    </div>
                  </div>
                </div>
              ))}
              {categorias.length > MAX_LINHAS && (
                <button
                  type="button"
                  onClick={() => setVerTodas((v) => !v)}
                  className="text-[10px] text-primary underline-offset-2 hover:underline"
                >
                  {verTodas ? "ver menos" : `ver todas (${categorias.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
