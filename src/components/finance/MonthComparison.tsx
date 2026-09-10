import { useState, useMemo } from "react";
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getMonthTotals, getFinanceStorageKeys, readMonthData, anosComLancamentos } from "@/components/finance/storage-keys";
import { doPerfil, perfilAtivoLocal } from "@/lib/finance-perfil";
import { useAuth } from "@/hooks/use-auth";
import { useFinanceCategories } from "@/lib/finance-categories";

/* Exportados (09/09) pra Comparação Anual (YearComparison), que soma os 12
   meses com as MESMAS leituras e a MESMA cara — uma tabela de rótulos e uma
   paleta só, senão "Lazer" roxo num card vira laranja no de baixo. */
export const ALL_MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const categoryLabels: Record<string, string> = {
  alimentacao: "Alimentação", restaurante: "Restaurante", mercado: "Mercado",
  transporte: "Transporte", combustivel: "Combustível", lazer: "Lazer",
  entretenimento: "Entretenimento", saude: "Saúde", farmacia: "Farmácia",
  vestuario: "Vestuário", beleza: "Beleza", educacao: "Educação",
  eletronicos: "Eletrônicos", servicos: "Serviços", delivery: "Delivery",
  presente: "Presentes", casa: "Casa", pets: "Pets", filhos: "Filhos",
  viagem: "Viagem", moradia: "Moradia", contas_casa: "Contas da Casa",
  condominio: "Condomínio", seguro: "Seguro", plano_saude: "Plano de Saúde",
  assinaturas: "Assinaturas", internet_telefone: "Internet/Telefone",
  academia: "Academia", transporte_fixo: "Transporte Fixo",
  fatura_cartao: "Fatura Cartão", financiamento: "Financiamento",
  pensao: "Pensão", outros: "Outros",
};

export const COLORS = [
  "bg-purple-500", "bg-amber-500", "bg-emerald-500",
  "bg-blue-500", "bg-red-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500",
];

/* ── MÊS + ANO (09/09) ─────────────────────────────────────────────────────
 * Cliente pagante: "balanço anual e comparação entre os anos como no mensal".
 * Os dois seletores só tinham o MÊS, e as leituras iam sem ano — dezembro de
 * 2025 contra janeiro de 2026 era impossível. Pior: em janeiro a comparação
 * padrão ("mês passado × este") lia o dezembro do ANO CORRENTE, ou seja,
 * vazio. O valor do seletor vira "AAAA-MM"; o rótulo, "dez/2025". A lista vai
 * de janeiro do ano passado (ou do ano mais antigo com lançamento arquivado)
 * até o mês de agora — mês futuro não tem o que comparar. */
export interface MesAno { ano: number; idx: number }

export const idDeMesAno = (m: MesAno) => `${m.ano}-${String(m.idx + 1).padStart(2, "0")}`;

export const mesAnoDeId = (id: string): MesAno => {
  const [a, m] = id.split("-").map(Number);
  return { ano: a, idx: Math.min(11, Math.max(0, (m || 1) - 1)) };
};

const abrev = (idx: number) => ALL_MONTHS[idx].substring(0, 3);

/** "dez/2025" — o que aparece no seletor. */
export const rotuloMesAno = (m: MesAno) => `${abrev(m.idx).toLowerCase()}/${m.ano}`;

export const opcoesDeMeses = (anosComDados: number[], agora = new Date()): MesAno[] => {
  const anoAtual = agora.getFullYear();
  const idxAtual = agora.getMonth();
  const anoMin = Math.min(anoAtual - 1, ...anosComDados.filter((a) => a >= 2015 && a <= anoAtual));
  const out: MesAno[] = [];
  for (let ano = anoMin; ano <= anoAtual; ano++) {
    for (let idx = 0; idx < 12; idx++) {
      if (ano === anoAtual && idx > idxAtual) break;
      out.push({ ano, idx });
    }
  }
  return out;
};

/** Os dois últimos meses — o padrão de sempre, agora atravessando janeiro. */
export const parPadrao = (agora = new Date()): [MesAno, MesAno] => {
  const b = { ano: agora.getFullYear(), idx: agora.getMonth() };
  const a = b.idx === 0 ? { ano: b.ano - 1, idx: 11 } : { ano: b.ano, idx: b.idx - 1 };
  return [a, b];
};

interface CategoryData {
  category: string;
  label: string;
  monthA: number;
  monthB: number;
}

