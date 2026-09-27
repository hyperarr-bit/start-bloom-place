import { FileText, Download, FileSpreadsheet, Printer, Calendar, TrendingUp, TrendingDown, PieChart } from "lucide-react";
import { dataSegura, localDayKey, mesAtualExtenso } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { computeMonthlyBalance, computeSavingsRate } from "@/lib/finance-totals";
import { ImportExtrato } from "@/components/finance/ImportExtrato";
import { useFinanceCategories } from "@/lib/finance-categories";
import { useUserData } from "@/hooks/use-user-data";
import { doPerfil, PERFIL_PESSOAL, PERFIL_TODOS, type Perfil } from "@/lib/finance-perfil";
import { type Parcela, parcelaDoMes, somaParcelasDoMes, valorDaParcelaNoMes } from "@/lib/finance-parcelas";

interface Income {
  id: string;
  description: string;
  value: number;
  date: string;
}

interface Expense {
  id: string;
  description: string;
  category: string;
  value: number;
  date: string;
  paymentMethod: string;
}

interface FixedExpense {
  id: string;
  description: string;
  category: string;
  value: number;
  paymentMethod?: string;
  day?: number;
}

interface ReportsProps {
  incomes: Income[];
  expenses: Expense[];
  totalIncome: number;
  totalExpenses: number;
  totalDebts: number;
  totalInvestments: number;
  setIncomes: (incomes: Income[]) => void;
  setExpenses: (expenses: Expense[]) => void;
  /** Custos fixos do mês (já do perfil ativo). Ausente = lidos do store. */
  fixedExpenses?: FixedExpense[];
  /** Parcelamentos do mês (já do perfil ativo). Ausente = lidos do store. */
  installments?: Parcela[];
}

const categoryLabels: Record<string, string> = {
  vestuario: "Vestuário",
  restaurante: "Restaurante",
  educacao: "Educação",
  presente: "Presentes",
  lazer: "Lazer",
  eletrodomesticos: "Eletrodomésticos",
  mercado: "Mercado",
  transporte: "Transporte",
  saude: "Saúde",
  outros: "Outros",
};

const paymentLabels: Record<string, string> = {
  pix: "Pix",
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
  dinheiro: "Dinheiro",
  boleto: "Boleto",
  debito_auto: "Débito automático",
  transferencia: "Transferência",
};

