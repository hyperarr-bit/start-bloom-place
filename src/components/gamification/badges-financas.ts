import { Badge, Raridade, XP_RARIDADE } from "./types";
import { chaveArquivada } from "@/lib/virada-do-mes";
import { somaParcelasDoMes, type Parcela } from "@/lib/finance-parcelas";
import { computeMonthlyBalance, computeMonthlyOutflow, computeSavingsRate } from "@/lib/finance-totals";
import { PERFIL_PESSOAL, doPerfil } from "@/lib/finance-perfil";

/**
 * Conquistas de FINANÇAS — saíram do AchievementsPage (26/09) pra serem lidas
 * também pela Home (momento do adesivo novo) sem montar a tela inteira.
 *
 * Várias são medidas pelo MÊS corrente (taxa de poupança, lançamentos do mês,
 * contas pagas): antes, no dia 1º, elas voltavam a trancar e o nível caía. Não
 * voltam mais — o desbloqueio fica gravado em `conquistas-desbloqueadas`
 * (ver lib/conquistas-registro).
 *
 * 27/09: cada adesivo declara a RARIDADE (posição na escada do módulo) e o XP
 * vem dela: comum 50 · raro 100 · épico 200 · lendário 400. Dois novos:
 * "Mês Fechado" (1 mês arquivado na virada) e "3 Meses no Azul".
 */

type Base = Omit<Badge, "unlocked" | "progresso" | "xp" | "raridade"> & { raridade: Raridade };

const comXp = (b: Base): Omit<Badge, "unlocked" | "progresso"> => ({ ...b, xp: XP_RARIDADE[b.raridade] });

/** Insígnia com progresso numérico — o `alvo` é o que a descrição promete. */
const comProgresso = (b: Base, atual: number, alvo: number): Badge => ({
  ...comXp(b),
  unlocked: atual >= alvo,
  progresso: { atual: Math.max(0, Math.min(atual, alvo)), alvo },
});

/** Insígnia sim/não — não dá pra medir "meio caminho" de "contas todas pagas". */
const booleana = (b: Base, ok: boolean): Badge => ({ ...comXp(b), unlocked: ok });

const num = (v: unknown) => Number(v) || 0;

/** Taxa de poupança só abre com o mês anotado (5+ gastos): senão a 1ª receita já era "100% poupado".
 *  Travada assim, o círculo mostra a taxa de VERDADE (93%), não o alvo cortado (40%). */
const poupanca = (b: Badge, mesAnotado: boolean, taxa: number): Badge =>
  mesAnotado || !b.unlocked ? b : { ...b, unlocked: false, progresso: b.progresso ? { atual: Math.max(0, taxa), alvo: b.progresso.alvo } : undefined };

type Leitor = <T>(key: string, fallback: T) => T;
type Item = Record<string, unknown>;

/** Mês anotado = pelo menos 5 gastos (variáveis + fixos) e saída > 0 — a trava das insígnias de poupança. */
export const MIN_GASTOS_POUPANCA = 5;
/** "3 Meses no Azul": quantos meses arquivados seguidos com saldo positivo. */
export const ALVO_MESES_NO_AZUL = 3;

const lista = (get: Leitor, k: string): Item[] => {
  const v = get<unknown>(k, []);
  return Array.isArray(v) ? v.filter((x): x is Item => !!x && typeof x === "object") : [];
};
const valor = (i: Item) => num(i.value) || num(i.amount);
const soma = (itens: Item[]) => itens.reduce((s, i) => s + valor(i), 0);

const MESES_OLHADOS = 24;

/** Os meses arquivados na virada (`finance-{ano}-{mes}-*`), do mais recente pro mais antigo. */
export interface MesArquivado {
  /** "2026-08" */
  mes: string;
  lancamentos: number;
  receitas: number;
  saida: number;
  /** Tem receita e o mês está anotado (≥ 5 gastos): dá pra dizer se sobrou. */
  medido: boolean;
  saldo: number;
}

/** `perfil` (27/09): só os lançamentos daquele perfil (PF ou uma empresa) — sem ele, tudo junto, como sempre foi. */
export const lerMesesArquivados = (get: Leitor, hoje = new Date(), perfil?: string): MesArquivado[] => {
  const out: MesArquivado[] = [];
  const filtrar = <T extends Item>(itens: T[]): T[] => (perfil ? doPerfil(itens as (T & { perfil?: string })[], perfil) : itens);
  for (let i = 1; i <= MESES_OLHADOS; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const ano = d.getFullYear(), mes = d.getMonth();
    const incomes = filtrar(lista(get, chaveArquivada(ano, mes, "incomes")));
    const expenses = filtrar(lista(get, chaveArquivada(ano, mes, "expenses")));
    const fixed = filtrar(lista(get, chaveArquivada(ano, mes, "fixed")));
    const parcelas = filtrar(lista(get, chaveArquivada(ano, mes, "installments"))) as unknown as Parcela[];
    const receitas = soma(incomes);
    const saida = computeMonthlyOutflow(soma(expenses), soma(fixed), somaParcelasDoMes(parcelas));
    const lancamentos = incomes.length + expenses.length + fixed.length;
    out.push({
      mes: `${ano}-${String(mes + 1).padStart(2, "0")}`,
      lancamentos,
      receitas,
      saida,
      medido: receitas > 0 && expenses.length + fixed.length >= MIN_GASTOS_POUPANCA && saida > 0,
      saldo: computeMonthlyBalance(receitas, saida),
    });
  }
  return out;
};

