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

      // Fallback: if the video is actually playing but the "playing" event never fired,
      // hide the poster after a short delay so the user sees the video.
      const fallback = setTimeout(() => {
        if (video && !video.paused && video.currentTime > 0) {
          setVideoState("playing");
        }
      }, 1500);

      return () => {
        video.removeEventListener("loadedmetadata", onReady);
        video.removeEventListener("canplay", onReady);
        document.removeEventListener("visibilitychange", onVisibility);
        clearTimeout(fallback);
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
            <div className="relative w-[240px] md:w-[290px]" style={{ aspectRatio: "593 / 1080" }}>
              {/* Screen content (video + poster) sits behind the frame */}
              <div
                className="absolute overflow-hidden bg-muted"
                style={{
                  top: "13.4%",
                  bottom: "13.4%",
                  left: "19.6%",
                  right: "19.6%",
                  borderRadius: "9%",
                }}
              >
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
              {/* iPhone frame overlay */}
              <img
                src={iphoneMockup}
                alt=""
                aria-hidden
                className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20 select-none"
                draggable={false}
              />
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
