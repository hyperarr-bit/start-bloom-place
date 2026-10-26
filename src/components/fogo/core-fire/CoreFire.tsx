import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { CORE_FIRE_COLORS, FIRE_BODY_FRAMES, FIRE_INNER_FRAMES, FIRE_KEY_TIMES, FIRE_BODY_DURATION, FIRE_INNER_DURATION, fireClockPhase, toneForDays, type CoreFireStatus, type CoreFireTone } from "./core-fire-data";
import "./core-fire.css";
export type { CoreFireStatus, CoreFireTone } from "./core-fire-data";

/*
 * A CHAMA SEM BORDA do Codex (pacote "core-fire 3", 26/10) — o componente do pacote, com UMA mudança de integração:
 * a CONTINUIDADE ao remontar. O SMIL começa do quadro 0 quando o <svg> entra na página; trocar de aba / voltar pra
 * Home fazia a chama "recomeçar com pulo". Agora, toda vez que o movimento liga (montagem, volta da aba oculta, volta
 * pra tela), o relógio do SVG é posto na fase do relógio do aparelho (`fireClockPhase`) — a chama continua de onde
 * "estaria". Fora isso: só React, sem dependência; pausa fora da tela, em aba oculta e com redução de movimento.
 */
type Props = {
  tone?: CoreFireTone | "auto";
  days?: number;
  status?: CoreFireStatus;
  /** Altura em px; a largura segue a proporção original 28:32. */
  size?: number;
  motion?: boolean;
  /** Incrementar num registro/marco real. Nunca celebra na montagem inicial. */
  celebrationKey?: number;
  label?: string;
  className?: string;
  style?: CSSProperties;
};

type SvgComRelogio = SVGSVGElement & { setCurrentTime?: (s: number) => void };

const reduzirMovimento = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A silhueta exata da Home, sem contorno. Este componente nunca lê nem grava dado do usuário. */
export function CoreFire({ tone = "home", days = 0, status = "done", size = 24, motion = true, celebrationKey = 0, label, className = "", style }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const lastCelebration = useRef(0);
  const [celebrating, setCelebrating] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  const [reduced, setReduced] = useState(reduzirMovimento);
  useEffect(() => {
    const query = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const update = () => setReduced(!!query?.matches);
    query?.addEventListener?.("change", update);
    const visibility = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", visibility);
    const observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting)) : null;
    if (ref.current) observer?.observe(ref.current);
    return () => { query?.removeEventListener?.("change", update); document.removeEventListener("visibilitychange", visibility); observer?.disconnect(); };
  }, []);
  const selected: CoreFireTone = status === "unstarted" ? "gray" : tone === "auto" ? toneForDays(days) : tone;
  const color = CORE_FIRE_COLORS[selected];
  const animate = motion && !reduced && visible && pageVisible && status === "done" && selected !== "gray";
  // a continuidade: antes de pintar, o relógio do SVG vai pra fase do relógio do aparelho
  useLayoutEffect(() => {
    if (!animate) return;
    const svg = ref.current as SvgComRelogio | null;
    try { svg?.setCurrentTime?.(fireClockPhase()); } catch { /* sem SMIL (jsdom): nada a sincronizar */ }
  }, [animate]);
  useEffect(() => {
    if (celebrationKey <= 0 || celebrationKey === lastCelebration.current) return;
    lastCelebration.current = celebrationKey;
    if (!animate) return;
    setCelebrating(true);
    const timer = window.setTimeout(() => setCelebrating(false), 1100);
    return () => { window.clearTimeout(timer); setCelebrating(false); };
  }, [celebrationKey, animate]);
  const vars = { "--cf-body": color.body, "--cf-inner": color.inner, ...style } as CSSProperties;
  return <svg ref={ref} className={`core-fire ${className}`.trim()} style={vars} width={size * 28 / 32} height={size} viewBox="0 0 28 32" fill="none" data-status={status} data-tone={selected} data-motion={animate ? "on" : "off"} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <g key={celebrationKey} className={animate && celebrating ? "cf-ignite" : undefined}>
      <g className="cf-moving">
        <path className="cf-body" fill={color.body} d={FIRE_BODY_FRAMES[0]}>{animate && <animate attributeName="d" values={FIRE_BODY_FRAMES.join(";")} dur={FIRE_BODY_DURATION} keyTimes={FIRE_KEY_TIMES} calcMode="linear" repeatCount="indefinite"/>}</path>
        <path className="cf-inner" fill={color.inner} d={FIRE_INNER_FRAMES[0]}>{animate && <animate attributeName="d" values={FIRE_INNER_FRAMES.join(";")} dur={FIRE_INNER_DURATION} keyTimes={FIRE_KEY_TIMES} calcMode="linear" repeatCount="indefinite"/>}</path>
      </g>
      <g className="cf-still"><path fill={color.body} d={FIRE_BODY_FRAMES[0]}/><path fill={color.inner} d={FIRE_INNER_FRAMES[0]}/></g>
      {animate && celebrating && <g className="cf-sparks" fill={color.body}><circle className="cf-spark cf-spark-a" cx="7" cy="9" r=".65"/><circle className="cf-spark cf-spark-b" cx="22" cy="12" r=".55"/><circle className="cf-spark cf-spark-c" cx="18" cy="5" r=".45"/></g>}
    </g>
  </svg>;
}
