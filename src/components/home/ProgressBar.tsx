import { motion } from "framer-motion";

interface ProgressBarProps {
  value: number;
  max: number;
  colorClass?: string;
  size?: "sm" | "md";
}

export const ProgressBar = ({ value, max, colorClass = "bg-primary", size = "sm" }: ProgressBarProps) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const h = size === "sm" ? "h-1.5" : "h-2";

  return (
    <div className={`w-full ${h} rounded-full bg-muted overflow-hidden`}>
      <motion.div
        className={`${h} rounded-full ${colorClass}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
      />
    </div>
  );
};
