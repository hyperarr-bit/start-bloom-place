import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BotaoPorta } from "./BotaoPorta";

/**
 * TELA 0 DA PORTA — a welcome com vídeo (escolha do dono), adaptada da
 * WelcomeCalai do app 1.0.14 (ramo v14). Na web: sem ATT, sem "Restaurar
 * compras", sem termos. O iPhone com o passeio pelo app em loop, uma frase,
 * a prova social, "Começar" e "Já tem conta? Entrar" (→ /entrar da web)
 * ABAIXO do botão.
 *
 * Os arquivos de public/funil/ são os MESMOS do v14, byte a byte.
 */
export const VIDEO_WELCOME = "/funil/welcome-app.mp4";
export const POSTER_WELCOME = "/funil/welcome-app.jpg";
export const MOLDURA_WELCOME = "/funil/iphone-mockup.svg";

export function WelcomePorta({ onComecar, onEntrar, onVideo }: {
  onComecar: () => void;
  onEntrar: () => void;
  onVideo?: (ok: boolean, motivo?: string) => void;
}) {
  const semMovimento = useReducedMotion() === true;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rodouRef = useRef(false);
  const [falhou, setFalhou] = useState(false);

  /* autoplay à mão: o React põe `muted` como propriedade, e há motores que só
   * liberam o autoplay com o ATRIBUTO no HTML. Se negar, fica o poster. */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    try { v.setAttribute("muted", ""); } catch { /* noop */ }
    let p: Promise<void> | undefined;
    try { p = v.play(); } catch { p = undefined; }
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        if (rodouRef.current) return;
        setFalhou(true);
        onVideo?.(false, "autoplay");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="wpt" data-testid="porta-welcome">
      <style>{CSS_WPT}</style>
      <div className="wpt-col">
        <motion.div
          className="wpt-palco"
          initial={semMovimento ? false : { opacity: 0, y: 56, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className="wpt-fone"
            aria-hidden
            animate={semMovimento ? undefined : { y: [0, -3, 0] }}
            transition={semMovimento ? undefined : { duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
          >
            <div className="wpt-tela">
              {/* autoplay negado (modo economia de bateria, webview): no lugar do vídeo com o botão de
                  play nativo por cima, a tela parada do app (o poster), limpa */}
              {falhou && <img className="wpt-video" src={POSTER_WELCOME} alt="" draggable={false} data-testid="porta-poster" />}
              <video
                style={falhou ? { display: "none" } : undefined}
                ref={videoRef}
                className="wpt-video"
                src={VIDEO_WELCOME}
                poster={POSTER_WELCOME}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                disablePictureInPicture
                onPlaying={() => { if (rodouRef.current) return; rodouRef.current = true; setFalhou(false); onVideo?.(true); }}
                onError={() => { if (rodouRef.current) return; setFalhou(true); onVideo?.(false, "carregar"); }}
                data-testid="porta-video"
                data-falhou={falhou ? "" : undefined}
              />
            </div>
            <img className="wpt-moldura" src={MOLDURA_WELCOME} alt="" draggable={false} />
          </motion.div>
        </motion.div>

        <div className="wpt-corpo">
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4 }} data-testid="porta-welcome-titulo">
            Sua vida inteira organizada num app só.
          </motion.h1>
          <motion.p className="wpt-prova" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45, duration: 0.4 }}>
            <span className="wpt-st">★★★★★</span> <b>+1000 pessoas</b> organizando a vida
          </motion.p>
        </div>

        <motion.div className="wpt-rodape" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.4 }}>
          <BotaoPorta
            fixo={false}
            seta={false}
            texto="Começar"
            testid="porta-comecar"
            onClick={onComecar}
            secundario={{ texto: <>Já tem conta? <b>Entrar</b></>, onClick: onEntrar, testid: "porta-welcome-entrar" }}
          />
        </motion.div>
      </div>
    </div>
  );
}

const CSS_WPT = `
.wpt { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 30; overflow: hidden; display: flex; justify-content: center; -webkit-font-smoothing: antialiased; background: #ffffff; color: #16121c; }
.wpt-col { position: relative; width: 100%; max-width: 430px; display: flex; flex-direction: column; padding: calc(14px + env(safe-area-inset-top)) 0 0; }
/* o palco do telefone ENCOLHE antes do texto e do botão: num iPhone SE o vídeo fica menor, o Começar nunca sai da tela */
.wpt-palco { flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 6px 10px 4px; }
.wpt-fone { position: relative; height: 100%; max-height: 100%; width: auto; max-width: 100%; aspect-ratio: 430 / 880; border-radius: 15.8% / 7.73%; box-shadow: 0 34px 60px -24px rgba(22,18,28,.5), 0 10px 22px -14px rgba(22,18,28,.25); }
.wpt-moldura { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: block; pointer-events: none; user-select: none; -webkit-user-drag: none; z-index: 2; }
.wpt-tela { position: absolute; top: 1.14%; right: 2.33%; bottom: 1.14%; left: 2.33%; border-radius: 13.8% / 6.75%; overflow: hidden; background: #ffffff; padding-top: 9.5%; z-index: 1; }
/* sem o botão de play nativo por cima (modo economia de bateria nega o autoplay): fica o poster limpo */
.wpt-video::-webkit-media-controls, .wpt-video::-webkit-media-controls-start-playback-button, .wpt-video::-webkit-media-controls-overlay-play-button { display: none !important; -webkit-appearance: none; opacity: 0; }
.wpt-video { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; background: #ffffff; }
.wpt-corpo { flex: 0 0 auto; text-align: center; padding: 14px 22px 0; }
.wpt h1 { margin: 0; font-weight: 900; letter-spacing: -.03em; line-height: 1.08; font-size: 28px; font-size: clamp(25px, 7.4vw, 32px); }
.wpt-prova { margin: 9px 0 0; font-size: 13.5px; color: #7d8691; }
.wpt-prova b { color: #16121c; }
.wpt-st { color: #f0a500; letter-spacing: .06em; }
.wpt-rodape { flex: 0 0 auto; display: flex; flex-direction: column; align-items: stretch; padding-top: 6px; }
`;