/** Meses seguidos no azul, contando do mês passado pra trás (um mês sem medida quebra a conta). */
export const mesesSeguidosNoAzul = (arquivados: MesArquivado[]): number => {
  let n = 0;
  for (const m of arquivados) {
    if (!m.medido || m.saldo <= 0) break;
    n++;
  }
  return n;
};

/** "AAAA-MM" do mês de `hoje`. */
const idDoMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
/** Só os lançamentos datados NO mês (os sem data ficam — na dúvida não se tira nada de ninguém). */
const doMes = (itens: Item[], mesId: string) =>
  itens.filter((i) => typeof i.date !== "string" || !/^\d{4}-\d{2}/.test(i.date) || i.date.startsWith(`${mesId}-`));
/** "Salário" e "salário " são a MESMA fonte de renda. */
const fonteDaRenda = (i: Item) => String(i.description ?? i.name ?? i.source ?? "").trim().toLowerCase();

/**
 * As medidas do mês corrente que os adesivos e as insígnias usam.
 *
 * CONSERTOS DA AUDITORIA (27/09, LEIA §4):
 *  1. "Múltiplas Rendas" contava LANÇAMENTOS (a receita só tem `description`;
 *     `name`/`source` nunca existiram, e `id` é único por linha): 3 salários
 *     do mesmo emprego abriam "3+ fontes". Agora conta descrições distintas,
 *     no mês corrente e nos meses arquivados.
 *  2. "Comprador Consciente" nunca abria: ninguém grava `acquired`. A lista de
 *     desejos guarda `savedAmount`/`price` — o desejo com o valor inteiro
 *     juntado é o que o app sabe de verdade.
 *  3. A taxa de poupança ignorava as PARCELAS do mês (o Painel inclui: a
 *     regra da casa é fixos + variáveis + parcelas).
 *  4. Tudo somava PF + PJ sem olhar perfil nem data: a renda da empresa
 *     inflava a poupança pessoal, e um gasto de mês passado ainda no balde
 *     entrava no mês. As medidas de DINHEIRO agora são do perfil ativo e do
 *     mês; as de CONTAGEM ("registre 1 receita") continuam somando tudo.
 */
