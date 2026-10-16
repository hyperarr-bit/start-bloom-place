import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import { AREAS, type AreaKey } from "@/lib/funnel";
import { BotaoDoFunil } from "@/pages/funis/w/BotaoDoFunil";
import { FUNIL_APP_WEB, VARIANTE_APP } from "./conteudo";

/**
 * A WELCOME DO APP NA WEB (/assinatura, 16/10) — a tela 1 do iPhone 1.0.15 (WelcomeCalai do ComecarW): um iPhone no
 * centro com o VÍDEO do app em loop (mudo, inline, poster antes do 1º quadro), uma frase, a prova curta e o
 * "Começar" no rodapé, com "Já tem conta? Entrar" ABAIXO do botão (como no app).
 *
 * O que muda da cópia do app (WelcomeCalai mora no ramo da 1.0.15, fora do main): sem o pedido de rastreamento da
 * Apple (ATT só existe no app) e sem o aviso "já comprou pelo site?" (isto É o site). Eventos com o funil da web:
 * `app_welcome_view`/`app_welcome_start`/`app_welcome_login` levam `funil: "app_web"` (os do app não levam), e
 * `welcome_video_play`/`welcome_video_erro` idem — as séries do app não se misturam com as da web.
 */
export const VIDEO_WELCOME = "/funil/welcome-app.mp4";
export const POSTER_WELCOME = "/funil/welcome-app.jpg";
export const MOLDURA_WELCOME = "/funil/iphone-mockup.svg";
/** 17/10 (dono: "o vídeo não funciona, só fica um print"): autoplay negado (NotAllowedError — Modo Pouca Energia;
 *  17% das aberturas no próprio app) → em vez da tela parada, o celular passa as 6 telas do passeio (as mesmas da
 *  Porta, 640×1388 como o vídeo), 2 s cada; o 1º toque continua tentando o vídeo. */
export const TELAS_PASSEIO = [1, 2, 3, 4, 5, 6].map((n) => `/porta/tour/${n}.jpg`);
const PASSEIO_MS = 2000;

const PROMESSA_PADRAO = "Sua vida inteira organizada num app só.";
const PROMESSA_DA_ROTA: Record<AreaKey, string> = {
  dinheiro: "Seu dinheiro inteiro, num app só.",
  rotina: "Sua rotina inteira, num app só.",
  corpo: "Treino e dieta, num app só.",
  saude: "Sua saúde inteira, num app só.",
  metas: "Suas metas, finalmente, num app só.",
};

const TAG = { funil: FUNIL_APP_WEB, variante: VARIANTE_APP, web: true };

export function WelcomeVideo({ onComecar, onEntrar, area }: { onComecar: () => void; onEntrar: () => void; area?: AreaKey | null }) {
  const semMovimento = useReducedMotion() === true;
  const [videoFalhou, setVideoFalhou] = useState(false);
  const [quadro, setQuadro] = useState(0);
  useEffect(() => {
    if (!videoFalhou) return;
    const t = window.setInterval(() => setQuadro((q) => (q + 1) % TELAS_PASSEIO.length), PASSEIO_MS);
    return () => window.clearInterval(t);
  }, [videoFalhou]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rodouRef = useRef(false);

  useEffect(() => { trackEvent("app_welcome_view", { calai: true, ...TAG }); }, []);

  /* AUTOPLAY À MÃO (como no app): `muted` como atributo + play(); negado (Modo Pouca Energia do iPhone) → fica o
   * poster, e o 1º toque na tela tenta de novo. */
  const tocar = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    try { v.setAttribute("muted", ""); } catch { /* noop */ }
    let p: Promise<void> | undefined;
    try { p = v.play(); } catch { p = undefined; }
    if (p && typeof p.catch === "function") {
      p.catch((e: unknown) => {
        if (rodouRef.current) return;
        setVideoFalhou(true);
        trackEvent("welcome_video_erro", { motivo: "autoplay", erro: String((e as { name?: string })?.name ?? e).slice(0, 80), ...TAG });
      });
    }
  };
  useEffect(() => { tocar(); }, []);
  const aoRodar = () => {
    if (rodouRef.current) return;
    rodouRef.current = true;
    setVideoFalhou(false);
    trackEvent("welcome_video_play", { ...TAG });
  };
  const aoFalhar = () => {
    if (rodouRef.current) return;
    setVideoFalhou(true);
    trackEvent("welcome_video_erro", { motivo: "carregar", code: videoRef.current?.error?.code ?? null, ...TAG });
  };

  const promessa = area && area in AREAS ? PROMESSA_DA_ROTA[area] : PROMESSA_PADRAO;

  return (
    <div className="wca" data-testid="welcome-app-web" onPointerDown={() => { if (!rodouRef.current) tocar(); }}>
      <style>{CSS_WCA}</style>
      <div className="wca-col">
        <motion.div
          className="wca-palco"
          initial={semMovimento ? false : { opacity: 0, y: 56, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className="wca-fone"
            aria-hidden
            animate={semMovimento ? undefined : { y: [0, -3, 0] }}
            transition={semMovimento ? undefined : { duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
          >
            <div className="wca-tela">
              <video
                ref={videoRef}
                className={videoFalhou ? "wca-video wca-escondido" : "wca-video"}
                src={VIDEO_WELCOME}
                poster={POSTER_WELCOME}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                disablePictureInPicture
                onPlaying={aoRodar}
                onError={aoFalhar}
                data-testid="welcome-video"
                data-falhou={videoFalhou ? "" : undefined}
              />
              {/* autoplay negado/vídeo que não carrega: a tela do app parada (o poster) POR CIMA — sem o botão de play
                  do Safari no meio do celular; o toque tenta o vídeo de novo e, rodando, a imagem sai */}
              {videoFalhou && (
                <img className="wca-poster" src={TELAS_PASSEIO[quadro]} alt="" draggable={false} data-testid="welcome-poster" data-quadro={quadro} />
              )}
              {/* pré-carrega as telas do passeio pra troca não piscar */}
              {videoFalhou && <div aria-hidden style={{ display: "none" }}>{TELAS_PASSEIO.map((u) => <img key={u} src={u} alt="" />)}</div>}
            </div>
            <img className="wca-moldura" src={MOLDURA_WELCOME} alt="" draggable={false} />
          </motion.div>
        </motion.div>

        <div className="wca-corpo">
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4 }} data-testid="welcome-promessa">
            {promessa}
          </motion.h1>
          <motion.p className="wca-prova" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45, duration: 0.4 }}>
            <span className="wca-st">★★★★★</span> <b>+1000 pessoas</b> organizando a vida
          </motion.p>
        </div>

        <motion.div className="wca-rodape" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.4 }}>
          <BotaoDoFunil
            fixo={false}
            seta={false}
            texto="Começar"
            testid="welcome-comecar"
            onClick={() => { trackEvent("app_welcome_start", { calai: true, ...TAG }); onComecar(); }}
            secundarioAbaixo
            secundario={{ texto: <>Já tem conta? <b>Entrar</b></>, testid: "welcome-entrar", onClick: () => { trackEvent("app_welcome_login", { ...TAG }); onEntrar(); } }}
          />
        </motion.div>
      </div>
    </div>
  );
}

