/**
 * PLANO DO TREINO (27/09, pedido do dono: "a parte mais importante — configurar
 * o treino e os exercícios — não faz sentido ser esse botãozinho de
 * configuração; tem que ser uma aba de verdade").
 *
 * Funções puras da aba 📋 PLANO: os modelos prontos (que agora já vêm com
 * exercícios — antes só marcavam o grupo muscular e a pessoa ainda tinha que
 * digitar a semana inteira), as sugestões de exercício por grupo e mover um
 * exercício na lista. Nada aqui muda o formato gravado: o plano continua em
 * `saude-workouts-v2` com séries/reps/carga em TEXTO.
 */
import { normalizarNome, type ExercicioDoPlano } from "@/lib/treino-series";
import { DIAS, regiaoDoExercicio } from "@/lib/treino-constancia";

export interface DiaDoPlano {
  muscles: string[];
  exercises: ExercicioDoPlano[];
}

export const GRUPOS_MUSCULARES = [
  "Peito", "Costas", "Ombros", "Bíceps", "Tríceps", "Pernas", "Glúteos",
  "Abdômen", "Quadríceps", "Posterior", "Panturrilha", "Cardio", "Full Body",
];

export const EMOJI_DO_MUSCULO: Record<string, string> = {
  Peito: "🏋️", Costas: "💪", Ombros: "🏋️", "Bíceps": "💪", "Tríceps": "💪",
  Pernas: "🦵", "Glúteos": "🍑", "Abdômen": "🔥", "Quadríceps": "🦵",
  Posterior: "🦵", Panturrilha: "🦵", Cardio: "🏃", "Full Body": "🏋️",
};

export interface ModeloDeTreino {
  name: string;
  emoji: string;
  /** uma linha: quantos dias e a lógica da divisão */
  descricao: string;
  plan: Record<string, string[]>;
}

export const MODELOS: ModeloDeTreino[] = [
  {
    name: "Push / Pull / Legs",
    emoji: "💪",
    descricao: "6 dias · empurrar, puxar e pernas, duas vezes na semana",
    plan: {
      SEGUNDA: ["Peito", "Ombros", "Tríceps"], "TERÇA": ["Costas", "Bíceps"], QUARTA: ["Quadríceps", "Posterior", "Glúteos", "Panturrilha"],
      QUINTA: ["Peito", "Ombros", "Tríceps"], SEXTA: ["Costas", "Bíceps"], "SÁBADO": ["Quadríceps", "Posterior", "Glúteos", "Panturrilha"], DOMINGO: [],
    },
  },
  {
    name: "Upper / Lower",
    emoji: "🏋️",
    descricao: "4 dias · parte de cima e parte de baixo, alternadas",
    plan: {
      SEGUNDA: ["Peito", "Costas", "Ombros", "Bíceps", "Tríceps"], "TERÇA": ["Quadríceps", "Posterior", "Glúteos", "Panturrilha"], QUARTA: [],
      QUINTA: ["Peito", "Costas", "Ombros", "Bíceps", "Tríceps"], SEXTA: ["Quadríceps", "Posterior", "Glúteos", "Panturrilha"], "SÁBADO": [], DOMINGO: [],
    },
  },
  {
    name: "ABC Clássico",
    emoji: "🔥",
    descricao: "6 dias · A peito e tríceps, B costas e bíceps, C ombros e pernas",
    plan: {
      SEGUNDA: ["Peito", "Tríceps"], "TERÇA": ["Costas", "Bíceps"], QUARTA: ["Ombros", "Pernas"],
      QUINTA: ["Peito", "Tríceps"], SEXTA: ["Costas", "Bíceps"], "SÁBADO": ["Ombros", "Pernas"], DOMINGO: [],
    },
  },
  {
    name: "Full Body 3x",
    emoji: "⚡",
    descricao: "3 dias · o corpo todo, com um dia de folga entre eles",
    plan: { SEGUNDA: ["Full Body"], "TERÇA": [], QUARTA: ["Full Body"], QUINTA: [], SEXTA: ["Full Body"], "SÁBADO": [], DOMINGO: [] },
  },
];

