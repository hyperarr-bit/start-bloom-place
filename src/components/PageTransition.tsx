import { motion } from "framer-motion";
import { ReactNode } from "react";

export const PageTransition = ({ children }: { children: ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.3, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);

export const StaggerContainer = ({ children, className }: { children: ReactNode; className?: string }) => (
  <motion.div
    className={className}
    initial="hidden"
    animate="visible"
    variants={{
      hidden: {},
      visible: { transition: { staggerChildren: 0.06 } },
    }}
  >
    {children}
  </motion.div>
);

export const StaggerItem = ({ children, className }: { children: ReactNode; className?: string }) => (
  <motion.div
    className={className}
    variants={{
      hidden: { opacity: 0, y: 16, scale: 0.97 },
      visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: "easeOut" } },
    }}
  >
    {children}
  </motion.div>
);

export const FadeIn = ({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);

export const AnimatedCheckbox = ({ checked, onToggle, className = "" }: { checked: boolean; onToggle: () => void; className?: string }) => (
  <motion.button
    onClick={onToggle}
    className={`flex items-center justify-center rounded border-2 transition-colors ${
      checked
        ? "bg-green-500 border-green-500"
        : "border-muted-foreground/30 hover:border-green-400"
    } ${className}`}
    whileTap={{ scale: 0.85 }}
    animate={checked ? { scale: [1, 1.2, 1] } : {}}
    transition={{ duration: 0.25 }}
  >
    {checked && (
      <motion.svg
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="w-3 h-3 text-white"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.path d="M5 13l4 4L19 7" />
      </motion.svg>
    )}
  </motion.button>
);
