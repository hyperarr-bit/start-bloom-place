import { Badge, Raridade, XP_RARIDADE } from "./types";
import { localDayKey, parseLocalDay } from "@/lib/utils";
import { DIAS, metaPadrao, segundaDe, somarDias as somarDiasData } from "@/lib/treino-constancia";

/**
 * Conquistas dos módulos de VIDA (27/07; coleção ampliada em 27/09).
 *
 * Por que existiam só as de finanças: sobra do pivô de julho. O resultado é
 * que quem usa o CORE pra rotina, leitura e treino abria /conquistas e via 24
 * insígnias de dinheiro — nenhuma delas alcançável pelo que a pessoa de fato
 * faz no app. Uma tela de conquistas que não fala do seu esforço desmotiva
 * mais do que não ter tela nenhuma.
 *
 * Em 27/09 a coleção foi a 65 adesivos com RARIDADE (comum · raro · épico ·
 * lendário — a posição na escada de cada módulo, nunca sorteio). A escassez
 * passou a vir da raridade, não da quantidade: a folha mostra os conquistados
 * e só os 4 mais perto de colar.
 *
 * REGRA DURA: conquista nunca pode ser perdida. Por isso tudo aqui é medido
 * por acumulado ou por RECORDE histórico, nunca por estado atual — senão a
 * pessoa quebraria uma sequência e veria a medalha desaparecer (e o registro
 * em `conquistas-desbloqueadas` garante isso mesmo pras medidas do ano).
 */

type Leitor = <T>(key: string, fallback: T) => T;

/** Progresso explícito: é o que deixa "Próximas conquistas" ser de verdade.
 *  `unidade` (26/09) monta o "falta": ["livro", "livros"] → "mais 1 livro".
 *  As medidas por RECORDE de dias seguidos ficam sem unidade — o "falta" delas
 *  é a descrição, porque "mais 4 dias" só vale pra quem está no recorde. */
const fazer = (
  id: string, name: string, description: string, icon: string,
  category: Badge["category"], raridade: Raridade, atual: number, alvo: number,
  unidade?: [string, string], extra: Partial<Badge> = {},
): Badge => ({
  id, name, description, icon, category, raridade, xp: XP_RARIDADE[raridade],
  color: "green",
  unlocked: atual >= alvo,
  progresso: { atual: Math.max(0, Math.min(atual, alvo)), alvo },
  ...(unidade ? { unidade } : {}),
  ...extra,
});

const ehDia = (k: unknown): k is string => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);

/** Maior sequência de dias consecutivos JÁ ALCANÇADA (recorde, não a atual). */
export const recordeDeSequencia = (dias: string[]): number => {
  const ordenados = [...new Set(dias)].sort();
  let melhor = 0, corrente = 0;
  let anterior: number | null = null;
  for (const d of ordenados) {
    const t = parseLocalDay(d).getTime();
    corrente = anterior !== null && Math.round((t - anterior) / 864e5) === 1 ? corrente + 1 : 1;
    if (corrente > melhor) melhor = corrente;
    anterior = t;
  }
  return melhor;
};

const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** Dias "AAAA-MM-DD" de um registro { dia: valor } cujo valor passa no teste. */
const diasDe = (reg: unknown, ok: (v: unknown) => boolean = (v) => !!v): string[] =>
  Object.entries(objeto(reg)).filter(([k, v]) => ehDia(k) && ok(v)).map(([k]) => k);
/** Dias distintos de uma lista de registros com `date`. */
const diasDaLista = (v: unknown): number => new Set(lista(v).map((e) => (e as { date?: unknown })?.date).filter(ehDia)).size;

/**
 * Semanas (segunda a domingo) seguidas batendo a meta de treinos, contando
 * da semana corrente pra trás: a corrente entra se já bateu; sem bater ainda,
 * a corrida continua viva pelas semanas fechadas anteriores.
 */
export const semanasSeguidasNaMeta = (treinos: string[], meta: number, hoje: string): number => {
  if (meta < 1) return 0;
  const porSemana = new Map<string, number>();
  for (const d of new Set(treinos)) {
    const seg = localDayKey(segundaDe(parseLocalDay(d)));
    porSemana.set(seg, (porSemana.get(seg) ?? 0) + 1);
  }
  const segAtual = localDayKey(segundaDe(parseLocalDay(hoje)));
  let n = (porSemana.get(segAtual) ?? 0) >= meta ? 1 : 0;
  let cursor = localDayKey(somarDiasData(parseLocalDay(segAtual), -7));
  for (let i = 0; i < 60 && (porSemana.get(cursor) ?? 0) >= meta; i++) {
    n++;
    cursor = localDayKey(somarDiasData(parseLocalDay(cursor), -7));
  }
  return n;
};

