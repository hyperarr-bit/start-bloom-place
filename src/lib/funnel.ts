/**
 * Dados e helpers compartilhados do funil /comecar.
 * Vivem aqui (e não no Comecar.tsx) porque o PaywallFlow também precisa
 * deles pra personalizar a oferta — e Comecar já importa PaywallFlow.
 */

/** Navegador embutido do Instagram/Facebook/TikTok etc.
 *  O Google BLOQUEIA OAuth nesses webviews ("disallowed_useragent") —
 *  quem clica em "Continuar com Google" ali vê um erro do Google e morre.
 *  Nesses casos o cadastro por e-mail vira o caminho único. */
export const isInAppBrowser = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|MicroMessenger|TikTok|musical_ly/i.test(
    navigator.userAgent,
  );
};

export type QuizOpt = { emoji: string; label: string };
export type QuizQ = { key: string; q: string; opts: QuizOpt[] };

/* ------------------------------------------------------------------ áreas */

/** Funil vitrine (?porta=vida): o criativo vende o app completo ("vida
 *  organizada"), a porta faz a pessoa escolher UMA área — amplitude no
 *  anúncio, especificidade no primeiro toque. `financas` continua sendo o
 *  funil padrão (porta antiga, sem ?porta=vida). */
export type AreaKey = "dinheiro" | "rotina" | "corpo" | "saude" | "metas";

export const AREAS: Record<AreaKey, {
  emoji: string;
  label: string;        // opção na porta
  nome: string;         // nome curto ("Rotina") usado em copy
  module: string;       // módulo do app que a demo/1ª sessão abre
  color: string;        // acento visual (radar/central)
}> = {
  dinheiro: { emoji: "💸", label: "Meu dinheiro", nome: "Dinheiro", module: "financas", color: "hsl(45 85% 45%)" },
  rotina: { emoji: "📅", label: "Minha rotina", nome: "Rotina", module: "rotina", color: "hsl(330 65% 50%)" },
  corpo: { emoji: "💪", label: "Treino e dieta", nome: "Corpo", module: "treino", color: "hsl(255 60% 55%)" },
  saude: { emoji: "❤️", label: "Minha saúde", nome: "Saúde", module: "saude", color: "hsl(0 70% 55%)" },
  // Metas + desenvolvimento pessoal juntos (mesmo módulo). A dor lidera o
  // rótulo ("metas"); "evolução pessoal" é a identidade do criativo.
  metas: { emoji: "🎯", label: "Metas e evolução pessoal", nome: "Metas", module: "desenvolvimento", color: "hsl(215 75% 50%)" },
};

/** Áreas que aparecem na PORTA vitrine, nesta ordem. Saúde saiu da porta
 *  (dor de prevenção não abre porta fria) mas segue viva em todo o resto:
 *  chips da demo, eixo do radar e trilha (quem tem area=saude salvo funciona). */
export const DOOR_AREAS: AreaKey[] = ["dinheiro", "rotina", "corpo", "metas"];

/** Os módulos da demo curada (os 5 do criativo + Metas). */
export const DEMO_MODULES: Array<{ key: string; emoji: string; label: string }> = [
  { key: "rotina", emoji: "📅", label: "Rotina" },
  { key: "financas", emoji: "💸", label: "Finanças" },
  { key: "treino", emoji: "💪", label: "Treino" },
  { key: "dieta", emoji: "🥗", label: "Dieta" },
  { key: "saude", emoji: "❤️", label: "Saúde" },
  { key: "desenvolvimento", emoji: "🎯", label: "Metas" },
];

