import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { trackEvent, instalouVindoDoSite } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";
import { pedirRastreamentoIos } from "@/lib/att-ios";
import { initRevenueCat, restaurar } from "@/lib/revenuecat";
import { ehApple } from "@/lib/loja";
import { JaPagouPeloSite } from "@/components/app/JaPagouPeloSite";
import { AREAS, type AreaKey } from "@/lib/funnel";

/**
 * WELCOME ESTILO CAL AI (10/10, chave FUNIL_CALAI em lib/funil-calai) — a tela 1 do
 * app quando a chave está ligada. Substitui a welcome da grade azul (AppWelcome) E
 * os 3 quadros de promessa (PromessasScreen).
 *
 *   · um iPhone no centro com VÍDEO em loop do app real (~9 s, mudo, inline):
 *     Home → Finanças → "Mercado 235" no + Novo gasto → o mês soma → Home com o
 *     score subindo. Gerado do app de verdade (scratchpad/v14-funil-calai/video/),
 *     H.264 ≤ 1,5 MB em public/funil/, com poster pra antes do 1º quadro;
 *   · UMA frase ("Sua vida inteira organizada num app só" — ou a promessa da rota,
 *     se a pessoa já escolheu uma e voltou);
 *   · "Começar" — pede o ATT exatamente como a welcome de hoje (NÃO se move);
 *   · "Já tem conta? Entrar", "Restaurar compras" (shell), "Já pagou pelo site?" e
 *     o rodapé legal de hoje.
 *
 * Eventos: os MESMOS da welcome de hoje (`app_welcome_view`, `app_welcome_start`,
 * `app_welcome_login`, `app_welcome_restore`; o `funnel_view step=welcome` sai do
 * ComecarW, com `video: true`) + `welcome_video_play` (o 1º quadro rodou) e
 * `welcome_video_erro` (não carregou / autoplay negado → fica o poster).
 *
 * Visual: planner (branco, grafite #16121c, magenta só no detalhe, Inter herdada).
 * CSS em runtime via <style>, sem shorthand `inset` (regra de 04/08).
 */
export const VIDEO_WELCOME = "/funil/welcome-app.mp4";
export const POSTER_WELCOME = "/funil/welcome-app.jpg";

const PROMESSA_PADRAO = "Sua vida inteira organizada num app só.";
const PROMESSA_DA_ROTA: Record<AreaKey, string> = {
  dinheiro: "Seu dinheiro inteiro, num app só.",
  rotina: "Sua rotina inteira, num app só.",
  corpo: "Treino e dieta, num app só.",
  saude: "Sua saúde inteira, num app só.",
  metas: "Suas metas, finalmente, num app só.",
};

