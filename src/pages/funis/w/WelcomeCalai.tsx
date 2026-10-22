import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { trackEvent, instalouVindoDoSite } from "@/lib/analytics";
import { pedirRastreamentoIos, segurarReservaNativaDoATT } from "@/lib/att-ios";
import { bracoATT, camposDoATT } from "@/lib/att-momento";
import { AREAS, type AreaKey } from "@/lib/funnel";
import { BotaoDoFunil } from "@/pages/funis/w/BotaoDoFunil";
import { rotaComFoto } from "@/lib/troca-de-rota";

/**
 * WELCOME ESTILO CAL AI (10/10, chave FUNIL_CALAI em lib/funil-calai) — a tela 1 do
 * app quando a chave está ligada. Substitui a welcome da grade azul (AppWelcome) E
 * os 3 quadros de promessa (PromessasScreen).
 *
 *   · o VÍDEO em loop do app real (~12 s, mudo, inline), no estilo do Cal AI (dono 17/10: "tem que
 *     mostrar o app mesmo, de forma fluida… o iPhone entra" e "o usuário quer ver primeiro o app"):
 *     fundo branco, um iPhone ENTRA pela direita girado e assenta no centro (0,7 s) já na HOME CHEIA
 *     de uma conta usada (Bom dia, score 37, 🔥 12 dias, widgets, módulos); dentro dele, uma gravação
 *     de tela CONTÍNUA: arrasta as ações rápidas → Registrar Gasto → 12 → Alimentação → ✓ (score
 *     37 → 42, 🔥 13 dias "garantido hoje") → rola a Home até os módulos → Finanças → rola até o
 *     QUANTO POSSO GASTAR HOJE → ZOOM só no card, limpo sobre o branco ("R$ 123 por dia · Sobram
 *     R$ 111 pra hoje") → volta → o iPhone sai pela esquerda e o loop recomeça com ele entrando.
 *     Sem legendas. Gerado do app (conta montada pelo fluxo + seeds da demo /preview, Supabase
 *     falso, loja mock; receita em scratchpad/video-welcome2/work), 1080×1386 H.264 ≤ 2 MB em
 *     public/funil/, com pôster JPEG (o iPhone assentado na Home cheia) pra antes do 1º quadro /
 *     autoplay negado;
 *   · UMA frase ("Sua vida inteira organizada num app só" — ou a promessa da rota,
 *     se a pessoa já escolheu uma e voltou);
 *   · "Começar" — pede o ATT exatamente como a welcome de hoje (NÃO se move);
 *   · UMA linha secundária ABAIXO do botão como no Cal AI — "Já sou cliente · Entrar" desde a 1.0.18
 *     (21/10: 7,6% das instalações tocavam o "Já tem conta? Entrar" em ~3 s SEM ter conta e iam criar
 *     conta pela Apple/Google no /entrar, pulando o quiz; agora diz pra quem é, num corpo menor, e o
 *     /entrar?de=welcome ganha a volta "Ainda não tem conta? Monte seu plano"). Era "Já tem conta? Entrar" (dono
 *     10/10: o rodapé tinha 4 linhas, duas dizendo a mesma coisa, e o link em cima do
 *     botão "não faz sentido nenhum"; a linha de termos saiu — o Cal AI não tem). "Restaurar
 *     compras" e o "Já pagou pelo site?" moraram aqui até 10/10; agora ficam na tela de
 *     Entrar (que é pra onde a pessoa vai de qualquer jeito — ver RestaurarCompras).
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
/** O mesmo vídeo em WebP animado, pra quando o iPhone nega o vídeo (Modo Pouca Energia). */
export const VIDEO_WELCOME_ANIMADO = "/funil/welcome-app.webp";

const PROMESSA_PADRAO = "Sua vida inteira organizada num app só.";
const PROMESSA_DA_ROTA: Record<AreaKey, string> = {
  dinheiro: "Seu dinheiro inteiro, num app só.",
  rotina: "Sua rotina inteira, num app só.",
  corpo: "Treino e dieta, num app só.",
  saude: "Sua saúde inteira, num app só.",
  metas: "Suas metas, finalmente, num app só.",
};

