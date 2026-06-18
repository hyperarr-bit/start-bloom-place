// Seeds de demonstração para o modo /preview/:modulo.
// Cada entrada é um snapshot in-memory pra dar a sensação de app cheio.
// Adicionar mais chaves aqui = preview mais rico.
import { FINANCAS_SEED } from "./preview-seeds-financas";

const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return iso(d);
};

const COMMON: Record<string, any> = {
  "core-user-name": "Visitante",
  "core-onboarding-done": "true",
  "spotlight-done-financas": "true",
  "spotlight-done-rotina": "true",
  "spotlight-done-dieta": "true",
  "spotlight-done-treino": "true",
};

export const PREVIEW_SEEDS: Record<string, Record<string, any>> = {
  // Snapshot de conta real → formato 100% compatível com o módulo (sem NaN,
  // sem Invalid Date, aba de Investimentos funcionando).
  financas: { ...COMMON, ...FINANCAS_SEED },
  rotina: {
    ...COMMON,
    "core-rotina-habits": [
      { id: "1", name: "Beber 2L de água", icon: "💧" },
      { id: "2", name: "Treinar", icon: "💪" },
      { id: "3", name: "Ler 20min", icon: "📖" },
    ],
    "core-rotina-habit-log": {
      "1": { [daysAgo(0)]: true, [daysAgo(1)]: true, [daysAgo(2)]: true, [daysAgo(3)]: true },
      "2": { [daysAgo(0)]: true, [daysAgo(2)]: true, [daysAgo(3)]: true },
      "3": { [daysAgo(1)]: true, [daysAgo(2)]: true },
    },
    "todo-list": [
      { id: "1", text: "Pagar boleto da luz", done: false },
      { id: "2", text: "Responder email do cliente", done: true },
      { id: "3", text: "Comprar presente", done: false },
    ],
  },
  treino: {
    ...COMMON,
    "saude-workouts-v2": [
      { id: "1", name: "Peito + Tríceps", day: "Segunda", exercises: [
        { name: "Supino reto", sets: 4, reps: "10" },
        { name: "Tríceps corda", sets: 3, reps: "12" },
      ]},
      { id: "2", name: "Costas + Bíceps", day: "Quarta", exercises: [
        { name: "Puxada frente", sets: 4, reps: "10" },
        { name: "Rosca direta", sets: 3, reps: "12" },
      ]},
    ],
    "treino-active-days": ["Segunda", "Quarta", "Sexta"],
    "saude-workout-log": [daysAgo(0), daysAgo(2), daysAgo(4)],
  },
  dieta: {
    ...COMMON,
    "core-dieta-calories-goal": 2200,
    "core-dieta-meals": [
      { id: "1", name: "Café da manhã", time: "07:30", items: [{ name: "Ovos mexidos", kcal: 220 }, { name: "Pão integral", kcal: 140 }] },
      { id: "2", name: "Almoço", time: "12:30", items: [{ name: "Frango grelhado", kcal: 280 }, { name: "Arroz", kcal: 200 }] },
    ],
    "core-dieta-log": {
      [iso(today)]: { kcal: 1450, water: 1500 },
    },
  },
  saude: {
    ...COMMON,
    "core-saude-water-goal": 8,
    "core-saude-water": {
      [iso(today)]: 5,
      [daysAgo(1)]: 8,
      [daysAgo(2)]: 7,
    },
    "core-saude-sleep": {
      [daysAgo(0)]: 7.5,
      [daysAgo(1)]: 8,
      [daysAgo(2)]: 6.5,
    },
  },
  desenvolvimento: { ...COMMON },
  hiperfoco: {
    ...COMMON,
    "mente-dreams": [
      { id: "1", title: "Viver no exterior por 1 ano", category: "Vida" },
      { id: "2", title: "Lançar meu próprio app", category: "Carreira" },
    ],
  },
  estudos: { ...COMMON },
  carreira: { ...COMMON },
  biblioteca: {
    ...COMMON,
    "lib-books": [
      { id: "1", title: "Hábitos Atômicos", author: "James Clear", status: "lendo", progress: 65 },
      { id: "2", title: "Mindset", author: "Carol Dweck", status: "lido", progress: 100 },
    ],
  },
  casa: { ...COMMON },
  viagens: { ...COMMON },
  relacionamentos: {
    ...COMMON,
    "rel-people": [
      { id: "1", name: "Mãe", relation: "Família" },
      { id: "2", name: "João", relation: "Amigo" },
    ],
    "rel-dates": [
      { id: "1", personId: "1", title: "Aniversário", date: "1965-08-12" },
    ],
  },
  pet: {
    ...COMMON,
    "pet-list": [
      { id: "1", name: "Mel", species: "Cachorro", breed: "Golden", age: 3 },
    ],
  },
  beleza: { ...COMMON },
  detox: {
    ...COMMON,
    "detox-habits": [
      {
        id: "1",
        name: "Largar redes sociais à noite",
        icon: "📱",
        startDate: daysAgo(12),
        relapses: [],
        record: 12,
        checkins: [daysAgo(0), daysAgo(1), daysAgo(2), daysAgo(4)],
        reasons: ["Pela minha saúde mental", "Mais tempo com quem eu amo"],
      },
      {
        id: "2",
        name: "Parar de fumar",
        icon: "🚬",
        startDate: daysAgo(5),
        relapses: [daysAgo(5)],
        record: 23,
        checkins: [daysAgo(0), daysAgo(1), daysAgo(3)],
        reasons: ["Pela minha respiração", "Economizar dinheiro"],
      },
    ],
    "detox-diary": [
      { id: "1", date: daysAgo(1), trigger: "Ansiedade no trabalho", difficulty: 4, note: "Resisti e fui caminhar." },
      { id: "2", date: daysAgo(3), trigger: "Tédio à noite", difficulty: 2, note: "Li um livro no lugar." },
    ],
  },
};

export const getSeedsForModule = (moduleKey: string): Record<string, any> => {
  return PREVIEW_SEEDS[moduleKey] ?? { ...COMMON };
};

// Modules tracked by the Home onboarding (must match Home's ALL_MODULES so the
// tutorial overlay stays suppressed in the demo).
const HOME_ONBOARDING_MODULES = [
  "financas", "rotina", "dieta", "treino", "saude", "metas", "hiperfoco",
  "estudos", "carreira", "biblioteca", "casa", "beleza", "viagens",
  "relacionamentos", "pet", "detox",
];

/**
 * Seeds for the full navigable demo (/demo): every module's snapshot merged
 * into one in-memory store so the Home widgets/score look alive and each
 * module opens populated. Also pre-marks the onboarding flags so the Home
 * tutorial overlay never hijacks the demo.
 */
export const getDemoSeeds = (): Record<string, any> => {
  const merged: Record<string, any> = { ...COMMON };
  for (const key of Object.keys(PREVIEW_SEEDS)) {
    Object.assign(merged, PREVIEW_SEEDS[key]);
  }
  // Skip the guest reset that would wipe the flags below, then mark onboarding
  // as fully done so Home renders straight to the dashboard.
  merged["core-onboarding-reset-v2"] = "true";
  merged["force-new-user-reset-done"] = "true";
  merged["core-onboarding-done"] = "true";
  merged["core-all-modules-celebrated"] = "true";
  HOME_ONBOARDING_MODULES.forEach((m) => {
    merged[`spotlight-done-${m}`] = "true";
  });
  return merged;
};
