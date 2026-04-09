import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface WelcomeScreenProps {
  onComplete: () => void;
  onLogin: () => void;
}

export const WelcomeScreen = ({ onComplete, onLogin }: WelcomeScreenProps) => {
  const [showButton, setShowButton] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowButton(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      video.play().catch(() => {});
    };

    if (video.readyState >= 3) {
      setVideoReady(true);
      tryPlay();
    } else {
      video.addEventListener('canplay', () => {
        setVideoReady(true);
        tryPlay();
      }, { once: true });
    }

    const interval = setInterval(() => {
      if (video.readyState >= 3) {
        setVideoReady(true);
        tryPlay();
        clearInterval(interval);
      }
    }, 300);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/10 pointer-events-none" />

      {/* Logo */}
      <motion.div
        className="relative z-10 text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <h1 className="text-3xl font-bold text-foreground tracking-[0.2em]">CORE</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Organize toda a sua vida em um só lugar
        </p>
      </motion.div>

      {/* iPhone frame with video */}
      <motion.div
        className="relative z-10"
        initial={{ opacity: 0, y: 80, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.5 }}
      >
        <div className="relative w-[240px] h-[519px] rounded-[44px] bg-[#1a1a1a] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.5)] p-[10px]">
          {/* Screen with video */}
          <div className="w-full h-full rounded-[34px] overflow-hidden bg-muted">
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              className={`w-full h-full object-cover transition-opacity duration-500 ${videoReady ? 'opacity-100' : 'opacity-0'}`}
              src="/videos/app-preview.mp4"
            />
          </div>

          {/* Home Indicator */}
          <div className="absolute bottom-[8px] left-1/2 -translate-x-1/2 w-[100px] h-[4px] bg-white/20 rounded-full" />
        </div>
      </motion.div>

      {/* CTA + Login */}
      <AnimatePresence>
        {showButton && (
          <motion.div
            className="relative z-10 mt-5 flex flex-col items-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <motion.button
              onClick={onComplete}
              className="px-8 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg"
              whileTap={{ scale: 0.96 }}
            >
              Começar
            </motion.button>
            <button
              onClick={onLogin}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Já tem uma conta? <span className="font-medium text-foreground">Entrar</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
