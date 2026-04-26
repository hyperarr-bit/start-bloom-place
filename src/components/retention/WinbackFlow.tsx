import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WinbackWheel } from "./WinbackWheel";
import { WinbackOffer } from "./WinbackOffer";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";

interface Props {
  open: boolean;
  onClose: () => void;
  attemptId: string | null;
}

export function WinbackFlow({ open, onClose, attemptId }: Props) {
  const [step, setStep] = useState<"wheel" | "offer">("wheel");

  useEffect(() => {
    if (open) {
      setStep("wheel");
      trackEvent("winback_triggered");
      // mark wheel_shown timestamp
      if (attemptId) {
        supabase
          .from("winback_attempts")
          .update({ wheel_shown_at: new Date().toISOString() })
          .eq("id", attemptId)
          .then(() => {});
      }
    }
  }, [open, attemptId]);

  const handleWheelDone = async () => {
    if (attemptId) {
      await supabase
        .from("winback_attempts")
        .update({
          wheel_spun_at: new Date().toISOString(),
          offer_shown_at: new Date().toISOString(),
        })
        .eq("id", attemptId);
    }
    setStep("offer");
  };

  const handleClose = async () => {
    if (attemptId) {
      await supabase
        .from("winback_attempts")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", attemptId);
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <AnimatePresence mode="wait">
        {step === "wheel" ? (
          <motion.div
            key="wheel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <WinbackWheel onContinue={handleWheelDone} />
          </motion.div>
        ) : (
          <motion.div
            key="offer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <WinbackOffer onClose={handleClose} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
