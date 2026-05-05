import { forwardRef, useEffect, useRef, useState } from "react";

interface WelcomeScreenProps {
  onComplete: () => void;
  onLogin: () => void;
}

const isTikTokWebView = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /BytedanceWebview|TikTok|musical_ly|Bytedance/i.test(ua);
};

export const WelcomeScreen = forwardRef<HTMLDivElement, WelcomeScreenProps>(
  ({ onComplete, onLogin }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isTikTok, setIsTikTok] = useState(false);

    useEffect(() => {
      setIsTikTok(isTikTokWebView());
    }, []);

    useEffect(() => {
      if (isTikTok) return;
      const v = videoRef.current;
      if (!v) return;

      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.setAttribute("muted", "");
      v.setAttribute("playsinline", "");
      v.setAttribute("webkit-playsinline", "true");

      const tryPlay = () => {
        const p = v.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      };

      const abortNative = () => {
        try { (v as unknown as { webkitExitFullscreen?: () => void }).webkitExitFullscreen?.(); } catch {}
        try { v.pause(); tryPlay(); } catch {}
      };
      v.addEventListener("webkitbeginfullscreen", abortNative);

      const onVisibility = () => {
        if (document.visibilityState === "visible") tryPlay();
      };
      document.addEventListener("visibilitychange", onVisibility);

      tryPlay();

      return () => {
        v.removeEventListener("webkitbeginfullscreen", abortNative);
        document.removeEventListener("visibilitychange", onVisibility);
      };
    }, [isTikTok]);

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
                <div className="iphone-screen relative overflow-hidden bg-black">
                  {isTikTok ? (
                    <img
                      src="/videos/app-preview-poster.jpg"
                      alt="Prévia do app CORE"
                      className="absolute inset-0 w-full h-full select-none"
                      style={{ objectFit: "cover", pointerEvents: "none", display: "block" }}
                      draggable={false}
                    />
                  ) : (
                    <>
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
                        {...({ "webkit-playsinline": "true" } as Record<string, string>)}
                        aria-hidden
                        tabIndex={-1}
                        className="absolute inset-0 w-full h-full select-none"
                        style={{ objectFit: "cover", pointerEvents: "none", display: "block" }}
                      />
                      <div
                        className="absolute inset-0"
                        style={{ pointerEvents: "auto", touchAction: "none" }}
                        onPointerDown={(e) => e.preventDefault()}
                        onTouchStart={(e) => e.preventDefault()}
                        onClick={(e) => e.preventDefault()}
                        aria-hidden
                      />
                    </>
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
