import { useAppNavigate } from "@/hooks/use-demo-mode";
import { AnimatePresence, motion } from "framer-motion";
import { X, Sparkles, Zap, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDailyNudge } from "@/hooks/use-daily-nudge";
import { useAuth } from "@/hooks/use-auth";

const TONE_ICON = {
  info: Sparkles,
  engage: Zap,
  urgent: Clock,
} as const;

const TONE_STYLES = {
  info: "bg-primary/10 text-primary border-primary/20",
  engage: "bg-primary/15 text-primary border-primary/30",
  urgent: "bg-destructive/10 text-destructive border-destructive/30",
} as const;

export const DailyNudge = () => {
  const { nudge, open, dismiss, click } = useDailyNudge();
  const { trialDay } = useAuth();
  const navigate = useAppNavigate();

  if (!nudge) return null;

  const Icon = TONE_ICON[nudge.tone];

  const handleCta = () => {
    click();
    navigate(nudge.ctaRoute);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            onClick={() => dismiss("later")}
          />

          {/* Bottom sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-3xl shadow-2xl"
          >
            <div className="max-w-lg mx-auto px-5 pt-3 pb-6">
              {/* Drag handle */}
              <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />

              <div className="flex items-start justify-between gap-3 mb-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${TONE_STYLES[nudge.tone]}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <button
                  onClick={() => dismiss("x")}
                  className="text-muted-foreground hover:text-foreground p-1 -mr-1 -mt-1"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Dia {trialDay} de 7 · Trial CORE
              </p>
              <h2 className="text-lg font-bold leading-snug mb-1.5">
                {nudge.title}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                {nudge.description}
              </p>

              <div className="space-y-2">
                <Button onClick={handleCta} className="w-full h-11 gap-2">
                  {nudge.ctaLabel}
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <button
                  onClick={() => dismiss("later")}
                  className="w-full text-xs text-muted-foreground hover:text-foreground py-2"
                >
                  Agora não
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
