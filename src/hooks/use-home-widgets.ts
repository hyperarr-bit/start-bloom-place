import { useState, useEffect } from "react";
import { useUserData } from "@/hooks/use-user-data";

export type WidgetSize = "small" | "large";

export type WidgetId =
  | "finances"
  | "workout"
  | "calories"
  | "health"
  | "habits"
  | "reading"
  | "week-progress"
  | "budget-remaining"
  | "habit-streaks"
  | "motivational-quote"
  | "quick-notes"
  | "focus-timer"
  | "macro-balance"
  | "sleep-log"
  | "countdown"
  | "week-calendar"
  | "tasks"
  | "skincare"
  | "cuidados";

export interface WidgetDef {
  id: WidgetId;
  label: string;
  description: string;
  emoji: string;
  category: "produtividade" | "saúde" | "finanças" | "bem-estar";
  defaultSize: WidgetSize;
}

export interface ActiveWidget {
  id: WidgetId;
  size: WidgetSize;
}

export const WIDGET_CATALOG: WidgetDef[] = [
  // Module summary widgets (formerly cards)
  { id: "finances", label: "Finanças", description: "Saldo mensal e próxima conta", emoji: "💰", category: "finanças", defaultSize: "small" },
  { id: "workout", label: "Treino", description: "Treino do dia e status", emoji: "🏋️", category: "saúde", defaultSize: "small" },
  { id: "calories", label: "Calorias", description: "Consumo calórico do dia", emoji: "🍎", category: "saúde", defaultSize: "small" },
  { id: "health", label: "Saúde", description: "Água e indicadores de saúde", emoji: "❤️", category: "saúde", defaultSize: "small" },
  { id: "habits", label: "Hábitos", description: "Tarefas e hábitos do dia", emoji: "✅", category: "produtividade", defaultSize: "small" },
  // 22/09, chamado: "tarefas criadas em Carreira, Rotina, Casa não aparecem no dashboard inicial"
  { id: "tasks", label: "Tarefas de hoje", description: "Rotina, Carreira e Casa numa lista só, com ✓", emoji: "☑️", category: "produtividade", defaultSize: "large" },
  { id: "reading", label: "Leitura", description: "Livro atual e progresso", emoji: "📖", category: "bem-estar", defaultSize: "small" },
  // 28/09 (protótipo da Beleza): os passos de pele de hoje, manhã e noite, com o quadradinho
  { id: "skincare", label: "Skincare de hoje", description: "Os passos de pele de hoje, manhã e noite, com ✓", emoji: "🧴", category: "bem-estar", defaultSize: "large" },
  // 28/09 (Onda 1 da Beleza): unha, sobrancelha, depilação — os 3 que vencem primeiro
  { id: "cuidados", label: "Próximos cuidados", description: "Unha, sobrancelha, depilação: quanto falta", emoji: "💅", category: "bem-estar", defaultSize: "large" },
  // Custom widgets
  { id: "week-progress", label: "Progresso Semanal", description: "Gráfico do seu score ao longo da semana", emoji: "📊", category: "produtividade", defaultSize: "large" },
  { id: "budget-remaining", label: "Orçamento Restante", description: "Quanto ainda pode gastar este mês", emoji: "💸", category: "finanças", defaultSize: "large" },
  { id: "habit-streaks", label: "Ofensiva de Hábitos", description: "Grid de consistência dos seus hábitos", emoji: "🔥", category: "produtividade", defaultSize: "large" },
  { id: "motivational-quote", label: "Frase do Dia", description: "Motivação diária para manter o foco", emoji: "💡", category: "bem-estar", defaultSize: "large" },
  { id: "quick-notes", label: "Notas Rápidas", description: "Bloco de anotações na tela inicial", emoji: "📝", category: "produtividade", defaultSize: "large" },
  { id: "focus-timer", label: "Timer de Foco", description: "Pomodoro rápido direto da Home", emoji: "⏱️", category: "produtividade", defaultSize: "large" },
  { id: "macro-balance", label: "Macros do Dia", description: "Equilíbrio de proteína, carbs e gordura", emoji: "🥩", category: "saúde", defaultSize: "large" },
  { id: "sleep-log", label: "Sono", description: "Registre horas dormidas rapidamente", emoji: "😴", category: "saúde", defaultSize: "large" },
  { id: "countdown", label: "Contagem Regressiva", description: "Dias restantes até uma meta ou evento", emoji: "🎯", category: "bem-estar", defaultSize: "large" },
  { id: "week-calendar", label: "Visão da Semana", description: "Mini calendário com status de cada dia", emoji: "📅", category: "produtividade", defaultSize: "large" },
];