/** Dinheiro com 2 casas e o sinal antes do R$ ("-R$ 500,00") — 26/09. */
const reais = (v: number) => {
  const r = Math.round((Number(v) || 0) * 100) / 100;
  return `${r < 0 ? "-" : ""}R$ ${Math.abs(r).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Uma linha de despesa do relatório: gasto do dia a dia, custo fixo ou parcela. */
export interface LinhaDeDespesa {
  id: string;
  tipo: "Variável" | "Fixo" | "Parcela";
  descricao: string;
  /** "10 de 12" pra parcela, "vence dia 5" pro fixo */
  detalhe?: string;
  categoria: string;
  valor: number;
  data?: string;
  pagamento?: string;
}

/**
 * AS DESPESAS DO MÊS INTEIRAS (26/09, varredura). O card de cima dizia
 * "Despesas R$ 3.718" (fixos + variáveis + parcelas, lib/finance-totals), mas
 * a lista "Despesas (6)", as categorias e o CSV só tinham os gastos do dia a
 * dia (R$ 464) — o relatório não fechava. Agora os três tipos entram, cada
 * um marcado.
 */
export const linhasDeDespesa = (expenses: Expense[], fixos: FixedExpense[], parcelas: Parcela[]): LinhaDeDespesa[] => [
  ...(expenses ?? []).map((e): LinhaDeDespesa => ({
    id: `v-${e.id}`, tipo: "Variável", descricao: e.description, categoria: e.category || "outros",
    valor: Number(e.value) || 0, data: e.date, pagamento: e.paymentMethod,
  })),
  ...(fixos ?? []).map((f): LinhaDeDespesa => ({
    id: `f-${f.id}`, tipo: "Fixo", descricao: f.description, categoria: f.category || "outros",
    valor: Number(f.value) || 0, detalhe: Number.isInteger(f.day) ? `vence dia ${f.day}` : undefined, pagamento: f.paymentMethod,
  })),
  ...(parcelas ?? []).filter((p) => valorDaParcelaNoMes(p) > 0).map((p): LinhaDeDespesa => ({
    id: `p-${p.id}`, tipo: "Parcela", descricao: p.description,
    categoria: p.category === "roupa" ? "vestuario" : p.category || "outros",
    valor: valorDaParcelaNoMes(p), detalhe: `${parcelaDoMes(p)} de ${p.totalInstallments}`,
    data: p.date, pagamento: "credito",
  })),
];

/**
 * CSV que abre DIREITO no Excel em português (26/09, varredura): BOM UTF-8
 * (sem ele os acentos viravam "SalÃ¡rio"), ponto e vírgula como separador
 * (com vírgula tudo caía numa coluna só), decimal com vírgula, data
 * dd/mm/aaaa e rótulos de gente ("Alimentação", "Cartão de crédito") em vez
 * do nome interno ("alimentacao", "credito").
 */
export const montarCSV = (
  tipo: "incomes" | "expenses" | "all",
  incomes: Income[],
  despesas: LinhaDeDespesa[],
  rotuloCategoria: (c: string) => string,
): string => {
  const txt = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const num = (v: number) => (Math.round((Number(v) || 0) * 100) / 100).toFixed(2).replace(".", ",");
  const dia = (d?: string) => { const s = dataSegura(d, "dd/MM/yyyy"); return s === "—" ? "" : s; };
  const linhas: string[] = [];
  if (tipo === "incomes" || tipo === "all") {
    linhas.push("RECEITAS", "Descrição;Valor;Data");
    for (const i of incomes ?? []) linhas.push([txt(i.description), num(i.value), dia(i.date)].join(";"));
    linhas.push(["TOTAL", num((incomes ?? []).reduce((s, i) => s + (Number(i.value) || 0), 0)), ""].join(";"));
    linhas.push("");
  }
  if (tipo === "expenses" || tipo === "all") {
    linhas.push("DESPESAS", "Tipo;Descrição;Categoria;Valor;Data;Forma de pagamento");
    for (const d of despesas ?? []) {
      const descricao = d.tipo === "Parcela" && d.detalhe ? `${d.descricao} (${d.detalhe})` : d.descricao;
      linhas.push([
        d.tipo, txt(descricao), txt(rotuloCategoria(d.categoria)), num(d.valor), dia(d.data),
        txt(d.pagamento ? paymentLabels[d.pagamento] ?? d.pagamento : ""),
      ].join(";"));
    }
    linhas.push(["TOTAL", "", "", num((despesas ?? []).reduce((s, d) => s + d.valor, 0)), "", ""].join(";"));
  }
  return "\uFEFF" + linhas.join("\r\n") + "\r\n";
};

export const Reports = ({
  incomes,
  expenses,
  totalIncome,
  totalExpenses,
  totalDebts,
  totalInvestments,
  setIncomes,
  setExpenses,
  fixedExpenses,
  installments,
}: ReportsProps) => {
  const { labelOf } = useFinanceCategories(); // resolve nome de categorias personalizadas
  const { get } = useUserData();
  const currentMonth = mesAtualExtenso();
  // totalExpenses aqui já é a saída mensal completa (fixas + variáveis + parcelas),
  // calculada uma vez no Index — mesma base da Saúde Financeira e do Dashboard.
  const balance = computeMonthlyBalance(totalIncome, totalExpenses);
  const savingsRate = computeSavingsRate(totalIncome, totalExpenses);
  const rotuloCategoria = (c: string) => categoryLabels[c] || labelOf(c);

  /* Fixos e parcelas (26/09): quando a tela não manda, lê do mesmo store e
     do mesmo perfil (PF/PJ) que o Index usa — perfil apagado cai no pessoal. */
  const perfis = get<Perfil[]>("finance-perfis", []);
  const perfilSalvo = get<string>("finance-perfil-ativo", PERFIL_PESSOAL);
  const perfil = perfilSalvo === PERFIL_PESSOAL || perfilSalvo === PERFIL_TODOS
    || (Array.isArray(perfis) && perfis.some((p) => p?.id === perfilSalvo)) ? perfilSalvo : PERFIL_PESSOAL;
  const lista = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const fixos = fixedExpenses ?? doPerfil(lista<FixedExpense>(get("finance-fixed-expenses", [])), perfil);
  const parcelas = installments ?? doPerfil(lista<Parcela>(get("finance-installments", [])), perfil);

  const despesas = linhasDeDespesa(expenses, fixos, parcelas);
  const totalFixos = fixos.reduce((s, f) => s + (Number(f.value) || 0), 0);
  const totalParcelas = somaParcelasDoMes(parcelas);
  // O dia a dia é o que sobra do total oficial: assim os três somam EXATAMENTE
  // o "Despesas" de cima, mesmo com compra no crédito que foi pra fatura do
  // mês que vem (regra da fatura, lib/finance-fatura).
  const totalDiaADia = Math.max(0, totalExpenses - totalFixos - totalParcelas);

  // Group expenses by category (dia a dia + fixos + parcelas)
  const expensesByCategory = despesas.reduce((acc, d) => {
    acc[d.categoria] = (acc[d.categoria] || 0) + d.valor;
    return acc;
  }, {} as Record<string, number>);

  // Export to CSV
  const exportToCSV = (type: "incomes" | "expenses" | "all") => {
    const csvContent = montarCSV(type, incomes, despesas, rotuloCategoria);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `financas_${type}_${localDayKey()}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // Print report
  const printReport = () => {
    const printContent = document.getElementById("monthly-report");
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório Financeiro - ${currentMonth}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; border-bottom: 2px solid #8b5cf6; padding-bottom: 10px; }
            h2 { color: #666; margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .positive { color: green; }
            .negative { color: red; }
            .summary { display: flex; gap: 20px; margin: 20px 0; }
            .summary-card { background: #f5f5f5; padding: 15px; border-radius: 8px; flex: 1; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-4">
      {/* Actions Bar */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-xs font-bold mb-3">📥 IMPORTAR / EXPORTAR DADOS</h3>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {/* Extrato do banco (OFX/CSV) com auto-categorização e revisão */}
            <ImportExtrato
              expenses={expenses}
              incomes={incomes}
              setExpenses={setExpenses}
              setIncomes={setIncomes}
            />
          </div>
          {/* flex-wrap (26/09): em 360px o "Tudo" ficava metade fora da tela */}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => exportToCSV("incomes")}>
              <Download className="w-4 h-4 mr-1" /> Receitas
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportToCSV("expenses")}>
              <Download className="w-4 h-4 mr-1" /> Despesas
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportToCSV("all")}>
              <FileSpreadsheet className="w-4 h-4 mr-1" /> Tudo
            </Button>
          </div>
          <Button size="sm" onClick={printReport} className="ml-auto">
            <Printer className="w-4 h-4 mr-1" /> Imprimir Relatório
          </Button>
        </div>
      </div>

      {/* Monthly Report Preview */}
      <div id="monthly-report" className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold">Relatório Financeiro</h2>
            <p className="text-sm text-muted-foreground">{currentMonth}</p>
          </div>
          <Calendar className="w-8 h-8 text-muted-foreground" />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Receitas</p>
            <p className="text-[clamp(0.95rem,4.4vw,1.125rem)] font-bold whitespace-nowrap text-green-400">{reais(totalIncome)}</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Despesas</p>
            <p className="text-[clamp(0.95rem,4.4vw,1.125rem)] font-bold whitespace-nowrap text-red-400">{reais(totalExpenses)}</p>
          </div>
          <div className={`${balance >= 0 ? "bg-blue-500/10 border-blue-500/30" : "bg-orange-500/10 border-orange-500/30"} border rounded-lg p-3`}>
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className={`text-[clamp(0.95rem,4.4vw,1.125rem)] font-bold whitespace-nowrap ${balance >= 0 ? "text-blue-400" : "text-orange-400"}`}>
              {balance >= 0 ? "+" : ""}{reais(balance)}
            </p>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Taxa Poupança</p>
            <p className="text-[clamp(0.95rem,4.4vw,1.125rem)] font-bold whitespace-nowrap text-purple-400">
              {savingsRate.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
            </p>
          </div>
        </div>
        {/* De onde vem o "Despesas": os três somam o número do card (26/09) */}
        <p className="text-[11px] text-muted-foreground mb-6" data-testid="despesas-composicao">
          Despesas = custos fixos {reais(totalFixos)} + dia a dia {reais(totalDiaADia)} + parcelas {reais(totalParcelas)}
        </p>

        {/* Expenses by Category */}
        <div className="mb-6">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
            <PieChart className="w-4 h-4" />
            Despesas por Categoria
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {Object.entries(expensesByCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, value]) => (
                // flex-wrap: nome comprido + valor com centavos não cabem lado a
                // lado num celular de 360px — o valor desce, sem cortar o nome
                <div key={cat} className="flex flex-wrap items-center justify-between gap-x-2 bg-muted/30 rounded p-2">
                  <span className="text-xs">{rotuloCategoria(cat)}</span>
                  <span className="text-xs font-medium whitespace-nowrap ml-auto">{reais(value)}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Transactions Tables */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Incomes Table */}
          <div>
            <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              Receitas ({incomes.length})
            </h3>
            <div className="bg-muted/30 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-2">Descrição</th>
                    <th className="text-right p-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {/* relatório é o mês INTEIRO — o corte em 10 linhas escondia lançamento (26/09) */}
                  {incomes.map((i) => (
                    <tr key={i.id} className="border-t border-border/50">
                      <td className="p-2">{i.description}</td>
                      <td className="p-2 text-right text-green-400 whitespace-nowrap">{reais(i.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expenses Table */}
          <div>
            <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              Despesas ({despesas.length})
            </h3>
            <div className="bg-muted/30 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-2">Descrição</th>
                    <th className="text-left p-2">Categoria</th>
                    <th className="text-right p-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {despesas.map((d) => (
                    <tr key={d.id} className="border-t border-border/50">
                      <td className="p-2">
                        {d.descricao}
                        {d.tipo !== "Variável" && (
                          <span className="block text-[10px] text-muted-foreground">
                            {d.tipo === "Fixo" ? "custo fixo" : "parcela"}{d.detalhe ? ` · ${d.detalhe}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-muted-foreground">{rotuloCategoria(d.categoria)}</td>
                      <td className="p-2 text-right text-red-400 whitespace-nowrap">{reais(d.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-border text-center text-xs text-muted-foreground">
          <p>Relatório gerado em {new Date().toLocaleDateString("pt-BR")} • CORE</p>
        </div>
      </div>

      {/* Import Guide */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <h4 className="text-xs font-bold mb-2">📋 COMO IMPORTAR SEU EXTRATO</h4>
        <div className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
          <p>1. No app do seu banco, abra o extrato e toque em <strong>exportar</strong> (todo banco tem — Nubank, Inter, Itaú, BB...).</p>
          <p>2. Escolha o formato <strong>OFX</strong> (de preferência) ou <strong>CSV</strong>.</p>
          <p>3. Volte aqui, toque em <strong>Importar extrato</strong> e selecione o arquivo.</p>
          <p>O CORE categoriza sozinho (iFood → Delivery, Uber → Transporte...) e aprende com as suas correções. Lançamentos repetidos são detectados e desmarcados.</p>
        </div>
      </div>
    </div>
  );
};
