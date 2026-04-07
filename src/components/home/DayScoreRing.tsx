import { motion } from "framer-motion";
import { Flame } from "lucide-react";

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

        <motion.p
          className="text-lg font-bold mb-0.5"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Vamos lá!
        </motion.p>
        <p className="text-[11px] text-muted-foreground mb-3">Score do dia baseado em suas atividades</p>
        
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