const KEY = "core-home-widgets-v2";
/** A chave dos widgets da Home (lista de { id, size }) — pra quem oferece "pôr na Home" de dentro de um módulo. */
export const CHAVE_WIDGETS_HOME = KEY;

/**
 * A lista com o widget acrescentado no fim, no tamanho pedido; `null` se ele já
 * está lá (ou se a lista gravada é lixo — não sobrescreve o que não entende).
 * Widget desconhecido pro app antigo não quebra a Home dele: WidgetGrid pula id
 * sem componente.
 */
export function comWidget(atuais: unknown, id: WidgetId, size: WidgetSize): ActiveWidget[] | null {
  if (atuais != null && !Array.isArray(atuais)) return null;
  const lista = (Array.isArray(atuais) ? atuais : []) as ActiveWidget[];
  if (lista.some((w) => w?.id === id)) return null;
  return [...lista, { id, size }];
}

const DEFAULT_WIDGETS: ActiveWidget[] = [];

export function useHomeWidgets() {
  const { get, set: setData, loaded } = useUserData();
  const [activeWidgets, setActiveWidgets] = useState<ActiveWidget[]>(() => {
    const saved = get<ActiveWidget[]>(KEY, []);
    return saved.length > 0 ? saved : DEFAULT_WIDGETS;
  });

  // A GRAVAÇÃO SÓ DESTRAVA DEPOIS DA HIDRATAÇÃO (20/08, review da Monik ★4:
  // "os widgets desaparecem quando saio e entro"). Antes de `loaded`, o get()
  // devolve o fallback [] — e o efeito de gravação escrevia esse VAZIO por
  // cima do valor salvo no servidor a cada boot frio. Não era só sumir da
  // tela: destruía o dado. `pronto` é estado (não ref) de propósito — vira
  // true num render SEPARADO, garantindo que a primeira gravação já enxerga
  // o estado hidratado, nunca o [] da montagem.
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    if (!loaded || pronto) return;
    const saved = get<ActiveWidget[]>(KEY, []);
    if (saved.length > 0) setActiveWidgets(saved);
    setPronto(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, pronto]);

  useEffect(() => {
    if (!pronto) return;
    setData(KEY, activeWidgets);
  }, [activeWidgets, setData, pronto]);

  const addWidget = (id: WidgetId) => {
    const def = WIDGET_CATALOG.find(w => w.id === id);
    if (!def) return;
    setActiveWidgets(prev =>
      prev.some(w => w.id === id) ? prev : [...prev, { id, size: "small" }]
    );
  };

  const removeWidget = (id: WidgetId) => {
    setActiveWidgets(prev => prev.filter(w => w.id !== id));
  };

  const isActive = (id: WidgetId) => activeWidgets.some(w => w.id === id);

  const toggleSize = (id: WidgetId) => {
    setActiveWidgets(prev =>
      prev.map(w =>
        w.id === id ? { ...w, size: w.size === "small" ? "large" : "small" } : w
      )
    );
  };

  const reorder = (from: number, to: number) => {
    setActiveWidgets(prev => {
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  };

  return { activeWidgets, addWidget, removeWidget, isActive, toggleSize, reorder };
}
