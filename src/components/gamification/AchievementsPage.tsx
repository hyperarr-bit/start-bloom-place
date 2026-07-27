import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Zap, Target } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useUserData } from "@/hooks/use-user-data";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { toast } from "sonner";
import { LevelProgress } from "./LevelProgress";
import { BadgesGrid } from "./BadgesGrid";
import { BadgeDetailSheet } from "./BadgeDetailSheet";
import { BadgeMedallion } from "./BadgeMedallion";
import { ProfileCard } from "./ProfileCard";
import { buildBadgesVida } from "./badges-vida";
import { Badge, fracaoDe } from "./types";

const XP = 50;
const XP_HI = 100;
const XP_TOP = 200;

/** Insígnia com progresso numérico — o `alvo` é o que a descrição promete. */
const comProgresso = (b: Omit<Badge, "unlocked" | "progresso">, atual: number, alvo: number): Badge => ({
  ...b,
  unlocked: atual >= alvo,
  progresso: { atual: Math.max(0, Math.min(atual, alvo)), alvo },
});

/** Insígnia sim/não — não dá pra medir "meio caminho" de "contas todas pagas". */
const booleana = (b: Omit<Badge, "unlocked" | "progresso">, ok: boolean): Badge => ({ ...b, unlocked: ok });

function buildBadges(get: <T>(key: string, fallback: T) => T): Badge[] {
  const incomes = get<any[]>("finance-incomes", []);
  const expenses = get<any[]>("finance-expenses", []);
  const fixedExpenses = get<any[]>("finance-fixed-expenses", []);
  const investments = get<any[]>("finance-investments", []);
  const installments = get<any[]>("finance-installments", []);
  const dueDays = get<any[]>("finance-dueDays", []);
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

  const reservaAlvo = monthlyExpenses * 3;

  const acquiredWish = wishlist.some((w: any) => w.acquired || w.purchased);

  const challenges = get<{ history?: { result: string }[] }>("finance-challenges", { history: [] });
  const challengeWins = (challenges.history ?? []).filter((h) => h.result === "win").length;

  const base = { category: "finance" as const, color: "green" };

  return [
    // Receitas / Despesas
    comProgresso({ ...base, id: "first-income", name: "Primeiro Salário", description: "Registre sua 1ª receita", icon: "💵", xp: XP }, incomes.length, 1),
    comProgresso({ ...base, id: "multi-income", name: "Múltiplas Rendas", description: "3+ fontes de renda", icon: "💼", xp: XP_HI }, uniqueIncomes, 3),
    comProgresso({ ...base, id: "first-expense", name: "Primeira Despesa", description: "Registre 1 despesa", icon: "🧾", xp: XP }, expenses.length, 1),
    comProgresso({ ...base, id: "organizer", name: "Organizador", description: "10+ despesas categorizadas", icon: "🗂️", xp: XP }, categorizedExpenses, 10),
    comProgresso({ ...base, id: "budget-master", name: "Mestre do Orçamento", description: "50+ lançamentos no mês", icon: "📊", xp: XP_HI }, monthLaunches, 50),

    // Poupança
    comProgresso({ ...base, id: "saver-20", name: "Poupador", description: "Taxa de poupança ≥ 20%", icon: "🐷", xp: XP }, savingsRate, 20),
    comProgresso({ ...base, id: "saver-40", name: "Super Poupador", description: "Taxa de poupança ≥ 40%", icon: "🪙", xp: XP_HI }, savingsRate, 40),
    comProgresso({ ...base, id: "saver-60", name: "Formiguinha", description: "Taxa de poupança ≥ 60%", icon: "🐜", xp: XP_TOP }, savingsRate, 60),

    // Investimentos
    comProgresso({ ...base, id: "investor-1k", name: "Investidor", description: "R$ 1.000+ investidos", icon: "📈", xp: XP }, totalInvestments, 1000),
    comProgresso({ ...base, id: "investor-10k", name: "Investidor Pro", description: "R$ 10.000+ investidos", icon: "🏦", xp: XP_HI }, totalInvestments, 10000),
    comProgresso({ ...base, id: "investor-50k", name: "Patrimônio 50k", description: "R$ 50.000+ investidos", icon: "💰", xp: XP_HI }, totalInvestments, 50000),
    comProgresso({ ...base, id: "investor-100k", name: "Patrimônio 100k", description: "R$ 100.000+ investidos", icon: "🏆", xp: XP_TOP }, totalInvestments, 100000),
    comProgresso({ ...base, id: "diversified", name: "Diversificado", description: "3+ ativos diferentes", icon: "🧩", xp: XP_HI }, uniqueAssets, 3),

    // Contas / Dívidas
    booleana({ ...base, id: "bills-ok", name: "Contas em Dia", description: "Todas as contas pagas", icon: "✅", xp: XP }, billsPaid),
    booleana({ ...base, id: "debt-free", name: "Livre de Dívidas", description: "Sem parcelas pendentes", icon: "🆓", xp: XP_HI }, installments.length > 0 && !hasActiveDebt),
    booleana({ ...base, id: "quitador", name: "Quitador", description: "Parcelamento 100% quitado", icon: "🎯", xp: XP }, hasQuitado),

    /*
     * "Sonhador" e "Realizador" saíram (27/07): as duas dependiam do módulo
     * METAS, removido do app em 31/03. Sem tela pra criar meta, eram medalhas
     * IMPOSSÍVEIS — e, com a nova ordenação por proximidade, apareceriam pra
     * sempre em "Próximas conquistas" a 0%, que é o contrário do que aquele
     * card serve. Alvo inalcançável apresentado como próximo passo desmotiva.
     */
    reservaAlvo > 0
      ? comProgresso({ ...base, id: "emergency-fund", name: "Reserva de Emergência", description: "3× despesas mensais guardadas", icon: "🛡️", xp: XP_TOP }, totalInvestments, reservaAlvo)
      : booleana({ ...base, id: "emergency-fund", name: "Reserva de Emergência", description: "3× despesas mensais guardadas", icon: "🛡️", xp: XP_TOP }, false),

    // Wishlist
    comProgresso({ ...base, id: "wishlist", name: "Lista de Desejos", description: "1+ item na lista", icon: "📝", xp: XP }, wishlist.length, 1),
    booleana({ ...base, id: "conscious-buyer", name: "Comprador Consciente", description: "Adquira item da lista", icon: "🛍️", xp: XP }, acquiredWish),

    // Desafios semanais
    comProgresso({ ...base, id: "challenger", name: "Desafiante", description: "Vença 1 desafio semanal", icon: "🎯", xp: XP }, challengeWins, 1),
    comProgresso({ ...base, id: "challenger-5", name: "Imbatível", description: "Vença 5 desafios semanais", icon: "🥊", xp: XP_HI }, challengeWins, 5),
    comProgresso({ ...base, id: "challenger-15", name: "Lenda da Semana", description: "Vença 15 desafios semanais", icon: "🐐", xp: XP_TOP }, challengeWins, 15),
  ];
}