/** As medidas de vida que os adesivos e as insígnias usam. */
export function medirVida(get: Leitor, hoje: string = localDayKey()) {
  // ---------- rotina ----------
  const diasAtivos = diasDe(get<unknown>("heatmap-log", {}), (v) => (typeof v === "number" ? v > 0 : v === true));
  const recordeRotina = recordeDeSequencia(diasAtivos);

  type Entrada = { gratitude?: string[]; learned?: string; tomorrow?: string } | null;
  const diario = objeto(get<unknown>("journal-entries", {})) as Record<string, Entrada>;
  const diasDeDiario = Object.entries(diario).filter(([k, e]) => {
    if (!ehDia(k)) return false;
    const g = Array.isArray(e?.gratitude) ? e.gratitude.filter(Boolean).length : 0;
    return g > 0 || !!e?.learned || !!e?.tomorrow;
  }).length;

  // humor mora em 3 chaves (Rotina, Home, Dev. Pessoal) — um dia conta uma vez
  const diasDeHumor = new Set([
    ...diasDe(get<unknown>("mood-log", {})),
    ...diasDe(get<unknown>("core-mood-log", {})),
    ...diasDe(get<unknown>("dp-mood-log", {})),
  ]).size;
  const minutosDeFoco = Math.max(0, Number(get<unknown>("pomodoro-total-focus", 0)) || 0);

  // ---------- leitura ----------
  type Livro = { status?: string; pages?: number; endDate?: string };
  const livros = lista(get<unknown>("lib-books", [])) as Livro[];
  const terminados = livros.filter((b) => b?.status === "lido").length;
  const ano = hoje.slice(0, 4);
  const lidosNoAno = livros.filter((b) => b?.status === "lido" && typeof b.endDate === "string" && b.endDate.startsWith(ano)).length;
  const metaDoAno = Math.min(365, Math.max(1, Math.round(Number(get<unknown>("lib-year-goal", 12)) || 12)));
  const diasDeLeitura = new Set(lista(get<unknown>("lib-read-log", [])).filter(ehDia)).size;

  // ---------- treino ----------
  const treinos = [...new Set(lista(get<unknown>("saude-workout-log", [])).filter(ehDia))];
  const recordesPessoais = lista(get<unknown>("saude-prs", [])).length;
  const metaSalva = Number(get<unknown>("treino-meta-semanal", null));
  const diasDoPlano = lista(get<unknown>("treino-active-days", [])).filter((d): d is string => typeof d === "string" && DIAS.includes(d));
  const metaSemanal = Math.min(7, Math.max(1, Math.round(metaSalva) || metaPadrao(diasDoPlano)));
  const semanasNaMeta = semanasSeguidasNaMeta(treinos, metaSemanal, hoje);

  // ---------- dieta ----------
  type DiaDieta = { meals?: Record<string, { followed?: boolean }> };
  const diarioDieta = objeto(get<unknown>("dieta-diary-v2", {})) as Record<string, DiaDieta>;
  const diasImpecaveis = Object.entries(diarioDieta).filter(([k, d]) => {
    if (!ehDia(k)) return false;
    const refeicoes = Object.values(d?.meals ?? {});
    return refeicoes.length > 0 && refeicoes.every((m) => m?.followed);
  }).map(([k]) => k);
  const recordeDieta = recordeDeSequencia(diasImpecaveis);
  const receitas = lista(get<unknown>("dieta-recipes-v2", [])).length;

  // ---------- saúde: água (26/09 — o adesivo da gota do Fable) ----------
  // Dia "em dia" = copos do dia ≥ meta (a mesma meta que a Hidratação usa).
  const metaAgua = Math.min(20, Math.max(1, Math.round(Number(get<unknown>("core-saude-water-goal", 8)) || 8)));
  const diasDeAgua = diasDe(get<unknown>("water-log", {}), (v) => Number(v) >= metaAgua).length;

  // sono: o registro mora em 2 chaves (Rotina e Saúde) — vale a maior do dia
  const metaSono = Math.min(12, Math.max(4, Number(get<unknown>("core-saude-sleep-goal", 8)) || 8));
  const horasPorNoite = new Map<string, number>();
  for (const reg of [get<unknown>("sleep-log", {}), get<unknown>("core-saude-sleep", {})]) {
    for (const [k, v] of Object.entries(objeto(reg))) if (ehDia(k)) horasPorNoite.set(k, Math.max(horasPorNoite.get(k) ?? 0, Number(v) || 0));
  }
  const noitesNaMeta = [...horasPorNoite.values()].filter((h) => h >= metaSono).length;
  const diasDeRemedio = diasDe(get<unknown>("core-saude-supplement-log", {}), (v) => Array.isArray(v) && v.length > 0).length;
  const medicoes = lista(get<unknown>("core-saude-measures", [])).length;

  // ---------- vida (metas, carta, pet, momentos, detox, estudos) ----------
  type Periodo = { items?: { done?: boolean }[] };
  const linhaDoTempo = objeto(get<unknown>("goals-timeline", {})) as Record<string, Periodo>;
  const metasConcluidas = Object.values(linhaDoTempo).reduce((s, p) => s + lista(p?.items).filter((i) => !!(i as { done?: boolean })?.done).length, 0);
  const carta = objeto(get<unknown>("dp-future-letter", {})) as { text?: unknown };
  const cartaEscrita = typeof carta.text === "string" && carta.text.trim().length > 0;
  const registrosDoPet = lista(get<unknown>("pet-diary", [])).length;
  const momentos = lista(get<unknown>("rel-moments", [])).length;
  const diasDeDetox = diasDaLista(get<unknown>("detox-diary", []));
  const revisoes = Object.values(objeto(get<unknown>("estudos-revisoes", {}))).filter((e) => (Number((e as { vezes?: unknown })?.vezes) || 0) >= 1).length;

  return {
    diasAtivos, recordeRotina, diasDeDiario, diasDeHumor, minutosDeFoco,
    livros, terminados, lidosNoAno, metaDoAno, diasDeLeitura,
    treinos, recordesPessoais, metaSemanal, semanasNaMeta,
    diasImpecaveis, recordeDieta, receitas,
    metaAgua, diasDeAgua, noitesNaMeta, diasDeRemedio, medicoes,
    metasConcluidas, cartaEscrita, registrosDoPet, momentos, diasDeDetox, revisoes,
  };
}

