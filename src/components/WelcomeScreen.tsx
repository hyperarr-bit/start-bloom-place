import { forwardRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { trackEvent, captureLandingMeta } from "@/lib/analytics";
import { PreSignupTutorial } from "@/components/welcome/PreSignupTutorial";
import coreLogo from "/core-logo.png";

interface WelcomeScreenProps {
  onComplete?: () => void;
  onLogin?: () => void;
}

export const WelcomeScreen = forwardRef<HTMLDivElement, WelcomeScreenProps>(
  ({ onComplete, onLogin }, _ref) => {
    const [showTutorial, setShowTutorial] = useState(false);

    useEffect(() => {
      // Captura UTM e registra a visita do anúncio/landing
      captureLandingMeta();
      trackEvent("landing_view", {});
    }, []);

    const handleStart = () => {
      trackEvent("start_clicked", { destination: "pre_signup_tutorial" });
      onComplete?.();
      setShowTutorial(true);
    };

    const handleLogin = () => {
      trackEvent("login_clicked", {});
      onLogin?.();
    };

    if (showTutorial) {
      return <PreSignupTutorial onClose={() => setShowTutorial(false)} />;
    }

    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-background overflow-hidden px-6"
        style={{
          minHeight: "100dvh",
          paddingTop: "max(3rem, env(safe-area-inset-top))",
          paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))",
        }}
      >
        {/* spacer */}
        <div />

        {/* Logo + tagline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="flex flex-col items-center gap-6 text-center"
        >
          <div className="relative">
            <div className="absolute inset-0 blur-3xl bg-foreground/5 rounded-full" aria-hidden />
            <img
              src={coreLogo}
              alt="CORE"
              className="relative w-32 h-32 md:w-40 md:h-40 object-contain select-none"
              draggable={false}
            />
          </div>

          <div className="space-y-2 max-w-sm">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
              Bem-vindo ao CORE
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Organize sua vida — finanças, treino, dieta e rotina — em um só lugar.
            </p>
          </div>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.12 }}
          className="w-full max-w-sm flex flex-col items-stretch gap-3"
        >
          <button
            onClick={handleStart}
            className="w-full py-3.5 rounded-xl bg-foreground text-background text-base font-semibold shadow-lg active:scale-[0.98] transition-transform"
          >
            Quero começar
          </button>

          <Link
            to="/auth"
            onClick={handleLogin}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center py-2"
          >
            Já tem uma conta? <span className="font-medium text-foreground">Entrar</span>
          </Link>
        </motion.div>
      </div>
    );
  }
);

WelcomeScreen.displayName = "WelcomeScreen";
