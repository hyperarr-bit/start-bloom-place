/** Value stack por área de entrada (funil vitrine) — o ValueStack do PaywallDia14 e os 4 itens do paywall sem teste
 *  (12/11) leem daqui. Arquivo leve de propósito: o paywall sem teste não pode importar o PaywallDia14 (ciclo). */
import { BarChart3, BellRing, CalendarDays, Dumbbell, Flame, HeartPulse, MessageCircleHeart, Salad, Target, Wallet } from "lucide-react";
import type { AreaKey } from "@/lib/funnel";

// Value stack por área de entrada (funil vitrine): a killer feature da dor
// escolhida vem primeiro (serial position); a amplitude é bônus, não promessa.
export const STACKS: Record<AreaKey, Array<{ Icon: typeof Wallet; tile: string; title: string; sub: string }>> = {
  dinheiro: [
    { Icon: Wallet, tile: "bg-amber-100 text-amber-700", title: "Finanças completo", sub: "gastos, saldo e visão do mês" },
    { Icon: BellRing, tile: "bg-rose-100 text-rose-600", title: "Contas a vencer", sub: "lembretes antes do juros" },
    { Icon: Target, tile: "bg-emerald-100 text-emerald-700", title: "Metas e desejos", sub: "progresso que dá vontade" },
    { Icon: BarChart3, tile: "bg-violet-100 text-violet-700", title: "Saúde financeira", sub: "score, relatórios e simuladores" },
  ],
  rotina: [
    { Icon: CalendarDays, tile: "bg-rose-100 text-rose-600", title: "Rotina semanal", sub: "sua semana inteira, hora a hora" },
    { Icon: Flame, tile: "bg-amber-100 text-amber-700", title: "Hábitos e streaks", sub: "consistência que dá orgulho" },
    { Icon: BellRing, tile: "bg-violet-100 text-violet-700", title: "Tarefas e urgências", sub: "nada mais esquecido" },
    { Icon: Target, tile: "bg-emerald-100 text-emerald-700", title: "Metas e desejos", sub: "progresso que dá vontade" },
  ],
  corpo: [
    { Icon: Dumbbell, tile: "bg-violet-100 text-violet-700", title: "Treino completo", sub: "plano, cargas e progressão" },
    { Icon: Salad, tile: "bg-emerald-100 text-emerald-700", title: "Dieta e cardápio", sub: "refeição por refeição" },
    { Icon: BarChart3, tile: "bg-amber-100 text-amber-700", title: "Progresso visível", sub: "cada treino registrado" },
    { Icon: Flame, tile: "bg-rose-100 text-rose-600", title: "Constância", sub: "streaks que te seguram firme" },
  ],
  saude: [
    { Icon: HeartPulse, tile: "bg-rose-100 text-rose-600", title: "Saúde no dia a dia", sub: "água, sono e energia" },
    { Icon: BellRing, tile: "bg-amber-100 text-amber-700", title: "Vitaminas na hora", sub: "lembrete + controle de estoque" },
    { Icon: BarChart3, tile: "bg-violet-100 text-violet-700", title: "Evolução do corpo", sub: "peso, medidas e exames" },
    { Icon: Target, tile: "bg-emerald-100 text-emerald-700", title: "Autocuidado", sub: "pequenas vitórias diárias" },
  ],
  metas: [
    { Icon: Target, tile: "bg-emerald-100 text-emerald-700", title: "Metas com plano", sub: "visão, passos e prazo" },
    { Icon: CalendarDays, tile: "bg-violet-100 text-violet-700", title: "Linha do tempo", sub: "6 meses, 1, 3 e 5 anos" },
    { Icon: BarChart3, tile: "bg-amber-100 text-amber-700", title: "Sua evolução visível", sub: "roda da vida + progresso" },
    { Icon: MessageCircleHeart, tile: "bg-rose-100 text-rose-600", title: "Diário e humor", sub: "gratidão pra manter o pique" },
  ],
};
