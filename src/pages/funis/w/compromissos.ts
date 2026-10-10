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