export function medirFinancas(get: Leitor, hoje = new Date()) {
  const mesId = idDoMes(hoje);
  const perfil = get<string>("finance-perfil-ativo", PERFIL_PESSOAL) || PERFIL_PESSOAL;
  const incomes = lista(get, "finance-incomes");
  const expenses = lista(get, "finance-expenses");
  const fixedExpenses = lista(get, "finance-fixed-expenses");
  const investments = lista(get, "finance-investments");
  const installments = lista(get, "finance-installments");
  const dueDays = lista(get, "finance-dueDays");
  const wishlist = lista(get, "finance-wishlist");

  // dinheiro: o perfil ativo, o mês pela data
  const incomesDoMes = doPerfil(doMes(incomes, mesId), perfil);
  const expensesDoMes = doPerfil(doMes(expenses, mesId), perfil);
  const fixosDoPerfil = doPerfil(fixedExpenses, perfil);
  const parcelasDoPerfil = doPerfil(installments, perfil) as unknown as Parcela[];
  const totalIncome = soma(incomesDoMes);
  const totalExpenses = soma(expensesDoMes);
  const totalFixed = soma(fixosDoPerfil);
  const monthlyExpenses = totalExpenses + totalFixed;
  /* A saída do mês é a do Painel: variáveis + fixos + parcelas do mês. */
  const saidaDoMes = computeMonthlyOutflow(totalExpenses, totalFixed, somaParcelasDoMes(parcelasDoPerfil));
  const savingsRate = computeSavingsRate(totalIncome, saidaDoMes);
  /*
   * Poupança só vale com o mês anotado (26/09). Com o desbloqueio agora
   * PERMANENTE, a conta antiga virava brinde: a 1ª receita, antes de qualquer
   * gasto, dava "100% poupado" e abria Poupador, Super Poupador e Formiguinha
   * de uma vez — pra sempre. Antes ela trancava de novo no 1º gasto.
   */
  const mesAnotado = expensesDoMes.length + fixosDoPerfil.length >= MIN_GASTOS_POUPANCA && saidaDoMes > 0;
  const totalInvestments = investments.reduce((s, i) => s + (num(i.currentValue) || num(i.value)), 0);
  const uniqueAssets = new Set(investments.map((i) => i.type || i.name)).size;

  const allBills = dueDays.flatMap((d) => (Array.isArray(d.bills) ? (d.bills as Item[]) : []));
  const billsPaid = allBills.length > 0 && allBills.every((b) => !!b?.paid);
  const hasActiveDebt = installments.some((i) => num(i.paidInstallments) < num(i.totalInstallments));
  const hasQuitado = installments.some((i) => num(i.paidInstallments) >= num(i.totalInstallments) && num(i.totalInstallments) > 0);

  // fontes de renda: descrições distintas, hoje e nos meses arquivados
  const fontes = new Set(incomes.map(fonteDaRenda).filter(Boolean));
  for (let i = 1; i <= MESES_OLHADOS; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    for (const inc of lista(get, chaveArquivada(d.getFullYear(), d.getMonth(), "incomes"))) {
      const f = fonteDaRenda(inc);
      if (f) fontes.add(f);
    }
  }
  const uniqueIncomes = fontes.size;
  const categorizedExpenses = expenses.filter((e) => !!e.category).length;
  const monthLaunches = doMes(incomes, mesId).length + doMes(expenses, mesId).length + fixedExpenses.length;

  const reservaAlvo = saidaDoMes * 3;
  const acquiredWish = wishlist.some((w) => !!(w.acquired || w.purchased) || (num(w.price) > 0 && num(w.savedAmount) >= num(w.price)));

  const challenges = get<{ history?: { result: string }[] } | null>("finance-challenges", { history: [] });
  const challengeWins = (Array.isArray(challenges?.history) ? challenges!.history : []).filter((h) => h?.result === "win").length;

  const arquivados = lerMesesArquivados(get, hoje, perfil);
  const mesesFechados = lerMesesArquivados(get, hoje).filter((m) => m.lancamentos > 0).length;
  const mesesNoAzul = mesesSeguidosNoAzul(arquivados);

  /* A insígnia "Sobrou no mês" (27/09) fala o mesmo número do Painel:
   * receitas − (variáveis + fixos + parcelas do mês). Só com o mês anotado. */
  const sobrouNoMes = computeMonthlyBalance(totalIncome, saidaDoMes);
  const taxaDoMes = savingsRate;

  return {
    incomes, expenses, fixedExpenses, investments, installments, wishlist, perfil,
    totalIncome, monthlyExpenses, saidaDoMes, savingsRate, mesAnotado, totalInvestments, uniqueAssets,
    billsPaid, hasActiveDebt, hasQuitado, uniqueIncomes, categorizedExpenses, monthLaunches,
    reservaAlvo, acquiredWish, challengeWins, mesesFechados, mesesNoAzul, sobrouNoMes, taxaDoMes,
  };
}

