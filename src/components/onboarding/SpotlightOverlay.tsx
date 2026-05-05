import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, X } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";

interface SpotlightOverlayProps {
  /** module key this spotlight belongs to (must match `quickstart-target-module`) */
  moduleKey: "financas" | "rotina" | "dieta" | "treino";
  /** Instruction shown to the user. Short and action-oriented. */
  instruction: string;
  /** activation action(s) that should dismiss the spotlight when fired */
  activationActions: string[];
}

/**
 * Renders a dimming overlay with a floating instruction card at the bottom of
 * the viewport, telling the user what action to take in this module. Auto-hides
 * when the related activation flag is set in user_data (i.e. the user
 * completed the first meaningful action) or when the user dismisses it.
 */
export const SpotlightOverlay = ({ moduleKey, instruction, activationActions }: SpotlightOverlayProps) => {
  const { get, set } = useUserData();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = get<string>("quickstart-target-module", "");
    const done = get<string>(`spotlight-done-${moduleKey}`, "");
    if (target === moduleKey && !done) {
      setVisible(true);
      trackEvent("spotlight_shown", { module: moduleKey });
    }
  }, [moduleKey, get]);

  useEffect(() => {
    if (!visible) return;
    const onActivation = (e: Event) => {
      const detail = (e as CustomEvent).detail as { action?: string } | undefined;
      if (detail?.action && activationActions.includes(detail.action)) {
        set(`spotlight-done-${moduleKey}`, "true");
        set("quickstart-target-module", "");
        trackEvent("quickstart_completed", { module: moduleKey });
        setVisible(false);
      }
    };
    window.addEventListener("core:activation", onActivation);
    return () => window.removeEventListener("core:activation", onActivation);
  }, [visible, set, activationActions, moduleKey]);

  const dismiss = () => {
    set(`spotlight-done-${moduleKey}`, "true");
    trackEvent("spotlight_dismissed", { module: moduleKey });
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* dim layer — does NOT block clicks (pointer-events: none) so the user can interact with the page */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-[2px] pointer-events-none"
          />

          {/* instruction card — pinned to bottom, clickable */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed left-0 right-0 z-[90] flex justify-center px-4"
            style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-4 relative pointer-events-auto">
              <button
                onClick={dismiss}
                aria-label="Fechar"
                className="absolute top-3 right-3 w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-3 pr-6">
                <div className="shrink-0 w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ArrowUp className="w-4 h-4 text-primary animate-bounce" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-primary mb-1">
                    Passo 1 de 1
                  </p>
                  <p className="text-sm font-semibold text-foreground leading-snug">
                    {instruction}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Procura o botão <span className="font-semibold text-foreground">+</span> nas abas acima.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
