import { useEntradaDaHome } from "@/components/home/entrada-da-home";
import { motion } from "framer-motion";

interface ProgressBarProps {
  value: number;
  max: number;
  colorClass?: string;
  size?: "sm" | "md";
}

export const ProgressBar = ({ value, max, colorClass = "bg-primary", size = "sm" }: ProgressBarProps) => {
  const entrada = useEntradaDaHome(); // 07/11: a barra cresce do zero só na 1ª montagem da sessão
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const h = size === "sm" ? "h-1.5" : "h-2";

  return (
    <div className={`w-full ${h} rounded-full bg-muted overflow-hidden`}>
      <motion.div
        className={`${h} rounded-full ${colorClass}`}
        initial={entrada ? { width: 0 } : false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
      />
    </div>
  );
};
