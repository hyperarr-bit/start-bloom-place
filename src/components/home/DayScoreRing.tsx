import { motion } from "framer-motion";
import { Flame, TrendingUp } from "lucide-react";

interface DayScoreRingProps {
  score: number;
  streak: number;
}

export const DayScoreRing = ({ score, streak }: DayScoreRingProps) => {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  const getScoreColor = () => {
    if (score >= 80) return "hsl(var(--success))";
    if (score >= 50) return "hsl(var(--warning))";
    return "hsl(var(--accent))";
  };

  const getScoreLabel = () => {
    if (score >= 80) return "Excelente!";
    if (score >= 60) return "Bom dia!";
    if (score >= 30) return "Vamos lá!";
    return "Comece agora";
  };

  return (
    <div className="flex items-center gap-5">
      {/* Ring */}
      <div className="relative w-[130px] h-[130px] flex-shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
          />
          <motion.circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke={getScoreColor()}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-3xl font-bold"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.5 }}
          >
            {score}
          </motion.span>
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">pontos</span>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <motion.p
          className="text-lg font-bold mb-1"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {getScoreLabel()}
        </motion.p>
        <p className="text-xs text-muted-foreground mb-3">Score do dia baseado nas suas atividades</p>
        
        {streak > 0 && (
          <motion.div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/20"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7, type: "spring" }}
          >
            <Flame className="w-3.5 h-3.5 text-warning" />
            <span className="text-xs font-bold text-warning">{streak} dia{streak > 1 ? "s" : ""}</span>
            <span className="text-[10px] text-muted-foreground">consecutivo{streak > 1 ? "s" : ""}</span>
          </motion.div>
        )}
      </div>
    </div>
  );
};
