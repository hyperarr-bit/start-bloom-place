import { forwardRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { trackEvent, captureLandingMeta } from "@/lib/analytics";
import financasMockup from "@/assets/financas-mockup.png";

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
        className="fixed inset-0 z-[100] flex flex-col bg-background overflow-hidden px-6"
        style={{
          minHeight: "100dvh",
          paddingTop: "max(1.25rem, env(safe-area-inset-top))",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        {/* Header: wordmark + headline + subtitle */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center text-center gap-3 pt-2"
        >
          <span className="text-xl font-black tracking-tight text-foreground">CORE</span>
          <h1 className="text-[30px] md:text-4xl font-bold text-foreground tracking-tight leading-[1.1]">
            Tenha controle da<br />sua vida financeira
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-xs leading-snug">
            Acompanhe receitas, despesas e investimentos em um só lugar.
          </p>
        </motion.div>

        {/* Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="flex-1 min-h-0 flex items-center justify-center py-4"
        >
          <div
            className="relative h-full max-h-[420px] aspect-[9/19] rounded-[2.2rem] border-[6px] border-foreground/90 bg-background shadow-2xl overflow-hidden"
          >
            <AnimatedAppMockup scene="financas" />
          </div>
        </motion.div>

        {/* Footer CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
          className="w-full max-w-sm mx-auto flex flex-col items-stretch gap-3"
        >
          <button
            onClick={handleStart}
            className="w-full py-4 rounded-2xl bg-foreground text-background text-base font-semibold shadow-lg active:scale-[0.98] transition-transform"
          >
            Começar grátis
          </button>

          <Link
            to="/auth"
            onClick={handleLogin}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            Já tem uma conta? <span className="font-semibold text-foreground">Entrar</span>
          </Link>

          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>7 dias grátis. Sem complicação.</span>
          </div>
        </motion.div>
      </div>
    );
  }
);

WelcomeScreen.displayName = "WelcomeScreen";
