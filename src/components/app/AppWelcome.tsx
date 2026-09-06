import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";
import { initRevenueCat, restaurar } from "@/lib/revenuecat";

/**
 * TELA 1 DO APP DAS LOJAS (Capacitor) — welcome "grade viva" aprovada nos
 * mockups de 21/07 (v-final.html). Monta SÓ no shell nativo, como OVERLAY
 * dentro do /inicio (fix 23/07 à noite, bug do iPhone): morar em rota
 * própria causava flash branco na troca de rota — agora a porta já está
 * montada por baixo e o Começar só faz o céu derreter (exit fade de quem
 * renderiza este overlay). O web nunca vê este componente.
 *
 * Papel da tela: confirmar o download ("é esse app que baixei"), dar o beat
 * de marca (único momento de céu FORTE do funil) e entregar pro funil que
 * converte já aquecido. Padrão Cal AI/BitePal: welcome → quiz.
 *
 * Sem streak fake de propósito: no primeiro launch a pessoa não tem streak
 * nenhum — prova fica nas estrelas. "Restaurar compras" cobre reinstalação
 * de assinante (guideline de loja) e degrada silencioso sem chave RC.
 */
/** v61: o "+1000" conta de 0 a 1000 (~900ms) — número que se move recebe o
 *  olhar (número-herói). rAF com ease-out cúbico; respeita reduced-motion. */
function Contador({ ate }: { ate: number }) {
  const [n, setN] = useState(ate);
  useEffect(() => {
    try {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    } catch { /* segue animando */ }
    setN(0);
    let raf = 0;
    let t0 = 0;
    const dur = 900;
    const passo = (t: number) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / dur);
      setN(Math.round(ate * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    const atraso = window.setTimeout(() => { raf = requestAnimationFrame(passo); }, 650);
    return () => { window.clearTimeout(atraso); cancelAnimationFrame(raf); };
  }, [ate]);
  return <>+{n}</>;
}

export function AppWelcome({ onComecar, onEntrar }: { onComecar: () => void; onEntrar?: () => void }) {
  const navigate = useNavigate();
  const [restaurando, setRestaurando] = useState(false);
  const [msgRestore, setMsgRestore] = useState<string | null>(null);

  useEffect(() => { trackEvent("app_welcome_view", {}); }, []);

  const TILES: Array<[string, string]> = [
    ["💰", "#fdeccb"], ["💪", "#d9e4fb"], ["🥗", "#d7f0dd"], ["📅", "#cdeeee"],
    ["🎯", "#e6def8"], ["❤️", "#fbd8e8"], ["🎓", "#ffe4cf"], ["🧠", "#dcf3d2"],
  ];

  const tentarRestaurar = async () => {
    if (restaurando) return;
    setRestaurando(true);
    setMsgRestore(null);
    trackEvent("app_welcome_restore", {});
    await initRevenueCat();
    const ok = await restaurar();
    setRestaurando(false);
    if (ok) { window.location.href = "/"; return; }
    setMsgRestore("Nenhuma assinatura encontrada nesta conta Google.");
  };

  return (
    <div className="apw">
      <style>{CSS_APW}</style>
      <div className="apw-glow" aria-hidden />

      <div className="apw-col">
      <div className="apw-grade" aria-hidden>
        {TILES.map(([emo, cor], i) => (
          <motion.span
            key={emo} className="apw-tile" style={{ background: cor }}
            /* v61: layoutId casa com o tile da MESMA área na porta do funil —
               ao tocar Começar, o tile VOA e vira o card do quiz (shared
               element). Fora do funil não existe par montado: inofensivo. */
            layoutId={`apw-tile-${emo}`}
            initial={{ opacity: 0, y: -18, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.06 + i * 0.055, type: "spring", stiffness: 300, damping: 22 }}
          >
            {/* v61: depois da cascata, o tile RESPIRA (flutuação defasada) —
                tela congelada após 1s parecia morta. Camada interna pra não
                brigar com o spring de entrada. */}
            <motion.span
              style={{ display: "block" }}
              animate={{ y: [0, -3.5, 0] }}
              transition={{ duration: 3 + (i % 4) * 0.5, repeat: Infinity, ease: "easeInOut", delay: 1 + i * 0.22 }}
            >{emo}</motion.span>
          </motion.span>
        ))}
      </div>

      <div className="apw-corpo">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            Um app<br />pra vida<br />inteira
          </motion.h1>
          <motion.p
            className="apw-sub"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.4 }}
          >
            {/* v61: o "16" é o diferencial nº1 (23% escolhem "Tudo" na porta)
                e não aparecia na tela */}
            Finanças, rotina, corpo, metas — <b>16 módulos</b> num lugar só.
          </motion.p>
          <motion.p
            className="apw-prova"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            <span className="apw-st">★★★★★</span> <b><Contador ate={1000} /> pessoas</b> organizando a vida
          </motion.p>
        </div>

        <motion.div
          className="apw-rodape"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72, duration: 0.4 }}
        >
          <button
            className="apw-cta btn-shine"
            onClick={() => { trackEvent("app_welcome_start", {}); onComecar(); }}
          >
            Começar
          </button>
          {/* 23/08 (dono): welcome SEM preço — preço é papel do paywall,
              depois do compromisso. Aqui só a promessa e o Começar. */}
          {/* v60: no funil do teste o login fica DENTRO do funil (SignupScreen
              tem a esteira de conta existente); /entrar é o fallback do uso
              antigo em Comecar/Radar. */}
          <button className="apw-link" onClick={() => { trackEvent("app_welcome_login", {}); if (onEntrar) onEntrar(); else navigate("/entrar"); }}>
            Já tenho conta? <b>Entrar</b>
          </button>
          {isNativeShell() && (
            <button className="apw-restore" onClick={tentarRestaurar} disabled={restaurando}>
              {restaurando ? "Verificando…" : "Restaurar compras"}
            </button>
          )}
          {msgRestore && <span className="apw-msg">{msgRestore}</span>}
          <span className="apw-termos">Ao continuar, você aceita nossos Termos e Aviso de Privacidade</span>
        </motion.div>
      </div>
      </div>
    </div>
  );
}

