// Seeds de demonstração para o modo /preview/:modulo.
// Cada entrada é um snapshot in-memory pra dar a sensação de app cheio.
// Adicionar mais chaves aqui = preview mais rico.

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
  financas: {
    ...COMMON,
    "finance-incomes": [
      { id: "1", source: "Salário", value: 5000, day: 5 },
      { id: "2", source: "Freelance", value: 1200, day: 20 },
    ],
    "finance-fixed-expenses": [
      { id: "1", name: "Aluguel", value: 1500, day: 10 },
      { id: "2", name: "Internet", value: 120, day: 15 },
      { id: "3", name: "Academia", value: 99, day: 5 },
    ],
    "finance-expenses": [
      { id: "1", name: "Mercado", value: 420, category: "Alimentação", date: daysAgo(2) },
      { id: "2", name: "Uber", value: 38, category: "Transporte", date: daysAgo(1) },
      { id: "3", name: "Cinema", value: 60, category: "Lazer", date: daysAgo(4) },
    ],
    "finance-investments": [
      { id: "1", name: "Tesouro Selic", value: 8000, type: "Renda Fixa" },
      { id: "2", name: "ITSA4", value: 2500, type: "Ações" },
    ],
    "finance-goals": [
      { id: "1", name: "Reserva de emergência", target: 15000, current: 6200 },
      { id: "2", name: "Viagem Japão", target: 12000, current: 1800 },
    ],
  },
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
    "core-saude-water-goal": 2500,
    "core-saude-water": {
      [iso(today)]: 1500,
      [daysAgo(1)]: 2500,
      [daysAgo(2)]: 2200,
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
      { id: "1", name: "Reduzir açúcar", startDate: daysAgo(12), streak: 12 },
      { id: "2", name: "Largar redes sociais à noite", startDate: daysAgo(5), streak: 5 },
    ],
  },
};

export const getSeedsForModule = (moduleKey: string): Record<string, any> => {
  return PREVIEW_SEEDS[moduleKey] ?? { ...COMMON };
};