export interface SugestaoDeExercicio {
  name: string;
  sets: string;
  reps: string;
  tipo?: "cardio";
  duracao?: string;
}

const f = (name: string, sets: number, reps: number | string): SugestaoDeExercicio => ({ name, sets: String(sets), reps: String(reps) });
const c = (name: string, minutos: number): SugestaoDeExercicio => ({ name, sets: "", reps: "", tipo: "cardio", duracao: String(minutos) });

/** Os exercícios mais comuns de academia por grupo, na ordem em que entram
 *  num treino (o composto primeiro). Carga nunca vem: é de cada um. */
export const EXERCICIOS_POR_GRUPO: Record<string, SugestaoDeExercicio[]> = {
  Peito: [f("Supino reto", 4, 10), f("Supino inclinado", 3, 10), f("Crucifixo", 3, 12), f("Crossover", 3, 12), f("Flexão de braço", 3, 12)],
  Costas: [f("Puxada frente", 4, 10), f("Remada curvada", 4, 10), f("Remada baixa", 3, 12), f("Remada unilateral", 3, 12)],
  Ombros: [f("Desenvolvimento", 4, 10), f("Elevação lateral", 3, 12), f("Elevação frontal", 3, 12), f("Crucifixo invertido", 3, 12)],
  "Bíceps": [f("Rosca direta", 3, 12), f("Rosca martelo", 3, 12), f("Rosca alternada", 3, 12)],
  "Tríceps": [f("Tríceps corda", 3, 12), f("Tríceps testa", 3, 12), f("Tríceps francês", 3, 12)],
  Pernas: [f("Agachamento livre", 4, 8), f("Leg press 45°", 4, 12), f("Cadeira extensora", 3, 12), f("Mesa flexora", 3, 12), f("Panturrilha em pé", 4, 15)],
  "Quadríceps": [f("Agachamento livre", 4, 8), f("Leg press 45°", 4, 12), f("Cadeira extensora", 3, 12), f("Afundo", 3, 10)],
  Posterior: [f("Mesa flexora", 3, 12), f("Stiff", 3, 10), f("Cadeira flexora", 3, 12)],
  "Glúteos": [f("Elevação pélvica", 4, 10), f("Cadeira abdutora", 3, 15), f("Agachamento búlgaro", 3, 10)],
  Panturrilha: [f("Panturrilha em pé", 4, 15), f("Panturrilha sentado", 3, 15)],
  "Abdômen": [f("Prancha", 3, "40s"), f("Abdominal infra", 3, 15), f("Abdominal supra", 3, 20)],
  Cardio: [c("Esteira", 20), c("Bike", 15), c("Elíptico", 15)],
  "Full Body": [f("Agachamento livre", 3, 10), f("Supino reto", 3, 10), f("Remada curvada", 3, 10), f("Desenvolvimento", 3, 10), f("Stiff", 3, 10), f("Prancha", 3, "40s")],
};

/** "Crucifixo" já está coberto por "Crucifixo inclinado" (e vice-versa). */
const jaTem = (existentes: string[], nome: string): boolean => {
  const n = normalizarNome(nome);
  return existentes.some((e) => e === n || e.startsWith(`${n} `) || n.startsWith(`${e} `));
};

/**
 * Sugestões pros grupos do dia, sem repetir o que o dia já tem: um de cada
 * grupo por rodada (Peito + Ombros + Tríceps → 2 de peito, 2 de ombro, 1 de
 * tríceps pra 5) e a saída AGRUPADA por grupo, na ordem em que os grupos foram
 * marcados — que é como se monta treino de academia. Sem grupo marcado, as
 * sugestões de corpo todo.
 */
