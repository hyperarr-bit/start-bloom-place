import { forwardRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { trackEvent, captureLandingMeta } from "@/lib/analytics";
import coreLogo from "@/assets/core-logo.png";
import coreLogoBlack from "@/assets/core-logo-black.png";
import { useTheme } from "@/hooks/use-theme";

interface WelcomeScreenProps {
  onComplete?: () => void;
  onLogin?: () => void;
}

export const WelcomeScreen = forwardRef<HTMLDivElement, WelcomeScreenProps>(
  ({ onComplete, onLogin }, _ref) => {
    const { mode } = useTheme();
    const logoSrc = mode === "dark" ? coreLogo : coreLogoBlack;

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
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background overflow-hidden px-6 gap-6"
        style={{
          minHeight: "100dvh",
          paddingTop: "max(1.5rem, env(safe-area-inset-top))",
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="flex flex-col items-center gap-5 text-center"
        >
          <div className="relative">
            <div className="absolute inset-0 blur-3xl bg-foreground/5 rounded-full" aria-hidden />
            <img
              src={logoSrc}
              alt="CORE"
              className="relative w-28 h-28 md:w-36 md:h-36 object-contain select-none"
              draggable={false}
            />
          </div>

          <h1 className="text-[26px] md:text-4xl font-bold text-foreground tracking-tight leading-tight max-w-sm">
            Organize sua vida financeira em um só lugar
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.12 }}
          className="w-full max-w-sm flex flex-col items-stretch gap-3"
        >
          <button
            onClick={handleStart}
            className="w-full py-4 rounded-2xl bg-foreground text-background text-base font-semibold shadow-lg active:scale-[0.98] transition-transform"
          >
            Quero começar
          </button>

          <Link
            to="/auth"
            onClick={handleLogin}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center py-1"
          >
            Já tem uma conta? <span className="font-medium text-foreground">Entrar</span>
          </Link>
        </motion.div>
      </div>
    );
  }
);

WelcomeScreen.displayName = "WelcomeScreen";
