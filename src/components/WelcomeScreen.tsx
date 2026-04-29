import { useState, useEffect, useRef, useCallback, forwardRef } from "react";
import { motion } from "framer-motion";
import { Play, Loader2 } from "lucide-react";

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
      // Force muted before playing — autoplay only works guaranteed when muted.
      try {
        video.muted = true;
        // @ts-ignore — Safari/iOS specific
        video.defaultMuted = true;
      } catch {}
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
      const onEnded = () => {
        try {
          video.currentTime = 0;
          const p = video.play();
          if (p !== undefined) p.catch(() => setVideoState("blocked"));
        } catch {
          setVideoState("blocked");
        }
      };
      const onPause = () => {
        // Always try to resume — never let the video stay paused unless the user is gone.
        if (document.visibilityState === "visible" && !video.ended) {
          attemptPlay();
        }
      };
      const onError = () => setVideoState("error");

      video.addEventListener("loadedmetadata", onReady, { once: true });
      video.addEventListener("canplay", onReady, { once: true });
      video.addEventListener("ended", onEnded);
      video.addEventListener("pause", onPause);
      video.addEventListener("error", onError);

      if (video.readyState >= 2) attemptPlay();

      const onVisibility = () => {
        if (document.visibilityState === "visible" && video.paused) attemptPlay();
      };
      const onFocus = () => {
        if (video.paused) attemptPlay();
      };
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("focus", onFocus);
      window.addEventListener("pageshow", onFocus);

      // Watchdog: if the video gets paused by iOS Low Power Mode, energy saver,
      // or Safari background tabs, retry every 1.5s while we're visible.
      const watchdog = window.setInterval(() => {
        if (
          document.visibilityState === "visible" &&
          video.paused &&
          !video.ended &&
          video.readyState >= 2
        ) {
          attemptPlay();
        }
      }, 1500);

      // First-touch fallback: if autoplay was blocked, the very first tap/click
      // anywhere on the document will start playback (counts as user gesture).
      const onFirstGesture = () => {
        if (video.paused) attemptPlay();
      };
      document.addEventListener("touchstart", onFirstGesture, { passive: true });
      document.addEventListener("click", onFirstGesture);

      return () => {
        video.removeEventListener("loadedmetadata", onReady);
        video.removeEventListener("canplay", onReady);
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("pause", onPause);
        video.removeEventListener("error", onError);
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("focus", onFocus);
        window.removeEventListener("pageshow", onFocus);
        document.removeEventListener("touchstart", onFirstGesture);
        document.removeEventListener("click", onFirstGesture);
        window.clearInterval(watchdog);
      };
    }, [attemptPlay]);

    const handleScreenTap = useCallback(() => {
      if (videoState === "blocked" || videoState === "loading") attemptPlay();
    }, [videoState, attemptPlay]);

    const handleManualPlay = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        attemptPlay();
      },
      [attemptPlay]
    );

    const isPosterVisible = videoState !== "playing";
    const showPlayButton = videoState === "blocked" || videoState === "error";
    // Don't show a loader on first paint — the poster image already fills the screen.
    const showLoader = false;

    return (
      <div
        ref={ref}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-background overflow-hidden px-6 pt-10 pb-8"
        onClick={handleScreenTap}
      >
        <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 max-w-4xl w-full min-h-0">
          {/* iPhone CSS mockup */}
          <div className="relative z-10 flex items-center justify-center shrink min-h-0">
            <div
              className="iphone-frame relative"
              style={{
                aspectRatio: "9 / 19.5",
                height: "min(60vh, 600px)",
                maxWidth: "78vw",
              }}
            >
              {/* Side buttons */}
              <span className="iphone-btn iphone-btn-silent" />
              <span className="iphone-btn iphone-btn-volup" />
              <span className="iphone-btn iphone-btn-voldown" />
              <span className="iphone-btn iphone-btn-power" />

              {/* Inner bezel + screen */}
              <div className="iphone-bezel">
                <div className="iphone-screen">
                  <video
                    ref={videoRef}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    poster="/videos/app-preview-poster.jpg"
                    className="absolute inset-0 w-full h-full object-cover bg-black pointer-events-none"
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
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                      isPosterVisible ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                  />

                  {/* Overlay: play / loader */}
                  {(showPlayButton || showLoader) && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center">
                      {showPlayButton ? (
                        <button
                          type="button"
                          onClick={handleManualPlay}
                          aria-label="Tocar vídeo"
                          className="w-14 h-14 rounded-full bg-background/80 backdrop-blur border border-border shadow-lg flex items-center justify-center text-foreground hover:scale-105 active:scale-95 transition-transform"
                        >
                          <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
                        </button>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-background/70 backdrop-blur flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-foreground" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Title + CTA */}
          <div className="relative z-10 w-full max-w-sm flex flex-col items-center md:items-start gap-5 shrink-0">
            <h1 className="text-2xl md:text-4xl font-bold text-foreground text-center md:text-left leading-tight">
              Organize sua vida<br />em um só lugar
            </h1>

            <div className="w-full flex flex-col items-center md:items-start gap-2">
              <button
                onClick={onComplete}
                className="w-full py-3.5 rounded-xl bg-foreground text-background text-base font-semibold shadow-lg"
              >
                Começar
              </button>
              <button
                onClick={onLogin}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Já tem uma conta? <span className="font-medium text-foreground">Entrar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

WelcomeScreen.displayName = "WelcomeScreen";