/** Grade de 16 usada no "vislumbre da central" (só visual, não navega). */
export const ALL_MODULE_ICONS: Array<{ emoji: string; label: string }> = [
  { emoji: "💸", label: "Finanças" }, { emoji: "📅", label: "Rotina" },
  { emoji: "💪", label: "Treino" }, { emoji: "🥗", label: "Dieta" },
  { emoji: "❤️", label: "Saúde" }, { emoji: "🎯", label: "Metas" },
  { emoji: "🧠", label: "Foco" }, { emoji: "📚", label: "Estudos" },
  { emoji: "💼", label: "Carreira" }, { emoji: "📖", label: "Leitura" },
  { emoji: "🏠", label: "Casa" }, { emoji: "✨", label: "Beleza" },
  { emoji: "✈️", label: "Viagens" }, { emoji: "🤝", label: "Relações" },
  { emoji: "🐶", label: "Pet" }, { emoji: "🚭", label: "Detox" },
];

/** Trilhas do quiz por área (funil vitrine). A trilha de dinheiro é o QUIZ
 *  padrão abaixo (5 perguntas + tela de impacto). As demais: 4 perguntas —
 *  2 da área + compromisso + vitória (chaves iguais em todas as trilhas pra
 *  personalização do paywall/app funcionar igual). */
