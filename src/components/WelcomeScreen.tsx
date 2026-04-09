import { useState, useEffect, useRef, useCallback, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface WelcomeScreenProps {
  onComplete: () => void;
  onLogin: () => void;
}

type VideoState = "loading" | "playing" | "blocked" | "error";

export const WelcomeScreen = forwardRef<HTMLDivElement, WelcomeScreenProps>(
  ({ onComplete, onLogin }, ref) => {
    const [showButton, setShowButton] = useState(false);
    const [videoState, setVideoState] = useState<VideoState>("loading");
    const videoRef = useRef<HTMLVideoElement>(null);

    const attemptPlay = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setVideoState("playing");
          })
          .catch(() => {
            setVideoState("blocked");
          });
      }
    }, []);

    // Show CTA after delay
    useEffect(() => {
      const timer = setTimeout(() => setShowButton(true), 2000);
      return () => clearTimeout(timer);
    }, []);

    // Autoplay logic
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const onReady = () => attemptPlay();

      video.addEventListener("loadedmetadata", onReady, { once: true });
      video.addEventListener("canplay", onReady, { once: true });

      if (video.readyState >= 2) {
        attemptPlay();
      }

      const onVisibility = () => {
        if (document.visibilityState === "visible" && video.paused) {
          attemptPlay();
        }
      };
      document.addEventListener("visibilitychange", onVisibility);

      return () => {
        video.removeEventListener("loadedmetadata", onReady);
        video.removeEventListener("canplay", onReady);
        document.removeEventListener("visibilitychange", onVisibility);
      };
    }, [attemptPlay]);

    // Tap-to-play fallback
    const handleScreenTap = useCallback(() => {
      if (videoState === "blocked" || videoState === "loading") {
        attemptPlay();
      }
    }, [videoState, attemptPlay]);

    // Poster hides when video is playing
    const isPosterVisible = videoState !== "playing";

    return (
      <motion.div
        ref={ref}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.4 } }}
        onClick={handleScreenTap}
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
            {/* Screen */}
            <div className="w-full h-full rounded-[34px] overflow-hidden bg-muted relative">
              {/* Video — ALWAYS opacity-100 so iOS allows autoplay */}
              <video
                ref={videoRef}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                poster="/videos/app-preview-poster.jpg"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
                // @ts-ignore — webkit attribute for iOS
                webkit-playsinline="true"
                disablePictureInPicture
                onPlaying={() => setVideoState("playing")}
              >
                <source src="/videos/app-preview.mp4" type="video/mp4" />
              </video>

              {/* Poster overlay — sits on top, fades out when video plays */}
              <img
                src="/videos/app-preview-poster.jpg"
                alt=""
                className={`absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-500 ${
                  isPosterVisible ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
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
  }
);

WelcomeScreen.displayName = "WelcomeScreen";