export function buildBadgesVida(get: Leitor, hoje: string = localDayKey()): Badge[] {
  const m = medirVida(get, hoje);
  const rota = (caminho: string, nome: string) => ({ rota: { caminho, nome } });

  return [
    // ---- Rotina: o módulo onde a constância é o produto ----
    fazer("rotina-1", "Primeiro Dia", "Marque 1 dia na sua rotina", "🌱", "rotina", "comum", m.diasAtivos.length, 1, ["dia marcado", "dias marcados"]),
    fazer("rotina-7", "Semana Cheia", "7 dias seguidos sem falhar", "📅", "rotina", "raro", m.recordeRotina, 7),
    fazer("rotina-21", "Hábito Formado", "21 dias seguidos — o número que vira hábito", "🔥", "rotina", "epico", m.recordeRotina, 21),
    fazer("rotina-60", "Rotina de Ferro", "60 dias seguidos de rotina", "🛡️", "rotina", "lendario", m.recordeRotina, 60),
    fazer("diario-7", "Reflexivo", "7 dias de diário escritos", "✨", "rotina", "raro", m.diasDeDiario, 7, ["dia de diário", "dias de diário"]),
    fazer("humor-7", "Humor em Dia", "7 dias anotando como você está", "🙂", "rotina", "comum", m.diasDeHumor, 7, ["dia com humor anotado", "dias com humor anotado"]),
    fazer("foco-10h", "Foco Total", "10 horas de foco no pomodoro", "🍅", "rotina", "raro", m.minutosDeFoco, 600, undefined, { formato: "minutos" }),

    // ---- Leitura: o módulo com mais tempo por pessoa no app ----
    fazer("leitura-estante", "Estante Montada", "3 livros na sua biblioteca", "📚", "leitura", "comum", m.livros.length, 3, ["livro na estante", "livros na estante"]),
    fazer("leitura-1", "1º Livro Lido", "Termine 1 livro", "📖", "leitura", "raro", m.terminados, 1, ["livro terminado", "livros terminados"]),
    fazer("leitura-10", "Devorador", "Termine 10 livros", "🐛", "leitura", "epico", m.terminados, 10, ["livro terminado", "livros terminados"]),
    fazer("leitura-25", "Biblioteca Viva", "Termine 25 livros", "🏛️", "leitura", "lendario", m.terminados, 25, ["livro terminado", "livros terminados"]),
    fazer("leitura-30", "Maratona de Leitura", "30 dias com leitura marcada", "🔖", "leitura", "raro", m.diasDeLeitura, 30, ["dia de leitura", "dias de leitura"]),
    fazer("meta-ano", "Meta do Ano", `Bata a meta de livros do ano (${m.metaDoAno})`, "🎯", "leitura", "epico", m.lidosNoAno, m.metaDoAno, ["livro lido no ano", "livros lidos no ano"]),

    // ---- Treino ----
    fazer("treino-1", "Primeiro Treino", "Registre 1 treino", "🏋️", "treino", "comum", m.treinos.length, 1, ["treino", "treinos"]),
    fazer("treino-12", "Ritmo de Academia", "12 treinos registrados", "💪", "treino", "raro", m.treinos.length, 12, ["treino", "treinos"]),
    fazer("treino-50", "Máquina", "50 treinos registrados", "⚙️", "treino", "epico", m.treinos.length, 50, ["treino", "treinos"]),
    fazer("treino-100", "Lenda da Academia", "100 treinos registrados", "🏆", "treino", "lendario", m.treinos.length, 100, ["treino", "treinos"]),
    fazer("treino-pr", "Recordista", "3 recordes pessoais anotados", "🏅", "treino", "epico", m.recordesPessoais, 3, ["recorde pessoal", "recordes pessoais"]),
    fazer("meta-semanal-4", "Mês Completo", `4 semanas seguidas batendo a meta (${m.metaSemanal}× por semana)`, "📆", "treino", "epico", m.semanasNaMeta, 4, ["semana na meta", "semanas na meta"]),

    // ---- Dieta ----
    fazer("dieta-1", "Dia Impecável", "1 dia com todas as refeições seguidas", "🥗", "dieta", "comum", m.diasImpecaveis.length, 1, ["dia impecável", "dias impecáveis"]),
    fazer("dieta-7", "Semana Limpa", "7 dias impecáveis seguidos", "🍎", "dieta", "epico", m.recordeDieta, 7),
    fazer("dieta-30", "30 Dias Impecáveis", "30 dias impecáveis no total", "🥇", "dieta", "epico", m.diasImpecaveis.length, 30, ["dia impecável", "dias impecáveis"]),
    fazer("receita-1", "Chef de Casa", "Guarde 1 receita sua", "👩‍🍳", "dieta", "comum", m.receitas, 1, ["receita", "receitas"]),

    // ---- Saúde ----
    fazer("agua-7", "Água em Dia", "7 dias batendo a meta de água", "💧", "saude", "raro", m.diasDeAgua, 7, ["dia com a meta de água", "dias com a meta de água"]),
    fazer("agua-30", "Hidratada", "30 dias batendo a meta de água", "🚰", "saude", "raro", m.diasDeAgua, 30, ["dia com a meta de água", "dias com a meta de água"]),
    fazer("agua-100", "Fonte", "100 dias batendo a meta de água", "⛲", "saude", "epico", m.diasDeAgua, 100, ["dia com a meta de água", "dias com a meta de água"]),
    fazer("sono-7", "Noites Bem Dormidas", "7 noites na meta de sono", "🌙", "saude", "raro", m.noitesNaMeta, 7, ["noite na meta", "noites na meta"]),
    fazer("remedio-7", "Remédio em Dia", "7 dias marcando os remédios", "💊", "saude", "comum", m.diasDeRemedio, 7, ["dia com remédio marcado", "dias com remédio marcado"]),
    fazer("medidas-4", "Evolução Anotada", "4 medições do corpo", "📏", "saude", "comum", m.medicoes, 4, ["medição", "medições"]),

    // ---- Vida: metas, carta, pet, momentos, detox, estudos ----
    fazer("meta-1", "Meta Concluída", "Marque 1 meta da linha do tempo como feita", "🚩", "vida", "raro", m.metasConcluidas, 1, ["meta concluída", "metas concluídas"], rota("/desenvolvimento", "Desenvolvimento")),
    fazer("carta-futuro", "Carta pro Futuro", "Escreva a carta pro seu eu do futuro", "✉️", "vida", "raro", m.cartaEscrita ? 1 : 0, 1, undefined, rota("/desenvolvimento", "Desenvolvimento")),
    fazer("pet-7", "Diário do Pet", "7 registros no diário do pet", "🐾", "vida", "comum", m.registrosDoPet, 7, ["registro", "registros"], rota("/pet", "Pet")),
    fazer("momentos-5", "Álbum de Momentos", "5 momentos guardados", "📸", "vida", "comum", m.momentos, 5, ["momento", "momentos"], rota("/relacionamentos", "Relacionamentos")),
    fazer("detox-7", "Semana Detox", "7 dias no diário do detox", "🌿", "vida", "raro", m.diasDeDetox, 7, ["dia de diário", "dias de diário"], rota("/detox", "Detox")),
    fazer("estudos-revisao-1", "Revisão Feita", "Responda 1 revisão dos estudos", "🧠", "vida", "comum", m.revisoes, 1, ["revisão", "revisões"], rota("/estudos", "Estudos")),
  ];
}
