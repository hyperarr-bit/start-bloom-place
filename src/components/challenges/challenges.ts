/**
 * Desafios semanais — avaliados 100% em cima dos lançamentos reais da semana
 * (segunda a domingo). Sem timer, sem cron: o estado é recalculado a cada
 * render e a vitória/derrota vira histórico (que alimenta as insígnias).
 */

import { chaveArquivada } from "@/lib/virada-do-mes";
import { doPerfil } from "@/lib/finance-perfil";

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

/* ═══ A SEMANA FECHA SEM DEPENDER DO PAINEL (29/09) ═══
 *
 * A vitória só entrava no histórico com o card do Painel de Finanças MONTADO:
 * "Semana sem delivery" e "Gastar menos que a semana passada" só se cumprem no
 * domingo (7º dia), e quem não abria o Painel no domingo ganhava uma DERROTA na
 * segunda — o fechamento marcava "loss" sem avaliar a semana (e, se avaliasse,
 * contava 1 dia: `indexOf` de hoje numa semana passada é -1). Agora o fechamento
 * AVALIA a semana inteira (7 dias) e roda na abertura do app, fora da tela
 * (hooks/use-fechamento-desafio), e o card usa as mesmas funções.
 *
 * E a semana que cruza o mês (28/09 a 04/10): no dia 1º a virada arquiva os
 * gastos de 28–30/09 em `finance-2026-setembro-expenses` e o card só via o balde
 * de outubro — o delivery do dia 29 sumia, os dias com registro também, e o
 * "gastar menos que a semana passada" ficava sem semana anterior.
 */

const diaLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Segunda-feira da semana anterior à de `weekStart`. */
export const segundaAnterior = (weekStart: string): string => {
  const base = new Date(`${weekStart}T12:00:00`);
  base.setDate(base.getDate() - 7);
  return mondayOf(base);
};

/** Estado gravado tolerante a formato velho/estranho. */
export const lerDesafios = (v: unknown): ChallengesState => {
  const o = v && typeof v === "object" ? (v as Partial<ChallengesState>) : {};
  const a = o.active as ChallengesState["active"] | undefined;
  const active = a && typeof a.key === "string" && typeof a.weekStart === "string" ? { key: a.key, weekStart: a.weekStart } : null;
  const history = Array.isArray(o.history) ? o.history.filter((h) => h && typeof h.key === "string" && typeof h.weekStart === "string") : [];
  return { active, history };
};

/**
 * Os gastos variáveis que o desafio precisa ver: a semana dele e a anterior, de
 * TODOS os baldes onde essas datas podem morar — o do mês corrente
 * (`finance-expenses`) e o arquivado de cada mês que as duas semanas tocam.
 * `extras` = a lista que a tela já tem na mão (entra primeiro); repetido pelo
 * id só conta uma vez (na virada o mesmo gasto pode estar nos dois baldes).
 */
/** O que o desafio lê de um gasto variável (o resto do registro passa intacto). */
export type GastoDoDesafio = { id?: string; date?: string; value?: unknown; category?: string; description?: string; perfil?: string };

export const gastosParaDesafio = (
  ler: (chave: string) => unknown,
  weekStart: string,
  perfil: string,
  extras: GastoDoDesafio[] = [],
): GastoDoDesafio[] => {
  const datas = [...weekDates(segundaAnterior(weekStart)), ...weekDates(weekStart)];
  const meses = [...new Set(datas.map((d) => d.slice(0, 7)))];
  const chaves = ["finance-expenses", ...meses.map((m) => chaveArquivada(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, "expenses"))];
  const vistos = new Set<string>();
  const saida: GastoDoDesafio[] = [];
  const somar = (bruto: unknown) => {
    if (!bruto || typeof bruto !== "object") return;
    const e = bruto as GastoDoDesafio;
    const id = e.id != null ? `id:${e.id}` : `sem-id:${e.date}|${e.value}|${e.description}`;
    if (vistos.has(id)) return;
    vistos.add(id);
    saida.push(e);
  };
  extras.forEach(somar);
  for (const chave of chaves) {
    const lista = ler(chave);
    if (Array.isArray(lista)) doPerfil(lista as GastoDoDesafio[], perfil).forEach(somar);
  }
  return saida;
};

/** Avalia `def` na semana de `weekStart` vista de `hoje`. Semana que já acabou conta os 7 dias. */
export const avaliarDesafio = (def: ChallengeDef, weekStart: string, gastos: GastoDoDesafio[], hoje: Date = new Date()): ChallengeStatus => {
  const dias = weekDates(weekStart);
  const hojeStr = diaLocal(hoje);
  const elapsedDays = hojeStr > dias[6] ? 7 : Math.min(Math.max(dias.indexOf(hojeStr) + 1, 1), 7);
  const semana = new Set(dias);
  const anterior = new Set(weekDates(segundaAnterior(weekStart)));
  const weekExpenses = gastos.filter((e) => semana.has(e?.date ?? ""));
  const prevWeekTotal = gastos.filter((e) => anterior.has(e?.date ?? "")).reduce((s, e) => s + (Number(e?.value) || 0), 0);
  return def.evaluate({ weekExpenses, prevWeekTotal, elapsedDays });
};

/**
 * Fecha o desafio de uma semana que já passou, AVALIANDO a semana inteira:
 * cumpriu → "win", não cumpriu → "loss". Já tem resultado daquela semana
 * (a vitória do meio da semana, gravada pelo card) → só libera pra escolher
 * outro. `null` = nada a fazer (sem desafio, ou é o da semana de agora).
 */
export const fecharSemanaDoDesafio = (
  estado: unknown,
  gastosDa: (weekStart: string) => GastoDoDesafio[],
  hoje: Date = new Date(),
): ChallengesState | null => {
  const s = lerDesafios(estado);
  const ativo = s.active;
  if (!ativo || ativo.weekStart >= mondayOf(hoje)) return null;
  if (s.history.some((h) => h.weekStart === ativo.weekStart && h.key === ativo.key)) return { active: null, history: s.history };
  const def = challengeByKey(ativo.key);
  const ev = def ? avaliarDesafio(def, ativo.weekStart, gastosDa(ativo.weekStart), hoje) : null;
  return { active: null, history: [...s.history, { key: ativo.key, weekStart: ativo.weekStart, result: ev?.done ? "win" : "loss" }] };
};
