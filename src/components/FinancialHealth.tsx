import { AlertTriangle, CheckCircle, TrendingUp, Shield, Target, Lightbulb, CreditCard, Heart, Plane, PiggyBank } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Goal {
  id: string;
  name: string;
  targetValue: number;
  currentValue: number;
}

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
  totalDebts: number;
  totalInvestments: number;
  emergencyFund: number;
  emergencyFundGoal: number;
  goals: Goal[];
  dueDays: DueDay[];
  installments: Installment[];
  wishlistItems: WishlistItem[];
  trips: Trip[];
  investments: Investment[];
}

export const FinancialHealth = ({
  totalIncome,
  totalExpenses,
  totalDebts,
  totalInvestments,
  emergencyFund,
  emergencyFundGoal,
  goals,
  dueDays,
  installments,
  wishlistItems,
  trips,
  investments,
}: FinancialHealthProps) => {
  // === METRICS ===
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  const debtToIncome = totalIncome > 0 ? (totalDebts / (totalIncome * 12)) * 100 : 0;
  const emergencyProgress = emergencyFundGoal > 0 ? (emergencyFund / emergencyFundGoal) * 100 : 0;
  const investmentRate = totalIncome > 0 ? (totalInvestments / (totalIncome * 12)) * 100 : 0;

  // Bills payment rate
  const allBills = dueDays.flatMap(d => d.bills);
  const paidBills = allBills.filter(b => b.paid).length;
  const billsPaymentRate = allBills.length > 0 ? (paidBills / allBills.length) * 100 : 100;

  // Goals progress
  const goalsProgress = goals.length > 0
    ? goals.reduce((sum, g) => sum + Math.min((g.currentValue / g.targetValue) * 100, 100), 0) / goals.length
    : 0;

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
  const monthlyContributions = investments.reduce((s, i) => s + i.monthlyContribution, 0);
  const contributionRate = totalIncome > 0 ? (monthlyContributions / totalIncome) * 100 : 0;

  // === SCORE CALCULATION (0-100) ===
  let score = 0;
  score += Math.min(savingsRate * 0.6, 15);           // Savings: up to 15pts
  score -= Math.min(debtToIncome * 0.4, 15);           // Debt penalty: up to -15pts
  score += Math.min(emergencyProgress * 0.15, 15);     // Emergency fund: up to 15pts
  score += Math.min(investmentRate * 0.3, 10);          // Investment volume: up to 10pts
  score += Math.min(billsPaymentRate * 0.15, 15);       // Bills on time: up to 15pts
  score += Math.min(goalsProgress * 0.1, 10);           // Goals progress: up to 10pts
  score += Math.min(installmentProgress * 0.05, 5);     // Installment payoff: up to 5pts
  score += Math.min(wishlistDiscipline * 0.05, 5);      // Wishlist saving: up to 5pts
  score += Math.min(diversificationScore * 0.05, 5);    // Diversification: up to 5pts
  score += Math.min(contributionRate * 0.5, 5);         // Monthly contributions: up to 5pts
  score += 10; // Base
  score = Math.max(0, Math.min(100, Math.round(score)));

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
    tips.push({ icon: Shield, text: `Reserva de emergência: ${emergencyProgress.toFixed(0)}% completa. Meta: 6 meses de despesas.`, type: "info" });
  } else {
    tips.push({ icon: CheckCircle, text: "Reserva de emergência completa! 🎉", type: "success" });
  }

  if (billsPaymentRate < 100 && allBills.length > 0) {
    tips.push({ icon: AlertTriangle, text: `${allBills.length - paidBills} conta(s) pendente(s) de ${allBills.length}. Pague em dia para evitar juros!`, type: "warning" });
  } else if (allBills.length > 0) {
    tips.push({ icon: CheckCircle, text: "Todas as contas pagas em dia! ✅", type: "success" });
  }

  if (investmentTypes < 3 && investments.length > 0) {
    tips.push({ icon: TrendingUp, text: `Sua carteira tem ${investmentTypes} tipo(s) de investimento. Diversifique mais para reduzir riscos.`, type: "info" });
  }

  if (wishlistTotal > totalIncome * 3 && wishlistItems.length > 0) {
    tips.push({ icon: Heart, text: `Seus desejos somam R$ ${wishlistTotal.toLocaleString("pt-BR")} — ${(wishlistTotal / totalIncome).toFixed(1)}x sua renda. Priorize os mais importantes.`, type: "warning" });
  }

  const monthlyBalance = totalIncome - totalExpenses;
  const yearlyProjection = monthlyBalance * 12;
  const monthlyInstallmentCost = installments.reduce((s, i) => i.paidInstallments < i.totalInstallments ? s + i.installmentValue : s, 0);
  const realMonthlyBalance = monthlyBalance - monthlyInstallmentCost;

  // Trip readiness
  const tripReadiness = trips.length > 0
    ? trips.reduce((s, t) => s + (t.savedAmount / t.budget) * 100, 0) / trips.length
    : 0;

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
            {realMonthlyBalance >= 0 ? "+" : ""}R$ {realMonthlyBalance.toLocaleString("pt-BR")}
          </p>
          <p className="text-[10px] text-muted-foreground">Inclui parcelas</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-muted-foreground mb-1">Projeção Anual</p>
          <p className={`text-lg font-bold ${yearlyProjection >= 0 ? "text-green-400" : "text-red-400"}`}>
            {yearlyProjection >= 0 ? "+" : ""}R$ {yearlyProjection.toLocaleString("pt-BR")}
          </p>
          <p className="text-[10px] text-muted-foreground">Economia em 12 meses</p>
        </div>
      </div>

      {/* Integration Breakdown */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h4 className="text-xs font-bold mb-3">📊 COMPOSIÇÃO DO SCORE</h4>
        <div className="space-y-2">
          {[
            { label: "Poupança mensal", value: Math.min(savingsRate * 0.6, 15), max: 15, icon: "💰" },
            { label: "Contas em dia", value: Math.min(billsPaymentRate * 0.15, 15), max: 15, icon: "📋" },
            { label: "Reserva de emergência", value: Math.min(emergencyProgress * 0.15, 15), max: 15, icon: "🛡️" },
            { label: "Volume de investimentos", value: Math.min(investmentRate * 0.3, 10), max: 10, icon: "📈" },
            { label: "Progresso das metas", value: Math.min(goalsProgress * 0.1, 10), max: 10, icon: "🎯" },
            { label: "Controle de dívidas", value: Math.max(0, 15 - Math.min(debtToIncome * 0.4, 15)), max: 15, icon: "💳" },
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
            <Target className="w-4 h-4 text-yellow-400" />
            <span className="text-[10px] text-muted-foreground">Metas</span>
          </div>
          <p className="text-lg font-bold">{goalsProgress.toFixed(0)}%</p>
          <Progress value={goalsProgress} className="h-1 mt-1" />
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
            Necessidades: R$ {(totalIncome * 0.5).toLocaleString("pt-BR")} | 
            Desejos: R$ {(totalIncome * 0.3).toLocaleString("pt-BR")} | 
            Poupança: R$ {(totalIncome * 0.2).toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-lg border border-blue-500/30 p-3 cursor-pointer hover:border-blue-500/50 transition-colors">
          <p className="text-xs font-bold text-blue-400 mb-1">💰 Reserva de Emergência</p>
          <p className="text-[10px] text-muted-foreground">
            R$ {emergencyFund.toLocaleString("pt-BR")} de R$ {emergencyFundGoal.toLocaleString("pt-BR")} ({emergencyProgress.toFixed(0)}%)
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-lg border border-purple-500/30 p-3 cursor-pointer hover:border-purple-500/50 transition-colors">
          <p className="text-xs font-bold text-purple-400 mb-1">📈 Renda Passiva</p>
          <p className="text-[10px] text-muted-foreground">
            Potencial: R$ {((totalInvestments * 0.06) / 12).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}/mês com seus investimentos atuais
          </p>
        </div>
      </div>
    </div>
  );
};