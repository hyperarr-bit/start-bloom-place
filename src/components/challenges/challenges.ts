/**
 * Desafios semanais — avaliados 100% em cima dos lançamentos reais da semana
 * (segunda a domingo). Sem timer, sem cron: o estado é recalculado a cada
 * render e a vitória/derrota vira histórico (que alimenta as insígnias).
 */

export interface ChallengeStatus {
  pct: number;          // 0–100 pra barra
  done: boolean;        // cumpriu (pode ser antes do fim da semana)
  failed: boolean;      // já era (não dá mais pra cumprir nesta semana)
  statusText: string;   // linha de progresso humana
}

export interface ChallengeDef {
  key: string;
  emoji: string;
  title: string;
  desc: string;
  evaluate: (ctx: ChallengeCtx) => ChallengeStatus;
}

export interface ChallengeCtx {
  weekExpenses: any[];      // gastos variáveis com date dentro da semana
  prevWeekTotal: number;    // soma dos variáveis da semana anterior
  elapsedDays: number;      // 1..7 (segunda = 1)
}

export interface ChallengesState {
  active: { key: string; weekStart: string } | null;
  history: { key: string; weekStart: string; result: "win" | "loss" }[];
}

export const EMPTY_CHALLENGES: ChallengesState = { active: null, history: [] };

/** Segunda-feira da semana da data, como YYYY-MM-DD local. */
export const mondayOf = (date: Date): string => {
  const d = new Date(date);
  const dow = (d.getDay() + 6) % 7; // seg=0 ... dom=6
  d.setDate(d.getDate() - dow);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const weekDates = (weekStart: string): string[] => {
  const base = new Date(`${weekStart}T12:00:00`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
};

const sum = (xs: any[]) => xs.reduce((s, e) => s + (e.value || 0), 0);

export const CHALLENGES: ChallengeDef[] = [
  {
    key: "sem-delivery",
    emoji: "🛵",
    title: "Semana sem delivery",
    desc: "Zero pedidos de delivery até domingo",
    evaluate: ({ weekExpenses, elapsedDays }) => {
      const hit = weekExpenses.some((e) => e.category === "delivery");
      if (hit) return { pct: 0, done: false, failed: true, statusText: "Rolou um delivery... semana que vem tem revanche." };
      const done = elapsedDays >= 7;
      return {
        pct: (elapsedDays / 7) * 100,
        done,
        failed: false,
        statusText: done ? "Semana limpa. Zero delivery. 👑" : `${elapsedDays}/7 dias limpos — segue firme.`,
      };
    },
  },
  {
    key: "tres-dias-zero",
    emoji: "🧘",
    title: "3 dias sem gastar",
    desc: "Três dias da semana com zero gasto variável",
    evaluate: ({ weekExpenses, elapsedDays }) => {
      const daysWithSpend = new Set(weekExpenses.map((e) => e.date));
      const zeroDays = Math.max(0, elapsedDays - daysWithSpend.size);
      const done = zeroDays >= 3;
      const remainingDays = 7 - elapsedDays;
      const failed = !done && zeroDays + remainingDays < 3;
      return {
        pct: Math.min((zeroDays / 3) * 100, 100),
        done,
        failed,
        statusText: done ? `${zeroDays} dias sem gastar. Monge. 🧘` : failed ? "Não fecha mais essa semana — próxima tem." : `${zeroDays}/3 dias zerados até agora.`,
      };
    },
  },
  {
    key: "registro-5-dias",
    emoji: "✍️",
    title: "Registrar em 5 dias",
    desc: "Anote pelo menos 1 gasto em 5 dias diferentes",
    evaluate: ({ weekExpenses, elapsedDays }) => {
      const days = new Set(weekExpenses.map((e) => e.date)).size;
      const done = days >= 5;
      const remainingDays = 7 - elapsedDays;
      const failed = !done && days + remainingDays < 5;
      return {
        pct: Math.min((days / 5) * 100, 100),
        done,
        failed,
        statusText: done ? "5 dias de registro. Disciplina real. ✍️" : failed ? "Essa semana não fecha mais — bora na próxima." : `${days}/5 dias com registro.`,
      };
    },
  },
  {
    key: "menos-que-passada",
    emoji: "📉",
    title: "Gastar menos que semana passada",
    desc: "Feche a semana abaixo do total da anterior",
    evaluate: ({ weekExpenses, prevWeekTotal, elapsedDays }) => {
      const current = sum(weekExpenses);
      if (prevWeekTotal <= 0) {
        return { pct: 0, done: false, failed: true, statusText: "Sem semana anterior pra comparar ainda." };
      }
      const failed = current >= prevWeekTotal;
      const done = elapsedDays >= 7 && !failed;
      const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
      return {
        pct: Math.min((current / prevWeekTotal) * 100, 100),
        done,
        failed,
        statusText: failed
          ? `Passou do teto (${fmt(prevWeekTotal)}). Semana que vem tem.`
          : `${fmt(current)} de ${fmt(prevWeekTotal)} (teto da semana passada).`,
      };
    },
  },
];

export const challengeByKey = (key: string) => CHALLENGES.find((c) => c.key === key) ?? null;