export function WelcomeCalai({ onComecar, onEntrar, area }: { onComecar: () => void; onEntrar?: () => void; area?: AreaKey | null }) {
  /* ATT (1.0.18, dono 21/10 — chave remota `att_momento`, lib/att-momento): braço "auto3s" = o de hoje, o pedido
   * 3 s depois de a tela aparecer; braço "comecar" = nada automático — o pedido sai só no toque em "Começar"
   * (abaixo) ou na Home, e a welcome segura a reserva nativa de 10 s pra o diálogo não cair sozinho no vídeo. */
  useEffect(() => {
    if (bracoATT() === "comecar") { segurarReservaNativaDoATT(); return; }
    const t = window.setTimeout(() => { void pedirRastreamentoIos("welcome_auto"); }, 3000);
    return () => window.clearTimeout(t);
  }, []);
  const navigate = useNavigate();
  const semMovimento = useReducedMotion() === true;
  /* 1.0.18 (QA de aparelho 21/10): voltando do /entrar ("Ainda não tem conta? Monte seu plano") a foto do Entrar saía em
   * cima de uma welcome AINDA VAZIA (frase, prova e botão entrando com atraso; o vídeo começa em branco) — 1 a 3 quadros
   * de tela branca. Chegando por troca de rota (a foto da tela anterior está por cima), frase, prova e botão já entram
   * prontos; só a abertura a frio (o app abrindo) mantém a entrada animada. */
  const [entrouPorTroca] = useState(rotaComFoto);
  const semEntrada = semMovimento || entrouPorTroca;
  const [videoFalhou, setVideoFalhou] = useState(false);
  /* 20/10 (dono, iPhone em Modo Pouca Energia): o vídeo negado ficava parado com o PLAY do iOS no meio do celular.
   * O iOS bloqueia <video> no WebView com pouca energia (o Cal AI é nativo, por isso roda lá), mas NÃO bloqueia imagem
   * animada. Então o pôster cobre o vídeo até ele rodar de verdade e, sem rodar em 1,2 s, entra o MESMO vídeo em WebP
   * animado (720 px, 15 qps, ~2,6 MB no pacote). O toque segue tentando o vídeo e, rodando, a capa sai. */
  const [rodando, setRodando] = useState(false);
  const [passeio, setPasseio] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => { if (!rodouRef.current) setPasseio(true); }, 1200); return () => window.clearTimeout(t); }, []);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rodouRef = useRef(false);

  useEffect(() => { trackEvent("app_welcome_view", { calai: true, ...camposDoATT() }); }, []);
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
  /* 17/10: 1 em 4 iPhones negava o autoplay (telemetria de 10 dias: 1.465 welcome_video_play ×
   * 488 welcome_video_erro NotAllowedError — Modo Pouca Energia e afins) e ficava no pôster parado;
   * e o WebKit do Playwright nega o play() chamado na montagem (vídeo sem dado, bloco entrando) mas
   * aceita o MESMO play() mais tarde. Então o play() é tentado VÁRIAS vezes: na montagem, no
   * `loadeddata`, 1,5 s e 3,5 s depois e no 1º toque na tela (um
   * gesto libera o vídeo até no Modo Pouca Energia). Só a tentativa dos 3,5 s conta welcome_video_erro;
   * tocar depois disso conta welcome_video_play como sempre (o `onPlaying`). */
  const tentarTocar = (quando: "montou" | "carregou" | "depois" | "ultima" | "toque") => {
    const v = videoRef.current;
    if (!v || rodouRef.current || (quando !== "montou" && !v.paused)) return;
    v.muted = true;
    v.defaultMuted = true;
    try { v.setAttribute("muted", ""); } catch { /* noop */ }
    const p = v.play();
    if (p && typeof p.catch === "function") {
      p.catch((e: unknown) => {
        if (rodouRef.current || quando !== "ultima") return; // ainda vem outra tentativa (ou é a do toque)
        setVideoFalhou(true);
        trackEvent("welcome_video_erro", { motivo: "autoplay", erro: String((e as { name?: string })?.name ?? e).slice(0, 80) });
      });
    }
  };
  useEffect(() => {
    tentarTocar("montou");
    const t1 = window.setTimeout(() => tentarTocar("depois"), 1500);
    const t2 = window.setTimeout(() => tentarTocar("ultima"), 3500);
    const aoTocar = () => tentarTocar("toque");
    window.addEventListener("pointerdown", aoTocar, { passive: true });
    window.addEventListener("touchstart", aoTocar, { passive: true });
    return () => {
      window.clearTimeout(t1); window.clearTimeout(t2);
      window.removeEventListener("pointerdown", aoTocar); window.removeEventListener("touchstart", aoTocar);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const aoRodar = () => {
    if (rodouRef.current) return;
    rodouRef.current = true;
    setVideoFalhou(false);
    setRodando(true);
    trackEvent("welcome_video_play", {});
  };
  const aoFalhar = () => {
    if (rodouRef.current) return;
    setVideoFalhou(true);
    const code = videoRef.current?.error?.code ?? null;
    trackEvent("welcome_video_erro", { motivo: "carregar", code });
  };

  const promessa = area && area in AREAS ? PROMESSA_DA_ROTA[area] : PROMESSA_PADRAO;

  /* O quadro do vídeo cabe no palco pelos DOIS lados (largura e altura) mantendo 39:50 — só com CSS
   * (height 100% + max-width) a largura era cortada e o object-fit cover ampliava o vídeo, cortando o
   * iPhone. Medido pelo ResizeObserver; sem ele (jsdom), o CSS de reserva (width 100%, aspect-ratio). */
  const palcoRef = useRef<HTMLDivElement | null>(null);
  const [quadro, setQuadro] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = palcoRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const medir = () => {
      const livreW = el.clientWidth - 32, livreH = el.clientHeight - 6; // o padding do palco
      if (livreW <= 0 || livreH <= 0) return;
      const w = Math.floor(Math.min(livreW, livreH * (39 / 50)));
      setQuadro({ width: w, height: Math.floor(w * (50 / 39)) });
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="wca" data-testid="welcome-calai">
      <style>{CSS_WCA}</style>
      <div className="wca-col">
        {/* A ENTRADA do iPhone já está no vídeo (ele vem da direita e assenta), então o bloco só
            aparece num fade curto — deslizar o bloco por cima da entrada do vídeo dava dois movimentos.
            Com prefers-reduced-motion, nada se move. */}
        <motion.div
          ref={palcoRef}
          className="wca-palco"
          initial={semEntrada ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <div className="wca-quadro" aria-hidden style={quadro ?? undefined}>
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
              onLoadedData={() => tentarTocar("carregou")}
              onError={aoFalhar}
              data-testid="welcome-video"
              data-falhou={videoFalhou ? "" : undefined}
            />
            {!rodando && (
              <div className="wca-cobre" data-testid="welcome-cobre" data-animado={passeio ? "" : undefined}>
                {/* 1.0.18 (QA de aparelho 21/10): o pôster é o celular PARADO no meio, mas o vídeo (e o WebP) começa em branco com
                    o celular ENTRANDO pela direita — o pôster na abertura piscava ~130 ms e o celular sumia e voltava deslizando.
                    A capa abre BRANCA (igual ao 1º quadro do vídeo); o pôster fica só de reserva, por baixo do WebP, depois dele. */}
                <img className="wca-cobre-img wca-cobre-foto" src={POSTER_WELCOME} alt="" draggable={false} />
                {/* carrega desde o início (pra estar pronto em 1,2 s) e só aparece se o vídeo não rodar */}
                <img className="wca-cobre-img wca-cobre-anim" src={VIDEO_WELCOME_ANIMADO} alt="" draggable={false} />
              </div>
            )}
          </div>
        </motion.div>

        <div className="wca-corpo">
          <motion.h1 initial={semEntrada ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4 }}>
            {promessa}
          </motion.h1>
          <motion.p className="wca-prova" initial={semEntrada ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45, duration: 0.4 }}>
            <span className="wca-st">★★★★★</span> <b>+1000 pessoas</b> organizando a vida
          </motion.p>
        </div>

        {/* 10/10 (dono): o BotaoDoFunil (56 px, 12 px de margem, colado embaixo + safe-area), rendendo no
            fluxo (a welcome já é uma camada fixa). Só aqui o link secundário fica ABAIXO do botão —
            "não tem problema mudar o botão só na 1ª página". */}
        <motion.div className="wca-rodape" initial={semEntrada ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.4 }}>
          {veioDoSite && (
            <div className="wca-aviso" data-testid="welcome-veio-do-site">
              Você já comprou pelo site? <b>Entra com o mesmo e-mail</b> — não precisa pagar de novo.
            </div>
          )}
          <BotaoDoFunil
            fixo={false}
            seta={false}
            texto={veioDoSite ? "Entrar na minha conta" : "Começar"}
            testid={veioDoSite ? "welcome-entrar-conta" : "welcome-comecar"}
            onClick={veioDoSite
              ? () => { trackEvent("app_welcome_login", { pos_compra_web: true, ...camposDoATT() }); if (onEntrar) onEntrar(); else navigate("/entrar"); }
              : async () => { trackEvent("app_welcome_start", { calai: true, ...camposDoATT() }); await pedirRastreamentoIos("welcome"); onComecar(); }}
            secundarioAbaixo
            secundario={veioDoSite
              ? { texto: <>Ainda não tenho conta? <b>Começar</b></>, onClick: async () => { trackEvent("app_welcome_start", { pos_compra_web: true, ...camposDoATT() }); await pedirRastreamentoIos("welcome"); onComecar(); } }
              : { texto: <>Já sou cliente · <b>Entrar</b></>, testid: "welcome-ja-sou-cliente", onClick: () => { trackEvent("app_welcome_login", { ...camposDoATT() }); if (onEntrar) onEntrar(); else navigate("/entrar?de=welcome"); } }}
          />
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
  padding: calc(14px + env(safe-area-inset-top)) 0 0;
}
/* O palco do vídeo ENCOLHE antes do texto e do botão (min-height 0) — num
   iPhone SE o vídeo fica menor, o Começar nunca sai da tela. */
.wca-palco { flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 4px 16px 2px; }
/* O quadro = o vídeo inteiro (1080×1386, proporção ~39:50). O vídeo já traz o iPhone (com a
   sombra) sobre fundo BRANCO, igual ao da tela — então o quadro não tem borda, canto nem sombra:
   o celular parece solto na página, como no Cal AI. O canto de 20 px é só reserva (no zoom o card
   fica sozinho sobre o branco). Cabe pela ALTURA (o que sobrar entre o topo
   e o texto) e nunca passa da largura. */
.wca-quadro {
  position: relative; width: 100%; max-width: 100%; max-height: 100%; flex: 0 0 auto;
  aspect-ratio: 39 / 50;
  border-radius: 20px; overflow: hidden; background: #ffffff;
}
/* contain + o mesmo fundo do vídeo: se a caixa sair um pixel da proporção, nada é cortado nem ampliado */
.wca-video { display: block; width: 100%; height: 100%; object-fit: contain; background: #ffffff; }
/* a capa = branca (o 1º quadro do vídeo) por cima do vídeo até ele rodar; sem vídeo, o WebP animado aparece suave e o pôster fica de reserva por baixo */
.wca-cobre { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #ffffff; pointer-events: none; }
.wca-cobre-img { position: absolute; top: 0; left: 0; display: block; width: 100%; height: 100%; object-fit: contain; }
.wca-cobre-foto { opacity: 0; }
.wca-cobre[data-animado] .wca-cobre-foto { opacity: 1; transition: opacity 0s linear .4s; }
.wca-cobre-anim { opacity: 0; transition: opacity .35s ease-out; }
.wca-cobre[data-animado] .wca-cobre-anim { opacity: 1; }
.wca-video::-webkit-media-controls-start-playback-button { display: none !important; -webkit-appearance: none; }
.wca-video::-webkit-media-controls-overlay-play-button { display: none !important; -webkit-appearance: none; }
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
.wca-cta {
  width: 100%; height: 56px; border: 0; border-radius: 999px;
  background: #16121c; color: #fff; font-size: 17px; font-weight: 800;
  font-family: inherit; cursor: pointer;
  box-shadow: 0 18px 38px -12px rgba(22,18,28,.5);
}
.wca-cta:active { transform: scale(.985); }
/* 1.0.18: o "Já sou cliente · Entrar" é a porta de quem JÁ tem conta — menor que o link padrão do rodapé */
.wca .bdf-link-abaixo[data-testid="welcome-ja-sou-cliente"] { font-size: 13px; color: #6b7480; }
.wca-link { border: 0; background: none; padding: 9px 16px; font-size: 14px; color: #4f5a64; font-family: inherit; cursor: pointer; }
.wca-link b { color: #16121c; }
.wca-aviso { margin: 0 0 8px; padding: 10px 14px; border-radius: 12px; background: #f7f5fb; border: 1px solid #e4e0ee; color: #16121c; font-size: 13.5px; line-height: 1.4; text-align: center; }
.wca-restore { border: 0; background: none; padding: 8px 16px; font-size: 12.5px; color: #4f5a64; font-weight: 700;
  font-family: inherit; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.wca-restore:disabled { opacity: .6; }
.wca-termos { font-size: 10.5px; color: #9aa6b1; text-align: center; line-height: 1.5; }
`;