const CSS_APW = `
.apw {
  /* top/right/bottom/left por extenso, sem o shorthand inset (04/08): este
     CSS entra em runtime via <style> e nao passa pelo cssTarget do build —
     em WebView < Chrome 87 o shorthand era descartado e a welcome inteira
     ficava sem posicao/invisivel: o app "nascia" direto no quiz (foto do
     dono). Mesma classe do bug do build, porta de entrada diferente. */
  position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 50; overflow: hidden;
  display: flex; justify-content: center;
  /* fonte herdada do app (uma métrica só em todas as plataformas — o
     line-height .95 com stack própria sobrepunha linhas no SF Pro do iOS) */
  -webkit-font-smoothing: antialiased;
  background:
    radial-gradient(90% 46% at 88% 2%, rgba(255,182,214,.5) 0%, rgba(255,182,214,0) 60%),
    linear-gradient(180deg, #7ec6f6 0%, #a8d9fa 30%, #d8edfd 55%, #f2f8fd 80%, #ffffff 100%);
}
.apw-col {
  position: relative; width: 100%; max-width: 430px;
  display: flex; flex-direction: column;
  padding: 0 22px calc(20px + env(safe-area-inset-bottom));
}
.apw-glow {
  position: absolute; top: -6%; left: 50%; transform: translateX(-50%);
  width: 140%; height: 44%; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(255,255,255,.5), rgba(255,255,255,0));
}
.apw-grade {
  position: relative;
  /* SEM min() AQUI, e nao e estilo — e sobrevivencia (05/08, provado no
     Chromium 77 de verdade): clamp() nao parseia no 77 (fallback-first
     funciona), mas min() PARSEIA e computa 0 — ele engole o fallback e
     entrega margem zero. A sangria fixa de -33px fica a 3px do valor
     "ideal" e rende IGUAL em qualquer motor. */
  margin: calc(3.5vh + env(safe-area-inset-top)) -33px 0;
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; padding: 0 8px;
}
.apw-tile {
  /* min-height ANTES do aspect-ratio (88+): no WebView velho os azulejos
     colapsavam pra altura do emoji. 74px fica quase-quadrado na coluna. */
  min-height: 74px;
  aspect-ratio: 1; border-radius: 22px; display: grid; place-items: center;
  /* clamp e 79+ — sem o fallback o emoji caia pra 16px herdado (foto do
     dono: azulejo grande com emoji minusculo) */
  font-size: 38px;
  font-size: clamp(32px, 10vw, 46px);
  box-shadow: 0 18px 34px -12px rgba(20,60,110,.35);
}
.apw-grade .apw-tile:nth-child(odd) { transform: rotate(-3deg); }
.apw-grade .apw-tile:nth-child(even) { transform: rotate(3deg); }
.apw-corpo { flex: 1; display: flex; flex-direction: column; justify-content: space-evenly; padding-top: 1vh; }
.apw h1 {
  margin: 0; font-weight: 900; color: #141414; letter-spacing: -.035em;
  /* fallback primeiro: sem ele o titulo renderizava no tamanho de h1 padrao
     em WebView < 79 (clamp descartado) */
  line-height: 1.04; font-size: 46px; font-size: clamp(42px, 13vw, 58px);
}
.apw-sub { margin: 1.6vh 0 0; font-size: 16.5px; line-height: 1.45; color: #4f5a64; max-width: 24ch; }
.apw-prova { margin: 1.4vh 0 0; font-size: 14px; color: #7d8691; }
.apw-prova b { color: #141414; }
.apw-st { color: #f0a500; letter-spacing: .06em; }
/* margens em vez de gap de proposito: gap em FLEX e Chrome 84+ — com gap, o
   rodape colava CTA/link/termos em WebView velho. Margem rende IGUAL em
   qualquer motor (zero divergencia emulador × aparelho). */
.apw-rodape { display: flex; flex-direction: column; align-items: center; }
.apw-rodape > * + * { margin-top: 11px; }
.apw-cta {
  width: 100%; height: 58px; border: 0; border-radius: 999px;
  background: #16121c; color: #fff; font-size: 17.5px; font-weight: 800;
  font-family: inherit; cursor: pointer;
  box-shadow: 0 18px 38px -10px rgba(22,18,28,.5);
}
.apw-cta:active { transform: scale(.985); }
/* ALVO DE TOQUE DOS DOIS LINKS DE BAIXO (01/09 — caso real, com dinheiro).
 *
 * Estavam com padding zero: o alvo era só a altura do texto — 22px no "Entrar"
 * e 17px no "Restaurar compras", contra os 48dp que o Android manda. Uma
 * cliente que pagou R$24,90 por Pix na folha do Google precisava justamente do
 * "Restaurar compras" pra confirmar a compra, e relatou que "não é clicável".
 * Ela estava certa: 17px de alvo, cinza claro e sem sublinhado — parece
 * legenda, não botão.
 *
 * Agora: padding vertical que leva os dois pra ~44px, e o restaurar ganha
 * sublinhado e cor mais escura pra ANUNCIAR que é tocável. É a única saída de
 * quem pagou e voltou depois. */
.apw-link { border: 0; background: none; padding: 11px 16px; font-size: 14.5px; color: #4f5a64; font-family: inherit; cursor: pointer; }
.apw-link b { color: #16121c; }
.apw-restore { border: 0; background: none; padding: 12px 16px; font-size: 13px; color: #4f5a64; font-weight: 700;
  font-family: inherit; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.apw-restore:disabled { opacity: .6; }
.apw-msg { font-size: 11.5px; color: #4f5a64; }
.apw-termos { font-size: 11px; color: #9aa6b1; text-align: center; line-height: 1.5; }
.apw-trial { display: block; text-align: center; font-size: 11.5px; color: #4f5a64; font-weight: 600; margin-top: -2px; }
`;
