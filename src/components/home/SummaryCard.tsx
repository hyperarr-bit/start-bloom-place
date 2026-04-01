import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface SummaryCardProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  path: string;
  accentClass?: string;
  delay?: number;
}

export const SummaryCard = ({ icon, title, children, path, accentClass = "", delay = 0 }: SummaryCardProps) => {
  const navigate = useNavigate();

  return (
    <motion.button
      onClick={() => navigate(path)}
      className="group w-full text-left bg-card rounded-2xl p-4 shadow-sm hover:shadow-md border border-border/50 transition-all"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${accentClass || "bg-muted"}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
            <ArrowRight className="w-3 h-3 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </div>
          {children}
        </div>
      </div>
    </motion.button>
  );
};