/* O CSS da welcome do app (WelcomeCalai), sem shorthand `inset` (regra de 04/08). */
const CSS_WCA = `
.wca {
  position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 50; overflow: hidden;
  display: flex; justify-content: center;
  -webkit-font-smoothing: antialiased;
  background: #ffffff;
  color: #16121c;
}
.wca-col {
  position: relative; width: 100%; max-width: 430px;
  display: flex; flex-direction: column;
  padding: calc(14px + env(safe-area-inset-top)) 0 0;
}
.wca-palco { flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 6px 10px 4px; }
.wca-fone {
  position: relative; height: 100%; max-height: 100%; width: auto; max-width: 100%;
  aspect-ratio: 430 / 880;
  border-radius: 15.8% / 7.73%;
  box-shadow: 0 34px 60px -24px rgba(22,18,28,.5), 0 10px 22px -14px rgba(22,18,28,.25);
}
.wca-moldura { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: block; pointer-events: none; user-select: none; -webkit-user-drag: none; z-index: 2; }
.wca-tela { position: absolute; top: 1.14%; right: 2.33%; bottom: 1.14%; left: 2.33%; border-radius: 13.8% / 6.75%; overflow: hidden; background: #ffffff; padding-top: 9.5%; z-index: 1; }
.wca-video { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; background: #ffffff; }
/* web: autoplay negado (Modo Pouca Energia) mostra o botão de play do Safari por cima do poster — some; o toque na tela tenta de novo */
.wca-poster { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; background: #ffffff; pointer-events: none; }
.wca-escondido { position: absolute; top: 0; left: 0; width: 1px; height: 1px; opacity: 0; }
.wca-video::-webkit-media-controls-start-playback-button { display: none !important; -webkit-appearance: none; }
.wca-video::-webkit-media-controls-overlay-play-button { display: none !important; -webkit-appearance: none; }
.wca-video::-webkit-media-controls-panel { display: none !important; }
.wca-video::-webkit-media-controls { display: none !important; }
.wca-corpo { flex: 0 0 auto; text-align: center; padding: 14px 22px 0; }
.wca h1 {
  margin: 0; font-weight: 900; letter-spacing: -.03em; line-height: 1.08;
  font-size: 28px; font-size: clamp(25px, 7.4vw, 32px);
}
.wca-prova { margin: 9px 0 0; font-size: 13.5px; color: #7d8691; }
.wca-prova b { color: #16121c; }
.wca-st { color: #f0a500; letter-spacing: .06em; }
.wca-rodape { flex: 0 0 auto; display: flex; flex-direction: column; align-items: stretch; padding-top: 6px; }
`;
