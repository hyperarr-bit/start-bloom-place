import { Badge } from "./types";

/**
 * Conquistas de FINANÇAS — saíram do AchievementsPage (26/09) pra serem lidas
 * também pela Home (momento do adesivo novo) sem montar a tela inteira.
 *
 * Várias são medidas pelo MÊS corrente (taxa de poupança, lançamentos do mês,
 * contas pagas): antes, no dia 1º, elas voltavam a trancar e o nível caía. Não
 * voltam mais — o desbloqueio fica gravado em `conquistas-desbloqueadas`
 * (ver lib/conquistas-registro).
 */

const XP = 50;
const XP_HI = 100;
const XP_TOP = 200;

type Base = Omit<Badge, "unlocked" | "progresso">;

/** Insígnia com progresso numérico — o `alvo` é o que a descrição promete. */
const comProgresso = (b: Base, atual: number, alvo: number): Badge => ({
  ...b,
  unlocked: atual >= alvo,
  progresso: { atual: Math.max(0, Math.min(atual, alvo)), alvo },
});

/** Insígnia sim/não — não dá pra medir "meio caminho" de "contas todas pagas". */
const booleana = (b: Base, ok: boolean): Badge => ({ ...b, unlocked: ok });

const num = (v: unknown) => Number(v) || 0;

/** Taxa de poupança só abre com o mês anotado (5+ gastos): senão a 1ª receita já era "100% poupado".
 *  Travada assim, o círculo mostra a taxa de VERDADE (93%), não o alvo cortado (40%). */
const poupanca = (b: Badge, mesAnotado: boolean, taxa: number): Badge =>
  mesAnotado || !b.unlocked ? b : { ...b, unlocked: false, progresso: b.progresso ? { atual: Math.max(0, taxa), alvo: b.progresso.alvo } : undefined };

