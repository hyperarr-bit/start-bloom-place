// Seeds de demonstração para o modo /preview/:modulo.
// Cada entrada é um snapshot in-memory pra dar a sensação de app cheio.
// Adicionar mais chaves aqui = preview mais rico.
import { FINANCAS_SEED } from "./preview-seeds-financas";
import { localDayKey, semanaAtualId } from "./utils";

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
    // Semana coerente com o "41 dias seguidos" (26/09): da segunda até ontem
    // com hábitos feitos, hoje pela metade, o resto em branco. E com o carimbo
    // da semana — sem ele a Rotina descarta a grade (é o que impede o check da
    // semana passada de ressuscitar) e a demo abria com a grade toda vazia.
    "rotina-habits-checked": (() => {
      const dias = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
      const feitos = [
        [true, true, false, true, true, true], [true, true, true, true, false, true],
        [true, false, true, true, true, false], [true, true, true, false, true, true],
        [true, true, false, true, true, false], [true, false, true, true, false, true],
        [true, true, true, true, true, false],
      ];
      const hoje = (today.getDay() + 6) % 7;
      return Object.fromEntries(dias.map((d, i) => [d, i < hoje ? feitos[i] : i === hoje ? [true, true, false, false, false, false] : Array(6).fill(false)]));
    })(),
    "rotina-habits-week": semanaAtualId(),
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
  // TREINO (26/09, redesenho aprovado em mockup): a demo é tela de VENDA e pode
  // ser aberta em qualquer dia — então a semana é montada a partir de HOJE.
  // Hoje é sempre "Peito + Tríceps" com o supino fechado 4×10 há 7 dias (a
  // "última vez" em cinza + o post-it "Sobe pra 52,5 kg?") e duas séries já
  // marcadas; 12 semanas de histórico série por série, com as antigas mais
  // fracas e as 5 últimas na meta (🔥 5 sem); ombros sem treino há 15 dias
  // (o post-it do grupo esquecido).
  treino: (() => {
    const DIAS = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
    const idxHoje = (today.getDay() + 6) % 7;
    type Treino = { musculos: string[]; forca: [string, number, number | string, number, number, number?][]; cardio?: [string, string, string][] };
    // [nome, séries, reps, carga de 12 semanas atrás, carga de agora, sessões no platô]
    const TREINOS: Record<string, Treino> = {
      pernas: { musculos: ["Quadríceps", "Pernas"], forca: [["Agachamento livre", 4, 8, 60, 80], ["Leg press 45°", 4, 12, 140, 180], ["Cadeira extensora", 3, 12, 35, 45], ["Mesa flexora", 3, 12, 30, 40], ["Panturrilha em pé", 4, 15, 40, 50]] },
      costas: { musculos: ["Costas", "Bíceps"], forca: [["Puxada frente", 4, 10, 45, 55], ["Remada curvada", 4, 10, 40, 45, 4], ["Remada baixa", 3, 12, 40, 50], ["Rosca direta", 3, 12, 10, 14]] },
      ombros: { musculos: ["Ombros", "Abdômen"], forca: [["Desenvolvimento com halteres", 4, 10, 12, 18], ["Elevação lateral", 3, 12, 6, 9], ["Prancha", 3, "40s", 0, 0], ["Abdominal infra", 3, 15, 0, 0]] },
      peito: { musculos: ["Peito", "Tríceps"], forca: [["Supino reto", 4, 10, 40, 50], ["Crucifixo inclinado", 3, 12, 10, 14], ["Tríceps corda", 3, 12, 20, 25]] },
      cardio: { musculos: ["Cardio"], forca: [], cardio: [["Esteira inclinada", "30", "3 km"], ["Bike", "15", "5 km"]] },
    };
    // o padrão da semana contado a partir de hoje (posição 5 = hoje = peito)
    const PADRAO: (string | null)[] = ["pernas", null, "costas", null, "ombros", "peito", "cardio"];
    const doDia = (i: number) => PADRAO[(i - idxHoje + 12) % 7];
    const kg = (n: number) => (n ? `${String(n).replace(".", ",")}kg` : "");
    const plano: Record<string, { muscles: string[]; exercises: Record<string, unknown>[] }> = {};
    DIAS.forEach((d, i) => {
      const t = doDia(i) ? TREINOS[doDia(i) as string] : null;
      plano[d] = t
        ? {
            muscles: t.musculos,
            exercises: [
              ...t.forca.map(([name, sets, reps, , ate]) => ({ name, sets: String(sets), reps: String(reps), carga: kg(ate), done: false, obs: "" })),
              ...(t.cardio ?? []).map(([name, duracao, distancia]) => ({ name, sets: "", reps: "", carga: "", done: false, obs: "", tipo: "cardio", duracao, distancia })),
            ],
          }
        : { muscles: [], exercises: [] };
    });

    // Sessões dos últimos 84 dias. Semana (segunda a domingo) contada de trás
    // pra frente: 0 = a atual. Semana 6 fraca (quebra a sequência antes das 5
    // últimas); 7–11 com adesão de quem está começando.
    const segundaDeHoje = new Date(today.getFullYear(), today.getMonth(), today.getDate() - idxHoje);
    const semanaDe = (d: Date) => Math.round((segundaDeHoje.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime()) / (7 * 86_400_000));
    const FICA: Record<number, string[]> = { 6: ["pernas", "peito"], 7: ["pernas", "costas", "peito"], 8: ["pernas"], 9: ["pernas", "costas", "ombros", "peito"], 10: ["pernas", "peito"], 11: ["pernas", "costas", "peito"] };
    const sessoes: { n: number; data: string; dia: string; treino: string }[] = [];
    for (let n = 84; n >= 1; n--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
      const i = (d.getDay() + 6) % 7;
      const treino = doDia(i);
      if (!treino) continue;
      const w = semanaDe(d);
      if (w > 11) continue;
      if (treino === "ombros" && n <= 9) continue;
      if (FICA[w] && !FICA[w].includes(treino)) continue;
      sessoes.push({ n, data: iso(d), dia: DIAS[i], treino });
    }

    const historico: Record<string, unknown>[] = [];
    const volume: Record<string, number> = {};
    const meta: Record<string, { dia: string; minutos: number; musculos: string[] }> = {};
    const porExercicio: Record<string, number> = {};
    const totalDoExercicio: Record<string, number> = {};
    sessoes.forEach((s) => TREINOS[s.treino].forca.forEach(([nome]) => { totalDoExercicio[nome] = (totalDoExercicio[nome] ?? 0) + 1; }));
    const passo = (c: number) => (c < 20 ? 1 : 2.5);
    sessoes.forEach((s) => {
      const t = TREINOS[s.treino];
      let vol = 0;
      t.forca.forEach(([nome, sets, reps, de, ate, plato = 2]) => {
        const j = porExercicio[nome] ?? 0;
        porExercicio[nome] = j + 1;
        // sobe em linha até `plato` sessões antes do fim e fica ali (a última fecha)
        const ate100 = Math.max(1, totalDoExercicio[nome] - plato);
        const cargaNa = (x: number) => {
          const bruto = de + (ate - de) * Math.min(1, Math.max(0, x) / ate100);
          return Math.round(bruto / passo(bruto)) * passo(bruto);
        };
        const carga = cargaNa(j);
        const subiu = j > 0 && carga > cargaNa(j - 1);
        const r = typeof reps === "number" ? reps : parseInt(reps, 10);
        // carga que acabou de subir: as últimas séries caem; carga repetida: fecha todas
        const lista = Array.from({ length: sets }, (_, k) => ({ carga, reps: subiu && k >= sets - 2 ? r - (k - sets + 3) : r }));
        vol += lista.reduce((a, x) => a + x.carga * x.reps, 0);
        const melhor = lista.reduce((m, x) => (x.carga > m.carga || (x.carga === m.carga && x.reps > m.reps) ? x : m), lista[0]);
        historico.push({ date: s.data, exercise: nome, sets: String(sets), reps: String(melhor.reps), carga: kg(melhor.carga), obs: "", series: lista });
      });
      (t.cardio ?? []).forEach(([nome, duracao, distancia]) => {
        historico.push({ date: s.data, exercise: nome, sets: "", reps: "", carga: "", obs: "", tipo: "cardio", duracao, distancia });
      });
      volume[s.data] = vol;
      meta[s.data] = { dia: s.dia, minutos: s.treino === "cardio" ? 45 : 42 + ((s.n * 7) % 17), musculos: t.musculos };
    });
    historico.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const ultimaDePeito = sessoes.filter((s) => s.treino === "peito").pop();
    const ultimaDePernas = sessoes.filter((s) => s.treino === "pernas").pop();

    return {
      ...COMMON,
      // conta "viva" não vê a dica de primeira abertura em cima do treino
      "core-tip-seen-treino": "true",
      "saude-workouts-v2": plano,
      "treino-active-days": DIAS.filter((_, i) => doDia(i)),
      "treino-meta-semanal": 4,
      "treino-descanso-padrao": 90,
      // sem o carimbo da semana a virada zeraria os ✓ no primeiro mount
      "treino-semana-dos-checks": semanaAtualId(),
      "saude-workout-log": sessoes.map((s) => s.data),
      "treino-exercise-history": historico,
      "treino-weekly-volume": volume,
      "treino-sessoes": meta,
      "treino-notas-sessoes": {
        ...(ultimaDePeito ? { [ultimaDePeito.data]: "Supino fechou 4×10 limpo. Semana que vem sobe." } : {}),
        ...(ultimaDePernas ? { [ultimaDePernas.data]: "Joelho tranquilo, agachamento até embaixo." } : {}),
      },
      "saude-workout-notes": { [DIAS[idxHoje]]: "Dormi 6h, energia ok. Ombro esquerdo pediu calma no supino." },
      // o treino de hoje já começou: 2 séries do supino feitas, as outras em cinza
      "treino-sessao": {
        data: iso(today),
        dia: DIAS[idxHoje],
        inicio: new Date(Date.now() - 23 * 60_000).toISOString(),
        series: {
          "Supino reto": [
            { carga: 50, reps: 10, feito: true, ok: true },
            { carga: 50, reps: 10, feito: true, ok: true },
            { carga: 50, reps: 10, feito: false },
            { carga: 50, reps: 10, feito: false },
          ],
        },
      },
    };
  })(),
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
    "saude-fast-goal": 16, // 14 não é nenhum dos botões (16/18/20/24)
    // 15/09: substitutos por refeição (11/09) — o "❌ comi outra coisa" vira "Comi: X"
    "dieta-substitutos": {
      Almoço: ["Salada de atum com arroz", "Wrap de frango com folhas"],
      Lanche: ["Banana com pasta de amendoim", "Ovo cozido + fruta"],
      Janta: ["Sopa de legumes com frango"],
    },
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
    // 15/09: exames e documentos (11/09 entraram fotos de exame e receituário)
    "core-saude-exams-v2": [
      { id: "1", name: "Hemograma completo", date: daysAgo(12), time: "07:30", location: "Lab. Central", notes: "Ferritina 48 · Vitamina D 31 — repetir em 6 meses", done: true, fotos: [] },
      { id: "2", name: "Check-up cardiológico", date: daysAgo(-9), time: "09:00", location: "Clínica Vida", notes: "Jejum de 8h", done: false, fotos: [] },
    ],
    "core-saude-documentos": [
      { id: "1", tipo: "receita", titulo: "Receita — Vitamina D 2000UI", date: daysAgo(12), notes: "1 cápsula por dia, com o café. Válida por 6 meses.", fotos: [] },
      { id: "2", tipo: "atestado", titulo: "Atestado — 2 dias", date: daysAgo(30), notes: "Gripe. Entregue no RH.", fotos: [] },
    ],
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
    "hiperfoco-thoughts": {
      [iso(today)]: {
        7: [{ id: "1", text: "Acordei com a ideia de vender pra escolas", tags: ["negócio"], hour: 7 }],
        9: [{ id: "2", text: "Reunião com a Marina: proposta até sexta", tags: ["trabalho"], hour: 9 }],
        13: [{ id: "3", text: "Ideia: ligar o app com a planilha do cliente", tags: ["app"], hour: 13 }],
        20: [{ id: "4", text: "Dia produtivo. Amanhã: responder o Pedro", tags: ["pessoal"], hour: 20 }],
      },
      [daysAgo(1)]: {
        8: [{ id: "5", text: "Treino feito antes do trabalho", tags: ["pessoal"], hour: 8 }],
        15: [{ id: "6", text: "Cliente novo indicado pela Dona Lúcia", tags: ["negócio"], hour: 15 }],
      },
    },
    "mente-dreams": [
      { id: "1", date: `${daysAgo(1)}T06:40:00`, description: "Estava numa casa à beira-mar, organizando caixas que não acabavam nunca. Acordei tranquila.", tags: ["Lúcido"], interpretation: "" },
      { id: "2", date: `${daysAgo(4)}T07:10:00`, description: "Apresentação no trabalho e o projetor não ligava. Todo mundo esperando.", tags: ["Medo"], interpretation: "Semana de entrega, faz sentido." },
    ],
  },
  estudos: {
    ...COMMON,
    // 07/09: demo cheia (antes só COMMON = tela vazia nos stories e na demo guiada)
    "estudos-schedule-name": "Minha grade",
    "estudos-pomodoro-count": 14,
    "estudos-cursos-andamento": [
      { id: "1", name: "Inglês intermediário", notes: "3x por semana, 40 min" },
      // 09/09: "Aula 12 de 30" saiu da nota e virou número (barra + "+1 aula")
      { id: "2", name: "Excel do zero ao avançado", notes: "Certificado até dezembro", aulasFeitas: 12, aulasTotal: 30 },
    ],
    // 09/09 (pedido do dono: "aprendi isso, esse slide é bom por causa disso").
    // Datas recentes pra o tile "Aprendizados · esta semana" acender na demo.
    "estudos-aprendizados": {
      "1": [
        { id: "1001", data: daysAgo(0), referencia: "Unidade 5 · slide 8", aprendi: "Present perfect", porque: "Usar com 'since' e 'for' — 'I have lived here since 2020'." },
        { id: "1002", data: daysAgo(1), referencia: "Unidade 4", aprendi: "'Used to' é hábito do passado que acabou", porque: "Bom pra falar da infância sem enrolar." },
      ],
      "2": [
        { id: "2001", data: daysAgo(2), referencia: "Aula 12 · slide 3", aprendi: "Tabela dinâmica resume milhares de linhas em segundos", porque: "O slide mostra o antes/depois — serve pro relatório de vendas do mês." },
      ],
    },
    "estudos-cursos-desejo": [
      { id: "3", name: "Oratória" },
      { id: "4", name: "Design no Figma" },
    ],
    "estudos-subjects": [
      { id: "1", name: "Present perfect", leitura: true, resumo: true },
      { id: "2", name: "Tabela dinâmica", leitura: true, resumo: false },
      { id: "3", name: "PROCV e XLOOKUP", leitura: false, resumo: false },
    ],
    "estudos-exams": [
      { id: "1", title: "Prova de inglês", date: daysAgo(-6), time: "19:00", color: "bg-blue-500", done: false },
      { id: "2", title: "Entrega do projeto de Excel", date: daysAgo(-13), time: "23:59", color: "bg-green-500", done: false },
    ],
    "estudos-notebooks": [
      { id: "1", date: daysAgo(1), curso: "Inglês", materia: "Present perfect", resumo: "Ações que começaram no passado e continuam agora.", planoLeitura: "Unidade 5", duvidas: "Diferença pro simple past", frases: "I have lived here for 3 years." },
    ],
  },
  carreira: {
    ...COMMON,
    "career-day-phases": [
      { id: "f1", nome: "Prospecção", memo: "", counts: { [iso(today)]: 6, [daysAgo(1)]: 8, [daysAgo(2)]: 5 } },
      { id: "f2", nome: "Follow-up", memo: "", counts: { [iso(today)]: 3, [daysAgo(1)]: 4 } },
      { id: "f3", nome: "Entregas", memo: "", counts: { [iso(today)]: 2, [daysAgo(1)]: 1 } },
    ],
    "career-day-tasks": [
      { id: "1", texto: "Mandar proposta pra Dona Lúcia", feito: true, dia: iso(today) },
      { id: "2", texto: "Ligar pro fornecedor", feito: false, dia: iso(today) },
      { id: "3", texto: "Fechar relatório da semana", feito: false, dia: iso(today) },
    ],
    "career-jobs": [
      { id: "1", company: "Studio Norte", role: "Designer júnior", link: "", status: "entrevista", date: daysAgo(3), salary: "R$ 3.200", notes: "Entrevista quinta às 15h", favorite: true },
      { id: "2", company: "Loja Vida", role: "Vendedor", link: "", status: "aplicado", date: daysAgo(6), salary: "R$ 2.400 + comissão", notes: "", favorite: false },
    ],
    "career-skills": [
      { id: "1", name: "Vendas", category: "soft skill", level: 3, targetLevel: 5, notes: "" },
      { id: "2", name: "Excel", category: "ferramenta", level: 2, targetLevel: 4, notes: "" },
      { id: "3", name: "Inglês", category: "idioma", level: 2, targetLevel: 4, notes: "" },
    ],
    "career-contacts": [
      { id: "1", name: "Marina S.", company: "Studio Norte", role: "Gerente", linkedin: "", email: "", phone: "", notes: "Indicou a vaga", lastContact: daysAgo(2), category: "profissional" },
    ],
    "career-portfolio": [
      { id: "1", title: "Site da padaria do bairro", description: "Landing page feita em uma semana", link: "", category: "projeto", date: daysAgo(20), highlight: true },
    ],
  },
  biblioteca: {
    ...COMMON,
    "lib-books": [
      // 09/09: formato, sinopse e páginas pra demo mostrar os selos novos; e o
      // "lido" ganha data de fim — sem ela a meta do ano ficava em 0/12 na
      // própria demonstração, o mesmo tropeço que um cliente relatou.
      { id: "1", title: "Hábitos Atômicos", author: "James Clear", status: "lendo", progress: 65, format: "ebook", pages: 320, currentPage: 208,
        synopsis: "Como pequenas mudanças diárias, de 1%, se acumulam em resultados grandes. O método dos 4 passos pra criar hábitos bons e largar os ruins." },
      { id: "2", title: "Mindset", author: "Carol Dweck", status: "lido", progress: 100, format: "fisico", pages: 312, currentPage: 312, endDate: daysAgo(40),
        notes: "A ideia central: talento é ponto de partida, não teto. Reler o capítulo sobre elogiar o esforço." },
    ],
  },
  casa: {
    ...COMMON,
    "casa-rooms": [
      { id: "1", name: "Cozinha", color: "bg-yellow-200 dark:bg-yellow-900/40", tasks: [{ id: "1", text: "Limpar a geladeira", done: true }, { id: "2", text: "Trocar o filtro de água", done: false }] },
      { id: "2", name: "Sala", color: "bg-blue-200 dark:bg-blue-900/40", tasks: [{ id: "3", text: "Aspirar o sofá", done: false }, { id: "4", text: "Regar as plantas", done: true }] },
      { id: "3", name: "Quarto", color: "bg-purple-200 dark:bg-purple-900/40", tasks: [{ id: "5", text: "Trocar os lençóis", done: false }] },
      { id: "4", name: "Banheiro", color: "bg-green-200 dark:bg-green-900/40", tasks: [{ id: "6", text: "Repor papel higiênico", done: false }] },
    ],
    "casa-shopping-list": [
      { id: "1", name: "Arroz 5 kg", checked: false, fromPantry: true },
      { id: "2", name: "Ovos", checked: false, fromPantry: false },
      { id: "3", name: "Detergente", checked: true, fromPantry: false },
      { id: "4", name: "Frango", checked: false, fromPantry: false },
    ],
    "casa-maint-tasks": [
      { id: "1", task: "Limpar o ar-condicionado", frequencyMonths: 6, lastDone: daysAgo(150), icon: "❄️" },
      { id: "2", task: "Trocar o filtro do purificador", frequencyMonths: 3, lastDone: daysAgo(80), icon: "💧" },
    ],
  },
  viagens: {
    ...COMMON,
    "travel-bucket": [
      { id: "1", name: "Jericoacoara", country: "Brasil", continent: "América do Sul", notes: "Julho, 7 dias", visited: false, rating: 0, photoUrl: "", priority: "próximo" },
      { id: "2", name: "Buenos Aires", country: "Argentina", continent: "América do Sul", notes: "Feriado de novembro", visited: false, rating: 0, photoUrl: "", priority: "planejando" },
      { id: "3", name: "Lisboa", country: "Portugal", continent: "Europa", notes: "", visited: false, rating: 0, photoUrl: "", priority: "sonho" },
      { id: "4", name: "Chapada dos Veadeiros", country: "Brasil", continent: "América do Sul", notes: "Cachoeira Santa Bárbara", visited: true, rating: 5, photoUrl: "", priority: "próximo" },
    ],
  },
  relacionamentos: {
    ...COMMON,
    "rel-people": [
      { id: "1", name: "Mãe", relation: "Família", birthday: "1965-08-12", notes: "Gosta de orquídea" },
      { id: "2", name: "Ana", relation: "Namorada", birthday: "1998-03-04", notes: "Ama café coado" },
      { id: "3", name: "João", relation: "Amigo", birthday: "1997-11-21", notes: "Aniversário sempre no bar do Zé" },
      { id: "4", name: "Pedro", relation: "Irmão", birthday: "2001-05-09", notes: "" },
      { id: "5", name: "Dona Lúcia", relation: "Cliente", birthday: "", notes: "Sempre pergunta dos filhos" },
    ],
    "rel-dates": [
      { id: "1", title: "Aniversário da mãe", person: "Mãe", date: "2026-08-12", type: "birthday" },
      { id: "2", title: "1 ano de namoro", person: "Ana", date: "2026-09-20", type: "anniversary" },
      { id: "3", title: "Aniversário do João", person: "João", date: "2026-11-21", type: "birthday" },
    ],
    "rel-moments": [
      { id: "1", date: daysAgo(2), person: "Ana", description: "Jantar surpresa em casa" },
      { id: "2", date: daysAgo(9), person: "Mãe", description: "Almoço de domingo com a família toda" },
    ],
    "rel-events": [
      { id: "1", name: "Churrasco do Pedro", date: daysAgo(-5), location: "Casa do Pedro", rsvp: "confirmed", tasks: [{ id: "1", text: "Levar carvão", done: false }] },
    ],
  },
  // 29/09 (Pet refeito): o RG completo, a carteirinha com plano (pet-cuidados), o dia do pet e o peso.
  // As linhas antigas de pet-health ficam no formato de sempre (vaccine/deworming/visit).
  pet: {
    ...COMMON,
    "pet-list": [
      { id: "1", name: "Mel", species: "Cachorro", breed: "Golden", weight: "28", birthday: "2023-04-15", sexo: "femea", castrado: true, porte: "grande", chip: "985112004567890", vetNome: "Dra. Paula" },
      { id: "2", name: "Tom", species: "Gato", breed: "SRD", weight: "4,2", birthday: "2022-10-02", sexo: "macho", castrado: true },
    ],
    "pet-health": [
      { id: "1", petId: "1", type: "vaccine", name: "V10", date: daysAgo(40), nextDate: daysAgo(-325) },
      { id: "2", petId: "1", type: "deworming", name: "Vermífugo", date: daysAgo(70), nextDate: daysAgo(-20) },
      { id: "3", petId: "2", type: "visit", name: "Check-up anual", date: daysAgo(10), nextDate: daysAgo(-355) },
      { id: "4", petId: "1", type: "antipulgas", name: "NexGard", date: daysAgo(32), nextDate: daysAgo(2), cuidadoId: "c-pulga" },
    ],
    "pet-cuidados": [
      { id: "c-pulga", petId: "1", tipo: "antipulgas", nome: "NexGard", intervaloDias: 30 },
      { id: "c-raiva", petId: "1", tipo: "vacina", nome: "Antirrábica", intervaloDias: 365, sugerido: true },
      { id: "c-apoquel", petId: "1", tipo: "remedio", nome: "Apoquel", dose: "1 comp.", horarios: ["20:00"], ate: daysAgo(-6) },
    ],
    "pet-routine-tasks-1": [
      { id: "food", label: "Comida · manhã", emoji: "🥣", hora: "08:00" },
      { id: "walk", label: "Passeio", emoji: "🦮" },
      { id: "water", label: "Água fresca", emoji: "💧" },
      { id: "food-noite", label: "Comida · noite", emoji: "🥣", hora: "19:00" },
    ],
    [`pet-routine-${daysAgo(0)}`]: { "1": { food: true, walk: true } },
    "pet-pesos": { "1": [{ dia: daysAgo(120), kg: 26.8 }, { dia: daysAgo(60), kg: 27.5 }, { dia: daysAgo(5), kg: 28 }] },
    "pet-expenses": [
      { id: "1", petId: "1", category: "Ração", description: "Ração 15 kg", value: 189.9, date: daysAgo(3) },
      { id: "2", petId: "1", category: "Banho", description: "Banho e tosa", value: 80, date: daysAgo(12) },
      { id: "3", petId: "2", category: "Ração", description: "Ração de gato 3 kg", value: 95, date: daysAgo(6) },
    ],
    "pet-diary": [
      { id: "1", petName: "Mel", date: daysAgo(1), text: "Passeio longo no parque, cansou gostoso.", mood: "😄" },
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