export const getExpensesByCategory = (m: MesAno, userId: string | null, perfil: string): Record<string, number> => {
  const keys = getFinanceStorageKeys(ALL_MONTHS[m.idx], m.ano);
  const expenses = doPerfil(readMonthData(userId, keys.expenses) || [], perfil);
  const fixed = doPerfil(readMonthData(userId, keys.fixed) || [], perfil);
  const grouped: Record<string, number> = {};

  expenses.forEach((e: any) => {
    const cat = e.category || "outros";
    grouped[cat] = (grouped[cat] || 0) + (e.value || 0);
  });
  fixed.forEach((e: any) => {
    const cat = e.category || "outros";
    grouped[cat] = (grouped[cat] || 0) + (e.value || 0);
  });

  return grouped;
};

export const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;

/**
 * Badge de variação. Compartilhado com o Balanço Anual (linha "vs ano
 * anterior", 09/09) — por isso mora fora do componente. Por padrão subir é
 * ruim (despesa, vermelho); `bomQuandoSobe` inverte a cor pra saldo/balanço.
 */
export const DiffBadge = ({ a, b, bomQuandoSobe = false }: { a: number; b: number; bomQuandoSobe?: boolean }) => {
  if (a === 0 && b === 0) return null;
  const diff = b - a;
  const pct = a > 0 ? ((diff / a) * 100) : 0;
  if (Math.abs(diff) < 1) return <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Minus className="w-3 h-3" />igual</span>;
  const isUp = diff > 0;
  const bom = bomQuandoSobe ? isUp : !isUp;
  return (
    <span className={`text-[10px] flex items-center gap-0.5 ${bom ? "text-green-400" : "text-red-400"}`}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isUp ? "+" : ""}{a > 0 ? `${pct.toFixed(0)}%` : fmt(Math.abs(diff))}
    </span>
  );
};

/** Saldo varia em R$, não em %: -50% de um saldo negativo não diz nada. */
export const SaldoDiffBadge = ({ a, b }: { a: number; b: number }) => {
  if (a === 0 && b === 0) return null;
  const diff = b - a;
  if (Math.abs(diff) < 1) return <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Minus className="w-3 h-3" />igual</span>;
  const isUp = diff > 0;
  return (
    <span className={`text-[10px] flex items-center gap-0.5 ${isUp ? "text-green-400" : "text-red-400"}`}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isUp ? "+" : ""}{fmt(diff)}
    </span>
  );
};

interface Props {
  /** Perfil ativo (PF/PJ), vindo de Index. Sem a prop, lê o gravado. */
  perfil?: string;
}

