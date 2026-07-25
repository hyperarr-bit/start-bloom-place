import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { isNativeShell } from "@/lib/native-shell";

interface TutorialDonePopupProps {
  onClose: () => void;
}

export const TutorialDonePopup = ({ onClose }: TutorialDonePopupProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-5 bg-background"
      style={{
        paddingTop: "max(1.25rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 flex flex-col items-center text-center gap-5"
      >
        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 14 }}
          className="relative w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center"
        >
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <Sparkles className="relative w-10 h-10 text-primary" strokeWidth={2} />
        </motion.div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground leading-tight">
            Parabéns! Você terminou o tutorial 🎉
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            {isNativeShell() ? "Você desbloqueou o app. Bom proveito." : "Você desbloqueou o app. Aproveite seus 7 dias grátis."}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-xl bg-foreground text-background font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform mt-2"
        >
          Começar a usar <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>
    </motion.div>
  );
};
