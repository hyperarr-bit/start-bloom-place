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
        className="fixed inset-0 z-[100] flex flex-col items-center bg-background overflow-hidden px-6"
        style={{
          minHeight: "100dvh",
          paddingTop: "max(1.25rem, env(safe-area-inset-top))",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        {/* Top: brand wordmark */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex-none pt-6 md:pt-10"
        >
          <span className="text-sm font-black tracking-widest text-muted-foreground uppercase">Core</span>
        </motion.div>

        {/* Middle: headline + subtitle */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="flex-1 flex flex-col items-center justify-center text-center w-full max-w-sm gap-4"
        >
          <h1 className="text-[32px] md:text-[40px] font-bold text-foreground tracking-tight leading-[1.1]">
            Tenha controle da<br />sua vida financeira
          </h1>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            Acompanhe receitas, despesas e investimentos em um só lugar.
          </p>
        </motion.div>

        {/* Bottom: CTA + login link */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.25 }}
          className="flex-none w-full max-w-sm pb-6 md:pb-10 flex flex-col items-stretch gap-3"
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
    );
  }
);

WelcomeScreen.displayName = "WelcomeScreen";
