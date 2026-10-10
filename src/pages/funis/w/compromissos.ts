import type { AreaKey } from "@/lib/funnel";

/** Claro!×3 POR ROTA (pedido do dono: "elas têm que mudar de acordo com a
 *  escolha da rota"). A pergunta 1 é a dor da área; 2 e 3 sobem o degrau.
 *  (10/10: saiu do ComecarW pra um arquivo puro — a tela "Seu plano de 3 dias"
 *  (PlanoDe3Dias, chave ONBOARDING_1TELA) usa as MESMAS perguntas como chips.) */
export const COMPROMISSOS_POR_AREA: Record<AreaKey, Array<{ emoji: string; p: string }>> = {
  dinheiro: [
    { emoji: "💸", p: "Você quer saber pra onde seu dinheiro vai?" },
    { emoji: "📅", p: "Quer parar de esquecer conta e pagar juros?" },
    { emoji: "🚀", p: "Topa fechar o mês no azul?" },
  ],
  rotina: [
    { emoji: "🗓️", p: "Você quer um dia que se organiza sozinho?" },
    { emoji: "🔁", p: "Quer construir hábitos que ficam?" },
    { emoji: "🚀", p: "Topa manter a constância por 30 dias?" },
  ],
  corpo: [
    { emoji: "💪", p: "Você quer treinar com progresso de verdade?" },
    { emoji: "🥗", p: "Quer dieta e treino no mesmo lugar?" },
    { emoji: "🚀", p: "Topa cuidar do corpo sem depender de motivação?" },
  ],
  saude: [
    { emoji: "❤️", p: "Você quer cuidar da sua saúde todo dia?" },
    { emoji: "😴", p: "Quer dormir e beber água como gente grande?" },
    { emoji: "🚀", p: "Topa virar sua versão mais saudável?" },
  ],
  metas: [
    { emoji: "🎯", p: "Você quer tirar suas metas do papel?" },
    { emoji: "🧭", p: "Quer ver seu progresso toda semana?" },
    { emoji: "🚀", p: "Topa virar sua melhor versão?" },
  ],
};

/**
 * A pergunta vira AFIRMAÇÃO no chip do plano ("Você quer saber pra onde seu
 * dinheiro vai?" → "Saber pra onde meu dinheiro vai"). Regras curtas, sem
 * dicionário: tira o "Você quer / Quer / Topa", troca seu→meu, tira o "?".
 */
export function compromissoComoChip(pergunta: string): string {
  let t = pergunta.trim().replace(/\?$/, "");
  t = t.replace(/^(Você quer|Quer|Topa)\s+/i, "");
  t = t.replace(/\bseu\b/g, "meu").replace(/\bsua\b/g, "minha").replace(/\bsuas\b/g, "minhas").replace(/\bseus\b/g, "meus");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * PLANO COM CADEADO (10/10, chave PLANO_CADEADO em lib/ofertas-saida) — o que ela
 * vai FAZER em cada um dos 3 dias, na linguagem dela, a partir da rota/missão
 * (a dose do dia 1 é a mesma da Missão em doses: 1 toque no módulo da área).
 * Dias 2 e 3 sobem o degrau, como os compromissos. Frases curtas: a tela não rola.
 */
export const DIAS_POR_AREA: Record<AreaKey, [string, string, string]> = {
  dinheiro: ["Anota 1 gasto e vê o mês somar sozinho", "Marca as contas do mês e recebe o aviso antes de vencer", "Vê quanto dá pra gastar hoje sem furar o mês"],
  rotina: ["Marca 1 hábito e vê sua semana ganhar vida", "Monta o dia de amanhã em 2 minutos", "Fecha 3 dias seguidos e vê a sequência crescer"],
  corpo: ["Anota 1 exercício e a carga de hoje", "Marca as refeições e vê o dia fechar", "Compara o treino com o de anteontem e sobe a carga"],
  saude: ["Marca 1 copo d'água e bate a meta do dia", "Registra o sono e vê o padrão da semana", "Fecha água + sono + remédio no mesmo dia"],
  metas: ["Escolhe 1 meta e divide em passos", "Faz o primeiro passo e marca feito", "Vê o progresso da semana e ajusta o rumo"],
};

/** O que fica atrás do cadeado ("Depois do teste": o que o CORE monta nos próximos 30 dias) — 2–3 linhas BORRADAS. */
export const DEPOIS_DO_TESTE_POR_AREA: Record<AreaKey, [string, string, string]> = {
  dinheiro: ["Semana 1: seu mapa de gastos por categoria", "Semana 2: as contas fixas no piloto automático", "Semana 3–4: o plano pra fechar o mês no azul"],
  rotina: ["Semana 1: sua rotina de manhã montada", "Semana 2: os hábitos que ficam, com lembrete", "Semana 3–4: a constância de 30 dias"],
  corpo: ["Semana 1: seu plano de treino da semana", "Semana 2: cardápio e treino no mesmo lugar", "Semana 3–4: a progressão de carga"],
  saude: ["Semana 1: água, sono e remédios no lugar", "Semana 2: seus padrões de sono e energia", "Semana 3–4: a rotina de saúde que fica"],
  metas: ["Semana 1: sua meta principal com passos", "Semana 2: a revisão semanal no lugar", "Semana 3–4: o progresso em cada meta"],
};
