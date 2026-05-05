import { forwardRef, useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

interface WelcomeScreenProps {
  onComplete: () => void;
  onLogin: () => void;
}

export const WelcomeScreen = forwardRef<HTMLDivElement, WelcomeScreenProps>(
  ({ onComplete, onLogin }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    // Quando o usuário fecha o player nativo (iOS WebView/TikTok), NÃO tentamos
    // mais dar play automaticamente — senão o player nativo fica reabrindo sozinho.
    const userDismissedRef = useRef(false);

    const playPreviewVideo = () => {
      const v = videoRef.current;
      if (!v) return;
      userDismissedRef.current = false; // usuário pediu pra tocar de novo
      v.muted = true;
      v.defaultMuted = true;
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => setIsVideoPlaying(false));
    };

    useEffect(() => {
      const v = videoRef.current;
      if (!v) return;
      v.muted = true;
      v.defaultMuted = true;
      v.setAttribute("muted", "");
      v.setAttribute("playsinline", "");
      v.setAttribute("webkit-playsinline", "true");

      const tryPlay = () => {
        if (userDismissedRef.current) return; // respeita o "sair" do usuário
        if (!v.paused) return;
        const p = v.play();
        if (p && typeof p.catch === "function") p.catch(() => setIsVideoPlaying(false));
      };

      const syncPlayingState = () => setIsVideoPlaying(!v.paused && !v.ended);

      // iOS dispara este evento quando o usuário SAI do player nativo fullscreen
      const onExitFullscreen = () => {
        userDismissedRef.current = true;
        try { v.pause(); } catch {}
        setIsVideoPlaying(false);
      };

      tryPlay();
      const onCanPlay = () => tryPlay();
      const onLoadedData = () => tryPlay();

      v.addEventListener("play", syncPlayingState);
      v.addEventListener("pause", syncPlayingState);
      v.addEventListener("ended", syncPlayingState);
      v.addEventListener("canplay", onCanPlay);
      v.addEventListener("loadeddata", onLoadedData);
      v.addEventListener("webkitendfullscreen", onExitFullscreen);
      v.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement) onExitFullscreen();
      });

      return () => {
        v.removeEventListener("play", syncPlayingState);
        v.removeEventListener("pause", syncPlayingState);
        v.removeEventListener("ended", syncPlayingState);
        v.removeEventListener("canplay", onCanPlay);
        v.removeEventListener("loadeddata", onLoadedData);
        v.removeEventListener("webkitendfullscreen", onExitFullscreen);
      };
    }, []);

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
                <div className="iphone-screen relative overflow-hidden">
                  <video
                    ref={videoRef}
                    src="/videos/app-preview.mp4"
                    poster="/videos/app-preview-poster.jpg"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    disablePictureInPicture
                    disableRemotePlayback
                    controls={false}
                    x-webkit-airplay="deny"
                    controlsList="nodownload nofullscreen noremoteplayback"
                    {...({ "webkit-playsinline": "true" } as Record<string, string>)}
                    draggable={false}
                    tabIndex={-1}
                    aria-hidden="true"
                    style={{ pointerEvents: "none", WebkitUserSelect: "none", userSelect: "none" }}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                  />
                  <div
                    data-video-gesture-guard
                    className="absolute inset-0 z-30 cursor-default touch-none select-none"
                    aria-hidden="true"
                    onContextMenu={(e) => e.preventDefault()}
                    onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  />
                  {!isVideoPlaying && (
                    <button
                      type="button"
                      aria-label="Reproduzir prévia do aplicativo"
                      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); playPreviewVideo(); }}
                      onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); playPreviewVideo(); }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); playPreviewVideo(); }}
                      className="absolute inset-0 z-40 flex items-center justify-center bg-background/20 text-foreground backdrop-blur-[1px]"
                    >
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background/85 shadow-lg">
                        <Play className="h-7 w-7 fill-current pl-0.5" aria-hidden="true" />
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