export const AchievementsPage = () => {
  const navigate = useNavigate();
  const { get } = useUserData();
  const [selected, setSelected] = useState<Badge | null>(null);
  const [challengesHidden, setChallengesHidden] = usePersistedState<boolean>("finance-challenges-hidden", false);

  const badges = useMemo(() => [...buildBadges(get), ...buildBadgesVida(get)], [get]);

  const totalXP = useMemo(() => badges.filter(b => b.unlocked).reduce((sum, b) => sum + b.xp, 0), [badges]);

  const finalBadges = useMemo<Badge[]>(
    () => [
      ...badges,
      // A insígnia máxima é do APP INTEIRO, não das finanças — ela sempre foi
      // medida pelo XP total, e chamá-la de "Mestre Financeiro" era mentira
      // desde que existe conquista de rotina, leitura e treino.
      {
        id: "master", name: "Mestre do CORE", description: "Chegue ao nível Diamante",
        icon: "👑", category: "geral", color: "green", xp: XP_TOP,
        unlocked: totalXP >= 2000, progresso: { atual: Math.min(totalXP, 2000), alvo: 2000 },
      },
    ],
    [badges, totalXP],
  );

  /**
   * "Próximas" é por PROXIMIDADE, não por ordem de declaração.
   *
   * Antes era `filter(!unlocked).slice(0,3)`, então quem tinha zero investido
   * via "Patrimônio 100k" como próxima conquista. Um alvo inalcançável
   * apresentado como o próximo passo não motiva — desmotiva. Agora entra
   * quem está mais perto de fechar, e só quem já começou (>0) na frente:
   * sugerir algo que a pessoa nem começou é palpite, não pista.
   */
  const nextBadges = useMemo(() => {
    const trancadas = finalBadges.filter(b => !b.unlocked);
    const comeco = trancadas.filter(b => fracaoDe(b) > 0).sort((a, b) => fracaoDe(b) - fracaoDe(a));
    const zeradas = trancadas.filter(b => fracaoDe(b) === 0).sort((a, b) => a.xp - b.xp);
    return [...comeco, ...zeradas].slice(0, 3);
  }, [finalBadges]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/home")} className="hover:bg-muted rounded-md p-1 transition-colors" aria-label="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold tracking-tight">CONQUISTAS</h1>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Cartão do membro: nível, streak e melhores insígnias — compartilhável.
            (Os cards de contagem antigos moram dentro dele agora.) */}
        <ProfileCard badges={finalBadges} totalXP={totalXP} />

        <LevelProgress xp={totalXP} />

        {nextBadges.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-4">
            <h4 className="text-xs font-bold mb-3 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              Próximas conquistas
            </h4>
            <div className="space-y-2">
              {nextBadges.map(badge => {
                const f = fracaoDe(badge);
                return (
                  <button
                    key={badge.id}
                    onClick={() => setSelected(badge)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-left hover:bg-muted/60 transition-colors"
                  >
                    <BadgeMedallion emoji={badge.icon} xp={badge.xp} unlocked={false} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold">{badge.name}</p>
                      <p className="text-[10px] text-muted-foreground">{badge.description}</p>
                      {/* A barra é o ponto: mostra que falta pouco, não só que falta */}
                      {badge.progresso && f > 0 && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-yellow-400/70" style={{ width: `${Math.round(f * 100)}%` }} />
                          </div>
                          <span className="text-[9px] font-bold tabular-nums text-muted-foreground shrink-0">
                            {Math.round(f * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-yellow-400/60 shrink-0">+{badge.xp} XP</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <BadgesGrid badges={finalBadges} onSelect={setSelected} />

        {/* Quem escondeu os desafios semanais reativa por aqui (as insígnias
            de desafio dependem deles) */}
        {challengesHidden && (
          <button
            onClick={() => { setChallengesHidden(false); toast.success("Desafios semanais de volta no Dashboard! 🎯"); }}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Target className="w-3.5 h-3.5" /> Reativar desafios semanais
          </button>
        )}
      </main>

      <BadgeDetailSheet badge={selected} onClose={() => setSelected(null)} />
    </div>
  );
};
