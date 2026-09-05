import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import {
  passosDoCoach, marcarCoachVisto, retanguloDoSpotlight, posicaoDoCard, alvoVisivel,
  type Retangulo,
} from "./coach-passos";

/**
 * DEMO GUIADA (v105) — coach-mark de 3 passos por cima do módulo real.
 *
 * Substitui a DicaDemoShell (v83.1): a dica genérica de 6s era vista por
 * todo mundo e não apontava nada do módulo que a pessoa escolheu. Aqui cada
 * passo recorta o alvo (spotlight) e explica em duas linhas; o 3º passo é
 * sempre a barra dos outros módulos. Toque no escuro ou em "Próximo" avança.
 *
 * Mecânica:
 *  - o alvo é medido na hora (getBoundingClientRect) e remedido em resize,
 *    scroll e a cada 250ms — o módulo hidrata dados depois do mount e cards
 *    mudam de lugar;
 *  - alvo fora da área útil (atrás dos headers grudados ou sob o CTA fixo) é
 *    trazido pro meio uma vez por passo; alvo dentro de header grudado não
 *    rola (a página pularia pro topo à toa);
 *  - sem alvo (aba diferente, elemento ausente): card no centro, tela
 *    escurecida sem recorte;
 *  - prefers-reduced-motion: nada anima; senão o card entra em 200ms só com
 *    opacity/transform (barato na GPU do aparelho popular).
 *
 * Quem decide SE ele aparece (funil do shell, 1× por sessão, 1º módulo) é o
 * Preview; aqui só se marca a sessão quando de fato apareceu.
 */
const ESCURO = "rgba(28,25,23,.58)";
/** Altura do CTA fixo do rodapé da demo (+ safe area): o card não pousa nele. */
const RESERVA_BASE = 96;
/** Espera o PageTransition (180ms) e a hidratação dos dados de exemplo antes de escurecer a tela. */
const ATRASO_PADRAO_MS = 350;

const reduzMovimento = (): boolean => {
  try { return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true; } catch { return false; }
};
const mesmoRet = (a: Retangulo | null, b: Retangulo | null): boolean =>
  (!a && !b) || (!!a && !!b && ["top", "left", "width", "height"].every((k) => Math.round(a[k as keyof Retangulo]) === Math.round(b[k as keyof Retangulo])));
/** Fim dos elementos grudados no topo (barra do tour + header do módulo). */
const reservaTopo = (): number => {
  try {
    const nav = document.querySelector(".demo-tour-nav")?.getBoundingClientRect().bottom ?? 0;
    const header = document.querySelector("header.sticky")?.getBoundingClientRect().bottom ?? 0;
    return Math.max(0, nav, header);
  } catch { return 0; }
};

