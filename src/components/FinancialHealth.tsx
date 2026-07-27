import { AlertTriangle, CheckCircle, TrendingUp, Shield, Target, Lightbulb, CreditCard, Heart, Plane, PiggyBank } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { computeMonthlyOutflow, computeSavingsRate } from "@/lib/finance-totals";

interface Bill {
  id: string;
  name: string;
  paid: boolean;
}

interface DueDay {
  day: number;
  color: string;
  bills: Bill[];
}

interface Installment {
  id: string;
  description: string;
  totalValue: number;
  installmentValue: number;
  paidInstallments: number;
  totalInstallments: number;
  cardName: string;
}

interface WishlistItem {
  id: string;
  name: string;
  price: number;
  savedAmount: number;
  priority: "alta" | "media" | "baixa";
  category: string;
}

interface Trip {
  id: string;
  destination: string;
  budget: number;
  savedAmount: number;
  expenses: { id: string; estimatedCost: number; paid: boolean }[];
}

interface Investment {
  id: string;
  name: string;
  type: string;
  investedAmount: number;
  currentValue: number;
  monthlyContribution: number;
}

interface FinancialHealthProps {
  totalIncome: number;
  totalExpenses: number;
  totalFixedExpenses: number;
  monthlyInstallments: number;
  totalDebts: number;
  totalInvestments: number;
  emergencyFundGoal: number;
  dueDays: DueDay[];
  installments: Installment[];
  wishlistItems: WishlistItem[];
  trips: Trip[];
  investments: Investment[];
}