export const AREA_TRACKS: Record<Exclude<AreaKey, "dinheiro">, QuizQ[]> = {
  rotina: [
    {
      key: "atrapalha",
      q: "O que mais bagunça sua rotina hoje?",
      opts: [
        { emoji: "😴", label: "Acordo sem plano nenhum" },
        { emoji: "📱", label: "Perco horas no celular" },
        { emoji: "🌀", label: "Começo mil coisas e não termino" },
        { emoji: "📅", label: "Esqueço tarefas e compromissos" },
        { emoji: "🧹", label: "Quero organizar tudo" },
      ],
    },
    {
      key: "consistencia",
      q: "Quanto tempo você costuma manter um hábito novo?",
      opts: [
        { emoji: "🙃", label: "Uns 3 dias" },
        { emoji: "📆", label: "Uma semana" },
        { emoji: "🌗", label: "Um mês, aí largo" },
        { emoji: "🤷", label: "Nunca consegui manter" },
      ],
    },
    {
      key: "compromisso",
      q: "Topa dedicar 5 minutos por dia pra sua rotina?",
      opts: [
        { emoji: "💪", label: "Sim, topo" },
        { emoji: "🙂", label: "Topo, se for bem simples" },
      ],
    },
    {
      key: "vitoria",
      q: "Qual seria uma vitória nos próximos 7 dias?",
      opts: [
        { emoji: "🔥", label: "Manter um hábito 7 dias seguidos" },
        { emoji: "🌅", label: "Acordar sabendo o que fazer" },
        { emoji: "✅", label: "Uma semana sem esquecer nada" },
        { emoji: "📋", label: "Minha semana inteira num painel" },
      ],
    },
  ],
  corpo: [
    {
      key: "atrapalha",
      q: "O que mais te trava hoje?",
      opts: [
        { emoji: "🏋️", label: "Começo a treinar e desisto" },
        { emoji: "🍔", label: "Como mal e nem percebo" },
        { emoji: "📋", label: "Não tenho plano de treino nem dieta" },
        { emoji: "😩", label: "Falta constância, não vontade" },
        { emoji: "🧹", label: "Quero organizar tudo" },
      ],
    },
    {
      key: "consistencia",
      q: "Quantas vezes você já recomeçou treino ou dieta?",
      opts: [
        { emoji: "🌱", label: "Essa vai ser a primeira" },
        { emoji: "✌️", label: "Umas 2 ou 3" },
        { emoji: "😅", label: "Perdi a conta" },
        { emoji: "🏃", label: "Tô na ativa, mas sem controle" },
      ],
    },
    {
      key: "compromisso",
      q: "Topa dedicar 5 minutos por dia pro seu corpo?",
      opts: [
        { emoji: "💪", label: "Sim, topo" },
        { emoji: "🙂", label: "Topo, se for bem simples" },
      ],
    },
    {
      key: "vitoria",
      q: "Qual seria uma vitória nos próximos 7 dias?",
      opts: [
        { emoji: "🏋️", label: "Treinar a semana sem furar" },
        { emoji: "🥗", label: "Seguir o cardápio por 7 dias" },
        { emoji: "📈", label: "Ver meu progresso registrado" },
        { emoji: "📋", label: "Treino e dieta num lugar só" },
      ],
    },
  ],
  saude: [
    {
      key: "atrapalha",
      q: "O que você mais negligencia hoje?",
      opts: [
        { emoji: "💧", label: "Beber água" },
        { emoji: "😴", label: "Dormir direito" },
        { emoji: "💊", label: "Vitaminas e remédios na hora" },
        { emoji: "💉", label: "Exames e check-ups" },
        { emoji: "🧹", label: "Um pouco de tudo" },
      ],
    },
    {
      key: "consistencia",
      q: "Como seu corpo anda te avisando?",
      opts: [
        { emoji: "😩", label: "Cansaço o dia todo" },
        { emoji: "🌙", label: "Sono ruim" },
        { emoji: "😰", label: "Ansiedade e estresse" },
        { emoji: "🛡️", label: "Tô bem — quero prevenir" },
      ],
    },
    {
      key: "compromisso",
      q: "Topa dedicar 5 minutos por dia pra sua saúde?",
      opts: [
        { emoji: "💪", label: "Sim, topo" },
        { emoji: "🙂", label: "Topo, se for bem simples" },
      ],
    },
    {
      key: "vitoria",
      q: "Qual seria uma vitória nos próximos 7 dias?",
      opts: [
        { emoji: "🌙", label: "Dormir melhor essa semana" },
        { emoji: "💧", label: "Bater a meta de água todo dia" },
        { emoji: "💊", label: "Não esquecer nenhuma vitamina" },
        { emoji: "📋", label: "Minha saúde inteira num painel" },
      ],
    },
  ],
  metas: [
    {
      key: "atrapalha",
      q: "O que acontece com as suas metas?",
      opts: [
        { emoji: "📝", label: "Ficam na cabeça, nunca no papel" },
        { emoji: "🎆", label: "Empolgo em janeiro, esqueço em março" },
        { emoji: "🌀", label: "Tenho tantas que não sei por onde começar" },
        { emoji: "🔁", label: "Sinto que não saio do lugar" },
        { emoji: "🧹", label: "Quero organizar tudo" },
      ],
    },
    {
      key: "consistencia",
      q: "Quanto tempo faz que essa meta te espera?",
      opts: [
        { emoji: "🌱", label: "Surgiu agora" },
        { emoji: "📆", label: "Uns meses" },
        { emoji: "🗓️", label: "Mais de um ano" },
        { emoji: "😔", label: "Anos… nem conto mais" },
      ],
    },
    {
      key: "compromisso",
      q: "Topa dedicar 5 minutos por dia pras suas metas?",
      opts: [
        { emoji: "💪", label: "Sim, topo" },
        { emoji: "🙂", label: "Topo, se for bem simples" },
      ],
    },
    {
      key: "vitoria",
      q: "Qual seria uma vitória nos próximos 7 dias?",
      opts: [
        { emoji: "🗺️", label: "Minha meta com um plano de verdade" },
        { emoji: "✅", label: "Dar o primeiro passo, finalmente" },
        { emoji: "🌱", label: "Sentir que tô evoluindo de novo" },
        { emoji: "📋", label: "Minhas metas todas num painel" },
      ],
    },
  ],
};

/** Tela de PICO das trilhas (funil vitrine), depois da pergunta de
 *  "consistencia" — o equivalente ao "R$6.000 somem por ano" de finanças.
 *  `echo` reage à resposta; `reframe` é a virada; `card` aprofunda. */
