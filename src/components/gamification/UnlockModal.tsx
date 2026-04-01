import { motion, AnimatePresence } from "framer-motion";
import { Trophy, X } from "lucide-react";
import { Badge } from "./types";

interface UnlockModalProps {
  badge: Badge | null;
  onClose: () => void;
}

export const UnlockModal = ({ badge, onClose }: UnlockModalProps) => {
  if (!badge) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.3, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.3, opacity: 0, y: 50 }}
          transition={{ type: "spring", damping: 15, stiffness: 300 }}
          className="relative bg-card border border-yellow-500/50 rounded-2xl p-8 max-w-sm mx-4 text-center shadow-2xl shadow-yellow-500/20"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={onClose} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>

          {/* Confetti-like particles */}
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"][i % 6],
                top: "50%",
                left: "50%",
              }}
              initial={{ x: 0, y: 0, opacity: 1 }}
              animate={{
                x: Math.cos((i * 30 * Math.PI) / 180) * 120,
                y: Math.sin((i * 30 * Math.PI) / 180) * 120,
                opacity: 0,
                scale: 0,
              }}
              transition={{ duration: 1, delay: 0.2 }}
            />
          ))}

          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", delay: 0.1, damping: 10 }}
            className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg shadow-yellow-500/30"
          >
            <Trophy className="w-10 h-10 text-white" />
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xs uppercase tracking-widest text-yellow-400 font-bold mb-1"
          >
            🎉 Conquista Desbloqueada!
          </motion.p>

          <motion.h3
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl font-bold mb-1"
          >
            {badge.name}
          </motion.h3>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm text-muted-foreground mb-3"
          >
            {badge.description}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="inline-flex items-center gap-1 bg-yellow-500/20 text-yellow-400 text-sm font-bold px-3 py-1 rounded-full"
          >
            +{badge.xp} XP
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
