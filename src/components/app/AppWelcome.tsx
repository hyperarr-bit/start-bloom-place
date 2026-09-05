import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";
import { initRevenueCat, restaurar } from "@/lib/revenuecat";
import { MODULO_VISUAL, RECORTES_WELCOME } from "@/lib/funnel-icones";

/**
 * TELA 1 DO APP DAS LOJAS (Capacitor) — a CAPA (v105, 05/09, desenho aprovado
 * pelo dono no protótipo "CORE Lente").
 *
 * Um céu de dia. Os 8 módulos que os pagantes mais usam (ranking real de 30
 * dias: Finanças 85%, Rotina 76%, Treino 66%…) pousam como RECORTES do app em
 * volta da lente de vidro do CORE — a vida espalhada, reunida. A frase troca
 * dentro de uma linha de altura fixa (nunca empurra o resto), e o botão está
 * no PRIMEIRO QUADRO: 64 de 241 saídas na welcome aconteciam entre 0,5 e 3 s
 * — a pessoa via um quadro e ia embora; o quadro tem que vender e o botão tem
 * que estar lá. Ao tocar em Começar, as nuvens sobem e viram o branco do app
 * (exit do framer nas nuvens): continuidade, não corte.
 *
 * O que NÃO tem, de propósito: filtro SVG de deslocamento (o iPhone não
 * renderiza em elemento HTML — provado no protótipo 1), shorthand `inset`
 * (WebView < 87 descarta), `clamp()`/`min()` (Chromium 77 computa zero). A
 * cena é escalada por JS pra caber em qualquer altura, do 360×640 pra cima.
 * Só transform e opacidade animam.
 *
 * Papel da tela continua o mesmo: confirmar o download, dar o beat de marca e
 * entregar pro funil já aquecido (welcome → porta; as "promessas" saíram:
 * custavam 3,5 s por 1,5% de perda).
 */

const FRASES = ["num lugar só.", "em 5 min por dia.", "sem planilha.", "no seu ritmo."];
const LARGURA_CENA = 390;
const ALTURA_CENA = 440;
const RAIO_LENTE = 78;
const TOPO_CENA = 18;

const reduzMovimento = () => {
  try { return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; } catch { return false; }
};

/** v61: o "+1000" conta de 0 a 1000 (~900ms) — número que se move recebe o
 *  olhar (número-herói). rAF com ease-out cúbico; respeita reduced-motion. */
function Contador({ ate }: { ate: number }) {
  const [n, setN] = useState(ate);
  useEffect(() => {
    if (reduzMovimento()) return;
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

/** Um recorte: cartão branco com borda de adesivo, o tile pastel do módulo e
 *  um dado pequeno de verdade (saldo, hábitos, água…). Pousa de fora da tela
 *  e depois flutua — duas animações em camadas separadas pra não brigarem. */
function Recorte({ i, m, dado, x, y, r, s, pontos, barra }: (typeof RECORTES_WELCOME)[number] & { i: number }) {
  const v = MODULO_VISUAL[m];
  const cx = x + 62, cy = y + 26;
  const x0 = x + (cx - LARGURA_CENA / 2) * 1.8, y0 = y + (cy - 220) * 1.8;
  const Icon = v.Icon;
  return (
    <div
      className="apw-recorte"
      style={{
        ["--x" as string]: `${x}px`, ["--y" as string]: `${y}px`, ["--r" as string]: `${r}deg`,
        ["--x0" as string]: `${x0}px`, ["--y0" as string]: `${y0}px`, ["--d" as string]: `${0.12 + i * 0.07}s`,
        ["--cor" as string]: v.tinta,
      }}
    >
      <div className="apw-miolo" style={{ transform: `scale(${s})` }}>
        <span className="apw-tile" style={{ background: v.cor, color: v.tinta }}><Icon className="apw-ico" strokeWidth={2} /></span>
        <span className="apw-txt">
          <span className="apw-nome">{v.nome}</span>
          <span className="apw-dado">
            {pontos !== undefined && (
              <>
                {dado}
                {Array.from({ length: 5 }).map((_, k) => <i key={k} className={k < pontos ? "on" : ""} />)}
              </>
            )}
            {barra !== undefined && (<><span className="apw-barra"><b style={{ width: `${barra}%` }} /></span>{dado}</>)}
            {pontos === undefined && barra === undefined && dado}
          </span>
        </span>
      </div>
    </div>
  );
}

/** A cena: recortes + lente, escalada por JS pra caber na altura que sobra. A
 *  lente mostra o próprio céu ampliado (1,3×) — refração de verdade, sem
 *  filtro: a cópia do céu fica dentro dela e é deslocada pelo mesmo ponto. */
function Cena() {
  const ref = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState({ s: 1, lx: 0, ly: 0, w: 0, h: 0, ox: 0, oy: 0, tela: { w: 0, h: 0 } });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      const s = Math.min(w / LARGURA_CENA, (h - TOPO_CENA) / ALTURA_CENA, 1.05);
      const R = RAIO_LENTE * s;
      const lx = w / 2 - R, ly = TOPO_CENA + 220 * s - R;
      const rc = el.getBoundingClientRect();
      setGeo({ s, lx, ly, w: 2 * R, h: 2 * R, ox: rc.left + lx, oy: rc.top + ly, tela: { w: window.innerWidth, h: window.innerHeight } });
    };
    medir();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    window.addEventListener("resize", medir);
    const t = window.setTimeout(medir, 80);
    return () => { ro?.disconnect(); window.removeEventListener("resize", medir); window.clearTimeout(t); };
  }, []);
  const R = geo.w / 2;
  return (
    <div className="apw-cena" ref={ref} aria-hidden>
      <div className="apw-palco" style={{ transform: `scale(${geo.s})` }}>
        {RECORTES_WELCOME.map((rc, i) => <Recorte key={rc.m} i={i} {...rc} />)}
      </div>
      <div className="apw-lente" style={{ left: geo.lx, top: geo.ly, width: geo.w, height: geo.h }}>
        <div
          className="apw-refrata"
          style={{
            width: geo.tela.w, height: geo.tela.h,
            transformOrigin: `${geo.ox + R}px ${geo.oy + R}px`,
            transform: `translate(${-geo.ox}px, ${-geo.oy}px) scale(1.3)`,
          }}
        >
          <div className="apw-grad" />
          <svg><use href="#apw-nuvens" /></svg>
        </div>
        <div className="apw-brilho" />
        <div className="apw-marca" style={{ fontSize: 30 * geo.s }}>CORE</div>
      </div>
    </div>
  );
}

