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
      { emoji: "🪙", label: "Menos de R$ 100" },
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
};