export const FinancialHealth = ({
  totalIncome,
  totalExpenses,
  totalFixedExpenses,
  monthlyInstallments,
  totalDebts,
  totalInvestments,
  emergencyFundGoal,
  dueDays,
  installments,
  wishlistItems,
  trips,
  investments,
}: FinancialHealthProps) => {
  // === METRICS ===
  // Mesmas funções do Index/Relatórios (lib/finance-totals) — a taxa daqui TEM
  // que bater com a do resto do app.
  const totalRealExpenses = computeMonthlyOutflow(totalExpenses, totalFixedExpenses, monthlyInstallments);
  const savingsRate = computeSavingsRate(totalIncome, totalRealExpenses);
  const debtToIncome = totalIncome > 0 ? (totalDebts / (totalIncome * 12)) * 100 : 0;
  /*
   * RESERVA DE EMERGÊNCIA — de onde sai o número (27/07).
   *
   * Lia de uma meta chamada "emergência" dentro do módulo Metas. Como Metas
   * foi removido em 31/03, NADA no app cria essa meta: o valor era sempre 0 e
   * os 15 pontos da reserva eram tão inalcançáveis quanto os 10 das metas.
   * Somados, 25 dos 100 pontos estavam mortos e o score travava em 75.
   *
   * Agora usa o TOTAL INVESTIDO, que é a mesma definição que a conquista
   * "Reserva de Emergência" já usa (investido vs. despesas mensais). Duas
   * partes do app medindo a mesma coisa de jeitos diferentes é como o número
   * perde a confiança de quem lê. O alvo continua 6 meses de despesa — o
   * clássico — enquanto a conquista pede 3; cada um coerente consigo.
   */
  const realEmergencyGoal = totalRealExpenses > 0 ? totalRealExpenses * 6 : emergencyFundGoal;
  const emergencyProgress = realEmergencyGoal > 0 ? (totalInvestments / realEmergencyGoal) * 100 : 0;
  const monthlyContributions = investments.reduce((s, i) => s + i.monthlyContribution, 0);
  const investmentRate = totalIncome > 0 ? (monthlyContributions / totalIncome) * 100 : 0;

  // Bills payment rate
  const allBills = dueDays.flatMap(d => Array.isArray((d as any)?.bills) ? (d as any).bills : []);
  const paidBills = allBills.filter((b: any) => b?.paid).length;
  const billsPaymentRate = allBills.length > 0 ? (paidBills / allBills.length) * 100 : 100;

  /*
   * METAS SAIU DO SCORE (27/07).
   *
   * O módulo Metas foi removido do app em 31/03 ("Remove Metas module from
   * finance"), mas o score continuou reservando 10 dos 100 pontos pro
   * "progresso das metas" — e sem tela pra criar meta, `goals` é sempre
   * vazio. Resultado: TODO usuário ficava travado em 90, penalizado por não
   * usar algo que não existe.
   *
   * Era incoerente até dentro deste arquivo: parcelas e desejos vazios valem
   * 100 (pontuação cheia, "nada a cobrar"), só metas valia 0.
   *
   * Os 10 pontos foram para reserva de emergência e aportes mensais (5 cada)
   * — os dois critérios que sobraram com o mesmo espírito: guardar dinheiro
   * mirando um objetivo.
   */

  // Installment progress (how much already paid off)
  const installmentProgress = installments.length > 0
    ? installments.reduce((sum, i) => sum + (i.paidInstallments / i.totalInstallments) * 100, 0) / installments.length
    : 100;

  // Wishlist discipline (how much saved vs total desired)
  const wishlistTotal = wishlistItems.reduce((s, i) => s + i.price, 0);
  const wishlistSaved = wishlistItems.reduce((s, i) => s + i.savedAmount, 0);
  const wishlistDiscipline = wishlistTotal > 0 ? (wishlistSaved / wishlistTotal) * 100 : 100;

  // Investment diversification (more types = better)
  const investmentTypes = new Set(investments.map(i => i.type)).size;
  const diversificationScore = Math.min(investmentTypes * 25, 100);

  // Monthly contributions consistency
  const contributionRate = totalIncome > 0 ? (monthlyContributions / totalIncome) * 100 : 0;

  /*
   * SCORE (0-100). Os pesos abaixo somam EXATAMENTE 100 — e isso não era
   * verdade antes (27/07).
   *
   * Dois defeitos que se escondiam um no outro:
   *  1. as dívidas eram calculadas como DESCONTO (score -= penalidade) mas
   *     exibidas na composição como pontos ganhos ("14,1/15pts"). Com isso a
   *     lista somava 110 na tela enquanto a fórmula só permitia 95: ninguém
   *     jamais tiraria 100, por mais impecável que fosse.
   *  2. os 10 pontos de metas e os 15 da reserva estavam mortos (ver acima),
   *     derrubando o teto real pra 75.
   *
   * Agora a dívida é positiva-invertida (quanto menos dívida, mais ponto),
   * igual ao que a composição SEMPRE mostrou — a tela deixa de mentir — e sem
   * os 10 das metas o total fecha em 100 sem inventar peso novo.
   */
  const pesos = [
    Math.min(Math.max(savingsRate, 0) * 1.0, 20),              // Poupança: 20
    Math.max(0, 15 - Math.min(debtToIncome * 0.5, 15)),        // Dívidas: 15 (invertido)
    Math.min(emergencyProgress * 0.15, 15),                    // Reserva: 15
    Math.min(investmentRate * 1.0, 15),                        // Aportes mensais: 15
    Math.min(billsPaymentRate * 0.15, 15),                     // Contas em dia: 15
    Math.min(installmentProgress * 0.05, 5),                   // Parcelas: 5
    Math.min(wishlistDiscipline * 0.05, 5),                    // Desejos: 5
    Math.min(diversificationScore * 0.05, 5),                  // Diversificação: 5
    Math.min(contributionRate * 0.5, 5),                       // Aportes regulares: 5
  ];                                                           // total: 100
  const score = Math.max(0, Math.min(100, Math.round(pesos.reduce((a, b) => a + b, 0))));

  const getScoreColor = () => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getScoreLabel = () => {
    if (score >= 80) return "Excelente";
    if (score >= 60) return "Bom";
    if (score >= 40) return "Regular";
    return "Precisa Melhorar";
  };

  const getScoreBg = () => {
    if (score >= 80) return "from-green-500/20 to-green-600/5";
    if (score >= 60) return "from-yellow-500/20 to-yellow-600/5";
    if (score >= 40) return "from-orange-500/20 to-orange-600/5";
    return "from-red-500/20 to-red-600/5";
  };

  // === TIPS ===
  const tips: { icon: typeof AlertTriangle; text: string; type: "warning" | "success" | "info" }[] = [];

  if (savingsRate < 20) {
    tips.push({ icon: AlertTriangle, text: `Sua taxa de poupança é ${savingsRate.toFixed(1)}%. Tente poupar pelo menos 20% da renda.`, type: "warning" });
  } else {
    tips.push({ icon: CheckCircle, text: `Ótimo! Você está poupando ${savingsRate.toFixed(1)}% da sua renda.`, type: "success" });
  }

  if (debtToIncome > 30) {
    tips.push({ icon: AlertTriangle, text: `Suas dívidas representam ${debtToIncome.toFixed(1)}% da renda anual. Priorize quitá-las.`, type: "warning" });
  } else if (totalDebts > 0) {
    tips.push({ icon: CheckCircle, text: `Dívidas sob controle: ${debtToIncome.toFixed(1)}% da renda anual.`, type: "success" });
  }

  if (emergencyProgress < 100) {
    tips.push({ icon: Shield, text: `Reserva de emergência: ${emergencyProgress.toFixed(0)}% completa. Meta: 6 meses de despesas reais (R$ ${realEmergencyGoal.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}).`, type: "info" });
  } else {
    tips.push({ icon: CheckCircle, text: "Reserva de emergência completa! 🎉", type: "success" });
  }

  if (billsPaymentRate < 100 && allBills.length > 0) {
    const pendentes = allBills.length - paidBills;
    tips.push({ icon: AlertTriangle, text: `${pendentes} conta${pendentes > 1 ? "s" : ""} pendente${pendentes > 1 ? "s" : ""} de ${allBills.length}. Pague em dia para evitar juros!`, type: "warning" });
  } else if (allBills.length > 0) {
    tips.push({ icon: CheckCircle, text: "Todas as contas pagas em dia! ✅", type: "success" });
  }

  if (investmentTypes < 3 && investments.length > 0) {
    tips.push({ icon: TrendingUp, text: `Sua carteira tem ${investmentTypes} tipo(s) de investimento. Diversifique mais para reduzir riscos.`, type: "info" });
  }

  if (wishlistTotal > totalIncome * 3 && wishlistItems.length > 0) {
    tips.push({ icon: Heart, text: `Seus desejos somam R$ ${wishlistTotal.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} — ${(wishlistTotal / totalIncome).toFixed(1)}x sua renda. Priorize os mais importantes.`, type: "warning" });
  }

  const monthlyBalance = totalIncome - totalRealExpenses;
  const yearlyProjection = monthlyBalance * 12;
  const realMonthlyBalance = monthlyBalance;

  // Trip readiness
  const tripReadiness = trips.length > 0
    ? trips.reduce((s, t) => s + (t.savedAmount / t.budget) * 100, 0) / trips.length
    : 0;

  const hasAnyData = totalIncome > 0 || totalExpenses > 0 || totalDebts > 0 || investments.length > 0 || totalFixedExpenses > 0;
  // Considera dados suficientes para calcular score só quando há receita E pelo menos uma despesa (variável, fixa ou parcela).
  // Evita exibir score baixíssimo só porque o usuário ainda está cadastrando os dados (ex.: durante o tutorial).
  const hasEnoughData = totalIncome > 0 && (totalExpenses + totalFixedExpenses + monthlyInstallments) > 0;

  if (!hasAnyData) {
    return (
      <div className="space-y-4">
        <div className="bg-card rounded-lg border border-dashed border-border p-8 text-center">
          <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-bold mb-1">Sem dados financeiros ainda</h3>
          <p className="text-xs text-muted-foreground">
            Cadastre suas receitas, despesas e investimentos nas abas <strong>Meu Financeiro</strong> e <strong>Investimentos</strong> para ver seu score.
          </p>
        </div>
      </div>
    );
  }

  if (!hasEnoughData) {
    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/30 p-6 text-center">
          <Target className="w-10 h-10 text-primary mx-auto mb-3" />
          <h3 className="text-sm font-bold mb-1">Score em construção</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Pra calcular um score que faça sentido, precisamos da sua <strong>receita</strong> e de pelo menos uma <strong>despesa</strong> (variável, fixa ou parcela).
            Continue preenchendo em <strong>Meu Financeiro</strong> e o score aparece aqui automaticamente.
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      {/* Score Card */}
      <div className={`bg-gradient-to-br ${getScoreBg()} rounded-lg border border-border p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Target className="w-4 h-4" />
            SCORE FINANCEIRO
          </h3>
          <span className={`text-3xl font-bold ${getScoreColor()}`}>{score}/100</span>
        </div>
        <Progress value={score} className="h-3 mb-2" />
        <p className={`text-sm text-center font-medium ${getScoreColor()}`}>{getScoreLabel()}</p>
      </div>

      {/* Detailed Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-muted-foreground mb-1">Taxa de Poupança</p>
          <p className={`text-lg font-bold ${savingsRate >= 20 ? "text-green-400" : "text-orange-400"}`}>
            {savingsRate.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted-foreground">Meta: ≥20%</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-muted-foreground mb-1">Dívida/Renda Anual</p>
          <p className={`text-lg font-bold ${debtToIncome <= 30 ? "text-green-400" : "text-red-400"}`}>
            {debtToIncome.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted-foreground">Meta: ≤30%</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-muted-foreground mb-1">Saldo Real Mensal</p>
          <p className={`text-lg font-bold ${realMonthlyBalance >= 0 ? "text-green-400" : "text-red-400"}`}>
            {realMonthlyBalance >= 0 ? "+" : ""}R$ {realMonthlyBalance.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-muted-foreground">Inclui fixas + parcelas</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-muted-foreground mb-1">Projeção Anual</p>
          <p className={`text-lg font-bold ${yearlyProjection >= 0 ? "text-green-400" : "text-red-400"}`}>
            {yearlyProjection >= 0 ? "+" : ""}R$ {yearlyProjection.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-muted-foreground">Economia em 12 meses</p>
        </div>
      </div>

      {/* Integration Breakdown */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h4 className="text-xs font-bold mb-3">📊 COMPOSIÇÃO DO SCORE</h4>
        <div className="space-y-2">
          {[
            { label: "Poupança mensal", value: Math.min(Math.max(savingsRate, 0) * 1.0, 20), max: 20, icon: "💰" },
            { label: "Contas em dia", value: Math.min(billsPaymentRate * 0.15, 15), max: 15, icon: "📋" },
            { label: "Reserva de emergência", value: Math.min(emergencyProgress * 0.15, 15), max: 15, icon: "🛡️" },
            { label: "Aportes mensais", value: Math.min(investmentRate * 1.0, 15), max: 15, icon: "📈" },
            { label: "Controle de dívidas", value: Math.max(0, 15 - Math.min(debtToIncome * 0.5, 15)), max: 15, icon: "💳" },
            { label: "Quitação de parcelas", value: Math.min(installmentProgress * 0.05, 5), max: 5, icon: "📆" },
            { label: "Disciplina (desejos)", value: Math.min(wishlistDiscipline * 0.05, 5), max: 5, icon: "❤️" },
            { label: "Diversificação", value: Math.min(diversificationScore * 0.05, 5), max: 5, icon: "🔀" },
            { label: "Aportes regulares", value: Math.min(contributionRate * 0.5, 5), max: 5, icon: "🔄" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-sm w-5">{item.icon}</span>
              <span className="text-xs flex-1">{item.label}</span>
              <div className="w-24">
                <Progress value={(item.value / item.max) * 100} className="h-1.5" />
              </div>
              <span className="text-[10px] text-muted-foreground w-14 text-right">
                {item.value.toFixed(1)}/{item.max}pts
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cross-component insights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] text-muted-foreground">Contas Pagas</span>
          </div>
          <p className="text-lg font-bold">{paidBills}/{allBills.length}</p>
          <Progress value={billsPaymentRate} className="h-1 mt-1" />
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-4 h-4 text-pink-400" />
            <span className="text-[10px] text-muted-foreground">Desejos</span>
          </div>
          <p className="text-lg font-bold">{wishlistDiscipline.toFixed(0)}%</p>
          <p className="text-[10px] text-muted-foreground">{wishlistItems.length} itens</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <Plane className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] text-muted-foreground">Viagens</span>
          </div>
          <p className="text-lg font-bold">{tripReadiness.toFixed(0)}%</p>
          <p className="text-[10px] text-muted-foreground">{trips.length} planejada(s)</p>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h4 className="text-xs font-bold mb-3 flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          DICAS PERSONALIZADAS
        </h4>
        <div className="space-y-2">
          {tips.map((tip, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 p-2 rounded ${
                tip.type === "warning"
                  ? "bg-orange-500/10 border border-orange-500/20"
                  : tip.type === "success"
                  ? "bg-green-500/10 border border-green-500/20"
                  : "bg-blue-500/10 border border-blue-500/20"
              }`}
            >
              <tip.icon
                className={`w-4 h-4 mt-0.5 ${
                  tip.type === "warning"
                    ? "text-orange-400"
                    : tip.type === "success"
                    ? "text-green-400"
                    : "text-blue-400"
                }`}
              />
              <p className="text-xs">{tip.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-lg border border-green-500/30 p-3 cursor-pointer hover:border-green-500/50 transition-colors">
          <p className="text-xs font-bold text-green-400 mb-1">🎯 Regra 50/30/20</p>
          <p className="text-[10px] text-muted-foreground">
            Necessidades: R$ {(totalIncome * 0.5).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} | 
            Desejos: R$ {(totalIncome * 0.3).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} | 
            Poupança: R$ {(totalIncome * 0.2).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-lg border border-blue-500/30 p-3 cursor-pointer hover:border-blue-500/50 transition-colors">
          <p className="text-xs font-bold text-blue-400 mb-1">💰 Reserva de Emergência</p>
          <p className="text-[10px] text-muted-foreground">
            R$ {totalInvestments.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} de R$ {realEmergencyGoal.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ({emergencyProgress.toFixed(0)}%)
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-lg border border-purple-500/30 p-3 cursor-pointer hover:border-purple-500/50 transition-colors">
          <p className="text-xs font-bold text-purple-400 mb-1">📈 Renda Passiva</p>
          <p className="text-[10px] text-muted-foreground">
            Potencial: R$ {((totalInvestments * 0.06) / 12).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/mês com seus investimentos atuais
          </p>
        </div>
      </div>
    </div>
  );
};