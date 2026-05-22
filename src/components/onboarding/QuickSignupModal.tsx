import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUserData } from "@/hooks/use-user-data";
import { QuickSignupStep } from "./QuickSignupStep";

export const QuickSignupModal = () => {
  const { get, isGuest, loading } = useUserData();
  const pending = get("quicksignup-pending") === "true";
  const open = !loading && isGuest && pending;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="quicksignup-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-background/40 backdrop-blur-md"
          style={{
            paddingTop: "max(1.25rem, env(safe-area-inset-top))",
            paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 max-h-[92vh] overflow-y-auto"
          >
            <QuickSignupStep />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