export function buildBadgesFinancas(get: Leitor): Badge[] {
  const m = medirFinancas(get);
  const base = { category: "finance" as const, color: "green" };
  const reais = { formato: "reais" as const };
  const porcento = { formato: "porcento" as const };

  return [
    // Receitas / Despesas
    comProgresso({ ...base, id: "first-income", name: "Primeiro Salário", description: "Registre sua 1ª receita", icon: "💵", raridade: "comum", unidade: ["receita", "receitas"] }, m.incomes.length, 1),
    comProgresso({ ...base, id: "multi-income", name: "Múltiplas Rendas", description: "3+ fontes de renda", icon: "💼", raridade: "raro", unidade: ["fonte de renda", "fontes de renda"] }, m.uniqueIncomes, 3),
    comProgresso({ ...base, id: "first-expense", name: "Primeira Despesa", description: "Registre 1 despesa", icon: "🧾", raridade: "comum", unidade: ["despesa", "despesas"] }, m.expenses.length, 1),
    comProgresso({ ...base, id: "organizer", name: "Organizador", description: "10+ despesas categorizadas", icon: "🗂️", raridade: "comum", unidade: ["despesa categorizada", "despesas categorizadas"] }, m.categorizedExpenses, 10),
    comProgresso({ ...base, id: "budget-master", name: "Mestre do Orçamento", description: "50+ lançamentos no mês", icon: "📊", raridade: "raro", unidade: ["lançamento no mês", "lançamentos no mês"] }, m.monthLaunches, 50),

    // Poupança (só com o mês anotado — ver mesAnotado)
    poupanca(comProgresso({ ...base, ...porcento, id: "saver-20", name: "Poupador", description: "Taxa de poupança ≥ 20%", icon: "🐷", raridade: "comum" }, m.savingsRate, 20), m.mesAnotado, m.savingsRate),
    poupanca(comProgresso({ ...base, ...porcento, id: "saver-40", name: "Super Poupador", description: "Taxa de poupança ≥ 40%", icon: "💰", raridade: "raro" }, m.savingsRate, 40), m.mesAnotado, m.savingsRate),
    poupanca(comProgresso({ ...base, ...porcento, id: "saver-60", name: "Formiguinha", description: "Taxa de poupança ≥ 60%", icon: "🐜", raridade: "epico" }, m.savingsRate, 60), m.mesAnotado, m.savingsRate),

    // Investimentos
    comProgresso({ ...base, ...reais, id: "investor-1k", name: "Investidor", description: "R$ 1.000+ investidos", icon: "📈", raridade: "comum" }, m.totalInvestments, 1000),
    comProgresso({ ...base, ...reais, id: "investor-10k", name: "Investidor Pro", description: "R$ 10.000+ investidos", icon: "🏦", raridade: "raro" }, m.totalInvestments, 10000),
    comProgresso({ ...base, ...reais, id: "investor-50k", name: "Patrimônio 50k", description: "R$ 50.000+ investidos", icon: "💰", raridade: "raro" }, m.totalInvestments, 50000),
    comProgresso({ ...base, ...reais, id: "investor-100k", name: "Patrimônio 100k", description: "R$ 100.000+ investidos", icon: "🏆", raridade: "lendario" }, m.totalInvestments, 100000),
    comProgresso({ ...base, id: "diversified", name: "Diversificado", description: "3+ ativos diferentes", icon: "🧩", raridade: "raro", unidade: ["ativo diferente", "ativos diferentes"] }, m.uniqueAssets, 3),

    // Contas / Dívidas
    booleana({ ...base, id: "bills-ok", name: "Contas em Dia", description: "Todas as contas pagas", icon: "✅", raridade: "comum" }, m.billsPaid),
    booleana({ ...base, id: "debt-free", name: "Livre de Dívidas", description: "Sem parcelas pendentes", icon: "🆓", raridade: "raro" }, m.installments.length > 0 && !m.hasActiveDebt),
    booleana({ ...base, id: "quitador", name: "Quitador", description: "Parcelamento 100% quitado", icon: "🎯", raridade: "comum" }, m.hasQuitado),

    /*
     * "Sonhador" e "Realizador" saíram (27/07): as duas dependiam do módulo
     * METAS, removido do app em 31/03 — eram medalhas IMPOSSÍVEIS.
     */
    m.reservaAlvo > 0
      ? comProgresso({ ...base, ...reais, id: "emergency-fund", name: "Reserva de Emergência", description: "3× despesas mensais guardadas", icon: "🛡️", raridade: "epico" }, m.totalInvestments, m.reservaAlvo)
      : booleana({ ...base, id: "emergency-fund", name: "Reserva de Emergência", description: "3× despesas mensais guardadas", icon: "🛡️", raridade: "epico" }, false),

    // Wishlist
    comProgresso({ ...base, id: "wishlist", name: "Lista de Desejos", description: "1+ item na lista", icon: "📝", raridade: "comum", unidade: ["item na lista", "itens na lista"] }, m.wishlist.length, 1),
    booleana({ ...base, id: "conscious-buyer", name: "Comprador Consciente", description: "Junte o valor inteiro de um desejo da lista", icon: "🛍️", raridade: "comum" }, m.acquiredWish),

    // Desafios semanais
    comProgresso({ ...base, id: "challenger", name: "Desafiante", description: "Vença 1 desafio semanal", icon: "🎯", raridade: "comum", unidade: ["desafio vencido", "desafios vencidos"] }, m.challengeWins, 1),
    comProgresso({ ...base, id: "challenger-5", name: "Imbatível", description: "Vença 5 desafios semanais", icon: "🥊", raridade: "raro", unidade: ["desafio vencido", "desafios vencidos"] }, m.challengeWins, 5),
    comProgresso({ ...base, id: "challenger-15", name: "Lenda da Semana", description: "Vença 15 desafios semanais", icon: "🐐", raridade: "epico", unidade: ["desafio vencido", "desafios vencidos"] }, m.challengeWins, 15),

    // Virada do mês (27/09): o que fica arquivado quando o mês fecha
    comProgresso({ ...base, id: "mes-fechado", name: "Mês Fechado", description: "Feche 1 mês com lançamentos (a virada arquiva sozinha)", icon: "🗃️", raridade: "comum", unidade: ["mês fechado", "meses fechados"] }, m.mesesFechados, 1),
    comProgresso({ ...base, id: "azul-3", name: "3 Meses no Azul", description: "3 meses fechados seguidos com saldo positivo", icon: "📘", raridade: "epico", unidade: ["mês no azul", "meses no azul"] }, m.mesesNoAzul, ALVO_MESES_NO_AZUL),
  ];
}