export const DemoCoach = ({ module, onDone, atrasoMs = ATRASO_PADRAO_MS }: { module: string; onDone: () => void; atrasoMs?: number }) => {
  const passos = passosDoCoach(module);
  const [pronto, setPronto] = useState(atrasoMs <= 0);
  const [idx, setIdx] = useState(0);
  const [alvo, setAlvo] = useState<Retangulo | null>(null);
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [alturaCard, setAlturaCard] = useState(180);
  const cardRef = useRef<HTMLDivElement>(null);
  const fechouRef = useRef(false);
  const vistosRef = useRef(0);
  const semMovimento = reduzMovimento();
  const passo = passos[idx];

  useEffect(() => {
    if (pronto) return;
    const t = window.setTimeout(() => setPronto(true), atrasoMs);
    return () => window.clearTimeout(t);
  }, [pronto, atrasoMs]);

  // 1× por sessão: a marca vale quando o coach de fato apareceu.
  useEffect(() => { if (pronto) marcarCoachVisto(); }, [pronto]);

  useEffect(() => {
    if (!pronto) return;
    vistosRef.current = Math.max(vistosRef.current, idx + 1);
    trackEvent("demo_coach_view", { passo: idx + 1, module });
  }, [pronto, idx, module]);

  const concluir = useCallback(() => {
    if (fechouRef.current) return;
    fechouRef.current = true;
    trackEvent("demo_coach_done", { module, passos: vistosRef.current });
    onDone();
  }, [module, onDone]);

  // Desmontou no meio (trocou de módulo, Voltar do Android): conta o que viu.
  useEffect(() => () => {
    if (fechouRef.current || vistosRef.current === 0) return;
    fechouRef.current = true;
    trackEvent("demo_coach_done", { module, passos: vistosRef.current });
  }, [module]);

  // Mede o alvo do passo e acompanha a tela.
  useEffect(() => {
    if (!pronto) return;
    let rolou = false;
    const medir = () => {
      const el = passo.alvo();
      const r = el?.getBoundingClientRect();
      const ret: Retangulo | null = alvoVisivel(r) ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
      const vw = window.innerWidth, vh = window.innerHeight;
      setVp((p) => (p.w === vw && p.h === vh ? p : { w: vw, h: vh }));
      setAlvo((p) => (mesmoRet(p, ret) ? p : ret));
      if (!ret || !el || rolou) return;
      rolou = true;
      const grudado = !!el.closest("header, .demo-tour-nav");
      const foraDaAreaUtil = ret.top < reservaTopo() || ret.top + ret.height > vh - RESERVA_BASE;
      if (!grudado && foraDaAreaUtil) {
        try { el.scrollIntoView({ block: "center", behavior: semMovimento ? "auto" : "smooth" }); } catch { /* WebView velho */ }
      }
    };
    medir();
    const id = window.setInterval(medir, 250);
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [pronto, passo, semMovimento]);

  // Altura real do card (muda com o texto e com a fonte do sistema).
  useLayoutEffect(() => {
    const h = cardRef.current?.getBoundingClientRect().height;
    if (h && Math.round(h) !== Math.round(alturaCard)) setAlturaCard(h);
  });

  if (!pronto) return null;

  const spot = alvo ? retanguloDoSpotlight(alvo, vp.w, vp.h) : null;
  const pos = posicaoDoCard(spot, alturaCard, vp.h, reservaTopo(), RESERVA_BASE);
  const ultimo = idx === passos.length - 1;
  const avancar = () => (ultimo ? concluir() : setIdx((i) => Math.min(i + 1, passos.length - 1)));
  const anim = semMovimento ? "" : "animate-in fade-in slide-in-from-bottom-2 duration-200";

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Dica da demo" data-testid="demo-coach">
      {/* Pega o toque no escuro: avança. Sem alvo, ele mesmo escurece a tela. */}
      <div className="absolute inset-0" style={{ background: spot ? "transparent" : ESCURO }} onClick={avancar} aria-hidden="true" />
      {spot && (
        <div
          data-testid="demo-coach-spotlight"
          className="fixed rounded-[14px] pointer-events-none"
          style={{
            top: spot.top, left: spot.left, width: spot.width, height: spot.height,
            boxShadow: `0 0 0 9999px ${ESCURO}, 0 0 0 3px hsl(var(--accent))`,
          }}
        />
      )}
      {/* Cores fixas de propósito: o card é branco também no tema escuro do módulo. */}
      <div className="fixed left-4 right-4 mx-auto max-w-[360px] pointer-events-auto" style={{ top: pos.top }} data-lugar={pos.lugar}>
        <div key={idx} ref={cardRef} className={`rounded-[18px] bg-white text-[#1c1917] p-4 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45)] ${anim}`}>
          <div className="flex items-start gap-3">
            <span className="grid place-items-center w-7 h-7 rounded-full bg-[hsl(330,65%,50%)] text-white text-[13px] font-bold shrink-0" aria-hidden="true">{idx + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold leading-snug">{passo.titulo}</p>
              <p className="text-[13px] text-[#57534e] leading-snug mt-1">{passo.texto}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5" role="img" aria-label={`Passo ${idx + 1} de ${passos.length}`}>
              {passos.map((_, i) => (
                <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === idx ? "bg-[hsl(330,65%,50%)]" : "bg-[#d6d3d1]"}`} />
              ))}
            </div>
            <button
              type="button"
              onClick={avancar}
              className="inline-flex items-center justify-center min-h-11 rounded-full bg-[#333333] text-white text-[13px] font-semibold px-5 active:bg-[#222222]"
            >
              {ultimo ? "Entendi" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