export function AppWelcome({ onComecar, onEntrar }: { onComecar: () => void; onEntrar?: () => void }) {
  const navigate = useNavigate();
  const [restaurando, setRestaurando] = useState(false);
  const [msgRestore, setMsgRestore] = useState<string | null>(null);
  const [fi, setFi] = useState(0);
  const [saindo, setSaindo] = useState<number | null>(null);

  useEffect(() => { trackEvent("app_welcome_view", {}); }, []);

  // A frase troca a cada 2,6 s dentro de uma linha de altura fixa: a que sai
  // sobe e some, a que entra vem de baixo. Reduced-motion: fica na primeira.
  useEffect(() => {
    if (reduzMovimento()) return;
    const id = window.setInterval(() => {
      setFi((atual) => { setSaindo(atual); return (atual + 1) % FRASES.length; });
      window.setTimeout(() => setSaindo(null), 450);
    }, 2600);
    return () => window.clearInterval(id);
  }, []);

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
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <defs>
          <filter id="apw-nuvem" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.011 0.018" numOctaves="5" seed="7" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.9 -0.62" result="a" />
            <feGaussianBlur in="a" stdDeviation="2.6" result="b" />
            <feComposite in="b" in2="SourceGraphic" operator="in" />
          </filter>
          <filter id="apw-nuvem2" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.03" numOctaves="4" seed="3" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.6 -0.55" result="a" />
            <feGaussianBlur in="a" stdDeviation="1.8" result="b" />
            <feComposite in="b" in2="SourceGraphic" operator="in" />
          </filter>
          <radialGradient id="apw-g1" cx="50%" cy="55%" r="50%"><stop offset="0" stopColor="#fff" /><stop offset=".55" stopColor="#fff" stopOpacity=".7" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
          <radialGradient id="apw-g2" cx="50%" cy="55%" r="50%"><stop offset="0" stopColor="#B9D0EA" /><stop offset=".6" stopColor="#B9D0EA" stopOpacity=".5" /><stop offset="1" stopColor="#B9D0EA" stopOpacity="0" /></radialGradient>
          <symbol id="apw-nuvens" viewBox="0 0 390 844" preserveAspectRatio="xMidYMax slice">
            <g filter="url(#apw-nuvem)" opacity=".55"><ellipse cx="96" cy="716" rx="270" ry="126" fill="url(#apw-g2)" /><ellipse cx="330" cy="660" rx="240" ry="118" fill="url(#apw-g2)" /></g>
            <g filter="url(#apw-nuvem)" opacity=".98"><ellipse cx="90" cy="704" rx="270" ry="126" fill="url(#apw-g1)" /><ellipse cx="330" cy="646" rx="240" ry="118" fill="url(#apw-g1)" /><ellipse cx="200" cy="800" rx="330" ry="160" fill="#fff" /></g>
            <g filter="url(#apw-nuvem2)" opacity=".8"><ellipse cx="60" cy="150" rx="130" ry="46" fill="url(#apw-g1)" /><ellipse cx="335" cy="262" rx="150" ry="52" fill="url(#apw-g1)" /></g>
          </symbol>
        </defs>
      </svg>

      <div className="apw-ceu" aria-hidden>
        <div className="apw-grad" />
        <div className="apw-sol" />
        {/* No Começar as nuvens SOBEM e viram o branco do app (exit do framer:
            o ComecarW tira a welcome de um AnimatePresence). */}
        <motion.div className="apw-nuvens" exit={{ y: -360, scale: 1.7, opacity: 0 }} transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}>
          <svg><use href="#apw-nuvens" /></svg>
        </motion.div>
      </div>

      <div className="apw-col">
        <Cena />

        <div className="apw-texto">
          <h1 className="apw-h1">
            <span className="apw-l">Sua vida inteira,</span>
            <span className="apw-l"><s>em 6 apps</s></span>
            <span className="apw-l apw-troca">
              {FRASES.map((f, i) => (
                <span key={f} className={`apw-fr${i === fi ? " ativa" : ""}${i === saindo ? " saindo" : ""}`}>{f}</span>
              ))}
            </span>
          </h1>
          <p className="apw-sub">Finanças, rotina, treino, saúde e metas. <b>16 módulos</b>, um app.</p>
          <p className="apw-prova">
            <span className="apw-st">★★★★★</span> <b><Contador ate={1000} /> pessoas</b> organizando a vida
          </p>
        </div>

        <div className="apw-rodape">
          <button
            className="apw-cta"
            onClick={() => { trackEvent("app_welcome_start", {}); onComecar(); }}
          >
            Começar <ArrowRight className="apw-seta" strokeWidth={2.2} />
          </button>
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
        </div>
      </div>
    </div>
  );
}

