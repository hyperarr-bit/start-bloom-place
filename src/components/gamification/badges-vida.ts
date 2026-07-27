import { Badge } from "./types";

/**
 * Conquistas dos módulos de VIDA (27/07).
 *
 * Por que existiam só as de finanças: sobra do pivô de julho. O resultado é
 * que quem usa o CORE pra rotina, leitura e treino abria /conquistas e via 24
 * insígnias de dinheiro — nenhuma delas alcançável pelo que a pessoa de fato
 * faz no app. Uma tela de conquistas que não fala do seu esforço desmotiva
 * mais do que não ter tela nenhuma.
 *
 * São 3 por módulo, de propósito. A tentação é encher (o dado permite fazer
 * 50), mas conquista só vale enquanto for escassa: 40 medalhas viram lista de
 * afazeres, e a que a pessoa acabou de ganhar some no meio. Cada trio segue a
 * mesma escada — a de entrada (prova que dá), a de constância (a que muda o
 * comportamento) e a rara (a que dá orgulho de printar).
 *
 * REGRA DURA: conquista nunca pode ser perdida. Por isso tudo aqui é medido
 * por acumulado ou por RECORDE histórico, nunca por estado atual — senão a
 * pessoa quebraria uma sequência e veria a medalha desaparecer.
 */

type Leitor = <T>(key: string, fallback: T) => T;

/** Progresso explícito: é o que deixa "Próximas conquistas" ser de verdade. */
const fazer = (
  id: string, name: string, description: string, icon: string,
  category: Badge["category"], xp: number, atual: number, alvo: number,
): Badge => ({
  id, name, description, icon, category, xp,
  color: "green",
  unlocked: atual >= alvo,
  progresso: { atual: Math.min(atual, alvo), alvo },
});

const ehDia = (k: unknown) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);

/** Maior sequência de dias consecutivos JÁ ALCANÇADA (recorde, não a atual). */
const recordeDeSequencia = (dias: string[]): number => {
  const ordenados = [...new Set(dias)].sort();
  let melhor = 0, corrente = 0;
  let anterior: number | null = null;
  for (const d of ordenados) {
    const t = new Date(`${d}T12:00:00`).getTime();
    corrente = anterior !== null && Math.round((t - anterior) / 864e5) === 1 ? corrente + 1 : 1;
    if (corrente > melhor) melhor = corrente;
    anterior = t;
  }
  return melhor;
};

export function buildBadgesVida(get: Leitor): Badge[] {
  // ---------- rotina ----------
  const heatmap = get<Record<string, boolean | number>>("heatmap-log", {}) ?? {};
  const diasAtivos = Object.entries(heatmap)
    .filter(([k, v]) => ehDia(k) && (typeof v === "number" ? v > 0 : v === true))
    .map(([k]) => k);
  const recordeRotina = recordeDeSequencia(diasAtivos);

  const diario = get<Record<string, { gratitude?: string[]; learned?: string; tomorrow?: string }>>("journal-entries", {}) ?? {};
  const diasDeDiario = Object.entries(diario).filter(([k, e]) => {
    if (!ehDia(k)) return false;
    const g = Array.isArray(e?.gratitude) ? e.gratitude.filter(Boolean).length : 0;
    return g > 0 || !!e?.learned || !!e?.tomorrow;
  }).length;

  // ---------- leitura ----------
  type Livro = { status?: string; pages?: number };
  const acervo = get<Livro[]>("lib-books", []) ?? [];
  const livros = Array.isArray(acervo) ? acervo : [];
  const terminados = livros.filter((b) => b?.status === "lido").length;

  // ---------- treino ----------
  const treinos = (get<string[]>("saude-workout-log", []) ?? []).filter(ehDia);
  const recordesPessoais = (get<unknown[]>("saude-prs", []) ?? []).length;

  // ---------- dieta ----------
  type DiaDieta = { meals?: Record<string, { followed?: boolean }> };
  const diarioDieta = get<Record<string, DiaDieta>>("dieta-diary-v2", {}) ?? {};
  const diasImpecaveis = Object.entries(diarioDieta).filter(([k, d]) => {
    if (!ehDia(k)) return false;
    const refeicoes = Object.values(d?.meals ?? {});
    return refeicoes.length > 0 && refeicoes.every((m) => m?.followed);
  });
  const recordeDieta = recordeDeSequencia(diasImpecaveis.map(([k]) => k));

  return [
    // ---- Rotina: o módulo onde a constância é o produto ----
    fazer("rotina-1", "Primeiro Dia", "Marque 1 dia na sua rotina", "🌱", "rotina", 50, diasAtivos.length, 1),
    fazer("rotina-7", "Semana Cheia", "7 dias seguidos sem falhar", "📅", "rotina", 100, recordeRotina, 7),
    fazer("rotina-21", "Hábito Formado", "21 dias seguidos — o número que vira hábito", "🔥", "rotina", 200, recordeRotina, 21),
    fazer("diario-7", "Reflexivo", "7 dias de diário escritos", "🪞", "rotina", 100, diasDeDiario, 7),

    // ---- Leitura: o módulo com mais tempo por pessoa no app ----
    fazer("leitura-estante", "Estante Montada", "3 livros na sua biblioteca", "📚", "leitura", 50, livros.length, 3),
    fazer("leitura-1", "Livro Fechado", "Termine 1 livro", "📖", "leitura", 100, terminados, 1),
    fazer("leitura-10", "Devorador", "Termine 10 livros", "🐛", "leitura", 200, terminados, 10),

    // ---- Treino ----
    fazer("treino-1", "Primeiro Treino", "Registre 1 treino", "🏋️", "treino", 50, treinos.length, 1),
    fazer("treino-12", "Ritmo de Academia", "12 treinos registrados", "💪", "treino", 100, treinos.length, 12),
    fazer("treino-pr", "Recordista", "3 recordes pessoais anotados", "🏅", "treino", 200, recordesPessoais, 3),

    // ---- Dieta ----
    fazer("dieta-1", "Dia Impecável", "1 dia com todas as refeições seguidas", "🥗", "dieta", 50, diasImpecaveis.length, 1),
    fazer("dieta-7", "Semana Limpa", "7 dias impecáveis seguidos", "🍎", "dieta", 200, recordeDieta, 7),
  ];
}
