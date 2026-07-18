// Seeds de demonstração para o modo /preview/:modulo.
// Cada entrada é um snapshot in-memory pra dar a sensação de app cheio.
// Adicionar mais chaves aqui = preview mais rico.
import { FINANCAS_SEED } from "./preview-seeds-financas";
import { localDayKey } from "./utils";

const today = new Date();
const iso = (d: Date) => localDayKey(d);
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
  // Seeds "dia 30": a demo tem que parecer uma conta viva há um mês (empty
  // state vende o sonho; aqui vendemos o sonho REALIZADO). As chaves batem
  // com as que os módulos LEEM via usePersistedState — chave errada = demo vazia.
  rotina: {
    ...COMMON,
    "rotina-habits": [
      "Beber 2L de água", "Treinar", "Ler 30min",
      "Meditar 10min", "Dormir até 23h", "Sem celular após 22h",
    ],
    "rotina-habits-checked": {
      SEGUNDA: [true, true, false, true, true, true],
      "TERÇA": [true, true, true, true, false, true],
      QUARTA: [true, false, true, true, true, false],
      QUINTA: [false, false, false, false, false, false],
      SEXTA: [false, false, false, false, false, false],
      "SÁBADO": [false, false, false, false, false, false],
      DOMINGO: [false, false, false, false, false, false],
    },
    "rotina-schedule": {
      "6:00": { Segunda: "Acordar", Terça: "Acordar", Quarta: "Acordar", Quinta: "Acordar", Sexta: "Acordar", Sábado: "Manhã sem pressa", Domingo: "Dia livre 🌿" },
      "7:00": { Segunda: "Ritual pessoal (água, skincare)", Terça: "Ritual pessoal", Quarta: "Manhã mais leve", Quinta: "", Sexta: "", Sábado: "", Domingo: "" },
      "8:00": { Segunda: "Café + organização do dia", Terça: "Café da manhã", Quarta: "", Quinta: "", Sexta: "", Sábado: "Academia", Domingo: "" },
      "9:00": { Segunda: "", Terça: "Finalizar pendências", Quarta: "Academia", Quinta: "Criação / estudos", Sexta: "", Sábado: "", Domingo: "" },
      "10:00": { Segunda: "Academia", Terça: "Academia", Quarta: "", Quinta: "", Sexta: "Finalizar pendências", Sábado: "", Domingo: "" },
      "11:00": { Segunda: "Trabalho", Terça: "Trabalho estratégico", Quarta: "", Quinta: "Ajustes", Sexta: "", Sábado: "", Domingo: "" },
      "12:00": { Segunda: "", Terça: "", Quarta: "Trabalho", Quinta: "", Sexta: "", Sábado: "", Domingo: "" },
      "13:00": { Segunda: "Almoço", Terça: "Almoço", Quarta: "Almoço", Quinta: "", Sexta: "Revisão da semana", Sábado: "", Domingo: "" },
      "14:00": { Segunda: "Reuniões / operacional", Terça: "", Quarta: "", Quinta: "Execução", Sexta: "Reunião", Sábado: "", Domingo: "" },
      "15:00": { Segunda: "Trabalho", Terça: "Operacional / entregas", Quarta: "Vida pessoal / flexível", Quinta: "", Sexta: "", Sábado: "", Domingo: "" },
      "18:00": { Segunda: "Jantar + rotina pessoal", Terça: "", Quarta: "Reuniões", Quinta: "", Sexta: "", Sábado: "", Domingo: "" },
      "19:00": { Segunda: "Tempo livre", Terça: "Tempo livre", Quarta: "", Quinta: "", Sexta: "", Sábado: "", Domingo: "" },
      "20:00": { Segunda: "", Terça: "", Quarta: "Autocuidado", Quinta: "", Sexta: "", Sábado: "", Domingo: "" },
    },
    // Consistência: ~6 semanas de heatmap com streak vivo (o "41 dias" do vídeo).
    "heatmap-log": Object.fromEntries(
      Array.from({ length: 41 }, (_, i) => [daysAgo(i), 1 + ((i * 7) % 3)]),
    ),
    "todo-list": [
      { id: "1", text: "Pagar boleto da luz", priority: "alta", done: false },
      { id: "2", text: "Responder e-mail do cliente", priority: "media", done: true },
      { id: "3", text: "Comprar presente da mãe", priority: "baixa", done: false },
    ],
    "rotina-urgencies": [
      { id: "1", text: "Renovar CNH essa semana", done: false },
    ],
  },
  treino: {
    ...COMMON,
    // Semana espelhando o criativo: segunda completa (5/5), terça pendente.
    "saude-workouts-v2": {
      SEGUNDA: {
        muscles: ["Quadríceps", "Pernas"],
        exercises: [
          { name: "Agachamento Livre", sets: "4", reps: "10", carga: "60kg", done: true, obs: "" },
          { name: "Leg Press 45°", sets: "4", reps: "12", carga: "120kg", done: true, obs: "" },
          { name: "Cadeira Extensora", sets: "3", reps: "12", carga: "40kg", done: true, obs: "" },
          { name: "Afundo com halteres", sets: "3", reps: "10", carga: "16kg", done: true, obs: "" },
          { name: "Panturrilha em pé", sets: "4", reps: "15", carga: "", done: true, obs: "" },
        ],
      },
      "TERÇA": {
        muscles: ["Full Body", "Abdômen"],
        exercises: [
          { name: "Puxada Aberta", sets: "4", reps: "10", carga: "", done: false, obs: "" },
          { name: "Remada Aberta", sets: "4", reps: "10", carga: "", done: false, obs: "" },
          { name: "Desenvolvimento com halteres", sets: "3", reps: "10", carga: "", done: false, obs: "" },
          { name: "Supino reto com halteres", sets: "3", reps: "10", carga: "", done: false, obs: "" },
          { name: "Prancha", sets: "3", reps: "40s", carga: "", done: false, obs: "" },
          { name: "Abdominal infra", sets: "3", reps: "15", carga: "", done: false, obs: "" },
        ],
      },
      QUARTA: {
        muscles: ["Peito", "Tríceps"],
        exercises: [
          { name: "Supino reto", sets: "4", reps: "10", carga: "50kg", done: false, obs: "" },
          { name: "Crucifixo inclinado", sets: "3", reps: "12", carga: "14kg", done: false, obs: "" },
          { name: "Tríceps corda", sets: "3", reps: "12", carga: "25kg", done: false, obs: "" },
        ],
      },
      QUINTA: {
        muscles: ["Costas", "Bíceps"],
        exercises: [
          { name: "Puxada frente", sets: "4", reps: "10", carga: "55kg", done: false, obs: "" },
          { name: "Remada curvada", sets: "4", reps: "10", carga: "40kg", done: false, obs: "" },
          { name: "Rosca direta", sets: "3", reps: "12", carga: "12kg", done: false, obs: "" },
        ],
      },
      SEXTA: {
        muscles: ["Ombros", "Abdômen"],
        exercises: [
          { name: "Desenvolvimento militar", sets: "4", reps: "10", carga: "30kg", done: false, obs: "" },
          { name: "Elevação lateral", sets: "3", reps: "12", carga: "8kg", done: false, obs: "" },
          { name: "Prancha", sets: "3", reps: "45s", carga: "", done: false, obs: "" },
        ],
      },
      // Fim de semana preenchido de leve: a demo pode abrir no sábado —
      // "Dia de descanso" como 1ª tela é empty state que não vende nada.
      "SÁBADO": {
        muscles: ["Cardio", "Abdômen"],
        exercises: [
          { name: "Esteira inclinada", sets: "1", reps: "25min", carga: "", done: false, obs: "" },
          { name: "Prancha", sets: "3", reps: "40s", carga: "", done: false, obs: "" },
          { name: "Abdominal supra", sets: "3", reps: "15", carga: "", done: false, obs: "" },
        ],
      },
      DOMINGO: {
        muscles: ["Cardio"],
        exercises: [
          { name: "Caminhada leve", sets: "1", reps: "30min", carga: "", done: false, obs: "" },
          { name: "Alongamento completo", sets: "1", reps: "10min", carga: "", done: false, obs: "" },
        ],
      },
    },
    "treino-active-days": ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"],
    "saude-workout-log": [daysAgo(0), daysAgo(2), daysAgo(3), daysAgo(5), daysAgo(7), daysAgo(9)],
    "treino-exercise-history": [
      { date: daysAgo(7), exercise: "Agachamento Livre", sets: "4", reps: "10", carga: "55kg" },
      { date: daysAgo(0), exercise: "Agachamento Livre", sets: "4", reps: "10", carga: "60kg", obs: "Subiu 5kg 🎉" },
      { date: daysAgo(7), exercise: "Leg Press 45°", sets: "4", reps: "12", carga: "110kg" },
      { date: daysAgo(0), exercise: "Leg Press 45°", sets: "4", reps: "12", carga: "120kg" },
    ],
  },
  dieta: {
    ...COMMON,
    "dieta-meals-config": ["Café da Manhã", "Almoço", "Lanche", "Janta", "Ceia"],
    // Cardápio semanal preenchido (o mesmo estilo do criativo).
    "saude-meals": (() => {
      const base = {
        "Café da Manhã": "2 ovos mexidos (100g) • 1 fatia de pão integral • 100g de mamão ou melão",
        Almoço: "120g de frango grelhado • 100g de arroz • feijão • 200g de vegetais variados",
        Lanche: "160g de iogurte natural • 100g de morangos • 15g de whey ou aveia",
        Janta: "120g de patinho moído ou tilápia • 150g de abóbora ou batata-doce • salada à vontade",
        Ceia: "150g de melancia • 10g de castanhas ou pasta de amendoim",
      };
      const varTue = { ...base, Almoço: "120g de tilápia grelhada • 100g de arroz integral • salada colorida" };
      const varWed = { ...base, Janta: "Omelete de 3 ovos com queijo • salada de folhas" };
      const weekend = { ...base, Almoço: "Refeição livre 😌 — com consciência", Ceia: "" };
      return {
        SEGUNDA: base, "TERÇA": varTue, QUARTA: varWed, QUINTA: base,
        SEXTA: varTue, "SÁBADO": weekend, DOMINGO: weekend,
      };
    })(),
    "saude-fast-goal": 14,
    "dieta-recipes-v2": [
      { id: "1", name: "Panqueca de banana fit", ingredients: "1 banana, 2 ovos, aveia, canela", instructions: "Amassa, mistura e frigideira em fogo baixo.", category: "Café", favorite: true, prepTime: "10 min", servings: "2" },
      { id: "2", name: "Frango cremoso rápido", ingredients: "Frango desfiado, requeijão light, milho", instructions: "Refoga tudo e finaliza no forno.", category: "Almoço", favorite: false, prepTime: "25 min", servings: "3" },
    ],
  },
  saude: {
    ...COMMON,
    "core-saude-water-goal": 8,
    "core-saude-water": {
      [iso(today)]: 5,
      [daysAgo(1)]: 8,
      [daysAgo(2)]: 7,
      [daysAgo(3)]: 8,
      [daysAgo(4)]: 6,
    },
    "core-saude-sleep-goal": 8,
    "core-saude-sleep": {
      [daysAgo(0)]: 8,
      [daysAgo(1)]: 7.5,
      [daysAgo(2)]: 6.5,
      [daysAgo(3)]: 8,
      [daysAgo(4)]: 7,
    },
    "core-saude-supplements": [
      { id: "1", name: "Vitamina D3 2000UI", time: "08:00", stock: 42 },
      { id: "2", name: "Ômega 3", time: "12:30", stock: 18 },
      { id: "3", name: "Creatina 5g", time: "17:00", stock: 60 },
    ],
    "core-saude-supplement-log": {
      [daysAgo(1)]: ["1", "2", "3"],
      [daysAgo(2)]: ["1", "3"],
    },
    "saude-bmi-height": "178",
    "saude-bmi-weight": "76.4",
  },
  desenvolvimento: {
    ...COMMON,
    "spotlight-done-desenvolvimento": "true",
    "dp-motivations": [
      "Dar uma vida melhor pra minha família",
      "Provar pra mim que eu consigo",
      "Ter liberdade de horário",
    ],
    "dp-affirmations": ["Eu termino o que eu começo", "Um passo por dia me basta"],
    "dp-strengths": ["Criatividade", "Não desisto fácil"],
    "dp-weaknesses": ["Procrastino quando é difícil"],
    "dp-skills": ["Vender", "Escrever bem"],
    "dp-skills-learn": ["Gestão financeira", "Inglês"],
    "dp-values": ["Família", "Honestidade", "Liberdade"],
    "dp-can-control": ["Minha rotina", "Meu esforço"],
    "dp-cant-control": ["A opinião dos outros"],
    "dp-wheel": {
      saude: 7, financas: 5, relacionamentos: 8, carreira: 6,
      espiritualidade: 7, lazer: 4, intelectual: 6, emocional: 6,
    },
    // A meta VIVA: visão + plano com passos (alguns feitos) + pedra no caminho
    "goals-board-v2": [
      {
        id: "g1",
        title: "Abrir meu negócio próprio",
        actionGroups: [
          {
            id: "g1-a", label: "Definir as bases:", tasks: [
              { id: "t1", text: "Validar a ideia com 10 clientes", done: true },
              { id: "t2", text: "Separar R$ 3.000 de capital inicial", done: true },
              { id: "t3", text: "Abrir o MEI", done: false },
            ],
          },
          {
            id: "g1-b", label: "Estruturar o plano:", tasks: [
              { id: "t4", text: "Criar o Instagram do negócio", done: false },
              { id: "t5", text: "Fazer a primeira venda", done: false },
            ],
          },
        ],
        referenceLinks: [], referenceImages: [],
        vision: { meta: "Faturar R$ 5.000/mês", objetivo: "Sair do CLT com segurança", tempo: "12 meses" },
        problems: [{ id: "p1", problem: "Medo de largar a renda fixa", solution: "Validar vendendo enquanto ainda trabalho" }],
      },
      {
        id: "g2",
        title: "Viajar pro Nordeste em dezembro",
        actionGroups: [
          {
            id: "g2-a", label: "Definir as bases:", tasks: [
              { id: "t6", text: "Pesquisar passagens e época", done: true },
              { id: "t7", text: "Guardar R$ 400/mês", done: true },
            ],
          },
        ],
        referenceLinks: [], referenceImages: [],
        vision: { meta: "7 dias em Jericoacoara", objetivo: "Descansar de verdade", tempo: "5 meses" },
        problems: [{ id: "p2", problem: "", solution: "" }],
      },
    ],
    "goals-timeline": {
      "6meses": { items: [{ id: "tl1", text: "Negócio validado e vendendo", done: false }, { id: "tl2", text: "R$ 5.000 guardados", done: false }] },
      "1ano": { items: [{ id: "tl3", text: "Sair do CLT", done: false }] },
      "3anos": { items: [{ id: "tl4", text: "Equipe de 2 pessoas", done: false }] },
      "5anos": { items: [{ id: "tl5", text: "Viver 100% do meu negócio", done: false }] },
    },
    "goals-home": { quote: "Um passo por dia chega em qualquer lugar.", dreamBoard: [] },
    "dp-gratitude": {
      [iso(today)]: ["Acordei cedo e treinei", "Café com minha mãe"],
      [daysAgo(1)]: ["Primeiro 'sim' de um cliente 🎉"],
    },
    "dp-mood-log": { [iso(today)]: 4, [daysAgo(1)]: 5, [daysAgo(2)]: 3, [daysAgo(3)]: 4 },
  },
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
