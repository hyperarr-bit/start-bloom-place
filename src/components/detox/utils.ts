// Forma canônica de um hábito de Detox + normalizador defensivo.
// Vários componentes leem h.relapses.length / h.relapses.filter / h.record etc.
// Se um hábito vier sem esses campos (seed do /preview, dado legado ou corrompido),
// o acesso quebra a aba inteira (RouteErrorBoundary). Normalizar na leitura blinda
// todos os componentes de uma vez.

export interface DetoxHabit {
  id: string;
  name: string;
  icon: string;
  startDate: string;
  relapses: string[];
  record: number;
  checkins: string[];
  reasons: string[];
}

const todayStr = () => new Date().toISOString().split("T")[0];

export function normalizeDetoxHabits(raw: unknown): DetoxHabit[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((h): h is Record<string, unknown> => !!h && typeof h === "object")
    .map((h) => ({
      id: h.id != null ? String(h.id) : Date.now().toString() + Math.random().toString(36).slice(2, 6),
      name: typeof h.name === "string" && h.name.trim() ? h.name : "Hábito",
      icon: typeof h.icon === "string" && h.icon ? h.icon : "🌿",
      startDate: typeof h.startDate === "string" && h.startDate ? h.startDate : todayStr(),
      relapses: Array.isArray(h.relapses) ? (h.relapses as string[]) : [],
      // aceita `streak` legado/seed como fallback de recorde
      record:
        typeof h.record === "number"
          ? h.record
          : typeof (h as { streak?: unknown }).streak === "number"
          ? (h as { streak: number }).streak
          : 0,
      checkins: Array.isArray(h.checkins) ? (h.checkins as string[]) : [],
      reasons: Array.isArray(h.reasons) ? (h.reasons as string[]) : [],
    }));
}
