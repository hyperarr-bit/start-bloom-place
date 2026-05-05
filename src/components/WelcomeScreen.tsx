import { forwardRef } from "react";

interface WelcomeScreenProps {
  onComplete: () => void;
  onLogin: () => void;
}

export const WelcomeScreen = forwardRef<HTMLDivElement, WelcomeScreenProps>(
  ({ onComplete, onLogin }, ref) => {
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
