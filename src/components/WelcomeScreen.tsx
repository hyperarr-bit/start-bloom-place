import { useState, useEffect, useRef, useCallback, forwardRef } from "react";
import { motion } from "framer-motion";
import iphoneMockup from "@/assets/iphone-mockup.png";

interface WelcomeScreenProps {
  onComplete: () => void;
  onLogin: () => void;
}

type VideoState = "loading" | "playing" | "blocked" | "error";

export const WelcomeScreen = forwardRef<HTMLDivElement, WelcomeScreenProps>(
  ({ onComplete, onLogin }, ref) => {
    const [videoState, setVideoState] = useState<VideoState>("loading");
    const videoRef = useRef<HTMLVideoElement>(null);

    const attemptPlay = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setVideoState("playing"))
          .catch(() => setVideoState("blocked"));
      }
    }, []);

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

    const handleScreenTap = useCallback(() => {
      if (videoState === "blocked" || videoState === "loading") {
        attemptPlay();
      }
    }, [videoState, attemptPlay]);

    const isPosterVisible = videoState !== "playing";

    return (
      <motion.div
        ref={ref}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background overflow-hidden px-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.4 } }}
        onClick={handleScreenTap}
      >
        {/* Mobile: vertical stack / Desktop: side-by-side */}
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16 max-w-4xl w-full">
          {/* iPhone frame with video */}
          <motion.div
            className="relative z-10 flex items-center shrink-0"
            initial={{ opacity: 0, y: 80, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.3 }}
          >
            <div className="relative w-[180px] h-[390px] md:w-[220px] md:h-[476px] rounded-[40px] bg-[#1a1a1a] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.5)] p-[10px]">
              <div className="w-full h-full rounded-[30px] overflow-hidden bg-muted relative">
                <video
                  ref={videoRef}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  poster="/videos/app-preview-poster.jpg"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
                  // @ts-ignore
                  webkit-playsinline="true"
                  disablePictureInPicture
                  onPlaying={() => setVideoState("playing")}
                >
                  <source src="/videos/app-preview.mp4" type="video/mp4" />
                </video>
                <img
                  src="/videos/app-preview-poster.jpg"
                  alt=""
                  className={`absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-500 ${
                    isPosterVisible ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                />
              </div>
              <div className="absolute bottom-[8px] left-1/2 -translate-x-1/2 w-[100px] h-[4px] bg-white/20 rounded-full" />
            </div>
          </motion.div>

          {/* Title + CTA */}
          <div className="relative z-10 w-full md:max-w-sm flex flex-col items-center md:items-start gap-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground text-center md:text-left leading-tight">
              Organize sua vida<br />em um só lugar
            </h1>

            <div className="w-full flex flex-col items-center md:items-start gap-3">
              <button
                onClick={onComplete}
                className="w-full py-5 rounded-xl bg-foreground text-background text-base font-semibold shadow-lg"
              >
                Começar
              </button>
              <button
                onClick={onLogin}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors mt-1"
              >
                Já tem uma conta? <span className="font-medium text-foreground">Entrar</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
);

WelcomeScreen.displayName = "WelcomeScreen";