export const AREA_PROOF: Record<Exclude<AreaKey, "dinheiro">, {
  echo: Record<string, string>;
  reframe: string;
  card: string;
  cta: string;
}> = {
  rotina: {
    echo: {
      "Uns 3 dias": "3 dias e o hábito morre.",
      "Uma semana": "Uma semana, e some.",
      "Um mês, aí largo": "Um mês, e do zero de novo.",
      "Nunca consegui manter": "Nunca deu pra manter.",
    },
    reframe: "Não é falta de força de vontade — é falta de sistema.",
    card: "Quem tem 100 dias de streak não é mais disciplinado que você. Só tem onde marcar — e não aguenta quebrar a sequência.",
    cta: "Quero meu sistema",
  },
  corpo: {
    echo: {
      "Essa vai ser a primeira": "Começar do zero de novo.",
      "Umas 2 ou 3": "2, 3 recomeços já.",
      "Perdi a conta": "Perdeu a conta dos recomeços.",
      "Tô na ativa, mas sem controle": "Treinando no escuro.",
    },
    reframe: "Recomeçar do zero cansa mais que treinar.",
    card: "O problema nunca foi disciplina. Foi não ter treino e dieta no mesmo lugar, com o progresso batendo na sua frente.",
    cta: "Quero parar de recomeçar",
  },
  saude: {
    echo: {
      "Cansaço o dia todo": "Cansaço o dia inteiro.",
      "Sono ruim": "Sono ruim, toda noite.",
      "Ansiedade e estresse": "Ansiedade sem trégua.",
      "Tô bem — quero prevenir": "Bem hoje — e quer continuar.",
    },
    reframe: "O corpo cobra o que a rotina não cuida.",
    card: "Água, sono, vitaminas na hora. Coisas pequenas que, juntas e no automático, mudam como você se sente todo dia.",
    cta: "Quero me cuidar de verdade",
  },
  metas: {
    echo: {
      "Surgiu agora": "Ainda dá tempo de começar certo.",
      "Uns meses": "Meses esperando na fila.",
      "Mais de um ano": "Mais de um ano parada.",
      "Anos… nem conto mais": "Anos vendo ela de longe.",
    },
    reframe: "Meta sem plano visível é só um desejo.",
    card: "A distância entre você e ela não é talento — é um plano que você VÊ todo dia: visão, passos e linha do tempo num lugar só.",
    cta: "Quero tirar do papel",
  },
};

/** Âncora de custo do paywall (funil vitrine): o custo de CONTINUAR ASSIM
 *  (recomeços/sintomas) vs o preço. Espelha o AnchorCard de finanças. */
export const AREA_ANCHOR: Record<Exclude<AreaKey, "dinheiro">, { pain: string; painSub: string }> = {
  rotina: { pain: "Recomeçar do zero", painSub: "de novo, e de novo" },
  corpo: { pain: "Mais um recomeço", painSub: "largado no meio" },
  saude: { pain: "O corpo cobrando", painSub: "a conta lá na frente" },
  metas: { pain: "Mais um ano igual", painSub: "com a meta no mesmo lugar" },
};

export const QUIZ: QuizQ[] = [
  {
    key: "atrapalha",
    q: "O que mais te atrapalha hoje?",
    opts: [
      { emoji: "💸", label: "Gasto sem perceber" },
      { emoji: "📅", label: "Esqueço contas" },
      { emoji: "🏦", label: "Não consigo guardar dinheiro" },
      { emoji: "🤷", label: "Não sei pra onde meu dinheiro vai" },
      { emoji: "🧹", label: "Quero organizar tudo" },
    ],
  },
  {
    key: "controle",
    q: "Como você controla seu dinheiro hoje?",
    opts: [
      { emoji: "🙈", label: "Não controlo" },
      { emoji: "📝", label: "Bloco de notas" },
      { emoji: "📊", label: "Planilha" },
      { emoji: "🏛️", label: "App de banco" },
      { emoji: "📱", label: "Outro app" },
    ],
  },
  {
    key: "gasto",
    q: "Quanto você acha que gasta sem perceber, por mês?",
    opts: [
      { emoji: "💰", label: "Menos de R$ 100" },
      { emoji: "💵", label: "R$ 100 a R$ 300" },
      { emoji: "💸", label: "R$ 300 a R$ 500" },
      { emoji: "🔥", label: "Mais de R$ 500" },
      { emoji: "🤷", label: "Não faço ideia" },
    ],
  },
  {
    key: "compromisso",
    q: "Topa dedicar 5 minutos por dia pro seu dinheiro?",
    opts: [
      { emoji: "💪", label: "Sim, topo" },
      { emoji: "🙂", label: "Topo, se for bem simples" },
    ],
  },
  {
    key: "vitoria",
    q: "Qual seria uma vitória nos próximos 7 dias?",
    opts: [
      { emoji: "🔍", label: "Entender meus gastos" },
      { emoji: "✅", label: "Parar de esquecer contas" },
      { emoji: "🎯", label: "Criar minha primeira meta" },
      { emoji: "💰", label: "Saber quanto posso gastar" },
      { emoji: "📋", label: "Organizar tudo em um painel" },
    ],
  },
];

