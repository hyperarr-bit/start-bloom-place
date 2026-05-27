import { forwardRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { trackEvent, captureLandingMeta } from "@/lib/analytics";

interface WelcomeScreenProps {
  onComplete?: () => void;
  onLogin?: () => void;
}

export const WelcomeScreen = forwardRef<HTMLDivElement, WelcomeScreenProps>(
  ({ onComplete, onLogin }, _ref) => {

    useEffect(() => {
      captureLandingMeta();
      trackEvent("landing_view", {});
    }, []);

    const handleStart = () => {
      trackEvent("start_clicked", { destination: "financas" });
      onComplete?.();
      window.location.href = "/financas";
    };

    const handleLogin = () => {
      trackEvent("login_clicked", {});
      onLogin?.();
    };

    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background overflow-hidden px-6"
        style={{
          minHeight: "100dvh",
          paddingTop: "max(1.25rem, env(safe-area-inset-top))",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex flex-col items-center justify-center text-center gap-6 w-full max-w-sm">
          {/* Header: wordmark + headline + subtitle */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col items-center text-center gap-2"
          >
            <span className="text-xl font-black tracking-tight text-foreground">CORE</span>
            <h1 className="text-[30px] md:text-4xl font-bold text-foreground tracking-tight leading-[1.1]">
              Tenha controle da<br />sua vida financeira
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-xs leading-snug">
              Acompanhe receitas, despesas e investimentos em um só lugar.
            </p>
          </motion.div>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
            className="w-full flex flex-col items-stretch gap-1"
          >
            <button
              onClick={handleStart}
              className="w-full py-4 rounded-2xl bg-foreground text-background text-base font-semibold shadow-lg active:scale-[0.98] transition-transform"
            >
              Começar
            </button>

            <Link
              to="/auth"
              onClick={handleLogin}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
            >
              Já tem uma conta? <span className="font-semibold text-foreground">Entrar</span>
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }
);

WelcomeScreen.displayName = "WelcomeScreen";
