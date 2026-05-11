import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";

export interface SpotlightStep {
  selector: string;
  label: string;
  advanceOnClick?: boolean;
  advanceOnAction?: string;
  /** Optional: storage key to inspect; if it already has data on mount, auto-advance. */
  checkKey?: string;
}

interface SpotlightOverlayProps {
  moduleKey: "financas" | "rotina" | "dieta" | "treino";
  steps: SpotlightStep[];
  activationActions?: string[];
}

interface Rect { top: number; left: number; width: number; height: number }

const PADDING = 8;

export const SpotlightOverlay = ({ moduleKey, steps, activationActions = [] }: SpotlightOverlayProps) => {
  const { get, set, isGuest } = useUserData();
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Refs keep the activation listener stable across step changes,
  // so events fired in the same tick aren't lost.
  const stepIdxRef = useRef(0);
  const stepsRef = useRef(steps);
  stepIdxRef.current = stepIdx;
  stepsRef.current = steps;

  useEffect(() => {
    if (!isGuest) return;
    const target = get<string>("quickstart-target-module", "");
    const done = get<string>(`spotlight-done-${moduleKey}`, "");
    if (target === moduleKey && !done) {
      setActive(true);
      trackEvent("spotlight_shown", { module: moduleKey });
    }
  }, [moduleKey, get, isGuest]);

  const finish = useCallback((reason: "completed" | "dismissed") => {
    set(`spotlight-done-${moduleKey}`, "true");
    if (reason === "completed") set("quickstart-target-module", "");
    trackEvent(reason === "completed" ? "quickstart_completed" : "spotlight_dismissed", { module: moduleKey });
    setActive(false);
  }, [set, moduleKey]);

  const finishRef = useRef(finish);
  finishRef.current = finish;

  const advance = useCallback(() => {
    const idx = stepIdxRef.current;
    const total = stepsRef.current.length;
    if (idx >= total - 1) finishRef.current("completed");
    else setStepIdx(idx + 1);
  }, []);

  // Single, stable activation listener
  useEffect(() => {
    if (!active) return;
    const onActivation = (e: Event) => {
      const detail = (e as CustomEvent).detail as { action?: string } | undefined;
      const action = detail?.action;
      if (!action) return;
      const cur = stepsRef.current[stepIdxRef.current];
      if (cur?.advanceOnAction === action) {
        advance();
      } else if (activationActions.includes(action)) {
        finishRef.current("completed");
      }
    };
    window.addEventListener("core:activation", onActivation);
    return () => window.removeEventListener("core:activation", onActivation);
  }, [active, advance, activationActions]);

  // Fallback: if data for this step already exists, auto-advance.
  useEffect(() => {
    if (!active) return;
    const cur = steps[stepIdx];
    if (!cur?.checkKey) return;
    const v = get<any>(cur.checkKey, null);
    const has =
      v != null &&
      ((Array.isArray(v) && v.length > 0) ||
        (typeof v === "object" && Object.keys(v).length > 0) ||
        (typeof v === "string" && v.trim().length > 0));
    if (has) {
      const t = setTimeout(() => advance(), 400);
      return () => clearTimeout(t);
    }
  }, [active, stepIdx, steps, get, advance]);

  // Measure target & re-measure
  useEffect(() => {
    if (!active) return;
    const step = steps[stepIdx];
    if (!step) return;

    const measure = () => {
      const el = document.querySelector(step.selector);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    measure();
    const interval = setInterval(measure, 250);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    const onPageClick = (e: MouseEvent) => {
      const target = document.querySelector(step.selector);
      if (!target) return;
      if (target.contains(e.target as Node)) {
        if (step.advanceOnAction) return;
        if (step.advanceOnClick !== false) {
          setTimeout(() => advance(), 250);
        }
      }
    };
    document.addEventListener("click", onPageClick, true);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      document.removeEventListener("click", onPageClick, true);
    };
  }, [active, stepIdx, steps, advance]);

  const step = active ? steps[stepIdx] : null;

  const scrollToTarget = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [step]);

  if (!active || !step) return null;

  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  const labelBelow = rect ? rect.top < 110 : true;

  const offScreen: "above" | "below" | null = !rect
    ? null
    : rect.top + rect.height < 60
      ? "above"
      : rect.top > viewportH - 60
        ? "below"
        : null;

  // Dim only on navigation steps
  const dim = !step.advanceOnAction;

  return (
    <AnimatePresence>
      <motion.div
        key="spotlight-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[200] pointer-events-none"
      >
        {dim && (rect ? (
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <mask id={`spot-mask-${moduleKey}`}>
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={rect.left - PADDING}
                  y={rect.top - PADDING}
                  width={rect.width + PADDING * 2}
                  height={rect.height + PADDING * 2}
                  rx={10}
                  fill="black"
                />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.65)" mask={`url(#spot-mask-${moduleKey})`} />
          </svg>
        ) : (
          <div className="absolute inset-0 bg-black/60" />
        ))}

        {rect && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: [1, 1.06, 1], opacity: 1 }}
            transition={{ scale: { duration: 1.4, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 0.3 } }}
            className="absolute rounded-[12px] border-2 border-primary"
            style={{
              top: rect.top - PADDING,
              left: rect.left - PADDING,
              width: rect.width + PADDING * 2,
              height: rect.height + PADDING * 2,
              boxShadow: "0 0 0 4px hsl(var(--primary) / 0.25), 0 0 30px hsl(var(--primary) / 0.45)",
            }}
          />
        )}

        {rect && (
          <motion.div
            key={`bubble-${stepIdx}`}
            initial={{ opacity: 0, y: labelBelow ? -8 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.25 }}
            className="absolute pointer-events-auto"
            style={{
              top: labelBelow ? rect.top + rect.height + PADDING + 8 : Math.max(8, rect.top - 90),
              left: Math.max(12, Math.min(rect.left + rect.width / 2 - 130, window.innerWidth - 272)),
              width: 260,
            }}
          >
            <div className="relative">
              {labelBelow && (
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -top-6 left-1/2 -translate-x-1/2"
                >
                  <ArrowDown className="w-6 h-6 text-primary rotate-180" strokeWidth={3} />
                </motion.div>
              )}
              <div className="bg-card border border-primary/40 rounded-xl shadow-2xl p-3 relative">
                <p className="text-[10px] uppercase tracking-wider font-bold text-primary mb-1">
                  Passo {stepIdx + 1} de {steps.length}
                </p>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {step.label}
                </p>
              </div>
              {!labelBelow && (
                <motion.div
                  animate={{ y: [0, 6, 0] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -bottom-6 left-1/2 -translate-x-1/2"
                >
                  <ArrowDown className="w-6 h-6 text-primary" strokeWidth={3} />
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {offScreen && (
          <motion.button
            key={`offscreen-${offScreen}`}
            initial={{ opacity: 0, y: offScreen === "below" ? 20 : -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={scrollToTarget}
            className={`fixed left-1/2 -translate-x-1/2 pointer-events-auto bg-primary text-primary-foreground rounded-full shadow-2xl px-4 py-2 flex items-center gap-2 text-xs font-bold z-[210] ${
              offScreen === "below" ? "bottom-6" : "top-6"
            }`}
          >
            {offScreen === "below" ? (
              <>
                <motion.span animate={{ y: [0, 3, 0] }} transition={{ duration: 1, repeat: Infinity }}>
                  <ArrowDown className="w-4 h-4" strokeWidth={3} />
                </motion.span>
                Role pra baixo
              </>
            ) : (
              <>
                <motion.span animate={{ y: [0, -3, 0] }} transition={{ duration: 1, repeat: Infinity }}>
                  <ArrowUp className="w-4 h-4" strokeWidth={3} />
                </motion.span>
                Role pra cima
              </>
            )}
          </motion.button>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
