import { useState, useEffect, useRef, useCallback, forwardRef } from "react";
import { Play } from "lucide-react";

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
      try {
        video.muted = true;
        video.volume = 0;
        // @ts-ignore
        video.defaultMuted = true;
        video.setAttribute("muted", "");
        video.setAttribute("playsinline", "");
        video.setAttribute("webkit-playsinline", "true");
      } catch {}
      try {
        const p = video.play();
        if (p !== undefined) {
          p.then(() => setVideoState("playing")).catch(() => {
            setVideoState((prev) => (prev === "playing" ? prev : "blocked"));
          });
        }
      } catch {
        setVideoState("blocked");
      }
    }, []);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      // Try immediately on mount — preload="auto" + preload <link> mean
      // the asset is usually ready when we get here.
      attemptPlay();

      const onCanPlay = () => attemptPlay();
      const onPlaying = () => setVideoState("playing");
      const onTimeUpdate = () => {
        if (video.currentTime > 0 && !video.paused) setVideoState("playing");
      };
      const onEnded = () => {
        try {
          video.currentTime = 0;
          const p = video.play();
          if (p !== undefined) p.catch(() => {});
        } catch {}
      };
      const onPause = () => {
        if (document.visibilityState === "visible" && !video.ended) attemptPlay();
      };
      const onError = () => setVideoState("error");

      video.addEventListener("canplay", onCanPlay);
      video.addEventListener("playing", onPlaying);
      video.addEventListener("timeupdate", onTimeUpdate);
      video.addEventListener("ended", onEnded);
      video.addEventListener("pause", onPause);
      video.addEventListener("error", onError);

      const onVisibility = () => {
        if (document.visibilityState === "visible" && video.paused) attemptPlay();
      };
      const onFocus = () => { if (video.paused) attemptPlay(); };
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("focus", onFocus);
      window.addEventListener("pageshow", onFocus);

      const watchdog = window.setInterval(() => {
        if (
          document.visibilityState === "visible" &&
          video.paused &&
          !video.ended
        ) {
          attemptPlay();
        }
      }, 1500);

      const onFirstGesture = () => { if (video.paused) attemptPlay(); };
      document.addEventListener("touchstart", onFirstGesture, { passive: true });
      document.addEventListener("click", onFirstGesture);

      return () => {
        video.removeEventListener("canplay", onCanPlay);
        video.removeEventListener("playing", onPlaying);
        video.removeEventListener("timeupdate", onTimeUpdate);
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

    const isPosterVisible = videoState !== "playing";
    const showPlayButton = videoState === "blocked" || videoState === "error";

    return (
      <div
        ref={ref}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background overflow-hidden px-6"
        style={{
          minHeight: "100dvh",
          paddingTop: "max(2.5rem, env(safe-area-inset-top))",
          paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-16 max-w-4xl w-full min-h-0">
          <div className="relative z-10 flex items-center justify-center shrink min-h-0">
            <div
              className="iphone-frame relative"
              style={{
                aspectRatio: "9 / 19.5",
                height: "min(62dvh, 620px)",
                maxWidth: "82vw",
              }}
            >
              <span className="iphone-btn iphone-btn-silent" />
              <span className="iphone-btn iphone-btn-volup" />
              <span className="iphone-btn iphone-btn-voldown" />
              <span className="iphone-btn iphone-btn-power" />

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
                    className="absolute inset-0 w-full h-full object-cover bg-black pointer-events-none select-none"
                    // @ts-ignore
                    webkit-playsinline="true"
                    // @ts-ignore
                    x5-playsinline="true"
                    disablePictureInPicture
                    disableRemotePlayback
                    controls={false}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <source src="/videos/app-preview.mp4" type="video/mp4" />
                  </video>

                  <img
                    src="/videos/app-preview-poster.jpg"
                    alt=""
                    draggable={false}
                    className={`absolute inset-0 w-full h-full object-cover pointer-events-none select-none transition-opacity duration-300 ${
                      isPosterVisible ? "opacity-100" : "opacity-0"
                    }`}
                  />

                  {/* Tap layer — captures gesture without ever opening the native player */}
                  <div
                    className="absolute inset-0"
                    onClick={(e) => { e.stopPropagation(); attemptPlay(); }}
                    onContextMenu={(e) => e.preventDefault()}
                  />

                  {showPlayButton && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); attemptPlay(); }}
                      aria-label="Reproduzir vídeo"
                      className="absolute inset-0 flex items-center justify-center bg-black/20"
                    >
                      <span className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                        <Play className="w-7 h-7 text-black ml-0.5" fill="currentColor" />
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

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
