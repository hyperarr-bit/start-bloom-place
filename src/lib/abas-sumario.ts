/**
 * AS FRASES DO SUMÁRIO (07/11, SPEC novidades-guardadas/2026-11-07/trial-abas/SPEC.md §4). Só o braço "sumario" usa
 * (components/ui/sumario-abas).
 *
 * Regra: no máximo 6 palavras, em minúscula, dizendo SÓ o que a aba já tem. Cada frase foi conferida com o que a tela
 * mostra hoje numa conta vazia (os títulos de cada aba, capturados no build de teste em
 * trial-abas/scripts/spec/telas-por-aba.json) — nada de prometer o que não existe (o erro da "validade da Despensa").
 * Finanças e Casa vêm da SPEC. Aba sem frase aqui aparece no sumário só com o nome (id novo não quebra nada).
 * O teste src/test/abas-caderno.test.tsx trava: ≤ 6 palavras, minúscula, todo id existe no módulo.
 */
export const FRASE_DA_ABA: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  financas: {
    financeiro: "entra, sai, cartão e dívidas",
    dashboard: "o mês em gráficos",
    kit: "o seu kit de 30 dias",
    investimentos: "carteira e aportes",
    itens: "o que você quer comprar",
    simuladores: "juros, financiar ou à vista",
    limites: "um teto por categoria",
    relatorios: "o mês em PDF",
    saude: "sua nota do mês",
  },
  rotina: {
    semana: "hábitos e tarefas de hoje",
    mes: "compromissos em cada dia",
    diario: "diário do dia e humor",
    revisao: "revisão da semana",
    foco: "cronômetro de foco e pausa",
  },
  saude: {
    hoje: "água, remédios e sono",
    evolucao: "fotos e medidas do corpo",
    log: "consultas, exames e documentos",
  },
  treino: {
    hoje: "o treino de hoje",
    plano: "o plano da semana",
    semana: "os treinos da semana",
    evolucao: "recordes e carga",
  },
  dieta: {
    cardapio: "o cardápio da semana",
    diario: "as refeições que você seguiu",
    jejum: "cronômetro de jejum",
    receitas: "suas receitas",
  },
  beleza: {
    routine: "sua rotina de pele",
    hair: "seu cronograma capilar",
    shelf: "seus produtos na prateleira",
    care: "unha, sobrancelha e depilação",
  },
  casa: {
    comodos: "afazeres de cada cômodo",
    mercado: "a lista do mercado",
    despensa: "geladeira, armário e limpeza",
    rotina: "rotina de limpeza da casa",
    cardapio: "o mesmo cardápio da Dieta",
    manutencao: "manutenção, garantias e medidas",
    coop: "moradores e tarefas",
    seguranca: "checklist e estoque de emergência",
    utilidades: "contatos, desapego e consumo",
  },
  biblioteca: {
    lendo: "o livro que você está lendo",
    estante: "todos os seus livros",
    insights: "suas citações",
    emprestados: "livros emprestados",
    desafio: "desafio de leitura do ano",
  },
  desenvolvimento: {
    sobre: "o que te motiva e afirmações",
    metas: "metas e mural dos sonhos",
    diario: "reflexão do dia",
    humor: "humor e nota da semana",
    respiracao: "respiração 4-7-8",
    gratidao: "gratidão do dia",
    carta: "carta pro seu eu do futuro",
    desafios: "desafios de 30 dias",
  },
  estudos: {
    estudos: "cursos e provas",
    metodo: "técnicas de estudo",
    grade: "horário das aulas",
    tarefas: "tarefas da semana",
    caderno: "o que você aprendeu",
  },
  relacionamentos: {
    pessoas: "suas pessoas e aniversários",
    agenda: "as datas do ano",
    presentes: "ideias de presente por pessoa",
    momentos: "momentos com quem você ama",
  },
  detox: {
    rastreador: "o que você quer largar",
    diario: "como foi o dia",
    conquistas: "suas conquistas no detox",
    stats: "recordes e recaídas",
  },
  hiperfoco: {
    dia: "o que pensou em cada hora",
    metas: "metas por prazo",
    ideias: "suas ideias",
    busca: "busca nos seus pensamentos",
    estrategia: "suas estratégias",
    timeline: "os últimos 30 dias",
    sonhos: "diário de sonhos",
  },
  carreira: {
    dia: "tarefas e fases do trabalho",
    jobs: "suas candidaturas",
    portfolio: "projetos e certificados",
    network: "contatos e follow-up",
    skills: "suas habilidades e idiomas",
    interview: "preparação pra entrevista",
  },
  pet: {
    hoje: "os cuidados do dia",
    saude: "vacinas, vermífugo e peso",
    gastos: "os gastos com o pet",
    diario: "momentos do seu pet",
  },
  viagens: {
    destinos: "lugares que sonha conhecer",
    budget: "orçamento da viagem",
    passeios: "passeios do mês",
    cronograma: "roteiro dia a dia",
    mala: "listas de mala",
    divisor: "rachar a conta",
    lugares: "restaurantes, cafés e pontos",
    diario: "diário de viagem",
    moeda: "conversor de moedas",
    seguranca: "ficha de emergência",
    countdown: "contagem pra viagem",
  },
};

export const fraseDaAba = (modulo: string, aba: string): string | undefined => FRASE_DA_ABA[modulo]?.[aba];

/** O título da seção das guardadas. Finanças: PLANEJAR (as 6 foram escolhidas juntas na 1.0.21). */
export const tituloDasGuardadas = (modulo: string): string => (modulo === "financas" ? "PLANEJAR" : "GUARDADAS");
