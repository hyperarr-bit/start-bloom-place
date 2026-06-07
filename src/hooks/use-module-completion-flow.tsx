import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";

export type CoreModuleKey = "financas" | "rotina" | "dieta" | "metas";

const ALL_MODULES: CoreModuleKey[] = ["financas", "rotina", "dieta", "metas"];

const LABELS: Record<CoreModuleKey, string> = {
  financas: "Finanças",
  rotina: "Rotina",
  dieta: "Dieta",
  metas: "Metas",
};

export const useModuleCompletionFlow = (currentModule: CoreModuleKey) => {
  const { get, set, isGuest } = useUserData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<CoreModuleKey[]>([]);
  const [allDone, setAllDone] = useState(false);

  const onModuleComplete = useCallback(() => {
    // SpotlightOverlay already set spotlight-done-<module> before calling onComplete.
    const remaining = ALL_MODULES.filter(
      (m) => m !== currentModule && !get<string>(`spotlight-done-${m}`, "")
    );
    setPending(remaining);
    const done = remaining.length === 0;
    setAllDone(done);

    if (done) {
      trackEvent("quickstart_all_completed", { is_guest: isGuest });
    }

    if (done && isGuest) {
      // Pula o card "Tudo pronto" e abre o form de cadastro direto.
      set("quicksignup-pending", "true");
      return;
    }
    setOpen(true);
  }, [currentModule, get, set, isGuest]);

  const handleClose = () => {
    setOpen(false);
    if (pending.length > 0) navigate("/home");
  };

  const CompletionDialog = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mc-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-background/70 pointer-events-auto px-6"
          onClick={handleClose}
        >
          <motion.div
            key="mc-card"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-2xl border border-primary/30 bg-card shadow-2xl p-6 text-center"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
              className="relative mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"
            >
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              {allDone ? (
                <Sparkles className="relative w-9 h-9 text-primary" strokeWidth={2.2} />
              ) : (
                <CheckCircle2 className="relative w-9 h-9 text-primary" strokeWidth={2.5} />
              )}
            </motion.div>

            {allDone ? (
              <>
                <h3 className="relative text-lg font-bold text-foreground mb-2">
                  Tudo pronto! 🎉
                </h3>
                <p className="relative text-sm text-muted-foreground leading-relaxed mb-5">
                  {isGuest
                    ? "Você completou os 4 módulos. Vamos liberar seu teste grátis de 7 dias."
                    : "Você completou todos os módulos do tutorial."}
                </p>
                <button
                  onClick={handleClose}
                  className="relative w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  Continuar
                </button>
              </>
            ) : (
              <>
                <h3 className="relative text-lg font-bold text-foreground mb-2">
                  Módulo concluído!
                </h3>
                <p className="relative text-sm text-muted-foreground leading-relaxed mb-2">
                  {isGuest
                    ? `Falta ${pending.length} módulo${pending.length > 1 ? "s" : ""} pra desbloquear seu teste grátis.`
                    : `Ainda faltam ${pending.length} módulo${pending.length > 1 ? "s" : ""} no tutorial.`}
                </p>
                <p className="relative text-xs text-muted-foreground mb-5">
                  Pendentes: {pending.map((m) => LABELS[m]).join(", ")}
                </p>
                <button
                  onClick={handleClose}
                  className="relative w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar e terminar os outros
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return { onModuleComplete, CompletionDialog };
};
