/**
 * Daily Nudge logic — picks ONE contextual in-app suggestion
 * for the current trial day, adapting to which key actions
 * the user has already activated.
 */

export interface DailyNudge {
  key: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaRoute: string;
  /** Activation key that, once present, marks this nudge as "completed". */
  actionKey?: string;
  tone: "info" | "engage" | "urgent";
}

/**
 * Returns a nudge for the given trial day, or null if nothing should be shown.
 */
export function pickDailyNudge(
  trialDay: number,
  activations: Set<string>,
  trialExpired: boolean,
): DailyNudge | null {
  if (trialExpired) {
    // Trial expirado é tratado pelo TrialBanner full-screen + WinbackFlow.
    // Não mostrar drawer duplicado.
    return null;
  }

  const has = (k: string) => activations.has(k);

  switch (trialDay) {
    case 1: {
      if (has("first_task")) {
        return {
          key: "d1-after-task",
          title: "Boa! Já organizou suas tarefas.",
          description: "Que tal começar pelas finanças agora? Registre uma transação rápida.",
          ctaLabel: "Ir para Finanças",
          ctaRoute: "/financas",
          actionKey: "first_transaction",
          tone: "engage",
        };
      }
      return {
        key: "d1-first-task",
        title: "Comece pequeno: 1 tarefa",
        description: "Crie sua primeira tarefa do dia. Leva menos de 30 segundos.",
        ctaLabel: "Criar tarefa",
        ctaRoute: "/rotina",
        actionKey: "first_task",
        tone: "info",
      };
    }

    case 2: {
      if (has("first_transaction")) {
        return {
          key: "d2-finance-summary",
          title: "Veja para onde vai seu dinheiro",
          description: "Você já registrou uma transação. Confira o resumo do mês.",
          ctaLabel: "Ver resumo",
          ctaRoute: "/financas",
          tone: "engage",
        };
      }
      return {
        key: "d2-finance-first",
        title: "Dia 2: Registre sua 1ª transação",
        description: "Em menos de 1 minuto você vê quanto sobra no fim do mês.",
        ctaLabel: "Registrar agora",
        ctaRoute: "/financas",
        actionKey: "first_transaction",
        tone: "info",
      };
    }

    case 3: {
      if (has("first_habit")) {
        return {
          key: "d3-habit-streak",
          title: "Mantenha seu streak vivo",
          description: "Marque seu hábito de hoje e não quebre a sequência.",
          ctaLabel: "Marcar hábito",
          ctaRoute: "/desenvolvimento",
          tone: "engage",
        };
      }
      if (has("first_workout") || has("first_water_log")) {
        return {
          key: "d3-habit-from-health",
          title: "Você cuida da saúde — turbina com 1 hábito",
          description: "Crie um hábito diário e veja a evolução em forma de gráfico.",
          ctaLabel: "Criar hábito",
          ctaRoute: "/desenvolvimento",
          actionKey: "first_habit",
          tone: "engage",
        };
      }
      return {
        key: "d3-habit-first",
        title: "Dia 3: Crie um hábito simples",
        description: "Beber água, ler 10 min, qualquer coisa. O CORE acompanha pra você.",
        ctaLabel: "Criar hábito",
        ctaRoute: "/desenvolvimento",
        actionKey: "first_habit",
        tone: "info",
      };
    }

    case 4: {
      const count = activations.size;
      if (count >= 3) {
        return {
          key: "d4-rich-recap",
          title: `Olha só: você já ativou ${count} áreas`,
          description: "Veja o resumo da sua semana no painel principal.",
          ctaLabel: "Ver minha semana",
          ctaRoute: "/",
          tone: "engage",
        };
      }
      return {
        key: "d4-explore",
        title: "Dia 4: Explore um módulo novo",
        description: "Saúde, Casa, Treino, Beleza... abra um que você ainda não usou.",
        ctaLabel: "Abrir módulos",
        ctaRoute: "/",
        tone: "info",
      };
    }

    case 5: {
      const engaged = activations.size >= 3;
      if (engaged) {
        return {
          key: "d5-engaged-value",
          title: "Você está aproveitando o CORE",
          description: "Garanta que tudo isso continue — assine antes do trial acabar.",
          ctaLabel: "Ver planos",
          ctaRoute: "/planos",
          tone: "engage",
        };
      }
      return {
        key: "d5-low-value",
        title: "Faltam 2 dias do seu teste",
        description: "Veja como o CORE pode te ajudar todos os dias.",
        ctaLabel: "Ver benefícios",
        ctaRoute: "/planos",
        tone: "engage",
      };
    }

    case 6: {
      const engaged = activations.size >= 3;
      return {
        key: engaged ? "d6-engaged-convert" : "d6-value-pitch",
        title: engaged
          ? "Amanhã é o último dia"
          : "Garanta seu acesso antes que expire",
        description: engaged
          ? "Continue com tudo que você já configurou. A partir de R$ 5,82/mês no anual."
          : "Assine agora e mantenha tudo organizado.",
        ctaLabel: "Assinar agora",
        ctaRoute: "/planos",
        tone: "urgent",
      };
    }

    case 7:
    case 8: {
      return {
        key: "d7-last-call",
        title: "Último dia do trial",
        description: "Não perca seus dados — assine agora e continue de onde parou.",
        ctaLabel: "Assinar antes que expire",
        ctaRoute: "/planos",
        tone: "urgent",
      };
    }

    default:
      return null;
  }
}