export const MonthComparison = ({ perfil }: Props) => {
  const { user } = useAuth();
  const { labelOf } = useFinanceCategories(); // resolve nome de categorias personalizadas
  const userId = user?.id ?? null;
  const p = perfil ?? perfilAtivoLocal(userId);

  const [padraoA, padraoB] = parPadrao();
  const [idA, setIdA] = useState(idDeMesAno(padraoA));
  const [idB, setIdB] = useState(idDeMesAno(padraoB));
  const mA = mesAnoDeId(idA);
  const mB = mesAnoDeId(idB);
  const opcoes = useMemo(() => opcoesDeMeses(anosComLancamentos(userId)), [userId]);

  const totalsA = useMemo(() => { const m = mesAnoDeId(idA); return getMonthTotals(ALL_MONTHS[m.idx], userId, m.ano, p); }, [idA, userId, p]);
  const totalsB = useMemo(() => { const m = mesAnoDeId(idB); return getMonthTotals(ALL_MONTHS[m.idx], userId, m.ano, p); }, [idB, userId, p]);

  const categoryComparison = useMemo(() => {
    const catsA = getExpensesByCategory(mesAnoDeId(idA), userId, p);
    const catsB = getExpensesByCategory(mesAnoDeId(idB), userId, p);
    const allCats = new Set([...Object.keys(catsA), ...Object.keys(catsB)]);

    const data: CategoryData[] = [];
    allCats.forEach((cat) => {
      data.push({
        category: cat,
        label: categoryLabels[cat] || labelOf(cat),
        monthA: catsA[cat] || 0,
        monthB: catsB[cat] || 0,
      });
    });

    return data.sort((a, b) => (b.monthA + b.monthB) - (a.monthA + a.monthB));
  }, [idA, idB, userId, p, labelOf]);

  const maxCatValue = useMemo(() => {
    return Math.max(1, ...categoryComparison.map((c) => Math.max(c.monthA, c.monthB)));
  }, [categoryComparison]);

  const totalExpA = totalsA.custosFixos + totalsA.custosVariaveis;
  const totalExpB = totalsB.custosFixos + totalsB.custosVariaveis;
  const saldoA = totalsA.receitas - totalExpA;
  const saldoB = totalsB.receitas - totalExpB;

  const hasData = totalsA.receitas > 0 || totalsB.receitas > 0 || categoryComparison.length > 0;

  /* Rótulo das barras: "Ago"/"Set" como sempre quando os dois meses são do
     mesmo ano; "dez/25"/"jan/26" só quando o ano é o que os distingue. */
  const mesmoAno = mA.ano === mB.ano;
  const curto = (m: MesAno) => mesmoAno ? abrev(m.idx) : `${abrev(m.idx).toLowerCase()}/${String(m.ano).slice(2)}`;
  const larguraRotulo = mesmoAno ? "w-7" : "w-11";

  return (
    <div className="bg-card rounded-lg border border-border p-4 animate-fade-in">
      <h3 className="text-xs font-bold mb-3">📈 COMPARAÇÃO MENSAL</h3>

      {/* Month selectors */}
      <div className="flex items-center gap-2 mb-3">
        <Select value={idA} onValueChange={setIdA}>
          <SelectTrigger className="h-7 text-xs flex-1" aria-label="Primeiro mês">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opcoes.map((m) => (
              <SelectItem key={idDeMesAno(m)} value={idDeMesAno(m)} className="text-xs">{rotuloMesAno(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <Select value={idB} onValueChange={setIdB}>
          <SelectTrigger className="h-7 text-xs flex-1" aria-label="Segundo mês">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opcoes.map((m) => (
              <SelectItem key={idDeMesAno(m)} value={idDeMesAno(m)} className="text-xs">{rotuloMesAno(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!hasData ? (
        <p className="text-xs text-muted-foreground text-center py-8">
          Sem dados para comparar. Preencha pelo menos um mês.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Summary grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {/* Receitas */}
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Receitas</p>
              <p className="text-[11px] font-bold text-green-400 tabular-nums">{fmt(totalsA.receitas)}</p>
              <p className="text-[11px] font-bold text-green-400 tabular-nums">{fmt(totalsB.receitas)}</p>
            </div>
            {/* Despesas */}
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Despesas</p>
              <p className="text-[11px] font-bold text-red-400 tabular-nums">{fmt(totalExpA)}</p>
              <p className="text-[11px] font-bold text-red-400 tabular-nums">{fmt(totalExpB)}</p>
              <DiffBadge a={totalExpA} b={totalExpB} />
            </div>
            {/* Saldo */}
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Saldo</p>
              <p className={`text-[11px] font-bold tabular-nums ${saldoA >= 0 ? "text-green-400" : "text-red-400"}`}>{fmt(saldoA)}</p>
              <p className={`text-[11px] font-bold tabular-nums ${saldoB >= 0 ? "text-green-400" : "text-red-400"}`}>{fmt(saldoB)}</p>
              <SaldoDiffBadge a={saldoA} b={saldoB} />
            </div>
          </div>

          {/* Labels row */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground" data-testid="rotulos-meses">
            <span>{curto(mA)}</span>
            <span>{curto(mB)}</span>
          </div>

          {/* Category breakdown */}
          {categoryComparison.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Por Categoria</p>
              {categoryComparison.map((cat, i) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${COLORS[i % COLORS.length]}`} />
                      <span className="text-xs">{cat.label}</span>
                    </div>
                    <DiffBadge a={cat.monthA} b={cat.monthB} />
                  </div>
                  {/* Side by side bars */}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] text-muted-foreground ${larguraRotulo} flex-shrink-0`}>{curto(mA)}</span>
                      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-muted-foreground/40 rounded-full transition-all"
                          style={{ width: `${(cat.monthA / maxCatValue) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground w-16 text-right">{fmt(cat.monthA)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] text-muted-foreground ${larguraRotulo} flex-shrink-0`}>{curto(mB)}</span>
                      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${COLORS[i % COLORS.length]}`}
                          style={{ width: `${(cat.monthB / maxCatValue) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground w-16 text-right">{fmt(cat.monthB)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
