import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useUserData } from "@/hooks/use-user-data";
import { QuickSignupStep } from "./QuickSignupStep";

export const QuickSignupModal = () => {
  const { get, isGuest, loaded } = useUserData();
  const location = useLocation();
  const pending = get<string>("quicksignup-pending", "") === "true";

  // Nunca abrir (nem travar o scroll do body) nas superfícies de marketing,
  // checkout, auth e admin. A conversão demo→cadastro acontece no /preview e em
  // /home. Sem isso, um guest com `quicksignup-pending` que cai no /lp ou /planos
  // ficava com o body em overflow:hidden e a página inteira travada.
  const suppressOnRoute =
    location.pathname === "/" ||
    location.pathname.startsWith("/lp") ||
    location.pathname.startsWith("/planos") ||
    location.pathname.startsWith("/auth") ||
    location.pathname.startsWith("/reset-password") ||
    location.pathname.startsWith("/update-password") ||
    location.pathname.startsWith("/admin");

  const shouldOpen = loaded && isGuest && pending && !suppressOnRoute;
  const [keepOpen, setKeepOpen] = useState(false);

  // Once opened, stay open until QuickSignupStep tells us it's done (success screen confirmed).
  useEffect(() => {
    if (shouldOpen && !keepOpen) setKeepOpen(true);
  }, [shouldOpen, keepOpen]);

  // Mesmo já aberto, sair para uma rota suprimida fecha o modal e libera o scroll.
  const open = !suppressOnRoute && (keepOpen || shouldOpen);

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
          className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-background"
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
            <QuickSignupStep onFinished={() => setKeepOpen(false)} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