export function WelcomeCalai({ onComecar, onEntrar, area }: { onComecar: () => void; onEntrar?: () => void; area?: AreaKey | null }) {
  /* ATT (20/09): a pessoa vê a tela PRIMEIRO; o pedido chega 3 s depois. Igual à welcome de hoje. */
  useEffect(() => { const t = window.setTimeout(() => { void pedirRastreamentoIos("welcome_auto"); }, 3000); return () => window.clearTimeout(t); }, []);
  const navigate = useNavigate();
  const [restaurando, setRestaurando] = useState(false);
  const [msgRestore, setMsgRestore] = useState<string | null>(null);
  const [videoFalhou, setVideoFalhou] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rodouRef = useRef(false);

  useEffect(() => { trackEvent("app_welcome_view", { calai: true }); }, []);
  const [veioDoSite, setVeioDoSite] = useState(() => instalouVindoDoSite());
  useEffect(() => {
    if (veioDoSite) { trackEvent("app_welcome_pos_compra_web", {}); return; }
    const t = window.setTimeout(() => { if (instalouVindoDoSite()) { setVeioDoSite(true); trackEvent("app_welcome_pos_compra_web", {}); } }, 2000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* AUTOPLAY À MÃO. O React põe `muted` como PROPRIEDADE, não como atributo, e
   * há motores que só liberam autoplay quando o atributo está no HTML — então
   * aqui a gente garante os dois e chama play() de novo; se o motor negar, fica
   * o poster (tela estática do app) e a telemetria conta quantos. */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    try { v.setAttribute("muted", ""); } catch { /* noop */ }
    const p = v.play();
    if (p && typeof p.catch === "function") {
      p.catch((e: unknown) => {
        if (rodouRef.current) return;
        setVideoFalhou(true);
        trackEvent("welcome_video_erro", { motivo: "autoplay", erro: String((e as { name?: string })?.name ?? e).slice(0, 80) });
      });
    }
  }, []);
  const aoRodar = () => {
    if (rodouRef.current) return;
    rodouRef.current = true;
    setVideoFalhou(false);
    trackEvent("welcome_video_play", {});
  };
  const aoFalhar = () => {
    if (rodouRef.current) return;
    setVideoFalhou(true);
    const code = videoRef.current?.error?.code ?? null;
    trackEvent("welcome_video_erro", { motivo: "carregar", code });
  };

  const tentarRestaurar = async () => {
    if (restaurando) return;
    setRestaurando(true);
    setMsgRestore(null);
    trackEvent("app_welcome_restore", {});
    await initRevenueCat();
    const ok = await restaurar();
    setRestaurando(false);
    if (ok) { window.location.href = "/"; return; }
    setMsgRestore(`Nenhuma assinatura encontrada nesta conta ${ehApple() ? "da App Store" : "Google"}.`);
  };

  const promessa = area && area in AREAS ? PROMESSA_DA_ROTA[area] : PROMESSA_PADRAO;

  return (
    <div className="wca" data-testid="welcome-calai">
      <style>{CSS_WCA}</style>
      <div className="wca-col">
        <motion.div className="wca-palco" initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <div className="wca-fone" aria-hidden>
            <div className="wca-ilha" />
            <div className="wca-tela">
            <video
              ref={videoRef}
              className="wca-video"
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
            </div>
          </div>
        </motion.div>

        <div className="wca-corpo">
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4 }}>
            {promessa}
          </motion.h1>
          <motion.p className="wca-prova" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45, duration: 0.4 }}>
            <span className="wca-st">★★★★★</span> <b>+1000 pessoas</b> organizando a vida
          </motion.p>
        </div>

        <motion.div className="wca-rodape" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.4 }}>
          {veioDoSite && (
            <div className="wca-aviso" data-testid="welcome-veio-do-site">
              Você já comprou pelo site? <b>Entra com o mesmo e-mail</b> — não precisa pagar de novo.
            </div>
          )}
          {veioDoSite ? (
            <button className="wca-cta btn-shine" onClick={() => { trackEvent("app_welcome_login", { pos_compra_web: true }); if (onEntrar) onEntrar(); else navigate("/entrar"); }}>
              Entrar na minha conta
            </button>
          ) : (
            <button
              className="wca-cta btn-shine"
              data-testid="welcome-comecar"
              onClick={async () => { trackEvent("app_welcome_start", { calai: true }); await pedirRastreamentoIos("welcome"); onComecar(); }}
            >
              Começar
            </button>
          )}
          {veioDoSite ? (
            <button className="wca-link" onClick={async () => { trackEvent("app_welcome_start", { pos_compra_web: true }); await pedirRastreamentoIos("welcome"); onComecar(); }}>
              Ainda não tenho conta? <b>Começar</b>
            </button>
          ) : (
            <button className="wca-link" onClick={() => { trackEvent("app_welcome_login", {}); if (onEntrar) onEntrar(); else navigate("/entrar"); }}>
              Já tem conta? <b>Entrar</b>
            </button>
          )}
          {isNativeShell() && (
            <button className="wca-restore" onClick={tentarRestaurar} disabled={restaurando}>
              {restaurando ? "Verificando…" : "Restaurar compras"}
            </button>
          )}
          {!veioDoSite && (
            <JaPagouPeloSite origem="welcome" onEntrar={onEntrar} className="wca-ja-pagou" classeAcao="wca-ja-pagou-acao" />
          )}
          {msgRestore && <span className="wca-msg">{msgRestore}</span>}
          <span className="wca-termos">Ao continuar, você aceita nossos Termos e Aviso de Privacidade</span>
        </motion.div>
      </div>
    </div>
  );
}

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
  padding: calc(14px + env(safe-area-inset-top)) 22px calc(18px + env(safe-area-inset-bottom));
}
/* O palco do telefone ENCOLHE antes do texto e do botão (min-height 0) — num
   iPhone SE o vídeo fica menor, o Começar nunca sai da tela. */
