import { motion } from "framer-motion";
import { getLevel, getNextLevel, LEVELS } from "./types";

interface LevelProgressProps {
  xp: number;
}

export const LevelProgress = ({ xp }: LevelProgressProps) => {
  const current = getLevel(xp);
  const next = getNextLevel(xp);
  const progress = next
    ? ((xp - current.minXP) / (next.minXP - current.minXP)) * 100
    : 100;

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{current.icon}</span>
          <div>
            <p className="text-sm font-bold">Nível {current.name}</p>
            <p className="text-xs text-muted-foreground">{xp} XP total</p>
          </div>
        </div>
        {next && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Próximo: {next.icon} {next.name}</p>
            <p className="text-xs text-muted-foreground">{next.minXP - xp} XP restantes</p>
          </div>
        )}
      </div>
      <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${current.color}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
      {/* Level dots */}
      <div className="flex justify-between mt-2">
        {LEVELS.map((level) => (
          <div
            key={level.name}
            className={`text-center ${xp >= level.minXP ? "opacity-100" : "opacity-30"}`}
          >
            <span className="text-xs">{level.icon}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