/** Resposta de "gasto" → âncora em R$ usada na tela de impacto e no paywall.
 *  null = "Não faço ideia" (copy genérica, sem inventar número). */
export const GASTO_ANCHOR: Record<string, { month: string; year: string } | null> = {
  "Menos de R$ 100": { month: "R$ 100", year: "R$ 1.200" },
  "R$ 100 a R$ 300": { month: "R$ 300", year: "R$ 3.600" },
  "R$ 300 a R$ 500": { month: "R$ 500", year: "R$ 6.000" },
  "Mais de R$ 500": { month: "R$ 500+", year: "R$ 6.000+" },
  "Não faço ideia": null,
};

/** "Vitória" do quiz → promessa personalizada no headline do paywall. */
export const VICTORY_PHRASE: Record<string, string> = {
  "Entender meus gastos": "entender seus gastos",
  "Parar de esquecer contas": "nunca mais esquecer uma conta",
  "Criar minha primeira meta": "criar sua primeira meta",
  "Saber quanto posso gastar": "saber quanto pode gastar",
  "Organizar tudo em um painel": "organizar tudo num painel só",
  // Trilha rotina
  "Manter um hábito 7 dias seguidos": "manter um hábito 7 dias seguidos",
  "Acordar sabendo o que fazer": "acordar sabendo o que fazer",
  "Uma semana sem esquecer nada": "passar a semana sem esquecer nada",
  "Minha semana inteira num painel": "ver sua semana inteira num painel",
  // Trilha corpo
  "Treinar a semana sem furar": "treinar a semana inteira sem furar",
  "Seguir o cardápio por 7 dias": "seguir o cardápio por 7 dias",
  "Ver meu progresso registrado": "ver seu progresso registrado",
  "Treino e dieta num lugar só": "ter treino e dieta num lugar só",
  // Trilha saúde
  "Dormir melhor essa semana": "dormir melhor essa semana",
  "Bater a meta de água todo dia": "bater a meta de água todo dia",
  "Não esquecer nenhuma vitamina": "nunca mais esquecer uma vitamina",
  "Minha saúde inteira num painel": "ver sua saúde inteira num painel",
  // Trilha metas + evolução pessoal
  "Minha meta com um plano de verdade": "dar um plano de verdade pra sua meta",
  "Dar o primeiro passo, finalmente": "dar o primeiro passo, finalmente",
  "Sentir que tô evoluindo de novo": "sentir que tá evoluindo de novo",
  "Minhas metas todas num painel": "ver suas metas todas num painel",
};

/** Área escolhida na porta vitrine (persistida pro app abrir nela na 1ª sessão). */
export const FUNNEL_AREA_KEY = "core-funnel-area";

export const getFunnelArea = (): AreaKey | null => {
  try {
    const a = localStorage.getItem(FUNNEL_AREA_KEY);
    return a && a in AREAS ? (a as AreaKey) : null;
  } catch {
    return null;
  }
};

/**
 * Respostas do quiz salvas no aparelho (Comecar grava em "funnel-quiz-answers").
 * É o que liga o funil à 1ª sessão no app: quem veio pelo quiz não pode cair
 * num app genérico — o painel abre falando da meta e do R$ que a pessoa citou.
 */
export const getQuizAnswers = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem("funnel-quiz-answers") || "{}");
  } catch {
    return {};
  }
};
