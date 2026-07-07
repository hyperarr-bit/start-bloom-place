import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Award, Zap } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useUserData } from "@/hooks/use-user-data";
import { LevelProgress } from "./LevelProgress";
import { BadgesGrid } from "./BadgesGrid";
import { BadgeDetailSheet } from "./BadgeDetailSheet";
import { BadgeMedallion } from "./BadgeMedallion";
import { Badge } from "./types";

const XP = 50;
const XP_HI = 100;
const XP_TOP = 200;

function buildBadges(get: <T>(key: string, fallback: T) => T): Badge[] {
  const incomes = get<any[]>("finance-incomes", []);
  const expenses = get<any[]>("finance-expenses", []);
  const fixedExpenses = get<any[]>("finance-fixed-expenses", []);
  const investments = get<any[]>("finance-investments", []);
  const installments = get<any[]>("finance-installments", []);
  const dueDays = get<any[]>("finance-dueDays", []);
  const goals = get<any[]>("finance-goals", []);
  const wishlist = get<any[]>("finance-wishlist", []);

  const totalIncome = incomes.reduce((s: number, i: any) => s + (Number(i.value) || Number(i.amount) || 0), 0);
  const totalExpenses = expenses.reduce((s: number, e: any) => s + (Number(e.value) || Number(e.amount) || 0), 0);
  const totalFixed = fixedExpenses.reduce((s: number, e: any) => s + (Number(e.value) || Number(e.amount) || 0), 0);
  const monthlyExpenses = totalExpenses + totalFixed;
  const savingsRate = totalIncome > 0 ? ((totalIncome - monthlyExpenses) / totalIncome) * 100 : 0;
  const totalInvestments = investments.reduce((s: number, i: any) => s + (Number(i.currentValue) || Number(i.value) || 0), 0);
  const uniqueAssets = new Set(investments.map((i: any) => i.type || i.name)).size;

  const allBills = dueDays.flatMap((d: any) => d.bills || []);
  const billsPaid = allBills.length > 0 && allBills.every((b: any) => b.paid);
  const hasActiveDebt = installments.some((i: any) => (i.paidInstallments || 0) < (i.totalInstallments || 0));
  const hasQuitado = installments.some((i: any) => (i.paidInstallments || 0) >= (i.totalInstallments || 0) && (i.totalInstallments || 0) > 0);

  const uniqueIncomes = new Set(incomes.map((i: any) => i.name || i.source || i.id)).size;
  const categorizedExpenses = expenses.filter((e: any) => e.category).length;
  const monthLaunches = incomes.length + expenses.length + fixedExpenses.length;

  const completedGoals = goals.filter((g: any) => (g.current || 0) >= (g.target || 1) || g.completed).length;
  const reserve = totalInvestments >= monthlyExpenses * 3 && monthlyExpenses > 0;

  const acquiredWish = wishlist.some((w: any) => w.acquired || w.purchased);

  return [
    // Receitas / Despesas
    { id: "first-income", name: "Primeiro Salário", description: "Registre sua 1ª receita", icon: "💵", category: "finance", unlocked: incomes.length > 0, color: "green", xp: XP },
    { id: "multi-income", name: "Múltiplas Rendas", description: "3+ fontes de renda", icon: "💼", category: "finance", unlocked: uniqueIncomes >= 3, color: "green", xp: XP_HI },
    { id: "first-expense", name: "Primeira Despesa", description: "Registre 1 despesa", icon: "🧾", category: "finance", unlocked: expenses.length > 0, color: "green", xp: XP },
    { id: "organizer", name: "Organizador", description: "10+ despesas categorizadas", icon: "🗂️", category: "finance", unlocked: categorizedExpenses >= 10, color: "green", xp: XP },
    { id: "budget-master", name: "Mestre do Orçamento", description: "50+ lançamentos no mês", icon: "📊", category: "finance", unlocked: monthLaunches >= 50, color: "green", xp: XP_HI },

    // Poupança
    { id: "saver-20", name: "Poupador", description: "Taxa de poupança ≥ 20%", icon: "🐷", category: "finance", unlocked: savingsRate >= 20, color: "green", xp: XP },
    { id: "saver-40", name: "Super Poupador", description: "Taxa de poupança ≥ 40%", icon: "🪙", category: "finance", unlocked: savingsRate >= 40, color: "green", xp: XP_HI },
    { id: "saver-60", name: "Formiguinha", description: "Taxa de poupança ≥ 60%", icon: "🐜", category: "finance", unlocked: savingsRate >= 60, color: "green", xp: XP_TOP },

    // Investimentos
    { id: "investor-1k", name: "Investidor", description: "R$ 1.000+ investidos", icon: "📈", category: "finance", unlocked: totalInvestments >= 1000, color: "green", xp: XP },
    { id: "investor-10k", name: "Investidor Pro", description: "R$ 10.000+ investidos", icon: "🏦", category: "finance", unlocked: totalInvestments >= 10000, color: "green", xp: XP_HI },
    { id: "investor-50k", name: "Patrimônio 50k", description: "R$ 50.000+ investidos", icon: "💰", category: "finance", unlocked: totalInvestments >= 50000, color: "green", xp: XP_HI },
    { id: "investor-100k", name: "Patrimônio 100k", description: "R$ 100.000+ investidos", icon: "🏆", category: "finance", unlocked: totalInvestments >= 100000, color: "green", xp: XP_TOP },
    { id: "diversified", name: "Diversificado", description: "3+ ativos diferentes", icon: "🧩", category: "finance", unlocked: uniqueAssets >= 3, color: "green", xp: XP_HI },

    // Contas / Dívidas
    { id: "bills-ok", name: "Contas em Dia", description: "Todas as contas pagas", icon: "✅", category: "finance", unlocked: billsPaid, color: "green", xp: XP },
    { id: "debt-free", name: "Livre de Dívidas", description: "Sem parcelas pendentes", icon: "🆓", category: "finance", unlocked: installments.length > 0 && !hasActiveDebt, color: "green", xp: XP_HI },
    { id: "quitador", name: "Quitador", description: "Parcelamento 100% quitado", icon: "🎯", category: "finance", unlocked: hasQuitado, color: "green", xp: XP },

    // Metas / Planejamento
    { id: "dreamer", name: "Sonhador", description: "Crie sua 1ª meta", icon: "✨", category: "finance", unlocked: goals.length > 0, color: "green", xp: XP },
    { id: "achiever", name: "Realizador", description: "Conclua 1 meta", icon: "🥇", category: "finance", unlocked: completedGoals >= 1, color: "green", xp: XP_HI },
    { id: "emergency-fund", name: "Reserva de Emergência", description: "3× despesas mensais guardadas", icon: "🛡️", category: "finance", unlocked: reserve, color: "green", xp: XP_TOP },

    // Wishlist
    { id: "wishlist", name: "Lista de Desejos", description: "1+ item na lista", icon: "📝", category: "finance", unlocked: wishlist.length > 0, color: "green", xp: XP },
    { id: "conscious-buyer", name: "Comprador Consciente", description: "Adquira item da lista", icon: "🛍️", category: "finance", unlocked: acquiredWish, color: "green", xp: XP },

    // Mestre
    { id: "master", name: "Mestre Financeiro", description: "Atinja nível Diamante", icon: "👑", category: "finance", unlocked: false, color: "green", xp: XP_TOP },
  ];
}

