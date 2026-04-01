export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "finance" | "health" | "habits" | "general";
  unlocked: boolean;
  color: string;
  xp: number;
}

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