.wca-palco { flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 6px 0 4px; }
.wca-fone {
  position: relative; height: 100%; max-height: 100%; width: auto; max-width: 100%;
  aspect-ratio: 9 / 19.2;
  border-radius: 40px; background: #16121c; padding: 9px;
  box-shadow: 0 30px 60px -22px rgba(22,18,28,.55), 0 0 0 1px rgba(22,18,28,.08);
}
.wca-ilha { position: absolute; top: 18px; left: 50%; transform: translateX(-50%); width: 28%; height: 20px; border-radius: 999px; background: #16121c; z-index: 2; }
/* a "tela" do telefone: faixa branca em cima (a status bar do iPhone) pra ilha não cobrir o cabeçalho do app */
.wca-tela { position: absolute; top: 9px; right: 9px; bottom: 9px; left: 9px; border-radius: 32px; overflow: hidden; background: #ffffff; padding-top: 11%; }
.wca-video { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; background: #ffffff; }
.wca-corpo { flex: 0 0 auto; text-align: center; padding-top: 14px; }
.wca h1 {
  margin: 0; font-weight: 900; letter-spacing: -.03em; line-height: 1.08;
  font-size: 28px; font-size: clamp(25px, 7.4vw, 32px);
}
.wca-prova { margin: 9px 0 0; font-size: 13.5px; color: #7d8691; }
.wca-prova b { color: #16121c; }
.wca-st { color: #f0a500; letter-spacing: .06em; }
.wca-rodape { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; padding-top: 14px; }
.wca-rodape > * + * { margin-top: 9px; }
.wca-cta {
  width: 100%; height: 56px; border: 0; border-radius: 999px;
  background: #16121c; color: #fff; font-size: 17px; font-weight: 800;
  font-family: inherit; cursor: pointer;
  box-shadow: 0 18px 38px -12px rgba(22,18,28,.5);
}
.wca-cta:active { transform: scale(.985); }
.wca-link { border: 0; background: none; padding: 9px 16px; font-size: 14px; color: #4f5a64; font-family: inherit; cursor: pointer; }
.wca-link b { color: #16121c; }
.wca-aviso { margin: 0 0 8px; padding: 10px 14px; border-radius: 12px; background: #f7f5fb; border: 1px solid #e4e0ee; color: #16121c; font-size: 13.5px; line-height: 1.4; text-align: center; }
.wca-restore { border: 0; background: none; padding: 8px 16px; font-size: 12.5px; color: #4f5a64; font-weight: 700;
  font-family: inherit; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.wca-restore:disabled { opacity: .6; }
.wca-rodape > .wca-ja-pagou { margin-top: -4px; }
.wca-ja-pagou { border: 0; background: none; padding: 4px 16px 8px; font-size: 12px; color: #4f5a64; font-family: inherit; cursor: pointer; line-height: 1.25; }
.wca-ja-pagou-acao { font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
.wca-msg { font-size: 11.5px; color: #4f5a64; }
.wca-termos { font-size: 10.5px; color: #9aa6b1; text-align: center; line-height: 1.5; }
`;