export const AchievementsPage = () => {
  const navigate = useNavigate();
  const { get } = useUserData();
  const [selected, setSelected] = useState<Badge | null>(null);

  const badges = useMemo(() => buildBadges(get), [get]);

  const totalXP = useMemo(() => badges.filter(b => b.unlocked).reduce((sum, b) => sum + b.xp, 0), [badges]);

  const finalBadges = useMemo(
    () => badges.map(b => b.id === "master" ? { ...b, unlocked: totalXP >= 2000 } : b),
    [badges, totalXP]
  );

  const unlockedCount = finalBadges.filter(b => b.unlocked).length;
  const nextBadges = finalBadges.filter(b => !b.unlocked).slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="hover:bg-muted rounded-md p-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold tracking-tight">CONQUISTAS</h1>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        <LevelProgress xp={totalXP} />

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-card rounded-lg border border-border p-3 text-center">
            <Award className="w-4 h-4 mx-auto mb-1 text-yellow-400" />
            <p className="text-lg font-bold">{unlockedCount}/{finalBadges.length}</p>
            <p className="text-[10px] text-muted-foreground">Conquistas</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-3 text-center">
            <Zap className="w-4 h-4 mx-auto mb-1 text-purple-400" />
            <p className="text-lg font-bold">{totalXP}</p>
            <p className="text-[10px] text-muted-foreground">XP total</p>
          </div>
        </div>

        <BadgesGrid badges={finalBadges} onSelect={setSelected} />

        {nextBadges.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-4">
            <h4 className="text-xs font-bold mb-3 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              Próximas conquistas
            </h4>
            <div className="space-y-2">
              {nextBadges.map(badge => (
                <button
                  key={badge.id}
                  onClick={() => setSelected(badge)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-left hover:bg-muted/60 transition-colors"
                >
                  <BadgeMedallion emoji={badge.icon} xp={badge.xp} unlocked={false} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold">{badge.name}</p>
                    <p className="text-[10px] text-muted-foreground">{badge.description}</p>
                  </div>
                  <span className="text-[10px] font-bold text-yellow-400/60">+{badge.xp} XP</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <BadgeDetailSheet badge={selected} onClose={() => setSelected(null)} />
    </div>
  );
};