export const sugestoesDoDia = (musculos: string[], existentes: string[], max = 6): SugestaoDeExercicio[] => {
  const grupos = (musculos.length ? musculos : ["Full Body"]).filter((m, i, l) => l.indexOf(m) === i && EXERCICIOS_POR_GRUPO[m]);
  const usados = existentes.map(normalizarNome).filter(Boolean);
  const escolhidos: SugestaoDeExercicio[][] = grupos.map(() => []);
  const proximo = grupos.map(() => 0);
  let total = 0;
  let achou = true;
  while (total < max && achou) {
    achou = false;
    for (let g = 0; g < grupos.length && total < max; g++) {
      const lista = EXERCICIOS_POR_GRUPO[grupos[g]];
      while (proximo[g] < lista.length && jaTem(usados, lista[proximo[g]].name)) proximo[g]++;
      if (proximo[g] >= lista.length) continue;
      const s = lista[proximo[g]++];
      escolhidos[g].push(s);
      usados.push(normalizarNome(s.name));
      total++;
      achou = true;
    }
  }
  return escolhidos.flat();
};

/** Exercício novo no formato do plano (o `done` e a `obs` de sempre). */
export const exercicioNovo = (nome: string, extra: Partial<ExercicioDoPlano> = {}): ExercicioDoPlano => ({
  name: nome,
  sets: "",
  reps: "",
  carga: "",
  done: false,
  obs: "",
  ...extra,
});

export const exercicioDaSugestao = (s: SugestaoDeExercicio): ExercicioDoPlano =>
  exercicioNovo(s.name, { sets: s.sets, reps: s.reps, ...(s.tipo ? { tipo: s.tipo, duracao: s.duracao ?? "" } : {}) });

/** O treino que um modelo põe num dia vazio: 5 exercícios dos grupos do dia. */
export const exerciciosDoModelo = (musculos: string[]): ExercicioDoPlano[] =>
  musculos.length ? sugestoesDoDia(musculos, [], 5).map(exercicioDaSugestao) : [];

/**
 * Aplica um modelo: cada dia ganha os grupos do modelo e os dias de treino
 * passam a ser os do modelo. Dia que JÁ TEM exercício fica com os dele (como
 * sempre foi); dia de treino vazio ganha os exercícios do modelo.
 */
export const aplicarModelo = (
  plano: Record<string, Partial<DiaDoPlano> | undefined>,
  modelo: ModeloDeTreino,
): { plano: Record<string, DiaDoPlano>; diasAtivos: string[] } => {
  const novo: Record<string, DiaDoPlano> = {};
  const diasAtivos: string[] = [];
  for (const dia of DIAS) {
    const muscles = [...(modelo.plan[dia] ?? [])];
    const atuais = plano[dia]?.exercises ?? [];
    novo[dia] = { muscles, exercises: atuais.length ? atuais : exerciciosDoModelo(muscles) };
    if (muscles.length) diasAtivos.push(dia);
  }
  return { plano: novo, diasAtivos };
};

/** Move um item de `de` pra `para` (fora da lista = não mexe). */
export const moverNaLista = <T,>(lista: T[], de: number, para: number): T[] => {
  if (de === para || de < 0 || para < 0 || de >= lista.length || para >= lista.length) return lista;
  const nova = [...lista];
  const [item] = nova.splice(de, 1);
  nova.splice(para, 0, item);
  return nova;
};

/** Esteira, bike, corrida… já nascem cardio (tempo + distância). */
export const tipoPeloNome = (nome: string): "cardio" | undefined =>
  regiaoDoExercicio(nome) === "cardio" ? "cardio" : undefined;

/** Plano sem nenhum grupo nem exercício em dia nenhum (o módulo "vazio"). */
export const planoVazio = (plano: unknown): boolean => {
  if (!plano || typeof plano !== "object") return true;
  return Object.values(plano as Record<string, Partial<DiaDoPlano> | null | undefined>).every(
    (d) => !(d?.muscles?.length) && !(d?.exercises?.length),
  );
};
