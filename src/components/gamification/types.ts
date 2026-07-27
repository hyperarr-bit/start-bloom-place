export type BadgeCategoria = "finance" | "rotina" | "leitura" | "treino" | "dieta" | "geral";

/** Rótulo e ordem das seções da grade — a ordem é a de uso real dos módulos. */
export const CATEGORIAS: { id: BadgeCategoria; label: string; emoji: string }[] = [
  { id: "finance", label: "Finanças", emoji: "💰" },
  { id: "rotina", label: "Rotina", emoji: "📅" },
  { id: "leitura", label: "Leitura", emoji: "📚" },
  { id: "treino", label: "Treino", emoji: "🏋️" },
  { id: "dieta", label: "Dieta", emoji: "🥗" },
  { id: "geral", label: "CORE", emoji: "👑" },
];

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategoria;
  unlocked: boolean;
  color: string;
  xp: number;
  /**
   * Quanto falta. Opcional porque nem toda conquista é numérica ("todas as
   * contas pagas" é sim/não). Quando existe, é o que ordena "Próximas
   * conquistas" por PROXIMIDADE em vez de por ordem de declaração.
   */
  progresso?: { atual: number; alvo: number };
}

/** 0..1. Sem progresso declarado, só existe trancada (0) ou aberta (1). */
export const fracaoDe = (b: Badge): number =>
  b.unlocked ? 1 : b.progresso && b.progresso.alvo > 0 ? b.progresso.atual / b.progresso.alvo : 0;

export interface Level {
  name: string;
  minXP: number;
  icon: string;
  color: string;
}

export const LEVELS: Level[] = [
  { name: "Bronze", minXP: 0, icon: "🥉", color: "from-amber-700 to-amber-600" },
  { name: "Prata", minXP: 200, icon: "🥈", color: "from-slate-400 to-slate-300" },
  { name: "Ouro", minXP: 500, icon: "🥇", color: "from-yellow-500 to-amber-400" },
  { name: "Platina", minXP: 1000, icon: "💎", color: "from-cyan-400 to-blue-400" },
  { name: "Diamante", minXP: 2000, icon: "👑", color: "from-purple-500 to-pink-400" },
];

export const getLevel = (xp: number): Level => {
  return [...LEVELS].reverse().find(l => xp >= l.minXP) || LEVELS[0];
};

export const getNextLevel = (xp: number): Level | null => {
  const idx = LEVELS.findIndex(l => l.minXP > xp);
  return idx >= 0 ? LEVELS[idx] : null;
};
