import { forwardRef, useEffect, useRef } from "react";

interface WelcomeScreenProps {
  onComplete: () => void;
  onLogin: () => void;
}

export const WelcomeScreen = forwardRef<HTMLDivElement, WelcomeScreenProps>(
  ({ onComplete, onLogin }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c) return;

      // Configurações que permitem decodificação inline em iOS sem abrir player nativo
      v.muted = true;
      v.defaultMuted = true;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute("muted", "");
      v.setAttribute("playsinline", "");
      v.setAttribute("webkit-playsinline", "true");
      v.setAttribute("preload", "auto");

      const ctx = c.getContext("2d");
      if (!ctx) return;

      let rafId = 0;
      let stopped = false;

      const resize = () => {
        const w = v.videoWidth;
        const h = v.videoHeight;
        if (w && h && (c.width !== w || c.height !== h)) {
          c.width = w;
          c.height = h;
        }
      };

      const draw = () => {
        if (stopped) return;
        if (v.readyState >= 2 && v.videoWidth) {
          resize();
          try { ctx.drawImage(v, 0, 0, c.width, c.height); } catch {}
        }
        rafId = requestAnimationFrame(draw);
      };

      const tryPlay = () => {
        const p = v.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      };

      const onLoaded = () => { resize(); tryPlay(); };
      v.addEventListener("loadedmetadata", onLoaded);
      v.addEventListener("loadeddata", onLoaded);
      v.addEventListener("canplay", tryPlay);

      // Se o WebView (TikTok) tentar abrir player nativo, abortamos imediatamente.
      const abortNative = () => {
        const anyV = v as unknown as { webkitExitFullscreen?: () => void };
        try { anyV.webkitExitFullscreen?.(); } catch {}
      };
      v.addEventListener("webkitbeginfullscreen", abortNative);

      // Retomar quando a aba volta a ficar visível
      const onVisibility = () => {
        if (document.visibilityState === "visible") tryPlay();
      };
      document.addEventListener("visibilitychange", onVisibility);

      tryPlay();
      rafId = requestAnimationFrame(draw);

      return () => {
        stopped = true;
        cancelAnimationFrame(rafId);
        v.removeEventListener("loadedmetadata", onLoaded);
        v.removeEventListener("loadeddata", onLoaded);
        v.removeEventListener("canplay", tryPlay);
        v.removeEventListener("webkitbeginfullscreen", abortNative);
        document.removeEventListener("visibilitychange", onVisibility);
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
                <div className="iphone-screen relative overflow-hidden bg-black">
                  {/* <video> fonte: invisível mas presente no DOM (necessário para iOS decodificar inline) */}
                  <video
                    ref={videoRef}
                    src="/videos/app-preview.mp4"
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
                    style={{
                      position: "absolute",
                      width: 1,
                      height: 1,
                      opacity: 0,
                      pointerEvents: "none",
                      left: -9999,
                      top: -9999,
                    }}
                  />
                  {/* Canvas: o que o usuário enxerga. WebView nenhum sequestra canvas. */}
                  <canvas
                    ref={canvasRef}
                    aria-hidden
                    className="absolute inset-0 w-full h-full select-none"
                    style={{
                      objectFit: "cover",
                      WebkitUserSelect: "none",
                      userSelect: "none",
                      pointerEvents: "none",
                      display: "block",
                    }}
                  />
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