const CSS_APW = `
.apw {
  position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 50; overflow: hidden;
  display: flex; justify-content: center;
  -webkit-font-smoothing: antialiased;
  background: #5C9EE3;
}
.apw-ceu { position: absolute; top: 0; right: 0; bottom: 0; left: 0; overflow: hidden; }
.apw-grad { position: absolute; top: 0; right: 0; bottom: 0; left: 0;
  background: linear-gradient(180deg, #2F7BD0 0%, #5C9EE3 30%, #8DBDEE 56%, #C9E1F6 78%, #EAF2FA 100%); }
.apw-sol { position: absolute; left: -30%; top: -25%; width: 120%; height: 70%;
  background: radial-gradient(closest-side at 62% 40%, rgba(255,247,222,.6), rgba(255,247,222,0) 70%); }
.apw-nuvens { position: absolute; top: 0; right: 0; bottom: 0; left: 0; will-change: transform; }
.apw-nuvens svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }

.apw-col {
  position: relative; width: 100%; max-width: 430px;
  display: flex; flex-direction: column;
  padding: var(--app-safe-top, 0px) 22px calc(14px + env(safe-area-inset-bottom));
}
.apw-cena { flex: 1; min-height: 0; position: relative; overflow: hidden; margin: 0 -22px; }
.apw-palco { position: absolute; left: 50%; top: ${TOPO_CENA}px; width: ${LARGURA_CENA}px; height: ${ALTURA_CENA}px; margin-left: -${LARGURA_CENA / 2}px; transform-origin: top center; }

.apw-recorte { position: absolute; left: 0; top: 0; transform: translate(var(--x), var(--y)) rotate(var(--r));
  animation: apw-pousa .8s cubic-bezier(.22,1.25,.36,1) both; animation-delay: var(--d); will-change: transform; }
.apw-miolo { display: flex; align-items: center; gap: 8px; padding: 7px 12px 7px 8px; background: #fff; border-radius: 14px;
  box-shadow: 0 0 0 3px #fff, 0 12px 22px -12px rgba(20,33,58,.45);
  animation: apw-boia 6s ease-in-out infinite; animation-delay: calc(var(--d) + .8s); }
.apw-tile { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0; }
.apw-ico { width: 17px; height: 17px; }
.apw-txt { display: grid; gap: 2px; }
.apw-nome { font-size: 12.5px; line-height: 1; font-weight: 700; color: #1C1917; white-space: nowrap; }
.apw-dado { font-size: 11px; line-height: 1; font-weight: 500; color: #6B6661; white-space: nowrap; display: flex; align-items: center; gap: 4px; }
.apw-dado i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #E7E4DF; }
.apw-dado i.on { background: var(--cor, #D22D80); }
.apw-barra { display: inline-block; width: 54px; height: 5px; border-radius: 999px; background: #E7E4DF; overflow: hidden; }
.apw-barra b { display: block; height: 100%; background: var(--cor, #D22D80); border-radius: 999px; }
@keyframes apw-pousa { from { opacity: 0; transform: translate(var(--x0), var(--y0)) rotate(calc(var(--r) + 22deg)) scale(.7); }
  to { opacity: 1; transform: translate(var(--x), var(--y)) rotate(var(--r)) scale(1); } }
@keyframes apw-boia { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }

.apw-lente { position: absolute; overflow: hidden; border-radius: 50%;
  background: radial-gradient(120% 100% at 30% 22%, rgba(255,255,255,.72), rgba(255,255,255,.34) 48%, rgba(120,170,225,.30) 100%);
  -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
  box-shadow: inset 0 0 0 2px rgba(255,255,255,.95), inset 0 -30px 46px -18px rgba(31,90,170,.55), inset 0 26px 34px -24px #fff,
    inset 0 0 40px rgba(255,255,255,.35), 0 36px 60px -28px rgba(20,33,58,.6);
  animation: apw-lente-entra .7s cubic-bezier(.22,1.25,.36,1) both, apw-respira 7s ease-in-out 1s infinite; will-change: transform; }
@keyframes apw-lente-entra { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }
@keyframes apw-respira { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.03, .985); } }
.apw-refrata { position: absolute; left: 0; top: 0; transform-origin: 0 0; pointer-events: none; opacity: .55; }
.apw-refrata .apw-grad { position: absolute; top: 0; right: 0; bottom: 0; left: 0; }
.apw-refrata svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.apw-brilho { position: absolute; left: 14%; top: 7%; width: 44%; height: 18%; border-radius: 50%;
  background: linear-gradient(180deg, rgba(255,255,255,.95), rgba(255,255,255,0)); animation: apw-brilha 9s ease-in-out infinite; }
@keyframes apw-brilha { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(6px, 4px); } }
.apw-marca { position: absolute; top: 0; right: 0; bottom: 0; left: 0; display: grid; place-items: center;
  font-weight: 900; letter-spacing: -.02em; color: #1C1917; text-shadow: 0 1px 0 rgba(255,255,255,.6); }

.apw-texto { padding-top: 4px; }
.apw-h1 { margin: 0 0 10px; font-weight: 800; font-size: 28px; line-height: 1.12; letter-spacing: -.025em; color: #1C1917; }
.apw-l { display: block; height: 1.12em; position: relative; }
.apw-h1 s { text-decoration: none; color: #7A889B; font-weight: 500; position: relative; }
.apw-h1 s::after { content: ""; position: absolute; left: -2px; right: -2px; top: 54%; height: 3px; border-radius: 2px; background: #D22D80;
  transform: scaleX(0); transform-origin: left; animation: apw-risca .5s cubic-bezier(.23,1,.32,1) .9s forwards; }
@keyframes apw-risca { to { transform: scaleX(1); } }
.apw-fr { position: absolute; left: 0; top: 0; white-space: nowrap; opacity: 0; transform: translateY(10px);
  transition: opacity .4s, transform .45s cubic-bezier(.23,1,.32,1); }
.apw-fr.ativa { opacity: 1; transform: none; }
.apw-fr.saindo { opacity: 0; transform: translateY(-10px); }
.apw-sub { margin: 0 0 10px; font-size: 15px; line-height: 1.45; color: #3A4657; }
.apw-sub b { color: #1C1917; font-weight: 600; }
.apw-prova { margin: 0 0 6px; font-size: 13px; color: #3A4657; font-weight: 500; }
.apw-prova b { color: #1C1917; }
.apw-st { color: #f0a500; letter-spacing: .06em; }

.apw-rodape { display: flex; flex-direction: column; align-items: center; padding-top: 6px; }
.apw-rodape > * + * { margin-top: 6px; }
.apw-cta {
  width: 100%; height: 56px; border: 0; border-radius: 999px;
  background: #16121c; color: #fff; font-size: 16px; font-weight: 600;
  font-family: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
  box-shadow: 0 14px 26px -16px rgba(22,18,28,.65); transition: transform .12s cubic-bezier(.23,1,.32,1);
}
.apw-cta:active { transform: scale(.97); }
.apw-seta { width: 18px; height: 18px; }
.apw-link { border: 0; background: none; padding: 10px 16px; font-size: 14px; color: #3A4657; font-family: inherit; cursor: pointer; }
.apw-link b { color: #16121c; font-weight: 700; }
.apw-restore { border: 0; background: none; padding: 10px 16px; font-size: 12.5px; color: #3A4657; font-weight: 700;
  font-family: inherit; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.apw-restore:disabled { opacity: .6; }
.apw-msg { font-size: 11.5px; color: #3A4657; }
.apw-termos { font-size: 11px; color: #5C6B7A; text-align: center; line-height: 1.5; }

@media (prefers-reduced-motion: reduce) {
  .apw-recorte, .apw-miolo, .apw-lente, .apw-brilho { animation: none !important; }
  .apw-h1 s::after { animation: none; transform: scaleX(1); }
  .apw-fr { transition: none; }
}
`;
