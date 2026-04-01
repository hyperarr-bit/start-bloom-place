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
  | "week-calendar";

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
  { id: "reading", label: "Leitura", description: "Livro atual e progresso", emoji: "📖", category: "bem-estar", defaultSize: "small" },
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

const DEFAULT_WIDGETS: ActiveWidget[] = [];

export function useHomeWidgets() {
  const { get, set: setData } = useUserData();
  const [activeWidgets, setActiveWidgets] = useState<ActiveWidget[]>(() => {
    const saved = get<ActiveWidget[]>(KEY, []);
    return saved.length > 0 ? saved : DEFAULT_WIDGETS;
  });

  useEffect(() => {
    setData(KEY, activeWidgets);
  }, [activeWidgets, setData]);

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