export function buildBadgesFinancas(get: <T>(key: string, fallback: T) => T): Badge[] {
  type Item = Record<string, unknown>;
  const lista = (k: string): Item[] => {
    const v = get<unknown>(k, []);
    return Array.isArray(v) ? v.filter((x): x is Item => !!x && typeof x === "object") : [];
  };
  const valor = (i: Item) => num(i.value) || num(i.amount);
  const incomes = lista("finance-incomes");
  const expenses = lista("finance-expenses");
  const fixedExpenses = lista("finance-fixed-expenses");
  const investments = lista("finance-investments");
  const installments = lista("finance-installments");
  const dueDays = lista("finance-dueDays");
  const wishlist = lista("finance-wishlist");

  const totalIncome = incomes.reduce((s, i) => s + valor(i), 0);
  const totalExpenses = expenses.reduce((s, e) => s + valor(e), 0);
  const totalFixed = fixedExpenses.reduce((s, e) => s + valor(e), 0);
  const monthlyExpenses = totalExpenses + totalFixed;
  const savingsRate = totalIncome > 0 ? ((totalIncome - monthlyExpenses) / totalIncome) * 100 : 0;
  /*
   * Poupança só vale com o mês anotado (26/09). Com o desbloqueio agora
   * PERMANENTE, a conta antiga virava brinde: a 1ª receita, antes de qualquer
   * gasto, dava "100% poupado" e abria Poupador, Super Poupador e Formiguinha
   * de uma vez — pra sempre. Antes ela trancava de novo no 1º gasto.
   */
  const MIN_GASTOS_POUPANCA = 5;
  const mesAnotado = expenses.length + fixedExpenses.length >= MIN_GASTOS_POUPANCA && monthlyExpenses > 0;
  const totalInvestments = investments.reduce((s, i) => s + (num(i.currentValue) || num(i.value)), 0);
  const uniqueAssets = new Set(investments.map((i) => i.type || i.name)).size;

  const allBills = dueDays.flatMap((d) => (Array.isArray(d.bills) ? (d.bills as Item[]) : []));
  const billsPaid = allBills.length > 0 && allBills.every((b) => !!b?.paid);
  const hasActiveDebt = installments.some((i) => num(i.paidInstallments) < num(i.totalInstallments));
  const hasQuitado = installments.some((i) => num(i.paidInstallments) >= num(i.totalInstallments) && num(i.totalInstallments) > 0);

  const uniqueIncomes = new Set(incomes.map((i) => i.name || i.source || i.id)).size;
  const categorizedExpenses = expenses.filter((e) => !!e.category).length;
  const monthLaunches = incomes.length + expenses.length + fixedExpenses.length;

  const reservaAlvo = monthlyExpenses * 3;
  const acquiredWish = wishlist.some((w) => !!(w.acquired || w.purchased));

  const challenges = get<{ history?: { result: string }[] } | null>("finance-challenges", { history: [] });
  const challengeWins = (Array.isArray(challenges?.history) ? challenges!.history : []).filter((h) => h?.result === "win").length;

  const base = { category: "finance" as const, color: "green" };
  const reais = { formato: "reais" as const };
  const porcento = { formato: "porcento" as const };

  return [
    // Receitas / Despesas
    comProgresso({ ...base, id: "first-income", name: "Primeiro Salário", description: "Registre sua 1ª receita", icon: "💵", xp: XP, unidade: ["receita", "receitas"] }, incomes.length, 1),
    comProgresso({ ...base, id: "multi-income", name: "Múltiplas Rendas", description: "3+ fontes de renda", icon: "💼", xp: XP_HI, unidade: ["fonte de renda", "fontes de renda"] }, uniqueIncomes, 3),
    comProgresso({ ...base, id: "first-expense", name: "Primeira Despesa", description: "Registre 1 despesa", icon: "🧾", xp: XP, unidade: ["despesa", "despesas"] }, expenses.length, 1),
    comProgresso({ ...base, id: "organizer", name: "Organizador", description: "10+ despesas categorizadas", icon: "🗂️", xp: XP, unidade: ["despesa categorizada", "despesas categorizadas"] }, categorizedExpenses, 10),
    comProgresso({ ...base, id: "budget-master", name: "Mestre do Orçamento", description: "50+ lançamentos no mês", icon: "📊", xp: XP_HI, unidade: ["lançamento no mês", "lançamentos no mês"] }, monthLaunches, 50),

    // Poupança (só com o mês anotado — ver mesAnotado)
    poupanca(comProgresso({ ...base, ...porcento, id: "saver-20", name: "Poupador", description: "Taxa de poupança ≥ 20%", icon: "🐷", xp: XP }, savingsRate, 20), mesAnotado, savingsRate),
    poupanca(comProgresso({ ...base, ...porcento, id: "saver-40", name: "Super Poupador", description: "Taxa de poupança ≥ 40%", icon: "💰", xp: XP_HI }, savingsRate, 40), mesAnotado, savingsRate),
    poupanca(comProgresso({ ...base, ...porcento, id: "saver-60", name: "Formiguinha", description: "Taxa de poupança ≥ 60%", icon: "🐜", xp: XP_TOP }, savingsRate, 60), mesAnotado, savingsRate),

    // Investimentos
    comProgresso({ ...base, ...reais, id: "investor-1k", name: "Investidor", description: "R$ 1.000+ investidos", icon: "📈", xp: XP }, totalInvestments, 1000),
    comProgresso({ ...base, ...reais, id: "investor-10k", name: "Investidor Pro", description: "R$ 10.000+ investidos", icon: "🏦", xp: XP_HI }, totalInvestments, 10000),
    comProgresso({ ...base, ...reais, id: "investor-50k", name: "Patrimônio 50k", description: "R$ 50.000+ investidos", icon: "💰", xp: XP_HI }, totalInvestments, 50000),
    comProgresso({ ...base, ...reais, id: "investor-100k", name: "Patrimônio 100k", description: "R$ 100.000+ investidos", icon: "🏆", xp: XP_TOP }, totalInvestments, 100000),
    comProgresso({ ...base, id: "diversified", name: "Diversificado", description: "3+ ativos diferentes", icon: "🧩", xp: XP_HI, unidade: ["ativo diferente", "ativos diferentes"] }, uniqueAssets, 3),

    // Contas / Dívidas
    booleana({ ...base, id: "bills-ok", name: "Contas em Dia", description: "Todas as contas pagas", icon: "✅", xp: XP }, billsPaid),
    booleana({ ...base, id: "debt-free", name: "Livre de Dívidas", description: "Sem parcelas pendentes", icon: "🆓", xp: XP_HI }, installments.length > 0 && !hasActiveDebt),
    booleana({ ...base, id: "quitador", name: "Quitador", description: "Parcelamento 100% quitado", icon: "🎯", xp: XP }, hasQuitado),

    /*
     * "Sonhador" e "Realizador" saíram (27/07): as duas dependiam do módulo
     * METAS, removido do app em 31/03 — eram medalhas IMPOSSÍVEIS.
     */
    reservaAlvo > 0
      ? comProgresso({ ...base, ...reais, id: "emergency-fund", name: "Reserva de Emergência", description: "3× despesas mensais guardadas", icon: "🛡️", xp: XP_TOP }, totalInvestments, reservaAlvo)
      : booleana({ ...base, id: "emergency-fund", name: "Reserva de Emergência", description: "3× despesas mensais guardadas", icon: "🛡️", xp: XP_TOP }, false),

    // Wishlist
    comProgresso({ ...base, id: "wishlist", name: "Lista de Desejos", description: "1+ item na lista", icon: "📝", xp: XP, unidade: ["item na lista", "itens na lista"] }, wishlist.length, 1),
    booleana({ ...base, id: "conscious-buyer", name: "Comprador Consciente", description: "Adquira item da lista", icon: "🛍️", xp: XP }, acquiredWish),

    // Desafios semanais
    comProgresso({ ...base, id: "challenger", name: "Desafiante", description: "Vença 1 desafio semanal", icon: "🎯", xp: XP, unidade: ["desafio vencido", "desafios vencidos"] }, challengeWins, 1),
    comProgresso({ ...base, id: "challenger-5", name: "Imbatível", description: "Vença 5 desafios semanais", icon: "🥊", xp: XP_HI, unidade: ["desafio vencido", "desafios vencidos"] }, challengeWins, 5),
    comProgresso({ ...base, id: "challenger-15", name: "Lenda da Semana", description: "Vença 15 desafios semanais", icon: "🐐", xp: XP_TOP, unidade: ["desafio vencido", "desafios vencidos"] }, challengeWins, 15),
  ];
}
