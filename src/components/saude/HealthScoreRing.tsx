// This component is no longer used — health score is now inline in Saude.tsx summary cards
// Kept for backward compatibility if referenced elsewhere

import { motion } from "framer-motion";

interface HealthScoreRingProps {
  score: number;
  waterPct: number;
  sleepOk: boolean;
  medsCount: number;
  medsTotal: number;
}

export const HealthScoreRing = ({ score, waterPct, sleepOk, medsCount, medsTotal }: HealthScoreRingProps) => {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted border border-border">
      <div className="text-2xl font-black text-foreground">{score}%</div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2 text-[11px]">
          <span className={`w-2 h-2 rounded-full ${waterPct >= 100 ? "bg-success" : "bg-warning"}`} />
          <span className="text-muted-foreground">Água {waterPct >= 100 ? "✓" : `${Math.round(waterPct)}%`}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className={`w-2 h-2 rounded-full ${sleepOk ? "bg-success" : "bg-destructive"}`} />
          <span className="text-muted-foreground">Sono {sleepOk ? "OK" : "⚠"}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className={`w-2 h-2 rounded-full ${medsCount >= medsTotal ? "bg-success" : "bg-warning"}`} />
          <span className="text-muted-foreground">Meds {medsCount}/{medsTotal}</span>
        </div>
      </div>
    </div>
  );
};
