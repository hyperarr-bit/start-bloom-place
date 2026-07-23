import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
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
export function AppWelcome({ onComecar }: { onComecar: () => void }) {
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

      <div className="apw-grade" aria-hidden>
        {TILES.map(([emo, cor], i) => (
          <motion.span
            key={emo} className="apw-tile" style={{ background: cor }}
            initial={{ opacity: 0, y: -18, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.06 + i * 0.055, type: "spring", stiffness: 300, damping: 22 }}
          >{emo}</motion.span>
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
            Finanças, rotina, corpo, metas — tudo organizado num lugar só.
          </motion.p>
          <motion.p
            className="apw-prova"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            <span className="apw-st">★★★★★</span> <b>+500 pessoas</b> organizando a vida
          </motion.p>
        </div>

        <motion.div
          className="apw-rodape"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72, duration: 0.4 }}
        >
          <button
            className="apw-cta"
            onClick={() => { trackEvent("app_welcome_start", {}); onComecar(); }}
          >
            Começar
          </button>
          <button className="apw-link" onClick={() => { trackEvent("app_welcome_login", {}); navigate("/entrar"); }}>
            Já tenho conta? <b>Entrar</b>
          </button>
          <button className="apw-restore" onClick={tentarRestaurar} disabled={restaurando}>
            {restaurando ? "Verificando…" : "Restaurar compras"}
          </button>
          {msgRestore && <span className="apw-msg">{msgRestore}</span>}
          <span className="apw-termos">Ao continuar, você aceita nossos Termos e Aviso de Privacidade</span>
        </motion.div>
      </div>
    </div>
  );
}

const CSS_APW = `
.apw {
  position: fixed; inset: 0; z-index: 50; overflow: hidden;
  display: flex; flex-direction: column;
  padding: 0 22px calc(20px + env(safe-area-inset-bottom));
  /* fonte herdada do app (uma métrica só em todas as plataformas — o
     line-height .95 com stack própria sobrepunha linhas no SF Pro do iOS) */
  -webkit-font-smoothing: antialiased;
  background:
    radial-gradient(90% 46% at 88% 2%, rgba(255,182,214,.5) 0%, rgba(255,182,214,0) 60%),
    linear-gradient(180deg, #7ec6f6 0%, #a8d9fa 30%, #d8edfd 55%, #f2f8fd 80%, #ffffff 100%);
}
.apw-glow {
  position: absolute; top: -6%; left: 50%; transform: translateX(-50%);
  width: 140%; height: 44%; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(255,255,255,.5), rgba(255,255,255,0));
}
.apw-grade {
  position: relative;
  margin: calc(3.5vh + env(safe-area-inset-top)) calc(-22px - 3vw) 0;
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; padding: 0 8px;
}
.apw-tile {
  aspect-ratio: 1; border-radius: 22px; display: grid; place-items: center;
  font-size: clamp(32px, 10vw, 46px);
  box-shadow: 0 18px 34px -12px rgba(20,60,110,.35);
}
.apw-grade .apw-tile:nth-child(odd) { transform: rotate(-3deg); }
.apw-grade .apw-tile:nth-child(even) { transform: rotate(3deg); }
.apw-corpo { flex: 1; display: flex; flex-direction: column; justify-content: space-evenly; padding-top: 1vh; }
.apw h1 {
  margin: 0; font-weight: 900; color: #141414; letter-spacing: -.035em;
  line-height: 1.04; font-size: clamp(42px, 13vw, 58px);
}
.apw-sub { margin: 1.6vh 0 0; font-size: 16.5px; line-height: 1.45; color: #4f5a64; max-width: 24ch; }
.apw-prova { margin: 1.4vh 0 0; font-size: 14px; color: #7d8691; }
.apw-prova b { color: #141414; }
.apw-st { color: #f0a500; letter-spacing: .06em; }
.apw-rodape { display: flex; flex-direction: column; align-items: center; gap: 11px; }
.apw-cta {
  width: 100%; height: 58px; border: 0; border-radius: 999px;
  background: #16121c; color: #fff; font-size: 17.5px; font-weight: 800;
  font-family: inherit; cursor: pointer;
  box-shadow: 0 18px 38px -10px rgba(22,18,28,.5);
}
.apw-cta:active { transform: scale(.985); }
.apw-link { border: 0; background: none; padding: 0; font-size: 14.5px; color: #4f5a64; font-family: inherit; cursor: pointer; }
.apw-link b { color: #16121c; }
.apw-restore { border: 0; background: none; padding: 0; font-size: 12px; color: #8a94a0; font-weight: 600; font-family: inherit; cursor: pointer; }
.apw-restore:disabled { opacity: .6; }
.apw-msg { font-size: 11.5px; color: #4f5a64; }
.apw-termos { font-size: 11px; color: #9aa6b1; text-align: center; line-height: 1.5; }
`;
